// js/admin-main.js
import { auth, db } from '../firebase-config.js';
import { initAuth } from './admin-modules/auth.js'; // getCurrentUser は直接使わないので削除
import {
    loadInitialData,
    clearAdminDataCache,
    IMAGE_UPLOAD_WORKER_URL,
    getAllCategoriesCache,
    getAllTagsCache,
    getItemsCache, // ItemManager への依存としてgetItemsCacheは残す
    getEffectTypesCache,
    getEffectUnitsCache,
    getCharacterBasesCache
} from './admin-modules/data-loader-admin.js';
import { initUIHelpers, openModal as openModalHelper, closeModal as closeModalHelper, populateSelect as populateSelectHelper } from './admin-modules/ui-helpers.js'; // populateSelectHelper をインポート (未使用なら後で削除可)
import { initCategoryManager, _renderCategoriesForManagementInternal as renderCategoriesUI } from './admin-modules/category-manager.js';
import { initTagManager, _renderTagsForManagementInternal as renderTagsUI, _populateCategoryCheckboxesForTagFormInternal as populateTagFormCategories } from './admin-modules/tag-manager.js';
import { initEffectUnitManager, _renderEffectUnitsForManagementInternal as renderEffectUnitsUI } from './admin-modules/effect-unit-manager.js';
// EffectSuperCategoryManager は今回未作成なのでコメントアウト (もしあれば)
// import { initEffectSuperCategoryManager, _renderEffectSuperCategoriesForManagementInternal as renderEffectSuperCategoriesUI } from './admin-modules/effect-super-category-manager.js';
import { initEffectTypeManager, _renderEffectTypesForManagementInternal as renderEffectTypesUI, _populateEffectTypeSelectsInternal as populateEffectTypeSelectsInForms } from './admin-modules/effect-type-manager.js';
import { initCharBaseManager, _renderCharacterBaseOptionsInternal as renderCharBaseOptionsUI, _populateCharBaseEffectTypeSelectInternal as populateCharBaseEffectTypeSelectInModal, baseTypeMappings } from './admin-modules/char-base-manager.js';
import { initItemManager, _renderItemsAdminTableInternal as renderItemsTableUI, _populateTagCheckboxesForItemFormInternal as populateItemFormTags } from './admin-modules/item-manager.js';

// DOM elements for modals and navigation that admin-main controls directly
const DOM = {
    adminSideNav: null,
    adminHamburgerButton: null,
    adminCloseNavButton: null,
    adminNavButtons: null,
    listEnlargementModal: null,
    listEnlargementModalTitle: null,
    listEnlargementModalSearchContainer: null,
    listEnlargementModalContent: null,
    // Management Modals
    categoryManagementModal: null,
    tagManagementModal: null,
    effectUnitManagementModal: null,
    effectSuperCategoryManagementModal: null,
    effectTypeManagementModal: null,
    characterBaseManagementModal: null,
    // Enlargement buttons
    enlargeCategoryListButton: null,
    enlargeTagListButton: null,
    enlargeEffectUnitListButton: null,
    enlargeEffectSuperCategoryListButton: null,
    enlargeEffectTypeListButton: null,
    enlargeCharBaseOptionListButton: null,
    // Character Base specific elements
    charBaseTypeButtons: null, // Container for base type selection buttons
    selectedCharBaseTypeInput: null,
};

// Cache for manager instances - not strictly needed if we call exported functions directly
// const managers = {};

