'use client';
// src/app/teacher/page.tsx
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged, User
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getExamsByTeacher, Exam } from '@/lib/examService';
import {
  FlaskConical, Plus, LogOut, BookOpen, Users,
  Copy, Eye, BarChart3, CheckCircle, Clock
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function TeacherPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [exams, setExams] = useState<Exam[]>([]);
  const [examsLoading, setExamsLoading] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        setExamsLoading(true);
        try {
          const data = await getExamsByTeacher(u.uid);
          setExams(data);
        } catch {
          toast.error('시험지를 불러오지 못했습니다');
        } finally {
          setExamsLoading(false);
        }
      }
    });
    return unsub;
  }, []);

  async function handleLogin() {
    if (!email || !password) { toast.error('이메일과 비밀번호를 입력하세요'); return; }
    setLoginLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success('로그인 성공!');
    } catch {
      toast.error('로그인 실패: 이메일 또는 비밀번호를 확인하세요');
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleLogout() {
    await signOut(auth);
    setExams([]);
    toast('로그아웃 되었습니다');
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    toast.success(`코드 ${code} 복사됨!`);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // 로그인 화면
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center p-4">
        <div className="card p-8 w-full max-w-sm border-green-200">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center">
              <FlaskConical size={20} className="text-white" />
            </div>
            <div>
              <div className="font-bold text-green-900">베타과학학원</div>
              <div className="text-xs text-green-600">선생님 로그인</div>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">이메일</label>
              <input
                type="email"
                className="input-field"
                placeholder="teacher@beta.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">비밀번호</label>
              <input
                type="password"
                className="input-field"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
            </div>
            <button
              onClick={handleLogin}
              disabled={loginLoading}
              className="btn-primary w-full mt-2"
            >
              {loginLoading ? '로그인 중...' : '로그인'}
            </button>
          </div>
          <p className="text-xs text-gray-400 text-center mt-6">
            Firebase Console에서 계정을 생성해주세요
          </p>
        </div>
      </div>
    );
  }

  // 대시보드
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-green-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-green-600 rounded-xl flex items-center justify-center">
              <FlaskConical size={18} className="text-white" />
            </div>
            <div>
              <div className="font-bold text-green-900">베타과학학원</div>
              <div className="text-xs text-green-600">선생님 대시보드</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 hidden sm:block">{user.email}</span>
            <button
              onClick={() => router.push('/teacher/create')}
              className="btn-primary text-sm flex items-center gap-1.5"
            >
              <Plus size={16} />
              시험지 만들기
            </button>
            <button onClick={handleLogout} className="btn-ghost text-gray-500">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* 통계 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: '전체 시험지', value: exams.length, icon: BookOpen, color: 'text-green-600 bg-green-100' },
            { label: '게시된 시험', value: exams.filter(e => e.isPublished).length, icon: CheckCircle, color: 'text-blue-600 bg-blue-100' },
            { label: '임시 저장', value: exams.filter(e => !e.isPublished).length, icon: Clock, color: 'text-amber-600 bg-amber-100' },
            { label: '총 문항 수', value: exams.reduce((a, e) => a + e.questions.length, 0), icon: BarChart3, color: 'text-purple-600 bg-purple-100' },
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

        {/* 시험지 목록 */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg text-gray-800">내 시험지</h2>
        </div>

        {examsLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : exams.length === 0 ? (
          <div className="card p-16 text-center border-dashed border-2 border-green-200 bg-green-50/50">
            <BookOpen size={48} className="text-green-300 mx-auto mb-4" />
            <div className="font-semibold text-gray-600 mb-2">시험지가 없어요</div>
            <p className="text-sm text-gray-400 mb-6">첫 번째 시험지를 만들어보세요!</p>
            <button
              onClick={() => router.push('/teacher/create')}
              className="btn-primary mx-auto"
            >
              <Plus size={16} className="inline mr-1.5" />
              시험지 만들기
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {exams.map(exam => (
              <div key={exam.id} className="card p-5 hover:border-green-300 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-gray-800 truncate">{exam.title}</h3>
                      <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                        exam.isPublished
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {exam.isPublished ? '게시됨' : '임시저장'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span>{exam.questions.length}문항</span>
                      <span>
                        OX {exam.questions.filter(q => q.type === 'ox').length}개 /
                        4지선다 {exam.questions.filter(q => q.type === 'multiple').length}개
                      </span>
                      {exam.accessCode && (
                        <span className="font-mono font-bold text-green-600">
                          코드: {exam.accessCode}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {exam.accessCode && (
                      <button
                        onClick={() => copyCode(exam.accessCode!)}
                        className="btn-ghost text-xs flex items-center gap-1"
                        title="코드 복사"
                      >
                        <Copy size={14} />
                        복사
                      </button>
                    )}
                    <button
                      onClick={() => router.push(`/teacher/results/${exam.id}`)}
                      className="btn-ghost text-xs flex items-center gap-1"
                    >
                      <Users size={14} />
                      결과
                    </button>
                    <button
                      onClick={() => router.push(`/teacher/create?edit=${exam.id}`)}
                      className="btn-secondary text-xs flex items-center gap-1"
                    >
                      <Eye size={14} />
                      수정
                    </button>
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
