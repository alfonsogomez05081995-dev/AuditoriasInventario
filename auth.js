import {
    onAuthStateChanged,
    signOut,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth } from './firebase-config.js';
import { showFeedback } from './ui.js';

const authorizedUsers = [
    "luis.gomez3diebold@gmail.com",
    "luisgm.ldv@gmail.com",
    "proskaterdezazfixia@gmail.com",
    "andreamartinez08051995@gmail.com",
    "dayan.trilleras@dieboldnixdorf.com",
    "luis.gomez3@dieboldnixdorf.com"
];

function handleAuthError(error, authErrorEl) {
    console.error("Authentication Error:", error);
    showFeedback(authErrorEl, 'Ocurrió un error. Inténtalo de nuevo.', 'error');
}

export function setupAuth(
    {
        loginContainer,
        appContainer,
        userEmailEl,
        authErrorEl,
        loginForm,
        registerForm,
        logoutButton,
        showRegisterLink,
        showLoginLink,
        loginFormContainer,
        registerFormContainer
    },
    initializeAppState
) {
    onAuthStateChanged(auth, (user) => {
        if (user && authorizedUsers.map(email => email.toLowerCase()).includes(user.email.toLowerCase())) {
            loginContainer.classList.add('hidden');
            appContainer.classList.remove('hidden');
            userEmailEl.textContent = user.email;
            initializeAppState();
        } else {
            if (user) {
                showFeedback(authErrorEl, 'Acceso denegado. Tu cuenta no está autorizada.', 'error');
                signOut(auth);
            }
            loginContainer.classList.remove('hidden');
            appContainer.classList.add('hidden');
        }
    });

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        signInWithEmailAndPassword(auth, email, password).catch(err => handleAuthError(err, authErrorEl));
    });

    registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        createUserWithEmailAndPassword(auth, email, password).catch(err => handleAuthError(err, authErrorEl));
    });

    logoutButton.addEventListener('click', () => signOut(auth));

    showRegisterLink.addEventListener('click', () => {
        loginFormContainer.classList.add('hidden');
        registerFormContainer.classList.remove('hidden');
    });

    showLoginLink.addEventListener('click', () => {
        registerFormContainer.classList.add('hidden');
        loginFormContainer.classList.remove('hidden');
    });
}
