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
    tasksContainerCategories: document.getElementById('tasksContainerCategories'), // Changed ID
    step2ExecutionLog: document.getElementById('step2ExecutionLog'),

    step3Section: document.getElementById('step3Section'), // New Step 3
    startEffectSuperCategoryToTypeRestoreButton: document.getElementById('startEffectSuperCategoryToTypeRestoreButton'),
    tasksContainerEffectSuperCategoryToType: document.getElementById('tasksContainerEffectSuperCategoryToType'),
    step3ExecutionLog: document.getElementById('step3ExecutionLog'),
};

const COLLECTIONS_TO_WASH = [
    "categories", "tags", "items", 
    "effect_types", "effect_units", "effect_super_categories", 
    "item_sources"
];
const CHARACTER_BASE_TYPES_FOR_WASH = ["headShape", "correction", "color", "pattern"];

// Store parsed backup data globally after file selection for other steps
let parsedBackupDataGlobal = null;

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
        updateButtonStatesBasedOnLoginAndFile();
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
    parsedBackupDataGlobal = null; // Clear parsed data
    updateButtonStatesBasedOnLoginAndFile();

    DOMR.step1ExecutionLog.innerHTML = 'ログはここに表示されます...';
    DOMR.tasksContainerCategories.innerHTML = '<p>カテゴリ親子関係の修復タスクはここに表示されます。</p>';
    DOMR.step2ExecutionLog.innerHTML = 'ログはここに表示されます...';
    DOMR.tasksContainerEffectSuperCategoryToType.innerHTML = '<p>効果大分類と効果種類の関連性修復タスクはここに表示されます。</p>';
    DOMR.step3ExecutionLog.innerHTML = 'ログはここに表示されます...';
}

function updateButtonStatesBasedOnLoginAndFile() {
    const isLoggedIn = auth.currentUser !== null;
    const fileSelected = DOMR.backupFileInput.files.length > 0;

    DOMR.executeDbWashButton.disabled = !(isLoggedIn && fileSelected);
    DOMR.startCategoryRestoreButton.disabled = !isLoggedIn; // Can be run if DB is already washed
    DOMR.startEffectSuperCategoryToTypeRestoreButton.disabled = !isLoggedIn; // Same
}

DOMR.backupFileInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (file) {
        DOMR.step1ExecutionLog.innerHTML = 'バックアップファイルが選択されました。';
        try {
            const backupString = await file.text();
            parsedBackupDataGlobal = JSON.parse(backupString); // Parse and store globally
            if (!parsedBackupDataGlobal.collections) {
                throw new Error("バックアップファイルの形式が正しくありません。'collections' プロパティが見つかりません。");
            }
            logToUI(DOMR.step1ExecutionLog, "バックアップファイルの読み込みと解析に成功しました。", "success");
        } catch (e) {
            parsedBackupDataGlobal = null;
            logToUI(DOMR.step1ExecutionLog, `バックアップファイルの読み込みエラー: ${e.message}`, "error");
            alert(`バックアップファイルの読み込みエラー: ${e.message}`);
        }
    } else {
        parsedBackupDataGlobal = null;
        DOMR.step1ExecutionLog.innerHTML = 'バックアップファイルが選択されていません。';
    }
    updateButtonStatesBasedOnLoginAndFile();
});


function logToUI(logAreaElement, message, type = 'info') {
    if (!logAreaElement) return;
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logAreaElement.appendChild(logEntry);
    logAreaElement.scrollTop = logAreaElement.scrollHeight;
}

