'use client';
// src/app/student/[examId]/page.tsx
import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  getExam, submitStudentAnswers, calculateScore, isAnswerCorrect,
  formatCorrectAnswer, buildSubmissionSummary, getSubmissionSummary,
  Exam, SubmissionSummary
} from '@/lib/examService';
import { FlaskConical, ChevronLeft, ChevronRight, CheckCircle, ArrowLeft, RefreshCw, PartyPopper, Send, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

type Phase = 'name' | 'exam' | 'result';

// ─────────────────────────────────────────────
// ★ 미응답 판정 (순수 함수)
//   [예전 문제] 아래 번호판으로 '마지막 문제'로 건너뛴 뒤 답을 고르면
//   앞 문제를 안 풀었어도 그 자리에서 제출돼 버렸다.
//   그래서 20문항짜리 OX가 1~2문항만 채워진 채 0점으로 저장되는 일이 생겼다.
//   [지금 규칙] '마지막 번호'가 아니라 '빈 문항이 하나도 없을 때' 제출한다.
// ─────────────────────────────────────────────
function hasAns(answers: Record<string, string>, id: string): boolean {
  const v = answers ? answers[id] : undefined;
  return v !== undefined && v !== null && String(v).trim() !== '';
}

function unansweredIndexes(list: Exam['questions'], answers: Record<string, string>): number[] {
  const out: number[] = [];
  (list ?? []).forEach((q, i) => { if (!hasAns(answers, q.id)) out.push(i); });
  return out;
}

// 현재 위치 다음부터 안 푼 문제를 찾고, 뒤에 없으면 앞쪽에서 찾는다.
function nextUnansweredFrom(
  list: Exam['questions'],
  answers: Record<string, string>,
  from: number
): number {
  const miss = unansweredIndexes(list, answers);
  if (miss.length === 0) return -1;
  const after = miss.find(i => i > from);
  return after !== undefined ? after : miss[0];
}

// ─────────────────────────────────────────────
// ★★ 답안 임시저장 (2026-08 추가) ★★
//
// [무엇이 문제였나]
// 답안(answers)이 메모리에만 있어서, 제출이 실패하거나 학생이 실수로
// 창을 닫으면 20문항을 푼 기록이 통째로 사라졌다.
// 카카오톡 인앱 브라우저에서 제출이 튕긴 학생은 처음부터 다시 풀어야 했다.
//
// [어떻게 고쳤나]
// 답을 고를 때마다 브라우저에 즉시 저장한다. 다시 열면 그대로 복원된다.
// 저장이 성공하면 지운다. 7일이 지난 기록은 자동으로 버린다.
//
// 저장 실패(시크릿 모드·스토리지 차단)해도 시험 자체는 그대로 진행된다.
// 저장은 어디까지나 '보험'이므로, 여기서 절대 예외를 밖으로 던지지 않는다.
// ─────────────────────────────────────────────
const DRAFT_PREFIX = 'examDraft:';
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;   // 7일

function makeDraftKey(examId: string, type: string | null, who: string): string {
  return `${DRAFT_PREFIX}${examId}:${type || 'all'}:${who || 'anon'}`;
}

function readDraft(key: string): Record<string, string> | null {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.savedAt === 'number' && Date.now() - parsed.savedAt > DRAFT_TTL_MS) {
      try { localStorage.removeItem(key); } catch { /* 무시 */ }
      return null;
    }
    const a = parsed.answers;
    if (!a || typeof a !== 'object' || Array.isArray(a)) return null;
    const out: Record<string, string> = {};
    Object.keys(a).forEach(k => {
      const v = a[k];
      if (typeof v === 'string' && v.trim() !== '') out[k] = v;
    });
    return Object.keys(out).length > 0 ? out : null;
  } catch {
    return null;
  }
}

function writeDraft(key: string, answers: Record<string, string>): void {
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify({ answers, savedAt: Date.now() }));
  } catch { /* 저장 못 해도 시험은 계속된다 */ }
}

function clearDraft(key: string): void {
  if (!key) return;
  try { localStorage.removeItem(key); } catch { /* 무시 */ }
}

// ★ 제출 실패 사유를 학생이 알아들을 수 있는 말로 바꾼다.
//   답안이 남아 있다는 사실을 반드시 함께 알려, 다시 풀지 않게 한다.
function submitErrorMessage(err: any): string {
  const code = err && err.code;
  if (code === 'UNANSWERED' || code === 'PREV_READ_FAILED') {
    return String((err && err.message) || '제출할 수 없습니다.');
  }
  if (code === 'permission-denied') {
    return '성적 저장 권한이 없어 제출되지 않았어요.\n선생님께 알려주세요. (푼 답안은 저장돼 있어요)';
  }
  if (code === 'unavailable' || code === 'deadline-exceeded') {
    return '인터넷 연결이 잠시 끊겼어요.\n답안은 저장돼 있으니 [제출하기]를 다시 눌러주세요.';
  }
  return '제출에 실패했어요.\n푼 답안은 저장돼 있으니 [제출하기]를 다시 눌러주세요.';
}

