// js/admin-main.js
import { auth, db } from '../firebase-config.js';
import { initAuth } from './admin-modules/auth.js';
import {
    loadInitialData,
    clearAdminDataCache,
    IMAGE_UPLOAD_WORKER_URL,
    getAllCategoriesCache,
    getAllTagsCache,
    getItemsCache,
    getEffectTypesCache,
    getEffectUnitsCache,
    getEffectSuperCategoriesCache,
    getCharacterBasesCache
} from './admin-modules/data-loader-admin.js';
import { initUIHelpers, openModal as openModalHelper, closeModal as closeModalHelper } from './admin-modules/ui-helpers.js';

import { initCategoryManager, _renderCategoriesForManagementInternal as renderCategoriesUI, openEditCategoryModalById, buildCategoryTreeDOM as buildCategoryTreeDOMFromManager } from './admin-modules/category-manager.js';
import { initTagManager, _renderTagsForManagementInternal as renderTagsUI, _populateCategoryCheckboxesForTagFormInternal as populateTagFormCategories, openEditTagModalById } from './admin-modules/tag-manager.js';
import { initEffectUnitManager, _renderEffectUnitsForManagementInternal as renderEffectUnitsUI, openEditEffectUnitModalById } from './admin-modules/effect-unit-manager.js';
import { initEffectSuperCategoryManager, _renderEffectSuperCategoriesForManagementInternal as renderEffectSuperCategoriesUI, openEditEffectSuperCategoryModalById as openEditEscModal } from './admin-modules/effect-super-category-manager.js';
import { initEffectTypeManager, _renderEffectTypesForManagementInternal as renderEffectTypesUI, _populateEffectTypeSelectsInternal as populateEffectTypeSelectsInForms, openEditEffectTypeModalById as openEditEtModal } from './admin-modules/effect-type-manager.js';
import { initCharBaseManager, _renderCharacterBaseOptionsInternal as renderCharBaseOptionsUI, _populateCharBaseEffectTypeSelectInternal as populateCharBaseEffectTypeSelectInModal, baseTypeMappings, openEditCharBaseOptionModalById as openEditCboModal } from './admin-modules/char-base-manager.js';
import { initItemManager, _renderItemsAdminTableInternal as renderItemsTableUI, _populateTagCheckboxesForItemFormInternal as populateItemFormTags } from './admin-modules/item-manager.js';

const DOM = {
    adminSideNav: null,
    adminHamburgerButton: null,
    adminCloseNavButton: null,
    adminNavButtons: null,
    listEnlargementModal: null,
    listEnlargementModalTitle: null,
    listEnlargementModalSearchContainer: null,
    listEnlargementModalContent: null,
    categoryManagementModal: null,
    tagManagementModal: null,
    effectUnitManagementModal: null,
    effectSuperCategoryManagementModal: null,
    effectTypeManagementModal: null,
    characterBaseManagementModal: null,
    enlargeCategoryListButton: null,
    enlargeTagListButton: null,
    enlargeEffectUnitListButton: null,
    enlargeEffectSuperCategoryListButton: null,
    enlargeEffectTypeListButton: null,
    enlargeCharBaseOptionListButton: null,
    charBaseTypeButtons: null,
    selectedCharBaseTypeInput: null,
};

let wasEnlargedModalOpen = false;
let lastEnlargedModalConfig = null;

