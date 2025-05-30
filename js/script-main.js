// js/script-main.js
import { db } from '../firebase-config.js';
import {
    loadData,
    getAllItems, getAllCategories, getAllTags, getEffectTypesCache, getCharacterBasesCache,
    getItemSourcesCache, 
    EQUIPMENT_SLOT_TAG_IDS, SIMULATOR_PARENT_CATEGORY_NAME, SIMULATOR_EFFECT_CHILD_CATEGORY_NAME
} from './modules/data-loader.js';
import {
    initUIMain,
    displaySearchToolMessage, showConfirmSelectionButton
} from './modules/ui-main.js';
import {
    initSearchFilters, applyFiltersAndRender,
    activateSimulatorSelectionMode, deactivateSimulatorSelectionMode, cancelItemSelection,
    setTemporarilySelectedItemExport,
    isSelectingForSimulatorState as getIsSelectingForSimulator,
    getCurrentSelectingSlotState as getCurrentSelectingSlot
} from './modules/search-filters.js';
import {
    initSearchRender
} from './modules/search-render.js';
import {
    initSimulatorUI, updateSimulatorSlotDisplay, calculateAndDisplayTotalEffects, initializeSimulatorDisplay,
    getSelectedEquipment, getSelectedCharacterBase, setSelectedCharacterBaseValue, updateSelectedEquipment,
    getSimulatorDOMS 
} from './modules/simulator-ui.js';
import { initSimulatorLogic } from './modules/simulator-logic.js';
import { initSimulatorImage } from './modules/simulator-image.js';


document.addEventListener('DOMContentLoaded', async () => {
    console.log("[script-main] DOMContentLoaded, starting app init...");

    const simulatorModal = document.getElementById('simulatorModal');

    initUIMain(
        getIsSelectingForSimulator,
        cancelItemSelection,
        initializeSimulatorDisplay
    );

    try {
        console.log("[script-main] Calling loadData...");
        await loadData(db); 
        console.log("[script-main] loadData finished successfully.");

        initSearchRender({
            getAllItems: getAllItems,
            getEffectTypesCache: getEffectTypesCache,
            getAllTags: getAllTags,
            onItemTempSelect: (itemId) => {
                setTemporarilySelectedItemExport(itemId);
            }
        });

        initSearchFilters(db, {
            getAllItems: getAllItems,
            getAllCategories: getAllCategories,
            getAllTags: getAllTags,
            getEffectTypesCache: getEffectTypesCache,
            getSlotTagId: (slotName) => EQUIPMENT_SLOT_TAG_IDS[slotName],
            simulatorParentCategoryName: SIMULATOR_PARENT_CATEGORY_NAME,
            simulatorEffectChildCategoryName: SIMULATOR_EFFECT_CHILD_CATEGORY_NAME,
            onFilterChange: applyFiltersAndRender,
            onSelectionConfirmed: (slotName, selectedItemId) => {
                console.log(`[script-main] Simulator selection confirmed for slot '${slotName}', item ID: '${selectedItemId}'`);
                updateSelectedEquipment(slotName, selectedItemId);
                deactivateSimulatorSelectionMode();
                if (simulatorModal) simulatorModal.style.display = 'flex';
                updateSimulatorSlotDisplay(slotName);
                calculateAndDisplayTotalEffects();
            },
            displaySearchToolMessage: displaySearchToolMessage,
            showConfirmSelectionButton: showConfirmSelectionButton,
        });

        initSimulatorUI(db, {
            getAllItems: getAllItems,
            getEffectTypesCache: getEffectTypesCache,
            getCharacterBasesCache: getCharacterBasesCache,
            onSlotSelectStart: (slotName) => {
                console.log(`[script-main] Starting item selection for slot: ${slotName}`);
                if (simulatorModal) simulatorModal.style.display = 'none';
                const slotTagId = EQUIPMENT_SLOT_TAG_IDS[slotName];
                if (slotTagId === undefined || slotTagId === null) {
                    alert(`部位「${slotName}」に対応するタグIDが設定されていません。管理画面で設定を確認してください。`);
                    if (simulatorModal) simulatorModal.style.display = 'flex';
                    return;
                }
                activateSimulatorSelectionMode(slotName, slotTagId, getSelectedEquipment()[slotName] || null);
            },
            onSlotClear: (slotName) => {
                console.log(`[script-main] Clearing slot: ${slotName}`);
                updateSelectedEquipment(slotName, null);
                updateSimulatorSlotDisplay(slotName);
                calculateAndDisplayTotalEffects();
            },
            getCharacterBaseOptionData: (baseType, optionId) => {
                const bases = getCharacterBasesCache();
                return bases[baseType] ? (bases[baseType].find(opt => opt.id === optionId) || null) : null;
            }
        });

        initSimulatorLogic({
            getSelectedCharacterBase: getSelectedCharacterBase,
            setSelectedCharacterBaseValue: setSelectedCharacterBaseValue,
            calculateAndDisplayTotalEffects: calculateAndDisplayTotalEffects,
            getCharacterBasesCache: getCharacterBasesCache,
        });

        initSimulatorImage({
            getSelectedCharacterBase: getSelectedCharacterBase,
            getCharacterBasesCache: getCharacterBasesCache,
            getSelectedEquipment: getSelectedEquipment,
            getAllItems: getAllItems,
            getTotalEffectsDisplayHTML: () => document.getElementById('totalEffectsDisplay').innerHTML,
            getSimulatorDOMS: getSimulatorDOMS
        });

        console.log("[script-main] Performing initial item list render...");
        applyFiltersAndRender();
        console.log("[script-main] Performing initial simulator display setup...");
        initializeSimulatorDisplay();

        console.log("[script-main] All data loading and initial setup complete.");

    } catch (error) {
        console.error("[script-main] CRITICAL ERROR during app initialization:", error);
        const itemListEl = document.getElementById('itemList');
        if (itemListEl) {
            itemListEl.innerHTML = `<p style="color: red; text-align: center; padding: 20px;">アプリケーションの起動に失敗しました。データの読み込み中にエラーが発生した可能性があります。ページを再読み込みするか、管理者にお問い合わせください。</p>`;
        }
        const containerEl = document.querySelector('.container');
        if(containerEl) containerEl.innerHTML = `<p style="color: red; text-align: center; padding: 20px;">エラーが発生しました。詳細はコンソールを確認してください。</p>`;
    }
});
