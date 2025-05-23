// js/admin-modules/category-manager.js
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp, writeBatch, arrayUnion, arrayRemove, deleteField } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { openModal, closeModal, populateTagButtonSelector, getSelectedTagButtonValues } from './ui-helpers.js';

const DOMC = {
    newCategoryNameInput: null,
    newCategoryParentButtons: null,
    selectedNewParentCategoryIdInput: null,
    addCategoryButton: null,
    categoryListContainer: null,
    categorySearchInput: null,
    enlargeCategoryListButton: null,
    editCategoryModal: null,
    editingCategoryDocIdInput: null,
    editingCategoryNameInput: null,
    editingCategoryParentButtons: null,
    selectedEditingParentCategoryIdInput: null,
    editCategoryTagsGroup: null,
    editingCategoryTagsSelector: null,
    tagSearchModeGroup: null,
    editingTagSearchModeSelect: null,
    saveCategoryEditButton: null,
    deleteCategoryFromEditModalButton: null,
};

let dbInstance = null;
let getAllCategoriesFuncCache = () => [];
let getAllTagsFuncCache = () => [];
let refreshAllDataCallback = async () => {};
let openEnlargedListModalCallback = (config) => {}; // Changed to accept a config object

const categoryExpansionState = new Map(); // To store expansion state of categories
let currentCategorySearchTerm = "";

export function initCategoryManager(dependencies) {
    dbInstance = dependencies.db;
    getAllCategoriesFuncCache = dependencies.getAllCategories;
    getAllTagsFuncCache = dependencies.getAllTags;
    refreshAllDataCallback = dependencies.refreshAllData;
    openEnlargedListModalCallback = dependencies.openEnlargedListModal;

    DOMC.newCategoryNameInput = document.getElementById('newCategoryName');
    DOMC.newCategoryParentButtons = document.getElementById('newCategoryParentButtons');
    DOMC.selectedNewParentCategoryIdInput = document.getElementById('selectedNewParentCategoryId');
    DOMC.addCategoryButton = document.getElementById('addCategoryButton');
    DOMC.categoryListContainer = document.getElementById('categoryListContainer');
    DOMC.categorySearchInput = document.getElementById('categorySearchInput');
    DOMC.enlargeCategoryListButton = document.getElementById('enlargeCategoryListButton');

    DOMC.editCategoryModal = document.getElementById('editCategoryModal');
    DOMC.editingCategoryDocIdInput = document.getElementById('editingCategoryDocId');
    DOMC.editingCategoryNameInput = document.getElementById('editingCategoryName');
    DOMC.editingCategoryParentButtons = document.getElementById('editingCategoryParentButtons');
    DOMC.selectedEditingParentCategoryIdInput = document.getElementById('selectedEditingParentCategoryId');
    DOMC.editCategoryTagsGroup = document.getElementById('editCategoryTagsGroup');
    DOMC.editingCategoryTagsSelector = document.getElementById('editingCategoryTagsSelector');
    DOMC.tagSearchModeGroup = document.getElementById('tagSearchModeGroup');
    DOMC.editingTagSearchModeSelect = document.getElementById('editingTagSearchMode');
    DOMC.saveCategoryEditButton = document.getElementById('saveCategoryEditButton');
    DOMC.deleteCategoryFromEditModalButton = document.getElementById('deleteCategoryFromEditModalButton');

    if (DOMC.addCategoryButton) DOMC.addCategoryButton.addEventListener('click', addCategory);
    if (DOMC.saveCategoryEditButton) DOMC.saveCategoryEditButton.addEventListener('click', saveCategoryEdit);
    if (DOMC.deleteCategoryFromEditModalButton) {
        DOMC.deleteCategoryFromEditModalButton.addEventListener('click', () => {
            const categoryId = DOMC.editingCategoryDocIdInput.value;
            const category = getAllCategoriesFuncCache().find(c => c.id === categoryId);
            if (categoryId && category) deleteCategory(categoryId, category.name);
            else alert("削除対象のカテゴリIDが見つかりません。");
        });
    }
    if (DOMC.categoryListContainer) DOMC.categoryListContainer.addEventListener('click', handleCategoryTreeClick);
    if (DOMC.categorySearchInput) {
        DOMC.categorySearchInput.addEventListener('input', (e) => {
            currentCategorySearchTerm = e.target.value.toLowerCase().trim();
            _renderCategoriesForManagementInternal();
        });
    }
    if (DOMC.enlargeCategoryListButton) {
        DOMC.enlargeCategoryListButton.addEventListener('click', () => {
            if (typeof openEnlargedListModalCallback === 'function') {
                openEnlargedListModalCallback({
                    title: "カテゴリ一覧 (拡大)",
                    sourceItems: getAllCategoriesFuncCache(), // Pass all categories
                    itemType: 'category', // To identify the type of item
                    searchTerm: currentCategorySearchTerm, // Pass current search term
                    displayRenderer: (categories, allCats, isEnlarged) => buildCategoryTreeDOM(categories, allCats, isEnlarged), // Function to render the list
                    editFunction: openEditCategoryModalById // Function to call on item click
                });
            }
        });
    }
    console.log("[Category Manager] Initialized.");
}

