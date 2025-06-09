// js/admin-modules/item-source-manager.js
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp, writeBatch, getDoc, deleteField } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { openModal, closeModal, populateSelect } from './ui-helpers.js';

const DOMISM = {
    newItemSourceNameInput: null,
    newItemSourceParentSelector: null,
    selectedNewParentSourceIdInput: null,
    newItemSourceDisplayStringGroup: null,
    newItemSourceDisplayStringInput: null,
    addItemSourceButton: null,
    itemSourceListContainer: null,
    itemSourceSearchInput: null,

    editItemSourceModal: null,
    editingItemSourceDocIdInput: null,
    editingItemSourceNameInput: null,
    editingItemSourceParentSelector: null,
    selectedEditingParentSourceIdInput: null,
    editingItemSourceDisplayStringGroup: null,
    editingItemSourceDisplayStringInput: null,
    saveItemSourceEditButton: null,
    deleteItemSourceFromEditModalButton: null,

    finalSourceDisplayPreviewInput: null,
};

let dbInstance = null;
let getItemSourcesFuncCache = () => [];
let getItemsFuncCache = () => [];
let refreshAllDataCallback = async () => {};

const itemSourceExpansionState = new Map();
let currentItemSourceSearchTerm = "";
const MAX_SOURCE_DEPTH = 3;

export function initItemSourceManager(dependencies) {
    dbInstance = dependencies.db;
    getItemSourcesFuncCache = dependencies.getItemSources;
    getItemsFuncCache = dependencies.getItems;
    refreshAllDataCallback = dependencies.refreshAllData;

    DOMISM.newItemSourceNameInput = document.getElementById('newItemSourceName');
    DOMISM.newItemSourceParentSelector = document.getElementById('newItemSourceParentSelector');
    DOMISM.selectedNewParentSourceIdInput = document.getElementById('selectedNewParentSourceId');
    DOMISM.newItemSourceDisplayStringGroup = document.getElementById('newItemSourceDisplayStringGroup');
    DOMISM.newItemSourceDisplayStringInput = document.getElementById('newItemSourceDisplayString');
    DOMISM.addItemSourceButton = document.getElementById('addItemSourceButton');
    DOMISM.itemSourceListContainer = document.getElementById('itemSourceListContainer');
    DOMISM.itemSourceSearchInput = document.getElementById('itemSourceSearchInput');

    DOMISM.editItemSourceModal = document.getElementById('editItemSourceModal');
    DOMISM.editingItemSourceDocIdInput = document.getElementById('editingItemSourceDocId');
    DOMISM.editingItemSourceNameInput = document.getElementById('editingItemSourceName');
    DOMISM.editingItemSourceParentSelector = document.getElementById('editingItemSourceParentSelector');
    DOMISM.selectedEditingParentSourceIdInput = document.getElementById('selectedEditingParentSourceId');
    DOMISM.editingItemSourceDisplayStringGroup = document.getElementById('editingItemSourceDisplayStringGroup');
    DOMISM.editingItemSourceDisplayStringInput = document.getElementById('editingItemSourceDisplayString');
    DOMISM.saveItemSourceEditButton = document.getElementById('saveItemSourceEditButton');
    DOMISM.deleteItemSourceFromEditModalButton = document.getElementById('deleteItemSourceFromEditModalButton');

    DOMISM.finalSourceDisplayPreviewInput = document.getElementById('finalSourceDisplayPreview');


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

    if(DOMISM.newItemSourceParentSelector) {
        DOMISM.newItemSourceParentSelector.addEventListener('click', (event) => {
            if(event.target.classList.contains('category-select-button')) {
                const parentId = DOMISM.selectedNewParentSourceIdInput.value;
                const parentNode = parentId ? getItemSourcesFuncCache().find(s => s.id === parentId) : null;
                toggleDisplayStringInputForNode(DOMISM.newItemSourceDisplayStringGroup, parentNode, null, true);
            }
        });
    }
    if(DOMISM.editingItemSourceParentSelector) {
         DOMISM.editingItemSourceParentSelector.addEventListener('click', (event) => {
            if(event.target.classList.contains('category-select-button')) {
                const parentId = DOMISM.selectedEditingParentSourceIdInput.value;
                const parentNode = parentId ? getItemSourcesFuncCache().find(s => s.id === parentId) : null;
                const editingNodeId = DOMISM.editingItemSourceDocIdInput.value;
                toggleDisplayStringInputForNode(DOMISM.editingItemSourceDisplayStringGroup, parentNode, editingNodeId, false);
            }
        });
    }

    window.adminModules = window.adminModules || {};
    window.adminModules.itemSourceManager = {
        populateItemSourceLevelButtons,
        buildDisplayPathForSourceNode,
        // ===== 追加: 新しいヘルパーをエクスポート =====
        buildFullPathForSourceNode,
        // ===== 追加ここまで =====
    };

    console.log("[ItemSource Manager] Initialized.");
}


