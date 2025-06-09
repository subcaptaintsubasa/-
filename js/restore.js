// js/restore.js (最終確定版・親子関係再設定ツール)
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
    tasksContainer: document.getElementById('tasksContainer'),
};

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

// --- 分析と描画 ---
DOM.analyzeButton.addEventListener('click', async () => {
    const file = DOM.backupFileInput.files[0];
    if (!file) return;

    DOM.analyzeButton.disabled = true;
    DOM.analyzeButton.textContent = '分析中...';
    DOM.tasksContainer.innerHTML = '<p>データを読み込んでいます...</p>';

    try {
        // 1. 両方のデータを読み込む
        const oldBackupString = await file.text();
        const oldData = JSON.parse(oldBackupString).collections;

        const currentSnapshot = await getDocs(collection(db, 'categories'));
        const currentData = currentSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        DOM.tasksContainer.innerHTML = ''; // コンテナをクリア
        
        // 2. 親カテゴリのリストを作成 (これは現在のDBのデータでOK)
        const currentParentCategories = currentData.filter(c => !c.parentId || c.parentId === "").sort((a,b) => a.name.localeCompare(b.name));
        
        // 3. 古いデータから子カテゴリグループを作成
        const oldChildrenByParentId = oldData.categories
            .filter(c => c.parentId)
            .reduce((acc, cat) => {
                const parentId = cat.parentId;
                if (!acc[parentId]) acc[parentId] = [];
                acc[parentId].push(cat.name);
                return acc;
            }, {});

        // 4. UIを生成
        for (const oldParentId in oldChildrenByParentId) {
            const childNames = oldChildrenByParentId[oldParentId];
            const oldParent = oldData.categories.find(c => c.id === oldParentId);
            
            if (!oldParent) continue;

            const groupDiv = document.createElement('div');
            groupDiv.className = 'task-group';

            groupDiv.innerHTML = `<h4>旧親カテゴリ: 「${oldParent.name}」</h4>`;

            const taskItem = document.createElement('div');
            taskItem.className = 'task-item';

            const childList = document.createElement('div');
            childList.className = 'child-list';
            childList.innerHTML = `<strong>子カテゴリ:</strong><ul>${childNames.map(name => `<li>${name}</li>`).join('')}</ul>`;

            const selectorDiv = document.createElement('div');
            const selectorLabel = document.createElement('label');
            selectorLabel.textContent = '新しい親を選択:';
            selectorLabel.style.display = 'block';

            const selector = document.createElement('select');
            let optionsHtml = '<option value="">親なし (最上位)</option>';
            currentParentCategories.forEach(p => {
                optionsHtml += `<option value="${p.id}">${p.name}</option>`;
            });
            selector.innerHTML = optionsHtml;

            const updateButton = document.createElement('button');
            updateButton.textContent = 'このグループを更新';
            updateButton.onclick = async () => {
                const newParentId = selector.value;
                const newParentName = newParentId ? currentParentCategories.find(p => p.id === newParentId).name : "なし";

                if (!confirm(`グループ(${childNames.join(', ')})の親を「${newParentName}」に設定しますか？`)) return;

                updateButton.disabled = true;
                updateButton.textContent = '更新中...';
                try {
                    const batch = writeBatch(db);
                    childNames.forEach(name => {
                        const childToUpdate = currentData.find(c => c.name === name);
                        if (childToUpdate) {
                            const docRef = doc(db, 'categories', childToUpdate.id);
                            batch.update(docRef, { parentId: newParentId });
                        }
                    });
                    await batch.commit();
                    alert('更新しました！');
                    taskItem.style.backgroundColor = '#d4edda';
                    selector.disabled = true;
                    updateButton.textContent = '更新完了';
                } catch (err) {
                    alert('更新に失敗しました: ' + err.message);
                    updateButton.disabled = false;
                    updateButton.textContent = 'このグループを更新';
                }
            };
            
            selectorDiv.appendChild(selectorLabel);
            selectorDiv.appendChild(selector);
            
            taskItem.appendChild(childList);
            taskItem.appendChild(selectorDiv);
            taskItem.appendChild(updateButton);
            
            groupDiv.appendChild(taskItem);
            DOM.tasksContainer.appendChild(groupDiv);
        }
        
    } catch (error) {
        DOM.tasksContainer.innerHTML = `<p style="color: red;">処理エラー: ${error.message}</p>`;
        console.error(error);
    } finally {
        DOM.analyzeButton.disabled = false;
        DOM.analyzeButton.textContent = '分析＆リスト表示';
    }
});
