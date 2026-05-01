// =====================================================
// auth-guard.js
// public/ 폴더에 두고, 보호할 모든 페이지 <head>에
// <script type="module" src="/auth-guard.js"></script>
// 한 줄만 추가하면 됩니다.
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
