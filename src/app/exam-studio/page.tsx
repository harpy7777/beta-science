'use client';
// src/app/exam-studio/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// 시험 스튜디오 허브
//  - ?mode 없음   → 두 갈래 선택 화면
//  - ?mode=basic  → OX · 4지선다 시험지 만들기
//  - ?mode=master → 마스터테스트 만들기
// 로그인/권한 확인은 이 페이지에서 한 번만 수행하고, 결과를 각 화면에 넘겨줍니다.
// ─────────────────────────────────────────────────────────────────────────────
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { ADMIN_EMAIL, LOGIN_PATH, LOGIN_FALLBACK_PATH, isAdmin } from '@/lib/adminConfig';
import BasicExamCreator from '@/components/exam/BasicExamCreator';
import MasterTestCreator from '@/components/exam/MasterTestCreator';
import { CheckSquare, ClipboardList, LogOut, Lock, ArrowRight } from 'lucide-react';

type Mode = 'basic' | 'master';
type Gate = 'loading' | 'anon' | 'denied' | 'ok';

const PINK_GRAD = 'linear-gradient(135deg,#f472b6,#db2777)';

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#fdf2f8' }}>
      <div
        className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: '#f472b6', borderTopColor: 'transparent' }}
      />
    </div>
  );
}

