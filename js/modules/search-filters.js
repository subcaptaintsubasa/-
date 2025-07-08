--- START OF FILE --main/js/modules/search-filters.js.txt ---
// js/modules/search-filters.js
// Handles search input, category/tag filtering logic, and pagination state.

import { renderItems, updateRenderConfig } from './search-render.js';
import { displaySearchToolMessage, showConfirmSelectionButton } from './ui-main.js';

// Dependencies from data-loader will be passed or accessed via getters
let getAllItemsFunc = () => [];
let getAllCategoriesFunc = () => [];
let getAllTagsFunc = () => [];
let getEffectTypesCacheFunc = () => []; // For searching by effect name
let getSlotTagIdFunc = (slotName) => null;
let simulatorParentCategoryNameConst = "装備";
let simulatorEffectChildCategoryNameConst = "効果";


const DOMF = { // DOM elements relevant to filtering
    searchInput: null,
    parentCategoryFiltersContainer: null,
    childCategoriesAndTagsContainer: null,
    resetFiltersButton: null,
    itemListContainer: null, // For scrolling into view
    searchControlsElement: null,
    confirmSelectionButton: null,
};

// Filter state
let currentSearchTerm = "";
let selectedParentCategoryIds = [];
let selectedTagIds = []; // Includes slot tag when in simulator mode

// Pagination state
let currentPage = 1;
let itemsPerPage = 10; // Configurable

// Simulator selection mode state
let isSelectingForSimulator = false;
let currentSelectingSlot = null;
let temporarilySelectedItem = null; // Item ID

let onFilterChangeCallback = () => {}; // Callback to re-render items

export function initSearchFilters(db, dependencies) { // db might not be needed if data is passed
    // Assign passed dependencies (getters for data caches)
    getAllItemsFunc = dependencies.getAllItems;
    getAllCategoriesFunc = dependencies.getAllCategories;
    getAllTagsFunc = dependencies.getAllTags;
    getEffectTypesCacheFunc = dependencies.getEffectTypesCache;
    getSlotTagIdFunc = dependencies.getSlotTagId;
    simulatorParentCategoryNameConst = dependencies.simulatorParentCategoryName;
    simulatorEffectChildCategoryNameConst = dependencies.simulatorEffectChildCategoryName;


    onFilterChangeCallback = dependencies.onFilterChange || filterAndRenderItemsInternal; // Default internal call

    DOMF.searchInput = document.getElementById('searchInput');
    DOMF.parentCategoryFiltersContainer = document.getElementById('parentCategoryFiltersContainer');
    DOMF.childCategoriesAndTagsContainer = document.getElementById('childCategoriesAndTagsContainer');
    DOMF.resetFiltersButton = document.getElementById('resetFiltersButton');
    DOMF.itemListContainer = document.getElementById('itemList'); // Used for scrollIntoView
    DOMF.searchControlsElement = document.querySelector('.search-controls');
    DOMF.confirmSelectionButton = document.getElementById('confirmSelectionButton');


    if (DOMF.searchInput) {
        DOMF.searchInput.addEventListener('input', (e) => {
            currentSearchTerm = e.target.value.toLowerCase().trim();
            currentPage = 1;
            triggerFilterChange();
        });
    }

    if (DOMF.resetFiltersButton) {
        DOMF.resetFiltersButton.addEventListener('click', () => {
            // シミュレーター選択モード中であれば、まずモードを解除する
            if (isSelectingForSimulator) {
                deactivateSimulatorSelectionMode();
            } else {
                // 通常のフィルターリセット
                currentSearchTerm = "";
                if (DOMF.searchInput) DOMF.searchInput.value = "";
                selectedParentCategoryIds = [];
                selectedTagIds = [];
                currentPage = 1;
                renderParentCategoryFilters();
                renderChildCategoriesAndTags();
                triggerFilterChange();
            }
        });
    }
    
    if (DOMF.confirmSelectionButton) {
         DOMF.confirmSelectionButton.addEventListener('click', () => {
            if (dependencies.onSelectionConfirmed && currentSelectingSlot && temporarilySelectedItem) {
                dependencies.onSelectionConfirmed(currentSelectingSlot, temporarilySelectedItem);
            } else {
                 console.warn("Confirm selection clicked but no slot or item selected, or no callback.");
                 // Fallback: just cancel selection mode
                 deactivateSimulatorSelectionMode();
            }
        });
    }


    // Listen for custom pageChange event (dispatched by search-render.js)
    document.addEventListener('pageChange', (e) => {
        if (e.detail && e.detail.newPage) {
            currentPage = e.detail.newPage;
            triggerFilterChange();
            if (DOMF.itemListContainer && DOMF.itemListContainer.offsetTop) {
                 window.scrollTo({ top: DOMF.itemListContainer.offsetTop - 80, behavior: 'smooth' });
            }
        }
    });

    // Initial render of filter UI
    renderParentCategoryFilters();
    renderChildCategoriesAndTags(); // Will likely be empty initially
}

