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
import { initUIHelpers, initAdminNavigation, openModal as openModalGeneric, closeModal as closeModalGeneric } from './admin-modules/ui-helpers.js';
import { initCategoryManager, _renderCategoriesForManagementInternal as renderCategoriesUI } from './admin-modules/category-manager.js';
import { initTagManager, _renderTagsForManagementInternal as renderTagsUI, _populateCategoryCheckboxesForTagFormInternal as populateTagFormCategories } from './admin-modules/tag-manager.js'; // ★ _populateCategoryCheckboxesForTagFormInternal をインポート
import { initEffectUnitManager, _renderEffectUnitsForManagementInternal as renderEffectUnitsUI } from './admin-modules/effect-unit-manager.js';
import { initEffectTypeManager, _renderEffectTypesForManagementInternal as renderEffectTypesUI, _populateEffectTypeSelectsInternal as populateEffectTypeSelectsInForms } from './admin-modules/effect-type-manager.js';
import { initCharBaseManager, _renderCharacterBaseOptionsInternal as renderCharBaseOptionsUI, _populateCharBaseEffectTypeSelectInternal as populateCharBaseEffectTypeSelectInModal, baseTypeMappings } from './admin-modules/char-base-manager.js';
import { initItemManager, _renderItemsAdminTableInternal as renderItemsTableUI, _populateTagCheckboxesForItemFormInternal as populateItemFormTags } from './admin-modules/item-manager.js';


function openAndRenderManagementModal(modalId) {
    openModalGeneric(modalId);

    console.log(`[admin-main] Attempting to render content for modal: ${modalId}`);
    requestAnimationFrame(() => {
        switch (modalId) {
            case 'categoryManagementModal':
                if (typeof renderCategoriesUI === 'function') renderCategoriesUI();
                // カテゴリモーダル内の親カテゴリボタンも再描画が必要な場合がある
                const categoryManagerModule = import('./admin-modules/category-manager.js');
                 categoryManagerModule.then(cm => {
                     if (typeof cm._populateParentCategoryButtonsInternal === 'function') { // 仮の関数名
                         const newCatParentButtons = document.getElementById('newCategoryParentButtons'); // モーダル内の要素IDに注意
                         const editCatParentButtons = document.getElementById('editingCategoryParentButtons'); // 編集モーダル用
                         if(newCatParentButtons) cm._populateParentCategoryButtonsInternal(newCatParentButtons, document.getElementById('selectedNewParentCategoryId'));
                         // if(editCatParentButtons) cm._populateParentCategoryButtonsInternal(editCatParentButtons, document.getElementById('selectedEditingParentCategoryId'));
                     }
                 }).catch(err => console.error("Error loading category manager for repopulate:", err));
                break;
            case 'tagManagementModal':
                if (typeof renderTagsUI === 'function') renderTagsUI();
                if (typeof populateTagFormCategories === 'function') { // インポートした関数を使用
                    const container = document.getElementById('newTagCategoriesCheckboxes'); // モーダル内の要素ID
                    if (container) populateTagFormCategories(container);
                }
                break;
            case 'effectUnitManagementModal':
                if (typeof renderEffectUnitsUI === 'function') renderEffectUnitsUI();
                break;
            case 'effectTypeManagementModal':
                if (typeof renderEffectTypesUI === 'function') renderEffectTypesUI();
                if (typeof populateEffectTypeSelectsInForms === 'function') populateEffectTypeSelectsInForms();
                // effectTypeManager に effectUnitSelect を再描画する関数があればここで呼ぶ
                const effectTypeManagerModule = import('./admin-modules/effect-type-manager.js');
                effectTypeManagerModule.then(etm => {
                    if (typeof etm._populateEffectUnitSelectsForTypeFormsInternal === 'function') { // 仮の関数名
                        etm._populateEffectUnitSelectsForTypeFormsInternal();
                    }
                }).catch(err => console.error("Error loading effect type manager for repopulate units:", err));
                break;
            case 'charBaseManagementModal':
                if (typeof renderCharBaseOptionsUI === 'function') renderCharBaseOptionsUI();
                if (typeof populateCharBaseEffectTypeSelectInModal === 'function') populateCharBaseEffectTypeSelectInModal();
                break;
        }
        console.log(`[admin-main] Content rendering triggered for modal: ${modalId}`);
    });
}


