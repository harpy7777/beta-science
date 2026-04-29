import { db } from './firebase';
import { 
  collection, addDoc, getDoc, getDocs, doc, query, where, orderBy, serverTimestamp 
} from 'firebase/firestore';

// 1. 접속 코드로 시험지 찾기 (학생용)
export const getExamByCode = async (accessCode: string) => {
  const q = query(collection(db, 'exams'), where("accessCode", "==", accessCode), where("isPublished", "==", true));
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  }
  return null;
};

// 2. 시험지 저장 (saveExam)
export const saveExam = async (examData: any) => {
  return await addDoc(collection(db, 'exams'), { ...examData, createdAt: serverTimestamp() });
};

// 3. 학생 답안 제출 (submitStudentAnswers)
export const submitStudentAnswers = async (answerData: any) => {
  return await addDoc(collection(db, 'studentAnswers'), { ...answerData, submittedAt: serverTimestamp() });
};

// 4. 점수 계산 (calculateScore)
export const calculateScore = (questions: any[], answers: any) => {
  let correctCount = 0;
  questions.forEach((q, idx) => {
    if (answers[`q${idx}`] === q.correctAnswer) correctCount++;
  });
  return Math.round((correctCount / questions.length) * 100);
};

// 5. 선생님용 목록 조회 및 기타 호환용
export const getExamsByTeacher = async (teacherId: string) => {
  const q = query(collection(db, 'exams'), where("teacherId", "==", teacherId), orderBy("createdAt", "desc"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getAnswersByExam = async (examId: string) => {
  const q = query(collection(db, 'studentAnswers'), where("examId", "==", examId), orderBy("submittedAt", "desc"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};