function triggerFilterChange() {
    // ★★★ スマート更新ロジック ★★★
    if (window.appState && window.appState.isDataStale) {
        console.log('[Filters] Data is stale. Forcing a re-render of filter UI before applying filters.');
        
        // フィルターUI自体を再描画して、新しいカテゴリやタグが選択肢に現れるようにする
        renderParentCategoryFilters();
        renderChildCategoriesAndTags();
        
        // 状態フラグをリセット
        window.appState.isDataStale = false;
        
        // ユーザーに更新を通知する (script-main.jsから呼び出される)
        const event = new CustomEvent('dataRefreshed');
        document.dispatchEvent(event);
    }
    
    // Update render config before calling the callback that uses it
    updateRenderConfig({
        isSelectingForSimulator,
        temporarilySelectedItem,
        currentSelectingSlot
    });
    if (onFilterChangeCallback) {
        onFilterChangeCallback(); // This will eventually call applyFiltersAndRender
    }
}

export function applyFiltersAndRender() {
    const allItems = getAllItemsFunc();
    let filtered = [...allItems];

    // 1. Simulator Slot Tag Filter (highest priority if active)
    if (isSelectingForSimulator && currentSelectingSlot) {
        const requiredSlotTagId = getSlotTagIdFunc(currentSelectingSlot);
        if (requiredSlotTagId) {
            filtered = filtered.filter(item => item.tags && item.tags.includes(requiredSlotTagId));
        }
    }

    // 2. Search Term Filter
    if (currentSearchTerm) {
        const effectTypesCache = getEffectTypesCacheFunc();
        filtered = filtered.filter(item => {
            const nameMatch = item.name && item.name.toLowerCase().includes(currentSearchTerm);
            const sourceMatch = item.入手手段 && item.入手手段.toLowerCase().includes(currentSearchTerm);
            const priceMatch = typeof item.price === 'number' && String(item.price).includes(currentSearchTerm);
            const effectMatch = item.structured_effects && item.structured_effects.some(eff => {
                const typeInfo = effectTypesCache.find(et => et.id === eff.type);
                const typeName = typeInfo ? typeInfo.name.toLowerCase() : '';
                const unitText = (eff.unit && eff.unit !== 'none') ? eff.unit.toLowerCase() : '';
                const valueText = String(eff.value).toLowerCase();
                return `${typeName}${valueText}${unitText}`.includes(currentSearchTerm) ||
                       typeName.includes(currentSearchTerm) ||
                       `${valueText}${unitText}`.includes(currentSearchTerm);
            });
            return nameMatch || sourceMatch || effectMatch || priceMatch;
        });
    }

    // 3. Category and Tag Filters
    if (selectedParentCategoryIds.length > 0) {
        const allCategories = getAllCategoriesFunc();
        const allTags = getAllTagsFunc();
        
        filtered = filtered.filter(item => {
            let matchesSelectedParent = true; // Default to true if no parent filter applied or for simulator mode which handles this differently
            
            if (isSelectingForSimulator) {
                // In simulator mode, parent category (e.g., "装備") is pre-selected.
                // No further parent category filtering logic is typically needed here for items,
                // as the slot tag already narrows it down.
                // If SIMULATOR_PARENT_CATEGORY_NAME needs to be strictly enforced for items,
                // it can be done by checking if item belongs to a child of that parent.
            } else { // Normal search mode
                const itemChildCategoryIds = (item.tags || []).reduce((acc, tagId) => {
                    const tag = allTags.find(t => t.id === tagId);
                    if (tag && tag.categoryIds) {
                        tag.categoryIds.forEach(catId => {
                            const category = allCategories.find(c => c.id === catId);
                            if (category && category.parentId) acc.add(catId); // Only consider child categories
                        });
                    }
                    return acc;
                }, new Set());

                matchesSelectedParent = selectedParentCategoryIds.some(selectedParentId =>
                    Array.from(itemChildCategoryIds).some(itemCatId => {
                        const category = allCategories.find(c => c.id === itemCatId);
                        return category && category.parentId === selectedParentId;
                    })
                );
            }
             if (!matchesSelectedParent) return false;


            // Tag filtering logic
            if (selectedTagIds.length > 0) {
                let tagsToFilterByEffective = [...selectedTagIds];
                // In simulator mode, the slot tag is already handled, so we filter by *other* selected tags
                if (isSelectingForSimulator && currentSelectingSlot) {
                    const currentSlotTagId = getSlotTagIdFunc(currentSelectingSlot);
                    tagsToFilterByEffective = selectedTagIds.filter(tid => tid !== currentSlotTagId);
                }

                if (tagsToFilterByEffective.length > 0) {
                    // Determine search mode (AND/OR) based on tags' child categories
                    // This simplified version assumes a global AND unless all tags belong to a single OR-mode category.
                    // A more precise implementation would group tags by their child categories and apply modes accordingly.
                    let effectiveSearchMode = 'AND'; // Default
                    const categoriesOfSelectedTags = new Map();

                    tagsToFilterByEffective.forEach(tagId => {
                        const tag = allTags.find(t => t.id === tagId);
                        if (tag && tag.categoryIds) {
                            tag.categoryIds.forEach(catId => {
                                const category = allCategories.find(c => c.id === catId);
                                if (category && category.parentId) { // Is a child category
                                    if (!categoriesOfSelectedTags.has(catId)) {
                                        categoriesOfSelectedTags.set(catId, { mode: category.tagSearchMode || 'AND', tags: [] });
                                    }
                                    categoriesOfSelectedTags.get(catId).tags.push(tagId);
                                }
                            });
                        }
                    });
                    
                    // Simplified OR mode check: if all effective tags belong to the *same* child category, and that category is OR
                    if (categoriesOfSelectedTags.size === 1) {
                        const [firstCategoryData] = categoriesOfSelectedTags.values();
                        if (firstCategoryData.mode === 'OR' && firstCategoryData.tags.length === tagsToFilterByEffective.length) {
                            effectiveSearchMode = 'OR';
                        }
                    }
                    // More complex: If tags span multiple child categories, AND is generally safer, or implement per-category grouping.

                    if (effectiveSearchMode === 'OR') {
                        if (!tagsToFilterByEffective.some(tagId => item.tags && item.tags.includes(tagId))) return false;
                    } else { // AND mode
                        if (!tagsToFilterByEffective.every(tagId => item.tags && item.tags.includes(tagId))) return false;
                    }
                }
            }
            return true;
        });
    }


    // Pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const itemsToRenderOnPage = filtered.slice(startIndex, endIndex);

    // Render the filtered and paginated items
    renderItems(itemsToRenderOnPage, filtered.length, currentPage, itemsPerPage);
}


