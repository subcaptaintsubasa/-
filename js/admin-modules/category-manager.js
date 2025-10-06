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
let getItemsFuncCache = () => [];
let refreshAllDataCallback = async () => {};
let openEnlargedListModalCallback = (config) => {};

const categoryExpansionState = new Map();
let currentCategorySearchTerm = "";

export function initCategoryManager(dependencies) {
    dbInstance = dependencies.db;
    getAllCategoriesFuncCache = dependencies.getAllCategories; // This should now return only non-deleted items
    getAllTagsFuncCache = dependencies.getAllTags;
    getItemsFuncCache = dependencies.getItems;
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
            if (categoryId && category) {
                // 新しい確認モーダルを開く関数を呼び出す
                openDeleteCategoryConfirmModal(categoryId, category.name, !!category.parentId);
            } else {
                 alert("削除対象のカテゴリIDが見つかりません。");
            }
        });
    }

    // 新しい確認モーダルのイベントリスナーをセットアップ（ここから追記）
    const cancelDeleteBtn = document.getElementById('cancelDeleteCategoryButton');
    if(cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', () => closeModal('deleteCategoryConfirmModal'));

    const confirmDeleteBtn = document.getElementById('confirmDeleteCategoryButton');
    if(confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', executeCategoryDeletion);

    const deleteOptionRadios = document.querySelectorAll('input[name="deleteTagsOption"]');
    deleteOptionRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const previewEl = document.getElementById('tagsToDeletePreview');
            if (previewEl) {
                previewEl.style.display = e.target.value === 'delete' ? 'block' : 'none';
            }
        });
    });
    // ここまで追記
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
                    sourceFn: getAllCategoriesFuncCache,
                    itemType: 'category',
                    searchInputId: 'categorySearchInput',
                    currentSearchTerm: currentCategorySearchTerm,
                    editFunction: openEditCategoryModalById,
                    displayRenderer: buildCategoryTreeDOM
                });
            }
        });
    }
    console.log("[Category Manager] Initialized for logical delete.");
}

function populateParentCategoryButtonsUI(buttonContainer, hiddenInput, options = {}) {
    const { currentCategoryIdToExclude = null, selectedParentId = "" } = options;
    // getAllCategoriesFuncCache は isDeleted: false のものだけを返す想定 (data-loader-admin.jsで修正)
    const allCategories = getAllCategoriesFuncCache();

    if (!buttonContainer || !hiddenInput) {
        console.warn("populateParentCategoryButtonsUI: buttonContainer or hiddenInput is null.");
        return;
    }
    buttonContainer.innerHTML = '';
    hiddenInput.value = selectedParentId;

    const topLevelButton = document.createElement('button');
    topLevelButton.type = 'button';
    topLevelButton.className = 'category-select-button';
    topLevelButton.textContent = '親カテゴリなし';
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
        .filter(cat => (!cat.parentId || cat.parentId === "") && cat.id !== currentCategoryIdToExclude && !cat.isDeleted) // isDeletedフィルタ追加
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
            DOMC.editingTagSearchModeSelect.value = 'AND';
        }
    } else {
        if (DOMC.editingCategoryTagsSelector) DOMC.editingCategoryTagsSelector.innerHTML = '';
    }
}

