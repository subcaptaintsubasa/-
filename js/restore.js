// js/restore.js
import { auth, db } from '../firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { collection, getDocs, writeBatch, doc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

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
    forceBackupLink: document.getElementById('forceBackupLink'),
};

const COLLECTIONS_TO_BACKUP = [
    'categories', 'tags', 'effect_units', 'effect_super_categories', 'effect_types', 'items', 'item_sources'
];
const CHARACTER_BASES_COLLECTION_NAME = 'character_bases';
const CHARACTER_BASE_TYPES = ['headShape', 'correction', 'color', 'pattern'];

let parsedBackupData = null; // 読み込んだバックアップデータを保持

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

// --- UI制御ロジック ---
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
    DOM.previewContent.textContent = 'ZIPファイルを解凍・解析中...';

    try {
        const zip = await JSZip.loadAsync(file);
        const jsonFile = Object.values(zip.files).find(f => f.name.endsWith('.json'));

        if (!jsonFile) {
            throw new Error('ZIPファイル内にJSONファイルが見つかりません。');
        }

        const jsonString = await jsonFile.async('string');
        const data = JSON.parse(jsonString);

        if (!data.version || !data.collections) {
            throw new Error('バックアップファイルの形式が正しくありません。(version/collectionsが見つかりません)');
        }
        
        parsedBackupData = data; // 復元用にデータを保持
        
        let previewText = `バックアップバージョン: ${data.version}\n`;
        previewText += `作成日時: ${new Date(data.createdAt).toLocaleString('ja-JP')}\n\n`;
        previewText += `[コレクション別件数]\n`;

        for(const collName of COLLECTIONS_TO_BACKUP) {
            previewText += `- ${collName}: ${data.collections[collName]?.length || 0}件\n`;
        }
        const charBaseData = data.collections.character_bases || {};
        for(const baseType of CHARACTER_BASE_TYPES) {
            previewText += `- character_bases/${baseType}: ${charBaseData[baseType]?.length || 0}件\n`;
        }
        
        DOM.previewContent.textContent = previewText;
    } catch (error) {
        DOM.previewContent.textContent = `エラー: ${error.message}`;
        parsedBackupData = null; // エラー時はデータをクリア
    } finally {
        updateButtonStates();
    }
});


// --- 復元処理 ---
DOM.restoreButton.addEventListener('click', async () => {
    if (!parsedBackupData) {
        alert('先にプレビューを実行して、バックアップファイルの内容を確認してください。');
        return;
    }

    if (!confirm('【最終確認】現在のデータベースを完全に上書きします。この操作は絶対に元に戻せません。')) {
        return;
    }

    DOM.restoreButton.disabled = true;
    DOM.progressArea.style.display = 'block';
    logProgress('復元処理を開始します...');

    try {
        // 保険①: 現在のデータの強制バックアップ
        await forceBackupCurrentData();

        // 保険②: ユーザーに最終確認を促す
        if (!prompt('最終バックアップがダウンロードされました。安全な場所に保存しましたか？\n復元を続けるには「OK」と入力してください。') === 'OK') {
             throw new Error('ユーザーにより復元がキャンセルされました。');
        }

        logProgress('\n--- 現在の全データを削除しています ---');
        await deleteAllData();

        logProgress('\n--- バックアップからデータを復元しています ---');
        await restoreAllData(parsedBackupData);

        logProgress('\n--- 復元完了 ---');
        alert('データベースの復元が完了しました。管理ページをリロードして確認してください。');

    } catch (error) {
        logProgress(`\nエラー発生: ${error.message}`);
        console.error(error);
        alert(`復元処理中にエラーが発生しました。\nメッセージ: ${error.message}`);
    } finally {
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

async function forceBackupCurrentData() {
    logProgress('\n--- 保険機能: 現在のデータをバックアップしています ---');
    const collectionsData = {};
    for (const collName of COLLECTIONS_TO_BACKUP) {
        const snapshot = await getDocs(collection(db, collName));
        collectionsData[collName] = snapshot.docs.map(d => d.data());
    }
    collectionsData[CHARACTER_BASES_COLLECTION_NAME] = {};
    for (const baseType of CHARACTER_BASE_TYPES) {
        const snapshot = await getDocs(collection(db, `${CHARACTER_BASES_COLLECTION_NAME}/${baseType}/options`));
        collectionsData[CHARACTER_BASES_COLLECTION_NAME][baseType] = snapshot.docs.map(d => d.data());
    }
    
    const data = {
        version: "pre-restore-force-backup",
        createdAt: new Date().toISOString(),
        collections: collectionsData
    };
    
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    
    DOM.forceBackupLink.href = url;
    DOM.forceBackupLink.download = `force-backup-before-restore-${timestamp}.json`;
    DOM.forceBackupLink.click();
    URL.revokeObjectURL(url);
    logProgress('-> 強制バックアップファイルをダウンロードしました。');
}


async function deleteAllData() {
    for (const collName of COLLECTIONS_TO_BACKUP) {
        await deleteCollection(collName);
    }
    for (const baseType of CHARACTER_BASE_TYPES) {
        await deleteCollection(`${CHARACTER_BASES_COLLECTION_NAME}/${baseType}/options`);
    }
    logProgress('全データの削除完了。');
}

async function deleteCollection(collectionPath) {
    logProgress(`コレクション[${collectionPath}]を削除中...`);
    const collRef = collection(db, collectionPath);
    const snapshot = await getDocs(collRef);
    if (snapshot.size === 0) {
        logProgress(` -> スキップ (空)`);
        return;
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
    if (count % batchSize !== 0) {
        await batch.commit();
    }
    logProgress(` -> ${count}件のドキュメントを削除しました。`);
}

async function restoreAllData(backupData) {
    const collections = backupData.collections;
    for (const collName of COLLECTIONS_TO_BACKUP) {
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
    if (!dataArray || dataArray.length === 0) {
        logProgress(` -> スキップ (データなし)`);
        return;
    }
    const collRef = collection(db, collectionPath);
    const batchSize = 499;
    let count = 0;
    let batch = writeBatch(db);
    for (const data of dataArray) {
        const docRef = doc(collRef); 
        // タイムスタンプが文字列の場合、FirestoreのTimestampオブジェクトに変換する
        const dataWithTimestamps = convertTimestamps(data);
        batch.set(docRef, dataWithTimestamps);
        count++;
        if (count % batchSize === 0) {
            await batch.commit();
            batch = writeBatch(db);
        }
    }
    if (count % batchSize !== 0) {
        await batch.commit();
    }
    logProgress(` -> ${count}件のドキュメントを復元しました。`);
}

function convertTimestamps(data) {
    for (const key in data) {
        if (typeof data[key] === 'object' && data[key] !== null) {
            // FirestoreのTimestamp形式 `{ seconds: ..., nanoseconds: ... }` をチェック
            if ('seconds' in data[key] && 'nanoseconds' in data[key] && Object.keys(data[key]).length === 2) {
                // これは既にTimestampオブジェクトとして扱える形式なので何もしない
            } else {
                convertTimestamps(data[key]); // 再帰的に探索
            }
        } else if (typeof data[key] === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(data[key])) {
             // ISO文字列の日付をTimestampに変換
            data[key] = serverTimestamp(); // 復元時の時間でタイムスタンプを更新
        }
    }
    return data;
}