export function renderParentCategoryFilters() {
    if (!DOMF.parentCategoryFiltersContainer) return;
    DOMF.parentCategoryFiltersContainer.innerHTML = '';
    const parentCategories = getAllCategoriesFunc().filter(cat => !cat.parentId || cat.parentId === "");

    if (parentCategories.length === 0) {
        DOMF.parentCategoryFiltersContainer.innerHTML = '<p>利用可能な親カテゴリはありません。</p>';
        return;
    }

    parentCategories.forEach(category => {
        const button = document.createElement('div');
        button.classList.add('category-filter-button');
        let isDisabledForSimulator = false;
        if (isSelectingForSimulator && category.name !== simulatorParentCategoryNameConst) {
            isDisabledForSimulator = true;
        }
        button.classList.toggle('disabled', isDisabledForSimulator);
        button.textContent = category.name;
        button.dataset.categoryId = category.id;
        button.classList.toggle('active', selectedParentCategoryIds.includes(category.id) && !isDisabledForSimulator);

        button.addEventListener('click', () => {
            if (isDisabledForSimulator) return;
            // If in simulator mode and "装備" is clicked, it should not be de-selectable
            if (isSelectingForSimulator && category.name === simulatorParentCategoryNameConst) {
                 if (!selectedParentCategoryIds.includes(category.id)) { // If not active, make it active
                    button.classList.add('active');
                    selectedParentCategoryIds = [category.id]; // Force select
                 } // If already active, do nothing
            } else {
                button.classList.toggle('active');
                const index = selectedParentCategoryIds.indexOf(category.id);
                if (index > -1) {
                    selectedParentCategoryIds.splice(index, 1);
                } else {
                    selectedParentCategoryIds.push(category.id);
                }
            }

            // When a parent category changes, child tags selection should be reset
            // unless it's a simulator slot tag
            const slotTagToPreserve = (isSelectingForSimulator && currentSelectingSlot) ? getSlotTagIdFunc(currentSelectingSlot) : null;
            selectedTagIds = slotTagToPreserve ? [slotTagToPreserve] : [];

            currentPage = 1;
            renderChildCategoriesAndTags(); // Update child/tag display
            triggerFilterChange();
        });
        DOMF.parentCategoryFiltersContainer.appendChild(button);
    });
}

