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

// ─────────────────────────────────────────────────────────────────────────────
// ✏️  과목 목록 — 여기만 수정하면 전체 반영됩니다
// ─────────────────────────────────────────────────────────────────────────────
const GRADES = ['중1', '중2', '중3', '고1', '고2', '고3'];

const SUBJECTS: Record<string, string[]> = {
  '중1': ['과학내신', '과학선행'],
  '중2': ['과학내신', '과학선행'],
  '중3': ['과학내신', '과학선행'],
  '고1': ['통합과학1', '통합과학2', '화학1', '물질과 에너지', '화학 반응의 세계'],
  '고2': ['통합과학1', '통합과학2', '화학1', '물질과 에너지', '화학 반응의 세계'],
  '고3': ['통합과학1', '통합과학2', '화학1', '물질과 에너지', '화학 반응의 세계'],
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

function generateCodePenData(title: string, questions: Question[]): { html: string; css: string; js: string } {
  const allQ = questions.map(q => ({
    id: q.id, type: q.type, text: q.text,
    choices: q.type === 'multiple' ? q.options : undefined,
    answer: q.answer, explanation: q.explanation || '',
  }));
  const dataJson = JSON.stringify(allQ);

  const html = `<div class="header">
  <h1>${title}</h1>
  <p>베타과학학원</p>
</div>
<div class="wrap" id="app"></div>`;

  const css = `* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Noto Sans KR', -apple-system, sans-serif; background: #f0fdf4; min-height: 100vh; }
.header { background: linear-gradient(135deg, #16a34a, #15803d); color: #fff; padding: 1.25rem 1rem; text-align: center; }
.header h1 { font-size: 20px; font-weight: 700; }
.header p { font-size: 13px; opacity: .8; margin-top: 3px; }
.wrap { max-width: 680px; margin: 0 auto; padding: 1.5rem 1rem; }
.progress-bar { background: #dcfce7; border-radius: 10px; height: 8px; margin-bottom: 1.5rem; overflow: hidden; }
.progress-fill { height: 100%; background: #16a34a; border-radius: 10px; transition: .3s; }
.card { background: #fff; border-radius: 16px; padding: 1.5rem; box-shadow: 0 2px 12px rgba(0,0,0,.07); }
.q-counter { font-size: 13px; color: #6b7280; margin-bottom: .75rem; }
.q-type { display: inline-block; font-size: 11px; font-weight: 700; padding: 2px 10px; border-radius: 20px; margin-bottom: .75rem; }
.q-type.ox { background: #dcfce7; color: #15803d; }
.q-type.mc { background: #dbeafe; color: #1d4ed8; }
.q-text { font-size: 16px; font-weight: 600; line-height: 1.6; color: #1f2937; margin-bottom: 1.25rem; }
.ox-row { display: flex; gap: 12px; }
.ox-btn { flex: 1; padding: 16px; border-radius: 12px; border: 2px solid #e5e7eb; font-size: 22px; font-weight: 800; cursor: pointer; background: #fff; transition: .15s; }
.ox-btn.O { color: #16a34a; border-color: #86efac; }
.ox-btn.O:hover { background: #f0fdf4; }
.ox-btn.X { color: #dc2626; border-color: #fca5a5; }
.ox-btn.X:hover { background: #fef2f2; }
.ox-btn:disabled { opacity: .5; cursor: default; }
.mc-list { display: flex; flex-direction: column; gap: 8px; }
.mc-opt { padding: 12px 16px; border-radius: 10px; border: 2px solid #e5e7eb; font-size: 14px; cursor: pointer; background: #fff; text-align: left; transition: .15s; display: flex; align-items: center; gap: 10px; }
.mc-opt:hover:not(:disabled) { border-color: #16a34a; background: #f0fdf4; }
.mc-opt:disabled { cursor: default; opacity: .7; }
.mc-opt .num { font-weight: 700; color: #16a34a; min-width: 22px; font-size: 15px; }
.feedback { margin-top: 1rem; padding: 12px 16px; border-radius: 10px; font-size: 14px; line-height: 1.6; display: none; }
.feedback.ok { background: #dcfce7; color: #14532d; border: 1.5px solid #86efac; }
.feedback.ng { background: #fee2e2; color: #7f1d1d; border: 1.5px solid #fca5a5; }
.nav { display: flex; justify-content: space-between; align-items: center; margin-top: 1.25rem; }
.btn { padding: 10px 22px; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; border: none; font-family: inherit; }
.btn-next { background: #16a34a; color: #fff; }
.btn-next:hover { background: #15803d; }
.btn-prev { background: #f3f4f6; color: #374151; }
.btn-prev:hover { background: #e5e7eb; }
.score-card { background: #fff; border-radius: 20px; padding: 2.5rem 2rem; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,.08); }
.score-big { font-size: 64px; font-weight: 800; color: #16a34a; line-height: 1; }
.score-denom { font-size: 24px; color: #9ca3af; }
.score-msg { font-size: 17px; color: #374151; margin-top: .75rem; font-weight: 600; }
.score-pct { font-size: 14px; color: #6b7280; margin-top: .25rem; }
.btn-restart { margin-top: 1.5rem; padding: 12px 36px; background: #16a34a; color: #fff; border: none; border-radius: 12px; font-size: 15px; font-weight: 600; cursor: pointer; font-family: inherit; }
.btn-restart:hover { background: #15803d; }`;

  const js = `const QS = ${dataJson};
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
    html += '<button class="ox-btn O" onclick="answerOX(&quot;O&quot;)">O</button>';
    html += '<button class="ox-btn X" onclick="answerOX(&quot;X&quot;)">X</button>';
    html += '</div>';
  } else {
    html += '<div class="mc-list">';
    (q.choices||[]).forEach((c,i) => {
      html += '<button class="mc-opt" onclick="answerMC(&quot;' + (i+1) + '&quot;)">'
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
  fb.innerHTML = (ok ? '✅ 정답입니다!' : '❌ 오답! 정답: <b>' + (q.type==='ox' ? q.answer : (NUMS[parseInt(q.answer)-1]||q.answer)) + '</b>')
    + (q.explanation ? '<br>💡 ' + q.explanation : '');
  document.querySelectorAll('.ox-btn,.mc-opt').forEach(b => b.disabled = true);
  const nb = document.getElementById('nb');
  if (nb) nb.style.display = 'block';
}

function answerOX(a) { const ok = a === qs[cur].answer; if (ok) score++; showFeedback(ok); }
function answerMC(a) { const ok = a === qs[cur].answer; if (ok) score++; showFeedback(ok); }
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
render();`;

  return { html, css, js };
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

  const handleGradeChange = (g: string) => { setGrade(g); setSubject(''); };
  const subjectList = grade ? (SUBJECTS[grade] ?? []) : [];
  const allQuestions = [...oxParsed, ...mcParsed];

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
    setOxParsed(parsed);
    toast.success(`OX 문제 ${parsed.length}개 불러옴`);
  }, [oxBulk]);

  const handleMcParse = useCallback(() => {
    const parsed = parseMCBulk(mcBulk);
    if (parsed.length === 0) { toast.error('형식을 확인해주세요'); return; }
    setMcParsed(parsed);
    toast.success(`4지선다 ${parsed.length}개 불러옴`);
  }, [mcBulk]);

  async function handleSave(publish: boolean) {
    if (!grade) { toast.error('학년을 선택하세요'); setStep(1); return; }
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

  function openCodePen() {
    if (allQuestions.length === 0) { toast.error('문제가 없습니다'); return; }
    const { html, css, js } = generateCodePenData(title || '온라인 테스트', allQuestions);
    const data = JSON.stringify({ html, css, js });
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = 'https://codepen.io/pen/define';
    form.target = '_blank';
    const input = document.createElement('input');
    input.type = 'hidden'; input.name = 'data'; input.value = data;
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

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── 헤더 ── */}
      <header className="bg-white border-b border-green-100 sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">

          {/* 왼쪽: 이전 페이지 버튼 + 로고 */}
          <div className="flex items-center gap-3">
            {/* ★ 이전 페이지 버튼 */}
            <button
              onClick={() => router.push('/teacher')}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-green-700 hover:bg-green-50 px-3 py-2 rounded-lg transition-all -ml-1"
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">선생님 홈</span>
            </button>
            <div className="h-5 w-px bg-gray-200" />
            <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
              <FlaskConical size={16} className="text-white" />
            </div>
            <div>
              <div className="font-bold text-green-900 text-sm">{editId ? '시험지 수정' : '시험지 만들기'}</div>
              <div className="text-xs text-green-600">
                {grade && subject ? `${grade} · ${subject}` : title || '정보 미입력'}
              </div>
            </div>
          </div>

          {/* 스텝 표시 */}
          <div className="hidden sm:flex items-center gap-2">
            {([1, 2, 3] as Step[]).map(s => (
              <button
                key={s}
                onClick={() => {
                  if (s >= 2 && (!title.trim() || !grade || !subject)) {
                    toast.error('학년·과목·단원명을 먼저 입력하세요'); return;
                  }
                  setStep(s);
                }}
                className={`w-8 h-8 rounded-full text-sm font-bold transition-all ${
                  step === s ? 'bg-green-600 text-white'
                  : step > s ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-400'
                }`}
              >
                {step > s ? '✓' : s}
              </button>
            ))}
          </div>

          {/* 오른쪽 버튼 */}
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

        {/* ── STEP 1: 기본 정보 ── */}
        {step === 1 && (
          <div className="max-w-lg mx-auto">
            <div className="card p-8">
              <div className="mb-6">
                <div className="w-10 h-10 rounded-full bg-green-600 text-white flex items-center justify-center font-bold text-base mb-4">1</div>
                <h2 className="text-xl font-black text-gray-800 mb-1">시험지 기본 정보</h2>
                <p className="text-sm text-gray-400">학년 · 과목 · 단원명을 입력하세요</p>
              </div>

              {/* 학년 */}
              <div className="mb-5">
                <label className="block text-sm font-semibold text-gray-700 mb-2">학년</label>
                <div className="grid grid-cols-3 gap-2">
                  {GRADES.map(g => (
                    <button key={g} type="button" onClick={() => handleGradeChange(g)}
                      className={`py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${
                        grade === g
                          ? 'bg-green-600 text-white border-green-600'
                          : 'border-gray-200 text-gray-500 hover:border-green-300 hover:text-green-600'
                      }`}>{g}</button>
                  ))}
                </div>
              </div>

              {/* 과목 — 학년 선택 후 표시 */}
              {grade && (
                <div className="mb-5">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">과목</label>
                  <div className="flex flex-wrap gap-2">
                    {subjectList.map(s => (
                      <button key={s} type="button" onClick={() => setSubject(s)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${
                          subject === s
                            ? 'bg-green-600 text-white border-green-600'
                            : 'border-gray-200 text-gray-500 hover:border-green-300 hover:text-green-600'
                        }`}>{s}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* 단원명 */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">단원명</label>
                <input
                  type="text"
                  className="input-field text-base font-semibold"
                  placeholder="예: 1단원 · 물질의 구성"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && title.trim() && grade && subject) setStep(2); }}
                  autoFocus
                />
              </div>

              <button
                onClick={() => {
                  if (!grade) { toast.error('학년을 선택하세요'); return; }
                  if (!subject) { toast.error('과목을 선택하세요'); return; }
                  if (!title.trim()) { toast.error('단원명을 입력하세요'); return; }
                  setStep(2);
                }}
                className="btn-primary w-full py-3"
              >
                다음: 문제 추가 →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: 문제 입력 ── */}
        {step === 2 && (
          <div className="space-y-5">
            {/* 요약 배지 */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-green-100 text-green-700">{grade}</span>
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-green-100 text-green-700">{subject}</span>
              <span className="text-sm font-semibold text-gray-700">{title}</span>
            </div>

            {/* OX */}
            <div className="card p-0 overflow-hidden">
              <button onClick={() => setOxOpen(o => !o)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">OX 문제</span>
                  <span className="font-bold text-gray-800">OX 일괄 입력</span>
                  {oxParsed.length > 0 && <span className="text-xs text-green-600 font-semibold">✓ {oxParsed.length}개 로드됨</span>}
                </div>
                {oxOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </button>
              {oxOpen && (
                <div className="px-5 pb-5 border-t border-gray-100">
                  <div className="bg-green-50 rounded-xl p-3 my-4 text-xs text-green-800 leading-relaxed">
                    <strong>입력 형식</strong> (문제 사이 빈 줄로 구분)<br />
                    <code className="block mt-1 bg-white rounded p-2 text-green-900 whitespace-pre">{`문제: 물은 H2O로 표현된다.
정답: O
해설: 물 분자는 수소 2개, 산소 1개입니다.

문제: 지구는 태양계의 중심이다.
정답: X
해설: 태양이 중심입니다.`}</code>
                  </div>
                  <textarea className="input-field resize-none font-mono text-sm" rows={8}
                    placeholder={`문제: \n정답: O\n해설: \n\n문제: \n정답: X\n해설: `}
                    value={oxBulk} onChange={e => setOxBulk(e.target.value)} />
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-gray-400">
                      {oxBulk.trim().split(/\n\s*\n/).filter(b => b.includes('문제:')).length}개 감지됨
                    </span>
                    <button onClick={handleOxParse} className="btn-primary text-sm px-4 py-2">가져오기 →</button>
                  </div>
                  {oxParsed.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">로드된 OX 문제 ({oxParsed.length}개)</div>
                      {oxParsed.map((q, i) => (
                        <div key={q.id} className="flex items-start gap-3 bg-gray-50 rounded-lg px-3 py-2">
                          <span className="text-xs text-gray-400 mt-0.5 shrink-0">Q{i+1}</span>
                          <span className="flex-1 text-sm text-gray-700 line-clamp-1">{q.text}</span>
                          <span className={`text-sm font-bold shrink-0 ${q.answer === 'O' ? 'text-green-600' : 'text-red-500'}`}>{q.answer}</span>
                          <button onClick={() => setOxParsed(prev => prev.filter((_, idx) => idx !== i))} className="text-gray-300 hover:text-red-400 shrink-0"><Trash2 size={13} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={() => setOxParsed(prev => [...prev, makeQuestion('ox')])} className="btn-secondary text-xs mt-3 flex items-center gap-1">
                    <Plus size={13} /> OX 문제 1개 추가
                  </button>
                </div>
              )}
            </div>

            {/* 4지선다 */}
            <div className="card p-0 overflow-hidden">
              <button onClick={() => setMcOpen(o => !o)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">4지선다</span>
                  <span className="font-bold text-gray-800">4지선다 일괄 입력</span>
                  {mcParsed.length > 0 && <span className="text-xs text-blue-600 font-semibold">✓ {mcParsed.length}개 로드됨</span>}
                </div>
                {mcOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </button>
              {mcOpen && (
                <div className="px-5 pb-5 border-t border-gray-100">
                  <div className="bg-blue-50 rounded-xl p-3 my-4 text-xs text-blue-800 leading-relaxed">
                    <strong>입력 형식</strong> (문제 사이 빈 줄로 구분)<br />
                    <code className="block mt-1 bg-white rounded p-2 text-blue-900 whitespace-pre">{`문제: 광합성을 하는 세포 소기관은?
선택지1: 미토콘드리아
선택지2: 엽록체
선택지3: 리보솜
선택지4: 골지체
정답: 엽록체
해설: 엽록체는 광합성을 담당합니다.`}</code>
                  </div>
                  <textarea className="input-field resize-none font-mono text-sm" rows={10}
                    placeholder={`문제: \n선택지1: \n선택지2: \n선택지3: \n선택지4: \n정답: \n해설: `}
                    value={mcBulk} onChange={e => setMcBulk(e.target.value)} />
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-gray-400">
                      {mcBulk.trim().split(/\n\s*\n/).filter(b => b.includes('문제:')).length}개 감지됨
                    </span>
                    <button onClick={handleMcParse} className="btn-primary text-sm px-4 py-2">가져오기 →</button>
                  </div>
                  {mcParsed.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">로드된 4지선다 ({mcParsed.length}개)</div>
                      {mcParsed.map((q, i) => (
                        <div key={q.id} className="flex items-start gap-3 bg-gray-50 rounded-lg px-3 py-2">
                          <span className="text-xs text-gray-400 mt-0.5 shrink-0">Q{i+1}</span>
                          <span className="flex-1 text-sm text-gray-700 line-clamp-1">{q.text}</span>
                          <span className="text-xs text-blue-600 font-semibold shrink-0">{q.answer}번</span>
                          <button onClick={() => setMcParsed(prev => prev.filter((_, idx) => idx !== i))} className="text-gray-300 hover:text-red-400 shrink-0"><Trash2 size={13} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={() => setMcParsed(prev => [...prev, makeQuestion('multiple')])} className="btn-secondary text-xs mt-3 flex items-center gap-1">
                    <Plus size={13} /> 4지선다 1개 추가
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <button onClick={() => setStep(1)} className="btn-ghost text-sm flex items-center gap-1">
                <ArrowLeft size={14} /> 기본 정보 수정
              </button>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">총 {allQuestions.length}문항</span>
                <button onClick={() => { if (allQuestions.length === 0) { toast.error('문제를 1개 이상 입력하세요'); return; } setStep(3); }} className="btn-primary text-sm">
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
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">{grade}</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">{subject}</span>
                  </div>
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
                      <span className={`shrink-0 text-xs px-2 py-0.5 rounded font-bold mt-0.5 ${q.type === 'ox' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{i+1}</span>
                      <div className="flex-1">
                        <p className="text-gray-800 font-medium text-sm leading-relaxed">{q.text || <span className="text-red-400">⚠ 문제 미입력</span>}</p>
                        {q.type === 'ox' && (
                          <div className="flex gap-2 mt-2">
                            {['O','X'].map(v => (
                              <span key={v} className={`px-3 py-1 rounded-lg text-sm font-bold border ${q.answer === v ? v==='O' ? 'bg-green-100 text-green-700 border-green-300' : 'bg-red-100 text-red-600 border-red-300' : 'bg-gray-50 text-gray-300 border-gray-200'}`}>{v}</span>
                            ))}
                          </div>
                        )}
                        {q.type === 'multiple' && q.options && (
                          <div className="grid grid-cols-2 gap-1.5 mt-2">
                            {q.options.map((opt, j) => (
                              <span key={j} className={`px-2 py-1.5 rounded-lg text-xs border ${q.answer === String(j+1) ? 'bg-green-100 text-green-700 border-green-300 font-semibold' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
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

            <div className="card p-5 border-2 border-dashed border-green-200 bg-green-50/40">
              <div className="flex items-start gap-3 mb-4">
                <FileText size={20} className="text-green-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-bold text-gray-800 text-sm mb-1">CodePen으로 배포하기</div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    1. 아래 버튼으로 CodePen 열기 → Ctrl+S 저장 → URL 복사<br />
                    2. 복사한 URL을 아래에 붙여넣으면 학생 목록에 자동 연결됩니다.
                  </p>
                </div>
                <button onClick={openCodePen} className="btn-secondary text-xs flex items-center gap-1.5 shrink-0 border-green-300 text-green-700 hover:bg-green-50">
                  <ExternalLink size={13} /> CodePen 열기
                </button>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">CodePen URL (저장 후 붙여넣기)</label>
                <input type="url" className="input-field text-sm" placeholder="https://codepen.io/..."
                  value={codepenUrl} onChange={e => setCodepenUrl(e.target.value)} />
              </div>
            </div>

            {saved && (
              <div className="card p-4 bg-green-50 border border-green-200">
                <div className="flex items-center gap-2 text-green-700 font-semibold text-sm">
                  <CheckCircle size={16} />
                  저장 완료! 학생들이 학년 · 과목으로 바로 찾을 수 있어요.
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => handleSave(false)} disabled={saving} className="btn-secondary py-4 text-base flex items-center justify-center gap-2">
                <Save size={18} /> 임시저장
              </button>
              <button onClick={() => handleSave(true)} disabled={saving} className="btn-primary py-4 text-base flex items-center justify-center gap-2">
                {saving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send size={18} />}
                {saving ? '게시 중...' : '게시하기'}
              </button>
            </div>
            <p className="text-xs text-center text-gray-400">게시하면 학생들이 학년 · 과목으로 필터링해서 바로 찾을 수 있어요</p>
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