function toggleDisplayStringInputForNode(displayStringGroupElement, parentNodeData, editingNodeId, isNewNode) {
    if (!displayStringGroupElement) return;
    const allSources = getItemSourcesFuncCache();
    let currentDepthOfNodeBeingEditedOrCreated = 0;

    if (parentNodeData) {
        currentDepthOfNodeBeingEditedOrCreated = (parentNodeData.depth !== undefined ? parentNodeData.depth : 0) + 1;
    } else {
        currentDepthOfNodeBeingEditedOrCreated = 0;
    }

    displayStringGroupElement.style.display = 'block';
    const infoPara = displayStringGroupElement.querySelector('p.info');
    if (infoPara) {
        let isConsideredTerminalForDisplayString = false;
        if (isNewNode) {
            isConsideredTerminalForDisplayString = currentDepthOfNodeBeingEditedOrCreated >= MAX_SOURCE_DEPTH;
        } else if (editingNodeId) {
            const hasChildren = allSources.some(s => s.parentId === editingNodeId);
            isConsideredTerminalForDisplayString = !hasChildren;
        }

        if (isConsideredTerminalForDisplayString) {
            infoPara.textContent = "この経路は末端として扱えます。アイテムの入手手段としてこの文字列が表示されます。空の場合は経路名が使われます。";
        } else {
            infoPara.textContent = "この経路は中間経路です。表示用文字列は通常、末端の経路で使用されます（が、設定は可能です）。";
        }
    }
}


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
    noParentButton.addEventListener('click', (e) => {
        selectParentSourceButtonUI(selectorContainer, hiddenInput, e.currentTarget, "");
        const displayStringGroup = selectorContainer.id === 'newItemSourceParentSelector' ?
                                   DOMISM.newItemSourceDisplayStringGroup :
                                   DOMISM.editingItemSourceDisplayStringGroup;
        const isNew = selectorContainer.id === 'newItemSourceParentSelector';
        if (displayStringGroup) {
            toggleDisplayStringInputForNode(displayStringGroup, null, currentSourceIdToExclude, isNew);
        }
    });
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
                button.addEventListener('click', (e) => {
                    selectParentSourceButtonUI(selectorContainer, hiddenInput, e.currentTarget, source.id);
                    const displayStringGroup = selectorContainer.id === 'newItemSourceParentSelector' ?
                                               DOMISM.newItemSourceDisplayStringGroup :
                                               DOMISM.editingItemSourceDisplayStringGroup;
                    const isNew = selectorContainer.id === 'newItemSourceParentSelector';
                    if (displayStringGroup) {
                        toggleDisplayStringInputForNode(displayStringGroup, source, currentSourceIdToExclude, isNew);
                    }
                });
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
            const actualDepth = source.depth !== undefined ? source.depth : 0;
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
            let infoText = ` (階層: ${actualDepth + 1})`;
            if (source.displayString && source.displayString.trim() !== "") {
                infoText += ` [表示: ${source.displayString.substring(0,15)}${source.displayString.length > 15 ? '...' : ''}]`;
            }
            smallInfo.textContent = infoText;
            content.appendChild(smallInfo);
            li.appendChild(content);

            if (hasActualChildren) {
                const childrenUl = buildNode(source.id, actualDepth + 1);
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
    if (!DOMISM.itemSourceListContainer) {
        console.error("[ItemSource Manager] itemSourceListContainer is null!");
        return;
    }
    const allSources = getItemSourcesFuncCache();
    DOMISM.itemSourceListContainer.innerHTML = '';

    let sourcesToDisplay = allSources;
    if (currentItemSourceSearchTerm) {
        const searchResults = allSources.filter(s => s.name.toLowerCase().includes(currentItemSourceSearchTerm) || (s.displayString && s.displayString.toLowerCase().includes(currentItemSourceSearchTerm)));
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
        if (treeRoot) {
            DOMISM.itemSourceListContainer.appendChild(treeRoot);
        } else {
            DOMISM.itemSourceListContainer.innerHTML = '<p>入手経路の表示に失敗しました。</p>';
        }
    }
    populateParentSourceSelectorUI(DOMISM.newItemSourceParentSelector, DOMISM.selectedNewParentSourceIdInput, { selectedParentId: DOMISM.selectedNewParentSourceIdInput.value || "" });
    const initialParentId = DOMISM.selectedNewParentSourceIdInput.value;
    const initialParentNode = initialParentId ? allSources.find(s=>s.id === initialParentId) : null;
    toggleDisplayStringInputForNode(DOMISM.newItemSourceDisplayStringGroup, initialParentNode, null, true);
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
    const displayString = DOMISM.newItemSourceDisplayStringInput.value.trim();
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

    const dataToAdd = {
        name: name, parentId: parentId || "", depth: depth, createdAt: serverTimestamp()
    };
    if (displayString) {
        dataToAdd.displayString = displayString;
    }

    try {
        await addDoc(collection(dbInstance, 'item_sources'), dataToAdd);
        DOMISM.newItemSourceNameInput.value = '';
        DOMISM.newItemSourceDisplayStringInput.value = '';
        populateParentSourceSelectorUI(DOMISM.newItemSourceParentSelector, DOMISM.selectedNewParentSourceIdInput, { selectedParentId: "" });
        toggleDisplayStringInputForNode(DOMISM.newItemSourceDisplayStringGroup, null, null, true);
        await refreshAllDataCallback();
    } catch (error) { console.error("[ItemSource Manager] Error adding node:", error); alert("入手経路の追加に失敗しました。"); }
}

