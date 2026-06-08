'use client';
// src/app/teacher/create/page.tsx
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, getDocs, Timestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import {
  saveExam, updateExam, getExam,
  Question, QuestionType
} from '@/lib/examService';
import {
  ArrowLeft, Plus, Trash2,
  Send, Save, CheckCircle, FileText,
  ChevronDown, ChevronUp, FlaskConical, AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';

type Step = 1 | 2 | 3;

// ─────────────────────────────────────────────────────────────────────────────
const GRADES = ['중1', '중2', '중3', '고1', '고2', '고3'];

const SUBJECTS: Record<string, string[]> = {
  '중1': ['과학내신'],
  '중2': ['과학내신'],
  '중3': ['과학내신'],
  '고1': ['통합과학1', '통합과학2', '화학', '물질과 에너지', '화학 반응의 세계'],
  '고2': ['통합과학1', '통합과학2', '화학', '물질과 에너지', '화학 반응의 세계'],
  '고3': ['통합과학1', '통합과학2', '화학', '물질과 에너지', '화학 반응의 세계'],
};
// ─────────────────────────────────────────────────────────────────────────────

function makeId() {
  return Math.random().toString(36).substring(2, 10);
}

function makeQuestion(type: QuestionType): Question {
  return {
    id: makeId(),
    type,
    text: '',
    options: type === 'multiple' ? ['', '', '', ''] : undefined,
    answer: type === 'ox' ? 'O' : '1',
    explanation: '',
  };
}

function parseOXBulk(raw: string): Question[] {
  const blocks = raw.trim().split(/\n\s*\n/);
  const results: Question[] = [];
  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim());
    const get = (key: string) => {
      const l = lines.find(x => x.startsWith(key));
      return l ? l.replace(key, '').trim() : '';
    };
    const text = get('문제:');
    if (!text) continue;
    const ansRaw = get('정답:').toUpperCase();
    const ans = ansRaw === 'X' ? 'X' : 'O';
    results.push({ id: makeId(), type: 'ox', text, answer: ans, explanation: get('해설:') });
  }
  return results;
}

function parseMCBulk(raw: string): Question[] {
  const blocks = raw.trim().split(/\n\s*\n/);
  const results: Question[] = [];
  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim());
    const get = (key: string) => {
      const l = lines.find(x => x.startsWith(key));
      return l ? l.replace(key, '').trim() : '';
    };
    const text = get('문제:');
    if (!text) continue;
    const opts = [get('선택지1:'), get('선택지2:'), get('선택지3:'), get('선택지4:')];
    const ansText = get('정답:');
    const ansIdx = opts.findIndex(o => o === ansText);
    const answer = ansIdx >= 0 ? String(ansIdx + 1) : (ansText || '1');
    results.push({ id: makeId(), type: 'multiple', text, options: opts, answer, explanation: get('해설:') });
  }
  return results;
}

