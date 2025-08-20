// --- Configuración de Firebase para el Entorno de PRODUCCIÓN ---
// REEMPLAZA ESTOS VALORES con la configuración de tu NUEVO proyecto de Firebase (el que tiene el plan de pago).

const firebaseConfig = {
  apiKey: "TU_API_KEY_DE_PRODUCCION",
  authDomain: "TU-PROYECTO-PROD.firebaseapp.com",
  projectId: "TU-PROYECTO-PROD",
  storageBucket: "TU-PROYECTO-PROD.appspot.com",
  messagingSenderId: "TU_MESSAGING_SENDER_ID",
  appId: "TU_APP_ID"
};

// NO ES NECESARIO MODIFICAR NADA DEBAJO DE ESTA LÍNEA

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };
