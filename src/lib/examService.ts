import { db } from './firebase';
import { 
  collection, addDoc, getDoc, getDocs, doc, query, where, orderBy, serverTimestamp 
} from 'firebase/firestore';

// 1. 접속 코드로 시험지 찾기 (학생용) - 설계도의 accessCode 사용
export const getExamByCode = async (accessCode: string) => {
  const q = query(
    collection(db, 'exams'), 
    where("accessCode", "==", accessCode.toUpperCase()),
    where("isPublished", "==", true)
  );
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  }
  return null;
};

// 2. 시험지 저장 (선생님용)
export const saveExam = async (examData: any) => {
  return await addDoc(collection(db, 'exams'), {
    ...examData,
    createdAt: serverTimestamp()
  });
};

// 3. 학생 답안 제출 - 설계도의 studentAnswers 컬렉션 사용
export const submitStudentAnswers = async (answerData: any) => {
  return await addDoc(collection(db, 'studentAnswers'), {
    ...answerData,
    submittedAt: serverTimestamp()
  });
};

// 4. 특정 시험의 결과 조회 (성적표용)
export const getAnswersByExam = async (examId: string) => {
  const q = query(
    collection(db, 'studentAnswers'), 
    where("examId", "==", examId),
    orderBy("submittedAt", "desc")
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// 5. 선생님의 모든 시험 목록 조회
export const getExamsByTeacher = async (teacherId: string) => {
  const q = query(
    collection(db, 'exams'), 
    where("teacherId", "==", teacherId),
    orderBy("createdAt", "desc")
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// 6. 점수 계산 (클로드의 q0, q1 방식 대응)
export const calculateScore = (questions: any[], answers: any) => {
  let correctCount = 0;
  questions.forEach((q, idx) => {
    if (answers[`q${idx}`] === q.correctAnswer) {
      correctCount++;
    }
  });
  return Math.round((correctCount / questions.length) * 100);
};

// 7. 기타 호환용 함수
export const getExam = async (examId: string) => {
  const docRef = doc(db, 'exams', examId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
};
