// js/restore.js (新・親子関係 再設定ツール)
import { auth, db } from '../firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { collection, getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

const DOM = {
    passwordPrompt: document.getElementById('password-prompt'),
    mainContent: document.getElementById('main-content'),
    loginButton: document.getElementById('loginButton'),
    logoutButton: document.getElementById('logoutButton'),
    adminEmailInput: document.getElementById('adminEmailInput'),
    adminPasswordInput: document.getElementById('adminPasswordInput'),
    passwordError: document.getElementById('passwordError'),
    parentList: document.getElementById('parentList'),
    childListContainer: document.getElementById('childListContainer'),
};

let allCategories = [];
let parentCategories = [];

// --- 認証 ---
onAuthStateChanged(auth, user => {
    DOM.passwordPrompt.style.display = user ? 'none' : 'flex';
    DOM.mainContent.style.display = user ? 'block' : 'none';
    if (user) {
        loadAndRenderCategories();
    }
});
DOM.loginButton.addEventListener('click', () => signInWithEmailAndPassword(auth, DOM.adminEmailInput.value, DOM.adminPasswordInput.value).catch(err => DOM.passwordError.textContent = 'ログイン失敗'));
DOM.logoutButton.addEventListener('click', () => signOut(auth));

// --- データ読み込みと描画 ---
async function loadAndRenderCategories() {
    try {
        DOM.parentList.innerHTML = '<li>読み込み中...</li>';
        DOM.childListContainer.innerHTML = '<p>読み込み中...</p>';

        const snapshot = await getDocs(collection(db, 'categories'));
        allCategories = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        parentCategories = allCategories.filter(c => !c.parentId || c.parentId === "").sort((a,b) => a.name.localeCompare(b.name));
        const childCategories = allCategories.filter(c => c.parentId && c.parentId !== "").sort((a,b) => a.name.localeCompare(b.name));

        renderParentList();
        renderChildList(childCategories);

    } catch (error) {
        console.error("データの読み込みに失敗しました:", error);
        DOM.parentList.innerHTML = '<li>エラー</li>';
        DOM.childListContainer.innerHTML = `<p style="color: red;">エラー: ${error.message}</p>`;
    }
}

function renderParentList() {
    DOM.parentList.innerHTML = parentCategories.map(p => `<li>${p.name}</li>`).join('');
}

function renderChildList(childCategories) {
    DOM.childListContainer.innerHTML = '';
    if (childCategories.length === 0) {
        DOM.childListContainer.innerHTML = '<p>親が設定されているカテゴリはありません。</p>';
        return;
    }

    childCategories.forEach(child => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'child-item';
        itemDiv.dataset.childId = child.id;

        const nameSpan = document.createElement('span');
        const currentParentName = allCategories.find(p => p.id === child.parentId)?.name || '不明';
        nameSpan.innerHTML = `<strong>${child.name}</strong> <small>(現在の親: ${currentParentName})</small>`;

        const selector = document.createElement('select');
        let optionsHtml = '<option value="">親なし (最上位にする)</option>';
        parentCategories.forEach(p => {
            optionsHtml += `<option value="${p.id}" ${child.parentId === p.id ? 'selected' : ''}>${p.name}</option>`;
        });
        selector.innerHTML = optionsHtml;

        const saveButton = document.createElement('button');
        saveButton.textContent = '保存';
        saveButton.onclick = async () => {
            const newParentId = selector.value;
            saveButton.disabled = true;
            saveButton.textContent = '保存中...';

            try {
                const docRef = doc(db, 'categories', child.id);
                await updateDoc(docRef, { parentId: newParentId });
                
                // 成功したらUIを更新
                child.parentId = newParentId;
                const newParentName = allCategories.find(p => p.id === newParentId)?.name || 'なし';
                nameSpan.innerHTML = `<strong>${child.name}</strong> <small>(現在の親: ${newParentName})</small>`;
                itemDiv.style.backgroundColor = '#d4edda';
                setTimeout(() => { itemDiv.style.backgroundColor = ''; }, 2000);

            } catch (err) {
                alert(`「${child.name}」の更新に失敗しました: ${err.message}`);
                console.error(err);
            } finally {
                saveButton.disabled = false;
                saveButton.textContent = '保存';
            }
        };

        itemDiv.appendChild(nameSpan);
        itemDiv.appendChild(selector);
        itemDiv.appendChild(saveButton);
        DOM.childListContainer.appendChild(itemDiv);
    });
}
