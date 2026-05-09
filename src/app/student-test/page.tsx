'use client';
// src/app/student-test/page.tsx
import { useState, useEffect } from 'react';
import { FlaskConical, ArrowRight, ChevronRight } from 'lucide-react';
import { getStudentById, getExamsByGrade, Exam, saveResult } from '@/lib/examService';
import toast from 'react-hot-toast';

// 학년 매핑
const GRADE_MAP: Record<string, string> = {
  '중1': '중1', '중2': '중2', '중3': '중3',
  '고1': '고1', '고2': '고2', '고3': '고3',
};

type Step = 'login' | 'select';

// 시험을 OX / 4지선다 / 혼합 중 어떤 타입인지 판별
function getExamType(exam: Exam): 'ox' | 'multiple' | 'mixed' {
  const questions = exam.questions ?? [];
  const hasOX = questions.some((q: any) => q.type === 'ox');
  const hasMulti = questions.some((q: any) => q.type === 'multiple');
  if (hasOX && hasMulti) return 'mixed';
  if (hasOX) return 'ox';
  return 'multiple';
}

// 혼합 시험에서 OX만 추출한 가상 시험 객체 생성
function makeOXSubExam(exam: Exam): Exam & { subType: 'ox' } {
  return {
    ...exam,
    id: exam.id + '__ox',
    title: exam.title + ' (OX퀴즈)',
    questions: (exam.questions ?? []).filter((q: any) => q.type === 'ox'),
    subType: 'ox',
  } as any;
}

// 혼합 시험에서 4지선다만 추출한 가상 시험 객체 생성
function makeMultiSubExam(exam: Exam): Exam & { subType: 'multiple' } {
  return {
    ...exam,
    id: exam.id + '__multiple',
    title: exam.title + ' (4지선다)',
    questions: (exam.questions ?? []).filter((q: any) => q.type === 'multiple'),
    subType: 'multiple',
  } as any;
}

// 시험 목록을 분리/정리: 혼합 시험은 OX와 4지선다 두 항목으로 분리
function splitExams(exams: Exam[]): Array<Exam & { subType?: 'ox' | 'multiple' }> {
  const result: Array<Exam & { subType?: 'ox' | 'multiple' }> = [];
  for (const exam of exams) {
    const type = getExamType(exam);
    if (type === 'mixed') {
      const oxSub = makeOXSubExam(exam);
      const multiSub = makeMultiSubExam(exam);
      if (oxSub.questions.length > 0) result.push(oxSub as any);
      if (multiSub.questions.length > 0) result.push(multiSub as any);
    } else {
      result.push(exam as any);
    }
  }
  return result;
}

// 실제 examId: __ox / __multiple 접미사 제거
function getRealExamId(id: string): string {
  return id.replace(/__ox$/, '').replace(/__multiple$/, '');
}

// 시험 타입 라벨/색상
function getTypeBadge(exam: Exam & { subType?: string }) {
  const sub = (exam as any).subType;
  if (sub === 'ox') return { label: 'OX퀴즈', color: '#10b981' };
  if (sub === 'multiple') return { label: '4지선다', color: '#1a3fc4' };
  const type = getExamType(exam);
  if (type === 'ox') return { label: 'OX퀴즈', color: '#10b981' };
  if (type === 'multiple') return { label: '4지선다', color: '#1a3fc4' };
  return { label: '혼합', color: '#f59e0b' };
}