// Helper function to open specific edit modals (this might grow)
// These need to be defined or imported if they are in separate manager files
// For now, assuming they are exported from their respective manager modules.
// These are called from the listEnlargementModal click listener.
function openEditModal(type, id) {
    switch (type) {
        case 'category':
            // Assuming categoryManager.openEditCategoryModalById is available
            // This requires categoryManager to export this function or for initCategoryManager
            // to return an object with this method.
            // For simplicity, directly call if globally available or properly imported
            if (window.categoryManager && typeof window.categoryManager.openEditCategoryModalById === 'function') { // Example if manager is global
                window.categoryManager.openEditCategoryModalById(id);
            } else { // Prefer direct import and call
                const catManagerModule = getCategoryManagerModule(); // Placeholder, real import needed
                if (catManagerModule && typeof catManagerModule.openEditCategoryModalById === 'function') {
                     catManagerModule.openEditCategoryModalById(id);
                } else { // Fallback if using older structure or directly calling globally exposed methods from managers
                    // This part needs to ensure the functions are actually callable.
                    // The best approach is to import these functions directly.
                    // Let's assume the init functions made them available or they are exported.
                    // This structure assumes the functions are globally available or exposed by the init functions.
                    // A better way: each manager provides its openEditModal function.
                    const { openEditCategoryModalById: openCatEdit } = categoryManagerModuleInstance; // Needs instance or direct import
                    if (openCatEdit) openCatEdit(id);

                }
            }
            break;
        case 'tag':
            // Similar logic for tags
            const { openEditTagModalById: openTagEdit } = tagManagerModuleInstance;
            if (openTagEdit) openTagEdit(id);
            break;
        case 'effectUnit':
            const { openEditEffectUnitModalById: openEUEdit } = effectUnitManagerModuleInstance;
            if (openEUEdit) openEUEdit(id);
            break;
        // case 'effectSuperCategory':
        //     const { openEditEffectSuperCategoryModalById: openESCEdit } = effectSuperCategoryManagerModuleInstance;
        //     if (openESCEdit) openESCEdit(id);
        //     break;
        case 'effectType':
            const { openEditEffectTypeModalById: openETEdit } = effectTypeManagerModuleInstance;
            if (openETEdit) openETEdit(id);
            break;
        case 'charBaseOption':
            // Character base options need the baseType as well. This needs to be stored or passed.
            // For now, this is a simplified call. The data-type attribute on the list item will be crucial.
            const { openEditCharBaseOptionModalById: openCBOEdit } = charBaseManagerModuleInstance;
            const baseType = document.querySelector(`[data-modal-target="characterBaseManagementModal"]`)?.dataset.activeBaseType || DOM.selectedCharBaseTypeInput.value; // Get active base type
            if (openCBOEdit && baseType) openCBOEdit(id, baseType); // Requires baseType
            break;
        default:
            console.warn(`Unknown type for edit modal: ${type}`);
    }
}
// Placeholder instances (these would be set by init or functions returned by init)
let categoryManagerModuleInstance = {};
let tagManagerModuleInstance = {};
let effectUnitManagerModuleInstance = {};
// let effectSuperCategoryManagerModuleInstance = {};
let effectTypeManagerModuleInstance = {};
let charBaseManagerModuleInstance = {};


document.addEventListener('DOMContentLoaded', () => {
    console.log("[admin-main] DOMContentLoaded, initializing admin panel...");

    DOM.adminSideNav = document.getElementById('adminSideNav');
    DOM.adminHamburgerButton = document.getElementById('adminHamburgerButton');
    DOM.adminCloseNavButton = document.getElementById('adminCloseNavButton');
    DOM.adminNavButtons = document.querySelectorAll('.admin-nav-button');
    DOM.listEnlargementModal = document.getElementById('listEnlargementModal');
    DOM.listEnlargementModalTitle = document.getElementById('listEnlargementModalTitle');
    DOM.listEnlargementModalSearchContainer = document.getElementById('listEnlargementModalSearchContainer');
    DOM.listEnlargementModalContent = document.getElementById('listEnlargementModalContent');

    DOM.categoryManagementModal = document.getElementById('categoryManagementModal');
    DOM.tagManagementModal = document.getElementById('tagManagementModal');
    DOM.effectUnitManagementModal = document.getElementById('effectUnitManagementModal');
    DOM.effectSuperCategoryManagementModal = document.getElementById('effectSuperCategoryManagementModal');
    DOM.effectTypeManagementModal = document.getElementById('effectTypeManagementModal');
    DOM.characterBaseManagementModal = document.getElementById('characterBaseManagementModal');

    DOM.enlargeCategoryListButton = document.getElementById('enlargeCategoryListButton');
    DOM.enlargeTagListButton = document.getElementById('enlargeTagListButton');
    DOM.enlargeEffectUnitListButton = document.getElementById('enlargeEffectUnitListButton');
    DOM.enlargeEffectSuperCategoryListButton = document.getElementById('enlargeEffectSuperCategoryListButton');
    DOM.enlargeEffectTypeListButton = document.getElementById('enlargeEffectTypeListButton');
    DOM.enlargeCharBaseOptionListButton = document.getElementById('enlargeCharBaseOptionListButton');

    DOM.charBaseTypeButtons = document.getElementById('charBaseTypeButtons');
    DOM.selectedCharBaseTypeInput = document.getElementById('selectedCharBaseType');


    initUIHelpers(); // Initialize generic UI helpers like modal closing

    initAuth(auth,
        (user) => { // onLogin
            console.log("[admin-main] User logged in, displaying admin content.");
            document.getElementById('password-prompt').style.display = 'none';
            const adminContentEl = document.getElementById('admin-content');
            if (adminContentEl) adminContentEl.style.display = 'block';
            else console.error("#admin-content element not found!");

            const currentUserEmailSpan = document.getElementById('currentUserEmail');
            if (user && currentUserEmailSpan) {
                currentUserEmailSpan.textContent = `ログイン中: ${user.email}`;
            }
            setupAdminNav();
            loadAndInitializeAdminModules();
        },
        () => { // onLogout
            console.log("[admin-main] User logged out, hiding admin content.");
            const passwordPromptEl = document.getElementById('password-prompt');
            if(passwordPromptEl) passwordPromptEl.style.display = 'flex';

            const adminContentEl = document.getElementById('admin-content');
            if (adminContentEl) adminContentEl.style.display = 'none';
            if (DOM.adminSideNav) DOM.adminSideNav.classList.remove('open');


            const currentUserEmailSpan = document.getElementById('currentUserEmail');
            if (currentUserEmailSpan) currentUserEmailSpan.textContent = '';
            clearAdminUIAndData();
        }
    );
});

