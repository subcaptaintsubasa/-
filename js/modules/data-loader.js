// js/script-main.js
import { db } from '../firebase-config.js';
import {
    loadData,
    getAllItems, getAllCategories, getAllTags, getEffectTypesCache, getCharacterBasesCache,
    EQUIPMENT_SLOT_TAG_IDS, SIMULATOR_PARENT_CATEGORY_NAME, SIMULATOR_EFFECT_CHILD_CATEGORY_NAME
} from './modules/data-loader.js';
import {
    initUIMain, openItemDetailModal, /* closeAllModals, handleGlobalClick, handleCloseButtonClick, */
    displaySearchToolMessage, showConfirmSelectionButton // Specific UI functions used by search-filters
} from './modules/ui-main.js';
import {
    initSearchFilters, applyFiltersAndRender,
    activateSimulatorSelectionMode, deactivateSimulatorSelectionMode, cancelItemSelection,
    // Getters for search filter state if needed by other parts of main, though ideally managed within search-filters
    // getSelectedParentCategoryIds, getSelectedTagIds, getCurrentPage, setItemsPerPageExport, setCurrentPageExport,
    // getTemporarilySelectedItem, setTemporarilySelectedItemExport,
    isSelectingForSimulatorState as getIsSelectingForSimulator, // Renamed for clarity
    getCurrentSelectingSlotState as getCurrentSelectingSlot // Renamed for clarity
} from './modules/search-filters.js';
import {
    initSearchRender, renderItems // renderItems is called by applyFiltersAndRender
} from './modules/search-render.js';
import {
    initSimulatorUI, updateSimulatorSlotDisplay, calculateAndDisplayTotalEffects, initializeSimulatorDisplay,
    getSelectedEquipment, getSelectedCharacterBase, setSelectedCharacterBaseValue, updateSelectedEquipment
} from './modules/simulator-ui.js';
import { initSimulatorLogic } from './modules/simulator-logic.js';
import { initSimulatorImage, getSimulatorDOMS as getSimulatorImageDOMS } from './modules/simulator-image.js';


document.addEventListener('DOMContentLoaded', async () => {
    console.log("[script-main] DOMContentLoaded, starting app init...");

    const simulatorModal = document.getElementById('simulatorModal'); // For passing to initSimulatorUI if needed for direct manipulation

    // Initialize general UI elements (hamburger, nav, modal closing logic)
    // Pass callbacks that ui-main might need to trigger actions in other modules
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
        // search-render needs access to data getters
        initSearchRender({
            getAllItems: getAllItems,
            getEffectTypesCache: getEffectTypesCache,
            getAllTags: getAllTags,
            onItemTempSelect: (itemId) => { // Called when an item card is clicked in simulator mode
                const searchFiltersModule = import('./modules/search-filters.js'); // Dynamic import for direct function call
                searchFiltersModule.then(sf => sf.setTemporarilySelectedItemExport(itemId));
            }
            // pageChange event is handled by search-filters itself
        });

        // search-filters needs callbacks and data getters
        initSearchFilters(db, { // db might not be needed if all data comes from data-loader getters
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
                // applyFiltersAndRender(); // Re-render item list in normal mode (already called by deactivate)

                if (simulatorModal) simulatorModal.style.display = 'flex';
                updateSimulatorSlotDisplay(slotName); // Update the specific slot in simulator
                calculateAndDisplayTotalEffects();    // Recalculate effects
            },
            // Pass UI update functions to search-filters so it can manage them
            displaySearchToolMessage: displaySearchToolMessage,
            showConfirmSelectionButton: showConfirmSelectionButton,
        });


        // Initialize Simulator Components
        // simulator-ui needs data getters and callbacks for its interactions
        initSimulatorUI(db, { // db might not be needed
            getAllItems: getAllItems,
            getEffectTypesCache: getEffectTypesCache,
            getCharacterBasesCache: getCharacterBasesCache,
            onSlotSelectStart: (slotName) => { // Called when a "Select" button in a slot is clicked
                console.log(`[script-main] Starting item selection for slot: ${slotName}`);
                if (simulatorModal) simulatorModal.style.display = 'none'; // Hide simulator modal
                const slotTagId = EQUIPMENT_SLOT_TAG_IDS[slotName];
                if (slotTagId === undefined || slotTagId === null) {
                    alert(`部位「${slotName}」に対応するタグIDが設定されていません。管理画面で設定を確認してください。`);
                    if (simulatorModal) simulatorModal.style.display = 'flex'; // Show simulator modal again
                    return;
                }
                activateSimulatorSelectionMode(slotName, slotTagId, getSelectedEquipment()[slotName] || null);
                // applyFiltersAndRender(); // Called by activateSimulatorSelectionMode
            },
            onSlotClear: (slotName) => {
                console.log(`[script-main] Clearing slot: ${slotName}`);
                updateSelectedEquipment(slotName, null);    // Update state in simulator-ui
                updateSimulatorSlotDisplay(slotName);      // Update visual display of the slot
                calculateAndDisplayTotalEffects();         // Recalculate
            },
            getCharacterBaseOptionData: (baseType, optionId) => { // Needed by simulator-logic via simulator-ui
                const bases = getCharacterBasesCache();
                return bases[baseType] ? (bases[baseType].find(opt => opt.id === optionId) || null) : null;
            }
        });

        // simulator-logic needs access to simulator-ui's state and functions
        initSimulatorLogic({
            getSelectedCharacterBase: getSelectedCharacterBase,
            setSelectedCharacterBaseValue: setSelectedCharacterBaseValue,
            calculateAndDisplayTotalEffects: calculateAndDisplayTotalEffects,
            getCharacterBasesCache: getCharacterBasesCache,
        });

        // simulator-image needs access to simulator-ui's state/DOM and data
        initSimulatorImage({
            getSelectedCharacterBase: getSelectedCharacterBase,
            getCharacterBasesCache: getCharacterBasesCache, // If names are not in selectedCharacterBase directly
            getSelectedEquipment: getSelectedEquipment,
            getAllItems: getAllItems,
            getTotalEffectsDisplayHTML: () => document.getElementById('totalEffectsDisplay').innerHTML,
            getSimulatorDOMS: getSimulatorImageDOMS // From simulator-ui.js (if ui exports its DOM cache)
        });

        // Initial render of items (all items, page 1, default filters)
        console.log("[script-main] Performing initial item list render...");
        applyFiltersAndRender();
        console.log("[script-main] Performing initial simulator display setup...");
        initializeSimulatorDisplay(); // Initialize simulator with default/empty state

        console.log("[script-main] All data loading and initial setup complete.");

    } catch (error) {
        console.error("[script-main] CRITICAL ERROR during app initialization:", error);
        const itemListEl = document.getElementById('itemList');
        if (itemListEl) {
            itemListEl.innerHTML = `<p style="color: red; text-align: center; padding: 20px;">アプリケーションの起動に失敗しました。データの読み込み中にエラーが発生した可能性があります。ページを再読み込みするか、管理者にお問い合わせください。</p>`;
        }
        // Optionally hide other parts of the UI or show a more prominent error message
        const containerEl = document.querySelector('.container');
        if(containerEl) containerEl.innerHTML = `<p style="color: red; text-align: center; padding: 20px;">エラーが発生しました。詳細はコンソールを確認してください。</p>`;
    }
});
