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
    
    charBaseEffectRestoreSection: document.getElementById('charBaseEffectRestoreSection'),
    // itemSearchInputForEffects: document.getElementById('itemSearchInputForEffects'), // Removed, specific to item effects
    tasksContainerCharBaseToEffectType: document.getElementById('tasksContainerCharBaseToEffectType'),
    charBaseEffectRestoreLog: document.getElementById('charBaseEffectRestoreLog'),
};

// Character base types to process - should match your Firestore structure and backup
const CHARACTER_BASE_TYPES_TO_RESTORE = {
    headShape: "頭の形",
    correction: "補正",
    color: "色",
    pattern: "柄"
};

let parsedBackupDataGlobal = null;
let currentEffectTypesCache = []; // Cache for current effect types from DB
let currentCharBaseOptionsCache = {}; // Cache for current char base options { headShape: [...], correction: [...] }

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
        loadInitialDataForCharBaseStep(); 
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
    currentEffectTypesCache = [];
    currentCharBaseOptionsCache = {};
    updateButtonStatesBasedOnLoginAndFile();

    DOMR.tasksContainerCharBaseToEffectType.innerHTML = '<p>バックアップファイルを選択し、データが読み込まれると表示されます。</p>';
    DOMR.charBaseEffectRestoreLog.innerHTML = 'ログはここに表示されます...';
    // Clear any search inputs if they were part of a previous generic setup
    const searchInputs = document.querySelectorAll('.search-filter-input');
    searchInputs.forEach(input => input.value = '');
}

function updateButtonStatesBasedOnLoginAndFile() {
    // No specific buttons to enable/disable in this step, determined by login and data load.
}

DOMR.backupFileInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (DOMR.charBaseEffectRestoreLog) DOMR.charBaseEffectRestoreLog.innerHTML = '';
    if (file) {
        logToUI(DOMR.charBaseEffectRestoreLog, 'バックアップファイルが選択されました。解析中...');
        try {
            const backupString = await file.text();
            parsedBackupDataGlobal = JSON.parse(backupString);
            if (!parsedBackupDataGlobal.collections || 
                !parsedBackupDataGlobal.collections.character_bases ||
                !parsedBackupDataGlobal.collections.effect_types) {
                parsedBackupDataGlobal = null; 
                throw new Error("バックアップファイルの形式が正しくありません。'collections.character_bases' または 'collections.effect_types' が見つかりません。");
            }
            logToUI(DOMR.charBaseEffectRestoreLog, "バックアップファイルの読み込みと解析に成功しました。", "success");
            await loadInitialDataForCharBaseStep(); 
            renderCharBaseEffectRestoreTasks(); 
        } catch (e) {
            parsedBackupDataGlobal = null;
            logToUI(DOMR.charBaseEffectRestoreLog, `バックアップファイルの読み込みエラー: ${e.message}`, "error");
            alert(`バックアップファイルの読み込みエラー: ${e.message}`);
        }
    } else {
        parsedBackupDataGlobal = null;
        logToUI(DOMR.charBaseEffectRestoreLog, 'バックアップファイルが選択されていません。');
    }
    updateButtonStatesBasedOnLoginAndFile();
    if (DOMR.tasksContainerCharBaseToEffectType) DOMR.tasksContainerCharBaseToEffectType.innerHTML = '<p>バックアップファイルを選択し、データが読み込まれると表示されます。</p>';
});


function logToUI(logAreaElement, message, type = 'info') {
    if (!logAreaElement) return;
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logAreaElement.appendChild(logEntry);
    logAreaElement.scrollTop = logAreaElement.scrollHeight;
}

