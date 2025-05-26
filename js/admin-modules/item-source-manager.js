// js/admin-modules/item-source-manager.js
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp, writeBatch, getDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { openModal, closeModal, populateSelect } from './ui-helpers.js';

const DOMISM = { // DOM Item Source Manager
    newItemSourceNameInput: null,
    newItemSourceParentSelector: null,
    selectedNewParentSourceIdInput: null,
    addItemSourceButton: null,
    itemSourceListContainer: null,
    itemSourceSearchInput: null,
    // enlargeItemSourceListButton: (handled by admin-main.js)

    editItemSourceModal: null,
    editingItemSourceDocIdInput: null,
    editingItemSourceNameInput: null,
    editingItemSourceParentSelector: null,
    selectedEditingParentSourceIdInput: null,
    saveItemSourceEditButton: null,
    deleteItemSourceFromEditModalButton: null,
};

// アイテムフォーム内の入手経路選択モーダル関連のDOM
const DOM_ITEM_FORM_SOURCE_SELECT = {
    selectItemSourceModal: null,
    itemSourceSelectionArea: null,
    sourceLevelSelectors: [], // [selectElLevel1, selectElLevel2, ...]
    sourceLevelGroupDivs: [], // [groupDivLevel2, groupDivLevel3, ...]
    currentSelectionPathDisplay: null,
    confirmItemSourceSelectionButton: null,
    itemSourceDisplayInputForItemForm: null, // アイテムフォーム側の表示用input (readonly)
    selectedItemSourceNodeIdInputForItemForm: null, // アイテムフォーム側のID保持用hidden input
};


let dbInstance = null;
let getItemSourcesFuncCache = () => []; // From data-loader-admin
let getItemsFuncCache = () => []; // To check usage before delete
let refreshAllDataCallback = async () => {};

const itemSourceExpansionState = new Map();
let currentItemSourceSearchTerm = "";
const MAX_SOURCE_DEPTH = 3; // 0-indexed depth (0, 1, 2, 3 for 4 levels)

