'use client';
// src/app/teacher/audit/page.tsx
// 모든 시험(임시저장 포함)을 검사하여 "채점이 안 되는 4지선다 문제"를 찾아내는 관리자 도구 (읽기 전용)
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getAllPublishedExams, getExamsByTeacher, Exam, Question } from '@/lib/examService';
import { ArrowLeft, AlertTriangle, CheckCircle, Search, FlaskConical, ChevronDown, ChevronUp } from 'lucide-react';

type Issue = {
  qIndex: number;
  text: string;
  answer: string;
  options: string[];
  suggestion: string;
};

function auditQuestion(q: Question): { broken: boolean; suggestion: string } {
  if (q.type !== 'multiple') return { broken: false, suggestion: '' };
  const opts = q.options ?? [];
  const n = opts.length || 4;
  const a = (q.answer ?? '').trim();

  const num = Number(a);
  if (a !== '' && Number.isInteger(num) && num >= 1 && num <= n) {
    return { broken: false, suggestion: '' };
  }

  const exact = opts.findIndex(o => (o ?? '').trim() === a);
  if (exact >= 0) return { broken: true, suggestion: `${exact + 1}번 (${opts[exact]})` };

  const m = a.match(/^선택지\s*([1-9])$/);
  if (m && Number(m[1]) <= n) return { broken: true, suggestion: `${m[1]}번 (${opts[Number(m[1]) - 1] ?? '?'})` };

  return { broken: true, suggestion: '⚠ 자동 추정 불가 — 직접 확인 필요' };
}

type ExamReport = {
  id: string;
  title: string;
  grade?: string;
  subject?: string;
  isPublished: boolean;
  issues: Issue[];
};

type Scope = 'all' | 'published';

