// js/admin-main.js
import { auth, db } from '../firebase-config.js'; // プロジェクトルートのfirebase-config.jsをインポート
import { initAuth, getCurrentUser } from './admin-modules/auth.js';
import {
    loadInitialData,
    clearAdminDataCache,
    IMAGE_UPLOAD_WORKER_URL,
    // Cache Getters
    getAllCategoriesCache,
    getAllTagsCache,
    getItemsCache,
    getEffectTypesCache,
    getEffectUnitsCache,
    getCharacterBasesCache
} from './admin-modules/data-loader-admin.js';
import { initUIHelpers } from './admin-modules/ui-helpers.js';
import { initCategoryManager, _renderCategoriesForManagementInternal as renderCategoriesUI } from './admin-modules/category-manager.js';
import { initTagManager, _renderTagsForManagementInternal as renderTagsUI } from './admin-modules/tag-manager.js';
import { initEffectUnitManager, _renderEffectUnitsForManagementInternal as renderEffectUnitsUI } from './admin-modules/effect-unit-manager.js';
import { initEffectTypeManager, _renderEffectTypesForManagementInternal as renderEffectTypesUI, _populateEffectTypeSelectsInternal as populateEffectTypeSelectsInForms } from './admin-modules/effect-type-manager.js';
import { initCharBaseManager, _renderCharacterBaseOptionsInternal as renderCharBaseOptionsUI, _populateCharBaseEffectTypeSelectInternal as populateCharBaseEffectTypeSelectInModal, baseTypeMappings } from './admin-modules/char-base-manager.js';
import { initItemManager, _renderItemsAdminTableInternal as renderItemsTableUI, _populateTagCheckboxesForItemFormInternal as populateItemFormTags } from './admin-modules/item-manager.js';


document.addEventListener('DOMContentLoaded', () => {
    console.log("[admin-main] DOMContentLoaded, initializing admin panel...");
    initUIHelpers(); // Initialize generic UI things like modal closing

    initAuth(auth,
        (user) => { // onLogin callback
            console.log("[admin-main] User logged in, displaying admin content.");
            document.getElementById('password-prompt').style.display = 'none';
            document.getElementById('admin-content').style.display = 'block';
            const currentUserEmailSpan = document.getElementById('currentUserEmail');
            if (user && currentUserEmailSpan) {
                currentUserEmailSpan.textContent = `ログイン中: ${user.email}`;
            }
            loadAndInitializeAdminModules(); // Load data and init manager modules
        },
        () => { // onLogout callback
            console.log("[admin-main] User logged out, hiding admin content.");
            document.getElementById('password-prompt').style.display = 'flex';
            document.getElementById('admin-content').style.display = 'none';
            const currentUserEmailSpan = document.getElementById('currentUserEmail');
            if (currentUserEmailSpan) currentUserEmailSpan.textContent = '';
            clearAdminUIAndData(); // Clear UI elements and cached data
        }
    );
});

function clearAdminUIAndData() {
    console.log("[admin-main] Clearing admin UI and data cache...");
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
    document.querySelectorAll('#admin-content form').forEach(form => {
        if (typeof form.reset === 'function') {
            form.reset();
        }
    });
    // Specific clear functions for forms if `form.reset()` isn't enough
    const itemForm = document.getElementById('itemForm');
    if (itemForm && typeof window.clearItemFormInternal === 'function') { // Assuming clearItemFormInternal is globally available or imported
        // This part needs careful management if clearItemFormInternal is inside item-manager.js
        // For now, let's assume form.reset() is the primary mechanism.
    }


    clearAdminDataCache();
    console.log("[admin-main] Admin UI cleared and data cache flushed.");
}


async function loadAndInitializeAdminModules() {
    console.log("[admin-main] Starting to load data and initialize modules...");
    try {
        await loadInitialData(db);

        const commonDependencies = {
            db,
            getAllCategories: getAllCategoriesCache,
            getAllTags: getAllTagsCache,
            getItems: getItemsCache,
            getEffectTypes: getEffectTypesCache,
            getEffectUnits: getEffectUnitsCache,
            getCharacterBases: getCharacterBasesCache,
            refreshAllData: async () => {
                console.log("[admin-main] Refreshing all data and UI...");
                await loadInitialData(db);
                renderAllAdminUISections();
                console.log("[admin-main] All data and UI refreshed.");
            }
        };

        initEffectUnitManager(commonDependencies);
        initEffectTypeManager(commonDependencies);
        initCategoryManager(commonDependencies);
        initTagManager(commonDependencies);

        const charBaseManagerDeps = { ...commonDependencies, baseTypeMappings }; // baseTypeMappings from char-base-manager itself
        initCharBaseManager(charBaseManagerDeps);

        const itemManagerDeps = { ...commonDependencies, uploadWorkerUrl: IMAGE_UPLOAD_WORKER_URL };
        initItemManager(itemManagerDeps);

        // Ensure all necessary UI population calls happen after data is loaded and managers are ready
        renderAllAdminUISections(); // This calls the individual render functions

        console.log("[admin-main] Admin modules initialized successfully.");

    } catch (error) {
        console.error("[admin-main] CRITICAL ERROR during admin panel initialization:", error);
        alert("管理パネルの初期化中にエラーが発生しました。コンソールを確認してください。");
        const adminContainer = document.getElementById('admin-content')?.querySelector('.container');
        if (adminContainer) {
            adminContainer.innerHTML = `<p class="error-message" style="color:red; text-align:center; padding:20px;">管理データの読み込みまたは表示に失敗しました。ページを再読み込みするか、管理者にお問い合わせください。</p>`;
        }
    }
}

function renderAllAdminUISections() {
    console.log("[admin-main] Rendering all admin UI sections...");
    // These functions are imported from their respective manager modules
    // and should handle fetching their data using the getters from commonDependencies
    if (typeof renderCategoriesUI === 'function') renderCategoriesUI();
    if (typeof renderTagsUI === 'function') renderTagsUI();
    if (typeof renderEffectUnitsUI === 'function') renderEffectUnitsUI();
    if (typeof renderEffectTypesUI === 'function') renderEffectTypesUI();
    if (typeof renderCharBaseOptionsUI === 'function') renderCharBaseOptionsUI();
    if (typeof renderItemsTableUI === 'function') renderItemsTableUI();

    // Re-populate select dropdowns that depend on dynamic data in other forms
    if (typeof populateEffectTypeSelectsInForms === 'function') populateEffectTypeSelectsInForms();
    if (typeof populateCharBaseEffectTypeSelectInModal === 'function') populateCharBaseEffectTypeSelectInModal();
    if (typeof populateItemFormTags === 'function') populateItemFormTags();
    console.log("[admin-main] All admin UI sections rendered.");
}