document.addEventListener('DOMContentLoaded', () => {
    console.log("[admin-main] DOMContentLoaded, initializing admin panel...");
    initUIHelpers();
    initAdminNavigation();

    document.addEventListener('openAdminManagementModal', (event) => {
        if (event.detail && event.detail.modalId) {
            console.log(`[admin-main] Event 'openAdminManagementModal' received for: ${event.detail.modalId}`);
            openAndRenderManagementModal(event.detail.modalId);
        }
    });

    initAuth(auth,
        (user) => {
            console.log("[admin-main] User logged in, displaying admin content.");
            document.getElementById('password-prompt').style.display = 'none';
            document.getElementById('admin-content').style.display = 'block';
            const currentUserEmailSpan = document.getElementById('currentUserEmail');
            if (user && currentUserEmailSpan) {
                currentUserEmailSpan.textContent = `ログイン中: ${user.email}`;
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
});

function clearAdminUIAndData() {
    console.log("[admin-main] Clearing admin UI and data cache...");
    const formIdsToReset = ['itemForm', 'newCategoryName', 'newTagName', 'newEffectUnitName', 'newEffectTypeName']; // Add more form/input IDs if needed
    formIdsToReset.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (el.tagName === 'FORM') el.reset();
            else if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') el.value = '';
        }
    });

    const listContainerIds = [
        'categoryListContainer', 'tagListContainer', 'effectUnitListContainer',
        'effectTypeListContainer', 'charBaseOptionListContainer'
        // Note: item list is in #itemsTable tbody
    ];
    listContainerIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<p>ログアウトしました。</p>';
    });
    const itemsTableBody = document.querySelector('#itemsTable tbody');
    if (itemsTableBody) itemsTableBody.innerHTML = '';


    const itemManagementSection = document.getElementById('item-management');
    if(itemManagementSection) itemManagementSection.style.display = 'block'; // Default view

    // Close any open modals
    document.querySelectorAll('.modal.admin-management-modal.active-modal').forEach(m => closeModalGeneric(m.id));


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

        const itemManagerDeps = { ...commonDependencies, uploadWorkerUrl: IMAGE_UPLOAD_WORKER_URL };
        initItemManager(itemManagerDeps);

        initEffectUnitManager(commonDependencies);
        initEffectTypeManager(commonDependencies);
        initCategoryManager(commonDependencies);
        initTagManager(commonDependencies);
        const charBaseManagerDeps = { ...commonDependencies, baseTypeMappings };
        initCharBaseManager(charBaseManagerDeps);

        renderAllAdminUISections(true);

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

function renderAllAdminUISections(skipItemManagement = false) {
    console.log("[admin-main] Rendering all admin UI sections...");
    if (!skipItemManagement && typeof renderItemsTableUI === 'function') renderItemsTableUI();
    if (typeof renderCategoriesUI === 'function') renderCategoriesUI();
    if (typeof renderTagsUI === 'function') renderTagsUI();
    if (typeof renderEffectUnitsUI === 'function') renderEffectUnitsUI();
    if (typeof renderEffectTypesUI === 'function') renderEffectTypesUI();
    if (typeof renderCharBaseOptionsUI === 'function') renderCharBaseOptionsUI();

    if (typeof populateEffectTypeSelectsInForms === 'function') populateEffectTypeSelectsInForms();
    if (typeof populateCharBaseEffectTypeSelectInModal === 'function') populateCharBaseEffectTypeSelectInModal();
    if (!skipItemManagement && typeof populateItemFormTags === 'function') populateItemFormTags();
    console.log("[admin-main] All admin UI sections rendered (item management skipped: " + skipItemManagement + ").");
}
