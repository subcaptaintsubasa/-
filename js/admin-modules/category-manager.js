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
    deleteCategoryFromEditModalButton: null, // 新しい削除ボタン
};

let dbInstance = null;
let getAllCategoriesFuncCache = () => [];
let getAllTagsFuncCache = () => [];
let refreshAllDataCallback = async () => {};

// カテゴリツリーの展開状態を保持
const categoryExpansionState = new Map(); // Map<categoryId, boolean>

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
                deleteCategory(categoryId, category.name); // categoryNameを渡す
            } else {
                alert("削除対象のカテゴリIDが見つかりません。");
            }
        });
    }
    // イベントデリゲーションでカテゴリツリーのクリックを処理
    if (DOMC.categoryListContainer) {
        DOMC.categoryListContainer.addEventListener('click', handleCategoryTreeClick);
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

    const topLevelButton = document.createElement('button'); // Changed to button
    topLevelButton.type = 'button';
    topLevelButton.className = 'category-select-button';
    topLevelButton.textContent = '親カテゴリなし';
    topLevelButton.dataset.parentId = ""; // Use consistent dataset attribute
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
            const button = document.createElement('button'); // Changed to button
            button.type = 'button';
            button.className = 'category-select-button';
            button.textContent = cat.name;
            button.dataset.parentId = cat.id; // Use consistent dataset attribute
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

    if (allCategories.length === 0) {
        DOMC.categoryListContainer.innerHTML = '<p>カテゴリが登録されていません。</p>';
        populateParentCategoryButtonsUI(DOMC.newCategoryParentButtons, DOMC.selectedNewParentCategoryIdInput, { selectedParentId: "" });
        return;
    }

    const buildCategoryTree = (parentId = "") => {
        const children = allCategories.filter(cat => (cat.parentId || "") === parentId)
                                 .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
        if (children.length === 0) return null;

        const ul = document.createElement('ul');
        if (parentId !== "") ul.classList.add('category-tree-children');
        
        // 親カテゴリの場合、展開状態に応じて 'hidden' クラスを適用
        if (parentId !== "" && !categoryExpansionState.get(parentId)) {
            ul.classList.add('hidden');
        }


        children.forEach(category => {
            const li = document.createElement('li');
            li.classList.add('category-tree-item');
            li.dataset.categoryId = category.id;

            const hasChildren = allCategories.some(c => c.parentId === category.id);
            const isExpanded = categoryExpansionState.get(category.id) === true;

            const expander = document.createElement('span');
            expander.classList.add('category-tree-expander');
            if (hasChildren) {
                expander.textContent = isExpanded ? '▼' : '►';
                expander.classList.toggle('expanded', isExpanded);
            } else {
                expander.innerHTML = ' '; // 子がない場合はスペースでインデントを保つ
            }
            expander.dataset.action = 'toggle';
            li.appendChild(expander);

            const content = document.createElement('div');
            content.classList.add('category-tree-content');
            content.dataset.action = 'edit'; // クリックで編集モーダルを開く

            const nameSpan = document.createElement('span');
            nameSpan.classList.add('category-name');
            nameSpan.textContent = category.name;
            content.appendChild(nameSpan);

            const smallInfo = document.createElement('small');
            let infoText = "";
            if (!category.parentId) {
                infoText = "(親カテゴリ)";
            } else {
                const parent = allCategories.find(p => p.id === category.parentId);
                infoText = `(親: ${parent ? parent.name : '不明'})`;
                if (category.tagSearchMode) {
                    infoText += ` [${category.tagSearchMode.toUpperCase()}検索]`;
                }
            }
            smallInfo.textContent = infoText;
            content.appendChild(smallInfo);
            li.appendChild(content);
            ul.appendChild(li);

            if (hasChildren) {
                const childrenUl = buildCategoryTree(category.id);
                if (childrenUl) {
                    if (!isExpanded) childrenUl.classList.add('hidden'); // 子ULも展開状態に合わせる
                    li.appendChild(childrenUl); // li の子として孫カテゴリのulを追加
                }
            }
        });
        return ul;
    };

    const treeRoot = buildCategoryTree(""); // 親カテゴリからツリー構築開始
    if (treeRoot) {
        DOMC.categoryListContainer.appendChild(treeRoot);
    } else {
        DOMC.categoryListContainer.innerHTML = '<p>カテゴリが登録されていません。(ルート構築失敗)</p>';
    }
    
    populateParentCategoryButtonsUI(DOMC.newCategoryParentButtons, DOMC.selectedNewParentCategoryIdInput, { selectedParentId: "" });
    console.log("[Category Manager] Categories rendered as tree for management.");
}

