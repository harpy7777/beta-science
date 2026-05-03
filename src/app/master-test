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
import { FlaskConical, Plus, LogOut, Save, Trash2, ChevronDown } from 'lucide-react';
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

  // 폼 상태
  const [testId] = useState('test-' + Date.now());
  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState('');
  const [unitName, setUnitName] = useState('');
  const [parts, setParts] = useState<Part[]>([makePart(1), makePart(2), makePart(3)]);
  const [saving, setSaving] = useState(false);

  // 등록된 테스트 목록
  const [tests, setTests] = useState<MasterTest[]>([]);
  const [filterGrade, setFilterGrade] = useState('');
  const [filterSubject, setFilterSubject] = useState('');

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
        testId,
        subject,
        grade,
        unitName: unitName || '미지정 단원',
        parts,
        regDate: new Date().toLocaleString(),
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Header ── */}
      <header className="bg-white border-b border-green-100 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => router.push('/')}
          >
            <div className="w-9 h-9 bg-green-600 rounded-xl flex items-center justify-center">
              <FlaskConical size={18} className="text-white" />
            </div>
            <div>
              <div className="font-bold text-green-900">베타과학학원</div>
              <div className="text-xs text-green-600">마스터테스트 출제</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 hidden sm:block">{user?.email}</span>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary text-sm flex items-center gap-1.5 bg-green-600 hover:bg-green-700"
            >
              <Plus size={16} />
              {saving ? '저장 중...' : '테스트 저장'}
            </button>
            <button onClick={handleLogout} className="btn-ghost text-gray-500">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">

        {/* ── 페이지 타이틀 ── */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">마스터테스트 생성</h1>
          <p className="text-sm text-gray-500 mt-1">새로운 테스트를 생성하고 문항을 입력하세요</p>
        </div>

        {/* ── 기본 정보 ── */}
        <div className="card p-6 mb-5 bg-white border border-gray-200 rounded-xl">
          <h2 className="text-base font-bold text-gray-800 mb-5">기본 정보</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">테스트 ID</label>
              <input
                type="text"
                value={testId}
                readOnly
                className="input-field bg-gray-50 text-gray-400 cursor-default text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                과목 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  className="input-field appearance-none pr-8 text-sm"
                >
                  <option value="">과목 선택</option>
                  {SUBJECTS.map(s => <option key={s}>{s}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                학년 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={grade}
                  onChange={e => setGrade(e.target.value)}
                  className="input-field appearance-none pr-8 text-sm"
                >
                  <option value="">학년 선택</option>
                  {GRADES.map(g => <option key={g}>{g}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">단원명</label>
            <input
              type="text"
              value={unitName}
              onChange={e => setUnitName(e.target.value)}
              placeholder="예: 알칼리금속과 할로젠"
              className="input-field text-sm"
            />
          </div>
        </div>

        {/* ── 섹션별 문항 ── */}
        {parts.map((part) => (
          <div key={part.id} className="card p-6 mb-5 bg-white border border-gray-200 rounded-xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-gray-800">
                {part.id}부: 문항 {part.range}
              </h2>
              <button
                onClick={() => removePart(part.id)}
                className="text-red-400 hover:text-red-600 transition-colors"
                title="섹션 삭제"
              >
                <Trash2 size={16} />
              </button>
            </div>

            {/* 섹션명 & 핵심내용 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">섹션명</label>
                <input
                  type="text"
                  value={part.sectionName}
                  onChange={e => updatePart(part.id, 'sectionName', e.target.value)}
                  placeholder="예: 알칼리금속"
                  className="input-field text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">핵심 내용</label>
                <input
                  type="text"
                  value={part.sectionContent}
                  onChange={e => updatePart(part.id, 'sectionContent', e.target.value)}
                  placeholder="이 섹션의 핵심 개념을 입력하세요..."
                  className="input-field text-sm"
                />
              </div>
            </div>

            {/* 정답 입력 */}
            <div className="mb-5">
              <p className="text-sm font-bold text-gray-700 mb-3">
                정답 입력 ({part.range}번)
              </p>
              <div className="grid grid-cols-5 gap-3 mb-3">
                {Object.keys(part.answers).slice(0, 5).map(qno => (
                  <div key={qno} className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-gray-400">Q{qno.replace('q', '')}</span>
                    <div className="relative">
                      <select
                        value={part.answers[qno]}
                        onChange={e => updateAnswer(part.id, qno, e.target.value)}
                        className="input-field appearance-none pr-6 text-sm py-2"
                      >
                        {ANSWER_OPTIONS.map(o => <option key={o}>{o}</option>)}
                      </select>
                      <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-5 gap-3">
                {Object.keys(part.answers).slice(5, 10).map(qno => (
                  <div key={qno} className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-gray-400">Q{qno.replace('q', '')}</span>
                    <div className="relative">
                      <select
                        value={part.answers[qno]}
                        onChange={e => updateAnswer(part.id, qno, e.target.value)}
                        className="input-field appearance-none pr-6 text-sm py-2"
                      >
                        {ANSWER_OPTIONS.map(o => <option key={o}>{o}</option>)}
                      </select>
                      <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 추가 과제 */}
            <div className="border-t border-gray-100 pt-5">
              <p className="text-sm font-bold text-gray-700 mb-3">추가 과제 (오답별)</p>
              <div className="space-y-3">
                {[
                  { label: '0-2개 오답', field: 'taskLow' as keyof Part },
                  { label: '3-4개 오답', field: 'taskMid' as keyof Part },
                  { label: '5개 이상 오답', field: 'taskHigh' as keyof Part },
                ].map(({ label, field }) => (
                  <div key={field}>
                    <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>
                    <input
                      type="text"
                      value={part[field] as string}
                      onChange={e => updatePart(part.id, field, e.target.value)}
                      className="input-field text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}

        {/* ── 섹션 추가 버튼 ── */}
        <button
          onClick={addPart}
          className="w-full py-3 border-2 border-dashed border-green-200 rounded-xl text-green-600 text-sm font-medium hover:border-green-400 hover:bg-green-50 transition-colors mb-8 flex items-center justify-center gap-2"
        >
          <Plus size={16} />
          섹션 추가
        </button>

        {/* ── 저장 버튼 ── */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-base transition-colors mb-10 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Save size={18} />
          {saving ? '저장 중...' : '테스트 저장'}
        </button>

        {/* ── 등록된 테스트 목록 ── */}
        <div className="border-t-2 border-gray-200 pt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              등록된 테스트
              <span className="bg-green-500 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                {tests.length}개
              </span>
            </h2>
          </div>

          {/* 필터 */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">학년 필터</label>
              <div className="relative">
                <select
                  value={filterGrade}
                  onChange={e => setFilterGrade(e.target.value)}
                  className="input-field appearance-none pr-8 text-sm"
                >
                  <option value="">전체 학년</option>
                  {GRADES.map(g => <option key={g}>{g}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">과목 필터</label>
              <div className="relative">
                <select
                  value={filterSubject}
                  onChange={e => setFilterSubject(e.target.value)}
                  className="input-field appearance-none pr-8 text-sm"
                >
                  <option value="">전체 과목</option>
                  {SUBJECTS.map(s => <option key={s}>{s}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <button
              onClick={() => { setFilterGrade(''); setFilterSubject(''); }}
              className="btn-ghost text-sm text-gray-600 border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50"
            >
              필터 초기화
            </button>
          </div>

          {/* 테스트 테이블 */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 border-b border-gray-200">테스트 ID</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 border-b border-gray-200">단원명</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 border-b border-gray-200">과목</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 border-b border-gray-200">학년</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 border-b border-gray-200">관리</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-gray-400 py-10 text-sm">
                      등록된 테스트가 없습니다
                    </td>
                  </tr>
                ) : filtered.map(t => (
                  <tr key={t.fireId} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{t.testId}</td>
                    <td className="px-4 py-3 font-semibold text-sm text-gray-800">{t.unitName}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs border border-gray-200 rounded-full px-2.5 py-0.5 text-gray-600">
                        {t.subject}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-green-100 text-green-700 font-medium rounded-full px-2.5 py-0.5">
                        {t.grade}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(t.fireId)}
                        className="text-red-400 hover:text-red-600 transition-colors"
                        title="삭제"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