export function buildCategoryTreeDOM(categoriesToDisplay, allCategoriesData, isEnlargedView = false) {
    // categoriesToDisplay と allCategoriesData は isDeleted: false のものだけが渡される想定
    const buildNode = (parentId = "") => {
        const children = categoriesToDisplay
            .filter(cat => (cat.parentId || "") === parentId && !cat.isDeleted) // isDeletedフィルタ追加
            .sort((a, b) => a.name.localeCompare(b.name, 'ja'));

        if (children.length === 0) return null;

        const ul = document.createElement('ul');
        if (parentId !== "") {
            ul.classList.add('category-tree-children');
            if (!isEnlargedView && !currentCategorySearchTerm && !categoryExpansionState.get(parentId)) {
                ul.classList.add('hidden');
            }
        }

        children.forEach(category => {
            const li = document.createElement('li');
            li.classList.add('category-tree-item');
            li.dataset.categoryId = category.id;

            const hasActualChildren = allCategoriesData.some(c => c.parentId === category.id && !c.isDeleted); // isDeletedフィルタ追加
            const isExpanded = isEnlargedView || !!currentCategorySearchTerm || categoryExpansionState.get(category.id);

            const expander = document.createElement('span');
            expander.classList.add('category-tree-expander');
            if (hasActualChildren) {
                expander.textContent = isExpanded ? '▼' : '►';
                if (isExpanded) expander.classList.add('expanded');
            } else {
                expander.innerHTML = ' ';
            }
            if (!isEnlargedView) expander.dataset.action = 'toggle';
            li.appendChild(expander);

            const content = document.createElement('div');
            content.classList.add('category-tree-content');
            if (!isEnlargedView) content.dataset.action = 'edit';
            
            const nameSpan = document.createElement('span');
            nameSpan.classList.add('category-name');
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
    return buildNode("");
}

export function _renderCategoriesForManagementInternal() {
    if (!DOMC.categoryListContainer) return;
    const allCategories = getAllCategoriesFuncCache(); // isDeleted: false のものだけが返る
    DOMC.categoryListContainer.innerHTML = '';

    let categoriesToDisplay = allCategories;
    if (currentCategorySearchTerm) {
        const searchResults = allCategories.filter(cat => cat.name.toLowerCase().includes(currentCategorySearchTerm));
        const displaySet = new Set();
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
        const treeRoot = buildCategoryTreeDOM(categoriesToDisplay, allCategories, false);
        if (treeRoot) {
            DOMC.categoryListContainer.appendChild(treeRoot);
        } else {
             DOMC.categoryListContainer.innerHTML = '<p>カテゴリの表示に失敗しました。</p>';
        }
    }
    
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
        const childrenUl = listItem.querySelector('ul.category-tree-children');
        if (childrenUl) {
            const isCurrentlyExpanded = !childrenUl.classList.contains('hidden');
            categoryExpansionState.set(categoryId, !isCurrentlyExpanded);
            childrenUl.classList.toggle('hidden', isCurrentlyExpanded);
            if(expander) {
                expander.textContent = !isCurrentlyExpanded ? '▼' : '►';
                expander.classList.toggle('expanded', !isCurrentlyExpanded);
            }
        }
    } else if (action === 'edit') {
        openEditCategoryModalById(categoryId);
    } else if (target.classList.contains('category-name') || target.closest('.category-tree-content')) {
        if (!actionTarget) {
            openEditCategoryModalById(categoryId);
        }
    }
}

async function addCategory() {
    if (!DOMC.newCategoryNameInput || !DOMC.selectedNewParentCategoryIdInput) return;
    const name = DOMC.newCategoryNameInput.value.trim();
    const parentId = DOMC.selectedNewParentCategoryIdInput.value; 
    if (!name) { alert("カテゴリ名を入力してください。"); return; }

    // isDeleted: false のカテゴリ内で重複チェック
    const q = query(collection(dbInstance, 'categories'), 
                    where('name', '==', name), 
                    where('parentId', '==', parentId || ""),
                    where('isDeleted', '==', false) // 重複チェックも未削除のものに対して行う
                  );
    const existingQuery = await getDocs(q);
    if (!existingQuery.empty) {
        alert(parentId ? "同じ親カテゴリ内に同じ名前の子カテゴリが既に存在します。" : "同じ名前の親カテゴリが既に存在します。");
        return;
    }

    try {
        const categoryData = { 
            name: name, 
            parentId: parentId || "", 
            isDeleted: false, // 新規作成時は必ず false
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp() // updatedAt も設定
        };
        if (parentId) categoryData.tagSearchMode = 'AND'; 
        await addDoc(collection(dbInstance, 'categories'), categoryData);
        DOMC.newCategoryNameInput.value = '';
        populateParentCategoryButtonsUI(DOMC.newCategoryParentButtons, DOMC.selectedNewParentCategoryIdInput, { selectedParentId: "" });
    } catch (error) {
        console.error("[Category Manager] Error adding category:", error);
        alert("カテゴリの追加に失敗しました。");
    }
}

export function openEditCategoryModalById(categoryId) {
    const allCategories = getAllCategoriesFuncCache(); // isDeleted: false のものだけ
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
    if (!containerElement) {
        console.warn("populateTagsForCategoryEditModal: containerElement is null");
        return;
    }
    containerElement.innerHTML = ''; // Clear previous buttons

    const activeTagIds = allTags
        .filter(tag => !tag.isDeleted && tag.categoryIds && tag.categoryIds.includes(categoryId))
        .map(t => t.id);

    const sortedTags = allTags
        .filter(tag => !tag.isDeleted)
        .sort((a, b) => a.name.localeCompare(b.name, 'ja'));

    if (sortedTags.length === 0) {
        containerElement.innerHTML = '<p>利用可能なタグがありません。</p>';
        return;
    }

    // item-manager.js と同じクラス名のボタンを生成するロジック
    sortedTags.forEach(tag => {
        const button = document.createElement('div');
        button.className = 'tag-filter admin-tag-select'; // ★★★ 正しいクラス名に変更 ★★★
        button.textContent = tag.name;
        button.dataset.tagId = tag.id;
        if (activeTagIds.includes(tag.id)) {
            button.classList.add('active');
        }
        button.setAttribute('role', 'button');
        button.setAttribute('tabindex', '0');
        button.addEventListener('click', () => {
            button.classList.toggle('active');
        });
        button.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                button.classList.toggle('active');
            }
        });
        containerElement.appendChild(button);
    });
}

