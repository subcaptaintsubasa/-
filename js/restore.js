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
    tasksContainerCategories: document.getElementById('tasksContainerCategories'),
    step2ExecutionLog: document.getElementById('step2ExecutionLog'),

    step3Section: document.getElementById('step3Section'),
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
    parsedBackupDataGlobal = null;
    updateButtonStatesBasedOnLoginAndFile();

    DOMR.step1ExecutionLog.innerHTML = 'ログはここに表示されます...';
    DOMR.tasksContainerCategories.innerHTML = '<p>カテゴリ親子関係の修復タスクはここに表示されます。</p>';
    DOMR.step2ExecutionLog.innerHTML = 'ログはここに表示されます...';
    DOMR.tasksContainerEffectSuperCategoryToType.innerHTML = '<p>効果大分類と効果種類の関連性修復タスクはここに表示されます。</p>';
    DOMR.step3ExecutionLog.innerHTML = 'ログはここに表示されます...';
}

function updateButtonStatesBasedOnLoginAndFile() {
    const isLoggedIn = auth.currentUser !== null;
    const fileSelected = DOMR.backupFileInput.files.length > 0 && parsedBackupDataGlobal !== null; // Check if parsed successfully

    DOMR.executeDbWashButton.disabled = !(isLoggedIn && fileSelected);
    DOMR.startCategoryRestoreButton.disabled = !isLoggedIn;
    DOMR.startEffectSuperCategoryToTypeRestoreButton.disabled = !isLoggedIn;
}

