// js/admin-modules/tag-manager.js
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp, writeBatch, arrayRemove } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { openModal, closeModal, populateCheckboxGroup, getSelectedCheckboxValues } from './ui-helpers.js'; // Removed clearForm as it's not used directly for a tag form

const DOMT = {
    newTagNameInput: null,
    newTagCategoriesCheckboxes: null,
    addTagButton: null,
    tagListContainer: null,
    editTagModal: null,
    editingTagDocIdInput: null,
    editingTagNameInput: null,
    editingTagCategoriesCheckboxes: null,
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

    // Initial UI population is handled by renderAllAdminUISections in admin-main.js
    console.log("[Tag Manager] Initialized.");
}

function getAssignableCategoriesForTag() {
    const allCategories = getAllCategoriesFuncCache();
    return allCategories
        .filter(cat => cat.parentId && cat.parentId !== "") // Only child categories
        .map(cat => {
            const parentCat = allCategories.find(p => p.id === cat.parentId);
            return {
                id: cat.id,
                name: cat.name,
                parentName: parentCat ? parentCat.name : '不明'
            };
        })
        .sort((a,b) => { // Sort by parent name, then child name
            if (a.parentName !== b.parentName) {
                return a.parentName.localeCompare(b.parentName, 'ja');
            }
            return a.name.localeCompare(b.name, 'ja');
        });
}

export function _populateCategoryCheckboxesForTagFormInternal(containerElement, selectedCategoryIds = []) { // Renamed
    if (!containerElement) {
        console.warn("_populateCategoryCheckboxesForTagFormInternal: containerElement is null");
        return;
    }
    const assignableCategories = getAssignableCategoriesForTag();
    populateCheckboxGroup(
        containerElement,
        assignableCategories,
        selectedCategoryIds,
        'tagCategory',
        containerElement.id === 'newTagCategoriesCheckboxes' ? 'new-tag-cat-' : 'edit-tag-cat-'
    );
}


export function _renderTagsForManagementInternal() { // Renamed
    if (!DOMT.tagListContainer) return;
    const allTags = getAllTagsFuncCache();
    const allCategories = getAllCategoriesFuncCache();
    DOMT.tagListContainer.innerHTML = '';

    if (allTags.length === 0) {
        DOMT.tagListContainer.innerHTML = '<p>タグが登録されていません。</p>';
        // Populate checkbox for "new tag" form even if list is empty
        _populateCategoryCheckboxesForTagFormInternal(DOMT.newTagCategoriesCheckboxes);
        return;
    }

    // Sort tags alphabetically
    const sortedTags = [...allTags].sort((a,b) => a.name.localeCompare(b.name, 'ja'));

    sortedTags.forEach(tag => {
        const belongingCategoriesNames = (tag.categoryIds || [])
            .map(catId => {
                const cat = allCategories.find(c => c.id === catId);
                if (cat && cat.parentId) {
                    let name = cat.name;
                    const parentCat = allCategories.find(p => p.id === cat.parentId);
                    name += parentCat ? ` (親:${parentCat.name})` : ` (親:不明)`;
                    return name;
                }
                return null;
            })
            .filter(name => name)
            .sort((a,b) => a.localeCompare(b, 'ja')) // Sort belonging category names
            .join(', ');
        const displayCategories = belongingCategoriesNames || '未分類';

        const div = document.createElement('div');
        div.classList.add('list-item');
        div.innerHTML = `
            <span>${tag.name} <small>(所属: ${displayCategories})</small></span>
            <div>
                <button class="edit-tag action-button" data-tag-id="${tag.id}" title="編集">✎</button>
                <button class="delete-tag action-button delete" data-tag-id="${tag.id}" data-tag-name="${tag.name}" title="削除">×</button>
            </div>
        `;
        DOMT.tagListContainer.appendChild(div);
    });

    DOMT.tagListContainer.querySelectorAll('.edit-tag').forEach(btn => {
        btn.addEventListener('click', (e) => openEditTagModalById(e.currentTarget.dataset.tagId));
    });
    DOMT.tagListContainer.querySelectorAll('.delete-tag').forEach(btn => {
        btn.addEventListener('click', (e) => deleteTag(e.currentTarget.dataset.tagId, e.currentTarget.dataset.tagName));
    });

    // Populate category checkboxes for the "new tag" form
    _populateCategoryCheckboxesForTagFormInternal(DOMT.newTagCategoriesCheckboxes);
    console.log("[Tag Manager] Tags rendered for management.");
}