export function initItemSourceManager(dependencies) {
    dbInstance = dependencies.db;
    getItemSourcesFuncCache = dependencies.getItemSources;
    getItemsFuncCache = dependencies.getItems; // Assuming this is passed for usage check
    refreshAllDataCallback = dependencies.refreshAllData;

    // DOMISMの要素を取得
    DOMISM.newItemSourceNameInput = document.getElementById('newItemSourceName');
    DOMISM.newItemSourceParentSelector = document.getElementById('newItemSourceParentSelector');
    DOMISM.selectedNewParentSourceIdInput = document.getElementById('selectedNewParentSourceId');
    DOMISM.addItemSourceButton = document.getElementById('addItemSourceButton');
    DOMISM.itemSourceListContainer = document.getElementById('itemSourceListContainer');
    DOMISM.itemSourceSearchInput = document.getElementById('itemSourceSearchInput');

    DOMISM.editItemSourceModal = document.getElementById('editItemSourceModal');
    DOMISM.editingItemSourceDocIdInput = document.getElementById('editingItemSourceDocId');
    DOMISM.editingItemSourceNameInput = document.getElementById('editingItemSourceName');
    DOMISM.editingItemSourceParentSelector = document.getElementById('editingItemSourceParentSelector');
    DOMISM.selectedEditingParentSourceIdInput = document.getElementById('selectedEditingParentSourceId');
    DOMISM.saveItemSourceEditButton = document.getElementById('saveItemSourceEditButton');
    DOMISM.deleteItemSourceFromEditModalButton = document.getElementById('deleteItemSourceFromEditModalButton');

    // DOM_ITEM_FORM_SOURCE_SELECT の要素を取得
    DOM_ITEM_FORM_SOURCE_SELECT.selectItemSourceModal = document.getElementById('selectItemSourceModal');
    DOM_ITEM_FORM_SOURCE_SELECT.itemSourceSelectionArea = document.getElementById('itemSourceSelectionArea');
    for (let i = 1; i <= 4; i++) {
        const selector = document.getElementById(`sourceLevel${i}`);
        if (selector) DOM_ITEM_FORM_SOURCE_SELECT.sourceLevelSelectors.push(selector);
        if (i > 1) { // Level 1 group is always visible
            const groupDiv = document.getElementById(`sourceLevel${i}Group`);
            if (groupDiv) DOM_ITEM_FORM_SOURCE_SELECT.sourceLevelGroupDivs.push(groupDiv);
        }
    }
    DOM_ITEM_FORM_SOURCE_SELECT.currentSelectionPathDisplay = document.getElementById('currentSelectionPathDisplay');
    DOM_ITEM_FORM_SOURCE_SELECT.confirmItemSourceSelectionButton = document.getElementById('confirmItemSourceSelectionButton');
    DOM_ITEM_FORM_SOURCE_SELECT.itemSourceDisplayInputForItemForm = document.getElementById('itemSourceDisplay');
    DOM_ITEM_FORM_SOURCE_SELECT.selectedItemSourceNodeIdInputForItemForm = document.getElementById('selectedItemSourceNodeId');


    // イベントリスナー（入手経路管理モーダル用）
    if (DOMISM.addItemSourceButton) DOMISM.addItemSourceButton.addEventListener('click', addItemSourceNode);
    if (DOMISM.saveItemSourceEditButton) DOMISM.saveItemSourceEditButton.addEventListener('click', saveItemSourceNodeEdit);
    if (DOMISM.deleteItemSourceFromEditModalButton) {
        DOMISM.deleteItemSourceFromEditModalButton.addEventListener('click', () => {
            const nodeId = DOMISM.editingItemSourceDocIdInput.value;
            const node = getItemSourcesFuncCache().find(n => n.id === nodeId);
            if (nodeId && node) deleteItemSourceNode(nodeId, node.name);
            else alert("削除対象の経路IDが見つかりません。");
        });
    }
    if (DOMISM.itemSourceListContainer) DOMISM.itemSourceListContainer.addEventListener('click', handleItemSourceTreeClick);
    if (DOMISM.itemSourceSearchInput) {
        DOMISM.itemSourceSearchInput.addEventListener('input', (e) => {
            currentItemSourceSearchTerm = e.target.value.toLowerCase().trim();
            _renderItemSourcesForManagementInternal();
        });
    }
    
    if (DOM_ITEM_FORM_SOURCE_SELECT.confirmItemSourceSelectionButton) {
        DOM_ITEM_FORM_SOURCE_SELECT.confirmItemSourceSelectionButton.addEventListener('click', confirmSourceSelectionForItemForm);
    }
    DOM_ITEM_FORM_SOURCE_SELECT.sourceLevelSelectors.forEach(selector => {
        if (selector) {
            selector.addEventListener('change', handleSourceLevelChangeForItemForm);
        }
    });
    
    // Export functions to global scope for item-manager.js
    window.adminModules = window.adminModules || {};
    window.adminModules.itemSourceManager = {
        openSelectItemSourceModalForItemForm,
        displaySelectedItemSourcePathOnLoad
    };

    console.log("[ItemSource Manager] Initialized.");
}

// --- 入手経路管理 UI ---
function populateParentSourceSelectorUI(selectorContainer, hiddenInput, options = {}) {
    const { currentSourceIdToExclude = null, selectedParentId = "" } = options;
    const allSources = getItemSourcesFuncCache();

    if (!selectorContainer || !hiddenInput) {
        console.warn("populateParentSourceSelectorUI: Required DOM elements missing.");
        return;
    }
    selectorContainer.innerHTML = '';
    hiddenInput.value = selectedParentId;

    const noParentButton = document.createElement('button');
    noParentButton.type = 'button';
    noParentButton.className = 'category-select-button';
    noParentButton.textContent = '親経路なし (最上位)';
    noParentButton.dataset.parentId = "";
    if (selectedParentId === "") noParentButton.classList.add('active');
    noParentButton.addEventListener('click', () => selectParentSourceButtonUI(selectorContainer, hiddenInput, noParentButton, ""));
    selectorContainer.appendChild(noParentButton);

    function buildParentOptionsRecursive(parentId = "", depth = 0) {
        if (depth > MAX_SOURCE_DEPTH - 1) return; 

        allSources
            .filter(source => (source.parentId || "") === parentId && source.id !== currentSourceIdToExclude)
            .sort((a, b) => a.name.localeCompare(b.name, 'ja'))
            .forEach(source => {
                let isAncestorOfExcluded = false;
                if (currentSourceIdToExclude) {
                    let tempAncestorId = currentSourceIdToExclude;
                    let sanity = 0;
                    while (tempAncestorId && sanity < 10) {
                        const tempAncestor = allSources.find(s => s.id === tempAncestorId);
                        if (!tempAncestor) break;
                        if (tempAncestor.parentId === source.id) { isAncestorOfExcluded = true; break; }
                        tempAncestorId = tempAncestor.parentId;
                        sanity++;
                    }
                }
                if (isAncestorOfExcluded) return;

                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'category-select-button';
                button.textContent = `${'┈'.repeat(depth * 2)} ${source.name}`;
                button.dataset.parentId = source.id;
                if (selectedParentId === source.id) button.classList.add('active');
                button.addEventListener('click', () => selectParentSourceButtonUI(selectorContainer, hiddenInput, button, source.id));
                selectorContainer.appendChild(button);
                buildParentOptionsRecursive(source.id, depth + 1);
            });
    }
    buildParentOptionsRecursive();
}

