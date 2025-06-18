// js/script-main.js
import { db } from '../firebase-config.js';
import {
    loadData,
    isInitialDataLoaded, // Check if data is ready in memory
    getAllItems, 
    getAllCategories, 
    getAllTags, 
    getEffectTypesCache, 
    getCharacterBasesCache,
    getItemSourcesCache, // Make sure this is exported and used if needed by ui-main for item detail
    EQUIPMENT_SLOT_TAG_IDS, 
    SIMULATOR_PARENT_CATEGORY_NAME, 
    SIMULATOR_EFFECT_CHILD_CATEGORY_NAME
} from './modules/data-loader.js';
import {
    initUIMain,
    displaySearchToolMessage, 
    showConfirmSelectionButton,
    openItemDetailModal, // Ensure openItemDetailModal is imported if ui-main manages it directly
    closeAllModals // For potential full app reset/error scenarios
} from './modules/ui-main.js';
import {
    initSearchFilters, 
    applyFiltersAndRender,
    activateSimulatorSelectionMode, 
    deactivateSimulatorSelectionMode, 
    cancelItemSelection,
    setTemporarilySelectedItemExport,
    isSelectingForSimulatorState as getIsSelectingForSimulator, // Renamed for clarity
    getCurrentSelectingSlotState as getCurrentSelectingSlot // Renamed for clarity
} from './modules/search-filters.js';
import {
    initSearchRender 
    // renderItems is called via applyFiltersAndRender, so not directly needed here
} from './modules/search-render.js';
import {
    initSimulatorUI, 
    updateSimulatorSlotDisplay, 
    calculateAndDisplayTotalEffects, 
    initializeSimulatorDisplay,
    getSelectedEquipment, 
    getSelectedCharacterBase, 
    setSelectedCharacterBaseValue, 
    updateSelectedEquipment,
    getSimulatorDOMS 
} from './modules/simulator-ui.js';
import { initSimulatorLogic } from './modules/simulator-logic.js';
import { initSimulatorImage } from './modules/simulator-image.js';


