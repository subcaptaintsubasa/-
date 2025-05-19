// js/admin-modules/auth.js
// Handles Firebase Authentication for the admin panel.

import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

const DOMA = {
    passwordPrompt: null,
    adminContent: null,
    loginButton: null,
    adminEmailInput: null,
    adminPasswordInput: null,
    passwordError: null,
    logoutButton: null,
};

let onLoginCallback = (user) => { console.warn("onLoginCallback not set in auth.js", user);};
let onLogoutCallback = () => { console.warn("onLogoutCallback not set in auth.js");};
let firebaseAuthInstance = null;

export function initAuth(authInstance, onLogin, onLogout) {
    firebaseAuthInstance = authInstance;
    if (typeof onLogin === 'function') onLoginCallback = onLogin;
    if (typeof onLogout === 'function') onLogoutCallback = onLogout;

    DOMA.passwordPrompt = document.getElementById('password-prompt');
    DOMA.adminContent = document.getElementById('admin-content');
    DOMA.loginButton = document.getElementById('loginButton');
    DOMA.adminEmailInput = document.getElementById('adminEmailInput');
    DOMA.adminPasswordInput = document.getElementById('adminPasswordInput');
    DOMA.passwordError = document.getElementById('passwordError');
    DOMA.logoutButton = document.getElementById('logoutButton');

    if (DOMA.loginButton) {
        DOMA.loginButton.addEventListener('click', handleLogin);
    } else {
        console.error("Login button not found in auth.js");
    }

    if (DOMA.logoutButton) {
        DOMA.logoutButton.addEventListener('click', handleLogout);
    } else {
        console.error("Logout button not found in auth.js");
    }

    onAuthStateChanged(firebaseAuthInstance, (user) => {
        if (user) {
            console.log("[Auth] User is signed in:", user.email);
            onLoginCallback(user);
        } else {
            console.log("[Auth] User is signed out.");
            onLogoutCallback();
        }
    });
    console.log("[Auth] Firebase Auth initialized.");
}

function handleLogin() {
    if (!DOMA.adminEmailInput || !DOMA.adminPasswordInput || !DOMA.passwordError) {
        console.error("Auth form elements not found for login.");
        return;
    }

    const email = DOMA.adminEmailInput.value;
    const password = DOMA.adminPasswordInput.value;

    if (!email || !password) {
        DOMA.passwordError.textContent = 'メールアドレスとパスワードを入力してください。';
        return;
    }
    DOMA.passwordError.textContent = '';

    signInWithEmailAndPassword(firebaseAuthInstance, email, password)
        .then((userCredential) => {
            // Signed in - onAuthStateChanged will trigger onLoginCallback
            console.log("[Auth] Admin login successful for:", userCredential.user.email);
        })
        .catch((error) => {
            console.error("[Auth] Admin login error:", error.code, error.message);
            let errorMessage = "ログインエラーが発生しました。";
            switch (error.code) {
                case 'auth/invalid-email':
                    errorMessage = "メールアドレスの形式が正しくありません。";
                    break;
                case 'auth/user-not-found':
                case 'auth/wrong-password':
                case 'auth/invalid-credential': // v9+ uses this for wrong password or user not found
                    errorMessage = "メールアドレスまたはパスワードが間違っています。";
                    break;
                case 'auth/too-many-requests':
                    errorMessage = "試行回数が多すぎます。後でもう一度お試しください。";
                    break;
                default:
                    errorMessage = `ログインエラー (${error.code})`;
            }
            DOMA.passwordError.textContent = errorMessage;
        });
}

function handleLogout() {
    signOut(firebaseAuthInstance)
        .then(() => {
            // Sign-out successful - onAuthStateChanged will trigger onLogoutCallback
            console.log("[Auth] Admin logout successful.");
        })
        .catch((error) => {
            console.error("[Auth] Admin logout error:", error);
            alert(`ログアウトエラー: ${error.message}`);
        });
}

export function getCurrentUser() {
    return firebaseAuthInstance ? firebaseAuthInstance.currentUser : null;
}
