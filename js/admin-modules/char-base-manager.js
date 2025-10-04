// js/admin-modules/char-base-manager.js
import { collection, getDocs, addDoc, doc, updateDoc, query, orderBy, serverTimestamp, where } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js"; // deleteDoc removed
import { openModal, closeModal, populateSelect } from './ui-helpers.js';

const DOMCB = {
    charBaseTypeButtons: null,
    selectedCharBaseTypeInput: null,
    addNewCharBaseOptionButton: null,
    selectedCharBaseTypeDisplay: null,
    charBaseOptionListContainer: null,
    enlargeCharBaseOptionListButton: null, // Added for consistency
    editCharBaseOptionModal: null,
    editCharBaseOptionModalTitle: null,
    editingCharBaseTypeInput: null,
    editingCharBaseOptionDocIdInput: null,
    editingCharBaseOptionNameInput: null,
    charBaseOptionEffectTypeSelect: null,
    charBaseOptionEffectValueInput: null,
    charBaseOptionEffectUnitDisplay: null,
    addCharBaseOptionEffectButton: null,
    currentCharBaseOptionEffectsList: null,
    saveCharBaseOptionButton: null,
    deleteCharBaseOptionFromEditModalButton: null,
};

// baseTypeMappings should be passed from admin-main.js to ensure consistency
// For now, keep a local copy for standalone understanding, but prefer passed version.
export const baseTypeMappings = { // This might be redundant if admin-main passes it.
    headShape: "頭の形",
    correction: "補正",
    color: "色",
    pattern: "柄"
};

let dbInstance = null;
let getCharacterBasesFuncCache = () => ({}); // Returns { headShape: [...], color: [...] } all non-deleted
let getEffectTypesFuncCache = () => []; // Assumes non-deleted
let getEffectUnitsFuncCache = () => []; // Assumes non-deleted
let getEffectSuperCategoriesFuncCache = () => []; // Assumes non-deleted
let refreshAllDataCallback = async () => {};
let openEnlargedListModalCallbackFromMain = (config) => {};

let currentCharBaseOptionEffects = [];
let charBaseEffectEditMode = false;
let charBaseEffectEditingIndex = -1;

