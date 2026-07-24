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
//      - 이 대기를 생략하면, 페이지 로드 직후 선생님이 아직 복원되기 전
//        currentUser가 잠깐 null로 보여서 익명 로그인이 잘못 걸릴 수 있음.
//   2) 그 뒤에도 로그인한 사람이 아무도 없을 때만(= 학생) 익명 로그인.
//      - 선생님은 이미 이메일로 로그인된 상태이므로 익명 로그인이 걸리지 않음.
//   3) 익명 로그인이 실패해도 throw하지 않음. (현재 보안 규칙이 열려 있어
//      기존 동작이 그대로 유지되도록. 규칙을 잠그는 건 이후 단계에서 진행)
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
    // 익명 로그인 실패 시에도 기존 흐름을 막지 않음 (규칙은 아직 열려 있음)
    console.warn('[examService] ensureAuth skipped:', e);
  }
}
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// ★ 채점 정규화: "선택지3","3번","3" → "3" / "O","X" → 대문자 통일
// 정답이 어떤 형식으로 저장돼 있어도 학생 답(번호)과 정확히 비교됨
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
// q.type === 'ox' 이면 "O" / "X" 그대로, 4지선다면 번호 + 보기내용
export function formatCorrectAnswer(question: {
  type: 'ox' | 'multiple';
  answer: string;
  options?: string[];
}): string {
  if (question.type === 'ox') {
    return normalizeAnswer(question.answer); // O 또는 X
  }
  // 4지선다: 정답에서 숫자만 뽑음 ("선택지3" → "3")
  const num = normalizeAnswer(question.answer);
  const idx = Number(num) - 1;
  const optText = question.options?.[idx];
  if (num && optText) return `${num}번 - ${optText}`;
  // 혹시 정답이 보기 내용으로 저장된 경우 ("유리")
  const foundIdx = question.options?.findIndex(opt => opt === question.answer);
  if (foundIdx !== undefined && foundIdx >= 0) return `${foundIdx + 1}번 - ${question.answer}`;
  return question.answer;
}
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// ★ 단원 자연 정렬: 제목에서 단원 번호를 뽑아 만든 순서와 무관하게 정렬한다.
// 지원 형식:
//   "7-1. 별의 특성 (① 별까지의 거리)"  → [7, 1, 1]
//   "8-2. 과학과 기술의 활용 (① ...)"   → [8, 2, 1]
//   "3단원 ... ②"                       → [3, 0, 2]
//   "(2) ..." / "2) ..."                → 소단원 2 로 인식
// 동그라미 숫자(①~⑳)와 (1)/1) 형식 모두 인식.

// 동그라미 숫자 → 정수. 동그라미가 아니면 0.
function circledToNumber(ch: string): number {
  const code = ch.codePointAt(0) ?? 0;
  // ① ~ ⑳ : U+2460 ~ U+2473
  if (code >= 0x2460 && code <= 0x2473) return code - 0x2460 + 1;
  return 0;
}

const ORDER_MAX = Number.MAX_SAFE_INTEGER;

// 제목 → [대단원, 중단원, 소단원]. 번호가 없으면 큰 값으로 두어 맨 뒤로 보냄.
function getUnitOrder(title: string): [number, number, number] {
  const t = (title ?? '').trim();

  let major = ORDER_MAX;
  let minor = ORDER_MAX;

  // 1) "N-M" (예: 7-1, 8-2) — 제목 맨 앞의 단원 표기
  const dash = t.match(/(\d+)\s*-\s*(\d+)/);
  if (dash) {
    major = parseInt(dash[1], 10);
    minor = parseInt(dash[2], 10);
  } else {
    // 2) "N단원" 형식
    const danwon = t.match(/(\d+)\s*단원/);
    if (danwon) {
      major = parseInt(danwon[1], 10);
      minor = 0;
    }
  }

  // 3) 소단원(동그라미 숫자) — 제목 어디에 있어도 첫 번째 것을 사용
  let sub = ORDER_MAX;
  for (const ch of t) {
    const n = circledToNumber(ch);
    if (n > 0) { sub = n; break; }
  }
  // 동그라미가 없으면 (1) / 1) 형식 fallback
  if (sub === ORDER_MAX) {
    const paren = t.match(/[(（]\s*(\d+)\s*[)）]/);
    if (paren) sub = parseInt(paren[1], 10);
  }

  return [major, minor, sub];
}

