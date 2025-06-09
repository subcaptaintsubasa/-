// js/restore.js
import { auth, db } from '../firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { collection, getDocs, writeBatch, doc, deleteDoc, addDoc, serverTimestamp, query, where } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

const DOMR = {
    passwordPrompt: document.getElementById('password-prompt'),
    mainContent: document.getElementById('main-content'),
    loginButton: document.getElementById('loginButton'),
    logoutButton: document.getElementById('logoutButton'),
    adminEmailInput: document.getElementById('adminEmailInput'),
    adminPasswordInput: document.getElementById('adminPasswordInput'),
    passwordError: document.getElementById('passwordError'),
    backupFileInput: document.getElementById('backupFile'),
    
    step1Section: document.getElementById('step1Section'),
    executeDbWashButton: document.getElementById('executeDbWashButton'),
    step1ExecutionLog: document.getElementById('step1ExecutionLog'),

    step2Section: document.getElementById('step2Section'),
    startCategoryRestoreButton: document.getElementById('startCategoryRestoreButton'),
    tasksContainer: document.getElementById('tasksContainer'),
    step2ExecutionLog: document.getElementById('step2ExecutionLog'),
};

const COLLECTIONS_TO_WASH = [
    "categories", "tags", "items", 
    "effect_types", "effect_units", "effect_super_categories", 
    "item_sources" 
    // "character_bases" is special due to subcollections
];
const CHARACTER_BASE_TYPES_FOR_WASH = ["headShape", "correction", "color", "pattern"];


// --- Authentication ---
onAuthStateChanged(auth, user => {
    DOMR.passwordPrompt.style.display = user ? 'none' : 'flex';
    DOMR.mainContent.style.display = user ? 'block' : 'none';
    if (!user) {
        DOMR.adminEmailInput.value = '';
        DOMR.adminPasswordInput.value = '';
        DOMR.passwordError.textContent = '';
        resetFullUI();
    } else {
        // User is logged in, enable buttons if file is selected
        DOMR.executeDbWashButton.disabled = DOMR.backupFileInput.files.length === 0;
        DOMR.startCategoryRestoreButton.disabled = false; // Can always try to start step 2
    }
});

DOMR.loginButton.addEventListener('click', () => {
    signInWithEmailAndPassword(auth, DOMR.adminEmailInput.value, DOMR.adminPasswordInput.value)
        .catch(err => { DOMR.passwordError.textContent = `ログイン失敗: ${err.message}`; });
});
DOMR.logoutButton.addEventListener('click', () => { signOut(auth); });


// --- UI Control ---
function resetFullUI() {
    DOMR.backupFileInput.value = '';
    DOMR.executeDbWashButton.disabled = true;
    DOMR.startCategoryRestoreButton.disabled = true;
    DOMR.step1ExecutionLog.innerHTML = 'ログはここに表示されます...';
    DOMR.tasksContainer.innerHTML = '<p>カテゴリ親子関係の修復タスクはここに表示されます。</p>';
    DOMR.step2ExecutionLog.innerHTML = 'ログはここに表示されます...';
}

DOMR.backupFileInput.addEventListener('change', () => {
    const fileSelected = DOMR.backupFileInput.files.length > 0;
    DOMR.executeDbWashButton.disabled = !fileSelected;
    // startCategoryRestoreButton is not dependent on file for now, as user might have already washed DB.
    if (fileSelected) {
        DOMR.step1ExecutionLog.innerHTML = 'バックアップファイルが選択されました。「DB洗い替え実行」ボタンで処理を開始できます。';
    } else {
        resetFullUI();
    }
});

function logToUI(logAreaElement, message, type = 'info') {
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logAreaElement.appendChild(logEntry);
    logAreaElement.scrollTop = logAreaElement.scrollHeight; // Auto-scroll
}

