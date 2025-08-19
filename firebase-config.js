// Import necessary functions from the Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCCiX9Xmm29OdqOKb8XVoI6cr52fCTm9Fg",
  authDomain: "auditoriainventariosdezaz1.firebaseapp.com",
  projectId: "auditoriainventariosdezaz1",
  storageBucket: "auditoriainventariosdezaz1.firebasestorage.app",
  messagingSenderId: "426872106325",
  appId: "1:426872106325:web:c0777cf99b6578a02253dc",
  measurementId: "G-PZ7XER54T5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
