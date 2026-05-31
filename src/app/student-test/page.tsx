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

function getExamType(exam: Exam): 'ox' | 'multiple' | 'mixed' {
  const questions = exam.questions ?? [];
  const hasOX = questions.some((q: any) => q.type === 'ox');
  const hasMulti = questions.some((q: any) => q.type === 'multiple');
  if (hasOX && hasMulti) return 'mixed';
  if (hasOX) return 'ox';
  return 'multiple';
}

function makeOXSubExam(exam: Exam): Exam & { subType: 'ox' } {
  return {
    ...exam,
    id: exam.id + '__ox',
    title: exam.title + ' (OX퀴즈)',
    questions: (exam.questions ?? []).filter((q: any) => q.type === 'ox'),
    subType: 'ox',
  } as any;
}

function makeMultiSubExam(exam: Exam): Exam & { subType: 'multiple' } {
  return {
    ...exam,
    id: exam.id + '__multiple',
    title: exam.title + ' (4지선다)',
    questions: (exam.questions ?? []).filter((q: any) => q.type === 'multiple'),
    subType: 'multiple',
  } as any;
}

// ─────────────────────────────────────────────
// ★ 제목 속 동그라미 숫자(①②③…)를 보통 숫자로 변환 (소단원 구분용)
function circledToNumber(title: string): number {
  const circled = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮';
  for (const ch of title ?? '') {
    const idx = circled.indexOf(ch);
    if (idx >= 0) return idx + 1; // ① → 1, ② → 2 ...
  }
  // 동그라미가 없으면 "(1." "(2." 같은 괄호 안 숫자도 시도
  const m2 = (title ?? '').match(/\(\s*(\d+)\s*[.)]/);
  if (m2) return Number(m2[1]);
  return 99; // 소단원 번호 못 찾으면 맨 뒤
}

// ★ 정렬용: 대단원(1-1) + 소단원(①②③)을 하나의 숫자로 합침
//   "1-1 ① ..." → 1 * 1_000_000 + 1 * 1_000 + 1 = 1001001
//   "1-1 ② ..." → 1001002  / "2-3 ① ..." → 2003001
//   같은 소단원의 OX와 4지선다가 바로 붙도록 만들어 줌
function getUnitOrder(title: string): number {
  const m = (title ?? '').match(/(\d+)\s*-\s*(\d+)/);
  const big   = m ? Number(m[1]) : 999;   // 대단원 앞자리 (1-1의 1)
  const mid   = m ? Number(m[2]) : 999;   // 대단원 뒷자리 (1-1의 1)
  const small = circledToNumber(title);    // 소단원 (①②③)
  return big * 1_000_000 + mid * 1_000 + small;
}

// ★ 같은 단원 안에서 OX(0)를 먼저, 4지선다(1)를 나중에
function getTypeOrder(sub?: string): number {
  if (sub === 'ox') return 0;
  if (sub === 'multiple') return 1;
  return 2; // 혼합/기타는 뒤로
}
// ─────────────────────────────────────────────

function splitExams(exams: Exam[]): Array<Exam & { subType?: 'ox' | 'multiple' }> {
  // 1) 시험을 OX / 4지선다 단위로 펼침
  const flat: Array<Exam & { subType?: 'ox' | 'multiple' }> = [];
  for (const exam of exams) {
    const type = getExamType(exam);
    if (type === 'mixed') {
      const oxSub = makeOXSubExam(exam);
      const multiSub = makeMultiSubExam(exam);
      if (oxSub.questions.length > 0) flat.push(oxSub as any);
      if (multiSub.questions.length > 0) flat.push(multiSub as any);
    } else {
      flat.push(exam as any);
    }
  }

  // 2) 단원 번호 순 → 같은 단원이면 OX 먼저, 4지선다 나중 순으로 정렬
  flat.sort((a, b) => {
    const unitDiff = getUnitOrder(a.title) - getUnitOrder(b.title);
    if (unitDiff !== 0) return unitDiff;

    // 같은 단원이면 OX/4지선다 순서로
    const subA = (a as any).subType ?? (getExamType(a) === 'ox' ? 'ox' : getExamType(a) === 'multiple' ? 'multiple' : undefined);
    const subB = (b as any).subType ?? (getExamType(b) === 'ox' ? 'ox' : getExamType(b) === 'multiple' ? 'multiple' : undefined);
    const typeDiff = getTypeOrder(subA) - getTypeOrder(subB);
    if (typeDiff !== 0) return typeDiff;

    // 그래도 같으면 제목 가나다순
    return (a.title ?? '').localeCompare(b.title ?? '', 'ko');
  });

  return flat;
}