DOMR.backupFileInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (file) {
        DOMR.step1ExecutionLog.innerHTML = 'バックアップファイルが選択されました。解析中...';
        try {
            const backupString = await file.text();
            parsedBackupDataGlobal = JSON.parse(backupString);
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
            let deleteCount = 0;
            if (snapshot.size > 0) {
                const deleteBatch = writeBatch(db);
                snapshot.docs.forEach(d => deleteBatch.delete(d.ref));
                await deleteBatch.commit();
                deleteCount = snapshot.size;
            }
            logToUI(DOMR.step1ExecutionLog, `${collName} コレクションのデータ削除完了 (${deleteCount}件)。`);
        }
        
        logToUI(DOMR.step1ExecutionLog, `character_bases のサブコレクションデータを削除中...`);
        for (const baseType of CHARACTER_BASE_TYPES_FOR_WASH) {
            const subCollPath = `character_bases/${baseType}/options`;
            const subSnapshot = await getDocs(collection(db, subCollPath));
            let subDeleteCount = 0;
            if (subSnapshot.size > 0) {
                const subDeleteBatch = writeBatch(db);
                subSnapshot.docs.forEach(d => subDeleteBatch.delete(d.ref));
                await subDeleteBatch.commit();
                subDeleteCount = subSnapshot.size;
            }
            logToUI(DOMR.step1ExecutionLog, `  ${subCollPath} のデータ削除完了 (${subDeleteCount}件)。`);
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
                if (dataToWrite.hasOwnProperty('id')) { // Preserve old id if it exists in backup for reference during step 2+
                    dataToWrite.old_id_from_backup = dataToWrite.id;
                }
                delete dataToWrite.id; 
                dataToWrite.createdAt = serverTimestamp();
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
                         if (optionDataToWrite.hasOwnProperty('id')) {
                            optionDataToWrite.old_id_from_backup = optionDataToWrite.id;
                        }
                        delete optionDataToWrite.id;
                        optionDataToWrite.createdAt = serverTimestamp();
                        optionDataToWrite.updatedAt = serverTimestamp();
                        await addDoc(collection(db, subCollPath), optionDataToWrite);
                    }
                     logToUI(DOMR.step1ExecutionLog, `  ${subCollPath} への書き込み完了 (${optionsData.length}件)。`);
                } else {
                    logToUI(DOMR.step1ExecutionLog, `バックアップに character_bases.${baseType} のデータがありません。`, 'warning');
                }
            }
        } else {
            logToUI(DOMR.step1ExecutionLog, `バックアップに character_bases のデータがありません。`, 'warning');
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
        logToUI(DOMR.step2ExecutionLog, "バックアップデータ (categories) が読み込まれていません。", "error");
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
            name: d.data().name,
            parentId: d.data().parentId 
        }));

        const oldCategoriesFromBackup = parsedBackupDataGlobal.collections.categories;

        DOMR.tasksContainerCategories.innerHTML = ''; 
        logToUI(DOMR.step2ExecutionLog, `現在のDBから ${currentCategories.length} 件のカテゴリを読み込みました。`);

        const currentParentCategoryCandidates = currentCategories
            .filter(c => !c.parentId || c.parentId === "") 
            .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
        
        logToUI(DOMR.step2ExecutionLog, `親カテゴリ候補 (洗い替え後のDBでparentIdが空または旧IDのままのもの): ${currentParentCategoryCandidates.length} 件`);

        const childrenGroupsByOldParentId = {};
        currentCategories.forEach(cat => {
            if (cat.parentId && cat.parentId !== "") {
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
            DOMR.tasksContainerCategories.innerHTML = '<p>現在のデータベースに、旧 `parentId` を持つ子カテゴリが見つかりませんでした。(修復済みか洗い替えデータに親子関係がない可能性)</p>';
            logToUI(DOMR.step2ExecutionLog, "修復対象の子カテゴリグループなし。", "info");
            DOMR.startCategoryRestoreButton.disabled = false;
            DOMR.startCategoryRestoreButton.textContent = 'カテゴリ親子関係の修復開始';
            return;
        }
        logToUI(DOMR.step2ExecutionLog, `${sortedOldParentIdStrings.length} 個の旧親子グループを検出しました。`);

        sortedOldParentIdStrings.forEach(oldParentIdStr => {
            const groupData = childrenGroupsByOldParentId[oldParentIdStr];
            const groupDiv = document.createElement('div');
            groupDiv.className = 'task-group';

            const header = document.createElement('h4');
            header.textContent = `旧 親カテゴリ: 「${groupData.oldParentName}」 `;
            const oldIdSpan = document.createElement('span');
            oldIdSpan.className = 'old-id';
            oldIdSpan.textContent = `(旧ID: ${groupData.oldParentIdString})`;
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
            selectorLabel.htmlFor = `selector-cat-${oldParentIdStr.replace(/[^a-zA-Z0-9]/g, "")}`;
            selectorLabel.textContent = '現在のDBから新しい親を選択:';
            
            const selector = document.createElement('select');
            selector.id = `selector-cat-${oldParentIdStr.replace(/[^a-zA-Z0-9]/g, "")}`;
            let optionsHtml = '<option value="">親なし (最上位にする)</option>';
            // 親候補は、洗い替え後のDBで、現時点で parentId が設定されていないもの（つまり真の親候補）
            const actualParentCandidatesInDB = currentCategories
                .filter(c => !c.parentId || c.parentId === "")
                .sort((a,b)=>a.name.localeCompare(b.name, 'ja'));

            actualParentCandidatesInDB.forEach(p => {
                const isRecommended = (p.name === groupData.oldParentName);
                optionsHtml += `<option value="${p.id}" ${isRecommended ? 'selected' : ''}>${p.name} (現ID: ${p.id.substring(0,5)}...)</option>`;
            });
            selector.innerHTML = optionsHtml;

            const updateButton = document.createElement('button');
            updateButton.textContent = 'このグループの親を更新';
            updateButton.addEventListener('click', async () => {
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
                    statusMessage.className = 'status-message';
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
                        statusMessage.textContent = `${updatesCount}件の子カテゴリの親を更新しました。このグループの処理は完了です。他のグループの処理に進むか、次のステップに進んでください。`;
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
        const currentEffectTypesSnapshot = await getDocs(collection(db, 'effect_types'));
        const currentEffectTypes = currentEffectTypesSnapshot.docs.map(d => ({ 
            id: d.id,
            name: d.data().name, 
            superCategoryId: d.data().superCategoryId // This is an OLD SuperCategory ID from backup
        }));
        
        const currentSuperCategoriesSnapshot = await getDocs(collection(db, 'effect_super_categories'));
        const currentSuperCategories = currentSuperCategoriesSnapshot.docs.map(d => ({ 
            id: d.id,
            name: d.data().name 
        }));

        const oldSuperCategoriesFromBackup = parsedBackupDataGlobal.collections.effect_super_categories;

        DOMR.tasksContainerEffectSuperCategoryToType.innerHTML = '';
        logToUI(DOMR.step3ExecutionLog, `現在のDBから ${currentEffectTypes.length} 件の効果種類、${currentSuperCategories.length} 件の効果大分類を読み込みました。`);

        if (currentEffectTypes.length === 0) {
            DOMR.tasksContainerEffectSuperCategoryToType.innerHTML = '<p>現在のデータベースに効果種類が見つかりません。</p>';
            DOMR.startEffectSuperCategoryToTypeRestoreButton.disabled = false;
            DOMR.startEffectSuperCategoryToTypeRestoreButton.textContent = '効果大分類→効果種類 関係修復開始';
            return;
        }
        
        const effectTypesByOldSuperCatId = {};
        currentEffectTypes.forEach(effType => {
            const oldScId = effType.superCategoryId || "NONE"; 
            if (!effectTypesByOldSuperCatId[oldScId]) {
                const oldSuperCatInfo = oldScId !== "NONE" ? oldSuperCategoriesFromBackup.find(sc => sc.id === oldScId) : null;
                effectTypesByOldSuperCatId[oldScId] = {
                    oldSuperCategoryName: oldSuperCatInfo ? oldSuperCatInfo.name : (oldScId === "NONE" ? "なし(元々未分類)" : `不明な旧大分類 (ID: ${oldScId})`),
                    oldSuperCategoryIdString: oldScId,
                    memberEffectTypes: []
                };
            }
            effectTypesByOldSuperCatId[oldScId].memberEffectTypes.push({ newId: effType.id, name: effType.name });
        });

        const sortedOldSuperCatIdStrings = Object.keys(effectTypesByOldSuperCatId).sort((a,b) => {
            return effectTypesByOldSuperCatId[a].oldSuperCategoryName.localeCompare(effectTypesByOldSuperCatId[b].oldSuperCategoryName, 'ja');
        });

        if (sortedOldSuperCatIdStrings.length === 0) {
            DOMR.tasksContainerEffectSuperCategoryToType.innerHTML = '<p>関連付けを修復する効果種類のグループが見つかりませんでした。</p>';
            logToUI(DOMR.step3ExecutionLog, "修復対象の効果種類グループなし。", "info");
            DOMR.startEffectSuperCategoryToTypeRestoreButton.disabled = false;
            DOMR.startEffectSuperCategoryToTypeRestoreButton.textContent = '効果大分類→効果種類 関係修復開始';
            return;
        }
        logToUI(DOMR.step3ExecutionLog, `${sortedOldSuperCatIdStrings.length} 個の旧効果大分類グループを検出しました。`);

        sortedOldSuperCatIdStrings.forEach(oldScIdStr => {
            const groupData = effectTypesByOldSuperCatId[oldScIdStr];
            const groupDiv = document.createElement('div');
            groupDiv.className = 'task-group';

            const header = document.createElement('h4');
            header.textContent = `旧 効果大分類: 「${groupData.oldSuperCategoryName}」 `;
            if (groupData.oldSuperCategoryIdString !== "NONE") {
                const oldIdSpan = document.createElement('span');
                oldIdSpan.className = 'old-id';
                oldIdSpan.textContent = `(旧ID: ${groupData.oldSuperCategoryIdString})`;
                header.appendChild(oldIdSpan);
            }
            groupDiv.appendChild(header);

            const taskItem = document.createElement('div');
            taskItem.className = 'task-item';

            const memberListDiv = document.createElement('div');
            memberListDiv.className = 'child-list';
            const memberNamesForDisplay = groupData.memberEffectTypes.map(et => `<li>${et.name} (現ID: ${et.newId.substring(0,5)}...)</li>`).join('');
            memberListDiv.innerHTML = `<strong>このグループの効果種類 (${groupData.memberEffectTypes.length}件):</strong><ul>${memberNamesForDisplay}</ul>`;

            const selectorContainerDiv = document.createElement('div');
            selectorContainerDiv.className = 'selector-container';
            const selectorLabel = document.createElement('label');
            selectorLabel.htmlFor = `selector-sc-${oldScIdStr.replace(/[^a-zA-Z0-9]/g, "")}`;
            selectorLabel.textContent = '現在のDBから新しい効果大分類を選択:';
            
            const selector = document.createElement('select');
            selector.id = `selector-sc-${oldScIdStr.replace(/[^a-zA-Z0-9]/g, "")}`;
            let optionsHtml = '<option value="">大分類なし (未分類にする)</option>';
            currentSuperCategories.sort((a,b) => a.name.localeCompare(b.name, 'ja')).forEach(currentSC => {
                const isRecommended = (currentSC.name === groupData.oldSuperCategoryName);
                optionsHtml += `<option value="${currentSC.id}" ${isRecommended ? 'selected' : ''}>${currentSC.name} (現ID: ${currentSC.id.substring(0,5)}...)</option>`;
            });
            selector.innerHTML = optionsHtml;

            const updateButton = document.createElement('button');
            updateButton.textContent = 'このグループの効果種類を更新';
            updateButton.style.marginTop = '10px';
            updateButton.addEventListener('click', async () => {
                const newSuperCategoryIdActual = selector.value; 
                const selectedOptionText = selector.options[selector.selectedIndex].text;

                if (!confirm(`効果種類グループ (旧大分類: ${groupData.oldSuperCategoryName}) の新しい効果大分類を「${selectedOptionText}」に設定しますか？`)) {
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
                statusMessage.className = 'status-message info';

                try {
                    const batch = writeBatch(db);
                    let updatesCount = 0;
                    groupData.memberEffectTypes.forEach(effectTypeToUpdate => {
                        const docRef = doc(db, 'effect_types', effectTypeToUpdate.newId);
                        batch.update(docRef, { superCategoryId: newSuperCategoryIdActual || null });
                        updatesCount++;
                        logToUI(DOMR.step3ExecutionLog, `効果種類「${effectTypeToUpdate.name}」(現ID:${effectTypeToUpdate.newId}) の superCategoryId を「${newSuperCategoryIdActual || 'なし'}」に更新予定。`);
                    });

                    if (updatesCount > 0) {
                        await batch.commit();
                        statusMessage.textContent = `${updatesCount}件の効果種類の効果大分類を更新しました。`;
                        statusMessage.className = 'status-message success';
                        logToUI(DOMR.step3ExecutionLog, `グループ (旧大分類: ${groupData.oldSuperCategoryName}) の更新成功。`, "success");
                    } else {
                         statusMessage.textContent = '更新対象の効果種類はありませんでした。';
                         statusMessage.className = 'status-message info';
                         logToUI(DOMR.step3ExecutionLog, `グループ (旧大分類: ${groupData.oldSuperCategoryName}) の更新対象なし。`, "info");
                    }
                    
                    taskItem.style.backgroundColor = '#d4edda'; 
                    selector.disabled = true; 
                    updateButton.textContent = '更新完了';
                } catch (err) {
                    console.error("EffectType SuperCategory Group Update error:", err);
                    statusMessage.textContent = `更新失敗: ${err.message}`;
                    statusMessage.className = 'status-message error';
                    logToUI(DOMR.step3ExecutionLog, `グループ (旧大分類: ${groupData.oldSuperCategoryName}) の更新失敗: ${err.message}`, "error");
                    updateButton.disabled = false;
                    updateButton.textContent = 'このグループの効果種類を更新';
                }
            });
            
            selectorContainerDiv.appendChild(selectorLabel);
            selectorContainerDiv.appendChild(selector);
            
            taskItem.appendChild(memberListDiv);
            taskItem.appendChild(selectorContainerDiv);
            taskItem.appendChild(updateButton);
            
            groupDiv.appendChild(taskItem);
            DOMR.tasksContainerEffectSuperCategoryToType.appendChild(groupDiv);
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
