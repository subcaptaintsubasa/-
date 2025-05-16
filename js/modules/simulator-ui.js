// js/modules/simulator-ui.js
// Handles UI updates and interactions for the equipment simulator modal.

// Dependencies (passed or imported)
let getAllItemsFunc = () => [];
let getEffectTypesCacheFunc = () => [];
let getCharacterBasesCacheFunc = () => [];
let getCharacterBaseOptionDataFunc = (baseType, optionId) => null;
let onSlotSelectStartCb = (slotName) => {};
let onSlotClearCb = (slotName) => {};
// onSelectionConfirmed is handled by search-filters via main script orchestration

const DOMS = { // DOM elements for Simulator UI
    simulatorModal: null,
    equipmentSlotsContainer: null,
    totalEffectsDisplay: null,
    // Character Base Selectors
    charBaseSelects: {}, // Populated in init: { headShape: el, correction: el, ... }
    // Image Export / Preview
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

const equipmentSlotNames = ["服", "顔", "首", "腕", "背中", "足"]; // Could be dynamic if needed

// Simulator State (managed within this module)
let selectedEquipment = {}; // { slotName: itemId, ... }
let selectedCharacterBase = { // { headShape: optionData, correction: optionData, ... }
    headShape: null,
    correction: null,
    color: null,
    pattern: null
};

export function initSimulatorUI(db, dependencies) { // db may not be needed if data is passed
    getAllItemsFunc = dependencies.getAllItems;
    getEffectTypesCacheFunc = dependencies.getEffectTypesCache;
    getCharacterBasesCacheFunc = dependencies.getCharacterBasesCache;
    getCharacterBaseOptionDataFunc = dependencies.getCharacterBaseOptionData;
    onSlotSelectStartCb = dependencies.onSlotSelectStart;
    // onSelectionConfirmed is handled by search-filters calling back to main, then to here.
    onSlotClearCb = dependencies.onSlotClear;


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


    // Initialize equipment slot UI and event listeners
    if (DOMS.equipmentSlotsContainer) {
        DOMS.equipmentSlotsContainer.querySelectorAll('.slot').forEach(slotElement => {
            const slotName = slotElement.dataset.slotName;
            if (!slotName) return;

            selectedEquipment[slotName] = null; // Initialize

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

    // Initialize character base selectors
    populateCharacterBaseSelectors(); // Needs characterBasesCache to be loaded
    Object.values(DOMS.charBaseSelects).forEach(selectEl => {
        if (selectEl) {
            selectEl.addEventListener('change', (event) => {
                 // This event is now handled by simulator-logic.js
                 // The event will be dispatched for simulator-logic to pick up.
                const baseType = event.target.dataset.baseType;
                const selectedOptionId = event.target.value;
                document.dispatchEvent(new CustomEvent('charBaseChange', {detail: {baseType, selectedOptionId}}));
            });
        }
    });


    // Reset simulator button
    if (DOMS.resetSimulatorButton) {
        DOMS.resetSimulatorButton.addEventListener('click', () => {
            equipmentSlotNames.forEach(slotName => selectedEquipment[slotName] = null);
            selectedCharacterBase = { headShape: null, correction: null, color: null, pattern: null };
            initializeSimulatorDisplay(); // Full UI reset
             console.log("Simulator reset.");
        });
    }

    // Image related buttons are handled by simulator-image.js
    // Event listeners for them will be set up there.
}

export function initializeSimulatorDisplay() {
    equipmentSlotNames.forEach(slotName => {
        updateSimulatorSlotDisplay(slotName);
    });

    const characterBasesCache = getCharacterBasesCacheFunc();
    Object.entries(DOMS.charBaseSelects).forEach(([baseType, selectEl]) => {
        if (selectEl) {
            // Ensure options are populated before setting value
            if (selectEl.options.length <= 1 && characterBasesCache[baseType]?.length > 0) {
                 populateSingleCharacterBaseSelector(baseType, selectEl, characterBasesCache[baseType]);
            }

            if (selectedCharacterBase[baseType] && selectedCharacterBase[baseType].id) {
                selectEl.value = selectedCharacterBase[baseType].id;
            } else {
                selectEl.value = ""; // "選択なし"
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
    selectElement.innerHTML = '<option value="">選択なし</option>'; // Default empty option
    if (options && options.length > 0) {
        options.forEach(option => {
            const opt = document.createElement('option');
            opt.value = option.id;
            opt.textContent = option.name;
            selectElement.appendChild(opt);
        });
    } else {
        // selectElement.innerHTML = '<option value="">データなし</option>';
        console.warn(`No data found for character base type: ${baseType} to populate selector.`);
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
            imgElement.src = item.image || './images/placeholder_item.png';
            imgElement.alt = item.name || 'アイテム画像';
            nameElement.textContent = item.name || '(名称未設定)';
            if (clearButton) clearButton.style.display = 'inline-block';
            if (selectButton) selectButton.textContent = '変更';
        } else {
            // Item ID exists but item data not found (data inconsistency)
            imgElement.src = './images/placeholder_slot.png';
            imgElement.alt = slotName;
            nameElement.textContent = 'エラー(データ不整合)';
            if (clearButton) clearButton.style.display = 'none';
            if (selectButton) selectButton.textContent = '選択';
            console.warn(`Item data for ID ${itemId} not found in slot ${slotName}.`);
        }
    } else {
        // No item selected for this slot
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
    const allItems = getAllItemsFunc();

    // 1. Character base effects
    Object.values(selectedCharacterBase).forEach(baseOption => {
        if (baseOption && baseOption.effects && Array.isArray(baseOption.effects)) {
            baseOption.effects.forEach(effect => {
                processEffect(effect, effectTypesCache, totalEffectsMap);
            });
        }
    });

    // 2. Equipment effects
    Object.values(selectedEquipment).forEach(itemId => {
        if (!itemId) return;
        const item = allItems.find(i => i.docId === itemId);
        if (item && item.structured_effects && Array.isArray(item.structured_effects)) {
            item.structured_effects.forEach(effect => {
                processEffect(effect, effectTypesCache, totalEffectsMap);
            });
        }
    });

    // Finalize 'max' calculation
    totalEffectsMap.forEach(effectData => {
        if (effectData.calculationMethod === 'max' && effectData.valuesForMax.length > 0) {
            effectData.value = Math.max(...effectData.valuesForMax);
        }
    });

    // Display
    if (totalEffectsMap.size === 0) {
        DOMS.totalEffectsDisplay.innerHTML = '<p>効果はありません。</p>';
    } else {
        let html = '<ul>';
        totalEffectsMap.forEach(effData => {
            const unitText = (effData.unit && effData.unit !== 'none') ? effData.unit : '';
            // Round to avoid floating point issues, e.g., 3 decimal places
            const displayValue = Math.round(effData.value * 1000) / 1000;
            html += `<li>${effData.typeName}: ${displayValue}${unitText}</li>`;
        });
        html += '</ul>';
        DOMS.totalEffectsDisplay.innerHTML = html;
    }
    // Also update export area (can be done here or when image generation is triggered)
    if(DOMS.exportEffects) DOMS.exportEffects.innerHTML = DOMS.totalEffectsDisplay.innerHTML;
}

function processEffect(effect, effectTypesCache, totalEffectsMap) {
    const { type: effectTypeId, value, unit } = effect;
    if (!effectTypeId || typeof value !== 'number') return;

    const effectTypeInfo = effectTypesCache.find(et => et.id === effectTypeId);
    if (!effectTypeInfo) {
        console.warn(`Effect type info not found for ID: ${effectTypeId}`);
        return;
    }

    const calculationMethod = effectTypeInfo.calculationMethod || 'sum';
    const sumCap = typeof effectTypeInfo.sumCap === 'number' ? effectTypeInfo.sumCap : Infinity;
    const currentUnit = unit || effectTypeInfo.defaultUnit || 'none'; // Use effect's unit, fallback to type's default, then 'none'
    const effectKey = `${effectTypeId}_${currentUnit}`; // Key by type AND unit

    if (!totalEffectsMap.has(effectKey)) {
        totalEffectsMap.set(effectKey, {
            typeId: effectTypeId,
            typeName: effectTypeInfo.name,
            value: 0,
            unit: currentUnit,
            calculationMethod: calculationMethod,
            sumCap: sumCap,
            valuesForMax: [] // Stores all values if method is 'max'
        });
    }

    const currentEffectData = totalEffectsMap.get(effectKey);
    if (calculationMethod === 'max') {
        currentEffectData.valuesForMax.push(value);
    } else { // 'sum'
        currentEffectData.value += value;
        if (currentEffectData.value > currentEffectData.sumCap) {
            currentEffectData.value = currentEffectData.sumCap;
        }
    }
}

// --- Getters and Setters for State ---
export const getSelectedEquipment = () => selectedEquipment;
export const updateSelectedEquipment = (slotName, itemId) => {
    if (selectedEquipment.hasOwnProperty(slotName)) {
        selectedEquipment[slotName] = itemId;
    }
};

export const getSelectedCharacterBase = () => selectedCharacterBase;
export const setSelectedCharacterBaseValue = (baseType, optionData) => {
    if (selectedCharacterBase.hasOwnProperty(baseType)) {
        selectedCharacterBase[baseType] = optionData; // optionData can be null
    }
};

// Export DOMS if simulator-image.js needs direct access
export const getSimulatorDOMS = () => DOMS;
