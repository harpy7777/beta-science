<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8"><script src="/favicon.js"></script>
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="theme-color" content="#db2777">
<meta name="robots" content="noindex, nofollow">
<title>인후쌤의 과학 수업 관리 시스템 · 과학 개념 지도</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
html { -webkit-text-size-adjust: 100%; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif;
  background: #fafafa; color: #1d1d1f; min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  overscroll-behavior-y: none;
}

/* — Header — */
.header {
  background: #fff; border-bottom: 1px solid #fce7f3;
  padding: 0 1rem;
  padding-left: max(1rem, env(safe-area-inset-left));
  padding-right: max(1rem, env(safe-area-inset-right));
  height: 54px;
  display: flex; align-items: center; justify-content: center;
  position: sticky; top: 0; z-index: 300;
}
.header-inner { display: flex; align-items: center; gap: 10px; min-width: 0; width: 100%; max-width: 1080px; }
.logo {
  width: 32px; height: 32px;
  background: linear-gradient(135deg,#f472b6,#db2777);
  border-radius: 9px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  color: #fff; font-size: 15px; font-weight: 800;
}
.brand { font-size: 15px; font-weight: 700; color: #1d1d1f; line-height: 1.2; }
.brand-sub { font-size: 11px; color: #db2777; font-weight: 600; margin-top: 1px; }
.header-spacer { flex: 1; }
.hbtn {
  border: 1px solid #fce7f3; background: #fff; color: #db2777;
  font-size: 12px; font-weight: 700; padding: 7px 11px; border-radius: 9px; cursor: pointer;
  font-family: inherit; white-space: nowrap; text-decoration: none; display: inline-flex; align-items: center;
  min-height: 34px;
}
.hbtn:hover { background: #fdf2f8; }

/* — Layout — */
.wrap { max-width: 1080px; margin: 0 auto; padding: 1rem; padding-bottom: 4rem; }
.card {
  background: #fff; border: 1px solid #fce7f3; border-radius: 18px;
  padding: 1.25rem; margin-bottom: 1rem;
  box-shadow: 0 4px 24px rgba(219,39,119,0.08);
}
.card-title { font-size: 1.05rem; font-weight: 700; color: #1d1d1f; margin-bottom: 0.9rem; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.card-title .tag { font-size: 11px; font-weight: 700; color: #db2777; background: #fdf2f8; padding: 3px 8px; border-radius: 999px; }
.field-label { font-size: 11px; font-weight: 700; color: #db2777; letter-spacing: 0.05em; margin-bottom: 6px; display: block; }
.muted { color: #86868b; font-size: 12px; line-height: 1.6; }

/* — Controls — */
.controls { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
select, input[type=text] {
  width: 100%; font-family: inherit; font-size: 14px; color: #1d1d1f;
  padding: 10px 12px; border: 1px solid #f3d6e6; border-radius: 11px; background: #fff;
  appearance: none; -webkit-appearance: none;
}
select:focus, input:focus { outline: 2px solid #f9a8d4; outline-offset: 1px; }
select[multiple] { padding: 6px; appearance: none; -webkit-appearance: none; }
select[multiple] option { padding: 5px 7px; border-radius: 6px; font-size: 13px; }
select[multiple] optgroup { font-size: 11px; color: #db2777; font-weight: 700; }

/* — Banner — */
.banner {
  border-radius: 14px; padding: 0.85rem 1rem; margin-bottom: 1rem;
  font-size: 13px; line-height: 1.65; border: 1px solid;
}
.banner b { font-weight: 700; }
.banner.info { background: #fdf2f8; border-color: #fbcfe8; color: #9d174d; }
.banner.warnbox { background: #fffbeb; border-color: #fde68a; color: #92400e; }
.banner.okbox { background: #ecfdf5; border-color: #a7f3d0; color: #065f46; }

/* — Stat strip — */
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; }
.stat { background: #fdf2f8; border: 1px solid #fce7f3; border-radius: 14px; padding: 0.85rem; text-align: center; }
.stat .v { font-size: 1.5rem; font-weight: 800; color: #db2777; line-height: 1.1; }
.stat .l { font-size: 11px; color: #86868b; margin-top: 4px; font-weight: 600; }
.stat .s { font-size: 10px; color: #b0b0b5; margin-top: 2px; }

/* — 영역별 한 줄 요약 — */
.asum { margin-bottom: 1rem; }
.asum-row { padding: 0.7rem 0; border-bottom: 1px solid #f7f7f8; }
.asum-row:last-child { border-bottom: none; }
.asum-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.asum-name { font-size: 13.5px; font-weight: 700; color: #1d1d1f; }
.asum-state { font-size: 11px; font-weight: 800; padding: 3px 9px; border-radius: 999px; white-space: nowrap; }
.asum-num { margin-left: auto; font-size: 11px; color: #b0b0b5; font-weight: 600; white-space: nowrap; }
.asum-bar { display: flex; height: 7px; border-radius: 999px; overflow: hidden; background: #f1f1f4; margin-top: 8px; }
.asum-bar i { display: block; height: 100%; }

/* — Focus cards — */
.focus { border: 1px solid #fde68a; background: #fffbeb; border-radius: 14px; padding: 1rem; margin-bottom: 10px; }
.focus h4 { font-size: 15px; font-weight: 800; color: #1d1d1f; margin-bottom: 6px; }
.focus p { font-size: 13px; line-height: 1.7; color: #4b4b50; }
.focus .why { margin-top: 8px; font-size: 12px; color: #86868b; }
.focus .go {
  display: inline-block; margin-top: 10px; font-size: 12px; font-weight: 700;
  color: #db2777; background: #fff; border: 1px solid #fce7f3;
  padding: 7px 12px; border-radius: 9px; text-decoration: none;
}

/* — Tabs — */
.tabs { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px; margin-bottom: 0.9rem; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
.tabs::-webkit-scrollbar { display: none; }
.tab {
  flex-shrink: 0; font-family: inherit; font-size: 13px; font-weight: 700;
  padding: 8px 14px; border-radius: 999px; border: 1px solid #fce7f3;
  background: #fff; color: #86868b; cursor: pointer;
}
.tab.on { background: #db2777; color: #fff; border-color: #db2777; }

/* — Map — */
.mapbox { overflow-x: auto; overflow-y: hidden; -webkit-overflow-scrolling: touch; border-radius: 12px; background: #fdfdfd; border: 1px solid #f5f5f7; }
.mapbox svg { display: block; }
.legend { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 0.8rem; }
.legend span { font-size: 11px; color: #86868b; display: flex; align-items: center; gap: 5px; font-weight: 600; }
.legend i { width: 11px; height: 11px; border-radius: 3px; display: inline-block; border: 1px solid rgba(0,0,0,0.08); }
.maphint { font-size: 11px; color: #b0b0b5; margin-top: 6px; }

/* — Table — */
.tbl { width: 100%; border-collapse: collapse; font-size: 13px; table-layout: fixed; }
.tbl th { font-size: 11px; color: #db2777; font-weight: 700; padding: 8px 10px; border-bottom: 1px solid #fce7f3; white-space: nowrap; }
.tbl td { padding: 9px 10px; border-bottom: 1px solid #f7f7f8; vertical-align: middle; }
.tbl tr:last-child td { border-bottom: none; }
.tbl .c-std   { width: 24%; text-align: center; }
.tbl .c-name  { width: 28%; text-align: center; }
.tbl .c-num   { width: 13%; text-align: center; }
.tbl .c-rate  { width: 16%; text-align: center; }
.tbl .c-state { width: 19%; text-align: center; }
.pill { font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 999px; white-space: nowrap; display: inline-block; }
.nlink { color: #1d1d1f; text-decoration: none; font-weight: 600; }
.nlink:hover { color: #db2777; text-decoration: underline; }
.col-hide { display: table-cell; }

/* — 상태 안내 (표 아래 범례 + 대응) — */
.guide { margin-top: 1.15rem; border-top: 1px solid #f3f3f5; padding-top: 1rem; }
.guide-t { font-size: 11px; font-weight: 800; color: #86868b; letter-spacing: 0.06em; margin-bottom: 0.85rem; }
.guide-item { display: grid; grid-template-columns: 124px 1fr; gap: 14px; padding: 0.8rem 0; border-bottom: 1px solid #f7f7f8; align-items: start; }
.guide-item:last-child { border-bottom: none; }
.guide-l { text-align: center; }
.guide-cri { display: block; font-size: 10.5px; color: #b0b0b5; margin-top: 6px; font-weight: 600; line-height: 1.45; }
.guide-mean { font-size: 13px; line-height: 1.7; color: #3a3a3e; }

/* — Exam tagging — */
.exrow { display: grid; grid-template-columns: 1fr minmax(240px, 320px); gap: 12px; align-items: start; padding: 12px 0; border-bottom: 1px solid #f7f7f8; }
.exrow:last-child { border-bottom: none; }
.exname { font-size: 13px; font-weight: 600; color: #1d1d1f; word-break: break-all; }
.exmeta { font-size: 11px; color: #b0b0b5; margin-top: 3px; }
.exchosen { font-size: 11px; color: #db2777; font-weight: 600; margin-top: 5px; line-height: 1.6; }
.exsel { width: 100%; }
.btn {
  font-family: inherit; font-size: 13px; font-weight: 700; padding: 10px 16px;
  border-radius: 11px; border: none; cursor: pointer;
  background: linear-gradient(135deg,#f472b6,#db2777); color: #fff;
}
.btn:disabled { opacity: 0.45; cursor: not-allowed; }
.btn.ghost { background: #fff; color: #db2777; border: 1px solid #fce7f3; }

details.diag { border: 1px solid #f3d6e6; border-radius: 12px; padding: 0.8rem 1rem; background: #fffdfe; }
details.diag summary { cursor: pointer; font-size: 13px; font-weight: 700; color: #db2777; }
pre.dump {
  margin-top: 0.7rem; background: #1d1d1f; color: #e8e8ed; padding: 0.9rem;
  border-radius: 10px; font-size: 11px; line-height: 1.6; overflow-x: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre-wrap; word-break: break-all;
}

@media (max-width: 640px) {
  .wrap { padding: 0.75rem; }
  .card { padding: 1rem; border-radius: 15px; }
  .brand { font-size: 13px; }
  .brand-sub { font-size: 10px; }
  .col-hide { display: none; }
  .tbl { font-size: 12px; }
  .tbl th, .tbl td { padding: 8px 5px; }
  .exrow { grid-template-columns: 1fr; gap: 8px; }
  .exsel { min-width: 0; width: 100%; }
  .stat .v { font-size: 1.25rem; }
  .asum-num { margin-left: 0; width: 100%; }
  .guide-item { grid-template-columns: 1fr; gap: 7px; }
  .guide-l { text-align: left; }
  .guide-cri { display: inline; margin-top: 0; margin-left: 7px; }
}
@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
</style>
</head>
<body>

<header class="header">
  <div class="header-inner">
    <div class="logo">과</div>
    <div>
      <div class="brand">과학 개념 지도</div>
      <div class="brand-sub">통합과학2 · 2022 개정</div>
    </div>
    <div class="header-spacer"></div>
    <a class="hbtn" href="/index.html">허브로</a>
  </div>
</header>

<div class="wrap">

  <div id="banner"></div>

  <!-- 조회 조건 -->
  <div class="card">
    <div class="card-title">조회 조건</div>
    <div class="controls">
      <div>
        <label class="field-label" for="selGrade">학년</label>
        <select id="selGrade"><option value="">전체</option></select>
      </div>
      <div>
        <label class="field-label" for="selStudent">학생</label>
        <select id="selStudent"><option value="">불러오는 중…</option></select>
      </div>
      <div>
        <label class="field-label" for="selPub">교과서</label>
        <select id="selPub">
          <option value="miraen">미래엔</option>
          <option value="visang">비상교육</option>
          <option value="donga">동아출판</option>
        </select>
      </div>
      <div>
        <label class="field-label" for="selGrain">보기 단위</label>
        <select id="selGrain">
          <option value="auto">자동 (데이터량에 맞춤)</option>
          <option value="area">영역 3개</option>
          <option value="std">성취기준 15개</option>
          <option value="node">개념 57개</option>
        </select>
      </div>
    </div>
    <div class="muted" style="margin-top:0.7rem">교과서 선택은 개념을 눌렀을 때 열리는 단원 페이지에만 적용됩니다. 성취기준은 교육부 고시라 출판사가 달라도 동일합니다. 학부모용 화면은 <b>개별 학습 리포트</b>에서 학생별 링크로 열립니다.</div>
  </div>

  <!-- 요약 -->
  <div class="card">
    <div class="card-title" id="sumTitle">학습 현황 (내부용)</div>
    <div class="stats" id="stats"></div>
    <div class="muted" style="margin-top:0.8rem" id="sumNote"></div>
  </div>

  <!-- 공략 포인트 -->
  <div class="card">
    <div class="card-title">공략 포인트 <span class="tag">선수 개념 추적</span></div>
    <div id="focusList"></div>
  </div>

  <!-- 지도 -->
  <div class="card">
    <div class="card-title">개념 지도</div>
    <div class="asum" id="areaSummary"></div>
    <div class="tabs" id="areaTabs"></div>
    <div class="mapbox" id="mapbox"></div>
    <div class="legend" id="legend"></div>
    <div class="maphint" id="mapHint"></div>
  </div>

  <!-- 개념별 표 -->
  <div class="card">
    <div class="card-title">개념별 상세</div>
    <div class="muted" id="tblNote" style="margin-bottom:0.8rem"></div>
    <div style="overflow-x:auto">
      <table class="tbl">
        <thead>
          <tr>
            <th class="c-std col-hide">성취기준</th>
            <th class="c-name">개념</th>
            <th class="c-num">문항</th>
            <th class="c-rate">정답률</th>
            <th class="c-state">상태</th>
          </tr>
        </thead>
        <tbody id="tblBody"></tbody>
      </table>
    </div>
    <div class="guide" id="guide"></div>
  </div>

  <!-- 시험별 개념 연결 -->
  <div class="card" id="tagCard">
    <div class="card-title">시험 ↔ 개념 연결 <span class="tag">최초 1회</span></div>
    <div class="muted" style="margin-bottom:0.9rem">
      시험마다 다루는 <b>개념</b>을 지정해 두면 이후 채점 결과가 자동으로 개념 지도에 반영됩니다.
      성취기준(15개)이 아니라 개념(57개) 단위로 연결해야 선수 관계 추적이 작동합니다.
      목록은 <b>전체 학생의 채점 기록</b>에서 모으므로, 학생을 바꿔 가며 반복할 필요가 없습니다.
      여러 개를 고를 때는 <b>Cmd(⌘)</b> 또는 <b>Ctrl</b>을 누른 채 클릭하고, 같은 방법으로 선택을 해제합니다.
      마스터테스트처럼 개념 지도에 넣지 않을 시험은 <b>아무것도 고르지 않은 채로</b> 두면 집계에서 제외됩니다.
    </div>
    <div id="examList"></div>
    <div style="margin-top:1rem; display:flex; gap:8px; flex-wrap:wrap">
      <button class="btn" id="btnSaveTags" type="button">연결 저장</button>
      <button class="btn ghost" id="btnAutoTag" type="button">시험명으로 자동 추천</button>
    </div>
    <div class="muted" style="margin-top:0.7rem" id="tagMsg"></div>
  </div>

  <!-- 진단 -->
  <div class="card" id="diagCard">
    <details class="diag">
      <summary>데이터 연결 진단</summary>
      <div class="muted" style="margin-top:0.7rem">
        Firestore에서 실제로 읽어온 내용입니다. 필드 이름이 맞지 않으면 여기에 그대로 나오니,
        이 내용을 복사해서 알려주시면 연결 코드를 맞춰 드릴 수 있습니다.
      </div>
      <pre class="dump" id="diagDump">대기 중…</pre>
    </details>
  </div>

</div>

<script src="/concept-map.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"></script>
<script>
(function () {
  'use strict';

  /* ==================================================================
   * concept-map.html — 선생님 전용 개념 지도
   *
   * 학부모 화면은 concept-report.html 로 분리했다.
   * 이 파일에는 상태 라벨·판정 기준·안내 문구를 직접 정의하지 않는다.
   * 전부 concept-map.js(7절)의 CM.* 를 호출해서 쓴다.
   * → 톤이나 기준을 고칠 때 concept-map.js 한 곳만 만지면
   *   선생님 화면과 학부모 화면에 동시에 반영된다.
   * ================================================================ */

  var firebaseConfig = {
    apiKey: 'AIzaSyD5MQx_rXO_xRYelyKxK090TaKa3Gg2D3k',
    authDomain: 'beta-science.firebaseapp.com',
    projectId: 'beta-science',
    storageBucket: 'beta-science.firebasestorage.app',
    messagingSenderId: '650652155367',
    appId: '1:650652155367:web:41d2958e675cb4edd4d142'
  };

  var VIEW = 'teacher';

  var CM = window.ConceptMap;
  var db = null;
  var LIVE = false;

  var state = {
    area: 1,
    students: [],
    gradeList: [],
    grade: '',              // '' = 전체
    studentId: '',
    publisher: 'miraen',
    grain: 'auto',
    records: [],
    examCount: 0,           // 이 학생이 실제로 응시한 시험 수
    exams: [],              // [{key, title, q, takers, mine}]
    examsSig: '',
    tagMap: {},             // examKey -> [conceptId]
    tagError: '',
    analysis: null,
    diag: []
  };

  function $(id) { return document.getElementById(id); }
  function esc(s) { return CM.escapeHtml(s); }
  function pct(r) { return CM.pctText(r); }
  function sty(status) { return CM.styleOf(status, VIEW); }

  function log(label, obj) {
    state.diag.push('■ ' + label + '\n' + (typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2)));
    var el = $('diagDump');
    if (el) el.textContent = state.diag.join('\n\n');
  }

  /* ---------------- 샘플 데이터 (연결 전 미리보기) ---------------- */

  function sampleStudents() {
    return [
      { id: 'demo1', studentId: 'demo1', name: '샘플 학생 A', grade: '고등1학년' },
      { id: 'demo2', studentId: 'demo2', name: '샘플 학생 B', grade: '고등2학년' }
    ];
  }

  function sampleRecords(seed) {
    var out = [];
    function add(id, correct, n) { for (var i = 0; i < n; i++) out.push({ conceptId: id, correct: correct }); }
    if (seed === 'demo2') {
      add('S2-207', true, 4); add('S2-208', false, 5); add('S2-209', false, 4);
      add('S2-210', true, 4); add('S2-211', false, 4);
      add('S2-201', true, 5); add('S2-204', true, 4); add('S2-205', true, 4);
      add('S2-216', true, 4); add('S2-217', true, 3);
    } else {
      add('S2-116', true, 4); add('S2-117', true, 4);
      add('S2-118', false, 4); add('S2-118', true, 1);
      add('S2-120', false, 5); add('S2-121', false, 4); add('S2-122', false, 3);
      add('S2-110', true, 4); add('S2-111', true, 5); add('S2-113', true, 3);
      add('S2-101', true, 4); add('S2-102', true, 4); add('S2-105', true, 3); add('S2-106', true, 4);
    }
    return out;
  }

  /* ---------------- Firestore 연결 ---------------- */

  function looksConfigured(cfg) {
    return cfg && cfg.apiKey && cfg.apiKey.indexOf('PASTE') === -1;
  }

  function initFirebase() {
    if (!looksConfigured(firebaseConfig)) {
      log('설정', 'firebaseConfig 가 아직 채워지지 않아 샘플 데이터로 실행합니다.');
      return false;
    }
    if (typeof firebase === 'undefined' || !firebase.initializeApp) {
      log('설정', 'Firebase SDK 를 불러오지 못했습니다.');
      return false;
    }
    try {
      if (!firebase.apps || firebase.apps.length === 0) firebase.initializeApp(firebaseConfig);
      db = firebase.firestore();
      return true;
    } catch (e) {
      log('Firebase 초기화 실패', String(e && e.message ? e.message : e));
      return false;
    }
  }

  function pick(obj, names) {
    for (var i = 0; i < names.length; i++) {
      if (obj && obj[names[i]] !== undefined && obj[names[i]] !== null && obj[names[i]] !== '') return obj[names[i]];
    }
    return null;
  }

  function loadStudents() {
    if (!LIVE) { state.students = sampleStudents(); return Promise.resolve(); }
    return db.collection('students').get().then(function (snap) {
      var arr = [];
      var sampleShape = null;
      snap.forEach(function (d) {
        var v = d.data() || {};
        if (!sampleShape) sampleShape = Object.keys(v);
        var withdrawn = v.withdrawn === true || v.isWithdrawn === true || v.status === '퇴원' || v.active === false;
        if (withdrawn) return;
        arr.push({
          id: d.id,
          studentId: String(pick(v, ['id', 'studentId', 'sid', 'studentID', 'loginId']) || d.id).trim().toLowerCase(),
          name: pick(v, ['name', 'studentName', '이름']) || d.id,
          grade: String(pick(v, ['grade', '학년', 'gradeLevel', 'schoolGrade']) || '').trim()
        });
      });
      arr.sort(function (a, b) {
        var g = String(a.grade).localeCompare(String(b.grade), 'ko', { numeric: true });
        if (g !== 0) return g;
        return String(a.name).localeCompare(String(b.name), 'ko');
      });
      state.students = arr;
      var gcount = {};
      for (var q = 0; q < arr.length; q++) {
        var gk = arr[q].grade || '(미지정)';
        gcount[gk] = (gcount[gk] || 0) + 1;
      }
      log('students 컬렉션', { 읽은문서수: snap.size, 재원학생수: arr.length, 학년분포: gcount, 첫문서필드: sampleShape });
    }).catch(function (e) {
      log('students 읽기 실패', String(e && e.message ? e.message : e));
      state.students = sampleStudents();
    });
  }

  function num(x) {
    if (x === null || x === undefined || x === '') return null;
    var n = Number(x);
    return isFinite(n) ? n : null;
  }

  /** answers 필드가 배열이든 맵이든 정오를 세어 본다. 집계 필드가 없을 때만 쓴다. */
  function parseAnswers(ans) {
    var list = [];
    if (Array.isArray(ans)) list = ans;
    else if (ans && typeof ans === 'object') {
      for (var k in ans) if (Object.prototype.hasOwnProperty.call(ans, k)) list.push(ans[k]);
    }
    var total = 0, correct = 0;
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      var c = null;
      if (typeof it === 'boolean') c = it;
      else if (it && typeof it === 'object') {
        if (typeof it.correct === 'boolean') c = it.correct;
        else if (typeof it.isCorrect === 'boolean') c = it.isCorrect;
        else if (it.result !== undefined) c = (it.result === true || it.result === 'O' || it.result === 'correct');
        else {
          var key = pick(it, ['answer', 'correctAnswer', 'key']);
          var mine = pick(it, ['userAnswer', 'studentAnswer', 'selected', 'input', 'value', 'my']);
          if (key !== null && mine !== null) c = String(key).trim() === String(mine).trim();
        }
      }
      if (c === null) continue;
      total++; if (c) correct++;
    }
    return { total: total, correct: correct };
  }

  /** grades 문서 1개 = 시험 1회. 맞은 개수와 전체 문항 수를 뽑는다. */
  function docTally(v) {
    var total = num(v.totalQuestions);
    var correct = num(v.score);

    if (total === null) {
      var oc = num(v.oxCount), mc = num(v.multiCount);
      if (oc !== null || mc !== null) total = (oc || 0) + (mc || 0);
    }
    if (correct === null) {
      var os = num(v.oxScore), ms = num(v.multiScore);
      if (os !== null || ms !== null) correct = (os || 0) + (ms || 0);
    }
    if (total === null || correct === null) {
      var p = parseAnswers(v.answers);
      if (p.total > 0) { total = p.total; correct = p.correct; }
    }
    if (total === null || total <= 0) return null;
    if (correct === null) return null;
    // score 가 개수가 아니라 백분율로 저장된 경우를 보정한다
    if (correct > total && correct <= 100) correct = Math.round(total * correct / 100);
    if (correct > total) correct = total;
    if (correct < 0) correct = 0;
    return { total: total, correct: correct };
  }

  function examKeyOf(id, data) {
    var t = pick(data, ['examId', 'testName', 'examTitle', 'title', 'testId']);
    return t ? String(t) : String(id);
  }

  function examTitleOf(id, data) {
    var t = pick(data, ['testName', 'examTitle', 'title', 'examId']);
    return t ? String(t) : String(id);
  }

  /** Firestore 문서 ID 로 쓸 수 없는 문자를 치환한다. */
  function safeDocId(key) {
    return String(key).replace(/[\/\\#\[\]*?]/g, '_').slice(0, 500) || '_';
  }

  /* ---------------- 시험명 → 개념 자동 추천 ---------------- */

  /** '1-1. 진화와 생물다양성 (ⓐ 생물다양성과 보전)' → '생물다양성과 보전' */
  function innerTopic(title) {
    var s = String(title == null ? '' : title).trim();
    var m = s.match(/[(（]([^()（）]*)[)）]\s*$/);
    var inner = m ? m[1] : s;
    inner = inner.replace(/^[^0-9A-Za-z\uAC00-\uD7A3]+/, '').trim();
    inner = inner.replace(/^[0-9A-Za-z]{1,2}[.)]\s*/, '').trim();
    return inner || s;
  }

  /** 한글 2글자 조각으로 잘라 이름 유사도를 잰다. */
  function bigrams(s) {
    var t = String(s == null ? '' : s).replace(/[\s·.,、()（）\-_/]/g, '');
    var out = [];
    for (var i = 0; i + 1 < t.length; i++) out.push(t.substr(i, 2));
    return out;
  }

  function sharedBigrams(a, b) {
    var A = bigrams(a), B = bigrams(b);
    var set = {}, seen = {}, c = 0, i;
    for (i = 0; i < B.length; i++) set[B[i]] = true;
    for (i = 0; i < A.length; i++) {
      if (set[A[i]] && !seen[A[i]]) { seen[A[i]] = true; c++; }
    }
    return c;
  }

  var SUGGEST_MIN = 20;
  var SUGGEST_LIMIT = 6;

  /** 시험명에서 개념 노드 후보를 점수순으로 뽑는다. */
  function suggestNodes(title) {
    var full = String(title == null ? '' : title);
    var inner = innerTopic(full);
    var out = [];
    var nodes = CM.NODES;
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var sc = 0;
      if (inner === n.name) sc += 100;
      else if (inner.indexOf(n.name) !== -1) sc += 60;
      else if (n.name.indexOf(inner) !== -1) sc += 50;
      sc += 8 * sharedBigrams(n.name, inner);
      var kws = n.kw || [];
      for (var k = 0; k < kws.length; k++) {
        // '물', '산', '철' 같은 한 글자 키워드는 엉뚱한 개념을 끌어오므로 제외한다
        if (String(kws[k]).length < 2) continue;
        if (inner.indexOf(kws[k]) !== -1) sc += 12;
        else if (full.indexOf(kws[k]) !== -1) sc += 4;
      }
      if (sc >= SUGGEST_MIN) out.push({ id: n.id, score: sc });
    }
    out.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return a.id < b.id ? -1 : 1;
    });
    return out.slice(0, SUGGEST_LIMIT);
  }

  /* ---------------- 데이터 로딩 ---------------- */

  function loadGrades(studentId) {
    if (!LIVE) {
      state.records = sampleRecords(studentId);
      state.examCount = 2;
      state.exams = [
        { key: 'demo-1', title: '샘플 단원평가 1회', q: 12, takers: 2, mine: true },
        { key: 'demo-2', title: '샘플 단원평가 2회', q: 10, takers: 2, mine: true }
      ];
      return Promise.resolve();
    }
    var target = String(studentId || '').trim().toLowerCase();
    return db.collection('grades').get().then(function (snap) {
      var recs = [];
      var exams = {};
      var firstShape = null;
      var sampleShown = null;
      var matched = 0, skipped = 0, taken = 0;
      snap.forEach(function (d) {
        var v = d.data() || {};
        if (!firstShape) firstShape = { docId: d.id, 필드: Object.keys(v) };

        var t = docTally(v);
        var key = examKeyOf(d.id, v);
        var sid = String(pick(v, ['studentId', 'sid', 'studentID', 'id']) || '').trim().toLowerCase();
        var isMine = target && sid === target;

        /* 시험 목록은 학생과 무관하게 전체 문서에서 모은다.
           한 명씩 돌아가며 태그를 달 필요가 없도록 하기 위함이다. */
        if (!exams[key]) exams[key] = { key: key, title: examTitleOf(d.id, v), q: 0, takers: 0, mine: false };
        exams[key].takers += 1;
        if (t && t.total > exams[key].q) exams[key].q = t.total;
        if (isMine) exams[key].mine = true;

        // 정답률 집계는 선택된 학생 문서만
        if (!isMine) return;
        matched++;
        if (!t) { skipped++; return; }
        taken++;

        if (!sampleShown) {
          sampleShown = {
            시험: examTitleOf(d.id, v),
            맞은개수: t.correct, 전체문항: t.total,
            answers타입: Array.isArray(v.answers) ? '배열(' + v.answers.length + ')'
              : (v.answers && typeof v.answers === 'object' ? '맵(' + Object.keys(v.answers).length + ')' : typeof v.answers)
          };
        }

        var ids = state.tagMap[key] || [];
        if (ids.length === 0) return;
        for (var s = 0; s < ids.length; s++) {
          var node = CM.getNode(ids[s]);
          if (!node) continue;
          for (var i = 0; i < t.total; i++) {
            recs.push({ conceptId: node.id, std: node.std, correct: i < t.correct });
          }
        }
      });
      state.records = recs;
      state.examCount = taken;
      state.exams = Object.keys(exams).map(function (k) { return exams[k]; })
        .sort(function (a, b) {
          // 미연결 시험을 맨 위로 올려 남은 작업이 바로 보이게 한다
          var au = (state.tagMap[a.key] || []).length === 0;
          var bu = (state.tagMap[b.key] || []).length === 0;
          if (au !== bu) return au ? -1 : 1;
          if (a.mine !== b.mine) return a.mine ? -1 : 1;
          if (b.takers !== a.takers) return b.takers - a.takers;
          return String(a.title).localeCompare(String(b.title), 'ko', { numeric: true });
        });
      log('grades 컬렉션', {
        전체문서수: snap.size, 이학생문서수: matched, 집계실패문서: skipped,
        첫문서구조: firstShape, 표본: sampleShown,
        전체시험수: state.exams.length, 연결된기록수: state.records.length
      });
    }).catch(function (e) {
      log('grades 읽기 실패', String(e && e.message ? e.message : e));
      state.records = [];
      state.examCount = 0;
      state.exams = [];
    });
  }

  /** conceptTags 문서를 개념 id 배열로 정규화한다.
      concepts(신규) 우선, 없으면 standards(구버전)를 노드로 펼친다. */
  function normalizeTagDoc(v) {
    if (Array.isArray(v.concepts) && v.concepts.length) {
      var ids = [];
      for (var i = 0; i < v.concepts.length; i++) {
        if (CM.getNode(v.concepts[i])) ids.push(v.concepts[i]);
      }
      return ids;
    }
    if (Array.isArray(v.standards) && v.standards.length) {
      var out = [];
      for (var s = 0; s < v.standards.length; s++) {
        var list = CM.byStandard(v.standards[s]) || [];
        for (var g = 0; g < list.length; g++) out.push(list[g].id);
      }
      return out;
    }
    return [];
  }

  function loadTags() {
    if (!LIVE) { state.tagMap = {}; return Promise.resolve(); }
    return db.collection('conceptTags').get().then(function (snap) {
      var m = {};
      var legacy = 0;
      snap.forEach(function (d) {
        var v = d.data() || {};
        var key = v.examId ? String(v.examId) : d.id;
        var ids = normalizeTagDoc(v);
        if (ids.length) {
          m[key] = ids;
          if (!Array.isArray(v.concepts) || !v.concepts.length) legacy++;
        }
      });
      state.tagMap = m;
      state.tagError = '';
      log('conceptTags 컬렉션', { 저장된시험수: snap.size, 개념연결된시험: Object.keys(m).length, 구버전문서: legacy });
    }).catch(function (e) {
      var msg = String(e && e.message ? e.message : e);
      state.tagMap = {};
      state.tagError = msg;
      log('conceptTags 읽기 실패', msg);
    });
  }

  function selectedIds(sel) {
    var chosen = [];
    for (var o = 0; o < sel.options.length; o++) {
      if (sel.options[o].selected && sel.options[o].value) chosen.push(sel.options[o].value);
    }
    return chosen;
  }

  function stdsOf(ids) {
    var seen = {}, out = [];
    for (var i = 0; i < ids.length; i++) {
      var n = CM.getNode(ids[i]);
      if (n && !seen[n.std]) { seen[n.std] = true; out.push(n.std); }
    }
    return out;
  }

  function saveTags() {
    if (!LIVE) { $('tagMsg').textContent = '샘플 모드에서는 저장되지 않습니다. Firebase 설정을 채우면 저장됩니다.'; return; }
    var rows = document.querySelectorAll('[data-exam]');
    if (!rows.length) { $('tagMsg').textContent = '저장할 시험이 없습니다.'; return; }
    var batch = db.batch();
    var count = 0, linked = 0;
    for (var i = 0; i < rows.length; i++) {
      var key = rows[i].getAttribute('data-exam');
      var chosen = selectedIds(rows[i]);
      state.tagMap[key] = chosen;
      if (chosen.length) linked++;
      batch.set(db.collection('conceptTags').doc(safeDocId(key)), {
        examId: key,
        concepts: chosen,
        standards: stdsOf(chosen),
        updatedAt: new Date().toISOString()
      });
      count++;
    }
    $('tagMsg').textContent = '저장 중…';
    batch.commit().then(function () {
      $('tagMsg').textContent = count + '개 시험을 저장했습니다. (개념이 연결된 시험 ' + linked + '개)';
      state.tagError = '';
      state.examsSig = '';   // 저장 후에는 미연결 우선 정렬을 다시 반영한다
      return refresh();
    }).catch(function (e) {
      var msg = String(e && e.message ? e.message : e);
      $('tagMsg').textContent = (msg.indexOf('permission') !== -1 || msg.indexOf('insufficient') !== -1)
        ? '저장 권한이 없습니다. Firestore 보안 규칙에 conceptTags 컬렉션을 추가해 주세요.'
        : '저장하지 못했습니다: ' + msg;
    });
  }

  function autoTag() {
    var rows = document.querySelectorAll('[data-exam]');
    var filled = 0, empty = 0;
    for (var i = 0; i < rows.length; i++) {
      var title = rows[i].getAttribute('data-title') || rows[i].getAttribute('data-exam');
      var hits = suggestNodes(title);
      var want = {};
      for (var h = 0; h < hits.length; h++) want[hits[h].id] = true;
      for (var o = 0; o < rows[i].options.length; o++) {
        rows[i].options[o].selected = !!want[rows[i].options[o].value];
      }
      if (hits.length) filled++; else empty++;
      var idx = rows[i].getAttribute('data-idx');
      var box = document.getElementById('chosen-' + idx);
      if (box) box.innerHTML = chosenText(selectedIds(rows[i]));
    }
    $('tagMsg').textContent = filled > 0
      ? filled + '개 시험에 추천을 채웠습니다' + (empty ? ' (' + empty + '개는 못 찾음)' : '') + '. 확인 후 저장하세요.'
      : '시험명에서 개념을 찾지 못했습니다. 직접 골라 주세요.';
  }

  function chosenText(ids) {
    if (!ids || !ids.length) return '<span style="color:#b0b0b5">선택된 개념 없음</span>';
    var names = [];
    for (var i = 0; i < ids.length; i++) {
      var n = CM.getNode(ids[i]);
      if (n) names.push(esc(n.name));
    }
    return '선택: ' + names.join(' · ');
  }

  /* ---------------- 학년 / 학생 선택 ---------------- */

  function gradeLabel(g) {
    var s = String(g == null ? '' : g).trim();
    if (!s) return '학년 미지정';
    if (/^\d+$/.test(s)) return s + '학년';
    return s;
  }

  function renderGradeOptions() {
    var seen = {}, list = [], i;
    for (i = 0; i < state.students.length; i++) {
      var g = state.students[i].grade || '';
      if (!seen[g]) { seen[g] = true; list.push(g); }
    }
    list.sort(function (a, b) {
      if (!a) return 1;              // 미지정은 항상 끝으로
      if (!b) return -1;
      return String(a).localeCompare(String(b), 'ko', { numeric: true });
    });
    state.gradeList = list;

    var html = '<option value="">전체 (' + state.students.length + '명)</option>';
    for (i = 0; i < list.length; i++) {
      var cnt = 0;
      for (var k = 0; k < state.students.length; k++) {
        if ((state.students[k].grade || '') === list[i]) cnt++;
      }
      html += '<option value="' + esc(list[i]) + '">' + esc(gradeLabel(list[i])) + ' (' + cnt + '명)</option>';
    }
    $('selGrade').innerHTML = html;
    $('selGrade').value = state.grade;
  }

  function filteredStudents() {
    if (!state.grade) return state.students.slice();
    var out = [];
    for (var i = 0; i < state.students.length; i++) {
      if ((state.students[i].grade || '') === state.grade) out.push(state.students[i]);
    }
    return out;
  }

  function renderStudentOptions() {
    var arr = filteredStudents();
    var html = '';
    for (var i = 0; i < arr.length; i++) {
      html += '<option value="' + esc(arr[i].studentId) + '">' + esc(arr[i].name) + '</option>';
    }
    $('selStudent').innerHTML = html || '<option value="">해당 학년 학생 없음</option>';
    state.studentId = arr.length ? arr[0].studentId : '';
    $('selStudent').value = state.studentId;
  }

  /* ---------------- 렌더링 ---------------- */

  function renderBanner() {
    var el = $('banner');
    if (!LIVE) {
      el.innerHTML = '<div class="banner warnbox">'
        + '<b>샘플 데이터로 보고 있습니다.</b><br>'
        + '화면 구성과 진단 방식을 먼저 확인하시라고 예시를 띄웠습니다. '
        + '이 파일 위쪽 <b>firebaseConfig</b> 를 다른 페이지에 있는 것과 똑같이 바꿔 넣으면 실제 학생 데이터로 바뀝니다.'
        + '</div>';
      return;
    }
    var tagged = 0, untagged = 0;
    for (var i = 0; i < state.exams.length; i++) {
      if ((state.tagMap[state.exams[i].key] || []).length) tagged++; else untagged++;
    }
    if (state.tagError) {
      el.innerHTML = '<div class="banner warnbox">'
        + '<b>conceptTags 컬렉션에 접근할 수 없습니다.</b><br>'
        + 'Firestore 보안 규칙에 conceptTags 를 추가해야 개념 연결을 저장할 수 있습니다. '
        + '규칙을 추가하기 전까지는 지도가 비어 있습니다.'
        + '</div>';
    } else if (tagged === 0) {
      el.innerHTML = '<div class="banner info">'
        + '<b>아직 시험과 개념이 연결되지 않았습니다.</b><br>'
        + '아래 <b>시험 ↔ 개념 연결</b>에서 시험마다 개념을 지정하면 지도가 채워집니다.'
        + '</div>';
    } else if (untagged > 0) {
      el.innerHTML = '<div class="banner info">'
        + '<b>개념이 연결되지 않은 시험 ' + untagged + '개</b>가 있습니다. '
        + '아래 <b>시험 ↔ 개념 연결</b> 목록 <b>맨 위</b>에 모아 두었습니다. '
        + '마스터테스트처럼 지도에 넣지 않을 시험이라면 그대로 두셔도 됩니다.'
        + '</div>';
    } else {
      el.innerHTML = '';
    }
  }

  function grainOf(total) {
    if (state.grain !== 'auto') return state.grain;
    if (total < 60) return 'area';
    if (total < 200) return 'std';
    return 'node';
  }

  function renderStats() {
    var A = state.analysis;
    var c = CM.countByStatus(A, null);
    var total = A ? A.answered : 0;
    var g = grainOf(total);
    var html = '';

    html += '<div class="stat"><div class="v">' + Math.round(c.measured / c.total * 100) + '%</div>'
      + '<div class="l">개념 커버리지</div>'
      + '<div class="s">' + c.measured + ' / ' + c.total + ' 개념</div></div>';
    html += '<div class="stat"><div class="v">' + c.ok + '</div>'
      + '<div class="l">안정 개념</div>'
      + '<div class="s">' + esc(CM.CRITERIA.ok) + '</div></div>';
    html += '<div class="stat"><div class="v">' + c.weak + '</div>'
      + '<div class="l">' + esc(sty('weak').label) + ' 개념</div>'
      + '<div class="s">' + esc(CM.CRITERIA.weak) + '</div></div>';
    html += '<div class="stat"><div class="v">' + total + '</div>'
      + '<div class="l">누적 문항</div>'
      + '<div class="s">' + ({ area: '영역 단위로 표시', std: '성취기준 단위로 표시', node: '개념 단위로 표시' })[g] + '</div></div>';

    $('stats').innerHTML = html;

    var areas = CM.AREAS.map(function (a) {
      var s = A && A.areaSummary[a.id] ? A.areaSummary[a.id] : { total: 0, rate: null };
      return a.name + ' ' + (s.total ? pct(s.rate) + ' (' + s.total + '문항)' : '기록 없음');
    }).join(' · ');
    $('sumNote').textContent = areas + ' · 응시 ' + state.examCount + '회';
  }

  /** 지도 위 영역별 한 줄 요약 */
  function renderAreaSummary() {
    var html = '';
    for (var i = 0; i < CM.AREAS.length; i++) {
      var a = CM.AREAS[i];
      var s = CM.areaState(state.analysis, a.id, VIEW);
      html += '<div class="asum-row">'
        + '<div class="asum-head">'
        + '<span class="asum-name">' + esc(a.name) + '</span>'
        + '<span class="asum-state" style="background:' + s.style.bg + ';color:' + s.style.fg + '">' + esc(s.label) + '</span>'
        + '<span class="asum-num">' + esc(s.right) + '</span>'
        + '</div>'
        + CM.stackBar(s.counts, VIEW, 'asum-bar')
        + '</div>';
    }
    $('areaSummary').innerHTML = html;
  }

  function renderFocus() {
    var A = state.analysis;
    var box = $('focusList');

    if (!A || A.roots.length === 0) {
      box.innerHTML = '<div class="banner okbox">' + (A && A.answered > 0
        ? '<b>지금은 막힌 지점이 없습니다.</b> 선수 개념이 끊긴 곳 없이 잘 이어지고 있습니다.'
        : '<b>아직 분석할 기록이 없습니다.</b> 시험 결과가 쌓이면 여기에 공략 포인트가 나타납니다.') + '</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < Math.min(A.roots.length, 3); i++) {
      var r = A.roots[i];
      var node = CM.getNode(r.id);
      var url = CM.pageUrl(r.id, state.publisher);
      html += '<div class="focus">'
        + '<h4>' + esc(node.name) + '</h4>'
        + '<p>' + esc(CM.explainRoot(r)) + '</p>'
        + '<div class="why">성취기준 ' + esc(CM.stdLabel(node.std))
        + ' · 관련 문항 ' + A.stats[r.id].total + '개 · 정답률 ' + pct(r.rate) + '</div>'
        + (url ? '<a class="go" href="/' + esc(url) + '">단원 페이지 열기 →</a>' : '')
        + '</div>';
    }
    box.innerHTML = html;
  }

  function renderGuide() {
    var rows = CM.GUIDE.teacher;
    var html = '<div class="guide-t">판정 기준 · 대응</div>';
    for (var i = 0; i < rows.length; i++) {
      var g = rows[i];
      var s = sty(g.k);
      html += '<div class="guide-item">'
        + '<div class="guide-l">'
        + '<span class="pill" style="background:' + s.bg + ';color:' + s.fg + '">' + esc(s.label) + '</span>'
        + '<span class="guide-cri">' + esc(CM.CRITERIA[g.k]) + '</span>'
        + '</div>'
        + '<div><div class="guide-mean">' + esc(g.mean) + '</div></div>'
        + '</div>';
    }
    $('guide').innerHTML = html;
  }

  function renderTabs() {
    var html = '';
    for (var i = 0; i < CM.AREAS.length; i++) {
      var a = CM.AREAS[i];
      html += '<button class="tab' + (state.area === a.id ? ' on' : '') + '" data-area="' + a.id + '" type="button">'
        + esc(a.name) + '</button>';
    }
    $('areaTabs').innerHTML = html;
  }

  function renderMap() {
    var A = state.analysis;
    var nodes = CM.byArea(state.area);
    var depth = CM.levels();

    // 레벨별 열 구성 (해당 영역 안에서 다시 0부터)
    var minD = Infinity;
    var i, j;
    for (i = 0; i < nodes.length; i++) minD = Math.min(minD, depth[nodes[i].id]);
    var cols = {};
    for (i = 0; i < nodes.length; i++) {
      var d = depth[nodes[i].id] - minD;
      if (!cols[d]) cols[d] = [];
      cols[d].push(nodes[i]);
    }
    var keys = Object.keys(cols).map(Number).sort(function (a, b) { return a - b; });

    var BW = 138, BH = 46, GX = 62, GY = 13, PAD = 18;
    var maxRows = 0;
    for (i = 0; i < keys.length; i++) maxRows = Math.max(maxRows, cols[keys[i]].length);

    var W = PAD * 2 + keys.length * BW + Math.max(0, keys.length - 1) * GX;
    var H = PAD * 2 + maxRows * BH + Math.max(0, maxRows - 1) * GY;

    var pos = {};
    for (i = 0; i < keys.length; i++) {
      var list = cols[keys[i]];
      var colH = list.length * BH + (list.length - 1) * GY;
      var y0 = PAD + (H - PAD * 2 - colH) / 2;
      for (j = 0; j < list.length; j++) {
        pos[list[j].id] = { x: PAD + i * (BW + GX), y: y0 + j * (BH + GY) };
      }
    }

    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="개념 선수관계 지도">';
    svg += '<defs><marker id="ar" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">'
      + '<path d="M0 0 L8 4 L0 8 z" fill="#d8d8dd"/></marker></defs>';

    // 간선
    for (i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      for (j = 0; j < n.prereq.length; j++) {
        var p = pos[n.prereq[j]];
        var q = pos[n.id];
        if (!p || !q) continue;
        var x1 = p.x + BW, y1 = p.y + BH / 2;
        var x2 = q.x, y2 = q.y + BH / 2;
        var mx = (x1 + x2) / 2;
        var weakEdge = A && A.stats[n.prereq[j]].status === 'weak';
        svg += '<path d="M' + x1 + ' ' + y1 + ' C' + mx + ' ' + y1 + ', ' + mx + ' ' + y2 + ', ' + x2 + ' ' + y2 + '" '
          + 'fill="none" stroke="' + (weakEdge ? '#fbbf24' : '#e5e5ea') + '" stroke-width="' + (weakEdge ? 2 : 1.4) + '" marker-end="url(#ar)"/>';
      }
    }

    // 노드
    for (i = 0; i < nodes.length; i++) {
      var nd = nodes[i];
      var pt = pos[nd.id];
      var st = A ? A.stats[nd.id] : { status: 'unknown', total: 0, rate: null };
      var s = sty(st.status);
      var url = CM.pageUrl(nd.id, state.publisher);
      var label = nd.name.length > 11 ? nd.name.slice(0, 10) + '…' : nd.name;
      var sub = st.total > 0 ? pct(st.rate) + ' · ' + st.total + '문항' : s.label;

      svg += '<a href="/' + esc(url) + '" aria-label="' + esc(nd.name) + '">';
      svg += '<rect x="' + pt.x + '" y="' + pt.y + '" width="' + BW + '" height="' + BH + '" rx="11" '
        + 'fill="' + s.bg + '" stroke="' + s.line + '" stroke-width="1.4"/>';
      svg += '<text x="' + (pt.x + BW / 2) + '" y="' + (pt.y + 19) + '" text-anchor="middle" font-size="12" font-weight="700" fill="' + s.fg + '" '
        + 'font-family="-apple-system,BlinkMacSystemFont,sans-serif">' + esc(label) + '</text>';
      svg += '<text x="' + (pt.x + BW / 2) + '" y="' + (pt.y + 34) + '" text-anchor="middle" font-size="10" fill="' + s.fg + '" opacity="0.75" '
        + 'font-family="-apple-system,BlinkMacSystemFont,sans-serif">' + esc(sub) + '</text>';
      svg += '</a>';
    }

    svg += '</svg>';
    $('mapbox').innerHTML = svg;

    $('mapHint').textContent = '화살표는 선수 관계입니다. 왼쪽 개념이 흔들리면 오른쪽이 따라 흔들립니다. 개념을 누르면 해당 단원 페이지가 열립니다.';

    var lg = '';
    for (i = 0; i < CM.STATUS_ORDER.length; i++) {
      var t = sty(CM.STATUS_ORDER[i]);
      lg += '<span><i style="background:' + t.bg + ';border-color:' + t.line + '"></i>' + esc(t.label) + '</span>';
    }
    $('legend').innerHTML = lg;
  }

  function renderTable() {
    var A = state.analysis;
    var nodes = CM.byArea(state.area);

    $('tblNote').textContent = '성취기준은 교육부 고시 학습 목표 단위입니다. 학교 시험과 2028 수능이 이 단위로 출제됩니다. 칸에 마우스를 올리면 원본 코드가 보입니다.';

    var html = '';
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var st = A ? A.stats[n.id] : { status: 'unknown', total: 0, rate: null };
      var s = sty(st.status);
      var url = CM.pageUrl(n.id, state.publisher);
      html += '<tr>'
        + '<td class="c-std col-hide" title="' + esc(n.std) + '"><span class="muted">' + CM.stdCell(n.std) + '</span></td>'
        + '<td class="c-name"><a class="nlink" href="/' + esc(url) + '">' + esc(n.name) + '</a></td>'
        + '<td class="c-num">' + (st.total || '—') + '</td>'
        + '<td class="c-rate">' + pct(st.rate) + '</td>'
        + '<td class="c-state"><span class="pill" style="background:' + s.bg + ';color:' + s.fg + '">' + esc(s.label) + '</span></td>'
        + '</tr>';
    }
    $('tblBody').innerHTML = html;
  }

  /** 개념 57개를 성취기준별 그룹으로 묶은 선택 항목 목록 */
  function conceptOptions(chosen) {
    var mark = {};
    for (var c = 0; c < chosen.length; c++) mark[chosen[c]] = true;
    var stds = CM.listStandards();
    var html = '';
    for (var s = 0; s < stds.length; s++) {
      var group = CM.byStandard(stds[s]);
      if (!group.length) continue;
      html += '<optgroup label="' + esc(CM.stdLabel(stds[s])) + '">';
      for (var g = 0; g < group.length; g++) {
        html += '<option value="' + esc(group[g].id) + '"' + (mark[group[g].id] ? ' selected' : '') + '>'
          + esc(group[g].name) + '</option>';
      }
      html += '</optgroup>';
    }
    return html;
  }

  function examMeta(ex) {
    var chosen = state.tagMap[ex.key] || [];
    return '문항 ' + ex.q + '개 · 응시 ' + ex.takers + '명'
      + (ex.mine ? ' · 이 학생 응시' : ' · 이 학생 미응시')
      + (chosen.length ? ' · 개념 ' + chosen.length + '개 연결됨' : ' · 미연결');
  }

  function renderExams() {
    var box = $('examList');
    if (!state.exams.length) {
      box.innerHTML = '<div class="muted">채점 기록에서 시험을 찾지 못했습니다.</div>';
      state.examsSig = '';
      return;
    }

    var sig = state.exams.map(function (e) { return e.key; }).join('\u0001');
    // 학생만 바뀐 경우에는 목록을 다시 그리지 않고 설명글만 갱신한다.
    // (아직 저장하지 않은 선택이 날아가지 않도록)
    if (sig === state.examsSig && box.querySelector('[data-exam]')) {
      for (var m = 0; m < state.exams.length; m++) {
        var mel = document.getElementById('meta-' + m);
        if (mel) mel.textContent = examMeta(state.exams[m]);
      }
      return;
    }
    state.examsSig = sig;

    var html = '';
    for (var i = 0; i < state.exams.length; i++) {
      var ex = state.exams[i];
      var chosen = state.tagMap[ex.key] || [];
      html += '<div class="exrow">'
        + '<div><div class="exname">' + esc(ex.title) + '</div>'
        + '<div class="exmeta" id="meta-' + i + '">' + esc(examMeta(ex)) + '</div>'
        + '<div class="exchosen" id="chosen-' + i + '">' + chosenText(chosen) + '</div></div>'
        + '<select class="exsel" multiple size="8" data-exam="' + esc(ex.key) + '" data-title="' + esc(ex.title) + '" data-idx="' + i + '">'
        + conceptOptions(chosen) + '</select>'
        + '</div>';
    }
    box.innerHTML = html;

    var sels = box.querySelectorAll('[data-exam]');
    for (var k = 0; k < sels.length; k++) {
      sels[k].addEventListener('change', function () {
        var idx = this.getAttribute('data-idx');
        var el = document.getElementById('chosen-' + idx);
        if (el) el.innerHTML = chosenText(selectedIds(this));
      });
    }
  }

  function renderAll() {
    renderBanner();
    renderStats();
    renderFocus();
    renderTabs();
    renderAreaSummary();
    renderMap();
    renderTable();
    renderGuide();
    renderExams();
  }

  function analyzeNow() {
    state.analysis = CM.analyze(state.records);
  }

  function refresh() {
    return loadGrades(state.studentId).then(function () {
      analyzeNow();
      renderAll();
    });
  }

  /* ---------------- 이벤트 ---------------- */

  function bind() {
    $('selGrade').addEventListener('change', function (e) {
      state.grade = e.target.value;
      renderStudentOptions();
      refresh();
    });
    $('selStudent').addEventListener('change', function (e) {
      state.studentId = e.target.value;
      refresh();
    });
    $('selPub').addEventListener('change', function (e) {
      state.publisher = e.target.value;
      renderMap(); renderTable(); renderFocus();
    });
    $('selGrain').addEventListener('change', function (e) {
      state.grain = e.target.value;
      renderStats();
    });
    $('areaTabs').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-area]') : null;
      if (!b) return;
      state.area = Number(b.getAttribute('data-area'));
      renderTabs(); renderMap(); renderTable();
    });
    $('btnSaveTags').addEventListener('click', saveTags);
    $('btnAutoTag').addEventListener('click', autoTag);
  }

  /* ---------------- 시작 ---------------- */

  function boot() {
    if (!CM) {
      $('banner').innerHTML = '<div class="banner warnbox"><b>concept-map.js 를 찾지 못했습니다.</b><br>'
        + 'public 폴더에 concept-map.js 가 올라가 있는지 확인해 주세요.</div>';
      return;
    }
    var v = CM.validate();
    log('개념 데이터', { 노드수: v.count, 무결성: v.ok ? '정상' : v.errors });

    var copy = CM.validateCopy();
    if (copy.nameWarnings.length) {
      log('학부모 화면 개념명 확인', {
        설명: '교육과정 용어라 오류가 아닙니다. 표시명을 바꾸려면 concept-map.js 의 name 을 수정하세요.',
        해당개념: copy.nameWarnings
      });
    }

    LIVE = initFirebase();
    bind();

    loadTags()
      .then(loadStudents)
      .then(function () {
        renderGradeOptions();
        renderStudentOptions();
        return refresh();
      })
      .catch(function (e) {
        log('시작 실패', String(e && e.message ? e.message : e));
        state.records = []; analyzeNow(); renderAll();
      });
  }

  // 테스트 전용 노출 (브라우저 동작에는 영향 없음)
  window.__cmTest = {
    suggestNodes: suggestNodes, innerTopic: innerTopic,
    state: state, renderAll: renderAll
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
</script>
</body>
</html>
