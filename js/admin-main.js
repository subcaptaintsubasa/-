// js/admin-main.js
import { auth, db } from '../firebase-config.js';
import { initAuth, getCurrentUser } from './admin-modules/auth.js';
import { loadInitialData, clearAdminDataCache, IMAGE_UPLOAD_WORKER_URL } from './admin-modules/data-loader-admin.js';
import { initUIHelpers } from './admin-modules/ui-helpers.js';
import { initCategoryManager, _renderCategoriesForManagementInternal as renderCategoriesUI } from './admin-modules/category-manager.js';
import { initTagManager, _renderTagsForManagementInternal as renderTagsUI } from './admin-modules/tag-manager.js';
import { initEffectUnitManager, _renderEffectUnitsForManagementInternal as renderEffectUnitsUI } from './admin-modules/effect-unit-manager.js';
import { initEffectTypeManager, _renderEffectTypesForManagementInternal as renderEffectTypesUI, _populateEffectTypeSelectsInternal as populateEffectTypeSelectsInForms } from './admin-modules/effect-type-manager.js';
import { initCharBaseManager, _renderCharacterBaseOptionsInternal as renderCharBaseOptionsUI, _populateCharBaseEffectTypeSelectInternal as populateCharBaseEffectTypeSelectInModal, baseTypeMappings } from './admin-modules/char-base-manager.js';
import { initItemManager, _renderItemsAdminTableInternal as renderItemsTableUI, _populateTagCheckboxesForItemFormInternal as populateItemFormTags } from './admin-modules/item-manager.js';

// For getters that will be passed to manager modules
import {
    getAllCategoriesCache,
    getAllTagsCache,
    getItemsCache,
    getEffectTypesCache,
    getEffectUnitsCache,
    getCharacterBasesCache
} from './admin-modules/data-loader-admin.js';


document.addEventListener('DOMContentLoaded', () => {
    initUIHelpers(); // Initialize generic UI things like modal closing

    initAuth(auth,
        (user) => { // onLogin callback
            document.getElementById('password-prompt').style.display = 'none';
            document.getElementById('admin-content').style.display = 'block';
            const currentUserEmailSpan = document.getElementById('currentUserEmail');
            if (user && currentUserEmailSpan) {
                currentUserEmailSpan.textContent = `ログイン中: ${user.email}`;
            }
            loadAndInitializeAdminModules(); // Load data and init manager modules
        },
        () => { // onLogout callback
            document.getElementById('password-prompt').style.display = 'flex';
            document.getElementById('admin-content').style.display = 'none';
            const currentUserEmailSpan = document.getElementById('currentUserEmail');
            if (currentUserEmailSpan) currentUserEmailSpan.textContent = '';
            clearAdminUIAndData(); // Clear UI elements and cached data
        }
    );
});

function clearAdminUIAndData() {
    // This function should clear out the content of all list containers,
    // reset forms, etc. Each manager module could expose a `clearUI` function,
    // or we can do it more directly here if simple enough.
    const listContainers = [
        'categoryListContainer', 'tagListContainer', 'effectUnitListContainer',
        'effectTypeListContainer', 'charBaseOptionListContainer',
    ];
    listContainers.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<p>ログアウトしました。データは表示されません。</p>';
    });
    const itemsTableBody = document.querySelector('#itemsTable tbody');
    if (itemsTableBody) itemsTableBody.innerHTML = '';
    // Reset forms (more robustly done by calling clear methods from each manager if they exist)
    document.querySelectorAll('#admin-content form').forEach(form => form.reset());


    clearAdminDataCache(); // Clear data from data-loader-admin
    console.log("Admin UI cleared and data cache flushed.");
}


