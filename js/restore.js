// js/restore.js
import { auth, db } from '../firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { collection, getDocs, writeBatch, doc, updateDoc, query, where } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js"; // Removed unused addDoc, deleteDoc, serverTimestamp

const DOMR = {
    passwordPrompt: document.getElementById('password-prompt'),
    mainContent: document.getElementById('main-content'),
    loginButton: document.getElementById('loginButton'),
    logoutButton: document.getElementById('logoutButton'),
    adminEmailInput: document.getElementById('adminEmailInput'),
    adminPasswordInput: document.getElementById('adminPasswordInput'),
    passwordError: document.getElementById('passwordError'),
    backupFileInput: document.getElementById('backupFile'),
    
    // Step 1-4 elements are removed as per request. Only Step 5 related elements remain or are adapted.
    itemEffectRestoreSection: document.getElementById('itemEffectRestoreSection'),
    itemSearchInputForEffects: document.getElementById('itemSearchInputForEffects'),
    tasksContainerItemToEffectType: document.getElementById('tasksContainerItemToEffectType'),
    itemEffectRestoreLog: document.getElementById('itemEffectRestoreLog'),
};

let parsedBackupDataGlobal = null;
let currentItemsCache = []; // Cache for current items from DB
let currentEffectTypesCache = []; // Cache for current effect types from DB

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
        loadInitialDataForCurrentStep(); // Load data needed for the current step
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

    DOMR.tasksContainerItemToEffectType.innerHTML = '<p>アイテム名を入力して絞り込んでください。</p>';
    DOMR.itemEffectRestoreLog.innerHTML = 'ログはここに表示されます...';
    if (DOMR.itemSearchInputForEffects) DOMR.itemSearchInputForEffects.value = '';
}

function updateButtonStatesBasedOnLoginAndFile() {
    const isLoggedIn = auth.currentUser !== null;
    const fileSelectedAndParsed = DOMR.backupFileInput.files.length > 0 && parsedBackupDataGlobal !== null;
    // No specific buttons to enable/disable in this simplified version other than what's handled by login state
}