function setupAdminNav() {
    if (DOM.adminHamburgerButton && DOM.adminSideNav) {
        DOM.adminHamburgerButton.addEventListener('click', () => {
            DOM.adminSideNav.classList.add('open');
            DOM.adminHamburgerButton.setAttribute('aria-expanded', 'true');
        });
    }
    if (DOM.adminCloseNavButton && DOM.adminSideNav) {
        DOM.adminCloseNavButton.addEventListener('click', () => {
            DOM.adminSideNav.classList.remove('open');
            if (DOM.adminHamburgerButton) DOM.adminHamburgerButton.setAttribute('aria-expanded', 'false');
        });
    }
    if (DOM.adminNavButtons) {
        DOM.adminNavButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const targetModalId = e.currentTarget.dataset.modalTarget;
                if (targetModalId) {
                    openModalHelper(targetModalId);
                    if (DOM.adminSideNav) DOM.adminSideNav.classList.remove('open');
                    if (DOM.adminHamburgerButton) DOM.adminHamburgerButton.setAttribute('aria-expanded', 'false');
                     // If opening char base manager, ensure its list is rendered for current type
                    if (targetModalId === 'characterBaseManagementModal' && typeof renderCharBaseOptionsUI === 'function') {
                        renderCharBaseOptionsUI();
                    }
                }
            });
        });
    }

    setupEnlargementButtonListeners();
    setupCharBaseTypeButtons();
}

function setupCharBaseTypeButtons() {
    if (!DOM.charBaseTypeButtons || !DOM.selectedCharBaseTypeInput) return;
    DOM.charBaseTypeButtons.innerHTML = ''; // Clear any existing

    Object.entries(baseTypeMappings).forEach(([key, displayName]) => {
        const button = document.createElement('div');
        button.className = 'category-select-button'; // Re-use style
        button.textContent = displayName;
        button.dataset.baseTypeKey = key;
        if (DOM.selectedCharBaseTypeInput.value === key) {
            button.classList.add('active');
        }
        button.addEventListener('click', () => {
            DOM.charBaseTypeButtons.querySelectorAll('.active').forEach(b => b.classList.remove('active'));
            button.classList.add('active');
            DOM.selectedCharBaseTypeInput.value = key;
            const displaySpan = document.getElementById('selectedCharBaseTypeDisplay');
            if (displaySpan) displaySpan.textContent = displayName;
            if (typeof renderCharBaseOptionsUI === 'function') renderCharBaseOptionsUI();
        });
        DOM.charBaseTypeButtons.appendChild(button);
    });
}


