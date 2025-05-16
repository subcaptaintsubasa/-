// js/admin-modules/char-base-manager.js
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { openModal, closeModal, populateSelect, clearForm } from './ui-helpers.js';

const DOMCB = { // DOM elements for Character Base Management
    charBaseTypeSelect: null,
    addNewCharBaseOptionButton: null,
    selectedCharBaseTypeDisplay: null,
    charBaseOptionListContainer: null,
    // Edit Modal Elements
    editCharBaseOptionModal: null,
    editCharBaseOptionModalTitle: null,
    editingCharBaseTypeInput: null, // Hidden input for base type (headShape, etc.)
    editingCharBaseOptionDocIdInput: null,
    editingCharBaseOptionNameInput: null,
    // Effect input area within the modal
    charBaseOptionEffectTypeSelect: null,
    charBaseOptionEffectValueInput: null,
    charBaseOptionEffectUnitDisplay: null,
    addCharBaseOptionEffectButton: null,
    currentCharBaseOptionEffectsList: null,
    saveCharBaseOptionButton: null,
};

export const baseTypeMappings = { // Export for use in other modules if needed (e.g. for display names)
    headShape: "頭の形",
    correction: "補正",
    color: "色",
    pattern: "柄"
};

let dbInstance = null;
let getCharacterBasesFuncCache = () => ({});
let getEffectTypesFuncCache = () => [];
let refreshAllDataCallback = async () => {};

// State for the edit modal's effect list
let currentCharBaseOptionEffects = []; // Array of { type: string, value: number, unit: string }

export function initCharBaseManager(dependencies) {
    dbInstance = dependencies.db;
    getCharacterBasesFuncCache = dependencies.getCharacterBases;
    getEffectTypesFuncCache = dependencies.getEffectTypes;
    refreshAllDataCallback = dependencies.refreshAllData;
    // setCurrentCharBaseOptionEffects = dependencies.setCurrentCharBaseOptionEffects; // Not needed if managed locally
    // getCurrentCharBaseOptionEffects = dependencies.getCurrentCharBaseOptionEffects; // Not needed if managed locally

    DOMCB.charBaseTypeSelect = document.getElementById('charBaseTypeSelect');
    DOMCB.addNewCharBaseOptionButton = document.getElementById('addNewCharBaseOptionButton');
    DOMCB.selectedCharBaseTypeDisplay = document.getElementById('selectedCharBaseTypeDisplay');
    DOMCB.charBaseOptionListContainer = document.getElementById('charBaseOptionListContainer');

    DOMCB.editCharBaseOptionModal = document.getElementById('editCharBaseOptionModal');
    DOMCB.editCharBaseOptionModalTitle = document.getElementById('editCharBaseOptionModalTitle');
    DOMCB.editingCharBaseTypeInput = document.getElementById('editingCharBaseType');
    DOMCB.editingCharBaseOptionDocIdInput = document.getElementById('editingCharBaseOptionDocId');
    DOMCB.editingCharBaseOptionNameInput = document.getElementById('editingCharBaseOptionName');

    DOMCB.charBaseOptionEffectTypeSelect = document.getElementById('charBaseOptionEffectTypeSelect');
    DOMCB.charBaseOptionEffectValueInput = document.getElementById('charBaseOptionEffectValueInput');
    DOMCB.charBaseOptionEffectUnitDisplay = document.getElementById('charBaseOptionEffectUnitDisplay');
    DOMCB.addCharBaseOptionEffectButton = document.getElementById('addCharBaseOptionEffectButton');
    DOMCB.currentCharBaseOptionEffectsList = document.getElementById('currentCharBaseOptionEffectsList');
    DOMCB.saveCharBaseOptionButton = document.getElementById('saveCharBaseOptionButton');

    if (DOMCB.charBaseTypeSelect) {
        DOMCB.charBaseTypeSelect.addEventListener('change', renderCharacterBaseOptions);
    }
    if (DOMCB.addNewCharBaseOptionButton) {
        DOMCB.addNewCharBaseOptionButton.addEventListener('click', () => {
            const selectedType = DOMCB.charBaseTypeSelect.value;
            openEditCharBaseOptionModal(null, selectedType); // null for new option
        });
    }
    if (DOMCB.addCharBaseOptionEffectButton) {
        DOMCB.addCharBaseOptionEffectButton.addEventListener('click', addEffectToCharBaseOptionModalList);
    }
    if (DOMCB.saveCharBaseOptionButton) {
        DOMCB.saveCharBaseOptionButton.addEventListener('click', saveCharBaseOption);
    }
    if (DOMCB.charBaseOptionEffectTypeSelect) {
        DOMCB.charBaseOptionEffectTypeSelect.addEventListener('change', updateCharBaseOptionEffectUnitDisplay);
    }

    renderCharacterBaseOptions(); // Initial render for default selected type
    _populateCharBaseEffectTypeSelectInternal(); // Populate effect type select in modal
}

