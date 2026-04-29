import { db } from './firebase';
import { 
  collection, addDoc, getDoc, getDocs, doc, query, where, orderBy, serverTimestamp, updateDoc 
} from 'firebase/firestore';

// 1. 규격 정의 - 화면 코드와 100% 일치 (text, answer)
export type QuestionType = 'multiple' | 'ox';

export interface Question {
  id: string;
  type: QuestionType;
  text: string;   // q.text 에 대응
  answer: string; // q.answer 에 대응 (에러 해결 핵심!)
  options?: string[];
  correctAnswer?: string; // 혹시 몰라 기존 이름도 남겨둠
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

// 2. 접속 코드로 시험지 찾기
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

// 3. 특정 ID로 시험지 가져오기
export const getExam = async (examId: string): Promise<Exam | null> => {
  const docRef = doc(db, 'exams', examId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as Exam : null;
};

// 4. 시험지 저장/수정
export const saveExam = async (examData: any) => {
  return await addDoc(collection(db, 'exams'), { ...examData, createdAt: serverTimestamp() });
};

export const updateExam = async (examId: string, examData: any) => {
  const docRef = doc(db, 'exams', examId);
  return await updateDoc(docRef, examData);
};

// 5. 학생 답안 제출
export const submitStudentAnswers = async (answerData: any) => {
  return await addDoc(collection(db, 'studentAnswers'), { ...answerData, submittedAt: serverTimestamp() });
};

// 6. 결과 조회
export const getAnswersByExam = async (examId: string) => {
  const q = query(collection(db, 'studentAnswers'), where("examId", "==", examId), orderBy("submittedAt", "desc"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// 7. 선생님 시험 목록 조회
export const getExamsByTeacher = async (teacherId: string) => {
  const q = query(collection(db, 'exams'), where("teacherId", "==", teacherId), orderBy("createdAt", "desc"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// 8. 채점 로직 (명칭 대응)
export const calculateScore = (exam: any, answers: any) => {
  const questions = exam.questions || []; 
  let correctCount = 0;
  questions.forEach((q: any, idx: number) => {
    // q.answer 또는 q.correctAnswer 중 있는 것을 사용
    const rightAnswer = q.answer || q.correctAnswer;
    if (answers[`q${idx}`] === rightAnswer) correctCount++;
  });
  return questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
};