function selectParentSourceButtonUI(container, hiddenInput, clickedButton, parentId) {
    container.querySelectorAll('.category-select-button.active').forEach(activeBtn => activeBtn.classList.remove('active'));
    clickedButton.classList.add('active');
    hiddenInput.value = parentId;
}

export function buildItemSourceTreeDOM(sourcesToDisplay, allSourcesData, isEnlargedView = false) {
    const getSourceDepth = (sourceId, sources) => {
        let depth = 0;
        let current = sources.find(s => s.id === sourceId);
        let visited = new Set();
        while (current && current.parentId && !visited.has(current.id)) {
            visited.add(current.id);
            depth++;
            current = sources.find(s => s.id === current.parentId);
            if (depth > MAX_SOURCE_DEPTH + 5) return -1; // Safety break for deep or cyclic
        }
        return depth;
    };
    
    const buildNode = (parentId = "", currentDisplayDepth = 0) => {
        const children = sourcesToDisplay
            .filter(source => (source.parentId || "") === parentId)
            .sort((a, b) => a.name.localeCompare(b.name, 'ja'));

        if (children.length === 0) return null;
        const ul = document.createElement('ul');
        if (parentId !== "") {
            ul.classList.add('category-tree-children');
            if (!isEnlargedView && !currentItemSourceSearchTerm && !itemSourceExpansionState.get(parentId)) {
                ul.classList.add('hidden');
            }
        }

        children.forEach(source => {
            const li = document.createElement('li');
            li.classList.add('category-tree-item');
            li.dataset.sourceId = source.id;
            const actualDepth = source.depth !== undefined ? source.depth : getSourceDepth(source.id, allSourcesData);
            li.dataset.depth = actualDepth;

            const hasActualChildren = allSourcesData.some(s => s.parentId === source.id);
            const isExpanded = isEnlargedView || !!currentItemSourceSearchTerm || itemSourceExpansionState.get(source.id);

            const expander = document.createElement('span');
            expander.classList.add('category-tree-expander');
            if (hasActualChildren) {
                expander.textContent = isExpanded ? '▼' : '►';
                if (isExpanded) expander.classList.add('expanded');
            } else {
                expander.innerHTML = ' ';
            }
            if (!isEnlargedView) expander.dataset.action = 'toggle';
            li.appendChild(expander);

            const content = document.createElement('div');
            content.classList.add('category-tree-content');
            if (!isEnlargedView) content.dataset.action = 'edit';
            
            const nameSpan = document.createElement('span');
            nameSpan.classList.add('category-name');
            nameSpan.textContent = source.name;
            content.appendChild(nameSpan);

            const smallInfo = document.createElement('small');
            smallInfo.textContent = ` (階層: ${actualDepth + 1})`;
            content.appendChild(smallInfo);
            li.appendChild(content);

            if (hasActualChildren) {
                const childrenUl = buildNode(source.id, currentDisplayDepth + 1);
                if (childrenUl) {
                    if (!isEnlargedView && !isExpanded && !currentItemSourceSearchTerm) {
                        childrenUl.classList.add('hidden');
                    }
                    li.appendChild(childrenUl);
                }
            }
            ul.appendChild(li);
        });
        return ul;
    };
    return buildNode("", 0);
}

