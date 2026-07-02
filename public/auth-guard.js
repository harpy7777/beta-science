// =====================================================
// auth-guard.js
// public/ 폴더에 두고, 보호할 모든 페이지 <head>에
// <script type="module" src="/auth-guard.js"></script>
// 한 줄만 추가하면 됩니다.
//
// [학생 열람 모드]
// 클리닉 링크로 ?student=1 을 달고 들어온 "학습 콘텐츠(단원) 페이지"는
// 로그인 없이 바로 볼 수 있게 통과시킵니다.
// 단, 아래 화이트리스트(STUDENT_VIEWABLE) 경로에서만 허용하므로
// 대시보드·학생관리·성적 등 민감한 선생님 페이지는 절대 열리지 않습니다.
//
// [★ 학생 열람 모드에서 '이 페이지 밖으로' 나가는 링크 전면 차단]
// 학생이 단원 페이지의 헤더 로고/브레드크럼("🏠 홈", 단원 요약 등)을 눌러
// index.html(허브) 같은 다른 페이지로 넘어가지 못하도록 잠급니다.
// - 페이지 내 앵커(#탭/#아코디언)는 그대로 유지 → 학습 콘텐츠 동작 정상
// - "← 뒤로"(history.back) 버튼은 클리닉으로 돌아가는 정상 출구이므로 건드리지 않음
// =====================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD5MQx_rXO_xRYelyKxK090TaKa3Gg2D3k",
  authDomain: "beta-science.firebaseapp.com",
  projectId: "beta-science",
  storageBucket: "beta-science.firebasestorage.app",
  messagingSenderId: "650652155367",
  appId: "1:650652155367:web:41d2958e675cb4edd4d142"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ── 학생이 로그인 없이 열람 가능한 "학습 콘텐츠(단원) 페이지" 화이트리스트 ──
// 여기에 해당하는 경로에서 ?student=1 로 들어온 경우에만 로그인 검사를 건너뜁니다.
// (선생님 전용 페이지 경로는 절대 포함하지 마세요.)
const STUDENT_VIEWABLE = [
  /\/middle-science[123]-unit\d/,          // 중등과학 단원
  /\/(miraen|donga|visang)-science[12]-unit\d/, // 통합과학 단원
  /\/chemistry1-unit\d/,                    // 화학1 단원
  /\/chemistry2-unit[\d-]+/                 // 화학2 단원
];

const _params = new URLSearchParams(location.search);
const _studentMode = _params.get("student") === "1";
const _isViewableContent = STUDENT_VIEWABLE.some(re => re.test(location.pathname));

if (_studentMode && _isViewableContent) {
  // ✅ 학생 열람 모드: 로그인 없이 바로 표시
  document.documentElement.style.visibility = "visible";

  // ── ★ 이 페이지 밖으로 나가는 모든 링크 잠금 (허브/다른 단원/요약 등) ──
  // 같은 경로(#해시)로 가는 페이지 내 링크만 허용하고, 다른 페이지로 가는 링크는
  // (1) 시각적으로 비활성화하고 (2) 클릭 자체를 캡처 단계에서 차단합니다.
  const _isCrossPageLink = (a) => {
    const raw = a.getAttribute("href");
    if (!raw) return false;
    if (raw.charAt(0) === "#") return false;              // 페이지 내 앵커 → 허용
    // javascript:, mailto:, tel: 등은 페이지 이동이 아니므로 건드리지 않음
    if (/^(javascript:|mailto:|tel:|sms:)/i.test(raw.trim())) return false;
    let dest;
    try { dest = new URL(a.href, location.href); } catch (e) { return false; }
    return dest.pathname !== location.pathname;           // 다른 경로면 차단 대상
  };

  const _lockNav = () => {
    document.querySelectorAll("a[href]").forEach((a) => {
      if (!_isCrossPageLink(a)) return;
      a.removeAttribute("href");            // 링크 기능 제거 (텍스트/로고는 그대로 보임)
      a.style.pointerEvents = "none";       // 클릭 불가
      a.style.cursor = "default";
      a.setAttribute("aria-disabled", "true");
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", _lockNav);
  } else {
    _lockNav();
  }

  // 동적으로 추가되는 링크나 removeAttribute를 놓친 경우까지 대비한 최종 안전망:
  // 캡처 단계에서 '다른 페이지로 가는 <a>' 클릭을 전부 취소.
  document.addEventListener("click", (e) => {
    const a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (a && _isCrossPageLink(a)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

} else {
  // ── 선생님 로그인 가드 (기존 동작) ──
  // 로그인 확인 전까지 페이지 숨김 (깜빡임 방지)
  document.documentElement.style.visibility = "hidden";

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      // 로그인 안 됨 → 로그인 페이지로
      window.location.replace("/login.html");
      return;
    }

    try {
      const snap = await getDoc(doc(db, "users", user.uid));

      if (!snap.exists() || snap.data().status !== "approved") {
        // 미승인 계정 → 로그아웃 후 로그인 페이지로
        await auth.signOut();
        window.location.replace("/login.html");
        return;
      }

      // ✅ 승인된 선생님 → 페이지 표시
      document.documentElement.style.visibility = "visible";

      // 선생님 이름을 페이지에 표시 (id="teacherName" 요소가 있을 때만)
      const nameEl = document.getElementById("teacherName");
      if (nameEl) nameEl.textContent = snap.data().name + " 선생님";

      // 로그아웃 함수 전역 등록 (onclick="authLogout()" 으로 사용)
      window.authLogout = async () => {
        await auth.signOut();
        window.location.replace("/login.html");
      };

    } catch (err) {
      console.error("auth-guard error:", err);
      window.location.replace("/login.html");
    }
  });
}