function handleCategoryTreeClick(event) {
    const target = event.target;
    const listItem = target.closest('.category-tree-item');
    if (!listItem) return;

    const categoryId = listItem.dataset.categoryId;
    const action = target.dataset.action || target.closest('[data-action]')?.dataset.action;

    if (action === 'toggle') {
        const expander = listItem.querySelector('.category-tree-expander');
        const childrenUl = listItem.querySelector('.category-tree-children');
        if (childrenUl) {
            const isCurrentlyExpanded = categoryExpansionState.get(categoryId) || false;
            categoryExpansionState.set(categoryId, !isCurrentlyExpanded);
            childrenUl.classList.toggle('hidden', isCurrentlyExpanded); // isCurrentlyExpandedがtrueならhiddenにする
            if(expander) expander.textContent = !isCurrentlyExpanded ? '▼' : '►';
            if(expander) expander.classList.toggle('expanded', !isCurrentlyExpanded);
        }
    } else if (action === 'edit') {
        openEditCategoryModalById(categoryId);
    }
}


async function addCategory() {
    if (!DOMC.newCategoryNameInput || !DOMC.selectedNewParentCategoryIdInput) return;
    const name = DOMC.newCategoryNameInput.value.trim();
    const parentId = DOMC.selectedNewParentCategoryIdInput.value; // "" or an ID

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
            parentId: parentId || "", // Firestoreでは空文字列で保存
            createdAt: serverTimestamp()
        };
        if (parentId) categoryData.tagSearchMode = 'AND'; // 子カテゴリのデフォルト

        await addDoc(collection(dbInstance, 'categories'), categoryData);
        
        DOMC.newCategoryNameInput.value = '';
        populateParentCategoryButtonsUI(DOMC.newCategoryParentButtons, DOMC.selectedNewParentCategoryIdInput, { selectedParentId: "" });

        await refreshAllDataCallback(); // This will trigger _renderCategoriesForManagementInternal
    } catch (error) {
        console.error("[Category Manager] Error adding category:", error);
        alert("カテゴリの追加に失敗しました。");
    }
}

function openEditCategoryModalById(categoryId) {
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
    const newParentId = DOMC.selectedEditingParentCategoryIdInput.value; // "" or an ID
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

    if (newParentId) { // 循環参照チェック
        let currentAncestorId = newParentId;
        const visited = new Set([docId]); // 自分自身から始まる
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
            updatedAt: serverTimestamp()
        };

        const isBecomingChild = !!newParentId;
        if (isBecomingChild) {
            categoryUpdateData.tagSearchMode = newTagSearchMode;
        } else { // 親カテゴリになる、または最上位のまま
            categoryUpdateData.tagSearchMode = deleteField(); // Firestoreでフィールドを削除
        }
        batch.update(doc(dbInstance, 'categories', docId), categoryUpdateData);

        // タグのカテゴリ関連を更新
        const allTags = getAllTagsFuncCache();
        allTags.forEach(tag => {
            const isCurrentlySelectedForCat = selectedTagIdsForThisCategory.includes(tag.id);
            const isAlreadyAssociatedWithCat = tag.categoryIds && tag.categoryIds.includes(docId);

            if (isBecomingChild) { // カテゴリが子カテゴリになる/子カテゴリのまま
                if (isCurrentlySelectedForCat && !isAlreadyAssociatedWithCat) {
                    batch.update(doc(dbInstance, 'tags', tag.id), { categoryIds: arrayUnion(docId) });
                } else if (!isCurrentlySelectedForCat && isAlreadyAssociatedWithCat) {
                    batch.update(doc(dbInstance, 'tags', tag.id), { categoryIds: arrayRemove(docId) });
                }
            } else { // カテゴリが親カテゴリになる
                if (isAlreadyAssociatedWithCat) { // 以前子カテゴリでタグと紐付いていたら解除
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
    const childCheckQuery = query(collection(dbInstance, 'categories'), where('parentId', '==', docId));
    const childSnapshot = await getDocs(childCheckQuery);
    if (!childSnapshot.empty) {
        alert(`カテゴリ「${categoryName}」は他のカテゴリの親として使用されているため削除できません。先に子カテゴリを削除するか、別の親カテゴリに移動してください。`);
        return;
    }

    if (confirm(`カテゴリ「${categoryName}」を削除しますか？\nこのカテゴリに紐づいているタグの関連付けも解除されます。\nこの操作は元に戻せません。`)) {
        try {
            const batch = writeBatch(dbInstance);
            // タグからこのカテゴリIDを削除
            const tagsToUpdateQuery = query(collection(dbInstance, 'tags'), where('categoryIds', 'array-contains', docId));
            const tagsSnapshot = await getDocs(tagsToUpdateQuery);
            tagsSnapshot.forEach(tagDoc => {
                batch.update(tagDoc.ref, { categoryIds: arrayRemove(docId) });
            });
            // カテゴリ自体を削除
            batch.delete(doc(dbInstance, 'categories', docId));
            await batch.commit();
            
            closeModal('editCategoryModal'); // 編集モーダルが開いていたら閉じる
            await refreshAllDataCallback();
        } catch (error) {
            console.error("[Category Manager] Error deleting category:", error);
            alert("カテゴリの削除または関連タグの更新に失敗しました。");
        }
    }
}
