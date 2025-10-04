// js/admin-modules/item-source-manager.js
import { collection, getDocs, addDoc, doc, updateDoc, query, where, orderBy, serverTimestamp, writeBatch, deleteField } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js"; // deleteDoc removed
import { openModal, closeModal } from './ui-helpers.js'; // populateSelect not directly used here

const DOMISM = {
    newItemSourceNameInput: null,
    newItemSourceParentSelector: null,
    selectedNewParentSourceIdInput: null,
    newItemSourceDisplayStringGroup: null,
    newItemSourceDisplayStringInput: null,
    addItemSourceButton: null,
    itemSourceListContainer: null,
    itemSourceSearchInput: null,
    enlargeItemSourceListButton: null, // Added for consistency

    editItemSourceModal: null,
    editingItemSourceDocIdInput: null,
    editingItemSourceNameInput: null,
    editingItemSourceParentSelector: null,
    selectedEditingParentSourceIdInput: null,
    editingItemSourceDisplayStringGroup: null,
    editingItemSourceDisplayStringInput: null,
    saveItemSourceEditButton: null,
    deleteItemSourceFromEditModalButton: null,

    finalSourceDisplayPreviewInput: null, // Used by item-manager, but related
};

let dbInstance = null;
let getItemSourcesFuncCache = () => [];
let getItemsFuncCache = () => []; // For checking usage on delete
let refreshAllDataCallback = async () => {};
let openEnlargedListModalCallbackFromMain = (config) => {};


const itemSourceExpansionState = new Map();
let currentItemSourceSearchTerm = "";
const MAX_SOURCE_DEPTH = 3; // 0-indexed (0, 1, 2, 3 means 4 levels)