// Timestamp/seconds/문자열 등 어떤 형태든 밀리초로 변환 (정렬 동점 처리용)
function tsToMillis(ts: any): number {
  if (!ts) return 0;
  if (typeof ts.toDate === 'function') return ts.toDate().getTime();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  return new Date(ts).getTime();
}

// 단원 순서 → 같은 단원이면 만든 순서(오름차순)로 정렬
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
  // ★ 유형별 점수/문항수 (OX·4지선다 이어풀기 지원)
  oxScore?: number | null;
  multiScore?: number | null;
  oxCount?: number;
  multiCount?: number;
  correctCount?: number;
  answeredCount?: number;
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

// ★ 허용된 학년 목록 (저장/필터 모두 이 기준 사용)
export const VALID_GRADES = ['중1', '중2', '중3', '고1', '고2', '고3'];

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
  // ★ 저장 직전 학년 검증: 잘못된 학년이면 저장 자체를 막음 (데이터 오염 방지)
  const g = (exam.grade ?? '').trim();
  if (!VALID_GRADES.includes(g)) {
    throw new Error('학년이 올바르지 않습니다. 학년을 다시 선택하세요.');
  }
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();

  // ★ 방어: 혹시 호출부에서 id가 섞여 들어와도 문서 안에 stale id가 저장되지 않도록 제거
  //   (이 id 박제가 "중복 시험지 하나 지웠더니 둘 다 사라지는" 버그의 원인이었음)
  const { id: _ignoredId, ...examWithoutId } = exam as Exam;

  const data = removeUndefined({
    ...examWithoutId,
    grade: g, // ★ 공백 제거된 정확한 학년으로 저장
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
  // ★ 수정 시에도 학년이 들어오면 검증
  if (exam.grade !== undefined) {
    const g = (exam.grade ?? '').trim();
    if (!VALID_GRADES.includes(g)) {
      throw new Error('학년이 올바르지 않습니다. 학년을 다시 선택하세요.');
    }
    exam = { ...exam, grade: g };
  }
  // ★ 방어: 업데이트 페이로드에 id가 섞여 들어와도 문서 안에 저장되지 않도록 제거
  const { id: _ignoredId, ...examWithoutId } = exam as Partial<Exam>;
  const data = removeUndefined(examWithoutId);
  await updateDoc(doc(db, 'tests', examId), data as object);
}

export async function getExamsByTeacher(teacherId: string): Promise<Exam[]> {
  const q = query(
    collection(db, 'tests'),
    where('teacherId', '==', teacherId),
    orderBy('regDate', 'desc')  // desc 유지 (인덱스 오류 방지)
  );
  const snap = await getDocs(q);
  // ★ 핵심: d.data()를 먼저 펼치고 진짜 문서 ID를 마지막에 덮어쓴다 (stale id 무력화).
  const exams = snap.docs.map(d => ({ ...d.data(), id: d.id }) as Exam);
  // ★ 단원 순서대로 정렬 (만든 순서와 무관하게 7-1 → 7-2 → 8-1 → 8-2 ...)
  return sortExamsByUnit(exams);
}

export async function getExamsByGrade(grade: string): Promise<Exam[]> {
  await ensureAuth(); // ★ 학생 경로: 로그인 없으면 익명 인증 (선생님은 영향 없음)
  const target = (grade ?? '').trim();
  const q = query(
    collection(db, 'tests'),
    where('grade', '==', target),
    where('isPublished', '==', true),
    orderBy('regDate', 'desc')
  );
  const snap = await getDocs(q);
  const exams = snap.docs.map(d => ({ ...d.data(), id: d.id }) as Exam);
  // ★ 안전장치: 학년이 정확히 일치하는 것만 통과시킴 (학년 섞임 방지)
  const filtered = exams.filter(e => (e.grade ?? '').trim() === target);
  // ★ 학생 화면도 동일하게 단원 순서로 정렬
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
  // ★ 전체 목록도 단원 순서로 정렬
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

export async function submitStudentAnswers(payload: {
  examId: string;
  studentName: string;
  studentId?: string;
  answers: Record<string, string>;
  score: number;
  totalQuestions: number;
  grade?: string;
  subType?: QuestionType | null;   // ★ 'ox' | 'multiple' | null(전체)
}): Promise<string> {
  await ensureAuth(); // ★ 학생 경로: 답안 제출 전 인증 보장
  const exam = await getExam(payload.examId);

  const allQuestions      = exam?.questions ?? [];
  const oxQuestions       = allQuestions.filter(q => q.type === 'ox');
  const multipleQuestions = allQuestions.filter(q => q.type === 'multiple');

  // ★ 중복 제출 방지 (한 시험 = 한 문서): studentId가 있으면
  //   (examId + studentId)를 문서 ID로 고정한다.
  const key = (payload.studentId ?? '').trim();
  const gid = key ? `${payload.examId}__${key}` : '';

  // ★★ 핵심 수정 ★★
  // OX를 먼저 풀고 이어서 4지선다를 풀면 같은 문서 ID로 저장되는데,
  // 예전에는 이번 제출분(4지선다 답만)으로 문서를 통째로 덮어써서
  // 먼저 기록된 OX 답안과 OX 점수가 0으로 날아갔다.
  // → 이전 제출 답안을 먼저 읽어와 병합한 뒤 점수를 다시 계산한다.
  let prevAnswers: Record<string, string> = {};
  let prevSubTypes: QuestionType[] = [];
  let prevFirstAt: Timestamp | null = null;

  if (gid) {
    try {
      const prevSnap = await getDoc(doc(db, 'grades', gid));
      if (prevSnap.exists()) {
        const p = prevSnap.data() as any;
        if (p && p.answers && typeof p.answers === 'object') {
          prevAnswers = p.answers as Record<string, string>;
        }
        if (p && Array.isArray(p.subTypes)) {
          prevSubTypes = p.subTypes as QuestionType[];
        }
        prevFirstAt = (p && (p.firstSubmittedAt ?? p.timestamp)) ?? null;
      }
    } catch (e) {
      // 조회 실패 시에는 신규 제출로 처리 (제출 자체를 막지 않음)
      console.warn('[examService] 이전 제출 조회 실패, 신규로 처리:', e);
    }
  }

  // 이전 답안 + 이번 답안 병합 (같은 문항은 이번 답이 우선)
  const mergedAnswers: Record<string, string> = { ...prevAnswers, ...payload.answers };

  const hasAnswer = (qid: string): boolean => {
    const v = mergedAnswers[qid];
    return v !== undefined && v !== null && String(v).trim() !== '';
  };

  // ★ 유형별 점수: 그 유형을 아직 안 풀었으면 null (0점으로 오기록되지 않음)
  const scoreOf = (list: Question[]): number | null => {
    const done = list.filter(q => hasAnswer(q.id));
    if (done.length === 0) return null;
    const correct = done.filter(q => isAnswerCorrect(mergedAnswers[q.id], q.answer)).length;
    return Math.round((correct / done.length) * 100);
  };

  const oxScore    = scoreOf(oxQuestions);
  const multiScore = scoreOf(multipleQuestions);

  // ★ 총점: 실제로 응시한 문항만을 기준으로 계산 (OX만 풀어도 점수가 반토막 나지 않음)
  const answeredQuestions = allQuestions.filter(q => hasAnswer(q.id));
  const correctCount = answeredQuestions.filter(q => isAnswerCorrect(mergedAnswers[q.id], q.answer)).length;
  const score = answeredQuestions.length > 0
    ? Math.round((correctCount / answeredQuestions.length) * 100)
    : 0;

  // 응시한 유형 기록 (['ox'], ['ox','multiple'] 등)
  const subTypes: QuestionType[] = Array.from(new Set<QuestionType>([
    ...prevSubTypes,
    ...(payload.subType ? [payload.subType] : []),
  ]));

  const now = Timestamp.now();

  const data = {
    examId:           payload.examId,
    studentName:      payload.studentName,
    studentId:        key,
    answers:          mergedAnswers,
    score,
    correctCount,
    answeredCount:    answeredQuestions.length,
    oxScore,
    multiScore,
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

  // studentId가 없는 예외적 경우에만 기존처럼 새 문서 생성
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
  await ensureAuth(); // ★ 학생 경로: 응시 시작 기록 전 인증 보장
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
  await ensureAuth(); // ★ 학생 경로: 본인 정보 조회 전 인증 보장
  const q = query(
    collection(db, 'students'),
    where('id', '==', studentId.toLowerCase())
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  // 주의: students 문서의 'id'는 학생 로그인 ID(필드)이고, fireId는 실제 문서 ID이다.
  // data()를 먼저 펼쳐 학생 id 필드를 살리고, fireId는 마지막에 실제 문서 ID로 덮어쓴다.
  return { ...d.data(), fireId: d.id } as { fireId: string; id: string; name: string; grade: string };
}

export async function deleteExam(examId: string): Promise<void> {
  await deleteDoc(doc(db, 'tests', examId));
}
