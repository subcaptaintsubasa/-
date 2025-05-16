// js/admin-modules/category-manager.js
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp, writeBatch, arrayUnion, arrayRemove, deleteField } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { openModal, closeModal, populateCheckboxGroup, getSelectedCheckboxValues, populateTagButtonSelector, getSelectedTagButtonValues, clearForm } from './ui-helpers.js'; // Assuming populateCheckboxGroup might be used here if tags were directly editable in category modal

const DOMC = { // DOM elements for Category Management
    newCategoryNameInput: null,
    newCategoryParentButtons: null,
    selectedNewParentCategoryIdInput: null,
    addCategoryButton: null,
    categoryListContainer: null,
    // Edit Modal Elements
    editCategoryModal: null,
    editingCategoryDocIdInput: null,
    editingCategoryNameInput: null,
    editingCategoryParentButtons: null,
    selectedEditingParentCategoryIdInput: null,
    editCategoryTagsGroup: null, // Container for tags selector
    editingCategoryTagsSelector: null, // The actual tag selector (buttons)
    tagSearchModeGroup: null,
    editingTagSearchModeSelect: null,
    saveCategoryEditButton: null,
};

let dbInstance = null;
let getAllCategoriesFuncCache = () => []; // Getter for allCategoriesCache from data-loader-admin
let getAllTagsFuncCache = () => [];     // Getter for allTagsCache from data-loader-admin
let refreshAllDataCallback = async () => {}; // Callback to refresh all admin data

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

    if (DOMC.addCategoryButton) {
        DOMC.addCategoryButton.addEventListener('click', addCategory);
    }
    if (DOMC.saveCategoryEditButton) {
        DOMC.saveCategoryEditButton.addEventListener('click', saveCategoryEdit);
    }

    // Initial population
    renderCategoriesForManagement();
    populateParentCategoryButtons(DOMC.newCategoryParentButtons, DOMC.selectedNewParentCategoryIdInput, { selectedParentId: "" });
}

function populateParentCategoryButtons(buttonContainer, hiddenInput, options = {}) {
    const { currentCategoryIdToExclude = null, selectedParentId = "" } = options;
    const allCategories = getAllCategoriesFuncCache();

    if (!buttonContainer || !hiddenInput) return;
    buttonContainer.innerHTML = ''; // Clear previous buttons

    // "Top Level" button
    const topLevelButton = document.createElement('div');
    topLevelButton.classList.add('category-select-button'); // From admin-forms.css
    topLevelButton.textContent = '最上位カテゴリとして設定';
    topLevelButton.dataset.parentId = ""; // Empty string for top-level
    if (selectedParentId === "") {
        topLevelButton.classList.add('active');
    }
    topLevelButton.addEventListener('click', () => {
        selectParentCategoryButtonUI(buttonContainer, hiddenInput, topLevelButton, "");
        // Special handling for edit modal UI based on parent/child status
        if (buttonContainer === DOMC.editingCategoryParentButtons) {
            toggleEditModalChildFields(false);
        }
    });
    buttonContainer.appendChild(topLevelButton);

    // Buttons for existing parent categories
    allCategories
        .filter(cat => (!cat.parentId || cat.parentId === "") && cat.id !== currentCategoryIdToExclude)
        .forEach(cat => {
            const button = document.createElement('div');
            button.classList.add('category-select-button');
            button.textContent = cat.name;
            button.dataset.parentId = cat.id;
            if (selectedParentId === cat.id) {
                button.classList.add('active');
            }
            button.addEventListener('click', () => {
                selectParentCategoryButtonUI(buttonContainer, hiddenInput, button, cat.id);
                if (buttonContainer === DOMC.editingCategoryParentButtons) {
                    toggleEditModalChildFields(true); // Is a child
                     // Repopulate tags for this category if it's being edited
                    const categoryBeingEdited = allCategories.find(c => c.id === DOMC.editingCategoryDocIdInput.value);
                    if (categoryBeingEdited) {
                         populateTagsForCategoryEditModal(DOMC.editingCategoryTagsSelector, categoryBeingEdited.id, getAllTagsFuncCache());
                    }
                }
            });
            buttonContainer.appendChild(button);
        });

    hiddenInput.value = selectedParentId; // Set the hidden input's value
}