export function initCharBaseManager(dependencies) {
    dbInstance = dependencies.db;
    getCharacterBasesFuncCache = dependencies.getCharacterBases;
    getEffectTypesFuncCache = dependencies.getEffectTypes;
    getEffectUnitsFuncCache = dependencies.getEffectUnits;
    getEffectSuperCategoriesFuncCache = dependencies.getEffectSuperCategories; // For populating effect select
    refreshAllDataCallback = dependencies.refreshAllData;
    if (typeof dependencies.openEnlargedListModal === 'function') {
        openEnlargedListModalCallbackFromMain = dependencies.openEnlargedListModal;
    }
    // If baseTypeMappings is passed from admin-main.js, use that instead of the local one.
    // e.g., if (dependencies.baseTypeMappingsFromMain) baseTypeMappings = dependencies.baseTypeMappingsFromMain;


    DOMCB.charBaseTypeButtons = document.getElementById('charBaseTypeButtons');
    DOMCB.selectedCharBaseTypeInput = document.getElementById('selectedCharBaseType');
    DOMCB.addNewCharBaseOptionButton = document.getElementById('addNewCharBaseOptionButton');
    DOMCB.selectedCharBaseTypeDisplay = document.getElementById('selectedCharBaseTypeDisplay');
    DOMCB.charBaseOptionListContainer = document.getElementById('charBaseOptionListContainer');
    DOMCB.enlargeCharBaseOptionListButton = document.getElementById('enlargeCharBaseOptionListButton');


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
    DOMCB.deleteCharBaseOptionFromEditModalButton = document.getElementById('deleteCharBaseOptionFromEditModalButton');


    if (DOMCB.addNewCharBaseOptionButton) {
        DOMCB.addNewCharBaseOptionButton.addEventListener('click', () => {
            const selectedType = DOMCB.selectedCharBaseTypeInput.value;
            openEditCharBaseOptionModal(null, selectedType); // For new option
        });
    }
    if (DOMCB.addCharBaseOptionEffectButton) {
        DOMCB.addCharBaseOptionEffectButton.addEventListener('click', handleAddOrUpdateCharBaseEffect);
    }
    if (DOMCB.saveCharBaseOptionButton) {
        DOMCB.saveCharBaseOptionButton.addEventListener('click', saveCharBaseOption);
    }
    if (DOMCB.deleteCharBaseOptionFromEditModalButton) {
        DOMCB.deleteCharBaseOptionFromEditModalButton.addEventListener('click', () => {
            const optionId = DOMCB.editingCharBaseOptionDocIdInput.value;
            const baseType = DOMCB.editingCharBaseTypeInput.value;
            const optionName = DOMCB.editingCharBaseOptionNameInput.value || '(名称未設定)';
            if (optionId && baseType) {
                logicalDeleteCharBaseOption(optionId, baseType, optionName); // Changed to logicalDelete
            } else {
                alert("削除対象のオプションが見つかりません。");
            }
        });
    }

    if (DOMCB.charBaseOptionEffectTypeSelect) {
        DOMCB.charBaseOptionEffectTypeSelect.addEventListener('change', updateCharBaseOptionEffectUnitDisplay);
    }
    if(DOMCB.charBaseOptionListContainer) {
        DOMCB.charBaseOptionListContainer.addEventListener('click', (event) => {
            const clickableName = event.target.closest('.list-item-name-clickable[data-id]');
            if (clickableName) {
                const optionId = clickableName.dataset.id;
                const baseType = clickableName.dataset.type; 
                if (optionId && baseType) {
                    openEditCharBaseOptionModalById(optionId, baseType);
                }
            }
        });
    }
    if (DOMCB.enlargeCharBaseOptionListButton && DOMCB.selectedCharBaseTypeInput) {
        DOMCB.enlargeCharBaseOptionListButton.addEventListener('click', () => {
             if (typeof openEnlargedListModalCallbackFromMain === 'function') {
                const currentBaseTypeKey = DOMCB.selectedCharBaseTypeInput.value;
                openEnlargedListModalCallbackFromMain({
                    title: `${baseTypeMappings[currentBaseTypeKey] || '基礎情報'} の選択肢一覧 (拡大)`,
                    sourceFn: () => (getCharacterBasesFuncCache()[currentBaseTypeKey] || []),
                    itemType: 'charBaseOption',
                    editFunction: (id) => openEditCharBaseOptionModalById(id, currentBaseTypeKey),
                });
            }
        });
    }
    console.log("[CharBase Manager] Initialized for logical delete.");
}

function switchToAddCharBaseEffectMode() {
    charBaseEffectEditMode = false;
    charBaseEffectEditingIndex = -1;
    if (DOMCB.addCharBaseOptionEffectButton) DOMCB.addCharBaseOptionEffectButton.textContent = '効果を追加';
    if (DOMCB.charBaseOptionEffectTypeSelect) DOMCB.charBaseOptionEffectTypeSelect.value = '';
    if (DOMCB.charBaseOptionEffectValueInput) DOMCB.charBaseOptionEffectValueInput.value = '';
    updateCharBaseOptionEffectUnitDisplay();
}

