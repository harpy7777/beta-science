'use client';
// src/app/teacher/create/page.tsx
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import {
  saveExam, updateExam, getExam,
  Question, QuestionType
} from '@/lib/examService';
import {
  FlaskConical, ArrowLeft, Plus, Trash2,
  ChevronDown, ChevronUp, Eye, Send, Save,
  CheckCircle, GripVertical
} from 'lucide-react';
import toast from 'react-hot-toast';

// ─── 타입 ──────────────────────────────────────────────────────────────────
type Step = 1 | 2 | 3;

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

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────────────
function CreateExamInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [step, setStep] = useState<Step>(1);
  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState<Question[]>([makeQuestion('ox')]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // ── 인증 + 수정 모드 로드 ──────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push('/teacher'); return; }
      setUser(u);
      setAuthLoading(false);

      if (editId) {
        const exam = await getExam(editId);
        if (exam) {
          setTitle(exam.title);
          setQuestions(exam.questions);
          setStep(2);
        }
      }
    });
    return unsub;
  }, [editId, router]);

  // ── 문제 조작 ──────────────────────────────────────────────────────────
  const addQuestion = useCallback((type: QuestionType) => {
    const q = makeQuestion(type);
    setQuestions(prev => [...prev, q]);
    setActiveIdx(questions.length);
  }, [questions.length]);

  const removeQuestion = useCallback((idx: number) => {
    if (questions.length <= 1) { toast.error('문제는 최소 1개 필요해요'); return; }
    setQuestions(prev => prev.filter((_, i) => i !== idx));
    setActiveIdx(prev => Math.min(prev, questions.length - 2));
  }, [questions.length]);

  const updateQuestion = useCallback((idx: number, patch: Partial<Question>) => {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, ...patch } : q));
  }, []);

  const updateOption = useCallback((qIdx: number, optIdx: number, value: string) => {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== qIdx) return q;
      const opts = [...(q.options ?? ['', '', '', ''])];
      opts[optIdx] = value;
      return { ...q, options: opts };
    }));
  }, []);

  const moveQuestion = useCallback((idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= questions.length) return;
    setQuestions(prev => {
      const arr = [...prev];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr;
    });
    setActiveIdx(newIdx);
  }, [questions.length]);

  // ── 저장/게시 ──────────────────────────────────────────────────────────
  async function handleSave(publish: boolean) {
    if (!title.trim()) { toast.error('단원명을 입력하세요'); setStep(1); return; }

    const invalid = questions.find(q => {
      if (!q.text.trim()) return true;
      if (q.type === 'multiple' && q.options?.some(o => !o.trim())) return true;
      return false;
    });
    if (invalid) { toast.error('모든 문제와 보기를 입력해주세요'); return; }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        teacherId: user!.uid,
        questions,
        isPublished: publish,
      };

      if (editId) {
        await updateExam(editId, payload);
        toast.success(publish ? '게시되었습니다!' : '저장되었습니다!');
      } else {
        await saveExam(payload);
        toast.success(publish ? '시험지가 게시되었습니다!' : '임시 저장됨');
      }

      setSaved(true);
      setTimeout(() => router.push('/teacher'), 1200);
    } catch (e) {
      console.error(e);
      toast.error('저장에 실패했습니다');
    } finally {
      setSaving(false);
    }
  }

  // ── 로딩 ──────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const q = questions[activeIdx];

  // ══════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── 헤더 ── */}
      <header className="bg-white border-b border-green-100 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/teacher')}
              className="btn-ghost -ml-2 text-gray-500"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
              <FlaskConical size={16} className="text-white" />
            </div>
            <div>
              <div className="font-bold text-green-900 text-sm">
                {editId ? '시험지 수정' : '시험지 만들기'}
              </div>
              <div className="text-xs text-green-600">{title || '단원명 미입력'}</div>
            </div>
          </div>

          {/* 스텝 인디케이터 */}
          <div className="hidden sm:flex items-center gap-2">
            {([1, 2, 3] as Step[]).map(s => (
              <button
                key={s}
                onClick={() => {
                  if (s === 2 && !title.trim()) { toast.error('단원명을 먼저 입력하세요'); return; }
                  if (s === 3 && questions.length === 0) return;
                  setStep(s);
                }}
                className={`step-badge ${
                  step === s ? 'step-active' :
                  step > s ? 'step-done' :
                  'step-idle'
                }`}
              >
                {step > s ? '✓' : s}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="btn-secondary text-sm flex items-center gap-1.5"
            >
              <Save size={15} />
              임시저장
            </button>
            <button
              onClick={() => {
                if (step < 3) { setStep(3); return; }
                handleSave(true);
              }}
              disabled={saving}
              className="btn-primary text-sm flex items-center gap-1.5"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : saved ? (
                <CheckCircle size={15} />
              ) : step < 3 ? (
                <Eye size={15} />
              ) : (
                <Send size={15} />
              )}
              {saving ? '저장 중...' : saved ? '완료!' : step < 3 ? '미리보기' : '게시하기'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* ── STEP 1: 단원명 ── */}
        {step === 1 && (
          <div className="max-w-lg mx-auto">
            <div className="card p-8">
              <div className="mb-6">
                <div className="step-badge step-active w-10 h-10 text-base mb-4">1</div>
                <h2 className="text-xl font-black text-gray-800 mb-1">단원명 입력</h2>
                <p className="text-sm text-gray-400">시험지 제목을 입력하세요</p>
              </div>
              <input
                type="text"
                className="input-field text-lg font-semibold"
                placeholder="예: 1단원 · 물질의 구성"
                value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && title.trim()) setStep(2);
                }}
                autoFocus
              />
              <button
                onClick={() => {
                  if (!title.trim()) { toast.error('단원명을 입력하세요'); return; }
                  setStep(2);
                }}
                className="btn-primary w-full mt-6"
              >
                다음: 문제 추가 →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: 문제 편집 ── */}
        {step === 2 && (
          <div className="grid grid-cols-12 gap-6">
            {/* 좌측: 문제 목록 */}
            <div className="col-span-12 md:col-span-4">
              <div className="card p-4 sticky top-24">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-gray-700 text-sm">문제 목록</h3>
                  <span className="text-xs text-gray-400">{questions.length}문항</span>
                </div>

                <div className="space-y-1.5 mb-4 max-h-[50vh] overflow-y-auto pr-1">
                  {questions.map((q, i) => (
                    <button
                      key={q.id}
                      onClick={() => setActiveIdx(i)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all flex items-center gap-2 ${
                        i === activeIdx
                          ? 'bg-green-600 text-white'
                          : 'hover:bg-gray-50 text-gray-600 border border-gray-100'
                      }`}
                    >
                      <GripVertical size={13} className="shrink-0 opacity-40" />
                      <span className={`text-xs px-1.5 py-0.5 rounded font-bold shrink-0 ${
                        i === activeIdx ? 'bg-green-500 text-white' :
                        q.type === 'ox' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {q.type === 'ox' ? 'OX' : '객'}
                      </span>
                      <span className="truncate">
                        {q.text ? (q.text.length > 20 ? q.text.slice(0, 20) + '…' : q.text) : `문제 ${i + 1}`}
                      </span>
                      {!q.text && (
                        <span className="ml-auto text-xs opacity-60">미입력</span>
                      )}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => addQuestion('ox')}
                    className="btn-secondary text-xs py-2 flex items-center justify-center gap-1"
                  >
                    <Plus size={13} />
                    OX 추가
                  </button>
                  <button
                    onClick={() => addQuestion('multiple')}
                    className="btn-secondary text-xs py-2 flex items-center justify-center gap-1"
                  >
                    <Plus size={13} />
                    객관식 추가
                  </button>
                </div>
              </div>
            </div>

            {/* 우측: 문제 편집 */}
            <div className="col-span-12 md:col-span-8">
              {q && (
                <div className="card p-6">
                  {/* 편집 헤더 */}
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                        q.type === 'ox' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {q.type === 'ox' ? 'OX 문제' : '4지선다'}
                      </span>
                      <span className="text-sm text-gray-400">문제 {activeIdx + 1}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => moveQuestion(activeIdx, -1)}
                        disabled={activeIdx === 0}
                        className="btn-ghost p-1.5 disabled:opacity-30"
                        title="위로"
                      >
                        <ChevronUp size={15} />
                      </button>
                      <button
                        onClick={() => moveQuestion(activeIdx, 1)}
                        disabled={activeIdx === questions.length - 1}
                        className="btn-ghost p-1.5 disabled:opacity-30"
                        title="아래로"
                      >
                        <ChevronDown size={15} />
                      </button>
                      <button
                        onClick={() => removeQuestion(activeIdx)}
                        className="btn-ghost p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50"
                        title="삭제"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* 문제 텍스트 */}
                  <div className="mb-5">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      문제 내용
                    </label>
                    <textarea
                      className="input-field resize-none"
                      rows={3}
                      placeholder="문제를 입력하세요..."
                      value={q.text}
                      onChange={e => updateQuestion(activeIdx, { text: e.target.value })}
                    />
                  </div>

                  {/* OX 정답 선택 */}
                  {q.type === 'ox' && (
                    <div className="mb-5">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">정답</label>
                      <div className="flex gap-3">
                        {(['O', 'X'] as const).map(v => (
                          <button
                            key={v}
                            onClick={() => updateQuestion(activeIdx, { answer: v })}
                            className={`flex-1 py-4 rounded-xl text-3xl font-black border-2 transition-all ${
                              q.answer === v
                                ? v === 'O'
                                  ? 'bg-green-500 text-white border-green-500'
                                  : 'bg-red-500 text-white border-red-500'
                                : v === 'O'
                                  ? 'border-green-300 text-green-500 hover:bg-green-50'
                                  : 'border-red-300 text-red-400 hover:bg-red-50'
                            }`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 4지선다 보기 */}
                  {q.type === 'multiple' && q.options && (
                    <div className="mb-5">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        보기 입력 및 정답 선택
                      </label>
                      <div className="space-y-2">
                        {q.options.map((opt, i) => (
                          <div key={i} className="flex gap-2 items-center">
                            <button
                              onClick={() => updateQuestion(activeIdx, { answer: String(i + 1) })}
                              className={`w-8 h-8 shrink-0 rounded-full text-sm font-bold border-2 transition-all ${
                                q.answer === String(i + 1)
                                  ? 'bg-green-600 text-white border-green-600'
                                  : 'border-gray-200 text-gray-400 hover:border-green-400'
                              }`}
                            >
                              {i + 1}
                            </button>
                            <input
                              type="text"
                              className={`input-field transition-all ${
                                q.answer === String(i + 1) ? 'border-green-400 ring-1 ring-green-300' : ''
                              }`}
                              placeholder={`보기 ${i + 1}`}
                              value={opt}
                              onChange={e => updateOption(activeIdx, i, e.target.value)}
                            />
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        번호를 클릭하면 정답으로 설정됩니다 (현재 정답: {q.answer}번)
                      </p>
                    </div>
                  )}

                  {/* 해설 */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      해설 <span className="text-gray-400 font-normal">(선택)</span>
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="정답 해설을 입력하면 학생에게 보여져요"
                      value={q.explanation ?? ''}
                      onChange={e => updateQuestion(activeIdx, { explanation: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {/* 하단 네비게이션 */}
              <div className="flex justify-between mt-4">
                <button
                  onClick={() => setStep(1)}
                  className="btn-ghost text-sm"
                >
                  ← 단원명 수정
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="btn-primary text-sm"
                >
                  미리보기 →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3: 미리보기 & 게시 ── */}
        {step === 3 && (
          <div className="max-w-2xl mx-auto">
            <div className="card p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-black text-gray-800">{title}</h2>
                  <p className="text-sm text-gray-400 mt-0.5">
                    총 {questions.length}문항 ·
                    OX {questions.filter(q => q.type === 'ox').length}개 /
                    4지선다 {questions.filter(q => q.type === 'multiple').length}개
                  </p>
                </div>
                <button
                  onClick={() => setStep(2)}
                  className="btn-secondary text-sm"
                >
                  수정하기
                </button>
              </div>

              {/* 문제 미리보기 */}
              <div className="space-y-4">
                {questions.map((q, i) => (
                  <div
                    key={q.id}
                    className="border border-gray-100 rounded-xl p-4 hover:border-green-200 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <span className={`shrink-0 text-xs px-2 py-0.5 rounded font-bold mt-0.5 ${
                        q.type === 'ox' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {i + 1}
                      </span>
                      <div className="flex-1">
                        <p className="text-gray-800 font-medium text-sm leading-relaxed">
                          {q.text || <span className="text-red-400">⚠ 문제 미입력</span>}
                        </p>

                        {q.type === 'ox' && (
                          <div className="flex gap-2 mt-2">
                            {['O', 'X'].map(v => (
                              <span key={v} className={`px-3 py-1 rounded-lg text-sm font-bold border ${
                                q.answer === v
                                  ? v === 'O' ? 'bg-green-100 text-green-700 border-green-300' : 'bg-red-100 text-red-600 border-red-300'
                                  : 'bg-gray-50 text-gray-300 border-gray-200'
                              }`}>{v}</span>
                            ))}
                          </div>
                        )}

                        {q.type === 'multiple' && q.options && (
                          <div className="grid grid-cols-2 gap-1.5 mt-2">
                            {q.options.map((opt, j) => (
                              <span key={j} className={`px-2 py-1.5 rounded-lg text-xs border ${
                                q.answer === String(j + 1)
                                  ? 'bg-green-100 text-green-700 border-green-300 font-semibold'
                                  : 'bg-gray-50 text-gray-500 border-gray-200'
                              }`}>
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

            {/* 게시 버튼 */}
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleSave(false)}
                disabled={saving}
                className="btn-secondary py-4 text-base flex items-center justify-center gap-2"
              >
                <Save size={18} />
                임시저장
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={saving}
                className="btn-primary py-4 text-base flex items-center justify-center gap-2"
              >
                {saving ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send size={18} />
                )}
                {saving ? '게시 중...' : '게시하기'}
              </button>
            </div>
            <p className="text-xs text-center text-gray-400 mt-3">
              게시하면 학생들이 접속 코드로 바로 응시할 수 있어요
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
// Suspense wrapper
export default function CreateExamPage() {
  return <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" /></div>}><CreateExamInner /></Suspense>;
}