export function _renderItemSourcesForManagementInternal() {
    if (!DOMISM.itemSourceListContainer) return;
    const allSources = getItemSourcesFuncCache();
    DOMISM.itemSourceListContainer.innerHTML = '';

    let sourcesToDisplay = allSources;
    if (currentItemSourceSearchTerm) {
        const searchResults = allSources.filter(s => s.name.toLowerCase().includes(currentItemSourceSearchTerm));
        const displaySet = new Set();
        function addWithParents(sourceId) {
            const source = allSources.find(s => s.id === sourceId);
            if (source && !displaySet.has(source.id)) {
                displaySet.add(source.id);
                if (source.parentId) addWithParents(source.parentId);
            }
        }
        searchResults.forEach(s => addWithParents(s.id));
        sourcesToDisplay = allSources.filter(s => displaySet.has(s.id));
    }

    if (sourcesToDisplay.length === 0) {
        DOMISM.itemSourceListContainer.innerHTML = currentItemSourceSearchTerm ?
            '<p>検索条件に一致する入手経路はありません。</p>' :
            '<p>入手経路が登録されていません。</p>';
    } else {
        const treeRoot = buildItemSourceTreeDOM(sourcesToDisplay, allSources, false);
        if (treeRoot) DOMISM.itemSourceListContainer.appendChild(treeRoot);
        else DOMISM.itemSourceListContainer.innerHTML = '<p>入手経路の表示に失敗しました。</p>';
    }
    populateParentSourceSelectorUI(DOMISM.newItemSourceParentSelector, DOMISM.selectedNewParentSourceIdInput, { selectedParentId: DOMISM.selectedNewParentSourceIdInput.value || "" });
}

function handleItemSourceTreeClick(event) {
    const target = event.target;
    const listItem = target.closest('.category-tree-item[data-source-id]');
    if (!listItem) return;

    const sourceId = listItem.dataset.sourceId;
    const actionTarget = target.closest('[data-action]');
    const action = actionTarget ? actionTarget.dataset.action : null;

    if (action === 'toggle') {
        const expander = listItem.querySelector('.category-tree-expander');
        const childrenUl = listItem.querySelector('ul.category-tree-children');
        if (childrenUl) {
            const isCurrentlyExpanded = !childrenUl.classList.contains('hidden');
            itemSourceExpansionState.set(sourceId, !isCurrentlyExpanded);
            childrenUl.classList.toggle('hidden', isCurrentlyExpanded);
            if(expander) {
                expander.textContent = !isCurrentlyExpanded ? '▼' : '►';
                expander.classList.toggle('expanded', !isCurrentlyExpanded);
            }
        }
    } else if (action === 'edit') {
        openEditItemSourceModalById(sourceId);
    } else if (target.classList.contains('category-name') || target.closest('.category-tree-content')) {
        if (!actionTarget) openEditItemSourceModalById(sourceId);
    }
}

async function addItemSourceNode() {
    if (!DOMISM.newItemSourceNameInput || !DOMISM.selectedNewParentSourceIdInput) return;
    const name = DOMISM.newItemSourceNameInput.value.trim();
    const parentId = DOMISM.selectedNewParentSourceIdInput.value;
    if (!name) { alert("経路名を入力してください。"); return; }

    const allSources = getItemSourcesFuncCache();
    const q = query(collection(dbInstance, 'item_sources'), where('name', '==', name), where('parentId', '==', parentId || ""));
    const existingQuery = await getDocs(q);
    if (!existingQuery.empty) {
        alert(parentId ? "同じ親経路内に同じ名前の経路が既に存在します。" : "同じ名前の最上位経路が既に存在します。");
        return;
    }

    let depth = 0;
    if (parentId) {
        const parentNode = allSources.find(s => s.id === parentId);
        if (parentNode) depth = (parentNode.depth !== undefined ? parentNode.depth : 0) + 1;
        else { alert("親経路が見つかりません。"); return; }
    }
    if (depth > MAX_SOURCE_DEPTH) {
        alert(`入手経路は最大${MAX_SOURCE_DEPTH + 1}階層までです。これ以上深くは追加できません。`);
        return;
    }

    try {
        await addDoc(collection(dbInstance, 'item_sources'), {
            name: name, parentId: parentId || "", depth: depth, createdAt: serverTimestamp()
        });
        DOMISM.newItemSourceNameInput.value = '';
        populateParentSourceSelectorUI(DOMISM.newItemSourceParentSelector, DOMISM.selectedNewParentSourceIdInput, { selectedParentId: "" });
        await refreshAllDataCallback();
    } catch (error) { console.error("[ItemSource Manager] Error adding node:", error); alert("入手経路の追加に失敗しました。"); }
}

