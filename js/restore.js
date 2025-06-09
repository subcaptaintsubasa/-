// js/restore.js (ID再接続パズルツール - ID修正版)
import { auth, db } from '../firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { collection, getDocs, writeBatch, doc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// ★★★ DOM定義の修正 ★★★
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
    tasksArea: document.getElementById('tasksArea'), // categoryTasks -> tasksArea に変更
};

// --- 認証 (変更なし) ---
onAuthStateChanged(auth, user => {
    DOM.passwordPrompt.style.display = user ? 'none' : 'flex';
    DOM.mainContent.style.display = user ? 'block' : 'none';
});
DOM.loginButton.addEventListener('click', () => signInWithEmailAndPassword(auth, DOM.adminEmailInput.value, DOM.adminPasswordInput.value).catch(err => DOM.passwordError.textContent = 'ログイン失敗'));
DOM.logoutButton.addEventListener('click', () => signOut(auth));

// --- UI制御 (変更なし) ---
DOM.backupFileInput.addEventListener('change', () => {
    DOM.analyzeButton.disabled = DOM.backupFileInput.files.length === 0;
});

// --- 分析処理 ---
DOM.analyzeButton.addEventListener('click', async () => {
    const file = DOM.backupFileInput.files[0];
    if (!file) return;

    DOM.analyzeButton.disabled = true;
    DOM.analyzeButton.textContent = '分析中...';
    // ★★★ DOM変数名の修正 ★★★
    DOM.tasksArea.style.display = 'block';
    DOM.tasksArea.innerHTML = '<p>データを読み込んで分析しています...</p>';

    try {
        const oldBackupString = await file.text();
        const oldData = JSON.parse(oldBackupString).collections;

        const newDataSnapshot = await getDocs(collection(db, 'categories'));
        const newCategories = newDataSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        
        const newParentCategories = newCategories.filter(c => !c.parentId);

        // ★★★ DOM変数名の修正 ★★★
        DOM.tasksArea.innerHTML = '<h3>カテゴリの親子関係 再接続</h3>';
        
        // 古いデータから親子関係のグループを作成
        const oldChildrenByParentId = oldData.categories
            .filter(c => c.parentId)
            .reduce((acc, cat) => {
                const parentId = cat.parentId;
                if (!acc[parentId]) acc[parentId] = [];
                acc[parentId].push(cat.name);
                return acc;
            }, {});

        // グループごとにUIを生成
        for (const oldParentId in oldChildrenByParentId) {
            const oldChildrenNames = oldChildrenByParentId[oldParentId];
            const oldParent = oldData.categories.find(c => c.id === oldParentId);

            if (!oldParent) continue;

            const groupDiv = document.createElement('div');
            groupDiv.className = 'task-group';
            groupDiv.innerHTML = `
                <p>以下のグループは、本来「<strong>${oldParent.name}</strong>」の子カテゴリでした。</p>
                <ul>${oldChildrenNames.map(name => `<li>${name}</li>`).join('')}</ul>
            `;
            
            const taskItem = document.createElement('div');
            taskItem.className = 'task-item';

            const selectorLabel = document.createElement('label');
            selectorLabel.textContent = '現在の親カテゴリから正しいものを選択 →';
            
            const selector = document.createElement('select');
            selector.innerHTML = `<option value="">選択してください...</option>`;
            newParentCategories.forEach(p => {
                const isRecommended = p.name === oldParent.name;
                selector.innerHTML += `<option value="${p.id}" ${isRecommended ? 'selected' : ''}>${p.name} ${isRecommended ? '(推奨)' : ''}</option>`;
            });

            const updateButton = document.createElement('button');
            updateButton.textContent = 'このグループの親を更新';
            updateButton.onclick = async () => {
                const newParentId = selector.value;
                if (!newParentId) {
                    alert('親カテゴリを選択してください。');
                    return;
                }
                if (!confirm(`このグループの親を「${newParentCategories.find(p=>p.id===newParentId).name}」に設定します。よろしいですか？`)) return;
                
                updateButton.disabled = true;
                updateButton.textContent = '更新中...';

                try {
                    const batch = writeBatch(db);
                    const childrenToUpdate = newCategories.filter(c => oldChildrenNames.includes(c.name));
                    
                    childrenToUpdate.forEach(child => {
                        const docRef = doc(db, 'categories', child.id);
                        batch.update(docRef, { parentId: newParentId });
                    });
                    
                    await batch.commit();
                    alert('更新しました！');
                    groupDiv.style.border = '2px solid #28a745';
                    groupDiv.style.backgroundColor = '#d4edda';
                } catch (err) {
                    alert('更新に失敗しました: ' + err.message);
                    updateButton.disabled = false;
                    updateButton.textContent = 'このグループの親を更新';
                }
            };
            
            taskItem.appendChild(selectorLabel);
            taskItem.appendChild(selector);
            taskItem.appendChild(updateButton);
            groupDiv.appendChild(taskItem);
            // ★★★ DOM変数名の修正 ★★★
            DOM.tasksArea.appendChild(groupDiv);
        }
        
    } catch (error) {
        // ★★★ DOM変数名の修正 ★★★
        DOM.tasksArea.innerHTML = `<p style="color: red;">エラー: ${error.message}</p>`;
        console.error(error);
    } finally {
        DOM.analyzeButton.disabled = false;
        DOM.analyzeButton.textContent = '再分析';
    }
});
