'use client';
// src/app/master-test/page.tsx
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import {
  getFirestore, collection, addDoc, deleteDoc,
  doc, query, orderBy, onSnapshot, getDoc
} from 'firebase/firestore';
import { Plus, LogOut, Save, Trash2, ChevronDown, SlidersHorizontal, X, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';

const db = getFirestore();

interface Part {
  id: number;
  range: string;
  sectionName: string;
  sectionContent: string;
  answers: Record<string, string>;
  taskLow: string;
  taskMid: string;
  taskHigh: string;
}

interface MasterTest {
  fireId: string;
  testId: string;
  subject: string;
  grade: string;
  unitName: string;
  parts: Part[];
  regDate: string;
}

const SUBJECTS = ['통합과학', '물리', '화학', '생물', '내신대비'];
const GRADES = ['중등1학년', '중등2학년', '중등3학년', '고등1학년', '고등2학년', '고등3학년'];
const ANSWER_OPTIONS = ['1', '2', '3', '4', '5'];

function makePart(id: number): Part {
  const start = (id - 1) * 10 + 1;
  const end = id * 10;
  const answers: Record<string, string> = {};
  for (let i = start; i <= end; i++) answers[`q${i}`] = '1';
  return {
    id,
    range: `${start}-${end}`,
    sectionName: '',
    sectionContent: '',
    answers,
    taskLow: '시험지에 오답문제 정리해오기',
    taskMid: '수업노트 필기 다시하고 오답문제 정리하기',
    taskHigh: '동영상 수업 내용복습, 수업노트 필기, 오답정리해오기',
  };
}

export default function MasterTestPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [testId] = useState('test-' + Date.now());
  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState('');
  const [unitName, setUnitName] = useState('');
  const [parts, setParts] = useState<Part[]>([makePart(1), makePart(2), makePart(3)]);
  const [saving, setSaving] = useState(false);

  const [tests, setTests] = useState<MasterTest[]>([]);
  const [filterGrade, setFilterGrade] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [showFilter, setShowFilter] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push('/login.html'); return; }
      try {
        const snap = await getDoc(doc(db, 'users', u.uid));
        if (!snap.exists() || snap.data().status !== 'approved') {
          await signOut(auth); router.push('/login.html'); return;
        }
        setUser(u);
      } catch {
        router.push('/login.html'); return;
      }
      setLoading(false);
    });
    return unsub;
  }, [router]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'master-tests'), orderBy('regDate', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setTests(snap.docs.map(d => ({ fireId: d.id, ...d.data() } as MasterTest)));
    });
    return unsub;
  }, [user]);

  function updatePart(id: number, field: keyof Part, value: string) {
    setParts(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  }

  function updateAnswer(partId: number, qno: string, value: string) {
    setParts(prev => prev.map(p =>
      p.id === partId ? { ...p, answers: { ...p.answers, [qno]: value } } : p
    ));
  }

  function addPart() {
    setParts(prev => [...prev, makePart(prev.length + 1)]);
  }

  function removePart(id: number) {
    if (parts.length <= 1) { toast.error('최소 1개 섹션이 필요합니다'); return; }
    setParts(prev => prev.filter(p => p.id !== id));
  }

  async function handleSave() {
    if (!subject || !grade) { toast.error('과목과 학년을 선택해주세요'); return; }
    setSaving(true);
    try {
      await addDoc(collection(db, 'master-tests'), {
        testId, subject, grade,
        unitName: unitName || '미지정 단원',
        parts,
        regDate: new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }),
      });
      toast.success('저장되었습니다!');
      setTimeout(() => window.location.reload(), 1200);
    } catch (e: unknown) {
      toast.error('오류: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(fireId: string) {
    if (!confirm('삭제하시겠습니까?')) return;
    try {
      await deleteDoc(doc(db, 'master-tests', fireId));
      toast.success('삭제되었습니다');
    } catch (e: unknown) {
      toast.error('삭제 오류: ' + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function handleLogout() {
    await signOut(auth);
    router.push('/login.html');
  }

  const filtered = tests.filter(t =>
    (!filterGrade || t.grade === filterGrade) &&
    (!filterSubject || t.subject === filterSubject)
  );

  const hasFilter = filterGrade || filterSubject;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pink-50">
        <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const inputCls = "w-full border border-pink-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-pink-400 transition-colors bg-white";
  const selectWrap = "relative";
  const selectCls = `${inputCls} appearance-none pr-8 cursor-pointer`;

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Header ── */}
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
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 text-sm font-semibold text-white px-3 py-2 rounded-xl transition-opacity disabled:opacity-50 hover:opacity-85"
              style={{ background: 'linear-gradient(135deg,#f472b6,#db2777)' }}
            >
              <Plus size={15} />
              <span>{saving ? '저장 중...' : '테스트 저장'}</span>
            </button>
            <button
              onClick={handleLogout}
              className="px-3 py-2 rounded-xl text-xs font-semibold border transition-colors"
              style={{ borderColor:'#f4c8d4', color:'#e8375a' }}
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6">

        {/* Welcome Bar */}
        <div
          className="rounded-2xl border border-pink-100 p-5 mb-6 flex items-center justify-between gap-3"
          style={{ background: 'linear-gradient(135deg,#fff0f7 0%,#fdf2f8 60%,#f0f9ff 100%)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#f472b6,#db2777)', boxShadow:'0 4px 12px rgba(219,39,119,0.25)' }}
            >
              ✏️
            </div>
            <div>
              <div className="font-bold text-gray-900 text-base">마스터테스트 생성</div>
              <div className="text-xs text-gray-500 mt-0.5">새로운 테스트를 생성하고 문항을 입력하세요</div>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="font-bold text-sm" style={{ color:'#db2777' }}>
              {new Date().toLocaleDateString('ko-KR', { year:'numeric', month:'long', day:'numeric' })}
            </div>
          </div>
        </div>

        {/* ── 기본 정보 ── */}
        <div className="bg-white border border-pink-100 rounded-2xl p-5 mb-4">
          <h2 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background:'#db2777' }}>1</span>
            기본 정보
          </h2>

          <div className="mb-3">
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">테스트 ID</label>
            <input
              type="text"
              value={testId}
              readOnly
              className="w-full bg-gray-50 border border-pink-50 rounded-xl px-3 py-2.5 text-xs text-gray-400 cursor-default"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                과목 <span className="text-pink-500">*</span>
              </label>
              <div className={selectWrap}>
                <select value={subject} onChange={e => setSubject(e.target.value)} className={selectCls}>
                  <option value="">선택</option>
                  {SUBJECTS.map(s => <option key={s}>{s}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                학년 <span className="text-pink-500">*</span>
              </label>
              <div className={selectWrap}>
                <select value={grade} onChange={e => setGrade(e.target.value)} className={selectCls}>
                  <option value="">선택</option>
                  {GRADES.map(g => <option key={g}>{g}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">단원명</label>
            <input
              type="text"
              value={unitName}
              onChange={e => setUnitName(e.target.value)}
              placeholder="예: 알칼리금속과 할로젠"
              className={inputCls}
            />
          </div>
        </div>

        {/* ── 섹션별 문항 ── */}
        {parts.map((part) => (
          <div key={part.id} className="bg-white border border-pink-100 rounded-2xl p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ background:'#db2777' }}
                >
                  {part.id}
                </span>
                <h2 className="text-sm font-bold text-gray-800">
                  {part.id}부 · 문항 {part.range}번
                </h2>
              </div>
              <button
                onClick={() => removePart(part.id)}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-red-400 hover:bg-red-50 transition-colors"
              >
                <Trash2 size={15} />
              </button>
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">섹션명</label>
                <input
                  type="text"
                  value={part.sectionName}
                  onChange={e => updatePart(part.id, 'sectionName', e.target.value)}
                  placeholder="예: 알칼리금속"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">핵심 내용</label>
                <input
                  type="text"
                  value={part.sectionContent}
                  onChange={e => updatePart(part.id, 'sectionContent', e.target.value)}
                  placeholder="이 섹션의 핵심 개념을 입력하세요..."
                  className={inputCls}
                />
              </div>
            </div>

            <div className="mb-4">
              <p className="text-xs font-bold text-gray-700 mb-3 uppercase tracking-wide">
                정답 입력 <span className="text-gray-400 font-normal normal-case">({part.range}번)</span>
              </p>
              <div className="grid grid-cols-5 gap-2">
                {Object.keys(part.answers).map(qno => (
                  <div key={qno} className="flex flex-col items-center gap-1.5">
                    <span className="text-xs font-semibold text-gray-400">
                      {qno.replace('q', '')}
                    </span>
                    <div className={selectWrap + ' w-full'}>
                      <select
                        value={part.answers[qno]}
                        onChange={e => updateAnswer(part.id, qno, e.target.value)}
                        className="w-full appearance-none border border-pink-100 rounded-lg text-center text-sm py-2 px-1 bg-white focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-transparent transition-colors"
                      >
                        {ANSWER_OPTIONS.map(o => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-pink-50 pt-4">
              <p className="text-xs font-bold text-gray-700 mb-3 uppercase tracking-wide">추가 과제 (오답별)</p>
              <div className="space-y-2.5">
                {[
                  { label: '0–2개 오답', field: 'taskLow'  as keyof Part, bg:'#d1fae5', color:'#065f46' },
                  { label: '3–4개 오답', field: 'taskMid'  as keyof Part, bg:'#fef9c3', color:'#854d0e' },
                  { label: '5개+ 오답',  field: 'taskHigh' as keyof Part, bg:'#fee2e2', color:'#991b1b' },
                ].map(({ label, field, bg, color }) => (
                  <div key={field} className="flex items-start gap-2">
                    <span
                      className="text-xs font-semibold px-2 py-1 rounded-lg flex-shrink-0 mt-0.5 whitespace-nowrap"
                      style={{ background: bg, color }}
                    >
                      {label}
                    </span>
                    <input
                      type="text"
                      value={part[field] as string}
                      onChange={e => updatePart(part.id, field, e.target.value)}
                      className="flex-1 border border-pink-100 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-pink-400 transition-colors"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}

        {/* 섹션 추가 버튼 */}
        <button
          onClick={addPart}
          className="w-full py-3.5 border-2 border-dashed border-pink-200 rounded-2xl text-sm font-semibold hover:border-pink-400 hover:bg-pink-50 transition-colors mb-4 flex items-center justify-center gap-2"
          style={{ color:'#db2777' }}
        >
          <Plus size={16} />
          섹션 추가
        </button>

        {/* 저장 버튼 */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-4 text-white font-bold rounded-2xl text-base transition-opacity mb-10 flex items-center justify-center gap-2 disabled:opacity-50 hover:opacity-85"
          style={{ background:'linear-gradient(135deg,#f472b6,#db2777)' }}
        >
          <Save size={18} />
          {saving ? '저장 중...' : '테스트 저장'}
        </button>

        {/* ── 등록된 테스트 목록 ── */}
        <div className="border-t-2 border-pink-100 pt-8">

          {/* 목록 헤더 */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-black text-gray-800 tracking-tight">등록된 테스트</h2>
              <span
                className="text-sm font-bold w-7 h-7 rounded-full flex items-center justify-center text-white shadow-sm"
                style={{ background: 'linear-gradient(135deg,#f472b6,#db2777)' }}
              >
                {tests.length}
              </span>
            </div>
            <button
              onClick={() => setShowFilter(v => !v)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors ${
                hasFilter
                  ? 'border-pink-300 text-pink-700 bg-pink-50'
                  : 'border-pink-100 text-gray-600 bg-white hover:bg-gray-50'
              }`}
            >
              <SlidersHorizontal size={13} />
              필터
              {hasFilter && (
                <span
                  className="w-4 h-4 rounded-full text-white text-xs flex items-center justify-center leading-none"
                  style={{ background:'#db2777' }}
                >
                  !
                </span>
              )}
            </button>
          </div>

          {/* 필터 패널 */}
          {showFilter && (
            <div className="bg-white border border-pink-100 rounded-2xl p-4 mb-4">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">학년</label>
                  <div className={selectWrap}>
                    <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)} className={selectCls}>
                      <option value="">전체</option>
                      {GRADES.map(g => <option key={g}>{g}</option>)}
                    </select>
                    <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">과목</label>
                  <div className={selectWrap}>
                    <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)} className={selectCls}>
                      <option value="">전체</option>
                      {SUBJECTS.map(s => <option key={s}>{s}</option>)}
                    </select>
                    <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>
              {hasFilter && (
                <button
                  onClick={() => { setFilterGrade(''); setFilterSubject(''); }}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <X size={13} />
                  필터 초기화
                </button>
              )}
            </div>
          )}

          {/* 테스트 테이블 */}
          {filtered.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-pink-200 rounded-2xl p-12 text-center">
              <BookOpen size={44} className="mx-auto mb-4" style={{ color:'#f9a8d4' }} />
              <div className="font-semibold text-gray-600 mb-2">등록된 테스트가 없습니다</div>
              <p className="text-sm text-gray-400">위에서 테스트를 생성하고 저장해보세요!</p>
            </div>
          ) : (
            <div className="bg-white border border-pink-100 rounded-2xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-pink-100" style={{ background: '#fdf2f8' }}>
                    <th className="text-left   text-xs font-bold text-gray-500 tracking-wide px-6 py-4">단원명</th>
                    <th className="text-center text-xs font-bold text-gray-500 tracking-wide px-4 py-4">등록일</th>
                    <th className="text-center text-xs font-bold text-gray-500 tracking-wide px-4 py-4">등록 상태</th>
                    <th className="text-center text-xs font-bold text-gray-500 tracking-wide px-4 py-4">학년</th>
                    <th className="text-center text-xs font-bold text-gray-500 tracking-wide px-4 py-4">과목</th>
                    <th className="text-center text-xs font-bold text-gray-500 tracking-wide px-4 py-4">총 문항</th>
                    <th className="text-center text-xs font-bold text-gray-500 tracking-wide px-6 py-4">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t, idx) => {
                    const totalQ = t.parts.reduce(
                      (acc, p) => acc + Object.keys(p.answers).length, 0
                    );
                    return (
                      <tr
                        key={t.fireId}
                        className="hover:bg-pink-50/40 transition-colors"
                        style={{ borderBottom: idx === filtered.length - 1 ? 'none' : '1px solid #f9f0f5' }}
                      >
                        {/* 단원명 */}
                        <td className="px-6 py-5">
                          <span className="font-bold text-gray-900 text-sm">{t.unitName}</span>
                        </td>

                        {/* 등록일 */}
                        <td className="px-4 py-5 text-center">
                          <span className="text-xs text-gray-600 font-medium whitespace-nowrap">
                           {t.regDate ? t.regDate.split('.').slice(0, 3).join('.').trim() : '—'}
                          </span>
                        </td>

                        {/* 등록 상태 */}
                        <td className="px-4 py-5 text-center">
                          <span className="inline-block text-xs px-3 py-1 rounded-full font-semibold bg-green-100 text-green-700">
                            등록됨
                          </span>
                        </td>

                        {/* 학년 */}
                        <td className="px-4 py-5 text-center">
                          {t.grade
                            ? <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full bg-pink-100 text-pink-700">{t.grade}</span>
                            : <span className="text-xs text-gray-300">—</span>
                          }
                        </td>

                        {/* 과목 */}
                        <td className="px-4 py-5 text-center">
                          {t.subject
                            ? <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full bg-blue-100 text-blue-700">{t.subject}</span>
                            : <span className="text-xs text-gray-300">—</span>
                          }
                        </td>

                        {/* 총 문항 */}
                        <td className="px-4 py-5 text-center">
                          <span className="text-sm font-black" style={{ color:'#db2777' }}>{totalQ}</span>
                          <span className="text-xs text-gray-400 ml-1">문항</span>
                        </td>

                        {/* 관리 */}
                        <td className="px-6 py-5">
                          <div className="flex items-center justify-center">
                            <button
                              onClick={() => handleDelete(t.fireId)}
                              className="flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
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
          )}
        </div>
      </main>
    </div>
  );
}
