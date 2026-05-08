// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyD5MQx_rXO_xRYelyKxK090TaKa3Gg2D3k",
  authDomain: "beta-science.firebaseapp.com",
  projectId: "beta-science",
  storageBucket: "beta-science.firebasestorage.app",
  messagingSenderId: "650652155367",
  appId: "1:650652155367:web:41d2958e675cb4edd4d142"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
