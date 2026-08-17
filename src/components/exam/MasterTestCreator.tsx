'use client';
// src/components/exam/MasterTestCreator.tsx
// ─────────────────────────────────────────────────────────────────────────────
// 마스터테스트 만들기 (정답표 등록 → 학생 OMR 제출)
// 로그인/권한 확인은 /exam-studio 페이지에서 끝내고, 여기서는 user 를 받아 씁니다.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signOut, User } from 'firebase/auth';
import {
  collection, addDoc, deleteDoc,
  doc, query, orderBy, onSnapshot
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { LOGIN_PATH } from '@/lib/adminConfig';
import { Plus, LogOut, Save, Trash2, ChevronDown, SlidersHorizontal, X, BookOpen, LayoutGrid } from 'lucide-react';
import toast from 'react-hot-toast';

const PINK_GRAD = 'linear-gradient(135deg,#f472b6,#db2777)';

interface Part {
  id: number;
  range: string;
  // sectionName / sectionContent 는 화면에서 제거했지만, 학생 OMR 페이지가 읽어도
  // 깨지지 않도록 저장 시 빈 문자열로 채워 보냅니다(하위호환).
  answers: Record<string, string>;   // 미입력은 '' (빈 값)
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
  subUnit?: string;
  parts: Part[];
  regDate: string;
}

const SUBJECTS = ['중1과학', '중2과학', '중3과학', '통합과학1', '통합과학2', '화학', '물질과 에너지', '화학 반응의 세계'];
const GRADES = ['중등1학년', '중등2학년', '중등3학년', '고등1학년', '고등2학년', '고등3학년'];
const ANSWER_OPTIONS = ['1', '2', '3', '4', '5'];

function makePart(id: number): Part {
  const start = (id - 1) * 10 + 1;
  const end = id * 10;
  const answers: Record<string, string> = {};
  // 기본값을 '1'이 아니라 ''(미입력)으로 둡니다 → 안 채우면 저장이 막힘
  for (let i = start; i <= end; i++) answers[`q${i}`] = '';
  return {
    id,
    range: `${start}-${end}`,
    answers,
    taskLow: '시험지에 오답문제 정리해오기',
    taskMid: '수업노트 필기 다시하고 오답문제 정리하기',
    taskHigh: '동영상 수업 내용복습, 수업노트 필기, 오답정리해오기',
  };
}

// 한 부(part)의 정답들을 "3214553142" 같은 문자열로 변환 (미입력은 공백)
function answersToString(answers: Record<string, string>): string {
  const qnos = Object.keys(answers).sort(
    (a, b) => Number(a.replace('q', '')) - Number(b.replace('q', ''))
  );
  return qnos.map(q => answers[q] || ' ').join('');
}

export default function MasterTestCreator({ user }: { user: User }) {
  const router = useRouter();

  const [testId] = useState('test-' + Date.now());
  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState('');
  const [unitName, setUnitName] = useState('');
  const [subUnit, setSubUnit] = useState('');
  const [parts, setParts] = useState<Part[]>([makePart(1)]);
  const [saving, setSaving] = useState(false);

  const [tests, setTests] = useState<MasterTest[]>([]);
  const [filterGrade, setFilterGrade] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [showFilter, setShowFilter] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'master-tests'), orderBy('regDate', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setTests(snap.docs.map(d => ({ fireId: d.id, ...d.data() } as MasterTest)));
      },
      (err) => {
        console.error(err);
        toast.error('테스트 목록을 불러오지 못했습니다');
      }
    );
    return unsub;
  }, [user]);

  function updatePart(id: number, field: keyof Part, value: string) {
    setParts(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  }

  // 버튼(드롭다운)으로 한 문항 정답 변경
  function updateAnswer(partId: number, qno: string, value: string) {
    setParts(prev => prev.map(p =>
      p.id === partId ? { ...p, answers: { ...p.answers, [qno]: value } } : p
    ));
  }

  // 타이핑 칸: "3214553142" 입력 → 각 문항에 1자리씩 배분
  // 1~5 외 문자는 무시. 길이가 모자라면 나머지는 미입력으로 둡니다.
  function applyAnswerString(partId: number, raw: string) {
    setParts(prev => prev.map(p => {
      if (p.id !== partId) return p;
      const qnos = Object.keys(p.answers).sort(
        (a, b) => Number(a.replace('q', '')) - Number(b.replace('q', ''))
      );
      const chars = raw.replace(/[^1-5]/g, '').split('');
      const next: Record<string, string> = {};
      qnos.forEach((q, i) => { next[q] = chars[i] ?? ''; });
      return { ...p, answers: next };
    }));
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

    // 정답 미입력 검사: 안 채운 문항이 있으면 저장 차단 (1번 기본값 사고 방지)
    const blanks: number[] = [];
    parts.forEach(p => {
      Object.keys(p.answers).forEach(q => {
        if (!p.answers[q]) blanks.push(Number(q.replace('q', '')));
      });
    });
    if (blanks.length > 0) {
      blanks.sort((a, b) => a - b);
      const preview = blanks.slice(0, 8).join(', ');
      toast.error(`정답을 입력하지 않은 문항이 있습니다: ${preview}${blanks.length > 8 ? ' …' : ''}번`);
      return;
    }

    setSaving(true);
    try {
      // 학생 OMR/대시보드 하위호환: sectionName·sectionContent 는 빈 값으로 채워 저장
      const partsToSave = parts.map(p => ({
        id: p.id,
        range: p.range,
        sectionName: subUnit || '',
        sectionContent: '',
        answers: p.answers,
        taskLow: p.taskLow,
        taskMid: p.taskMid,
        taskHigh: p.taskHigh,
      }));

      await addDoc(collection(db, 'master-tests'), {
        testId, subject, grade,
        unitName: unitName || '미지정 단원',
        subUnit: subUnit || '',
        parts: partsToSave,
        regDate: new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }),
      });
      toast.success('저장되었습니다!');
      // 목록은 onSnapshot 으로 자동 갱신되므로, 입력칸만 초기화합니다 (새로고침 없음)
      setParts([makePart(1)]);
      setUnitName('');
      setSubUnit('');
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
    try { await signOut(auth); } catch { /* 이미 로그아웃된 경우 무시 */ }
    window.location.href = LOGIN_PATH;
  }

  const filtered = tests.filter(t =>
    (!filterGrade || t.grade === filterGrade) &&
    (!filterSubject || t.subject === filterSubject)
  );

  const hasFilter = filterGrade || filterSubject;

  const inputCls = "w-full border border-pink-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-pink-400 transition-colors bg-white";
  const selectWrap = "relative";
  const selectCls = `${inputCls} appearance-none pr-8 cursor-pointer`;

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Header ── */}
      <header className="bg-white border-b border-pink-100 sticky top-0 z-50">
        <div className="w-full px-4 sm:px-6 h-14 flex items-center justify-between gap-2">
          <div
            className="flex items-center gap-2.5 cursor-pointer min-w-0"
            onClick={() => router.push('/exam-studio')}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: PINK_GRAD }}
            >
              <LayoutGrid size={15} className="text-white" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-gray-900 text-sm leading-tight truncate">마스터테스트 만들기</div>
              <div className="text-xs truncate" style={{ color: '#db2777' }}>인후쌤의 과학 수업 관리 시스템</div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 text-sm font-semibold text-white px-3 py-2 rounded-xl transition-opacity disabled:opacity-50 hover:opacity-85"
              style={{ background: PINK_GRAD }}
            >
              <Plus size={15} />
              <span className="hidden sm:inline">{saving ? '저장 중...' : '테스트 저장'}</span>
              <span className="sm:hidden">{saving ? '...' : '저장'}</span>
            </button>
            <button
              onClick={handleLogout}
              className="px-3 py-2 rounded-xl text-xs font-semibold border transition-colors flex items-center"
              style={{ borderColor: '#f4c8d4', color: '#e8375a' }}
              aria-label="로그아웃"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">

        {/* Welcome Bar */}
        <div
          className="rounded-2xl border border-pink-100 p-4 sm:p-5 mb-6 flex items-center justify-between gap-3"
          style={{ background: 'linear-gradient(135deg,#fff0f7 0%,#fdf2f8 60%,#f0f9ff 100%)' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: PINK_GRAD, boxShadow: '0 4px 12px rgba(219,39,119,0.25)' }}
            >
              ✏️
            </div>
            <div className="min-w-0">
              <div className="font-bold text-gray-900 text-sm sm:text-base">마스터테스트 생성</div>
              <div className="text-xs text-gray-500 mt-0.5">새로운 테스트를 생성하고 문항을 입력하세요</div>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="font-bold text-xs sm:text-sm" style={{ color: '#db2777' }}>
              {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
        </div>

        {/* ── 기본 정보 ── */}
        <div className="bg-white border border-pink-100 rounded-2xl p-5 mb-4">
          <h2 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: '#db2777' }}>1</span>
            기본 정보
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 tracking-wide">
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
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 tracking-wide">
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

          {/* 단원명 + 소단원명 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 tracking-wide">단원명</label>
              <input
                type="text"
                value={unitName}
                onChange={e => setUnitName(e.target.value)}
                placeholder="예: 1단원"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 tracking-wide">소단원명</label>
              <input
                type="text"
                value={subUnit}
                onChange={e => setSubUnit(e.target.value)}
                placeholder="예: 1-1 진화와 생물다양성"
                className={inputCls}
              />
            </div>
          </div>
        </div>

        {/* ── 섹션별 문항 ── */}
        {parts.map((part) => {
          const answerStr = answersToString(part.answers);
          return (
          <div key={part.id} className="bg-white border border-pink-100 rounded-2xl p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ background: '#db2777' }}
                >
                  {part.id}
                </span>
                <h2 className="text-sm font-bold text-gray-800 truncate">
                  {part.id}부 · 문항 {part.range}번
                </h2>
              </div>
              <button
                onClick={() => removePart(part.id)}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-red-400 hover:bg-red-50 transition-colors flex-shrink-0"
                aria-label="섹션 삭제"
              >
                <Trash2 size={15} />
              </button>
            </div>

            {/* 빠른 정답 입력 (타이핑) */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-700 mb-1.5 tracking-wide">
                빠른 정답 입력 <span className="text-gray-400 font-normal">— 정답을 순서대로 한 번에 (예: 3214553142)</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={answerStr.replace(/ /g, '')}
                onChange={e => applyAnswerString(part.id, e.target.value)}
                placeholder="1~5 숫자만 순서대로 입력 (아래 표에 자동 반영)"
                className={inputCls + ' tracking-[0.3em] font-bold text-pink-700'}
              />
            </div>

            <div className="mb-4">
              <p className="text-xs font-bold text-gray-700 mb-3 tracking-wide">
                정답 확인/수정 <span className="text-gray-400 font-normal">({part.range}번)</span>
              </p>
              <div className="grid grid-cols-5 gap-2">
                {Object.keys(part.answers)
                  .sort((a, b) => Number(a.replace('q','')) - Number(b.replace('q','')))
                  .map(qno => {
                  const filled = !!part.answers[qno];
                  return (
                  <div key={qno} className="flex flex-col items-center gap-1.5">
                    <span className="text-xs font-semibold text-gray-400">
                      {qno.replace('q', '')}
                    </span>
                    <div className={selectWrap + ' w-full'}>
                      <select
                        value={part.answers[qno]}
                        onChange={e => updateAnswer(part.id, qno, e.target.value)}
                        className={`w-full appearance-none border rounded-lg text-center text-sm py-2 px-1 focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-transparent transition-colors ${
                          filled ? 'border-pink-100 bg-white' : 'border-red-200 bg-red-50 text-red-400'
                        }`}
                      >
                        <option value="">·</option>
                        {ANSWER_OPTIONS.map(o => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-pink-50 pt-4">
              <p className="text-xs font-bold text-gray-700 mb-3 tracking-wide">추가 과제 (오답별)</p>
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
                      className="flex-1 min-w-0 border border-pink-100 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-pink-400 transition-colors"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          );
        })}

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
          style={{ background: PINK_GRAD }}
        >
          <Save size={18} />
          {saving ? '저장 중...' : '테스트 저장'}
        </button>

        {/* ── 등록된 테스트 목록 ── */}
        <div className="border-t-2 border-pink-100 pt-8">

          {/* 목록 헤더 */}
          <div className="flex items-center justify-between gap-2 mb-5">
            <div className="flex items-center gap-3 min-w-0">
              <h2 className="text-lg font-black text-gray-800 tracking-tight">등록된 테스트</h2>
              <span
                className="text-sm font-bold w-7 h-7 rounded-full flex items-center justify-center text-white shadow-sm flex-shrink-0"
                style={{ background: PINK_GRAD }}
              >
                {tests.length}
              </span>
            </div>
            <button
              onClick={() => setShowFilter(v => !v)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors flex-shrink-0 ${
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 tracking-wide">학년</label>
                  <div className={selectWrap}>
                    <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)} className={selectCls}>
                      <option value="">전체</option>
                      {GRADES.map(g => <option key={g}>{g}</option>)}
                    </select>
                    <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 tracking-wide">과목</label>
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

          {/* 테스트 목록 */}
          {filtered.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-pink-200 rounded-2xl p-12 text-center">
              <BookOpen size={44} className="mx-auto mb-4" style={{ color:'#f9a8d4' }} />
              <div className="font-semibold text-gray-600 mb-2">등록된 테스트가 없습니다</div>
              <p className="text-sm text-gray-400 leading-relaxed">위에서 테스트를 생성하고 저장해보세요!</p>
            </div>
          ) : (
            <>
              {/* ── 데스크탑 테이블 (md 이상) ── */}
              <div className="hidden md:block bg-white border border-pink-100 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full" style={{ minWidth: '680px' }}>
                    <thead>
                      <tr className="border-b border-pink-100" style={{ background: '#fdf2f8' }}>
                        <th className="text-left   text-xs font-bold text-gray-500 tracking-wide px-6 py-4 whitespace-nowrap">단원명</th>
                        <th className="text-center text-xs font-bold text-gray-500 tracking-wide px-4 py-4 whitespace-nowrap">등록일</th>
                        <th className="text-center text-xs font-bold text-gray-500 tracking-wide px-4 py-4 whitespace-nowrap">등록 상태</th>
                        <th className="text-center text-xs font-bold text-gray-500 tracking-wide px-4 py-4 whitespace-nowrap">학년</th>
                        <th className="text-center text-xs font-bold text-gray-500 tracking-wide px-4 py-4 whitespace-nowrap">과목</th>
                        <th className="text-center text-xs font-bold text-gray-500 tracking-wide px-4 py-4 whitespace-nowrap">총 문항</th>
                        <th className="text-center text-xs font-bold text-gray-500 tracking-wide px-6 py-4 whitespace-nowrap">관리</th>
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
                            <td className="px-6 py-5">
                              <span className="font-bold text-gray-900 text-sm">{t.unitName}</span>
                              {t.subUnit ? <span className="text-xs text-gray-400 ml-2">{t.subUnit}</span> : null}
                            </td>
                            <td className="px-4 py-5 text-center">
                              <span className="text-xs text-gray-600 font-medium whitespace-nowrap">
                                {t.regDate ? t.regDate.split('.').slice(0, 3).join('.').trim() : '—'}
                              </span>
                            </td>
                            <td className="px-4 py-5 text-center">
                              <span className="inline-block text-xs px-3 py-1 rounded-full font-semibold bg-green-100 text-green-700 whitespace-nowrap">
                                등록됨
                              </span>
                            </td>
                            <td className="px-4 py-5 text-center">
                              {t.grade
                                ? <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full bg-pink-100 text-pink-700 whitespace-nowrap">{t.grade}</span>
                                : <span className="text-xs text-gray-300">—</span>
                              }
                            </td>
                            <td className="px-4 py-5 text-center">
                              {t.subject
                                ? <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full bg-blue-100 text-blue-700 whitespace-nowrap">{t.subject}</span>
                                : <span className="text-xs text-gray-300">—</span>
                              }
                            </td>
                            <td className="px-4 py-5 text-center">
                              <span className="text-sm font-black" style={{ color:'#db2777' }}>{totalQ}</span>
                              <span className="text-xs text-gray-400 ml-1">문항</span>
                            </td>
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
              </div>

              {/* ── 모바일 카드 뷰 (md 미만) ── */}
              <div className="md:hidden flex flex-col gap-3">
                {filtered.map((t) => {
                  const totalQ = t.parts.reduce(
                    (acc, p) => acc + Object.keys(p.answers).length, 0
                  );
                  return (
                    <div
                      key={t.fireId}
                      className="bg-white border border-pink-100 rounded-2xl p-4"
                    >
                      {/* 상단: 단원명 + 상태 배지 */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <span className="font-bold text-gray-900 text-sm leading-snug flex-1 min-w-0">
                          {t.unitName}
                          {t.subUnit ? <span className="block text-xs font-normal text-gray-400 mt-0.5">{t.subUnit}</span> : null}
                        </span>
                        <span className="flex-shrink-0 inline-block text-xs px-2.5 py-1 rounded-full font-semibold bg-green-100 text-green-700">
                          등록됨
                        </span>
                      </div>

                      {/* 뱃지 행: 학년 + 과목 + 등록일 */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-3">
                        {t.grade && (
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-pink-100 text-pink-700">
                            {t.grade}
                          </span>
                        )}
                        {t.subject && (
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
                            {t.subject}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">
                          {t.regDate ? t.regDate.split('.').slice(0, 3).join('.').trim() : '—'}
                        </span>
                      </div>

                      {/* 문항 + 섹션 수 */}
                      <div className="flex items-center gap-3 mb-3 py-2.5 px-3 rounded-xl bg-gray-50">
                        <div className="flex-1 text-center">
                          <div className="text-xs text-gray-400 mb-0.5">총 문항</div>
                          <div className="text-sm font-black" style={{ color:'#db2777' }}>
                            {totalQ}<span className="text-xs font-normal text-gray-400 ml-0.5">문항</span>
                          </div>
                        </div>
                        <div className="w-px h-8 bg-gray-200" />
                        <div className="flex-1 text-center">
                          <div className="text-xs text-gray-400 mb-0.5">섹션 수</div>
                          <div className="text-sm font-black text-gray-700">
                            {t.parts.length}<span className="text-xs font-normal text-gray-400 ml-0.5">부</span>
                          </div>
                        </div>
                      </div>

                      {/* 삭제 버튼 */}
                      <button
                        onClick={() => handleDelete(t.fireId)}
                        className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-red-500 bg-red-50 hover:bg-red-100 py-2.5 rounded-xl transition-colors"
                      >
                        <Trash2 size={13} />
                        삭제
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
