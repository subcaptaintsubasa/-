// js/restore.js (カテゴリ親子関係 復旧ツール - グルーピング修正版)
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

// --- 分析処理 (変更なし) ---
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
        
        // ★★★ 親カテゴリの定義を修正 ★★★
        // 旧バックアップを参考に、本来親だったカテゴリ名をリストアップ
        const oldParentNames = oldBackupData.categories
            .filter(c => !c.parentId)
            .map(c => c.name);
        
        // 現在のDBから、名前に基づいて「親候補」を特定
        parentCategories = currentCategories.filter(c => oldParentNames.includes(c.name));
        
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

// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
// ★★★ レンダリング関数を全面的に修正 ★★★
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
function renderCategoryTasks() {
    // 親カテゴリではないものをすべて「子カテゴリ候補」としてグループ化する
    const parentCategoryIds = new Set(parentCategories.map(p => p.id));
    const childCandidateCategories = currentCategories.filter(c => !parentCategoryIds.has(c.id));

    if (childCandidateCategories.length === 0) {
        DOM.categoryTasks.innerHTML = '<p>修正対象の子カテゴリが見つかりませんでした。すべてのカテゴリが親として認識されています。</p>';
        return;
    }
    
    // UIを作成
    const groupDiv = document.createElement('div');
    groupDiv.className = 'task-group';

    groupDiv.innerHTML = `
        <h3>親子関係の修正</h3>
        <p>以下のカテゴリは、現在「親」として扱われていないため、子カテゴリの可能性があります。</p>
        <p>リストから本来の親を選択し、「選択したカテゴリの親を更新」ボタンを押してください。</p>
    `;

    const taskItem = document.createElement('div');
    taskItem.className = 'task-item';
    taskItem.style.flexDirection = 'column';
    taskItem.style.alignItems = 'flex-start';

    // 子カテゴリのリストをチェックボックスで表示
    const childList = document.createElement('div');
    childList.className = 'child-list';
    childList.innerHTML = `<h4>子に設定するカテゴリを選択:</h4>` + 
        childCandidateCategories.map(c => `
            <div class="checkbox-item">
                <input type="checkbox" id="cat-${c.id}" value="${c.id}" class="child-checkbox">
                <label for="cat-${c.id}">${c.name}</label>
            </div>
        `).join('');
    
    // 親を選択するドロップダウン
    const selectorDiv = document.createElement('div');
    selectorDiv.style.marginTop = '20px';
    selectorDiv.innerHTML = `<label for="parent-selector" style="display:block; margin-bottom:5px;"><b>割り当てる親カテゴリを選択:</b></label>`;
    
    const selector = document.createElement('select');
    selector.id = 'parent-selector';
    selector.innerHTML = `<option value="">親なし (最上位にする)</option>`;
    parentCategories.sort((a,b) => a.name.localeCompare(b.name)).forEach(p => {
        selector.innerHTML += `<option value="${p.id}">${p.name}</option>`;
    });
    
    const updateButton = document.createElement('button');
    updateButton.textContent = '選択したカテゴリの親を更新';
    updateButton.style.marginTop = '15px';

    updateButton.onclick = async () => {
        const selectedChildIds = Array.from(childList.querySelectorAll('.child-checkbox:checked')).map(cb => cb.value);
        const newParentId = selector.value;
        
        if (selectedChildIds.length === 0) {
            alert('親を設定する子カテゴリを1つ以上選択してください。');
            return;
        }

        const newParentName = newParentId ? parentCategories.find(p => p.id === newParentId).name : 'なし';
        if (!confirm(`${selectedChildIds.length}件の子カテゴリの親を「${newParentName}」に更新しますか？`)) return;
        
        updateButton.disabled = true;
        updateButton.textContent = '更新中...';
        try {
            const batch = writeBatch(db);
            selectedChildIds.forEach(childId => {
                const docRef = doc(db, 'categories', childId);
                batch.update(docRef, { parentId: newParentId });
            });
            await batch.commit();
            alert('更新しました！ページを再読み込みするか、再分析して結果を確認してください。');
            DOM.analyzeButton.click(); // 自動で再分析
        } catch (err) {
            alert('更新に失敗しました: ' + err.message);
        } finally {
            updateButton.disabled = false;
            updateButton.textContent = '選択したカテゴリの親を更新';
        }
    };
    
    selectorDiv.appendChild(selector);
    
    taskItem.appendChild(childList);
    taskItem.appendChild(selectorDiv);
    taskItem.appendChild(updateButton);
    
    groupDiv.appendChild(taskItem);
    DOM.categoryTasks.appendChild(groupDiv);
}
