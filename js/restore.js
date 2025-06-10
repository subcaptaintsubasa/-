// js/restore.js
import { auth, db } from '../firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { collection, getDocs, writeBatch, doc, updateDoc, query, where } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

const DOMR = {
    passwordPrompt: document.getElementById('password-prompt'),
    mainContent: document.getElementById('main-content'),
    loginButton: document.getElementById('loginButton'),
    logoutButton: document.getElementById('logoutButton'),
    adminEmailInput: document.getElementById('adminEmailInput'),
    adminPasswordInput: document.getElementById('adminPasswordInput'),
    passwordError: document.getElementById('passwordError'),
    backupFileInput: document.getElementById('backupFile'),
    
    itemEffectRestoreSection: document.getElementById('itemEffectRestoreSection'),
    itemSearchInputForEffects: document.getElementById('itemSearchInputForEffects'),
    tasksContainerItemToEffectType: document.getElementById('tasksContainerItemToEffectType'),
    itemEffectRestoreLog: document.getElementById('itemEffectRestoreLog'),
};

let parsedBackupDataGlobal = null;
let currentItemsCache = []; 
let currentEffectTypesCache = []; 

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
        loadInitialDataForCurrentStep(); 
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
    currentItemsCache = [];
    currentEffectTypesCache = [];
    updateButtonStatesBasedOnLoginAndFile();

    DOMR.tasksContainerItemToEffectType.innerHTML = '<p>バックアップファイルを選択し、必要ならアイテム名で絞り込んでください。</p>';
    DOMR.itemEffectRestoreLog.innerHTML = 'ログはここに表示されます...';
    if (DOMR.itemSearchInputForEffects) DOMR.itemSearchInputForEffects.value = '';
}

function updateButtonStatesBasedOnLoginAndFile() {
    // No specific buttons to enable/disable in this simplified version other than what's handled by login state
    // and the input event listener for itemSearchInputForEffects.
}

DOMR.backupFileInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (DOMR.itemEffectRestoreLog) DOMR.itemEffectRestoreLog.innerHTML = '';
    if (file) {
        logToUI(DOMR.itemEffectRestoreLog, 'バックアップファイルが選択されました。解析中...');
        try {
            const backupString = await file.text();
            parsedBackupDataGlobal = JSON.parse(backupString);
            if (!parsedBackupDataGlobal.collections || !parsedBackupDataGlobal.collections.items || !parsedBackupDataGlobal.collections.effect_types) {
                parsedBackupDataGlobal = null; 
                throw new Error("バックアップファイルの形式が正しくありません。'collections.items' または 'collections.effect_types' が見つかりません。");
            }
            logToUI(DOMR.itemEffectRestoreLog, "バックアップファイルの読み込みと解析に成功しました。", "success");
            await loadInitialDataForCurrentStep(); // Reload DB data with new backup context
            renderItemEffectRestoreTasks(); // Render tasks immediately after successful parse and DB load
        } catch (e) {
            parsedBackupDataGlobal = null;
            logToUI(DOMR.itemEffectRestoreLog, `バックアップファイルの読み込みエラー: ${e.message}`, "error");
            alert(`バックアップファイルの読み込みエラー: ${e.message}`);
        }
    } else {
        parsedBackupDataGlobal = null;
        logToUI(DOMR.itemEffectRestoreLog, 'バックアップファイルが選択されていません。');
    }
    updateButtonStatesBasedOnLoginAndFile();
    if (DOMR.tasksContainerItemToEffectType) DOMR.tasksContainerItemToEffectType.innerHTML = '<p>バックアップファイルを選択し、必要ならアイテム名で絞り込んでください。</p>';
});


function logToUI(logAreaElement, message, type = 'info') {
    if (!logAreaElement) return;
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logAreaElement.appendChild(logEntry);
    logAreaElement.scrollTop = logAreaElement.scrollHeight;
}

async function loadInitialDataForCurrentStep() {
    if (!auth.currentUser) return; 
    logToUI(DOMR.itemEffectRestoreLog, "現在のデータベースからアイテムと効果種類のデータを読み込み中...");
    try {
        const [itemsSnapshot, effectTypesSnapshot] = await Promise.all([
            getDocs(collection(db, 'items')),
            getDocs(collection(db, 'effect_types'))
        ]);
        currentItemsCache = itemsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        currentEffectTypesCache = effectTypesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        logToUI(DOMR.itemEffectRestoreLog, `アイテム ${currentItemsCache.length}件、効果種類 ${currentEffectTypesCache.length}件を読み込みました。`, "success");
    } catch (error) {
        logToUI(DOMR.itemEffectRestoreLog, `データ読み込みエラー: ${error.message}`, "error");
        console.error("Error loading initial data for item-effect restore:", error);
    }
}

// --- Item to EffectType Relationship Restore ---
if (DOMR.itemSearchInputForEffects) {
    DOMR.itemSearchInputForEffects.addEventListener('input', renderItemEffectRestoreTasks);
}

