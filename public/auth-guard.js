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