export function initItemSourceManager(dependencies) {
    dbInstance = dependencies.db;
    getItemSourcesFuncCache = dependencies.getItemSources; // Assumes non-deleted
    getItemsFuncCache = dependencies.getItems; // Assumes non-deleted
    refreshAllDataCallback = dependencies.refreshAllData;
    if (typeof dependencies.openEnlargedListModal === 'function') {
        openEnlargedListModalCallbackFromMain = dependencies.openEnlargedListModal;
    }

    DOMISM.newItemSourceNameInput = document.getElementById('newItemSourceName');
    DOMISM.newItemSourceParentSelector = document.getElementById('newItemSourceParentSelector');
    DOMISM.selectedNewParentSourceIdInput = document.getElementById('selectedNewParentSourceId');
    DOMISM.newItemSourceDisplayStringGroup = document.getElementById('newItemSourceDisplayStringGroup');
    DOMISM.newItemSourceDisplayStringInput = document.getElementById('newItemSourceDisplayString');
    DOMISM.addItemSourceButton = document.getElementById('addItemSourceButton');
    DOMISM.itemSourceListContainer = document.getElementById('itemSourceListContainer');
    DOMISM.itemSourceSearchInput = document.getElementById('itemSourceSearchInput');
    DOMISM.enlargeItemSourceListButton = document.getElementById('enlargeItemSourceListButton');


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
            if (nodeId && node) {
                logicalDeleteItemSourceNode(nodeId, node.name); // Changed to logicalDelete
            } else {
                alert("削除対象の経路IDが見つかりません。");
            }
        });
    }
    if (DOMISM.itemSourceListContainer) DOMISM.itemSourceListContainer.addEventListener('click', handleItemSourceTreeClick);
    if (DOMISM.itemSourceSearchInput) {
        DOMISM.itemSourceSearchInput.addEventListener('input', (e) => {
            currentItemSourceSearchTerm = e.target.value.toLowerCase().trim();
            _renderItemSourcesForManagementInternal();
        });
    }
     if (DOMISM.enlargeItemSourceListButton) {
        DOMISM.enlargeItemSourceListButton.addEventListener('click', () => {
            if (typeof openEnlargedListModalCallbackFromMain === 'function') {
                openEnlargedListModalCallbackFromMain({
                    title: "入手経路一覧 (拡大)",
                    sourceFn: getItemSourcesFuncCache,
                    itemType: 'itemSource',
                    searchInputId: 'itemSourceSearchInput',
                    currentSearchTerm: currentItemSourceSearchTerm,
                    editFunction: openEditItemSourceModalById,
                    displayRenderer: buildItemSourceTreeDOM // This function needs to be robust
                });
            }
        });
    }


    // Event listeners for parent selectors to toggle displayString input visibility/text
    if(DOMISM.newItemSourceParentSelector) {
        DOMISM.newItemSourceParentSelector.addEventListener('click', (event) => {
            if(event.target.classList.contains('category-select-button')) {
                // Parent selection is handled by selectParentSourceButtonUI. We need its state.
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
        buildFullPathForSourceNode,
    };

    console.log("[ItemSource Manager] Initialized for logical delete.");
}

// toggleDisplayStringInputForNode remains largely the same, uses filtered cache
function toggleDisplayStringInputForNode(displayStringGroupElement, parentNodeData, editingNodeId, isNewNode) {
    if (!displayStringGroupElement) return;
    const allSources = getItemSourcesFuncCache(); // Assumes non-deleted
    let currentDepthOfNodeBeingEditedOrCreated = 0;

    if (parentNodeData) { // parentNodeData is from the filtered cache, so it's not deleted
        currentDepthOfNodeBeingEditedOrCreated = (parentNodeData.depth !== undefined ? parentNodeData.depth : 0) + 1;
    } else { // Root node
        currentDepthOfNodeBeingEditedOrCreated = 0;
    }

    displayStringGroupElement.style.display = 'block'; // Always show the group, adjust text below
    const infoPara = displayStringGroupElement.querySelector('p.info');
    if (infoPara) {
        let isConsideredTerminalForDisplayString = false;
        if (isNewNode) {
            // If new, it's terminal if its depth would be >= MAX_SOURCE_DEPTH
            isConsideredTerminalForDisplayString = currentDepthOfNodeBeingEditedOrCreated >= MAX_SOURCE_DEPTH;
        } else if (editingNodeId) {
            // If editing, it's terminal if it has no *active* children
            const hasActiveChildren = allSources.some(s => s.parentId === editingNodeId); // No need for !s.isDeleted as allSources is filtered
            isConsideredTerminalForDisplayString = !hasActiveChildren;
        }

        if (isConsideredTerminalForDisplayString) {
            infoPara.textContent = "この経路は末端として扱えます。アイテムの入手手段としてこの文字列が表示されます。空の場合は経路名が使われます。";
        } else {
            infoPara.textContent = "この経路は中間経路です。表示用文字列は通常、末端の経路で使用されます（が、設定は可能です）。";
        }
    }
}


// populateParentSourceSelectorUI remains largely the same, uses filtered cache
function populateParentSourceSelectorUI(selectorContainer, hiddenInput, options = {}) {
    const { currentSourceIdToExclude = null, selectedParentId = "" } = options;
    const allSources = getItemSourcesFuncCache(); // Assumes non-deleted

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
        if (depth > MAX_SOURCE_DEPTH - 1) return; // Max depth for a PARENT is one less than max node depth

        allSources // Already filtered for non-deleted
            .filter(source => (source.parentId || "") === parentId && source.id !== currentSourceIdToExclude)
            .sort((a, b) => a.name.localeCompare(b.name, 'ja'))
            .forEach(source => {
                let isAncestorOfExcluded = false;
                if (currentSourceIdToExclude) {
                    let tempAncestorId = currentSourceIdToExclude;
                    let sanity = 0;
                    while (tempAncestorId && sanity < (MAX_SOURCE_DEPTH + 2)) { // Safety break
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
                        // Pass source data (which is non-deleted)
                        toggleDisplayStringInputForNode(displayStringGroup, source, currentSourceIdToExclude, isNew);
                    }
                });
                selectorContainer.appendChild(button);
                buildParentOptionsRecursive(source.id, depth + 1);
            });
    }
    buildParentOptionsRecursive();
}


// selectParentSourceButtonUI remains the same
function selectParentSourceButtonUI(container, hiddenInput, clickedButton, parentId) {
    container.querySelectorAll('.category-select-button.active').forEach(activeBtn => activeBtn.classList.remove('active'));
    clickedButton.classList.add('active');
    hiddenInput.value = parentId;
}