document.addEventListener('DOMContentLoaded', async () => {
    console.log("[script-main] DOMContentLoaded, starting app init...");

    const simulatorModal = document.getElementById('simulatorModal'); // Still useful for direct manipulation

    // Initialize basic UI handlers (modals, nav) first
    // These don't strictly depend on data being loaded, but some callbacks might
    initUIMain(
        getIsSelectingForSimulator, // Pass the state getter from search-filters
        cancelItemSelection,        // Pass the cancel action from search-filters
        initializeSimulatorDisplay  // Pass the UI initializer from simulator-ui
    );

    try {
        console.log("[script-main] Calling loadData to populate/sync IndexedDB and load to memory...");
        // loadData will:
        // 1. Attempt to load from IndexedDB to memory cache immediately.
        // 2. Check if full sync or diff sync is needed with Firestore.
        // 3. Perform Firestore sync (full or diff) potentially in the background after initial IDB load.
        await loadData(db); 
        console.log("[script-main] loadData call completed. Initial data (from IDB) should be in memory if available.");

        // Now, check if the initial data load into memory was successful
        if (isInitialDataLoaded()) {
            console.log("[script-main] Initial data loaded into memory. Initializing data-dependent modules.");

            // Initialize modules that depend on the data being available in memory caches
            initSearchRender({
                getAllItems: getAllItems,
                getEffectTypesCache: getEffectTypesCache,
                getAllTags: getAllTags,
                // getEffectUnitsCache is now handled internally by search-render via data-loader import
                onItemTempSelect: (itemId) => { // Callback when an item is clicked in simulator selection mode
                    setTemporarilySelectedItemExport(itemId);
                    // Potentially re-render only the item list if just highlight changes,
                    // or rely on applyFiltersAndRender to be called by other logic.
                    // For now, this just updates the state.
                }
            });

            initSearchFilters(db, { // db might not be strictly needed if all data comes from cache getters
                getAllItems: getAllItems,
                getAllCategories: getAllCategories,
                getAllTags: getAllTags,
                getEffectTypesCache: getEffectTypesCache,
                getSlotTagId: (slotName) => EQUIPMENT_SLOT_TAG_IDS[slotName],
                simulatorParentCategoryName: SIMULATOR_PARENT_CATEGORY_NAME,
                simulatorEffectChildCategoryName: SIMULATOR_EFFECT_CHILD_CATEGORY_NAME,
                onFilterChange: applyFiltersAndRender, // Callback to re-render items when filters change
                onSelectionConfirmed: (slotName, selectedItemId) => {
                    console.log(`[script-main] Simulator selection confirmed for slot '${slotName}', item ID: '${selectedItemId}'`);
                    updateSelectedEquipment(slotName, selectedItemId); // Update simulator's state
                    deactivateSimulatorSelectionMode(); // Turn off selection mode in search-filters
                    if (simulatorModal) simulatorModal.style.display = 'flex'; // Show simulator modal
                    updateSimulatorSlotDisplay(slotName); // Update the specific slot in simulator UI
                    calculateAndDisplayTotalEffects(); // Recalculate effects
                },
                displaySearchToolMessage: displaySearchToolMessage, // UI function
                showConfirmSelectionButton: showConfirmSelectionButton, // UI function
            });

            initSimulatorUI(db, { // db might not be strictly needed
                getAllItems: getAllItems,
                getEffectTypesCache: getEffectTypesCache,
                getCharacterBasesCache: getCharacterBasesCache,
                // getEffectUnitsCache is handled by simulator-ui via data-loader import
                onSlotSelectStart: (slotName) => {
                    console.log(`[script-main] Starting item selection for slot: ${slotName}`);
                    if (simulatorModal) simulatorModal.style.display = 'none'; // Hide simulator
                    const slotTagId = EQUIPMENT_SLOT_TAG_IDS[slotName];
                    if (slotTagId === undefined || slotTagId === null) {
                        alert(`部位「${slotName}」に対応するタグIDが設定されていません。管理画面で設定を確認してください。`);
                        if (simulatorModal) simulatorModal.style.display = 'flex'; // Re-show simulator
                        return;
                    }
                    // Activate selection mode in search-filters, passing current equipped item for pre-selection
                    activateSimulatorSelectionMode(slotName, slotTagId, getSelectedEquipment()[slotName] || null);
                },
                onSlotClear: (slotName) => {
                    console.log(`[script-main] Clearing slot: ${slotName}`);
                    updateSelectedEquipment(slotName, null);
                    updateSimulatorSlotDisplay(slotName);
                    calculateAndDisplayTotalEffects();
                },
                getCharacterBaseOptionData: (baseType, optionId) => { // Used by simulator logic/UI
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
                getCharacterBasesCache: getCharacterBasesCache, // For resolving names if needed
                getSelectedEquipment: getSelectedEquipment,
                getAllItems: getAllItems, // For item names/images in export
                getTotalEffectsDisplayHTML: () => {
                    const displayElement = document.getElementById('totalEffectsDisplay');
                    return displayElement ? displayElement.innerHTML : "<p>効果なし</p>";
                },
                getSimulatorDOMS: getSimulatorDOMS // To access export area DOM elements
            });

            console.log("[script-main] Performing initial item list render based on default filters...");
            applyFiltersAndRender(); // This will render items based on current (likely empty) filters
            
            console.log("[script-main] Performing initial simulator display setup...");
            initializeSimulatorDisplay(); // Set up the simulator UI with default/empty state

        } else {
            // This block executes if `isInitialDataLoaded()` returns false after `loadData` finishes.
            // This implies that `loadAllDataToCache` within `loadData` failed or IDB was empty and
            // the subsequent full sync (if triggered) also had issues before populating memory.
            console.error("[script-main] Critical: Initial data could not be loaded into memory cache even after loadData call. App cannot function correctly.");
            const itemListEl = document.getElementById('itemList');
            if (itemListEl) {
                itemListEl.innerHTML = `<p style="color: red; text-align: center; padding: 20px;">データ準備エラー: アプリケーションのデータが読み込めませんでした。時間をおいてページを再読み込みするか、管理者にお問い合わせください。</p>`;
            }
            // Optionally, disable filter controls or other UI elements that depend on data.
            // You might also want to hide the main content and show a more prominent error message.
        }
        console.log("[script-main] Application initialization sequence complete.");

    } catch (error) {
        console.error("[script-main] CRITICAL ERROR during app initialization:", error);
        // Display a user-friendly error message covering the whole content area.
        const containerEl = document.querySelector('.container');
        if(containerEl) {
            containerEl.innerHTML = `<div style="padding: 20px; text-align: center;">
                                        <h2 style="color: red;">アプリケーションエラー</h2>
                                        <p>申し訳ありませんが、アプリケーションの起動中に問題が発生しました。</p>
                                        <p>時間をおいてページを再読み込みしてみてください。</p>
                                        <p><small>詳細: ${error.message}</small></p>
                                     </div>`;
        }
        closeAllModals(); // Close any modals that might have been opened
    }
});
