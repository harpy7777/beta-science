// src/lib/examService.ts
import {
  collection, addDoc, getDocs, doc, getDoc, setDoc,
  updateDoc, query, where, orderBy, Timestamp, serverTimestamp, deleteDoc
} from 'firebase/firestore';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { db, auth } from './firebase';

// ─────────────────────────────────────────────
// ★ 학생 인증 보장 (선생님 로그인은 절대 건드리지 않음)
// 동작 원리:
//   1) Firebase가 초기 인증 상태를 복원할 때까지 기다린다 (waitForAuthReady).
//   2) 그 뒤에도 로그인한 사람이 아무도 없을 때만(= 학생) 익명 로그인.
//   3) 익명 로그인이 실패해도 throw하지 않음.
let authReadyPromise: Promise<void> | null = null;
function waitForAuthReady(): Promise<void> {
  if (authReadyPromise) return authReadyPromise;
  authReadyPromise = new Promise<void>((resolve) => {
    const unsub = onAuthStateChanged(auth, () => { unsub(); resolve(); });
  });
  return authReadyPromise;
}

async function ensureAuth(): Promise<void> {
  try {
    await waitForAuthReady();
    if (!auth.currentUser) {
      await signInAnonymously(auth);
    }
  } catch (e) {
    console.warn('[examService] ensureAuth skipped:', e);
  }
}
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// ★ 채점 정규화: "선택지3","3번","3" → "3" / "O","X" → 대문자 통일
function normalizeAnswer(val: string | undefined | null): string {
  if (val === undefined || val === null) return '';
  const str = String(val).trim();
  if (/^[oOxX]$/.test(str)) return str.toUpperCase();
  const numMatch = str.match(/\d+/);
  if (numMatch) return numMatch[0];
  return str;
}

// ★ 학생답과 정답이 일치하는지 판정 (모든 채점은 이 함수를 사용)
export function isAnswerCorrect(
  studentAnswer: string | undefined | null,
  correctAnswer: string | undefined | null
): boolean {
  const a = normalizeAnswer(studentAnswer);
  const b = normalizeAnswer(correctAnswer);
  return a !== '' && a === b;
}

// ★ 정답을 학생에게 보기 좋게 표시 ("선택지3" → "3번 - 유리")
export function formatCorrectAnswer(question: {
  type: 'ox' | 'multiple';
  answer: string;
  options?: string[];
}): string {
  if (question.type === 'ox') {
    return normalizeAnswer(question.answer); // O 또는 X
  }
  const num = normalizeAnswer(question.answer);
  const idx = Number(num) - 1;
  const optText = question.options?.[idx];
  if (num && optText) return `${num}번 - ${optText}`;
  const foundIdx = question.options?.findIndex(opt => opt === question.answer);
  if (foundIdx !== undefined && foundIdx >= 0) return `${foundIdx + 1}번 - ${question.answer}`;
  return question.answer;
}
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// ★ 단원 자연 정렬
function circledToNumber(ch: string): number {
  const code = ch.codePointAt(0) ?? 0;
  if (code >= 0x2460 && code <= 0x2473) return code - 0x2460 + 1; // ① ~ ⑳
  return 0;
}

const ORDER_MAX = Number.MAX_SAFE_INTEGER;

function getUnitOrder(title: string): [number, number, number] {
  const t = (title ?? '').trim();

  let major = ORDER_MAX;
  let minor = ORDER_MAX;

  const dash = t.match(/(\d+)\s*-\s*(\d+)/);
  if (dash) {
    major = parseInt(dash[1], 10);
    minor = parseInt(dash[2], 10);
  } else {
    const danwon = t.match(/(\d+)\s*단원/);
    if (danwon) {
      major = parseInt(danwon[1], 10);
      minor = 0;
    }
  }

  let sub = ORDER_MAX;
  for (const ch of t) {
    const n = circledToNumber(ch);
    if (n > 0) { sub = n; break; }
  }
  if (sub === ORDER_MAX) {
    const paren = t.match(/[(（]\s*(\d+)\s*[)）]/);
    if (paren) sub = parseInt(paren[1], 10);
  }

  return [major, minor, sub];
}

