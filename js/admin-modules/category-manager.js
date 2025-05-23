// js/admin-modules/category-manager.js
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp, writeBatch, arrayUnion, arrayRemove, deleteField } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { openModal, closeModal, populateTagButtonSelector, getSelectedTagButtonValues } from './ui-helpers.js';

const DOMC = {
    newCategoryNameInput: null,
    newCategoryParentButtons: null,
    selectedNewParentCategoryIdInput: null,
    addCategoryButton: null,
    categoryListContainer: null,
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
    // Added delete button from edit modal
    deleteCategoryFromEditModalButton: null,
    // Category search input in management modal
    categorySearchInput: null,
};

let dbInstance = null;
let getAllCategoriesFuncCache = () => [];
let getAllTagsFuncCache = () => [];
let refreshAllDataCallback = async () => {};

export function initCategoryManager(dependencies) {
    dbInstance = dependencies.db;
    getAllCategoriesFuncCache = dependencies.getAllCategories;
    getAllTagsFuncCache = dependencies.getAllTags;
    refreshAllDataCallback = dependencies.refreshAllData;

    DOMC.newCategoryNameInput = document.getElementById('newCategoryName');
    DOMC.newCategoryParentButtons = document.getElementById('newCategoryParentButtons');
    DOMC.selectedNewParentCategoryIdInput = document.getElementById('selectedNewParentCategoryId');
    DOMC.addCategoryButton = document.getElementById('addCategoryButton');
    DOMC.categoryListContainer = document.getElementById('categoryListContainer');
    DOMC.categorySearchInput = document.getElementById('categorySearchInput'); // Search input

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


    if (DOMC.addCategoryButton) {
        DOMC.addCategoryButton.addEventListener('click', addCategory);
    }
    if (DOMC.saveCategoryEditButton) {
        DOMC.saveCategoryEditButton.addEventListener('click', saveCategoryEdit);
    }
    if (DOMC.deleteCategoryFromEditModalButton) {
        DOMC.deleteCategoryFromEditModalButton.addEventListener('click', () => {
            const categoryId = DOMC.editingCategoryDocIdInput.value;
            const category = getAllCategoriesFuncCache().find(c => c.id === categoryId);
            if (categoryId && category) {
                deleteCategory(categoryId, category.name); // Call existing delete function
            } else {
                alert("削除対象のカテゴリIDが見つかりません。");
            }
        });
    }
    // Add event listener for search input
    if (DOMC.categorySearchInput) {
        DOMC.categorySearchInput.addEventListener('input', _renderCategoriesForManagementInternal);
    }
    // Event delegation for list item clicks
    if (DOMC.categoryListContainer) {
        DOMC.categoryListContainer.addEventListener('click', (event) => {
            const clickableName = event.target.closest('.list-item-name-clickable[data-category-id]');
            if (clickableName) {
                openEditCategoryModalById(clickableName.dataset.categoryId);
            }
        });
    }

    console.log("[Category Manager] Initialized.");
}

function populateParentCategoryButtonsUI(buttonContainer, hiddenInput, options = {}) {
    const { currentCategoryIdToExclude = null, selectedParentId = "" } = options;
    const allCategories = getAllCategoriesFuncCache();

    if (!buttonContainer || !hiddenInput) {
        console.warn("populateParentCategoryButtonsUI: buttonContainer or hiddenInput is null.");
        return;
    }
    buttonContainer.innerHTML = '';

    const topLevelButton = document.createElement('div');
    topLevelButton.className = 'category-select-button';
    topLevelButton.textContent = '最上位カテゴリとして設定';
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
            const button = document.createElement('div');
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
                    const categoryBeingEdited = allCategories.find(c => c.id === DOMC.editingCategoryDocIdInput.value);
                    if (categoryBeingEdited) {
                        populateTagsForCategoryEditModal(DOMC.editingCategoryTagsSelector, categoryBeingEdited.id, getAllTagsFuncCache());
                    }
                }
            });
            buttonContainer.appendChild(button);
        });

    hiddenInput.value = selectedParentId;
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
            DOMC.editingTagSearchModeSelect.value = 'AND';
        }
    } else {
        if (DOMC.editingCategoryTagsSelector) DOMC.editingCategoryTagsSelector.innerHTML = '';
    }
}

