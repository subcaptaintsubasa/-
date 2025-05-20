// js/admin-modules/char-base-manager.js
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { openModal, closeModal, populateSelect } from './ui-helpers.js';

const DOMCB = {
    // charBaseTypeSelect: null, // プルダウンからボタンに変更
    charBaseTypeButtonsContainer: null, // ★★★ 追加: ボタンコンテナ ★★★
    selectedCharBaseTypeInput: null,   // ★★★ 追加: 選択された種類を保持する隠しフィールド ★★★
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
let refreshAllDataCallback = async () => {};

let currentCharBaseOptionEffects = [];

export function initCharBaseManager(dependencies) {
    dbInstance = dependencies.db;
    getCharacterBasesFuncCache = dependencies.getCharacterBases;
    getEffectTypesFuncCache = dependencies.getEffectTypes;
    getEffectUnitsFuncCache = dependencies.getEffectUnits;
    refreshAllDataCallback = dependencies.refreshAllData;

    DOMCB.charBaseTypeButtonsContainer = document.getElementById('charBaseTypeButtons'); // ★★★ 取得 ★★★
    DOMCB.selectedCharBaseTypeInput = document.getElementById('selectedCharBaseType'); // ★★★ 取得 ★★★
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

    // ★★★ ボタン生成とイベントリスナー設定 ★★★
    if (DOMCB.charBaseTypeButtonsContainer && DOMCB.selectedCharBaseTypeInput) {
        populateCharBaseTypeButtons(); // 初期ボタン生成
        DOMCB.charBaseTypeButtonsContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('category-select-button')) {
                const selectedType = e.target.dataset.baseType;
                if (selectedType) {
                    selectCharBaseTypeButton(selectedType);
                    _renderCharacterBaseOptionsInternal();
                }
            }
        });
    }


    if (DOMCB.addNewCharBaseOptionButton) {
        DOMCB.addNewCharBaseOptionButton.addEventListener('click', () => {
            const selectedType = DOMCB.selectedCharBaseTypeInput.value; // 隠しフィールドから取得
            openEditCharBaseOptionModal(null, selectedType);
        });
    }
    if (DOMCB.addCharBaseOptionEffectButton) {
        DOMCB.addCharBaseOptionEffectButton.addEventListener('click', addEffectToCharBaseOptionModalList);
    }
    if (DOMCB.saveCharBaseOptionButton) {
        DOMCB.saveCharBaseOptionButton.addEventListener('click', saveCharBaseOption);
    }
    if (DOMCB.deleteCharBaseOptionFromEditModalButton) {
        DOMCB.deleteCharBaseOptionFromEditModalButton.addEventListener('click', () => {
            const optionId = DOMCB.editingCharBaseOptionDocIdInput.value;
            const baseType = DOMCB.editingCharBaseTypeInput.value;
            const optionName = DOMCB.editingCharBaseOptionNameInput.value;
            if (optionId && baseType) {
                deleteCharBaseOption(optionId, baseType, optionName);
            } else {
                alert("削除対象のオプションIDまたは種類が見つかりません。");
            }
        });
    }
    if (DOMCB.charBaseOptionEffectTypeSelect) {
        DOMCB.charBaseOptionEffectTypeSelect.addEventListener('change', updateCharBaseOptionEffectUnitDisplay);
    }
    if (DOMCB.charBaseOptionListContainer) {
        DOMCB.charBaseOptionListContainer.addEventListener('click', handleCharBaseOptionListClick);
    }
    console.log("[CharBase Manager] Initialized.");
}

// ★★★ 基礎情報の種類選択ボタンを生成する関数 ★★★
function populateCharBaseTypeButtons() {
    if (!DOMCB.charBaseTypeButtonsContainer || !DOMCB.selectedCharBaseTypeInput) return;
    DOMCB.charBaseTypeButtonsContainer.innerHTML = '';
    const currentlySelectedType = DOMCB.selectedCharBaseTypeInput.value || 'headShape'; // デフォルト

    Object.entries(baseTypeMappings).forEach(([typeKey, typeName]) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.classList.add('category-select-button'); // カテゴリ選択ボタンのスタイルを流用
        button.textContent = typeName;
        button.dataset.baseType = typeKey;
        if (typeKey === currentlySelectedType) {
            button.classList.add('active');
        }
        DOMCB.charBaseTypeButtonsContainer.appendChild(button);
    });
}

