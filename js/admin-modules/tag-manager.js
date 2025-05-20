// js/admin-modules/tag-manager.js
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp, writeBatch, arrayRemove } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { openModal, closeModal, populateCheckboxGroup, getSelectedCheckboxValues, openEnlargedListModal } from './ui-helpers.js'; // ★★★ openEnlargedListModal をインポート ★★★

const DOMT = {
    newTagNameInput: null,
    newTagCategoriesCheckboxes: null,
    addTagButton: null,
    tagListContainer: null,
    tagSearchInput: null,
    enlargeTagListButton: null, // ★★★ 追加 ★★★
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
let refreshAllDataCallback = async () => {};
let currentTagSearchTerm = "";

export function initTagManager(dependencies) {
    dbInstance = dependencies.db;
    getAllCategoriesFuncCache = dependencies.getAllCategories;
    getAllTagsFuncCache = dependencies.getAllTags;
    refreshAllDataCallback = dependencies.refreshAllData;
    // openEnlargedListModal は ui-helpers から直接使う

    DOMT.newTagNameInput = document.getElementById('newTagName');
    DOMT.newTagCategoriesCheckboxes = document.getElementById('newTagCategoriesCheckboxes');
    DOMT.addTagButton = document.getElementById('addTagButton');
    DOMT.tagListContainer = document.getElementById('tagListContainer');
    DOMT.tagSearchInput = document.getElementById('tagSearchInput');
    DOMT.enlargeTagListButton = document.getElementById('enlargeTagListButton'); // ★★★ 取得 ★★★

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
                deleteTag(tagId, tag.name);
            } else {
                alert("削除対象のタグIDが見つかりません。");
            }
        });
    }
    if (DOMT.tagListContainer) {
        DOMT.tagListContainer.addEventListener('click', handleTagListClick);
    }
    if (DOMT.tagSearchInput) {
        DOMT.tagSearchInput.addEventListener('input', (e) => {
            currentTagSearchTerm = e.target.value.toLowerCase().trim();
            _renderTagsForManagementInternal();
        });
    }
    // ★★★ 拡大ボタンのイベントリスナー ★★★
    if (DOMT.enlargeTagListButton) {
        DOMT.enlargeTagListButton.addEventListener('click', () => {
            openEnlargedListModal(
                "タグ一覧 (拡大)",
                (container) => {
                    // 現在のフィルタリングとグループ化を反映したリストのDOMを生成
                    const listContent = buildTagListDOMForEnlargement(true); // isEnlargedView = true
                    if (listContent) {
                        container.appendChild(listContent);
                    } else {
                        container.innerHTML = '<p>表示するタグがありません。</p>';
                    }
                }
            );
        });
    }
    console.log("[Tag Manager] Initialized.");
}

function getAssignableCategoriesForTag() {
    // (この関数は変更なし)
    const allCategories = getAllCategoriesFuncCache();
    return allCategories
        .filter(cat => cat.parentId && cat.parentId !== "")
        .map(cat => {
            const parentCat = allCategories.find(p => p.id === cat.parentId);
            return { id: cat.id, name: cat.name, parentName: parentCat ? parentCat.name : '不明' };
        })
        .sort((a,b) => {
            if (a.parentName !== b.parentName) return a.parentName.localeCompare(b.parentName, 'ja');
            return a.name.localeCompare(b.name, 'ja');
        });
}

export function _populateCategoryCheckboxesForTagFormInternal(containerElement, selectedCategoryIds = []) {
    // (この関数は変更なし)
    if (!containerElement) { console.warn("_populateCategoryCheckboxesForTagFormInternal: containerElement is null"); return; }
    const assignableCategories = getAssignableCategoriesForTag();
    populateCheckboxGroup( containerElement, assignableCategories, selectedCategoryIds, 'tagCategory',
        containerElement.id === 'newTagCategoriesCheckboxes' ? 'new-tag-cat-' : 'edit-tag-cat-' );
}


