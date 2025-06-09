// js/restore.js (ID再接続パズルツール - 最終版)
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
    tasksArea: document.getElementById('tasksArea'),
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
    DOM.tasksArea.innerHTML = '<p>データを読み込んで分析しています...</p>';
    DOM.tasksArea.style.display = 'block';

    try {
        const oldBackupString = await file.text();
        const oldData = JSON.parse(oldBackupString).collections;

        const snapshot = await getDocs(collection(db, 'categories'));
        const newCategories = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        const newParentCategories = newCategories.filter(c => !c.parentId);

        DOM.tasksArea.innerHTML = '<h3>カテゴリの親子関係 再接続</h3>';
        
        // ★★★ 新ロジック: 古いバックアップから親子関係の「名前のペア」を作成 ★★★
        const oldParentIdToNameMap = new Map();
        oldData.categories.forEach(c => {
            // バックアップに自身のIDがないため、名前をキーにする
            oldParentIdToNameMap.set(c.name, c.parentId);
        });

        // 現在のDBデータから、同じ親を持つ子をグループ化
        const childrenGroupedByCurrentParent = newCategories
            .filter(c => c.parentId)
            .reduce((acc, cat) => {
                const parentId = cat.parentId;
                if (!acc[parentId]) acc[parentId] = [];
                acc[parentId].push(cat);
                return acc;
            }, {});

        // グループごとにUIを生成
        for (const currentParentId in childrenGroupedByCurrentParent) {
            const childrenGroup = childrenGroupedByCurrentParent[currentParentId];
            
            // このグループの代表として、最初の子供の古い親の名前を取得
            const representativeChild = childrenGroup[0];
            const oldParentIdForThisGroup = oldParentIdToNameMap.get(representativeChild.name);
            const oldParent = oldData.categories.find(c => c.id === oldParentIdForThisGroup);
            const oldParentName = oldParent ? oldParent.name : "不明(元々親なし？)";

            const groupDiv = document.createElement('div');
            groupDiv.className = 'task-group';
            groupDiv.innerHTML = `
                <p>以下のグループは、本来は「<strong>${oldParentName}</strong>」の子カテゴリでした。</p>
                <ul>${childrenGroup.map(c => `<li>${c.name}</li>`).join('')}</ul>
            `;
            
            const taskItem = document.createElement('div');
            taskItem.className = 'task-item';

            const selectorLabel = document.createElement('label');
            selectorLabel.textContent = '割り当てる新しい親を選択 →';
            
            const selector = document.createElement('select');
            selector.innerHTML = `<option value="">親なし (最上位にする)</option>`;
            newParentCategories.forEach(p => {
                selector.innerHTML += `<option value="${p.id}">${p.name}</option>`;
            });
            
            const updateButton = document.createElement('button');
            updateButton.textContent = 'このグループの親を更新';
            updateButton.onclick = async () => {
                const newParentId = selector.value;
                const newParentName = newParentId ? newParentCategories.find(p=>p.id===newParentId).name : "なし";
                if (!confirm(`このグループ(${childrenGroup.length}件)の親を「${newParentName}」に設定します。よろしいですか？`)) return;
                
                updateButton.disabled = true;
                updateButton.textContent = '更新中...';

                try {
                    const batch = writeBatch(db);
                    childrenGroup.forEach(child => {
                        const docRef = doc(db, 'categories', child.id);
                        batch.update(docRef, { parentId: newParentId });
                    });
                    await batch.commit();
                    alert('更新が完了しました！');
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
            DOM.tasksArea.appendChild(groupDiv);
        }
        
    } catch (error) {
        DOM.tasksArea.innerHTML = `<p style="color: red;">エラー: ${error.message}</p>`;
        console.error(error);
    } finally {
        DOM.analyzeButton.disabled = false;
        DOM.analyzeButton.textContent = '再分析';
    }
});
