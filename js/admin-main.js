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
import { initUIHelpers, initAdminNavigation, openModal, closeModal } from './admin-modules/ui-helpers.js';
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
    const listContainers = [
        'categoryListContainer', 'tagListContainer', 'effectUnitListContainer',
        'effectTypeListContainer', 'charBaseOptionListContainer',
        // Modal content list containers
        'categoryListContainerModal', 'tagListContainerModal', 'effectUnitListContainerModal',
        'effectTypeListContainerModal', 'charBaseOptionListContainerModal'
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
    // Ensure item management section is hidden if it's not the default state after logout/before login
    const itemManagementSection = document.getElementById('item-management');
    if(itemManagementSection) itemManagementSection.style.display = 'block'; // Or 'none' depending on desired initial state pre-login


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

        // Initialize managers
        // Note: The IDs used within these managers (e.g., for newCategoryName)
        // now need to correspond to the elements *within* their respective modals
        // if they were made unique (e.g., newCategoryNameModal).
        // If IDs were kept original (e.g. newCategoryName for both page and modal),
        // ensure the correct one is being targeted, possibly by passing a modal-specific root element.
        // For this iteration, assuming IDs inside modals have been made unique (e.g., adding 'Modal' suffix).
        // If not, manager logic needs to be more context-aware or DOM queries more specific.

        // Item manager is initialized for the section directly on the page
        const itemManagerDeps = { ...commonDependencies, uploadWorkerUrl: IMAGE_UPLOAD_WORKER_URL };
        initItemManager(itemManagerDeps);

        // Other managers are for content now inside modals
        // Their init functions will try to find elements by original IDs.
        // If you duplicated the forms into modals AND changed their IDs,
        // then the manager JS files also need to be updated to target those new IDs.
        // For simplicity, the HTML provided earlier reused original IDs for elements *inside* the sections.
        initEffectUnitManager(commonDependencies);
        initEffectTypeManager(commonDependencies);
        initCategoryManager(commonDependencies);
        initTagManager(commonDependencies);
        const charBaseManagerDeps = { ...commonDependencies, baseTypeMappings };
        initCharBaseManager(charBaseManagerDeps);

        renderAllAdminUISections();

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
    // These calls will render content into the elements with original IDs.
    // If those elements are now inside modals, they will be rendered there.
    if (typeof renderItemsTableUI === 'function') renderItemsTableUI(); // For item-management section
    if (typeof renderCategoriesUI === 'function') renderCategoriesUI();
    if (typeof renderTagsUI === 'function') renderTagsUI();
    if (typeof renderEffectUnitsUI === 'function') renderEffectUnitsUI();
    if (typeof renderEffectTypesUI === 'function') renderEffectTypesUI();
    if (typeof renderCharBaseOptionsUI === 'function') renderCharBaseOptionsUI();

    if (typeof populateEffectTypeSelectsInForms === 'function') populateEffectTypeSelectsInForms();
    if (typeof populateCharBaseEffectTypeSelectInModal === 'function') populateCharBaseEffectTypeSelectInModal();
    if (typeof populateItemFormTags === 'function') populateItemFormTags(); // For item-management section
    console.log("[admin-main] All admin UI sections rendered.");
}
