// js/restore.js (ID維持対応 最終版)
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
    restoreButton: document.getElementById('restoreButton'),
    progressArea: document.getElementById('progressArea'),
    previewButton: document.getElementById('previewButton'),
    previewArea: document.getElementById('previewArea'),
    previewContent: document.getElementById('previewContent'),
};

const COLLECTIONS_TO_RESTORE = [
    'categories', 'tags', 'effect_units', 'effect_super_categories', 'effect_types', 'items', 'item_sources'
];
const CHARACTER_BASES_COLLECTION_NAME = 'character_bases';

let parsedBackupData = null;

// --- 認証処理 (変更なし) ---
onAuthStateChanged(auth, (user) => {
    if (user) DOM.passwordPrompt.style.display = 'none';
    else DOM.passwordPrompt.style.display = 'flex';
    DOM.restoreContent.style.display = user ? 'block' : 'none';
});
DOM.loginButton.addEventListener('click', () => {
    signInWithEmailAndPassword(auth, DOM.adminEmailInput.value, DOM.adminPasswordInput.value)
        .catch(err => DOM.passwordError.textContent = 'ログインに失敗しました。');
});
DOM.logoutButton.addEventListener('click', () => signOut(auth));

// --- UI制御 ---
function updateButtonStates() {
    const fileSelected = DOM.backupFileInput.files.length > 0;
    const confirmTextEntered = DOM.confirmTextInput.value === 'RESTORE';
    DOM.previewButton.disabled = !fileSelected;
    DOM.restoreButton.disabled = !(fileSelected && confirmTextEntered && parsedBackupData);
}
DOM.backupFileInput.addEventListener('change', () => {
    parsedBackupData = null;
    DOM.previewArea.style.display = 'none';
    updateButtonStates();
});
DOM.confirmTextInput.addEventListener('input', updateButtonStates);

// --- プレビュー機能 ---
DOM.previewButton.addEventListener('click', async () => {
    const file = DOM.backupFileInput.files[0];
    if (!file) return;

    DOM.previewButton.disabled = true;
    DOM.previewArea.style.display = 'block';
    DOM.previewContent.textContent = 'バックアップファイルを解析中...';

    try {
        const jsonString = await file.text();
        const data = JSON.parse(jsonString);

        if (!data.version || !data.collections || !data.version.endsWith('-id')) {
            throw new Error('ID情報が含まれていない、古い形式のバックアップファイルの可能性があります。復元できません。');
        }
        
        parsedBackupData = data;
        
        let previewText = `バックアップ形式: ${data.version}\n`;
        previewText += `作成日時: ${new Date(data.createdAt).toLocaleString('ja-JP')}\n\n`;
        previewText += `[コレクション別件数]\n`;

        for(const collName of COLLECTIONS_TO_RESTORE) {
            previewText += `- ${collName}: ${data.collections[collName]?.length || 0}件\n`;
        }
        const charBaseData = data.collections.character_bases || {};
        for(const baseType in charBaseData) {
            previewText += `- character_bases/${baseType}: ${charBaseData[baseType]?.length || 0}件\n`;
        }
        
        DOM.previewContent.textContent = previewText;
    } catch (error) {
        DOM.previewContent.textContent = `エラー: ${error.message}`;
        parsedBackupData = null;
    } finally {
        updateButtonStates();
    }
});

// --- 復元処理 ---
DOM.restoreButton.addEventListener('click', async () => {
    if (!parsedBackupData) {
        alert('先にプレビューを実行し、バックアップファイルの内容を確認してください。');
        return;
    }
    if (!confirm('【最終確認】現在のデータベースを完全に上書きします。この操作は絶対に元に戻せません。')) {
        return;
    }

    DOM.restoreButton.disabled = true;
    DOM.progressArea.style.display = 'block';
    logProgress('復元処理を開始します...');

    try {
        logProgress('\n--- 現在の全データを削除しています ---');
        await deleteAllData();

        logProgress('\n--- バックアップからデータを復元しています ---');
        await restoreAllData(parsedBackupData);

        logProgress('\n--- 復元完了 ---');
        alert('データベースの復元が完了しました。\n\n【重要】必ず管理ページに戻り、ブラウザをリロード（再読み込み）して、最新のデータを表示してください。');
    } catch (error) {
        logProgress(`\nエラー発生: ${error.message}`);
        console.error(error);
        alert(`復元処理中にエラーが発生しました。\nメッセージ: ${error.message}`);
    } finally {
        // フォームをリセット
        DOM.backupFileInput.value = '';
        DOM.confirmTextInput.value = '';
        parsedBackupData = null;
        DOM.previewArea.style.display = 'none';
        updateButtonStates();
    }
});

function logProgress(message) {
    DOM.progressArea.textContent += message + '\n';
    DOM.progressArea.scrollTop = DOM.progressArea.scrollHeight;
}

async function deleteAllData() {
    for (const collName of COLLECTIONS_TO_RESTORE) {
        await deleteCollection(collName);
    }
    const charBasesSnapshot = await getDocs(collection(db, CHARACTER_BASES_COLLECTION_NAME));
    for (const baseTypeDoc of charBasesSnapshot.docs) {
        await deleteCollection(`${CHARACTER_BASES_COLLECTION_NAME}/${baseTypeDoc.id}/options`);
    }
    logProgress('全データの削除完了。');
}

async function deleteCollection(collectionPath) {
    logProgress(`コレクション[${collectionPath}]を削除中...`);
    const collRef = collection(db, collectionPath);
    const snapshot = await getDocs(collRef);
    if (snapshot.size === 0) {
        logProgress(` -> スキップ (空)`); return;
    }
    const batchSize = 499;
    let count = 0;
    let batch = writeBatch(db);
    for (const docSnap of snapshot.docs) {
        batch.delete(docSnap.ref);
        count++;
        if (count % batchSize === 0) {
            await batch.commit();
            batch = writeBatch(db);
        }
    }
    if (count > 0 && count % batchSize !== 0) {
        await batch.commit();
    }
    logProgress(` -> ${count}件のドキュメントを削除しました。`);
}

async function restoreAllData(backupData) {
    const collections = backupData.collections;
    for (const collName of COLLECTIONS_TO_RESTORE) {
        if (collections[collName]) {
            await restoreCollection(collName, collections[collName]);
        }
    }
    const charBasesData = collections.character_bases;
    if (charBasesData) {
        for (const baseType in charBasesData) {
            if (charBasesData[baseType]) {
                await restoreCollection(`${CHARACTER_BASES_COLLECTION_NAME}/${baseType}/options`, charBasesData[baseType]);
            }
        }
    }
}

async function restoreCollection(collectionPath, dataArray) {
    logProgress(`コレクション[${collectionPath}]を復元中...`);
    if (!Array.isArray(dataArray) || dataArray.length === 0) {
        logProgress(` -> スキップ (データなし)`); return;
    }
    const collRef = collection(db, collectionPath);
    const batchSize = 499;
    let count = 0;
    let batch = writeBatch(db);
    for (const data of dataArray) {
        const docId = data._id;
        if (!docId) {
            logProgress(` -> 警告: _idが見つからないデータをスキップします。`);
            continue;
        }
        const docRef = doc(collRef, docId);
        const dataToSet = { ...data };
        delete dataToSet._id;
        batch.set(docRef, dataToSet);
        count++;
        if (count % batchSize === 0) {
            await batch.commit();
            batch = writeBatch(db);
        }
    }
    if (count > 0 && count % batchSize !== 0) {
        await batch.commit();
    }
    logProgress(` -> ${count}件のドキュメントを復元しました。`);
}