function StudentExamInner() {
  const { examId } = useParams<{ examId: string }>();
  const searchParams = useSearchParams();
  const isPreview = searchParams.get('preview') === '1';
  // ★ type 파라미터: 'ox' | 'multiple' | null(전체)
  const typeFilter = searchParams.get('type') as 'ox' | 'multiple' | null;
  // ★ from 파라미터: 시험을 끝낸 뒤 돌아갈 주소(클리닉 첫 페이지 등)
  const fromParam = searchParams.get('from');
  const router = useRouter();

  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>('name');
  const [studentName, setStudentName] = useState('');
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [score, setScore] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [summary, setSummary] = useState<SubmissionSummary | null>(null);

  // ★ 임시저장 관련
  const [draftKey, setDraftKey] = useState('');
  const [restored, setRestored] = useState(false);      // 지난 답안을 불러왔는가
  const [submitError, setSubmitError] = useState('');   // 마지막 제출 실패 사유

  // 재풀기용
  const [retryQuestions, setRetryQuestions] = useState<Exam['questions']>([]);
  const [isRetryMode, setIsRetryMode] = useState(false);
  const [retryAnswers, setRetryAnswers] = useState<Record<string, string>>({});
  const [retryScore, setRetryScore] = useState(0);
  const [retryPhase, setRetryPhase] = useState<'exam' | 'result'>('exam');

  const [studentId, setStudentId] = useState('');

  useEffect(() => {
    let savedName = '';
    let savedId   = '';
    try {
      savedName = localStorage.getItem('studentName') || '';
      savedId   = localStorage.getItem('studentId') || '';
    } catch { /* 스토리지가 막혀 있어도 진행 */ }

    const urlSid   = (searchParams.get('sid') || '').trim();
    const urlSname = (searchParams.get('sname') || '').trim();

    // ── 신원 결정: URL(sid/sname)이 항상 최우선 ──
    const effectiveId = urlSid || savedId || '';
    if (effectiveId) setStudentId(effectiveId);

    // sid가 있는데 저장된 id와 다르면, 저장된 이름은 '다른 학생' 것이므로 쓰지 않는다.
    let effectiveName = '';
    if (urlSname) {
      effectiveName = urlSname;
    } else if (savedName && (!urlSid || urlSid === savedId)) {
      effectiveName = savedName;
    }

    // ★ 신원을 localStorage에 고정 저장.
    //   OX → 4지선다로 넘어갈 때 페이지가 완전히 새로고침되므로,
    //   저장해두지 않으면 두 번째 시험에서 학생ID를 잃어버려 성적이 주인 없는
    //   기록으로 쌓이고 대시보드에서 걸러진다.
    try {
      if (effectiveId) localStorage.setItem('studentId', effectiveId);
      if (effectiveName) localStorage.setItem('studentName', effectiveName);
    } catch { /* 무시 */ }

    if (effectiveName) setStudentName(effectiveName);

    // ★ 임시저장 열쇠 — 학생ID(없으면 이름) + 시험 + 유형 단위로 따로 보관한다.
    //   같은 기기를 형제가 같이 써도 서로 답안이 섞이지 않는다.
    const who = effectiveId || effectiveName || '';
    const key = who ? makeDraftKey(String(examId), typeFilter, who) : '';
    if (key) setDraftKey(key);

    getExam(examId).then(e => {
      setExam(e);

      // ★ 지난번에 풀다 만 답안이 있으면 되살린다
      if (e && key) {
        const saved = readDraft(key);
        if (saved) {
          setAnswers(saved);
          setRestored(true);
          const list = (e.questions ?? []).filter(
            (q: any) => !typeFilter || q.type === typeFilter
          );
          const miss = unansweredIndexes(list, saved);
          setCurrent(miss.length > 0 ? miss[0] : 0);
        } else {
          setCurrent(0);
        }
      } else {
        setCurrent(0);
      }

      if (effectiveName) setPhase('exam');
      setLoading(false);
    }).catch(() => {
      setExam(null);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  // ★ typeFilter에 따라 실제로 풀 문제 목록 결정
  function getFilteredQuestions(e: Exam): Exam['questions'] {
    if (!typeFilter) return e.questions;
    return e.questions.filter((q: any) => q.type === typeFilter);
  }

  // ─────────────────────────────────────────────
  // 제출 — 빈 문항이 하나도 없을 때만 저장한다.
  // 저장에 실패하면 결과 화면으로 넘어가지 않는다.
  // (예전에는 저장이 실패해도 "시험 끝!"이 떠서 학생이 정상 제출로 착각했다)
  //
  // ★ 저장에 성공한 순간에만 임시저장을 지운다.
  //   실패하면 답안이 그대로 남아, 다시 제출하거나 나중에 열어도 이어서 낼 수 있다.
  // ─────────────────────────────────────────────
  async function autoSubmit(finalAnswers: Record<string, string>, questionsForSubmit: Exam['questions']) {
    if (!exam) return;
    if (submitting) return;

    // ① 마지막 안전장치 — 빈 문항이 있으면 저장하지 않고 그 문제로 보낸다
    const miss = unansweredIndexes(questionsForSubmit, finalAnswers);
    if (miss.length > 0) {
      toast.error(`아직 ${miss.length}문항이 비어 있어요. 모두 고른 뒤 제출됩니다.`);
      setCurrent(miss[0]);
      return;
    }

    const virtualExam: Exam = { ...exam, questions: questionsForSubmit };
    const s = calculateScore(virtualExam, finalAnswers);

    // 미리보기는 저장하지 않고 이번 세션 기준으로만 보여준다
    if (isPreview) {
      setScore(s);
      setSummary(buildSubmissionSummary(exam.questions ?? [], finalAnswers));
      setPhase('result');
      return;
    }

    setSubmitting(true);
    setSubmitError('');
    try {
      await submitStudentAnswers({
        examId: exam.id!,
        studentName,
        studentId,
        answers: finalAnswers,
        score: s,
        totalQuestions: questionsForSubmit.length,
        subType: typeFilter,
      });

      // ★ 저장이 확실히 끝난 뒤에만 임시저장을 지운다
      clearDraft(draftKey);
      setRestored(false);

      // 저장된 이전 답안까지 합친 정확한 요약 (OX를 먼저 푼 기록 반영)
      let merged: SubmissionSummary | null = null;
      try {
        merged = await getSubmissionSummary(exam.id!, studentId, finalAnswers);
      } catch {
        merged = null;
      }

      setScore(s);
      setSummary(merged ?? buildSubmissionSummary(exam.questions ?? [], finalAnswers));
      setSubmitting(false);
      setPhase('result');   // ★ 저장이 성공했을 때만 결과 화면으로
    } catch (err: any) {
      setSubmitting(false);

      // ★ 답안은 그대로 남겨둔다. 임시저장도 지우지 않는다.
      writeDraft(draftKey, finalAnswers);

      const msg = submitErrorMessage(err);
      setSubmitError(msg);
      toast.error(msg, { duration: 7000 });

      const code = err && err.code;
      if (code === 'UNANSWERED' && Array.isArray(err.unanswered) && err.unanswered.length > 0) {
        const firstMiss = unansweredIndexes(questionsForSubmit, finalAnswers);
        if (firstMiss.length > 0) setCurrent(firstMiss[0]);
      }
      // 결과 화면으로 넘어가지 않는다 → 학생이 다시 제출할 수 있다
    }
  }

  function handleAnswer(questionId: string, value: string) {
    if (!exam) return;
    if (submitting) return;
    const filteredQs = getFilteredQuestions(exam);
    const newAnswers = { ...answers, [questionId]: value };
    setAnswers(newAnswers);
    setSubmitError('');

    // ★ 답을 고른 즉시 저장한다 — 여기서부터는 창이 닫혀도 답이 남는다
    writeDraft(draftKey, newAnswers);

    // ★ 빈 문항이 하나도 없을 때만 제출한다 (푼 순서는 상관없다)
    const nextIdx = nextUnansweredFrom(filteredQs, newAnswers, current);
    if (nextIdx === -1) {
      autoSubmit(newAnswers, filteredQs);
    } else {
      setCurrent(nextIdx);
    }
  }

  // 재풀기 답 선택 — 같은 규칙 적용 (재풀기는 성적에 저장되지 않으므로 임시저장 대상이 아니다)
  function handleRetryAnswer(questionId: string, value: string) {
    const newAnswers = { ...retryAnswers, [questionId]: value };
    setRetryAnswers(newAnswers);

    const nextIdx = nextUnansweredFrom(retryQuestions, newAnswers, current);
    if (nextIdx !== -1) {
      setCurrent(nextIdx);
      return;
    }

    let correct = 0;
    retryQuestions.forEach(item => {
      if (isAnswerCorrect(newAnswers[item.id], item.answer)) correct++;
    });
    const s = retryQuestions.length > 0
      ? Math.round((correct / retryQuestions.length) * 100)
      : 0;
    setRetryScore(s);
    setRetryPhase('result');
  }

  // 틀린 문제만 다시 풀기
  function startRetry() {
    if (!exam) return;
    const filteredQs = getFilteredQuestions(exam);
    const wrong = filteredQs.filter(item => !isAnswerCorrect(answers[item.id], item.answer));
    if (wrong.length === 0) return;
    setRetryQuestions(wrong);
    setRetryAnswers({});
    setRetryScore(0);
    setRetryPhase('exam');
    setCurrent(0);
    setIsRetryMode(true);
  }

  function exitRetry() {
    setIsRetryMode(false);
    setCurrent(0);
  }

  // 이름 입력 후 시험 시작 (입력한 이름을 저장해 다음 유형에서도 유지)
  function startExamWithName() {
    if (!studentName.trim() && !isPreview) { toast.error('이름을 입력하세요'); return; }
    const finalName = studentName.trim() || '미리보기';
    setStudentName(finalName);
    try { localStorage.setItem('studentName', finalName); } catch { /* 무시 */ }

    // ★ 이름으로 들어온 학생도 임시저장을 쓸 수 있게 열쇠를 만든다
    const who = studentId || finalName;
    const key = makeDraftKey(String(examId), typeFilter, who);
    setDraftKey(key);

    const saved = readDraft(key);
    if (saved && exam) {
      setAnswers(saved);
      setRestored(true);
      const list = getFilteredQuestions(exam);
      const miss = unansweredIndexes(list, saved);
      setCurrent(miss.length > 0 ? miss[0] : 0);
    } else {
      setCurrent(0);
    }

    setPhase('exam');
  }

  // ★ 사이트 내부 경로만 허용 (오픈 리다이렉트 방지)
  function safeReturnPath(p: string | null): string | null {
    if (!p) return null;
    if (p.startsWith('/') && !p.startsWith('//')) return p;
    return null;
  }

  function goToList() {
    let target = safeReturnPath(fromParam);
    if (!target) {
      try { target = safeReturnPath(localStorage.getItem('clinicReturn')); } catch { /* 무시 */ }
    }
    if (target) window.location.href = target;
    else router.push('/student-test');
  }

  // ★ 같은 시험의 다른 유형으로 이동. sid/sname을 반드시 함께 넘긴다.
  function crossTypeHref(t: 'ox' | 'multiple') {
    const params = new URLSearchParams();
    params.set('type', t);
    const sid   = (searchParams.get('sid') || studentId || '').trim();
    const sname = (searchParams.get('sname') || studentName || '').trim();
    if (sid)   params.set('sid', sid);
    if (sname) params.set('sname', sname);
    if (fromParam) params.set('from', fromParam);
    if (isPreview) params.set('preview', '1');
    return `/student/${examId}?${params.toString()}`;
  }

  function prev() {
    if (current > 0) setCurrent(c => c - 1);
  }

  function next() {
    const list = isRetryMode ? retryQuestions : (exam ? getFilteredQuestions(exam) : []);
    if (current < list.length - 1) setCurrent(c => c + 1);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">🔍</div>
          <p className="text-gray-500">시험지를 찾을 수 없어요</p>
          <button onClick={() => router.push('/')} className="btn-primary mt-4">홈으로</button>
        </div>
      </div>
    );
  }

  const filteredQuestions = getFilteredQuestions(exam);

  if (filteredQuestions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">📭</div>
          <p className="text-gray-500">
            {typeFilter === 'ox' ? 'OX 문제가 없습니다' : '4지선다 문제가 없습니다'}
          </p>
          <button onClick={() => router.back()} className="btn-primary mt-4">뒤로가기</button>
        </div>
      </div>
    );
  }

  const questions = isRetryMode ? retryQuestions : filteredQuestions;
  const currentAnswers = isRetryMode ? retryAnswers : answers;
  const q = questions[current];
  const answered = Object.keys(currentAnswers).filter(k => hasAns(currentAnswers, k)).length;

  // ★ 남은(비어 있는) 문항
  const missingIdxs = unansweredIndexes(questions, currentAnswers);
  const remaining = missingIdxs.length;
  function goToFirstUnanswered() {
    if (missingIdxs.length > 0) setCurrent(missingIdxs[0]);
  }

  // ★ 손으로 누르는 제출 버튼.
  //   제출이 한 번 실패해 답안이 다 채워진 채로 남아 있을 때,
  //   이 버튼이 없으면 학생이 다시 제출할 방법이 없다.
  function manualSubmit() {
    if (submitting) return;
    if (isRetryMode) return;
    autoSubmit(answers, filteredQuestions);
  }

  const wrongQuestions = filteredQuestions.filter(item => !isAnswerCorrect(answers[item.id], item.answer));

  // ★ 이 시험지가 가진 유형 / 학생이 끝낸 유형
  const examHasOx    = summary ? summary.oxTotal > 0    : exam.questions.some(item => item.type === 'ox');
  const examHasMulti = summary ? summary.multiTotal > 0 : exam.questions.some(item => item.type === 'multiple');
  const oxDone       = summary ? summary.oxDone    : typeFilter !== 'multiple';
  const multiDone    = summary ? summary.multiDone : typeFilter !== 'ox';
  const allDone      = (!examHasOx || oxDone) && (!examHasMulti || multiDone);

  // 아직 안 푼 유형이 있으면 그 유형으로 안내 (없으면 null → 버튼 자체를 숨김)
  const nextType: 'ox' | 'multiple' | null =
    (examHasOx && !oxDone) ? 'ox'
    : (examHasMulti && !multiDone) ? 'multiple'
    : null;

  const nextTypeLabel = nextType === 'ox' ? 'OX퀴즈' : '4지선다';
  const nextTypeCount = nextType === 'ox'
    ? (summary?.oxTotal ?? 0)
    : (summary?.multiTotal ?? 0);

  const examDisplayTitle = typeFilter === 'ox'
    ? `${exam.title} (OX퀴즈)`
    : typeFilter === 'multiple'
    ? `${exam.title} (4지선다)`
    : exam.title;

  const typeLabel = typeFilter === 'ox'
    ? { text: 'OX퀴즈', bg: 'bg-green-100', color: 'text-green-700' }
    : typeFilter === 'multiple'
    ? { text: '4지선다', bg: 'bg-blue-100', color: 'text-blue-700' }
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex flex-col">

      {/* ★ 저장 중 오버레이 — 저장이 끝나기 전에 화면을 건드리지 못하게 한다 */}
      {submitting && (
        <div className="fixed inset-0 z-[60] bg-white/85 flex items-center justify-center px-6">
          <div className="text-center">
            <div className="w-9 h-9 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm font-bold text-green-700">성적을 저장하고 있어요</p>
            <p className="text-xs text-gray-400 mt-1">창을 닫거나 새로고침하지 마세요</p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-green-100 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center shrink-0">
              <FlaskConical size={16} className="text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-green-900 text-sm whitespace-nowrap">인후쌤의 과학 수업 관리 시스템</span>
                {(phase === 'exam' || isRetryMode) && (
                  <span className="text-xs text-green-600 whitespace-nowrap">· {studentName}</span>
                )}
                {(phase === 'exam' || isRetryMode) && (
                  isRetryMode ? (
                    <span className="bg-orange-100 text-orange-700 font-bold px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap">
                      오답 재풀기
                    </span>
                  ) : typeLabel ? (
                    <span className={`${typeLabel.bg} ${typeLabel.color} font-bold px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap`}>
                      {typeLabel.text}
                    </span>
                  ) : null
                )}
              </div>
              {phase === 'exam' && !isRetryMode && (
                <div className="text-[11px] text-green-600/80 truncate mt-0.5">{examDisplayTitle}</div>
              )}
            </div>
          </div>
          {(phase === 'exam' || isRetryMode) && (
            <div className="text-xs text-gray-500 shrink-0 whitespace-nowrap">
              <span className="font-bold text-green-600">{answered}</span>/{questions.length} 답변
            </div>
          )}
          {isPreview && (
            <button onClick={() => router.back()} className="btn-ghost text-xs flex items-center gap-1 shrink-0">
              <ArrowLeft size={14} />미리보기 종료
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 flex flex-col">

        {/* 이름 입력 */}
        {phase === 'name' && !isRetryMode && (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="card p-8 w-full max-w-sm text-center">
              <div className="text-4xl mb-4">👤</div>
              <h2 className="text-xl font-black text-gray-800 mb-1">{examDisplayTitle}</h2>
              {typeLabel && (
                <span className={`inline-block ${typeLabel.bg} ${typeLabel.color} text-xs font-bold px-2.5 py-1 rounded-full mb-2`}>
                  {typeLabel.text} · {filteredQuestions.length}문항
                </span>
              )}
              {!typeLabel && (
                <p className="text-gray-400 text-sm mb-6">{filteredQuestions.length}문항</p>
              )}
              <div className="text-left mb-2 mt-4">
                <label className="text-sm font-semibold text-gray-700 block mb-1.5">이름을 입력하세요</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="홍길동"
                  value={studentName}
                  onChange={e => setStudentName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && studentName.trim()) {
                      startExamWithName();
                    }
                  }}
                  autoFocus
                />
              </div>
              <button onClick={startExamWithName} className="btn-primary w-full mt-4">
                시험 시작하기 →
              </button>
              <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">
                {filteredQuestions.length}문항을 모두 풀어야 제출됩니다
              </p>
            </div>
          </div>
        )}

        {/* 시험 풀기 (일반 + 재풀기 공통) */}
        {((phase === 'exam' && !isRetryMode) || (isRetryMode && retryPhase === 'exam')) && q && (
          <div className="flex-1 flex flex-col">
            {isRetryMode && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-2.5 mb-4 flex items-center justify-between">
                <span className="text-orange-700 text-sm font-semibold">
                  🔄 오답 재풀기 · {retryQuestions.length}문제
                </span>
                <button onClick={exitRetry} className="text-xs text-orange-500 underline">
                  결과로 돌아가기
                </button>
              </div>
            )}

            {/* ★ 지난 답안을 되살렸을 때 알려준다 */}
            {!isRetryMode && restored && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 mb-4 text-xs font-bold text-blue-800 leading-snug">
                💾 지난번에 풀던 답안을 그대로 불러왔어요 · 이어서 풀면 됩니다
              </div>
            )}

            {/* ★ 제출 실패 안내 — 답안이 남아 있다는 사실과 다시 낼 방법을 함께 보여준다 */}
            {!isRetryMode && submitError && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs font-bold text-red-700 leading-relaxed whitespace-pre-line">
                    {submitError}
                  </p>
                </div>
                {remaining === 0 && (
                  <button
                    onClick={manualSubmit}
                    disabled={submitting}
                    className="w-full mt-3 rounded-xl bg-red-600 text-white text-sm font-bold py-2.5 disabled:opacity-50"
                  >
                    다시 제출하기
                  </button>
                )}
              </div>
            )}

            {/* ★ 빈 문항 경고 — 남은 문항이 있으면 항상 보인다 */}
            {remaining > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 mb-4 flex items-center justify-between gap-3">
                <span className="text-amber-800 text-xs font-bold leading-snug">
                  아직 {remaining}문항이 비어 있어요 · 모두 풀어야 제출됩니다
                </span>
                <button
                  onClick={goToFirstUnanswered}
                  className="text-xs font-bold text-amber-700 underline shrink-0 whitespace-nowrap"
                >
                  안 푼 문제로 →
                </button>
              </div>
            )}
            {remaining === 0 && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 mb-4">
                <div className="text-xs font-bold text-green-700">
                  ✓ 모든 문항을 풀었어요
                </div>
                {/* ★ 재풀기가 아닐 때만 제출 버튼을 둔다.
                    자동 제출이 실패했더라도 여기서 다시 낼 수 있다. */}
                {!isRetryMode && (
                  <button
                    onClick={manualSubmit}
                    disabled={submitting}
                    className="w-full mt-2.5 rounded-xl bg-green-600 text-white text-sm font-bold py-3 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Send size={15} />
                    {submitting ? '제출하는 중…' : '제출하기'}
                  </button>
                )}
              </div>
            )}

            {/* Progress */}
            <div className="mb-6">
              <div className="flex justify-between text-xs text-gray-400 mb-2">
                <span>문제 {current + 1} / {questions.length}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  q.type === 'ox' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {q.type === 'ox' ? 'OX 문제' : '4지선다'}
                </span>
              </div>
              <div className="h-1.5 bg-gray-200 rounded-full">
                <div
                  className="progress-bar"
                  style={{ width: `${((current + 1) / questions.length) * 100}%` }}
                />
              </div>
            </div>

            {/* 문제 */}
            <div className="card p-6 mb-6 flex-1">
              <p className="text-lg font-semibold text-gray-800 leading-relaxed mb-6">{q.text}</p>

              {q.type === 'ox' && (
                <div className="flex gap-4">
                  {(['O', 'X'] as const).map(v => (
                    <button
                      key={v}
                      disabled={submitting}
                      onClick={() => isRetryMode ? handleRetryAnswer(q.id, v) : handleAnswer(q.id, v)}
                      className={`ox-btn ${v === 'O' ? 'ox-btn-o' : 'ox-btn-x'} ${currentAnswers[q.id] === v ? 'selected' : ''}`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              )}

              {q.type === 'multiple' && q.options && (
                <div className="space-y-2">
                  {q.options.map((opt, i) => (
                    <button
                      key={i}
                      disabled={submitting}
                      onClick={() => isRetryMode ? handleRetryAnswer(q.id, String(i + 1)) : handleAnswer(q.id, String(i + 1))}
                      className={`choice-btn ${currentAnswers[q.id] === String(i + 1) ? 'selected' : ''}`}
                    >
                      <span className="inline-flex w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-xs items-center justify-center mr-2 font-bold">
                        {i + 1}
                      </span>
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 네비게이션 */}
            <div className="flex gap-3">
              <button onClick={prev} disabled={current === 0} className="btn-secondary">
                <ChevronLeft size={18} />
              </button>
              <div className="flex gap-1 flex-1 overflow-x-auto py-1">
                {questions.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrent(i)}
                    className={`w-8 h-8 shrink-0 rounded-full text-xs font-bold transition-all ${
                      i === current
                        ? 'bg-green-600 text-white'
                        : hasAns(currentAnswers, questions[i].id)
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <button onClick={next} disabled={current === questions.length - 1} className="btn-secondary">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* 재풀기 결과 */}
        {isRetryMode && retryPhase === 'result' && (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="card p-8 w-full max-w-sm text-center">
              <RefreshCw size={48} className="text-orange-500 mx-auto mb-4" />
              <h2 className="text-2xl font-black text-gray-800 mb-1">재풀기 완료!</h2>
              <p className="text-gray-400 text-sm mb-6">틀린 문제 {retryQuestions.length}개 중</p>

              <div className="bg-orange-50 rounded-2xl p-6 mb-6">
                <div className="text-6xl font-black text-orange-500 mb-1">{retryScore}</div>
                <div className="text-orange-600 font-medium">점</div>
              </div>

              <div className="space-y-3 mb-6 text-left">
                {retryQuestions.map((item, i) => {
                  const myAns = retryAnswers[item.id];
                  const isCorrect = isAnswerCorrect(myAns, item.answer);
                  return (
                    <div key={item.id} className={`p-3 rounded-xl text-sm ${
                      isCorrect ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                    }`}>
                      <div className="flex items-start gap-2">
                        <span className={`font-bold shrink-0 ${isCorrect ? 'text-green-600' : 'text-red-500'}`}>
                          {isCorrect ? '✓' : '✗'} Q{i + 1}
                        </span>
                        <div>
                          <p className={`font-medium ${isCorrect ? 'text-green-800' : 'text-red-800'}`}>
                            {item.text.length > 40 ? item.text.slice(0, 40) + '…' : item.text}
                          </p>
                          {!isCorrect && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              정답: {formatCorrectAnswer(item)}
                            </p>
                          )}
                          {item.explanation && (
                            <p className="text-xs text-gray-400 mt-0.5 italic">{item.explanation}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col gap-2">
                <button onClick={exitRetry} className="btn-primary w-full">
                  전체 결과 보기
                </button>
                <button onClick={startRetry} className="btn-secondary w-full">
                  한 번 더 풀기
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 최종 결과 */}
        {phase === 'result' && !isRetryMode && (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="card p-8 w-full max-w-sm text-center">

              {/* ★ 전부 끝냈으면 완료 표시, 아니면 이번 유형만 끝난 상태 표시 */}
              {allDone ? (
                <>
                  <PartyPopper size={48} className="text-green-500 mx-auto mb-4" />
                  <h2 className="text-2xl font-black text-gray-800 mb-1">시험 끝!</h2>
                  <p className="text-gray-500 text-sm mb-4">
                    {studentName} · {examHasOx && examHasMulti ? 'OX와 4지선다를 모두 마쳤어요' : '수고했어요'}
                  </p>
                </>
              ) : (
                <>
                  <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
                  <h2 className="text-2xl font-black text-gray-800 mb-1">
                    {typeLabel ? `${typeLabel.text} 완료!` : '시험 완료!'}
                  </h2>
                  <p className="text-gray-400 text-sm mb-4">{studentName}의 결과</p>
                </>
              )}

              {/* 이번에 푼 유형 점수 */}
              <div className="bg-green-50 rounded-2xl p-6 mb-4">
                {typeLabel && (
                  <div className={`inline-block ${typeLabel.bg} ${typeLabel.color} text-xs font-bold px-2.5 py-1 rounded-full mb-2`}>
                    {typeLabel.text}
                  </div>
                )}
                <div className="text-6xl font-black text-green-600 mb-1">{score}</div>
                <div className="text-green-700 font-medium">점</div>
                <div className="text-xs text-gray-400 mt-1">
                  {filteredQuestions.length - wrongQuestions.length} / {filteredQuestions.length} 정답
                </div>
              </div>

              {/* ★ 두 유형을 다 끝냈을 때만: 종합 점수 카드
                  점수는 저장값과 같은 '전체 문항 기준'을 쓴다 */}
              {allDone && examHasOx && examHasMulti && summary && (
                <div className="rounded-2xl border-2 border-green-200 bg-white p-4 mb-4">
                  <div className="text-xs font-bold text-gray-400 tracking-wide mb-2">이 시험지 종합 결과</div>
                  <div className="text-4xl font-black text-green-600 leading-none">
                    {summary.overallScore}<span className="text-lg ml-1">점</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1 mb-3">
                    총 {summary.answeredCount}문항 중 {summary.totalCorrect}문항 정답
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 rounded-xl bg-green-50 py-2.5">
                      <div className="text-[11px] font-bold text-green-700 mb-0.5">OX퀴즈</div>
                      <div className="text-lg font-black text-green-700">
                        {summary.oxFullScore ?? 0}<span className="text-xs font-semibold ml-0.5">점</span>
                      </div>
                      <div className="text-[10px] text-gray-400">{summary.oxCorrect}/{summary.oxTotal}</div>
                    </div>
                    <div className="flex-1 rounded-xl bg-blue-50 py-2.5">
                      <div className="text-[11px] font-bold text-blue-700 mb-0.5">4지선다</div>
                      <div className="text-lg font-black text-blue-700">
                        {summary.multiFullScore ?? 0}<span className="text-xs font-semibold ml-0.5">점</span>
                      </div>
                      <div className="text-[10px] text-gray-400">{summary.multiCorrect}/{summary.multiTotal}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* ★ 아직 남은 유형이 있으면 안내 */}
              {!allDone && nextType && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 mb-4 text-sm text-amber-800 font-semibold">
                  아직 {nextTypeLabel}
                  {nextTypeCount > 0 ? ` ${nextTypeCount}문항이` : '가'} 남아 있어요
                </div>
              )}

              {wrongQuestions.length > 0 && (
                <div className="bg-red-50 rounded-xl px-4 py-3 mb-6 text-sm text-red-700 font-semibold">
                  ❌ 틀린 문제 {wrongQuestions.length}개
                </div>
              )}
              {wrongQuestions.length === 0 && (
                <div className="bg-green-50 rounded-xl px-4 py-3 mb-6 text-sm text-green-700 font-semibold">
                  🎉 모두 맞혔어요!
                </div>
              )}

              <div className="space-y-3 mb-6 text-left">
                {filteredQuestions.map((item, i) => {
                  const myAns = answers[item.id];
                  const isCorrect = isAnswerCorrect(myAns, item.answer);
                  return (
                    <div key={item.id} className={`p-3 rounded-xl text-sm ${
                      isCorrect ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                    }`}>
                      <div className="flex items-start gap-2">
                        <span className={`font-bold shrink-0 ${isCorrect ? 'text-green-600' : 'text-red-500'}`}>
                          {isCorrect ? '✓' : '✗'} Q{i + 1}
                        </span>
                        <div>
                          <p className={`font-medium ${isCorrect ? 'text-green-800' : 'text-red-800'}`}>
                            {item.text.length > 40 ? item.text.slice(0, 40) + '…' : item.text}
                          </p>
                          {!isCorrect && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              정답: {formatCorrectAnswer(item)}
                            </p>
                          )}
                          {item.explanation && (
                            <p className="text-xs text-gray-400 mt-0.5 italic">{item.explanation}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col gap-2">
                {wrongQuestions.length > 0 && (
                  <button
                    onClick={startRetry}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    <RefreshCw size={16} /> 틀린 문제 다시 풀기 ({wrongQuestions.length}개)
                  </button>
                )}

                {/* ★ 남은 유형이 실제로 있을 때만 이동 버튼을 만든다.
                    (OX만 있는 시험지에서 4지선다 버튼이 뜨던 문제도 이걸로 사라짐) */}
                {nextType && (
                  <button
                    onClick={() => {
                      if (submitting) { toast('성적 저장 중이에요. 잠시만요!'); return; }
                      window.location.href = crossTypeHref(nextType);
                    }}
                    className="btn-primary w-full"
                    style={{
                      background: nextType === 'ox'
                        ? 'linear-gradient(135deg, #10b981, #059669)'
                        : 'linear-gradient(135deg, #1a3fc4, #3b5bdb)'
                    }}
                  >
                    {nextTypeLabel} 풀러 가기 →
                  </button>
                )}

                <button onClick={goToList} className="btn-secondary w-full">
                  시험 목록으로
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function StudentExamPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-green-50">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <StudentExamInner />
    </Suspense>
  );
}
