// src/lib/examService.ts
import {
  collection, addDoc, getDocs, doc, getDoc,
  updateDoc, query, where, orderBy, Timestamp, serverTimestamp, deleteDoc
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
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const data = removeUndefined({
    ...exam,
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
  const data = removeUndefined(exam);
  await updateDoc(doc(db, 'tests', examId), data as object);
}

export async function getExamsByTeacher(teacherId: string): Promise<Exam[]> {
  const q = query(
    collection(db, 'tests'),
    where('teacherId', '==', teacherId),
    orderBy('regDate', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Exam);
}

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
    const correct = oxQuestions.filter(q => payload.answers[q.id] === q.answer).length;
    oxScore = Math.round((correct / oxQuestions.length) * 100);
  }

  if (multipleQuestions.length > 0) {
    const correct = multipleQuestions.filter(q => payload.answers[q.id] === q.answer).length;
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
  const correct = exam.questions.filter(q => answers[q.id] === q.answer).length;
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

// 학생 ID로 학생 정보 조회
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

// 시험지 삭제
export async function deleteExam(examId: string): Promise<void> {
  await deleteDoc(doc(db, 'tests', examId));
}
