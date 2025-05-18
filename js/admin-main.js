// js/admin-main.js
import { auth, db } from '../firebase-config.js';
import { initAuth } from './admin-modules/auth.js'; // getCurrentUser is not directly used by admin-main
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
import { initUIHelpers, initAdminNavigation, openModal, closeModal, populateSelect } from './admin-modules/ui-helpers.js';
// Import render/populate functions from each manager that needs to be called on modal open
import { _renderCategoriesForManagementInternal as renderCategoriesUI, _populateParentCategoryButtonsForModalForm as populateCatFormParents } from './admin-modules/category-manager.js';
import { _renderTagsForManagementInternal as renderTagsUI, _populateCategoryCheckboxesForModalForm as populateTagFormCats } from './admin-modules/tag-manager.js';
import { _renderEffectUnitsForManagementInternal as renderEffectUnitsUI } from './admin-modules/effect-unit-manager.js';
import { _renderEffectTypesForManagementInternal as renderEffectTypesUI, _populateUnitSelectsForModalForms as populateEffectTypeFormUnits } from './admin-modules/effect-type-manager.js';
import { _renderCharacterBaseOptionsInternal as renderCharBaseOptionsUI, _populateEffectTypeSelectForModal as populateCharBaseFormEffectTypes, baseTypeMappings } from './admin-modules/char-base-manager.js';
import { initItemManager, _renderItemsAdminTableInternal as renderItemsTableUI, _populateTagCheckboxesForItemFormInternal as populateItemFormTags } from './admin-modules/item-manager.js';


document.addEventListener('DOMContentLoaded', () => {
    console.log("[admin-main] DOMContentLoaded, initializing admin panel...");
    initUIHelpers();
    initAdminNavigation();

    initAuth(auth,
        (user) => {
            console.log("[admin-main] User logged in, displaying admin content.");
            document.getElementById('password-prompt').style.display = 'none';
            document.getElementById('admin-content').style.display = 'block';
            const currentUserEmailSpan = document.getElementById('currentUserEmail');
            if (user && currentUserEmailSpan) {
                currentUserEmailSpan.textContent = `${user.email}`;
            }
            loadAndInitializeAdminModules();
        },
        () => {
            console.log("[admin-main] User logged out, hiding admin content.");
            document.getElementById('password-prompt').style.display = 'flex';
            document.getElementById('admin-content').style.display = 'none';
            const currentUserEmailSpan = document.getElementById('currentUserEmail');
            if (currentUserEmailSpan) currentUserEmailSpan.textContent = '';
            clearAdminUIAndData();
        }
    );

    document.addEventListener('adminModalOpened', (event) => {
        const modalId = event.detail.modalId;
        console.log(`[admin-main] Event: adminModalOpened for ${modalId}`);
        // When a management modal is opened, refresh its content
        switch (modalId) {
            case 'categoryManagementModal':
                if (typeof renderCategoriesUI === 'function') renderCategoriesUI();
                if (typeof populateCatFormParents === 'function') populateCatFormParents();
                break;
            case 'tagManagementModal':
                if (typeof renderTagsUI === 'function') renderTagsUI();
                if (typeof populateTagFormCats === 'function') populateTagFormCats();
                break;
            case 'effectUnitManagementModal':
                if (typeof renderEffectUnitsUI === 'function') renderEffectUnitsUI();
                break;
            case 'effectTypeManagementModal':
                if (typeof renderEffectTypesUI === 'function') renderEffectTypesUI();
                if (typeof populateEffectTypeFormUnits === 'function') populateEffectTypeFormUnits();
                break;
            case 'charBaseManagementModal':
                if (typeof renderCharBaseOptionsUI === 'function') renderCharBaseOptionsUI();
                if (typeof populateCharBaseFormEffectTypes === 'function') populateCharBaseFormEffectTypes();
                break;
        }
    });
});

function clearAdminUIAndData() {
    console.log("[admin-main] Clearing admin UI and data cache...");
    const listContainersIds = [ // IDs of list containers (both main page and modal versions)
        'categoryListContainer', 'tagListContainer', 'effectUnitListContainer',
        'effectTypeListContainer', 'charBaseOptionListContainer',
        'categoryListContainerModal', 'tagListContainerModal', 'effectUnitListContainerModal',
        'effectTypeListContainerModal', 'charBaseOptionListContainerModal'
    ];
    listContainersIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<p>ログアウトしました。</p>'; // Simplified message
    });
    const itemsTableBody = document.querySelector('#itemsTable tbody');
    if (itemsTableBody) itemsTableBody.innerHTML = '';

    document.querySelectorAll('#admin-content form, .modal form').forEach(form => {
        if (form && typeof form.reset === 'function') { // Check if form is not null
            form.reset();
        }
    });
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
                if (typeof renderItemsTableUI === 'function') renderItemsTableUI();

                const activeManagementModal = document.querySelector('.modal.admin-management-modal.active-modal');
                if (activeManagementModal && activeManagementModal.id) {
                     const event = new CustomEvent('adminModalOpened', { detail: { modalId: activeManagementModal.id } });
                     document.dispatchEvent(event);
                }
                console.log("[admin-main] All data and UI refreshed.");
            }
        };

        // Initialize managers for modal versions first, then for the main page version (item manager)
        // Pass a distinct suffix or a flag to differentiate element IDs if needed
        initCategoryManager({ ...commonDependencies, modalSuffix: 'Modal', isModalVersion: true });
        initTagManager({ ...commonDependencies, modalSuffix: 'Modal', isModalVersion: true });
        initEffectUnitManager({ ...commonDependencies, modalSuffix: 'Modal', isModalVersion: true });
        initEffectTypeManager({ ...commonDependencies, modalSuffix: 'Modal', isModalVersion: true });
        initCharBaseManager({ ...commonDependencies, baseTypeMappings, modalSuffix: 'Modal', isModalVersion: true });

        // Item manager for the non-modal section (main page)
        const itemManagerDeps = { ...commonDependencies, uploadWorkerUrl: IMAGE_UPLOAD_WORKER_URL, modalSuffix: '', isModalVersion: false };
        initItemManager(itemManagerDeps);

        // Initial render for the default visible section (Item Management)
        if (typeof renderItemsTableUI === 'function') renderItemsTableUI();
        if (typeof populateItemFormTags === 'function') populateItemFormTags(); // For the main item form
        
        const itemFormEffectTypeSelect = document.getElementById('effectTypeSelect'); // Main item form's effect type select
        if(itemFormEffectTypeSelect) {
             const effectTypesCache = getEffectTypesCache();
             const options = effectTypesCache.map(et => ({ value: et.id, text: et.name }));
             populateSelect(itemFormEffectTypeSelect, options, '効果種類を選択...');
        }

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