// Populates the effect type select in the character base option's effect editing area
export function _populateCharBaseEffectTypeSelectInternal() {
    // This function is similar to the one in effect-type-manager.js for populating itemFormEffectTypeSelect
    // It should use non-deleted effect types and group them by non-deleted super categories.
    const effectTypesCache = getEffectTypesFuncCache(); // Assumes non-deleted
    const superCategoriesCache = getEffectSuperCategoriesFuncCache() || []; // Assumes non-deleted
    const selectElement = DOMCB.charBaseOptionEffectTypeSelect;

    if (!selectElement) {
        console.warn("_populateCharBaseEffectTypeSelectInternal: Select element not found.");
        return;
    }
    if (!effectTypesCache) {
        console.warn("Effect types cache not available for populating char base effect type select.");
        selectElement.innerHTML = '<option value="">効果種類読込エラー</option>';
        return;
    }

    const currentValue = selectElement.value;
    selectElement.innerHTML = '<option value="">効果種類を選択...</option>';

    const sortedSuperCats = [...superCategoriesCache].sort((a, b) => a.name.localeCompare(b.name, 'ja'));

    sortedSuperCats.forEach(superCat => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = superCat.name;
        effectTypesCache
            .filter(et => et.superCategoryId === superCat.id) // Already non-deleted
            .sort((a, b) => a.name.localeCompare(b.name, 'ja'))
            .forEach(et => {
                const option = document.createElement('option');
                option.value = et.id;
                option.textContent = et.name;
                option.dataset.unitName = (et.defaultUnit && et.defaultUnit !== 'none') ? et.defaultUnit : '';
                optgroup.appendChild(option);
            });
        if (optgroup.childElementCount > 0) {
            selectElement.appendChild(optgroup);
        }
    });

    const unclassifiedTypes = effectTypesCache
        .filter(et => !et.superCategoryId || !superCategoriesCache.some(sc => sc.id === et.superCategoryId))
        .sort((a, b) => a.name.localeCompare(b.name, 'ja'));

    if (unclassifiedTypes.length > 0) {
        const unclassifiedOptgroupLabel = (superCategoriesCache.length > 0) ? "未分類" : "効果種類";
        const unclassifiedOptgroup = document.createElement('optgroup');
        unclassifiedOptgroup.label = unclassifiedOptgroupLabel;
        unclassifiedTypes.forEach(et => {
            const option = document.createElement('option');
            option.value = et.id;
            option.textContent = et.name;
            option.dataset.unitName = (et.defaultUnit && et.defaultUnit !== 'none') ? et.defaultUnit : '';
            unclassifiedOptgroup.appendChild(option);
        });
        if (unclassifiedOptgroup.childElementCount > 0) {
             selectElement.appendChild(unclassifiedOptgroup);
        }
    }
    
    if (currentValue && Array.from(selectElement.options).some(opt => opt.value === currentValue)) {
        selectElement.value = currentValue;
    }
}


