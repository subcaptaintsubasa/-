// js/admin-modules/tag-manager.js
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp, writeBatch, arrayRemove } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { openModal, closeModal, populateCheckboxGroup, getSelectedCheckboxValues } from './ui-helpers.js';

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
    deleteTagFromEditModalButton: null, // 新しい削除ボタン
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
                deleteTag(tagId, tag.name); // tagNameを渡す
            } else {
                alert("削除対象のタグIDが見つかりません。");
            }
        });
    }
    // イベントデリゲーションでタグリストのクリックを処理
    if (DOMT.tagListContainer) {
        DOMT.tagListContainer.addEventListener('click', handleTagListClick);
    }
    console.log("[Tag Manager] Initialized.");
}

function getAssignableCategoriesForTag() {
    const allCategories = getAllCategoriesFuncCache();
    return allCategories
        .filter(cat => cat.parentId && cat.parentId !== "")
        .map(cat => {
            const parentCat = allCategories.find(p => p.id === cat.parentId);
            return {
                id: cat.id,
                name: cat.name,
                parentName: parentCat ? parentCat.name : '不明'
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
        console.warn("_populateCategoryCheckboxesForTagFormInternal: containerElement is null");
        return;
    }
    const assignableCategories = getAssignableCategoriesForTag();
    populateCheckboxGroup(
        containerElement,
        assignableCategories,
        selectedCategoryIds,
        'tagCategory', // name属性
        containerElement.id === 'newTagCategoriesCheckboxes' ? 'new-tag-cat-' : 'edit-tag-cat-' // id prefix
    );
}

export function _renderTagsForManagementInternal() {
    if (!DOMT.tagListContainer) return;
    const allTags = getAllTagsFuncCache();
    const allCategories = getAllCategoriesFuncCache();
    DOMT.tagListContainer.innerHTML = '';

    if (allTags.length === 0) {
        DOMT.tagListContainer.innerHTML = '<p>タグが登録されていません。</p>';
        _populateCategoryCheckboxesForTagFormInternal(DOMT.newTagCategoriesCheckboxes);
        return;
    }

    // タグをカテゴリIDごとにグループ化
    const tagsByCategoryId = new Map();
    const unclassifiedTags = [];

    allTags.forEach(tag => {
        if (tag.categoryIds && tag.categoryIds.length > 0) {
            tag.categoryIds.forEach(catId => {
                if (!tagsByCategoryId.has(catId)) {
                    tagsByCategoryId.set(catId, []);
                }
                tagsByCategoryId.get(catId).push(tag);
            });
        } else {
            unclassifiedTags.push(tag);
        }
    });

    // 表示順: 親カテゴリ名 -> 子カテゴリ名 -> タグ名
    const childCategories = allCategories
        .filter(cat => cat.parentId && cat.parentId !== "")
        .sort((a, b) => {
            const parentA = allCategories.find(p => p.id === a.parentId)?.name || '';
            const parentB = allCategories.find(p => p.id === b.parentId)?.name || '';
            if (parentA !== parentB) return parentA.localeCompare(parentB, 'ja');
            return a.name.localeCompare(b.name, 'ja');
        });

    childCategories.forEach(childCat => {
        const tagsInThisChildCat = (tagsByCategoryId.get(childCat.id) || []).sort((a,b) => a.name.localeCompare(b.name, 'ja'));
        if (tagsInThisChildCat.length > 0) {
            const groupDiv = document.createElement('div');
            groupDiv.classList.add('tag-group');
            const parentCat = allCategories.find(p => p.id === childCat.parentId);
            const groupHeader = document.createElement('h5'); // または h4
            groupHeader.classList.add('tag-group-header');
            groupHeader.textContent = `${childCat.name} (親: ${parentCat ? parentCat.name : '不明'}) のタグ:`;
            groupDiv.appendChild(groupHeader);

            tagsInThisChildCat.forEach(tag => {
                appendTagToList(tag, groupDiv);
            });
            DOMT.tagListContainer.appendChild(groupDiv);
        }
    });

    if (unclassifiedTags.length > 0) {
        const groupDiv = document.createElement('div');
        groupDiv.classList.add('tag-group');
        const groupHeader = document.createElement('h5');
        groupHeader.classList.add('tag-group-header');
        groupHeader.textContent = '未分類のタグ:';
        groupDiv.appendChild(groupHeader);
        unclassifiedTags.sort((a,b) => a.name.localeCompare(b.name, 'ja')).forEach(tag => {
            appendTagToList(tag, groupDiv);
        });
        DOMT.tagListContainer.appendChild(groupDiv);
    }
    
    if (DOMT.tagListContainer.children.length === 0 && allTags.length > 0) {
         DOMT.tagListContainer.innerHTML = '<p>表示できるグループ化されたタグはありません（子カテゴリに紐づくタグがないか、未分類タグもありません）。</p>';
    }


    _populateCategoryCheckboxesForTagFormInternal(DOMT.newTagCategoriesCheckboxes);
    console.log("[Tag Manager] Tags rendered by category group for management.");
}

function appendTagToList(tag, containerElement) {
    const div = document.createElement('div');
    div.classList.add('list-item'); // Reuse existing list-item style
    div.innerHTML = `
        <span class="list-item-name-clickable" data-tag-id="${tag.id}" data-action="edit">${tag.name}</span>
        <!-- アクションボタンは削除 -->
    `;
    containerElement.appendChild(div);
}

function handleTagListClick(event) {
    const target = event.target;
    const clickableName = target.closest('.list-item-name-clickable[data-tag-id]');
    
    if (clickableName && clickableName.dataset.action === 'edit') {
        const tagId = clickableName.dataset.tagId;
        openEditTagModalById(tagId);
    }
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
            categoryIds: selectedCategoryIdsForTag, // 空配列も許容
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

    // タグが所属できるのは子カテゴリのみなので、そのバリデーションをキャッシュ取得時に行う
    const validCurrentCategoryIds = (tagToEdit.categoryIds || []).filter(catId => {
        const cat = getAllCategoriesFuncCache().find(c => c.id === catId);
        return cat && cat.parentId; // Is a child category
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
    if (originalTag && originalTag.name !== newName) { // 名前が変更された場合のみ重複チェック
        const q = query(collection(dbInstance, 'tags'), where('name', '==', newName));
        const existingQuery = await getDocs(q);
        if (existingQuery.docs.some(docSnap => docSnap.id !== docId)) { // 自身以外のドキュメントで重複があるか
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
            // アイテムからこのタグを削除
            const itemsToUpdateQuery = query(collection(dbInstance, 'items'), where('tags', 'array-contains', docId));
            const itemsSnapshot = await getDocs(itemsToUpdateQuery);
            itemsSnapshot.forEach(itemDoc => {
                batch.update(itemDoc.ref, { tags: arrayRemove(docId) });
            });
            // タグ自体を削除
            batch.delete(doc(dbInstance, 'tags', docId));
            await batch.commit();
            
            closeModal('editTagModal'); // 編集モーダルが開いていたら閉じる
            await refreshAllDataCallback();
        } catch (error) {
            console.error("[Tag Manager] Error deleting tag:", error);
            alert("タグの削除または関連エンティティの更新に失敗しました。");
        }
    }
}
