// js/full_restore.js
import { auth, db } from '../firebase-config.js'; // Ensure this path is correct
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { collection, getDocs, writeBatch, doc, deleteDoc, setDoc, Timestamp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

const DOM = {
    passwordPrompt: document.getElementById('password-prompt'),
    mainContent: document.getElementById('main-content'),
    loginButton: document.getElementById('loginButton'),
    logoutButton: document.getElementById('logoutButton'),
    adminEmailInput: document.getElementById('adminEmailInput'),
    adminPasswordInput: document.getElementById('adminPasswordInput'),
    passwordError: document.getElementById('passwordError'),
    backupZipFileInput: document.getElementById('backupZipFile'),
    confirmDeleteCheckbox: document.getElementById('confirmDeleteCheckbox'),
    executeFullRestoreButton: document.getElementById('executeFullRestoreButton'),
    restoreLog: document.getElementById('restoreLog'),
};

const COLLECTIONS_TO_RESTORE = [
    "categories", "tags", "items", 
    "effect_types", "effect_units", "effect_super_categories", 
    "item_sources"
];
const CHARACTER_BASE_TYPES_FOR_RESTORE = ["headShape", "correction", "color", "pattern"];

// --- Authentication ---
onAuthStateChanged(auth, user => {
    DOM.passwordPrompt.style.display = user ? 'none' : 'flex';
    DOM.mainContent.style.display = user ? 'block' : 'none';
    if (!user) {
        if (DOM.adminEmailInput) DOM.adminEmailInput.value = '';
        if (DOM.adminPasswordInput) DOM.adminPasswordInput.value = ''; // Corrected DOMR to DOM
        if (DOM.passwordError) DOM.passwordError.textContent = '';
        resetUI();
    } else {
        updateRestoreButtonState();
    }
});

DOM.loginButton.addEventListener('click', () => {
    signInWithEmailAndPassword(auth, DOM.adminEmailInput.value, DOM.adminPasswordInput.value)
        .catch(err => { DOM.passwordError.textContent = `ログイン失敗: ${err.message}`; });
});
if (DOM.logoutButton) { // Check if logoutButton exists
    DOM.logoutButton.addEventListener('click', () => { signOut(auth); });
}


// --- UI Control ---
function resetUI() {
    if (DOM.backupZipFileInput) DOM.backupZipFileInput.value = '';
    if (DOM.confirmDeleteCheckbox) DOM.confirmDeleteCheckbox.checked = false;
    if (DOM.restoreLog) DOM.restoreLog.innerHTML = '復元ログはここに表示されます...';
    updateRestoreButtonState();
}

function updateRestoreButtonState() {
    if (DOM.executeFullRestoreButton) {
        DOM.executeFullRestoreButton.disabled = !(
            auth.currentUser &&
            DOM.backupZipFileInput && DOM.backupZipFileInput.files.length > 0 &&
            DOM.confirmDeleteCheckbox && DOM.confirmDeleteCheckbox.checked
        );
    }
}

if (DOM.backupZipFileInput) DOM.backupZipFileInput.addEventListener('change', updateRestoreButtonState);
if (DOM.confirmDeleteCheckbox) DOM.confirmDeleteCheckbox.addEventListener('change', updateRestoreButtonState);

function logToUI(message, type = 'info') {
    if (!DOM.restoreLog) return;
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    DOM.restoreLog.appendChild(logEntry);
    DOM.restoreLog.scrollTop = DOM.restoreLog.scrollHeight;
}

// --- Full Restore Logic ---
if (DOM.executeFullRestoreButton) {
    DOM.executeFullRestoreButton.addEventListener('click', async () => {
        if (!DOM.confirmDeleteCheckbox.checked) {
            alert("データの削除と上書きに同意するチェックボックスをオンにしてください。");
            return;
        }
        const file = DOM.backupZipFileInput.files[0];
        if (!file) {
            alert("バックアップZIPファイルを選択してください。");
            return;
        }
        if (!confirm("最終確認：本当にデータベースの完全復元を実行しますか？この操作は取り消せません。")) {
            return;
        }

        DOM.executeFullRestoreButton.disabled = true;
        DOM.executeFullRestoreButton.textContent = '復元実行中...';
        DOM.restoreLog.innerHTML = '';
        logToUI("完全復元処理を開始します...");

        try {
            if (typeof JSZip === 'undefined') {
                throw new Error('JSZipライブラリが読み込まれていません。ページをリロードするか、開発者にご連絡ください。');
            }

            logToUI("ZIPファイルを解凍中...");
            const jszip = new JSZip();
            const zipContent = await jszip.loadAsync(file);
            const jsonFileInZip = zipContent.file("denpa_item_backup.json"); 

            if (!jsonFileInZip) {
                throw new Error("ZIPファイル内に 'denpa_item_backup.json' が見つかりません。");
            }
            const backupJsonString = await jsonFileInZip.async("string");
            const backupData = JSON.parse(backupJsonString);
            logToUI("バックアップJSONの解析完了。");

            if (backupData.version !== "2.0" || !backupData.collections) {
                throw new Error("バックアップファイルの形式が正しくないか、バージョン2.0ではありません。");
            }
            const collectionsFromBackup = backupData.collections;
            
            logToUI("既存データの削除を開始します...");
            for (const collName of COLLECTIONS_TO_RESTORE) {
                logToUI(`${collName} コレクションの既存データを削除中...`);
                const snapshot = await getDocs(collection(db, collName));
                let deleteCount = 0;
                if (snapshot.size > 0) {
                    const deleteBatch = writeBatch(db);
                    snapshot.docs.forEach(d => deleteBatch.delete(d.ref));
                    await deleteBatch.commit(); 
                    deleteCount = snapshot.size;
                }
                logToUI(`${collName} コレクションのデータ削除完了 (${deleteCount}件)。`);
            }
            logToUI(`character_bases のサブコレクションデータを削除中...`);
            for (const baseType of CHARACTER_BASE_TYPES_FOR_RESTORE) {
                const subCollPath = `character_bases/${baseType}/options`;
                const subSnapshot = await getDocs(collection(db, subCollPath));
                let subDeleteCount = 0;
                if (subSnapshot.size > 0) {
                    const subDeleteBatch = writeBatch(db);
                    subSnapshot.docs.forEach(d => subDeleteBatch.delete(d.ref));
                    await subDeleteBatch.commit();
                    subDeleteCount = subSnapshot.size;
                }
                logToUI(`  ${subCollPath} のデータ削除完了 (${subDeleteCount}件)。`);
            }
            logToUI("既存データの削除が完了しました。");

            logToUI("バックアップからのデータ書き込みを開始します (ドキュメントIDを維持)...");
            
            const processAndSetDoc = (docDataWithOldId, collPath) => {
                const firestoreDocId = docDataWithOldId._id; 
                if (!firestoreDocId) {
                    logToUI(`  警告: _id がないデータが見つかりました。スキップ: ${JSON.stringify(docDataWithOldId).substring(0,100)}`, "warning");
                    return null; 
                }
                const dataToWrite = { ...docDataWithOldId };
                delete dataToWrite._id; 

                Object.keys(dataToWrite).forEach(key => {
                    if (dataToWrite[key] && dataToWrite[key]._datatype === "timestamp") {
                        const date = new Date(dataToWrite[key].value);
                        if (!isNaN(date)) {
                            dataToWrite[key] = Timestamp.fromDate(date);
                        } else {
                            logToUI(`  警告: 不正なタイムスタンプ値 (${dataToWrite[key].value}) を ${key} で検出。無視します。`, "warning");
                            delete dataToWrite[key]; 
                        }
                    }
                });
                return setDoc(doc(db, collPath, firestoreDocId), dataToWrite);
            };

            for (const collName of COLLECTIONS_TO_RESTORE) {
                if (!collectionsFromBackup[collName] || !Array.isArray(collectionsFromBackup[collName])) {
                    logToUI(`${collName} のデータがバックアップに存在しないか、形式が不正です。スキップします。`, 'warning');
                    continue;
                }
                logToUI(`コレクション ${collName} に書き込み中...`);
                const docsToRestore = collectionsFromBackup[collName];
                const promises = [];
                for (const docData of docsToRestore) {
                    const promise = processAndSetDoc(docData, collName);
                    if(promise) promises.push(promise);
                }
                await Promise.all(promises); 
                logToUI(`コレクション ${collName} の ${docsToRestore.length} 件の書き込み完了。`);
            }

            if (collectionsFromBackup.character_bases) {
                logToUI(`character_bases のサブコレクションデータを書き込み中...`);
                for (const type of CHARACTER_BASE_TYPES_FOR_RESTORE) {
                    if (collectionsFromBackup.character_bases[type] && 
                        collectionsFromBackup.character_bases[type].options &&
                        Array.isArray(collectionsFromBackup.character_bases[type].options)) {
                        
                        const subCollPath = `character_bases/${type}/options`;
                        logToUI(`  サブコレクション ${subCollPath} に書き込み中...`);
                        const optionsToRestore = collectionsFromBackup.character_bases[type].options;
                        const promises = [];
                        for (const optionData of optionsToRestore) {
                            const promise = processAndSetDoc(optionData, subCollPath);
                            if(promise) promises.push(promise);
                        }
                        await Promise.all(promises);
                        logToUI(`  サブコレクション ${subCollPath} の ${optionsToRestore.length} 件の書き込み完了。`);
                    } else {
                         logToUI(`バックアップに character_bases.${type}.options のデータがありません。`, 'warning');
                    }
                }
            } else {
                logToUI(`バックアップに character_bases のデータがありません。`, 'warning');
            }

            logToUI("データの書き込みが完了しました。", "success");
            alert("データベースの完全復元が正常に完了しました。");

        } catch (error) {
            console.error("Full Restore Error:", error);
            logToUI(`エラーが発生しました: ${error.message}`, 'error');
            alert(`完全復元中にエラーが発生しました: ${error.message}`);
        } finally {
            DOM.executeFullRestoreButton.disabled = false;
            DOM.executeFullRestoreButton.textContent = 'データベース完全復元を実行';
            updateRestoreButtonState();
        }
    });
}
