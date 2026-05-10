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
  Plus, LogOut, BookOpen, Users,
  Eye, BarChart3, CheckCircle, Clock
} from 'lucide-react';
import toast from 'react-hot-toast';

function formatDate(ts: unknown): string {
  if (!ts) return '—';
  try {
    let date: Date;
    if (typeof (ts as any).toDate === 'function') {
      // 진짜 Firestore Timestamp
      date = (ts as any).toDate();
    } else if (typeof (ts as any).seconds === 'number') {
      // removeUndefined로 JSON 직렬화된 {seconds, nanoseconds} 객체
      date = new Date((ts as any).seconds * 1000);
    } else {
      date = new Date(ts as any);
    }
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\.$/, '')
  } catch {
    return '—';
  }
}

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pink-50">
        <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  /* ── 로그인 화면 ── */
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-white flex items-center justify-center p-4">
        <div className="bg-white border border-pink-100 rounded-2xl shadow-sm p-8 w-full max-w-sm">
          <div
            className="flex items-center gap-3 mb-8 cursor-pointer"
            onClick={() => router.push('/')}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#f472b6,#db2777)' }}
            >
              <svg width="15" height="15" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="7" r="3" fill="rgba(255,255,255,0.9)"/>
                <path d="M3.5 16c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5"
                  stroke="rgba(255,255,255,0.9)" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
              </svg>
            </div>
            <div>
              <div className="font-[500] text-gray-900 text-sm">베타과학학원</div>
              <div className="text-xs text-pink-500">선생님 로그인</div>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 tracking-wide uppercase">이메일</label>
              <input
                type="email"
                className="w-full border border-pink-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-pink-400 transition-colors"
                placeholder="teacher@beta.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 tracking-wide uppercase">비밀번호</label>
              <input
                type="password"
                className="w-full border border-pink-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-pink-400 transition-colors"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
            </div>
            <button
              onClick={handleLogin}
              disabled={loginLoading}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50 mt-2"
              style={{ background: 'linear-gradient(135deg,#f472b6,#db2777)' }}
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

  /* ── 대시보드 ── */
  const publishedCount = exams.filter(e => e.isPublished).length;
  const draftCount     = exams.filter(e => !e.isPublished).length;
  const totalQ         = exams.reduce((a, e) => a + e.questions.length, 0);

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <header className="bg-white border-b border-pink-100 sticky top-0 z-50">
        <div className="w-full px-6 h-14 flex items-center justify-between">
          <div
            className="flex items-center gap-2.5 cursor-pointer"
            onClick={() => router.push('/')}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#f472b6,#db2777)' }}
            >
              <svg width="15" height="15" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="7" r="3" fill="rgba(255,255,255,0.9)"/>
                <path d="M3.5 16c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5"
                  stroke="rgba(255,255,255,0.9)" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
              </svg>
            </div>
            <div className="font-[500] text-gray-900 text-sm leading-tight">베타과학학원</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/teacher/create')}
              className="flex items-center gap-1.5 text-sm font-semibold text-white px-3 py-2 rounded-xl transition-opacity hover:opacity-85"
              style={{ background: 'linear-gradient(135deg,#f472b6,#db2777)' }}
            >
              <Plus size={15} />
              <span>시험지 만들기</span>
            </button>
            <button
              onClick={handleLogout}
              className="px-3 py-2 rounded-xl text-xs font-semibold border transition-colors"
              style={{ borderColor:'#f4c8d4', color:'#e8375a' }}
              title="로그아웃"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6">

        {/* Welcome Bar */}
        <div
          className="rounded-2xl border border-pink-100 p-5 mb-6 flex items-center justify-between gap-3"
          style={{ background: 'linear-gradient(135deg,#fff0f7 0%,#fdf2f8 60%,#f0f9ff 100%)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center text-lg flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#f472b6,#db2777)', boxShadow:'0 4px 12px rgba(219,39,119,0.25)' }}
            >
              🎓
            </div>
            <div>
              <div className="font-bold text-gray-900 text-base">선생님 대시보드</div>
              <div className="text-xs text-gray-500 mt-0.5">시험지 생성 및 결과 관리</div>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="font-bold text-sm" style={{ color:'#db2777' }}>
              {new Date().toLocaleDateString('ko-KR', { year:'numeric', month:'long', day:'numeric' })}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              {['일요일','월요일','화요일','수요일','목요일','금요일','토요일'][new Date().getDay()]}
            </div>
          </div>
        </div>

        {/* OVERVIEW 라벨 */}
        <div className="text-xs font-bold text-gray-400 tracking-widest uppercase mb-3">OVERVIEW</div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { label: '전체 시험지', value: exams.length,   icon: BookOpen,    iconBg:'#fdf2f8', valColor:'#db2777' },
            { label: '게시된 시험', value: publishedCount, icon: CheckCircle, iconBg:'#d1fae5', valColor:'#16a34a' },
            { label: '임시 저장',   value: draftCount,     icon: Clock,       iconBg:'#fef9c3', valColor:'#d97706' },
            { label: '총 문항 수',  value: totalQ,         icon: BarChart3,   iconBg:'#dbeafe', valColor:'#2563eb' },
          ].map(({ label, value, icon: Icon, iconBg, valColor }) => (
            <div key={label} className="bg-white border border-pink-100 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: iconBg }}>
                <Icon size={16} style={{ color: valColor }} />
              </div>
              <div>
                <div className="text-xl font-black leading-none" style={{ color: valColor }}>{value}</div>
                <div className="text-xs text-gray-400 mt-1">{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* 내 시험지 헤더 */}
        <div className="text-xs font-bold text-gray-400 tracking-widest uppercase mb-3">내 시험지</div>

        {/* 로딩 */}
        {examsLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-pink-400 border-t-transparent rounded-full animate-spin" />
          </div>

        /* 빈 상태 */
        ) : exams.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-pink-200 rounded-2xl p-12 text-center">
            <BookOpen size={44} className="mx-auto mb-4" style={{ color:'#f9a8d4' }} />
            <div className="font-semibold text-gray-600 mb-2">시험지가 없어요</div>
            <p className="text-sm text-gray-400 mb-6">첫 번째 시험지를 만들어보세요!</p>
            <button
              onClick={() => router.push('/teacher/create')}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-white px-4 py-2.5 rounded-xl"
              style={{ background: 'linear-gradient(135deg,#f472b6,#db2777)' }}
            >
              <Plus size={16} />
              시험지 만들기
            </button>
          </div>

        /* 시험지 테이블 */
        ) : (
          <div className="bg-white border border-pink-100 rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-pink-100" style={{ background: '#fdf2f8' }}>
                  <th className="text-left text-xs font-bold text-gray-500 tracking-wide px-6 py-4">단원명</th>
                  <th className="text-center text-xs font-bold text-gray-500 tracking-wide px-4 py-4">게시일</th>
                  <th className="text-center text-xs font-bold text-gray-500 tracking-wide px-4 py-4">게시 상태</th>
                  <th className="text-center text-xs font-bold text-gray-500 tracking-wide px-4 py-4">학년</th>
                  <th className="text-center text-xs font-bold text-gray-500 tracking-wide px-4 py-4">과목</th>
                  <th className="text-center text-xs font-bold text-gray-500 tracking-wide px-4 py-4">OX 문항</th>
                  <th className="text-center text-xs font-bold text-gray-500 tracking-wide px-4 py-4">4지선다</th>
                  <th className="text-center text-xs font-bold text-gray-500 tracking-wide px-4 py-4">총 문항</th>
                  <th className="text-center text-xs font-bold text-gray-500 tracking-wide px-6 py-4">관리</th>
                </tr>
              </thead>
              <tbody>
                {exams.map((exam, idx) => {
                  const oxCount       = exam.questions.filter(q => q.type === 'ox').length;
                  const multipleCount = exam.questions.filter(q => q.type === 'multiple').length;
                  return (
                    <tr
                      key={exam.id}
                      className="border-b border-gray-50 hover:bg-pink-50/40 transition-colors"
                      style={{ borderBottom: idx === exams.length - 1 ? 'none' : undefined }}
                    >
                      {/* 단원명 */}
                      <td className="px-6 py-5">
                        <span className="font-bold text-gray-900 text-sm">{exam.title}</span>
                      </td>

                      {/* 게시일 */}
                      <td className="px-4 py-5 text-center">
                        <span className="text-xs text-gray-600 font-medium">
                          {formatDate(exam.regDate)}
                        </span>
                      </td>

                      {/* 게시 상태 */}
                      <td className="px-4 py-5 text-center">
                        <span className={`inline-block text-xs px-3 py-1 rounded-full font-semibold ${
                          exam.isPublished
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {exam.isPublished ? '게시됨' : '임시저장'}
                        </span>
                      </td>

                      {/* 학년 */}
                      <td className="px-4 py-5 text-center">
                        {exam.grade
                          ? <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full bg-pink-100 text-pink-700">{exam.grade}</span>
                          : <span className="text-xs text-gray-300">—</span>
                        }
                      </td>

                      {/* 과목 */}
                      <td className="px-4 py-5 text-center">
                        {exam.subject
                          ? <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full bg-blue-100 text-blue-700">{exam.subject}</span>
                          : <span className="text-xs text-gray-300">—</span>
                        }
                      </td>

                      {/* OX 문항 수 */}
                      <td className="px-4 py-5 text-center">
                        <span className="text-sm font-bold text-gray-700">{oxCount}</span>
                        <span className="text-xs text-gray-400 ml-1">개</span>
                      </td>

                      {/* 4지선다 문항 수 */}
                      <td className="px-4 py-5 text-center">
                        <span className="text-sm font-bold text-gray-700">{multipleCount}</span>
                        <span className="text-xs text-gray-400 ml-1">개</span>
                      </td>

                      {/* 총 문항 수 */}
                      <td className="px-4 py-5 text-center">
                        <span className="text-sm font-black" style={{ color:'#db2777' }}>{exam.questions.length}</span>
                        <span className="text-xs text-gray-400 ml-1">문항</span>
                      </td>

                      {/* 관리 버튼 */}
                      <td className="px-6 py-5">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => router.push(`/teacher/results/${exam.id}`)}
                            className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-blue-600 bg-gray-100 hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
                          >
                            <Users size={13} />
                            결과 보기
                          </button>
                          <button
                            onClick={() => router.push(`/teacher/create?edit=${exam.id}`)}
                            className="flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-2 rounded-lg transition-opacity hover:opacity-85 whitespace-nowrap"
                            style={{ background:'#db2777' }}
                          >
                            <Eye size={13} />
                            수정
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