// --- (populateParentCategoryButtonsUI, selectParentCategoryButtonUI, toggleEditModalChildFields - 変更なしのため省略) ---
function populateParentCategoryButtonsUI(buttonContainer, hiddenInput, options = {}) {
    const { currentCategoryIdToExclude = null, selectedParentId = "" } = options;
    const allCategories = getAllCategoriesFuncCache();

    if (!buttonContainer || !hiddenInput) {
        console.warn("populateParentCategoryButtonsUI: buttonContainer or hiddenInput is null.");
        return;
    }
    buttonContainer.innerHTML = '';
    hiddenInput.value = selectedParentId; 

    const topLevelButton = document.createElement('button'); // Changed to button for consistency with a11y for click
    topLevelButton.type = 'button';
    topLevelButton.className = 'category-select-button';
    topLevelButton.textContent = '親カテゴリなし'; // origin.js had 最上位カテゴリとして設定
    topLevelButton.dataset.parentId = "";
    if (selectedParentId === "") {
        topLevelButton.classList.add('active');
    }
    topLevelButton.addEventListener('click', () => {
        selectParentCategoryButtonUI(buttonContainer, hiddenInput, topLevelButton, "");
        if (buttonContainer === DOMC.editingCategoryParentButtons) {
            toggleEditModalChildFields(false);
        }
    });
    buttonContainer.appendChild(topLevelButton);

    allCategories
        .filter(cat => (!cat.parentId || cat.parentId === "") && cat.id !== currentCategoryIdToExclude)
        .sort((a,b) => a.name.localeCompare(b.name, 'ja'))
        .forEach(cat => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'category-select-button';
            button.textContent = cat.name;
            button.dataset.parentId = cat.id;
            if (selectedParentId === cat.id) {
                button.classList.add('active');
            }
            button.addEventListener('click', () => {
                selectParentCategoryButtonUI(buttonContainer, hiddenInput, button, cat.id);
                if (buttonContainer === DOMC.editingCategoryParentButtons) {
                    toggleEditModalChildFields(true);
                    const categoryBeingEditedId = DOMC.editingCategoryDocIdInput.value;
                    // Ensure DOMC.editingCategoryTagsSelector is valid before populating
                    if (categoryBeingEditedId && DOMC.editingCategoryTagsSelector) {
                        populateTagsForCategoryEditModal(DOMC.editingCategoryTagsSelector, categoryBeingEditedId, getAllTagsFuncCache());
                    }
                }
            });
            buttonContainer.appendChild(button);
        });
}

