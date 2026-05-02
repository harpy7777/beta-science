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
  grade?: string;        // 추가: 학년 (중1, 중2, 중3, 고1, 고2, 고3)
  codepenUrl?: string;   // 추가: CodePen URL
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

function removeUndefined(obj: unknown): unknown {
  return JSON.parse(JSON.stringify(obj));
}

// ─── 학원 입장코드 조회 ────────────────────────────────────────────────────
export async function getAcademyEntranceCode(): Promise<string | null> {
  const snap = await getDoc(doc(db, 'settings', 'academy'));
  if (!snap.exists()) return null;
  return (snap.data() as AcademySettings).entranceCode ?? null;
}

// ─── 학원 입장코드 저장/수정 ───────────────────────────────────────────────
export async function setAcademyEntranceCode(code: string): Promise<void> {
  await updateDoc(doc(db, 'settings', 'academy'), {
    entranceCode: code.toUpperCase(),
    updatedAt: Timestamp.now(),
  });
}

// ─── 입장코드 검증 ─────────────────────────────────────────────────────────
export async function verifyEntranceCode(code: string): Promise<boolean> {
  const stored = await getAcademyEntranceCode();
  if (!stored) return false;
  return stored.toUpperCase() === code.toUpperCase();
}

// ─── 시험지 저장 (신규) ────────────────────────────────────────────────────
export async function saveExam(
  exam: Omit<Exam, 'id' | 'createdAt' | 'regDate'>
): Promise<string> {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const data = removeUndefined({
    ...exam,
    accessCode: code,
    regDate: Timestamp.now(),
  });
  const docRef = await addDoc(collection(db, 'tests'), data as object);
  return docRef.id;
}

// ─── 시험지 수정 ───────────────────────────────────────────────────────────
export async function updateExam(
  examId: string,
  exam: Partial<Omit<Exam, 'id' | 'createdAt' | 'regDate'>>
): Promise<void> {
  const data = removeUndefined(exam);
  await updateDoc(doc(db, 'tests', examId), data as object);
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

// ─── 학년별 게시된 시험지 목록 ────────────────────────────────────────────
export async function getExamsByGrade(grade: string): Promise<Exam[]> {
  const q = query(
    collection(db, 'tests'),
    where('grade', '==', grade),
    where('isPublished', '==', true),
    orderBy('regDate', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Exam);
}

// ─── 전체 게시된 시험지 목록 ──────────────────────────────────────────────
export async function getAllPublishedExams(): Promise<Exam[]> {
  const q = query(
    collection(db, 'tests'),
    where('isPublished', '==', true),
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
  grade?: string;
}): Promise<string> {
  const exam = await getExam(payload.examId);
  const docRef = await addDoc(collection(db, 'grades'), {
    examId: payload.examId,
    studentName: payload.studentName,
    answers: payload.answers,
    score: payload.score,
    totalQuestions: payload.totalQuestions,
    grade: payload.grade ?? exam?.grade ?? '',
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

// ─── 학생 이름별 성적 조회 ─────────────────────────────────────────────────
export async function getAnswersByStudent(studentName: string): Promise<StudentAnswer[]> {
  const q = query(
    collection(db, 'grades'),
    where('studentName', '==', studentName),
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