export function openEditItemSourceModalById(sourceId) {
    const allSources = getItemSourcesFuncCache();
    const sourceToEdit = allSources.find(s => s.id === sourceId);
    if (!sourceToEdit) { alert("編集する経路データが見つかりません。"); return; }

    DOMISM.editingItemSourceDocIdInput.value = sourceToEdit.id;
    DOMISM.editingItemSourceNameInput.value = sourceToEdit.name;
    populateParentSourceSelectorUI(DOMISM.editingItemSourceParentSelector, DOMISM.selectedEditingParentSourceIdInput, {
        currentSourceIdToExclude: sourceToEdit.id,
        selectedParentId: sourceToEdit.parentId || ""
    });
    openModal('editItemSourceModal');
    if (DOMISM.editingItemSourceNameInput) DOMISM.editingItemSourceNameInput.focus();
}

async function saveItemSourceNodeEdit() {
    const docId = DOMISM.editingItemSourceDocIdInput.value;
    const newName = DOMISM.editingItemSourceNameInput.value.trim();
    const newParentId = DOMISM.selectedEditingParentSourceIdInput.value;
    if (!newName) { alert("経路名は空にできません。"); return; }
    if (docId === newParentId) { alert("自身を親経路に設定することはできません。"); return; }

    const allSources = getItemSourcesFuncCache();
    const originalSource = allSources.find(s => s.id === docId);
    if (!originalSource) { alert("元の経路データが見つかりません。"); return; }

    if (originalSource.name !== newName || (originalSource.parentId || "") !== (newParentId || "")) {
        const q = query(collection(dbInstance, 'item_sources'), where('name', '==', newName), where('parentId', '==', newParentId || ""));
        const existingQuery = await getDocs(q);
        if (existingQuery.docs.some(docSnap => docSnap.id !== docId)) {
            alert(newParentId ? "同じ親経路内に同じ名前の経路が既に存在します。" : "同じ名前の最上位経路が既に存在します。");
            return;
        }
    }

    let newDepth = 0;
    if (newParentId) {
        const newParentNode = allSources.find(s => s.id === newParentId);
        if (!newParentNode) { alert("新しい親経路が見つかりません。"); return; }
        newDepth = (newParentNode.depth !== undefined ? newParentNode.depth : 0) + 1;
        
        let currentAncestorId = newParentId;
        let sanity = 0;
        while (currentAncestorId && sanity < 10) {
            if (currentAncestorId === docId) { alert("循環参照です。この親経路設定はできません。"); return; }
            const ancestor = allSources.find(s => s.id === currentAncestorId);
            currentAncestorId = ancestor ? (ancestor.parentId || "") : "";
            sanity++;
        }
    }
    
    const originalNodeDepth = originalSource.depth !== undefined ? originalSource.depth : 0;
    const maxChildDepthOfMovingNode = getMaxDepthOfSubtree(docId, allSources) - originalNodeDepth;
    
    if (newDepth + maxChildDepthOfMovingNode > MAX_SOURCE_DEPTH) {
        alert(`この移動を行うと、経路の階層が${MAX_SOURCE_DEPTH + 1}階層を超えてしまいます。\n移動対象ノードの最大相対深度: ${maxChildDepthOfMovingNode}, 新しい親の深度: ${newDepth -1}, 結果深度: ${newDepth + maxChildDepthOfMovingNode}`);
        return;
    }

    try {
        const batch = writeBatch(dbInstance);
        batch.update(doc(dbInstance, 'item_sources', docId), {
            name: newName, parentId: newParentId || "", depth: newDepth, updatedAt: serverTimestamp()
        });
        await updateDescendantDepthsRecursive(docId, newDepth, allSources, batch);
        await batch.commit();
        closeModal('editItemSourceModal');
        await refreshAllDataCallback();
    } catch (error) { console.error("[ItemSource Manager] Error saving edit:", error); alert("入手経路の更新に失敗しました。"); }
}

