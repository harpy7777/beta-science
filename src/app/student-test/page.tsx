'use client';
// src/app/student-test/page.tsx
import { useState, useEffect } from 'react';
import {
  FlaskConical, ArrowRight, BookOpen,
  ExternalLink, ChevronRight, User, Hash, ChevronLeft
} from 'lucide-react';
import { verifyEntranceCode, getAllPublishedExams, Exam, saveResult } from '@/lib/examService';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// ✏️  과목 목록 — teacher/create/page.tsx 의 SUBJECTS 와 동일하게 유지하세요
// ─────────────────────────────────────────────────────────────────────────────
const GRADES = ['중1', '중2', '중3', '고1', '고2', '고3'];

const SUBJECTS: Record<string, string[]> = {
  '중1': ['과학내신', '과학선행'],
  '중2': ['과학내신', '과학선행'],
  '중3': ['과학내신', '과학선행'],
  '고1': ['통합과학1', '통합과학2', '화학1', '물질과 에너지', '화학 반응의 세계'],
  '고2': ['통합과학1', '통합과학2', '화학1', '물질과 에너지', '화학 반응의 세계'],
  '고3': ['통합과학1', '통합과학2', '화학1', '물질과 에너지', '화학 반응의 세계'],
};
// ─────────────────────────────────────────────────────────────────────────────

type Screen = 'login' | 'subject' | 'list';

