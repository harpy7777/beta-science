'use client';
// src/app/student/[examId]/page.tsx
import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  getExam, submitStudentAnswers, calculateScore, isAnswerCorrect,
  formatCorrectAnswer, buildSubmissionSummary, getSubmissionSummary,
  Exam, SubmissionSummary
} from '@/lib/examService';
import { FlaskConical, ChevronLeft, ChevronRight, CheckCircle, ArrowLeft, RefreshCw, PartyPopper } from 'lucide-react';
import toast from 'react-hot-toast';

type Phase = 'name' | 'exam' | 'result';

function StudentExamInner() {
  const { examId } = useParams<{ examId: string }>();
  const searchParams = useSearchParams();
  const isPreview = searchParams.get('preview') === '1';
  // ★ type 파라미터: 'ox' | 'multiple' | null(전체)
  const typeFilter = searchParams.get('type') as 'ox' | 'multiple' | null;
  // ★ from 파라미터: 시험을 끝낸 뒤 돌아갈 주소(클리닉 첫 페이지 등)
  const fromParam = searchParams.get('from');
  const router = useRouter();

  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>('name');
  const [studentName, setStudentName] = useState('');
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [score, setScore] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [summary, setSummary] = useState<SubmissionSummary | null>(null);

  // 재풀기용
  const [retryQuestions, setRetryQuestions] = useState<Exam['questions']>([]);
  const [isRetryMode, setIsRetryMode] = useState(false);
  const [retryAnswers, setRetryAnswers] = useState<Record<string, string>>({});
  const [retryScore, setRetryScore] = useState(0);
  const [retryPhase, setRetryPhase] = useState<'exam' | 'result'>('exam');

  const [studentId, setStudentId] = useState('');

  useEffect(() => {
    getExam(examId).then(e => {
      setExam(e);
      setLoading(false);
    });

    let savedName = '';
    let savedId   = '';
    try {
      savedName = localStorage.getItem('studentName') || '';
      savedId   = localStorage.getItem('studentId') || '';
    } catch {}

    const urlSid   = (searchParams.get('sid') || '').trim();
    const urlSname = (searchParams.get('sname') || '').trim();

    // ── 신원 결정: URL(sid/sname)이 항상 최우선 ──
    const effectiveId = urlSid || savedId || '';
    if (effectiveId) setStudentId(effectiveId);

    // sid가 있는데 저장된 id와 다르면, 저장된 이름은 '다른 학생' 것이므로 쓰지 않는다.
    let effectiveName = '';
    if (urlSname) {
      effectiveName = urlSname;
    } else if (savedName && (!urlSid || urlSid === savedId)) {
      effectiveName = savedName;
    }

    // ★ 신원을 localStorage에 고정 저장.
    //   OX → 4지선다로 넘어갈 때 페이지가 완전히 새로고침되므로,
    //   저장해두지 않으면 두 번째 시험에서 학생ID를 잃어버려 성적이 주인 없는
    //   기록으로 쌓이고 대시보드에서 걸러진다.
    try {
      if (effectiveId) localStorage.setItem('studentId', effectiveId);
      if (effectiveName) localStorage.setItem('studentName', effectiveName);
    } catch {}

    if (effectiveName) {
      setStudentName(effectiveName);
      setPhase('exam');
      setCurrent(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  // ★ typeFilter에 따라 실제로 풀 문제 목록 결정
  function getFilteredQuestions(e: Exam): Exam['questions'] {
    if (!typeFilter) return e.questions;
    return e.questions.filter((q: any) => q.type === typeFilter);
  }

  // 자동 제출
  async function autoSubmit(finalAnswers: Record<string, string>, questionsForSubmit: Exam['questions']) {
    if (!exam) return;

    const virtualExam: Exam = { ...exam, questions: questionsForSubmit };
    const s = calculateScore(virtualExam, finalAnswers);
    setScore(s);

    // 우선 이번 세션 기준 요약을 즉시 세팅 (네트워크가 느려도 화면이 비지 않도록)
    setSummary(buildSubmissionSummary(exam.questions ?? [], finalAnswers));

    if (!isPreview) {
      setSubmitting(true);
      try {
        await submitStudentAnswers({
          examId: exam.id!,
          studentName,
          studentId,
          answers: finalAnswers,
          score: s,
          totalQuestions: questionsForSubmit.length,
          subType: typeFilter,
        });
        // 저장된 이전 답안까지 합친 정확한 요약으로 교체 (OX를 먼저 푼 기록 반영)
        const merged = await getSubmissionSummary(exam.id!, studentId, finalAnswers);
        if (merged) setSummary(merged);
      } catch {
        toast.error('제출 중 오류가 발생했습니다');
      } finally {
        setSubmitting(false);
      }
    }
    setPhase('result');
  }

  function handleAnswer(questionId: string, value: string) {
    if (!exam) return;
    const filteredQs = getFilteredQuestions(exam);
    const newAnswers = { ...answers, [questionId]: value };
    setAnswers(newAnswers);

    if (current < filteredQs.length - 1) {
      setCurrent(c => c + 1);
    } else {
      autoSubmit(newAnswers, filteredQs);
    }
  }

  // 재풀기 답 선택
  function handleRetryAnswer(questionId: string, value: string) {
    const newAnswers = { ...retryAnswers, [questionId]: value };
    setRetryAnswers(newAnswers);

    if (current < retryQuestions.length - 1) {
      setCurrent(c => c + 1);
    } else {
      let correct = 0;
      retryQuestions.forEach(item => {
        if (isAnswerCorrect(newAnswers[item.id], item.answer)) correct++;
      });
      const s = Math.round((correct / retryQuestions.length) * 100);
      setRetryScore(s);
      setRetryPhase('result');
    }
  }

  // 틀린 문제만 다시 풀기
  function startRetry() {
    if (!exam) return;
    const filteredQs = getFilteredQuestions(exam);
    const wrong = filteredQs.filter(item => !isAnswerCorrect(answers[item.id], item.answer));
    if (wrong.length === 0) return;
    setRetryQuestions(wrong);
    setRetryAnswers({});
    setRetryScore(0);
    setRetryPhase('exam');
    setCurrent(0);
    setIsRetryMode(true);
  }

  function exitRetry() {
    setIsRetryMode(false);
    setCurrent(0);
  }

  // 이름 입력 후 시험 시작 (입력한 이름을 저장해 다음 유형에서도 유지)
  function startExamWithName() {
    if (!studentName.trim() && !isPreview) { toast.error('이름을 입력하세요'); return; }
    const finalName = studentName.trim() || '미리보기';
    setStudentName(finalName);
    try { localStorage.setItem('studentName', finalName); } catch {}
    setCurrent(0);
    setPhase('exam');
  }

  // ★ 사이트 내부 경로만 허용 (오픈 리다이렉트 방지)
  function safeReturnPath(p: string | null): string | null {
    if (!p) return null;
    if (p.startsWith('/') && !p.startsWith('//')) return p;
    return null;
  }

  function goToList() {
    let target = safeReturnPath(fromParam);
    if (!target) {
      try { target = safeReturnPath(localStorage.getItem('clinicReturn')); } catch {}
    }
    if (target) window.location.href = target;
    else router.push('/student-test');
  }

  // ★ 같은 시험의 다른 유형으로 이동. sid/sname을 반드시 함께 넘긴다.
  function crossTypeHref(t: 'ox' | 'multiple') {
    const params = new URLSearchParams();
    params.set('type', t);
    const sid   = (searchParams.get('sid') || studentId || '').trim();
    const sname = (searchParams.get('sname') || studentName || '').trim();
    if (sid)   params.set('sid', sid);
    if (sname) params.set('sname', sname);
    if (fromParam) params.set('from', fromParam);
    if (isPreview) params.set('preview', '1');
    return `/student/${examId}?${params.toString()}`;
  }

  function prev() {
    if (current > 0) setCurrent(c => c - 1);
  }

  function next() {
    const list = isRetryMode ? retryQuestions : (exam ? getFilteredQuestions(exam) : []);
    if (current < list.length - 1) setCurrent(c => c + 1);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">🔍</div>
          <p className="text-gray-500">시험지를 찾을 수 없어요</p>
          <button onClick={() => router.push('/')} className="btn-primary mt-4">홈으로</button>
        </div>
      </div>
    );
  }

  const filteredQuestions = getFilteredQuestions(exam);

  if (filteredQuestions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">📭</div>
          <p className="text-gray-500">
            {typeFilter === 'ox' ? 'OX 문제가 없습니다' : '4지선다 문제가 없습니다'}
          </p>
          <button onClick={() => router.back()} className="btn-primary mt-4">뒤로가기</button>
        </div>
      </div>
    );
  }

  const questions = isRetryMode ? retryQuestions : filteredQuestions;
  const currentAnswers = isRetryMode ? retryAnswers : answers;
  const q = questions[current];
  const answered = Object.keys(currentAnswers).length;

  const wrongQuestions = filteredQuestions.filter(item => !isAnswerCorrect(answers[item.id], item.answer));

  // ★ 이 시험지가 가진 유형 / 학생이 끝낸 유형
  const examHasOx    = summary ? summary.oxTotal > 0    : exam.questions.some(item => item.type === 'ox');
  const examHasMulti = summary ? summary.multiTotal > 0 : exam.questions.some(item => item.type === 'multiple');
  const oxDone       = summary ? summary.oxDone    : typeFilter !== 'multiple';
  const multiDone    = summary ? summary.multiDone : typeFilter !== 'ox';
  const allDone      = (!examHasOx || oxDone) && (!examHasMulti || multiDone);

  // 아직 안 푼 유형이 있으면 그 유형으로 안내 (없으면 null → 버튼 자체를 숨김)
  const nextType: 'ox' | 'multiple' | null =
    (examHasOx && !oxDone) ? 'ox'
    : (examHasMulti && !multiDone) ? 'multiple'
    : null;

  const nextTypeLabel = nextType === 'ox' ? 'OX퀴즈' : '4지선다';
  const nextTypeCount = nextType === 'ox'
    ? (summary?.oxTotal ?? 0)
    : (summary?.multiTotal ?? 0);

  const examDisplayTitle = typeFilter === 'ox'
    ? `${exam.title} (OX퀴즈)`
    : typeFilter === 'multiple'
    ? `${exam.title} (4지선다)`
    : exam.title;

  const typeLabel = typeFilter === 'ox'
    ? { text: 'OX퀴즈', bg: 'bg-green-100', color: 'text-green-700' }
    : typeFilter === 'multiple'
    ? { text: '4지선다', bg: 'bg-blue-100', color: 'text-blue-700' }
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-green-100 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center shrink-0">
              <FlaskConical size={16} className="text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-green-900 text-sm whitespace-nowrap">인후쌤의 과학 수업 관리 시스템</span>
                {(phase === 'exam' || isRetryMode) && (
                  <span className="text-xs text-green-600 whitespace-nowrap">· {studentName}</span>
                )}
                {(phase === 'exam' || isRetryMode) && (
                  isRetryMode ? (
                    <span className="bg-orange-100 text-orange-700 font-bold px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap">
                      오답 재풀기
                    </span>
                  ) : typeLabel ? (
                    <span className={`${typeLabel.bg} ${typeLabel.color} font-bold px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap`}>
                      {typeLabel.text}
                    </span>
                  ) : null
                )}
              </div>
              {phase === 'exam' && !isRetryMode && (
                <div className="text-[11px] text-green-600/80 truncate mt-0.5">{examDisplayTitle}</div>
              )}
            </div>
          </div>
          {(phase === 'exam' || isRetryMode) && (
            <div className="text-xs text-gray-500 shrink-0 whitespace-nowrap">
              <span className="font-bold text-green-600">{answered}</span>/{questions.length} 답변
            </div>
          )}
          {isPreview && (
            <button onClick={() => router.back()} className="btn-ghost text-xs flex items-center gap-1 shrink-0">
              <ArrowLeft size={14} />미리보기 종료
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 flex flex-col">

        {/* 이름 입력 */}
        {phase === 'name' && !isRetryMode && (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="card p-8 w-full max-w-sm text-center">
              <div className="text-4xl mb-4">👤</div>
              <h2 className="text-xl font-black text-gray-800 mb-1">{examDisplayTitle}</h2>
              {typeLabel && (
                <span className={`inline-block ${typeLabel.bg} ${typeLabel.color} text-xs font-bold px-2.5 py-1 rounded-full mb-2`}>
                  {typeLabel.text} · {filteredQuestions.length}문항
                </span>
              )}
              {!typeLabel && (
                <p className="text-gray-400 text-sm mb-6">{filteredQuestions.length}문항</p>
              )}
              <div className="text-left mb-2 mt-4">
                <label className="text-sm font-semibold text-gray-700 block mb-1.5">이름을 입력하세요</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="홍길동"
                  value={studentName}
                  onChange={e => setStudentName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && studentName.trim()) {
                      startExamWithName();
                    }
                  }}
                  autoFocus
                />
              </div>
              <button onClick={startExamWithName} className="btn-primary w-full mt-4">
                시험 시작하기 →
              </button>
            </div>
          </div>
        )}

        {/* 시험 풀기 (일반 + 재풀기 공통) */}
        {((phase === 'exam' && !isRetryMode) || (isRetryMode && retryPhase === 'exam')) && q && (
          <div className="flex-1 flex flex-col">
            {isRetryMode && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-2.5 mb-4 flex items-center justify-between">
                <span className="text-orange-700 text-sm font-semibold">
                  🔄 오답 재풀기 · {retryQuestions.length}문제
                </span>
                <button onClick={exitRetry} className="text-xs text-orange-500 underline">
                  결과로 돌아가기
                </button>
              </div>
            )}

            {/* Progress */}
            <div className="mb-6">
              <div className="flex justify-between text-xs text-gray-400 mb-2">
                <span>문제 {current + 1} / {questions.length}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  q.type === 'ox' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {q.type === 'ox' ? 'OX 문제' : '4지선다'}
                </span>
              </div>
              <div className="h-1.5 bg-gray-200 rounded-full">
                <div
                  className="progress-bar"
                  style={{ width: `${((current + 1) / questions.length) * 100}%` }}
                />
              </div>
            </div>

            {/* 문제 */}
            <div className="card p-6 mb-6 flex-1">
              <p className="text-lg font-semibold text-gray-800 leading-relaxed mb-6">{q.text}</p>

              {q.type === 'ox' && (
                <div className="flex gap-4">
                  {(['O', 'X'] as const).map(v => (
                    <button
                      key={v}
                      onClick={() => isRetryMode ? handleRetryAnswer(q.id, v) : handleAnswer(q.id, v)}
                      className={`ox-btn ${v === 'O' ? 'ox-btn-o' : 'ox-btn-x'} ${currentAnswers[q.id] === v ? 'selected' : ''}`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              )}

              {q.type === 'multiple' && q.options && (
                <div className="space-y-2">
                  {q.options.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => isRetryMode ? handleRetryAnswer(q.id, String(i + 1)) : handleAnswer(q.id, String(i + 1))}
                      className={`choice-btn ${currentAnswers[q.id] === String(i + 1) ? 'selected' : ''}`}
                    >
                      <span className="inline-flex w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-xs items-center justify-center mr-2 font-bold">
                        {i + 1}
                      </span>
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 네비게이션 */}
            <div className="flex gap-3">
              <button onClick={prev} disabled={current === 0} className="btn-secondary">
                <ChevronLeft size={18} />
              </button>
              <div className="flex gap-1 flex-1 overflow-x-auto py-1">
                {questions.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrent(i)}
                    className={`w-8 h-8 shrink-0 rounded-full text-xs font-bold transition-all ${
                      i === current
                        ? 'bg-green-600 text-white'
                        : currentAnswers[questions[i].id]
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <button onClick={next} disabled={current === questions.length - 1} className="btn-secondary">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* 재풀기 결과 */}
        {isRetryMode && retryPhase === 'result' && (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="card p-8 w-full max-w-sm text-center">
              <RefreshCw size={48} className="text-orange-500 mx-auto mb-4" />
              <h2 className="text-2xl font-black text-gray-800 mb-1">재풀기 완료!</h2>
              <p className="text-gray-400 text-sm mb-6">틀린 문제 {retryQuestions.length}개 중</p>

              <div className="bg-orange-50 rounded-2xl p-6 mb-6">
                <div className="text-6xl font-black text-orange-500 mb-1">{retryScore}</div>
                <div className="text-orange-600 font-medium">점</div>
              </div>

              <div className="space-y-3 mb-6 text-left">
                {retryQuestions.map((item, i) => {
                  const myAns = retryAnswers[item.id];
                  const isCorrect = isAnswerCorrect(myAns, item.answer);
                  return (
                    <div key={item.id} className={`p-3 rounded-xl text-sm ${
                      isCorrect ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                    }`}>
                      <div className="flex items-start gap-2">
                        <span className={`font-bold shrink-0 ${isCorrect ? 'text-green-600' : 'text-red-500'}`}>
                          {isCorrect ? '✓' : '✗'} Q{i + 1}
                        </span>
                        <div>
                          <p className={`font-medium ${isCorrect ? 'text-green-800' : 'text-red-800'}`}>
                            {item.text.length > 40 ? item.text.slice(0, 40) + '…' : item.text}
                          </p>
                          {!isCorrect && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              정답: {formatCorrectAnswer(item)}
                            </p>
                          )}
                          {item.explanation && (
                            <p className="text-xs text-gray-400 mt-0.5 italic">{item.explanation}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col gap-2">
                <button onClick={exitRetry} className="btn-primary w-full">
                  전체 결과 보기
                </button>
                <button onClick={startRetry} className="btn-secondary w-full">
                  한 번 더 풀기
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 최종 결과 */}
        {phase === 'result' && !isRetryMode && (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="card p-8 w-full max-w-sm text-center">

              {/* ★ 전부 끝냈으면 완료 표시, 아니면 이번 유형만 끝난 상태 표시 */}
              {allDone ? (
                <>
                  <PartyPopper size={48} className="text-green-500 mx-auto mb-4" />
                  <h2 className="text-2xl font-black text-gray-800 mb-1">시험 끝!</h2>
                  <p className="text-gray-500 text-sm mb-4">
                    {studentName} · {examHasOx && examHasMulti ? 'OX와 4지선다를 모두 마쳤어요' : '수고했어요'}
                  </p>
                </>
              ) : (
                <>
                  <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
                  <h2 className="text-2xl font-black text-gray-800 mb-1">
                    {typeLabel ? `${typeLabel.text} 완료!` : '시험 완료!'}
                  </h2>
                  <p className="text-gray-400 text-sm mb-4">{studentName}의 결과</p>
                </>
              )}

              {/* 이번에 푼 유형 점수 */}
              <div className="bg-green-50 rounded-2xl p-6 mb-4">
                {typeLabel && (
                  <div className={`inline-block ${typeLabel.bg} ${typeLabel.color} text-xs font-bold px-2.5 py-1 rounded-full mb-2`}>
                    {typeLabel.text}
                  </div>
                )}
                <div className="text-6xl font-black text-green-600 mb-1">{score}</div>
                <div className="text-green-700 font-medium">점</div>
                <div className="text-xs text-gray-400 mt-1">
                  {filteredQuestions.length - wrongQuestions.length} / {filteredQuestions.length} 정답
                </div>
              </div>

              {/* ★ 두 유형을 다 끝냈을 때만: 종합 점수 카드 */}
              {allDone && examHasOx && examHasMulti && summary && (
                <div className="rounded-2xl border-2 border-green-200 bg-white p-4 mb-4">
                  <div className="text-xs font-bold text-gray-400 tracking-wide mb-2">이 시험지 종합 결과</div>
                  <div className="text-4xl font-black text-green-600 leading-none">
                    {summary.overallScore}<span className="text-lg ml-1">점</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1 mb-3">
                    총 {summary.answeredCount}문항 중 {summary.totalCorrect}문항 정답
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 rounded-xl bg-green-50 py-2.5">
                      <div className="text-[11px] font-bold text-green-700 mb-0.5">OX퀴즈</div>
                      <div className="text-lg font-black text-green-700">
                        {summary.oxScore ?? 0}<span className="text-xs font-semibold ml-0.5">점</span>
                      </div>
                      <div className="text-[10px] text-gray-400">{summary.oxCorrect}/{summary.oxTotal}</div>
                    </div>
                    <div className="flex-1 rounded-xl bg-blue-50 py-2.5">
                      <div className="text-[11px] font-bold text-blue-700 mb-0.5">4지선다</div>
                      <div className="text-lg font-black text-blue-700">
                        {summary.multiScore ?? 0}<span className="text-xs font-semibold ml-0.5">점</span>
                      </div>
                      <div className="text-[10px] text-gray-400">{summary.multiCorrect}/{summary.multiTotal}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* ★ 아직 남은 유형이 있으면 안내 */}
              {!allDone && nextType && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 mb-4 text-sm text-amber-800 font-semibold">
                  아직 {nextTypeLabel}
                  {nextTypeCount > 0 ? ` ${nextTypeCount}문항이` : '가'} 남아 있어요
                </div>
              )}

              {submitting && (
                <div className="text-xs text-gray-400 mb-3">성적 저장 중...</div>
              )}

              {wrongQuestions.length > 0 && (
                <div className="bg-red-50 rounded-xl px-4 py-3 mb-6 text-sm text-red-700 font-semibold">
                  ❌ 틀린 문제 {wrongQuestions.length}개
                </div>
              )}
              {wrongQuestions.length === 0 && (
                <div className="bg-green-50 rounded-xl px-4 py-3 mb-6 text-sm text-green-700 font-semibold">
                  🎉 모두 맞혔어요!
                </div>
              )}

              <div className="space-y-3 mb-6 text-left">
                {filteredQuestions.map((item, i) => {
                  const myAns = answers[item.id];
                  const isCorrect = isAnswerCorrect(myAns, item.answer);
                  return (
                    <div key={item.id} className={`p-3 rounded-xl text-sm ${
                      isCorrect ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                    }`}>
                      <div className="flex items-start gap-2">
                        <span className={`font-bold shrink-0 ${isCorrect ? 'text-green-600' : 'text-red-500'}`}>
                          {isCorrect ? '✓' : '✗'} Q{i + 1}
                        </span>
                        <div>
                          <p className={`font-medium ${isCorrect ? 'text-green-800' : 'text-red-800'}`}>
                            {item.text.length > 40 ? item.text.slice(0, 40) + '…' : item.text}
                          </p>
                          {!isCorrect && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              정답: {formatCorrectAnswer(item)}
                            </p>
                          )}
                          {item.explanation && (
                            <p className="text-xs text-gray-400 mt-0.5 italic">{item.explanation}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col gap-2">
                {wrongQuestions.length > 0 && (
                  <button
                    onClick={startRetry}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    <RefreshCw size={16} /> 틀린 문제 다시 풀기 ({wrongQuestions.length}개)
                  </button>
                )}

                {/* ★ 남은 유형이 실제로 있을 때만 이동 버튼을 만든다.
                    (OX만 있는 시험지에서 4지선다 버튼이 뜨던 문제도 이걸로 사라짐) */}
                {nextType && (
                  <button
                    onClick={() => {
                      if (submitting) { toast('성적 저장 중이에요. 잠시만요!'); return; }
                      window.location.href = crossTypeHref(nextType);
                    }}
                    className="btn-primary w-full"
                    style={{
                      background: nextType === 'ox'
                        ? 'linear-gradient(135deg, #10b981, #059669)'
                        : 'linear-gradient(135deg, #1a3fc4, #3b5bdb)'
                    }}
                  >
                    {nextTypeLabel} 풀러 가기 →
                  </button>
                )}

                <button onClick={goToList} className="btn-secondary w-full">
                  시험 목록으로
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function StudentExamPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-green-50">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <StudentExamInner />
    </Suspense>
  );
}
