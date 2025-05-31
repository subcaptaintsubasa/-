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
};

// アイテムフォームの入手経路選択モーダル(ボタン式UI用)のDOM
const DOM_ITEM_FORM_SOURCE_BUTTON_UI = {
    selectItemSourceModal: null, // HTMLでは selectItemSourceForButtonUIModal
    itemSourceButtonSelectionUiContainer: null, // HTMLのID itemSourceButtonSelectionUiContainer
    currentPathDisplay: null, // HTMLのID currentPathDisplayForButtonUI
    confirmSelectionButton: null, // HTMLのID confirmItemSourceSelectionForButtonUIButton
};


let dbInstance = null;
let getItemSourcesFuncCache = () => []; 
let getItemsFuncCache = () => []; 
let refreshAllDataCallback = async () => {};
let itemSourceSelectionCallbackForItemManager = null; 

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

    // 新しいボタン式UI用モーダルのDOM
    DOM_ITEM_FORM_SOURCE_BUTTON_UI.selectItemSourceModal = document.getElementById('selectItemSourceForButtonUIModal');
    DOM_ITEM_FORM_SOURCE_BUTTON_UI.itemSourceButtonSelectionUiContainer = document.getElementById('itemSourceButtonSelectionUiContainer');
    DOM_ITEM_FORM_SOURCE_BUTTON_UI.currentPathDisplay = document.getElementById('currentPathDisplayForButtonUI');
    DOM_ITEM_FORM_SOURCE_BUTTON_UI.confirmSelectionButton = document.getElementById('confirmItemSourceSelectionForButtonUIButton');


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
    
    if (DOM_ITEM_FORM_SOURCE_BUTTON_UI.confirmSelectionButton) {
        DOM_ITEM_FORM_SOURCE_BUTTON_UI.confirmSelectionButton.addEventListener('click', confirmSourceSelectionForButtonUI);
    }
    // itemSourceButtonSelectionUiContainer内のボタンクリックは動的に設定
    
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
        // openSelectItemSourceModalForItemForm, // 古いモーダル用は削除
        populateItemSourceLevelButtons, // item-managerから呼ばれる新しいUI用
        // displaySelectedItemSourcePathOnLoad // item-manager側で処理
    };

    console.log("[ItemSource Manager] Initialized.");
}

