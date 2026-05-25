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
  ArrowLeft, Plus, Trash2,
  Send, Save, CheckCircle, FileText,
  ExternalLink, ChevronDown, ChevronUp, FlaskConical
} from 'lucide-react';
import toast from 'react-hot-toast';

type Step = 1 | 2 | 3;

// ─────────────────────────────────────────────────────────────────────────────
// ✏️  과목 목록 — 여기만 수정하면 전체 반영됩니다
// ─────────────────────────────────────────────────────────────────────────────
const GRADES = ['중1', '중2', '중3', '고1', '고2', '고3'];

@@ -283,7 +281,7 @@
    if (allQuestions.length === 0) { toast.error('문제를 1개 이상 입력하세요'); return; }
    setSaving(true);
    try {
     const payload = {
      const payload = {
        title: title.trim(),
        teacherId: user!.uid,
        questions: allQuestions,
@@ -328,43 +326,42 @@

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#fdf2f8' }}>
        <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#f472b6', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  // ── 공통 인풋 스타일
  const inputCls = "w-full border border-pink-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-pink-400 transition-colors bg-white";

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
      <header className="bg-white border-b border-pink-100 sticky top-0 z-50">
        <div className="w-full px-4 sm:px-6 h-14 flex items-center justify-between">

          {/* 왼쪽: 로고 + 타이틀 */}
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => router.push('/teacher')}>
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#f472b6,#db2777)' }}
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">선생님 홈</span>
            </button>
            <div className="h-5 w-px bg-gray-200" />
            <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
              <FlaskConical size={16} className="text-white" />
              <FlaskConical size={15} className="text-white" />
            </div>
            <div>
              <div className="font-bold text-green-900 text-sm">{editId ? '시험지 수정' : '시험지 만들기'}</div>
              <div className="text-xs text-green-600">
                {grade && subject ? `${grade} · ${subject}` : title || '정보 미입력'}
              <div className="font-semibold text-gray-900 text-sm leading-tight">
                {editId ? '시험지 수정' : '시험지 만들기'}
              </div>
              <div className="text-xs" style={{ color: '#db2777' }}>
                {grade && subject ? `${grade} · ${subject}` : title || '베타과학학원'}
              </div>
            </div>
          </div>

          {/* 스텝 표시 */}
          <div className="hidden sm:flex items-center gap-2">
          {/* 스텝 인디케이터 (중간) */}
          <div className="hidden sm:flex items-center gap-1.5">
            {([1, 2, 3] as Step[]).map(s => (
              <button
                key={s}
@@ -374,11 +371,14 @@
                  }
                  setStep(s);
                }}
                className={`w-8 h-8 rounded-full text-sm font-bold transition-all ${
                  step === s ? 'bg-green-600 text-white'
                  : step > s ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-400'
                }`}
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
@@ -387,173 +387,272 @@

          {/* 오른쪽 버튼 */}
          <div className="flex gap-2">
            <button onClick={() => handleSave(false)} disabled={saving} className="btn-secondary text-sm flex items-center gap-1.5">
              <Save size={15} /> 임시저장
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
              className="btn-primary text-sm flex items-center gap-1.5"
              className="flex items-center gap-1.5 text-sm font-semibold text-white px-3 py-2 rounded-xl transition-opacity disabled:opacity-50 hover:opacity-85"
              style={{ background: 'linear-gradient(135deg,#f472b6,#db2777)' }}
            >
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : saved ? <CheckCircle size={15} />
                : step < 3 ? <Eye size={15} />
                : <Send size={15} />}
              {saving ? '저장 중...' : saved ? '완료!' : step < 3 ? '미리보기' : '게시하기'}
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

      <main className="max-w-3xl mx-auto px-4 py-8">
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
          <div className="max-w-lg mx-auto">
            <div className="card p-8">
              <div className="mb-6">
                <div className="w-10 h-10 rounded-full bg-green-600 text-white flex items-center justify-center font-bold text-base mb-4">1</div>
                <h2 className="text-xl font-black text-gray-800 mb-1">시험지 기본 정보</h2>
                <p className="text-sm text-gray-400">학년 · 과목 · 단원명을 입력하세요</p>
              </div>
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
              <div className="mb-5">
                <label className="block text-sm font-semibold text-gray-700 mb-2">학년</label>
              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
                  학년 <span style={{ color: '#db2777' }}>*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {GRADES.map(g => (
                    <button key={g} type="button" onClick={() => handleGradeChange(g)}
                      className={`py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${
                    <button
                      key={g}
                      type="button"
                      onClick={() => handleGradeChange(g)}
                      className="py-2.5 rounded-xl text-sm font-bold border-2 transition-all"
                      style={
                        grade === g
                          ? 'bg-green-600 text-white border-green-600'
                          : 'border-gray-200 text-gray-500 hover:border-green-300 hover:text-green-600'
                      }`}>{g}</button>
                          ? { background: 'linear-gradient(135deg,#f472b6,#db2777)', color: '#fff', borderColor: '#db2777' }
                          : { borderColor: '#fce7f3', color: '#9ca3af' }
                      }
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* 과목 — 학년 선택 후 표시 */}
              {/* 과목 */}
              {grade && (
                <div className="mb-5">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">과목</label>
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
                    과목 <span style={{ color: '#db2777' }}>*</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {subjectList.map(s => (
                      <button key={s} type="button" onClick={() => setSubject(s)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSubject(s)}
                        className="px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all"
                        style={
                          subject === s
                            ? 'bg-green-600 text-white border-green-600'
                            : 'border-gray-200 text-gray-500 hover:border-green-300 hover:text-green-600'
                        }`}>{s}</button>
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
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">단원명</label>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">단원명</label>
                <input
                  type="text"
                  className="input-field text-base font-semibold"
                  className={inputCls}
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
          <div className="space-y-5">
          <div className="space-y-4">

            {/* 요약 배지 */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-green-100 text-green-700">{grade}</span>
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-green-100 text-green-700">{subject}</span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: '#fce7f3', color: '#db2777' }}>{grade}</span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">{subject}</span>
              <span className="text-sm font-semibold text-gray-700">{title}</span>
            </div>

            {/* OX */}
            <div className="card p-0 overflow-hidden">
              <button onClick={() => setOxOpen(o => !o)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors">
            {/* OX 섹션 */}
            <div className="bg-white border border-pink-100 rounded-2xl overflow-hidden">
              <button
                onClick={() => setOxOpen(o => !o)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-pink-50/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">OX 문제</span>
                  <span className="font-bold text-gray-800">OX 일괄 입력</span>
                  {oxParsed.length > 0 && <span className="text-xs text-green-600 font-semibold">✓ {oxParsed.length}개 로드됨</span>}
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#dcfce7', color: '#15803d' }}>OX 문제</span>
                  <span className="font-bold text-gray-800 text-sm">OX 일괄 입력</span>
                  {oxParsed.length > 0 && (
                    <span className="text-xs font-semibold" style={{ color: '#16a34a' }}>✓ {oxParsed.length}개 로드됨</span>
                  )}
                </div>
                {oxOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                {oxOpen ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
              </button>

              {oxOpen && (
                <div className="px-5 pb-5 border-t border-gray-100">
                  <div className="bg-green-50 rounded-xl p-3 my-4 text-xs text-green-800 leading-relaxed">
                <div className="px-5 pb-5 border-t border-pink-50">
                  {/* 입력 형식 안내 */}
                  <div className="rounded-xl p-3 my-4 text-xs leading-relaxed" style={{ background: '#f0fdf4', color: '#166534' }}>
                    <strong>입력 형식</strong> (문제 사이 빈 줄로 구분)<br />
                    <code className="block mt-1 bg-white rounded p-2 text-green-900 whitespace-pre">{`문제: 물은 H2O로 표현된다.
                    <code className="block mt-1 bg-white rounded p-2 whitespace-pre" style={{ color: '#15803d' }}>{`문제: 물은 H2O로 표현된다.
정답: O
해설: 물 분자는 수소 2개, 산소 1개입니다.

문제: 지구는 태양계의 중심이다.
정답: X
해설: 태양이 중심입니다.`}</code>
                  </div>
                  <textarea className="input-field resize-none font-mono text-sm" rows={8}

                  <textarea
                    className={`${inputCls} resize-none font-mono`}
                    rows={8}
                    placeholder={`문제: \n정답: O\n해설: \n\n문제: \n정답: X\n해설: `}
                    value={oxBulk} onChange={e => setOxBulk(e.target.value)} />
                    value={oxBulk}
                    onChange={e => setOxBulk(e.target.value)}
                  />

                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-gray-400">
                      {oxBulk.trim().split(/\n\s*\n/).filter(b => b.includes('문제:')).length}개 감지됨
                    </span>
                    <button onClick={handleOxParse} className="btn-primary text-sm px-4 py-2">가져오기 →</button>
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
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">로드된 OX 문제 ({oxParsed.length}개)</div>
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        로드된 OX 문제 ({oxParsed.length}개)
                      </div>
                      {oxParsed.map((q, i) => (
                        <div key={q.id} className="flex items-start gap-3 bg-gray-50 rounded-lg px-3 py-2">
                          <span className="text-xs text-gray-400 mt-0.5 shrink-0">Q{i+1}</span>
                        <div key={q.id} className="flex items-start gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                          <span className="text-xs text-gray-400 mt-0.5 shrink-0">Q{i + 1}</span>
                          <span className="flex-1 text-sm text-gray-700 line-clamp-1">{q.text}</span>
                          <span className={`text-sm font-bold shrink-0 ${q.answer === 'O' ? 'text-green-600' : 'text-red-500'}`}>{q.answer}</span>
                          <button onClick={() => setOxParsed(prev => prev.filter((_, idx) => idx !== i))} className="text-gray-300 hover:text-red-400 shrink-0"><Trash2 size={13} /></button>
                          <button
                            onClick={() => setOxParsed(prev => prev.filter((_, idx) => idx !== i))}
                            className="text-gray-300 hover:text-red-400 shrink-0 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={() => setOxParsed(prev => [...prev, makeQuestion('ox')])} className="btn-secondary text-xs mt-3 flex items-center gap-1">

                  <button
                    onClick={() => setOxParsed(prev => [...prev, makeQuestion('ox')])}
                    className="flex items-center gap-1.5 text-xs font-semibold mt-3 px-3 py-2 rounded-xl border transition-colors"
                    style={{ borderColor: '#fce7f3', color: '#db2777' }}
                  >
                    <Plus size={13} /> OX 문제 1개 추가
                  </button>
                </div>
              )}
            </div>

            {/* 4지선다 */}
            <div className="card p-0 overflow-hidden">
              <button onClick={() => setMcOpen(o => !o)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors">
            {/* 4지선다 섹션 */}
            <div className="bg-white border border-pink-100 rounded-2xl overflow-hidden">
              <button
                onClick={() => setMcOpen(o => !o)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-pink-50/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">4지선다</span>
                  <span className="font-bold text-gray-800">4지선다 일괄 입력</span>
                  {mcParsed.length > 0 && <span className="text-xs text-blue-600 font-semibold">✓ {mcParsed.length}개 로드됨</span>}
                  <span className="font-bold text-gray-800 text-sm">4지선다 일괄 입력</span>
                  {mcParsed.length > 0 && (
                    <span className="text-xs font-semibold text-blue-600">✓ {mcParsed.length}개 로드됨</span>
                  )}
                </div>
                {mcOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                {mcOpen ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
              </button>

              {mcOpen && (
                <div className="px-5 pb-5 border-t border-gray-100">
                  <div className="bg-blue-50 rounded-xl p-3 my-4 text-xs text-blue-800 leading-relaxed">
                <div className="px-5 pb-5 border-t border-pink-50">
                  <div className="rounded-xl p-3 my-4 text-xs leading-relaxed bg-blue-50 text-blue-800">
                    <strong>입력 형식</strong> (문제 사이 빈 줄로 구분)<br />
                    <code className="block mt-1 bg-white rounded p-2 text-blue-900 whitespace-pre">{`문제: 광합성을 하는 세포 소기관은?
선택지1: 미토콘드리아
@@ -563,42 +662,79 @@
정답: 엽록체
해설: 엽록체는 광합성을 담당합니다.`}</code>
                  </div>
                  <textarea className="input-field resize-none font-mono text-sm" rows={10}

                  <textarea
                    className={`${inputCls} resize-none font-mono`}
                    rows={10}
                    placeholder={`문제: \n선택지1: \n선택지2: \n선택지3: \n선택지4: \n정답: \n해설: `}
                    value={mcBulk} onChange={e => setMcBulk(e.target.value)} />
                    value={mcBulk}
                    onChange={e => setMcBulk(e.target.value)}
                  />

                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-gray-400">
                      {mcBulk.trim().split(/\n\s*\n/).filter(b => b.includes('문제:')).length}개 감지됨
                    </span>
                    <button onClick={handleMcParse} className="btn-primary text-sm px-4 py-2">가져오기 →</button>
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
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">로드된 4지선다 ({mcParsed.length}개)</div>
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        로드된 4지선다 ({mcParsed.length}개)
                      </div>
                      {mcParsed.map((q, i) => (
                        <div key={q.id} className="flex items-start gap-3 bg-gray-50 rounded-lg px-3 py-2">
                          <span className="text-xs text-gray-400 mt-0.5 shrink-0">Q{i+1}</span>
                        <div key={q.id} className="flex items-start gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                          <span className="text-xs text-gray-400 mt-0.5 shrink-0">Q{i + 1}</span>
                          <span className="flex-1 text-sm text-gray-700 line-clamp-1">{q.text}</span>
                          <span className="text-xs text-blue-600 font-semibold shrink-0">{q.answer}번</span>
                          <button onClick={() => setMcParsed(prev => prev.filter((_, idx) => idx !== i))} className="text-gray-300 hover:text-red-400 shrink-0"><Trash2 size={13} /></button>
                          <button
                            onClick={() => setMcParsed(prev => prev.filter((_, idx) => idx !== i))}
                            className="text-gray-300 hover:text-red-400 shrink-0 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={() => setMcParsed(prev => [...prev, makeQuestion('multiple')])} className="btn-secondary text-xs mt-3 flex items-center gap-1">

                  <button
                    onClick={() => setMcParsed(prev => [...prev, makeQuestion('multiple')])}
                    className="flex items-center gap-1.5 text-xs font-semibold mt-3 px-3 py-2 rounded-xl border transition-colors"
                    style={{ borderColor: '#dbeafe', color: '#1d4ed8' }}
                  >
                    <Plus size={13} /> 4지선다 1개 추가
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <button onClick={() => setStep(1)} className="btn-ghost text-sm flex items-center gap-1">
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
                <span className="text-sm text-gray-500">총 {allQuestions.length}문항</span>
                <button onClick={() => { if (allQuestions.length === 0) { toast.error('문제를 1개 이상 입력하세요'); return; } setStep(3); }} className="btn-primary text-sm">
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
@@ -608,92 +744,167 @@

        {/* ── STEP 3: 미리보기 & 게시 ── */}
        {step === 3 && (
          <div className="max-w-2xl mx-auto space-y-5">
            <div className="card p-6">
          <div className="space-y-4">

            {/* 시험지 요약 카드 */}
            <div className="bg-white border border-pink-100 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">{grade}</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">{subject}</span>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: '#fce7f3', color: '#db2777' }}>{grade}</span>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">{subject}</span>
                  </div>
                  <h2 className="text-xl font-black text-gray-800">{title}</h2>
                  <p className="text-sm text-gray-400 mt-0.5">
                  <h2 className="text-lg font-black text-gray-800">{title}</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    총 {allQuestions.length}문항 · OX {oxParsed.length}개 / 4지선다 {mcParsed.length}개
                  </p>
                </div>
                <button onClick={() => setStep(2)} className="btn-secondary text-sm">수정하기</button>
                <button
                  onClick={() => setStep(2)}
                  className="text-xs font-semibold px-3 py-2 rounded-xl border transition-colors"
                  style={{ borderColor: '#fce7f3', color: '#db2777' }}
                >
                  수정하기
                </button>
              </div>
              <div className="space-y-3">

              {/* 문제 목록 */}
              <div className="space-y-2.5">
                {allQuestions.map((q, i) => (
                  <div key={q.id} className="border border-gray-100 rounded-xl p-4">
                  <div key={q.id} className="border border-pink-50 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <span className={`shrink-0 text-xs px-2 py-0.5 rounded font-bold mt-0.5 ${q.type === 'ox' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{i+1}</span>
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
                        <p className="text-gray-800 font-medium text-sm leading-relaxed">{q.text || <span className="text-red-400">⚠ 문제 미입력</span>}</p>
                        <p className="text-gray-800 font-medium text-sm leading-relaxed">
                          {q.text || <span className="text-red-400">⚠ 문제 미입력</span>}
                        </p>
                        {q.type === 'ox' && (
                          <div className="flex gap-2 mt-2">
                            {['O','X'].map(v => (
                              <span key={v} className={`px-3 py-1 rounded-lg text-sm font-bold border ${q.answer === v ? v==='O' ? 'bg-green-100 text-green-700 border-green-300' : 'bg-red-100 text-red-600 border-red-300' : 'bg-gray-50 text-gray-300 border-gray-200'}`}>{v}</span>
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
                              <span key={j} className={`px-2 py-1.5 rounded-lg text-xs border ${q.answer === String(j+1) ? 'bg-green-100 text-green-700 border-green-300 font-semibold' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                                <span className="font-bold mr-1">{j+1}.</span>{opt || '(미입력)'}
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
                        {q.explanation && <p className="text-xs text-gray-400 mt-2 italic">💡 {q.explanation}</p>}
                        {q.explanation && (
                          <p className="text-xs text-gray-400 mt-2 italic">💡 {q.explanation}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-5 border-2 border-dashed border-green-200 bg-green-50/40">
            {/* CodePen 배포 카드 */}
            <div
              className="bg-white border-2 border-dashed rounded-2xl p-5"
              style={{ borderColor: '#f9a8d4' }}
            >
              <div className="flex items-start gap-3 mb-4">
                <FileText size={20} className="text-green-600 shrink-0 mt-0.5" />
                <FileText size={20} className="shrink-0 mt-0.5" style={{ color: '#db2777' }} />
                <div className="flex-1">
                  <div className="font-bold text-gray-800 text-sm mb-1">CodePen으로 배포하기</div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    1. 아래 버튼으로 CodePen 열기 → Ctrl+S 저장 → URL 복사<br />
                    2. 복사한 URL을 아래에 붙여넣으면 학생 목록에 자동 연결됩니다.
                  </p>
                </div>
                <button onClick={openCodePen} className="btn-secondary text-xs flex items-center gap-1.5 shrink-0 border-green-300 text-green-700 hover:bg-green-50">
                <button
                  onClick={openCodePen}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-colors shrink-0"
                  style={{ borderColor: '#f9a8d4', color: '#db2777' }}
                >
                  <ExternalLink size={13} /> CodePen 열기
                </button>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">CodePen URL (저장 후 붙여넣기)</label>
                <input type="url" className="input-field text-sm" placeholder="https://codepen.io/..."
                  value={codepenUrl} onChange={e => setCodepenUrl(e.target.value)} />
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                  CodePen URL (저장 후 붙여넣기)
                </label>
                <input
                  type="url"
                  className={inputCls}
                  placeholder="https://codepen.io/..."
                  value={codepenUrl}
                  onChange={e => setCodepenUrl(e.target.value)}
                />
              </div>
            </div>

            {/* 저장 완료 메시지 */}
            {saved && (
              <div className="card p-4 bg-green-50 border border-green-200">
                <div className="flex items-center gap-2 text-green-700 font-semibold text-sm">
                  <CheckCircle size={16} />
              <div className="rounded-2xl p-4 border flex items-center gap-2" style={{ background: '#fdf2f8', borderColor: '#f9a8d4' }}>
                <CheckCircle size={16} style={{ color: '#db2777' }} />
                <span className="text-sm font-semibold" style={{ color: '#db2777' }}>
                  저장 완료! 학생들이 학년 · 과목으로 바로 찾을 수 있어요.
                </div>
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => handleSave(false)} disabled={saving} className="btn-secondary py-4 text-base flex items-center justify-center gap-2">
                <Save size={18} /> 임시저장
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
              <button onClick={() => handleSave(true)} disabled={saving} className="btn-primary py-4 text-base flex items-center justify-center gap-2">
                {saving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send size={18} />}
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
            <p className="text-xs text-center text-gray-400">게시하면 학생들이 학년 · 과목으로 필터링해서 바로 찾을 수 있어요</p>

            <p className="text-xs text-center text-gray-400 pb-4">
              게시하면 학생들이 학년 · 과목으로 필터링해서 바로 찾을 수 있어요
            </p>
          </div>
        )}
      </main>
@@ -704,8 +915,8 @@
export default function CreateExamPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#fdf2f8' }}>
        <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#f472b6', borderTopColor: 'transparent' }} />
      </div>
    }>
      <CreateExamInner />
