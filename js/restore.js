// js/restore.js (ID再マッピング・パズルツール)
import { auth, db } from '../firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { collection, getDocs, writeBatch, doc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

const DOM = {
    // ... (UI要素の取得はhtmlに合わせて調整)
    passwordPrompt: document.getElementById('password-prompt'),
    mainContent: document.getElementById('main-content'),
    loginButton: document.getElementById('loginButton'),
    logoutButton: document.getElementById('logoutButton'),
    backupFileInput: document.getElementById('backupFile'),
    generateMapButton: document.getElementById('generateMapButton'),
    mappingArea: document.getElementById('mappingArea'),
    categoryParentMapContainer: document.getElementById('categoryParentMapContainer'),
    tagCategoryMapContainer: document.getElementById('tagCategoryMapContainer'),
    itemTagMapContainer: document.getElementById('itemTagMapContainer'),
    applyAllButton: document.getElementById('applyAllButton'),
};

let oldData, newData, idMapByName;

// --- 認証 ---
onAuthStateChanged(auth, user => {
    DOM.passwordPrompt.style.display = user ? 'none' : 'flex';
    DOM.mainContent.style.display = user ? 'block' : 'none';
});
DOM.loginButton.addEventListener('click', () => signInWithEmailAndPassword(auth, document.getElementById('adminEmailInput').value, document.getElementById('adminPasswordInput').value));
DOM.logoutButton.addEventListener('click', () => signOut(auth));

// --- UI制御 ---
DOM.backupFileInput.addEventListener('change', () => {
    DOM.generateMapButton.disabled = DOM.backupFileInput.files.length === 0;
});

// --- メイン処理 ---
DOM.generateMapButton.addEventListener('click', async () => {
    DOM.generateMapButton.disabled = true;
    DOM.generateMapButton.textContent = '処理中...';

    try {
        const file = DOM.backupFileInput.files[0];
        const oldBackupString = await file.text();
        oldData = JSON.parse(oldBackupString).collections;
        newData = await fetchCurrentDataWithIds();
        idMapByName = createIdNameMaps(newData);

        displayCategoryParentMappingUI();
        displayTagCategoryMappingUI();
        displayItemTagMappingUI();

        DOM.mappingArea.style.display = 'block';
    } catch (e) {
        alert('エラー: ' + e.message);
        console.error(e);
    } finally {
        DOM.generateMapButton.textContent = 'マッピングリストを再作成';
        DOM.generateMapButton.disabled = false;
    }
});

DOM.applyAllButton.addEventListener('click', async () => {
    if(!confirm('本当にこれらの変更をデータベースに適用しますか？この操作は元に戻せません。')) return;

    try {
        const batch = writeBatch(db);
        
        // 1. カテゴリの親子関係
        document.querySelectorAll('#categoryParentMapContainer .mapping-row').forEach(row => {
            const newParentId = row.querySelector('select').value;
            if (newParentId) {
                const childIds = JSON.parse(row.dataset.childIds);
                childIds.forEach(childId => {
                    batch.update(doc(db, 'categories', childId), { parentId: newParentId });
                });
            }
        });

        // 2. タグのカテゴリ所属
        document.querySelectorAll('#tagCategoryMapContainer .mapping-row').forEach(row => {
            const newCategoryId = row.querySelector('select').value;
            if (newCategoryId) {
                 const tagId = row.dataset.tagId;
                 batch.update(doc(db, 'tags', tagId), { categoryIds: [newCategoryId] });
            }
        });

        // 3. アイテムのタグ
        document.querySelectorAll('#itemTagMapContainer .mapping-row').forEach(row => {
            const newItemTagIds = Array.from(row.querySelectorAll('select option:checked')).map(opt => opt.value);
            const itemId = row.dataset.itemId;
            batch.update(doc(db, 'items', itemId), { tags: newItemTagIds });
        });

        await batch.commit();
        alert('データベースの更新が完了しました！管理ページをリロードして確認してください。');

    } catch(e) {
        alert('データベースの更新中にエラーが発生しました: ' + e.message);
        console.error(e);
    }
});