function selectParentCategoryButtonUI(container, hiddenInput, clickedButton, parentId) {
    container.querySelectorAll('.category-select-button.active').forEach(activeBtn => {
        activeBtn.classList.remove('active');
    });
    clickedButton.classList.add('active');
    hiddenInput.value = parentId;
}

function toggleEditModalChildFields(isChild) {
    if (DOMC.tagSearchModeGroup) DOMC.tagSearchModeGroup.style.display = isChild ? 'block' : 'none';
    if (DOMC.editCategoryTagsGroup) DOMC.editCategoryTagsGroup.style.display = isChild ? 'block' : 'none';
    if (isChild) {
        if (DOMC.editingTagSearchModeSelect && !DOMC.editingTagSearchModeSelect.value) {
            DOMC.editingTagSearchModeSelect.value = 'AND'; // Default to AND
        }
    } else {
        // When switching to parent, clear associated tags in the edit modal
        if (DOMC.editingCategoryTagsSelector) DOMC.editingCategoryTagsSelector.innerHTML = '';
    }
}


// Based on origin.js's tree rendering logic
function buildCategoryTreeDOM(categoriesToDisplay, allCategoriesData, isEnlargedView = false) {
    const buildNode = (parentId = "") => {
        const children = categoriesToDisplay
            .filter(cat => (cat.parentId || "") === parentId)
            .sort((a, b) => a.name.localeCompare(b.name, 'ja'));

        if (children.length === 0) return null;

        const ul = document.createElement('ul');
        if (parentId !== "") {
            ul.classList.add('category-tree-children');
            // In enlarged view or search, always show children
            if (!isEnlargedView && !currentCategorySearchTerm && !categoryExpansionState.get(parentId)) {
                ul.classList.add('hidden');
            }
        }

        children.forEach(category => {
            const li = document.createElement('li');
            li.classList.add('category-tree-item');
            li.dataset.categoryId = category.id; // For click handling

            const hasActualChildren = allCategoriesData.some(c => c.parentId === category.id);
            const isExpanded = isEnlargedView || !!currentCategorySearchTerm || categoryExpansionState.get(category.id);

            const expander = document.createElement('span');
            expander.classList.add('category-tree-expander');
            if (hasActualChildren) {
                expander.textContent = isExpanded ? '▼' : '►';
                if (isExpanded) expander.classList.add('expanded');
            } else {
                expander.innerHTML = ' '; // Non-breaking space for alignment
            }
            // Only add toggle action if not in enlarged view
            if (!isEnlargedView) expander.dataset.action = 'toggle';
            li.appendChild(expander);

            const content = document.createElement('div');
            content.classList.add('category-tree-content');
            // Only add edit action if not in enlarged view (or handle in admin-main for enlarged)
            if (!isEnlargedView) content.dataset.action = 'edit';
            // For enlarged view, click will be handled by admin-main.js

            const nameSpan = document.createElement('span');
            nameSpan.classList.add('category-name'); // For styling
            nameSpan.textContent = category.name;
            content.appendChild(nameSpan);

            const smallInfo = document.createElement('small');
            let infoText = "";
            if (!category.parentId) {
                infoText = " (親カテゴリ)";
            } else {
                const parent = allCategoriesData.find(p => p.id === category.parentId);
                infoText = ` (親: ${parent ? parent.name : '不明'})`;
                if (category.tagSearchMode) {
                    infoText += ` [${category.tagSearchMode.toUpperCase()}検索]`;
                }
            }
            smallInfo.textContent = infoText;
            content.appendChild(smallInfo);
            li.appendChild(content);

            if (hasActualChildren) {
                const childrenUl = buildNode(category.id);
                if (childrenUl) {
                    if (!isEnlargedView && !isExpanded && !currentCategorySearchTerm) {
                        childrenUl.classList.add('hidden');
                    }
                    li.appendChild(childrenUl);
                }
            }
            ul.appendChild(li);
        });
        return ul;
    };
    return buildNode(""); // Start building from root
}