// --- Step 1: DB Wash ---
DOMR.executeDbWashButton.addEventListener('click', async () => {
    const file = DOMR.backupFileInput.files[0];
    if (!file) {
        alert("バックアップファイルを選択してください。");
        return;
    }

    if (!confirm("本当にデータベースの洗い替えを実行しますか？\n" +
                 `対象コレクション (${COLLECTIONS_TO_WASH.join(', ')}, character_bases/*) の既存データは全て削除され、\n` +
                 "バックアップファイルの内容で上書きされます。この操作は元に戻せません。")) {
        return;
    }

    DOMR.executeDbWashButton.disabled = true;
    DOMR.executeDbWashButton.textContent = '洗い替え実行中...';
    DOMR.step1ExecutionLog.innerHTML = ''; // Clear previous logs
    logToUI(DOMR.step1ExecutionLog, "DB洗い替え処理を開始します...");

    try {
        const backupString = await file.text();
        const backupData = JSON.parse(backupString);

        if (!backupData.collections) {
            throw new Error("バックアップファイルの形式が正しくありません。'collections' プロパティが見つかりません。");
        }
        const collectionsFromBackup = backupData.collections;

        // Delete existing data
        for (const collName of COLLECTIONS_TO_WASH) {
            logToUI(DOMR.step1ExecutionLog, `${collName} コレクションの既存データを削除中...`);
            const snapshot = await getDocs(collection(db, collName));
            const deleteBatch = writeBatch(db);
            snapshot.docs.forEach(d => deleteBatch.delete(d.ref));
            await deleteBatch.commit();
            logToUI(DOMR.step1ExecutionLog, `${collName} コレクションのデータ削除完了 (${snapshot.size}件)。`);
        }
        
        // Delete character_bases subcollections data
        logToUI(DOMR.step1ExecutionLog, `character_bases のサブコレクションデータを削除中...`);
        for (const baseType of CHARACTER_BASE_TYPES_FOR_WASH) {
            const subCollPath = `character_bases/${baseType}/options`;
            logToUI(DOMR.step1ExecutionLog, `  ${subCollPath} のデータを削除中...`);
            const subSnapshot = await getDocs(collection(db, subCollPath));
            const subDeleteBatch = writeBatch(db);
            subSnapshot.docs.forEach(d => subDeleteBatch.delete(d.ref));
            await subDeleteBatch.commit();
            logToUI(DOMR.step1ExecutionLog, `  ${subCollPath} のデータ削除完了 (${subSnapshot.size}件)。`);
        }
        logToUI(DOMR.step1ExecutionLog, `character_bases のサブコレクションデータ削除完了。`);


        // Add new data from backup
        const oldToNewIdMap = {}; // To store mapping for stage 2, if needed for other entities

        for (const collName of COLLECTIONS_TO_WASH) {
            if (!collectionsFromBackup[collName] || !Array.isArray(collectionsFromBackup[collName])) {
                logToUI(DOMR.step1ExecutionLog, `${collName} のデータがバックアップに存在しないか、形式が不正です。スキップします。`, 'warning');
                continue;
            }
            logToUI(DOMR.step1ExecutionLog, `${collName} コレクションにバックアップデータを書き込み中...`);
            const collectionData = collectionsFromBackup[collName];
            if (!oldToNewIdMap[collName]) oldToNewIdMap[collName] = {};

            for (const docData of collectionData) {
                const oldId = docData.id; // Assuming backup has 'id' field with old ID
                const dataToWrite = { ...docData };
                delete dataToWrite.id; // Remove old ID before writing, Firestore generates new one
                
                // Add server timestamps if applicable (adjust fields as needed)
                dataToWrite.createdAt = serverTimestamp();
                dataToWrite.updatedAt = serverTimestamp();
                
                // Handle specific fields, e.g., parentId for categories should remain old ID for now
                // If parentId refers to an ID within the backup, it's fine.

                const newDocRef = await addDoc(collection(db, collName), dataToWrite);
                if (oldId) {
                    oldToNewIdMap[collName][oldId] = newDocRef.id;
                }
            }
            logToUI(DOMR.step1ExecutionLog, `${collName} コレクションへの書き込み完了 (${collectionData.length}件)。`);
        }
        
        // Add character_bases data
        if (collectionsFromBackup.character_bases) {
            logToUI(DOMR.step1ExecutionLog, `character_bases のデータを書き込み中...`);
             if (!oldToNewIdMap.character_bases) oldToNewIdMap.character_bases = {};

            for (const baseType of CHARACTER_BASE_TYPES_FOR_WASH) {
                if (collectionsFromBackup.character_bases[baseType] && Array.isArray(collectionsFromBackup.character_bases[baseType])) {
                    const optionsData = collectionsFromBackup.character_bases[baseType];
                    const subCollPath = `character_bases/${baseType}/options`;
                    logToUI(DOMR.step1ExecutionLog, `  ${subCollPath} に書き込み中...`);
                    if (!oldToNewIdMap.character_bases[baseType]) oldToNewIdMap.character_bases[baseType] = {};

                    for (const optionDocData of optionsData) {
                        const oldOptId = optionDocData.id;
                        const optionDataToWrite = { ...optionDocData };
                        delete optionDataToWrite.id;
                        optionDataToWrite.createdAt = serverTimestamp();
                        optionDataToWrite.updatedAt = serverTimestamp();

                        const newOptDocRef = await addDoc(collection(db, subCollPath), optionDataToWrite);
                        if (oldOptId) {
                            oldToNewIdMap.character_bases[baseType][oldOptId] = newOptDocRef.id;
                        }
                    }
                     logToUI(DOMR.step1ExecutionLog, `  ${subCollPath} への書き込み完了 (${optionsData.length}件)。`);
                } else {
                     logToUI(DOMR.step1ExecutionLog, `  character_bases.${baseType} のデータがバックアップにないか形式不正。`, 'warning');
                }
            }
        } else {
             logToUI(DOMR.step1ExecutionLog, `character_bases のデータがバックアップにありません。`, 'warning');
        }


        logToUI(DOMR.step1ExecutionLog, "DB洗い替え処理が正常に完了しました。", 'success');
        DOMR.startCategoryRestoreButton.disabled = false; // Enable step 2 button
        alert("データベースの洗い替えが完了しました。ステップ2に進んでください。");

    } catch (error) {
        console.error("DB Wash Error:", error);
        logToUI(DOMR.step1ExecutionLog, `エラーが発生しました: ${error.message}`, 'error');
        alert(`エラーが発生しました: ${error.message}`);
    } finally {
        DOMR.executeDbWashButton.disabled = DOMR.backupFileInput.files.length === 0;
        DOMR.executeDbWashButton.textContent = 'DB洗い替え実行';
    }
});