// ★★★ タグリストのDOMを生成する共通関数 (拡大表示と通常表示で共用) ★★★
function buildTagListDOMForEnlargement(isEnlargedView = false) {
    const allTags = getAllTagsFuncCache();
    const allCategories = getAllCategoriesFuncCache();
    let filteredTags = allTags;
    if (currentTagSearchTerm) {
        filteredTags = allTags.filter(tag => tag.name.toLowerCase().includes(currentTagSearchTerm));
    }

    if (filteredTags.length === 0) {
        const p = document.createElement('p');
        p.textContent = currentTagSearchTerm ? '検索条件に一致するタグはありません。' : 'タグが登録されていません。';
        return p;
    }

    const fragment = document.createDocumentFragment();
    const tagsByCategoryId = new Map();
    const unclassifiedTags = [];

    filteredTags.forEach(tag => {
        if (tag.categoryIds && tag.categoryIds.length > 0) {
            let classified = false;
            tag.categoryIds.forEach(catId => {
                const category = allCategories.find(c => c.id === catId);
                if (category && category.parentId) {
                    if (!tagsByCategoryId.has(catId)) tagsByCategoryId.set(catId, []);
                    tagsByCategoryId.get(catId).push(tag);
                    classified = true;
                }
            });
            if (!classified) unclassifiedTags.push(tag);
        } else {
            unclassifiedTags.push(tag);
        }
    });

    const childCategories = allCategories
        .filter(cat => cat.parentId && cat.parentId !== "")
        .sort((a, b) => {
            const parentA = allCategories.find(p => p.id === a.parentId)?.name || '';
            const parentB = allCategories.find(p => p.id === b.parentId)?.name || '';
            if (parentA !== parentB) return parentA.localeCompare(parentB, 'ja');
            return a.name.localeCompare(b.name, 'ja');
        });

    let hasRenderedContent = false;
    childCategories.forEach(childCat => {
        const tagsInThisChildCat = (tagsByCategoryId.get(childCat.id) || []).sort((a,b) => a.name.localeCompare(b.name, 'ja'));
        if (tagsInThisChildCat.length > 0) {
            hasRenderedContent = true;
            const groupDiv = document.createElement('div');
            groupDiv.classList.add('tag-group');
            const parentCat = allCategories.find(p => p.id === childCat.parentId);
            const groupHeader = document.createElement('h5');
            groupHeader.classList.add('tag-group-header');
            groupHeader.textContent = `${childCat.name} (親: ${parentCat ? parentCat.name : '不明'}) のタグ:`;
            groupDiv.appendChild(groupHeader);
            tagsInThisChildCat.forEach(tag => appendTagToList(tag, groupDiv, isEnlargedView));
            fragment.appendChild(groupDiv);
        }
    });

    if (unclassifiedTags.length > 0) {
        hasRenderedContent = true;
        const groupDiv = document.createElement('div');
        groupDiv.classList.add('tag-group');
        const groupHeader = document.createElement('h5');
        groupHeader.classList.add('tag-group-header');
        groupHeader.textContent = '未分類のタグ:';
        groupDiv.appendChild(groupHeader);
        unclassifiedTags.sort((a,b) => a.name.localeCompare(b.name, 'ja')).forEach(tag => {
            appendTagToList(tag, groupDiv, isEnlargedView);
        });
        fragment.appendChild(groupDiv);
    }

    if (!hasRenderedContent && filteredTags.length > 0) {
        const p = document.createElement('p');
        p.textContent = '検索されたタグは表示可能なカテゴリグループに属していません。';
        fragment.appendChild(p);
    }
    return fragment.childNodes.length > 0 ? fragment : null;
}

