// js/modules/simulator-ui.js
// Handles UI updates and interactions for the equipment simulator modal.
// data-loaderから getEffectUnitsCache をインポート
import { getEffectUnitsCache as getEffectUnitsCacheFromLoader } from './data-loader.js';


let getAllItemsFunc = () => [];
let getEffectTypesCacheFunc = () => [];
let getEffectUnitsCacheFunc = () => []; // ローカルのキャッシュ関数ポインタ
let getCharacterBasesCacheFunc = () => ({});
// getCharacterBaseOptionDataFunc is not directly used in this file after refactor,
// but kept if other parts of simulator-logic or elsewhere might need it via this module.
let getCharacterBaseOptionDataFunc = (baseType, optionId) => null;
let onSlotSelectStartCb = (slotName) => {};
let onSlotClearCb = (slotName) => {};


const DOMS = {
    simulatorModal: null,
    equipmentSlotsContainer: null,
    totalEffectsDisplay: null,
    charBaseSelects: {},
    imageExportArea: null,
    exportCharBase: null,
    exportSlots: null,
    exportEffects: null,
    previewImageButton: null,
    saveImageButton: null,
    resetSimulatorButton: null,
    imagePreviewModal: null,
    generatedImagePreview: null,
};

const equipmentSlotNames = ["服", "顔", "首", "腕", "背中", "足"];

let selectedEquipment = {};
let selectedCharacterBase = {
    headShape: null,
    correction: null,
    color: null,
    pattern: null
};

export function initSimulatorUI(db, dependencies) {
    getAllItemsFunc = dependencies.getAllItems;
    getEffectTypesCacheFunc = dependencies.getEffectTypesCache;
    getCharacterBasesCacheFunc = dependencies.getCharacterBasesCache;
    getCharacterBaseOptionDataFunc = dependencies.getCharacterBaseOptionData; // Kept for potential use
    onSlotSelectStartCb = dependencies.onSlotSelectStart;
    onSlotClearCb = dependencies.onSlotClear;
    getEffectUnitsCacheFunc = getEffectUnitsCacheFromLoader; // ★★★ data-loaderから取得 ★★★


    DOMS.simulatorModal = document.getElementById('simulatorModal');
    DOMS.equipmentSlotsContainer = document.querySelector('.equipment-slots');
    DOMS.totalEffectsDisplay = document.getElementById('totalEffectsDisplay');

    const baseTypes = ["headShape", "correction", "color", "pattern"];
    baseTypes.forEach(type => {
        const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1);
        DOMS.charBaseSelects[type] = document.getElementById(`charBase${capitalizedType}`);
    });

    DOMS.imageExportArea = document.getElementById('imageExportArea');
    DOMS.exportCharBase = document.getElementById('exportCharBase');
    DOMS.exportSlots = document.getElementById('exportSlots');
    DOMS.exportEffects = document.getElementById('exportEffects');
    DOMS.previewImageButton = document.getElementById('previewImageButton');
    DOMS.saveImageButton = document.getElementById('saveImageButton');
    DOMS.resetSimulatorButton = document.getElementById('resetSimulatorButton');
    DOMS.imagePreviewModal = document.getElementById('imagePreviewModal');
    DOMS.generatedImagePreview = document.getElementById('generatedImagePreview');


    if (DOMS.equipmentSlotsContainer) {
        DOMS.equipmentSlotsContainer.querySelectorAll('.slot').forEach(slotElement => {
            const slotName = slotElement.dataset.slotName;
            if (!slotName) return;
            selectedEquipment[slotName] = null;
            const selectButton = slotElement.querySelector('.select-item-button');
            const clearButton = slotElement.querySelector('.clear-item-button');
            if (selectButton) {
                selectButton.addEventListener('click', () => {
                    if (onSlotSelectStartCb) onSlotSelectStartCb(slotName);
                });
            }
            if (clearButton) {
                clearButton.addEventListener('click', () => {
                    if (onSlotClearCb) onSlotClearCb(slotName);
                });
            }
        });
    }

    populateCharacterBaseSelectors();
    Object.values(DOMS.charBaseSelects).forEach(selectEl => {
        if (selectEl) {
            selectEl.addEventListener('change', (event) => {
                const baseType = event.target.dataset.baseType;
                const selectedOptionId = event.target.value;
                document.dispatchEvent(new CustomEvent('charBaseChange', {detail: {baseType, selectedOptionId}}));
            });
        }
    });

    if (DOMS.resetSimulatorButton) {
        DOMS.resetSimulatorButton.addEventListener('click', () => {
            equipmentSlotNames.forEach(slotName => selectedEquipment[slotName] = null);
            selectedCharacterBase = { headShape: null, correction: null, color: null, pattern: null };
            initializeSimulatorDisplay();
        });
    }
}

