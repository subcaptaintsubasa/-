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

// Import manager init functions AND their specific openEditModalById functions
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
        console.log("[admin-main] User logged in, displaying admin content.");
        document.getElementById('password-prompt').style.display = 'none';
        const adminContentEl = document.getElementById('admin-content');
        if (adminContentEl) adminContentEl.style.display = 'block';
        const currentUserEmailSpan = document.getElementById('currentUserEmail');
        if (user && currentUserEmailSpan) currentUserEmailSpan.textContent = `ログイン中: ${user.email}`;
        setupAdminNav();
        loadAndInitializeAdminModules();
    }, () => {
        console.log("[admin-main] User logged out, hiding admin content.");
        const passwordPromptEl = document.getElementById('password-prompt');
        if(passwordPromptEl) passwordPromptEl.style.display = 'flex';
        const adminContentEl = document.getElementById('admin-content');
        if (adminContentEl) adminContentEl.style.display = 'none';
        if (DOM.adminSideNav) DOM.adminSideNav.classList.remove('open');
        const currentUserEmailSpan = document.getElementById('currentUserEmail');
        if (currentUserEmailSpan) currentUserEmailSpan.textContent = '';
        clearAdminUIAndData();
    });

    document.addEventListener('adminEditModalClosed', (e) => {
        if (wasEnlargedModalOpen && lastEnlargedModalConfig && lastEnlargedModalConfig.sourceFn) {
            console.log(`Edit modal ${e.detail.modalId} closed, re-opening last enlarged list: ${lastEnlargedModalConfig.title}`);
            const updatedItems = lastEnlargedModalConfig.sourceFn();
            openEnlargedListModal(
                updatedItems,
                lastEnlargedModalConfig.type,
                lastEnlargedModalConfig.title,
                lastEnlargedModalConfig.searchInputId,
                lastEnlargedModalConfig.editFn,
                lastEnlargedModalConfig.displayRenderer,
                lastEnlargedModalConfig.currentSearchTerm
            );
        } else {
            wasEnlargedModalOpen = false; 
            lastEnlargedModalConfig = null;
        }
    });

    if (DOM.listEnlargementModal) {
        const closeBtn = DOM.listEnlargementModal.querySelector('.close-button');
        if (closeBtn) {
            const newCloseBtn = closeBtn.cloneNode(true);
            closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
            newCloseBtn.addEventListener('click', () => {
                wasEnlargedModalOpen = false;
                lastEnlargedModalConfig = null;
                closeModalHelper('listEnlargementModal');
            });
        }
        DOM.listEnlargementModal.addEventListener('click', function(event) {
            if (event.target === this) {
                wasEnlargedModalOpen = false;
                lastEnlargedModalConfig = null;
                closeModalHelper('listEnlargementModal');
            }
        });
    }
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
    DOM.charBaseTypeButtons.innerHTML = ''; 
    Object.entries(baseTypeMappings).forEach(([key, displayName]) => {
        const button = document.createElement('div');
        button.className = 'category-select-button';
        button.textContent = displayName;
        button.dataset.baseTypeKey = key;
        if (DOM.selectedCharBaseTypeInput.value === key) button.classList.add('active');
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
    const listContainersIds = ['categoryListContainer', 'tagListContainer', 'effectUnitListContainer', 'effectSuperCategoryListContainer', 'effectTypeListContainer', 'charBaseOptionListContainer'];
    listContainersIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<p>ログアウトしました。データは表示されません。</p>';
    });
    const itemsTableBody = document.querySelector('#itemsTable tbody');
    if (itemsTableBody) itemsTableBody.innerHTML = '';
    document.querySelectorAll('#admin-content form').forEach(form => {
        if (typeof form.reset === 'function') form.reset();
    });
    document.querySelectorAll('.checkbox-group-container, .category-button-group.admin, .tag-button-container.admin').forEach(container => container.innerHTML = '');
    const effectsLists = ['currentEffectsList', 'currentCharBaseOptionEffectsList'];
    effectsLists.forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = '<p>効果が追加されていません。</p>'; });
    const imagePreviews = ['itemImagePreview'];
    imagePreviews.forEach(id => { const el = document.getElementById(id); if (el) { el.src = '#'; el.style.display = 'none'; } });
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
                console.log("[admin-main] Refreshing all data and UI...");
                await loadInitialData(db);
                renderAllAdminUISections();
                console.log("[admin-main] All data and UI refreshed.");
            },
            openEnlargedListModal: (config) => {
                openEnlargedListModal(
                    config.sourceItems || config.sourceFn(),
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
    } catch (error) {
        console.error("[admin-main] CRITICAL ERROR during admin panel initialization:", error);
        alert("管理パネルの初期化中に重大なエラーが発生しました。コンソールを確認してください。");
        const adminContainer = document.getElementById('admin-content')?.querySelector('.container');
        if (adminContainer) adminContainer.innerHTML = `<p class="error-message" style="text-align:center;padding:20px;color:red;">管理データの読み込みまたは表示に失敗しました。</p>`;
    }
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
            const newBtn = config.btn.cloneNode(true); // Prevent multiple listeners on original
            config.btn.parentNode.replaceChild(newBtn, config.btn);
            config.btn = newBtn; 

            config.btn.addEventListener('click', () => {
                const items = config.sourceFn();
                const title = typeof config.titleGetter === 'function' ? config.titleGetter() : config.title;
                const currentSearchTerm = config.searchInputId ? document.getElementById(config.searchInputId)?.value || "" : "";
                
                lastEnlargedModalConfig = { 
                    sourceFn: config.sourceFn,
                    type: config.type,
                    title: title,
                    searchInputId: config.searchInputId,
                    currentSearchTerm: currentSearchTerm,
                    editFn: config.editFn,
                    displayRenderer: config.displayRenderer 
                };
                openEnlargedListModal(
                    items, 
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

    DOM.listEnlargementModalTitle.textContent = title;
    DOM.listEnlargementModalSearchContainer.innerHTML = '';

    let searchInputForEnlarged = null;
    if (originalSearchInputId) {
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
        let itemsToRender = items; 
        if (filterTerm) {
            itemsToRender = items.filter(item => item.name && item.name.toLowerCase().includes(filterTerm.toLowerCase()));
        }

        if (!itemsToRender || itemsToRender.length === 0) {
            DOM.listEnlargementModalContent.innerHTML = filterTerm ? '<p>検索条件に一致する項目はありません。</p>' : '<p>表示する項目がありません。</p>';
            return;
        }
        
        if (typeof displayRenderer === 'function' && type === 'category') { // Only use custom renderer for category for now
            const listDOM = displayRenderer(itemsToRender, getAllCategoriesCache(), true); 
            if (listDOM) {
                DOM.listEnlargementModalContent.appendChild(listDOM);
                DOM.listEnlargementModalContent.querySelectorAll('.category-tree-item[data-category-id]').forEach(li => {
                    const contentDiv = li.querySelector('.category-tree-content');
                    if (contentDiv && typeof editFunction === 'function') {
                        contentDiv.classList.add('list-item-name-clickable');
                        const newContentDiv = contentDiv.cloneNode(true); // Avoid multiple listeners
                        contentDiv.parentNode.replaceChild(newContentDiv, contentDiv);
                        newContentDiv.addEventListener('click', (e) => {
                            if (e.target.closest('.category-tree-expander')) return;
                            const catId = li.dataset.categoryId;
                            closeModalHelper('listEnlargementModal');
                            editFunction(catId);
                        });
                    }
                });
            } else {
                DOM.listEnlargementModalContent.innerHTML = `<p>${title}の表示に失敗しました。</p>`;
            }
        } else { 
            itemsToRender.sort((a,b) => (a.name || "").localeCompare(b.name || "", 'ja')).forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.classList.add('list-item');
                const nameSpan = document.createElement('span');
                nameSpan.classList.add('list-item-name-clickable');
                let displayText = item.name || '(名称未設定)';
                // Add specific details for other types
                if (type === 'tag') {
                    const belongingCategoriesNames = (item.categoryIds || [])
                       .map(catId => getAllCategoriesCache().find(c => c.id === catId)?.name)
                       .filter(name => name).join(', ') || '未分類';
                   displayText += ` (所属: ${belongingCategoriesNames})`;
                } else if (type === 'effectUnit') {
                   displayText += item.position === 'prefix' ? ' (前)' : ' (後)';
                } else if (type === 'effectSuperCategory') {
                    const typesCount = getEffectTypesCache().filter(et => et.superCategoryId === item.id).length;
                    displayText += ` (${typesCount} 効果種類)`;
                } else if (type === 'effectType') {
                    const superCat = getEffectSuperCategoriesCache().find(sc => sc.id === item.superCategoryId);
                    displayText += superCat ? ` (大分類: ${superCat.name})` : ' (大分類:未設定)';
                    displayText += item.defaultUnit && item.defaultUnit !== 'none' ? ` [${item.defaultUnit}]` : ' [単位なし]';
                } else if (type === 'charBaseOption') {
                   if (item.effects && item.effects.length > 0) {
                       const effectsSummary = item.effects.map(eff => {
                           const typeInfo = getEffectTypesCache().find(et => et.id === eff.type);
                           const unitInfo = getEffectUnitsCache().find(u => u.name === eff.unit);
                           const unitPos = unitInfo ? unitInfo.position : 'suffix';
                           const unitStr = eff.unit && eff.unit !== 'none' ? eff.unit : '';
                           const valStr = eff.value;
                           const effectValDisplay = unitPos === 'prefix' ? `${unitStr}${valStr}` : `${valStr}${unitStr}`;
                           return `${typeInfo ? typeInfo.name : '不明'} ${effectValDisplay}`;
                       }).join('; ');
                       displayText += ` (効果: ${effectsSummary.substring(0, 30)}${effectsSummary.length > 30 ? '...' : ''})`;
                   } else {
                       displayText += ' (効果なし)';
                   }
                }
                nameSpan.textContent = displayText;
                nameSpan.dataset.id = item.id;

                if (typeof editFunction === 'function') {
                    nameSpan.addEventListener('click', (e) => {
                        const itemId = e.target.dataset.id;
                        closeModalHelper('listEnlargementModal');
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
        renderContent(searchInputForEnlarged.value);
    } else {
        renderContent();
    }
    openModalHelper('listEnlargementModal');
}

// Removed categoryManager_buildCategoryTreeDOMForEnlarged as we directly use the imported one
// from category-manager (buildCategoryTreeDOMFromManager)