export function renderChildCategoriesAndTags() {
    if (!DOMF.childCategoriesAndTagsContainer) return;
    DOMF.childCategoriesAndTagsContainer.innerHTML = '';
    const allCategories = getAllCategoriesFunc();
    const allTags = getAllTagsFunc();

    let displayChildCategories = false;
    if (isSelectingForSimulator) {
        const equipmentParent = allCategories.find(c => c.name === simulatorParentCategoryNameConst && (!c.parentId || c.parentId === ""));
        if (equipmentParent && selectedParentCategoryIds.includes(equipmentParent.id)) {
            displayChildCategories = true;
        }
    } else { // Normal mode
        if (selectedParentCategoryIds.length > 0) {
            displayChildCategories = true;
        }
    }

    if (!displayChildCategories) {
        DOMF.childCategoriesAndTagsContainer.style.display = 'none';
        if (selectedParentCategoryIds.length === 0 && !isSelectingForSimulator) {
            DOMF.childCategoriesAndTagsContainer.innerHTML = '<p style="color: #777; margin-top: 10px;">親カテゴリを選択すると、関連する子カテゴリとタグが表示されます。</p>';
            DOMF.childCategoriesAndTagsContainer.style.display = 'block';
        }
        return;
    }
    DOMF.childCategoriesAndTagsContainer.style.display = 'block';

    let hasContentToShow = false;

    selectedParentCategoryIds.forEach(parentId => {
        const parentCat = allCategories.find(c => c.id === parentId);
        if (!parentCat) return;

        const childCategoriesOfParent = allCategories.filter(cat => cat.parentId === parentId);
        if (childCategoriesOfParent.length > 0) {
            childCategoriesOfParent.forEach(childCat => {
                // In simulator mode, only show "効果" child category under "装備" parent
                if (isSelectingForSimulator && parentCat.name === simulatorParentCategoryNameConst && childCat.name !== simulatorEffectChildCategoryNameConst) {
                    return;
                }
                hasContentToShow = true;
                const childCatSection = document.createElement('div');
                childCatSection.classList.add('child-category-section');
                const childCatHeader = document.createElement('h4');
                const searchModeText = childCat.tagSearchMode === 'OR' ? '(OR検索)' : '(AND検索)';
                childCatHeader.innerHTML = `${childCat.name} <span class="search-mode">${searchModeText}</span>`;
                childCatSection.appendChild(childCatHeader);

                const tagsForThisChild = allTags.filter(tag => tag.categoryIds && tag.categoryIds.includes(childCat.id));
                if (tagsForThisChild.length > 0) {
                    const tagsContainer = document.createElement('div');
                    tagsContainer.classList.add('tag-filters-inline');
                    tagsForThisChild.forEach(tag => {
                        const tagButton = document.createElement('div');
                        tagButton.classList.add('tag-filter');
                        tagButton.textContent = tag.name;
                        tagButton.dataset.tagId = tag.id;

                        let isDisabledTag = false;
                        const currentSlotTagId = (isSelectingForSimulator && currentSelectingSlot) ? getSlotTagIdFunc(currentSelectingSlot) : null;

                        if (isSelectingForSimulator) {
                            // Disable tags that are not the current slot tag IF the child category is NOT "効果"
                            if (parentCat.name === simulatorParentCategoryNameConst && childCat.name !== simulatorEffectChildCategoryNameConst) {
                                if (tag.id !== currentSlotTagId) {
                                    isDisabledTag = true;
                                }
                            }
                            // If current child category IS "効果", all its tags are enabled.
                        }

                        tagButton.classList.toggle('disabled', isDisabledTag);
                        tagButton.classList.toggle('active', selectedTagIds.includes(tag.id) && !isDisabledTag);
                        
                        tagButton.addEventListener('click', () => {
                            if (isDisabledTag) return;
                            // Slot tags in simulator mode cannot be deselected by clicking
                            if (isSelectingForSimulator && tag.id === currentSlotTagId && childCat.name !== simulatorEffectChildCategoryNameConst) {
                                return;
                            }

                            tagButton.classList.toggle('active');
                            const index = selectedTagIds.indexOf(tag.id);
                            if (index > -1) {
                                selectedTagIds.splice(index, 1);
                            } else {
                                selectedTagIds.push(tag.id);
                            }
                            currentPage = 1;
                            triggerFilterChange();
                        });
                        tagsContainer.appendChild(tagButton);
                    });
                    childCatSection.appendChild(tagsContainer);
                } else {
                    childCatSection.appendChild(Object.assign(document.createElement('p'), { className: 'no-tags-message', textContent: 'この子カテゴリに属するタグはありません。'}));
                }
                DOMF.childCategoriesAndTagsContainer.appendChild(childCatSection);
            });
        }
    });

    if (!hasContentToShow && selectedParentCategoryIds.length > 0) {
        DOMF.childCategoriesAndTagsContainer.innerHTML = '<p style="color: #777; margin-top: 10px;">選択された親カテゴリには表示可能な子カテゴリまたはタグがありません。</p>';
    }
}

