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

// 시험지 데이터 타입 정의
export interface ExamData {
  id?: string;
  teacherId: string;
  title: string;
  questions: any[];
  createdAt?: string;
}

// 학생 답안 타입 정의
export interface SubmissionData {
  examId: string;
  studentName: string;
  answers: any;
  submittedAt?: string;
}

// 시험지 생성
export const createExam = async (examData: ExamData): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, 'exams'), {
      ...examData,
      createdAt: new Date().toISOString()
    });
    return docRef.id;
  } catch (error) {
    console.error("Error adding document: ", error);
    throw error;
  }
};

// 특정 시험지 조회
export const getExam = async (examId: string): Promise<DocumentData | null> => {
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

// 선생님별 시험 목록 조회
export const getExamsByTeacher = async (teacherId: string): Promise<any[]> => {
  try {
    const q = query(collection(db, 'exams'), where("teacherId", "==", teacherId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    throw error;
  }
};

// 학생 답안 제출
export const submitStudentAnswers = async (data: SubmissionData): Promise<string> => {
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
export const updateExam = async (examId: string, examData: Partial<ExamData>): Promise<void> => {
  try {
    const docRef = doc(db, 'exams', examId);
    await updateDoc(docRef, examData as any);
  } catch (error) {
    throw error;
  }
};

// 결과 조회
export const getAnswersByExam = async (examId: string): Promise<any[]> => {
  try {
    const q = query(collection(db, 'submissions'), where("examId", "==", examId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    throw error;
  }
};