// --- Step 2: Category Parent Relationship Restore ---
DOMR.startCategoryRestoreButton.addEventListener('click', async () => {
    DOMR.startCategoryRestoreButton.disabled = true;
    DOMR.startCategoryRestoreButton.textContent = '分析中...';
    DOMR.tasksContainer.innerHTML = '<p>現在のカテゴリデータを読み込んで分析しています...</p>';
    DOMR.step2ExecutionLog.innerHTML = '';

    try {
        const currentCategoriesSnapshot = await getDocs(collection(db, 'categories'));
        const currentCategories = currentCategoriesSnapshot.docs.map(d => ({
            id: d.id, // This is the NEW Firestore document ID
            ...d.data() // This will contain name, parentId (old ID), etc.
        }));

        DOMR.tasksContainer.innerHTML = '';
        logToUI(DOMR.step2ExecutionLog, `現在のDBから ${currentCategories.length} 件のカテゴリを読み込みました。`);

        const currentParentCategoryCandidates = currentCategories
            .filter(c => !c.parentId || c.parentId === "") // True parents in current DB (after wash, parentId might still be old ID)
            .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
        
        logToUI(DOMR.step2ExecutionLog, `親カテゴリ候補 (現在のDBでparentIdが空のもの): ${currentParentCategoryCandidates.length} 件`);


        // Group current child categories by their OLD parentId (stored in parentId field after wash)
        const childrenGroupsByOldParentId = {};
        currentCategories.forEach(cat => {
            if (cat.parentId && cat.parentId !== "") { // This parentId is an OLD ID from backup
                if (!childrenGroupsByOldParentId[cat.parentId]) {
                    // Try to find the name of the old parent (best effort, might not be in currentCategories if it was a top-level)
                    // For display, we might need the original backup file again, or assume names are consistent
                    // Let's assume names are consistent enough for UI display of "Old Parent Name"
                    const oldParentDataGuess = currentCategories.find(p => p.id === cat.parentId); // This is WRONG logic for old parent name
                                                                                                  // We need the backup file's category list again, or a map.
                                                                                                  // For simplicity now, just show the old parentId
                    childrenGroupsByOldParentId[cat.parentId] = {
                        oldParentIdString: cat.parentId, // The actual old ID string
                        childCategories: [] // Will store { newId: '...', name: '...' }
                    };
                }
                childrenGroupsByOldParentId[cat.parentId].childCategories.push({ newId: cat.id, name: cat.name });
            }
        });
        
        // To get oldParentName, we need to parse the backup file again or pass its content
        // This is a bit inefficient. Let's parse it quickly if needed here.
        // For robust solution, pass `oldCategories` from Step 1 or re-read.
        // Quick re-read for this step if file is still selected:
        let oldCategoriesFromBackupForStep2 = [];
        const file = DOMR.backupFileInput.files[0];
        if (file) {
            try {
                const backupString = await file.text();
                const backupData = JSON.parse(backupString);
                if (backupData.collections && backupData.collections.categories) {
                    oldCategoriesFromBackupForStep2 = backupData.collections.categories;
                }
            } catch (e) { console.warn("Could not re-read backup for old parent names", e); }
        }


        const sortedOldParentIdStrings = Object.keys(childrenGroupsByOldParentId).sort((a,b) => {
            const nameA = (oldCategoriesFromBackupForStep2.find(c => c.id === a) || {name:a}).name;
            const nameB = (oldCategoriesFromBackupForStep2.find(c => c.id === b) || {name:b}).name;
            return nameA.localeCompare(nameB, 'ja');
        });


        if (sortedOldParentIdStrings.length === 0) {
            DOMR.tasksContainer.innerHTML = '<p>現在のデータベースに、旧 `parentId` を持つ子カテゴリが見つかりませんでした。親子関係は既に修復済みか、洗い替えが不完全かもしれません。</p>';
            logToUI(DOMR.step2ExecutionLog, "修復対象の子カテゴリグループなし。", "info");
            return;
        }
        logToUI(DOMR.step2ExecutionLog, `${sortedOldParentIdStrings.length} 個の旧親子グループを検出しました。`);

        sortedOldParentIdStrings.forEach(oldParentIdStr => {
            const groupData = childrenGroupsByOldParentId[oldParentIdStr];
            const oldParentInfoFromBackup = oldCategoriesFromBackupForStep2.find(c => c.id === oldParentIdStr);
            const oldParentNameDisplay = oldParentInfoFromBackup ? oldParentInfoFromBackup.name : `不明な旧親 (ID: ${oldParentIdStr})`;

            const groupDiv = document.createElement('div');
            groupDiv.className = 'task-group';

            const header = document.createElement('h4');
            header.textContent = `旧 親カテゴリ: 「${oldParentNameDisplay}」 `;
            const oldIdSpan = document.createElement('span');
            oldIdSpan.className = 'old-id';
            oldIdSpan.textContent = `(旧ID: ${oldParentIdStr})`;
            header.appendChild(oldIdSpan);
            groupDiv.appendChild(header);

            const taskItem = document.createElement('div');
            taskItem.className = 'task-item';

            const childListDiv = document.createElement('div');
            childListDiv.className = 'child-list';
            const childNamesForDisplay = groupData.childCategories.map(c => `<li>${c.name} (現ID: ${c.newId.substring(0,5)}...)</li>`).join('');
            childListDiv.innerHTML = `<strong>このグループの子カテゴリ (${groupData.childCategories.length}件):</strong><ul>${childNamesForDisplay}</ul>`;

            const selectorContainerDiv = document.createElement('div');
            selectorContainerDiv.className = 'selector-container';
            const selectorLabel = document.createElement('label');
            selectorLabel.htmlFor = `selector-cat-${oldParentIdStr}`;
            selectorLabel.textContent = '現在のDBから新しい親を選択:';
            
            const selector = document.createElement('select');
            selector.id = `selector-cat-${oldParentIdStr}`;
            let optionsHtml = '<option value="">親なし (最上位にする)</option>';
            currentParentCategoryCandidates.forEach(p => {
                // Match by name (assuming names are consistent after wash)
                const isRecommended = (p.name === oldParentNameDisplay);
                optionsHtml += `<option value="${p.id}" ${isRecommended ? 'selected' : ''}>${p.name} (現ID: ${p.id.substring(0,5)}...)</option>`;
            });
            selector.innerHTML = optionsHtml;

            const updateButton = document.createElement('button');
            updateButton.textContent = 'このグループの親を更新';
            updateButton.addEventListener('click', async () => {
                const newActualParentId = selector.value; // This is a NEW Firestore ID, or ""
                const selectedOptionText = selector.options[selector.selectedIndex].text;
                
                if (!confirm(`子カテゴリグループ (旧親: ${oldParentNameDisplay}) の新しい親を「${selectedOptionText}」に設定しますか？`)) {
                    return;
                }
                
                updateButton.disabled = true;
                updateButton.textContent = '更新中...';
                let statusMessage = taskItem.querySelector('.status-message');
                if (!statusMessage) {
                    statusMessage = document.createElement('p');
                    statusMessage.className = 'status-message';
                    taskItem.appendChild(statusMessage);
                }
                statusMessage.textContent = "処理中...";
                statusMessage.style.color = "orange";

                try {
                    const batch = writeBatch(db);
                    let updatesCount = 0;
                    groupData.childCategories.forEach(childToUpdate => {
                        // childToUpdate.newId is the current Firestore document ID
                        const docRef = doc(db, 'categories', childToUpdate.newId);
                        batch.update(docRef, { parentId: newActualParentId }); // Update parentId to new Firestore ID
                        updatesCount++;
                        logToUI(DOMR.step2ExecutionLog, `子カテゴリ「${childToUpdate.name}」(現ID:${childToUpdate.newId}) の parentId を「${newActualParentId || 'なし'}」に更新予定。`);
                    });

                    if (updatesCount > 0) {
                        await batch.commit();
                        statusMessage.textContent = `${updatesCount}件の子カテゴリの親を更新しました。`;
                        statusMessage.style.color = 'green';
                        logToUI(DOMR.step2ExecutionLog, `グループ (旧親: ${oldParentNameDisplay}) の更新成功。`, "success");
                    } else {
                         statusMessage.textContent = '更新対象のカテゴリはありませんでした。';
                         statusMessage.style.color = 'blue';
                         logToUI(DOMR.step2ExecutionLog, `グループ (旧親: ${oldParentNameDisplay}) の更新対象なし。`, "info");
                    }
                    
                    taskItem.style.backgroundColor = '#d4edda'; 
                    selector.disabled = true; 
                    updateButton.textContent = '更新完了'; 
                } catch (err) {
                    console.error("Update error:", err);
                    statusMessage.textContent = `更新失敗: ${err.message}`;
                    statusMessage.style.color = 'red';
                    logToUI(DOMR.step2ExecutionLog, `グループ (旧親: ${oldParentNameDisplay}) の更新失敗: ${err.message}`, "error");
                    updateButton.disabled = false;
                    updateButton.textContent = 'このグループの親を更新';
                }
            });
            
            selectorContainerDiv.appendChild(selectorLabel);
            selectorContainerDiv.appendChild(selector);
            
            taskItem.appendChild(childListDiv);
            taskItem.appendChild(selectorContainerDiv);
            taskItem.appendChild(updateButton);
            
            groupDiv.appendChild(taskItem);
            DOMR.tasksContainer.appendChild(groupDiv);
        });
        
    } catch (error) {
        console.error("Category Restore Error:", error);
        DOMR.tasksContainer.innerHTML = `<p style="color: red;">カテゴリ親子関係の分析エラー: ${error.message}</p>`;
        logToUI(DOMR.step2ExecutionLog, `カテゴリ親子関係の分析エラー: ${error.message}`, 'error');
    } finally {
        DOMR.startCategoryRestoreButton.disabled = false;
        DOMR.startCategoryRestoreButton.textContent = 'カテゴリ親子関係の修復開始';
    }
});
