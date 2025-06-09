// js/restore.js (ID再マッピング救出ツール)
import { auth, db } from '../firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { collection, getDocs, writeBatch, doc, setDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

const DOM = {
    passwordPrompt: document.getElementById('password-prompt'),
    restoreContent: document.getElementById('restore-content'),
    loginButton: document.getElementById('loginButton'),
    logoutButton: document.getElementById('logoutButton'),
    adminEmailInput: document.getElementById('adminEmailInput'),
    adminPasswordInput: document.getElementById('adminPasswordInput'),
    passwordError: document.getElementById('passwordError'),
    backupFileInput: document.getElementById('backupFile'),
    confirmTextInput: document.getElementById('confirmText'),
    rescueButton: document.getElementById('rescueButton'),
    progressArea: document.getElementById('progressArea'),
};

const COLLECTIONS_TO_RESCUE = ['categories', 'tags', 'effect_units', 'effect_super_categories', 'effect_types', 'items', 'item_sources'];
const CHARACTER_BASES_COLLECTION_NAME = 'character_bases';
const CHARACTER_BASE_TYPES = ['headShape', 'correction', 'color', 'pattern'];

// --- 認証 ---
onAuthStateChanged(auth, user => {
    DOM.passwordPrompt.style.display = user ? 'none' : 'flex';
    DOM.restoreContent.style.display = user ? 'block' : 'none';
});
DOM.loginButton.addEventListener('click', () => signInWithEmailAndPassword(auth, DOM.adminEmailInput.value, DOM.adminPasswordInput.value).catch(err => DOM.passwordError.textContent = 'ログイン失敗'));
DOM.logoutButton.addEventListener('click', () => signOut(auth));

// --- UI制御 ---
function checkRescueButtonState() {
    const fileSelected = DOM.backupFileInput.files.length > 0;
    const confirmTextEntered = DOM.confirmTextInput.value === 'RESCUE MY DATA';
    DOM.rescueButton.disabled = !(fileSelected && confirmTextEntered);
}
DOM.backupFileInput.addEventListener('change', checkRescueButtonState);
DOM.confirmTextInput.addEventListener('input', checkRescueButtonState);

// --- 救出処理 ---
DOM.rescueButton.addEventListener('click', async () => {
    if (!confirm('【最終警告】本当にデータベースの救出を実行しますか？この操作は取り消せません。')) return;

    DOM.rescueButton.disabled = true;
    DOM.progressArea.style.display = 'block';
    logProgress('救出プロセスを開始します...');

    const file = DOM.backupFileInput.files[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const oldBackupData = JSON.parse(e.target.result);
            if (oldBackupData.version !== "1.0") {
                throw new Error("このツールは version: 1.0 のバックアップファイル専用です。");
            }
            logProgress('古いバックアップファイルの読み込み完了。');

            logProgress('\n--- STEP 1: 現在のデータベースから新IDを取得中 ---');
            const newIdData = await fetchCurrentDataWithIds();
            logProgress('新IDの取得完了。');

            logProgress('\n--- STEP 2: 新旧IDのマッピングを作成中 ---');
            const idMap = createFullIdMap(oldBackupData.collections, newIdData);
            logProgress('IDマッピングの作成完了。');

            logProgress('\n--- STEP 3: バックアップデータのIDを新しいIDに書き換え中 ---');
            const remappedData = remapOldBackupData(oldBackupData.collections, idMap);
            logProgress('IDの書き換え完了。');

            logProgress('\n--- STEP 4: 現在のデータベースを全削除中 ---');
            await deleteAllData(newIdData);
            logProgress('全削除完了。');
            
            logProgress('\n--- STEP 5: 修復済みデータをデータベースに書き込み中 ---');
            await restoreRemappedData(remappedData, idMap);
            logProgress('データの書き込み完了。');

            logProgress('\n--- ★★★ 救出完了 ★★★ ---');
            alert('データベースの救出が完了しました。管理ページをリロードしてデータが正常に表示されるか確認してください。');

        } catch (error) {
            logProgress(`\n致命的なエラー: ${error.message}`);
            console.error(error);
            alert(`救出処理中にエラーが発生しました。\nメッセージ: ${error.message}`);
        }
    };
    reader.readAsText(file);
});

function logProgress(message) {
    DOM.progressArea.textContent += message + '\n';
    DOM.progressArea.scrollTop = DOM.progressArea.scrollHeight;
}