// ── 로그인 필요 / 권한 없음 화면 (자동 이동하지 않고 버튼으로만 이동) ──
function GateScreen({
  kind, email, onSignOut, onGo,
}: {
  kind: 'anon' | 'denied';
  email: string | null;
  onSignOut: () => void;
  onGo: (path: string) => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: '#fdf2f8' }}>
      <div className="w-full max-w-sm bg-white border border-pink-100 rounded-2xl p-7 text-center">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: '#fce7f3' }}
        >
          <Lock size={26} style={{ color: '#db2777' }} />
        </div>

        <h1 className="text-lg font-black text-gray-900 tracking-tight mb-2">
          {kind === 'anon' ? '로그인이 필요합니다' : '접근 권한이 없습니다'}
        </h1>

        {kind === 'anon' ? (
          <p className="text-sm text-gray-500 leading-relaxed mb-6">
            시험 스튜디오는 선생님 계정으로 로그인한 뒤 이용할 수 있습니다.
          </p>
        ) : (
          <div className="mb-6">
            <p className="text-sm text-gray-500 leading-relaxed mb-4">
              이 계정으로는 시험 스튜디오를 열 수 없습니다.
            </p>
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 text-left space-y-2">
              <div>
                <div className="text-[11px] font-semibold text-gray-400 mb-0.5">현재 로그인</div>
                <div className="text-xs font-semibold text-gray-700 break-all">{email || '(이메일 없음)'}</div>
              </div>
              <div className="h-px bg-gray-200" />
              <div>
                <div className="text-[11px] font-semibold text-gray-400 mb-0.5">허용된 계정</div>
                <div className="text-xs font-semibold break-all" style={{ color: '#db2777' }}>{ADMIN_EMAIL}</div>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {kind === 'denied' && (
            <button
              onClick={onSignOut}
              className="w-full py-3 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-85 flex items-center justify-center gap-2"
              style={{ background: PINK_GRAD }}
            >
              <LogOut size={15} />
              로그아웃하고 다시 로그인
            </button>
          )}
          <button
            onClick={() => onGo(LOGIN_PATH)}
            className={
              kind === 'anon'
                ? 'w-full py-3 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-85'
                : 'w-full py-3 rounded-xl text-sm font-semibold border transition-colors hover:bg-pink-50'
            }
            style={
              kind === 'anon'
                ? { background: PINK_GRAD }
                : { borderColor: '#f4c8d4', color: '#db2777' }
            }
          >
            로그인 화면으로 이동
          </button>
          <button
            onClick={() => onGo(LOGIN_FALLBACK_PATH)}
            className="w-full py-2.5 rounded-xl text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors"
          >
            위 화면이 열리지 않으면 여기를 누르세요
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 두 갈래 선택 화면 ──
function ModePicker({ email, onPick, onSignOut }: {
  email: string | null;
  onPick: (m: Mode) => void;
  onSignOut: () => void;
}) {
  const cards: {
    mode: Mode; badge: string; badgeBg: string; badgeColor: string;
    title: string; desc: string; points: string[]; icon: React.ReactNode;
  }[] = [
    {
      mode: 'basic',
      badge: 'OX · 4지선다',
      badgeBg: '#dcfce7',
      badgeColor: '#15803d',
      title: '시험지 만들기',
      desc: '문제와 정답, 해설을 직접 입력해 학생에게 게시하는 시험지입니다.',
      points: ['여러 문제를 한 번에 붙여넣기', '문제별 해설 입력', '임시저장 후 이어서 작업'],
      icon: <CheckSquare size={22} className="text-white" />,
    },
    {
      mode: 'master',
      badge: '정답표 방식',
      badgeBg: '#dbeafe',
      badgeColor: '#1d4ed8',
      title: '마스터테스트 만들기',
      desc: '종이 시험지의 정답만 등록해 두고, 학생이 OMR로 답을 제출하는 방식입니다.',
      points: ['정답을 한 줄로 빠르게 입력', '10문항 단위로 부 나누기', '오답 개수별 과제 자동 배정'],
      icon: <ClipboardList size={22} className="text-white" />,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-pink-100 sticky top-0 z-40">
        <div className="w-full px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: PINK_GRAD }}
            >
              <svg width="15" height="15" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="7" r="3" fill="rgba(255,255,255,0.9)" />
                <path
                  d="M3.5 16c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5"
                  stroke="rgba(255,255,255,0.9)" strokeWidth="1.4" strokeLinecap="round" fill="none"
                />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-gray-900 text-sm leading-tight truncate">시험 스튜디오</div>
              <div className="text-xs truncate" style={{ color: '#db2777' }}>인후쌤의 과학 수업 관리 시스템</div>
            </div>
          </div>
          <button
            onClick={onSignOut}
            className="px-3 py-2 rounded-xl text-xs font-semibold border transition-colors flex items-center flex-shrink-0"
            style={{ borderColor: '#f4c8d4', color: '#e8375a' }}
            aria-label="로그아웃"
          >
            <LogOut size={15} />
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        {/* 웰컴 바 */}
        <div
          className="rounded-2xl border border-pink-100 p-4 sm:p-5 mb-6 flex items-center justify-between gap-3"
          style={{ background: 'linear-gradient(135deg,#fff0f7 0%,#fdf2f8 60%,#f0f9ff 100%)' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: PINK_GRAD, boxShadow: '0 4px 12px rgba(219,39,119,0.25)' }}
            >
              🧪
            </div>
            <div className="min-w-0">
              <div className="font-bold text-gray-900 text-sm sm:text-base">어떤 시험을 만드시겠어요?</div>
              <div className="text-xs text-gray-500 mt-0.5 truncate">{email}</div>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="font-bold text-xs sm:text-sm" style={{ color: '#db2777' }}>
              {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
        </div>

        {/* 두 갈래 버튼 — 좌우 동일 폭 / 동일 높이 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
          {cards.map(c => (
            <button
              key={c.mode}
              type="button"
              onClick={() => onPick(c.mode)}
              className="group h-full text-left bg-white border border-pink-100 rounded-2xl p-5 flex flex-col transition-all hover:border-pink-300 hover:shadow-lg hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-pink-200"
            >
              <div className="flex items-center gap-2.5 mb-4">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: PINK_GRAD, boxShadow: '0 4px 12px rgba(219,39,119,0.22)' }}
                >
                  {c.icon}
                </div>
                <span
                  className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ background: c.badgeBg, color: c.badgeColor }}
                >
                  {c.badge}
                </span>
              </div>

              <h2 className="text-base font-black text-gray-900 tracking-tight mb-1.5">{c.title}</h2>
              <p className="text-xs text-gray-500 leading-relaxed mb-4">{c.desc}</p>

              <ul className="space-y-1.5 mb-5">
                {c.points.map(p => (
                  <li key={p} className="flex items-start gap-2 text-xs text-gray-600 leading-relaxed">
                    <span
                      className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                      style={{ background: '#f472b6' }}
                    />
                    {p}
                  </li>
                ))}
              </ul>

              {/* mt-auto → 카드 높이가 달라도 버튼 줄이 아래에서 정렬됨 */}
              <div
                className="mt-auto w-full py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-1.5 transition-opacity group-hover:opacity-90"
                style={{ background: PINK_GRAD }}
              >
                시작하기
                <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
              </div>
            </button>
          ))}
        </div>

        <p className="text-xs text-center text-gray-400 mt-6 leading-relaxed">
          만든 시험은 각 화면 아래 목록에서 다시 확인할 수 있습니다
        </p>
      </main>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
function ExamStudioInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [gate, setGate] = useState<Gate>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const raw = searchParams.get('mode');
  const mode: Mode | null = raw === 'basic' || raw === 'master' ? raw : null;
  const editId = searchParams.get('edit');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) { setUser(null); setEmail(null); setGate('anon'); return; }
      setEmail(u.email ?? null);
      if (!isAdmin(u.email)) { setUser(null); setGate('denied'); return; }
      setUser(u);
      setGate('ok');
    });
    return unsub;
  }, []);

  async function handleSignOut() {
    try { await signOut(auth); } catch { /* 이미 로그아웃된 경우 무시 */ }
    setGate('anon');
  }

  if (gate === 'loading') return <Spinner />;

  if (gate === 'anon' || gate === 'denied') {
    return (
      <GateScreen
        kind={gate}
        email={email}
        onSignOut={handleSignOut}
        onGo={(path) => { window.location.href = path; }}
      />
    );
  }

  if (!user) return <Spinner />;

  if (mode === 'basic') return <BasicExamCreator user={user} editId={editId} />;
  if (mode === 'master') return <MasterTestCreator user={user} />;

  return (
    <ModePicker
      email={email}
      onPick={(m) => router.push(`/exam-studio?mode=${m}`)}
      onSignOut={handleSignOut}
    />
  );
}

export default function ExamStudioPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ExamStudioInner />
    </Suspense>
  );
}
