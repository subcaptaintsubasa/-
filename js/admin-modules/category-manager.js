// js/admin-modules/category-manager.js
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp, writeBatch, arrayUnion, arrayRemove, deleteField } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { openModal, closeModal, populateTagButtonSelector, getSelectedTagButtonValues, clearForm } from './ui-helpers.js';

const DOMC = {
    // Elements within the categoryManagementModal
    newCategoryNameInput: null,
    newCategoryParentButtons: null,
    selectedNewParentCategoryIdInput: null,
    addCategoryButton: null,
    categoryListContainer: null,
    // Edit Modal Elements (these are for the separate #editCategoryModal)
    editCategoryModal: null,
    editingCategoryDocIdInput: null,
    editingCategoryNameInput: null,
    editingCategoryParentButtons: null, // This is for the #editCategoryModal
    selectedEditingParentCategoryIdInput: null, // This is for the #editCategoryModal
    editCategoryTagsGroup: null,
    editingCategoryTagsSelector: null,
    tagSearchModeGroup: null,
    editingTagSearchModeSelect: null,
    saveCategoryEditButton: null,
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

    // Get elements within the #categoryManagementModal
    DOMC.newCategoryNameInput = document.getElementById('newCategoryName_inModal');
    DOMC.newCategoryParentButtons = document.getElementById('newCategoryParentButtons_inModal');
    DOMC.selectedNewParentCategoryIdInput = document.getElementById('selectedNewParentCategoryId_inModal');
    DOMC.addCategoryButton = document.getElementById('addCategoryButton_inModal');
    DOMC.categoryListContainer = document.getElementById('categoryListContainer_inModal');

    // Get elements for the separate edit modal (for editing an individual category)
    DOMC.editCategoryModal = document.getElementById('editCategoryModal'); // This is the smaller, specific edit modal
    DOMC.editingCategoryDocIdInput = document.getElementById('editingCategoryDocId');
    DOMC.editingCategoryNameInput = document.getElementById('editingCategoryName');
    DOMC.editingCategoryParentButtons = document.getElementById('editingCategoryParentButtons'); // In #editCategoryModal
    DOMC.selectedEditingParentCategoryIdInput = document.getElementById('selectedEditingParentCategoryId'); // In #editCategoryModal
    DOMC.editCategoryTagsGroup = document.getElementById('editCategoryTagsGroup');
    DOMC.editingCategoryTagsSelector = document.getElementById('editingCategoryTagsSelector');
    DOMC.tagSearchModeGroup = document.getElementById('tagSearchModeGroup');
    DOMC.editingTagSearchModeSelect = document.getElementById('editingTagSearchMode');
    DOMC.saveCategoryEditButton = document.getElementById('saveCategoryEditButton');


    if (DOMC.addCategoryButton) {
        DOMC.addCategoryButton.addEventListener('click', addCategory);
    }
    if (DOMC.saveCategoryEditButton) { // For the separate edit modal
        DOMC.saveCategoryEditButton.addEventListener('click', saveCategoryEdit);
    }

    // Initial population for the form inside #categoryManagementModal
    _renderCategoriesForManagementInternal(); // Render list inside the modal
    populateParentCategoryButtonsForForm(DOMC.newCategoryParentButtons, DOMC.selectedNewParentCategoryIdInput, { selectedParentId: "" });
}