function clearAdminUIAndData() {
    console.log("[admin-main] Clearing admin UI and data cache...");
    const listContainersIds = [
        'categoryListContainer', 'tagListContainer', 'effectUnitListContainer',
        'effectTypeListContainer', 'charBaseOptionListContainer',
        // 'effectSuperCategoryListContainer', // if added
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

    // Clear checkbox groups and button groups that aren't reset by form.reset()
    document.querySelectorAll('.checkbox-group-container, .category-button-group.admin, .tag-button-container.admin').forEach(container => {
        container.innerHTML = ''; // Or more specific clearing if needed
    });
    // Clear effect lists
    const effectsLists = ['currentEffectsList', 'currentCharBaseOptionEffectsList'];
    effectsLists.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<p>効果が追加されていません。</p>';
    });
    // Reset image previews
    const imagePreviews = ['itemImagePreview'];
    imagePreviews.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.src = '#';
            el.style.display = 'none';
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
                console.log("[admin-main] Refreshing all data and UI (called from a manager)...");
                await loadInitialData(db);
                renderAllAdminUISections();
                console.log("[admin-main] All data and UI refreshed after manager action.");
            }
        };

        // Store module instances or init functions that return interfaces
        categoryManagerModuleInstance = initCategoryManager(commonDependencies);
        tagManagerModuleInstance = initTagManager(commonDependencies);
        effectUnitManagerModuleInstance = initEffectUnitManager(commonDependencies);
        // effectSuperCategoryManagerModuleInstance = initEffectSuperCategoryManager(commonDependencies);
        effectTypeManagerModuleInstance = initEffectTypeManager(commonDependencies);
        charBaseManagerModuleInstance = initCharBaseManager({ ...commonDependencies, baseTypeMappingsFromMain: baseTypeMappings });
        initItemManager({ ...commonDependencies, uploadWorkerUrl: IMAGE_UPLOAD_WORKER_URL });

        renderAllAdminUISections();

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
    // if (typeof renderEffectSuperCategoriesUI === 'function') renderEffectSuperCategoriesUI();
    if (typeof renderEffectTypesUI === 'function') renderEffectTypesUI();
    if (typeof renderCharBaseOptionsUI === 'function') {
        // Ensure the char base type selector is populated and current type is set before rendering options
        const currentBaseType = DOM.selectedCharBaseTypeInput ? DOM.selectedCharBaseTypeInput.value : 'headShape';
        const displaySpan = document.getElementById('selectedCharBaseTypeDisplay');
        if (displaySpan && baseTypeMappings[currentBaseType]) displaySpan.textContent = baseTypeMappings[currentBaseType];
        renderCharBaseOptionsUI();
    }
    if (typeof renderItemsTableUI === 'function') renderItemsTableUI();

    if (typeof populateTagFormCategories === 'function') populateTagFormCategories(document.getElementById('newTagCategoriesCheckboxes'));
    if (typeof populateEffectTypeSelectsInForms === 'function') populateEffectTypeSelectsInForms();
    if (typeof populateCharBaseEffectTypeSelectInModal === 'function') populateCharBaseEffectTypeSelectInModal();
    if (typeof populateItemFormTags === 'function') populateItemFormTags();

    console.log("[admin-main] All admin UI sections rendering process complete.");
}


// --- List Enlargement Modal Logic ---
function setupEnlargementButtonListeners() {
    const buttonConfig = [
        { btn: DOM.enlargeCategoryListButton, type: 'category', title: 'カテゴリ一覧', sourceFn: getAllCategoriesCache, searchInputId: 'categorySearchInput' },
        { btn: DOM.enlargeTagListButton, type: 'tag', title: 'タグ一覧', sourceFn: getAllTagsCache, searchInputId: 'tagSearchInput' },
        { btn: DOM.enlargeEffectUnitListButton, type: 'effectUnit', title: '効果単位一覧', sourceFn: getEffectUnitsCache, searchInputId: null }, // No search for units for now
        { btn: DOM.enlargeEffectSuperCategoryListButton, type: 'effectSuperCategory', title: '効果大分類一覧', sourceFn: () => { /* getEffectSuperCategoriesCache */ return []; }, searchInputId: null },
        { btn: DOM.enlargeEffectTypeListButton, type: 'effectType', title: '効果種類一覧', sourceFn: getEffectTypesCache, searchInputId: null }, // No search for types for now
        { btn: DOM.enlargeCharBaseOptionListButton, type: 'charBaseOption', titleGetter: () => `${baseTypeMappings[DOM.selectedCharBaseTypeInput.value] || '基礎情報'} の選択肢一覧`, sourceFn: () => getCharacterBasesCache()[DOM.selectedCharBaseTypeInput.value] || [], searchInputId: null }
    ];

    buttonConfig.forEach(config => {
        if (config.btn) {
            config.btn.addEventListener('click', () => {
                const items = config.sourceFn();
                const title = typeof config.titleGetter === 'function' ? config.titleGetter() : config.title;
                openEnlargedListModal(items, config.type, title, config.searchInputId);
            });
        }
    });
}

