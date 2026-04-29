'use client';
// src/app/teacher/results/[examId]/page.tsx
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getExam, getAnswersByExam, Exam, StudentAnswer } from '@/lib/examService';
import { ArrowLeft, FlaskConical, Users, Trophy, BarChart2, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ResultsPage() {
  const { examId } = useParams<{ examId: string }>();
  const router = useRouter();
  const [exam, setExam] = useState<Exam | null>(null);
  const [answers, setAnswers] = useState<StudentAnswer[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!exam) return <div className="p-8 text-center text-gray-400">시험지를 찾을 수 없습니다</div>;

  const avg = answers.length > 0
    ? Math.round(answers.reduce((a, s) => a + (s.score ?? 0), 0) / answers.length)
    : 0;

  // 문제별 정답률
  const questionStats = exam.questions.map(q => {
    const correct = answers.filter(a => a.answers[q.id] === q.answer).length;
    return {
      q,
      correct,
      rate: answers.length > 0 ? Math.round((correct / answers.length) * 100) : 0,
    };
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-green-100 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-4">
          <button onClick={() => router.push('/teacher')} className="btn-ghost -ml-2">
            <ArrowLeft size={18} />
          </button>
          <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
            <FlaskConical size={16} className="text-white" />
          </div>
          <div>
            <div className="font-bold text-gray-800">{exam.title}</div>
            <div className="text-xs text-gray-400">성적 결과</div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* 통계 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: '응시 인원', value: `${answers.length}명`, icon: Users, color: 'text-blue-600 bg-blue-100' },
            { label: '평균 점수', value: `${avg}점`, icon: Trophy, color: 'text-amber-600 bg-amber-100' },
            { label: '총 문항', value: `${exam.questions.length}문항`, icon: BarChart2, color: 'text-green-600 bg-green-100' },
            { label: '코드', value: exam.accessCode || '-', icon: Clock, color: 'text-purple-600 bg-purple-100' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="card p-5">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${color}`}>
                <Icon size={18} />
              </div>
              <div className="text-2xl font-black text-gray-800">{value}</div>
              <div className="text-sm text-gray-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* 학생별 결과 */}
          <div className="card p-6">
            <h3 className="font-bold text-gray-800 mb-4">학생별 점수</h3>
            {answers.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <div className="text-4xl mb-2">📭</div>
                <p className="text-sm">아직 응시한 학생이 없어요</p>
              </div>
            ) : (
              <div className="space-y-3">
                {answers
                  .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
                  .map((ans, i) => (
                    <div key={ans.id} className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
                        i === 0 ? 'bg-amber-400 text-white' :
                        i === 1 ? 'bg-gray-300 text-white' :
                        i === 2 ? 'bg-orange-400 text-white' :
                        'bg-gray-100 text-gray-500'
                      }`}>{i + 1}</span>
                      <span className="flex-1 font-medium text-gray-700 text-sm">{ans.studentName}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full transition-all"
                            style={{ width: `${ans.score ?? 0}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold text-gray-700 w-10 text-right">
                          {ans.score ?? 0}점
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* 문제별 정답률 */}
          <div className="card p-6">
            <h3 className="font-bold text-gray-800 mb-4">문제별 정답률</h3>
            {answers.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <div className="text-4xl mb-2">📊</div>
                <p className="text-sm">응시 데이터가 없어요</p>
              </div>
            ) : (
              <div className="space-y-3">
                {questionStats.map(({ q, correct, rate }, i) => (
                  <div key={q.id}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-600 truncate flex-1 pr-2">
                        Q{i + 1}. {q.text.length > 24 ? q.text.slice(0, 24) + '…' : q.text}
                      </span>
                      <span className={`font-bold text-xs ${
                        rate >= 70 ? 'text-green-600' : rate >= 40 ? 'text-amber-600' : 'text-red-500'
                      }`}>
                        {correct}/{answers.length} ({rate}%)
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          rate >= 70 ? 'bg-green-400' : rate >= 40 ? 'bg-amber-400' : 'bg-red-400'
                        }`}
                        style={{ width: `${rate}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
