// js/admin-main.js
import { auth, db } from '../firebase-config.js';
import { initAuth, getCurrentUser } from './admin-modules/auth.js';
import {
    loadInitialData,
    clearAdminDataCache,
    IMAGE_UPLOAD_WORKER_URL,
    getAllCategoriesCache,
    getAllTagsCache,
    getItemsCache,
    getEffectTypesCache,
    getEffectUnitsCache,
    getCharacterBasesCache
} from './admin-modules/data-loader-admin.js';
import { initUIHelpers } from './admin-modules/ui-helpers.js';
import { initCategoryManager, _renderCategoriesForManagementInternal as renderCategoriesUI } from './admin-modules/category-manager.js';
import { initTagManager, _renderTagsForManagementInternal as renderTagsUI, _populateCategoryCheckboxesForTagFormInternal as populateTagFormCategories } from './admin-modules/tag-manager.js';
import { initEffectUnitManager, _renderEffectUnitsForManagementInternal as renderEffectUnitsUI } from './admin-modules/effect-unit-manager.js';
import { initEffectTypeManager, _renderEffectTypesForManagementInternal as renderEffectTypesUI, _populateEffectTypeSelectsInternal as populateEffectTypeSelectsInForms } from './admin-modules/effect-type-manager.js';
import { initCharBaseManager, _renderCharacterBaseOptionsInternal as renderCharBaseOptionsUI, _populateCharBaseEffectTypeSelectInternal as populateCharBaseEffectTypeSelectInModal, baseTypeMappings } from './admin-modules/char-base-manager.js';
import { initItemManager, _renderItemsAdminTableInternal as renderItemsTableUI, _populateTagCheckboxesForItemFormInternal as populateItemFormTags } from './admin-modules/item-manager.js';


document.addEventListener('DOMContentLoaded', () => {
    console.log("[admin-main] DOMContentLoaded, initializing admin panel...");
    initUIHelpers();

    initAuth(auth,
        (user) => {
            console.log("[admin-main] User logged in, displaying admin content.");
            document.getElementById('password-prompt').style.display = 'none';
            const adminContentEl = document.getElementById('admin-content');
            if (adminContentEl) adminContentEl.style.display = 'block';
            else console.error("#admin-content element not found!");

            const currentUserEmailSpan = document.getElementById('currentUserEmail');
            if (user && currentUserEmailSpan) {
                currentUserEmailSpan.textContent = `ログイン中: ${user.email}`;
            }
            loadAndInitializeAdminModules();
        },
        () => {
            console.log("[admin-main] User logged out, hiding admin content.");
            const passwordPromptEl = document.getElementById('password-prompt');
            if(passwordPromptEl) passwordPromptEl.style.display = 'flex';

            const adminContentEl = document.getElementById('admin-content');
            if (adminContentEl) adminContentEl.style.display = 'none';

            const currentUserEmailSpan = document.getElementById('currentUserEmail');
            if (currentUserEmailSpan) currentUserEmailSpan.textContent = '';
            clearAdminUIAndData();
        }
    );
});

function clearAdminUIAndData() {
    console.log("[admin-main] Clearing admin UI and data cache...");
    const listContainersIds = [
        'categoryListContainer', 'tagListContainer', 'effectUnitListContainer',
        'effectTypeListContainer', 'charBaseOptionListContainer',
    ];
    listContainersIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<p>ログアウトしました。データは表示されません。</p>';
    });

    const itemsTableBody = document.querySelector('#itemsTable tbody');
    if (itemsTableBody) itemsTableBody.innerHTML = '';

    document.querySelectorAll('#admin-content form').forEach(form => {
        if (typeof form.reset === 'function') form.reset();
    });
    // Specific form clear might be needed for custom elements not reset by form.reset()
    // e.g., clearing selected buttons in category parent selector, clearing effect lists etc.
    // For now, relying on individual managers to reset their specific form states if needed upon data refresh.

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
                console.log("[admin-main] Refreshing all data and UI (called from a manager)...");
                await loadInitialData(db);
                renderAllAdminUISections(); // This will re-render everything
                console.log("[admin-main] All data and UI refreshed after manager action.");
            }
        };

        initEffectUnitManager(commonDependencies);
        initEffectTypeManager(commonDependencies); // Depends on units for its form's select
        initCategoryManager(commonDependencies);   // Depends on tags for its modal
        initTagManager(commonDependencies);        // Depends on categories for its form/modal
        initCharBaseManager({ ...commonDependencies, baseTypeMappingsFromMain: baseTypeMappings }); // Pass mapping
        initItemManager({ ...commonDependencies, uploadWorkerUrl: IMAGE_UPLOAD_WORKER_URL }); // Depends on tags, effect types

        renderAllAdminUISections(); // Initial render after all data is loaded and managers are ready

        console.log("[admin-main] Admin modules initialized and initial UI rendered successfully.");

    } catch (error) {
        console.error("[admin-main] CRITICAL ERROR during admin panel initialization:", error);
        alert("管理パネルの初期化中に重大なエラーが発生しました。コンソールを確認してください。");
        const adminContainer = document.getElementById('admin-content')?.querySelector('.container');
        if (adminContainer) {
            adminContainer.innerHTML = `<p class="error-message" style="color:red; text-align:center; padding:20px;">管理データの読み込みまたは表示に失敗しました。ページを再読み込みするか、管理者にお問い合わせください。</p>`;
        }
    }
}

function renderAllAdminUISections() {
    console.log("[admin-main] Rendering all admin UI sections...");
    if (typeof renderCategoriesUI === 'function') renderCategoriesUI();
    if (typeof renderTagsUI === 'function') renderTagsUI();
    if (typeof renderEffectUnitsUI === 'function') renderEffectUnitsUI();
    if (typeof renderEffectTypesUI === 'function') renderEffectTypesUI();
    if (typeof renderCharBaseOptionsUI === 'function') renderCharBaseOptionsUI();
    if (typeof renderItemsTableUI === 'function') renderItemsTableUI();

    // Populate selects/checkboxes in forms that depend on other data collections
    // These are typically called within the respective _render...Internal functions now,
    // but calling them here again ensures they are populated after all data is available.
    if (typeof populateTagFormCategories === 'function') populateTagFormCategories(document.getElementById('newTagCategoriesCheckboxes')); // For new tag form
    if (typeof populateEffectTypeSelectsInForms === 'function') populateEffectTypeSelectsInForms(); // For item & char-base forms
    if (typeof populateCharBaseEffectTypeSelectInModal === 'function') populateCharBaseEffectTypeSelectInModal(); // For char-base modal
    if (typeof populateItemFormTags === 'function') populateItemFormTags(); // For item form
    // Note: category-manager's parent category selector is populated within its _render function.

    console.log("[admin-main] All admin UI sections rendering process complete.");
}