export function _renderCharacterBaseOptionsInternal() {
    if (!DOMCB.selectedCharBaseTypeInput || !DOMCB.charBaseOptionListContainer || !DOMCB.selectedCharBaseTypeDisplay) return;

    const selectedTypeKey = DOMCB.selectedCharBaseTypeInput.value;
    const selectedTypeName = baseTypeMappings[selectedTypeKey] || "不明な種類";
    DOMCB.selectedCharBaseTypeDisplay.textContent = selectedTypeName;
    DOMCB.charBaseOptionListContainer.innerHTML = '';

    const characterBasesCache = getCharacterBasesFuncCache(); // Assumes non-deleted options per type
    const optionsForSelectedType = (characterBasesCache[selectedTypeKey] || []).sort((a,b) => a.name.localeCompare(b.name, 'ja'));
    const effectTypesCache = getEffectTypesFuncCache(); // Assumes non-deleted
    const effectUnitsCache = getEffectUnitsFuncCache(); // Assumes non-deleted

    if (optionsForSelectedType.length === 0) {
        DOMCB.charBaseOptionListContainer.innerHTML = `<p>${selectedTypeName} の選択肢はまだ登録されていません。</p>`;
        return;
    }

    optionsForSelectedType.forEach(option => {
        // No need to check option.isDeleted as cache is pre-filtered
        let effectsSummary = '効果なし';
        if (option.effects && option.effects.length > 0) {
            effectsSummary = option.effects.map(eff => {
                const typeInfo = effectTypesCache.find(et => et.id === eff.type); // Char base effect stores effectTypeId as 'type'
                const typeName = typeInfo ? typeInfo.name : `不明(${eff.type ? eff.type.substring(0, 6) : 'IDなし'}...)`;
                
                let effectTextPart;
                const unitName = eff.unit;
                if (unitName && unitName !== 'none') {
                    const unitData = effectUnitsCache.find(u => u.name === unitName);
                    const position = unitData ? unitData.position : 'suffix';
                    if (position === 'prefix') {
                        effectTextPart = `${unitName}${eff.value}`;
                    } else {
                        effectTextPart = `${eff.value}${unitName}`;
                    }
                } else {
                    effectTextPart = `${eff.value}`;
                }
                return `${typeName} ${effectTextPart}`;
            }).join('; ');
            if (effectsSummary.length > 45) effectsSummary = effectsSummary.substring(0, 42) + "...";
        }

        const div = document.createElement('div');
        div.classList.add('list-item');
        
        const nameSpan = document.createElement('span');
        nameSpan.classList.add('list-item-name-clickable');
        nameSpan.innerHTML = `${option.name} <small>(${effectsSummary})</small>`;
        nameSpan.dataset.id = option.id;
        nameSpan.dataset.type = selectedTypeKey; // Pass the baseType for edit context
        div.appendChild(nameSpan);
        
        DOMCB.charBaseOptionListContainer.appendChild(div);
    });
}

export function openEditCharBaseOptionModalById(optionId, baseType) {
    const characterBasesCache = getCharacterBasesFuncCache();
    const optionsForBaseType = characterBasesCache[baseType] || [];
    const optionData = optionsForBaseType.find(opt => opt.id === optionId); // Assumes non-deleted
    
    if (!optionData && optionId) { // optionId implies we are editing, so data should exist
        alert("編集するデータが見つかりません。"); 
        return; 
    }
    openEditCharBaseOptionModal(optionData, baseType); // Pass null for new option
}

// Internal function to open modal, handles both new and edit
function openEditCharBaseOptionModal(optionData, baseType) { // optionData can be null for new
    DOMCB.editingCharBaseTypeInput.value = baseType;
    const typeName = baseTypeMappings[baseType] || "基礎情報";
    DOMCB.editCharBaseOptionModalTitle.textContent = optionData ? `${typeName}オプション編集` : `${typeName}オプション新規追加`;

    DOMCB.editingCharBaseOptionDocIdInput.value = optionData ? optionData.id : '';
    DOMCB.editingCharBaseOptionNameInput.value = optionData ? optionData.name : '';
    currentCharBaseOptionEffects = optionData && Array.isArray(optionData.effects) ? JSON.parse(JSON.stringify(optionData.effects)) : [];

    switchToAddCharBaseEffectMode(); // Reset effect input form
    renderCurrentCharBaseOptionEffectsListModal(); // Render current/empty effects

    // Ensure effect type select is populated
    if (DOMCB.charBaseOptionEffectTypeSelect.options.length <=1 || (DOMCB.charBaseOptionEffectTypeSelect.options[0] && DOMCB.charBaseOptionEffectTypeSelect.options[0].value === "")) {
        _populateCharBaseEffectTypeSelectInternal();
    }
    
    openModal('editCharBaseOptionModal');
    if(DOMCB.editingCharBaseOptionNameInput) DOMCB.editingCharBaseOptionNameInput.focus();
}

// updateCharBaseOptionEffectUnitDisplay remains the same
function updateCharBaseOptionEffectUnitDisplay() {
    if (!DOMCB.charBaseOptionEffectUnitDisplay || !DOMCB.charBaseOptionEffectTypeSelect) return;
    const selectedOption = DOMCB.charBaseOptionEffectTypeSelect.options[DOMCB.charBaseOptionEffectTypeSelect.selectedIndex];
    const unitName = selectedOption ? selectedOption.dataset.unitName : null;
    DOMCB.charBaseOptionEffectUnitDisplay.textContent = (unitName && unitName !== '' && unitName !== 'none') ? `(${unitName})` : '';
}