async function loadInitialDataForCharBaseStep() {
    if (!auth.currentUser) return; 
    logToUI(DOMR.charBaseEffectRestoreLog, "現在のデータベースからキャラクター基礎情報と効果種類のデータを読み込み中...");
    currentCharBaseOptionsCache = {}; // Reset cache
    try {
        const effectTypesSnapshot = await getDocs(collection(db, 'effect_types'));
        currentEffectTypesCache = effectTypesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        logToUI(DOMR.charBaseEffectRestoreLog, `効果種類 ${currentEffectTypesCache.length}件を読み込みました。`);

        for (const typeKey of Object.keys(CHARACTER_BASE_TYPES_TO_RESTORE)) {
            const optionsSnapshot = await getDocs(collection(db, `character_bases/${typeKey}/options`));
            currentCharBaseOptionsCache[typeKey] = optionsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            logToUI(DOMR.charBaseEffectRestoreLog, `基礎情報 (${CHARACTER_BASE_TYPES_TO_RESTORE[typeKey]}): ${currentCharBaseOptionsCache[typeKey].length}件のオプションを読み込みました。`);
        }
        logToUI(DOMR.charBaseEffectRestoreLog, "キャラクター基礎情報データの読み込み完了。", "success");
    } catch (error) {
        logToUI(DOMR.charBaseEffectRestoreLog, `データ読み込みエラー: ${error.message}`, "error");
        console.error("Error loading initial data for char base effect restore:", error);
    }
}

// --- Character Base to EffectType Relationship Restore ---
function renderCharBaseEffectRestoreTasks() {
    if (!parsedBackupDataGlobal) {
        DOMR.tasksContainerCharBaseToEffectType.innerHTML = '<p>まず、バックアップファイルを選択・読み込んでください。</p>';
        return;
    }
    if (Object.keys(currentCharBaseOptionsCache).length === 0 || currentEffectTypesCache.length === 0) {
        DOMR.tasksContainerCharBaseToEffectType.innerHTML = '<p>データベースからキャラクター基礎情報または効果種類のデータが読み込まれていません。</p>';
        if (auth.currentUser && (Object.keys(currentCharBaseOptionsCache).length === 0 || currentEffectTypesCache.length === 0)) {
            logToUI(DOMR.charBaseEffectRestoreLog, "データキャッシュが空のため、再読み込みを試みます...", "warning");
            loadInitialDataForCharBaseStep().then(() => renderCharBaseEffectRestoreTasks());
            return; 
        }
        return;
    }

    DOMR.tasksContainerCharBaseToEffectType.innerHTML = ''; 
    const oldEffectTypesFromBackup = parsedBackupDataGlobal.collections.effect_types;
    const oldCharBaseDataFromBackup = parsedBackupDataGlobal.collections.character_bases;

    for (const charBaseTypeKey in CHARACTER_BASE_TYPES_TO_RESTORE) {
        const typeDisplayName = CHARACTER_BASE_TYPES_TO_RESTORE[charBaseTypeKey];
        const typeGroupDiv = document.createElement('div');
        typeGroupDiv.className = 'char-base-type-group';
        
        const typeHeader = document.createElement('h4');
        typeHeader.textContent = typeDisplayName;
        typeGroupDiv.appendChild(typeHeader);

        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = 'search-filter-input';
        searchInput.placeholder = `${typeDisplayName}オプション名で絞り込み...`;
        searchInput.dataset.baseTypeKey = charBaseTypeKey; // Store for filtering
        searchInput.addEventListener('input', (e) => filterAndRenderCharBaseOptions(e.target.dataset.baseTypeKey, e.target.value));
        typeGroupDiv.appendChild(searchInput);

        const optionsContainer = document.createElement('div');
        optionsContainer.id = `options-container-${charBaseTypeKey}`;
        typeGroupDiv.appendChild(optionsContainer);

        DOMR.tasksContainerCharBaseToEffectType.appendChild(typeGroupDiv);
        filterAndRenderCharBaseOptions(charBaseTypeKey, ''); // Initial render for this type
    }
}

