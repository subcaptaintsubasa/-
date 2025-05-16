// js/admin-modules/auth.js
// Handles Firebase Authentication for the admin panel.

import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

const DOMA = { // DOM elements for Auth
    passwordPrompt: null,
    adminContent: null,
    loginButton: null,
    adminEmailInput: null,
    adminPasswordInput: null,
    passwordError: null,
    logoutButton: null,
    // currentUserEmailSpan: null, // Managed by callback now
};

let onLoginCallback = () => {};
let onLogoutCallback = () => {};
let firebaseAuthInstance = null;

export function initAuth(authInstance, onLogin, onLogout) {
    firebaseAuthInstance = authInstance;
    onLoginCallback = onLogin || (() => {});
    onLogoutCallback = onLogout || (() => {});

    DOMA.passwordPrompt = document.getElementById('password-prompt');
    DOMA.adminContent = document.getElementById('admin-content');
    DOMA.loginButton = document.getElementById('loginButton');
    DOMA.adminEmailInput = document.getElementById('adminEmailInput');
    DOMA.adminPasswordInput = document.getElementById('adminPasswordInput');
    DOMA.passwordError = document.getElementById('passwordError');
    DOMA.logoutButton = document.getElementById('logoutButton');
    // DOMA.currentUserEmailSpan = document.getElementById('currentUserEmail');

    if (DOMA.loginButton) {
        DOMA.loginButton.addEventListener('click', handleLogin);
    }

    if (DOMA.logoutButton) {
        DOMA.logoutButton.addEventListener('click', handleLogout);
    }

    // Listen for auth state changes
    onAuthStateChanged(firebaseAuthInstance, (user) => {
        if (user) {
            // User is signed in
            // if (DOMA.passwordPrompt) DOMA.passwordPrompt.style.display = 'none';
            // if (DOMA.adminContent) DOMA.adminContent.style.display = 'block';
            // if (DOMA.currentUserEmailSpan) DOMA.currentUserEmailSpan.textContent = `ログイン中: ${user.email}`;
            onLoginCallback(user);
        } else {
            // User is signed out
            // if (DOMA.passwordPrompt) DOMA.passwordPrompt.style.display = 'flex';
            // if (DOMA.adminContent) DOMA.adminContent.style.display = 'none';
            // if (DOMA.currentUserEmailSpan) DOMA.currentUserEmailSpan.textContent = '';
            onLogoutCallback();
        }
    });
}

function handleLogin() {
    if (!DOMA.adminEmailInput || !DOMA.adminPasswordInput || !DOMA.passwordError) return;

    const email = DOMA.adminEmailInput.value;
    const password = DOMA.adminPasswordInput.value;

    if (!email || !password) {
        DOMA.passwordError.textContent = 'メールアドレスとパスワードを入力してください。';
        return;
    }
    DOMA.passwordError.textContent = ''; // Clear previous errors

    signInWithEmailAndPassword(firebaseAuthInstance, email, password)
        .then((userCredential) => {
            // Signed in
            // const user = userCredential.user;
            // onAuthStateChanged will handle UI update via onLoginCallback
            console.log("Admin login successful");
        })
        .catch((error) => {
            console.error("Admin login error:", error);
            let errorMessage = "ログインエラーが発生しました。";
            switch (error.code) {
                case 'auth/invalid-email':
                    errorMessage = "メールアドレスの形式が正しくありません。";
                    break;
                case 'auth/user-not-found':
                case 'auth/wrong-password':
                case 'auth/invalid-credential': // For v9+ combined error
                    errorMessage = "メールアドレスまたはパスワードが間違っています。";
                    break;
                default:
                    errorMessage = `ログインエラー: ${error.message}`;
            }
            if (DOMA.passwordError) DOMA.passwordError.textContent = errorMessage;
        });
}

function handleLogout() {
    signOut(firebaseAuthInstance)
        .then(() => {
            // Sign-out successful.
            // onAuthStateChanged will handle UI update via onLogoutCallback
            console.log("Admin logout successful");
        })
        .catch((error) => {
            console.error("Admin logout error:", error);
            alert(`ログアウトエラー: ${error.message}`);
        });
}

// Optional: Export a function to get current user if needed by other admin modules
export function getCurrentUser() {
    return firebaseAuthInstance ? firebaseAuthInstance.currentUser : null;
}
