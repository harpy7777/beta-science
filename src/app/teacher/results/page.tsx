'use client';
// src/app/teacher/results/page.tsx
// 관리자용 — 학생별 이름 · 틀린 개수 · 총점 확인 대시보드
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getAllResults, Result } from '@/lib/examService';
import {
  FlaskConical, ArrowLeft, Search,
  ChevronDown, ChevronUp, Download
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// ✏️  과목 목록 — 다른 파일들과 동일하게 유지하세요
// ─────────────────────────────────────────────────────────────────────────────
const GRADES = ['전체', '중1', '중2', '중3', '고1', '고2', '고3'];
// ─────────────────────────────────────────────────────────────────────────────

type SortKey = 'studentName' | 'grade' | 'subject' | 'score' | 'wrongCount' | 'startedAt';
type SortDir = 'asc' | 'desc';

function scoreColor(pct: number) {
  if (pct >= 90) return 'text-green-600 bg-green-50';
  if (pct >= 70) return 'text-blue-600 bg-blue-50';
  if (pct >= 50) return 'text-amber-600 bg-amber-50';
  return 'text-red-600 bg-red-50';
}

export default function ResultsDashboard() {
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(true);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);

  // 필터
  const [gradeFilter, setGradeFilter] = useState('전체');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('startedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push('/teacher'); return; }
      setAuthLoading(false);
      setLoading(true);
      try {
        const data = await getAllResults();
        setResults(data);
      } finally {
        setLoading(false);
      }
    });
    return unsub;
  }, [router]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  const filtered = results
    .filter(r => gradeFilter === '전체' || r.grade === gradeFilter)
    .filter(r =>
      search === '' ||
      r.studentName.includes(search) ||
      r.examTitle.includes(search) ||
      (r.subject ?? '').includes(search)
    )
    .sort((a, b) => {
      let av: string | number = '';
      let bv: string | number = '';
      if (sortKey === 'studentName') { av = a.studentName; bv = b.studentName; }
      else if (sortKey === 'grade') { av = a.grade; bv = b.grade; }
      else if (sortKey === 'subject') { av = a.subject ?? ''; bv = b.subject ?? ''; }
      else if (sortKey === 'score') { av = a.score ?? -1; bv = b.score ?? -1; }
      else if (sortKey === 'wrongCount') { av = a.wrongCount ?? -1; bv = b.wrongCount ?? -1; }
      else if (sortKey === 'startedAt') { av = a.startedAt; bv = b.startedAt; }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  // 요약 통계
  const completed = results.filter(r => r.score !== null);
  const avgScore = completed.length
    ? Math.round(completed.reduce((s, r) => s + (r.score! / r.totalQuestions) * 100, 0) / completed.length)
    : 0;

  // CSV 다운로드
  function downloadCSV() {
    const header = ['이름', '학년', '과목', '시험지', '총문항', '맞은수', '틀린수', '점수(%)', '응시시각'].join(',');
    const rows = filtered.map(r => {
      const correct = r.score ?? '-';
      const wrong = r.wrongCount ?? '-';
      const pct = r.score !== null ? Math.round((r.score / r.totalQuestions) * 100) : '-';
      return [r.studentName, r.grade, r.subject ?? '', r.examTitle, r.totalQuestions, correct, wrong, pct, r.startedAt].join(',');
    });
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = '성적결과.csv';
    a.click(); URL.revokeObjectURL(url);
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <span className="text-gray-200 text-xs">↕</span>;
    return sortDir === 'asc'
      ? <ChevronUp size={13} className="text-green-600" />
      : <ChevronDown size={13} className="text-green-600" />;
  }

  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── 헤더 ── */}
      <header className="bg-white border-b border-green-100 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
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
            <div className="font-bold text-green-900 text-sm">성적 결과 관리</div>
          </div>
          <button onClick={downloadCSV} className="btn-secondary text-sm flex items-center gap-1.5">
            <Download size={15} /> CSV 다운로드
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* ── 요약 카드 ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: '총 응시', value: results.length + '명' },
            { label: '완료', value: completed.length + '명' },
            { label: '평균 점수', value: avgScore + '%' },
            { label: '오늘 응시', value: results.filter(r => r.startedAt.startsWith(new Date().toISOString().slice(0,10))).length + '명' },
          ].map(c => (
            <div key={c.label} className="card p-4">
              <div className="text-xs text-gray-400 mb-1">{c.label}</div>
              <div className="text-2xl font-black text-gray-800">{c.value}</div>
            </div>
          ))}
        </div>

        {/* ── 필터 & 검색 ── */}
        <div className="flex flex-wrap gap-3 items-center">
          {/* 학년 필터 */}
          <div className="flex gap-1.5 flex-wrap">
            {GRADES.map(g => (
              <button key={g} onClick={() => setGradeFilter(g)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                  gradeFilter === g
                    ? 'bg-green-600 text-white border-green-600'
                    : 'border-gray-200 text-gray-500 hover:border-green-300'
                }`}>{g}</button>
            ))}
          </div>
          {/* 검색 */}
          <div className="flex-1 min-w-[200px] relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
            <input
              type="text"
              className="input-field pl-8 text-sm py-2"
              placeholder="이름 · 시험지명 · 과목 검색"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <span className="text-xs text-gray-400 shrink-0">{filtered.length}건</span>
        </div>

        {/* ── 결과 테이블 ── */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="card p-16 text-center border-dashed border-2 border-gray-100">
            <div className="text-gray-300 text-4xl mb-3">📋</div>
            <div className="text-gray-400 font-medium">결과 데이터가 없습니다</div>
          </div>
        ) : (
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    {[
                      { key: 'studentName', label: '이름' },
                      { key: 'grade', label: '학년' },
                      { key: 'subject', label: '과목' },
                      { key: null, label: '시험지' },
                      { key: 'wrongCount', label: '틀린 수' },
                      { key: 'score', label: '점수' },
                      { key: 'startedAt', label: '응시 시각' },
                    ].map(col => (
                      <th key={col.label}
                        className={`px-4 py-3 text-left text-xs font-bold text-gray-500 whitespace-nowrap ${col.key ? 'cursor-pointer hover:text-green-700 select-none' : ''}`}
                        onClick={() => col.key && toggleSort(col.key as SortKey)}
                      >
                        <span className="flex items-center gap-1">
                          {col.label}
                          {col.key && <SortIcon k={col.key as SortKey} />}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => {
                    const pct = r.score !== null ? Math.round((r.score / r.totalQuestions) * 100) : null;
                    const wrong = r.wrongCount ?? (r.score !== null ? r.totalQuestions - r.score : null);
                    return (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        {/* 이름 */}
                        <td className="px-4 py-3 font-semibold text-gray-800">{r.studentName}</td>
                        {/* 학년 */}
                        <td className="px-4 py-3">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">{r.grade}</span>
                        </td>
                        {/* 과목 */}
                        <td className="px-4 py-3 text-gray-600 text-xs">{r.subject ?? '-'}</td>
                        {/* 시험지 */}
                        <td className="px-4 py-3 text-gray-700 max-w-[180px] truncate">{r.examTitle}</td>
                        {/* 틀린 수 ★ */}
                        <td className="px-4 py-3 text-center">
                          {wrong !== null
                            ? <span className={`text-sm font-black px-2.5 py-1 rounded-lg ${wrong === 0 ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
                                {wrong}개
                              </span>
                            : <span className="text-gray-300 text-xs">-</span>}
                        </td>
                        {/* 점수 ★ */}
                        <td className="px-4 py-3 text-center">
                          {pct !== null
                            ? <span className={`text-sm font-black px-2.5 py-1 rounded-lg ${scoreColor(pct)}`}>
                                {r.score}/{r.totalQuestions} <span className="font-normal text-xs">({pct}%)</span>
                              </span>
                            : <span className="text-gray-300 text-xs">미완료</span>}
                        </td>
                        {/* 응시 시각 */}
                        <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                          {r.startedAt ? new Date(r.startedAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
