// js/admin-main.js
import { auth, db } from '../firebase-config.js';
import { initAuth } from './admin-modules/auth.js';
import {
    loadInitialData,
    clearAdminDataCache,
    getAllCategoriesCache,
    getAllTagsCache,
    getItemsCache,
    getEffectTypesCache,
    getEffectUnitsCache,
    getEffectSuperCategoriesCache,
    getCharacterBasesCache
} from './admin-modules/data-loader-admin.js';
import { initUIHelpers, openModal as openAdminModal, closeModal as closeAdminModal } from './admin-modules/ui-helpers.js';
import { initCategoryManager, _renderCategoriesForManagementInternal as renderCategoriesUI } from './admin-modules/category-manager.js';
import { initTagManager, _renderTagsForManagementInternal as renderTagsUI, _populateCategoryCheckboxesForTagFormInternal as populateTagFormCategories } from './admin-modules/tag-manager.js';
import { initEffectUnitManager, _renderEffectUnitsForManagementInternal as renderEffectUnitsUI } from './admin-modules/effect-unit-manager.js';
import { initEffectSuperCategoryManager, _renderEffectSuperCategoriesForManagementInternal as renderEffectSuperCategoriesUI } from './admin-modules/effect-super-category-manager.js';
import { initEffectTypeManager, _renderEffectTypesForManagementInternal as renderEffectTypesUI, _populateEffectTypeSelectsInternal as populateEffectTypeSelectsInForms } from './admin-modules/effect-type-manager.js';
import { initCharBaseManager, _renderCharacterBaseOptionsInternal as renderCharBaseOptionsUI, _populateCharBaseEffectTypeSelectInternal as populateCharBaseEffectTypeSelectInModal, baseTypeMappings } from './admin-modules/char-base-manager.js';
import { initItemManager, _renderItemsAdminTableInternal as renderItemsTableUI, _populateTagCheckboxesForItemFormInternal as populateItemFormTags } from './admin-modules/item-manager.js';
import { IMAGE_UPLOAD_WORKER_URL } from './admin-modules/data-loader-admin.js';


const DOM = {
    adminHamburgerButton: null,
    adminSideNav: null,
    adminCloseNavButton: null,
    adminNavButtons: null,
    adminNavOverlay: null, 
    adminPageBody: null,    
};