async function addTag() {
    if (!DOMT.newTagNameInput || !DOMT.newTagCategoriesCheckboxes) return;
    const name = DOMT.newTagNameInput.value.trim();
    const selectedCategoryIdsForTag = getSelectedCheckboxValues(DOMT.newTagCategoriesCheckboxes, 'tagCategory');

    if (!name) { alert("タグ名を入力してください。"); return; }

    const q = query(collection(dbInstance, 'tags'), where('name', '==', name));
    const existingQuery = await getDocs(q);
    if (!existingQuery.empty) { alert("同じ名前のタグが既に存在します。"); return; }

    try {
        await addDoc(collection(dbInstance, 'tags'), {
            name: name,
            categoryIds: selectedCategoryIdsForTag,
            createdAt: serverTimestamp()
        });

        DOMT.newTagNameInput.value = '';
        _populateCategoryCheckboxesForTagFormInternal(DOMT.newTagCategoriesCheckboxes); // Clear selections

        await refreshAllDataCallback();
    } catch (error) {
        console.error("[Tag Manager] Error adding tag:", error);
        alert("タグの追加に失敗しました。");
    }
}

function openEditTagModalById(tagId) {
    const allTags = getAllTagsFuncCache();
    const tagToEdit = allTags.find(t => t.id === tagId);
    if (!tagToEdit) { alert("編集するタグのデータが見つかりません。"); return; }

    DOMT.editingTagDocIdInput.value = tagToEdit.id;
    DOMT.editingTagNameInput.value = tagToEdit.name;

    const validCurrentCategoryIds = (tagToEdit.categoryIds || []).filter(catId => {
        const cat = getAllCategoriesFuncCache().find(c => c.id === catId);
        return cat && cat.parentId;
    });
    _populateCategoryCheckboxesForTagFormInternal(DOMT.editingTagCategoriesCheckboxes, validCurrentCategoryIds);

    openModal('editTagModal');
    if (DOMT.editingTagNameInput) DOMT.editingTagNameInput.focus();
}

async function saveTagEdit() {
    const docId = DOMT.editingTagDocIdInput.value;
    const newName = DOMT.editingTagNameInput.value.trim();
    const newSelectedCategoryIdsForTag = getSelectedCheckboxValues(DOMT.editingTagCategoriesCheckboxes, 'tagCategory');

    if (!newName) { alert("タグ名は空にできません。"); return; }

    const allTags = getAllTagsFuncCache();
    const originalTag = allTags.find(t => t.id === docId);
    if (originalTag && originalTag.name !== newName) {
        const q = query(collection(dbInstance, 'tags'), where('name', '==', newName));
        const existingQuery = await getDocs(q);
        if (existingQuery.docs.some(docSnap => docSnap.id !== docId)) {
            alert("編集後の名前が、他の既存タグと重複します。"); return;
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
        console.error("[Tag Manager] Error saving tag edit:", error);
        alert("タグの更新に失敗しました。");
    }
}

async function deleteTag(docId, tagName) {
    if (confirm(`タグ「${tagName}」を削除しますか？\nこのタグを使用している全てのアイテムからも自動的に解除されます。\nこの操作は元に戻せません。`)) {
        try {
            const batch = writeBatch(dbInstance);
            const itemsToUpdateQuery = query(collection(dbInstance, 'items'), where('tags', 'array-contains', docId));
            const itemsSnapshot = await getDocs(itemsToUpdateQuery);
            itemsSnapshot.forEach(itemDoc => {
                batch.update(itemDoc.ref, { tags: arrayRemove(docId) });
            });
            batch.delete(doc(dbInstance, 'tags', docId));
            await batch.commit();
            await refreshAllDataCallback();
        } catch (error) {
            console.error("[Tag Manager] Error deleting tag:", error);
            alert("タグの削除または関連エンティティの更新に失敗しました。");
        }
    }
}
