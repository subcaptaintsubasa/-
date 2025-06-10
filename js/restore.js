// js/restore.js
import { auth, db } from '../firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { collection, getDocs, writeBatch, doc, deleteDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
// JSZip will be available globally via the script tag in restore.html

const DOMR = {
    passwordPrompt: document.getElementById('password-prompt'),
    mainContent: document.getElementById('main-content'),
    loginButton: document.getElementById('loginButton'),
    logoutButton: document.getElementById('logoutButton'),
    adminEmailInput: document.getElementById('adminEmailInput'),
    adminPasswordInput: document.getElementById('adminPasswordInput'),
    passwordError: document.getElementById('passwordError'),
    
    backupZipFileInput: document.getElementById('backupZipFile'),
    fileNameDisplay: document.getElementById('fileNameDisplay'),
    backupCreatedAtDisplay: document.getElementById('backupCreatedAtDisplay'),
    detectedCollectionsList: document.getElementById('detectedCollectionsList'),
    washDataBeforeRestoreCheckbox: document.getElementById('washDataBeforeRestore'),
    executeRestoreButton: document.getElementById('executeRestoreButton'),
    restoreExecutionLog: document.getElementById('restoreExecutionLog'),
};

let parsedBackupJsonData = null; // To store the content of the JSON file from the ZIP

// --- Authentication ---
onAuthStateChanged(auth, user => {
    DOMR.passwordPrompt.style.display = user ? 'none' : 'flex';
    DOMR.mainContent.style.display = user ? 'block' : 'none';
    if (!user) {
        DOMR.adminEmailInput.value = '';
        DOMR.adminPasswordInput.value = '';
        DOMR.passwordError.textContent = '';
        resetRestoreUI();
    } else {
        updateRestoreButtonState();
    }
});

DOMR.loginButton.addEventListener('click', () => {
    signInWithEmailAndPassword(auth, DOMR.adminEmailInput.value, DOMR.adminPasswordInput.value)
        .catch(err => { DOMR.passwordError.textContent = `ログイン失敗: ${err.message}`; });
});
DOMR.logoutButton.addEventListener('click', () => { signOut(auth).then(resetRestoreUI); });


// --- UI Control ---
function resetRestoreUI() {
    DOMR.backupZipFileInput.value = '';
    parsedBackupJsonData = null;
    DOMR.fileNameDisplay.textContent = '-';
    DOMR.backupCreatedAtDisplay.textContent = '-';
    DOMR.detectedCollectionsList.innerHTML = '<li>-</li>';
    DOMR.washDataBeforeRestoreCheckbox.checked = true;
    DOMR.restoreExecutionLog.innerHTML = 'ログはここに表示されます...';
    updateRestoreButtonState();
}

function updateRestoreButtonState() {
    const isLoggedIn = auth.currentUser !== null;
    const fileSelectedAndParsed = DOMR.backupZipFileInput.files.length > 0 && parsedBackupJsonData !== null;
    DOMR.executeRestoreButton.disabled = !(isLoggedIn && fileSelectedAndParsed);
}