async function loadAndInitializeAdminModules() {
    console.log("Admin Main: Starting to load data and initialize modules...");
    try {
        await loadInitialData(db); // Load all data first

        // Common dependencies to pass to manager modules
        const commonDependencies = {
            db,
            // Getters for data caches
            getAllCategories: getAllCategoriesCache,
            getAllTags: getAllTagsCache,
            getItems: getItemsCache,
            getEffectTypes: getEffectTypesCache,
            getEffectUnits: getEffectUnitsCache,
            getCharacterBases: getCharacterBasesCache,
            // Callback to refresh all data and UI (could be more granular)
            refreshAllData: async () => {
                console.log("Admin Main: Refreshing all data and UI...");
                await loadInitialData(db); // Reload data
                // Re-render all relevant UI sections
                renderAllAdminUISections();
                console.log("Admin Main: All data and UI refreshed.");
            }
        };

        // Initialize managers in an order that respects dependencies if any
        // (e.g., effect units before effect types if types use units in their forms)
        initEffectUnitManager(commonDependencies); // Renders its list
        initEffectTypeManager(commonDependencies); // Renders its list, populates its form selects

        initCategoryManager(commonDependencies);   // Renders its list, populates its form selects
        initTagManager(commonDependencies);        // Renders its list, populates its form selects (needs categories)

        // Character Base Manager dependencies
        const charBaseManagerDeps = {
            ...commonDependencies,
            // baseTypeMappings is imported directly in char-base-manager
        };
        initCharBaseManager(charBaseManagerDeps); // Renders options, populates its modal's effect type select

        // Item Manager dependencies
        const itemManagerDeps = {
            ...commonDependencies,
            uploadWorkerUrl: IMAGE_UPLOAD_WORKER_URL,
        };
        initItemManager(itemManagerDeps);         // Renders table, populates its form's tag/effect type selects

        // After all managers are initialized with their own data,
        // ensure any cross-module UI elements (like select dropdowns) are populated.
        // Most managers do this internally now via refreshAllData or direct calls.
        // However, explicit calls after all data is loaded can ensure correctness.
        // For example, effect type manager populates effect type selects in other forms.
        populateEffectTypeSelectsInForms(); // From effect-type-manager.js
        populateCharBaseEffectTypeSelectInModal(); // From char-base-manager.js
        populateItemFormTags(); // From item-manager.js (populates tags in item form)


        console.log("Admin modules initialized successfully.");

    } catch (error) {
        console.error("Admin Main: Error during initial data load or module setup:", error);
        alert("管理パネルの初期化中にエラーが発生しました。コンソールを確認してください。");
        // Display a more user-friendly error message in the UI if possible
        const adminContainer = document.getElementById('admin-content')?.querySelector('.container');
        if (adminContainer) {
            adminContainer.innerHTML = `<p class="error-message" style="color:red; text-align:center; padding:20px;">管理データの読み込みまたは表示に失敗しました。ページを再読み込みするか、管理者にお問い合わせください。</p>`;
        }
    }
}

function renderAllAdminUISections() {
    // Call the internal render functions from each manager module
    // These functions should ideally fetch their required data using the getters.
    if (typeof renderCategoriesUI === 'function') renderCategoriesUI();
    if (typeof renderTagsUI === 'function') renderTagsUI();
    if (typeof renderEffectUnitsUI === 'function') renderEffectUnitsUI();
    if (typeof renderEffectTypesUI === 'function') renderEffectTypesUI();
    if (typeof renderCharBaseOptionsUI === 'function') renderCharBaseOptionsUI();
    if (typeof renderItemsTableUI === 'function') renderItemsTableUI();

    // Also, re-populate any select dropdowns that depend on dynamic data
    if (typeof populateEffectTypeSelectsInForms === 'function') populateEffectTypeSelectsInForms();
    if (typeof populateCharBaseEffectTypeSelectInModal === 'function') populateCharBaseEffectTypeSelectInModal();
    if (typeof populateItemFormTags === 'function') populateItemFormTags();
    // ... and other similar population functions for category/tag selects in forms ...
    // These might be part of the manager's init or their internal render logic now.
    // Example: Category manager's init populates its own parent category selectors.
    // Tag manager's init populates its own category selectors.
}
