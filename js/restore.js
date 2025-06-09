// js/restore.js (カテゴリ親子関係 復旧ツール)
import { auth, db } from '../firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { collection, getDocs, writeBatch, doc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

const DOM = {
    passwordPrompt: document.getElementById('password-prompt'),
    mainContent: document.getElementById('main-content'),
    loginButton: document.getElementById('loginButton'),
    logoutButton: document.getElementById('logoutButton'),
    adminEmailInput: document.getElementById('adminEmailInput'),
    adminPasswordInput: document.getElementById('adminPasswordInput'),
    passwordError: document.getElementById('passwordError'),
    backupFileInput: document.getElementById('backupFile'),
    analyzeButton: document.getElementById('analyzeButton'),
    categoryTasks: document.getElementById('categoryTasks'),
};

let oldBackupData = null;
let currentCategories = [];
let parentCategories = [];

// --- 認証 ---
onAuthStateChanged(auth, user => {
    DOM.passwordPrompt.style.display = user ? 'none' : 'flex';
    DOM.mainContent.style.display = user ? 'block' : 'none';
});
DOM.loginButton.addEventListener('click', () => signInWithEmailAndPassword(auth, DOM.adminEmailInput.value, DOM.adminPasswordInput.value).catch(err => DOM.passwordError.textContent = 'ログイン失敗'));
DOM.logoutButton.addEventListener('click', () => signOut(auth));

// --- UI制御 ---
DOM.backupFileInput.addEventListener('change', () => {
    DOM.analyzeButton.disabled = DOM.backupFileInput.files.length === 0;
});

// --- 分析処理 ---
DOM.analyzeButton.addEventListener('click', async () => {
    const file = DOM.backupFileInput.files[0];
    if (!file) return;

    DOM.analyzeButton.disabled = true;
    DOM.analyzeButton.textContent = '分析中...';
    DOM.categoryTasks.innerHTML = '<p>データを読み込んでいます...</p>';

    try {
        const oldBackupString = await file.text();
        oldBackupData = JSON.parse(oldBackupString).collections;

        const snapshot = await getDocs(collection(db, 'categories'));
        currentCategories = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        parentCategories = currentCategories.filter(c => !c.parentId);

        DOM.categoryTasks.innerHTML = '';
        renderCategoryTasks();
        alert('分析が完了しました。下のリストから親子関係を修正してください。');

    } catch (error) {
        DOM.categoryTasks.innerHTML = `<p style="color: red;">分析エラー: ${error.message}</p>`;
        console.error(error);
    } finally {
        DOM.analyzeButton.disabled = false;
        DOM.analyzeButton.textContent = '再分析';
    }
});

function renderCategoryTasks() {
    // 現在のparentIdで子カテゴリをグループ化
    const childrenByParent = currentCategories
        .filter(c => c.parentId)
        .reduce((acc, cat) => {
            const parentId = cat.parentId || 'unknown';
            if (!acc[parentId]) acc[parentId] = [];
            acc[parentId].push(cat);
            return acc;
        }, {});
    
    // グループごとにUIを作成
    for (const parentId in childrenByParent) {
        const children = childrenByParent[parentId];
        const groupDiv = document.createElement('div');
        groupDiv.className = 'task-group';

        // このグループの本来の親を探す
        const firstChildName = children[0].name;
        const oldChildData = oldBackupData.categories.find(c => c.name === firstChildName);
        const oldParentData = oldBackupData.categories.find(p => p.id === oldChildData?.parentId);
        const recommendedParent = parentCategories.find(p => p.name === oldParentData?.name);

        const currentParent = parentCategories.find(p => p.id === parentId);
        groupDiv.innerHTML = `
            <h3>親子関係の修正</h3>
            <p>現在「${currentParent ? currentParent.name : '不明な親 or 親なし'}(ID: ${parentId})」に所属している子カテゴリグループ:</p>
        `;

        const taskItem = document.createElement('div');
        taskItem.className = 'task-item';

        const childList = document.createElement('div');
        childList.className = 'child-list';
        childList.innerHTML = `<ul>${children.map(c => `<li>${c.name}</li>`).join('')}</ul>`;
        
        const selectorDiv = document.createElement('div');
        const selectorLabel = document.createElement('label');
        selectorLabel.textContent = '正しい親を選択:';
        selectorLabel.style.display = 'block';

        const selector = document.createElement('select');
        selector.innerHTML = `<option value="">親なし (最上位にする)</option>`;
        parentCategories.forEach(p => {
            const isRecommended = recommendedParent && p.id === recommendedParent.id;
            selector.innerHTML += `<option value="${p.id}" ${isRecommended ? 'selected' : ''}>${p.name} ${isRecommended ? '(推奨)' : ''}</option>`;
        });
        
        const updateButton = document.createElement('button');
        updateButton.textContent = 'このグループの親を更新';
        updateButton.onclick = async () => {
            const newParentId = selector.value;
            if (!confirm(`子カテゴリ${children.length}件の親を「${newParentId ? parentCategories.find(p=>p.id===newParentId).name : 'なし'}」に更新しますか？`)) return;
            
            updateButton.disabled = true;
            updateButton.textContent = '更新中...';
            try {
                const batch = writeBatch(db);
                children.forEach(child => {
                    const docRef = doc(db, 'categories', child.id);
                    batch.update(docRef, { parentId: newParentId });
                });
                await batch.commit();
                alert('更新しました！');
                taskItem.style.backgroundColor = '#d4edda'; // 成功したら緑色に
                selector.disabled = true;
            } catch (err) {
                alert('更新に失敗しました: ' + err.message);
                updateButton.disabled = false;
                updateButton.textContent = 'このグループの親を更新';
            }
        };
        
        selectorDiv.appendChild(selectorLabel);
        selectorDiv.appendChild(selector);
        
        taskItem.appendChild(childList);
        taskItem.appendChild(selectorDiv);
        taskItem.appendChild(updateButton);
        
        groupDiv.appendChild(taskItem);
        DOM.categoryTasks.appendChild(groupDiv);
    }
}