export function _renderCategoriesForManagementInternal() {
    if (!DOMC.categoryListContainer) return;
    const allCategories = getAllCategoriesFuncCache();
    DOMC.categoryListContainer.innerHTML = '';

    const searchTerm = DOMC.categorySearchInput ? DOMC.categorySearchInput.value.toLowerCase() : "";
    let filteredCategories = allCategories;
    if (searchTerm) {
        filteredCategories = allCategories.filter(cat => cat.name.toLowerCase().includes(searchTerm));
    }


    if (filteredCategories.length === 0) {
        DOMC.categoryListContainer.innerHTML = searchTerm ? '<p>検索条件に一致するカテゴリはありません。</p>' :'<p>カテゴリが登録されていません。</p>';
        if (!searchTerm) { // Only populate for new category if list itself is empty, not due to search
             populateParentCategoryButtonsUI(DOMC.newCategoryParentButtons, DOMC.selectedNewParentCategoryIdInput, { selectedParentId: "" });
        }
        return;
    }

    const sortedCategories = [...filteredCategories].sort((a, b) => {
        if (!a.parentId && b.parentId) return -1;
        if (a.parentId && !b.parentId) return 1;
        if (a.parentId && b.parentId && a.parentId !== b.parentId) {
             const parentA = allCategories.find(p => p.id === a.parentId)?.name || '';
             const parentB = allCategories.find(p => p.id === b.parentId)?.name || '';
             return parentA.localeCompare(parentB, 'ja');
        }
        return a.name.localeCompare(b.name, 'ja');
    });


    sortedCategories.forEach(category => {
        let displayInfo = '';
        let searchModeInfo = '';
        if (!category.parentId || category.parentId === "") {
            displayInfo = "(親カテゴリ)";
        } else {
            const parentCategory = allCategories.find(p => p.id === category.parentId);
            const parentName = parentCategory ? parentCategory.name : '不明な親';
            displayInfo = `(子カテゴリ, 親: ${parentName})`;
            searchModeInfo = category.tagSearchMode === 'OR' ? ' [OR検索]' : ' [AND検索]';
        }

        const div = document.createElement('div');
        div.classList.add('list-item');
        
        const nameSpan = document.createElement('span');
        nameSpan.classList.add('list-item-name-clickable');
        nameSpan.dataset.categoryId = category.id; // For click handler
        nameSpan.innerHTML = `${category.name} <small>${displayInfo}${searchModeInfo}</small>`;
        // Click event is delegated to categoryListContainer

        div.appendChild(nameSpan);
        // Delete button in list items is removed, deletion is through edit modal
        DOMC.categoryListContainer.appendChild(div);
    });

    // Populate parent category selector for the "new category" form (only if not searching)
    if (!searchTerm) {
        populateParentCategoryButtonsUI(DOMC.newCategoryParentButtons, DOMC.selectedNewParentCategoryIdInput, { selectedParentId: "" });
    }
    // console.log("[Category Manager] Categories rendered for management."); // Reduce logging
}

async function addCategory() {
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
        const categoryData = {
            name: name,
            parentId: parentId || "", // Ensure empty string for top-level, not undefined
            createdAt: serverTimestamp()
        };
        if (parentId) categoryData.tagSearchMode = 'AND'; // Default for new child categories

        await addDoc(collection(dbInstance, 'categories'), categoryData);
        
        DOMC.newCategoryNameInput.value = '';
        populateParentCategoryButtonsUI(DOMC.newCategoryParentButtons, DOMC.selectedNewParentCategoryIdInput, { selectedParentId: "" });

        await refreshAllDataCallback();
    } catch (error) {
        console.error("[Category Manager] Error adding category:", error);
        alert("カテゴリの追加に失敗しました。");
    }
}

export function openEditCategoryModalById(categoryId) { // ★★★ EXPORTED ★★★
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

    const isChildCategory = !!currentParentId;
    toggleEditModalChildFields(isChildCategory);

    if (isChildCategory) {
        populateTagsForCategoryEditModal(DOMC.editingCategoryTagsSelector, categoryToEdit.id, getAllTagsFuncCache());
        if(DOMC.editingTagSearchModeSelect) DOMC.editingTagSearchModeSelect.value = currentTagSearchMode;
    }

    openModal('editCategoryModal');
    if(DOMC.editingCategoryNameInput) DOMC.editingCategoryNameInput.focus();
}