async function updateDescendantDepthsRecursive(parentId, parentNewDepth, allSources, batch) {
    const children = allSources.filter(s => s.parentId === parentId);
    for (const child of children) {
        const childNewDepth = parentNewDepth + 1;
        if (childNewDepth > MAX_SOURCE_DEPTH) {
             // This should ideally be caught before commit, but as a safeguard.
            console.error(`Depth limit exceeded for child ${child.id} (new depth ${childNewDepth}). Skipping update.`);
            continue; 
        }
        batch.update(doc(dbInstance, 'item_sources', child.id), { depth: childNewDepth });
        await updateDescendantDepthsRecursive(child.id, childNewDepth, allSources, batch);
    }
}

function getMaxDepthOfSubtree(rootId, allSources, currentDepth = 0) {
    // This function calculates the maximum depth *relative to the currentDepth passed*.
    // To get absolute max depth from root of this subtree:
    // 1. Find the root node using rootId.
    // 2. Its 'depth' field is its absolute depth.
    // 3. Traverse children. For each child, its absolute depth is child.depth.
    // We need the maximum *absolute* depth of any node in the subtree starting at rootId.
    let maxAbsDepth = currentDepth; // currentDepth is the depth of rootId node
    const findMaxRecursive = (nodeId, nodeDepth) => {
        maxAbsDepth = Math.max(maxAbsDepth, nodeDepth);
        const childrenOfNode = allSources.filter(s => s.parentId === nodeId);
        for (const childNode of childrenOfNode) {
            findMaxRecursive(childNode.id, nodeDepth + 1);
        }
    };
    const rootNode = allSources.find(s => s.id === rootId);
    if (rootNode) {
        findMaxRecursive(rootId, rootNode.depth !== undefined ? rootNode.depth : 0); // Start with actual depth of rootId
    }
    return maxAbsDepth;
}


async function deleteItemSourceNode(docId, nodeName) {
    const allSources = getItemSourcesFuncCache();
    const children = allSources.filter(s => s.parentId === docId);
    if (children.length > 0) {
        alert(`経路「${nodeName}」は他の経路の親として使用されているため削除できません。先に子経路を削除するか、別の親経路に移動してください。`); return;
    }
    const itemsUsingSourceQuery = query(collection(dbInstance, 'items'), where('sourceNodeId', '==', docId));
    const itemsSnapshot = await getDocs(itemsUsingSourceQuery);
    if (!itemsSnapshot.empty) {
        alert(`経路「${nodeName}」は ${itemsSnapshot.size} 個のアイテムで使用されているため削除できません。先にアイテムの入手経路を変更してください。`); return;
    }

    if (confirm(`入手経路「${nodeName}」を削除しますか？\nこの操作は元に戻せません。`)) {
        try {
            await deleteDoc(doc(dbInstance, 'item_sources', docId));
            if (DOMISM.editItemSourceModal.style.display !== 'none' && DOMISM.editingItemSourceDocIdInput.value === docId) {
                closeModal('editItemSourceModal');
            }
            await refreshAllDataCallback();
        } catch (error) { console.error("[ItemSource Manager] Error deleting node:", error); alert("入手経路の削除に失敗しました。"); }
    }
}

// --- アイテムフォーム用 入手経路選択 UI & Logic ---
function openSelectItemSourceModalForItemForm() {
    if (!DOM_ITEM_FORM_SOURCE_SELECT.selectItemSourceModal || !DOM_ITEM_FORM_SOURCE_SELECT.itemSourceDisplayInputForItemForm) return;
    
    // Reset selectors
    DOM_ITEM_FORM_SOURCE_SELECT.sourceLevelSelectors.forEach((sel, index) => {
        sel.innerHTML = ''; // Clear previous options
        if (index > 0 && DOM_ITEM_FORM_SOURCE_SELECT.sourceLevelGroupDivs[index - 1]) {
            DOM_ITEM_FORM_SOURCE_SELECT.sourceLevelGroupDivs[index - 1].style.display = 'none';
        }
    });

    populateSourceLevelSelectForItemForm(1, ""); // Populate L1
    updateSelectionPathDisplayForItemForm(); // Update display and button state
    openModal('selectItemSourceModal');
}