function tsToMillis(ts: any): number {
  if (!ts) return 0;
  if (typeof ts.toDate === 'function') return ts.toDate().getTime();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  return new Date(ts).getTime();
}

function sortExamsByUnit(exams: Exam[]): Exam[] {
  return [...exams].sort((a, b) => {
    const oa = getUnitOrder(a.title);
    const ob = getUnitOrder(b.title);
    if (oa[0] !== ob[0]) return oa[0] - ob[0];
    if (oa[1] !== ob[1]) return oa[1] - ob[1];
    if (oa[2] !== ob[2]) return oa[2] - ob[2];
    return tsToMillis(a.regDate) - tsToMillis(b.regDate);
  });
}
// ─────────────────────────────────────────────

export type QuestionType = 'ox' | 'multiple';

export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  options?: string[];
  answer: string;
  explanation?: string;
}

export interface Exam {
  id?: string;
  title: string;
  teacherId: string;
  questions: Question[];
  oxQuestions?: Question[];
  multipleQuestions?: Question[];
  createdAt?: Timestamp;
  regDate?: Timestamp;
  isPublished: boolean;
  accessCode?: string;
  grade?: string;
  subject?: string;
  codepenUrl?: string;
}

// ★ 유형별 응시 현황 요약 (결과 화면 · 완료 판정에 사용)
export interface SubmissionSummary {
  oxTotal: number;        // 시험지의 OX 문항 수
  multiTotal: number;     // 시험지의 4지선다 문항 수
  oxDone: boolean;        // OX를 응시했는가
  multiDone: boolean;     // 4지선다를 응시했는가
  oxScore: number | null;
  multiScore: number | null;
  oxCorrect: number;
  multiCorrect: number;
  overallScore: number;   // 응시한 문항 전체 기준 점수
  totalCorrect: number;
  answeredCount: number;
  allDone: boolean;       // 이 시험지에 있는 유형을 전부 끝냈는가
}

export interface StudentAnswer {
  id?: string;
  examId: string;
  studentName: string;
  studentId?: string;
  answers: Record<string, string>;
  score: number;
  totalQuestions: number;
  submittedAt?: Timestamp;
  timestamp?: Timestamp;
  firstSubmittedAt?: Timestamp;
  testName?: string;
  date?: string;
  grade?: string;
  // ★ 유형별 (대시보드 · 학생 상세가 읽는 필드)
  ox?: { score: number; correct: number; total: number } | null;
  multiple?: { score: number; correct: number; total: number } | null;
  oxScore?: number | null;
  multiScore?: number | null;
  oxCount?: number;
  multiCount?: number;
  correctCount?: number;
  answeredCount?: number;
  subType?: QuestionType | null;
  subTypes?: QuestionType[];
  lastSubType?: QuestionType | null;
}

export interface AcademySettings {
  entranceCode: string;
  updatedAt?: Timestamp;
}

export interface Result {
  id?: string;
  examId: string;
  examTitle: string;
  studentName: string;
  studentId?: string;
  grade: string;
  subject?: string;
  startedAt: string;
  score: number | null;
  totalQuestions: number;
  wrongCount: number | null;
}

// ★ 허용된 학년 목록
export const VALID_GRADES = ['중1', '중2', '중3', '고1', '고2', '고3'];

// ★ 학생 ID 표준화: 앞뒤 공백 제거 + 소문자.
//   students 컬렉션의 id가 소문자로 저장돼 있고 getStudentById도 소문자로 조회하므로
//   grades에도 반드시 같은 형태로 넣어야 대시보드의 학생 매칭이 성립한다.
function normalizeStudentId(sid: string | undefined | null): string {
  return String(sid ?? '').trim().toLowerCase();
}

function removeUndefined(obj: unknown): unknown {
  return JSON.parse(JSON.stringify(obj));
}

export async function getAcademyEntranceCode(): Promise<string | null> {
  const snap = await getDoc(doc(db, 'settings', 'academy'));
  if (!snap.exists()) return null;
  return (snap.data() as AcademySettings).entranceCode ?? null;
}

export async function setAcademyEntranceCode(code: string): Promise<void> {
  await updateDoc(doc(db, 'settings', 'academy'), {
    entranceCode: code.toUpperCase(),
    updatedAt: Timestamp.now(),
  });
}