export function _renderCategoriesForManagementInternal() {
    if (!DOMC.categoryListContainer) return;
    const allCategories = getAllCategoriesFuncCache();
    DOMC.categoryListContainer.innerHTML = '';

    let categoriesToDisplay = allCategories;
    if (currentCategorySearchTerm) {
        const searchResults = allCategories.filter(cat => cat.name.toLowerCase().includes(currentCategorySearchTerm));
        const displaySet = new Set();
        // Include parents of search results to maintain tree structure
        function addWithParents(categoryId) {
            const category = allCategories.find(c => c.id === categoryId);
            if (category && !displaySet.has(category.id)) {
                displaySet.add(category.id);
                if (category.parentId) {
                    addWithParents(category.parentId);
                }
            }
        }
        searchResults.forEach(cat => addWithParents(cat.id));
        categoriesToDisplay = allCategories.filter(cat => displaySet.has(cat.id));
    }

    if (categoriesToDisplay.length === 0) {
        DOMC.categoryListContainer.innerHTML = currentCategorySearchTerm ? 
            '<p>検索条件に一致するカテゴリはありません。</p>' : 
            '<p>カテゴリが登録されていません。</p>';
    } else {
        const treeRoot = buildCategoryTreeDOM(categoriesToDisplay, allCategories, false); // false for normal view
        if (treeRoot) {
            DOMC.categoryListContainer.appendChild(treeRoot);
        } else {
             DOMC.categoryListContainer.innerHTML = '<p>カテゴリの表示に失敗しました。</p>';
        }
    }
    
    // Always populate parent selector for "new category" form
    populateParentCategoryButtonsUI(DOMC.newCategoryParentButtons, DOMC.selectedNewParentCategoryIdInput, { selectedParentId: DOMC.selectedNewParentCategoryIdInput.value || "" });
}

function handleCategoryTreeClick(event) {
    const target = event.target;
    const listItem = target.closest('.category-tree-item[data-category-id]');
    if (!listItem) return;

    const categoryId = listItem.dataset.categoryId;
    const actionTarget = target.closest('[data-action]');
    const action = actionTarget ? actionTarget.dataset.action : null;

    if (action === 'toggle') {
        const expander = listItem.querySelector('.category-tree-expander');
        const childrenUl = listItem.querySelector('ul.category-tree-children'); // More specific selector
        if (childrenUl) {
            const isCurrentlyExpanded = !childrenUl.classList.contains('hidden');
            categoryExpansionState.set(categoryId, !isCurrentlyExpanded); // Update state based on new state
            childrenUl.classList.toggle('hidden', isCurrentlyExpanded);
            if (expander) {
                expander.textContent = !isCurrentlyExpanded ? '▼' : '►';
                expander.classList.toggle('expanded', !isCurrentlyExpanded);
            }
        }
    } else if (action === 'edit') {
        openEditCategoryModalById(categoryId);
    } else if (target.classList.contains('category-name') || target.closest('.category-tree-content')) {
        // If the content area (not expander) is clicked, also treat as edit
        openEditCategoryModalById(categoryId);
    }
}

async function addCategory() {
    // ... (変更なし、origin.js と同等) ...
    if (!DOMC.newCategoryNameInput || !DOMC.selectedNewParentCategoryIdInput) return;
    const name = DOMC.newCategoryNameInput.value.trim();
    const parentId = DOMC.selectedNewParentCategoryIdInput.value; 
    if (!name) { alert("カテゴリ名を入力してください。"); return; }
    const q = query(collection(dbInstance, 'categories'), where('name', '==', name), where('parentId', '==', parentId || ""));
    const existingQuery = await getDocs(q);
    if (!existingQuery.empty) {
        alert(parentId ? "同じ親カテゴリ内に同じ名前の子カテゴリが既に存在します。" : "同じ名前の親カテゴリが既に存在します。");
        return;
    }
    try {
        const categoryData = { name: name, parentId: parentId || "", createdAt: serverTimestamp() };
        if (parentId) categoryData.tagSearchMode = 'AND'; 
        await addDoc(collection(dbInstance, 'categories'), categoryData);
        DOMC.newCategoryNameInput.value = '';
        populateParentCategoryButtonsUI(DOMC.newCategoryParentButtons, DOMC.selectedNewParentCategoryIdInput, { selectedParentId: "" });
        await refreshAllDataCallback(); 
    } catch (error) {
        console.error("[Category Manager] Error adding category:", error);
        alert("カテゴリの追加に失敗しました。");
    }
}