export function openEditItemSourceModalById(sourceId) {
    const allSources = getItemSourcesFuncCache();
    const sourceToEdit = allSources.find(s => s.id === sourceId);
    if (!sourceToEdit) { alert("編集する経路データが見つかりません。"); return; }

    DOMISM.editingItemSourceDocIdInput.value = sourceToEdit.id;
    DOMISM.editingItemSourceNameInput.value = sourceToEdit.name;
    DOMISM.editingItemSourceDisplayStringInput.value = sourceToEdit.displayString || '';

    populateParentSourceSelectorUI(DOMISM.editingItemSourceParentSelector, DOMISM.selectedEditingParentSourceIdInput, {
        currentSourceIdToExclude: sourceToEdit.id,
        selectedParentId: sourceToEdit.parentId || ""
    });

    const parentNode = sourceToEdit.parentId ? allSources.find(s => s.id === sourceToEdit.parentId) : null;
    toggleDisplayStringInputForNode(DOMISM.editingItemSourceDisplayStringGroup, parentNode, sourceToEdit.id, false);

    openModal('editItemSourceModal');
    if (DOMISM.editingItemSourceNameInput) DOMISM.editingItemSourceNameInput.focus();
}

async function saveItemSourceNodeEdit() {
    const docId = DOMISM.editingItemSourceDocIdInput.value;
    const newName = DOMISM.editingItemSourceNameInput.value.trim();
    const newParentId = DOMISM.selectedEditingParentSourceIdInput.value;
    const newDisplayString = DOMISM.editingItemSourceDisplayStringInput.value.trim();

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
    const maxAbsoluteDepthInSubtree = getMaxDepthOfSubtree(docId, allSources);
    const depthChangeOfRoot = newDepth - originalNodeDepth;
    const newMaxDepthOfSubtree = maxAbsoluteDepthInSubtree + depthChangeOfRoot;

    if (newMaxDepthOfSubtree > MAX_SOURCE_DEPTH) {
        alert(`この移動を行うと、経路の階層が${MAX_SOURCE_DEPTH + 1}階層を超えてしまいます。`);
        return;
    }

    const dataToUpdate = {
        name: newName,
        parentId: newParentId || "",
        depth: newDepth,
        updatedAt: serverTimestamp()
    };

    if (newDisplayString) {
        dataToUpdate.displayString = newDisplayString;
    } else {
        dataToUpdate.displayString = deleteField();
    }

    try {
        const batch = writeBatch(dbInstance);
        batch.update(doc(dbInstance, 'item_sources', docId), dataToUpdate);
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
            console.error(`Depth limit exceeded for child ${child.id} (new depth ${childNewDepth}). Aborting descendant update for this branch.`);
            throw new Error(`Cannot move node, as a descendant would exceed max depth of ${MAX_SOURCE_DEPTH}.`);
        }
        const childUpdateData = { depth: childNewDepth };
        batch.update(doc(dbInstance, 'item_sources', child.id), childUpdateData);
        await updateDescendantDepthsRecursive(child.id, childNewDepth, allSources, batch);
    }
}

