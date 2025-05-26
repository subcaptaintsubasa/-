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

const DOM_ITEM_FORM_SOURCE_SELECT = {
    selectItemSourceModal: null,
    itemSourceSelectionUiContainer: null, // HTML側のID変更に合わせて更新
    sourceLevelSelectors: [], 
    sourceLevelGroupDivs: [], 
    currentSelectionPathDisplayForItemForm: null, // HTML側のID変更に合わせて更新
    confirmItemSourceSelectionButton: null,
    itemSourceDisplayInputForItemForm: null, 
    selectedItemSourceNodeIdInputForItemForm: null, 
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

    DOM_ITEM_FORM_SOURCE_SELECT.selectItemSourceModal = document.getElementById('selectItemSourceModal');
    DOM_ITEM_FORM_SOURCE_SELECT.itemSourceSelectionUiContainer = document.getElementById('itemSourceSelectionUiContainer'); 
    for (let i = 1; i <= 4; i++) {
        const selector = document.getElementById(`sourceLevel${i}`);
        if (selector) DOM_ITEM_FORM_SOURCE_SELECT.sourceLevelSelectors.push(selector);
        if (i > 1) { 
            const groupDiv = document.getElementById(`sourceLevel${i}Group`);
            if (groupDiv) DOM_ITEM_FORM_SOURCE_SELECT.sourceLevelGroupDivs.push(groupDiv);
        }
    }
    DOM_ITEM_FORM_SOURCE_SELECT.currentSelectionPathDisplayForItemForm = document.getElementById('currentSelectionPathDisplayForItemForm'); 
    DOM_ITEM_FORM_SOURCE_SELECT.confirmItemSourceSelectionButton = document.getElementById('confirmItemSourceSelectionButton');
    DOM_ITEM_FORM_SOURCE_SELECT.itemSourceDisplayInputForItemForm = document.getElementById('itemSourceDisplay');
    DOM_ITEM_FORM_SOURCE_SELECT.selectedItemSourceNodeIdInputForItemForm = document.getElementById('selectedItemSourceNodeId');

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
        openSelectItemSourceModalForItemForm,
        displaySelectedItemSourcePathOnLoad
    };

    console.log("[ItemSource Manager] Initialized.");
}