// --- Step 1: DB Wash ---
DOMR.executeDbWashButton.addEventListener('click', async () => {
    if (!parsedBackupDataGlobal) {
        alert("バックアップファイルが読み込まれていません。ファイルを選択し直してください。");
        return;
    }
    if (!confirm("本当にデータベースの洗い替えを実行しますか？\n" +
                 `対象コレクション (${COLLECTIONS_TO_WASH.join(', ')}, character_bases/*) の既存データは全て削除され、\n` +
                 "バックアップファイルの内容で上書きされます。この操作は元に戻せません。")) {
        return;
    }

    DOMR.executeDbWashButton.disabled = true;
    DOMR.executeDbWashButton.textContent = '洗い替え実行中...';
    DOMR.step1ExecutionLog.innerHTML = '';
    logToUI(DOMR.step1ExecutionLog, "DB洗い替え処理を開始します...");

    try {
        const collectionsFromBackup = parsedBackupDataGlobal.collections;

        for (const collName of COLLECTIONS_TO_WASH) {
            logToUI(DOMR.step1ExecutionLog, `${collName} コレクションの既存データを削除中...`);
            const snapshot = await getDocs(collection(db, collName));
            const deleteBatch = writeBatch(db);
            snapshot.docs.forEach(d => deleteBatch.delete(d.ref));
            await deleteBatch.commit();
            logToUI(DOMR.step1ExecutionLog, `${collName} コレクションのデータ削除完了 (${snapshot.size}件)。`);
        }
        
        logToUI(DOMR.step1ExecutionLog, `character_bases のサブコレクションデータを削除中...`);
        for (const baseType of CHARACTER_BASE_TYPES_FOR_WASH) {
            const subCollPath = `character_bases/${baseType}/options`;
            const subSnapshot = await getDocs(collection(db, subCollPath));
            const subDeleteBatch = writeBatch(db);
            subSnapshot.docs.forEach(d => subDeleteBatch.delete(d.ref));
            await subDeleteBatch.commit();
            logToUI(DOMR.step1ExecutionLog, `  ${subCollPath} のデータ削除完了 (${subSnapshot.size}件)。`);
        }
        logToUI(DOMR.step1ExecutionLog, `character_bases のサブコレクションデータ削除完了。`);

        for (const collName of COLLECTIONS_TO_WASH) {
            if (!collectionsFromBackup[collName] || !Array.isArray(collectionsFromBackup[collName])) {
                logToUI(DOMR.step1ExecutionLog, `${collName} のデータがバックアップに存在しないか、形式が不正です。スキップします。`, 'warning');
                continue;
            }
            logToUI(DOMR.step1ExecutionLog, `${collName} コレクションにバックアップデータを書き込み中...`);
            const collectionData = collectionsFromBackup[collName];
            for (const docData of collectionData) {
                const dataToWrite = { ...docData };
                delete dataToWrite.id; 
                dataToWrite.createdAt = serverTimestamp(); // Use current server timestamp
                dataToWrite.updatedAt = serverTimestamp();
                await addDoc(collection(db, collName), dataToWrite);
            }
            logToUI(DOMR.step1ExecutionLog, `${collName} コレクションへの書き込み完了 (${collectionData.length}件)。`);
        }
        
        if (collectionsFromBackup.character_bases) {
            logToUI(DOMR.step1ExecutionLog, `character_bases のデータを書き込み中...`);
            for (const baseType of CHARACTER_BASE_TYPES_FOR_WASH) {
                if (collectionsFromBackup.character_bases[baseType] && Array.isArray(collectionsFromBackup.character_bases[baseType])) {
                    const optionsData = collectionsFromBackup.character_bases[baseType];
                    const subCollPath = `character_bases/${baseType}/options`;
                    for (const optionDocData of optionsData) {
                        const optionDataToWrite = { ...optionDocData };
                        delete optionDataToWrite.id;
                        optionDataToWrite.createdAt = serverTimestamp();
                        optionDataToWrite.updatedAt = serverTimestamp();
                        await addDoc(collection(db, subCollPath), optionDataToWrite);
                    }
                     logToUI(DOMR.step1ExecutionLog, `  ${subCollPath} への書き込み完了 (${optionsData.length}件)。`);
                }
            }
        }
        logToUI(DOMR.step1ExecutionLog, "DB洗い替え処理が正常に完了しました。", 'success');
        alert("データベースの洗い替えが完了しました。ステップ2以降に進んでください。");

    } catch (error) {
        console.error("DB Wash Error:", error);
        logToUI(DOMR.step1ExecutionLog, `エラーが発生しました: ${error.message}`, 'error');
        alert(`エラーが発生しました: ${error.message}`);
    } finally {
        DOMR.executeDbWashButton.textContent = 'DB洗い替え実行';
        updateButtonStatesBasedOnLoginAndFile();
    }
});