export async function verifyEntranceCode(code: string): Promise<boolean> {
  const stored = await getAcademyEntranceCode();
  if (!stored) return false;
  return stored.toUpperCase() === code.toUpperCase();
}

export async function saveExam(
  exam: Omit<Exam, 'id' | 'createdAt' | 'regDate'>
): Promise<string> {
  const g = (exam.grade ?? '').trim();
  if (!VALID_GRADES.includes(g)) {
    throw new Error('학년이 올바르지 않습니다. 학년을 다시 선택하세요.');
  }
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();

  const { id: _ignoredId, ...examWithoutId } = exam as Exam;

  const data = removeUndefined({
    ...examWithoutId,
    grade: g,
    accessCode: code,
    regDate: Timestamp.now(),
  });
  const docRef = await addDoc(collection(db, 'tests'), data as object);
  return docRef.id;
}

export async function updateExam(
  examId: string,
  exam: Partial<Omit<Exam, 'id' | 'createdAt' | 'regDate'>>
): Promise<void> {
  if (exam.grade !== undefined) {
    const g = (exam.grade ?? '').trim();
    if (!VALID_GRADES.includes(g)) {
      throw new Error('학년이 올바르지 않습니다. 학년을 다시 선택하세요.');
    }
    exam = { ...exam, grade: g };
  }
  const { id: _ignoredId, ...examWithoutId } = exam as Partial<Exam>;
  const data = removeUndefined(examWithoutId);
  await updateDoc(doc(db, 'tests', examId), data as object);
}

export async function getExamsByTeacher(teacherId: string): Promise<Exam[]> {
  const q = query(
    collection(db, 'tests'),
    where('teacherId', '==', teacherId),
    orderBy('regDate', 'desc')
  );
  const snap = await getDocs(q);
  const exams = snap.docs.map(d => ({ ...d.data(), id: d.id }) as Exam);
  return sortExamsByUnit(exams);
}

export async function getExamsByGrade(grade: string): Promise<Exam[]> {
  await ensureAuth();
  const target = (grade ?? '').trim();
  const q = query(
    collection(db, 'tests'),
    where('grade', '==', target),
    where('isPublished', '==', true),
    orderBy('regDate', 'desc')
  );
  const snap = await getDocs(q);
  const exams = snap.docs.map(d => ({ ...d.data(), id: d.id }) as Exam);
  const filtered = exams.filter(e => (e.grade ?? '').trim() === target);
  return sortExamsByUnit(filtered);
}

export async function getAllPublishedExams(): Promise<Exam[]> {
  const q = query(
    collection(db, 'tests'),
    where('isPublished', '==', true),
    orderBy('regDate', 'desc')
  );
  const snap = await getDocs(q);
  const exams = snap.docs.map(d => ({ ...d.data(), id: d.id }) as Exam);
  return sortExamsByUnit(exams);
}

export async function getExam(examId: string): Promise<Exam | null> {
  const snap = await getDoc(doc(db, 'tests', examId));
  if (!snap.exists()) return null;
  return { ...snap.data(), id: snap.id } as Exam;
}

