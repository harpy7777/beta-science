// src/lib/examService.ts 수정본
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
  isPublished: boolean;
  accessCode?: string;     
}

// 시험지 저장
export async function saveExam(exam: Omit<Exam, 'id' | 'createdAt'>): Promise<string> {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const docRef = await addDoc(collection(db, 'tests'), { // 'exams' -> 'tests'로 변경 (대시보드 일치)
    ...exam,
    accessCode: code,
    regDate: Timestamp.now(), // 대시보드 orderBy 필드명 일치
  });
  return docRef.id;
}

// 학생 답안 제출 (여기가 중요! 우리 대시보드와 연결되는 지점입니다)
export async function submitStudentAnswers(exam: Exam, studentName: string, answers: Record<string, string>): Promise<string> {
  const score = calculateScore(exam, answers);
  
  const docRef = await addDoc(collection(db, 'grades'), { // 'studentAnswers' -> 'grades'로 변경
    studentName: studentName,
    testName: exam.title,
    score: score,
    date: new Date().toLocaleDateString(), // 대시보드 표시용 날짜 포맷
    timestamp: Timestamp.now(),
    examId: exam.id,
    answers: answers
  });
  return docRef.id;
}

// 점수 계산 로직 (기존 동일)
export function calculateScore(exam: Exam, answers: Record<string, string>): number {
  let correct = 0;
  if (!exam.questions || exam.questions.length === 0) return 0;
  for (const q of exam.questions) {
    if (answers[q.id] === q.answer) correct++;
  }
  return Math.round((correct / exam.questions.length) * 100);
}

// 시험지 단건 조회
export async function getExam(examId: string): Promise<Exam | null> {
  const snap = await getDoc(doc(db, 'tests', examId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Exam;
}

// 접속 코드로 시험지 찾기
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