// handleAddOrUpdateCharBaseEffect remains the same
function handleAddOrUpdateCharBaseEffect() {
    const typeId = DOMCB.charBaseOptionEffectTypeSelect.value;
    const valueStr = DOMCB.charBaseOptionEffectValueInput.value;
    if (!typeId) { alert("効果種類を選択してください。"); return; }
    if (valueStr.trim() === '' || isNaN(parseFloat(valueStr))) { alert("効果の値を数値で入力してください。"); return; }

    const value = parseFloat(valueStr);
    const selectedOption = DOMCB.charBaseOptionEffectTypeSelect.options[DOMCB.charBaseOptionEffectTypeSelect.selectedIndex];
    const unit = (selectedOption && selectedOption.dataset.unitName && selectedOption.dataset.unitName !== 'none') ? selectedOption.dataset.unitName : null;

    const newEffect = { type: typeId, value: value, unit: unit }; // Note: 'type' here is effectTypeId

    if (charBaseEffectEditMode && charBaseEffectEditingIndex >= 0 && charBaseEffectEditingIndex < currentCharBaseOptionEffects.length) {
        currentCharBaseOptionEffects[charBaseEffectEditingIndex] = newEffect;
    } else {
        currentCharBaseOptionEffects.push(newEffect);
    }
    renderCurrentCharBaseOptionEffectsListModal();
    switchToAddCharBaseEffectMode(); // Reset form
}

// renderCurrentCharBaseOptionEffectsListModal remains the same
function renderCurrentCharBaseOptionEffectsListModal() {
    if (!DOMCB.currentCharBaseOptionEffectsList) return;
    DOMCB.currentCharBaseOptionEffectsList.innerHTML = '';
    const effectTypesCache = getEffectTypesFuncCache(); // Assumes non-deleted
    const effectUnitsCache = getEffectUnitsFuncCache(); // Assumes non-deleted

    if (currentCharBaseOptionEffects.length === 0) {
        DOMCB.currentCharBaseOptionEffectsList.innerHTML = '<p>効果が追加されていません。</p>'; return;
    }

    currentCharBaseOptionEffects.forEach((effect, index) => {
        const effectType = effectTypesCache.find(et => et.id === effect.type); // 'type' is effectTypeId
        const typeName = effectType ? effectType.name : '不明な効果';
        
        let effectText;
        const unitName = effect.unit;
        if (unitName && unitName !== 'none') {
            const unitData = effectUnitsCache.find(u => u.name === unitName);
            const position = unitData ? unitData.position : 'suffix';
            if (position === 'prefix') {
                effectText = `${unitName}${effect.value}`;
            } else {
                effectText = `${effect.value}${unitName}`;
            }
        } else {
            effectText = `${effect.value}`;
        }

        const div = document.createElement('div');
        div.classList.add('effect-list-item');
        div.innerHTML = `
            <span>${typeName} ${effectText}</span>
            <div>
                <button type="button" class="edit-charbase-effect-in-list action-button edit" data-index="${index}" title="この効果を編集">✎</button>
                <button type="button" class="delete-charbase-effect-from-list action-button delete" data-index="${index}" title="この効果を削除">×</button>
            </div>
        `;
        div.querySelector('.edit-charbase-effect-in-list').addEventListener('click', (e) => {
            const editIndex = parseInt(e.currentTarget.dataset.index, 10);
            const effectToEdit = currentCharBaseOptionEffects[editIndex];
            if (effectToEdit) {
                DOMCB.charBaseOptionEffectTypeSelect.value = effectToEdit.type; // 'type' is effectTypeId
                DOMCB.charBaseOptionEffectValueInput.value = effectToEdit.value;
                updateCharBaseOptionEffectUnitDisplay(); // Update unit based on selected effect type

                charBaseEffectEditMode = true;
                charBaseEffectEditingIndex = editIndex;
                if (DOMCB.addCharBaseOptionEffectButton) DOMCB.addCharBaseOptionEffectButton.textContent = '効果を更新';
                if (DOMCB.charBaseOptionEffectTypeSelect) DOMCB.charBaseOptionEffectTypeSelect.focus();
            }
        });
        div.querySelector('.delete-charbase-effect-from-list').addEventListener('click', (e) => {
            const deleteIndex = parseInt(e.currentTarget.dataset.index, 10);
            currentCharBaseOptionEffects.splice(deleteIndex, 1);
            renderCurrentCharBaseOptionEffectsListModal();
            if (charBaseEffectEditMode && charBaseEffectEditingIndex === deleteIndex) { // If deleted item was being edited
                switchToAddCharBaseEffectMode(); // Reset form
            }
        });
        DOMCB.currentCharBaseOptionEffectsList.appendChild(div);
    });
}


