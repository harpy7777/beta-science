'use client';
// src/app/teacher/results/[examId]/page.tsx
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getExam, getAnswersByExam, isAnswerCorrect, Exam, StudentAnswer } from '@/lib/examService';
import { ArrowLeft, FlaskConical, Users, Trophy, BarChart2, ChevronDown, ChevronUp, Download } from 'lucide-react';
import toast from 'react-hot-toast';

const GRADE_ORDER = ['중1','중2','중3','고1','고2','고3'];

function gradeColor(grade: string) {
  const map: Record<string, string> = {
    '중1':'#6366f1','중2':'#8b5cf6','중3':'#a855f7',
    '고1':'#0ea5e9','고2':'#10b981','고3':'#f59e0b',
  };
  return map[grade] ?? '#6b7280';
}

function ScoreBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
      <div
        className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

function RingChart({ pct, color, size = 80 }: { pct: number; color: string; size?: number }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f3f4f6" strokeWidth={10} />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={10}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dasharray 0.8s ease' }}
      />
      <text x={size/2} y={size/2 + 5} textAnchor="middle" fontSize="14" fontWeight="700" fill={color}>
        {pct}%
      </text>
    </svg>
  );
}

export default function ResultsPage() {
  const { examId } = useParams<{ examId: string }>();
  const router = useRouter();
  const [exam, setExam] = useState<Exam | null>(null);
  const [answers, setAnswers] = useState<StudentAnswer[]>([]);
  const [loading, setLoading] = useState(true);

  // 필터
  const [gradeFilter, setGradeFilter] = useState('전체');
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push('/teacher'); return; }
      try {
        const [examData, answersData] = await Promise.all([
          getExam(examId),
          getAnswersByExam(examId),
        ]);
        setExam(examData);
        setAnswers(answersData);
      } catch {
        toast.error('데이터를 불러오지 못했습니다');
      } finally {
        setLoading(false);
      }
    });
    return unsub;
  }, [examId, router]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!exam) return <div className="p-8 text-center text-gray-400">시험지를 찾을 수 없습니다</div>;

  // 학년 목록 (응시자 기준)
  const grades = ['전체', ...GRADE_ORDER.filter(g => answers.some(a => a.grade === g))];

  // 필터된 학생
  const filtered = gradeFilter === '전체' ? answers : answers.filter(a => a.grade === gradeFilter);

  // OX / MC 문제 분리
  const oxQs = exam.questions.filter(q => q.type === 'ox');
  const mcQs = exam.questions.filter(q => q.type === 'multiple');

  // 학생별 OX점수 / MC점수 계산
  function getStudentStats(ans: StudentAnswer) {
    const oxCorrect = oxQs.filter(q => isAnswerCorrect(ans.answers?.[q.id], q.answer)).length;
    const mcCorrect = mcQs.filter(q => isAnswerCorrect(ans.answers?.[q.id], q.answer)).length;
    const totalCorrect = oxCorrect + mcCorrect;
    const totalQ = exam!.questions.length;
    const pct = totalQ > 0 ? Math.round((totalCorrect / totalQ) * 100) : 0;
    const oxPct = oxQs.length > 0 ? Math.round((oxCorrect / oxQs.length) * 100) : null;
    const mcPct = mcQs.length > 0 ? Math.round((mcCorrect / mcQs.length) * 100) : null;
    return { oxCorrect, mcCorrect, totalCorrect, pct, oxPct, mcPct };
  }

  // 평균
  const avgPct = filtered.length > 0
    ? Math.round(filtered.reduce((s, a) => s + getStudentStats(a).pct, 0) / filtered.length)
    : 0;

  // 문제별 정답률
  const qStats = exam.questions.map(q => {
    const correct = filtered.filter(a => isAnswerCorrect(a.answers?.[q.id], q.answer)).length;
    const rate = filtered.length > 0 ? Math.round((correct / filtered.length) * 100) : 0;
    return { q, correct, rate };
  });

  // CSV 다운로드
  function downloadCSV() {
    const rows = [
      ['이름', '학년', '총점(%)', 'OX정답', 'OX총수', 'OX정답률', '4지선다정답', '4지선다총수', '4지선다정답률'],
      ...filtered.map(a => {
        const s = getStudentStats(a);
        return [
          a.studentName, a.grade ?? '',
          s.pct, s.oxCorrect, oxQs.length, s.oxPct ?? '-',
          s.mcCorrect, mcQs.length, s.mcPct ?? '-',
        ];
      }),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `${exam.title}_성적결과.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── 헤더 ── */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/teacher')}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-green-700 hover:bg-green-50 px-3 py-2 rounded-lg transition-all -ml-1">
              <ArrowLeft size={16} /> 선생님 홈
            </button>
            <div className="h-5 w-px bg-gray-200" />
            <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
              <FlaskConical size={16} className="text-white" />
            </div>
            <div>
              <div className="font-bold text-gray-800 text-sm">{exam.title}</div>
              <div className="text-xs text-gray-400">성적 결과</div>
            </div>
          </div>
          <button onClick={downloadCSV}
            className="btn-secondary text-sm flex items-center gap-1.5">
            <Download size={15} /> CSV 다운로드
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* ── 요약 카드 4개 ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: '응시 인원', value: `${filtered.length}명`, icon: Users, color: '#0ea5e9' },
            { label: '평균 점수', value: `${avgPct}%`, icon: Trophy, color: '#f59e0b' },
            { label: 'OX 문항', value: `${oxQs.length}문항`, icon: BarChart2, color: '#10b981' },
            { label: '4지선다', value: `${mcQs.length}문항`, icon: BarChart2, color: '#8b5cf6' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="card p-5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                style={{ background: color + '20' }}>
                <Icon size={18} style={{ color }} />
              </div>
              <div className="text-2xl font-black text-gray-800">{value}</div>
              <div className="text-sm text-gray-400 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* ── 학년 필터 탭 ── */}
        {grades.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {grades.map(g => (
              <button key={g} onClick={() => setGradeFilter(g)}
                className="px-4 py-1.5 rounded-full text-sm font-bold border-2 transition-all"
                style={gradeFilter === g
                  ? { background: g === '전체' ? '#16a34a' : gradeColor(g), color: '#fff', borderColor: 'transparent' }
                  : { background: '#fff', color: '#6b7280', borderColor: '#e5e7eb' }
                }
              >{g}</button>
            ))}
          </div>
        )}

        <div className="grid lg:grid-cols-5 gap-6">

          {/* ── 학생별 결과 (왼쪽 넓게) ── */}
          <div className="lg:col-span-3 card p-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
              <h3 className="font-bold text-gray-800">학생별 성적</h3>
              <span className="text-xs text-gray-400">{filtered.length}명 · 클릭하면 상세 보기</span>
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-16 text-gray-300">
                <div className="text-4xl mb-2">📭</div>
                <p className="text-sm">응시 학생이 없어요</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {[...filtered]
                  .sort((a, b) => getStudentStats(b).pct - getStudentStats(a).pct)
                  .map((ans, i) => {
                    const s = getStudentStats(ans);
                    const isOpen = expandedStudent === ans.id;
                    const gc = gradeColor(ans.grade ?? '');
                    const rankColor = i === 0 ? '#f59e0b' : i === 1 ? '#9ca3af' : i === 2 ? '#cd7c3a' : '#e5e7eb';

                    return (
                      <div key={ans.id}>
                        {/* 학생 행 */}
                        <button
                          onClick={() => setExpandedStudent(isOpen ? null : (ans.id ?? null))}
                          className="w-full px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                        >
                          <div className="flex items-center gap-3">
                            {/* 순위 */}
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                              style={{ background: rankColor + '30', color: rankColor }}>
                              {i + 1}
                            </div>

                            {/* 이름 + 학년 */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold text-gray-800">{ans.studentName}</span>
                                {ans.grade && (
                                  <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                                    style={{ background: gc + '20', color: gc }}>
                                    {ans.grade}
                                  </span>
                                )}
                              </div>
                              <ScoreBar value={s.pct} color={s.pct >= 80 ? '#10b981' : s.pct >= 60 ? '#0ea5e9' : s.pct >= 40 ? '#f59e0b' : '#ef4444'} />
                            </div>

                            {/* 점수 */}
                            <div className="text-right shrink-0">
                              <div className="font-black text-lg"
                                style={{ color: s.pct >= 80 ? '#10b981' : s.pct >= 60 ? '#0ea5e9' : s.pct >= 40 ? '#f59e0b' : '#ef4444' }}>
                                {s.pct}%
                              </div>
                              <div className="text-xs text-gray-400">{s.totalCorrect}/{exam.questions.length}</div>
                            </div>

                            {isOpen ? <ChevronUp size={15} className="text-gray-300 shrink-0" /> : <ChevronDown size={15} className="text-gray-300 shrink-0" />}
                          </div>
                        </button>

                        {/* 상세 펼치기 */}
                        {isOpen && (
                          <div className="px-5 pb-5 bg-gray-50/60 border-t border-gray-100">
                            <div className="grid grid-cols-2 gap-3 mt-4">

                              {/* OX 상세 */}
                              {oxQs.length > 0 && (
                                <div className="bg-white rounded-xl p-4 border border-green-100">
                                  <div className="flex items-center justify-between mb-3">
                                    <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">OX 문제</span>
                                    <RingChart pct={s.oxPct ?? 0} color="#10b981" size={56} />
                                  </div>
                                  <div className="text-2xl font-black text-green-700">{s.oxCorrect}<span className="text-sm text-gray-400 font-normal"> / {oxQs.length}</span></div>
                                  <div className="text-xs text-gray-400 mt-0.5">맞은 문제</div>
                                  <div className="mt-3 space-y-1.5">
                                    {oxQs.map((q, qi) => {
                                      const correct = isAnswerCorrect(ans.answers?.[q.id], q.answer);
                                      return (
                                        <div key={q.id} className="flex items-center gap-2 text-xs">
                                          <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold shrink-0 ${correct ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'}`}>
                                            {correct ? '○' : '✕'}
                                          </span>
                                          <span className="text-gray-600 truncate">Q{qi+1}. {q.text.slice(0,20)}…</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* 4지선다 상세 */}
                              {mcQs.length > 0 && (
                                <div className="bg-white rounded-xl p-4 border border-blue-100">
                                  <div className="flex items-center justify-between mb-3">
                                    <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">4지선다</span>
                                    <RingChart pct={s.mcPct ?? 0} color="#6366f1" size={56} />
                                  </div>
                                  <div className="text-2xl font-black text-blue-700">{s.mcCorrect}<span className="text-sm text-gray-400 font-normal"> / {mcQs.length}</span></div>
                                  <div className="text-xs text-gray-400 mt-0.5">맞은 문제</div>
                                  <div className="mt-3 space-y-1.5">
                                    {mcQs.map((q, qi) => {
                                      const correct = isAnswerCorrect(ans.answers?.[q.id], q.answer);
                                      return (
                                        <div key={q.id} className="flex items-center gap-2 text-xs">
                                          <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold shrink-0 ${correct ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'}`}>
                                            {correct ? '○' : '✕'}
                                          </span>
                                          <span className="text-gray-600 truncate">Q{qi+1}. {q.text.slice(0,20)}…</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* ── 오른쪽 사이드 ── */}
          <div className="lg:col-span-2 space-y-4">

            {/* 전체 평균 링 차트 */}
            <div className="card p-5 text-center">
              <div className="text-sm font-semibold text-gray-500 mb-3">전체 평균 정답률</div>
              <div className="flex justify-center mb-2">
                <RingChart pct={avgPct} color={avgPct >= 80 ? '#10b981' : avgPct >= 60 ? '#0ea5e9' : avgPct >= 40 ? '#f59e0b' : '#ef4444'} size={100} />
              </div>
              {oxQs.length > 0 && mcQs.length > 0 && (
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="bg-green-50 rounded-xl p-3">
                    <div className="text-xs text-green-600 font-bold mb-1">OX 평균</div>
                    <div className="text-xl font-black text-green-700">
                      {filtered.length > 0
                        ? Math.round(filtered.reduce((s, a) => s + (getStudentStats(a).oxPct ?? 0), 0) / filtered.length)
                        : 0}%
                    </div>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-3">
                    <div className="text-xs text-blue-600 font-bold mb-1">4지선다 평균</div>
                    <div className="text-xl font-black text-blue-700">
                      {filtered.length > 0
                        ? Math.round(filtered.reduce((s, a) => s + (getStudentStats(a).mcPct ?? 0), 0) / filtered.length)
                        : 0}%
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 문제별 정답률 */}
            <div className="card p-5">
              <h3 className="font-bold text-gray-800 mb-4 text-sm">문제별 정답률</h3>
              {filtered.length === 0 ? (
                <div className="text-center py-6 text-gray-300 text-sm">데이터 없음</div>
              ) : (
                <div className="space-y-3">
                  {qStats.map(({ q, correct, rate }, i) => (
                    <div key={q.id}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${q.type === 'ox' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                            {q.type === 'ox' ? 'OX' : 'MC'}
                          </span>
                          <span className="text-xs text-gray-600 truncate max-w-[110px]">
                            Q{i+1}. {q.text.slice(0, 14)}…
                          </span>
                        </div>
                        <span className="text-xs font-bold"
                          style={{ color: rate >= 70 ? '#10b981' : rate >= 40 ? '#f59e0b' : '#ef4444' }}>
                          {correct}/{filtered.length} ({rate}%)
                        </span>
                      </div>
                      <ScoreBar
                        value={rate}
                        color={rate >= 70 ? '#10b981' : rate >= 40 ? '#f59e0b' : '#ef4444'}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 점수 분포 */}
            {filtered.length > 0 && (
              <div className="card p-5">
                <h3 className="font-bold text-gray-800 mb-4 text-sm">점수 분포</h3>
                <div className="space-y-2">
                  {[
                    { label: '90~100%', min: 90, color: '#10b981' },
                    { label: '70~89%',  min: 70, color: '#0ea5e9' },
                    { label: '50~69%',  min: 50, color: '#f59e0b' },
                    { label: '0~49%',   min: 0,  color: '#ef4444' },
                  ].map(({ label, min, color }) => {
                    const next = min === 90 ? 101 : min === 70 ? 90 : min === 50 ? 70 : 50;
                    const count = filtered.filter(a => {
                      const p = getStudentStats(a).pct;
                      return p >= min && p < next;
                    }).length;
                    const pct = Math.round((count / filtered.length) * 100);
                    return (
                      <div key={label} className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-16 shrink-0">{label}</span>
                        <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden relative">
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${pct}%`, background: color }} />
                        </div>
                        <span className="text-xs font-bold w-6 text-right" style={{ color }}>{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