function selectParentCategoryButtonUI(container, hiddenInput, clickedButton, parentId) {
    // Deactivate other buttons in the same group
    container.querySelectorAll('.category-select-button.active').forEach(activeBtn => {
        activeBtn.classList.remove('active');
    });
    // Activate the clicked button
    clickedButton.classList.add('active');
    // Update the hidden input
    hiddenInput.value = parentId;
}

function toggleEditModalChildFields(isChild) {
    if (DOMC.tagSearchModeGroup) DOMC.tagSearchModeGroup.style.display = isChild ? 'block' : 'none';
    if (DOMC.editCategoryTagsGroup) DOMC.editCategoryTagsGroup.style.display = isChild ? 'block' : 'none';

    if (isChild) {
        if (DOMC.editingTagSearchModeSelect && !DOMC.editingTagSearchModeSelect.value) {
            DOMC.editingTagSearchModeSelect.value = 'AND'; // Default if becoming child
        }
    } else { // Is becoming parent
        if (DOMC.editingCategoryTagsSelector) DOMC.editingCategoryTagsSelector.innerHTML = ''; // Clear tags
    }
}


function renderCategoriesForManagement() {
    if (!DOMC.categoryListContainer) return;
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
        div.classList.add('list-item'); // From admin-lists.css
        div.innerHTML = `
            <span>${category.name} <small style="color:#555;">${displayInfo}${searchModeInfo}</small></span>
            <div>
                <button class="edit-category action-button" data-category-id="${category.id}" title="編集">✎</button>
                <button class="delete-category action-button delete" data-category-id="${category.id}" data-category-name="${category.name}" title="削除">×</button>
            </div>
        `;
        DOMC.categoryListContainer.appendChild(div);
    });

    // Add event listeners for edit/delete buttons
    DOMC.categoryListContainer.querySelectorAll('.edit-category').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const catId = e.currentTarget.dataset.categoryId;
            openEditCategoryModalById(catId);
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

    if (!name) {
        alert("カテゴリ名を入力してください。");
        return;
    }

    // Check for duplicates
    const q = query(collection(dbInstance, 'categories'), where('name', '==', name), where('parentId', '==', parentId || ""));
    const existingQuery = await getDocs(q);
    if (!existingQuery.empty) {
        alert(parentId ? "同じ親カテゴリ内に同じ名前の子カテゴリが既に存在します。" : "同じ名前の親カテゴリが既に存在します。");
        return;
    }

    try {
        const categoryData = {
            name: name,
            parentId: parentId || "", // Ensure empty string for top-level
            createdAt: serverTimestamp()
        };
        if (parentId) { // Only child categories have tagSearchMode initially
            categoryData.tagSearchMode = 'AND'; // Default for new child
        }

        await addDoc(collection(dbInstance, 'categories'), categoryData);
        
        DOMC.newCategoryNameInput.value = '';
        populateParentCategoryButtons(DOMC.newCategoryParentButtons, DOMC.selectedNewParentCategoryIdInput, { selectedParentId: "" }); // Reset selector

        await refreshAllDataCallback(); // Reload all admin data which will trigger re-renders
        // renderCategoriesForManagement(); // Direct re-render if refreshAllData doesn't handle it
        // populateParentCategoryButtons in other forms might need updating if refreshAllData is too broad
    } catch (error) {
        console.error("[Category Add] Error:", error);
        alert("カテゴリの追加に失敗しました。");
    }
}

function openEditCategoryModalById(categoryId) {
    const allCategories = getAllCategoriesFuncCache();
    const categoryToEdit = allCategories.find(c => c.id === categoryId);
    if (!categoryToEdit) {
        alert("編集するカテゴリのデータが見つかりません。");
        return;
    }

    DOMC.editingCategoryDocIdInput.value = categoryToEdit.id;
    DOMC.editingCategoryNameInput.value = categoryToEdit.name;
    const currentParentId = categoryToEdit.parentId || "";
    const currentTagSearchMode = categoryToEdit.tagSearchMode || 'AND';

    populateParentCategoryButtons(DOMC.editingCategoryParentButtons, DOMC.selectedEditingParentCategoryIdInput, {
        currentCategoryIdToExclude: categoryToEdit.id,
        selectedParentId: currentParentId
    });

    const isChildCategory = !!currentParentId;
    toggleEditModalChildFields(isChildCategory); // Show/hide child-specific fields

    if (isChildCategory) {
        populateTagsForCategoryEditModal(DOMC.editingCategoryTagsSelector, categoryToEdit.id, getAllTagsFuncCache());
        if(DOMC.editingTagSearchModeSelect) DOMC.editingTagSearchModeSelect.value = currentTagSearchMode;
    } else {
        if(DOMC.editingCategoryTagsSelector) DOMC.editingCategoryTagsSelector.innerHTML = '';
    }

    openModal('editCategoryModal');
    if(DOMC.editingCategoryNameInput) DOMC.editingCategoryNameInput.focus();
}

