// src/lib/examService.ts
import {
  collection, addDoc, getDocs, doc, getDoc,
  updateDoc, query, where, orderBy, Timestamp, serverTimestamp, deleteDoc
} from 'firebase/firestore';
import { db } from './firebase';

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
  answers: Record<string, string>;
  score: number;
  totalQuestions: number;
  submittedAt?: Timestamp;
  timestamp?: Timestamp;
  testName?: string;
  date?: string;
  grade?: string;
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
  const data = removeUndefined({
    ...exam,
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
  const data = removeUndefined(exam);
  await updateDoc(doc(db, 'tests', examId), data as object);
}

export async function getExamsByTeacher(teacherId: string): Promise<Exam[]> {
  const q = query(
    collection(db, 'tests'),
    where('teacherId', '==', teacherId),
    orderBy('regDate', 'desc')  // desc 유지 (인덱스 오류 방지)
  );
  const snap = await getDocs(q);
  const exams = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Exam);
  // 프론트에서 오름차순 정렬 (먼저 만든 것이 위로)
  return exams.sort((a, b) => {
    const getTime = (ts: any): number => {
      if (!ts) return 0;
      if (typeof ts.toDate === 'function') return ts.toDate().getTime();
      if (typeof ts.seconds === 'number') return ts.seconds * 1000;
      return new Date(ts).getTime();
    };
    return getTime(a.regDate) - getTime(b.regDate);
  });
}

export async function getExamsByGrade(grade: string): Promise<Exam[]> {
  const target = (grade ?? '').trim();
  const q = query(
    collection(db, 'tests'),
    where('grade', '==', target),
    where('isPublished', '==', true),
    orderBy('regDate', 'desc')
  );
  const snap = await getDocs(q);
  const exams = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Exam);
  // ★ 안전장치: 학년이 정확히 일치하는 것만 통과시킴 (학년 섞임 방지)
  return exams.filter(e => (e.grade ?? '').trim() === target);
}

export async function getAllPublishedExams(): Promise<Exam[]> {
  const q = query(
    collection(db, 'tests'),
    where('isPublished', '==', true),
    orderBy('regDate', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Exam);
}

export async function getExam(examId: string): Promise<Exam | null> {
  const snap = await getDoc(doc(db, 'tests', examId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Exam;
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
  return { id: d.id, ...d.data() } as Exam;
}

export async function submitStudentAnswers(payload: {
  examId: string;
  studentName: string;
  studentId?: string;
  answers: Record<string, string>;
  score: number;
  totalQuestions: number;
  grade?: string;
}): Promise<string> {
  const exam = await getExam(payload.examId);

  const oxQuestions       = (exam?.questions ?? []).filter(q => q.type === 'ox');
  const multipleQuestions = (exam?.questions ?? []).filter(q => q.type === 'multiple');

  let oxScore:    number | null = null;
  let multiScore: number | null = null;

  if (oxQuestions.length > 0) {
    const correct = oxQuestions.filter(q => isAnswerCorrect(payload.answers[q.id], q.answer)).length;
    oxScore = Math.round((correct / oxQuestions.length) * 100);
  }

  if (multipleQuestions.length > 0) {
    const correct = multipleQuestions.filter(q => isAnswerCorrect(payload.answers[q.id], q.answer)).length;
    multiScore = Math.round((correct / multipleQuestions.length) * 100);
  }

  const docRef = await addDoc(collection(db, 'grades'), {
    examId:         payload.examId,
    studentName:    payload.studentName,
    studentId:      payload.studentId ?? '',
    answers:        payload.answers,
    score:          payload.score,
    oxScore,
    multiScore,
    oxCount:        oxQuestions.length,
    multiCount:     multipleQuestions.length,
    totalQuestions: payload.totalQuestions,
    grade:          payload.grade ?? exam?.grade ?? '',
    testName:       exam?.title ?? '',
    date:           new Date().toLocaleDateString('ko-KR'),
    timestamp:      Timestamp.now(),
  });
  return docRef.id;
}

export async function getAnswersByExam(examId: string): Promise<StudentAnswer[]> {
  const q = query(
    collection(db, 'grades'),
    where('examId', '==', examId),
    orderBy('timestamp', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as StudentAnswer);
}

export async function getAnswersByStudent(studentName: string): Promise<StudentAnswer[]> {
  const q = query(
    collection(db, 'grades'),
    where('studentName', '==', studentName),
    orderBy('timestamp', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as StudentAnswer);
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
    id: d.id,
    ...(d.data() as Omit<Result, 'id'>),
  }));
}

export async function getStudentById(studentId: string): Promise<{ fireId: string; id: string; name: string; grade: string } | null> {
  const q = query(
    collection(db, 'students'),
    where('id', '==', studentId.toLowerCase())
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { fireId: d.id, ...d.data() } as { fireId: string; id: string; name: string; grade: string };
}

export async function deleteExam(examId: string): Promise<void> {
  await deleteDoc(doc(db, 'tests', examId));
}
