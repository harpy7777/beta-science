'use client';
// src/app/teacher/create/page.tsx
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { saveExam, updateExam, getExam, Question, QuestionType } from '@/lib/examService';
import {
  FlaskConical, ArrowLeft, ArrowRight, Plus, Trash2,
  CheckCircle, Copy, Eye
} from 'lucide-react';
import toast from 'react-hot-toast';

type Step = 1 | 2 | 3 | 4;

export default function CreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');

  const [step, setStep] = useState<Step>(1);
  const [userId, setUserId] = useState('');
  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedExamId, setSavedExamId] = useState('');
  const [accessCode, setAccessCode] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) { router.push('/teacher'); return; }
      setUserId(u.uid);
    });
    return unsub;
  }, [router]);

  const loadExam = useCallback(async (id: string) => {
    const exam = await getExam(id);
    if (!exam) return;
    setTitle(exam.title);
    setQuestions(exam.questions);
    setSavedExamId(id);
    setAccessCode(exam.accessCode || '');
    setStep(2);
  }, []);

  useEffect(() => {
    if (editId) loadExam(editId);
  }, [editId, loadExam]);

  function addQuestion(type: QuestionType) {
    const newQ: Question = {
      id: Date.now().toString(),
      type,
      text: '',
      answer: type === 'ox' ? 'O' : '1',
      options: type === 'multiple' ? ['', '', '', ''] : undefined,
      explanation: '',
    };
    setQuestions(prev => [...prev, newQ]);
  }

  function updateQuestion(id: string, field: keyof Question, value: unknown) {
    setQuestions(prev =>
      prev.map(q => q.id === id ? { ...q, [field]: value } : q)
    );
  }

  function updateOption(qId: string, idx: number, value: string) {
    setQuestions(prev =>
      prev.map(q => {
        if (q.id !== qId || !q.options) return q;
        const opts = [...q.options];
        opts[idx] = value;
        return { ...q, options: opts };
      })
    );
  }

  function removeQuestion(id: string) {
    setQuestions(prev => prev.filter(q => q.id !== id));
  }

  async function handleSave(publish = false) {
    if (!title.trim()) { toast.error('단원명을 입력하세요'); setStep(1); return; }
    if (questions.length === 0) { toast.error('문제를 1개 이상 추가하세요'); return; }

    for (const q of questions) {
      if (!q.text.trim()) { toast.error('빈 문제 내용이 있어요'); return; }
      if (q.type === 'multiple' && q.options?.some(o => !o.trim())) {
        toast.error('선택지를 모두 입력하세요'); return;
      }
    }

    setSaving(true);
    try {
      const examData = { title, teacherId: userId, questions, isPublished: publish };
      if (savedExamId) {
        await updateExam(savedExamId, examData);
        toast.success(publish ? '시험지 게시 완료!' : '저장 완료!');
      } else {
        const id = await saveExam(examData);
        setSavedExamId(id);
        const saved = await getExam(id);
        setAccessCode(saved?.accessCode || '');
        toast.success(publish ? '시험지 게시 완료!' : '저장 완료!');
      }
      if (publish) setStep(4);
      else setStep(3);
    } catch {
      toast.error('저장 실패. 다시 시도해주세요');
    } finally {
      setSaving(false);
    }
  }

  const stepLabels = ['단원 입력', 'OX 문제', '4지선다', '미리보기'];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-green-100 sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <button onClick={() => router.push('/teacher')} className="btn-ghost -ml-2">
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
              <FlaskConical size={16} className="text-white" />
            </div>
            <span className="font-bold text-green-900">시험지 만들기</span>
          </div>
        </div>
      </header>

      {/* Stepper */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {([1, 2, 3, 4] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className="flex items-center gap-2">
                  <div className={`step-badge ${
                    step === s ? 'step-active' : step > s ? 'step-done' : 'step-idle'
                  }`}>
                    {step > s ? <CheckCircle size={14} /> : s}
                  </div>
                  <span className={`text-sm hidden sm:block ${
                    step === s ? 'font-semibold text-green-700' : 'text-gray-400'
                  }`}>
                    {stepLabels[i]}
                  </span>
                </div>
                {i < 3 && (
                  <div className={`flex-1 h-0.5 mx-2 rounded ${step > s ? 'bg-green-400' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Step 1: 단원명 */}
        {step === 1 && (
          <div className="card p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-xl">📚</div>
              <div>
                <h2 className="font-bold text-gray-800 text-lg">단원 정보 입력</h2>
                <p className="text-sm text-gray-500">테스트의 단원명을 입력해주세요</p>
              </div>
            </div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              단원명 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="input-field text-lg"
              placeholder="예: 1단원: 물질의 구성"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && title.trim() && setStep(2)}
              autoFocus
            />
            <p className="text-xs text-gray-400 mt-2">
              💡 학생들에게 표시될 단원명입니다 (예: 1단원: 물질의 구성, 2단원: 빛과 파동)
            </p>
            <div className="flex justify-end mt-8">
              <button
                onClick={() => { if (!title.trim()) { toast.error('단원명을 입력하세요'); return; } setStep(2); }}
                className="btn-primary"
              >
                다음 단계 <ArrowRight size={16} className="inline ml-1" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: OX 문제 */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="card p-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-bold text-gray-800">문제 추가</h2>
                <span className="text-sm text-gray-400">{title}</span>
              </div>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => addQuestion('ox')}
                  className="btn-secondary flex-1 flex items-center justify-center gap-2"
                >
                  <span className="text-lg font-black text-green-600">OX</span>
                  OX 문제 추가
                </button>
                <button
                  onClick={() => addQuestion('multiple')}
                  className="btn-secondary flex-1 flex items-center justify-center gap-2"
                >
                  <span className="text-lg font-black text-blue-600">①</span>
                  4지선다 추가
                </button>
              </div>
            </div>

            {questions.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <div className="text-5xl mb-3">📝</div>
                <p>위 버튼으로 문제를 추가하세요</p>
              </div>
            )}

            {questions.map((q, idx) => (
              <div key={q.id} className="card p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-xs font-bold text-green-700">
                      {idx + 1}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      q.type === 'ox'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {q.type === 'ox' ? 'OX 문제' : '4지선다'}
                    </span>
                  </div>
                  <button onClick={() => removeQuestion(q.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* 문제 텍스트 */}
                <textarea
                  className="input-field mb-4 resize-none"
                  rows={2}
                  placeholder="문제를 입력하세요"
                  value={q.text}
                  onChange={e => updateQuestion(q.id, 'text', e.target.value)}
                />

                {/* OX 정답 */}
                {q.type === 'ox' && (
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-2 block">정답 선택</label>
                    <div className="flex gap-3">
                      {(['O', 'X'] as const).map(v => (
                        <button
                          key={v}
                          onClick={() => updateQuestion(q.id, 'answer', v)}
                          className={`ox-btn ${v === 'O' ? 'ox-btn-o' : 'ox-btn-x'} ${q.answer === v ? 'selected' : ''}`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4지선다 선택지 + 정답 */}
                {q.type === 'multiple' && q.options && (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 block">선택지 입력 (정답 번호도 선택)</label>
                    {q.options.map((opt, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuestion(q.id, 'answer', String(i + 1))}
                          className={`w-8 h-8 rounded-full text-sm font-bold border-2 shrink-0 transition-all ${
                            q.answer === String(i + 1)
                              ? 'bg-green-500 text-white border-green-500'
                              : 'border-gray-300 text-gray-400 hover:border-green-400'
                          }`}
                        >
                          {i + 1}
                        </button>
                        <input
                          type="text"
                          className="input-field py-2"
                          placeholder={`선택지 ${i + 1}`}
                          value={opt}
                          onChange={e => updateOption(q.id, i, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* 해설 (선택) */}
                <div className="mt-4">
                  <input
                    type="text"
                    className="input-field py-2 text-sm"
                    placeholder="해설 (선택사항) — 정답 후 학생에게 표시됩니다"
                    value={q.explanation || ''}
                    onChange={e => updateQuestion(q.id, 'explanation', e.target.value)}
                  />
                </div>
              </div>
            ))}

            {questions.length > 0 && (
              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep(1)} className="btn-secondary">
                  <ArrowLeft size={16} className="inline mr-1" /> 이전
                </button>
                <button onClick={() => handleSave(false)} disabled={saving} className="btn-secondary flex-1">
                  {saving ? '저장 중...' : '임시 저장'}
                </button>
                <button onClick={() => handleSave(true)} disabled={saving} className="btn-primary flex-1">
                  {saving ? '게시 중...' : '게시하기 🚀'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 3: 미리보기 (저장됨) */}
        {(step === 3 || step === 4) && (
          <div className="card p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-green-600" />
            </div>
            <h2 className="text-xl font-black text-gray-800 mb-2">
              {step === 4 ? '시험지 게시 완료! 🎉' : '저장 완료!'}
            </h2>
            <p className="text-gray-500 mb-6">{title}</p>

            {step === 4 && accessCode && (
              <div className="bg-green-50 rounded-2xl p-6 mb-6">
                <p className="text-sm text-green-700 mb-2 font-medium">학생 접속 코드</p>
                <div className="flex items-center justify-center gap-3">
                  <span className="text-4xl font-black font-mono text-green-700 tracking-widest">
                    {accessCode}
                  </span>
                  <button
                    onClick={() => { navigator.clipboard.writeText(accessCode); toast.success('코드 복사됨!'); }}
                    className="p-2 hover:bg-green-100 rounded-lg transition-colors"
                  >
                    <Copy size={20} className="text-green-600" />
                  </button>
                </div>
                <p className="text-xs text-green-500 mt-2">이 코드를 학생들에게 알려주세요</p>
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <button onClick={() => router.push(`/student/${savedExamId}?preview=1`)} className="btn-secondary flex items-center gap-2">
                <Eye size={16} />
                미리보기
              </button>
              <button onClick={() => router.push('/teacher')} className="btn-primary">
                대시보드로 이동
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Bottom action bar (step 2) */}
      {step === 2 && questions.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-green-100 p-4 md:hidden">
          <div className="flex gap-3 max-w-3xl mx-auto">
            <button onClick={() => handleSave(false)} disabled={saving} className="btn-secondary flex-1 text-sm">
              임시 저장
            </button>
            <button onClick={() => handleSave(true)} disabled={saving} className="btn-primary flex-1 text-sm">
              게시하기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