function getMaxDepthOfSubtree(rootId, allSources) {
    let maxAbsDepth = -1;
    const rootNode = allSources.find(s => s.id === rootId);
    if (!rootNode) return -1;

    maxAbsDepth = rootNode.depth !== undefined ? rootNode.depth : 0;

    const findMaxRecursive = (nodeId) => {
        const currentNode = allSources.find(s => s.id === nodeId);
        if(currentNode) maxAbsDepth = Math.max(maxAbsDepth, (currentNode.depth !== undefined ? currentNode.depth : 0));

        const childrenOfNode = allSources.filter(s => s.parentId === nodeId);
        for (const childNode of childrenOfNode) {
            findMaxRecursive(childNode.id);
        }
    };
    findMaxRecursive(rootId);
    return maxAbsDepth;
}

async function deleteItemSourceNode(docId, nodeName) {
    const allSources = getItemSourcesFuncCache();
    const itemsCacheData = getItemsFuncCache();

    const children = allSources.filter(s => s.parentId === docId);
    if (children.length > 0) {
        alert(`経路「${nodeName}」は他の経路の親として使用されているため削除できません。先に子経路を削除するか、別の親経路に移動してください。`); return;
    }

    const itemsUsingSource = itemsCacheData.filter(item => {
        if (item.sources && Array.isArray(item.sources)) {
            return item.sources.some(s => s.type === 'tree' && s.nodeId === docId);
        }
        return item.sourceNodeId === docId;
    });

    if (itemsUsingSource.length > 0) {
        alert(`経路「${nodeName}」は ${itemsUsingSource.length} 個のアイテムで使用されているため削除できません。先にアイテムの入手経路を変更してください。`); return;
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

export function populateItemSourceLevelButtons(parentId, level, containerElement, pathDisplayElement, tempNodeIdInputElement, currentSelectedPath = [], initialSelectedNodeId = null, finalSourceDisplayPreviewElement = null) {
    if (!containerElement || !pathDisplayElement || !tempNodeIdInputElement) {
        console.error("populateItemSourceLevelButtons: Required DOM elements for item form UI not found.");
        return;
    }
    if (!finalSourceDisplayPreviewElement) {
        console.warn("populateItemSourceLevelButtons: finalSourceDisplayPreviewElement is not provided. Preview will not be updated.");
    }


    let levelContainer = containerElement.querySelector(`.source-level-container[data-level="${level}"]`);
    if (levelContainer) {
        let sibling = levelContainer.nextElementSibling;
        while(sibling && sibling.classList.contains('source-level-container')) {
            let toRemove = sibling;
            sibling = sibling.nextElementSibling;
            toRemove.remove();
        }
        levelContainer.innerHTML = '';
    } else {
        levelContainer = document.createElement('div');
        levelContainer.className = 'source-level-container';
        levelContainer.dataset.level = level;
        levelContainer.style.marginBottom = '10px';
        if (level > 1) levelContainer.style.paddingLeft = `${(level - 1) * 15}px`;
        containerElement.appendChild(levelContainer);
    }

    const allSources = getItemSourcesFuncCache();
    const children = allSources
        .filter(s => (s.parentId || "") === (parentId || "") && (s.depth !== undefined && s.depth === level - 1))
        .sort((a, b) => a.name.localeCompare(b.name, 'ja'));

    const addTreeSourceBtn = document.getElementById('addTreeSourceToListButton');

    if (children.length === 0) {
        if (parentId && tempNodeIdInputElement.value === parentId && addTreeSourceBtn) {
            addTreeSourceBtn.disabled = false;
        } else if (addTreeSourceBtn) {
             addTreeSourceBtn.disabled = true;
        }
        if(level === 1 && levelContainer && children.length === 0) levelContainer.innerHTML = '<p style="font-style:italic; color:#777;">この階層に経路がありません。</p>';
        if (finalSourceDisplayPreviewElement && tempNodeIdInputElement.value) {
             const finalDisplay = buildDisplayPathForSourceNode(tempNodeIdInputElement.value, allSources);
             finalSourceDisplayPreviewElement.value = finalDisplay;
        } else if (finalSourceDisplayPreviewElement) {
            finalSourceDisplayPreviewElement.value = '';
        }
        return;
    }
    if(addTreeSourceBtn) addTreeSourceBtn.disabled = true;
    if (finalSourceDisplayPreviewElement) {
        finalSourceDisplayPreviewElement.value = '';
    }

    children.forEach(child => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'category-select-button item-source-select-button';
        button.textContent = child.name;
        if (child.displayString) {
            button.title = `表示名: ${child.displayString}`;
        }
        button.dataset.nodeId = child.id;
        button.dataset.nodeName = child.name;

        button.addEventListener('click', () => {
            levelContainer.querySelectorAll('.item-source-select-button.active').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            tempNodeIdInputElement.value = child.id;

            const newPath = [...currentSelectedPath.slice(0, level - 1), child.name];
            pathDisplayElement.value = newPath.join(' > ');

            const hasGrandChildren = allSources.some(s => s.parentId === child.id);
            if (addTreeSourceBtn) addTreeSourceBtn.disabled = hasGrandChildren;

            if (finalSourceDisplayPreviewElement) {
                const finalDisplay = buildDisplayPathForSourceNode(child.id, allSources);
                finalSourceDisplayPreviewElement.value = finalDisplay;
            }


            if (level < MAX_SOURCE_DEPTH + 1) {
                 populateItemSourceLevelButtons(child.id, level + 1, containerElement, pathDisplayElement, tempNodeIdInputElement, newPath, null, finalSourceDisplayPreviewElement);
            }
        });
        levelContainer.appendChild(button);

        if (initialSelectedNodeId && child.id === initialSelectedNodeId) {
            button.click();
        }
    });
}

/**
 * 指定された入手経路ノードIDに基づいて、最終的な表示文字列を構築します。
 * - ノードに displayString が設定されていれば、それを使用します。
 * - displayString がなければ、選択されたノード自身の名前のみを返します。
 * @param {string} nodeId - 表示パスを構築する対象のノードID。
 * @param {Array<Object>} allItemSources - 全ての入手経路データの配列（キャッシュ）。
 * @returns {string} - 最終的に表示される文字列。
 */
export function buildDisplayPathForSourceNode(nodeId, allItemSources) {
    if (!nodeId || !allItemSources || allItemSources.length === 0) {
        return "経路情報なし";
    }
    const node = allItemSources.find(s => s.id === nodeId);
    if (!node) {
        return `経路不明 (ID: ${nodeId.substring(0,5)}...)`;
    }

    if (node.displayString && node.displayString.trim() !== "") {
        return node.displayString.trim();
    }
    return node.name;
}

// ===== 追加: 新しいヘルパー関数 =====
/**
 * 指定された入手経路ノードIDに基づいて、完全な階層パス文字列を構築します。
 * 例: "ダンジョンA > フロア1 > ボス部屋"
 * @param {string} nodeId - 表示パスを構築する対象のノードID。
 * @param {Array<Object>} allItemSources - 全ての入手経路データの配列（キャッシュ）。
 * @returns {string} - 完全な階層パス文字列。
 */
export function buildFullPathForSourceNode(nodeId, allItemSources) {
    if (!nodeId || !allItemSources || allItemSources.length === 0) {
        return "経路情報なし";
    }

    const pathParts = [];
    let currentId = nodeId;
    let sanityCheck = 0;
    while(currentId && sanityCheck < 10) { // MAX_SOURCE_DEPTH より少し大きめに設定
        const node = allItemSources.find(s => s.id === currentId);
        if (node) {
            pathParts.unshift(node.name);
            currentId = node.parentId;
        } else {
            pathParts.unshift(`[ID:${currentId.substring(0,5)}...]`); // 親が見つからない場合
            break;
        }
        sanityCheck++;
    }
    return pathParts.join(' > ');
}
// ===== 追加ここまで =====