// ── 전체 삭제 확인 모달 ──
function ClearConfirmModal({
  kind, count, onConfirm, onCancel,
}: {
  kind: 'ox' | 'multiple'; count: number; onConfirm: () => void; onCancel: () => void;
}) {
  const label = kind === 'ox' ? 'OX 문제' : '4지선다 문제';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
            <AlertTriangle size={28} className="text-red-500" />
          </div>
        </div>
        <h3 className="text-center font-black text-gray-900 text-lg mb-2">입력칸의 {label}를 비울까요?</h3>
        <p className="text-center text-sm text-gray-500 mb-1">
          지금 입력창에 올라온 <span className="font-semibold text-red-500">{label} {count}개</span>가 화면에서 지워집니다.
        </p>
        <p className="text-center text-xs text-gray-400 mb-5">
          ※ 이미 게시된 시험은 삭제되지 않습니다. (입력 중인 내용만 비웁니다)
        </p>
        <div className="flex gap-2.5">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
            취소
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-85 flex items-center justify-center gap-1.5"
            style={{ background: 'linear-gradient(135deg,#f87171,#dc2626)' }}>
            <Trash2 size={14} />입력칸 비우기
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
function CreateExamInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [step, setStep] = useState<Step>(1);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [grade, setGrade] = useState('');
  const [subject, setSubject] = useState('');
  const [codepenUrl, setCodepenUrl] = useState('');

  const [oxBulk, setOxBulk] = useState('');
  const [mcBulk, setMcBulk] = useState('');
  const [oxOpen, setOxOpen] = useState(true);
  const [mcOpen, setMcOpen] = useState(true);
  const [oxParsed, setOxParsed] = useState<Question[]>([]);
  const [mcParsed, setMcParsed] = useState<Question[]>([]);

  // 인라인 수정 중인 문제 id (null이면 닫힘)
  const [oxEditId, setOxEditId] = useState<string | null>(null);
  const [mcEditId, setMcEditId] = useState<string | null>(null);

  // 입력칸 비우기 확인 모달 대상 ('ox' | 'multiple' | null)
  const [clearTarget, setClearTarget] = useState<'ox' | 'multiple' | null>(null);

  const handleGradeChange = (g: string) => { setGrade(g); setSubject(''); };
  const subjectList = grade ? (SUBJECTS[grade] ?? []) : [];
  const allQuestions = [...oxParsed, ...mcParsed];

  // ── 인라인 수정 헬퍼 ──
  const updateOx = (id: string, patch: Partial<Question>) =>
    setOxParsed(prev => prev.map(q => (q.id === id ? { ...q, ...patch } : q)));
  const updateMc = (id: string, patch: Partial<Question>) =>
    setMcParsed(prev => prev.map(q => (q.id === id ? { ...q, ...patch } : q)));
  const updateMcOption = (id: string, idx: number, val: string) =>
    setMcParsed(prev => prev.map(q => {
      if (q.id !== id) return q;
      const options = [...(q.options ?? ['', '', '', ''])];
      options[idx] = val;
      return { ...q, options };
    }));

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push('/teacher'); return; }
      setUser(u);
      setAuthLoading(false);
      if (editId) {
        const exam = await getExam(editId);
        if (exam) {
          setTitle(exam.title);
          setGrade(exam.grade ?? '');
          setSubject(exam.subject ?? '');
          setCodepenUrl(exam.codepenUrl ?? '');
          setOxParsed(exam.questions.filter(q => q.type === 'ox'));
          setMcParsed(exam.questions.filter(q => q.type === 'multiple'));
          setStep(2);
        }
      }
    });
    return unsub;
  }, [editId, router]);

  const handleOxParse = useCallback(() => {
    const parsed = parseOXBulk(oxBulk);
    if (parsed.length === 0) { toast.error('형식을 확인해주세요'); return; }
    setOxParsed(prev => [...prev, ...parsed]);   // ★ 덮어쓰기 → 기존 목록에 추가
    setOxBulk('');
    toast.success(`OX 문제 ${parsed.length}개 추가됨`);
  }, [oxBulk]);

  const handleMcParse = useCallback(() => {
    const parsed = parseMCBulk(mcBulk);
    if (parsed.length === 0) { toast.error('형식을 확인해주세요'); return; }
    setMcParsed(prev => [...prev, ...parsed]);   // ★ 덮어쓰기 → 기존 목록에 추가
    setMcBulk('');
    toast.success(`4지선다 ${parsed.length}개 추가됨`);
  }, [mcBulk]);

  // 입력칸 비우기 실행 (화면의 입력 내용만 비움 - 게시된 시험과 무관)
  function handleClearConfirm() {
    if (clearTarget === 'ox') {
      setOxParsed([]);
      setOxEditId(null);
      toast.success('OX 입력칸을 비웠습니다');
    } else if (clearTarget === 'multiple') {
      setMcParsed([]);
      setMcEditId(null);
      toast.success('4지선다 입력칸을 비웠습니다');
    }
    setClearTarget(null);
  }

  async function handleSave(publish: boolean) {
    if (!grade) { toast.error('학년을 선택하세요'); setStep(1); return; }
    // ★ 학년 검증: 정해진 학년(중1~고3)이 아니면 저장 차단 (학년 섞임 방지)
    if (!GRADES.includes(grade)) {
      toast.error('학년을 올바르게 선택하세요'); setStep(1); return;
    }
    if (!subject) { toast.error('과목을 선택하세요'); setStep(1); return; }
    if (!title.trim()) { toast.error('단원명을 입력하세요'); setStep(1); return; }
    if (allQuestions.length === 0) { toast.error('문제를 1개 이상 입력하세요'); return; }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        teacherId: user!.uid,
        questions: allQuestions,
        oxQuestions: oxParsed,
        multipleQuestions: mcParsed,
        isPublished: publish,
        grade,
        subject,
        codepenUrl: codepenUrl.trim(),
      };
      if (editId) {
        await updateExam(editId, payload);
        toast.success(publish ? '게시되었습니다!' : '저장되었습니다!');
      } else {
        await saveExam(payload);
        toast.success(publish ? '시험지가 게시되었습니다!' : '임시 저장됨');
      }
      setSaved(true);
    } catch (e) {
      console.error(e);
      toast.error('저장에 실패했습니다');
    } finally {
      setSaving(false);
    }
  }

  // 등록된 모든 시험을 백업 파일(JSON)로 내려받기 — backup.html에서 그대로 복원 가능
  async function downloadTestsBackup() {
    try {
      const snap = await getDocs(collection(db, 'tests'));
      const enc = (v: any): any => {
        if (v === null || v === undefined) return v;
        if (v instanceof Timestamp) return { __ts: true, s: v.seconds, n: v.nanoseconds };
        if (Array.isArray(v)) return v.map(enc);
        if (typeof v === 'object') { const o: any = {}; for (const k in v) o[k] = enc(v[k]); return o; }
        return v;
      };
      const tests = snap.docs.map(d => ({ __id: d.id, ...enc(d.data()) }));
      const payload = {
        meta: { app: 'beta-science', version: 1, exportedAt: new Date().toISOString() },
        data: { tests },
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const n = new Date(); const pad = (x: number) => String(x).padStart(2, '0');
      a.href = url;
      a.download = `beta-science-tests-${n.getFullYear()}${pad(n.getMonth() + 1)}${pad(n.getDate())}-${pad(n.getHours())}${pad(n.getMinutes())}.json`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`시험 백업 파일을 받았습니다 (${tests.length}개)`);
    } catch (e) {
      console.error(e);
      toast.error('백업에 실패했습니다. 다시 시도해주세요');
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#fdf2f8' }}>
        <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#f472b6', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  // ── 공통 인풋 스타일
  const inputCls = "w-full border border-pink-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-pink-400 transition-colors bg-white";

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── 입력칸 비우기 확인 모달 ── */}
      {clearTarget && (
        <ClearConfirmModal
          kind={clearTarget}
          count={clearTarget === 'ox' ? oxParsed.length : mcParsed.length}
          onConfirm={handleClearConfirm}
          onCancel={() => setClearTarget(null)}
        />
      )}

      {/* ── 헤더 ── */}
      <header className="bg-white border-b border-pink-100 sticky top-0 z-40">
        <div className="w-full px-4 sm:px-6 h-14 flex items-center justify-between">

          {/* 왼쪽: 로고 + 타이틀 */}
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => router.push('/teacher')}>
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#f472b6,#db2777)' }}
            >
              <FlaskConical size={15} className="text-white" />
            </div>
            <div>
              <div className="font-semibold text-gray-900 text-sm leading-tight">
                {editId ? '시험지 수정' : '시험지 만들기'}
              </div>
              <div className="text-xs" style={{ color: '#db2777' }}>
                {grade && subject ? `${grade} · ${subject}` : title || '베타과학학원'}
              </div>
            </div>
          </div>

          {/* 스텝 인디케이터 (중간) */}
          <div className="hidden sm:flex items-center gap-1.5">
            {([1, 2, 3] as Step[]).map(s => (
              <button
                key={s}
                onClick={() => {
                  if (s >= 2 && (!title.trim() || !grade || !subject)) {
                    toast.error('학년·과목·단원명을 먼저 입력하세요'); return;
                  }
                  setStep(s);
                }}
                className="w-7 h-7 rounded-full text-xs font-bold transition-all flex items-center justify-center"
                style={
                  step === s
                    ? { background: 'linear-gradient(135deg,#f472b6,#db2777)', color: '#fff' }
                    : step > s
                    ? { background: '#fce7f3', color: '#db2777' }
                    : { background: '#f3f4f6', color: '#9ca3af' }
                }
              >
                {step > s ? '✓' : s}
              </button>
            ))}
          </div>

          {/* 오른쪽 버튼 */}
          <div className="flex gap-2">
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-colors disabled:opacity-50"
              style={{ borderColor: '#f4c8d4', color: '#e8375a' }}
            >
              <Save size={14} />
              <span className="hidden sm:inline">임시저장</span>
            </button>
            <button
              onClick={() => { if (step < 3) { setStep(3); return; } handleSave(true); }}
              disabled={saving}
              className="flex items-center gap-1.5 text-sm font-semibold text-white px-3 py-2 rounded-xl transition-opacity disabled:opacity-50 hover:opacity-85"
              style={{ background: 'linear-gradient(135deg,#f472b6,#db2777)' }}
            >
              {saving
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : saved ? <CheckCircle size={14} />
                : step < 3 ? <FileText size={14} />
                : <Send size={14} />}
              <span className="hidden sm:inline">
                {saving ? '저장 중...' : saved ? '완료!' : step < 3 ? '미리보기' : '게시하기'}
              </span>
              <span className="sm:hidden">
                {saving ? '...' : saved ? '완료' : step < 3 ? '미리보기' : '게시'}
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">

        {/* ── Welcome Bar ── */}
        <div
          className="rounded-2xl border border-pink-100 p-4 sm:p-5 mb-6 flex items-center justify-between gap-3"
          style={{ background: 'linear-gradient(135deg,#fff0f7 0%,#fdf2f8 60%,#f0f9ff 100%)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#f472b6,#db2777)', boxShadow: '0 4px 12px rgba(219,39,119,0.25)' }}
            >
              📝
            </div>
            <div>
              <div className="font-bold text-gray-900 text-sm sm:text-base">
                {editId ? '시험지 수정' : '새 시험지 만들기'}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                학년과 과목을 선택하고 문제를 입력하세요
              </div>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="font-bold text-xs sm:text-sm" style={{ color: '#db2777' }}>
              {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
        </div>

        {/* ── STEP 1: 기본 정보 ── */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="bg-white border border-pink-100 rounded-2xl p-5">
              <h2 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ background: '#db2777' }}
                >1</span>
                기본 정보
              </h2>

              {/* 학년 */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
                  학년 <span style={{ color: '#db2777' }}>*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {GRADES.map(g => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => handleGradeChange(g)}
                      className="py-2.5 rounded-xl text-sm font-bold border-2 transition-all"
                      style={
                        grade === g
                          ? { background: 'linear-gradient(135deg,#f472b6,#db2777)', color: '#fff', borderColor: '#db2777' }
                          : { borderColor: '#fce7f3', color: '#9ca3af' }
                      }
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* 과목 */}
              {grade && (
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
                    과목 <span style={{ color: '#db2777' }}>*</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {subjectList.map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSubject(s)}
                        className="px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all"
                        style={
                          subject === s
                            ? { background: 'linear-gradient(135deg,#f472b6,#db2777)', color: '#fff', borderColor: '#db2777' }
                            : { borderColor: '#fce7f3', color: '#9ca3af' }
                        }
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 단원명 */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">단원명</label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="예: 1단원 · 물질의 구성"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && title.trim() && grade && subject) setStep(2); }}
                  autoFocus
                />
              </div>
            </div>

            <button
              onClick={() => {
                if (!grade) { toast.error('학년을 선택하세요'); return; }
                if (!subject) { toast.error('과목을 선택하세요'); return; }
                if (!title.trim()) { toast.error('단원명을 입력하세요'); return; }
                setStep(2);
              }}
              className="w-full py-4 text-white font-bold rounded-2xl text-base transition-opacity hover:opacity-85 flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg,#f472b6,#db2777)' }}
            >
              다음: 문제 추가 →
            </button>
          </div>
        )}

        {/* ── STEP 2: 문제 입력 ── */}
        {step === 2 && (
          <div className="space-y-4">

            {/* 요약 배지 */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: '#fce7f3', color: '#db2777' }}>{grade}</span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">{subject}</span>
              <span className="text-sm font-semibold text-gray-700">{title}</span>
            </div>

            {/* OX 섹션 */}
            <div className="bg-white border border-pink-100 rounded-2xl overflow-hidden">
              <button
                onClick={() => setOxOpen(o => !o)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-pink-50/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#dcfce7', color: '#15803d' }}>OX 문제</span>
                  <span className="font-bold text-gray-800 text-sm">OX 일괄 입력</span>
                  {oxParsed.length > 0 && (
                    <span className="text-xs font-semibold" style={{ color: '#16a34a' }}>✓ {oxParsed.length}개 로드됨</span>
                  )}
                </div>
                {oxOpen ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
              </button>

              {oxOpen && (
                <div className="px-5 pb-5 border-t border-pink-50">
                  {/* 입력 형식 안내 */}
                  <div className="rounded-xl p-3 my-4 text-xs leading-relaxed" style={{ background: '#f0fdf4', color: '#166534' }}>
                    <strong>입력 형식</strong> (문제 사이 빈 줄로 구분)<br />
                    <code className="block mt-1 bg-white rounded p-2 whitespace-pre" style={{ color: '#15803d' }}>{`문제: 물은 H2O로 표현된다.
정답: O
해설: 물 분자는 수소 2개, 산소 1개입니다.

문제: 지구는 태양계의 중심이다.
정답: X
해설: 태양이 중심입니다.`}</code>
                  </div>

                  <textarea
                    className={`${inputCls} resize-none font-mono`}
                    rows={8}
                    placeholder={`문제: \n정답: O\n해설: \n\n문제: \n정답: X\n해설: `}
                    value={oxBulk}
                    onChange={e => setOxBulk(e.target.value)}
                  />

                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-gray-400">
                      {oxBulk.trim().split(/\n\s*\n/).filter(b => b.includes('문제:')).length}개 감지됨 · 기존 목록에 추가됩니다
                    </span>
                    <button
                      onClick={handleOxParse}
                      className="text-sm font-semibold text-white px-4 py-2 rounded-xl transition-opacity hover:opacity-85"
                      style={{ background: 'linear-gradient(135deg,#f472b6,#db2777)' }}
                    >
                      가져오기 →
                    </button>
                  </div>

                  {oxParsed.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        로드된 OX 문제 ({oxParsed.length}개) · 문제를 누르면 수정할 수 있어요
                      </div>
                      {oxParsed.map((q, i) => {
                        const open = oxEditId === q.id;
                        return (
                          <div key={q.id} className={`rounded-xl border ${open ? 'border-green-300 bg-white' : 'border-transparent bg-gray-50'}`}>
                            <div className="flex items-start gap-3 px-3 py-2.5">
                              <span className="text-xs text-gray-400 mt-0.5 shrink-0">Q{i + 1}</span>
                              <button
                                type="button"
                                onClick={() => setOxEditId(open ? null : q.id)}
                                className="flex-1 text-left text-sm text-gray-700 line-clamp-1 hover:text-green-700 transition-colors"
                              >
                                {q.text || <span className="text-red-400">⚠ 문제 미입력</span>}
                              </button>
                              <span className={`text-sm font-bold shrink-0 ${q.answer === 'O' ? 'text-green-600' : 'text-red-500'}`}>{q.answer}</span>
                              <button
                                onClick={() => { setOxParsed(prev => prev.filter((_, idx) => idx !== i)); if (open) setOxEditId(null); }}
                                className="text-gray-300 hover:text-red-400 shrink-0 transition-colors"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                            {open && (
                              <div className="px-3 pb-3 pt-1 space-y-2.5 border-t border-green-100">
                                <div>
                                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">문제</label>
                                  <textarea
                                    className={`${inputCls} resize-none`}
                                    rows={2}
                                    value={q.text}
                                    onChange={e => updateOx(q.id, { text: e.target.value })}
                                    placeholder="문제를 입력하세요"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">정답</label>
                                  <div className="flex gap-2">
                                    {(['O', 'X'] as const).map(v => {
                                      const sel = q.answer === v;
                                      return (
                                        <button
                                          key={v}
                                          type="button"
                                          onClick={() => updateOx(q.id, { answer: v })}
                                          className="px-5 py-2 rounded-lg text-sm font-bold border-2 transition-all"
                                          style={sel
                                            ? v === 'O'
                                              ? { background: '#dcfce7', color: '#15803d', borderColor: '#86efac' }
                                              : { background: '#fee2e2', color: '#dc2626', borderColor: '#fca5a5' }
                                            : { background: '#f9fafb', color: '#9ca3af', borderColor: '#e5e7eb' }}
                                        >
                                          {v}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">해설 (선택)</label>
                                  <input
                                    type="text"
                                    className={inputCls}
                                    value={q.explanation ?? ''}
                                    onChange={e => updateOx(q.id, { explanation: e.target.value })}
                                    placeholder="해설"
                                  />
                                </div>
                                <div className="flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() => setOxEditId(null)}
                                    className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white"
                                    style={{ background: 'linear-gradient(135deg,#34d399,#15803d)' }}
                                  >
                                    완료
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* OX 하단 버튼: 1개 추가 + 입력칸 비우기 */}
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => { const nq = makeQuestion('ox'); setOxParsed(prev => [...prev, nq]); setOxEditId(nq.id); }}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-colors"
                      style={{ borderColor: '#fce7f3', color: '#db2777' }}
                    >
                      <Plus size={13} /> OX 문제 1개 추가
                    </button>
                    {oxParsed.length > 0 && (
                      <button
                        onClick={() => setClearTarget('ox')}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-colors"
                        style={{ borderColor: '#fecaca', color: '#dc2626' }}
                      >
                        <Trash2 size={13} /> 입력칸 비우기
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 4지선다 섹션 */}
            <div className="bg-white border border-pink-100 rounded-2xl overflow-hidden">
              <button
                onClick={() => setMcOpen(o => !o)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-pink-50/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">4지선다</span>
                  <span className="font-bold text-gray-800 text-sm">4지선다 일괄 입력</span>
                  {mcParsed.length > 0 && (
                    <span className="text-xs font-semibold text-blue-600">✓ {mcParsed.length}개 로드됨</span>
                  )}
                </div>
                {mcOpen ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
              </button>

              {mcOpen && (
                <div className="px-5 pb-5 border-t border-pink-50">
                  <div className="rounded-xl p-3 my-4 text-xs leading-relaxed bg-blue-50 text-blue-800">
                    <strong>입력 형식</strong> (문제 사이 빈 줄로 구분)<br />
                    <code className="block mt-1 bg-white rounded p-2 text-blue-900 whitespace-pre">{`문제: 광합성을 하는 세포 소기관은?
선택지1: 미토콘드리아
선택지2: 엽록체
선택지3: 리보솜
선택지4: 골지체
정답: 엽록체
해설: 엽록체는 광합성을 담당합니다.`}</code>
                  </div>

                  <textarea
                    className={`${inputCls} resize-none font-mono`}
                    rows={10}
                    placeholder={`문제: \n선택지1: \n선택지2: \n선택지3: \n선택지4: \n정답: \n해설: `}
                    value={mcBulk}
                    onChange={e => setMcBulk(e.target.value)}
                  />

                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-gray-400">
                      {mcBulk.trim().split(/\n\s*\n/).filter(b => b.includes('문제:')).length}개 감지됨 · 기존 목록에 추가됩니다
                    </span>
                    <button
                      onClick={handleMcParse}
                      className="text-sm font-semibold text-white px-4 py-2 rounded-xl transition-opacity hover:opacity-85"
                      style={{ background: 'linear-gradient(135deg,#f472b6,#db2777)' }}
                    >
                      가져오기 →
                    </button>
                  </div>

                  {mcParsed.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        로드된 4지선다 ({mcParsed.length}개) · 문제를 누르면 수정할 수 있어요
                      </div>
                      {mcParsed.map((q, i) => {
                        const open = mcEditId === q.id;
                        const validAns = ['1', '2', '3', '4'].includes(q.answer);
                        return (
                          <div key={q.id} className={`rounded-xl border ${open ? 'border-pink-300 bg-white' : 'border-transparent bg-gray-50'}`}>
                            <div className="flex items-start gap-3 px-3 py-2.5">
                              <span className="text-xs text-gray-400 mt-0.5 shrink-0">Q{i + 1}</span>
                              <button
                                type="button"
                                onClick={() => setMcEditId(open ? null : q.id)}
                                className="flex-1 text-left text-sm text-gray-700 line-clamp-1 hover:text-pink-600 transition-colors"
                              >
                                {q.text || <span className="text-red-400">⚠ 문제 미입력</span>}
                              </button>
                              <span className={`text-xs font-semibold shrink-0 ${validAns ? 'text-blue-600' : 'text-red-500'}`}>
                                {validAns ? `${q.answer}번` : '⚠ 정답확인'}
                              </span>
                              <button
                                onClick={() => { setMcParsed(prev => prev.filter((_, idx) => idx !== i)); if (open) setMcEditId(null); }}
                                className="text-gray-300 hover:text-red-400 shrink-0 transition-colors"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                            {open && (
                              <div className="px-3 pb-3 pt-1 space-y-2.5 border-t border-pink-100">
                                <div>
                                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">문제</label>
                                  <textarea
                                    className={`${inputCls} resize-none`}
                                    rows={2}
                                    value={q.text}
                                    onChange={e => updateMc(q.id, { text: e.target.value })}
                                    placeholder="문제를 입력하세요"
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <label className="block text-[11px] font-semibold text-gray-500">선택지 · 정답 (정답인 번호를 누르세요)</label>
                                  {[0, 1, 2, 3].map(j => {
                                    const isAns = q.answer === String(j + 1);
                                    return (
                                      <div key={j} className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => updateMc(q.id, { answer: String(j + 1) })}
                                          className="w-7 h-7 rounded-lg text-xs font-bold border-2 shrink-0 transition-all"
                                          style={isAns
                                            ? { background: 'linear-gradient(135deg,#f472b6,#db2777)', color: '#fff', borderColor: '#db2777' }
                                            : { background: '#fff', borderColor: '#e5e7eb', color: '#9ca3af' }}
                                        >
                                          {j + 1}
                                        </button>
                                        <input
                                          type="text"
                                          className={inputCls}
                                          value={(q.options && q.options[j]) ?? ''}
                                          onChange={e => updateMcOption(q.id, j, e.target.value)}
                                          placeholder={`선택지 ${j + 1}`}
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                                <div>
                                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">해설 (선택)</label>
                                  <input
                                    type="text"
                                    className={inputCls}
                                    value={q.explanation ?? ''}
                                    onChange={e => updateMc(q.id, { explanation: e.target.value })}
                                    placeholder="해설"
                                  />
                                </div>
                                <div className="flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() => setMcEditId(null)}
                                    className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white"
                                    style={{ background: 'linear-gradient(135deg,#f472b6,#db2777)' }}
                                  >
                                    완료
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* 4지선다 하단 버튼: 1개 추가 + 입력칸 비우기 */}
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => { const nq = makeQuestion('multiple'); setMcParsed(prev => [...prev, nq]); setMcEditId(nq.id); }}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-colors"
                      style={{ borderColor: '#dbeafe', color: '#1d4ed8' }}
                    >
                      <Plus size={13} /> 4지선다 1개 추가
                    </button>
                    {mcParsed.length > 0 && (
                      <button
                        onClick={() => setClearTarget('multiple')}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-colors"
                        style={{ borderColor: '#fecaca', color: '#dc2626' }}
                      >
                        <Trash2 size={13} /> 입력칸 비우기
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 하단 네비 */}
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-xl border transition-colors"
                style={{ borderColor: '#fce7f3', color: '#db2777' }}
              >
                <ArrowLeft size={14} /> 기본 정보 수정
              </button>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">총 <strong style={{ color: '#db2777' }}>{allQuestions.length}</strong>문항</span>
                <button
                  onClick={() => {
                    if (allQuestions.length === 0) { toast.error('문제를 1개 이상 입력하세요'); return; }
                    setStep(3);
                  }}
                  className="text-sm font-bold text-white px-5 py-2.5 rounded-xl transition-opacity hover:opacity-85"
                  style={{ background: 'linear-gradient(135deg,#f472b6,#db2777)' }}
                >
                  미리보기 →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3: 미리보기 & 게시 ── */}
        {step === 3 && (
          <div className="space-y-4">

            {/* 시험지 요약 카드 */}
            <div className="bg-white border border-pink-100 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: '#fce7f3', color: '#db2777' }}>{grade}</span>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">{subject}</span>
                  </div>
                  <h2 className="text-lg font-black text-gray-800">{title}</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    총 {allQuestions.length}문항 · OX {oxParsed.length}개 / 4지선다 {mcParsed.length}개
                  </p>
                </div>
                <button
                  onClick={() => setStep(2)}
                  className="text-xs font-semibold px-3 py-2 rounded-xl border transition-colors"
                  style={{ borderColor: '#fce7f3', color: '#db2777' }}
                >
                  수정하기
                </button>
              </div>

              {/* 문제 목록 */}
              <div className="space-y-2.5">
                {allQuestions.map((q, i) => (
                  <div key={q.id} className="border border-pink-50 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <span
                        className="shrink-0 text-xs px-2 py-0.5 rounded font-bold mt-0.5"
                        style={
                          q.type === 'ox'
                            ? { background: '#dcfce7', color: '#15803d' }
                            : { background: '#dbeafe', color: '#1d4ed8' }
                        }
                      >
                        {i + 1}
                      </span>
                      <div className="flex-1">
                        <p className="text-gray-800 font-medium text-sm leading-relaxed">
                          {q.text || <span className="text-red-400">⚠ 문제 미입력</span>}
                        </p>
                        {q.type === 'ox' && (
                          <div className="flex gap-2 mt-2">
                            {['O', 'X'].map(v => (
                              <span
                                key={v}
                                className="px-3 py-1 rounded-lg text-sm font-bold border"
                                style={
                                  q.answer === v
                                    ? v === 'O'
                                      ? { background: '#dcfce7', color: '#15803d', borderColor: '#86efac' }
                                      : { background: '#fee2e2', color: '#dc2626', borderColor: '#fca5a5' }
                                    : { background: '#f9fafb', color: '#d1d5db', borderColor: '#e5e7eb' }
                                }
                              >
                                {v}
                              </span>
                            ))}
                          </div>
                        )}
                        {q.type === 'multiple' && q.options && (
                          <div className="grid grid-cols-2 gap-1.5 mt-2">
                            {q.options.map((opt, j) => (
                              <span
                                key={j}
                                className="px-2 py-1.5 rounded-lg text-xs border"
                                style={
                                  q.answer === String(j + 1)
                                    ? { background: '#fce7f3', color: '#db2777', borderColor: '#f9a8d4', fontWeight: 600 }
                                    : { background: '#f9fafb', color: '#6b7280', borderColor: '#e5e7eb' }
                                }
                              >
                                <span className="font-bold mr-1">{j + 1}.</span>{opt || '(미입력)'}
                              </span>
                            ))}
                          </div>
                        )}
                        {q.explanation && (
                          <p className="text-xs text-gray-400 mt-2 italic">💡 {q.explanation}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 시험 백업 카드 (코드펜 대체) */}
            <div
              className="bg-white border-2 border-dashed rounded-2xl p-5"
              style={{ borderColor: '#f9a8d4' }}
            >
              <div className="flex items-start gap-3 mb-3">
                <Save size={20} className="shrink-0 mt-0.5" style={{ color: '#db2777' }} />
                <div className="flex-1">
                  <div className="font-bold text-gray-800 text-sm mb-1">시험 백업 받기</div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    게시한 뒤 아래 버튼을 누르면 <b>등록된 모든 시험</b>이 파일 하나로 내려받아집니다.
                    그 파일을 노션·구글드라이브에 보관해 두세요. (나중에 백업 페이지에서 그대로 복원할 수 있어요)
                  </p>
                </div>
              </div>
              <button
                onClick={downloadTestsBackup}
                className="w-full py-3 text-sm font-bold text-white rounded-xl transition-opacity hover:opacity-85 flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg,#f472b6,#db2777)' }}
              >
                <Save size={16} /> 전체 시험 백업 파일 받기
              </button>
            </div>

            {/* 저장 완료 메시지 */}
            {saved && (
              <div className="rounded-2xl p-4 border flex items-center gap-2" style={{ background: '#fdf2f8', borderColor: '#f9a8d4' }}>
                <CheckCircle size={16} style={{ color: '#db2777' }} />
                <span className="text-sm font-semibold" style={{ color: '#db2777' }}>
                  저장 완료! 학생들이 학년 · 과목으로 바로 찾을 수 있어요.
                </span>
              </div>
            )}

            {/* 최종 버튼 */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleSave(false)}
                disabled={saving}
                className="py-4 text-sm font-bold rounded-2xl border-2 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ borderColor: '#f9a8d4', color: '#db2777' }}
              >
                <Save size={16} /> 임시저장
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={saving}
                className="py-4 text-base font-bold text-white rounded-2xl transition-opacity disabled:opacity-50 hover:opacity-85 flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg,#f472b6,#db2777)' }}
              >
                {saving
                  ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Send size={18} />}
                {saving ? '게시 중...' : '게시하기'}
              </button>
            </div>

            <p className="text-xs text-center text-gray-400 pb-4">
              게시하면 학생들이 학년 · 과목으로 필터링해서 바로 찾을 수 있어요
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

export default function CreateExamPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#fdf2f8' }}>
        <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#f472b6', borderTopColor: 'transparent' }} />
      </div>
    }>
      <CreateExamInner />
    </Suspense>
  );
}