// --- Step 2: Category Parent Relationship Restore ---
DOMR.startCategoryRestoreButton.addEventListener('click', async () => {
    if (!parsedBackupDataGlobal || !parsedBackupDataGlobal.collections || !parsedBackupDataGlobal.collections.categories) {
        alert("ステップ2を開始する前に、ステップ1で有効なバックアップファイルを読み込んでください。");
        logToUI(DOMR.step2ExecutionLog, "バックアップデータが読み込まれていません。", "error");
        return;
    }
    DOMR.startCategoryRestoreButton.disabled = true;
    DOMR.startCategoryRestoreButton.textContent = '分析中...';
    DOMR.tasksContainerCategories.innerHTML = '<p>現在のカテゴリデータを読み込んで分析しています...</p>';
    DOMR.step2ExecutionLog.innerHTML = '';
    logToUI(DOMR.step2ExecutionLog, "カテゴリ親子関係の修復を開始します...");

    try {
        const currentCategoriesSnapshot = await getDocs(collection(db, 'categories'));
        const currentCategories = currentCategoriesSnapshot.docs.map(d => ({
            id: d.id, 
            name: d.data().name, // Need name for matching and display
            parentId: d.data().parentId // This should be the OLD parentId from backup
        }));

        const oldCategoriesFromBackup = parsedBackupDataGlobal.collections.categories;

        DOMR.tasksContainerCategories.innerHTML = ''; 
        logToUI(DOMR.step2ExecutionLog, `現在のDBから ${currentCategories.length} 件のカテゴリを読み込みました。`);

        const currentParentCategoryCandidates = currentCategories
            .filter(c => !c.parentId || c.parentId === "")
            .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
        
        logToUI(DOMR.step2ExecutionLog, `親カテゴリ候補 (洗い替え後のDBでparentIdが空のもの): ${currentParentCategoryCandidates.length} 件`);

        const childrenGroupsByOldParentId = {};
        currentCategories.forEach(cat => {
            if (cat.parentId && cat.parentId !== "") { // This parentId is an OLD ID from backup
                if (!childrenGroupsByOldParentId[cat.parentId]) {
                    const oldParentInfo = oldCategoriesFromBackup.find(p => p.id === cat.parentId);
                    childrenGroupsByOldParentId[cat.parentId] = {
                        oldParentName: oldParentInfo ? oldParentInfo.name : `不明な旧親 (ID: ${cat.parentId})`,
                        oldParentIdString: cat.parentId,
                        childCategories: [] 
                    };
                }
                childrenGroupsByOldParentId[cat.parentId].childCategories.push({ newId: cat.id, name: cat.name });
            }
        });
        
        const sortedOldParentIdStrings = Object.keys(childrenGroupsByOldParentId).sort((a,b) => {
            return childrenGroupsByOldParentId[a].oldParentName.localeCompare(childrenGroupsByOldParentId[b].oldParentName, 'ja');
        });

        if (sortedOldParentIdStrings.length === 0) {
            DOMR.tasksContainerCategories.innerHTML = '<p>現在のデータベースに、旧 `parentId` を持つ子カテゴリが見つかりませんでした。</p>';
            logToUI(DOMR.step2ExecutionLog, "修復対象の子カテゴリグループなし。", "info");
            return;
        }
        logToUI(DOMR.step2ExecutionLog, `${sortedOldParentIdStrings.length} 個の旧親子グループを検出しました。`);

        sortedOldParentIdStrings.forEach(oldParentIdStr => {
            const groupData = childrenGroupsByOldParentId[oldParentIdStr];
            const groupDiv = document.createElement('div');
            groupDiv.className = 'task-group'; // Reusing class from your previous HTML

            const header = document.createElement('h4');
            header.textContent = `旧 親カテゴリ: 「${groupData.oldParentName}」 `;
            const oldIdSpan = document.createElement('span');
            oldIdSpan.className = 'old-id';
            oldIdSpan.textContent = `(旧ID: ${groupData.oldParentIdString})`;
            header.appendChild(oldIdSpan);
            groupDiv.appendChild(header);

            const taskItem = document.createElement('div'); // Wrapper for list, select, button
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
                const isRecommended = (p.name === groupData.oldParentName);
                optionsHtml += `<option value="${p.id}" ${isRecommended ? 'selected' : ''}>${p.name} (現ID: ${p.id.substring(0,5)}...)</option>`;
            });
            selector.innerHTML = optionsHtml;

            const updateButton = document.createElement('button');
            updateButton.textContent = 'このグループの親を更新';
            updateButton.addEventListener('click', async () => {
                // ... (Update logic from previous version, seems okay) ...
                const newActualParentId = selector.value; 
                const selectedOptionText = selector.options[selector.selectedIndex].text;
                
                if (!confirm(`子カテゴリグループ (旧親: ${groupData.oldParentName}) の新しい親を「${selectedOptionText}」に設定しますか？`)) {
                    return;
                }
                
                updateButton.disabled = true;
                updateButton.textContent = '更新中...';
                let statusMessage = taskItem.querySelector('.status-message');
                if (!statusMessage) {
                    statusMessage = document.createElement('p');
                    statusMessage.className = 'status-message'; // Add class for styling
                    taskItem.appendChild(statusMessage);
                }
                statusMessage.textContent = "処理中...";
                statusMessage.className = 'status-message info';


                try {
                    const batch = writeBatch(db);
                    let updatesCount = 0;
                    groupData.childCategories.forEach(childToUpdate => {
                        const docRef = doc(db, 'categories', childToUpdate.newId);
                        batch.update(docRef, { parentId: newActualParentId });
                        updatesCount++;
                        logToUI(DOMR.step2ExecutionLog, `子カテゴリ「${childToUpdate.name}」(現ID:${childToUpdate.newId}) の parentId を「${newActualParentId || 'なし'}」に更新予定。`);
                    });

                    if (updatesCount > 0) {
                        await batch.commit();
                        statusMessage.textContent = `${updatesCount}件の子カテゴリの親を更新しました。ページを再読み込みして、親カテゴリ候補を最新化してください。`;
                        statusMessage.className = 'status-message success';
                        logToUI(DOMR.step2ExecutionLog, `グループ (旧親: ${groupData.oldParentName}) の更新成功。`, "success");
                    } else {
                         statusMessage.textContent = '更新対象のカテゴリはありませんでした。';
                         statusMessage.className = 'status-message info';
                         logToUI(DOMR.step2ExecutionLog, `グループ (旧親: ${groupData.oldParentName}) の更新対象なし。`, "info");
                    }
                    
                    taskItem.style.backgroundColor = '#d4edda'; 
                    selector.disabled = true; 
                    updateButton.textContent = '更新完了'; 
                } catch (err) {
                    console.error("Update error:", err);
                    statusMessage.textContent = `更新失敗: ${err.message}`;
                    statusMessage.className = 'status-message error';

                    logToUI(DOMR.step2ExecutionLog, `グループ (旧親: ${groupData.oldParentName}) の更新失敗: ${err.message}`, "error");
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
            DOMR.tasksContainerCategories.appendChild(groupDiv);
        });
        
    } catch (error) {
        console.error("Category Restore Error:", error);
        DOMR.tasksContainerCategories.innerHTML = `<p style="color: red;">カテゴリ親子関係の分析エラー: ${error.message}</p>`;
        logToUI(DOMR.step2ExecutionLog, `カテゴリ親子関係の分析エラー: ${error.message}`, 'error');
    } finally {
        DOMR.startCategoryRestoreButton.disabled = false;
        DOMR.startCategoryRestoreButton.textContent = 'カテゴリ親子関係の修復開始';
    }
});

// --- Step 3: Effect SuperCategory to EffectType Relationship Restore ---
DOMR.startEffectSuperCategoryToTypeRestoreButton.addEventListener('click', async () => {
    if (!parsedBackupDataGlobal || !parsedBackupDataGlobal.collections || 
        !parsedBackupDataGlobal.collections.effect_types || 
        !parsedBackupDataGlobal.collections.effect_super_categories) {
        alert("ステップ3を開始する前に、ステップ1で有効なバックアップファイルを読み込んでください。");
        logToUI(DOMR.step3ExecutionLog, "バックアップデータ (effect_types または effect_super_categories) が読み込まれていません。", "error");
        return;
    }

    DOMR.startEffectSuperCategoryToTypeRestoreButton.disabled = true;
    DOMR.startEffectSuperCategoryToTypeRestoreButton.textContent = '分析中...';
    DOMR.tasksContainerEffectSuperCategoryToType.innerHTML = '<p>現在のデータを読み込んで分析しています...</p>';
    DOMR.step3ExecutionLog.innerHTML = '';
    logToUI(DOMR.step3ExecutionLog, "効果大分類と効果種類の関連性修復を開始します...");

    try {
        // 1. Fetch current data from Firestore
        const currentEffectTypesSnapshot = await getDocs(collection(db, 'effect_types'));
        const currentEffectTypes = currentEffectTypesSnapshot.docs.map(d => ({ id: d.id, name: d.data().name, superCategoryId: d.data().superCategoryId /* This is an OLD ID */ }));
        
        const currentSuperCategoriesSnapshot = await getDocs(collection(db, 'effect_super_categories'));
        const currentSuperCategories = currentSuperCategoriesSnapshot.docs.map(d => ({ id: d.id, name: d.data().name }));

        // 2. Get old data from backup (already parsed in parsedBackupDataGlobal)
        const oldEffectTypesFromBackup = parsedBackupDataGlobal.collections.effect_types;
        const oldSuperCategoriesFromBackup = parsedBackupDataGlobal.collections.effect_super_categories;

        DOMR.tasksContainerEffectSuperCategoryToType.innerHTML = '';
        logToUI(DOMR.step3ExecutionLog, `現在のDBから ${currentEffectTypes.length} 件の効果種類、${currentSuperCategories.length} 件の効果大分類を読み込みました。`);

        if (currentEffectTypes.length === 0) {
            DOMR.tasksContainerEffectSuperCategoryToType.innerHTML = '<p>現在のデータベースに効果種類が見つかりません。</p>';
            return;
        }
        
        const sortedCurrentEffectTypes = currentEffectTypes.sort((a,b) => a.name.localeCompare(b.name, 'ja'));

        sortedCurrentEffectTypes.forEach(currentEffectType => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'item-to-restore'; // New class for individual items

            const oldSuperCatId = currentEffectType.superCategoryId; // This is the OLD ID
            const oldSuperCatInfo = oldSuperCatId ? oldSuperCategoriesFromBackup.find(sc => sc.id === oldSuperCatId) : null;
            const oldSuperCatNameDisplay = oldSuperCatInfo ? oldSuperCatInfo.name : (oldSuperCatId ? `不明な旧大分類 (ID: ${oldSuperCatId.substring(0,5)}...)` : 'なし');

            itemDiv.innerHTML = `
                <strong>効果種類: ${currentEffectType.name}</strong> (現ID: ${currentEffectType.id.substring(0,5)}...)
                <div class="item-info">旧所属効果大分類: <span class="${oldSuperCatInfo ? '' : 'old-parent-name'}">${oldSuperCatNameDisplay}</span></div>
            `;

            const selectorLabel = document.createElement('label');
            selectorLabel.textContent = '新しい効果大分類を選択:';
            selectorLabel.style.display = 'block';
            selectorLabel.style.marginTop = '5px';

            const selector = document.createElement('select');
            selector.id = `selector-efftype-${currentEffectType.id}`;
            let optionsHtml = '<option value="">大分類なし</option>';
            currentSuperCategories.sort((a,b) => a.name.localeCompare(b.name, 'ja')).forEach(currentSC => {
                const isRecommended = oldSuperCatInfo && (currentSC.name === oldSuperCatInfo.name);
                optionsHtml += `<option value="${currentSC.id}" ${isRecommended ? 'selected' : ''}>${currentSC.name} (現ID: ${currentSC.id.substring(0,5)}...)</option>`;
            });
            selector.innerHTML = optionsHtml;

            const updateButton = document.createElement('button');
            updateButton.textContent = 'この効果種類の大分類を更新';
            updateButton.style.marginTop = '10px';
            updateButton.addEventListener('click', async () => {
                const newSuperCategoryIdActual = selector.value; // This is a NEW Firestore ID, or ""
                const selectedOptionText = selector.options[selector.selectedIndex].text;

                if (!confirm(`効果種類「${currentEffectType.name}」の新しい効果大分類を「${selectedOptionText}」に設定しますか？`)) {
                    return;
                }

                updateButton.disabled = true;
                updateButton.textContent = '更新中...';
                let statusMessage = itemDiv.querySelector('.status-message');
                if (!statusMessage) {
                    statusMessage = document.createElement('p');
                    statusMessage.className = 'status-message';
                    itemDiv.appendChild(statusMessage);
                }
                statusMessage.textContent = "処理中...";
                statusMessage.className = 'status-message info';

                try {
                    const docRef = doc(db, 'effect_types', currentEffectType.id);
                    await updateDoc(docRef, { superCategoryId: newSuperCategoryIdActual || null }); // Store null if "なし"
                    
                    statusMessage.textContent = '効果大分類を更新しました。';
                    statusMessage.className = 'status-message success';
                    logToUI(DOMR.step3ExecutionLog, `効果種類「${currentEffectType.name}」の大分類を「${selectedOptionText}」に更新しました。`, "success");
                    itemDiv.style.backgroundColor = '#d4edda'; 
                    selector.disabled = true; 
                    updateButton.textContent = '更新完了';
                } catch (err) {
                    console.error("EffectType SuperCategory Update error:", err);
                    statusMessage.textContent = `更新失敗: ${err.message}`;
                    statusMessage.className = 'status-message error';
                    logToUI(DOMR.step3ExecutionLog, `効果種類「${currentEffectType.name}」の大分類更新失敗: ${err.message}`, "error");
                    updateButton.disabled = false;
                    updateButton.textContent = 'この効果種類の大分類を更新';
                }
            });

            itemDiv.appendChild(selectorLabel);
            itemDiv.appendChild(selector);
            itemDiv.appendChild(updateButton);
            DOMR.tasksContainerEffectSuperCategoryToType.appendChild(itemDiv);
        });

    } catch (error) {
        console.error("Effect SuperCategory to Type Restore Error:", error);
        DOMR.tasksContainerEffectSuperCategoryToType.innerHTML = `<p style="color: red;">効果大分類→効果種類 関係修復の分析エラー: ${error.message}</p>`;
        logToUI(DOMR.step3ExecutionLog, `効果大分類→効果種類 関係修復の分析エラー: ${error.message}`, 'error');
    } finally {
        DOMR.startEffectSuperCategoryToTypeRestoreButton.disabled = false;
        DOMR.startEffectSuperCategoryToTypeRestoreButton.textContent = '効果大分類→効果種類 関係修復開始';
    }
});
