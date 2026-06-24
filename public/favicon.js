(function() {
  const link = document.createElement('link');
  link.rel = 'icon';
  link.type = 'image/svg+xml';
  link.href = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 140 140'><polygon points='70,8 121,38 121,102 70,132 19,102 19,38' fill='none' stroke='%23E85D75' stroke-width='8' stroke-linejoin='round'/><polygon points='70,38 97,53 97,87 70,102 43,87 43,53' fill='none' stroke='%23E85D75' stroke-width='4' stroke-linejoin='round' stroke-dasharray='10 6'/><circle cx='70' cy='8' r='10' fill='%23E85D75'/><circle cx='121' cy='38' r='10' fill='%23E85D75'/><circle cx='121' cy='102' r='10' fill='%23E85D75'/><circle cx='70' cy='132' r='10' fill='%23E85D75'/><circle cx='19' cy='102' r='10' fill='%23E85D75'/><circle cx='19' cy='38' r='10' fill='%23E85D75'/></svg>";
  document.head.appendChild(link);
})();

/* ───────────────────────────────────────────────────────────
   학생 모드 잠금 (?student=1)
   클리닉으로 받은 핵심내용(단원) 페이지에서 학생이 "목록으로 / 뒤로 /
   학원명 로고 / 상단 경로"를 눌러 전체 목록·허브로 빠져나가는 것을 모두 차단.
   ?student=1 이 URL에 없으면 아무 것도 하지 않음 → 선생님의 일반 열람에는 영향 없음.
   ─────────────────────────────────────────────────────────── */
(function() {
  var isStudent = false;
  try { isStudent = new URLSearchParams(location.search).get('student') === '1'; } catch (e) {}
  if (!isStudent) return;

  // 학생이 가면 안 되는 허브/목록류 페이지 (안전망용)
  var BLOCKED = [
    'index.html', 'science.html', 'science-contents.html', 'science-performance.html',
    'science-report.html', 'science1-summary.html', 'science2-summary.html', 'science3-summary.html',
    'chemistry1-summary.html', 'chemistry2-summary.html',
    'middle-science1.html', 'middle-science2.html', 'middle-science3.html',
    'dashboard.html', 'students.html', 'student-test', 'student-omr.html'
  ];

  function disableLink(a) {
    a.removeAttribute('href');
    a.removeAttribute('onclick');
    a.style.cursor = 'default';
    a.style.pointerEvents = 'none';
  }
  function hideEl(el) {
    el.style.display = 'none';
    el.setAttribute('onclick', 'return false;');
  }

  function lock() {
    // 1) "← 목록으로 / ← 뒤로" 버튼·링크 숨김
    document.querySelectorAll('.back-btn').forEach(hideEl);

    // 2) 좌측 상단 학원명/로고 링크 비활성화 (허브 이동 차단)
    document.querySelectorAll('.header-brand, .header-left').forEach(disableLink);

    // 3) 상단 경로(breadcrumb) 링크 비활성화
    document.querySelectorAll('.bc-a, .bc-item').forEach(disableLink);

    // 4) 안전망: 허브/목록류로 향하는 그 밖의 모든 <a> 비활성화
    document.querySelectorAll('a[href]').forEach(function(a) {
      var raw = a.getAttribute('href') || '';
      var base = raw.split('?')[0].split('#')[0].replace(/^\.?\//, '');
      for (var i = 0; i < BLOCKED.length; i++) {
        if (base === BLOCKED[i] || base.indexOf(BLOCKED[i]) === 0) { disableLink(a); break; }
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', lock);
  } else {
    lock();
  }
})();