document.addEventListener('DOMContentLoaded', () => {
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

    initUIHelpers();
    initAuth(auth, (user) => {
        console.log("[admin-main] User logged in");
        document.getElementById('password-prompt').style.display = 'none';
        document.getElementById('admin-content').style.display = 'block';
        const emailSpan = document.getElementById('currentUserEmail');
        if (user && emailSpan) emailSpan.textContent = `ログイン中: ${user.email}`;
        setupAdminNav();
        loadAndInitializeAdminModules();
    }, () => {
        console.log("[admin-main] User logged out");
        document.getElementById('password-prompt').style.display = 'flex';
        document.getElementById('admin-content').style.display = 'none';
        if (DOM.adminSideNav) DOM.adminSideNav.classList.remove('open');
        const emailSpan = document.getElementById('currentUserEmail');
        if (emailSpan) emailSpan.textContent = '';
        clearAdminUIAndData();
    });

    document.addEventListener('adminEditModalClosed', (e) => {
        if (wasEnlargedModalOpen && lastEnlargedModalConfig && lastEnlargedModalConfig.sourceFn) {
            console.log(`Edit modal ${e.detail.modalId} closed, re-opening last enlarged list: ${lastEnlargedModalConfig.title}`);
            const updatedItems = lastEnlargedModalConfig.sourceFn(); // Re-fetch data
            openEnlargedListModal(
                updatedItems,
                lastEnlargedModalConfig.type,
                lastEnlargedModalConfig.title,
                lastEnlargedModalConfig.searchInputId,
                lastEnlargedModalConfig.editFn,
                lastEnlargedModalConfig.displayRenderer, // Pass the stored renderer
                lastEnlargedModalConfig.currentSearchTerm // Pass the stored search term
            );
            // Do not reset wasEnlargedModalOpen here; it's reset when enlarged modal itself closes
        } else {
            wasEnlargedModalOpen = false; // Reset if no valid config to reopen
            lastEnlargedModalConfig = null;
        }
    });

    // Handle closing of the enlargement modal to reset flags
    if (DOM.listEnlargementModal) {
        const closeBtn = DOM.listEnlargementModal.querySelector('.close-button');
        if (closeBtn) {
            // Ensure only one listener, or use a more robust method
            const newCloseBtn = closeBtn.cloneNode(true);
            closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
            newCloseBtn.addEventListener('click', () => {
                wasEnlargedModalOpen = false;
                lastEnlargedModalConfig = null;
                closeModalHelper('listEnlargementModal');
            });
        }
        DOM.listEnlargementModal.addEventListener('click', function(event) {
            if (event.target === this) { // Overlay click
                wasEnlargedModalOpen = false;
                lastEnlargedModalConfig = null;
                closeModalHelper('listEnlargementModal');
            }
        });
    }
});

function setupAdminNav() { /* ... (変更なし) ... */ }
function setupCharBaseTypeButtons() { /* ... (変更なし) ... */ }
function clearAdminUIAndData() { /* ... (変更なし) ... */ }

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
                console.log("[admin-main] Refreshing all data and UI...");
                await loadInitialData(db);
                renderAllAdminUISections();
                console.log("[admin-main] All data and UI refreshed.");
            },
            openEnlargedListModal: (config) => { // Pass config object
                // The actual call to openEnlargedListModal is done in setupEnlargementButtonListeners
                // This callback is if a manager *itself* needs to trigger the generic modal,
                // which is less common for "list enlargement" context.
                // For clarity, the call in enlargeButton listener is more direct.
                // If a manager needs to open an enlarged list of *its own items* it would call this.
                openEnlargedListModal(
                    config.sourceItems || config.sourceFn(), // Allow passing items directly or a source function
                    config.itemType,
                    config.title,
                    config.searchInputId || null,
                    config.editFunction,
                    config.displayRenderer,
                    config.currentSearchTerm || ""
                );
            }
        };

        initCategoryManager(commonDependencies);
        initTagManager(commonDependencies);
        initEffectUnitManager(commonDependencies);
        initEffectSuperCategoryManager(commonDependencies);
        initEffectTypeManager(commonDependencies);
        initCharBaseManager({ ...commonDependencies, baseTypeMappingsFromMain: baseTypeMappings });
        initItemManager({ ...commonDependencies, uploadWorkerUrl: IMAGE_UPLOAD_WORKER_URL });

        renderAllAdminUISections();
        console.log("[admin-main] Admin modules initialized and initial UI rendered successfully.");
    } catch (error) { /* ... (変更なし) ... */ }
}

