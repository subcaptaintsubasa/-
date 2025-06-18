// js/admin-modules/tag-manager.js
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp, writeBatch, arrayRemove } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { openModal, closeModal, populateCheckboxGroup, getSelectedCheckboxValues } from './ui-helpers.js';

const DOMT = {
    newTagNameInput: null,
    newTagCategoriesCheckboxes: null,
    addTagButton: null,
    tagListContainer: null,
    tagSearchInput: null,
    editTagModal: null,
    editingTagDocIdInput: null,
    editingTagNameInput: null,
    editingTagCategoriesCheckboxes: null,
    saveTagEditButton: null,
    deleteTagFromEditModalButton: null,
};

let dbInstance = null;
let getAllCategoriesFuncCache = () => [];
let getAllTagsFuncCache = () => [];
let getItemsFuncCache = () => []; // Items for checking usage on delete
let refreshAllDataCallback = async () => {};

export function initTagManager(dependencies) {
    dbInstance = dependencies.db;
    getAllCategoriesFuncCache = dependencies.getAllCategories;
    getAllTagsFuncCache = dependencies.getAllTags;
    getItemsFuncCache = dependencies.getItems; // Get items cache
    refreshAllDataCallback = dependencies.refreshAllData;

    DOMT.newTagNameInput = document.getElementById('newTagName');
    DOMT.newTagCategoriesCheckboxes = document.getElementById('newTagCategoriesCheckboxes');
    DOMT.addTagButton = document.getElementById('addTagButton');
    DOMT.tagListContainer = document.getElementById('tagListContainer');
    DOMT.tagSearchInput = document.getElementById('tagSearchInput');

    DOMT.editTagModal = document.getElementById('editTagModal');
    DOMT.editingTagDocIdInput = document.getElementById('editingTagDocId');
    DOMT.editingTagNameInput = document.getElementById('editingTagName');
    DOMT.editingTagCategoriesCheckboxes = document.getElementById('editingTagCategoriesCheckboxes');
    DOMT.saveTagEditButton = document.getElementById('saveTagEditButton');
    DOMT.deleteTagFromEditModalButton = document.getElementById('deleteTagFromEditModalButton');


    if (DOMT.addTagButton) {
        DOMT.addTagButton.addEventListener('click', addTag);
    }
    if (DOMT.saveTagEditButton) {
        DOMT.saveTagEditButton.addEventListener('click', saveTagEdit);
    }
    if (DOMT.deleteTagFromEditModalButton) {
        DOMT.deleteTagFromEditModalButton.addEventListener('click', () => {
            const tagId = DOMT.editingTagDocIdInput.value;
            const tag = getAllTagsFuncCache().find(t => t.id === tagId);
            if (tagId && tag) {
                logicalDeleteTag(tagId, tag.name); // Changed to logicalDeleteTag
            } else {
                alert("削除対象のタグIDが見つかりません。");
            }
        });
    }
    if (DOMT.tagSearchInput) {
        DOMT.tagSearchInput.addEventListener('input', _renderTagsForManagementInternal);
    }
    if (DOMT.tagListContainer) {
        DOMT.tagListContainer.addEventListener('click', (event) => {
            const clickableName = event.target.closest('.list-item-name-clickable[data-tag-id]');
            if (clickableName) {
                openEditTagModalById(clickableName.dataset.tagId);
            }
        });
    }

    console.log("[Tag Manager] Initialized for logical delete.");
}

function getAssignableCategoriesForTag() {
    const allCategories = getAllCategoriesFuncCache(); // Assumes this returns non-deleted
    return allCategories
        .filter(cat => cat.parentId && cat.parentId !== "" && !cat.isDeleted) // Ensure category itself is not deleted
        .map(cat => {
            const parentCat = allCategories.find(p => p.id === cat.parentId && !p.isDeleted); // Ensure parent is not deleted
            return {
                id: cat.id,
                name: cat.name,
                parentName: parentCat ? parentCat.name : '不明(親削除済?)'
            };
        })
        .sort((a,b) => {
            if (a.parentName !== b.parentName) {
                return a.parentName.localeCompare(b.parentName, 'ja');
            }
            return a.name.localeCompare(b.name, 'ja');
        });
}

