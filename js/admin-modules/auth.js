// js/admin-modules/auth.js
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

const DOMA = {
    passwordPrompt: null,
    adminContent: null,
    loginButton: null,
    adminEmailInput: null,
    adminPasswordInput: null,
    passwordError: null,
    logoutButton: null,
    currentUserEmailDisplay: null, // ★★★ ヘッダー変更に伴い追加 ★★★
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
    DOMA.currentUserEmailDisplay = document.getElementById('currentUserEmail'); // ★★★ 取得 ★★★

    if (DOMA.loginButton) {
        DOMA.loginButton.addEventListener('click', handleLogin);
    } else {
        console.error("Login button not found in auth.js");
    }
     // ★★★ Enterキーでのログインイベントリスナーを修正 ★★★
    if(DOMA.adminEmailInput) {
        DOMA.adminEmailInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter' && DOMA.loginButton) {
                DOMA.loginButton.click();
            }
        });
    }
    if(DOMA.adminPasswordInput) {
        DOMA.adminPasswordInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter' && DOMA.loginButton) {
                DOMA.loginButton.click();
            }
        });
    }


    if (DOMA.logoutButton) {
        DOMA.logoutButton.addEventListener('click', handleLogout);
    } else {
        console.error("Logout button not found in auth.js");
    }

    onAuthStateChanged(firebaseAuthInstance, (user) => {
        if (user) {
            console.log("[Auth] User is signed in:", user.email);
            if (DOMA.currentUserEmailDisplay) { // ★★★ メールアドレス表示 ★★★
                DOMA.currentUserEmailDisplay.textContent = `${user.email}`;
            }
            onLoginCallback(user);
        } else {
            console.log("[Auth] User is signed out.");
            if (DOMA.currentUserEmailDisplay) { // ★★★ メールアドレスクリア ★★★
                DOMA.currentUserEmailDisplay.textContent = '';
            }
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
                case 'auth/invalid-credential': 
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
            console.log("[Auth] Admin logout successful.");
             // ★★★ ログアウト時にフォームの値をクリア ★★★
            if (DOMA.adminEmailInput) DOMA.adminEmailInput.value = '';
            if (DOMA.adminPasswordInput) DOMA.adminPasswordInput.value = '';
            if (DOMA.passwordError) DOMA.passwordError.textContent = '';
        })
        .catch((error) => {
            console.error("[Auth] Admin logout error:", error);
            alert(`ログアウトエラー: ${error.message}`);
        });
}

// getCurrentUser は admin-main.js からは直接呼ばれなくなったので、エクスポートは任意
// export function getCurrentUser() {
//     return firebaseAuthInstance ? firebaseAuthInstance.currentUser : null;
// }