function getRealExamId(id: string): string {
  return id.replace(/__ox$/, '').replace(/__multiple$/, '');
}

function getTypeBadge(exam: Exam & { subType?: string }) {
  const sub = (exam as any).subType;
  if (sub === 'ox') return { label: 'OX퀴즈', color: '#10b981' };
  if (sub === 'multiple') return { label: '4지선다', color: '#3b82f6' };
  const type = getExamType(exam);
  if (type === 'ox') return { label: 'OX퀴즈', color: '#10b981' };
  if (type === 'multiple') return { label: '4지선다', color: '#3b82f6' };
  return { label: '혼합', color: '#f59e0b' };
}

// ── 공통 상단 헤더 ──
function TopHeader() {
  return (
    <div className="bg-white border-b border-green-100 px-5 py-3 flex items-center justify-center gap-3 shadow-sm sticky top-0 z-10">
      <div className="w-8 h-8 bg-green-600 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
        <FlaskConical size={16} className="text-white" />
      </div>
      <div>
        <div className="font-black text-green-900 text-sm leading-none">베타과학학원</div>
        <div className="text-xs text-green-500 mt-0.5">온라인 테스트</div>
      </div>
    </div>
  );
}

export default function StudentTestPage() {
  const [step, setStep] = useState<Step>('login');
  const [studentIdInput, setStudentIdInput] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [loading, setLoading] = useState(false);
  const [displayExams, setDisplayExams] = useState<Array<Exam & { subType?: string }>>([]);
  const [loadingExams, setLoadingExams] = useState(false);
  const [studentInfo, setStudentInfo] = useState<{ id: string; name: string; grade: string } | null>(null);

  useEffect(() => {
    try {
      const savedId = localStorage.getItem('studentId') ?? '';
      if (savedId) setStudentIdInput(savedId);
    } catch {}
  }, []);

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

      try {
        localStorage.setItem('studentId', student.id);
        localStorage.setItem('studentName', student.name);
        localStorage.setItem('studentGrade', selectedGrade);
      } catch {}

      setStudentInfo({ id: student.id, name: student.name, grade: selectedGrade });

      setLoadingExams(true);
      const gradeExams = await getExamsByGrade(selectedGrade);
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
        ...(subType ? { subType } : {}),
        ...(studentInfo.id ? { studentId: studentInfo.id } : {}),
      });
    } catch {
      // 기록 실패해도 시험 진행
    }

    if (subType) {
      window.location.href = `/student/${realExamId}?type=${subType}`;
    } else {
      window.location.href = `/student/${realExamId}`;
    }
  }

  // ── 로그인 화면 ──
  if (step === 'login') {
    return (
      // 배경을 페이지 전체에 고정, 스크롤은 내부에서
      <div
        className="bg-gradient-to-br from-green-50 via-white to-emerald-50"
        style={{ minHeight: '100svh', overflowX: 'hidden' }}
      >
        <TopHeader />

        {/* 패딩 기반 레이아웃 - viewport height 의존 제거 */}
        <div className="px-4 pt-10 pb-16">
          <div className="w-full max-w-md mx-auto">
            <div className="bg-white rounded-2xl border border-green-100 shadow-lg shadow-green-100/40 p-6 sm:p-8">
              <h2 className="font-black text-gray-800 text-lg mb-6">🎓 학생 입장</h2>

              {/* 학생 ID */}
              <div className="mb-5">
                <label className="block text-sm font-bold text-green-700 mb-1.5">학생 ID</label>
                <input
                  type="text"
                  inputMode="text"
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="off"
                  className="w-full border-2 border-green-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-500 transition-colors bg-white placeholder-gray-300"
                  placeholder="예: m01001, h01001"
                  value={studentIdInput}
                  onChange={e => setStudentIdInput(e.target.value.toLowerCase())}
                  onKeyDown={e => e.key === 'Enter' && handleEnter()}
                />
                <p className="text-xs text-gray-400 mt-1.5">선생님께 받은 학생 ID를 입력하세요</p>
              </div>

              {/* 학년 */}
              <div className="mb-7">
                <label className="block text-sm font-bold text-green-700 mb-2">학년</label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.keys(GRADE_MAP).map(g => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setSelectedGrade(g)}
                      className={`py-2.5 rounded-xl border-2 text-sm font-bold transition-all
                        ${selectedGrade === g
                          ? 'bg-green-600 border-green-600 text-white shadow-sm'
                          : 'border-green-200 text-gray-500 hover:border-green-400 hover:text-green-600 bg-white'
                        }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* 입장하기 */}
              <button
                type="button"
                onClick={handleEnter}
                disabled={loading}
                className="w-full py-3.5 bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:opacity-60 text-white font-bold text-base rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                {loading
                  ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <>입장하기 <ArrowRight size={18} /></>
                }
              </button>
            </div>

            <p className="text-center text-xs text-gray-400 mt-4 px-2">
              학생 ID는 선생님께 받은 고유 번호입니다 (예: m01001, h01001)
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── 시험 선택 화면 ──
  return (
    <div
      className="bg-gradient-to-br from-green-50 via-white to-emerald-50"
      style={{ minHeight: '100svh', overflowX: 'hidden' }}
    >
      <TopHeader />

      <div className="px-4 pt-8 pb-16">
        <div className="w-full max-w-md mx-auto">
          <div className="bg-white rounded-2xl border border-green-100 shadow-lg shadow-green-100/40 p-6 sm:p-7">

            {/* 뒤로가기 */}
            <button
              type="button"
              onClick={() => setStep('login')}
              className="text-xs font-bold text-gray-400 hover:text-green-600 mb-5 flex items-center gap-1 transition-colors"
            >
              ← 뒤로
            </button>

            {/* 타이틀 + 학생 배지 */}
            <div className="flex items-center justify-between mb-5 gap-2">
              <h2 className="font-black text-gray-800 text-lg">📋 테스트 선택</h2>
              {studentInfo && (
                <span className="bg-green-100 text-green-800 text-xs font-bold px-3 py-1.5 rounded-full flex-shrink-0">
                  {studentInfo.name} · {selectedGrade}
                </span>
              )}
            </div>

            {/* 시험 목록 */}
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
              <div className="space-y-2.5">
                {displayExams.map(exam => {
                  const badge = getTypeBadge(exam);
                  return (
                    <button
                      key={exam.id}
                      type="button"
                      onClick={() => handleSelectExam(exam)}
                      className="w-full text-left p-4 border-2 border-green-100 rounded-xl bg-white hover:bg-green-50 active:bg-green-100 hover:border-green-300 transition-all flex items-center justify-between group"
                    >
                      <div className="min-w-0 flex-1">
                        {/* 타입 배지 */}
                        <span
                          className="inline-block text-xs font-bold px-2 py-0.5 rounded-full text-white mb-1.5"
                          style={{ backgroundColor: badge.color }}
                        >
                          {badge.label}
                        </span>
                        {/* 시험명 */}
                        <div className="font-bold text-gray-900 text-sm truncate">
                          {exam.title}
                        </div>
                        {/* 과목 · 문제수 */}
                        <div className="text-xs text-gray-400 mt-0.5">
                          {exam.subject} · {exam.questions?.length ?? 0}문제
                        </div>
                      </div>
                      <ChevronRight
                        size={18}
                        className="text-green-300 group-hover:text-green-600 transition-colors flex-shrink-0 ml-3"
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