// ★★★ 基礎情報の種類選択ボタンがクリックされたときの処理 ★★★
function selectCharBaseTypeButton(typeKey) {
    if (!DOMCB.charBaseTypeButtonsContainer || !DOMCB.selectedCharBaseTypeInput) return;
    DOMCB.charBaseTypeButtonsContainer.querySelectorAll('.category-select-button.active').forEach(btn => {
        btn.classList.remove('active');
    });
    const newActiveButton = DOMCB.charBaseTypeButtonsContainer.querySelector(`button[data-base-type="${typeKey}"]`);
    if (newActiveButton) {
        newActiveButton.classList.add('active');
    }
    DOMCB.selectedCharBaseTypeInput.value = typeKey;
    updateSelectedCharBaseTypeDisplay(typeKey); // 表示用テキストも更新
}


export function _populateCharBaseEffectTypeSelectInternal() {
    const effectTypesCache = getEffectTypesFuncCache();
    const options = effectTypesCache.map(et => ({
        value: et.id,
        text: et.name,
        'data-unit-name': et.defaultUnit || ''
    })).sort((a,b) => a.text.localeCompare(b.text, 'ja'));
    populateSelect(DOMCB.charBaseOptionEffectTypeSelect, options, '効果種類を選択...');
    console.log("[CharBase Manager] Effect type select in char base option modal populated.");
}


export function _renderCharacterBaseOptionsInternal() {
    // ★★★ 選択された種類を隠しフィールドから取得 ★★★
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
                const typeName = typeInfo ? typeInfo.name : `不明`;
                const unitName = typeInfo && typeInfo.defaultUnit ? typeInfo.defaultUnit : '';
                return `${typeName}: ${eff.value}${unitName ? unitName : ''}`;
            }).join('; ');
            if (effectsSummary.length > 45) effectsSummary = effectsSummary.substring(0, 42) + "...";
        }

        const div = document.createElement('div');
        div.classList.add('list-item');
        div.innerHTML = `
            <span class="list-item-name-clickable" data-id="${option.id}" data-type="${selectedTypeKey}" data-action="edit">${option.name} <small>(${effectsSummary})</small></span>
            <div class="list-item-actions">
            </div>
        `;
        DOMCB.charBaseOptionListContainer.appendChild(div);
    });
    console.log(`[CharBase Manager] Options for ${selectedTypeName} rendered.`);
}

function handleCharBaseOptionListClick(event) {
    const target = event.target;
    const clickableName = target.closest('.list-item-name-clickable[data-id]');
    if (clickableName && clickableName.dataset.action === 'edit') {
        openEditCharBaseOptionModalById(clickableName.dataset.id, clickableName.dataset.type);
    }
}


function openEditCharBaseOptionModalById(optionId, baseType) {
    const characterBasesCache = getCharacterBasesFuncCache();
    const optionData = (characterBasesCache[baseType] || []).find(opt => opt.id === optionId);
    if (!optionData && optionId) {
        alert("編集するキャラクター基礎情報オプションのデータが見つかりません。");
        return;
    }
    openEditCharBaseOptionModal(optionData, baseType);
}

function openEditCharBaseOptionModal(optionData, baseType) {
    if (!DOMCB.editingCharBaseTypeInput || !DOMCB.editCharBaseOptionModalTitle ||
        !DOMCB.editingCharBaseOptionDocIdInput || !DOMCB.editingCharBaseOptionNameInput ||
        !DOMCB.charBaseOptionEffectTypeSelect || !DOMCB.charBaseOptionEffectValueInput) {
        console.error("[CharBase Manager] One or more DOM elements for edit modal are missing.");
        return;
    }

    DOMCB.editingCharBaseTypeInput.value = baseType;
    const typeName = baseTypeMappings[baseType] || "基礎情報";
    DOMCB.editCharBaseOptionModalTitle.textContent = optionData ? `${typeName}オプション編集` : `${typeName}オプション新規追加`;

    DOMCB.editingCharBaseOptionDocIdInput.value = optionData ? optionData.id : '';
    DOMCB.editingCharBaseOptionNameInput.value = optionData ? optionData.name : '';

    currentCharBaseOptionEffects = optionData && Array.isArray(optionData.effects) ? JSON.parse(JSON.stringify(optionData.effects)) : [];

    renderCurrentCharBaseOptionEffectsListModal();
    _populateCharBaseEffectTypeSelectInternal();

    DOMCB.charBaseOptionEffectTypeSelect.value = '';
    DOMCB.charBaseOptionEffectValueInput.value = '';
    updateCharBaseOptionEffectUnitDisplay();

    openModal('editCharBaseOptionModal');
    DOMCB.editingCharBaseOptionNameInput.focus();
}