// ★★★ EXPORTED FOR admin-main.js ★★★
export function openEditCategoryModalById(categoryId) {
    // ... (変更なし、origin.js と同等) ...
    const allCategories = getAllCategoriesFuncCache();
    const categoryToEdit = allCategories.find(c => c.id === categoryId);
    if (!categoryToEdit) { alert("編集するカテゴリのデータが見つかりません。"); return; }
    DOMC.editingCategoryDocIdInput.value = categoryToEdit.id;
    DOMC.editingCategoryNameInput.value = categoryToEdit.name;
    const currentParentId = categoryToEdit.parentId || "";
    const currentTagSearchMode = categoryToEdit.tagSearchMode || 'AND';
    populateParentCategoryButtonsUI(DOMC.editingCategoryParentButtons, DOMC.selectedEditingParentCategoryIdInput, {
        currentCategoryIdToExclude: categoryToEdit.id,
        selectedParentId: currentParentId
    });
    const isChildCategory = !!DOMC.selectedEditingParentCategoryIdInput.value; 
    toggleEditModalChildFields(isChildCategory);
    if (isChildCategory) {
        populateTagsForCategoryEditModal(DOMC.editingCategoryTagsSelector, categoryToEdit.id, getAllTagsFuncCache());
        if(DOMC.editingTagSearchModeSelect) DOMC.editingTagSearchModeSelect.value = currentTagSearchMode;
    } else {
        if(DOMC.editingCategoryTagsSelector) DOMC.editingCategoryTagsSelector.innerHTML = '';
    }
    openModal('editCategoryModal');
    if(DOMC.editingCategoryNameInput) DOMC.editingCategoryNameInput.focus();
}

function populateTagsForCategoryEditModal(containerElement, categoryId, allTags) {
    // ... (変更なし、origin.js と同等) ...
    if (!containerElement) {
        console.warn("populateTagsForCategoryEditModal: containerElement is null");
        return;
    }
    const activeTagIds = allTags.filter(tag => tag.categoryIds && tag.categoryIds.includes(categoryId)).map(t => t.id);
    populateTagButtonSelector(containerElement, allTags.sort((a,b) => a.name.localeCompare(b.name, 'ja')), activeTagIds);
}

