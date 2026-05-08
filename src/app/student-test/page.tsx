'use client';
// src/app/student-test/page.tsx
import { useState, useEffect } from 'react';
import { FlaskConical, ArrowRight, ChevronRight } from 'lucide-react';
import { getStudentById, getExamsByGrade, Exam, saveResult } from '@/lib/examService';
import toast from 'react-hot-toast';

// 학년 매핑: 버튼 표시값 → Firebase grade 값
const GRADE_MAP: Record<string, string> = {
  '중1': '중1', '중2': '중2', '중3': '중3',
  '고1': '고1', '고2': '고2', '고3': '고3',
};

type Step = 'login' | 'select';

export default function StudentTestPage() {
  const [step, setStep] = useState<Step>('login');
  const [studentIdInput, setStudentIdInput] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [loading, setLoading] = useState(false);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loadingExams, setLoadingExams] = useState(false);
  const [studentInfo, setStudentInfo] = useState<{ id: string; name: string; grade: string } | null>(null);

  // 로컬스토리지 복원
  useEffect(() => {
    const savedId = localStorage.getItem('studentId') ?? '';
    if (savedId) setStudentIdInput(savedId);
  }, []);

  // 입장하기
  async function handleEnter() {
    if (!studentIdInput.trim()) { toast.error('학생 ID를 입력하세요'); return; }
    if (!selectedGrade) { toast.error('학년을 선택하세요'); return; }

    setLoading(true);
    try {
      const student = await getStudentById(studentIdInput.trim().toLowerCase());
      if (!student) {
        toast.error('학생 ID가 올바르지 않습니다. 선생님께 확인하세요');
        return;
      }

      localStorage.setItem('studentId', student.id);
      localStorage.setItem('studentName', student.name);
      localStorage.setItem('studentGrade', selectedGrade);

      setStudentInfo({ id: student.id, name: student.name, grade: selectedGrade });

      // 해당 학년 시험 불러오기
      setLoadingExams(true);
      const gradeExams = await getExamsByGrade(selectedGrade);
      setExams(gradeExams);
      setStep('select');
    } catch {
      toast.error('오류가 발생했습니다. 다시 시도해주세요');
    } finally {
      setLoading(false);
      setLoadingExams(false);
    }
  }

  // 시험 선택 후 입장
  async function handleSelectExam(exam: Exam) {
    if (!studentInfo) return;
    try {
      await saveResult({
        examId: exam.id!,
        examTitle: exam.title,
        studentName: studentInfo.name,
        grade: studentInfo.grade,
        subject: exam.subject ?? '',
        startedAt: new Date().toISOString(),
        score: null,
        totalQuestions: exam.questions.length,
        wrongCount: null,
        ...(studentInfo.id ? { studentId: studentInfo.id } : {}),
      });
    } catch {
      // 기록 실패해도 시험 진행
    }
    window.location.href = `/student/${exam.id}`;
  }

  // ── 로그인 화면 ──
  if (step === 'login') {
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
            <h2 className="font-black text-gray-800 text-lg mb-6">🎓 학생 입장</h2>

            <div className="space-y-5">

              {/* 학생 ID */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">학생 ID</label>
                <input
                  type="text"
                  className="input-field font-mono tracking-wider"
                  placeholder="예: m01001, h01001"
                  value={studentIdInput}
                  onChange={e => setStudentIdInput(e.target.value.toLowerCase())}
                  autoFocus
                />
                <p className="text-xs text-gray-400 mt-1">선생님께 받은 학생 ID를 입력하세요</p>
              </div>

              {/* 학년 선택 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">학년</label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.keys(GRADE_MAP).map(g => (
                    <button
                      key={g}
                      onClick={() => setSelectedGrade(g)}
                      className={`py-2.5 rounded-xl border-2 text-sm font-bold transition-all
                        ${selectedGrade === g
                          ? 'bg-green-600 border-green-600 text-white'
                          : 'border-green-200 text-gray-500 hover:border-green-500 hover:text-green-600'
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
            학생 ID는 선생님께 받은 고유 번호입니다 (예: m01001, h01001)
          </p>
        </div>
      </div>
    );
  }

  // ── 시험 선택 화면 ──
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

        <div className="card p-8 border-green-100 shadow-xl shadow-green-100/50">
          {/* 뒤로가기 */}
          <button
            onClick={() => setStep('login')}
            className="text-xs font-semibold text-gray-400 hover:text-green-600 mb-4 flex items-center gap-1 transition-colors"
          >
            ← 뒤로
          </button>

          {/* 학생 정보 */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-black text-gray-800 text-lg">📋 시험 선택</h2>
            {studentInfo && (
              <span className="bg-green-100 text-green-800 text-xs font-bold px-3 py-1.5 rounded-full">
                {studentInfo.name} · {selectedGrade}
              </span>
            )}
          </div>

          {loadingExams ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-3 border-green-200 border-t-green-600 rounded-full animate-spin" />
            </div>
          ) : exams.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">
              <div className="text-3xl mb-3">📭</div>
              <p>{selectedGrade}에 등록된 시험이 없습니다</p>
              <p className="text-xs mt-1">선생님께 문의하세요</p>
            </div>
          ) : (
            <div className="space-y-2">
              {exams.map(exam => (
                <button
                  key={exam.id}
                  onClick={() => handleSelectExam(exam)}
                  className="w-full text-left p-4 border-2 border-green-100 rounded-xl bg-green-50 hover:border-green-500 hover:bg-green-100 transition-all flex items-center justify-between group"
                >
                  <div>
                    <div className="font-bold text-green-900 text-sm">{exam.title}</div>
                    <div className="text-xs text-green-600 mt-0.5">
                      {exam.subject} · {exam.questions?.length ?? 0}문제
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-green-400 group-hover:text-green-600 transition-colors" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