export default function StudentTestPage() {
  const [screen, setScreen] = useState<Screen>('login');
  const [entranceCode, setEntranceCode] = useState('');
  const [studentName, setStudentName] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [loading, setLoading] = useState(false);
  const [exams, setExams] = useState<Exam[]>([]);
  const [examsLoading, setExamsLoading] = useState(false);

  // 로컬스토리지 복원
  useEffect(() => {
    const name = localStorage.getItem('studentName') ?? '';
    const grade = localStorage.getItem('studentGrade') ?? '';
    if (name) setStudentName(name);
    if (grade) setSelectedGrade(grade);
  }, []);

  const subjectList = selectedGrade ? (SUBJECTS[selectedGrade] ?? []) : [];

  // ── 로그인 → 과목 선택 화면으로 ─────────────────────────────────────────
  async function handleLogin() {
    if (!entranceCode.trim()) { toast.error('입장 코드를 입력하세요'); return; }
    if (!studentName.trim()) { toast.error('이름을 입력하세요'); return; }
    if (!selectedGrade) { toast.error('학년을 선택하세요'); return; }

    setLoading(true);
    try {
      const valid = await verifyEntranceCode(entranceCode.trim());
      if (!valid) { toast.error('입장 코드가 올바르지 않습니다'); return; }
      localStorage.setItem('studentName', studentName.trim());
      localStorage.setItem('studentGrade', selectedGrade);
      setScreen('subject');
    } catch {
      toast.error('오류가 발생했습니다. 다시 시도해주세요');
    } finally {
      setLoading(false);
    }
  }

  // ── 과목 선택 → 시험 목록 불러오기 ──────────────────────────────────────
  async function handleSubjectSelect(sub: string) {
    setSelectedSubject(sub);
    setExamsLoading(true);
    try {
      const all = await getAllPublishedExams();
      // 선택한 학년+과목만 필터링
      setExams(all.filter(e => e.grade === selectedGrade && e.subject === sub));
      setScreen('list');
    } catch {
      toast.error('시험 목록을 불러오지 못했습니다');
    } finally {
      setExamsLoading(false);
    }
  }

  // ── 시험 응시 결과 저장 (CodePen URL 클릭 시 기록) ───────────────────────
  async function handleExamClick(exam: Exam) {
    // 결과는 실제 시험 완료 후 저장되어야 하지만,
    // CodePen 외부 링크는 결과를 직접 받을 수 없으므로
    // 클릭 시각 + 학생 정보만 Firebase에 기록합니다.
    // 실제 점수는 관리자가 수동 확인하거나 /student/[id] 내장 시험으로 받습니다.
    try {
      await saveResult({
        examId: exam.id!,
        examTitle: exam.title,
        studentName: studentName.trim(),
        grade: selectedGrade,
        subject: selectedSubject,
        startedAt: new Date().toISOString(),
        score: null,       // 완료 전
        totalQuestions: exam.questions.length,
        wrongCount: null,
      });
    } catch {
      // 기록 실패해도 시험은 열림
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ── 로그인 화면 ──────────────────────────────────────────────────────────
  if (screen === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
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
            <h2 className="font-black text-gray-800 text-lg mb-6 flex items-center gap-2">
              <User size={20} className="text-green-600" />
              학생 입장
            </h2>

            <div className="space-y-4">
              {/* 입장 코드 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1">
                  <Hash size={14} className="text-green-600" /> 학원 입장 코드
                </label>
                <input
                  type="text"
                  className="input-field uppercase tracking-widest font-mono text-center text-lg"
                  placeholder="선생님께 받은 코드"
                  value={entranceCode}
                  onChange={e => setEntranceCode(e.target.value.toUpperCase())}
                  maxLength={12}
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
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                />
              </div>

              {/* 학년 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">학년</label>
                <div className="grid grid-cols-3 gap-2">
                  {GRADES.map(g => (
                    <button key={g} onClick={() => setSelectedGrade(g)}
                      className={`py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${
                        selectedGrade === g
                          ? 'bg-green-600 text-white border-green-600'
                          : 'border-gray-200 text-gray-500 hover:border-green-300 hover:text-green-600'
                      }`}>{g}</button>
                  ))}
                </div>
              </div>

              <button onClick={handleLogin} disabled={loading}
                className="btn-primary w-full py-4 text-base flex items-center justify-center gap-2 mt-2">
                {loading
                  ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <>입장하기 <ArrowRight size={18} /></>}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── 과목 선택 화면 ────────────────────────────────────────────────────────
  if (screen === 'subject') {
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
            {/* 학생 정보 + 뒤로가기 */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="font-black text-gray-800 text-lg">{studentName} 학생</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-green-100 text-green-700">{selectedGrade}</span>
                  <span className="text-sm text-gray-400">과목을 선택하세요</span>
                </div>
              </div>
              <button onClick={() => setScreen('login')} className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1">
                <ChevronLeft size={13} /> 뒤로
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {subjectList.map(sub => (
                <button
                  key={sub}
                  onClick={() => handleSubjectSelect(sub)}
                  disabled={examsLoading}
                  className="flex items-center justify-between px-5 py-4 rounded-xl border-2 border-gray-200 hover:border-green-400 hover:bg-green-50 transition-all text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-green-100 group-hover:bg-green-200 rounded-xl flex items-center justify-center transition-colors">
                      <BookOpen size={17} className="text-green-600" />
                    </div>
                    <span className="font-bold text-gray-700 group-hover:text-green-800">{sub}</span>
                  </div>
                  <ChevronRight size={18} className="text-gray-300 group-hover:text-green-500" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── 시험 목록 화면 ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 — 본인 학년+과목만 표시 */}
      <header className="bg-white border-b border-green-100 sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-green-600 rounded-xl flex items-center justify-center">
              <FlaskConical size={18} className="text-white" />
            </div>
            <div>
              <div className="font-bold text-green-900 text-sm">베타과학학원</div>
              <div className="text-xs text-green-600">온라인 테스트</div>
            </div>
          </div>

          {/* ★ 전체 학년 탭 없음 — 본인 학년·과목 배지만 표시 */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-green-100 text-green-700">{selectedGrade}</span>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">{selectedSubject}</span>
            <span className="text-sm text-gray-600 font-medium hidden sm:inline">{studentName}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* 과목 변경 */}
            <button
              onClick={() => { setSelectedSubject(''); setScreen('subject'); }}
              className="text-xs text-gray-500 hover:text-green-700 border border-gray-200 hover:border-green-300 rounded-lg px-2.5 py-1.5 flex items-center gap-1 transition-all"
            >
              <ChevronLeft size={13} /> 과목 변경
            </button>
            {/* 나가기 */}
            <button
              onClick={() => { setScreen('login'); setEntranceCode(''); setSelectedSubject(''); }}
              className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1"
            >
              나가기
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* 섹션 타이틀 */}
        <div className="mb-6">
          <h1 className="text-xl font-black text-gray-800">{selectedGrade} · {selectedSubject}</h1>
          <p className="text-sm text-gray-400 mt-1">응시할 시험지를 선택하세요</p>
        </div>

        {examsLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : exams.length === 0 ? (
          <div className="card p-16 text-center border-dashed border-2 border-green-100">
            <BookOpen size={48} className="text-green-200 mx-auto mb-4" />
            <div className="font-semibold text-gray-500 mb-1">{selectedGrade} · {selectedSubject} 시험이 아직 없어요</div>
            <p className="text-sm text-gray-400">선생님이 시험지를 올리면 여기에 나타납니다</p>
          </div>
        ) : (
          <div className="space-y-3">
            {exams.map(exam => (
              <div key={exam.id} className="card p-5 hover:border-green-300 transition-all hover:shadow-md">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
                      <BookOpen size={18} className="text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-800 truncate">{exam.title}</div>
                      <div className="text-sm text-gray-400 mt-0.5">
                        총 {exam.questions.length}문항 ·
                        OX {exam.questions.filter(q => q.type === 'ox').length}개 /
                        4지선다 {exam.questions.filter(q => q.type === 'multiple').length}개
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {/* 내장 시험 — 결과가 Firebase에 자동 저장됨 */}
                    <a href={`/student/${exam.id}`}
                      className="btn-secondary text-xs flex items-center gap-1 py-2 px-3">
                      응시 <ChevronRight size={13} />
                    </a>
                    {/* CodePen 외부 시험 */}
                    {exam.codepenUrl && (
                      <a
                        href={exam.codepenUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => handleExamClick(exam)}
                        className="btn-primary text-xs flex items-center gap-1 py-2 px-3"
                      >
                        온라인 <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