// 1. 現在のDBからデータを取得
async function fetchCurrentDataWithIds() {
    const data = {};
    for (const collName of COLLECTIONS_TO_RESCUE) {
        const snapshot = await getDocs(collection(db, collName));
        data[collName] = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    data.character_bases = {};
    for (const baseType of CHARACTER_BASE_TYPES) {
        const snapshot = await getDocs(collection(db, `${CHARACTER_BASES_COLLECTION_NAME}/${baseType}/options`));
        data.character_bases[baseType] = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    return data;
}

// 2. ID対応表を作成
function createFullIdMap(oldData, newData) {
    const idMap = {};
    const createMap = (collName, oldColl, newColl, keyFields = ['name']) => {
        idMap[collName] = {};
        if (!oldColl || !newColl) return;
        oldColl.forEach(oldDoc => {
            const newDoc = newColl.find(nd => keyFields.every(key => nd[key] === oldDoc[key]));
            if (newDoc) {
                // 旧データにはIDがないので、名前をキーにするしかない
                const oldKey = keyFields.map(key => oldDoc[key]).join('-');
                idMap[collName][oldKey] = newDoc.id;
            }
        });
    };

    // 親子関係が重要なので、カテゴリから先に処理
    logProgress('  - カテゴリのIDマップを作成中...');
    idMap.categories = {};
    const oldCategories = oldData.categories;
    const newCategories = newData.categories;
    // まず親カテゴリをマッピング
    oldCategories.filter(c => !c.parentId).forEach(oldParent => {
        const newParent = newCategories.find(nc => !nc.parentId && nc.name === oldParent.name);
        if (newParent) {
            // ここでは旧IDが不明なため、名前で仮マッピング
            idMap.categories[oldParent.name] = newParent.id;
        }
    });
    // 次に子カテゴリをマッピング
    oldCategories.filter(c => c.parentId).forEach(oldChild => {
        const oldParent = oldCategories.find(p => p.name === oldCategories.find(oc => oc.parentId === oldChild.parentId)?.name); // 親の名前を取得
        const newParent = newCategories.find(nc => nc.id === idMap.categories[oldParent.name]);
        const newChild = newCategories.find(nc => nc.parentId === newParent?.id && nc.name === oldChild.name);
        if(newChild){
            idMap.categories[oldChild.name] = newChild.id;
        }
    });

    createMap('tags', oldData.tags, newData.tags);
    createMap('effect_units', oldData.effect_units, newData.effect_units);
    createMap('effect_super_categories', oldData.effect_super_categories, newData.effect_super_categories);
    createMap('effect_types', oldData.effect_types, newData.effect_types);
    createMap('items', oldData.items, newData.items);
    createMap('item_sources', oldData.item_sources, newData.item_sources);

    idMap.character_bases = {};
    for (const baseType of CHARACTER_BASE_TYPES) {
        createMap(baseType, oldData.character_bases?.[baseType], newData.character_bases?.[baseType]);
        idMap.character_bases[baseType] = idMap[baseType];
    }
    return idMap;
}

// 3. 古いデータのIDを書き換え
function remapOldBackupData(oldData, idMap) {
    const remappedData = JSON.parse(JSON.stringify(oldData)); // Deep clone
    
    remappedData.categories.forEach(cat => {
        if(cat.parentId) cat.parentId = idMap.categories[oldData.categories.find(p => p.id === cat.parentId)?.name] || cat.parentId;
    });

    remappedData.tags.forEach(tag => {
        tag.categoryIds = (tag.categoryIds || []).map(oldCatId => idMap.categories[oldData.categories.find(c => c.id === oldCatId)?.name] || oldCatId);
    });

    remappedData.items.forEach(item => {
        item.tags = (item.tags || []).map(oldTagId => idMap.tags[oldData.tags.find(t => t.id === oldTagId)?.name] || oldTagId);
        (item.structured_effects || []).forEach(eff => {
            eff.type = idMap.effect_types[oldData.effect_types.find(et => et.id === eff.type)?.name] || eff.type;
        });
    });

    return remappedData;
}

// 4. 全削除
async function deleteAllData(currentDbData) {
    for (const collName of COLLECTIONS_TO_RESCUE) {
        await deleteCollection(collName, currentDbData[collName].map(d => d.id));
    }
    for (const baseType in currentDbData.character_bases) {
        await deleteCollection(`${CHARACTER_BASES_COLLECTION_NAME}/${baseType}/options`, currentDbData.character_bases[baseType].map(d => d.id));
    }
}

async function deleteCollection(collectionPath, docIds) {
    logProgress(`コレクション[${collectionPath}]を削除中...`);
    if (!docIds || docIds.length === 0) {
        logProgress(` -> スキップ (空)`); return;
    }
    const batchSize = 499;
    let batch = writeBatch(db);
    for (let i = 0; i < docIds.length; i++) {
        batch.delete(doc(db, collectionPath, docIds[i]));
        if ((i + 1) % batchSize === 0) {
            await batch.commit();
            batch = writeBatch(db);
        }
    }
    if (docIds.length % batchSize !== 0) {
        await batch.commit();
    }
    logProgress(` -> ${docIds.length}件のドキュメントを削除しました。`);
}

// 5. 書き戻し
async function restoreRemappedData(remappedData, idMap) {
    const restore = async (collName, data, subKey = null) => {
        let path = collName;
        if(subKey) path = `${collName}/${subKey}/options`;
        const batchSize = 499;
        let batch = writeBatch(db);
        let count = 0;
        for(const docData of data) {
            const newId = subKey ? idMap[subKey][docData.name] : idMap[collName][docData.name];
            if(newId) {
                batch.set(doc(db, path, newId), docData);
                count++;
                if (count % batchSize === 0) { await batch.commit(); batch = writeBatch(db); }
            }
        }
        if (count > 0 && count % batchSize !== 0) { await batch.commit(); }
        logProgress(` -> [${path}] ${count}件を復元しました。`);
    };

    for (const collName of COLLECTIONS_TO_RESCUE) {
        await restore(collName, remappedData[collName]);
    }
    for (const baseType in remappedData.character_bases) {
        await restore(CHARACTER_BASES_COLLECTION_NAME, remappedData.character_bases[baseType], baseType);
    }
}