export function initializeSimulatorDisplay() {
    equipmentSlotNames.forEach(slotName => {
        updateSimulatorSlotDisplay(slotName);
    });
    const characterBasesCache = getCharacterBasesCacheFunc();
    Object.entries(DOMS.charBaseSelects).forEach(([baseType, selectEl]) => {
        if (selectEl) {
            if (selectEl.options.length <= 1 && characterBasesCache[baseType]?.length > 0) {
                 populateSingleCharacterBaseSelector(baseType, selectEl, characterBasesCache[baseType]);
            }
            if (selectedCharacterBase[baseType] && selectedCharacterBase[baseType].id) {
                selectEl.value = selectedCharacterBase[baseType].id;
            } else {
                selectEl.value = "";
            }
        }
    });
    calculateAndDisplayTotalEffects();
}

function populateCharacterBaseSelectors() {
    const characterBasesCache = getCharacterBasesCacheFunc();
    Object.entries(DOMS.charBaseSelects).forEach(([baseType, selectElement]) => {
        populateSingleCharacterBaseSelector(baseType, selectElement, characterBasesCache[baseType]);
    });
}

function populateSingleCharacterBaseSelector(baseType, selectElement, options) {
    if (!selectElement) return;
    selectElement.innerHTML = '<option value="">選択なし</option>';
    if (options && options.length > 0) {
        options.forEach(option => {
            const opt = document.createElement('option');
            opt.value = option.id;
            opt.textContent = option.name;
            selectElement.appendChild(opt);
        });
    } else {
        // console.warn(`No data found for character base type: ${baseType} to populate selector.`);
    }
}


export function updateSimulatorSlotDisplay(slotName) {
    const slotElement = document.getElementById(`slot-${slotName.replace(/\s/g, '')}`);
    if (!slotElement) {
        console.error(`Slot element for "${slotName}" not found.`);
        return;
    }
    const imgElement = slotElement.querySelector('.slot-image');
    const nameElement = slotElement.querySelector('.slot-item-name');
    const clearButton = slotElement.querySelector('.clear-item-button');
    const selectButton = slotElement.querySelector('.select-item-button');
    const itemId = selectedEquipment[slotName];
    const allItems = getAllItemsFunc();

    if (itemId) {
        const item = allItems.find(i => i.docId === itemId);
        if (item) {
            imgElement.src = item.image || './images/placeholder_item.png'; // Ensure this path is correct
            imgElement.alt = item.name || 'アイテム画像';
            nameElement.textContent = item.name || '(名称未設定)';
            if (clearButton) clearButton.style.display = 'inline-block';
            if (selectButton) selectButton.textContent = '変更';
        } else {
            imgElement.src = './images/placeholder_slot.png';
            imgElement.alt = slotName;
            nameElement.textContent = 'エラー(データ不整合)';
            if (clearButton) clearButton.style.display = 'none';
            if (selectButton) selectButton.textContent = '選択';
            // console.warn(`Item data for ID ${itemId} not found in slot ${slotName}.`); // Can be noisy
        }
    } else {
        imgElement.src = './images/placeholder_slot.png';
        imgElement.alt = slotName;
        nameElement.textContent = '未選択';
        if (clearButton) clearButton.style.display = 'none';
        if (selectButton) selectButton.textContent = '選択';
    }
}

