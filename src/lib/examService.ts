// src/lib/examService.ts
import {
  collection, addDoc, getDocs, doc, getDoc,
  updateDoc, query, where, orderBy, Timestamp
} from 'firebase/firestore';
import { db } from './firebase';

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
  createdAt?: Timestamp;
  regDate?: Timestamp;
  isPublished: boolean;
  accessCode?: string;
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
}

// ─── 시험지 저장 (신규) ────────────────────────────────────────────────────
export async function saveExam(
  exam: Omit<Exam, 'id' | 'createdAt' | 'regDate'>
): Promise<string> {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const docRef = await addDoc(collection(db, 'tests'), {
    ...exam,
    accessCode: code,
    regDate: Timestamp.now(),
  });
  return docRef.id;
}

// ─── 시험지 수정 ───────────────────────────────────────────────────────────
export async function updateExam(
  examId: string,
  exam: Partial<Omit<Exam, 'id' | 'createdAt' | 'regDate'>>
): Promise<void> {
  await updateDoc(doc(db, 'tests', examId), { ...exam });
}

// ─── 선생님 시험지 목록 ────────────────────────────────────────────────────
export async function getExamsByTeacher(teacherId: string): Promise<Exam[]> {
  const q = query(
    collection(db, 'tests'),
    where('teacherId', '==', teacherId),
    orderBy('regDate', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Exam);
}

// ─── 시험지 단건 조회 ──────────────────────────────────────────────────────
export async function getExam(examId: string): Promise<Exam | null> {
  const snap = await getDoc(doc(db, 'tests', examId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Exam;
}

// ─── 접속 코드로 시험지 찾기 ───────────────────────────────────────────────
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

// ─── 학생 답안 제출 ────────────────────────────────────────────────────────
export async function submitStudentAnswers(payload: {
  examId: string;
  studentName: string;
  answers: Record<string, string>;
  score: number;
  totalQuestions: number;
}): Promise<string> {
  // exam 정보(testName)도 함께 저장하기 위해 exam을 다시 조회
  const exam = await getExam(payload.examId);
  const docRef = await addDoc(collection(db, 'grades'), {
    examId: payload.examId,
    studentName: payload.studentName,
    answers: payload.answers,
    score: payload.score,
    totalQuestions: payload.totalQuestions,
    testName: exam?.title ?? '',
    date: new Date().toLocaleDateString('ko-KR'),
    timestamp: Timestamp.now(),
  });
  return docRef.id;
}

// ─── 시험지별 학생 답안 조회 ───────────────────────────────────────────────
export async function getAnswersByExam(examId: string): Promise<StudentAnswer[]> {
  const q = query(
    collection(db, 'grades'),
    where('examId', '==', examId),
    orderBy('timestamp', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as StudentAnswer);
}

// ─── 점수 계산 ─────────────────────────────────────────────────────────────
export function calculateScore(
  exam: Exam,
  answers: Record<string, string>
): number {
  if (!exam.questions || exam.questions.length === 0) return 0;
  const correct = exam.questions.filter(q => answers[q.id] === q.answer).length;
  return Math.round((correct / exam.questions.length) * 100);
}