DOMR.backupZipFileInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    parsedBackupJsonData = null; // Reset previous data
    DOMR.fileNameDisplay.textContent = '-';
    DOMR.backupCreatedAtDisplay.textContent = '-';
    DOMR.detectedCollectionsList.innerHTML = '<li>-</li>';
    logToUI(DOMR.restoreExecutionLog, "新しいファイルが選択されました。解析中...");

    if (file) {
        DOMR.fileNameDisplay.textContent = file.name;
        if (file.type !== 'application/zip' && file.type !== 'application/x-zip-compressed') {
            logToUI(DOMR.restoreExecutionLog, `エラー: 選択されたファイルはZIPファイルではありません。(タイプ: ${file.type})`, "error");
            alert("ZIPファイルを選択してください。");
            resetRestoreUI(); // Clear file input
            return;
        }

        try {
            const jszip = new JSZip();
            const zipContents = await jszip.loadAsync(file);
            
            // Assuming the JSON file is named 'denpa_item_backup_data.json' inside the ZIP
            const jsonFileInZip = zipContents.file("denpa_item_backup_data.json");

            if (jsonFileInZip) {
                const jsonString = await jsonFileInZip.async("string");
                parsedBackupJsonData = JSON.parse(jsonString);

                if (!parsedBackupJsonData.collections || !parsedBackupJsonData.version) {
                    parsedBackupJsonData = null;
                    throw new Error("ZIP内のJSONファイルの形式が正しくありません。'collections'または'version'プロパティが見つかりません。");
                }
                logToUI(DOMR.restoreExecutionLog, "バックアップZIPの解析に成功しました。", "success");
                DOMR.backupCreatedAtDisplay.textContent = parsedBackupJsonData.createdAt ? 
                    new Date(parsedBackupJsonData.createdAt).toLocaleString('ja-JP') : '不明';
                
                const detectedCollections = Object.keys(parsedBackupJsonData.collections);
                if (detectedCollections.length > 0) {
                    DOMR.detectedCollectionsList.innerHTML = detectedCollections.map(c => `<li>${c}</li>`).join('');
                } else {
                    DOMR.detectedCollectionsList.innerHTML = '<li>コレクションが検出されませんでした。</li>';
                    parsedBackupJsonData = null; // Invalidate if no collections
                }
            } else {
                parsedBackupJsonData = null;
                throw new Error("ZIPファイル内に 'denpa_item_backup_data.json' が見つかりません。");
            }
        } catch (e) {
            parsedBackupJsonData = null;
            logToUI(DOMR.restoreExecutionLog, `バックアップZIPの処理エラー: ${e.message}`, "error");
            alert(`バックアップZIPの処理エラー: ${e.message}`);
        }
    } else {
        logToUI(DOMR.restoreExecutionLog, 'ファイルが選択されていません。');
    }
    updateRestoreButtonState();
});


function logToUI(logAreaElement, message, type = 'info') {
    if (!logAreaElement) return;
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    logEntry.textContent = `[${new Date().toLocaleTimeString('ja-JP')}] ${message}`;
    logAreaElement.appendChild(logEntry);
    logAreaElement.scrollTop = logAreaElement.scrollHeight;
}