export function calculateAndDisplayTotalEffects() {
    if (!DOMS.totalEffectsDisplay) return;

    const totalEffectsMap = new Map();
    const effectTypesCache = getEffectTypesCacheFunc();
    const effectUnitsCache = getEffectUnitsCacheFunc(); // ★★★ 追加 ★★★
    const allItems = getAllItemsFunc();

    Object.values(selectedCharacterBase).forEach(baseOption => {
        if (baseOption && baseOption.effects && Array.isArray(baseOption.effects)) {
            baseOption.effects.forEach(effect => {
                processEffect(effect, effectTypesCache, totalEffectsMap, effectUnitsCache); // ★★★ effectUnitsCache を渡す ★★★
            });
        }
    });

    Object.values(selectedEquipment).forEach(itemId => {
        if (!itemId) return;
        const item = allItems.find(i => i.docId === itemId);
        if (item && item.structured_effects && Array.isArray(item.structured_effects)) {
            item.structured_effects.forEach(effect => {
                processEffect(effect, effectTypesCache, totalEffectsMap, effectUnitsCache); // ★★★ effectUnitsCache を渡す ★★★
            });
        }
    });

    totalEffectsMap.forEach(effectData => {
        if (effectData.calculationMethod === 'max' && effectData.valuesForMax.length > 0) {
            effectData.value = Math.max(...effectData.valuesForMax);
        }
    });

    if (totalEffectsMap.size === 0) {
        DOMS.totalEffectsDisplay.innerHTML = '<p>効果はありません。</p>';
    } else {
        let html = '<ul>';
        totalEffectsMap.forEach(effData => {
            // ★★★ 表示文字列生成ロジックを修正 ★★★
            let effectValueText;
            const unitName = effData.unit;
            if (unitName && unitName !== 'none' && effectUnitsCache) {
                const unitInfo = effectUnitsCache.find(u => u.name === unitName);
                const position = unitInfo ? unitInfo.position : 'suffix';
                const displayValue = Math.round(effData.value * 1000) / 1000;

                if (position === 'prefix') {
                    effectValueText = `${unitName}${displayValue}`;
                } else {
                    effectValueText = `${displayValue}${unitName}`;
                }
            } else {
                effectValueText = `${Math.round(effData.value * 1000) / 1000}`;
            }
            html += `<li>${effData.typeName}: ${effectValueText}</li>`;
        });
        html += '</ul>';
        DOMS.totalEffectsDisplay.innerHTML = html;
    }
    if(DOMS.exportEffects) DOMS.exportEffects.innerHTML = DOMS.totalEffectsDisplay.innerHTML;
}

// ★★★ effectUnitsCache を引数に追加 ★★★
function processEffect(effect, effectTypesCache, totalEffectsMap, effectUnitsCache) {
    const { type: effectTypeId, value, unit } = effect;
    if (!effectTypeId || typeof value !== 'number') return;

    const effectTypeInfo = effectTypesCache.find(et => et.id === effectTypeId);
    if (!effectTypeInfo) {
        // console.warn(`Effect type info not found for ID: ${effectTypeId}`); // Can be noisy
        return;
    }

    const calculationMethod = effectTypeInfo.calculationMethod || 'sum';
    const sumCap = typeof effectTypeInfo.sumCap === 'number' ? effectTypeInfo.sumCap : Infinity;
    
    // ★★★ 単位名決定ロジックを修正 ★★★
    // structured_effects から来る unit はそのまま使う。
    // もし effect オブジェクトに unit がなければ、effectTypeInfo.defaultUnit を使う。
    const currentUnitName = unit || effectTypeInfo.defaultUnit || 'none';
    
    const effectKey = `${effectTypeId}_${currentUnitName}`;

    if (!totalEffectsMap.has(effectKey)) {
        totalEffectsMap.set(effectKey, {
            typeId: effectTypeId,
            typeName: effectTypeInfo.name,
            value: 0,
            unit: currentUnitName, // ★★★ 保存する単位名も修正 ★★★
            calculationMethod: calculationMethod,
            sumCap: sumCap,
            valuesForMax: []
        });
    }

    const currentEffectData = totalEffectsMap.get(effectKey);
    if (calculationMethod === 'max') {
        currentEffectData.valuesForMax.push(value);
    } else {
        currentEffectData.value += value;
        if (currentEffectData.value > currentEffectData.sumCap) {
            currentEffectData.value = currentEffectData.sumCap;
        }
    }
}

export const getSelectedEquipment = () => selectedEquipment;
export const updateSelectedEquipment = (slotName, itemId) => {
    if (selectedEquipment.hasOwnProperty(slotName)) {
        selectedEquipment[slotName] = itemId;
    }
};

export const getSelectedCharacterBase = () => selectedCharacterBase;
export const setSelectedCharacterBaseValue = (baseType, optionData) => {
    if (selectedCharacterBase.hasOwnProperty(baseType)) {
        selectedCharacterBase[baseType] = optionData;
    }
};

export const getSimulatorDOMS = () => DOMS;