function populateParentCategoryButtonsForForm(buttonContainer, hiddenInput, options = {}) {
    const { currentCategoryIdToExclude = null, selectedParentId = "" } = options;
    const allCategories = getAllCategoriesFuncCache();

    if (!buttonContainer || !hiddenInput) return;
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
        // For the #editCategoryModal, specific UI toggles are needed
        if (buttonContainer === DOMC.editingCategoryParentButtons) {
            toggleEditModalChildFieldsUI(false);
        }
    });
    buttonContainer.appendChild(topLevelButton);

    allCategories
        .filter(cat => (!cat.parentId || cat.parentId === "") && cat.id !== currentCategoryIdToExclude)
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
                    toggleEditModalChildFieldsUI(true);
                     const categoryBeingEdited = allCategories.find(c => c.id === DOMC.editingCategoryDocIdInput.value);
                     if (categoryBeingEdited) {
                         populateTagsForCategoryEditModalUI(DOMC.editingCategoryTagsSelector, categoryBeingEdited.id, getAllTagsFuncCache());
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

function toggleEditModalChildFieldsUI(isChild) { // For #editCategoryModal
    if (DOMC.tagSearchModeGroup) DOMC.tagSearchModeGroup.style.display = isChild ? 'block' : 'none';
    if (DOMC.editCategoryTagsGroup) DOMC.editCategoryTagsGroup.style.display = isChild ? 'block' : 'none';
    if (isChild && DOMC.editingTagSearchModeSelect && !DOMC.editingTagSearchModeSelect.value) {
        DOMC.editingTagSearchModeSelect.value = 'AND';
    } else if (!isChild && DOMC.editingCategoryTagsSelector) {
        DOMC.editingCategoryTagsSelector.innerHTML = '';
    }
}

export function _renderCategoriesForManagementInternal() { // Renamed, called by admin-main
    if (!DOMC.categoryListContainer) {
        console.warn("Category list container (for modal) not found.");
        return;
    }
    const allCategories = getAllCategoriesFuncCache();
    DOMC.categoryListContainer.innerHTML = '';

    if (allCategories.length === 0) {
        DOMC.categoryListContainer.innerHTML = '<p>カテゴリが登録されていません。</p>';
        return;
    }

    allCategories.forEach(category => {
        let displayInfo = '';
        let searchModeInfo = '';
        if (!category.parentId || category.parentId === "") {
            displayInfo = "(親カテゴリ)";
        } else {
            const parentCategory = allCategories.find(p => p.id === category.parentId);
            const parentName = parentCategory ? parentCategory.name : '不明な親';
            displayInfo = `(子カテゴリ, 親: ${parentName})`;
            searchModeInfo = category.tagSearchMode === 'OR' ? ' (OR検索)' : ' (AND検索)';
        }

        const div = document.createElement('div');
        div.classList.add('list-item');
        div.innerHTML = `
            <span>${category.name} <small style="color:#555;">${displayInfo}${searchModeInfo}</small></span>
            <div>
                <button class="edit-category action-button" data-category-id="${category.id}" title="編集">✎</button>
                <button class="delete-category action-button delete" data-category-id="${category.id}" data-category-name="${category.name}" title="削除">×</button>
            </div>
        `;
        DOMC.categoryListContainer.appendChild(div);
    });

    DOMC.categoryListContainer.querySelectorAll('.edit-category').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const catId = e.currentTarget.dataset.categoryId;
            openEditCategoryModalById(catId); // This opens the #editCategoryModal
        });
    });
    DOMC.categoryListContainer.querySelectorAll('.delete-category').forEach(btn => {
        btn.addEventListener('click', (e) => {
            deleteCategory(e.currentTarget.dataset.categoryId, e.currentTarget.dataset.categoryName);
        });
    });
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
            name: name, parentId: parentId || "", createdAt: serverTimestamp()
        };
        if (parentId) categoryData.tagSearchMode = 'AND';

        await addDoc(collection(dbInstance, 'categories'), categoryData);
        
        DOMC.newCategoryNameInput.value = ''; // Clear input in the management modal
        populateParentCategoryButtonsForForm(DOMC.newCategoryParentButtons, DOMC.selectedNewParentCategoryIdInput, { selectedParentId: "" });

        await refreshAllDataCallback();
    } catch (error) {
        console.error("[Category Add] Error:", error);
        alert("カテゴリの追加に失敗しました。");
    }
}

