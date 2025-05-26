// js/admin-modules/item-source-manager.js
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp, writeBatch, getDoc, deleteField } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { openModal, closeModal, populateSelect } from './ui-helpers.js';

const DOMISM = { 
    newItemSourceNameInput: null,
    newItemSourceParentSelector: null,
    selectedNewParentSourceIdInput: null,
    newItemSourceDisplayStringGroup: null, // New
    newItemSourceDisplayStringInput: null, // New
    addItemSourceButton: null,
    itemSourceListContainer: null,
    itemSourceSearchInput: null,

    editItemSourceModal: null,
    editingItemSourceDocIdInput: null,
    editingItemSourceNameInput: null,
    editingItemSourceParentSelector: null,
    selectedEditingParentSourceIdInput: null,
    editingItemSourceDisplayStringGroup: null, // New
    editingItemSourceDisplayStringInput: null, // New
    saveItemSourceEditButton: null,
    deleteItemSourceFromEditModalButton: null,
};

const DOM_ITEM_FORM_SOURCE_SELECT = {
    selectItemSourceModal: null,
    itemSourceSelectionArea: null, // HTMLでは itemSourceSelectionUiContainer に変更したが、JS変数はそのまま
    sourceLevelSelectors: [], 
    sourceLevelGroupDivs: [], 
    currentSelectionPathDisplay: null, // HTMLでは currentSelectionPathDisplayForItemForm に変更したが、JS変数はそのまま
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
    DOMISM.newItemSourceDisplayStringGroup = document.getElementById('newItemSourceDisplayStringGroup'); // New
    DOMISM.newItemSourceDisplayStringInput = document.getElementById('newItemSourceDisplayString'); // New
    DOMISM.addItemSourceButton = document.getElementById('addItemSourceButton');
    DOMISM.itemSourceListContainer = document.getElementById('itemSourceListContainer');
    DOMISM.itemSourceSearchInput = document.getElementById('itemSourceSearchInput');

    DOMISM.editItemSourceModal = document.getElementById('editItemSourceModal');
    DOMISM.editingItemSourceDocIdInput = document.getElementById('editingItemSourceDocId');
    DOMISM.editingItemSourceNameInput = document.getElementById('editingItemSourceName');
    DOMISM.editingItemSourceParentSelector = document.getElementById('editingItemSourceParentSelector');
    DOMISM.selectedEditingParentSourceIdInput = document.getElementById('selectedEditingParentSourceId');
    DOMISM.editingItemSourceDisplayStringGroup = document.getElementById('editingItemSourceDisplayStringGroup'); // New
    DOMISM.editingItemSourceDisplayStringInput = document.getElementById('editingItemSourceDisplayString'); // New
    DOMISM.saveItemSourceEditButton = document.getElementById('saveItemSourceEditButton');
    DOMISM.deleteItemSourceFromEditModalButton = document.getElementById('deleteItemSourceFromEditModalButton');

    DOM_ITEM_FORM_SOURCE_SELECT.selectItemSourceModal = document.getElementById('selectItemSourceModal');
    DOM_ITEM_FORM_SOURCE_SELECT.itemSourceSelectionArea = document.getElementById('itemSourceSelectionUiContainer'); // HTMLのID変更に合わせる
    for (let i = 1; i <= 4; i++) {
        const selector = document.getElementById(`sourceLevel${i}`);
        if (selector) DOM_ITEM_FORM_SOURCE_SELECT.sourceLevelSelectors.push(selector);
        if (i > 1) { 
            const groupDiv = document.getElementById(`sourceLevel${i}Group`);
            if (groupDiv) DOM_ITEM_FORM_SOURCE_SELECT.sourceLevelGroupDivs.push(groupDiv);
        }
    }
    DOM_ITEM_FORM_SOURCE_SELECT.currentSelectionPathDisplay = document.getElementById('currentSelectionPathDisplayForItemForm'); // HTMLのID変更に合わせる
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
    
    // 親経路セレクタの変更イベントで表示用文字列入力欄の表示/非表示を制御
    if(DOMISM.newItemSourceParentSelector) {
        DOMISM.newItemSourceParentSelector.addEventListener('click', (event) => { // ボタン群なのでコンテナにリスナー
            if(event.target.classList.contains('category-select-button')) {
                toggleDisplayStringInputVisibility(DOMISM.newItemSourceParentSelector, DOMISM.selectedNewParentSourceIdInput, DOMISM.newItemSourceDisplayStringGroup);
            }
        });
    }
    if(DOMISM.editingItemSourceParentSelector) {
         DOMISM.editingItemSourceParentSelector.addEventListener('click', (event) => {
            if(event.target.classList.contains('category-select-button')) {
                toggleDisplayStringInputVisibility(DOMISM.editingItemSourceParentSelector, DOMISM.selectedEditingParentSourceIdInput, DOMISM.editingItemSourceDisplayStringGroup);
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

// 表示用文字列入力欄の表示/非表示を切り替えるヘルパー
function toggleDisplayStringInputVisibility(parentSelectorContainer, selectedParentIdInput, displayStringGroupElement) {
    const parentId = selectedParentIdInput.value;
    const allSources = getItemSourcesFuncCache();
    let isParentTerminal = true;
    if (parentId) { // 親が選択されている場合
        isParentTerminal = !allSources.some(s => s.parentId === parentId);
    } else { // 親が選択されていない（最上位に追加）場合は、子は作れるので末端ではない
        isParentTerminal = false; 
    }
    // 新規追加の場合、親が末端かどうかは関係なく、常に「子」として追加するので、
    // displayString入力欄は、追加されるノードが子を持つかどうかで決まる。
    // 新規追加時は子はいないので、常に末端扱い。
    // 編集時は、そのノードが子を持つかどうかで判断。
    // ここでのロジックは、親の選択状態に基づいて「今作ろうとしているノードが末端になる可能性」を示唆するが、
    // 厳密には「このノードが末端か？」で判断すべき。
    //
    // 修正：単純に「親が選択されているか」で判断するのではなく、
    // 「今作成/編集しているノードが、子ノードを持つ見込みがあるか（階層的に）」で判断。
    // MAX_DEPTH に達していたら、それ以上子は作れないので、末端として displayString を表示。
    let currentDepth = 0;
    if (parentId) {
        const parentNode = allSources.find(s => s.id === parentId);
        if (parentNode) {
            currentDepth = (parentNode.depth !== undefined ? parentNode.depth : 0) + 1;
        }
    }
    
    // 新規追加時、または編集中で親を変更した場合、そのノードが末端になるか（深さ制限で）
    if (currentDepth >= MAX_SOURCE_DEPTH) { // これが子を持てない最後の階層
        displayStringGroupElement.style.display = 'block';
    } else {
        displayStringGroupElement.style.display = 'none';
        // displayString入力欄もクリアした方が良い場合がある
        const inputField = displayStringGroupElement.querySelector('input[type="text"]');
        if(inputField) inputField.value = '';
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
        // 新規追加モーダルか編集モーダルかで対象のdisplayStringGroupを特定
        const displayStringGroup = selectorContainer.id === 'newItemSourceParentSelector' ? 
                                   DOMISM.newItemSourceDisplayStringGroup : 
                                   DOMISM.editingItemSourceDisplayStringGroup;
        if (displayStringGroup) {
            toggleDisplayStringInputForNode(displayStringGroup, null, currentSourceIdToExclude); // 親なしなので、depth 0。子が作れるなら非表示
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
                    if (displayStringGroup) {
                        // 選択された親のsourceオブジェクトを渡す
                        toggleDisplayStringInputForNode(displayStringGroup, source, currentSourceIdToExclude);
                    }
                });
                selectorContainer.appendChild(button);
                buildParentOptionsRecursive(source.id, depth + 1);
            });
    }
    buildParentOptionsRecursive();
}

// ノード自身が末端かどうかで表示用文字列入力欄の表示/非表示を制御
function toggleDisplayStringInputForNode(displayStringGroupElement, parentNodeData, editingNodeId = null) {
    if (!displayStringGroupElement) return;
    const allSources = getItemSourcesFuncCache();
    let nodeIsTerminal;
    let nodeDepth = 0;

    if (parentNodeData) { // 親が選択されている -> これから作る/編集するノードは子
        nodeDepth = (parentNodeData.depth !== undefined ? parentNodeData.depth : 0) + 1;
    } else { // 親が選択されていない -> これから作る/編集するノードは最上位
        nodeDepth = 0;
    }

    if (editingNodeId) { // 編集中
        const editingNode = allSources.find(s => s.id === editingNodeId);
        if (editingNode) {
            nodeIsTerminal = !allSources.some(s => s.parentId === editingNodeId) && (editingNode.depth >= MAX_SOURCE_DEPTH);
             //  編集中は、自身が子を持つか、かつ、階層制限に達しているかで判断
            const hasChildren = allSources.some(s => s.parentId === editingNodeId);
            if (hasChildren) { // 子がいるなら末端ではない
                nodeIsTerminal = false;
            } else { // 子がいない場合、階層制限に達していれば末端
                nodeIsTerminal = nodeDepth >= MAX_SOURCE_DEPTH;
            }
        } else { nodeIsTerminal = nodeDepth >= MAX_SOURCE_DEPTH; } // ノードが見つからない場合は深さで判断
    } else { // 新規作成中 (子はいない前提)
        nodeIsTerminal = nodeDepth >= MAX_SOURCE_DEPTH;
    }
    
    displayStringGroupElement.style.display = nodeIsTerminal ? 'block' : 'none';
    if (!nodeIsTerminal) {
        const inputField = displayStringGroupElement.querySelector('input[type="text"]');
        if(inputField) inputField.value = '';
    }
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
            if (source.displayString) {
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
    // 新規追加時の表示用文字列入力欄の初期状態
    toggleDisplayStringInputForNode(DOMISM.newItemSourceDisplayStringGroup, allSources.find(s=>s.id === DOMISM.selectedNewParentSourceIdInput.value) || null, null);

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
    if (depth >= MAX_SOURCE_DEPTH && displayString) { // 末端の場合のみdisplayStringを保存
        dataToAdd.displayString = displayString;
    }


    try {
        await addDoc(collection(dbInstance, 'item_sources'), dataToAdd);
        DOMISM.newItemSourceNameInput.value = '';
        DOMISM.newItemSourceDisplayStringInput.value = '';
        populateParentSourceSelectorUI(DOMISM.newItemSourceParentSelector, DOMISM.selectedNewParentSourceIdInput, { selectedParentId: "" });
        toggleDisplayStringInputForNode(DOMISM.newItemSourceDisplayStringGroup, null, null); // 親なしの状態に戻す
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
    
    // 編集モーダルを開く際に、表示用文字列入力欄の表示状態を決定
    toggleDisplayStringInputForNode(DOMISM.editingItemSourceDisplayStringGroup, allSources.find(s=>s.id === (sourceToEdit.parentId || "")), sourceToEdit.id);

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
    const maxChildDepthOfMovingNode = getMaxDepthOfSubtree(docId, allSources) - originalNodeDepth;
    
    if (newDepth + maxChildDepthOfMovingNode > MAX_SOURCE_DEPTH) {
        alert(`この移動を行うと、経路の階層が${MAX_SOURCE_DEPTH + 1}階層を超えてしまいます。\n移動対象ノードの最大相対深度: ${maxChildDepthOfMovingNode}, 新しい親の深度: ${newDepth -1}, 結果深度: ${newDepth + maxChildDepthOfMovingNode}`);
        return;
    }
    
    const dataToUpdate = {
        name: newName, 
        parentId: newParentId || "", 
        depth: newDepth, 
        updatedAt: serverTimestamp()
    };

    // displayString の処理: 新しい深さがMAX_SOURCE_DEPTH以上（つまり末端）の場合のみ保存
    const hasChildrenAfterEdit = allSources.some(s => s.parentId === docId && s.id !== docId); // 自分自身は除く
    const isTerminalAfterEdit = !hasChildrenAfterEdit && newDepth >= MAX_SOURCE_DEPTH;

    if (isTerminalAfterEdit && newDisplayString) {
        dataToUpdate.displayString = newDisplayString;
    } else {
        dataToUpdate.displayString = deleteField(); // 末端でない、または表示文字列が空なら削除
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
            console.error(`Depth limit exceeded for child ${child.id} (new depth ${childNewDepth}). Skipping update.`);
            continue; 
        }
        const childUpdateData = { depth: childNewDepth };
        // もし子孫も末端でなくなるならdisplayStringを消すロジックが必要だが、
        // ここでは親の移動に伴うdepth更新のみに集中。displayStringは各ノード編集時に管理。
        batch.update(doc(dbInstance, 'item_sources', child.id), childUpdateData);
        await updateDescendantDepthsRecursive(child.id, childNewDepth, allSources, batch);
    }
}

function getMaxDepthOfSubtree(rootId, allSources) {
    let maxAbsDepth = -1; 
    const findMaxRecursive = (nodeId, currentAbsDepth) => {
        maxAbsDepth = Math.max(maxAbsDepth, currentAbsDepth);
        const childrenOfNode = allSources.filter(s => s.parentId === nodeId);
        for (const childNode of childrenOfNode) {
            findMaxRecursive(childNode.id, currentAbsDepth + 1);
        }
    };
    const rootNode = allSources.find(s => s.id === rootId);
    if (rootNode) {
        findMaxRecursive(rootId, rootNode.depth !== undefined ? rootNode.depth : 0); 
    }
    return maxAbsDepth;
}

async function deleteItemSourceNode(docId, nodeName) {
    const allSources = getItemSourcesFuncCache();
    const itemsCache = getItemsFuncCache();

    const children = allSources.filter(s => s.parentId === docId);
    if (children.length > 0) {
        alert(`経路「${nodeName}」は他の経路の親として使用されているため削除できません。先に子経路を削除するか、別の親経路に移動してください。`); return;
    }
    
    const itemsUsingSource = itemsCache.filter(item => item.sourceNodeId === docId);
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

function openSelectItemSourceModalForItemForm() {
    if (!DOM_ITEM_FORM_SOURCE_SELECT.selectItemSourceModal || !DOM_ITEM_FORM_SOURCE_SELECT.itemSourceDisplayInputForItemForm) return;
    
    DOM_ITEM_FORM_SOURCE_SELECT.sourceLevelSelectors.forEach((sel, index) => {
        sel.innerHTML = ''; 
        const groupDivIndex = index -1; 
        if (index > 0 && DOM_ITEM_FORM_SOURCE_SELECT.sourceLevelGroupDivs[groupDivIndex]) { // groupDivs[0]はL2G
            DOM_ITEM_FORM_SOURCE_SELECT.sourceLevelGroupDivs[groupDivIndex].style.display = 'none';
        }
    });

    populateSourceLevelSelectForItemForm(1, ""); 
    updateSelectionPathDisplayForItemForm(); 
    openModal('selectItemSourceModal');
}

function populateSourceLevelSelectForItemForm(level, parentId) {
    const selectorIndex = level - 1;
    const selector = DOM_ITEM_FORM_SOURCE_SELECT.sourceLevelSelectors[selectorIndex];
    if (!selector) return;
    const allSources = getItemSourcesFuncCache();
    const children = allSources.filter(s => (s.parentId || "") === parentId && (s.depth !== undefined && s.depth === selectorIndex)).sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    
    selector.innerHTML = '<option value="">選択してください</option>';
    children.forEach(child => {
        const option = document.createElement('option');
        option.value = child.id; option.textContent = child.name;
        selector.appendChild(option);
    });

    for (let i = level; i < 4; i++) {
        const nextSelector = DOM_ITEM_FORM_SOURCE_SELECT.sourceLevelSelectors[i];
        if (nextSelector) nextSelector.innerHTML = '<option value="">選択してください</option>';
        // sourceLevelGroupDivsはL2,L3,L4のグループ(index 0,1,2)
        // ループ変数iは現在のselectorのindex (0-indexed)
        // 次のレベルのグループのindexは i
        const groupDivIndex = i;
        if (DOM_ITEM_FORM_SOURCE_SELECT.sourceLevelGroupDivs[groupDivIndex]) {
           DOM_ITEM_FORM_SOURCE_SELECT.sourceLevelGroupDivs[groupDivIndex].style.display = 'none';
        }
    }
}

function handleSourceLevelChangeForItemForm(event) {
    const currentLevel = parseInt(event.target.dataset.level, 10); 
    const selectedValue = event.target.value;

    for (let i = currentLevel; i < 4; i++) {
        const selectorToReset = DOM_ITEM_FORM_SOURCE_SELECT.sourceLevelSelectors[i]; 
        if (selectorToReset) {
            selectorToReset.innerHTML = '<option value="">選択してください</option>';
        }
        // グループのインデックスは、対応するセレクタのレベル - 2
        // L(i+1) のセレクタに対するグループのインデックスは (i+1)-2 = i-1
        // ただし、iは0-indexedなので、セレクタがsourceLevelSelectors[i]の時、そのグループはsourceLevelGroupDivs[i-1] (i>=1)
        const groupToHideIndex = i -1; // This is tricky.
                                    // loop i is 0-indexed (currentLevel is 1-indexed for dataset.level)
                                    // selector index `i` -> group index `i-1` (if groups are for L2, L3, L4)
                                    // Let's use currentLevel (1-indexed)
                                    // For levels currentLevel+1 to 4.
                                    // If currentLevel = 1, we reset groups for L2, L3, L4 (group indices 0, 1, 2)
        if (i >= currentLevel) { // Resetting groups for levels *after* the current one that changed.
            const groupIndexForLevel = i; // Groups for L(i+1) is sourceLevelGroupDivs[i] if L2 is index 0
            if(DOM_ITEM_FORM_SOURCE_SELECT.sourceLevelGroupDivs[groupIndexForLevel]) { // index for groupDivs is level-2
                DOM_ITEM_FORM_SOURCE_SELECT.sourceLevelGroupDivs[groupIndexForLevel].style.display = 'none';
            }
        }
    }

    if (selectedValue && currentLevel < 4) {
        // 次のレベル (currentLevel + 1) のグループを表示
        // currentLevel は 1-indexed. 次のレベルのグループは sourceLevelGroupDivs[currentLevel-1]
        const nextGroupIndex = currentLevel - 1; // L2Group is at index 0, L3Group at 1, L4Group at 2
        if (DOM_ITEM_FORM_SOURCE_SELECT.sourceLevelGroupDivs[nextGroupIndex]) {
            populateSourceLevelSelectForItemForm(currentLevel + 1, selectedValue);
            DOM_ITEM_FORM_SOURCE_SELECT.sourceLevelGroupDivs[nextGroupIndex].style.display = 'block';
        }
    }
    updateSelectionPathDisplayForItemForm();
}

function updateSelectionPathDisplayForItemForm() {
    if (!DOM_ITEM_FORM_SOURCE_SELECT.currentSelectionPathDisplay || !DOM_ITEM_FORM_SOURCE_SELECT.confirmItemSourceSelectionButton) return;
    const pathParts = [];
    const allSources = getItemSourcesFuncCache();
    let lastSelectedNodeId = "";
    
    for (let i = 0; i < 4; i++) {
        const selector = DOM_ITEM_FORM_SOURCE_SELECT.sourceLevelSelectors[i];
        if (selector && selector.value) {
            const selectedNode = allSources.find(s => s.id === selector.value);
            if (selectedNode) { 
                pathParts.push(selectedNode.name); 
                lastSelectedNodeId = selectedNode.id;
            } else break; 
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
    } else if (pathParts.length === 0) { 
         DOM_ITEM_FORM_SOURCE_SELECT.confirmItemSourceSelectionButton.disabled = true;
    }
}

function confirmSourceSelectionForItemForm() {
    let selectedNodeId = "";
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
    if (!allSources || allSources.length === 0) { 
        const q = query(collection(dbInstance, 'item_sources'), orderBy('name'));
        const snapshot = await getDocs(q);
        allSources = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    const pathParts = [];
    let currentId = nodeId;
    let sanityCheck = 0;
    
    const selectedNode = allSources.find(s => s.id === nodeId);
    let displayString = selectedNode ? selectedNode.displayString : null;

    if (displayString) { // displayString があればそれを優先
        pathParts.push(displayString);
    } else { //なければパスを構築
        while (currentId && sanityCheck < 10) {
            const node = allSources.find(s => s.id === currentId);
            if (node) {
                pathParts.unshift(node.name);
                currentId = node.parentId;
            } else {
                try {
                    const docSnap = await getDoc(doc(dbInstance, 'item_sources', currentId));
                    if (docSnap.exists()) {
                        const missingNode = { id: docSnap.id, ...docSnap.data() };
                        pathParts.unshift(missingNode.name);
                        currentId = missingNode.parentId;
                    } else { break; }
                } catch (e) { console.error("Error fetching missing source node:", e); break; }
            }
            sanityCheck++;
        }
    }
    DOM_ITEM_FORM_SOURCE_SELECT.itemSourceDisplayInputForItemForm.value = pathParts.join(' > ');
    DOM_ITEM_FORM_SOURCE_SELECT.selectedItemSourceNodeIdInputForItemForm.value = nodeId;
}
