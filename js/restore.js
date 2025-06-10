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
    
    // Step 6 elements
    step6Section: document.getElementById('step6Section'),
    charBaseTypeSelectorForStep6: document.getElementById('charBaseTypeSelectorForStep6'),
    tasksContainerCharBaseToEffectType: document.getElementById('tasksContainerCharBaseToEffectType'),
    step6ExecutionLog: document.getElementById('step6ExecutionLog'),
};

let parsedBackupDataGlobal = null;
let currentEffectTypesCache = []; // Cache for current effect types from DB
// Cache for character_bases will be structured like: { headShape: [...options], correction: [...options], ... }
let currentCharBasesCache = {}; 

const CHARACTER_BASE_TYPES_TO_PROCESS = ["headShape", "correction", "color", "pattern"];


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
    currentEffectTypesCache = [];
    currentCharBasesCache = {};

    DOMR.tasksContainerCharBaseToEffectType.innerHTML = '<p>まず、上のドロップダウンからキャラクター基礎情報の種類を選択してください。</p>';
    DOMR.step6ExecutionLog.innerHTML = 'ログはここに表示されます...';
    if (DOMR.charBaseTypeSelectorForStep6) DOMR.charBaseTypeSelectorForStep6.value = '';
}


DOMR.backupFileInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    const logArea = DOMR.step6ExecutionLog; // Use step 6 log for file parsing messages in this context
    if (logArea) logArea.innerHTML = ''; 
    
    if (file) {
        logToUI(logArea, 'バックアップファイルが選択されました。解析中...');
        try {
            const backupString = await file.text();
            parsedBackupDataGlobal = JSON.parse(backupString);
            if (!parsedBackupDataGlobal.collections || 
                !parsedBackupDataGlobal.collections.character_bases ||
                !parsedBackupDataGlobal.collections.effect_types) {
                parsedBackupDataGlobal = null; 
                throw new Error("バックアップファイルの形式が不完全です。'collections.character_bases' または 'collections.effect_types' が見つかりません。");
            }
            logToUI(logArea, "バックアップファイルの読み込みと解析に成功しました。", "success");
            await loadInitialDataForCurrentStep(); 
            // Do not render tasks immediately, wait for char base type selection
            if (DOMR.charBaseTypeSelectorForStep6.value) { // If a type is already selected, render for it
                renderCharBaseToEffectTypeTasks();
            } else {
                 DOMR.tasksContainerCharBaseToEffectType.innerHTML = '<p>キャラクター基礎情報の種類を選択してください。</p>';
            }
        } catch (e) {
            parsedBackupDataGlobal = null;
            logToUI(logArea, `バックアップファイルの読み込みエラー: ${e.message}`, "error");
            alert(`バックアップファイルの読み込みエラー: ${e.message}`);
        }
    } else {
        parsedBackupDataGlobal = null;
        logToUI(logArea, 'バックアップファイルが選択されていません。');
        DOMR.tasksContainerCharBaseToEffectType.innerHTML = '<p>まずバックアップファイルを選択してください。</p>';
    }
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
    const logArea = DOMR.step6ExecutionLog;
    logToUI(logArea, "現在のデータベースからキャラクター基礎情報と効果種類のデータを読み込み中...");
    try {
        const effectTypesSnapshot = await getDocs(collection(db, 'effect_types'));
        currentEffectTypesCache = effectTypesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        
        currentCharBasesCache = {};
        for (const baseType of CHARACTER_BASE_TYPES_TO_PROCESS) {
            const optionsSnapshot = await getDocs(collection(db, `character_bases/${baseType}/options`));
            currentCharBasesCache[baseType] = optionsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        }
        
        logToUI(logArea, `効果種類 ${currentEffectTypesCache.length}件、キャラクター基礎情報オプションを読み込みました。`, "success");
    } catch (error) {
        logToUI(logArea, `データ読み込みエラー: ${error.message}`, "error");
        console.error("Error loading initial data for charbase-effecttype restore:", error);
    }
}

// --- Step 6: Character Base Option to EffectType Relationship Restore ---
if (DOMR.charBaseTypeSelectorForStep6) {
    DOMR.charBaseTypeSelectorForStep6.addEventListener('change', renderCharBaseToEffectTypeTasks);
}