export function _renderTagsForManagementInternal() {
    if (!DOMT.tagListContainer) return;
    DOMT.tagListContainer.innerHTML = '';

    const listContent = buildTagListDOMForEnlargement(false); // 通常表示
    if (listContent) {
        DOMT.tagListContainer.appendChild(listContent);
    } else {
        // buildTagListDOMForEnlargement が p 要素を返すので、それがここに来る
        const p = document.createElement('p');
        p.textContent = currentTagSearchTerm ? '検索条件に一致するタグはありません。' : 'タグが登録されていません。';
        DOMT.tagListContainer.appendChild(p);
    }
    
    _populateCategoryCheckboxesForTagFormInternal(DOMT.newTagCategoriesCheckboxes);
    console.log("[Tag Manager] Tags rendered by category group for management.");
}

function appendTagToList(tag, containerElement, isEnlargedView = false) {
    const div = document.createElement('div');
    div.classList.add('list-item');
    const nameSpan = document.createElement('span');
    nameSpan.classList.add('list-item-name-clickable');
    nameSpan.textContent = tag.name;
    if (!isEnlargedView) { // 拡大表示では編集アクションを無効化
        nameSpan.dataset.tagId = tag.id;
        nameSpan.dataset.action = "edit";
    }
    div.appendChild(nameSpan);
    containerElement.appendChild(div);
}


function handleTagListClick(event) {
    // (この関数は変更なし)
    const target = event.target;
    const clickableName = target.closest('.list-item-name-clickable[data-tag-id]');
    if (clickableName && clickableName.dataset.action === 'edit') {
        openEditTagModalById(clickableName.dataset.tagId);
    }
}


async function addTag() {
    // (この関数は変更なし)
    if (!DOMT.newTagNameInput || !DOMT.newTagCategoriesCheckboxes) return;
    const name = DOMT.newTagNameInput.value.trim();
    const selectedCategoryIdsForTag = getSelectedCheckboxValues(DOMT.newTagCategoriesCheckboxes, 'tagCategory');
    if (!name) { alert("タグ名を入力してください。"); return; }
    const q = query(collection(dbInstance, 'tags'), where('name', '==', name));
    const existingQuery = await getDocs(q);
    if (!existingQuery.empty) { alert("同じ名前のタグが既に存在します。"); return; }
    try {
        await addDoc(collection(dbInstance, 'tags'), { name: name, categoryIds: selectedCategoryIdsForTag, createdAt: serverTimestamp() });
        DOMT.newTagNameInput.value = '';
        _populateCategoryCheckboxesForTagFormInternal(DOMT.newTagCategoriesCheckboxes);
        await refreshAllDataCallback();
    } catch (error) {
        console.error("[Tag Manager] Error adding tag:", error);
        alert("タグの追加に失敗しました。");
    }
}

function openEditTagModalById(tagId) {
    // (この関数は変更なし)
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
    // (この関数は変更なし)
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
        await updateDoc(doc(dbInstance, 'tags', docId), { name: newName, categoryIds: newSelectedCategoryIdsForTag, updatedAt: serverTimestamp() });
        closeModal('editTagModal');
        await refreshAllDataCallback();
    } catch (error) {
        console.error("[Tag Manager] Error saving tag edit:", error);
        alert("タグの更新に失敗しました。");
    }
}

async function deleteTag(docId, tagName) {
    // (この関数は変更なし)
    if (confirm(`タグ「${tagName}」を削除しますか？\nこのタグを使用している全てのアイテムからも自動的に解除されます。\nこの操作は元に戻せません。`)) {
        try {
            const batch = writeBatch(dbInstance);
            const itemsToUpdateQuery = query(collection(dbInstance, 'items'), where('tags', 'array-contains', docId));
            const itemsSnapshot = await getDocs(itemsToUpdateQuery);
            itemsSnapshot.forEach(itemDoc => { batch.update(itemDoc.ref, { tags: arrayRemove(docId) }); });
            batch.delete(doc(dbInstance, 'tags', docId));
            await batch.commit();
            closeModal('editTagModal');
            await refreshAllDataCallback();
        } catch (error) {
            console.error("[Tag Manager] Error deleting tag:", error);
            alert("タグの削除または関連エンティティの更新に失敗しました。");
        }
    }
}
