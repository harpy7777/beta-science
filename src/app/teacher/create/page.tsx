'use client';
// src/app/teacher/page.tsx
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged, User
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getExamsByTeacher, deleteExam, Exam } from '@/lib/examService';
import {
  Plus, LogOut, BookOpen, Users,
  Eye, BarChart3, CheckCircle, Clock, Trash2, AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';

function formatDate(ts: unknown): string {
  if (!ts) return '—';
  try {
    let date: Date;
    if (typeof (ts as any).toDate === 'function') {
      date = (ts as any).toDate();
    } else if (typeof (ts as any).seconds === 'number') {
      date = new Date((ts as any).seconds * 1000);
    } else {
      date = new Date(ts as any);
    }
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\.$/, '');
  } catch {
    return '—';
  }
}

/* ── 삭제 확인 모달 ── */
function DeleteConfirmModal({
  exam,
  onConfirm,
  onCancel,
  loading,
}: {
  exam: Exam;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 배경 오버레이 */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* 모달 카드 */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-[fadeInUp_0.2s_ease]">
        {/* 경고 아이콘 */}
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
            <AlertTriangle size={28} className="text-red-500" />
          </div>
        </div>

        {/* 텍스트 */}
        <h3 className="text-center font-black text-gray-900 text-lg mb-2">
          시험지를 삭제할까요?
        </h3>
        <p className="text-center text-sm text-gray-500 mb-1">
          아래 시험지가 <span className="font-semibold text-red-500">영구적으로 삭제</span>됩니다.
        </p>

        {/* 시험지 이름 박스 */}
        <div className="mt-3 mb-5 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-center">
          <span className="font-bold text-gray-800 text-sm">"{exam.title}"</span>
          <div className="flex items-center justify-center gap-2 mt-1.5">
            {exam.grade && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-pink-100 text-pink-700">{exam.grade}</span>
            )}
            {exam.subject && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{exam.subject}</span>
            )}
            <span className="text-xs text-gray-400">총 {exam.questions.length}문항</span>
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex gap-2.5">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-85 disabled:opacity-50 flex items-center justify-center gap-1.5"
            style={{ background: 'linear-gradient(135deg,#f87171,#dc2626)' }}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                삭제 중...
              </>
            ) : (
              <>
                <Trash2 size={14} />
                삭제하기
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
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

  // 삭제 관련 state
  const [deleteTarget, setDeleteTarget] = useState<Exam | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteExam(deleteTarget.id);
      setExams(prev => prev.filter(e => e.id !== deleteTarget.id));
      toast.success(`"${deleteTarget.title}" 시험지가 삭제되었습니다`);
      setDeleteTarget(null);
    } catch {
      toast.error('삭제에 실패했습니다. 다시 시도해주세요');
    } finally {
      setDeleteLoading(false);
    }
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
    <>
      {/* 삭제 확인 모달 */}
      {deleteTarget && (
        <DeleteConfirmModal
          exam={deleteTarget}
          onConfirm={handleDeleteConfirm}
          onCancel={() => !deleteLoading && setDeleteTarget(null)}
          loading={deleteLoading}
        />
      )}

      <div className="min-h-screen bg-gray-50">

        {/* Header */}
        <header className="bg-white border-b border-pink-100 sticky top-0 z-40">
          <div className="w-full px-4 sm:px-6 h-14 flex items-center justify-between">
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
                <span className="hidden sm:inline">시험지 만들기</span>
                <span className="sm:hidden">만들기</span>
              </button>
              <button
                onClick={handleLogout}
                className="px-3 py-2 rounded-xl text-xs font-semibold border transition-colors flex items-center"
                style={{ borderColor:'#f4c8d4', color:'#e8375a' }}
                title="로그아웃"
              >
                <LogOut size={15} />
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-screen-xl mx-auto px-4 sm:px-8 py-6">

          {/* Welcome Bar */}
          <div
            className="rounded-2xl border border-pink-100 p-4 sm:p-5 mb-6 flex items-center justify-between gap-3"
            style={{ background: 'linear-gradient(135deg,#fff0f7 0%,#fdf2f8 60%,#f0f9ff 100%)' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#f472b6,#db2777)', boxShadow:'0 4px 12px rgba(219,39,119,0.25)' }}
              >
                🎓
              </div>
              <div>
                <div className="font-bold text-gray-900 text-sm sm:text-base">선생님 대시보드</div>
                <div className="text-xs text-gray-500 mt-0.5">시험지 생성 및 결과 관리</div>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="font-bold text-xs sm:text-sm" style={{ color:'#db2777' }}>
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
              { label: '전체 시험지', value: exams.length,   icon: BookOpen,    iconBg:'#fdf2f8', valColor:'#db2877' },
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

          ) : (
            <>
              {/* ── 데스크탑 테이블 (md 이상) ── */}
              <div className="hidden md:block bg-white border border-pink-100 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full table-fixed" style={{ minWidth: '1200px' }}>
                    <colgroup>
                      <col style={{ width: '130px' }} />
                      <col style={{ width: '90px' }} />
                      <col style={{ width: 'auto' }} />
                      <col style={{ width: '110px' }} />
                      <col style={{ width: '110px' }} />
                      <col style={{ width: '80px' }} />
                      <col style={{ width: '80px' }} />
                      <col style={{ width: '90px' }} />
                      <col style={{ width: '240px' }} />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-pink-100" style={{ background: '#fdf2f8' }}>
                        <th className="text-center text-xs font-bold text-gray-500 tracking-wide px-5 py-4 whitespace-nowrap">과목</th>
                        <th className="text-center text-xs font-bold text-gray-500 tracking-wide px-5 py-4 whitespace-nowrap">학년</th>
                        <th className="text-center text-xs font-bold text-gray-500 tracking-wide px-6 py-4">단원명</th>
                        <th className="text-center text-xs font-bold text-gray-500 tracking-wide px-5 py-4 whitespace-nowrap">게시일</th>
                        <th className="text-center text-xs font-bold text-gray-500 tracking-wide px-5 py-4 whitespace-nowrap">게시 상태</th>
                        <th className="text-center text-xs font-bold text-gray-500 tracking-wide px-5 py-4 whitespace-nowrap">OX</th>
                        <th className="text-center text-xs font-bold text-gray-500 tracking-wide px-5 py-4 whitespace-nowrap">4지선다</th>
                        <th className="text-center text-xs font-bold text-gray-500 tracking-wide px-5 py-4 whitespace-nowrap">총 문항</th>
                        <th className="text-center text-xs font-bold text-gray-500 tracking-wide px-6 py-4 whitespace-nowrap">관리</th>
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
                            <td className="px-5 py-5 text-center">
                              {exam.subject
                                ? <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full bg-blue-100 text-blue-700 whitespace-nowrap">{exam.subject}</span>
                                : <span className="text-xs text-gray-300">—</span>
                              }
                            </td>
                            <td className="px-5 py-5 text-center">
                              {exam.grade
                                ? <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full bg-pink-100 text-pink-700 whitespace-nowrap">{exam.grade}</span>
                                : <span className="text-xs text-gray-300">—</span>
                              }
                            </td>
                            <td className="px-6 py-5 text-center">
                              <span className="font-bold text-gray-900 text-sm">{exam.title}</span>
                            </td>
                            <td className="px-5 py-5 text-center whitespace-nowrap">
                              <span className="text-xs text-gray-600 font-medium">{formatDate(exam.regDate)}</span>
                            </td>
                            <td className="px-5 py-5 text-center">
                              <span className={`inline-block text-xs px-3 py-1 rounded-full font-semibold whitespace-nowrap ${
                                exam.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                              }`}>
                                {exam.isPublished ? '게시됨' : '임시저장'}
                              </span>
                            </td>
                            <td className="px-5 py-5 text-center">
                              <span className="text-sm font-bold text-gray-700">{oxCount}</span>
                              <span className="text-xs text-gray-400 ml-0.5">개</span>
                            </td>
                            <td className="px-5 py-5 text-center">
                              <span className="text-sm font-bold text-gray-700">{multipleCount}</span>
                              <span className="text-xs text-gray-400 ml-0.5">개</span>
                            </td>
                            <td className="px-5 py-5 text-center">
                              <span className="text-sm font-black" style={{ color:'#db2777' }}>{exam.questions.length}</span>
                              <span className="text-xs text-gray-400 ml-0.5">문항</span>
                            </td>
                            <td className="px-6 py-5">
                              <div className="flex items-center justify-center gap-2">
                                {/* 결과 보기 */}
                                <button
                                  onClick={() => router.push(`/teacher/results/${exam.id}`)}
                                  className="flex items-center gap-1.5 text-xs font-semibold text-yellow-600 hover:text-yellow-700 bg-yellow-50 hover:bg-yellow-100 px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
                                >
                                  <Users size={13} />
                                  결과 보기
                                </button>
                                {/* 수정 */}
                                <button
                                  onClick={() => router.push(`/teacher/create?edit=${exam.id}`)}
                                  className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
                                >
                                  <Eye size={13} />
                                  수정
                                </button>
                                {/* 삭제 */}
                                <button
                                  onClick={() => setDeleteTarget(exam)}
                                  className="flex items-center gap-1.5 text-xs font-semibold text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
                                >
                                  <Trash2 size={13} />
                                  삭제
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── 모바일 카드 뷰 (md 미만) ── */}
              <div className="md:hidden flex flex-col gap-3">
                {exams.map((exam) => {
                  const oxCount       = exam.questions.filter(q => q.type === 'ox').length;
                  const multipleCount = exam.questions.filter(q => q.type === 'multiple').length;
                  return (
                    <div
                      key={exam.id}
                      className="bg-white border border-pink-100 rounded-2xl p-4"
                    >
                      {/* 상단: 단원명 + 상태 */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <span className="font-bold text-gray-900 text-sm leading-snug flex-1">{exam.title}</span>
                        <span className={`flex-shrink-0 inline-block text-xs px-2.5 py-1 rounded-full font-semibold ${
                          exam.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {exam.isPublished ? '게시됨' : '임시저장'}
                        </span>
                      </div>

                      {/* 뱃지 행: 학년 + 과목 + 게시일 */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-3">
                        {exam.grade && (
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-pink-100 text-pink-700">{exam.grade}</span>
                        )}
                        {exam.subject && (
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">{exam.subject}</span>
                        )}
                        <span className="text-xs text-gray-400">{formatDate(exam.regDate)}</span>
                      </div>

                      {/* 문항 수 행 */}
                      <div className="flex items-center gap-3 mb-3 py-2.5 px-3 rounded-xl bg-gray-50">
                        <div className="flex-1 text-center">
                          <div className="text-xs text-gray-400 mb-0.5">OX 문항</div>
                          <div className="text-sm font-black text-gray-700">{oxCount}<span className="text-xs font-normal text-gray-400 ml-0.5">개</span></div>
                        </div>
                        <div className="w-px h-8 bg-gray-200" />
                        <div className="flex-1 text-center">
                          <div className="text-xs text-gray-400 mb-0.5">4지선다</div>
                          <div className="text-sm font-black text-gray-700">{multipleCount}<span className="text-xs font-normal text-gray-400 ml-0.5">개</span></div>
                        </div>
                        <div className="w-px h-8 bg-gray-200" />
                        <div className="flex-1 text-center">
                          <div className="text-xs text-gray-400 mb-0.5">총 문항</div>
                          <div className="text-sm font-black" style={{ color:'#db2777' }}>{exam.questions.length}<span className="text-xs font-normal text-gray-400 ml-0.5">문항</span></div>
                        </div>
                      </div>

                      {/* 버튼 행 */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => router.push(`/teacher/results/${exam.id}`)}
                          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-yellow-600 hover:text-yellow-700 bg-yellow-50 hover:bg-yellow-100 py-2.5 rounded-xl transition-colors"
                        >
                          <Users size={13} />
                          결과 보기
                        </button>
                        <button
                          onClick={() => router.push(`/teacher/create?edit=${exam.id}`)}
                          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 py-2.5 rounded-xl transition-colors"
                        >
                          <Eye size={13} />
                          수정
                        </button>
                        {/* 삭제 버튼 */}
                        <button
                          onClick={() => setDeleteTarget(exam)}
                          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 py-2.5 rounded-xl transition-colors"
                        >
                          <Trash2 size={13} />
                          삭제
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}