async function saveCategoryEdit() {
    // ... (変更なし、origin.js と同等) ...
    const docId = DOMC.editingCategoryDocIdInput.value;
    const newName = DOMC.editingCategoryNameInput.value.trim();
    const newParentId = DOMC.selectedEditingParentCategoryIdInput.value; 
    const newTagSearchMode = DOMC.editingTagSearchModeSelect.value;
    const selectedTagIdsForThisCategory = getSelectedTagButtonValues(DOMC.editingCategoryTagsSelector);
    if (!newName) { alert("カテゴリ名は空にできません。"); return; }
    if (docId === newParentId) { alert("自身を親カテゴリに設定することはできません。"); return; }
    const allCategories = getAllCategoriesFuncCache();
    const originalCategory = allCategories.find(c => c.id === docId);
    if (originalCategory && (originalCategory.name !== newName || (originalCategory.parentId || "") !== (newParentId || ""))) {
        const q = query(collection(dbInstance, 'categories'), where('name', '==', newName), where('parentId', '==', newParentId || ""));
        const existingQuery = await getDocs(q);
        if (existingQuery.docs.some(docSnap => docSnap.id !== docId)) {
            alert(newParentId ? "同じ親カテゴリ内に同じ名前の子カテゴリが既に存在します。" : "同じ名前の親カテゴリが既に存在します。");
            return;
        }
    }
    if (newParentId) { 
        let currentAncestorId = newParentId;
        const visited = new Set([docId]); 
        while (currentAncestorId) {
            if (visited.has(currentAncestorId)) {
                alert("循環参照です。この親カテゴリ設定はできません。"); return;
            }
            visited.add(currentAncestorId);
            const ancestor = allCategories.find(c => c.id === currentAncestorId);
            currentAncestorId = ancestor ? (ancestor.parentId || "") : "";
        }
    }
    try {
        const batch = writeBatch(dbInstance);
        const categoryUpdateData = { name: newName, parentId: newParentId || "", updatedAt: serverTimestamp() };
        const isBecomingChild = !!newParentId;
        if (isBecomingChild) { categoryUpdateData.tagSearchMode = newTagSearchMode; } 
        else { categoryUpdateData.tagSearchMode = deleteField(); }
        batch.update(doc(dbInstance, 'categories', docId), categoryUpdateData);
        const allTags = getAllTagsFuncCache();
        allTags.forEach(tag => {
            const isCurrentlySelectedForCat = selectedTagIdsForThisCategory.includes(tag.id);
            const isAlreadyAssociatedWithCat = tag.categoryIds && tag.categoryIds.includes(docId);
            if (isBecomingChild) { 
                if (isCurrentlySelectedForCat && !isAlreadyAssociatedWithCat) {
                    batch.update(doc(dbInstance, 'tags', tag.id), { categoryIds: arrayUnion(docId) });
                } else if (!isCurrentlySelectedForCat && isAlreadyAssociatedWithCat) {
                    batch.update(doc(dbInstance, 'tags', tag.id), { categoryIds: arrayRemove(docId) });
                }
            } else { 
                if (isAlreadyAssociatedWithCat) { 
                     batch.update(doc(dbInstance, 'tags', tag.id), { categoryIds: arrayRemove(docId) });
                }
            }
        });
        await batch.commit();
        closeModal('editCategoryModal');
        await refreshAllDataCallback();
    } catch (error) {
        console.error("[Category Manager] Error saving category edit:", error);
        alert("カテゴリの更新または関連タグの更新に失敗しました。");
    }
}

async function deleteCategory(docId, categoryName) {
    // ... (変更なし、origin.js と同等) ...
    const childCheckQuery = query(collection(dbInstance, 'categories'), where('parentId', '==', docId));
    const childSnapshot = await getDocs(childCheckQuery);
    if (!childSnapshot.empty) {
        alert(`カテゴリ「${categoryName}」は他のカテゴリの親として使用されているため削除できません。先に子カテゴリを削除するか、別の親カテゴリに移動してください。`);
        return;
    }
    if (confirm(`カテゴリ「${categoryName}」を削除しますか？\nこのカテゴリに紐づいているタグの関連付けも解除されます。\nこの操作は元に戻せません。`)) {
        try {
            const batch = writeBatch(dbInstance);
            const tagsToUpdateQuery = query(collection(dbInstance, 'tags'), where('categoryIds', 'array-contains', docId));
            const tagsSnapshot = await getDocs(tagsToUpdateQuery);
            tagsSnapshot.forEach(tagDoc => {
                batch.update(tagDoc.ref, { categoryIds: arrayRemove(docId) });
            });
            batch.delete(doc(dbInstance, 'categories', docId));
            await batch.commit();
            if (DOMC.editCategoryModal.style.display !== 'none' && DOMC.editingCategoryDocIdInput.value === docId) { // Close edit modal if open for this category
                closeModal('editCategoryModal');
            }
            await refreshAllDataCallback();
        } catch (error) {
            console.error("[Category Manager] Error deleting category:", error);
            alert("カテゴリの削除または関連タグの更新に失敗しました。");
        }
    }
}