DOMR.backupFileInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (DOMR.itemEffectRestoreLog) DOMR.itemEffectRestoreLog.innerHTML = ''; // Clear log on new file
    if (file) {
        logToUI(DOMR.itemEffectRestoreLog, 'バックアップファイルが選択されました。解析中...');
        try {
            const backupString = await file.text();
            parsedBackupDataGlobal = JSON.parse(backupString);
            if (!parsedBackupDataGlobal.collections || !parsedBackupDataGlobal.collections.items || !parsedBackupDataGlobal.collections.effect_types) {
                parsedBackupDataGlobal = null; // Invalidate if essential parts are missing
                throw new Error("バックアップファイルの形式が正しくありません。'collections.items' または 'collections.effect_types' が見つかりません。");
            }
            logToUI(DOMR.itemEffectRestoreLog, "バックアップファイルの読み込みと解析に成功しました。", "success");
            loadInitialDataForCurrentStep(); // Reload DB data as backup context changed
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
    // Clear previous task display if file changes
    if (DOMR.tasksContainerItemToEffectType) DOMR.tasksContainerItemToEffectType.innerHTML = '<p>アイテム名を入力して絞り込んでください。</p>';
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
    if (!auth.currentUser) return; // Don't load if not logged in
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
    DOMR.itemSearchInputForEffects.addEventListener('input', handleItemSearchForEffects);
}

function handleItemSearchForEffects() {
    if (!parsedBackupDataGlobal) {
        DOMR.tasksContainerItemToEffectType.innerHTML = '<p>バックアップファイルを選択・読み込んでください。</p>';
        return;
    }
    if (currentItemsCache.length === 0 || currentEffectTypesCache.length === 0) {
        DOMR.tasksContainerItemToEffectType.innerHTML = '<p>データベースからアイテムまたは効果種類のデータが読み込まれていません。ページを再読み込みするか、管理者にお問い合わせください。</p>';
        return;
    }

    const searchTerm = DOMR.itemSearchInputForEffects.value.trim().toLowerCase();
    DOMR.tasksContainerItemToEffectType.innerHTML = ''; // Clear previous results

    if (!searchTerm) {
        DOMR.tasksContainerItemToEffectType.innerHTML = '<p>アイテム名を入力して絞り込んでください。</p>';
        return;
    }

    const oldItemsFromBackup = parsedBackupDataGlobal.collections.items;
    const oldEffectTypesFromBackup = parsedBackupDataGlobal.collections.effect_types;

    const filteredItems = currentItemsCache.filter(item => item.name && item.name.toLowerCase().includes(searchTerm));

    if (filteredItems.length === 0) {
        DOMR.tasksContainerItemToEffectType.innerHTML = `<p>アイテム名「${searchTerm}」に一致するアイテムは見つかりませんでした。</p>`;
        return;
    }
     if (filteredItems.length > 30) { // Limit display if too many results
        logToUI(DOMR.itemEffectRestoreLog, `検索結果が多すぎます (${filteredItems.length}件)。最初の30件のみ表示します。より具体的な名前で検索してください。`, "warning");
    }

    const itemsToDisplay = filteredItems.slice(0, 30).sort((a,b) => a.name.localeCompare(b.name, 'ja'));

    itemsToDisplay.forEach(currentItem => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'item-to-restore';

        const itemHeader = document.createElement('strong');
        itemHeader.className = 'item-name-header';
        itemHeader.textContent = `アイテム: ${currentItem.name} (現ID: ${currentItem.id.substring(0,5)}...)`;
        itemDiv.appendChild(itemHeader);

        const effectsListUl = document.createElement('ul');
        effectsListUl.className = 'effect-list';

        // Determine which effects array to use (new 'effects' or old 'structured_effects')
        let effectsToProcess = [];
        const oldItemDataFromBackup = oldItemsFromBackup.find(it => it.old_id_from_backup === currentItem.old_id_from_backup || it.name === currentItem.name); // Try to match by old_id or name

        if (currentItem.effects && Array.isArray(currentItem.effects)) {
            effectsToProcess = currentItem.effects;
        } else if (currentItem.structured_effects && Array.isArray(currentItem.structured_effects)) { // Fallback to old format in current DB
            effectsToProcess = currentItem.structured_effects.map(eff => ({
                type: "structured", // Convert to new format for processing
                effectTypeId: eff.type, // Old 'type' is the old effectTypeId
                value: eff.value,
                unit: eff.unit
            }));
        } else if (oldItemDataFromBackup) { // If current DB has no effects, try to get from backup
            if (oldItemDataFromBackup.effects && Array.isArray(oldItemDataFromBackup.effects)) {
                 effectsToProcess = oldItemDataFromBackup.effects;
            } else if (oldItemDataFromBackup.structured_effects && Array.isArray(oldItemDataFromBackup.structured_effects)){
                 effectsToProcess = oldItemDataFromBackup.structured_effects.map(eff => ({
                    type: "structured", effectTypeId: eff.type, value: eff.value, unit: eff.unit
                }));
            }
        }


        if (effectsToProcess.length === 0) {
            effectsListUl.innerHTML = '<li>このアイテムには効果が設定されていません。</li>';
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
                    const oldEffectTypeId = effect.effectTypeId; // This is an OLD EffectType ID
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
                    selector.dataset.effectIndex = index; // Store index for update

                    let optionsHtml = '<option value="">効果種類を選択解除</option>';
                    currentEffectTypesCache.sort((a,b) => a.name.localeCompare(b.name, 'ja')).forEach(currentET => {
                        const isRecommended = oldEffectTypeInfo && (currentET.name === oldEffectTypeInfo.name);
                        optionsHtml += `<option value="${currentET.id}" ${isRecommended ? 'selected' : ''}>${currentET.name} (現ID: ${currentET.id.substring(0,5)}...)</option>`;
                    });
                    selector.innerHTML = optionsHtml;
                    effectLi.appendChild(selector);
                } else {
                     effectLi.textContent = `不明な効果データ: ${JSON.stringify(effect).substring(0,50)}...`;
                }
                effectsListUl.appendChild(effectLi);
            });
        }
        itemDiv.appendChild(effectsListUl);

        if (effectsToProcess.some(e => e.type === "structured")) { // Only show update button if there are structured effects
            const updateButton = document.createElement('button');
            updateButton.textContent = 'このアイテムの効果を更新';
            updateButton.style.marginTop = '10px';
            updateButton.addEventListener('click', async () => {
                const newEffectsArray = [];
                let allSelectorsValid = true;

                itemDiv.querySelectorAll('ul.effect-list > li.effect-item').forEach(effectLiElement => {
                    const selector = effectLiElement.querySelector('select');
                    if (selector) { // This is a structured effect
                        const effectIndex = parseInt(selector.dataset.effectIndex, 10);
                        const originalEffectData = effectsToProcess[effectIndex]; // Get original value/unit
                        const newEffectTypeId = selector.value;

                        if (newEffectTypeId) { // Only add if a new type is selected
                            newEffectsArray.push({
                                type: "structured",
                                effectTypeId: newEffectTypeId, // NEW EffectType ID
                                value: originalEffectData.value,
                                unit: originalEffectData.unit
                            });
                        } else {
                            // User chose "効果種類を選択解除", so this effect is removed from structured
                        }
                    } else { // This is a manual effect, preserve it
                        const manualDisplayDiv = effectLiElement.querySelector('.manual-effect-display');
                        if (manualDisplayDiv) {
                            const originalManualEffect = effectsToProcess.find(eff => eff.type === "manual" && manualDisplayDiv.textContent.includes(eff.manualString));
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
                    // Ensure old fields are removed if they exist from previous versions
                    const updateData = { 
                        effects: newEffectsArray,
                        structured_effects: null, // Explicitly set to null or use deleteField if it was a direct field
                        effectsInputMode: null,
                        manualEffectsString: null
                    };
                    // For fields that might not exist, using deleteField is safer but requires them to be top-level
                    // Since structured_effects might be nested or part of an object, setting to null is often easier here.
                    // If firebase.firestore.FieldValue.delete() is available and desired:
                    // import { ..., deleteField } from "...firebase-firestore.js"
                    // updateData.structured_effects = deleteField(); 
                    
                    await updateDoc(docRef, updateData);
                    
                    statusMessage.textContent = 'アイテムの効果を更新しました。';
                    statusMessage.className = 'status-message success';
                    logToUI(DOMR.itemEffectRestoreLog, `アイテム「${currentItem.name}」の効果を更新しました。`, "success");
                    itemDiv.style.backgroundColor = '#d4edda'; 
                    itemDiv.querySelectorAll('select, button').forEach(el => el.disabled = true);
                    updateButton.textContent = '更新完了';

                    // Update local cache for the item
                    const cacheIndex = currentItemsCache.findIndex(it => it.id === currentItem.id);
                    if (cacheIndex !== -1) {
                        currentItemsCache[cacheIndex].effects = newEffectsArray;
                        delete currentItemsCache[cacheIndex].structured_effects; // Clean up old format from cache
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

// Initial load of data when user logs in (or file is selected while logged in)
// This is now more focused on what this specific tool page needs.
if (auth.currentUser) {
    loadInitialDataForCurrentStep();
}