export async function getExamByCode(code: string): Promise<Exam | null> {
  const q = query(
    collection(db, 'tests'),
    where('accessCode', '==', code.toUpperCase()),
    where('isPublished', '==', true)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { ...d.data(), id: d.id } as Exam;
}

// ─────────────────────────────────────────────
// ★ 답안 → 유형별 요약 (순수 함수, 네트워크 없음)
//   "응시했다"의 기준은 그 유형 문항에 답이 하나라도 들어 있는가이다.
//   점수는 응시한 문항만으로 계산하므로, 안 푼 유형이 0점으로 잡히지 않는다.
export function buildSubmissionSummary(
  questions: Question[],
  answers: Record<string, string>
): SubmissionSummary {
  const all = Array.isArray(questions) ? questions : [];
  const oxQs    = all.filter(q => q.type === 'ox');
  const multiQs = all.filter(q => q.type === 'multiple');

  const hasAnswer = (qid: string): boolean => {
    const v = answers ? answers[qid] : undefined;
    return v !== undefined && v !== null && String(v).trim() !== '';
  };

  const statOf = (list: Question[]) => {
    const done = list.filter(q => hasAnswer(q.id));
    const correct = done.filter(q => isAnswerCorrect(answers[q.id], q.answer)).length;
    return {
      done: done.length,
      correct,
      score: done.length > 0 ? Math.round((correct / done.length) * 100) : null,
    };
  };

  const ox    = statOf(oxQs);
  const multi = statOf(multiQs);

  const answered     = all.filter(q => hasAnswer(q.id));
  const totalCorrect = answered.filter(q => isAnswerCorrect(answers[q.id], q.answer)).length;
  const overallScore = answered.length > 0
    ? Math.round((totalCorrect / answered.length) * 100)
    : 0;

  const oxDone    = ox.done > 0;
  const multiDone = multi.done > 0;
  const allDone   = (oxQs.length === 0 || oxDone) && (multiQs.length === 0 || multiDone);

  return {
    oxTotal:      oxQs.length,
    multiTotal:   multiQs.length,
    oxDone,
    multiDone,
    oxScore:      ox.score,
    multiScore:   multi.score,
    oxCorrect:    ox.correct,
    multiCorrect: multi.correct,
    overallScore,
    totalCorrect,
    answeredCount: answered.length,
    allDone,
  };
}

// ★ 저장된 답안 + (선택) 이번 세션 답안을 합쳐 요약을 만든다.
//   결과 화면에서 "OX·4지선다 둘 다 끝났는지"를 판정하는 데 사용.
export async function getSubmissionSummary(
  examId: string,
  studentId?: string,
  localAnswers?: Record<string, string>
): Promise<SubmissionSummary | null> {
  await ensureAuth();
  const exam = await getExam(examId);
  if (!exam) return null;

  let stored: Record<string, string> = {};
  const key = normalizeStudentId(studentId);
  if (key) {
    try {
      const snap = await getDoc(doc(db, 'grades', `${examId}__${key}`));
      if (snap.exists()) {
        const p = snap.data() as any;
        if (p && p.answers && typeof p.answers === 'object' && !Array.isArray(p.answers)) {
          stored = p.answers as Record<string, string>;
        }
      }
    } catch (e) {
      console.warn('[examService] 요약 조회 실패, 이번 답안만 사용:', e);
    }
  }

  const merged = { ...stored, ...(localAnswers ?? {}) };
  return buildSubmissionSummary(exam.questions ?? [], merged);
}
// ─────────────────────────────────────────────

export async function submitStudentAnswers(payload: {
  examId: string;
  studentName: string;
  studentId?: string;
  answers: Record<string, string>;
  score: number;
  totalQuestions: number;
  grade?: string;
  subType?: QuestionType | null;   // 'ox' | 'multiple' | null(전체)
}): Promise<string> {
  await ensureAuth();
  const exam = await getExam(payload.examId);

  const allQuestions      = exam?.questions ?? [];
  const oxQuestions       = allQuestions.filter(q => q.type === 'ox');
  const multipleQuestions = allQuestions.filter(q => q.type === 'multiple');

  // ★ 학생 ID는 반드시 표준화해서 저장한다. (대시보드가 students.id와 대조함)
  const key = normalizeStudentId(payload.studentId);
  const gid = key ? `${payload.examId}__${key}` : '';

  // ★★ 이어풀기 보존 ★★
  // OX → 4지선다를 연달아 풀면 같은 문서 ID로 저장되는데, 예전에는 이번 제출분으로
  // 문서를 통째로 덮어써서 먼저 기록한 OX 답안과 점수가 사라졌다.
  // → 이전 답안을 읽어와 병합한 뒤 다시 채점한다.
  let prevAnswers: Record<string, string> = {};
  let prevSubTypes: QuestionType[] = [];
  let prevFirstAt: Timestamp | null = null;

  if (gid) {
    try {
      const prevSnap = await getDoc(doc(db, 'grades', gid));
      if (prevSnap.exists()) {
        const p = prevSnap.data() as any;
        if (p && p.answers && typeof p.answers === 'object' && !Array.isArray(p.answers)) {
          prevAnswers = p.answers as Record<string, string>;
        }
        if (p && Array.isArray(p.subTypes)) {
          prevSubTypes = p.subTypes as QuestionType[];
        }
        prevFirstAt = (p && (p.firstSubmittedAt ?? p.timestamp)) ?? null;
      }
    } catch (e) {
      console.warn('[examService] 이전 제출 조회 실패, 신규로 처리:', e);
    }
  }

  const mergedAnswers: Record<string, string> = { ...prevAnswers, ...payload.answers };
  const summary = buildSubmissionSummary(allQuestions, mergedAnswers);

  // ★ 대시보드·학생상세가 우선적으로 읽는 구조화 필드.
  //   응시하지 않은 유형은 null로 두어 "0점 응시"로 오해되지 않게 한다.
  const oxBlock = summary.oxDone
    ? { score: summary.oxScore ?? 0, correct: summary.oxCorrect, total: oxQuestions.length }
    : null;
  const multiBlock = summary.multiDone
    ? { score: summary.multiScore ?? 0, correct: summary.multiCorrect, total: multipleQuestions.length }
    : null;

  const subTypes: QuestionType[] = [];
  if (summary.oxDone) subTypes.push('ox');
  if (summary.multiDone) subTypes.push('multiple');
  prevSubTypes.forEach(t => { if (t && !subTypes.includes(t)) subTypes.push(t); });

  const now = Timestamp.now();

  const data = {
    examId:           payload.examId,
    studentName:      payload.studentName,
    studentId:        key,
    answers:          mergedAnswers,
    score:            summary.overallScore,
    correctCount:     summary.totalCorrect,
    answeredCount:    summary.answeredCount,
    // 구조화 필드 (우선 사용됨)
    ox:               oxBlock,
    multiple:         multiBlock,
    // 평면 필드 (기존 화면 호환)
    oxScore:          summary.oxScore,
    multiScore:       summary.multiScore,
    oxCount:          oxQuestions.length,
    multiCount:       multipleQuestions.length,
    totalQuestions:   allQuestions.length > 0 ? allQuestions.length : payload.totalQuestions,
    subTypes,
    lastSubType:      payload.subType ?? null,
    grade:            payload.grade ?? exam?.grade ?? '',
    testName:         exam?.title ?? '',
    date:             new Date().toLocaleDateString('ko-KR'),
    timestamp:        now,
    firstSubmittedAt: prevFirstAt ?? now,
  };

  if (gid) {
    await setDoc(doc(db, 'grades', gid), data);
    return gid;
  }

  // studentId가 없는 예외적 경우에만 새 문서 생성
  const docRef = await addDoc(collection(db, 'grades'), data);
  return docRef.id;
}

export async function getAnswersByExam(examId: string): Promise<StudentAnswer[]> {
  const q = query(
    collection(db, 'grades'),
    where('examId', '==', examId),
    orderBy('timestamp', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id }) as StudentAnswer);
}

