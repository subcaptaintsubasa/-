// js/admin-modules/tag-manager.js
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp, writeBatch, arrayRemove } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { openModal, closeModal, populateCheckboxGroup, getSelectedCheckboxValues, clearForm } from './ui-helpers.js';

const DOMT = { // DOM elements for Tag Management
    newTagNameInput: null,
    newTagCategoriesCheckboxes: null, // Container for checkboxes (child categories)
    addTagButton: null,
    tagListContainer: null,
    // Edit Modal Elements
    editTagModal: null,
    editingTagDocIdInput: null,
    editingTagNameInput: null,
    editingTagCategoriesCheckboxes: null, // Container for checkboxes in modal
    saveTagEditButton: null,
};

let dbInstance = null;
let getAllCategoriesFuncCache = () => [];
let getAllTagsFuncCache = () => [];
let refreshAllDataCallback = async () => {};

export function initTagManager(dependencies) {
    dbInstance = dependencies.db;
    getAllCategoriesFuncCache = dependencies.getAllCategories;
    getAllTagsFuncCache = dependencies.getAllTags;
    refreshAllDataCallback = dependencies.refreshAllData;

    DOMT.newTagNameInput = document.getElementById('newTagName');
    DOMT.newTagCategoriesCheckboxes = document.getElementById('newTagCategoriesCheckboxes');
    DOMT.addTagButton = document.getElementById('addTagButton');
    DOMT.tagListContainer = document.getElementById('tagListContainer');

    DOMT.editTagModal = document.getElementById('editTagModal');
    DOMT.editingTagDocIdInput = document.getElementById('editingTagDocId');
    DOMT.editingTagNameInput = document.getElementById('editingTagName');
    DOMT.editingTagCategoriesCheckboxes = document.getElementById('editingTagCategoriesCheckboxes');
    DOMT.saveTagEditButton = document.getElementById('saveTagEditButton');

    if (DOMT.addTagButton) {
        DOMT.addTagButton.addEventListener('click', addTag);
    }
    if (DOMT.saveTagEditButton) {
        DOMT.saveTagEditButton.addEventListener('click', saveTagEdit);
    }

    // Initial population
    renderTagsForManagement();
    populateCategoryCheckboxesForTagForm(DOMT.newTagCategoriesCheckboxes);
}

function getAssignableCategories() {
    // Tags can only be assigned to child categories
    const allCategories = getAllCategoriesFuncCache();
    return allCategories
        .filter(cat => cat.parentId && cat.parentId !== "")
        .map(cat => {
            const parentCat = allCategories.find(p => p.id === cat.parentId);
            return {
                id: cat.id,
                name: cat.name,
                parentName: parentCat ? parentCat.name : '不明' // For display in checkbox label
            };
        });
}

function populateCategoryCheckboxesForTagForm(containerElement, selectedCategoryIds = []) {
    const assignableCategories = getAssignableCategories();
    populateCheckboxGroup(
        containerElement,
        assignableCategories,
        selectedCategoryIds,
        'tagCategory', // checkbox name
        'tag-cat-assign-' // id prefix
    );
}


function renderTagsForManagement() {
    if (!DOMT.tagListContainer) return;
    const allTags = getAllTagsFuncCache();
    const allCategories = getAllCategoriesFuncCache();
    DOMT.tagListContainer.innerHTML = '';

    if (allTags.length === 0) {
        DOMT.tagListContainer.innerHTML = '<p>タグが登録されていません。</p>';
        return;
    }

    allTags.forEach(tag => {
        const belongingCategoriesNames = (tag.categoryIds || [])
            .map(catId => {
                const cat = allCategories.find(c => c.id === catId);
                if (cat && cat.parentId) { // Ensure it's a child category
                    let name = cat.name;
                    const parentCat = allCategories.find(p => p.id === cat.parentId);
                    name += parentCat ? ` (親:${parentCat.name})` : ` (親:不明)`;
                    return name;
                }
                return null;
            })
            .filter(name => name)
            .join(', ');
        const displayCategories = belongingCategoriesNames || '未分類';

        const div = document.createElement('div');
        div.classList.add('list-item');
        div.innerHTML = `
            <span>${tag.name} <small style="color:#555;">(所属: ${displayCategories})</small></span>
            <div>
                <button class="edit-tag action-button" data-tag-id="${tag.id}" title="編集">✎</button>
                <button class="delete-tag action-button delete" data-tag-id="${tag.id}" data-tag-name="${tag.name}" title="削除">×</button>
            </div>
        `;
        DOMT.tagListContainer.appendChild(div);
    });

    DOMT.tagListContainer.querySelectorAll('.edit-tag').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tagId = e.currentTarget.dataset.tagId;
            openEditTagModalById(tagId);
        });
    });
    DOMT.tagListContainer.querySelectorAll('.delete-tag').forEach(btn => {
        btn.addEventListener('click', (e) => {
            deleteTag(e.currentTarget.dataset.tagId, e.currentTarget.dataset.tagName);
        });
    });
}

