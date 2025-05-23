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
    enlargeCategoryListButton: null,
    enlargeTagListButton: null,
    enlargeEffectUnitListButton: null,
    enlargeEffectSuperCategoryListButton: null,
    enlargeEffectTypeListButton: null,
    enlargeCharBaseOptionListButton: null,
    charBaseTypeButtons: null,
    selectedCharBaseTypeInput: null,
};

// let wasEnlargedModalOpen = false; // ★★★ 削除: 不要になった ★★★
// let lastEnlargedModalConfig = null; // ★★★ 削除: 不要になった ★★★

document.addEventListener('DOMContentLoaded', () => {
    DOM.adminSideNav = document.getElementById('adminSideNav');
    DOM.adminHamburgerButton = document.getElementById('adminHamburgerButton');
    DOM.adminCloseNavButton = document.getElementById('adminCloseNavButton');
    DOM.adminNavButtons = document.querySelectorAll('.admin-nav-button');
    DOM.listEnlargementModal = document.getElementById('listEnlargementModal');
    DOM.listEnlargementModalTitle = document.getElementById('listEnlargementModalTitle');
    DOM.listEnlargementModalSearchContainer = document.getElementById('listEnlargementModalSearchContainer');
    DOM.listEnlargementModalContent = document.getElementById('listEnlargementModalContent');
    
    DOM.enlargeCategoryListButton = document.getElementById('enlargeCategoryListButton');
    DOM.enlargeTagListButton = document.getElementById('enlargeTagListButton');
    DOM.enlargeEffectUnitListButton = document.getElementById('enlargeEffectUnitListButton');
    DOM.enlargeEffectSuperCategoryListButton = document.getElementById('enlargeEffectSuperCategoryListButton');
    DOM.enlargeEffectTypeListButton = document.getElementById('enlargeEffectTypeListButton');
    DOM.enlargeCharBaseOptionListButton = document.getElementById('enlargeCharBaseOptionListButton');
    
    DOM.charBaseTypeButtons = document.getElementById('charBaseTypeButtons');
    DOM.selectedCharBaseTypeInput = document.getElementById('selectedCharBaseType');

    initUIHelpers();
    initAuth(auth, 
        (user) => { 
            console.log("[admin-main] User logged in, displaying admin content.");
            document.getElementById('password-prompt').style.display = 'none';
            const adminContentEl = document.getElementById('admin-content');
            if (adminContentEl) adminContentEl.style.display = 'block';
            const currentUserEmailSpan = document.getElementById('currentUserEmail');
            if (user && currentUserEmailSpan) currentUserEmailSpan.textContent = `ログイン中: ${user.email}`;
            setupAdminNav();
            loadAndInitializeAdminModules();
        }, 
        () => { 
            console.log("[admin-main] User logged out, hiding admin content.");
            document.getElementById('password-prompt').style.display = 'flex';
            const adminContentEl = document.getElementById('admin-content');
            if (adminContentEl) adminContentEl.style.display = 'none';
            if (DOM.adminSideNav) DOM.adminSideNav.classList.remove('open');
            const currentUserEmailSpan = document.getElementById('currentUserEmail');
            if (currentUserEmailSpan) currentUserEmailSpan.textContent = '';
            clearAdminUIAndData();
        }
    );

    // ★★★ adminEditModalClosed イベントリスナーを削除 (またはコメントアウト) ★★★
    // document.addEventListener('adminEditModalClosed', (e) => { ... });
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
            refreshAllData: async () => { /* ... */ },
            // ★★★ openEnlargedListModalCallbackFromMain に渡す関数を修正 ★★★
            openEnlargedListModal: (config) => { // This is the function passed to managers
                const items = typeof config.sourceFn === 'function' ? config.sourceFn() : config.sourceItems || [];
                const searchTerm = config.searchInputId ? document.getElementById(config.searchInputId)?.value || "" : config.currentSearchTerm || "";
                openEnlargedListModal( // Calls the admin-main's openEnlargedListModal
                    items,
                    config.itemType,
                    config.title,
                    config.searchInputId || null,
                    config.editFunction,
                    config.displayRenderer, // This should be a function
                    searchTerm
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

function renderAllAdminUISections() { /* ... (変更なし、効果大分類のレンダリング呼び出し確認) ... */ 
    console.log("[admin-main] Rendering all admin UI sections...");
    if (typeof renderCategoriesUI === 'function') renderCategoriesUI();
    if (typeof renderTagsUI === 'function') renderTagsUI();
    if (typeof renderEffectUnitsUI === 'function') renderEffectUnitsUI();
    if (typeof renderEffectSuperCategoriesUI === 'function') renderEffectSuperCategoriesUI(); // Ensure this is called
    if (typeof renderEffectTypesUI === 'function') renderEffectTypesUI();
    // ... (rest is same)
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
            const newBtn = config.btn.cloneNode(true);
            config.btn.parentNode.replaceChild(newBtn, config.btn);
            newBtn.addEventListener('click', () => { // Add listener to the new button
                const items = config.sourceFn();
                const title = typeof config.titleGetter === 'function' ? config.titleGetter() : config.title;
                const currentSearchTerm = config.searchInputId ? document.getElementById(config.searchInputId)?.value || "" : "";
                
                // lastEnlargedModalConfig は不要になったため削除
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

    // wasEnlargedModalOpen フラグと lastEnlargedModalConfig は不要になったため削除

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
        if (filterTerm && items) { // Ensure items is not null/undefined
            itemsToRender = items.filter(item => item.name && item.name.toLowerCase().includes(filterTerm.toLowerCase()));
        } else if (!items) {
            itemsToRender = []; // Handle case where items might be undefined
        }


        if (!itemsToRender || itemsToRender.length === 0) {
            DOM.listEnlargementModalContent.innerHTML = filterTerm ? '<p>検索条件に一致する項目はありません。</p>' : '<p>表示する項目がありません。</p>';
            return;
        }
        
        if (typeof displayRenderer === 'function' && type === 'category') {
            const listDOM = displayRenderer(itemsToRender, getAllCategoriesCache(), true); 
            if (listDOM) {
                DOM.listEnlargementModalContent.appendChild(listDOM);
                DOM.listEnlargementModalContent.querySelectorAll('.category-tree-item[data-category-id]').forEach(li => {
                    const contentDiv = li.querySelector('.category-tree-content');
                    if (contentDiv && typeof editFunction === 'function') {
                        contentDiv.classList.add('list-item-name-clickable');
                        const newContentDiv = contentDiv.cloneNode(true);
                        contentDiv.parentNode.replaceChild(newContentDiv, contentDiv);
                        newContentDiv.addEventListener('click', (e) => {
                            if (e.target.closest('.category-tree-expander')) return;
                            const catId = li.dataset.categoryId;
                            // ★★★ 拡大モーダルは閉じない ★★★
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
                if (type === 'tag') { /* ... */ }
                else if (type === 'effectUnit') { /* ... */ }
                else if (type === 'effectSuperCategory') {
                    const typesCount = (getEffectTypesCache() || []).filter(et => et.superCategoryId === item.id).length;
                    displayText += ` (${typesCount} 効果種類)`;
                }
                else if (type === 'effectType') { /* ... */ }
                else if (type === 'charBaseOption') { /* ... */ }
                nameSpan.textContent = displayText;
                nameSpan.dataset.id = item.id;

                if (typeof editFunction === 'function') {
                    nameSpan.addEventListener('click', (e) => {
                        const itemId = e.target.dataset.id;
                        // ★★★ 拡大モーダルは閉じない ★★★
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
