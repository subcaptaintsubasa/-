// js/script-main.js
import { db } from '../firebase-config.js'; // Firebase設定をインポート
import { loadData, getAllItems, getAllCategories, getAllTags, getEffectTypesCache, getCharacterBasesCache, EQUIPMENT_SLOT_TAG_IDS, SIMULATOR_PARENT_CATEGORY_NAME, SIMULATOR_EFFECT_CHILD_CATEGORY_NAME } from './modules/data-loader.js';
import { initUIMain, openItemDetailModal, closeAllModals, handleGlobalClick, handleCloseButtonClick, cancelItemSelection } from './modules/ui-main.js';
import { initSearchFilters, filterAndRenderItems, getSelectedParentCategoryIds, getSelectedTagIds, getCurrentPage, setItemsPerPage, setCurrentPage, getTemporarilySelectedItem, setTemporarilySelectedItem, isSelectingForSimulator, getCurrentSelectingSlot, setCurrentSelectingSlot } from './modules/search-filters.js';
import { initSimulatorUI, updateSimulatorSlotDisplay, calculateAndDisplayTotalEffects, initializeSimulatorDisplay, getSelectedEquipment, getSelectedCharacterBase, setSelectedCharacterBaseValue } from './modules/simulator-ui.js';
import { initSimulatorLogic } from './modules/simulator-logic.js'; // handleCharacterBaseChange を含む
import { initSimulatorImage } from './modules/simulator-image.js';

