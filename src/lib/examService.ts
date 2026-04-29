import { db } from './firebase';
import { 
  collection, addDoc, getDoc, getDocs, doc, query, where, orderBy, serverTimestamp, updateDoc 
} from 'firebase/firestore';

// 1. 모든 화면에서 공통으로 사용하는 '규격' 정의 (에러 원천 봉쇄)
export type QuestionType = 'multiple' | 'ox';

export interface Question {
  id: string;
  type: QuestionType;
  question: string;
  options?: string[];
  correctAnswer: string;
}

export interface Exam {
  id?: string;
  title: string;
  teacherId: string;
  questions: Question[];
  isPublished: boolean;
  accessCode: string;
  createdAt?: any;
}

// 2. 학생용: 접속 코드로 시험지 찾기
export const getExamByCode = async (accessCode: string): Promise<Exam | null> => {
  const q = query(
    collection(db, 'exams'), 
    where("accessCode", "==", accessCode.toUpperCase()),
    where("isPublished", "==", true)
  );
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    const docRes = querySnapshot.docs[0];
    return { id: docRes.id, ...docRes.data() } as Exam;
  }
  return null;
};

// 3. 공통: 특정 ID로 시험지 하나 가져오기 (getExam)
export const getExam = async (examId: string): Promise<Exam | null> => {
  const docRef = doc(db, 'exams', examId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as Exam : null;
};

// 4. 선생님용: 시험지 저장 (saveExam)
export const saveExam = async (examData: any) => {
  return await addDoc(collection(db, 'exams'), {
    ...examData,
    createdAt: serverTimestamp()
  });
};

// 5. 선생님용: 시험지 수정 (updateExam)
export const updateExam = async (examId: string, examData: any) => {
  const docRef = doc(db, 'exams', examId);
  return await updateDoc(docRef, examData);
};

// 6. 학생용: 답안 제출 (submitStudentAnswers)
export const submitStudentAnswers = async (answerData: any) => {
  return await addDoc(collection(db, 'studentAnswers'), {
    ...answerData,
    submittedAt: serverTimestamp()
  });
};

// 7. 선생님용: 특정 시험 결과 전체 조회 (getAnswersByExam)
export const getAnswersByExam = async (examId: string) => {
  const q = query(
    collection(db, 'studentAnswers'), 
    where("examId", "==", examId),
    orderBy("submittedAt", "desc")
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// 8. 선생님용: 내 시험 목록 전체 조회 (getExamsByTeacher)
export const getExamsByTeacher = async (teacherId: string) => {
  const q = query(
    collection(db, 'exams'), 
    where("teacherId", "==", teacherId),
    orderBy("createdAt", "desc")
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// 9. 학생용: 점수 채점 (calculateScore)
export const calculateScore = (exam: any, answers: any) => {
  const questions = exam.questions || []; 
  let correctCount = 0;
  questions.forEach((q: any, idx: number) => {
    if (answers[`q${idx}`] === q.correctAnswer) correctCount++;
  });
  return questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
};