function renderAllAdminUISections() {
    console.log("[admin-main] Rendering all admin UI sections...");
    if (typeof renderCategoriesUI === 'function') renderCategoriesUI();
    if (typeof renderTagsUI === 'function') renderTagsUI();
    if (typeof renderEffectUnitsUI === 'function') renderEffectUnitsUI();
    if (typeof renderEffectSuperCategoriesUI === 'function') renderEffectSuperCategoriesUI();
    if (typeof renderEffectTypesUI === 'function') renderEffectTypesUI();
    if (typeof renderCharBaseOptionsUI === 'function') {
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

function setupEnlargementButtonListeners() {
    const buttonConfig = [
        { btn: DOM.enlargeCategoryListButton, type: 'category', title: 'カテゴリ一覧', sourceFn: getAllCategoriesCache, searchInputId: 'categorySearchInput', editFn: openEditCategoryModalById, displayRenderer: buildCategoryTreeDOMFromManager },
        { btn: DOM.enlargeTagListButton, type: 'tag', title: 'タグ一覧', sourceFn: getAllTagsCache, searchInputId: 'tagSearchInput', editFn: openEditTagModalById },
        { btn: DOM.enlargeEffectUnitListButton, type: 'effectUnit', title: '効果単位一覧', sourceFn: getEffectUnitsCache, searchInputId: null, editFn: openEditEffectUnitModalById },
        { btn: DOM.enlargeEffectSuperCategoryListButton, type: 'effectSuperCategory', title: '効果大分類一覧', sourceFn: getEffectSuperCategoriesCache, searchInputId: null, editFn: openEditEscModal },
        { btn: DOM.enlargeEffectTypeListButton, type: 'effectType', title: '効果種類一覧', sourceFn: getEffectTypesCache, searchInputId: null, editFn: openEditEtModal },
        { btn: DOM.enlargeCharBaseOptionListButton, type: 'charBaseOption', titleGetter: () => `${baseTypeMappings[DOM.selectedCharBaseTypeInput.value] || '基礎情報'} の選択肢一覧`, sourceFn: () => (getCharacterBasesCache()[DOM.selectedCharBaseTypeInput.value] || []), searchInputId: null, editFn: (id) => openEditCboModal(id, DOM.selectedCharBaseTypeInput.value) }
    ];

    buttonConfig.forEach(config => {
        if (config.btn) {
            // Remove existing listener before adding, to prevent duplicates if this function is called multiple times
            const newBtn = config.btn.cloneNode(true);
            config.btn.parentNode.replaceChild(newBtn, config.btn);
            config.btn = newBtn; // Update reference in config

            config.btn.addEventListener('click', () => {
                const items = config.sourceFn();
                const title = typeof config.titleGetter === 'function' ? config.titleGetter() : config.title;
                const currentSearchTerm = config.searchInputId ? document.getElementById(config.searchInputId)?.value || "" : "";
                
                lastEnlargedModalConfig = { 
                    sourceFn: config.sourceFn, // Store sourceFn to re-fetch fresh data
                    type: config.type,
                    title: title,
                    searchInputId: config.searchInputId,
                    currentSearchTerm: currentSearchTerm,
                    editFn: config.editFn,
                    displayRenderer: config.displayRenderer 
                };
                openEnlargedListModal(
                    items, // Pass currently fetched items for initial display
                    config.type, 
                    title, 
                    config.searchInputId, 
                    config.editFn, 
                    config.displayRenderer,
                    currentSearchTerm
                );
            });
        }
    });
}

function openEnlargedListModal(items, type, title, originalSearchInputId, editFunction, displayRenderer, initialSearchTerm = "") {
    if (!DOM.listEnlargementModal || !DOM.listEnlargementModalTitle || !DOM.listEnlargementModalContent || !DOM.listEnlargementModalSearchContainer) {
        console.error("Enlargement modal DOM elements not found!");
        return;
    }

    wasEnlargedModalOpen = true; 
    // lastEnlargedModalConfig is set by the caller (setupEnlargementButtonListeners)

    DOM.listEnlargementModalTitle.textContent = title;
    DOM.listEnlargementModalSearchContainer.innerHTML = '';

    let searchInputForEnlarged = null;
    if (originalSearchInputId) {
        // const originalInput = document.getElementById(originalSearchInputId); // Not needed if initialSearchTerm is passed
        searchInputForEnlarged = document.createElement('input');
        searchInputForEnlarged.type = 'text';
        searchInputForEnlarged.placeholder = `${title.replace('一覧','')}内をフィルタ...`;
        searchInputForEnlarged.className = 'form-control';
        searchInputForEnlarged.style.marginBottom = '1rem';
        searchInputForEnlarged.ariaLabel = `${title}内を検索`;
        DOM.listEnlargementModalSearchContainer.appendChild(searchInputForEnlarged);
        searchInputForEnlarged.value = initialSearchTerm; 
    }

    const renderContent = (filterTerm = '') => {
        DOM.listEnlargementModalContent.innerHTML = '';
        let itemsToRender = items; // Use initially passed items for filtering
        if (filterTerm) {
            itemsToRender = items.filter(item => item.name && item.name.toLowerCase().includes(filterTerm.toLowerCase()));
        }

        if (!itemsToRender || itemsToRender.length === 0) {
            DOM.listEnlargementModalContent.innerHTML = filterTerm ? '<p>検索条件に一致する項目はありません。</p>' : '<p>表示する項目がありません。</p>';
            return;
        }
        
        if (typeof displayRenderer === 'function') {
            // For categories, displayRenderer is buildCategoryTreeDOMFromManager
            const listDOM = displayRenderer(itemsToRender, getAllCategoriesCache(), true); // isEnlarged = true
            if (listDOM) {
                DOM.listEnlargementModalContent.appendChild(listDOM);
                // Add click listeners for items rendered by displayRenderer (specifically for category tree)
                if (type === 'category') {
                    DOM.listEnlargementModalContent.querySelectorAll('.category-tree-item[data-category-id]').forEach(li => {
                        const contentDiv = li.querySelector('.category-tree-content');
                        if (contentDiv && typeof editFunction === 'function') {
                            contentDiv.classList.add('list-item-name-clickable');
                            // Ensure only one listener
                            const newContentDiv = contentDiv.cloneNode(true);
                            contentDiv.parentNode.replaceChild(newContentDiv, contentDiv);
                            newContentDiv.addEventListener('click', (e) => {
                                if (e.target.closest('.category-tree-expander')) return;
                                const catId = li.dataset.categoryId;
                                closeModalHelper('listEnlargementModal'); // Close enlargement modal first
                                // wasEnlargedModalOpen is still true here, adminEditModalClosed listener will use it
                                editFunction(catId);
                            });
                        }
                    });
                }
            } else {
                DOM.listEnlargementModalContent.innerHTML = `<p>${title}の表示に失敗しました。</p>`;
            }
        } else { // Default simple list rendering for other types
            itemsToRender.sort((a,b) => (a.name || "").localeCompare(b.name || "", 'ja')).forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.classList.add('list-item');
                const nameSpan = document.createElement('span');
                nameSpan.classList.add('list-item-name-clickable');
                // ... (displayText logic - same as before) ...
                let displayText = item.name || '(名称未設定)';
                if (type === 'tag') {
                    const belongingCategoriesNames = (item.categoryIds || [])
                       .map(catId => getAllCategoriesCache().find(c => c.id === catId)?.name)
                       .filter(name => name).join(', ') || '未分類';
                   displayText += ` (所属: ${belongingCategoriesNames})`;
                } else if (type === 'effectUnit') {
                   displayText += item.position === 'prefix' ? ' (前)' : ' (後)';
                } else if (type === 'effectSuperCategory') { // For effectSuperCategory
                    // No extra info for now, or add count of associated effect types
                    const typesCount = getEffectTypesCache().filter(et => et.superCategoryId === item.id).length;
                    displayText += ` (${typesCount} 効果種類)`;
                } else if (type === 'effectType') {
                    const superCat = getEffectSuperCategoriesCache().find(sc => sc.id === item.superCategoryId);
                    displayText += superCat ? ` (大分類: ${superCat.name})` : ' (大分類:未設定)';
                    displayText += item.defaultUnit && item.defaultUnit !== 'none' ? ` [${item.defaultUnit}]` : ' [単位なし]';
                } else if (type === 'charBaseOption') {
                   if (item.effects && item.effects.length > 0) { /* ... */ } else { displayText += ' (効果なし)';}
                }
                nameSpan.textContent = displayText;
                nameSpan.dataset.id = item.id;

                if (typeof editFunction === 'function') {
                    nameSpan.addEventListener('click', (e) => {
                        const itemId = e.target.dataset.id;
                        closeModalHelper('listEnlargementModal');
                        // wasEnlargedModalOpen = true; // Already set
                        editFunction(itemId);
                    });
                } else { nameSpan.style.cursor = 'default'; }
                itemDiv.appendChild(nameSpan);
                DOM.listEnlargementModalContent.appendChild(itemDiv);
            });
        }
    };

    if (searchInputForEnlarged) {
        searchInputForEnlarged.addEventListener('input', (e) => {
            renderContent(e.target.value);
        });
        renderContent(searchInputForEnlarged.value); // Render with initial (possibly copied) search term
    } else {
        renderContent();
    }
    openModalHelper('listEnlargementModal');
}

// No need for categoryManager_buildCategoryTreeDOMForEnlarged here anymore,
// as we pass category-manager's own buildCategoryTreeDOMFromManager as a displayRenderer