function populateSourceLevelSelectForItemForm(level, parentId) {
    const selectorIndex = level - 1;
    const selector = DOM_ITEM_FORM_SOURCE_SELECT.sourceLevelSelectors[selectorIndex];
    if (!selector) return;
    const allSources = getItemSourcesFuncCache();
    const children = allSources.filter(s => (s.parentId || "") === parentId && (s.depth === undefined || s.depth === selectorIndex)).sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    
    selector.innerHTML = '<option value="">選択してください</option>';
    children.forEach(child => {
        const option = document.createElement('option');
        option.value = child.id; option.textContent = child.name;
        selector.appendChild(option);
    });

    // Hide subsequent levels
    for (let i = level; i < 4; i++) {
        const nextSelector = DOM_ITEM_FORM_SOURCE_SELECT.sourceLevelSelectors[i];
        if (nextSelector) nextSelector.innerHTML = '<option value="">選択してください</option>';
        const nextGroup = DOM_ITEM_FORM_SOURCE_SELECT.sourceLevelGroupDivs[i-1]; // groupDivs is 0-indexed for levels 2,3,4
        if (nextGroup) nextGroup.style.display = 'none';
    }
}

function handleSourceLevelChangeForItemForm(event) {
    const currentLevel = parseInt(event.target.dataset.level, 10);
    const selectedValue = event.target.value;

    // Hide and reset subsequent levels
    for (let i = currentLevel; i < 4; i++) {
        const nextSelector = DOM_ITEM_FORM_SOURCE_SELECT.sourceLevelSelectors[i];
        const nextGroup = DOM_ITEM_FORM_SOURCE_SELECT.sourceLevelGroupDivs[i-1];
        if (nextSelector) nextSelector.innerHTML = '<option value="">選択してください</option>';
        if (nextGroup) nextGroup.style.display = 'none';
    }

    if (selectedValue && currentLevel < 4) {
        const nextLevelGroup = DOM_ITEM_FORM_SOURCE_SELECT.sourceLevelGroupDivs[currentLevel -1]; // groups are for L2, L3, L4
        if (nextLevelGroup) {
            populateSourceLevelSelectForItemForm(currentLevel + 1, selectedValue);
            nextLevelGroup.style.display = 'block';
        }
    }
    updateSelectionPathDisplayForItemForm();
}

function updateSelectionPathDisplayForItemForm() {
    if (!DOM_ITEM_FORM_SOURCE_SELECT.currentSelectionPathDisplay || !DOM_ITEM_FORM_SOURCE_SELECT.confirmItemSourceSelectionButton) return;
    const pathParts = [];
    const allSources = getItemSourcesFuncCache();
    let lastSelectedNodeId = "";
    let lastSelectedNodeDepth = -1;

    for (let i = 0; i < 4; i++) {
        const selector = DOM_ITEM_FORM_SOURCE_SELECT.sourceLevelSelectors[i];
        if (selector && selector.value) {
            const selectedNode = allSources.find(s => s.id === selector.value);
            if (selectedNode) { 
                pathParts.push(selectedNode.name); 
                lastSelectedNodeId = selectedNode.id;
                lastSelectedNodeDepth = selectedNode.depth !== undefined ? selectedNode.depth : i;
            } else break; // Should not happen if data is consistent
        } else break;
    }
    
    DOM_ITEM_FORM_SOURCE_SELECT.currentSelectionPathDisplay.textContent = pathParts.length > 0 ? pathParts.join(' > ') : '未選択';
    
    let isTerminalNodeSelected = false;
    if (lastSelectedNodeId) {
        isTerminalNodeSelected = !allSources.some(s => s.parentId === lastSelectedNodeId);
    }
    DOM_ITEM_FORM_SOURCE_SELECT.confirmItemSourceSelectionButton.disabled = !isTerminalNodeSelected;

    if (lastSelectedNodeId && !isTerminalNodeSelected) {
        DOM_ITEM_FORM_SOURCE_SELECT.currentSelectionPathDisplay.textContent += " (更に下層あり)";
    } else if (!lastSelectedNodeId && pathParts.length > 0) {
         DOM_ITEM_FORM_SOURCE_SELECT.currentSelectionPathDisplay.textContent += " (不完全な選択)";
         DOM_ITEM_FORM_SOURCE_SELECT.confirmItemSourceSelectionButton.disabled = true;
    } else if (pathParts.length === 0) { // Initially no selection
         DOM_ITEM_FORM_SOURCE_SELECT.confirmItemSourceSelectionButton.disabled = true;
    }
}


