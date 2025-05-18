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
import { initUIHelpers, initAdminNavigation, openModal, closeModal, populateSelect } from './admin-modules/ui-helpers.js'; // populateSelect をインポート
import { initCategoryManager, _renderCategoriesForManagementInternal as renderCategoriesUI } from './admin-modules/category-manager.js';
import { initTagManager, _renderTagsForManagementInternal as renderTagsUI } from './admin-modules/tag-manager.js';
import { initEffectUnitManager, _renderEffectUnitsForManagementInternal as renderEffectUnitsUI } from './admin-modules/effect-unit-manager.js';
import { initEffectTypeManager, _renderEffectTypesForManagementInternal as renderEffectTypesUI, _populateEffectTypeSelectsInternal as populateEffectTypeSelectsInForms } from './admin-modules/effect-type-manager.js';
import { initCharBaseManager, _renderCharacterBaseOptionsInternal as renderCharBaseOptionsUI, _populateCharBaseEffectTypeSelectInternal as populateCharBaseEffectTypeSelectInModal, baseTypeMappings } from './admin-modules/char-base-manager.js';
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
                currentUserEmailSpan.textContent = `${user.email}`; // ログイン中: を削除 (スペース確保のため)
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
        // ここで、開かれたモーダルに応じて、そのモーダル内のコンテンツを再描画/初期化する
        // 各マネージャーは、自身の担当する要素ID（モーダル内のもの）を知っている必要がある
        switch (modalId) {
            case 'categoryManagementModal':
                if (typeof renderCategoriesUI === 'function') {
                    // category-manager.js がモーダル内の要素ID（例: #categoryListContainerModal）を
                    // 参照するように修正されていれば、この呼び出しでモーダル内が更新される
                    renderCategoriesUI();
                    // 必要であれば、モーダル内のフォームの親カテゴリボタンも更新
                    const catManager = window.adminManagers?.categoryManager; // 仮のアクセス方法
                    if (catManager && typeof catManager.populateParentCategoryButtonsForModal === 'function') {
                        catManager.populateParentCategoryButtonsForModal();
                    }
                }
                break;
            case 'tagManagementModal':
                if (typeof renderTagsUI === 'function') {
                    renderTagsUI();
                    const tagManager = window.adminManagers?.tagManager;
                    if (tagManager && typeof tagManager.populateCategoryCheckboxesForModal === 'function') {
                        tagManager.populateCategoryCheckboxesForModal();
                    }
                }
                break;
            case 'effectUnitManagementModal':
                if (typeof renderEffectUnitsUI === 'function') renderEffectUnitsUI();
                break;
            case 'effectTypeManagementModal':
                if (typeof renderEffectTypesUI === 'function') {
                    renderEffectTypesUI();
                    const effectTypeManager = window.adminManagers?.effectTypeManager;
                    if (effectTypeManager && typeof effectTypeManager.populateUnitSelectsForModal === 'function') {
                        effectTypeManager.populateUnitSelectsForModal();
                    }
                }
                break;
            case 'charBaseManagementModal':
                if (typeof renderCharBaseOptionsUI === 'function') {
                     renderCharBaseOptionsUI(); // char-base-managerがモーダル内の要素を参照するように
                     const charBaseManager = window.adminManagers?.charBaseManager;
                     if (charBaseManager && typeof charBaseManager.populateEffectTypeSelectForModal === 'function') {
                        charBaseManager.populateEffectTypeSelectForModal();
                     }
                }
                break;
        }
    });
});

function clearAdminUIAndData() {
    console.log("[admin-main] Clearing admin UI and data cache...");
    const listContainers = [
        'categoryListContainer', 'tagListContainer', 'effectUnitListContainer',
        'effectTypeListContainer', 'charBaseOptionListContainer',
        // Modal specific list containers
        'categoryListContainerModal', 'tagListContainerModal', 'effectUnitListContainerModal',
        'effectTypeListContainerModal', 'charBaseOptionListContainerModal'
    ];
    listContainers.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<p>ログアウトしました。データは表示されません。</p>';
    });
    const itemsTableBody = document.querySelector('#itemsTable tbody');
    if (itemsTableBody) itemsTableBody.innerHTML = '';

    // Clear all forms, including those inside modals
    document.querySelectorAll('#admin-content form, .modal form').forEach(form => {
        if (typeof form.reset === 'function') {
            form.reset();
        }
        // Additional clear for custom elements if needed
        const itemForm = document.getElementById('itemForm'); // Main item form
        if (itemForm && formElement === itemForm && typeof window.clearItemFormSpecifics === 'function') {
             // window.clearItemFormSpecifics(); // If item-manager exposes such a function
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
                if (typeof renderItemsTableUI === 'function') renderItemsTableUI(); // Refresh main item table

                const activeManagementModal = document.querySelector('.modal.admin-management-modal.active-modal');
                if (activeManagementModal && activeManagementModal.id) {
                     const event = new CustomEvent('adminModalOpened', { detail: { modalId: activeManagementModal.id } });
                     document.dispatchEvent(event); // Trigger refresh for the currently open modal
                }
                console.log("[admin-main] All data and UI refreshed (focused on item table and active modal).");
            }
        };

        // Initialize managers, passing a suffix for their modal-specific element IDs
        initEffectUnitManager({ ...commonDependencies, modalSuffix: 'Modal', isModalVersion: true });
        initEffectTypeManager({ ...commonDependencies, modalSuffix: 'Modal', isModalVersion: true });
        initCategoryManager({ ...commonDependencies, modalSuffix: 'Modal', isModalVersion: true });
        initTagManager({ ...commonDependencies, modalSuffix: 'Modal', isModalVersion: true });
        initCharBaseManager({ ...commonDependencies, baseTypeMappings, modalSuffix: 'Modal', isModalVersion: true });

        // Item manager for the non-modal section
        const itemManagerDeps = { ...commonDependencies, uploadWorkerUrl: IMAGE_UPLOAD_WORKER_URL, isModalVersion: false };
        initItemManager(itemManagerDeps);

        // Initial render for the default visible section (Item Management)
        if (typeof renderItemsTableUI === 'function') renderItemsTableUI();
        if (typeof populateItemFormTags === 'function') populateItemFormTags();
        // Populate effect type select in the main item form
        const itemFormEffectTypeSelect = document.getElementById('effectTypeSelect');
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

// renderAllAdminUISections is no longer called directly in this manner.
// Updates are triggered by 'adminModalOpened' or refreshAllData.