export default function AuditPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [scope, setScope] = useState<Scope>('all');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [reports, setReports] = useState<ExamReport[]>([]);
  const [totalExams, setTotalExams] = useState(0);
  const [scannedScope, setScannedScope] = useState<Scope>('all');
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) =>
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) { router.push('/teacher'); return; }
      setUser(u);
      setAuthLoading(false);
    });
    return unsub;
  }, [router]);

  async function runAudit() {
    if (!user) return;
    setLoading(true);
    setDone(false);
    setError('');
    setReports([]);
    setExpanded({});
    try {
      const exams: Exam[] = scope === 'all'
        ? await getExamsByTeacher(user.uid)
        : await getAllPublishedExams();

      setTotalExams(exams.length);
      setScannedScope(scope);

      const result: ExamReport[] = [];
      for (const exam of exams) {
        const qs = exam.questions ?? [];
        const issues: Issue[] = [];
        qs.forEach((q, i) => {
          const { broken, suggestion } = auditQuestion(q);
          if (broken) {
            issues.push({
              qIndex: i + 1,
              text: q.text || '(문제 미입력)',
              answer: q.answer ?? '(없음)',
              options: q.options ?? [],
              suggestion,
            });
          }
        });
        if (issues.length > 0) {
          result.push({
            id: exam.id ?? '',
            title: exam.title,
            grade: exam.grade,
            subject: exam.subject,
            isPublished: !!exam.isPublished,
            issues,
          });
        }
      }
      setReports(result);
      setDone(true);
    } catch (e) {
      console.error(e);
      setError('검사 중 오류가 발생했습니다. 콘솔을 확인하세요.');
    } finally {
      setLoading(false);
    }
  }

  const totalIssues = reports.reduce((s, r) => s + r.issues.length, 0);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#fdf2f8' }}>
        <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#f472b6', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-pink-100 sticky top-0 z-50">
        <div className="w-full px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => router.push('/teacher')}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                 style={{ background: 'linear-gradient(135deg,#f472b6,#db2777)' }}>
              <FlaskConical size={15} className="text-white" />
            </div>
            <div>
              <div className="font-semibold text-gray-900 text-sm leading-tight">시험 정답 검사</div>
              <div className="text-xs" style={{ color: '#db2777' }}>4지선다 채점 오류 자동 점검</div>
            </div>
          </div>
          <button onClick={() => router.push('/teacher')}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-colors"
                  style={{ borderColor: '#fce7f3', color: '#db2777' }}>
            <ArrowLeft size={14} /> 돌아가기
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <div className="rounded-2xl border border-pink-100 p-4 sm:p-5 mb-6"
             style={{ background: 'linear-gradient(135deg,#fff0f7 0%,#fdf2f8 60%,#f0f9ff 100%)' }}>
          <div className="font-bold text-gray-900 text-sm sm:text-base mb-1">4지선다 정답 검사</div>
          <p className="text-xs text-gray-600 leading-relaxed">
            <b>학생이 정답을 골라도 오답 처리되는 4지선다 문제</b>를 찾아냅니다.
            (정답이 보기 번호 1~4로 저장되지 않은 경우) 이 검사는 <b>데이터를 변경하지 않습니다.</b>
          </p>

          <div className="mt-4">
            <div className="text-xs font-semibold text-gray-500 mb-2">검사 범위</div>
            <div className="flex gap-2">
              <button
                onClick={() => setScope('all')}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold border-2 transition-all"
                style={scope === 'all'
                  ? { background: 'linear-gradient(135deg,#f472b6,#db2777)', color: '#fff', borderColor: '#db2777' }
                  : { borderColor: '#fce7f3', color: '#9ca3af' }}>
                내 전체 시험 (임시저장 포함)
              </button>
              <button
                onClick={() => setScope('published')}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold border-2 transition-all"
                style={scope === 'published'
                  ? { background: 'linear-gradient(135deg,#f472b6,#db2777)', color: '#fff', borderColor: '#db2777' }
                  : { borderColor: '#fce7f3', color: '#9ca3af' }}>
                게시된 시험만
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              {scope === 'all'
                ? '※ 배포 전 점검에 권장 — 내가 만든 임시저장 시험까지 모두 검사합니다.'
                : '※ 학생에게 공개된(게시된) 모든 시험을 검사합니다.'}
            </p>
          </div>

          <button onClick={runAudit} disabled={loading}
                  className="mt-4 flex items-center gap-2 text-sm font-bold text-white px-5 py-3 rounded-xl transition-opacity hover:opacity-85 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#f472b6,#db2777)' }}>
            {loading
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> 검사 중...</>
              : <><Search size={16} /> 검사 시작</>}
          </button>
        </div>

        {error && (
          <div className="rounded-xl p-4 border bg-red-50 border-red-200 text-red-700 text-sm font-semibold mb-4">
            {error}
          </div>
        )}

        {done && (
          <div className="mb-5">
            {totalIssues === 0 ? (
              <div className="rounded-2xl p-5 border flex items-center gap-3"
                   style={{ background: '#f0fdf4', borderColor: '#86efac' }}>
                <CheckCircle size={22} style={{ color: '#16a34a' }} />
                <div>
                  <div className="font-bold text-sm" style={{ color: '#15803d' }}>문제 없음 🎉</div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    검사한 {totalExams}개 시험
                    {scannedScope === 'all' ? '(임시저장 포함)' : '(게시본)'}의 모든 4지선다가 정상적으로 채점됩니다.
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl p-5 border flex items-center gap-3"
                   style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
                <AlertTriangle size={22} style={{ color: '#d97706' }} />
                <div>
                  <div className="font-bold text-sm" style={{ color: '#92400e' }}>
                    {reports.length}개 시험에서 {totalIssues}개 문제 발견
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    검사한 {totalExams}개 시험{scannedScope === 'all' ? '(임시저장 포함)' : '(게시본)'} 중 문제가 있는 시험입니다. <b>시험을 누르면</b> 어떤 문제인지 펼쳐집니다.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {reports.map(r => (
          <div key={r.id} className="bg-white border border-pink-100 rounded-2xl overflow-hidden mb-3">
            {/* ── 접힌 헤더: 누르면 펼쳐짐 ── */}
            <button
              onClick={() => toggleExpand(r.id)}
              className="w-full flex items-center justify-between gap-2 px-4 sm:px-5 py-3.5 text-left hover:bg-pink-50/40 transition-colors">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                {/* 오류 개수 배지 */}
                <span className="shrink-0 inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full"
                      style={{ background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' }}>
                  <AlertTriangle size={11} /> {r.issues.length}개
                </span>
                {r.isPublished
                  ? <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#dcfce7', color: '#15803d' }}>게시됨</span>
                  : <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#f3f4f6', color: '#6b7280' }}>임시저장</span>}
                {r.grade && <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#fce7f3', color: '#db2777' }}>{r.grade}</span>}
                {r.subject && <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{r.subject}</span>}
                <span className="font-bold text-gray-800 text-sm break-words">{r.title}</span>
              </div>
              <span className="shrink-0 text-gray-400">
                {expanded[r.id] ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </span>
            </button>

            {/* ── 펼쳤을 때만 보이는 상세 ── */}
            {expanded[r.id] && (
              <div className="px-4 sm:px-5 pb-5 border-t border-pink-50">
                <div className="flex justify-end pt-3 pb-1">
                  <button onClick={() => router.push(`/teacher/create?edit=${r.id}`)}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors"
                          style={{ borderColor: '#f9a8d4', color: '#db2777' }}>
                    이 시험 수정하기 →
                  </button>
                </div>
                <div className="space-y-2">
                  {r.issues.map((iss, k) => (
                    <div key={k} className="border border-amber-100 bg-amber-50/40 rounded-xl p-3">
                      <div className="flex items-start gap-2">
                        <span className="shrink-0 text-xs font-bold px-2 py-0.5 rounded mt-0.5"
                              style={{ background: '#fef3c7', color: '#92400e' }}>{iss.qIndex}번</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800 font-medium leading-relaxed break-words">{iss.text}</p>
                          <div className="text-xs text-gray-600 mt-1.5 space-y-1">
                            <div className="break-words">현재 저장된 정답: <span className="font-mono font-bold text-red-600">&quot;{iss.answer}&quot;</span> <span className="text-gray-400">(번호가 아니라 채점 안 됨)</span></div>
                            <div className="break-words">올바른 정답: <span className="font-bold" style={{ color: '#15803d' }}>{iss.suggestion}</span></div>
                            {iss.options.length > 0 && (
                              <div>
                                <span className="text-gray-400">보기</span>
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                  {iss.options.map((o, i) => {
                                    // 정답으로 추정된 번호의 보기를 초록색으로 강조
                                    const isAnswer = iss.suggestion.startsWith(`${i + 1}번`);
                                    return (
                                      <span key={i}
                                        className="inline-block px-2 py-0.5 rounded-lg border text-xs break-all"
                                        style={isAnswer
                                          ? { background: '#dcfce7', borderColor: '#86efac', color: '#15803d', fontWeight: 600 }
                                          : { background: '#f9fafb', borderColor: '#e5e7eb', color: '#6b7280' }}>
                                        <span className="font-bold mr-0.5">{i + 1}.</span>{o || '(미입력)'}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {done && totalIssues > 0 && (
          <p className="text-xs text-center text-gray-400 pb-6 leading-relaxed">
            각 시험의 &quot;수정하기&quot;를 눌러 STEP 2에서 4지선다를 다시 입력하거나,<br />
            정답 텍스트를 보기 내용과 똑같이 맞춰 다시 &quot;가져오기&quot; 하면 됩니다.
          </p>
        )}
      </main>
    </div>
  );
}