function toggleDisplayStringInputForNode(displayStringGroupElement, parentNodeData, editingNodeId, isNewNode) {
    if (!displayStringGroupElement) return;
    const allSources = getItemSourcesFuncCache();
    let nodeIsConsideredTerminal;
    let currentDepthOfNodeBeingEditedOrCreated = 0;

    if (parentNodeData) {
        currentDepthOfNodeBeingEditedOrCreated = (parentNodeData.depth !== undefined ? parentNodeData.depth : 0) + 1;
    } else { // No parent, so it's a root node
        currentDepthOfNodeBeingEditedOrCreated = 0;
    }

    if (isNewNode) {
        // For a new node, it's considered terminal if its depth would be MAX_SOURCE_DEPTH
        // (meaning it cannot have children).
        nodeIsConsideredTerminal = currentDepthOfNodeBeingEditedOrCreated >= MAX_SOURCE_DEPTH;
    } else { // Editing existing node
        if (editingNodeId) {
            const editingNode = allSources.find(s => s.id === editingNodeId);
            if (editingNode) {
                const hasChildren = allSources.some(s => s.parentId === editingNodeId);
                if (hasChildren) {
                    nodeIsConsideredTerminal = false; // If it has children, it's not terminal for displayString input
                } else {
                    // If no children, it's terminal if its *current* (or new, if parent changed) depth is MAX_SOURCE_DEPTH
                    nodeIsConsideredTerminal = currentDepthOfNodeBeingEditedOrCreated >= MAX_SOURCE_DEPTH;
                }
            } else { // Should not happen if editingNodeId is valid
                nodeIsConsideredTerminal = currentDepthOfNodeBeingEditedOrCreated >= MAX_SOURCE_DEPTH;
            }
        } else { // editingNodeId is null, should not happen in this branch
             nodeIsConsideredTerminal = currentDepthOfNodeBeingEditedOrCreated >= MAX_SOURCE_DEPTH;
        }
    }
    
    // As per new requirement, displayString is always available for input.
    displayStringGroupElement.style.display = 'block'; 
    // The info message can indicate if it's a terminal node.
    const infoPara = displayStringGroupElement.querySelector('p.info');
    if (infoPara) {
        if (currentDepthOfNodeBeingEditedOrCreated >= MAX_SOURCE_DEPTH || (editingNodeId && !allSources.some(s => s.parentId === editingNodeId))) {
            infoPara.textContent = "この経路は末端です。アイテムの入手手段としてこの文字列が表示されます。空の場合は経路名が使われます。";
        } else {
            infoPara.textContent = "この経路は中間経路です。表示用文字列は通常、末端の経路で使用されます。";
        }
    }


    if (!nodeIsConsideredTerminal && !isNewNode) { // Only clear if editing and becoming non-terminal
        // Do not clear automatically anymore based on this logic, let user manage.
        // const inputField = displayStringGroupElement.querySelector('input[type="text"]');
        // if(inputField) inputField.value = '';
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
            if (source.displayString && source.displayString.trim() !== "") { // displayStringが空でない場合のみ表示
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

// ... (handleItemSourceTreeClick は変更なし)
// ... (addItemSourceNode, openEditItemSourceModalById, saveItemSourceNodeEdit, updateDescendantDepthsRecursive, getMaxDepthOfSubtree, deleteItemSourceNode は displayString の処理を追加・調整)

async function addItemSourceNode() {
    if (!DOMISM.newItemSourceNameInput || !DOMISM.selectedNewParentSourceIdInput) return;
    const name = DOMISM.newItemSourceNameInput.value.trim();
    const parentId = DOMISM.selectedNewParentSourceIdInput.value;
    const displayString = DOMISM.newItemSourceDisplayStringInput.value.trim(); // Get display string
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
    if (displayString) { // displayStringが入力されていれば保存
        dataToAdd.displayString = displayString;
    }

    try {
        await addDoc(collection(dbInstance, 'item_sources'), dataToAdd);
        DOMISM.newItemSourceNameInput.value = '';
        DOMISM.newItemSourceDisplayStringInput.value = ''; // Clear display string input
        populateParentSourceSelectorUI(DOMISM.newItemSourceParentSelector, DOMISM.selectedNewParentSourceIdInput, { selectedParentId: "" });
        toggleDisplayStringInputForNode(DOMISM.newItemSourceDisplayStringGroup, null, null, true);
        await refreshAllDataCallback();
    } catch (error) { console.error("[ItemSource Manager] Error adding node:", error); alert("入手経路の追加に失敗しました。"); }
}

// openEditItemSourceModalById は変更なし (toggleDisplayStringInputForNodeが編集時も考慮するため)

async function saveItemSourceNodeEdit() {
    const docId = DOMISM.editingItemSourceDocIdInput.value;
    const newName = DOMISM.editingItemSourceNameInput.value.trim();
    const newParentId = DOMISM.selectedEditingParentSourceIdInput.value;
    const newDisplayString = DOMISM.editingItemSourceDisplayStringInput.value.trim(); // Get display string

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
        dataToUpdate.displayString = deleteField(); // 空ならフィールドごと削除
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

// ... (updateDescendantDepthsRecursive, getMaxDepthOfSubtree, deleteItemSourceNode は変更なし)
// ... (openSelectItemSourceModalForItemForm, populateSourceLevelSelectForItemForm, handleSourceLevelChangeForItemForm, updateSelectionPathDisplayForItemForm, confirmSourceSelectionForItemForm, displaySelectedItemSourcePathOnLoad も変更なし)

// displaySelectedItemSourcePathOnLoad の中で、もし取得したノードに displayString があればそれを使うように修正
async function displaySelectedItemSourcePathOnLoad(nodeId) {
    if (!DOM_ITEM_FORM_SOURCE_SELECT.itemSourceDisplayInputForItemForm || !DOM_ITEM_FORM_SOURCE_SELECT.selectedItemSourceNodeIdInputForItemForm) return;
    if (!nodeId) {
        DOM_ITEM_FORM_SOURCE_SELECT.itemSourceDisplayInputForItemForm.value = "";
        DOM_ITEM_FORM_SOURCE_SELECT.selectedItemSourceNodeIdInputForItemForm.value = "";
        return;
    }

    let allSources = getItemSourcesFuncCache();
    if (!allSources || allSources.length === 0) { 
        const q = query(collection(dbInstance, 'item_sources'), orderBy('name')); // orderBy('depth'), orderBy('name') が望ましいがインデックス次第
        const snapshot = await getDocs(q);
        allSources = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    const pathParts = [];
    let currentId = nodeId;
    let sanityCheck = 0;
    let finalDisplayString = null;
    
    const targetNode = allSources.find(s => s.id === nodeId);
    if (targetNode && targetNode.displayString && targetNode.displayString.trim() !== "") {
        finalDisplayString = targetNode.displayString;
    }

    if (finalDisplayString) {
        pathParts.push(finalDisplayString);
    } else {
        while (currentId && sanityCheck < 10) {
            const node = allSources.find(s => s.id === currentId);
            if (node) {
                pathParts.unshift(node.name);
                currentId = node.parentId;
            } else {
                try { //念のためDB直接参照
                    const docSnap = await getDoc(doc(dbInstance, 'item_sources', currentId));
                    if (docSnap.exists()) {
                        const missingNode = { id: docSnap.id, ...docSnap.data() };
                        pathParts.unshift(missingNode.name);
                        currentId = missingNode.parentId;
                    } else { break; }
                } catch (e) { console.error("Error fetching missing source node for path:", e); break; }
            }
            sanityCheck++;
        }
    }
    DOM_ITEM_FORM_SOURCE_SELECT.itemSourceDisplayInputForItemForm.value = pathParts.join(finalDisplayString ? '' : ' > '); // displayStringなら区切り文字不要
    DOM_ITEM_FORM_SOURCE_SELECT.selectedItemSourceNodeIdInputForItemForm.value = nodeId;
}
