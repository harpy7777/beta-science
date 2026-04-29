'use client';
// src/app/student/[examId]/page.tsx
import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { getExam, submitStudentAnswers, calculateScore, Exam } from '@/lib/examService';
import { FlaskConical, ChevronLeft, ChevronRight, CheckCircle, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

type Phase = 'name' | 'exam' | 'result';

export default function StudentExamPage() {
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

  useEffect(() => {
    getExam(examId).then(e => {
      setExam(e);
      setLoading(false);
    });
  }, [examId]);

  function handleAnswer(questionId: string, value: string) {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  }

  function next() {
    if (!exam) return;
    if (current < exam.questions.length - 1) setCurrent(c => c + 1);
  }

  function prev() {
    if (current > 0) setCurrent(c => c - 1);
  }

  async function handleSubmit() {
    if (!exam) return;

    const unanswered = exam.questions.filter(q => !answers[q.id]);
    if (unanswered.length > 0) {
      const ok = window.confirm(`${unanswered.length}문제가 미답입니다. 제출하시겠어요?`);
      if (!ok) return;
    }

    const s = calculateScore(exam, answers);
    setScore(s);

    if (!isPreview) {
      setSubmitting(true);
      try {
        await submitStudentAnswers({
          examId: exam.id!,
          studentName,
          answers,
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

  const q = exam.questions[current];
  const answered = Object.keys(answers).length;

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
              {phase === 'exam' && (
                <div className="text-xs text-green-600">{studentName} · {exam.title}</div>
              )}
            </div>
          </div>
          {phase === 'exam' && (
            <div className="text-sm text-gray-500">
              <span className="font-bold text-green-600">{answered}</span>/{exam.questions.length} 답변
            </div>
          )}
          {isPreview && (
            <button onClick={() => router.back()} className="btn-ghost text-xs flex items-center gap-1">
              <ArrowLeft size={14} />
              미리보기 종료
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 flex flex-col">
        {/* 이름 입력 */}
        {phase === 'name' && (
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
                      setCurrent(0);
                      setPhase('exam');
                    }
                  }}
                  autoFocus
                />
              </div>
              <button
                onClick={() => {
                  if (!studentName.trim() && !isPreview) { toast.error('이름을 입력하세요'); return; }
                  setStudentName(prev => prev || '미리보기');
                  setCurrent(0);
                  setPhase('exam');
                }}
                className="btn-primary w-full mt-4"
              >
                시험 시작하기 →
              </button>
            </div>
          </div>
        )}

        {/* 시험 풀기 */}
        {phase === 'exam' && q && (
          <div className="flex-1 flex flex-col">
            {/* Progress */}
            <div className="mb-6">
              <div className="flex justify-between text-xs text-gray-400 mb-2">
                <span>문제 {current + 1} / {exam.questions.length}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  q.type === 'ox' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {q.type === 'ox' ? 'OX 문제' : '4지선다'}
                </span>
              </div>
              <div className="h-1.5 bg-gray-200 rounded-full">
                <div
                  className="progress-bar"
                  style={{ width: `${((current + 1) / exam.questions.length) * 100}%` }}
                />
              </div>
            </div>

            {/* 문제 */}
            <div className="card p-6 mb-6 flex-1">
              <p className="text-lg font-semibold text-gray-800 leading-relaxed mb-6">{q.text}</p>

              {/* OX 버튼 */}
              {q.type === 'ox' && (
                <div className="flex gap-4">
                  {(['O', 'X'] as const).map(v => (
                    <button
                      key={v}
                      onClick={() => handleAnswer(q.id, v)}
                      className={`ox-btn ${v === 'O' ? 'ox-btn-o' : 'ox-btn-x'} ${answers[q.id] === v ? 'selected' : ''}`}
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
                      onClick={() => handleAnswer(q.id, String(i + 1))}
                      className={`choice-btn ${answers[q.id] === String(i + 1) ? 'selected' : ''}`}
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
                {exam.questions.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrent(i)}
                    className={`w-8 h-8 shrink-0 rounded-full text-xs font-bold transition-all ${
                      i === current
                        ? 'bg-green-600 text-white'
                        : answers[exam.questions[i].id]
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              {current < exam.questions.length - 1 ? (
                <button onClick={next} className="btn-secondary">
                  <ChevronRight size={18} />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="btn-primary px-5"
                >
                  {submitting ? '제출 중...' : '제출'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* 결과 */}
        {phase === 'result' && (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="card p-8 w-full max-w-sm text-center">
              <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-black text-gray-800 mb-1">시험 완료!</h2>
              <p className="text-gray-400 text-sm mb-6">{studentName}의 결과</p>

              <div className="bg-green-50 rounded-2xl p-6 mb-6">
                <div className="text-6xl font-black text-green-600 mb-1">{score}</div>
                <div className="text-green-700 font-medium">점</div>
              </div>

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

              <button onClick={() => router.push('/')} className="btn-primary w-full">
                홈으로
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