function renderCharBaseToEffectTypeTasks() {
    const selectedCharBaseType = DOMR.charBaseTypeSelectorForStep6.value;
    const logArea = DOMR.step6ExecutionLog;
    const tasksContainer = DOMR.tasksContainerCharBaseToEffectType;

    tasksContainer.innerHTML = ''; // Clear previous tasks

    if (!selectedCharBaseType) {
        tasksContainer.innerHTML = '<p>キャラクター基礎情報の種類を選択してください。</p>';
        return;
    }
    if (!parsedBackupDataGlobal) {
        tasksContainer.innerHTML = '<p>まず、バックアップファイルを選択・読み込んでください。</p>';
        return;
    }
    if (currentEffectTypesCache.length === 0 || !currentCharBasesCache[selectedCharBaseType]) {
        tasksContainer.innerHTML = '<p>データベースから効果種類または選択されたキャラクター基礎情報が読み込まれていません。</p>';
        if (auth.currentUser) { // Attempt reload if logged in but cache empty
            loadInitialDataForCurrentStep().then(() => renderCharBaseToEffectTypeTasks());
        }
        return;
    }

    logToUI(logArea, `キャラクター基礎情報「${selectedCharBaseType}」のオプションの処理を開始します...`);

    const currentOptionsForType = currentCharBasesCache[selectedCharBaseType].sort((a,b) => (a.name||"").localeCompare(b.name||"", 'ja'));
    const oldCharBaseOptionsFromBackup = parsedBackupDataGlobal.collections.character_bases[selectedCharBaseType] || [];
    const oldEffectTypesFromBackup = parsedBackupDataGlobal.collections.effect_types;

    if (currentOptionsForType.length === 0) {
        tasksContainer.innerHTML = `<p>選択された種類「${selectedCharBaseType}」のキャラクター基礎情報オプションが現在のDBに見つかりません。</p>`;
        return;
    }

    currentOptionsForType.forEach(currentOption => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'item-to-restore';

        const itemHeader = document.createElement('strong');
        itemHeader.className = 'item-name-header';
        itemHeader.textContent = `オプション: ${currentOption.name || '(名称未設定)'} (現ID: ${currentOption.id.substring(0,5)}...)`;
        itemDiv.appendChild(itemHeader);

        const effectsListUl = document.createElement('ul');
        effectsListUl.className = 'effect-list';

        // Get effects array: prefer current DB, fallback to backup if current is empty/malformed
        let effectsToProcess = [];
        const oldOptionDataFromBackup = oldCharBaseOptionsFromBackup.find(opt => 
             (opt.old_id_from_backup && opt.old_id_from_backup === currentOption.old_id_from_backup) || // if old_id was stored
             (opt.name === currentOption.name) // fallback to name
        );

        if (currentOption.effects && Array.isArray(currentOption.effects)) {
            effectsToProcess = currentOption.effects;
        } else if (oldOptionDataFromBackup && oldOptionDataFromBackup.effects && Array.isArray(oldOptionDataFromBackup.effects)) {
            // If current DB option has no 'effects', use the ones from backup (these will have old effect type IDs)
            effectsToProcess = oldOptionDataFromBackup.effects;
            logToUI(logArea, `オプション「${currentOption.name}」の現在の効果データがDBにないため、バックアップの効果データを使用します。`, 'warning');
        }


        if (effectsToProcess.length === 0) {
            effectsListUl.innerHTML = '<li>このオプションには修復対象の効果が設定されていません。</li>';
        } else {
            effectsToProcess.forEach((effect, index) => {
                const effectLi = document.createElement('li');
                effectLi.className = 'effect-item';

                // In character_bases, effects are always structured, 'type' field holds the oldEffectTypeId
                const oldEffectTypeId = effect.type; 
                if (!oldEffectTypeId) {
                    effectLi.innerHTML = `効果データ形式エラー: <code>type</code> (旧効果種類ID) がありません。`;
                    effectsListUl.appendChild(effectLi);
                    return; // Skip this malformed effect
                }

                const oldEffectTypeInfo = oldEffectTypesFromBackup.find(et => et.id === oldEffectTypeId);
                const oldEffectTypeName = oldEffectTypeInfo ? oldEffectTypeInfo.name : `不明旧効果ID:${oldEffectTypeId.substring(0,5)}`;
                const effectValueUnit = `${effect.value !== undefined ? effect.value : ''}${effect.unit && effect.unit !== "none" ? effect.unit : ''}`;

                const infoDiv = document.createElement('div');
                infoDiv.className = 'item-info';
                infoDiv.innerHTML = `元効果: <span class="old-value">${oldEffectTypeName} ${effectValueUnit}</span> (旧ID: ${oldEffectTypeId.substring(0,5)})`;
                effectLi.appendChild(infoDiv);

                const selectorLabel = document.createElement('label');
                selectorLabel.htmlFor = `cb-efftype-sel-${currentOption.id}-${index}`;
                selectorLabel.textContent = '新しい効果種類を選択:';
                effectLi.appendChild(selectorLabel);

                const selector = document.createElement('select');
                selector.id = `cb-efftype-sel-${currentOption.id}-${index}`;
                selector.dataset.effectIndex = index; 

                let optionsHtml = '<option value="">効果種類を選択解除 (この効果を削除)</option>';
                currentEffectTypesCache.sort((a,b) => (a.name||"").localeCompare(b.name||"", 'ja')).forEach(currentET => {
                    const isRecommended = oldEffectTypeInfo && (currentET.name === oldEffectTypeInfo.name);
                    optionsHtml += `<option value="${currentET.id}" ${isRecommended ? 'selected' : ''}>${currentET.name} (現ID: ${currentET.id.substring(0,5)}...)</option>`;
                });
                selector.innerHTML = optionsHtml;
                effectLi.appendChild(selector);
                effectsListUl.appendChild(effectLi);
            });
        }
        itemDiv.appendChild(effectsListUl);

        if (effectsToProcess.length > 0) { // Only show update button if there are effects to potentially update
            const updateButton = document.createElement('button');
            updateButton.textContent = 'このオプションの効果を更新';
            updateButton.style.marginTop = '10px';
            updateButton.addEventListener('click', async () => {
                const newEffectsForOption = [];
                
                itemDiv.querySelectorAll('ul.effect-list > li.effect-item').forEach(effectLiElement => {
                    const selector = effectLiElement.querySelector('select');
                    if (selector) { 
                        const effectIndex = parseInt(selector.dataset.effectIndex, 10);
                        const originalEffectData = effectsToProcess[effectIndex]; 
                        const newEffectTypeId = selector.value;

                        if (newEffectTypeId && originalEffectData) { 
                            newEffectsForOption.push({
                                type: newEffectTypeId, // Store the NEW EffectType ID here
                                value: originalEffectData.value,
                                unit: originalEffectData.unit 
                            });
                        }
                        // If newEffectTypeId is empty, this effect is effectively removed.
                    }
                });
                
                if (!confirm(`オプション「${currentOption.name}」の効果を更新しますか？ ${newEffectsForOption.length} 件の効果が保存されます。`)) {
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
                    const docRef = doc(db, `character_bases/${selectedCharBaseType}/options`, currentOption.id);
                    await updateDoc(docRef, { effects: newEffectsForOption });
                    
                    statusMessage.textContent = 'オプションの効果を更新しました。';
                    statusMessage.className = 'status-message success';
                    logToUI(logArea, `オプション「${currentOption.name}」の効果を更新しました。`, "success");
                    itemDiv.style.backgroundColor = '#d4edda'; 
                    itemDiv.querySelectorAll('select, button').forEach(el => { if(el !== updateButton) el.disabled = true; });
                    updateButton.textContent = '更新完了';

                    // Update local cache for this option
                    const cacheType = currentCharBasesCache[selectedCharBaseType];
                    if (cacheType) {
                        const cacheIndex = cacheType.findIndex(opt => opt.id === currentOption.id);
                        if (cacheIndex !== -1) {
                            cacheType[cacheIndex].effects = newEffectsForOption;
                        }
                    }
                } catch (err) {
                    console.error("CharBase-EffectType Update error:", err);
                    statusMessage.textContent = `更新失敗: ${err.message}`;
                    statusMessage.className = 'status-message error';
                    logToUI(logArea, `オプション「${currentOption.name}」の効果更新失敗: ${err.message}`, "error");
                    updateButton.disabled = false;
                    updateButton.textContent = 'このオプションの効果を更新';
                }
            });
            itemDiv.appendChild(updateButton);
        }
        tasksContainer.appendChild(itemDiv);
    });
}


// Initial load if user is already logged in
if (auth.currentUser) {
    loadInitialDataForCurrentStep();
}