// --- Functions to manage simulator selection mode ---
export function activateSimulatorSelectionMode(slotName, slotTagId, currentEquippedItemId) {
    isSelectingForSimulator = true;
    currentSelectingSlot = slotName;
    temporarilySelectedItem = currentEquippedItemId; // Pre-select if already equipped
    currentPage = 1;

    // Pre-select "装備" parent category and the slot tag
    const equipmentParent = getAllCategoriesFunc().find(c => c.name === simulatorParentCategoryNameConst && (!c.parentId || c.parentId === ""));
    if (equipmentParent) {
        selectedParentCategoryIds = [equipmentParent.id];
    } else {
        console.warn(`親カテゴリ「${simulatorParentCategoryNameConst}」が見つかりません。`);
        selectedParentCategoryIds = [];
    }
    selectedTagIds = slotTagId ? [slotTagId] : [];

    if (DOMF.searchInput) DOMF.searchInput.value = ''; // Clear search for slot selection
    currentSearchTerm = '';

    // Update UI elements
    if (DOMF.searchControlsElement) DOMF.searchControlsElement.style.opacity = '1'; // Ensure visible
    displaySearchToolMessage(`「${slotName}」のアイテムを選択し、「決定」ボタンを押してください。`, true);
    showConfirmSelectionButton(true);

    renderParentCategoryFilters();
    renderChildCategoriesAndTags();
    triggerFilterChange(); // This will update renderConfig and call applyFiltersAndRender

    // Scroll to search area
    const targetScrollElement = document.getElementById('searchToolMessage') || DOMF.searchControlsElement;
    if (targetScrollElement && targetScrollElement.offsetParent !== null) {
        const offset = targetScrollElement === document.getElementById('searchToolMessage') ? 70 : 20;
        window.scrollTo({ top: targetScrollElement.offsetTop - offset, behavior: 'smooth' });
    } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

export function deactivateSimulatorSelectionMode() {
    isSelectingForSimulator = false;
    currentSelectingSlot = null;
    temporarilySelectedItem = null;
    currentPage = 1;

    // Reset filters to default (or last non-simulator state if you want to preserve it)
    selectedParentCategoryIds = [];
    selectedTagIds = [];
    if (DOMF.searchInput) DOMF.searchInput.value = '';
    currentSearchTerm = '';


    if (DOMF.searchControlsElement) DOMF.searchControlsElement.style.opacity = '1';
    displaySearchToolMessage('', false);
    showConfirmSelectionButton(false);

    renderParentCategoryFilters();
    renderChildCategoriesAndTags();
    // モード解除時に必ずフィルターを再適用して画面を更新する
    triggerFilterChange();
}

export function cancelItemSelection() { // Called when closing modal during selection
    deactivateSimulatorSelectionMode();
}

// --- Getters for state (if needed by other modules directly) ---
export const getSelectedParentCategoryIds = () => selectedParentCategoryIds;
export const getSelectedTagIds = () => selectedTagIds;
export const getCurrentPage = () => currentPage;
export const setCurrentPageExport = (page) => { currentPage = page; }; // Avoid direct mutation
export const getItemsPerPage = () => itemsPerPage;
export const setItemsPerPageExport = (num) => { itemsPerPage = num; };
export const getTemporarilySelectedItem = () => temporarilySelectedItem;
export const setTemporarilySelectedItemExport = (itemId) => {
    temporarilySelectedItem = itemId;
    // No immediate re-render, renderItems will pick it up
    // If visual feedback needs to be instant and not part of full re-render, handle it here.
    // For now, relying on renderItems to highlight.
    updateRenderConfig({ temporarilySelectedItem }); // Inform search-render
    // Potentially, re-call a lighter version of renderItems if only selection highlight changes
    const currentFilteredItems = getAllItemsFunc(); // This is not ideal to re-filter here
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    // Apply current filters to get the items on the *current* page again to re-render with new highlight
    // This is a bit inefficient. A better way would be for renderItems to just update highlights.
    // applyFiltersAndRender(); // This might be too heavy, consider a lighter update.
    // For now, let's assume filterAndRenderItems will be called after this by the main logic.
};

export const isSelectingForSimulatorState = () => isSelectingForSimulator;
export const getCurrentSelectingSlotState = () => currentSelectingSlot;
--- END OF FILE --