function _populateCharBaseEffectTypeSelectInternal() {
    const effectTypesCache = getEffectTypesFuncCache();
    const options = effectTypesCache.map(et => ({ value: et.id, text: et.name }));
    populateSelect(DOMCB.charBaseOptionEffectTypeSelect, options, '効果種類を選択...');
}


function renderCharacterBaseOptions() {
    if (!DOMCB.charBaseTypeSelect || !DOMCB.charBaseOptionListContainer || !DOMCB.selectedCharBaseTypeDisplay) return;

    const selectedTypeKey = DOMCB.charBaseTypeSelect.value;
    const selectedTypeName = baseTypeMappings[selectedTypeKey] || "不明な種類";
    DOMCB.selectedCharBaseTypeDisplay.textContent = selectedTypeName;
    DOMCB.charBaseOptionListContainer.innerHTML = '';

    const characterBasesCache = getCharacterBasesFuncCache();
    const options = characterBasesCache[selectedTypeKey] || [];
    const effectTypesCache = getEffectTypesFuncCache();

    if (options.length === 0) {
        DOMCB.charBaseOptionListContainer.innerHTML = `<p>${selectedTypeName} の選択肢はまだ登録されていません。</p>`;
        return;
    }

    options.forEach(option => {
        let effectsSummary = '効果なし';
        if (option.effects && option.effects.length > 0) {
            effectsSummary = option.effects.map(eff => {
                const typeInfo = effectTypesCache.find(et => et.id === eff.type);
                const typeName = typeInfo ? typeInfo.name : `不明(${eff.type.substring(0, 6)}...)`;
                const unitText = (eff.unit && eff.unit !== 'none') ? eff.unit : '';
                return `${typeName}: ${eff.value}${unitText}`;
            }).join(', ');
            if (effectsSummary.length > 40) effectsSummary = effectsSummary.substring(0, 37) + "...";
        }

        const div = document.createElement('div');
        div.classList.add('list-item');
        div.innerHTML = `
            <span>${option.name} <small style="color:#555;">(${effectsSummary})</small></span>
            <div>
                <button class="edit-char-base-option action-button" data-id="${option.id}" data-type="${selectedTypeKey}" title="編集">✎</button>
                <button class="delete-char-base-option action-button delete" data-id="${option.id}" data-type="${selectedTypeKey}" data-name="${option.name}" title="削除">×</button>
            </div>
        `;
        DOMCB.charBaseOptionListContainer.appendChild(div);
    });

    DOMCB.charBaseOptionListContainer.querySelectorAll('.edit-char-base-option').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const optionId = e.currentTarget.dataset.id;
            const baseType = e.currentTarget.dataset.type;
            openEditCharBaseOptionModalById(optionId, baseType);
        });
    });
    DOMCB.charBaseOptionListContainer.querySelectorAll('.delete-char-base-option').forEach(btn => {
        btn.addEventListener('click', (e) => {
            deleteCharBaseOption(e.currentTarget.dataset.id, e.currentTarget.dataset.type, e.currentTarget.dataset.name);
        });
    });
}

