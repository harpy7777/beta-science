'use client';
// src/app/student-test/page.tsx
import { useState, useEffect } from 'react';
import { FlaskConical, ArrowRight, User, Hash } from 'lucide-react';
import { getExamByCode, Exam, saveResult } from '@/lib/examService';
import toast from 'react-hot-toast';

const GRADES = ['중1', '중2', '중3', '고1', '고2', '고3'];

export default function StudentTestPage() {
  const [examCode, setExamCode] = useState('');
  const [studentName, setStudentName] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [loading, setLoading] = useState(false);

  // 로컬스토리지 복원
  useEffect(() => {
    const name = localStorage.getItem('studentName') ?? '';
    const grade = localStorage.getItem('studentGrade') ?? '';
    if (name) setStudentName(name);
    if (grade) setSelectedGrade(grade);
  }, []);

  async function handleEnter() {
    if (!examCode.trim()) { toast.error('시험 코드를 입력하세요'); return; }
    if (!studentName.trim()) { toast.error('이름을 입력하세요'); return; }
    if (!selectedGrade) { toast.error('학년을 선택하세요'); return; }

    setLoading(true);
    try {
      const exam: Exam | null = await getExamByCode(examCode.trim());
      if (!exam) { toast.error('시험 코드가 올바르지 않습니다'); return; }

      localStorage.setItem('studentName', studentName.trim());
      localStorage.setItem('studentGrade', selectedGrade);

      // 응시 기록 저장
      try {
        await saveResult({
          examId: exam.id!,
          examTitle: exam.title,
          studentName: studentName.trim(),
          grade: selectedGrade,
          subject: exam.subject ?? '',
          startedAt: new Date().toISOString(),
          score: null,
          totalQuestions: exam.questions.length,
          wrongCount: null,
        });
      } catch {
        // 기록 실패해도 시험은 진행
      }

      // 시험 페이지로 이동
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
            <User size={20} className="text-green-600" />
            학생 입장
          </h2>

          <div className="space-y-4">

            {/* 시험 코드 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1">
                <Hash size={14} className="text-green-600" /> 시험 코드
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

            {/* 이름 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">이름</label>
              <input
                type="text"
                className="input-field"
                placeholder="홍길동"
                value={studentName}
                onChange={e => setStudentName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleEnter()}
              />
            </div>

            {/* 학년 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">학년</label>
              <div className="grid grid-cols-3 gap-2">
                {GRADES.map(g => (
                  <button
                    key={g}
                    onClick={() => setSelectedGrade(g)}
                    className={`py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${
                      selectedGrade === g
                        ? 'bg-green-600 text-white border-green-600'
                        : 'border-gray-200 text-gray-500 hover:border-green-300 hover:text-green-600'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
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
          시험 코드는 선생님께 받은 6자리 코드입니다
        </p>
      </div>
    </div>
  );
}