async function saveCategoryEdit() {
    const docId = DOMC.editingCategoryDocIdInput.value;
    const newName = DOMC.editingCategoryNameInput.value.trim();
    const newParentId = DOMC.selectedEditingParentCategoryIdInput.value; 
    const newTagSearchMode = DOMC.editingTagSearchModeSelect.value;
    const selectedTagIdsForThisCategory = getSelectedTagButtonValues(DOMC.editingCategoryTagsSelector);

    if (!newName) { alert("カテゴリ名は空にできません。"); return; }
    if (docId === newParentId) { alert("自身を親カテゴリに設定することはできません。"); return; }

    const allCategories = getAllCategoriesFuncCache(); // isDeleted: false
    const originalCategory = allCategories.find(c => c.id === docId);

    if (originalCategory && (originalCategory.name !== newName || (originalCategory.parentId || "") !== (newParentId || ""))) {
        const q = query(collection(dbInstance, 'categories'), 
                        where('name', '==', newName), 
                        where('parentId', '==', newParentId || ""),
                        where('isDeleted', '==', false) // 重複チェック
                      );
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
        const categoryUpdateData = { 
            name: newName, 
            parentId: newParentId || "", 
            updatedAt: serverTimestamp() // updatedAt を更新
        };
        const isBecomingChild = !!newParentId;
        if (isBecomingChild) { 
            categoryUpdateData.tagSearchMode = newTagSearchMode; 
        } else { 
            categoryUpdateData.tagSearchMode = deleteField(); 
        }
        batch.update(doc(dbInstance, 'categories', docId), categoryUpdateData);
        
        const allTags = getAllTagsFuncCache(); // isDeleted: false
        allTags.forEach(tag => {
            const isCurrentlySelectedForCat = selectedTagIdsForThisCategory.includes(tag.id);
            const isAlreadyAssociatedWithCat = tag.categoryIds && tag.categoryIds.includes(docId);

            if (isBecomingChild) { 
                if (isCurrentlySelectedForCat && !isAlreadyAssociatedWithCat) {
                    batch.update(doc(dbInstance, 'tags', tag.id), { categoryIds: arrayUnion(docId), updatedAt: serverTimestamp() });
                } else if (!isCurrentlySelectedForCat && isAlreadyAssociatedWithCat) {
                    batch.update(doc(dbInstance, 'tags', tag.id), { categoryIds: arrayRemove(docId), updatedAt: serverTimestamp() });
                }
            } else { 
                if (isAlreadyAssociatedWithCat) { 
                     batch.update(doc(dbInstance, 'tags', tag.id), { categoryIds: arrayRemove(docId), updatedAt: serverTimestamp() });
                }
            }
        });
        await batch.commit();
        closeModal('editCategoryModal');
    } catch (error) {
        console.error("[Category Manager] Error saving category edit:", error);
        alert("カテゴリの更新または関連タグの更新に失敗しました。");
    }
}

// ===== ここから貼り付け =====

let deleteCategoryIdHolder = null; // 削除対象のIDを一時的に保持

/**
 * カテゴリ削除の確認モーダルを開き、内容をセットアップする関数
 */
function openDeleteCategoryConfirmModal(categoryId, categoryName, isChildCategory) {
    deleteCategoryIdHolder = categoryId; // IDを保持

    // モーダル内の要素を取得
    const nameDisplay = document.getElementById('deleteCategoryNameDisplay');
    const tagsInfo = document.getElementById('deleteCategoryTagsInfo');
    const tagCountDisplay = document.getElementById('deleteCategoryTagCount');
    const tagsToDeleteList = document.getElementById('tagsToDeleteList');
    const uncategorizeRadio = document.getElementById('deleteTagsOptionUncategorize');
    const tagsToDeletePreview = document.getElementById('tagsToDeletePreview');

    if (nameDisplay) nameDisplay.textContent = categoryName;

    // 子カテゴリの場合のみ、タグの扱いに関する選択肢を表示
    if (isChildCategory && tagsInfo && tagCountDisplay && tagsToDeleteList && uncategorizeRadio && tagsToDeletePreview) {
        const allTags = getAllTagsFuncCache();
        const tagsInCategory = allTags.filter(tag => tag.categoryIds && tag.categoryIds.includes(categoryId));

        if (tagsInCategory.length > 0) {
            tagsInfo.style.display = 'block';
            tagCountDisplay.textContent = tagsInCategory.length;
            tagsToDeleteList.innerHTML = ''; // リストを初期化
            tagsInCategory.forEach(tag => {
                const li = document.createElement('li');
                li.textContent = tag.name;
                tagsToDeleteList.appendChild(li);
            });
        } else {
            tagsInfo.style.display = 'none'; // タグがなければ非表示
        }
        
        // デフォルト状態にリセット
        uncategorizeRadio.checked = true;
        tagsToDeletePreview.style.display = 'none';

    } else if (tagsInfo) {
        tagsInfo.style.display = 'none'; // 親カテゴリの場合はタグ情報を非表示
    }
    
    closeModal('editCategoryModal'); // 元の編集モーダルを閉じる
    openModal('deleteCategoryConfirmModal');
}