document.addEventListener('DOMContentLoaded', () => {
    console.log("[admin-main] DOMContentLoaded, initializing admin panel...");

    DOM.adminHamburgerButton = document.getElementById('adminHamburgerButton');
    DOM.adminSideNav = document.getElementById('adminSideNav');
    DOM.adminCloseNavButton = document.getElementById('adminCloseNavButton');
    DOM.adminNavButtons = document.querySelectorAll('.admin-nav-button');
    DOM.adminPageBody = document.getElementById('admin-page'); 

    DOM.adminNavOverlay = document.createElement('div');
    DOM.adminNavOverlay.id = 'admin-nav-overlay';
    const adminContentElement = document.getElementById('admin-content');
    if (adminContentElement && adminContentElement.parentNode) {
        adminContentElement.parentNode.insertBefore(DOM.adminNavOverlay, adminContentElement);
    } else {
        document.body.appendChild(DOM.adminNavOverlay); 
        console.warn("Could not find #admin-content to insert overlay before it. Appended to body as fallback.");
    }

    initUIHelpers();

    function openAdminNav() {
        if (DOM.adminSideNav && DOM.adminHamburgerButton && DOM.adminNavOverlay && DOM.adminPageBody) {
            DOM.adminSideNav.classList.add('open');
            DOM.adminSideNav.setAttribute('aria-hidden', 'false');
            DOM.adminHamburgerButton.setAttribute('aria-expanded', 'true');
            DOM.adminNavOverlay.classList.add('active'); 
            DOM.adminPageBody.classList.add('admin-nav-open'); 
        }
    }

    function closeAdminNav() {
        if (DOM.adminSideNav && DOM.adminHamburgerButton && DOM.adminNavOverlay && DOM.adminPageBody) {
            DOM.adminSideNav.classList.remove('open');
            DOM.adminSideNav.setAttribute('aria-hidden', 'true');
            DOM.adminHamburgerButton.setAttribute('aria-expanded', 'false');
            DOM.adminNavOverlay.classList.remove('active'); 
            DOM.adminPageBody.classList.remove('admin-nav-open');
        }
    }

    if (DOM.adminHamburgerButton) {
        DOM.adminHamburgerButton.addEventListener('click', (e) => {
            e.stopPropagation(); 
            if (DOM.adminSideNav.classList.contains('open')) {
                closeAdminNav();
            } else {
                openAdminNav();
            }
        });
    }

    if (DOM.adminCloseNavButton) {
        DOM.adminCloseNavButton.addEventListener('click', closeAdminNav);
    }

    if (DOM.adminNavOverlay) {
        DOM.adminNavOverlay.addEventListener('click', closeAdminNav);
    }
    
    document.addEventListener('keydown', (e) => {
        if (e.key === "Escape" && DOM.adminSideNav && DOM.adminSideNav.classList.contains('open')) {
            closeAdminNav();
        }
    });

    DOM.adminNavButtons.forEach(button => {
        button.addEventListener('click', () => {
            const modalId = button.dataset.modalTarget;
            if (modalId) {
                openAdminModal(modalId);
                closeAdminNav(); 
                triggerModalContentRefresh(modalId);
            }
        });
    });

    initAuth(auth,
        (user) => {
            console.log("[admin-main] User logged in, displaying admin content.");
            const passwordPromptEl = document.getElementById('password-prompt');
            if(passwordPromptEl) passwordPromptEl.style.display = 'none';

            const adminContentEl = document.getElementById('admin-content');
            if (adminContentEl) adminContentEl.style.display = 'block';
            else console.error("#admin-content element not found!");
            
            const currentUserEmailSpan = document.getElementById('currentUserEmail');
            if(user && currentUserEmailSpan) currentUserEmailSpan.textContent = user.email;

            loadAndInitializeAdminModules();
        },
        () => {
            console.log("[admin-main] User logged out, hiding admin content.");
            const passwordPromptEl = document.getElementById('password-prompt');
            if(passwordPromptEl) passwordPromptEl.style.display = 'flex';

            const adminContentEl = document.getElementById('admin-content');
            if (adminContentEl) adminContentEl.style.display = 'none';
            
            const currentUserEmailSpan = document.getElementById('currentUserEmail');
            if(currentUserEmailSpan) currentUserEmailSpan.textContent = '';

            if (DOM.adminSideNav && DOM.adminSideNav.classList.contains('open')) {
                closeAdminNav();
            }
            clearAdminUIAndData();
        }
    );
});

