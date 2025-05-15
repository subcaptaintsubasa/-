// admin-auth.js
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js"; // firebaseConfigを共有するため
import { firebaseConfig } from './admin-config.js'; // Firebase設定を別ファイルから読み込む想定
import { loadInitialData, clearAdminUI } from './admin.script.js'; // メインスクリプトの関数をインポート

const app = initializeApp(firebaseConfig); // ここで再度初期化するか、メインからappインスタンスを渡す
const auth = getAuth(app);

const passwordPrompt = document.getElementById('password-prompt');
const adminContent = document.getElementById('admin-content');
const loginButton = document.getElementById('loginButton');
const adminEmailInput = document.getElementById('adminEmailInput');
const adminPasswordInput = document.getElementById('adminPasswordInput');
const passwordError = document.getElementById('passwordError');
const logoutButton = document.getElementById('logoutButton');
const currentUserEmailSpan = document.getElementById('currentUserEmail');

export function initializeAuth() {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            if (passwordPrompt) passwordPrompt.style.display = 'none';
            if (adminContent) adminContent.style.display = 'block';
            if (currentUserEmailSpan) currentUserEmailSpan.textContent = `ログイン中: ${user.email}`;
            // 認証後にメインのデータロード処理を呼び出す
            loadInitialData().catch(error => console.error("Error during initial data load:", error));
        } else {
            if (passwordPrompt) passwordPrompt.style.display = 'flex';
            if (adminContent) adminContent.style.display = 'none';
            if (currentUserEmailSpan) currentUserEmailSpan.textContent = '';
            clearAdminUI(); // メインスクリプトのUIクリア関数を呼び出す
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
}
