'use client';
// src/app/student-test/page.tsx
import { useState, useEffect } from 'react';
import { FlaskConical, ArrowRight, Hash } from 'lucide-react';
import { getExamByCode, Exam, saveResult, getStudentById } from '@/lib/examService';
import toast from 'react-hot-toast';

export default function StudentTestPage() {
  const [examCode, setExamCode] = useState('');
  const [studentIdInput, setStudentIdInput] = useState('');
  const [loading, setLoading] = useState(false);

  // 로컬스토리지 복원
  useEffect(() => {
    const savedId = localStorage.getItem('studentId') ?? '';
    if (savedId) setStudentIdInput(savedId);
  }, []);

  async function handleEnter() {
    if (!examCode.trim()) { toast.error('시험 코드를 입력하세요'); return; }
    if (!studentIdInput.trim()) { toast.error('학생 ID를 입력하세요'); return; }

    setLoading(true);
    try {
      // 학생 ID 확인
      const student = await getStudentById(studentIdInput.trim().toLowerCase());
      if (!student) {
        toast.error('학생 ID가 올바르지 않습니다. 선생님께 확인하세요');
        return;
      }

      // 시험 코드 확인
      const exam: Exam | null = await getExamByCode(examCode.trim());
      if (!exam) { toast.error('시험 코드가 올바르지 않습니다'); return; }

      // 로컬스토리지 저장
      localStorage.setItem('studentId', student.id);
      localStorage.setItem('studentName', student.name);
      localStorage.setItem('studentGrade', student.grade);

      // 응시 기록 저장
      try {
        await saveResult({
  examId: exam.id!,
  examTitle: exam.title,
  studentName: student.name,
  grade: student.grade,
  subject: exam.subject ?? '',
  startedAt: new Date().toISOString(),
  score: null,
  totalQuestions: exam.questions.length,
  wrongCount: null,
  ...(student.id ? { studentId: student.id } : {}),
});
      } catch {
        // 기록 실패해도 시험은 진행
      }

      window.location.href = `/student/${exam.id}`;
    } catch {
      toast.error('오류가 발생했습니다. 다시 시도해주세요');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* 로고 */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 bg-green-600 rounded-2xl flex items-center justify-center shadow-lg">
            <FlaskConical size={24} className="text-white" />
          </div>
          <div>
            <div className="font-black text-green-900 text-2xl leading-none">베타과학학원</div>
            <div className="text-sm text-green-600 mt-0.5">온라인 테스트</div>
          </div>
        </div>

        {/* 카드 */}
        <div className="card p-8 border-green-100 shadow-xl shadow-green-100/50">
          <h2 className="font-black text-gray-800 text-lg mb-6 flex items-center gap-2">
            <Hash size={20} className="text-green-600" />
            학생 입장
          </h2>

          <div className="space-y-4">

            {/* 시험 코드 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                시험 코드
              </label>
              <input
                type="text"
                className="input-field uppercase tracking-widest font-mono text-center text-lg"
                placeholder="선생님께 받은 코드"
                value={examCode}
                onChange={e => setExamCode(e.target.value.toUpperCase())}
                maxLength={12}
                autoFocus
              />
            </div>

            {/* 학생 ID */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                학생 ID
              </label>
              <input
                type="text"
                className="input-field font-mono tracking-wider"
                placeholder="예: m01001"
                value={studentIdInput}
                onChange={e => setStudentIdInput(e.target.value.toLowerCase())}
                onKeyDown={e => e.key === 'Enter' && handleEnter()}
              />
              <p className="text-xs text-gray-400 mt-1">선생님께 받은 학생 ID를 입력하세요</p>
            </div>

            <button
              onClick={handleEnter}
              disabled={loading}
              className="btn-primary w-full py-4 text-base flex items-center justify-center gap-2 mt-2"
            >
              {loading
                ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <>입장하기 <ArrowRight size={18} /></>
              }
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          학생 ID는 선생님께 받은 고유 번호입니다 (예: m01001, h01001)
        </p>
      </div>
    </div>
  );
}