document.addEventListener('DOMContentLoaded', async () => {
    // --- DOM Elements ---
    // 主要なDOM要素はこちらで取得し、各モジュールに渡すか、各モジュール内で取得します。
    // 例: const searchInput = document.getElementById('searchInput');
    const simulatorModal = document.getElementById('simulatorModal');
    const itemDetailModal = document.getElementById('itemDetailModal');

    // --- Global State (example, can be managed within modules too) ---
    // let currentFilteredItems = []; // search-filters.js or search-render.jsへ移動検討

    // Initialize main UI elements (hamburger, nav, modal closing logic)
    initUIMain(
        () => isSelectingForSimulator(), // getIsSelectingForSimulator
        cancelItemSelection,             // pass cancelItemSelection from search-filters
        initializeSimulatorDisplay       // pass initializeSimulatorDisplay from simulator-ui
    );


    // Load all necessary data from Firestore
    try {
        await loadData(db); // dbを渡す

        // Initialize Search Tool
        initSearchFilters(db, {
            onFilterChange: filterAndRenderItems, // filterAndRenderItems needs access to all data from data-loader
            onItemSelectForSimulator: (itemId) => {
                // This function would be called from search-render when an item is clicked in simulator mode
                // It might need to update a temporary selection state.
                 setTemporarilySelectedItem(itemId);
            },
            getSlotTagId: (slotName) => EQUIPMENT_SLOT_TAG_IDS[slotName], // Pass the map
            simulatorParentCategoryName: SIMULATOR_PARENT_CATEGORY_NAME,
            simulatorEffectChildCategoryName: SIMULATOR_EFFECT_CHILD_CATEGORY_NAME
        });


        // Initialize Simulator
        initSimulatorUI(db, {
            onSlotSelectStart: (slotName) => {
                // Logic from original startItemSelectionForSlot
                // This will interact with search-filters to set mode and pre-filter
                setCurrentSelectingSlot(slotName); // simulator-ui or main state

                const slotTagId = EQUIPMENT_SLOT_TAG_IDS[slotName];
                if (slotTagId === undefined || slotTagId === null) {
                    alert(`部位「${slotName}」に対応するタグIDが設定されていません。`);
                    return;
                }
                // isSelectingForSimulator = true; // Managed by search-filters
                // temporarilySelectedItem = selectedEquipment[slotName] || null; // Managed by search-filters
                // currentPage = 1; // Managed by search-filters

                simulatorModal.style.display = 'none';

                // Trigger filter setup in search-filters.js
                // This requires search-filters.js to expose a function to set simulator mode
                // e.g., setSearchModeForSimulator(true, slotName, slotTagId);
                // For now, let's assume direct state manipulation or callbacks
                const searchFiltersModule = await import('./modules/search-filters.js');
                searchFiltersModule.activateSimulatorSelectionMode(slotName, slotTagId, getSelectedEquipment()[slotName] || null);
                filterAndRenderItems(); // Re-filter based on new mode

                const searchToolMessage = document.getElementById('searchToolMessage');
                if (searchToolMessage) {
                    searchToolMessage.textContent = `「${slotName}」のアイテムを選択し、「決定」ボタンを押してください。`;
                    searchToolMessage.style.display = 'block';
                }
                document.getElementById('confirmSelectionButton').style.display = 'block';
                // Scroll logic...
            },
            onSelectionConfirmed: (slotName, selectedItemId) => {
                // Logic from original confirmSelectionButton click
                const simUI = await import('./modules/simulator-ui.js');
                simUI.updateSelectedEquipment(slotName, selectedItemId); // Update state in simulator-ui
                // isSelectingForSimulator = false; // Managed by search-filters
                // currentSelectingSlot = null; // Managed by search-filters
                // temporarilySelectedItem = null; // Managed by search-filters
                // currentPage = 1; // Managed by search-filters

                document.getElementById('searchToolMessage').style.display = 'none';
                document.getElementById('confirmSelectionButton').style.display = 'none';

                // Reset search filters to normal mode
                const searchFiltersModule = await import('./modules/search-filters.js');
                searchFiltersModule.deactivateSimulatorSelectionMode();
                filterAndRenderItems(); // Re-filter

                simulatorModal.style.display = 'flex';
                updateSimulatorSlotDisplay(slotName);
                calculateAndDisplayTotalEffects();
            },
            onSlotClear: (slotName) => {
                 const simUI = await import('./modules/simulator-ui.js');
                 simUI.updateSelectedEquipment(slotName, null);
                 updateSimulatorSlotDisplay(slotName);
                 calculateAndDisplayTotalEffects();
            },
            getCharacterBaseOptionData: (baseType, optionId) => {
                const bases = getCharacterBasesCache();
                if (bases[baseType]) {
                    return bases[baseType].find(opt => opt.id === optionId) || null;
                }
                return null;
            },
            getAllItems: getAllItems, // Pass item data access
            getEffectTypes: getEffectTypesCache // Pass effect type data access
        });

        initSimulatorLogic({ // Pass dependencies to simulator-logic
            getSelectedCharacterBase: getSelectedCharacterBase,
            setSelectedCharacterBaseValue: setSelectedCharacterBaseValue,
            calculateAndDisplayTotalEffects: calculateAndDisplayTotalEffects,
            getCharacterBasesCache: getCharacterBasesCache,
        });


        initSimulatorImage({ // Pass dependencies to simulator-image
            getSelectedCharacterBase: getSelectedCharacterBase,
            getCharacterBasesCache: getCharacterBasesCache,
            getSelectedEquipment: getSelectedEquipment,
            getAllItems: getAllItems,
            getTotalEffectsDisplayHTML: () => document.getElementById('totalEffectsDisplay').innerHTML, // Example
        });


        // Initial render of items (all items, page 1)
        filterAndRenderItems();
        initializeSimulatorDisplay(); // Initialize simulator with default/empty state

        console.log("Data loading and initial setup complete via script-main.js.");

    } catch (error) {
        console.error("Error during initial data load or setup:", error);
        document.getElementById('itemList').innerHTML = `<p style="color: red;">データの読み込みまたは初期化に失敗しました。</p>`;
    }
});

// Note: Functions like filterAndRenderItems, updateSimulatorSlotDisplay, calculateAndDisplayTotalEffects, etc.,
// would either be part of a module and imported, or this main script would orchestrate calls
// between modules. For simplicity in this example, some direct calls are assumed.
// A more robust approach might involve custom events or a more formal state management.