/**
 * 確認モーダルの「実行」ボタンが押されたときに呼ばれる関数
 */
async function executeCategoryDeletion() {
    if (!deleteCategoryIdHolder) {
        alert("削除対象のカテゴリIDが見つかりません。");
        return;
    }
    const categoryToDelete = getAllCategoriesFuncCache().find(c => c.id === deleteCategoryIdHolder);
    if (!categoryToDelete) {
        alert("削除対象のカテゴリデータが見つかりません。");
        return;
    }

    const deleteOptionRadio = document.querySelector('input[name="deleteTagsOption"]:checked');
    const deleteOption = deleteOptionRadio ? deleteOptionRadio.value : 'uncategorize';
    const isChildCategory = !!categoryToDelete.parentId;

    try {
        // 親カテゴリ or タグを持たない子カテゴリの場合
        if (!isChildCategory || deleteOption === 'uncategorize') {
            await logicalDeleteCategory(deleteCategoryIdHolder, categoryToDelete.name, false);
        } 
        // タグも一緒に削除する場合
        else if (deleteOption === 'delete') {
            await logicalDeleteCategory(deleteCategoryIdHolder, categoryToDelete.name, true);
        }
        
        closeModal('deleteCategoryConfirmModal');

    } catch (error) {
        console.error("[Category Manager] Error during category deletion execution:", error);
        alert(`カテゴリの削除に失敗しました: ${error.message}`);
    } finally {
        deleteCategoryIdHolder = null; // 処理後にIDをクリア
    }
}

/**
 * カテゴリの論理削除を実行するコア関数
 * @param {string} docId - 削除するカテゴリのID
 * @param {string} categoryName - 削除するカテゴリの名前（確認メッセージ用）
 * @param {boolean} deleteAssociatedTags - 関連するタグも一緒に削除するかどうか
 */
async function logicalDeleteCategory(docId, categoryName, deleteAssociatedTags) {
    const allCategories = getAllCategoriesFuncCache();
    
    // 子カテゴリ（未削除）が存在するかチェック
    const hasActiveChildren = allCategories.some(cat => cat.parentId === docId);
    if (hasActiveChildren) {
        throw new Error(`カテゴリ「${categoryName}」は、アクティブな子カテゴリの親として使用されているため削除できません。`);
    }

    const batch = writeBatch(dbInstance);

    // Step 1: 関連するタグの処理
    const allTags = getAllTagsFuncCache();
    const tagsInCategory = allTags.filter(tag => tag.categoryIds && tag.categoryIds.includes(docId));

    if (tagsInCategory.length > 0) {
        if (deleteAssociatedTags) {
            // タグも一緒に削除する場合
            const tagIdsToDelete = tagsInCategory.map(t => t.id);
            const tagIdsSet = new Set(tagIdsToDelete);

            // 全アイテムをスキャンして、削除対象のタグIDをアイテムのtags配列から除去
            const allItems = getItemsFuncCache(); // 依存関係からgetItemsを取得
            allItems.forEach(item => {
                if (item.tags && item.tags.some(tagId => tagIdsSet.has(tagId))) {
                    const newTags = item.tags.filter(tagId => !tagIdsSet.has(tagId));
                    batch.update(doc(dbInstance, 'items', item.docId), { tags: newTags, updatedAt: serverTimestamp() });
                }
            });

            // タグ自体を論理削除
            tagIdsToDelete.forEach(tagId => {
                batch.update(doc(dbInstance, 'tags', tagId), { isDeleted: true, updatedAt: serverTimestamp() });
            });

        } else {
            // タグを「未分類」にする場合
            tagsInCategory.forEach(tag => {
                batch.update(doc(dbInstance, 'tags', tag.id), { categoryIds: arrayRemove(docId), updatedAt: serverTimestamp() });
            });
        }
    }

    // Step 2: カテゴリ自体の論理削除
    batch.update(doc(dbInstance, 'categories', docId), {
        isDeleted: true,
        updatedAt: serverTimestamp()
    });

    await batch.commit();

    // どのモーダルが開いていても閉じる
    closeModal('editCategoryModal');
    closeModal('deleteCategoryConfirmModal');
}
// ===== ここまで貼り付け =====