function updateCharBaseOptionEffectUnitDisplay() {
    if (!DOMCB.charBaseOptionEffectUnitDisplay || !DOMCB.charBaseOptionEffectTypeSelect) return;
    const selectedOptionEl = DOMCB.charBaseOptionEffectTypeSelect.options[DOMCB.charBaseOptionEffectTypeSelect.selectedIndex];
    const unitName = selectedOptionEl ? (selectedOptionEl.dataset.unitName || '') : '';
    DOMCB.charBaseOptionEffectUnitDisplay.textContent = unitName ? `(${unitName})` : '';
}


function addEffectToCharBaseOptionModalList() {
    if (!DOMCB.charBaseOptionEffectTypeSelect || !DOMCB.charBaseOptionEffectValueInput) return;
    const typeId = DOMCB.charBaseOptionEffectTypeSelect.value;
    const valueStr = DOMCB.charBaseOptionEffectValueInput.value;
    if (!typeId) { alert("効果種類を選択してください。"); return; }
    if (valueStr.trim() === '' || isNaN(parseFloat(valueStr))) { alert("効果の値を数値で入力してください。"); return; }

    const value = parseFloat(valueStr);
    const selectedEffectType = getEffectTypesFuncCache().find(et => et.id === typeId);
    const unitName = selectedEffectType ? (selectedEffectType.defaultUnit || '') : '';

    currentCharBaseOptionEffects.push({ type: typeId, value: value, unit: unitName });
    renderCurrentCharBaseOptionEffectsListModal();
    DOMCB.charBaseOptionEffectTypeSelect.value = '';
    DOMCB.charBaseOptionEffectValueInput.value = '';
    updateCharBaseOptionEffectUnitDisplay();
}

function renderCurrentCharBaseOptionEffectsListModal() {
    if (!DOMCB.currentCharBaseOptionEffectsList) return;
    DOMCB.currentCharBaseOptionEffectsList.innerHTML = '';
    const effectTypesCache = getEffectTypesFuncCache();

    if (currentCharBaseOptionEffects.length === 0) {
        DOMCB.currentCharBaseOptionEffectsList.innerHTML = '<p>効果が追加されていません。</p>'; return;
    }

    currentCharBaseOptionEffects.forEach((effect, index) => {
        const effectType = effectTypesCache.find(et => et.id === effect.type);
        const typeName = effectType ? effectType.name : '不明な効果';
        const unitText = effect.unit && effect.unit !== '' ? `${effect.unit}` : '';
        const div = document.createElement('div');
        div.classList.add('effect-list-item');
        div.innerHTML = `
            <span>${typeName}: ${effect.value}${unitText}</span>
            <button type="button" class="delete-effect-from-list action-button delete" data-index="${index}" title="この効果を削除">×</button>
        `;
        div.querySelector('.delete-effect-from-list').addEventListener('click', (e) => {
            currentCharBaseOptionEffects.splice(parseInt(e.currentTarget.dataset.index, 10), 1);
            renderCurrentCharBaseOptionEffectsListModal();
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

    const optionData = {
        name,
        effects: currentCharBaseOptionEffects,
        updatedAt: serverTimestamp()
    };
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
            closeModal('editCharBaseOptionModal');
            await refreshAllDataCallback();
        } catch (error) {
            console.error(`[CharBase Manager] Error deleting option for ${baseType}:`, error);
            alert("基礎情報オプションの削除に失敗しました。");
        }
    }
}

// ★★★ 選択された基礎情報の種類名を更新するヘルパー関数 (既存のものを流用) ★★★
function updateSelectedCharBaseTypeDisplay(baseTypeKey) {
    if (DOMCB.selectedCharBaseTypeDisplay) {
        DOMCB.selectedCharBaseTypeDisplay.textContent = baseTypeMappings[baseTypeKey] || "不明な種類";
    }
}