function openEditCharBaseOptionModalById(optionId, baseType) {
    const characterBasesCache = getCharacterBasesFuncCache();
    const optionData = (characterBasesCache[baseType] || []).find(opt => opt.id === optionId);
    if (!optionData && optionId) { // optionId exists means we are editing
        alert("編集するデータが見つかりません。");
        return;
    }
    openEditCharBaseOptionModal(optionData, baseType); // optionData will be null for new
}


function openEditCharBaseOptionModal(optionData, baseType) { // optionData can be null for new
    DOMCB.editingCharBaseTypeInput.value = baseType;
    const typeName = baseTypeMappings[baseType] || "基礎情報";
    DOMCB.editCharBaseOptionModalTitle.textContent = optionData ? `${typeName}オプション編集` : `${typeName}オプション新規追加`;

    if (optionData) {
        DOMCB.editingCharBaseOptionDocIdInput.value = optionData.id;
        DOMCB.editingCharBaseOptionNameInput.value = optionData.name;
        // Deep clone effects to avoid modifying cache directly
        currentCharBaseOptionEffects = Array.isArray(optionData.effects) ? JSON.parse(JSON.stringify(optionData.effects)) : [];
    } else {
        DOMCB.editingCharBaseOptionDocIdInput.value = ''; // New option
        DOMCB.editingCharBaseOptionNameInput.value = '';
        currentCharBaseOptionEffects = [];
    }

    renderCurrentCharBaseOptionEffectsListModal();
    // Effect type select should already be populated by init
    if (DOMCB.charBaseOptionEffectTypeSelect.options.length > 0) DOMCB.charBaseOptionEffectTypeSelect.value = '';
    DOMCB.charBaseOptionEffectValueInput.value = '';
    updateCharBaseOptionEffectUnitDisplay(); // Clear or set based on (empty) selection

    openModal('editCharBaseOptionModal');
    DOMCB.editingCharBaseOptionNameInput.focus();
}

function updateCharBaseOptionEffectUnitDisplay() {
    if (!DOMCB.charBaseOptionEffectUnitDisplay || !DOMCB.charBaseOptionEffectTypeSelect) return;
    const selectedTypeId = DOMCB.charBaseOptionEffectTypeSelect.value;
    const effectTypesCache = getEffectTypesFuncCache();
    const selectedEffectType = effectTypesCache.find(et => et.id === selectedTypeId);

    if (selectedEffectType && selectedEffectType.defaultUnit && selectedEffectType.defaultUnit !== 'none') {
        DOMCB.charBaseOptionEffectUnitDisplay.textContent = `(${selectedEffectType.defaultUnit})`;
    } else {
        DOMCB.charBaseOptionEffectUnitDisplay.textContent = ''; // Empty or (単位なし)
    }
}


function addEffectToCharBaseOptionModalList() {
    const typeId = DOMCB.charBaseOptionEffectTypeSelect.value;
    const valueStr = DOMCB.charBaseOptionEffectValueInput.value;
    const effectTypesCache = getEffectTypesFuncCache();

    if (!typeId) { alert("効果種類を選択してください。"); return; }
    if (valueStr.trim() === '' || isNaN(parseFloat(valueStr))) {
        alert("効果の値を数値で入力してください。"); return;
    }
    const value = parseFloat(valueStr);
    const selectedEffectType = effectTypesCache.find(et => et.id === typeId);
    const unit = selectedEffectType ? (selectedEffectType.defaultUnit || 'none') : 'none';

    currentCharBaseOptionEffects.push({ type: typeId, value: value, unit: unit });
    renderCurrentCharBaseOptionEffectsListModal();

    // Reset input fields for next effect
    DOMCB.charBaseOptionEffectTypeSelect.value = '';
    DOMCB.charBaseOptionEffectValueInput.value = '';
    updateCharBaseOptionEffectUnitDisplay(); // Clear unit display
}