export function _populateCategoryCheckboxesForTagFormInternal(containerElement, selectedCategoryIds = []) {
    if (!containerElement) {
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


export function _renderTagsForManagementInternal() {
    if (!DOMT.tagListContainer) return;
    const allTags = getAllTagsFuncCache(); // Assumes this returns non-deleted tags
    const allCategories = getAllCategoriesFuncCache(); // Assumes this returns non-deleted categories
    DOMT.tagListContainer.innerHTML = '';

    const searchTerm = DOMT.tagSearchInput ? DOMT.tagSearchInput.value.toLowerCase() : "";
    let filteredTags = allTags;
    if (searchTerm) {
        filteredTags = allTags.filter(tag => tag.name.toLowerCase().includes(searchTerm));
    }

    if (filteredTags.length === 0) {
        DOMT.tagListContainer.innerHTML = searchTerm ? '<p>検索条件に一致するタグはありません。</p>' : '<p>タグが登録されていません。</p>';
        if (!searchTerm) _populateCategoryCheckboxesForTagFormInternal(DOMT.newTagCategoriesCheckboxes);
        return;
    }

    const sortedTags = [...filteredTags].sort((a,b) => a.name.localeCompare(b.name, 'ja'));

    sortedTags.forEach(tag => {
        const belongingCategoriesNames = (tag.categoryIds || [])
            .map(catId => {
                const cat = allCategories.find(c => c.id === catId); // Already filtered by isDeleted=false
                if (cat && cat.parentId) { // Ensure it's a child category
                    let name = cat.name;
                    const parentCat = allCategories.find(p => p.id === cat.parentId); // Already filtered
                    name += parentCat ? ` (親:${parentCat.name})` : ` (親:不明)`;
                    return name;
                }
                return null;
            })
            .filter(name => name)
            .sort((a,b) => a.localeCompare(b, 'ja'))
            .join(', ');
        const displayCategories = belongingCategoriesNames || '未分類';

        const div = document.createElement('div');
        div.classList.add('list-item');
        
        const nameSpan = document.createElement('span');
        nameSpan.classList.add('list-item-name-clickable');
        nameSpan.dataset.tagId = tag.id;
        nameSpan.innerHTML = `${tag.name} <small>(所属: ${displayCategories})</small>`;
        
        div.appendChild(nameSpan);
        DOMT.tagListContainer.appendChild(div);
    });

    if (!searchTerm) _populateCategoryCheckboxesForTagFormInternal(DOMT.newTagCategoriesCheckboxes);
}

async function addTag() {
    if (!DOMT.newTagNameInput || !DOMT.newTagCategoriesCheckboxes) return;
    const name = DOMT.newTagNameInput.value.trim();
    const selectedCategoryIdsForTag = getSelectedCheckboxValues(DOMT.newTagCategoriesCheckboxes, 'tagCategory');

    if (!name) { alert("タグ名を入力してください。"); return; }

    const q = query(collection(dbInstance, 'tags'), 
                    where('name', '==', name),
                    where('isDeleted', '==', false) // Check against non-deleted tags
                  );
    const existingQuery = await getDocs(q);
    if (!existingQuery.empty) { alert("同じ名前のタグが既に存在します。"); return; }

    try {
        await addDoc(collection(dbInstance, 'tags'), {
            name: name,
            categoryIds: selectedCategoryIdsForTag,
            isDeleted: false, // New tags are not deleted
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp() // Add updatedAt
        });

        DOMT.newTagNameInput.value = '';
        _populateCategoryCheckboxesForTagFormInternal(DOMT.newTagCategoriesCheckboxes);

        await refreshAllDataCallback();
    } catch (error) {
        console.error("[Tag Manager] Error adding tag:", error);
        alert("タグの追加に失敗しました。");
    }
}

export function openEditTagModalById(tagId) {
    const allTags = getAllTagsFuncCache(); // Assumes non-deleted
    const tagToEdit = allTags.find(t => t.id === tagId);
    if (!tagToEdit) { alert("編集するタグのデータが見つかりません。"); return; }

    DOMT.editingTagDocIdInput.value = tagToEdit.id;
    DOMT.editingTagNameInput.value = tagToEdit.name;

    const allCategories = getAllCategoriesFuncCache(); // Assumes non-deleted
    const validCurrentCategoryIds = (tagToEdit.categoryIds || []).filter(catId => {
        const cat = allCategories.find(c => c.id === catId);
        return cat && cat.parentId; // Ensure category exists and is a child
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

    const allTags = getAllTagsFuncCache(); // Assumes non-deleted
    if (allTags.some(t => t.id !== docId && t.name.toLowerCase() === newName.toLowerCase())) {
        alert("編集後の名前が、他の既存タグと重複します。"); return;
    }

    try {
        await updateDoc(doc(dbInstance, 'tags', docId), {
            name: newName,
            categoryIds: newSelectedCategoryIdsForTag,
            updatedAt: serverTimestamp() // Update timestamp
        });
        closeModal('editTagModal');
        await refreshAllDataCallback();
    } catch (error) {
        console.error("[Tag Manager] Error saving tag edit:", error);
        alert("タグの更新に失敗しました。");
    }
}

async function logicalDeleteTag(docId, tagName) {
    // Check if tag is used by any non-deleted items
    const itemsCache = getItemsFuncCache(); // Assumes non-deleted items
    const itemsUsingTag = itemsCache.filter(item => item.tags && item.tags.includes(docId));

    if (itemsUsingTag.length > 0) {
        alert(`タグ「${tagName}」は ${itemsUsingTag.length} 個のアイテムで使用されているため、論理削除できません。先にアイテムからこのタグを解除してください。`);
        return;
    }

    if (confirm(`タグ「${tagName}」を論理削除しますか？\nこのタグは一覧などには表示されなくなりますが、データは残ります。`)) {
        try {
            // No need to batch update items if we prevent deletion when in use.
            // If we allowed deletion while in use, we would need to remove the tagId from items.
            await updateDoc(doc(dbInstance, 'tags', docId), {
                isDeleted: true,
                updatedAt: serverTimestamp() // Update timestamp
            });
            
            if (DOMT.editTagModal.style.display !== 'none' && DOMT.editingTagDocIdInput.value === docId) {
                closeModal('editTagModal');
            }
            await refreshAllDataCallback();
        } catch (error) {
            console.error("[Tag Manager] Error logically deleting tag:", error);
            alert("タグの論理削除に失敗しました。");
        }
    }
}
