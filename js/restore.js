// js/restore.js
import { auth, db } from '../firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { collection, getDocs, writeBatch, doc, addDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

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
};

const COLLECTION_NAMES = [
    'categories',
    'tags',
    'effect_units',
    'effect_super_categories',
    'effect_types',
    'items',
    'item_sources'
];
const CHARACTER_BASES_COLLECTION_NAME = 'character_bases';

// --- 認証処理 ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        DOM.passwordPrompt.style.display = 'none';
        DOM.restoreContent.style.display = 'block';
    } else {
        DOM.passwordPrompt.style.display = 'flex';
        DOM.restoreContent.style.display = 'none';
    }
});

DOM.loginButton.addEventListener('click', () => {
    const email = DOM.adminEmailInput.value;
    const password = DOM.adminPasswordInput.value;
    signInWithEmailAndPassword(auth, email, password)
        .catch(err => {
            DOM.passwordError.textContent = 'ログインに失敗しました。';
            console.error(err);
        });
});

DOM.logoutButton.addEventListener('click', () => signOut(auth));


// --- 復元ボタンの有効化/無効化ロジック ---
function checkRestoreButtonState() {
    const fileSelected = DOM.backupFileInput.files.length > 0;
    const confirmTextEntered = DOM.confirmTextInput.value === 'RESTORE';
    DOM.restoreButton.disabled = !(fileSelected && confirmTextEntered);
}
DOM.backupFileInput.addEventListener('change', checkRestoreButtonState);
DOM.confirmTextInput.addEventListener('input', checkRestoreButtonState);


// --- 復元処理 ---
DOM.restoreButton.addEventListener('click', async () => {
    if (!confirm('本当によろしいですか？現在のデータベースは完全に上書きされます。この操作は絶対に元に戻せません。')) {
        return;
    }

    DOM.restoreButton.disabled = true;
    DOM.progressArea.style.display = 'block';
    logProgress('復元処理を開始します...');

    const file = DOM.backupFileInput.files[0];
    const reader = new FileReader();

    reader.onload = async (e) => {
        try {
            const backupData = JSON.parse(e.target.result);
            logProgress('バックアップファイルの読み込み完了。');

            // 1. 全データの削除
            logProgress('\n--- 現在の全データを削除しています ---');
            for (const collName of COLLECTION_NAMES) {
                await deleteCollection(collName);
            }
            // character_basesのサブコレクションを削除
            const charBaseTypes = Object.keys(backupData.collections.character_bases || {});
            for (const baseType of charBaseTypes) {
                await deleteCollection(`${CHARACTER_BASES_COLLECTION_NAME}/${baseType}/options`);
            }
            logProgress('全データの削除完了。');

            // 2. 新しいデータの書き込み
            logProgress('\n--- バックアップからデータを復元しています ---');
            for (const collName of COLLECTION_NAMES) {
                const collectionData = backupData.collections[collName];
                if (collectionData) {
                    await restoreCollection(collName, collectionData);
                }
            }
            // character_basesのサブコレクションを復元
            const charBasesData = backupData.collections.character_bases;
            if (charBasesData) {
                for (const baseType in charBasesData) {
                    const subCollectionData = charBasesData[baseType];
                    if (subCollectionData) {
                        await restoreCollection(`${CHARACTER_BASES_COLLECTION_NAME}/${baseType}/options`, subCollectionData);
                    }
                }
            }

            logProgress('\n--- 復元完了 ---');
            alert('データベースの復元が完了しました。管理ページをリロードして確認してください。');

        } catch (error) {
            logProgress(`\nエラー発生: ${error.message}`);
            console.error(error);
            alert('復元処理中にエラーが発生しました。詳細はコンソールを確認してください。');
        } finally {
            // フォームをリセット
            DOM.backupFileInput.value = '';
            DOM.confirmTextInput.value = '';
            checkRestoreButtonState();
        }
    };
    reader.readAsText(file);
});

function logProgress(message) {
    DOM.progressArea.textContent += message + '\n';
    DOM.progressArea.scrollTop = DOM.progressArea.scrollHeight;
}

async function deleteCollection(collectionPath) {
    logProgress(`コレクション[${collectionPath}]を削除中...`);
    const collRef = collection(db, collectionPath);
    const snapshot = await getDocs(collRef);
    if (snapshot.size === 0) {
        logProgress(` -> [${collectionPath}] は空です。スキップ。`);
        return;
    }
    
    // Firestoreのバッチ書き込みは500件まで
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
    // 残りのバッチをコミット
    if (count % batchSize !== 0) {
        await batch.commit();
    }
    logProgress(` -> [${collectionPath}] ${count}件のドキュメントを削除しました。`);
}

async function restoreCollection(collectionPath, dataArray) {
    logProgress(`コレクション[${collectionPath}]を復元中...`);
    if (!dataArray || dataArray.length === 0) {
        logProgress(` -> [${collectionPath}] データがありません。スキップ。`);
        return;
    }
    const collRef = collection(db, collectionPath);
    
    const batchSize = 499;
    let count = 0;
    let batch = writeBatch(db);

    for (const data of dataArray) {
        const docRef = doc(collRef); // 新しいIDでドキュメント参照を作成
        batch.set(docRef, data);
        count++;
        if (count % batchSize === 0) {
            await batch.commit();
            batch = writeBatch(db);
        }
    }
    // 残りのバッチをコミット
    if (count % batchSize !== 0) {
        await batch.commit();
    }
    logProgress(` -> [${collectionPath}] ${count}件のドキュメントを復元しました。`);
}