export async function getAnswersByStudent(studentName: string): Promise<StudentAnswer[]> {
  const q = query(
    collection(db, 'grades'),
    where('studentName', '==', studentName),
    orderBy('timestamp', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id }) as StudentAnswer);
}

export function calculateScore(
  exam: Exam,
  answers: Record<string, string>
): number {
  if (!exam.questions || exam.questions.length === 0) return 0;
  const correct = exam.questions.filter(q => isAnswerCorrect(answers[q.id], q.answer)).length;
  return Math.round((correct / exam.questions.length) * 100);
}

export async function saveResult(result: Omit<Result, 'id'>): Promise<string> {
  await ensureAuth();
  const ref = await addDoc(collection(db, 'results'), {
    ...result,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getAllResults(): Promise<Result[]> {
  const q = query(collection(db, 'results'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({
    ...(d.data() as Omit<Result, 'id'>),
    id: d.id,
  }));
}

export async function getStudentById(studentId: string): Promise<{ fireId: string; id: string; name: string; grade: string } | null> {
  await ensureAuth();
  const q = query(
    collection(db, 'students'),
    where('id', '==', normalizeStudentId(studentId))
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { ...d.data(), fireId: d.id } as { fireId: string; id: string; name: string; grade: string };
}

export async function deleteExam(examId: string): Promise<void> {
  await deleteDoc(doc(db, 'tests', examId));
}
