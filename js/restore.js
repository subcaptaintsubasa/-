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
    backupFileDetailsDiv: document.getElementById('backupFileDetails'), // Renamed from backupFileInfo
    fileNameDisplay: document.getElementById('fileNameDisplay'),
    backupCreatedAtDisplay: document.getElementById('backupCreatedAtDisplay'),
    detectedCollectionsSummaryDiv: document.getElementById('detectedCollectionsSummary'), // Renamed from detectedCollectionsList
    washDataBeforeRestoreCheckbox: document.getElementById('washDataBeforeRestore'),
    executeRestoreButton: document.getElementById('executeRestoreButton'),
    restoreExecutionLog: document.getElementById('restoreExecutionLog'),
};

let parsedBackupJsonData = null;

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
    DOMR.detectedCollectionsSummaryDiv.innerHTML = '<p>ファイルを選択してください。</p>';
    DOMR.backupFileDetailsDiv.style.display = 'none';
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
    parsedBackupJsonData = null; 
    DOMR.fileNameDisplay.textContent = '-';
    DOMR.backupCreatedAtDisplay.textContent = '-';
    DOMR.detectedCollectionsSummaryDiv.innerHTML = '';
    DOMR.backupFileDetailsDiv.style.display = 'none';
    logToUI(DOMR.restoreExecutionLog, "新しいファイルが選択されました。解析中...", 'info', true); // Clear previous logs

    if (file) {
        DOMR.fileNameDisplay.textContent = file.name;
        if (file.type !== 'application/zip' && file.type !== 'application/x-zip-compressed' && !file.name.toLowerCase().endsWith('.zip')) {
            logToUI(DOMR.restoreExecutionLog, `エラー: 選択されたファイルはZIPファイルではありません。(タイプ: ${file.type}, 名前: ${file.name})`, "error");
            alert("ZIPファイルを選択してください。");
            resetRestoreUI(); 
            return;
        }

        try {
            const jszip = new JSZip();
            const zipContents = await jszip.loadAsync(file);
            const jsonFileInZip = zipContents.file("denpa_item_backup_data.json");

            if (jsonFileInZip) {
                const jsonString = await jsonFileInZip.async("string");
                parsedBackupJsonData = JSON.parse(jsonString);

                if (!parsedBackupJsonData.collections || !parsedBackupJsonData.version) {
                    parsedBackupJsonData = null;
                    throw new Error("ZIP内のJSONファイルの形式が正しくありません。'collections'または'version'プロパティが見つかりません。");
                }
                logToUI(DOMR.restoreExecutionLog, "バックアップZIPの解析に成功しました。", "success");
                DOMR.backupFileDetailsDiv.style.display = 'block';
                DOMR.backupCreatedAtDisplay.textContent = parsedBackupJsonData.createdAt ? 
                    new Date(parsedBackupJsonData.createdAt).toLocaleString('ja-JP') : '不明';
                
                displayCollectionSummaries(parsedBackupJsonData.collections);

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

function displayCollectionSummaries(collections) {
    DOMR.detectedCollectionsSummaryDiv.innerHTML = ''; // Clear previous
    const summaryList = document.createElement('ul');
    summaryList.style.listStyleType = 'none';
    summaryList.style.paddingLeft = '0';

    for (const collName in collections) {
        const listItem = document.createElement('li');
        listItem.className = 'collection-summary';
        const dataArray = collections[collName];
        
        let count = 0;
        let sampleHtml = '';

        if (collName === 'character_bases' && typeof dataArray === 'object' && !Array.isArray(dataArray)) {
            // Handle character_bases specifically as it's an object of arrays
            let totalCharBaseOptions = 0;
            let charBaseSamples = [];
            for (const baseType in dataArray) {
                if (Array.isArray(dataArray[baseType])) {
                    totalCharBaseOptions += dataArray[baseType].length;
                    if(dataArray[baseType].length > 0 && charBaseSamples.length < 3){
                        charBaseSamples.push(`<strong>${baseType}</strong>: ${dataArray[baseType][0].name || '(名称なし)'} (ID: ${dataArray[baseType][0].docId.substring(0,5)}...)`);
                    }
                }
            }
            count = totalCharBaseOptions; // Or count distinct baseTypes if preferred
            sampleHtml = charBaseSamples.join('<br>');
            listItem.innerHTML = `<strong>${collName}</strong>: ${count}オプション (タイプ数: ${Object.keys(dataArray).length})`;

        } else if (Array.isArray(dataArray)) {
            count = dataArray.length;
            const samples = dataArray.slice(0, 3).map(doc => {
                return `${doc.name || '(名称なし)'} (ID: ${doc.docId ? doc.docId.substring(0, 5) : '不明'}...)`;
            });
            sampleHtml = samples.join('<br>');
            listItem.innerHTML = `<strong>${collName}</strong>: ${count}件`;
        } else {
            listItem.innerHTML = `<strong>${collName}</strong>: データ形式不明`;
        }


        if (sampleHtml) {
            const sampleDiv = document.createElement('div');
            sampleDiv.className = 'sample-data';
            sampleDiv.innerHTML = `サンプル:<br>${sampleHtml}`;
            listItem.appendChild(sampleDiv);
        }
        summaryList.appendChild(listItem);
    }
    DOMR.detectedCollectionsSummaryDiv.appendChild(summaryList);
}


function logToUI(logAreaElement, message, type = 'info', clearPrevious = false) {
    if (!logAreaElement) return;
    if (clearPrevious) logAreaElement.innerHTML = '';
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
    logToUI(DOMR.restoreExecutionLog, "復元処理を開始します...", 'info', true); // Clear previous logs

    try {
        const backupCollections = parsedBackupJsonData.collections;

        for (const collName of collectionsToProcess) {
            logToUI(DOMR.restoreExecutionLog, `コレクション「${collName}」の処理を開始...`);
            const collectionDataFromBackup = backupCollections[collName];

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
                    // Batch writes for subcollection
                    let subCollBatch = writeBatch(db);
                    let subCollWriteCount = 0;
                    for (const docData of optionsData) {
                        const docId = docData.docId;
                        if (!docId) {
                            logToUI(DOMR.restoreExecutionLog, `      ドキュメントIDがありません。スキップ: ${JSON.stringify(docData).substring(0,50)}...`, 'warning');
                            continue;
                        }
                        const dataToWrite = { ...docData };
                        delete dataToWrite.docId; 
                        // dataToWrite.updatedAt = serverTimestamp(); // Or use timestamp from backup
                        subCollBatch.set(doc(db, subCollPath, docId), dataToWrite);
                        subCollWriteCount++;
                        if (subCollWriteCount % 490 === 0) { // Commit batch periodically
                            await subCollBatch.commit();
                            subCollBatch = writeBatch(db);
                            logToUI(DOMR.restoreExecutionLog, `    「${subCollPath}」バッチ書き込み実行 (${subCollWriteCount}件時点)...`);
                        }
                    }
                    if (subCollWriteCount % 490 !== 0 || subCollWriteCount === 0 && optionsData.length > 0) { // Commit any remaining operations
                       if (subCollWriteCount > 0 && (subCollWriteCount % 490 !== 0)) await subCollBatch.commit();
                    }
                    logToUI(DOMR.restoreExecutionLog, `    「${subCollPath}」への書き込み完了 (合計 ${optionsData.length}件試行、${subCollWriteCount}件成功)。`);
                }
            } else { // For other, non-nested collections
                if (!Array.isArray(collectionDataFromBackup)) {
                    logToUI(DOMR.restoreExecutionLog, `コレクション「${collName}」のデータが配列形式ではありません。スキップします。`, 'warning');
                    continue;
                }
                if (performWash) {
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

                logToUI(DOMR.restoreExecutionLog, `  「${collName}」にバックアップデータを書き込み中...`);
                let collBatch = writeBatch(db);
                let collWriteCount = 0;
                for (const docData of collectionDataFromBackup) {
                    const docId = docData.docId; 
                    if (!docId) {
                        logToUI(DOMR.restoreExecutionLog, `    ドキュメントIDがありません。スキップ: ${JSON.stringify(docData).substring(0,50)}...`, 'warning');
                        continue;
                    }
                    const dataToWrite = { ...docData };
                    delete dataToWrite.docId;
                    // dataToWrite.updatedAt = serverTimestamp();

                    collBatch.set(doc(db, collName, docId), dataToWrite);
                    collWriteCount++;
                    if (collWriteCount % 490 === 0) { // Commit batch periodically
                        await collBatch.commit();
                        collBatch = writeBatch(db);
                        logToUI(DOMR.restoreExecutionLog, `  「${collName}」バッチ書き込み実行 (${collWriteCount}件時点)...`);
                    }
                }
                if (collWriteCount % 490 !== 0 || collWriteCount === 0 && collectionDataFromBackup.length > 0) {
                    if (collWriteCount > 0 && (collWriteCount % 490 !== 0)) await collBatch.commit();
                }
                logToUI(DOMR.restoreExecutionLog, `  「${collName}」への書き込み完了 (合計 ${collectionDataFromBackup.length}件試行、 ${collWriteCount}件成功)。`);
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

// Initial load if user is already logged in
if (auth.currentUser) {
    // No initial data loading needed specifically for this page's core function,
    // as it primarily operates on the uploaded backup file.
}