// --- (toggleDisplayStringInputForNode, populateParentSourceSelectorUI, selectParentSourceButtonUI, buildItemSourceTreeDOM, _renderItemSourcesForManagementInternal, handleItemSourceTreeClick, addItemSourceNode, openEditItemSourceModalById, saveItemSourceNodeEdit, updateDescendantDepthsRecursive, getMaxDepthOfSubtree, deleteItemSourceNode は前回の修正から大きな変更なし) ---
// toggleDisplayStringInputForNode は前回修正済み
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
    const itemsCache = getItemsFuncCache();

    const children = allSources.filter(s => s.parentId === docId);
    if (children.length > 0) {
        alert(`経路「${nodeName}」は他の経路の親として使用されているため削除できません。先に子経路を削除するか、別の親経路に移動してください。`); return;
    }
    
    const itemsUsingSource = itemsCache.filter(item => {
        if (item.sources && Array.isArray(item.sources)) {
            return item.sources.some(s => s.type === 'tree' && s.nodeId === docId);
        }
        return false;
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

// 新しいボタン式UIのための関数群
function openSelectItemSourceForButtonUIModal(callback) { 
    itemSourceSelectionCallbackForItemManager = callback; 
    if (!DOM_ITEM_FORM_SOURCE_BUTTON_UI.selectItemSourceModal) {
        console.error("Select item source (button UI) modal element not found!");
        return;
    }
    if(DOM_ITEM_FORM_SOURCE_BUTTON_UI.currentPathDisplay) DOM_ITEM_FORM_SOURCE_BUTTON_UI.currentPathDisplay.textContent = '未選択';
    if(DOM_ITEM_FORM_SOURCE_BUTTON_UI.confirmSelectionButton) DOM_ITEM_FORM_SOURCE_BUTTON_UI.confirmSelectionButton.disabled = true;
    
    populateItemSourceLevelButtons(null, 1, DOM_ITEM_FORM_SOURCE_BUTTON_UI.itemSourceButtonSelectionUiContainer, DOM_ITEM_FORM_SOURCE_BUTTON_UI.currentPathDisplay, document.getElementById('selectedItemSourceNodeId_temp')); // 最後の引数はitem-managerのtemp hidden input
    openModal('selectItemSourceForButtonUIModal');
}

// item-manager からも呼ばれる可能性があるため export
export function populateItemSourceLevelButtons(parentId, level, containerElement, pathDisplayElement, tempNodeIdInputElement) {
    if (!containerElement || level > MAX_SOURCE_DEPTH + 1) { // MAX_SOURCE_DEPTH は 0-indexed なので +1
        if (level > MAX_SOURCE_DEPTH + 1 && DOM_ITEM_FORM_SOURCE_BUTTON_UI.confirmSelectionButton) {
            // 最大深度に達したら、それ以上の子は表示せず、決定ボタンを活性化
            DOM_ITEM_FORM_SOURCE_BUTTON_UI.confirmSelectionButton.disabled = false;
        }
        return;
    }

    // 現在のレベルより深い階層のコンテナをクリア
    let nextLevelContainer = containerElement.querySelector(`.source-level-container[data-level="${level}"]`);
    if (nextLevelContainer) {
        // それ以降のコンテナも削除
        let sibling = nextLevelContainer.nextElementSibling;
        while(sibling) {
            let toRemove = sibling;
            sibling = sibling.nextElementSibling;
            toRemove.remove();
        }
        nextLevelContainer.innerHTML = ''; // 現在のレベルのコンテナをクリア
    } else {
        nextLevelContainer = document.createElement('div');
        nextLevelContainer.className = 'source-level-container';
        nextLevelContainer.dataset.level = level;
        nextLevelContainer.style.marginBottom = '10px';
        if (level > 1) nextLevelContainer.style.paddingLeft = `${(level - 1) * 20}px`;
        containerElement.appendChild(nextLevelContainer);
    }


    const allSources = getItemSourcesFuncCache();
    const children = allSources
        .filter(s => (s.parentId || "") === (parentId || "") && (s.depth !== undefined && s.depth === level - 1))
        .sort((a, b) => a.name.localeCompare(b.name, 'ja'));

    if (children.length === 0) {
        if (level > 1 && DOM_ITEM_FORM_SOURCE_BUTTON_UI.confirmSelectionButton) { // ルート直下で子がない場合は決定不可としない
            DOM_ITEM_FORM_SOURCE_BUTTON_UI.confirmSelectionButton.disabled = false; // 子がなければ現在のノードで決定可能
        }
        if(level === 1 && nextLevelContainer) nextLevelContainer.innerHTML = '<p style="font-style:italic; color:#777;">この階層に経路がありません。</p>';
        return;
    }
    if(DOM_ITEM_FORM_SOURCE_BUTTON_UI.confirmSelectionButton) DOM_ITEM_FORM_SOURCE_BUTTON_UI.confirmSelectionButton.disabled = true; // 子がある場合はまだ決定不可

    children.forEach(child => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'category-select-button item-source-select-button'; // category-select-button スタイルを流用
        button.textContent = child.name;
        if (child.displayString) {
            button.title = `表示名: ${child.displayString}`;
        }
        button.dataset.nodeId = child.id;
        button.dataset.nodeName = child.name; // パス表示用
        button.dataset.displayString = child.displayString || "";

        button.addEventListener('click', () => {
            // 現在のレベルの他のボタンのアクティブ状態を解除
            nextLevelContainer.querySelectorAll('.item-source-select-button.active').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            if (tempNodeIdInputElement) tempNodeIdInputElement.value = child.id;
            updatePathDisplayForButtonUI(containerElement, pathDisplayElement);
            populateItemSourceLevelButtons(child.id, level + 1, containerElement, pathDisplayElement, tempNodeIdInputElement);
        });
        nextLevelContainer.appendChild(button);
    });
}

function updatePathDisplayForButtonUI(selectionAreaElement, pathDisplayElement) {
    if (!selectionAreaElement || !pathDisplayElement) return;
    const pathParts = [];
    const activeButtons = selectionAreaElement.querySelectorAll('.item-source-select-button.active');
    activeButtons.forEach(btn => {
        pathParts.push(btn.dataset.nodeName);
    });
    pathDisplayElement.value = pathParts.length > 0 ? pathParts.join(' > ') : '未選択';
}

function confirmSourceSelectionForButtonUI() {
    const tempNodeIdInput = document.getElementById('selectedItemSourceNodeId_temp'); // item-manager側のDOM
    const selectedNodeId = tempNodeIdInput ? tempNodeIdInput.value : null;
    
    if (selectedNodeId) {
        const allSources = getItemSourcesFuncCache();
        const selectedNodeData = allSources.find(s => s.id === selectedNodeId);
        
        if (selectedNodeData) {
            let displayStringForCallback = "";
            if (selectedNodeData.displayString && selectedNodeData.displayString.trim() !== "") {
                displayStringForCallback = selectedNodeData.displayString;
            } else { // displayStringがなければパスを構築
                const pathParts = [];
                let currentIdForPath = selectedNodeId;
                let sanity = 0;
                while(currentIdForPath && sanity < 10) {
                    const node = allSources.find(s => s.id === currentIdForPath);
                    if (node) {
                        pathParts.unshift(node.name);
                        currentIdForPath = node.parentId;
                    } else { break; }
                    sanity++;
                }
                displayStringForCallback = pathParts.join(' > ');
            }

            if (itemSourceSelectionCallbackForItemManager) {
                itemSourceSelectionCallbackForItemManager(selectedNodeId, displayStringForCallback);
            }
            closeModal('selectItemSourceForButtonUIModal');
        } else {
            alert("選択された経路データが見つかりませんでした。");
        }
    } else {
        alert("入手経路が選択されていません。");
    }
}

// displaySelectedItemSourcePathOnLoad は item-manager.js 側で itemSourceDisplay を更新する
// (この関数は admin-main.js から呼ばれる想定だったが、item-managerが直接itemSourceDisplayを操作する形に変更)
// window.adminModules 経由の参照も不要になる
/*
async function displaySelectedItemSourcePathOnLoad(nodeId) {
    const itemSourceDisplayInput = document.getElementById('itemSourceDisplay'); 
    const selectedNodeIdInput = document.getElementById('selectedItemSourceNodeId_temp'); 

    if (!itemSourceDisplayInput || !selectedNodeIdInput) return;
    // ... (ロジックは item-manager の loadItemForEdit に集約またはヘルパーとして item-manager から呼ばれる) ...
}
*/
