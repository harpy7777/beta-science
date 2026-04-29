import { db } from './firebase';
import { 
  collection, addDoc, getDoc, getDocs, doc, query, where, orderBy, serverTimestamp, updateDoc 
} from 'firebase/firestore';

// 0. TypeScript가 요구하는 'Exam' 규격 추가 (에러 해결 핵심!)
export interface Exam {
  id?: string;
  title: string;
  teacherId: string;
  questions: any[];
  isPublished: boolean;
  accessCode: string;
  createdAt?: any;
}

// 1. 접속 코드로 시험지 찾기 (학생용)
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

// 2. 특정 ID로 시험지 하나 가져오기 (학생 응시/결과용)
export const getExam = async (examId: string): Promise<Exam | null> => {
  const docRef = doc(db, 'exams', examId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as Exam : null;
};

// 3. 시험지 저장 (생성용)
export const saveExam = async (examData: any) => {
  return await addDoc(collection(db, 'exams'), {
    ...examData,
    createdAt: serverTimestamp()
  });
};

// 4. 시험지 수정 (Update용 - 에러 해결!)
export const updateExam = async (examId: string, examData: any) => {
  const docRef = doc(db, 'exams', examId);
  return await updateDoc(docRef, examData);
};

// 5. 학생 답안 제출
export const submitStudentAnswers = async (answerData: any) => {
  return await addDoc(collection(db, 'studentAnswers'), {
    ...answerData,
    submittedAt: serverTimestamp()
  });
};

// 6. 결과 조회 (선생님용)
export const getAnswersByExam = async (examId: string) => {
  const q = query(
    collection(db, 'studentAnswers'), 
    where("examId", "==", examId),
    orderBy("submittedAt", "desc")
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// 7. 선생님의 시험 목록 조회
export const getExamsByTeacher = async (teacherId: string) => {
  const q = query(
    collection(db, 'exams'), 
    where("teacherId", "==", teacherId),
    orderBy("createdAt", "desc")
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// 8. 점수 계산
export const calculateScore = (questions: any[], answers: any) => {
  let correctCount = 0;
  questions.forEach((q, idx) => {
    if (answers[`q${idx}`] === q.correctAnswer) correctCount++;
  });
  return Math.round((correctCount / questions.length) * 100);
};