function renderItemEffectRestoreTasks() {
    if (!parsedBackupDataGlobal) {
        DOMR.tasksContainerItemToEffectType.innerHTML = '<p>まず、バックアップファイルを選択・読み込んでください。</p>';
        return;
    }
    if (currentItemsCache.length === 0 || currentEffectTypesCache.length === 0) {
        DOMR.tasksContainerItemToEffectType.innerHTML = '<p>データベースからアイテムまたは効果種類のデータが読み込まれていません。ログイン状態を確認するか、ページを再読み込みしてください。</p>';
        // Attempt to reload data if caches are empty but user is logged in
        if (auth.currentUser && (currentItemsCache.length === 0 || currentEffectTypesCache.length === 0)) {
            logToUI(DOMR.itemEffectRestoreLog, "データキャッシュが空のため、再読み込みを試みます...", "warning");
            loadInitialDataForCurrentStep().then(() => {
                // After data is loaded, call render again if search term exists or to show all
                if(DOMR.itemSearchInputForEffects.value.trim() !== "" || currentItemsCache.length > 0) {
                    renderItemEffectRestoreTasks();
                }
            });
            return; 
        }
        return;
    }

    const searchTerm = DOMR.itemSearchInputForEffects.value.trim().toLowerCase();
    DOMR.tasksContainerItemToEffectType.innerHTML = ''; 

    const oldItemsFromBackup = parsedBackupDataGlobal.collections.items;
    const oldEffectTypesFromBackup = parsedBackupDataGlobal.collections.effect_types;

    let itemsToDisplay = currentItemsCache.sort((a, b) => (a.name || "").localeCompare(b.name || "", 'ja'));

    if (searchTerm) {
        itemsToDisplay = itemsToDisplay.filter(item => item.name && item.name.toLowerCase().includes(searchTerm));
    }

    if (itemsToDisplay.length === 0) {
        DOMR.tasksContainerItemToEffectType.innerHTML = searchTerm ? 
            `<p>アイテム名「${searchTerm}」に一致するアイテムは見つかりませんでした。</p>` :
            '<p>表示するアイテムがありません。(全アイテム表示中)</p>';
        return;
    }
    logToUI(DOMR.itemEffectRestoreLog, `表示中のアイテム: ${itemsToDisplay.length}件`);


    itemsToDisplay.forEach(currentItem => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'item-to-restore';

        const itemHeader = document.createElement('strong');
        itemHeader.className = 'item-name-header';
        itemHeader.textContent = `アイテム: ${currentItem.name || '(名称未設定)'} (現ID: ${currentItem.id.substring(0,5)}...)`;
        itemDiv.appendChild(itemHeader);

        const effectsListUl = document.createElement('ul');
        effectsListUl.className = 'effect-list';

        let effectsToProcess = [];
        const oldItemDataFromBackup = oldItemsFromBackup.find(it => 
            (it.old_id_from_backup && it.old_id_from_backup === currentItem.old_id_from_backup) || 
            (it.name === currentItem.name) // Fallback to name if old_id_from_backup is missing (should exist after wash)
        );

        if (currentItem.effects && Array.isArray(currentItem.effects)) {
            effectsToProcess = currentItem.effects;
        } else if (currentItem.structured_effects && Array.isArray(currentItem.structured_effects)) {
            effectsToProcess = currentItem.structured_effects.map(eff => ({
                type: "structured", effectTypeId: eff.type, value: eff.value, unit: eff.unit
            }));
        } else if (oldItemDataFromBackup) {
            if (oldItemDataFromBackup.effects && Array.isArray(oldItemDataFromBackup.effects)) {
                 effectsToProcess = oldItemDataFromBackup.effects;
            } else if (oldItemDataFromBackup.structured_effects && Array.isArray(oldItemDataFromBackup.structured_effects)){
                 effectsToProcess = oldItemDataFromBackup.structured_effects.map(eff => ({
                    type: "structured", effectTypeId: eff.type, value: eff.value, unit: eff.unit
                }));
            }
        }

        if (effectsToProcess.length === 0) {
            effectsListUl.innerHTML = '<li>このアイテムには修復対象の効果が設定されていません。</li>';
        } else {
            effectsToProcess.forEach((effect, index) => {
                const effectLi = document.createElement('li');
                effectLi.className = 'effect-item';

                if (effect.type === "manual") {
                    const manualDisplay = document.createElement('div');
                    manualDisplay.className = 'manual-effect-display';
                    manualDisplay.textContent = `手動効果: ${effect.manualString || '(空)'}`;
                    effectLi.appendChild(manualDisplay);
                } else if (effect.type === "structured" && effect.effectTypeId) {
                    const oldEffectTypeId = effect.effectTypeId;
                    const oldEffectTypeInfo = oldEffectTypesFromBackup.find(et => et.id === oldEffectTypeId);
                    const oldEffectTypeName = oldEffectTypeInfo ? oldEffectTypeInfo.name : `不明旧効果ID:${oldEffectTypeId.substring(0,5)}`;
                    
                    const effectValueUnit = `${effect.value !== undefined ? effect.value : ''}${effect.unit && effect.unit !== "none" ? effect.unit : ''}`;

                    const infoDiv = document.createElement('div');
                    infoDiv.className = 'item-info';
                    infoDiv.innerHTML = `元効果: <span class="old-value">${oldEffectTypeName} ${effectValueUnit}</span> (旧ID: ${oldEffectTypeId.substring(0,5)})`;
                    effectLi.appendChild(infoDiv);

                    const selectorLabel = document.createElement('label');
                    selectorLabel.htmlFor = `efftype-sel-${currentItem.id}-${index}`;
                    selectorLabel.textContent = '新しい効果種類を選択:';
                    effectLi.appendChild(selectorLabel);

                    const selector = document.createElement('select');
                    selector.id = `efftype-sel-${currentItem.id}-${index}`;
                    selector.dataset.effectIndex = index;

                    let optionsHtml = '<option value="">効果種類を選択解除</option>';
                    currentEffectTypesCache.sort((a,b) => (a.name||"").localeCompare(b.name||"", 'ja')).forEach(currentET => {
                        const isRecommended = oldEffectTypeInfo && (currentET.name === oldEffectTypeInfo.name);
                        optionsHtml += `<option value="${currentET.id}" ${isRecommended ? 'selected' : ''}>${currentET.name} (現ID: ${currentET.id.substring(0,5)}...)</option>`;
                    });
                    selector.innerHTML = optionsHtml;
                    effectLi.appendChild(selector);
                } else {
                     effectLi.textContent = `不明な効果データ、またはeffectTypeIdがありません: ${JSON.stringify(effect).substring(0,50)}...`;
                }
                effectsListUl.appendChild(effectLi);
            });
        }
        itemDiv.appendChild(effectsListUl);

        if (effectsToProcess.some(e => e.type === "structured")) {
            const updateButton = document.createElement('button');
            updateButton.textContent = 'このアイテムの効果を更新';
            updateButton.style.marginTop = '10px';
            updateButton.addEventListener('click', async () => {
                const newEffectsArray = [];
                
                itemDiv.querySelectorAll('ul.effect-list > li.effect-item').forEach(effectLiElement => {
                    const selector = effectLiElement.querySelector('select');
                    if (selector) { 
                        const effectIndex = parseInt(selector.dataset.effectIndex, 10);
                        const originalEffectData = effectsToProcess.find((eff, idx) => eff.type === "structured" && idx === effectIndex); // Find original structured effect
                        const newEffectTypeId = selector.value;

                        if (newEffectTypeId && originalEffectData) { 
                            newEffectsArray.push({
                                type: "structured",
                                effectTypeId: newEffectTypeId, 
                                value: originalEffectData.value,
                                unit: originalEffectData.unit
                            });
                        }
                    } else { 
                        const manualDisplayDiv = effectLiElement.querySelector('.manual-effect-display');
                        if (manualDisplayDiv) {
                             const originalManualEffect = effectsToProcess.find(eff => eff.type === "manual" && manualDisplayDiv.textContent.includes(eff.manualString || '(空)'));
                            if (originalManualEffect) newEffectsArray.push(originalManualEffect);
                        }
                    }
                });
                
                if (!confirm(`アイテム「${currentItem.name}」の効果を更新しますか？ ${newEffectsArray.length} 件の効果が保存されます。`)) {
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
                    const docRef = doc(db, 'items', currentItem.id);
                    const updateData = { 
                        effects: newEffectsArray,
                        structured_effects: null, 
                        effectsInputMode: null,
                        manualEffectsString: null 
                    };
                    
                    await updateDoc(docRef, updateData);
                    
                    statusMessage.textContent = 'アイテムの効果を更新しました。';
                    statusMessage.className = 'status-message success';
                    logToUI(DOMR.itemEffectRestoreLog, `アイテム「${currentItem.name}」の効果を更新しました。`, "success");
                    itemDiv.style.backgroundColor = '#d4edda'; 
                    itemDiv.querySelectorAll('select, button').forEach(el => { if(el !== updateButton) el.disabled = true; });
                    updateButton.textContent = '更新完了';

                    const cacheIndex = currentItemsCache.findIndex(it => it.id === currentItem.id);
                    if (cacheIndex !== -1) {
                        currentItemsCache[cacheIndex].effects = newEffectsArray;
                        delete currentItemsCache[cacheIndex].structured_effects; 
                        delete currentItemsCache[cacheIndex].effectsInputMode;
                        delete currentItemsCache[cacheIndex].manualEffectsString;
                    }

                } catch (err) {
                    console.error("Item-EffectType Update error:", err);
                    statusMessage.textContent = `更新失敗: ${err.message}`;
                    statusMessage.className = 'status-message error';
                    logToUI(DOMR.itemEffectRestoreLog, `アイテム「${currentItem.name}」の効果更新失敗: ${err.message}`, "error");
                    updateButton.disabled = false;
                    updateButton.textContent = 'このアイテムの効果を更新';
                }
            });
            itemDiv.appendChild(updateButton);
        }
        DOMR.tasksContainerItemToEffectType.appendChild(itemDiv);
    });
}

// Initial load if user is already logged in
if (auth.currentUser) {
    loadInitialDataForCurrentStep().then(() => {
        renderItemEffectRestoreTasks(); // Render all items initially if data is loaded
    });
}