// buildItemSourceTreeDOM remains largely the same, operates on filtered cache
export function buildItemSourceTreeDOM(sourcesToDisplay, allSourcesData, isEnlargedView = false) {
    // sourcesToDisplay and allSourcesData are assumed to be non-deleted
    const buildNode = (parentId = "", currentDisplayDepth = 0) => { // currentDisplayDepth is for visual indent
        const children = sourcesToDisplay
            .filter(source => (source.parentId || "") === parentId) // No need for !source.isDeleted
            .sort((a, b) => a.name.localeCompare(b.name, 'ja'));

        if (children.length === 0) return null;
        const ul = document.createElement('ul');
        if (parentId !== "") { // Not root
            ul.classList.add('category-tree-children');
            // Handle expansion state for normal view
            if (!isEnlargedView && !currentItemSourceSearchTerm && !itemSourceExpansionState.get(parentId)) {
                ul.classList.add('hidden');
            }
        }

        children.forEach(source => {
            const li = document.createElement('li');
            li.classList.add('category-tree-item');
            li.dataset.sourceId = source.id;
            const actualDepth = source.depth !== undefined ? source.depth : 0; // Actual data depth
            li.dataset.depth = actualDepth;

            // Check for active children among all non-deleted sources
            const hasActualChildren = allSourcesData.some(s => s.parentId === source.id); // No !s.isDeleted needed
            const isExpanded = isEnlargedView || !!currentItemSourceSearchTerm || itemSourceExpansionState.get(source.id);

            const expander = document.createElement('span');
            expander.classList.add('category-tree-expander');
            if (hasActualChildren) {
                expander.textContent = isExpanded ? '▼' : '►';
                if (isExpanded) expander.classList.add('expanded');
            } else {
                expander.innerHTML = ' '; // Non-breaking space for alignment
            }
            if (!isEnlargedView) expander.dataset.action = 'toggle'; // Only add toggle action if not enlarged
            li.appendChild(expander);

            const content = document.createElement('div');
            content.classList.add('category-tree-content');
            if (!isEnlargedView) content.dataset.action = 'edit'; // For normal view edit

            const nameSpan = document.createElement('span');
            nameSpan.classList.add('category-name');
            nameSpan.textContent = source.name;
            content.appendChild(nameSpan);

            const smallInfo = document.createElement('small');
            let infoText = ` (階層: ${actualDepth + 1})`; // Display 1-indexed depth
            if (source.displayString && source.displayString.trim() !== "") {
                infoText += ` [表示: ${source.displayString.substring(0,15)}${source.displayString.length > 15 ? '...' : ''}]`;
            }
            smallInfo.textContent = infoText;
            content.appendChild(smallInfo);
            li.appendChild(content);

            if (hasActualChildren) {
                const childrenUl = buildNode(source.id, actualDepth + 1); // Pass updated depth
                if (childrenUl) {
                    // Handle expansion for normal view
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
    return buildNode("", 0); // Start with root (parentId="") and depth 0
}


// _renderItemSourcesForManagementInternal remains largely the same, uses filtered cache
export function _renderItemSourcesForManagementInternal() {
    if (!DOMISM.itemSourceListContainer) {
        console.error("[ItemSource Manager] itemSourceListContainer is null!");
        return;
    }
    const allSources = getItemSourcesFuncCache(); // Assumes non-deleted
    DOMISM.itemSourceListContainer.innerHTML = '';

    let sourcesToDisplay = allSources;
    if (currentItemSourceSearchTerm) {
        const searchResults = allSources.filter(s => 
            s.name.toLowerCase().includes(currentItemSourceSearchTerm) || 
            (s.displayString && s.displayString.toLowerCase().includes(currentItemSourceSearchTerm))
        );
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
        const treeRoot = buildItemSourceTreeDOM(sourcesToDisplay, allSources, false); // false for normal management view
        if (treeRoot) {
            DOMISM.itemSourceListContainer.appendChild(treeRoot);
        } else {
            DOMISM.itemSourceListContainer.innerHTML = '<p>入手経路の表示に失敗しました。</p>';
        }
    }
    // Repopulate parent selector and toggle displayString input based on current selection
    populateParentSourceSelectorUI(DOMISM.newItemSourceParentSelector, DOMISM.selectedNewParentSourceIdInput, { selectedParentId: DOMISM.selectedNewParentSourceIdInput.value || "" });
    const initialParentId = DOMISM.selectedNewParentSourceIdInput.value;
    const initialParentNode = initialParentId ? allSources.find(s=>s.id === initialParentId) : null;
    toggleDisplayStringInputForNode(DOMISM.newItemSourceDisplayStringGroup, initialParentNode, null, true);
}

// handleItemSourceTreeClick remains the same
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
    } else if (action === 'edit') { // Edit action from the list item directly
        openEditItemSourceModalById(sourceId);
    } else if (target.classList.contains('category-name') || target.closest('.category-tree-content')) {
        // Fallback if clicked on content area but not specific action button (for non-enlarged view)
        if (!actionTarget) openEditItemSourceModalById(sourceId);
    }
}


async function addItemSourceNode() {
    if (!DOMISM.newItemSourceNameInput || !DOMISM.selectedNewParentSourceIdInput) return;
    const name = DOMISM.newItemSourceNameInput.value.trim();
    const parentId = DOMISM.selectedNewParentSourceIdInput.value;
    const displayString = DOMISM.newItemSourceDisplayStringInput.value.trim();
    if (!name) { alert("経路名を入力してください。"); return; }

    const allSources = getItemSourcesFuncCache(); // Assumes non-deleted
    // Check for duplicates among non-deleted sources under the same parent
    const q = query(collection(dbInstance, 'item_sources'), 
                    where('name', '==', name), 
                    where('parentId', '==', parentId || ""),
                    where('isDeleted', '==', false) // Important for duplicate check
                  );
    const existingQuery = await getDocs(q);
    if (!existingQuery.empty) {
        alert(parentId ? "同じ親経路内に同じ名前の経路が既に存在します。" : "同じ名前の最上位経路が既に存在します。");
        return;
    }

    let depth = 0;
    if (parentId) {
        const parentNode = allSources.find(s => s.id === parentId); // parentNode must be non-deleted
        if (parentNode) depth = (parentNode.depth !== undefined ? parentNode.depth : 0) + 1;
        else { alert("親経路が見つかりません (おそらく削除済み)。"); return; } // Should not happen if UI is correct
    }
    if (depth > MAX_SOURCE_DEPTH) {
        alert(`入手経路は最大${MAX_SOURCE_DEPTH + 1}階層までです。これ以上深くは追加できません。`);
        return;
    }

    const dataToAdd = {
        name: name, 
        parentId: parentId || "", 
        depth: depth, 
        isDeleted: false, // New nodes are not deleted
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp() // Add updatedAt
    };
    if (displayString) {
        dataToAdd.displayString = displayString;
    }

    try {
        await addDoc(collection(dbInstance, 'item_sources'), dataToAdd);
        DOMISM.newItemSourceNameInput.value = '';
        DOMISM.newItemSourceDisplayStringInput.value = '';
        // Reset parent selector and toggle display string input
        populateParentSourceSelectorUI(DOMISM.newItemSourceParentSelector, DOMISM.selectedNewParentSourceIdInput, { selectedParentId: "" });
        toggleDisplayStringInputForNode(DOMISM.newItemSourceDisplayStringGroup, null, null, true);
    } catch (error) { console.error("[ItemSource Manager] Error adding node:", error); alert("入手経路の追加に失敗しました。"); }
}

// openEditItemSourceModalById remains largely the same, uses filtered cache
export function openEditItemSourceModalById(sourceId) {
    const allSources = getItemSourcesFuncCache(); // Assumes non-deleted
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

    const allSources = getItemSourcesFuncCache(); // Assumes non-deleted
    const originalSource = allSources.find(s => s.id === docId);
    if (!originalSource) { alert("元の経路データが見つかりません。"); return; }

    // Check for duplicates among non-deleted sources if name or parent changed
    if (originalSource.name !== newName || (originalSource.parentId || "") !== (newParentId || "")) {
        const q = query(collection(dbInstance, 'item_sources'), 
                        where('name', '==', newName), 
                        where('parentId', '==', newParentId || ""),
                        where('isDeleted', '==', false) // Check against non-deleted
                      );
        const existingQuery = await getDocs(q);
        if (existingQuery.docs.some(docSnap => docSnap.id !== docId)) {
            alert(newParentId ? "同じ親経路内に同じ名前の経路が既に存在します。" : "同じ名前の最上位経路が既に存在します。");
            return;
        }
    }

    let newDepth = 0;
    if (newParentId) {
        const newParentNode = allSources.find(s => s.id === newParentId); // Must be non-deleted
        if (!newParentNode) { alert("新しい親経路が見つかりません (おそらく削除済み)。"); return; }
        newDepth = (newParentNode.depth !== undefined ? newParentNode.depth : 0) + 1;

        // Circular dependency check (using non-deleted path)
        let currentAncestorId = newParentId;
        let sanity = 0;
        while (currentAncestorId && sanity < (MAX_SOURCE_DEPTH + 2)) {
            if (currentAncestorId === docId) { alert("循環参照です。この親経路設定はできません。"); return; }
            const ancestor = allSources.find(s => s.id === currentAncestorId);
            currentAncestorId = ancestor ? (ancestor.parentId || "") : "";
            sanity++;
        }
    }

    // Check depth constraints for the entire subtree being moved
    const originalNodeDepth = originalSource.depth !== undefined ? originalSource.depth : 0;
    const maxAbsoluteDepthInSubtree = getMaxDepthOfSubtree(docId, allSources); // Uses non-deleted sources
    const depthChangeOfRoot = newDepth - originalNodeDepth;
    const newMaxDepthOfSubtree = maxAbsoluteDepthInSubtree + depthChangeOfRoot;

    if (newMaxDepthOfSubtree > MAX_SOURCE_DEPTH) {
        alert(`この移動を行うと、経路の階層が${MAX_SOURCE_DEPTH + 1}階層を超えてしまいます (${newMaxDepthOfSubtree + 1}階層になる)。`);
        return;
    }

    const dataToUpdate = {
        name: newName,
        parentId: newParentId || "",
        depth: newDepth,
        updatedAt: serverTimestamp() // Update timestamp
    };

    if (newDisplayString) {
        dataToUpdate.displayString = newDisplayString;
    } else {
        dataToUpdate.displayString = deleteField(); // Remove if empty
    }

    try {
        const batch = writeBatch(dbInstance);
        batch.update(doc(dbInstance, 'item_sources', docId), dataToUpdate);
        // Recursively update depths of descendants
        await updateDescendantDepthsRecursive(docId, newDepth, allSources, batch); // Pass non-deleted sources
        await batch.commit();
        closeModal('editItemSourceModal');
    } catch (error) { console.error("[ItemSource Manager] Error saving edit:", error); alert(`入手経路の更新に失敗しました: ${error.message}`); }
}


// updateDescendantDepthsRecursive remains largely the same, operates on filtered cache
async function updateDescendantDepthsRecursive(parentId, parentNewDepth, allSources, batch) {
    // allSources is already filtered for non-deleted
    const children = allSources.filter(s => s.parentId === parentId);
    for (const child of children) {
        const childNewDepth = parentNewDepth + 1;
        if (childNewDepth > MAX_SOURCE_DEPTH) { // This check is critical
            console.error(`Depth limit exceeded for child ${child.id} (new depth ${childNewDepth}). Aborting descendant update for this branch.`);
            throw new Error(`移動できません。子孫経路 ${child.name} の階層が${MAX_SOURCE_DEPTH + 1}を超えます。`);
        }
        const childUpdateData = { depth: childNewDepth, updatedAt: serverTimestamp() }; // Update timestamp for children too
        batch.update(doc(dbInstance, 'item_sources', child.id), childUpdateData);
        await updateDescendantDepthsRecursive(child.id, childNewDepth, allSources, batch);
    }
}

// getMaxDepthOfSubtree remains largely the same, operates on filtered cache
function getMaxDepthOfSubtree(rootId, allSources) {
    // allSources is assumed to be non-deleted
    let maxAbsDepth = -1;
    const rootNode = allSources.find(s => s.id === rootId);
    if (!rootNode) return -1; // Should not happen if rootId is valid

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


async function logicalDeleteItemSourceNode(docId, nodeName) {
    const allSources = getItemSourcesFuncCache(); // Assumes non-deleted
    const itemsCacheData = getItemsFuncCache(); // Assumes non-deleted

    // Check for active (non-deleted) children
    const children = allSources.filter(s => s.parentId === docId);
    if (children.length > 0) {
        alert(`経路「${nodeName}」は、アクティブな子経路の親として使用されているため論理削除できません。先に子経路を削除するか、別の親経路に移動してください。`); 
        return;
    }

    // Check if used by any non-deleted items
    const itemsUsingSource = itemsCacheData.filter(item => {
        // Check new 'sources' array format
        if (item.sources && Array.isArray(item.sources)) {
            return item.sources.some(s => s.type === 'tree' && s.nodeId === docId);
        }
        // Fallback for old 'sourceNodeId' field if necessary, though ideally data is migrated
        return item.sourceNodeId === docId; 
    });

    if (itemsUsingSource.length > 0) {
        alert(`経路「${nodeName}」は ${itemsUsingSource.length} 個のアクティブなアイテムで使用されているため、論理削除できません。先にアイテムの入手経路を変更してください。`); 
        return;
    }

    if (confirm(`入手経路「${nodeName}」を論理削除しますか？\nこの経路は一覧などには表示されなくなりますが、データは残ります。`)) {
        try {
            await updateDoc(doc(dbInstance, 'item_sources', docId), {
                isDeleted: true,
                updatedAt: serverTimestamp() // Update timestamp
            });
            
            if (DOMISM.editItemSourceModal.style.display !== 'none' && DOMISM.editingItemSourceDocIdInput.value === docId) {
                closeModal('editItemSourceModal');
            }
        } catch (error) { console.error("[ItemSource Manager] Error logically deleting node:", error); alert("入手経路の論理削除に失敗しました。"); }
    }
}

// populateItemSourceLevelButtons remains largely the same, operates on filtered cache for display
export function populateItemSourceLevelButtons(parentId, level, containerElement, pathDisplayElement, tempNodeIdInputElement, currentSelectedPath = [], initialSelectedNodeId = null, finalSourceDisplayPreviewElement = null) {
    if (!containerElement || !pathDisplayElement || !tempNodeIdInputElement) {
        console.error("populateItemSourceLevelButtons: Required DOM elements for item form UI not found.");
        return;
    }
    if (!finalSourceDisplayPreviewElement) {
        console.warn("populateItemSourceLevelButtons: finalSourceDisplayPreviewElement is not provided. Preview will not be updated.");
    }

    // Remove subsequent level containers
    let levelContainer = containerElement.querySelector(`.source-level-container[data-level="${level}"]`);
    if (levelContainer) {
        let sibling = levelContainer.nextElementSibling;
        while(sibling && sibling.classList.contains('source-level-container')) {
            let toRemove = sibling;
            sibling = sibling.nextElementSibling;
            toRemove.remove();
        }
        levelContainer.innerHTML = ''; // Clear current level container
    } else {
        levelContainer = document.createElement('div');
        levelContainer.className = 'source-level-container';
        levelContainer.dataset.level = level;
        levelContainer.style.marginBottom = '10px';
        if (level > 1) levelContainer.style.paddingLeft = `${(level - 1) * 15}px`;
        containerElement.appendChild(levelContainer);
    }

    const allSources = getItemSourcesFuncCache(); // Assumes non-deleted
    const children = allSources
        .filter(s => (s.parentId || "") === (parentId || "") && (s.depth !== undefined && s.depth === level - 1)) // Match depth
        .sort((a, b) => a.name.localeCompare(b.name, 'ja'));

    const addTreeSourceBtn = document.getElementById('addTreeSourceToListButton'); // In item-manager

    if (children.length === 0) {
        // If this level has no children, the parentId (if selected) is a terminal node for this branch
        if (parentId && tempNodeIdInputElement.value === parentId && addTreeSourceBtn) {
            addTreeSourceBtn.disabled = false; // Enable add button if a parent was selected and it has no children
        } else if (addTreeSourceBtn) {
             addTreeSourceBtn.disabled = true; // Disable if no selection or non-terminal
        }
        if(level === 1 && levelContainer && children.length === 0) levelContainer.innerHTML = '<p style="font-style:italic; color:#777;">この階層に経路がありません。</p>';
        // Update preview if a node is selected
        if (finalSourceDisplayPreviewElement && tempNodeIdInputElement.value) {
             const finalDisplay = buildDisplayPathForSourceNode(tempNodeIdInputElement.value, allSources);
             finalSourceDisplayPreviewElement.value = finalDisplay;
        } else if (finalSourceDisplayPreviewElement) {
            finalSourceDisplayPreviewElement.value = ''; // Clear preview if no node selected
        }
        return;
    }
    if(addTreeSourceBtn) addTreeSourceBtn.disabled = true; // Children exist, so disable add button until a terminal one is picked
    if (finalSourceDisplayPreviewElement) {
        finalSourceDisplayPreviewElement.value = ''; // Clear preview as current selection is not terminal
    }


    children.forEach(child => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'category-select-button item-source-select-button'; // Common class for styling
        button.textContent = child.name;
        if (child.displayString) {
            button.title = `表示名: ${child.displayString}`; // Tooltip for displayString
        }
        button.dataset.nodeId = child.id;
        button.dataset.nodeName = child.name; // Store name for path building

        button.addEventListener('click', () => {
            // Deactivate other buttons in the same level
            levelContainer.querySelectorAll('.item-source-select-button.active').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            tempNodeIdInputElement.value = child.id; // Set the temp ID

            // Build path display
            const newPath = [...currentSelectedPath.slice(0, level - 1), child.name];
            pathDisplayElement.value = newPath.join(' > ');

            // Check if this newly selected node has children itself
            const hasGrandChildren = allSources.some(s => s.parentId === child.id);
            if (addTreeSourceBtn) addTreeSourceBtn.disabled = hasGrandChildren; // Enable add button only if it's a terminal node

            if (finalSourceDisplayPreviewElement) {
                const finalDisplay = buildDisplayPathForSourceNode(child.id, allSources);
                finalSourceDisplayPreviewElement.value = finalDisplay;
            }


            if (level < MAX_SOURCE_DEPTH + 1) { // Max depth for nodes (0 to MAX_SOURCE_DEPTH)
                 populateItemSourceLevelButtons(child.id, level + 1, containerElement, pathDisplayElement, tempNodeIdInputElement, newPath, null, finalSourceDisplayPreviewElement);
            }
        });
        levelContainer.appendChild(button);

        // If an initialSelectedNodeId is provided and matches, click it to pre-select the path
        if (initialSelectedNodeId && child.id === initialSelectedNodeId) {
            button.click(); // This will trigger its event listener
        }
    });
}


// buildDisplayPathForSourceNode and buildFullPathForSourceNode remain the same, operate on filtered cache
export function buildDisplayPathForSourceNode(nodeId, allItemSources) {
    // allItemSources is assumed to be non-deleted
    if (!nodeId || !allItemSources || allItemSources.length === 0) {
        return "経路情報なし";
    }
    const node = allItemSources.find(s => s.id === nodeId);
    if (!node) {
        return `経路不明 (ID: ${nodeId.substring(0,5)}...)`;
    }

    // If displayString exists and is not empty, use it. Otherwise, use the node's name.
    if (node.displayString && node.displayString.trim() !== "") {
        return node.displayString.trim();
    }
    // If no displayString, just use the node name. 
    // The full path is constructed by buildFullPathForSourceNode if needed.
    return node.name; 
}

export function buildFullPathForSourceNode(nodeId, allItemSources) {
    // allItemSources is assumed to be non-deleted
    if (!nodeId || !allItemSources || allItemSources.length === 0) {
        return "経路情報なし";
    }

    const pathParts = [];
    let currentId = nodeId;
    let sanityCheck = 0;
    const maxDepthIterations = MAX_SOURCE_DEPTH + 2; // Safety for loop

    while(currentId && sanityCheck < maxDepthIterations) { 
        const node = allItemSources.find(s => s.id === currentId);
        if (node) {
            pathParts.unshift(node.name); // Add current node's name to the beginning
            currentId = node.parentId;    // Move to parent
        } else {
            pathParts.unshift(`[ID:${currentId.substring(0,5)}...]`); // Parent not found (should not happen in clean data)
            break; // Stop if path is broken
        }
        sanityCheck++;
    }
    return pathParts.join(' > ');
}
