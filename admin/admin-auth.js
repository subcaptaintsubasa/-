// admin-auth.js
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { firebaseConfig } from './admin-config.js';
// loadInitialData と clearAdminUI はメインスクリプトからエクスポートされる想定
import { loadInitialData, clearAdminUI } from './admin.script.js';

const app = initializeApp(firebaseConfig); // Initialize Firebase app for auth module
const auth = getAuth(app);

export function initializeAuthEventListeners() {
    const passwordPrompt = document.getElementById('password-prompt');
    const adminContent = document.getElementById('admin-content');
    const loginButton = document.getElementById('loginButton');
    const adminEmailInput = document.getElementById('adminEmailInput');
    const adminPasswordInput = document.getElementById('adminPasswordInput');
    const passwordError = document.getElementById('passwordError');
    const logoutButton = document.getElementById('logoutButton');
    const currentUserEmailSpan = document.getElementById('currentUserEmail');

    onAuthStateChanged(auth, (user) => {
        if (user) {
            if (passwordPrompt) passwordPrompt.style.display = 'none';
            if (adminContent) adminContent.style.display = 'block';
            if (currentUserEmailSpan) currentUserEmailSpan.textContent = `ログイン中: ${user.email}`;
            loadInitialData().catch(error => console.error("Error during initial data load triggered by auth state change:", error));
        } else {
            if (passwordPrompt) passwordPrompt.style.display = 'flex';
            if (adminContent) adminContent.style.display = 'none';
            if (currentUserEmailSpan) currentUserEmailSpan.textContent = '';
            clearAdminUI();
        }
    });

    if (loginButton) {
        loginButton.addEventListener('click', () => {
            const email = adminEmailInput.value;
            const password = adminPasswordInput.value;
            if (!email || !password) {
                if(passwordError) passwordError.textContent = 'メールアドレスとパスワードを入力してください。';
                return;
            }
            if(passwordError) passwordError.textContent = '';
            signInWithEmailAndPassword(auth, email, password)
                .catch(error => {
                    console.error("Login error:", error);
                    if(passwordError) passwordError.textContent = `ログインエラー: ${error.message}`;
                });
        });
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            signOut(auth).catch(error => console.error("Logout error:", error));
        });
    }
    console.log("Auth event listeners initialized.");
}
