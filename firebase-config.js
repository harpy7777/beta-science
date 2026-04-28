import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD5MQx_rXO_xRYelyKxK090TaKa3Gg2D3k",
  authDomain: "beta-science.firebaseapp.com",
  projectId: "beta-science",
  storageBucket: "beta-science.firebasestorage.app",
  messagingSenderId: "650652155367",
  appId: "1:650652155367:web:41d2958e675cb4edd4d142",
  measurementId: "G-SPNVBHPWP6"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