function populateTagsForCategoryEditModal(containerElement, categoryId, allTags) {
    const activeTagIds = allTags.filter(tag => tag.categoryIds && tag.categoryIds.includes(categoryId)).map(t => t.id);
    populateTagButtonSelector(containerElement, allTags.sort((a,b) => a.name.localeCompare(b.name, 'ja')), activeTagIds);
}

async function saveCategoryEdit() {
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

    if (newParentId) { // Check for circular dependency if becoming a child
        let currentAncestorId = newParentId;
        const visited = new Set([docId]); // The category itself cannot be its own ancestor
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
        const categoryRef = doc(dbInstance, 'categories', docId);
        const categoryUpdateData = {
            name: newName,
            parentId: newParentId || "", // Ensure empty string for top-level
            updatedAt: serverTimestamp()
        };

        const isBecomingChild = !!newParentId;
        const wasChild = !!(originalCategory && originalCategory.parentId);

        if (isBecomingChild) {
            categoryUpdateData.tagSearchMode = newTagSearchMode;
        } else { // Becoming a parent or staying a parent
            categoryUpdateData.tagSearchMode = deleteField(); // Remove tagSearchMode if it's a parent
        }
        batch.update(categoryRef, categoryUpdateData);

        // Update tag associations
        const allTags = getAllTagsFuncCache();
        allTags.forEach(tag => {
            const tagRef = doc(dbInstance, 'tags', tag.id);
            const isCurrentlySelectedForCat = selectedTagIdsForThisCategory.includes(tag.id);
            const isAlreadyAssociatedWithCat = tag.categoryIds && tag.categoryIds.includes(docId);

            if (isBecomingChild) { // If the category is (or remains) a child
                if (isCurrentlySelectedForCat && !isAlreadyAssociatedWithCat) {
                    batch.update(tagRef, { categoryIds: arrayUnion(docId) });
                } else if (!isCurrentlySelectedForCat && isAlreadyAssociatedWithCat) {
                    batch.update(tagRef, { categoryIds: arrayRemove(docId) });
                }
            } else { // If the category is becoming a parent (or was already a parent and name changed)
                // It should not have tags directly associated with it; tags belong to child categories.
                if (isAlreadyAssociatedWithCat) { // If it previously was a child and had tags.
                     batch.update(tagRef, { categoryIds: arrayRemove(docId) });
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
    const childCheckQuery = query(collection(dbInstance, 'categories'), where('parentId', '==', docId));
    const childSnapshot = await getDocs(childCheckQuery);
    if (!childSnapshot.empty) {
        alert(`カテゴリ「${categoryName}」は他のカテゴリの親として使用されているため削除できません。`);
        return;
    }

    if (confirm(`カテゴリ「${categoryName}」を削除しますか？\nこのカテゴリに紐づいているタグの関連付けも解除されます。\nこの操作は元に戻せません。`)) {
        try {
            const batch = writeBatch(dbInstance);
            // Remove this categoryId from all tags that might be associated with it
            const tagsToUpdateQuery = query(collection(dbInstance, 'tags'), where('categoryIds', 'array-contains', docId));
            const tagsSnapshot = await getDocs(tagsToUpdateQuery);
            tagsSnapshot.forEach(tagDoc => {
                batch.update(tagDoc.ref, { categoryIds: arrayRemove(docId) });
            });

            // Delete the category itself
            batch.delete(doc(dbInstance, 'categories', docId));

            await batch.commit();
            // If the deleted category was being edited, close the edit modal
            if (DOMC.editCategoryModal.style.display !== 'none' && DOMC.editingCategoryDocIdInput.value === docId) {
                closeModal('editCategoryModal');
            }
            await refreshAllDataCallback();
        } catch (error) {
            console.error("[Category Manager] Error deleting category:", error);
            alert("カテゴリの削除または関連タグの更新に失敗しました。");
        }
    }
}
