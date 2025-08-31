// Import necessary functions from the Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCpgcCGd70n6Ex0MhXuFNYIBqRXi-2TVb4",
  authDomain: "auditoriainventariosdezaz.firebaseapp.com",
  databaseURL: "https://auditoriainventariosdezaz-default-rtdb.firebaseio.com",
  projectId: "auditoriainventariosdezaz",
  storageBucket: "auditoriainventariosdezaz.firebasestorage.app",
  messagingSenderId: "304007591435",
  appId: "1:304007591435:web:6922e3691c0376e17cb90e",
  measurementId: "G-F72HDB9L4T"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Enable offline persistence
enableIndexedDbPersistence(db)
  .catch((err) => {
    if (err.code == 'failed-precondition') {
      // Multiple tabs open, persistence can only be enabled
      // in one tab at a time.
      console.log('Persistence failed: multiple tabs open.');
    } else if (err.code == 'unimplemented') {
      // The current browser does not support all of the
      // features required to enable persistence
      console.log('Persistence not available in this browser.');
    }
  });

export { auth, db };