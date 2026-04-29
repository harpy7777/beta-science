import { db } from './firebase';
import { 
  collection, 
  addDoc, 
  getDoc, 
  getDocs, 
  doc, 
  query, 
  where, 
  updateDoc,
  DocumentData
} from 'firebase/firestore';

// 시험지 생성 (saveExam이라는 이름으로도 쓸 수 있게 함)
export const createExam = async (examData: any) => {
  try {
    const docRef = await addDoc(collection(db, 'exams'), {
      ...examData,
      createdAt: new Date().toISOString()
    });
    return docRef.id;
  } catch (error) {
    throw error;
  }
};
export const saveExam = createExam; // 이름 중복 대응

// 특정 시험지 조회 (getExamByCode라는 이름으로도 쓸 수 있게 함)
export const getExam = async (examId: string) => {
  try {
    const docRef = doc(db, 'exams', examId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    throw error;
  }
};
export const getExamByCode = getExam; // 이름 중복 대응

// 점수 계산 로직 추가
export const calculateScore = (questions: any[], answers: any) => {
  let score = 0;
  questions.forEach((q, index) => {
    if (answers[index] === q.correctAnswer) {
      score++;
    }
  });
  return Math.round((score / questions.length) * 100);
};

// 선생님별 시험 목록 조회
export const getExamsByTeacher = async (teacherId: string) => {
  try {
    const q = query(collection(db, 'exams'), where("teacherId", "==", teacherId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    throw error;
  }
};

// 학생 답안 제출
export const submitStudentAnswers = async (data: any) => {
  try {
    const docRef = await addDoc(collection(db, 'submissions'), {
      ...data,
      submittedAt: new Date().toISOString()
    });
    return docRef.id;
  } catch (error) {
    throw error;
  }
};

// 시험지 수정
export const updateExam = async (examId: string, examData: any) => {
  try {
    const docRef = doc(db, 'exams', examId);
    await updateDoc(docRef, examData);
  } catch (error) {
    throw error;
  }
};

// 결과 조회
export const getAnswersByExam = async (examId: string) => {
  try {
    const q = query(collection(db, 'submissions'), where("examId", "==", examId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    throw error;
  }
};