export default function StudentTestPage() {
  const [step, setStep] = useState<Step>('login');
  const [studentIdInput, setStudentIdInput] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [loading, setLoading] = useState(false);
  const [displayExams, setDisplayExams] = useState<Array<Exam & { subType?: string }>>([]);
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

      // ★ OX/4지선다 분리 처리
      const split = splitExams(gradeExams);
      setDisplayExams(split);
      setStep('select');
    } catch {
      toast.error('오류가 발생했습니다. 다시 시도해주세요');
    } finally {
      setLoading(false);
      setLoadingExams(false);
    }
  }

  // 시험 선택 후 입장
  async function handleSelectExam(exam: Exam & { subType?: string }) {
    if (!studentInfo) return;

    const realExamId = getRealExamId(exam.id!);
    const subType = (exam as any).subType as string | undefined;

    try {
      await saveResult({
        examId: realExamId,
        examTitle: exam.title,
        studentName: studentInfo.name,
        grade: studentInfo.grade,
        subject: exam.subject ?? '',
        startedAt: new Date().toISOString(),
        score: null,
        totalQuestions: exam.questions.length,
        wrongCount: null,
        // subType이 있으면 기록 (OX만 풀기 / 4지선다만 풀기)
        ...(subType ? { subType } : {}),
        ...(studentInfo.id ? { studentId: studentInfo.id } : {}),
      });
    } catch {
      // 기록 실패해도 시험 진행
    }

    // subType이 있으면 URL에 파라미터 추가하여 해당 타입만 보여주도록
    if (subType) {
      window.location.href = `/student/${realExamId}?type=${subType}`;
    } else {
      window.location.href = `/student/${realExamId}`;
    }
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
  // OX퀴즈 목록 / 4지선다 목록 분리 렌더링
  const oxExams = displayExams.filter(e => (e as any).subType === 'ox' || (!((e as any).subType) && getExamType(e as Exam) === 'ox'));
  const multiExams = displayExams.filter(e => (e as any).subType === 'multiple' || (!((e as any).subType) && getExamType(e as Exam) === 'multiple'));

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
              <div className="w-8 h-8 border-2 border-green-200 border-t-green-600 rounded-full animate-spin" />
            </div>
          ) : displayExams.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">
              <div className="text-3xl mb-3">📭</div>
              <p>{selectedGrade}에 등록된 시험이 없습니다</p>
              <p className="text-xs mt-1">선생님께 문의하세요</p>
            </div>
          ) : (
            <div className="space-y-4">

              {/* OX퀴즈 섹션 */}
              {oxExams.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="text-xs font-bold px-2.5 py-1 rounded-full text-white"
                      style={{ backgroundColor: '#10b981' }}
                    >
                      OX퀴즈
                    </span>
                    <span className="text-xs text-gray-400">{oxExams.length}개</span>
                  </div>
                  <div className="space-y-2">
                    {oxExams.map(exam => (
                      <button
                        key={exam.id}
                        onClick={() => handleSelectExam(exam)}
                        className="w-full text-left p-4 border-2 rounded-xl bg-green-50 hover:bg-green-100 transition-all flex items-center justify-between group"
                        style={{ borderColor: '#a7f3d0' }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = '#10b981')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = '#a7f3d0')}
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
                </div>
              )}

              {/* 4지선다 섹션 */}
              {multiExams.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="text-xs font-bold px-2.5 py-1 rounded-full text-white"
                      style={{ backgroundColor: '#1a3fc4' }}
                    >
                      4지선다
                    </span>
                    <span className="text-xs text-gray-400">{multiExams.length}개</span>
                  </div>
                  <div className="space-y-2">
                    {multiExams.map(exam => (
                      <button
                        key={exam.id}
                        onClick={() => handleSelectExam(exam)}
                        className="w-full text-left p-4 border-2 rounded-xl transition-all flex items-center justify-between group"
                        style={{ backgroundColor: '#eef2ff', borderColor: '#c7d2fe' }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = '#1a3fc4';
                          e.currentTarget.style.backgroundColor = '#e0e7ff';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = '#c7d2fe';
                          e.currentTarget.style.backgroundColor = '#eef2ff';
                        }}
                      >
                        <div>
                          <div className="font-bold text-sm" style={{ color: '#1e3a8a' }}>{exam.title}</div>
                          <div className="text-xs mt-0.5" style={{ color: '#3730a3' }}>
                            {exam.subject} · {exam.questions?.length ?? 0}문제
                          </div>
                        </div>
                        <ChevronRight size={18} style={{ color: '#818cf8' }} className="group-hover:opacity-100 opacity-60 transition-opacity" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