function confirmSourceSelectionForItemForm() {
    let selectedNodeId = "";
    // Get the ID from the last select element that has a value
    for (let i = 3; i >= 0; i--) { 
        const selector = DOM_ITEM_FORM_SOURCE_SELECT.sourceLevelSelectors[i];
        if (selector && selector.value) {
            selectedNodeId = selector.value;
            break;
        }
    }

    if (selectedNodeId) {
        const allSources = getItemSourcesFuncCache();
        const isTerminal = !allSources.some(s => s.parentId === selectedNodeId);
        if (!isTerminal) { 
            alert("末端の入手経路を選択してください（「更に下層あり」と表示されていない経路）。"); 
            return; 
        }
        
        if (DOM_ITEM_FORM_SOURCE_SELECT.itemSourceDisplayInputForItemForm) {
            let displayText = DOM_ITEM_FORM_SOURCE_SELECT.currentSelectionPathDisplay.textContent;
            // Remove "(更に下層あり)" or "(不完全な選択)" if present
            displayText = displayText.replace(/\s\(更に下層あり\)$/, "").replace(/\s\(不完全な選択\)$/, "");
            DOM_ITEM_FORM_SOURCE_SELECT.itemSourceDisplayInputForItemForm.value = displayText;
        }
        if (DOM_ITEM_FORM_SOURCE_SELECT.selectedItemSourceNodeIdInputForItemForm) {
            DOM_ITEM_FORM_SOURCE_SELECT.selectedItemSourceNodeIdInputForItemForm.value = selectedNodeId;
        }
        closeModal('selectItemSourceModal');
    } else {
        alert("入手経路が選択されていません。");
    }
}

async function displaySelectedItemSourcePathOnLoad(nodeId) {
    if (!DOM_ITEM_FORM_SOURCE_SELECT.itemSourceDisplayInputForItemForm || !DOM_ITEM_FORM_SOURCE_SELECT.selectedItemSourceNodeIdInputForItemForm) return;
    if (!nodeId) {
        DOM_ITEM_FORM_SOURCE_SELECT.itemSourceDisplayInputForItemForm.value = "";
        DOM_ITEM_FORM_SOURCE_SELECT.selectedItemSourceNodeIdInputForItemForm.value = "";
        return;
    }

    let allSources = getItemSourcesFuncCache();
    if (!allSources || allSources.length === 0) { // Cache might not be ready
        const q = query(collection(dbInstance, 'item_sources'), orderBy('name'));
        const snapshot = await getDocs(q);
        allSources = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Potentially update global cache if this happens, though ideally data-loader handles it.
    }

    const pathParts = [];
    let currentId = nodeId;
    let sanityCheck = 0;
    
    while (currentId && sanityCheck < 10) {
        const node = allSources.find(s => s.id === currentId);
        if (node) {
            pathParts.unshift(node.name);
            currentId = node.parentId;
        } else {
            // Fallback: if node not in cache, try to fetch it (should be rare)
            try {
                const docSnap = await getDoc(doc(dbInstance, 'item_sources', currentId));
                if (docSnap.exists()) {
                    const missingNode = { id: docSnap.id, ...docSnap.data() };
                    pathParts.unshift(missingNode.name);
                    currentId = missingNode.parentId;
                    // Optionally add to cache if it's a persistent cache object
                } else { break; }
            } catch (e) { console.error("Error fetching missing source node:", e); break; }
        }
        sanityCheck++;
    }
    DOM_ITEM_FORM_SOURCE_SELECT.itemSourceDisplayInputForItemForm.value = pathParts.join(' > ');
    DOM_ITEM_FORM_SOURCE_SELECT.selectedItemSourceNodeIdInputForItemForm.value = nodeId; // Ensure original ID is set
}

// For admin-main's enlarged list modal, if these are needed directly.
export { openEditItemSourceModalById }; // buildItemSourceTreeDOM is already exported
