// js/script-main.js
import { db } from '../firebase-config.js'; // Correct path from js/ to root
import {
    loadData,
    getAllItems, getAllCategories, getAllTags, getEffectTypesCache, getCharacterBasesCache,
    EQUIPMENT_SLOT_TAG_IDS, SIMULATOR_PARENT_CATEGORY_NAME, SIMULATOR_EFFECT_CHILD_CATEGORY_NAME
} from './modules/data-loader.js'; // Correct path from js/ to js/modules/
import {
    initUIMain,
    displaySearchToolMessage, showConfirmSelectionButton
    // openItemDetailModal is used by search-render, not directly by script-main usually
} from './modules/ui-main.js'; // Correct path
import {
    initSearchFilters, applyFiltersAndRender,
    activateSimulatorSelectionMode, deactivateSimulatorSelectionMode, cancelItemSelection,
    setTemporarilySelectedItemExport,
    isSelectingForSimulatorState as getIsSelectingForSimulator, // Aliased for clarity
    getCurrentSelectingSlotState as getCurrentSelectingSlot // Aliased for clarity
} from './modules/search-filters.js'; // Correct path
import {
    initSearchRender
    // renderItems is typically called by applyFiltersAndRender from search-filters
} from './modules/search-render.js'; // Correct path
import {
    initSimulatorUI, updateSimulatorSlotDisplay, calculateAndDisplayTotalEffects, initializeSimulatorDisplay,
    getSelectedEquipment, getSelectedCharacterBase, setSelectedCharacterBaseValue, updateSelectedEquipment
} from './modules/simulator-ui.js'; // Correct path
import { initSimulatorLogic } from './modules/simulator-logic.js'; // Correct path
import { initSimulatorImage, getSimulatorDOMS as getSimulatorImageDOMS } from './modules/simulator-image.js'; // Correct path


document.addEventListener('DOMContentLoaded', async () => {
    console.log("[script-main] DOMContentLoaded, starting app init...");

    const simulatorModal = document.getElementById('simulatorModal'); // Used for show/hide logic

    // Initialize general UI elements (hamburger, nav, modal closing logic)
    initUIMain(
        getIsSelectingForSimulator, // Callback to check if in simulator selection mode
        cancelItemSelection,        // Callback from search-filters to cancel item selection
        initializeSimulatorDisplay  // Callback from simulator-ui to re-init its display
    );

    try {
        console.log("[script-main] Calling loadData...");
        await loadData(db); // Load all data from Firestore
        console.log("[script-main] loadData finished successfully.");

        // Initialize Search Tool Components
        initSearchRender({ // search-render needs access to data getters
            getAllItems: getAllItems,
            getEffectTypesCache: getEffectTypesCache,
            getAllTags: getAllTags,
            onItemTempSelect: (itemId) => { // Called when an item card is clicked in simulator mode
                setTemporarilySelectedItemExport(itemId); // Update state in search-filters
            }
            // pageChange event is handled by search-filters itself via event listener
        });

        initSearchFilters(db, { // search-filters needs callbacks and data getters
            getAllItems: getAllItems,
            getAllCategories: getAllCategories,
            getAllTags: getAllTags,
            getEffectTypesCache: getEffectTypesCache,
            getSlotTagId: (slotName) => EQUIPMENT_SLOT_TAG_IDS[slotName],
            simulatorParentCategoryName: SIMULATOR_PARENT_CATEGORY_NAME,
            simulatorEffectChildCategoryName: SIMULATOR_EFFECT_CHILD_CATEGORY_NAME,
            onFilterChange: applyFiltersAndRender, // The core function to update the item list
            onSelectionConfirmed: (slotName, selectedItemId) => { // Called from search-filters when confirm button is clicked
                console.log(`[script-main] Simulator selection confirmed for slot '${slotName}', item ID: '${selectedItemId}'`);
                updateSelectedEquipment(slotName, selectedItemId); // Update simulator-ui state

                deactivateSimulatorSelectionMode(); // Reset search-filters state
                // applyFiltersAndRender(); // This is usually called within deactivateSimulatorSelectionMode or should be called after

                if (simulatorModal) simulatorModal.style.display = 'flex'; // Show simulator modal
                updateSimulatorSlotDisplay(slotName); // Update the specific slot in simulator
                calculateAndDisplayTotalEffects();    // Recalculate effects
            },
            displaySearchToolMessage: displaySearchToolMessage, // Pass UI update functions
            showConfirmSelectionButton: showConfirmSelectionButton,
        });


        // Initialize Simulator Components
        initSimulatorUI(db, { // simulator-ui needs data getters and callbacks
            getAllItems: getAllItems,
            getEffectTypesCache: getEffectTypesCache,
            getCharacterBasesCache: getCharacterBasesCache,
            onSlotSelectStart: (slotName) => { // Called when a "Select" button in a slot is clicked
                console.log(`[script-main] Starting item selection for slot: ${slotName}`);
                if (simulatorModal) simulatorModal.style.display = 'none'; // Hide simulator modal
                const slotTagId = EQUIPMENT_SLOT_TAG_IDS[slotName];
                if (slotTagId === undefined || slotTagId === null) {
                    alert(`部位「${slotName}」に対応するタグIDが設定されていません。管理画面で設定を確認してください。`);
                    if (simulatorModal) simulatorModal.style.display = 'flex'; // Show simulator modal again if error
                    return;
                }
                // Activate simulator selection mode in search-filters
                activateSimulatorSelectionMode(slotName, slotTagId, getSelectedEquipment()[slotName] || null);
                // applyFiltersAndRender(); // This is usually called within activateSimulatorSelectionMode
            },
            onSlotClear: (slotName) => {
                console.log(`[script-main] Clearing slot: ${slotName}`);
                updateSelectedEquipment(slotName, null);    // Update state in simulator-ui
                updateSimulatorSlotDisplay(slotName);      // Update visual display of the slot
                calculateAndDisplayTotalEffects();         // Recalculate
            },
            getCharacterBaseOptionData: (baseType, optionId) => {
                const bases = getCharacterBasesCache();
                return bases[baseType] ? (bases[baseType].find(opt => opt.id === optionId) || null) : null;
            }
        });

        initSimulatorLogic({ // simulator-logic needs access to simulator-ui's state and functions
            getSelectedCharacterBase: getSelectedCharacterBase,
            setSelectedCharacterBaseValue: setSelectedCharacterBaseValue,
            calculateAndDisplayTotalEffects: calculateAndDisplayTotalEffects,
            getCharacterBasesCache: getCharacterBasesCache,
        });

        initSimulatorImage({ // simulator-image needs access to simulator-ui's state/DOM and data
            getSelectedCharacterBase: getSelectedCharacterBase,
            getCharacterBasesCache: getCharacterBasesCache,
            getSelectedEquipment: getSelectedEquipment,
            getAllItems: getAllItems,
            getTotalEffectsDisplayHTML: () => document.getElementById('totalEffectsDisplay').innerHTML,
            getSimulatorDOMS: getSimulatorImageDOMS // From simulator-ui.js
        });

        console.log("[script-main] Performing initial item list render...");
        applyFiltersAndRender(); // Initial render of items
        console.log("[script-main] Performing initial simulator display setup...");
        initializeSimulatorDisplay(); // Initialize simulator with default/empty state

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
