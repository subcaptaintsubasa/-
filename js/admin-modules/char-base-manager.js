// js/admin-modules/char-base-manager.js
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { openModal, closeModal, populateSelect } from './ui-helpers.js';

const DOMCB = {
    charBaseTypeButtons: null,
    selectedCharBaseTypeInput: null,
    addNewCharBaseOptionButton: null,
    selectedCharBaseTypeDisplay: null,
    charBaseOptionListContainer: null,
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

export const baseTypeMappings = {
    headShape: "頭の形",
    correction: "補正",
    color: "色",
    pattern: "柄"
};

let dbInstance = null;
let getCharacterBasesFuncCache = () => ({});
let getEffectTypesFuncCache = () => [];
let getEffectUnitsFuncCache = () => [];
let getEffectSuperCategoriesFuncCache = () => [];
let refreshAllDataCallback = async () => {};

let currentCharBaseOptionEffects = [];
let charBaseEffectEditMode = false;
let charBaseEffectEditingIndex = -1;

export function initCharBaseManager(dependencies) {
    dbInstance = dependencies.db;
    getCharacterBasesFuncCache = dependencies.getCharacterBases;
    getEffectTypesFuncCache = dependencies.getEffectTypes;
    getEffectUnitsFuncCache = dependencies.getEffectUnits;
    getEffectSuperCategoriesFuncCache = dependencies.getEffectSuperCategories;
    refreshAllDataCallback = dependencies.refreshAllData;

    DOMCB.charBaseTypeButtons = document.getElementById('charBaseTypeButtons');
    DOMCB.selectedCharBaseTypeInput = document.getElementById('selectedCharBaseType');
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
    DOMCB.deleteCharBaseOptionFromEditModalButton = document.getElementById('deleteCharBaseOptionFromEditModalButton');


    if (DOMCB.addNewCharBaseOptionButton) {
        DOMCB.addNewCharBaseOptionButton.addEventListener('click', () => {
            const selectedType = DOMCB.selectedCharBaseTypeInput.value;
            openEditCharBaseOptionModal(null, selectedType);
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
                deleteCharBaseOption(optionId, baseType, optionName);
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
    console.log("[CharBase Manager] Initialized.");
}

function switchToAddCharBaseEffectMode() {
    charBaseEffectEditMode = false;
    charBaseEffectEditingIndex = -1;
    if (DOMCB.addCharBaseOptionEffectButton) DOMCB.addCharBaseOptionEffectButton.textContent = '効果を追加';
    if (DOMCB.charBaseOptionEffectTypeSelect) DOMCB.charBaseOptionEffectTypeSelect.value = '';
    if (DOMCB.charBaseOptionEffectValueInput) DOMCB.charBaseOptionEffectValueInput.value = '';
    updateCharBaseOptionEffectUnitDisplay();
}


export function _populateCharBaseEffectTypeSelectInternal() {
    const effectTypesCache = getEffectTypesFuncCache();
    const superCategoriesCache = getEffectSuperCategoriesFuncCache();
    const selectElement = DOMCB.charBaseOptionEffectTypeSelect;

    if (!selectElement || !effectTypesCache) {
        console.warn("Required elements or caches not found for populating char base effect type select (effectTypesCache).");
        if(selectElement) selectElement.innerHTML = '<option value="">効果種類読込エラー</option>';
        return;
    }
     if (!superCategoriesCache) { 
        console.warn("Super categories cache not available for populating char base effect type select. Displaying as flat list.");
        const optionsForCharBase = effectTypesCache.map(et => ({
            value: et.id,
            text: et.name,
            'data-unit-name': (et.defaultUnit && et.defaultUnit !== 'none') ? et.defaultUnit : '',
        })).sort((a, b) => a.text.localeCompare(b.text, 'ja'));
        populateSelect(selectElement, optionsForCharBase, '効果種類を選択...');
        return;
    }

    const currentValue = selectElement.value;
    selectElement.innerHTML = '<option value="">効果種類を選択...</option>';

    superCategoriesCache.sort((a, b) => a.name.localeCompare(b.name, 'ja'));

    superCategoriesCache.forEach(superCat => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = superCat.name;
        effectTypesCache
            .filter(et => et.superCategoryId === superCat.id)
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

    const characterBasesCache = getCharacterBasesFuncCache();
    const options = (characterBasesCache[selectedTypeKey] || []).sort((a,b) => a.name.localeCompare(b.name, 'ja'));
    const effectTypesCache = getEffectTypesFuncCache();
    const effectUnitsCache = getEffectUnitsFuncCache();

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
        nameSpan.dataset.type = selectedTypeKey;
        div.appendChild(nameSpan);
        
        DOMCB.charBaseOptionListContainer.appendChild(div);
    });
}

function openEditCharBaseOptionModalById(optionId, baseType) {
    const characterBasesCache = getCharacterBasesFuncCache();
    const optionData = (characterBasesCache[baseType] || []).find(opt => opt.id === optionId);
    if (!optionData && optionId) { alert("編集するデータが見つかりません。"); return; }
    openEditCharBaseOptionModal(optionData, baseType);
}

function openEditCharBaseOptionModal(optionData, baseType) {
    DOMCB.editingCharBaseTypeInput.value = baseType;
    const typeName = baseTypeMappings[baseType] || "基礎情報";
    DOMCB.editCharBaseOptionModalTitle.textContent = optionData ? `${typeName}オプション編集` : `${typeName}オプション新規追加`;

    DOMCB.editingCharBaseOptionDocIdInput.value = optionData ? optionData.id : '';
    DOMCB.editingCharBaseOptionNameInput.value = optionData ? optionData.name : '';
    currentCharBaseOptionEffects = optionData && Array.isArray(optionData.effects) ? JSON.parse(JSON.stringify(optionData.effects)) : [];

    switchToAddCharBaseEffectMode();
    renderCurrentCharBaseOptionEffectsListModal();

    if (DOMCB.charBaseOptionEffectTypeSelect.options.length <=1 || DOMCB.charBaseOptionEffectTypeSelect.options[0].value === "") {
        _populateCharBaseEffectTypeSelectInternal();
    }
    
    openModal('editCharBaseOptionModal');
    DOMCB.editingCharBaseOptionNameInput.focus();
}

function updateCharBaseOptionEffectUnitDisplay() {
    if (!DOMCB.charBaseOptionEffectUnitDisplay || !DOMCB.charBaseOptionEffectTypeSelect) return;
    const selectedOption = DOMCB.charBaseOptionEffectTypeSelect.options[DOMCB.charBaseOptionEffectTypeSelect.selectedIndex];
    const unitName = selectedOption ? selectedOption.dataset.unitName : null;
    DOMCB.charBaseOptionEffectUnitDisplay.textContent = (unitName && unitName !== '' && unitName !== 'none') ? `(${unitName})` : '';
}

function handleAddOrUpdateCharBaseEffect() {
    const typeId = DOMCB.charBaseOptionEffectTypeSelect.value;
    const valueStr = DOMCB.charBaseOptionEffectValueInput.value;
    if (!typeId) { alert("効果種類を選択してください。"); return; }
    if (valueStr.trim() === '' || isNaN(parseFloat(valueStr))) { alert("効果の値を数値で入力してください。"); return; }

    const value = parseFloat(valueStr);
    const selectedOption = DOMCB.charBaseOptionEffectTypeSelect.options[DOMCB.charBaseOptionEffectTypeSelect.selectedIndex];
    const unit = (selectedOption && selectedOption.dataset.unitName && selectedOption.dataset.unitName !== 'none') ? selectedOption.dataset.unitName : null;

    const newEffect = { type: typeId, value: value, unit: unit };

    if (charBaseEffectEditMode && charBaseEffectEditingIndex >= 0 && charBaseEffectEditingIndex < currentCharBaseOptionEffects.length) {
        currentCharBaseOptionEffects[charBaseEffectEditingIndex] = newEffect;
    } else {
        currentCharBaseOptionEffects.push(newEffect);
    }
    renderCurrentCharBaseOptionEffectsListModal();
    switchToAddCharBaseEffectMode();
}


function renderCurrentCharBaseOptionEffectsListModal() {
    if (!DOMCB.currentCharBaseOptionEffectsList) return;
    DOMCB.currentCharBaseOptionEffectsList.innerHTML = '';
    const effectTypesCache = getEffectTypesFuncCache();
    const effectUnitsCache = getEffectUnitsFuncCache();

    if (currentCharBaseOptionEffects.length === 0) {
        DOMCB.currentCharBaseOptionEffectsList.innerHTML = '<p>効果が追加されていません。</p>'; return;
    }

    currentCharBaseOptionEffects.forEach((effect, index) => {
        const effectType = effectTypesCache.find(et => et.id === effect.type);
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
                DOMCB.charBaseOptionEffectTypeSelect.value = effectToEdit.type;
                DOMCB.charBaseOptionEffectValueInput.value = effectToEdit.value;
                updateCharBaseOptionEffectUnitDisplay();

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
            if (charBaseEffectEditMode && charBaseEffectEditingIndex === deleteIndex) {
                switchToAddCharBaseEffectMode();
            }
        });
        DOMCB.currentCharBaseOptionEffectsList.appendChild(div);
    });
}

async function saveCharBaseOption() {
    const baseType = DOMCB.editingCharBaseTypeInput.value;
    const optionId = DOMCB.editingCharBaseOptionDocIdInput.value;
    const name = DOMCB.editingCharBaseOptionNameInput.value.trim();
    if (!baseType || !name) { alert("種類と名前は必須です。"); return; }

    const characterBasesCache = getCharacterBasesFuncCache();
    if ((characterBasesCache[baseType] || []).some(opt => opt.name.toLowerCase() === name.toLowerCase() && opt.id !== optionId)) {
        alert(`「${baseTypeMappings[baseType]}」に同じ名前の選択肢「${name}」が既に存在します。`); return;
    }

    const optionData = { name, effects: currentCharBaseOptionEffects, updatedAt: serverTimestamp() };
    const optionsCollectionRef = collection(dbInstance, `character_bases/${baseType}/options`);

    try {
        if (optionId) {
            await updateDoc(doc(optionsCollectionRef, optionId), optionData);
        } else {
            optionData.createdAt = serverTimestamp();
            await addDoc(optionsCollectionRef, optionData);
        }
        closeModal('editCharBaseOptionModal');
        await refreshAllDataCallback();
    } catch (error) {
        console.error(`[CharBase Manager] Error saving option for ${baseType}:`, error);
        alert("基礎情報オプションの保存に失敗しました。");
    }
}

async function deleteCharBaseOption(optionId, baseType, optionName) {
    if (confirm(`基礎情報「${baseTypeMappings[baseType]}」のオプション「${optionName}」を削除しますか？\nこの操作は元に戻せません。`)) {
        try {
            await deleteDoc(doc(dbInstance, `character_bases/${baseType}/options`, optionId));
            if (DOMCB.editCharBaseOptionModal.style.display !== 'none' && DOMCB.editingCharBaseOptionDocIdInput.value === optionId) {
                closeModal('editCharBaseOptionModal');
            }
            await refreshAllDataCallback();
        } catch (error) {
            console.error(`[CharBase Manager] Error deleting option for ${baseType}:`, error);
            alert("基礎情報オプションの削除に失敗しました。");
        }
    }
}