function clearAdminUIAndData() {
    console.log("[admin-main] Clearing admin UI and data cache...");
    const listContainersIds = [
        'categoryListContainer', 'tagListContainer', 'effectUnitListContainer',
        'effectSuperCategoryListContainer', 
        'effectTypeListContainer', 'charBaseOptionListContainer',
    ];
    listContainersIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<p>ログアウトしました。データは表示されません。</p>';
    });

    const itemsTableBody = document.querySelector('#itemsTable tbody');
    if (itemsTableBody) itemsTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">ログアウトしました。</td></tr>';

    const itemForm = document.getElementById('itemForm');
    if (itemForm && typeof itemForm.reset === 'function') {
        itemForm.reset();
        const itemIdToEdit = document.getElementById('itemIdToEdit');
        if(itemIdToEdit) itemIdToEdit.value = '';

        const itemImagePreview = document.getElementById('itemImagePreview');
        if(itemImagePreview) {
            itemImagePreview.style.display = 'none';
            itemImagePreview.src = '#';
        }
        const itemImageUrl = document.getElementById('itemImageUrl');
        if(itemImageUrl) itemImageUrl.value = '';

        const itemImageFile = document.getElementById('itemImageFile');
        if(itemImageFile) itemImageFile.value = '';

        const currentEffectsList = document.getElementById('currentEffectsList');
        if (currentEffectsList) currentEffectsList.innerHTML = '<p>効果が追加されていません。</p>';

        const itemTagsCheckboxes = document.getElementById('itemTagsSelectorCheckboxes');
        if (itemTagsCheckboxes) itemTagsCheckboxes.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
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
            getEffectSuperCategories: getEffectSuperCategoriesCache, 
            getCharacterBases: getCharacterBasesCache,
            refreshAllData: async () => {
                console.log("[admin-main] Refreshing all data and UI (called from a manager)...");
                await loadInitialData(db);
                if (typeof renderItemsTableUI === 'function') renderItemsTableUI();
                if (typeof populateItemFormTags === 'function') populateItemFormTags();
                if (typeof populateEffectTypeSelectsInForms === 'function') populateEffectTypeSelectsInForms();

                const activeModal = document.querySelector('.admin-management-modal.active-modal');
                if (activeModal) {
                    triggerModalContentRefresh(activeModal.id);
                }
                console.log("[admin-main] All data and UI refreshed after manager action.");
            },
            openAdminModal: openAdminModal,
            closeAdminModal: closeAdminModal,
        };

        initEffectUnitManager(commonDependencies);
        initEffectSuperCategoryManager(commonDependencies); 
        initEffectTypeManager(commonDependencies);
        initCategoryManager(commonDependencies);
        initTagManager(commonDependencies);
        initCharBaseManager({ ...commonDependencies, baseTypeMappingsFromMain: baseTypeMappings });
        initItemManager({ ...commonDependencies, uploadWorkerUrl: IMAGE_UPLOAD_WORKER_URL });

        if (typeof renderItemsTableUI === 'function') renderItemsTableUI();
        if (typeof populateItemFormTags === 'function') populateItemFormTags(); 
        if (typeof populateEffectTypeSelectsInForms === 'function') populateEffectTypeSelectsInForms();

        console.log("[admin-main] Admin modules initialized. Item management section rendered.");

    } catch (error) {
        console.error("[admin-main] CRITICAL ERROR during admin panel initialization:", error);
        alert("管理パネルの初期化中に重大なエラーが発生しました。コンソールを確認してください。");
        const adminContainer = document.getElementById('admin-content')?.querySelector('.container');
        if (adminContainer) {
            adminContainer.innerHTML = `<p class="error-message" style="color:red; text-align:center; padding:20px;">管理データの読み込みまたは表示に失敗しました。ページを再読み込みするか、管理者にお問い合わせください。</p>`;
        }
    }
}

function triggerModalContentRefresh(modalId) {
    console.log(`[admin-main] Refreshing content for modal: ${modalId}`);
    switch (modalId) {
        case 'categoryManagementModal':
            if (typeof renderCategoriesUI === 'function') renderCategoriesUI();
            break;
        case 'tagManagementModal':
            if (typeof renderTagsUI === 'function') renderTagsUI();
            if (typeof populateTagFormCategories === 'function') {
                 populateTagFormCategories(document.getElementById('newTagCategoriesCheckboxes'));
            }
            break;
        case 'effectUnitManagementModal':
            if (typeof renderEffectUnitsUI === 'function') renderEffectUnitsUI();
            break;
        case 'effectSuperCategoryManagementModal': 
            if (typeof renderEffectSuperCategoriesUI === 'function') {
                renderEffectSuperCategoriesUI(getEffectSuperCategoriesCache());
            }
            break;
        case 'effectTypeManagementModal':
            if (typeof renderEffectTypesUI === 'function') renderEffectTypesUI();
            break;
        case 'characterBaseManagementModal':
            if (typeof renderCharBaseOptionsUI === 'function') renderCharBaseOptionsUI();
             if (typeof populateCharBaseEffectTypeSelectInModal === 'function') populateCharBaseEffectTypeSelectInModal();
            break;
    }
}