async function saveCharBaseOption() {
    const baseType = DOMCB.editingCharBaseTypeInput.value;
    const optionId = DOMCB.editingCharBaseOptionDocIdInput.value; // Empty if new
    const name = DOMCB.editingCharBaseOptionNameInput.value.trim();

    if (!baseType || !name) { alert("種類と名前は必須です。"); return; }

    const characterBasesCache = getCharacterBasesFuncCache(); // Assumes non-deleted options
    const optionsForBaseType = characterBasesCache[baseType] || [];
    // Check for duplicates among non-deleted options of the same baseType
    if (optionsForBaseType.some(opt => opt.name.toLowerCase() === name.toLowerCase() && opt.id !== optionId)) {
        alert(`「${baseTypeMappings[baseType]}」に同じ名前の選択肢「${name}」が既に存在します。`); return;
    }

    const optionData = { 
        name, 
        effects: currentCharBaseOptionEffects, 
        updatedAt: serverTimestamp() // Add/Update timestamp
    };
    // For new options, also set isDeleted and createdAt
    if (!optionId) {
        optionData.isDeleted = false;
        optionData.createdAt = serverTimestamp();
    }

    const optionsCollectionRef = collection(dbInstance, `character_bases/${baseType}/options`);

    try {
        if (optionId) { // Editing existing
            await updateDoc(doc(optionsCollectionRef, optionId), optionData);
        } else { // Adding new
            await addDoc(optionsCollectionRef, optionData);
        }
        closeModal('editCharBaseOptionModal');
    } catch (error) {
        console.error(`[CharBase Manager] Error saving option for ${baseType}:`, error);
        alert("基礎情報オプションの保存に失敗しました。");
    }
}

async function logicalDeleteCharBaseOption(optionId, baseType, optionName) {
    // Character base options are not typically referenced by other collections directly
    // in a way that would block deletion (unlike tags or categories).
    // If they were, add checks here.

    if (confirm(`基礎情報「${baseTypeMappings[baseType]}」のオプション「${optionName}」を論理削除しますか？\nこのオプションは一覧などには表示されなくなりますが、データは残ります。`)) {
        try {
            await updateDoc(doc(dbInstance, `character_bases/${baseType}/options`, optionId), {
                isDeleted: true,
                updatedAt: serverTimestamp() // Update timestamp
            });
            
            if (DOMCB.editCharBaseOptionModal.style.display !== 'none' && DOMCB.editingCharBaseOptionDocIdInput.value === optionId) {
                closeModal('editCharBaseOptionModal');
            }
        } catch (error) {
            console.error(`[CharBase Manager] Error logically deleting option for ${baseType}:`, error);
            alert("基礎情報オプションの論理削除に失敗しました。");
        }
    }
}
