'use client';
// src/app/student/[examId]/page.tsx
import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { getExam, submitStudentAnswers, calculateScore, Exam } from '@/lib/examService';
import { FlaskConical, ChevronLeft, ChevronRight, CheckCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

type Phase = 'name' | 'exam' | 'result';

function StudentExamInner() {
  const { examId } = useParams<{ examId: string }>();
  const searchParams = useSearchParams();
  const isPreview = searchParams.get('preview') === '1';
  const router = useRouter();

  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>('name');
  const [studentName, setStudentName] = useState('');
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [score, setScore] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // 재풀기용 - 틀린 문제만 추린 가상 시험지
  const [retryQuestions, setRetryQuestions] = useState<Exam['questions']>([]);
  const [isRetryMode, setIsRetryMode] = useState(false);
  const [retryAnswers, setRetryAnswers] = useState<Record<string, string>>({});
  const [retryScore, setRetryScore] = useState(0);
  const [retryPhase, setRetryPhase] = useState<'exam' | 'result'>('exam');

  useEffect(() => {
    getExam(examId).then(e => {
      setExam(e);
      setLoading(false);
    });
    const savedName = localStorage.getItem('studentName');
    if (savedName) {
      setStudentName(savedName);
      setPhase('exam');
      setCurrent(0);
    }
  }, [examId]);

  // 자동 제출 (마지막 문제 답 선택 시)
  async function autoSubmit(finalAnswers: Record<string, string>) {
    if (!exam) return;
    const s = calculateScore(exam, finalAnswers);
    setScore(s);

    if (!isPreview) {
      setSubmitting(true);
      try {
        await submitStudentAnswers({
          examId: exam.id!,
          studentName,
          answers: finalAnswers,
          score: s,
          totalQuestions: exam.questions.length,
        });
      } catch {
        toast.error('제출 중 오류가 발생했습니다');
      } finally {
        setSubmitting(false);
      }
    }
    setPhase('result');
  }

  function handleAnswer(questionId: string, value: string) {
    const newAnswers = { ...answers, [questionId]: value };
    setAnswers(newAnswers);

    if (!exam) return;
    if (current < exam.questions.length - 1) {
      setCurrent(c => c + 1);
    } else {
      // 마지막 문제 → 자동 제출
      autoSubmit(newAnswers);
    }
  }

  // 재풀기 답 선택
  function handleRetryAnswer(questionId: string, value: string) {
    const newAnswers = { ...retryAnswers, [questionId]: value };
    setRetryAnswers(newAnswers);

    if (current < retryQuestions.length - 1) {
      setCurrent(c => c + 1);
    } else {
      // 재풀기 마지막 문제 → 결과
      let correct = 0;
      retryQuestions.forEach(q => {
        if (newAnswers[q.id] === q.answer) correct++;
      });
      const s = Math.round((correct / retryQuestions.length) * 100);
      setRetryScore(s);
      setRetryPhase('result');
    }
  }

  // 틀린 문제만 다시 풀기 시작
  function startRetry() {
    if (!exam) return;
    const wrong = exam.questions.filter(q => answers[q.id] !== q.answer);
    if (wrong.length === 0) return;
    setRetryQuestions(wrong);
    setRetryAnswers({});
    setRetryScore(0);
    setRetryPhase('exam');
    setCurrent(0);
    setIsRetryMode(true);
  }

  // 재풀기 종료 후 메인 결과로
  function exitRetry() {
    setIsRetryMode(false);
    setCurrent(0);
  }

  function prev() {
    if (current > 0) setCurrent(c => c - 1);
  }

  function next() {
    const list = isRetryMode ? retryQuestions : exam?.questions ?? [];
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

  const questions = isRetryMode ? retryQuestions : exam.questions;
  const currentAnswers = isRetryMode ? retryAnswers : answers;
  const q = questions[current];
  const answered = Object.keys(currentAnswers).length;

  // 틀린 문제 목록 (결과 화면용)
  const wrongQuestions = exam.questions.filter(q => answers[q.id] !== q.answer);

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-green-100 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
              <FlaskConical size={16} className="text-white" />
            </div>
            <div>
              <div className="font-bold text-green-900 text-sm">베타과학학원</div>
              {(phase === 'exam' || isRetryMode) && (
                <div className="text-xs text-green-600">
                  {studentName} · {isRetryMode ? '오답 재풀기' : exam.title}
                </div>
              )}
            </div>
          </div>
          {(phase === 'exam' || isRetryMode) && (
            <div className="text-sm text-gray-500">
              <span className="font-bold text-green-600">{answered}</span>/{questions.length} 답변
            </div>
          )}
          {isPreview && (
            <button onClick={() => router.back()} className="btn-ghost text-xs flex items-center gap-1">
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
              <h2 className="text-xl font-black text-gray-800 mb-1">{exam.title}</h2>
              <p className="text-gray-400 text-sm mb-6">{exam.questions.length}문항</p>
              <div className="text-left mb-2">
                <label className="text-sm font-semibold text-gray-700 block mb-1.5">이름을 입력하세요</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="홍길동"
                  value={studentName}
                  onChange={e => setStudentName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && studentName.trim()) {
                      setCurrent(0); setPhase('exam');
                    }
                  }}
                  autoFocus
                />
              </div>
              <button
                onClick={() => {
                  if (!studentName.trim() && !isPreview) { toast.error('이름을 입력하세요'); return; }
                  setStudentName(prev => prev || '미리보기');
                  setCurrent(0); setPhase('exam');
                }}
                className="btn-primary w-full mt-4"
              >
                시험 시작하기 →
              </button>
            </div>
          </div>
        )}

        {/* 시험 풀기 (일반 + 재풀기 공통) */}
        {((phase === 'exam' && !isRetryMode) || (isRetryMode && retryPhase === 'exam')) && q && (
          <div className="flex-1 flex flex-col">
            {/* 재풀기 안내 배너 */}
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

              {/* OX */}
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

              {/* 4지선다 */}
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
                {retryQuestions.map((q, i) => {
                  const myAns = retryAnswers[q.id];
                  const isCorrect = myAns === q.answer;
                  return (
                    <div key={q.id} className={`p-3 rounded-xl text-sm ${
                      isCorrect ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                    }`}>
                      <div className="flex items-start gap-2">
                        <span className={`font-bold shrink-0 ${isCorrect ? 'text-green-600' : 'text-red-500'}`}>
                          {isCorrect ? '✓' : '✗'} Q{i + 1}
                        </span>
                        <div>
                          <p className={`font-medium ${isCorrect ? 'text-green-800' : 'text-red-800'}`}>
                            {q.text.length > 40 ? q.text.slice(0, 40) + '…' : q.text}
                          </p>
                          {!isCorrect && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              정답: {q.type === 'ox' ? q.answer : `${q.answer}번 - ${q.options?.[Number(q.answer) - 1]}`}
                            </p>
                          )}
                          {q.explanation && (
                            <p className="text-xs text-gray-400 mt-0.5 italic">{q.explanation}</p>
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
              <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-black text-gray-800 mb-1">시험 완료!</h2>
              <p className="text-gray-400 text-sm mb-6">{studentName}의 결과</p>

              <div className="bg-green-50 rounded-2xl p-6 mb-4">
                <div className="text-6xl font-black text-green-600 mb-1">{score}</div>
                <div className="text-green-700 font-medium">점</div>
              </div>

              {/* 틀린 문제 수 요약 */}
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
                {exam.questions.map((q, i) => {
                  const myAns = answers[q.id];
                  const isCorrect = myAns === q.answer;
                  return (
                    <div key={q.id} className={`p-3 rounded-xl text-sm ${
                      isCorrect ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                    }`}>
                      <div className="flex items-start gap-2">
                        <span className={`font-bold shrink-0 ${isCorrect ? 'text-green-600' : 'text-red-500'}`}>
                          {isCorrect ? '✓' : '✗'} Q{i + 1}
                        </span>
                        <div>
                          <p className={`font-medium ${isCorrect ? 'text-green-800' : 'text-red-800'}`}>
                            {q.text.length > 40 ? q.text.slice(0, 40) + '…' : q.text}
                          </p>
                          {!isCorrect && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              정답: {q.type === 'ox' ? q.answer : `${q.answer}번 - ${q.options?.[Number(q.answer) - 1]}`}
                            </p>
                          )}
                          {q.explanation && (
                            <p className="text-xs text-gray-400 mt-0.5 italic">{q.explanation}</p>
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
                <button onClick={() => router.push('/')} className="btn-secondary w-full">
                  홈으로
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