// --- Restore Logic ---
DOMR.executeRestoreButton.addEventListener('click', async () => {
    if (!parsedBackupJsonData || !parsedBackupJsonData.collections) {
        alert("復元するデータが読み込まれていません。有効なバックアップZIPファイルを選択してください。");
        return;
    }
    const performWash = DOMR.washDataBeforeRestoreCheckbox.checked;
    const collectionsToProcess = Object.keys(parsedBackupJsonData.collections);

    let confirmMessage = "本当にデータベースの復元を実行しますか？\n";
    if (performWash) {
        confirmMessage += `以下のコレクションの既存データは全て削除され、バックアップ内容で上書きされます:\n${collectionsToProcess.join(', ')}\n`;
    } else {
        confirmMessage += `以下のコレクションのデータがバックアップ内容で上書き/追加されます:\n${collectionsToProcess.join(', ')}\n`;
    }
    confirmMessage += "この操作は元に戻せません。";

    if (!confirm(confirmMessage)) {
        return;
    }

    DOMR.executeRestoreButton.disabled = true;
    DOMR.executeRestoreButton.textContent = '復元実行中...';
    logToUI(DOMR.restoreExecutionLog, "復元処理を開始します...");

    try {
        const backupCollections = parsedBackupJsonData.collections;

        for (const collName of collectionsToProcess) {
            logToUI(DOMR.restoreExecutionLog, `コレクション「${collName}」の処理を開始...`);
            const collectionDataFromBackup = backupCollections[collName];

            if (!Array.isArray(collectionDataFromBackup) && collName !== "character_bases") { // character_bases is an object
                 logToUI(DOMR.restoreExecutionLog, `コレクション「${collName}」のデータが配列形式ではありません。スキップします。`, 'warning');
                continue;
            }

            if (performWash && collName !== "character_bases") {
                logToUI(DOMR.restoreExecutionLog, `  「${collName}」の既存データを削除中...`);
                const snapshot = await getDocs(collection(db, collName));
                let deleteCount = 0;
                if (snapshot.size > 0) {
                    const deleteBatch = writeBatch(db);
                    snapshot.docs.forEach(d => deleteBatch.delete(d.ref));
                    await deleteBatch.commit();
                    deleteCount = snapshot.size;
                }
                logToUI(DOMR.restoreExecutionLog, `  「${collName}」のデータ削除完了 (${deleteCount}件)。`);
            }
            
            if (collName === "character_bases") {
                 logToUI(DOMR.restoreExecutionLog, `  「character_bases」のサブコレクションを処理中...`);
                const charBaseTypes = Object.keys(collectionDataFromBackup);
                for (const baseType of charBaseTypes) {
                    const subCollPath = `character_bases/${baseType}/options`;
                    const optionsData = collectionDataFromBackup[baseType];
                    if (!Array.isArray(optionsData)) {
                        logToUI(DOMR.restoreExecutionLog, `    「${subCollPath}」のデータが配列形式ではありません。スキップします。`, 'warning');
                        continue;
                    }
                    if (performWash) {
                        logToUI(DOMR.restoreExecutionLog, `    「${subCollPath}」の既存データを削除中...`);
                        const subSnapshot = await getDocs(collection(db, subCollPath));
                        let subDeleteCount = 0;
                        if (subSnapshot.size > 0) {
                            const subDeleteBatch = writeBatch(db);
                            subSnapshot.docs.forEach(d => subDeleteBatch.delete(d.ref));
                            await subDeleteBatch.commit();
                            subDeleteCount = subSnapshot.size;
                        }
                        logToUI(DOMR.restoreExecutionLog, `    「${subCollPath}」のデータ削除完了 (${subDeleteCount}件)。`);
                    }
                    logToUI(DOMR.restoreExecutionLog, `    「${subCollPath}」にバックアップデータを書き込み中...`);
                    const writeBatchForSubColl = writeBatch(db);
                    let writeCountSub = 0;
                    optionsData.forEach(docData => {
                        const docId = docData.docId; // Use docId from backup
                        if (!docId) {
                            logToUI(DOMR.restoreExecutionLog, `      ドキュメントIDがありません。スキップ: ${JSON.stringify(docData).substring(0,50)}...`, 'warning');
                            return;
                        }
                        const dataToWrite = { ...docData };
                        delete dataToWrite.docId; // Remove docId from data payload
                        // Ensure server timestamps for consistency if needed, or use backup's
                        // dataToWrite.updatedAt = serverTimestamp(); 
                        
                        writeBatchForSubColl.set(doc(db, subCollPath, docId), dataToWrite);
                        writeCountSub++;
                    });
                    if (writeCountSub > 0) await writeBatchForSubColl.commit();
                    logToUI(DOMR.restoreExecutionLog, `    「${subCollPath}」への書き込み完了 (${writeCountSub}件)。`);
                }
            } else { // For other collections
                logToUI(DOMR.restoreExecutionLog, `  「${collName}」にバックアップデータを書き込み中...`);
                const writeBatchForColl = writeBatch(db);
                let writeCount = 0;
                collectionDataFromBackup.forEach(docData => {
                    const docId = docData.docId; 
                    if (!docId) {
                        logToUI(DOMR.restoreExecutionLog, `    ドキュメントIDがありません。スキップ: ${JSON.stringify(docData).substring(0,50)}...`, 'warning');
                        return;
                    }
                    const dataToWrite = { ...docData };
                    delete dataToWrite.docId;
                    // dataToWrite.updatedAt = serverTimestamp();

                    writeBatchForColl.set(doc(db, collName, docId), dataToWrite);
                    writeCount++;
                });
                if (writeCount > 0) await writeBatchForColl.commit();
                logToUI(DOMR.restoreExecutionLog, `  「${collName}」への書き込み完了 (${writeCount}件)。`);
            }
        }
        logToUI(DOMR.restoreExecutionLog, "復元処理が正常に完了しました。", 'success');
        alert("データベースの復元が完了しました。");

    } catch (error) {
        console.error("Restore Error:", error);
        logToUI(DOMR.restoreExecutionLog, `エラーが発生しました: ${error.message}`, 'error');
        alert(`復元エラーが発生しました: ${error.message}`);
    } finally {
        DOMR.executeRestoreButton.textContent = '復元実行';
        updateRestoreButtonState();
    }
});

// Initial load if user is already logged in (though not much to load for this page initially)
if (auth.currentUser) {
    // Placeholder for any initial data loading if needed in the future
}