function openEditCategoryModalById(categoryId) { // This function opens the #editCategoryModal
    const allCategories = getAllCategoriesFuncCache();
    const categoryToEdit = allCategories.find(c => c.id === categoryId);
    if (!categoryToEdit) { alert("編集するカテゴリのデータが見つかりません。"); return; }

    DOMC.editingCategoryDocIdInput.value = categoryToEdit.id;
    DOMC.editingCategoryNameInput.value = categoryToEdit.name;
    const currentParentId = categoryToEdit.parentId || "";
    const currentTagSearchMode = categoryToEdit.tagSearchMode || 'AND';

    populateParentCategoryButtonsForForm(DOMC.editingCategoryParentButtons, DOMC.selectedEditingParentCategoryIdInput, {
        currentCategoryIdToExclude: categoryToEdit.id,
        selectedParentId: currentParentId
    });

    const isChildCategory = !!currentParentId;
    toggleEditModalChildFieldsUI(isChildCategory);

    if (isChildCategory) {
        populateTagsForCategoryEditModalUI(DOMC.editingCategoryTagsSelector, categoryToEdit.id, getAllTagsFuncCache());
        if(DOMC.editingTagSearchModeSelect) DOMC.editingTagSearchModeSelect.value = currentTagSearchMode;
    } else {
        if(DOMC.editingCategoryTagsSelector) DOMC.editingCategoryTagsSelector.innerHTML = '';
    }

    openModal('editCategoryModal'); // From ui-helpers.js
    if(DOMC.editingCategoryNameInput) DOMC.editingCategoryNameInput.focus();
}

function populateTagsForCategoryEditModalUI(containerElement, categoryId, allTags) {
    const activeTagIds = allTags.filter(tag => tag.categoryIds && tag.categoryIds.includes(categoryId)).map(t => t.id);
    populateTagButtonSelector(containerElement, allTags, activeTagIds); // From ui-helpers.js
}


async function saveCategoryEdit() { // For the #editCategoryModal
    const docId = DOMC.editingCategoryDocIdInput.value;
    const newName = DOMC.editingCategoryNameInput.value.trim();
    const newParentId = DOMC.selectedEditingParentCategoryIdInput.value;
    const newTagSearchMode = DOMC.editingTagSearchModeSelect.value;
    const selectedTagIdsForThisCategory = getSelectedTagButtonValues(DOMC.editingCategoryTagsSelector);

    if (!newName) { alert("カテゴリ名は空にできません。"); return; }
    if (docId === newParentId) { alert("自身を親カテゴリに設定することはできません。"); return; }

    // ... (rest of validation and save logic from previous full version) ...
    const allCategories = getAllCategoriesFuncCache();
    const originalCategory = allCategories.find(c => c.id === docId);
    if (originalCategory && (originalCategory.name !== newName || (originalCategory.parentId || "") !== (newParentId || ""))) {
        const q = query(collection(dbInstance, 'categories'), where('name', '==', newName), where('parentId', '==', newParentId || ""));
        const existingQuery = await getDocs(q);
        let conflict = false;
        existingQuery.forEach(docSnap => { if (docSnap.id !== docId) conflict = true; });
        if (conflict) {
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
        const categoryUpdateData = {
            name: newName, parentId: newParentId || "", updatedAt: serverTimestamp()
        };
        const isBecomingChild = !!newParentId;
        if (isBecomingChild) {
            categoryUpdateData.tagSearchMode = newTagSearchMode;
        } else {
            categoryUpdateData.tagSearchMode = deleteField();
        }
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
        closeModal('editCategoryModal'); // From ui-helpers.js
        await refreshAllDataCallback();
    } catch (error) {
        console.error("[Category Edit] Error:", error);
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
    if (confirm(`カテゴリ「${categoryName}」を削除しますか？\nこのカテゴリに紐づいているタグの関連付けも解除されます。`)) {
        try {
            const batch = writeBatch(dbInstance);
            const tagsToUpdateQuery = query(collection(dbInstance, 'tags'), where('categoryIds', 'array-contains', docId));
            const tagsSnapshot = await getDocs(tagsToUpdateQuery);
            tagsSnapshot.forEach(tagDoc => {
                batch.update(tagDoc.ref, { categoryIds: arrayRemove(docId) });
            });
            batch.delete(doc(dbInstance, 'categories', docId));
            await batch.commit();
            await refreshAllDataCallback();
        } catch (error) {
            console.error("[Category Delete] Error:", error);
            alert("カテゴリの削除または関連タグの更新に失敗しました。");
        }
    }
}