function filterAndRenderCharBaseOptions(baseTypeKey, searchTerm) {
    const container = document.getElementById(`options-container-${baseTypeKey}`);
    if (!container) return;
    container.innerHTML = '';
    searchTerm = searchTerm.toLowerCase().trim();

    const oldEffectTypesFromBackup = parsedBackupDataGlobal.collections.effect_types;
    const oldCharBaseOptionsFromBackupForType = (parsedBackupDataGlobal.collections.character_bases[baseTypeKey] || []);

    let optionsToDisplay = (currentCharBaseOptionsCache[baseTypeKey] || []).sort((a,b) => (a.name||"").localeCompare(b.name||"", 'ja'));

    if (searchTerm) {
        optionsToDisplay = optionsToDisplay.filter(opt => opt.name && opt.name.toLowerCase().includes(searchTerm));
    }

    if (optionsToDisplay.length === 0) {
        container.innerHTML = `<p>表示する「${CHARACTER_BASE_TYPES_TO_RESTORE[baseTypeKey]}」オプションがありません${searchTerm ? ' (フィルタ結果)' : ''}。</p>`;
        return;
    }

    optionsToDisplay.forEach(currentOption => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'item-to-restore';

        const itemHeader = document.createElement('strong');
        itemHeader.className = 'item-name-header';
        itemHeader.textContent = `オプション: ${currentOption.name || '(名称未設定)'} (現ID: ${currentOption.id.substring(0,5)}...)`;
        itemDiv.appendChild(itemHeader);

        const effectsListUl = document.createElement('ul');
        effectsListUl.className = 'effect-list';

        let effectsToProcess = [];
        // Find corresponding old option data from backup to get old effect type IDs
        const oldOptionDataFromBackup = oldCharBaseOptionsFromBackupForType.find(opt => 
             (opt.old_id_from_backup && opt.old_id_from_backup === currentOption.old_id_from_backup) || 
             (opt.name === currentOption.name) // Fallback to name match
        );
        
        // The `effects` array in `currentOption` (from current DB) should hold the old effect type IDs
        // if the洗い替え step correctly preserved them.
        if (currentOption.effects && Array.isArray(currentOption.effects)) {
            effectsToProcess = currentOption.effects;
        } else if (oldOptionDataFromBackup && oldOptionDataFromBackup.effects && Array.isArray(oldOptionDataFromBackup.effects)) {
            // Fallback: if current DB option has no effects array, but backup did, use backup's structure.
            // This implies the effects array might have been lost or malformed during洗い替え for this specific option.
            effectsToProcess = oldOptionDataFromBackup.effects;
            logToUI(DOMR.charBaseEffectRestoreLog, `警告: ${baseTypeKey} オプション「${currentOption.name}」の現在の効果データが見つからないため、バックアップの効果構造を参照します。`, 'warning');
        }


        if (effectsToProcess.length === 0) {
            effectsListUl.innerHTML = '<li>このオプションには修復対象の効果が設定されていません。</li>';
        } else {
            effectsToProcess.forEach((effect, index) => {
                const effectLi = document.createElement('li');
                effectLi.className = 'effect-item';

                // In character_bases, effects are always structured and 'type' field holds the old_effect_type_id
                const oldEffectTypeId = effect.type; // This is an OLD EffectType ID
                if (!oldEffectTypeId) {
                     effectLi.textContent = `効果データに 'type' (旧効果種類ID) がありません: ${JSON.stringify(effect).substring(0,50)}...`;
                     effectsListUl.appendChild(effectLi);
                     return; // Skip this effect
                }

                const oldEffectTypeInfo = oldEffectTypesFromBackup.find(et => et.id === oldEffectTypeId);
                const oldEffectTypeName = oldEffectTypeInfo ? oldEffectTypeInfo.name : `不明旧効果ID:${oldEffectTypeId.substring(0,5)}`;
                
                const effectValueUnit = `${effect.value !== undefined ? effect.value : ''}${effect.unit && effect.unit !== "none" ? effect.unit : ''}`;

                const infoDiv = document.createElement('div');
                infoDiv.className = 'item-info';
                infoDiv.innerHTML = `元効果: <span class="old-value">${oldEffectTypeName} ${effectValueUnit}</span> (旧ID: ${oldEffectTypeId.substring(0,5)})`;
                effectLi.appendChild(infoDiv);

                const selectorLabel = document.createElement('label');
                selectorLabel.htmlFor = `efftype-sel-${baseTypeKey}-${currentOption.id}-${index}`;
                selectorLabel.textContent = '新しい効果種類を選択:';
                effectLi.appendChild(selectorLabel);

                const selector = document.createElement('select');
                selector.id = `efftype-sel-${baseTypeKey}-${currentOption.id}-${index}`;
                selector.dataset.effectIndex = index; 

                let optionsHtml = '<option value="">効果種類を選択解除</option>';
                currentEffectTypesCache.sort((a,b) => (a.name||"").localeCompare(b.name||"",'ja')).forEach(currentET => {
                    const isRecommended = oldEffectTypeInfo && (currentET.name === oldEffectTypeInfo.name);
                    optionsHtml += `<option value="${currentET.id}" ${isRecommended ? 'selected' : ''}>${currentET.name} (現ID: ${currentET.id.substring(0,5)}...)</option>`;
                });
                selector.innerHTML = optionsHtml;
                effectLi.appendChild(selector);
                effectsListUl.appendChild(effectLi);
            });
        }
        itemDiv.appendChild(effectsListUl);

        if (effectsToProcess.length > 0) { // Only show update button if there are effects
            const updateButton = document.createElement('button');
            updateButton.textContent = 'このオプションの効果を更新';
            updateButton.style.marginTop = '10px';
            updateButton.addEventListener('click', async () => {
                const newEffectsArrayForOption = [];
                
                itemDiv.querySelectorAll('ul.effect-list > li.effect-item').forEach(effectLiElement => {
                    const selector = effectLiElement.querySelector('select');
                    if (selector) { 
                        const effectIndex = parseInt(selector.dataset.effectIndex, 10);
                        const originalEffectData = effectsToProcess[effectIndex]; 
                        const newEffectTypeIdSelected = selector.value;

                        if (newEffectTypeIdSelected && originalEffectData) { 
                            newEffectsArrayForOption.push({
                                type: newEffectTypeIdSelected, // Store NEW EffectType ID in 'type' field
                                value: originalEffectData.value,
                                unit: originalEffectData.unit
                                // Any other fields from originalEffectData like 'name' (if it had one) should be preserved if needed
                            });
                        }
                    }
                });
                
                if (!confirm(`オプション「${currentOption.name}」(${CHARACTER_BASE_TYPES_TO_RESTORE[baseTypeKey]})の効果を更新しますか？ ${newEffectsArrayForOption.length} 件の効果が保存されます。`)) {
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
                    const docRef = doc(db, `character_bases/${baseTypeKey}/options`, currentOption.id);
                    await updateDoc(docRef, { effects: newEffectsArrayForOption });
                    
                    statusMessage.textContent = 'オプションの効果を更新しました。';
                    statusMessage.className = 'status-message success';
                    logToUI(DOMR.charBaseEffectRestoreLog, `オプション「${currentOption.name}」(${CHARACTER_BASE_TYPES_TO_RESTORE[baseTypeKey]}) の効果を更新しました。`, "success");
                    itemDiv.style.backgroundColor = '#d4edda'; 
                    itemDiv.querySelectorAll('select, button').forEach(el => { if(el !== updateButton) el.disabled = true; });
                    updateButton.textContent = '更新完了';

                    // Update local cache for the option
                    const cacheType = currentCharBaseOptionsCache[baseTypeKey];
                    if (cacheType) {
                        const cacheIndex = cacheType.findIndex(opt => opt.id === currentOption.id);
                        if (cacheIndex !== -1) {
                            cacheType[cacheIndex].effects = newEffectsArrayForOption;
                        }
                    }
                } catch (err) {
                    console.error("CharBase Option-EffectType Update error:", err);
                    statusMessage.textContent = `更新失敗: ${err.message}`;
                    statusMessage.className = 'status-message error';
                    logToUI(DOMR.charBaseEffectRestoreLog, `オプション「${currentOption.name}」(${CHARACTER_BASE_TYPES_TO_RESTORE[baseTypeKey]}) の効果更新失敗: ${err.message}`, "error");
                    updateButton.disabled = false;
                    updateButton.textContent = 'このオプションの効果を更新';
                }
            });
            itemDiv.appendChild(updateButton);
        }
        container.appendChild(itemDiv);
    });
}

// Initial load if user is already logged in
if (auth.currentUser) {
    loadInitialDataForCharBaseStep().then(() => {
        renderCharBaseEffectRestoreTasks(); 
    });
}