// Uses ui-helpers.populateTagButtonSelector
function populateTagsForCategoryEditModal(containerElement, categoryId, allTags) {
    const activeTagIds = allTags.filter(tag => tag.categoryIds && tag.categoryIds.includes(categoryId)).map(t => t.id);
    populateTagButtonSelector(containerElement, allTags, activeTagIds);
}


async function saveCategoryEdit() {
    const docId = DOMC.editingCategoryDocIdInput.value;
    const newName = DOMC.editingCategoryNameInput.value.trim();
    const newParentId = DOMC.selectedEditingParentCategoryIdInput.value;
    const newTagSearchMode = DOMC.editingTagSearchModeSelect.value;
    const selectedTagIdsForThisCategory = getSelectedTagButtonValues(DOMC.editingCategoryTagsSelector); // From ui-helpers

    if (!newName) { alert("カテゴリ名は空にできません。"); return; }
    if (docId === newParentId) { alert("自身を親カテゴリに設定することはできません。"); return; }

    const allCategories = getAllCategoriesFuncCache();
    const originalCategory = allCategories.find(c => c.id === docId);

    // Check for name conflict
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

    // Check for circular dependency
    if (newParentId) {
        let currentAncestorId = newParentId;
        const visited = new Set([docId]);
        while (currentAncestorId) {
            if (visited.has(currentAncestorId)) {
                alert("循環参照です。この親カテゴリ設定はできません。");
                return;
            }
            visited.add(currentAncestorId);
            const ancestor = allCategories.find(c => c.id === currentAncestorId);
            currentAncestorId = ancestor ? (ancestor.parentId || "") : "";
        }
    }

    try {
        const batch = writeBatch(dbInstance);
        const categoryUpdateData = {
            name: newName,
            parentId: newParentId || "",
            updatedAt: serverTimestamp()
        };

        const isBecomingChild = !!newParentId;
        if (isBecomingChild) {
            categoryUpdateData.tagSearchMode = newTagSearchMode;
        } else {
            categoryUpdateData.tagSearchMode = deleteField(); // Remove if becoming parent
        }
        batch.update(doc(dbInstance, 'categories', docId), categoryUpdateData);

        // Update tag associations
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
            } else { // Becoming a parent, remove all tag associations for this category
                if (isAlreadyAssociatedWithCat) {
                    batch.update(doc(dbInstance, 'tags', tag.id), { categoryIds: arrayRemove(docId) });
                }
            }
        });

        await batch.commit();
        closeModal('editCategoryModal');
        await refreshAllDataCallback(); // Reload and re-render everything
    } catch (error) {
        console.error("[Category Edit] Error:", error);
        alert("カテゴリの更新または関連タグの更新に失敗しました。");
    }
}

async function deleteCategory(docId, categoryName) {
    // Check for child categories
    const childCheckQuery = query(collection(dbInstance, 'categories'), where('parentId', '==', docId));
    const childSnapshot = await getDocs(childCheckQuery);
    if (!childSnapshot.empty) {
        alert(`カテゴリ「${categoryName}」は他のカテゴリの親として使用されているため削除できません。`);
        return;
    }

    if (confirm(`カテゴリ「${categoryName}」を削除しますか？\nこのカテゴリに紐づいているタグの関連付けも解除されます。`)) {
        try {
            const batch = writeBatch(dbInstance);
            // Remove this categoryId from tags
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

// Make renderCategoriesForManagement available if data-loader-admin needs to call it after loading.
// Or, data-loader-admin can emit an event that category-manager listens to.
// For simplicity, refreshAllDataCallback is assumed to handle re-rendering.
export { renderCategoriesForManagement as _renderCategoriesForManagementInternal };