// --- データ取得・UI構築ヘルパー ---
async function fetchCurrentDataWithIds() {
    const data = {};
    const collections = ['categories', 'tags', 'effect_units', 'effect_super_categories', 'effect_types', 'items', 'item_sources'];
    for (const collName of collections) {
        const snapshot = await getDocs(collection(db, collName));
        data[collName] = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    return data;
}

function createIdNameMaps(data) {
    const maps = {};
    for (const key in data) {
        maps[key] = new Map(data[key].map(item => [item.name, item.id]));
    }
    return maps;
}

function displayCategoryParentMappingUI() {
    const container = DOM.categoryParentMapContainer;
    container.innerHTML = '';
    const parentGroups = {};
    newData.categories.filter(c => c.parentId).forEach(c => {
        if (!parentGroups[c.parentId]) parentGroups[c.parentId] = [];
        parentGroups[c.parentId].push(c);
    });

    const oldParents = oldData.categories.filter(c => !c.parentId);

    for (const parentId in parentGroups) {
        const children = parentGroups[parentId];
        const row = document.createElement('div');
        row.className = 'mapping-row';
        row.dataset.childIds = JSON.stringify(children.map(c => c.id));

        row.innerHTML = `
            <div class="group-members">
                <strong>現在のグループ:</strong><br>
                ${children.map(c => c.name).join(', ')}
            </div>
            <div>
                <label>元の親カテゴリ:</label>
                <select>
                    <option value="">選択してください</option>
                    ${oldParents.map(p => `<option value="${idMapByName.categories.get(p.name)}">${p.name}</option>`).join('')}
                </select>
            </div>
        `;
        container.appendChild(row);
    }
}

function displayTagCategoryMappingUI() {
    // タグは1対1なので、よりシンプルに
    const container = DOM.tagCategoryMapContainer;
    container.innerHTML = '';
    const oldChildCategories = oldData.categories.filter(c => c.parentId);

    newData.tags.forEach(newTag => {
        const oldTag = oldData.tags.find(t => t.name === newTag.name);
        if(!oldTag || !oldTag.categoryIds || oldTag.categoryIds.length === 0) return;

        const row = document.createElement('div');
        row.className = 'mapping-row';
        row.dataset.tagId = newTag.id;
        
        row.innerHTML = `
             <div class="group-members"><strong>タグ:</strong> ${newTag.name}</div>
             <div>
                <label>元の所属カテゴリ:</label>
                <select>
                    <option value="">選択してください</option>
                    ${oldChildCategories.map(c => `<option value="${idMapByName.categories.get(c.name)}">${c.name}</option>`).join('')}
                </select>
            </div>
        `;
        container.appendChild(row);
        // 推測して選択状態にする
        const oldCatId = oldTag.categoryIds[0];
        const oldCat = oldData.categories.find(c => c.id === oldCatId);
        if(oldCat) {
            const newCatId = idMapByName.categories.get(oldCat.name);
            if(newCatId) row.querySelector('select').value = newCatId;
        }
    });
}

function displayItemTagMappingUI() {
    const container = DOM.itemTagMapContainer;
    container.innerHTML = '';

    newData.items.forEach(newItem => {
        const oldItem = oldData.items.find(i => i.name === newItem.name);
        if(!oldItem || !oldItem.tags || oldItem.tags.length === 0) return;

        const row = document.createElement('div');
        row.className = 'mapping-row';
        row.dataset.itemId = newItem.id;

        const oldTagNames = oldItem.tags.map(oldTagId => oldData.tags.find(t => t.id === oldTagId)?.name).filter(Boolean);
        
        row.innerHTML = `
            <div class="group-members">
                <strong>アイテム:</strong> ${newItem.name}<br>
                <small>（元々のタグ: ${oldTagNames.join(', ')}）</small>
            </div>
            <div>
                <label>新しいタグを選択:</label>
                <select multiple size="5">
                    ${newData.tags.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
                </select>
            </div>
        `;
        container.appendChild(row);
        // 推測して選択
        const select = row.querySelector('select');
        oldTagNames.forEach(oldName => {
            const newId = idMapByName.tags.get(oldName);
            const option = select.querySelector(`option[value="${newId}"]`);
            if(option) option.selected = true;
        });
    });
}