function openEnlargedListModal(items, type, title, originalSearchInputId) {
    if (!DOM.listEnlargementModal || !DOM.listEnlargementModalTitle || !DOM.listEnlargementModalContent || !DOM.listEnlargementModalSearchContainer) return;

    DOM.listEnlargementModalTitle.textContent = title;
    DOM.listEnlargementModalSearchContainer.innerHTML = ''; // Clear previous search

    let searchInputForEnlarged = null;
    if (originalSearchInputId) {
        searchInputForEnlarged = document.createElement('input');
        searchInputForEnlarged.type = 'text';
        searchInputForEnlarged.placeholder = `${title.replace('一覧','')}を検索...`;
        searchInputForEnlarged.className = 'form-control'; // General styling
        searchInputForEnlarged.style.marginBottom = '1rem';
        searchInputForEnlarged.ariaLabel = `${title}内を検索`;
        DOM.listEnlargementModalSearchContainer.appendChild(searchInputForEnlarged);
    }

    const renderContent = (filterTerm = '') => {
        DOM.listEnlargementModalContent.innerHTML = '';
        if (!items || items.length === 0) {
            DOM.listEnlargementModalContent.innerHTML = '<p>表示する項目がありません。</p>';
            return;
        }
        const filteredItems = filterTerm ? items.filter(item => item.name && item.name.toLowerCase().includes(filterTerm.toLowerCase())) : items;

        if (filteredItems.length === 0) {
            DOM.listEnlargementModalContent.innerHTML = '<p>検索条件に一致する項目はありません。</p>';
            return;
        }

        filteredItems.sort((a,b) => (a.name || "").localeCompare(b.name || "", 'ja')).forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.classList.add('list-item'); // Use existing list-item styling

            const nameSpan = document.createElement('span');
            nameSpan.classList.add('list-item-name-clickable'); // Make it look clickable
            nameSpan.textContent = item.name;
            if (type === 'category') {
                const parentCat = getAllCategoriesCache().find(p => p.id === item.parentId);
                nameSpan.textContent += parentCat ? ` (親: ${parentCat.name})` : (item.parentId ? ' (親:不明)' : ' (親カテゴリ)');
            } else if (type === 'tag') {
                 const belongingCategoriesNames = (item.categoryIds || [])
                    .map(catId => getAllCategoriesCache().find(c => c.id === catId)?.name)
                    .filter(name => name).join(', ') || '未分類';
                nameSpan.textContent += ` (所属: ${belongingCategoriesNames})`;
            } else if (type === 'effectUnit') {
                nameSpan.textContent += item.position === 'prefix' ? ' (前)' : ' (後)';
            }
            // Add more type-specific info if needed

            nameSpan.dataset.id = item.id;
            nameSpan.dataset.type = type; // Store type for edit click

            nameSpan.addEventListener('click', (e) => {
                const itemId = e.target.dataset.id;
                const itemType = e.target.dataset.type;
                closeModalHelper('listEnlargementModal');

                // This needs to call the correct openEdit function based on itemType
                // We need to ensure these functions are accessible here.
                // Option 1: Pass manager instances or specific functions to admin-main.
                // Option 2: Make openEdit functions globally available (less ideal).
                // Option 3: Have admin-main orchestrate, calling imported functions.
                // Using a simplified approach for now, assuming functions can be called.
                if (itemType === 'category') categoryManagerModuleInstance.openEditCategoryModalById(itemId);
                else if (itemType === 'tag') tagManagerModuleInstance.openEditTagModalById(itemId);
                else if (itemType === 'effectUnit') effectUnitManagerModuleInstance.openEditEffectUnitModalById(itemId);
                // else if (itemType === 'effectSuperCategory') effectSuperCategoryManagerModuleInstance.openEditEffectSuperCategoryModalById(itemId);
                else if (itemType === 'effectType') effectTypeManagerModuleInstance.openEditEffectTypeModalById(itemId);
                else if (itemType === 'charBaseOption') {
                    const activeBaseType = DOM.selectedCharBaseTypeInput.value; // Get current base type for char options
                    charBaseManagerModuleInstance.openEditCharBaseOptionModalById(itemId, activeBaseType);
                }

            });

            itemDiv.appendChild(nameSpan);
            DOM.listEnlargementModalContent.appendChild(itemDiv);
        });
    };

    if (searchInputForEnlarged) {
        searchInputForEnlarged.addEventListener('input', (e) => {
            renderContent(e.target.value);
        });
    }
    renderContent(); // Initial render
    openModalHelper('listEnlargementModal');
}

// Stubs for manager modules if they return an interface (adjust as per actual implementation)
// These are illustrative. The actual way to call manager functions would be via direct imports
// or methods on instances returned by their init functions.
function getCategoryManagerModule() { /* placeholder */ return categoryManagerModuleInstance; }
function getTagManagerModule() { /* placeholder */ return tagManagerModuleInstance; }


// Example of how manager instances might be stored IF their init functions return them.
// This is one way to make their methods callable from admin-main.
// The current approach is more direct calls to exported functions from managers.
// initCategoryManager might return { openEditCategoryModalById: func, ... }
// categoryManagerModuleInstance = initCategoryManager(commonDependencies);