async function addTag() {
    if (!DOMT.newTagNameInput || !DOMT.newTagCategoriesCheckboxes) return;
    const name = DOMT.newTagNameInput.value.trim();
    const selectedCategoryIdsForTag = getSelectedCheckboxValues(DOMT.newTagCategoriesCheckboxes, 'tagCategory');

    if (!name) {
        alert("タグ名を入力してください。");
        return;
    }

    const q = query(collection(dbInstance, 'tags'), where('name', '==', name));
    const existingQuery = await getDocs(q);
    if (!existingQuery.empty) {
        alert("同じ名前のタグが既に存在します。");
        return;
    }

    try {
        await addDoc(collection(dbInstance, 'tags'), {
            name: name,
            categoryIds: selectedCategoryIdsForTag,
            createdAt: serverTimestamp()
        });

        DOMT.newTagNameInput.value = '';
        populateCategoryCheckboxesForTagForm(DOMT.newTagCategoriesCheckboxes); // Clear checkboxes

        await refreshAllDataCallback(); // Reload and re-render
    } catch (error) {
        console.error("[Tag Add] Error:", error);
        alert("タグの追加に失敗しました。");
    }
}

function openEditTagModalById(tagId) {
    const allTags = getAllTagsFuncCache();
    const tagToEdit = allTags.find(t => t.id === tagId);
    if (!tagToEdit) {
        alert("編集するタグのデータが見つかりません。");
        return;
    }

    DOMT.editingTagDocIdInput.value = tagToEdit.id;
    DOMT.editingTagNameInput.value = tagToEdit.name;

    const validCurrentCategoryIds = (tagToEdit.categoryIds || []).filter(catId => {
        const cat = getAllCategoriesFuncCache().find(c => c.id === catId);
        return cat && cat.parentId; // Ensure it's a valid child category ID
    });
    populateCategoryCheckboxesForTagForm(DOMT.editingTagCategoriesCheckboxes, validCurrentCategoryIds);

    openModal('editTagModal');
    if (DOMT.editingTagNameInput) DOMT.editingTagNameInput.focus();
}

async function saveTagEdit() {
    const docId = DOMT.editingTagDocIdInput.value;
    const newName = DOMT.editingTagNameInput.value.trim();
    const newSelectedCategoryIdsForTag = getSelectedCheckboxValues(DOMT.editingTagCategoriesCheckboxes, 'tagCategory');

    if (!newName) {
        alert("タグ名は空にできません。");
        return;
    }

    const allTags = getAllTagsFuncCache();
    const originalTag = allTags.find(t => t.id === docId);
    if (originalTag && originalTag.name !== newName) {
        const q = query(collection(dbInstance, 'tags'), where('name', '==', newName));
        const existingQuery = await getDocs(q);
        let conflict = false;
        existingQuery.forEach(docSnap => { if (docSnap.id !== docId) conflict = true; });
        if (conflict) {
            alert("編集後の名前が、他の既存タグと重複します。");
            return;
        }
    }

    try {
        await updateDoc(doc(dbInstance, 'tags', docId), {
            name: newName,
            categoryIds: newSelectedCategoryIdsForTag,
            updatedAt: serverTimestamp()
        });
        closeModal('editTagModal');
        await refreshAllDataCallback();
    } catch (error) {
        console.error("[Tag Edit] Error:", error);
        alert("タグの更新に失敗しました。");
    }
}

async function deleteTag(docId, tagName) {
    if (confirm(`タグ「${tagName}」を削除しますか？\nこのタグを使用している全てのアイテムからも自動的に解除されます。`)) {
        try {
            const batch = writeBatch(dbInstance);

            // Remove tag from items' 'tags' array
            const itemsToUpdateQuery = query(collection(dbInstance, 'items'), where('tags', 'array-contains', docId));
            const itemsSnapshot = await getDocs(itemsToUpdateQuery);
            itemsSnapshot.forEach(itemDoc => {
                batch.update(itemDoc.ref, { tags: arrayRemove(docId) });
            });

            batch.delete(doc(dbInstance, 'tags', docId));
            await batch.commit();
            await refreshAllDataCallback();
        } catch (error) {
            console.error("[Tag Delete] Error:", error);
            alert("タグの削除または関連エンティティの更新に失敗しました。");
        }
    }
}

export { renderTagsForManagement as _renderTagsForManagementInternal };
