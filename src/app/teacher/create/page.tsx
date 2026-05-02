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
  Eye, Send, Save, CheckCircle, FileText,
  ExternalLink, ChevronDown, ChevronUp
} from 'lucide-react';
import toast from 'react-hot-toast';

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

// ── 일괄 파싱 ──────────────────────────────────────────────────────────────
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
    results.push({
      id: makeId(),
      type: 'ox',
      text,
      answer: ans,
      explanation: get('해설:'),
    });
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
    const c1 = get('선택지1:');
    const c2 = get('선택지2:');
    const c3 = get('선택지3:');
    const c4 = get('선택지4:');
    const ansText = get('정답:');
    // 정답이 텍스트면 번호로 변환
    const opts = [c1, c2, c3, c4];
    const ansIdx = opts.findIndex(o => o === ansText);
    const answer = ansIdx >= 0 ? String(ansIdx + 1) : (ansText || '1');
    results.push({
      id: makeId(),
      type: 'multiple',
      text,
      options: [c1, c2, c3, c4],
      answer,
      explanation: get('해설:'),
    });
  }
  return results;
}

// ── CodePen HTML 생성 ──────────────────────────────────────────────────────
function generateQuizHTML(title: string, questions: Question[]): string {
  const allQ = questions.map(q => ({
    id: q.id,
    type: q.type,
    text: q.text,
    choices: q.type === 'multiple' ? q.options : undefined,
    answer: q.answer,
    explanation: q.explanation || '',
  }));
  const dataJson = JSON.stringify(allQ);

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Noto Sans KR',-apple-system,sans-serif;background:#f0fdf4;min-height:100vh}
.header{background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;padding:1.25rem 1rem;text-align:center}
.header h1{font-size:20px;font-weight:700}
.header p{font-size:13px;opacity:.8;margin-top:3px}
.wrap{max-width:680px;margin:0 auto;padding:1.5rem 1rem}
.progress-bar{background:#dcfce7;border-radius:10px;height:8px;margin-bottom:1.5rem;overflow:hidden}
.progress-fill{height:100%;background:#16a34a;border-radius:10px;transition:.3s}
.card{background:#fff;border-radius:16px;padding:1.5rem;box-shadow:0 2px 12px rgba(0,0,0,.07)}
.q-counter{font-size:13px;color:#6b7280;margin-bottom:.75rem}
.q-type{display:inline-block;font-size:11px;font-weight:700;padding:2px 10px;border-radius:20px;margin-bottom:.75rem}
.q-type.ox{background:#dcfce7;color:#15803d}
.q-type.mc{background:#dbeafe;color:#1d4ed8}
.q-text{font-size:16px;font-weight:600;line-height:1.6;color:#1f2937;margin-bottom:1.25rem}
.ox-row{display:flex;gap:12px}
.ox-btn{flex:1;padding:16px;border-radius:12px;border:2px solid #e5e7eb;font-size:22px;font-weight:800;cursor:pointer;background:#fff;transition:.15s}
.ox-btn.O{color:#16a34a;border-color:#86efac}
.ox-btn.O:hover{background:#f0fdf4}
.ox-btn.X{color:#dc2626;border-color:#fca5a5}
.ox-btn.X:hover{background:#fef2f2}
.ox-btn:disabled{opacity:.5;cursor:default}
.mc-list{display:flex;flex-direction:column;gap:8px}
.mc-opt{padding:12px 16px;border-radius:10px;border:2px solid #e5e7eb;font-size:14px;cursor:pointer;background:#fff;text-align:left;transition:.15s;display:flex;align-items:center;gap:10px}
.mc-opt:hover:not(:disabled){border-color:#16a34a;background:#f0fdf4}
.mc-opt:disabled{cursor:default;opacity:.7}
.mc-opt .num{font-weight:700;color:#16a34a;min-width:22px;font-size:15px}
.feedback{margin-top:1rem;padding:12px 16px;border-radius:10px;font-size:14px;line-height:1.6;display:none}
.feedback.ok{background:#dcfce7;color:#14532d;border:1.5px solid #86efac}
.feedback.ng{background:#fee2e2;color:#7f1d1d;border:1.5px solid #fca5a5}
.nav{display:flex;justify-content:space-between;align-items:center;margin-top:1.25rem}
.btn{padding:10px 22px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;border:none;font-family:inherit}
.btn-next{background:#16a34a;color:#fff}.btn-next:hover{background:#15803d}
.btn-prev{background:#f3f4f6;color:#374151}.btn-prev:hover{background:#e5e7eb}
.score-card{background:#fff;border-radius:20px;padding:2.5rem 2rem;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,.08)}
.score-big{font-size:64px;font-weight:800;color:#16a34a;line-height:1}
.score-denom{font-size:24px;color:#9ca3af}
.score-msg{font-size:17px;color:#374151;margin-top:.75rem;font-weight:600}
.score-pct{font-size:14px;color:#6b7280;margin-top:.25rem}
.btn-restart{margin-top:1.5rem;padding:12px 36px;background:#16a34a;color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit}
.btn-restart:hover{background:#15803d}
</style>
</head>
<body>
<div class="header">
  <h1>${title}</h1>
  <p>베타과학학원</p>
</div>
<div class="wrap" id="app"></div>
<script>
const QS = ${dataJson};
let cur = 0, score = 0;
const qs = [...QS].sort(() => Math.random() - 0.5);
const app = document.getElementById('app');
const NUMS = ['①','②','③','④'];

function render() {
  if (cur >= qs.length) { showScore(); return; }
  const q = qs[cur];
  const pct = Math.round((cur / qs.length) * 100);
  let html = '<div class="progress-bar"><div class="progress-fill" style="width:' + pct + '%"></div></div>';
  html += '<div class="card">';
  html += '<div class="q-counter">' + (cur+1) + ' / ' + qs.length + '</div>';
  html += '<div class="q-type ' + (q.type==='ox'?'ox':'mc') + '">' + (q.type==='ox'?'OX 문제':'4지선다') + '</div>';
  html += '<div class="q-text">' + q.text + '</div>';
  if (q.type === 'ox') {
    html += '<div class="ox-row">';
    html += '<button class="ox-btn O" onclick="answerOX(\'O\')">O</button>';
    html += '<button class="ox-btn X" onclick="answerOX(\'X\')">X</button>';
    html += '</div>';
  } else {
    html += '<div class="mc-list">';
    (q.choices||[]).forEach((c,i) => {
      html += '<button class="mc-opt" onclick="answerMC(\'' + (i+1) + '\')">'
           + '<span class="num">' + NUMS[i] + '</span>' + c + '</button>';
    });
    html += '</div>';
  }
  html += '<div class="feedback" id="fb"></div>';
  html += '</div>';
  html += '<div class="nav">';
  if (cur > 0) html += '<button class="btn btn-prev" onclick="prev()">← 이전</button>';
  else html += '<span></span>';
  html += '<button class="btn btn-next" id="nb" style="display:none" onclick="next()">다음 →</button>';
  html += '</div>';
  app.innerHTML = html;
}

function showFeedback(ok) {
  const q = qs[cur];
  const fb = document.getElementById('fb');
  fb.className = 'feedback ' + (ok ? 'ok' : 'ng');
  fb.style.display = 'block';
  fb.innerHTML = (ok ? '✅ 정답입니다!' : '❌ 오답! 정답: <b>' + (q.type==='ox'?q.answer: (NUMS[parseInt(q.answer)-1]||q.answer)) + '</b>')
    + (q.explanation ? '<br>💡 ' + q.explanation : '');
  document.querySelectorAll('.ox-btn,.mc-opt').forEach(b => b.disabled = true);
  const nb = document.getElementById('nb');
  if (nb) nb.style.display = 'block';
}

function answerOX(a) {
  const ok = a === qs[cur].answer;
  if (ok) score++;
  showFeedback(ok);
}
function answerMC(a) {
  const ok = a === qs[cur].answer;
  if (ok) score++;
  showFeedback(ok);
}
function next() { cur++; render(); }
function prev() { if (cur > 0) { cur--; render(); } }

function showScore() {
  const pct = Math.round((score / qs.length) * 100);
  const msg = pct===100?'완벽합니다! 🎉':pct>=80?'훌륭해요! 👏':pct>=60?'잘 했어요! 😊':'조금 더 노력해봐요 💪';
  app.innerHTML = '<div class="score-card">'
    + '<div class="score-big">' + score + '<span class="score-denom"> / ' + qs.length + '</span></div>'
    + '<div class="score-msg">' + msg + '</div>'
    + '<div class="score-pct">정답률 ' + pct + '%</div>'
    + '<button class="btn-restart" onclick="restart()">다시 풀기</button>'
    + '</div>';
}
function restart() { cur=0; score=0; qs.sort(()=>Math.random()-.5); render(); }
render();
<\/script>
</body>
</html>`;
}

// ══════════════════════════════════════════════════════════════════════════
function CreateExamInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [step, setStep] = useState<Step>(1);
  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedExamId, setSavedExamId] = useState<string | null>(null);

  // 일괄 입력 UI 상태
  const [oxBulk, setOxBulk] = useState('');
  const [mcBulk, setMcBulk] = useState('');
  const [oxOpen, setOxOpen] = useState(true);
  const [mcOpen, setMcOpen] = useState(true);
  const [oxParsed, setOxParsed] = useState<Question[]>([]);
  const [mcParsed, setMcParsed] = useState<Question[]>([]);

  // ── 인증 + 수정 모드 ────────────────────────────────────────────────────
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
          // 기존 문제를 파싱된 상태로 복원
          setOxParsed(exam.questions.filter(q => q.type === 'ox'));
          setMcParsed(exam.questions.filter(q => q.type === 'multiple'));
          setStep(2);
        }
      }
    });
    return unsub;
  }, [editId, router]);

  // ── 일괄 파싱 핸들러 ────────────────────────────────────────────────────
  const handleOxParse = useCallback(() => {
    const parsed = parseOXBulk(oxBulk);
    if (parsed.length === 0) { toast.error('형식을 확인해주세요'); return; }
    setOxParsed(parsed);
    toast.success(`OX 문제 ${parsed.length}개 불러옴`);
  }, [oxBulk]);

  const handleMcParse = useCallback(() => {
    const parsed = parseMCBulk(mcBulk);
    if (parsed.length === 0) { toast.error('형식을 확인해주세요'); return; }
    setMcParsed(parsed);
    toast.success(`4지선다 ${parsed.length}개 불러옴`);
  }, [mcBulk]);

  const allQuestions = [...oxParsed, ...mcParsed];

  // ── 저장/게시 ────────────────────────────────────────────────────────────
  async function handleSave(publish: boolean) {
    if (!title.trim()) { toast.error('단원명을 입력하세요'); setStep(1); return; }
    if (allQuestions.length === 0) { toast.error('문제를 1개 이상 입력하세요'); return; }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        teacherId: user!.uid,
        questions: allQuestions,
        isPublished: publish,
      };
      let id: string;
      if (editId) {
        await updateExam(editId, payload);
        id = editId;
        toast.success(publish ? '게시되었습니다!' : '저장되었습니다!');
      } else {
        id = await saveExam(payload);
        toast.success(publish ? '시험지가 게시되었습니다!' : '임시 저장됨');
      }
      setSavedExamId(id);
      setSaved(true);
    } catch (e) {
      console.error(e);
      toast.error('저장에 실패했습니다');
    } finally {
      setSaving(false);
    }
  }

  // ── CodePen 열기 ─────────────────────────────────────────────────────────
  function openCodePen() {
    if (allQuestions.length === 0) { toast.error('문제가 없습니다'); return; }
    const html = generateQuizHTML(title || '온라인 테스트', allQuestions);
    const data = JSON.stringify({ html, css: '', js: '' });
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = 'https://codepen.io/pen/define';
    form.target = '_blank';
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'data';
    input.value = data;
    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── 헤더 ── */}
      <header className="bg-white border-b border-green-100 sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/teacher')} className="btn-ghost -ml-2 text-gray-500">
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

          {/* 스텝 */}
          <div className="hidden sm:flex items-center gap-2">
            {([1, 2, 3] as Step[]).map(s => (
              <button
                key={s}
                onClick={() => {
                  if (s === 2 && !title.trim()) { toast.error('단원명을 먼저 입력하세요'); return; }
                  setStep(s);
                }}
                className={`step-badge ${step === s ? 'step-active' : step > s ? 'step-done' : 'step-idle'}`}
              >
                {step > s ? '✓' : s}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <button onClick={() => handleSave(false)} disabled={saving} className="btn-secondary text-sm flex items-center gap-1.5">
              <Save size={15} /> 임시저장
            </button>
            <button
              onClick={() => { if (step < 3) { setStep(3); return; } handleSave(true); }}
              disabled={saving}
              className="btn-primary text-sm flex items-center gap-1.5"
            >
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : saved ? <CheckCircle size={15} />
                : step < 3 ? <Eye size={15} />
                : <Send size={15} />}
              {saving ? '저장 중...' : saved ? '완료!' : step < 3 ? '미리보기' : '게시하기'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">

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
                onKeyDown={e => { if (e.key === 'Enter' && title.trim()) setStep(2); }}
                autoFocus
              />
              <button
                onClick={() => { if (!title.trim()) { toast.error('단원명을 입력하세요'); return; } setStep(2); }}
                className="btn-primary w-full mt-6"
              >
                다음: 문제 추가 →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: 일괄 입력 ── */}
        {step === 2 && (
          <div className="space-y-5">

            {/* OX 문제 입력 */}
            <div className="card p-0 overflow-hidden">
              <button
                onClick={() => setOxOpen(o => !o)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">OX 문제</span>
                  <span className="font-bold text-gray-800">OX 일괄 입력</span>
                  {oxParsed.length > 0 && (
                    <span className="text-xs text-green-600 font-semibold">✓ {oxParsed.length}개 로드됨</span>
                  )}
                </div>
                {oxOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </button>

              {oxOpen && (
                <div className="px-5 pb-5 border-t border-gray-100">
                  {/* 형식 안내 */}
                  <div className="bg-green-50 rounded-xl p-3 my-4 text-xs text-green-800 leading-relaxed">
                    <strong>입력 형식</strong> (문제 사이 빈 줄 구분)<br />
                    <code className="block mt-1 bg-white rounded p-2 text-green-900 whitespace-pre">{`문제: 물은 H2O로 표현된다.
정답: O
해설: 물 분자는 수소 2개, 산소 1개입니다.

문제: 지구는 태양계의 중심이다.
정답: X
해설: 태양이 중심입니다.`}</code>
                  </div>

                  <textarea
                    className="input-field resize-none font-mono text-sm"
                    rows={8}
                    placeholder={`문제: \n정답: O\n해설: \n\n문제: \n정답: X\n해설: `}
                    value={oxBulk}
                    onChange={e => setOxBulk(e.target.value)}
                  />
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-gray-400">
                      {oxBulk.trim().split(/\n\s*\n/).filter(b => b.includes('문제:')).length}개 감지됨
                    </span>
                    <button onClick={handleOxParse} className="btn-primary text-sm px-4 py-2">
                      가져오기 →
                    </button>
                  </div>

                  {/* 파싱된 문제 미리보기 */}
                  {oxParsed.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">로드된 OX 문제 ({oxParsed.length}개)</div>
                      {oxParsed.map((q, i) => (
                        <div key={q.id} className="flex items-start gap-3 bg-gray-50 rounded-lg px-3 py-2">
                          <span className="text-xs text-gray-400 mt-0.5 shrink-0">Q{i+1}</span>
                          <span className="flex-1 text-sm text-gray-700 line-clamp-1">{q.text}</span>
                          <span className={`text-sm font-bold shrink-0 ${q.answer === 'O' ? 'text-green-600' : 'text-red-500'}`}>{q.answer}</span>
                          <button onClick={() => setOxParsed(prev => prev.filter((_, idx) => idx !== i))} className="text-gray-300 hover:text-red-400 shrink-0">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 개별 추가 버튼 */}
                  <button
                    onClick={() => setOxParsed(prev => [...prev, makeQuestion('ox')])}
                    className="btn-secondary text-xs mt-3 flex items-center gap-1"
                  >
                    <Plus size={13} /> OX 문제 1개 추가
                  </button>
                </div>
              )}
            </div>

            {/* 4지선다 입력 */}
            <div className="card p-0 overflow-hidden">
              <button
                onClick={() => setMcOpen(o => !o)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">4지선다</span>
                  <span className="font-bold text-gray-800">4지선다 일괄 입력</span>
                  {mcParsed.length > 0 && (
                    <span className="text-xs text-blue-600 font-semibold">✓ {mcParsed.length}개 로드됨</span>
                  )}
                </div>
                {mcOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </button>

              {mcOpen && (
                <div className="px-5 pb-5 border-t border-gray-100">
                  <div className="bg-blue-50 rounded-xl p-3 my-4 text-xs text-blue-800 leading-relaxed">
                    <strong>입력 형식</strong> (문제 사이 빈 줄 구분)<br />
                    <code className="block mt-1 bg-white rounded p-2 text-blue-900 whitespace-pre">{`문제: 광합성을 하는 세포 소기관은?
선택지1: 미토콘드리아
선택지2: 엽록체
선택지3: 리보솜
선택지4: 골지체
정답: 엽록체
해설: 엽록체는 광합성을 담당합니다.`}</code>
                  </div>

                  <textarea
                    className="input-field resize-none font-mono text-sm"
                    rows={10}
                    placeholder={`문제: \n선택지1: \n선택지2: \n선택지3: \n선택지4: \n정답: \n해설: `}
                    value={mcBulk}
                    onChange={e => setMcBulk(e.target.value)}
                  />
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-gray-400">
                      {mcBulk.trim().split(/\n\s*\n/).filter(b => b.includes('문제:')).length}개 감지됨
                    </span>
                    <button onClick={handleMcParse} className="btn-primary text-sm px-4 py-2">
                      가져오기 →
                    </button>
                  </div>

                  {mcParsed.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">로드된 4지선다 ({mcParsed.length}개)</div>
                      {mcParsed.map((q, i) => (
                        <div key={q.id} className="flex items-start gap-3 bg-gray-50 rounded-lg px-3 py-2">
                          <span className="text-xs text-gray-400 mt-0.5 shrink-0">Q{i+1}</span>
                          <span className="flex-1 text-sm text-gray-700 line-clamp-1">{q.text}</span>
                          <span className="text-xs text-blue-600 font-semibold shrink-0">{q.answer}번</span>
                          <button onClick={() => setMcParsed(prev => prev.filter((_, idx) => idx !== i))} className="text-gray-300 hover:text-red-400 shrink-0">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => setMcParsed(prev => [...prev, makeQuestion('multiple')])}
                    className="btn-secondary text-xs mt-3 flex items-center gap-1"
                  >
                    <Plus size={13} /> 4지선다 1개 추가
                  </button>
                </div>
              )}
            </div>

            {/* 요약 & 네비 */}
            <div className="flex items-center justify-between">
              <button onClick={() => setStep(1)} className="btn-ghost text-sm">← 단원명 수정</button>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">총 {allQuestions.length}문항</span>
                <button
                  onClick={() => {
                    if (allQuestions.length === 0) { toast.error('문제를 1개 이상 입력하세요'); return; }
                    setStep(3);
                  }}
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
          <div className="max-w-2xl mx-auto space-y-5">
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-black text-gray-800">{title}</h2>
                  <p className="text-sm text-gray-400 mt-0.5">
                    총 {allQuestions.length}문항 · OX {oxParsed.length}개 / 4지선다 {mcParsed.length}개
                  </p>
                </div>
                <button onClick={() => setStep(2)} className="btn-secondary text-sm">수정하기</button>
              </div>

              <div className="space-y-3">
                {allQuestions.map((q, i) => (
                  <div key={q.id} className="border border-gray-100 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <span className={`shrink-0 text-xs px-2 py-0.5 rounded font-bold mt-0.5 ${
                        q.type === 'ox' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                      }`}>{i+1}</span>
                      <div className="flex-1">
                        <p className="text-gray-800 font-medium text-sm leading-relaxed">{q.text || <span className="text-red-400">⚠ 문제 미입력</span>}</p>
                        {q.type === 'ox' && (
                          <div className="flex gap-2 mt-2">
                            {['O','X'].map(v => (
                              <span key={v} className={`px-3 py-1 rounded-lg text-sm font-bold border ${
                                q.answer === v
                                  ? v==='O' ? 'bg-green-100 text-green-700 border-green-300' : 'bg-red-100 text-red-600 border-red-300'
                                  : 'bg-gray-50 text-gray-300 border-gray-200'
                              }`}>{v}</span>
                            ))}
                          </div>
                        )}
                        {q.type === 'multiple' && q.options && (
                          <div className="grid grid-cols-2 gap-1.5 mt-2">
                            {q.options.map((opt, j) => (
                              <span key={j} className={`px-2 py-1.5 rounded-lg text-xs border ${
                                q.answer === String(j+1)
                                  ? 'bg-green-100 text-green-700 border-green-300 font-semibold'
                                  : 'bg-gray-50 text-gray-500 border-gray-200'
                              }`}>
                                <span className="font-bold mr-1">{j+1}.</span>{opt || '(미입력)'}
                              </span>
                            ))}
                          </div>
                        )}
                        {q.explanation && <p className="text-xs text-gray-400 mt-2 italic">💡 {q.explanation}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CodePen 안내 */}
            <div className="card p-5 border-2 border-dashed border-green-200 bg-green-50/40">
              <div className="flex items-start gap-3">
                <FileText size={20} className="text-green-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-bold text-gray-800 text-sm mb-1">CodePen으로 배포하기</div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    버튼을 클릭하면 새 탭에 퀴즈 코드가 자동 로드된 CodePen이 열립니다.<br />
                    CodePen에서 <strong>저장(Ctrl+S)</strong> 후 생성된 URL을 노션에 저장하세요.
                  </p>
                </div>
                <button onClick={openCodePen} className="btn-secondary text-xs flex items-center gap-1.5 shrink-0 border-green-300 text-green-700 hover:bg-green-50">
                  <ExternalLink size={13} />
                  CodePen 열기
                </button>
              </div>
            </div>

            {/* 저장 완료 후 */}
            {saved && (
              <div className="card p-4 bg-green-50 border border-green-200">
                <div className="flex items-center gap-2 text-green-700 font-semibold text-sm">
                  <CheckCircle size={16} />
                  Firebase에 저장 완료! 이제 CodePen URL을 노션에 저장하세요.
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => handleSave(false)} disabled={saving} className="btn-secondary py-4 text-base flex items-center justify-center gap-2">
                <Save size={18} /> 임시저장
              </button>
              <button onClick={() => handleSave(true)} disabled={saving} className="btn-primary py-4 text-base flex items-center justify-center gap-2">
                {saving
                  ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Send size={18} />}
                {saving ? '게시 중...' : '게시하기'}
              </button>
            </div>
            <p className="text-xs text-center text-gray-400">
              게시하면 학생들이 접속 코드로 바로 응시할 수 있어요
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <CreateExamInner />
    </Suspense>
  );
}
