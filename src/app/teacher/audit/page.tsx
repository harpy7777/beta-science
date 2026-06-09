'use client';
// src/app/teacher/audit/page.tsx
// 모든 시험(임시저장 포함)을 검사하여 "정말로 채점이 안 되는 문제"만 찾아내는 관리자 도구 (읽기 전용)
// ※ 4지선다 + OX 모두 검사. "선택지3" 처럼 저장돼도 새 채점 로직(isAnswerCorrect)에서 정상 채점되므로 오류로 보지 않음
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getAllPublishedExams, getExamsByTeacher, isAnswerCorrect, Exam, Question, QuestionType } from '@/lib/examService';
import { ArrowLeft, AlertTriangle, CheckCircle, Search, FlaskConical, ChevronDown, ChevronUp } from 'lucide-react';

type Issue = {
  qIndex: number;
  type: QuestionType;   // ★ 어떤 유형(ox/multiple)에서 난 오류인지
  text: string;
  answer: string;
  options: string[];
  suggestion: string;
};

// ★ 새 채점 기준으로 검사 (데이터 변경 없음)
// - 4지선다: 정답이 보기 번호(1~n) 중 하나로 채점되거나, 보기 내용과 정확히 일치하면 정상
//            "선택지3","3번","3", 보기내용("유리") 등은 모두 정상으로 판정됨
// - OX     : 정답이 O 또는 X로 채점되면 정상 (대소문자 무관)
//            학생은 O/X로 응시하므로, "참"/"맞음"/"○"/"1"/빈값 등은 전원 오답이 되는 진짜 오류
function auditQuestion(q: Question): { broken: boolean; suggestion: string } {
  const a = (q.answer ?? '').trim();

  // ── OX 문제 검사 ──
  if (q.type === 'ox') {
    // 정답이 비어있으면 채점 불가 → 진짜 오류
    if (a === '') {
      return { broken: true, suggestion: '⚠ 정답이 비어 있음 — O 또는 X 입력 필요' };
    }
    // 학생은 O/X로 응시하므로 정답도 O/X로 채점돼야 정상
    if (isAnswerCorrect('O', a) || isAnswerCorrect('X', a)) {
      return { broken: false, suggestion: '' };
    }
    // O/X 어느 쪽으로도 채점되지 않음 → 전원 오답이 되는 진짜 오류
    return { broken: true, suggestion: "⚠ OX 정답이 'O' 또는 'X'가 아님 — O 또는 X로 수정 필요" };
  }

  // ── 4지선다 문제 검사 ──
  if (q.type !== 'multiple') return { broken: false, suggestion: '' };
  const opts = q.options ?? [];
  const n = opts.length || 4;

  // 정답이 비어있으면 채점 불가 → 진짜 오류
  if (a === '') {
    return { broken: true, suggestion: '⚠ 정답이 비어 있음 — 직접 입력 필요' };
  }

  // 새 채점 로직 기준으로, 보기 1~n번 중 정답으로 채점되는 번호가 있는지 확인
  for (let i = 1; i <= n; i++) {
    if (isAnswerCorrect(String(i), a)) {
      // 정상 채점됨
      return { broken: false, suggestion: '' };
    }
  }

  // 보기 내용과 똑같이 저장된 경우도 정상으로 인정
  const exact = opts.findIndex(o => (o ?? '').trim() === a);
  if (exact >= 0) return { broken: false, suggestion: '' };

  // 위 어디에도 안 걸리면 진짜로 채점 불가능한 정답
  return { broken: true, suggestion: '⚠ 보기 어디에도 해당하지 않는 정답 — 직접 확인 필요' };
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
              type: q.type,
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
              <div className="text-xs" style={{ color: '#db2777' }}>채점 불가 문제 자동 점검</div>
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
          <div className="font-bold text-gray-900 text-sm sm:text-base mb-1">정답 검사 (4지선다 + OX)</div>
          <p className="text-xs text-gray-600 leading-relaxed">
            <b>정말로 채점이 불가능한 문제</b>만 찾아냅니다.
            4지선다는 정답이 비어 있거나 어떤 보기와도 맞지 않는 경우,
            OX는 정답이 비어 있거나 <b>O/X가 아닌 값</b>(예: &quot;참&quot;, &quot;○&quot;, &quot;1&quot;)으로 저장돼 학생 답과 채점되지 않는 경우를 잡아냅니다.
            &quot;선택지3&quot;처럼 저장된 4지선다 정답은 <b>정상적으로 채점</b>되므로 오류로 표시되지 않습니다. 이 검사는 <b>데이터를 변경하지 않습니다.</b>
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
                    {scannedScope === 'all' ? '(임시저장 포함)' : '(게시본)'}의 모든 문제(4지선다·OX)가 정상적으로 채점됩니다.
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
                    검사한 {totalExams}개 시험{scannedScope === 'all' ? '(임시저장 포함)' : '(게시본)'} 중 <b>채점이 불가능한</b> 문제가 있는 시험입니다. <b>시험을 누르면</b> 어떤 문제인지 펼쳐집니다.
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
                        {/* ★ 유형 배지: OX / 4지선다 */}
                        <span className="shrink-0 text-xs font-bold px-2 py-0.5 rounded mt-0.5"
                              style={iss.type === 'ox'
                                ? { background: '#dbeafe', color: '#1d4ed8' }
                                : { background: '#f3e8ff', color: '#7e22ce' }}>
                          {iss.type === 'ox' ? 'OX' : '4지선다'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800 font-medium leading-relaxed break-words">{iss.text}</p>
                          <div className="text-xs text-gray-600 mt-1.5 space-y-1">
                            <div className="break-words">현재 저장된 정답: <span className="font-mono font-bold text-red-600">&quot;{iss.answer}&quot;</span></div>
                            <div className="break-words">조치: <span className="font-bold" style={{ color: '#15803d' }}>{iss.suggestion}</span></div>
                            {iss.options.length > 0 && (
                              <div>
                                <span className="text-gray-400">보기</span>
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                  {iss.options.map((o, i) => (
                                    <span key={i}
                                      className="inline-block px-2 py-0.5 rounded-lg border text-xs break-all"
                                      style={{ background: '#f9fafb', borderColor: '#e5e7eb', color: '#6b7280' }}>
                                      <span className="font-bold mr-0.5">{i + 1}.</span>{o || '(미입력)'}
                                    </span>
                                  ))}
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
            각 시험의 &quot;수정하기&quot;를 눌러 4지선다·OX 정답을 다시 확인해 주세요.
          </p>
        )}
      </main>
    </div>
  );
}