function renderCurrentCharBaseOptionEffectsListModal() {
    if (!DOMCB.currentCharBaseOptionEffectsList) return;
    DOMCB.currentCharBaseOptionEffectsList.innerHTML = '';
    const effectTypesCache = getEffectTypesFuncCache();

    if (currentCharBaseOptionEffects.length === 0) {
        DOMCB.currentCharBaseOptionEffectsList.innerHTML = '<p>効果が追加されていません。</p>';
        return;
    }

    currentCharBaseOptionEffects.forEach((effect, index) => {
        const effectType = effectTypesCache.find(et => et.id === effect.type);
        const typeName = effectType ? effectType.name : '不明な効果';
        const unitText = effect.unit && effect.unit !== 'none' ? `(${effect.unit})` : '';
        const div = document.createElement('div');
        div.classList.add('effect-list-item'); // From admin-lists.css
        div.innerHTML = `
            <span>${typeName}: ${effect.value}${unitText}</span>
            <button type="button" class="delete-effect-from-list action-button delete" data-index="${index}" title="この効果を削除">×</button>
        `;
        DOMCB.currentCharBaseOptionEffectsList.appendChild(div);
    });

    // Add event listeners for delete buttons on effects
    DOMCB.currentCharBaseOptionEffectsList.querySelectorAll('.delete-effect-from-list').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const indexToRemove = parseInt(e.currentTarget.dataset.index, 10);
            currentCharBaseOptionEffects.splice(indexToRemove, 1);
            renderCurrentCharBaseOptionEffectsListModal(); // Re-render the list
        });
    });
}

async function saveCharBaseOption() {
    const baseType = DOMCB.editingCharBaseTypeInput.value;
    const optionId = DOMCB.editingCharBaseOptionDocIdInput.value; // Empty for new
    const name = DOMCB.editingCharBaseOptionNameInput.value.trim();
    // Effects are in currentCharBaseOptionEffects

    if (!baseType) { alert("基礎情報の種類が不明です。"); return; }
    if (!name) { alert("選択肢の名前を入力してください。"); return; }

    // Optional: Check for duplicate name within the same baseType if needed
    const characterBasesCache = getCharacterBasesFuncCache();
    if (characterBasesCache[baseType]?.some(opt => opt.name.toLowerCase() === name.toLowerCase() && opt.id !== optionId)) {
        alert(`「${baseTypeMappings[baseType]}」に同じ名前の選択肢「${name}」が既に存在します。`);
        return;
    }

    const optionData = {
        name: name,
        effects: currentCharBaseOptionEffects, // Already prepared array
        updatedAt: serverTimestamp()
    };
    const optionsCollectionRef = collection(dbInstance, `character_bases/${baseType}/options`);

    try {
        if (optionId) { // Editing existing
            await updateDoc(doc(optionsCollectionRef, optionId), optionData);
        } else { // Adding new
            optionData.createdAt = serverTimestamp();
            await addDoc(optionsCollectionRef, optionData);
        }
        closeModal('editCharBaseOptionModal');
        await refreshAllDataCallback(); // Reload all data, which will re-render the list
    } catch (error) {
        console.error(`[Character Base Option Save - ${baseType}] Error:`, error);
        alert("基礎情報オプションの保存に失敗しました。");
    }
}

async function deleteCharBaseOption(optionId, baseType, optionName) {
    if (confirm(`基礎情報「${baseTypeMappings[baseType]}」のオプション「${optionName}」を削除しますか？`)) {
        try {
            await deleteDoc(doc(dbInstance, `character_bases/${baseType}/options`, optionId));
            await refreshAllDataCallback();
        } catch (error) {
            console.error(`[Character Base Option Delete - ${baseType}] Error:`, error);
            alert("基礎情報オプションの削除に失敗しました。");
        }
    }
}

export { renderCharacterBaseOptions as _renderCharacterBaseOptionsInternal, _populateCharBaseEffectTypeSelectInternal };
