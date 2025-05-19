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
let refreshAllDataCallback = async () => {};
const categoryExpansionState = new Map();
let currentCategorySearchTerm = "";
let sortableInstances = []; // ★★★ SortableJSインスタンスを保持する配列 ★★★

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
    DOMC.categorySearchInput = document.getElementById('categorySearchInput');

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
                deleteCategory(categoryId, category.name);
            } else {
                alert("削除対象のカテゴリIDが見つかりません。");
            }
        });
    }
    if (DOMC.categoryListContainer) {
        DOMC.categoryListContainer.addEventListener('click', handleCategoryTreeClick);
    }
    if (DOMC.categorySearchInput) {
        DOMC.categorySearchInput.addEventListener('input', (e) => {
            currentCategorySearchTerm = e.target.value.toLowerCase().trim();
            _renderCategoriesForManagementInternal();
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
        .filter(cat => (!cat.parentId || cat.parentId === "") && cat.id !== currentCategoryIdToExclude)
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

// ★★★ SortableJSインスタンスを破棄するヘルパー関数 ★★★
function destroySortableInstances() {
    sortableInstances.forEach(sortable => sortable.destroy());
    sortableInstances = [];
}

export function _renderCategoriesForManagementInternal() {
    if (!DOMC.categoryListContainer) return;
    let allCategories = getAllCategoriesFuncCache();
    DOMC.categoryListContainer.innerHTML = '';
    destroySortableInstances(); // ★★★ 再描画前に既存のSortableインスタンスを破棄 ★★★

    let filteredCategories = allCategories;
    if (currentCategorySearchTerm) {
        filteredCategories = allCategories.filter(cat =>
            cat.name.toLowerCase().includes(currentCategorySearchTerm)
        );
        const categoriesToShow = new Set();
        function addWithParents(categoryId) {
            if (categoriesToShow.has(categoryId)) return;
            const category = allCategories.find(c => c.id === categoryId);
            if (category) {
                categoriesToShow.add(category.id);
                if (category.parentId) {
                    addWithParents(category.parentId);
                }
            }
        }
        filteredCategories.forEach(cat => addWithParents(cat.id));
        filteredCategories = allCategories.filter(cat => categoriesToShow.has(cat.id));
    }

    if (filteredCategories.length === 0) {
        DOMC.categoryListContainer.innerHTML = currentCategorySearchTerm ?
            '<p>検索条件に一致するカテゴリはありません。</p>' :
            '<p>カテゴリが登録されていません。</p>';
        populateParentCategoryButtonsUI(DOMC.newCategoryParentButtons, DOMC.selectedNewParentCategoryIdInput, { selectedParentId: "" });
        return;
    }

    const buildCategoryTree = (parentId = "") => {
        const children = filteredCategories.filter(cat => (cat.parentId || "") === parentId)
                                 .sort((a, b) => {
                                     // ★★★ orderフィールドによるソートを優先 ★★★
                                     const orderA = typeof a.order === 'number' ? a.order : Infinity;
                                     const orderB = typeof b.order === 'number' ? b.order : Infinity;
                                     if (orderA !== orderB) {
                                         return orderA - orderB;
                                     }
                                     return a.name.localeCompare(b.name, 'ja'); // 次に名前でソート
                                 });
        if (children.length === 0) return null;

        const ul = document.createElement('ul');
        ul.classList.add('category-sortable-list'); // ★★★ SortableJSのためのクラス ★★★
        ul.dataset.parentId = parentId || "root";   // ★★★ 親IDを記録 ★★★
        if (parentId !== "") ul.classList.add('category-tree-children');

        if (parentId !== "" && !categoryExpansionState.get(parentId) && !currentCategorySearchTerm) {
            ul.classList.add('hidden');
        }

        children.forEach(category => {
            const li = document.createElement('li');
            li.classList.add('category-tree-item');
            li.dataset.categoryId = category.id; // ★★★ カテゴリIDを<li>に設定 ★★★

            const hasActualChildren = allCategories.some(c => c.parentId === category.id);
            const isExpanded = categoryExpansionState.get(category.id) === true || !!currentCategorySearchTerm;

            const expander = document.createElement('span');
            expander.classList.add('category-tree-expander');
            if (hasActualChildren) {
                expander.textContent = isExpanded ? '▼' : '►';
                expander.classList.toggle('expanded', isExpanded);
            } else {
                expander.innerHTML = ' ';
            }
            expander.dataset.action = 'toggle';
            li.appendChild(expander);

            const content = document.createElement('div');
            content.classList.add('category-tree-content');
            content.dataset.action = 'edit';

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

            if (hasActualChildren) {
                const childrenUl = buildCategoryTree(category.id);
                if (childrenUl) {
                    if (!isExpanded && !currentCategorySearchTerm) childrenUl.classList.add('hidden');
                    li.appendChild(childrenUl);
                }
            }
        });
        return ul;
    };

    const treeRoot = buildCategoryTree("");
    if (treeRoot) {
        DOMC.categoryListContainer.appendChild(treeRoot);
        // ★★★ SortableJSの初期化 ★★★
        initializeSortableOnLists(DOMC.categoryListContainer);
    } else if (currentCategorySearchTerm) {
        DOMC.categoryListContainer.innerHTML = '<p>検索条件に一致するカテゴリはありません。</p>';
    } else {
        DOMC.categoryListContainer.innerHTML = '<p>カテゴリが登録されていません。(ルート構築失敗)</p>';
    }

    populateParentCategoryButtonsUI(DOMC.newCategoryParentButtons, DOMC.selectedNewParentCategoryIdInput, { selectedParentId: DOMC.selectedNewParentCategoryIdInput.value || "" });
    console.log("[Category Manager] Categories rendered as tree for management.");
}

// ★★★ SortableJSを各リストに適用する関数 ★★★
function initializeSortableOnLists(container) {
    const lists = container.querySelectorAll('ul.category-sortable-list');
    lists.forEach(listEl => {
        const sortable = new Sortable(listEl, {
            group: 'nested', // 同じグループ名はリスト間移動を許可
            animation: 150,
            fallbackOnBody: true,
            swapThreshold: 0.65,
            handle: '.category-tree-item', // ドラッグハンドルをアイテム全体に
            onEnd: async function (evt) {
                console.log("DragEnd Event:", evt);
                const itemEl = evt.item; // ドラッグされたアイテム (li)
                const newParentListEl = evt.to; // ドロップ先のリスト (ul)
                const oldParentListEl = evt.from; // 元のリスト (ul)
                
                const categoryId = itemEl.dataset.categoryId;
                const newParentId = newParentListEl.dataset.parentId === "root" ? "" : newParentListEl.dataset.parentId;
                // const oldParentId = oldParentListEl.dataset.parentId === "root" ? "" : oldParentListEl.dataset.parentId;

                // 新しい順序の取得
                const newOrderInCategory = Array.from(newParentListEl.children).map((childLi, index) => {
                    return { id: childLi.dataset.categoryId, order: index };
                });

                console.log(`Category ${categoryId} moved.`);
                console.log(`New Parent ID: '${newParentId}'`);
                console.log("New order in this list:", newOrderInCategory);

                // ここでFirestoreの更新処理を実装する (次のステップ)
                // 1. 移動したカテゴリの parentId を newParentId に更新
                // 2. newOrderInCategory に基づいて、移動先リスト内の全カテゴリの order フィールドを更新
                // 3. もし元のリスト(oldParentListEl)が異なる場合、そちらのリスト内のカテゴリのorderも更新
                alert(`カテゴリ「${itemEl.querySelector('.category-name').textContent}」が移動されました。\n新しい親: ${newParentId || '最上位'}\n順序情報の保存は次のステップで実装します。`);
                
                // UIの整合性を保つために、操作後はデータを再読み込みしてリストを再描画するのが安全
                // await refreshAllDataCallback(); 
                // ただし、SortableJSがDOMを直接変更するため、単純な再描画ではドラッグの見た目と一瞬ずれる可能性あり。
                // Firestore更新成功後に再描画するのが基本。
            },
        });
        sortableInstances.push(sortable);
    });
}


function handleCategoryTreeClick(event) {
    const target = event.target;
    const listItem = target.closest('.category-tree-item');
    if (!listItem) return;

    const categoryId = listItem.dataset.categoryId;
    // expanderとcontentが同じli内にあるので、data-actionを持つ最も近い要素を探す
    const actionTarget = target.closest('[data-action]');
    const action = actionTarget ? actionTarget.dataset.action : null;

    if (action === 'toggle') {
        event.stopPropagation(); // contentへのクリックイベント伝播を防ぐ
        const expander = listItem.querySelector('.category-tree-expander');
        const childrenUl = listItem.querySelector('.category-tree-children');
        if (childrenUl) {
            const isCurrentlyExpanded = categoryExpansionState.get(categoryId) || !!currentCategorySearchTerm; //検索中は常に展開扱い
            if (currentCategorySearchTerm) { //検索中は操作させない
                return;
            }
            categoryExpansionState.set(categoryId, !isCurrentlyExpanded);
            childrenUl.classList.toggle('hidden', isCurrentlyExpanded);
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
    const parentId = DOMC.selectedNewParentCategoryIdInput.value;

    if (!name) { alert("カテゴリ名を入力してください。"); return; }

    const q = query(collection(dbInstance, 'categories'), where('name', '==', name), where('parentId', '==', parentId || ""));
    const existingQuery = await getDocs(q);
    if (!existingQuery.empty) {
        alert(parentId ? "同じ親カテゴリ内に同じ名前の子カテゴリが既に存在します。" : "同じ名前の親カテゴリが既に存在します。");
        return;
    }

    try {
        // 新しいカテゴリのorder値を決定 (同じ親を持つ既存カテゴリの最大order + 1)
        const siblingsQuery = query(collection(dbInstance, 'categories'), where('parentId', '==', parentId || ""));
        const siblingsSnapshot = await getDocs(siblingsQuery);
        const maxOrder = siblingsSnapshot.docs.reduce((max, doc) => Math.max(max, doc.data().order || 0), -1);

        const categoryData = {
            name: name,
            parentId: parentId || "",
            order: maxOrder + 1, // 新しい順序
            createdAt: serverTimestamp()
        };
        if (parentId) categoryData.tagSearchMode = 'AND';

        await addDoc(collection(dbInstance, 'categories'), categoryData);

        DOMC.newCategoryNameInput.value = '';
        populateParentCategoryButtonsUI(DOMC.newCategoryParentButtons, DOMC.selectedNewParentCategoryIdInput, { selectedParentId: "" });

        await refreshAllDataCallback();
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

    // 名前と親の組み合わせでの重複チェック
    if (originalCategory && (originalCategory.name !== newName || (originalCategory.parentId || "") !== (newParentId || ""))) {
        const q = query(collection(dbInstance, 'categories'), where('name', '==', newName), where('parentId', '==', newParentId || ""));
        const existingQuery = await getDocs(q);
        if (existingQuery.docs.some(docSnap => docSnap.id !== docId)) {
            alert(newParentId ? "同じ親カテゴリ内に同じ名前の子カテゴリが既に存在します。" : "同じ名前の親カテゴリが既に存在します。");
            return;
        }
    }
    // 循環参照チェック
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
        const categoryDocRef = doc(dbInstance, 'categories', docId);
        const categoryUpdateData = {
            name: newName,
            parentId: newParentId || "",
            updatedAt: serverTimestamp()
        };
        // 親が変わった場合、orderをリセット（または新しい親の最後尾に）
        if (originalCategory && (originalCategory.parentId || "") !== (newParentId || "")) {
            const siblingsQuery = query(collection(dbInstance, 'categories'), where('parentId', '==', newParentId || ""));
            const siblingsSnapshot = await getDocs(siblingsQuery);
            categoryUpdateData.order = siblingsSnapshot.size; // 新しい親の最後尾のorder (0-indexed)
        }


        const isBecomingChild = !!newParentId;
        if (isBecomingChild) {
            categoryUpdateData.tagSearchMode = newTagSearchMode;
        } else {
            categoryUpdateData.tagSearchMode = deleteField();
        }
        batch.update(categoryDocRef, categoryUpdateData);

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
            const tagsToUpdateQuery = query(collection(dbInstance, 'tags'), where('categoryIds', 'array-contains', docId));
            const tagsSnapshot = await getDocs(tagsToUpdateQuery);
            tagsSnapshot.forEach(tagDoc => {
                batch.update(tagDoc.ref, { categoryIds: arrayRemove(docId) });
            });
            batch.delete(doc(dbInstance, 'categories', docId));
            await batch.commit();

            closeModal('editCategoryModal');
            await refreshAllDataCallback();
        } catch (error) {
            console.error("[Category Manager] Error deleting category:", error);
            alert("カテゴリの削除または関連タグの更新に失敗しました。");
        }
    }
}
