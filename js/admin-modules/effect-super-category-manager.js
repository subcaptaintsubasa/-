// js/admin-modules/effect-super-category-manager.js
import { collection, getDocs, addDoc, doc, updateDoc, query, orderBy, serverTimestamp, where, writeBatch, deleteField } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { openModal as openAdminModal, closeModal as closeAdminModal, populateTagButtonSelector, getSelectedTagButtonValues } from './ui-helpers.js';

const DOMESC = {
    newEffectSuperCategoryNameInput: null,
    addEffectSuperCategoryButton: null,
    effectSuperCategoryListContainer: null,
    enlargeEffectSuperCategoryListButton: null,
    editModal: null,
    editingDocIdInput: null,
    editingNameInput: null,
    editingEffectTypesSelector: null,
    saveEditButton: null,
    deleteFromEditModalButton: null,
};

let dbInstance = null;
let getEffectSuperCategoriesFuncCache = () => [];
let getEffectTypesFuncCache = () => [];
let refreshAllDataCallback = async () => {};
let openEnlargedListModalCallbackFromMain = (config) => { console.warn("openEnlargedListModalCallbackFromMain not set in ESCM");};


export function initEffectSuperCategoryManager(dependencies) {
    dbInstance = dependencies.db;
    getEffectSuperCategoriesFuncCache = dependencies.getEffectSuperCategories; // Assumes non-deleted
    getEffectTypesFuncCache = dependencies.getEffectTypes; // Assumes non-deleted
    refreshAllDataCallback = dependencies.refreshAllData;
    if (typeof dependencies.openEnlargedListModal === 'function') {
        openEnlargedListModalCallbackFromMain = dependencies.openEnlargedListModal;
    }

    DOMESC.newEffectSuperCategoryNameInput = document.getElementById('newEffectSuperCategoryName');
    DOMESC.addEffectSuperCategoryButton = document.getElementById('addEffectSuperCategoryButton');
    DOMESC.effectSuperCategoryListContainer = document.getElementById('effectSuperCategoryListContainer');
    DOMESC.enlargeEffectSuperCategoryListButton = document.getElementById('enlargeEffectSuperCategoryListButton');

    DOMESC.editModal = document.getElementById('editEffectSuperCategoryModal');
    DOMESC.editingDocIdInput = document.getElementById('editingEffectSuperCategoryDocId');
    DOMESC.editingNameInput = document.getElementById('editingEffectSuperCategoryName');
    DOMESC.editingEffectTypesSelector = document.getElementById('editingSuperCategoryEffectTypesSelector');
    DOMESC.saveEditButton = document.getElementById('saveEffectSuperCategoryEditButton');
    DOMESC.deleteFromEditModalButton = document.getElementById('deleteEffectSuperCategoryFromEditModalButton');

    if (DOMESC.addEffectSuperCategoryButton) {
        DOMESC.addEffectSuperCategoryButton.addEventListener('click', addEffectSuperCategory);
    }
    if (DOMESC.saveEditButton) {
        DOMESC.saveEditButton.addEventListener('click', saveEffectSuperCategoryEdit);
    }
    if (DOMESC.deleteFromEditModalButton) {
        DOMESC.deleteFromEditModalButton.addEventListener('click', () => {
            const docId = DOMESC.editingDocIdInput.value;
            const superCategory = getEffectSuperCategoriesFuncCache().find(sc => sc.id === docId);
            const name = superCategory ? superCategory.name : DOMESC.editingNameInput.value; 

            if (docId && name) {
                logicalDeleteEffectSuperCategory(docId, name); // Changed to logicalDelete
            } else if (!docId) {
                alert("削除対象の効果大分類IDが見つかりません。");
            } else {
                alert("削除対象の効果大分類名が不明です。");
            }
        });
    }

    if (DOMESC.effectSuperCategoryListContainer) {
        DOMESC.effectSuperCategoryListContainer.addEventListener('click', handleListClick);
    }
    if (DOMESC.enlargeEffectSuperCategoryListButton) {
        DOMESC.enlargeEffectSuperCategoryListButton.addEventListener('click', () => {
            if (typeof openEnlargedListModalCallbackFromMain === 'function') {
                openEnlargedListModalCallbackFromMain({
                    title: "効果大分類一覧 (拡大)",
                    sourceFn: getEffectSuperCategoriesFuncCache,
                    itemType: 'effectSuperCategory',
                    editFunction: openEditEffectSuperCategoryModalById,
                });
            }
        });
    }
    console.log("[Effect Super Category Manager] Initialized for logical delete.");
}

function buildEffectSuperCategoryListDOM(isEnlargedView = false) {
    const superCategoriesCache = getEffectSuperCategoriesFuncCache(); // Assumes non-deleted
    if (!superCategoriesCache || superCategoriesCache.length === 0) {
        const p = document.createElement('p');
        p.textContent = '効果大分類が登録されていません。';
        return p;
    }
    const listRoot = document.createDocumentFragment();
    const sortedSuperCategories = [...superCategoriesCache].sort((a, b) => a.name.localeCompare(b.name, 'ja'));

    sortedSuperCategories.forEach(sc => {
        const itemDiv = document.createElement('div');
        itemDiv.classList.add('list-item');
        const nameSpan = document.createElement('span');
        nameSpan.classList.add('list-item-name-clickable');
        nameSpan.textContent = sc.name;
        nameSpan.dataset.id = sc.id;
        if (!isEnlargedView) {
            nameSpan.dataset.action = "edit"; // For non-enlarged view, click on name edits
        }
        itemDiv.appendChild(nameSpan);
        listRoot.appendChild(itemDiv);
    });
    return listRoot;
}

export function _renderEffectSuperCategoriesForManagementInternal() {
    if (!DOMESC.effectSuperCategoryListContainer) return;
    DOMESC.effectSuperCategoryListContainer.innerHTML = '';
    const listContent = buildEffectSuperCategoryListDOM(false); // false for normal management view
    if (listContent && (listContent.childNodes.length > 0 || listContent.nodeName === 'P')) {
        DOMESC.effectSuperCategoryListContainer.appendChild(listContent);
    } else {
        DOMESC.effectSuperCategoryListContainer.innerHTML = '<p>効果大分類が登録されていません。</p>';
    }
}

function handleListClick(event) {
    const target = event.target;
    // Ensure click is on the name part and has action=edit for non-enlarged view
    const clickableName = target.closest('.list-item-name-clickable[data-id][data-action="edit"]');
    if (clickableName) {
        openEditEffectSuperCategoryModalById(clickableName.dataset.id);
    }
}

async function addEffectSuperCategory() {
    if (!DOMESC.newEffectSuperCategoryNameInput) return;
    const name = DOMESC.newEffectSuperCategoryNameInput.value.trim();
    if (!name) { alert("効果大分類名を入力してください。"); return; }

    const currentSuperCategories = getEffectSuperCategoriesFuncCache(); // Assumes non-deleted
    // Check for duplicates among non-deleted super categories
    if (currentSuperCategories.some(sc => sc.name.toLowerCase() === name.toLowerCase())) {
        alert("同じ名前の効果大分類が既に存在します。"); return;
    }
    try {
        await addDoc(collection(dbInstance, 'effect_super_categories'), { 
            name: name, 
            isDeleted: false, // New ones are not deleted
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp() // Add updatedAt
        });
        DOMESC.newEffectSuperCategoryNameInput.value = '';
        await refreshAllDataCallback();
    } catch (error) {
        console.error("[Effect Super Category Manager] Error adding:", error);
        alert("効果大分類の追加に失敗しました。");
    }
}

export function openEditEffectSuperCategoryModalById(docId) {
    const superCategory = getEffectSuperCategoriesFuncCache().find(sc => sc.id === docId); // Assumes non-deleted
    if (!superCategory) {
        alert("編集する効果大分類が見つかりません。");
        return;
    }
    if (DOMESC.editModal && DOMESC.editingDocIdInput && DOMESC.editingNameInput && DOMESC.editingEffectTypesSelector) {
        DOMESC.editingDocIdInput.value = superCategory.id;
        DOMESC.editingNameInput.value = superCategory.name;

        const allEffectTypes = getEffectTypesFuncCache() || []; // Assumes non-deleted
        // Find effect types that currently belong to this super category
        const effectTypesInThisSuperCat = allEffectTypes.filter(et => et.superCategoryId === docId).map(et => et.id);
        
        // Prepare options for the button selector: all non-deleted effect types
        const effectTypeOptionsForButtons = allEffectTypes.map(et => ({ id: et.id, name: et.name }))
                                                    .sort((a,b) => a.name.localeCompare(b.name, 'ja'));
                                                    
        populateTagButtonSelector(DOMESC.editingEffectTypesSelector, effectTypeOptionsForButtons, effectTypesInThisSuperCat);
        
        openAdminModal('editEffectSuperCategoryModal');
        if (DOMESC.editingNameInput) DOMESC.editingNameInput.focus();
    } else {
        console.error("Edit modal elements for Effect Super Category not found or not ready.");
        alert("編集モーダルの準備ができていません。");
    }
}

async function saveEffectSuperCategoryEdit() {
    const docId = DOMESC.editingDocIdInput.value;
    const newName = DOMESC.editingNameInput.value.trim();
    if (!newName) {
        alert("効果大分類名は空にできません。");
        return;
    }
    const currentSuperCategories = getEffectSuperCategoriesFuncCache(); // Assumes non-deleted
    if (currentSuperCategories.some(sc => sc.id !== docId && sc.name.toLowerCase() === newName.toLowerCase())) {
        alert("編集後の名前が他の効果大分類と重複します。");
        return;
    }

    const selectedEffectTypeIds = getSelectedTagButtonValues(DOMESC.editingEffectTypesSelector);

    try {
        const batch = writeBatch(dbInstance);
        // Update the super category itself
        batch.update(doc(dbInstance, 'effect_super_categories', docId), {
            name: newName,
            updatedAt: serverTimestamp() // Update timestamp
        });

        const allEffectTypes = getEffectTypesFuncCache() || []; // Assumes non-deleted
        allEffectTypes.forEach(et => {
            const effectTypeRef = doc(dbInstance, 'effect_types', et.id);
            const isCurrentlySelected = selectedEffectTypeIds.includes(et.id);
            const wasPreviouslyAssigned = et.superCategoryId === docId;

            if (isCurrentlySelected && !wasPreviouslyAssigned) {
                // Assign this superCategory to the effect type
                batch.update(effectTypeRef, { superCategoryId: docId, updatedAt: serverTimestamp() });
            } else if (!isCurrentlySelected && wasPreviouslyAssigned) {
                // Unassign this superCategory from the effect type
                batch.update(effectTypeRef, { superCategoryId: deleteField(), updatedAt: serverTimestamp() });
            }
        });

        await batch.commit();
        closeAdminModal('editEffectSuperCategoryModal');
        document.dispatchEvent(new CustomEvent('adminEditModalClosed', { detail: { modalId: 'editEffectSuperCategoryModal' } }));
        await refreshAllDataCallback();
    } catch (error) {
        console.error("[Effect Super Category Manager] Error updating:", error);
        alert("効果大分類の更新または関連する効果種類の更新に失敗しました。");
    }
}

async function logicalDeleteEffectSuperCategory(docId, name) {
    const effectTypes = getEffectTypesFuncCache() || []; // Assumes non-deleted
    // Check if any *non-deleted* effect types are using this super category
    const usedByEffectTypes = effectTypes.filter(et => et.superCategoryId === docId);

    if (usedByEffectTypes.length > 0) {
        const usedByTypeNames = usedByEffectTypes.map(et => et.name).join(', ');
        alert(`効果大分類「${name}」は効果種類「${usedByTypeNames}」で使用されているため、論理削除できません。\n先にこれらの効果種類からこの大分類の割り当てを解除してください。`);
        return;
    }

    if (confirm(`効果大分類「${name}」を論理削除しますか？\nこの大分類は一覧などには表示されなくなりますが、データは残ります。`)) {
        try {
            await updateDoc(doc(dbInstance, 'effect_super_categories', docId), {
                isDeleted: true,
                updatedAt: serverTimestamp() // Update timestamp
            });
            
            if (DOMESC.editModal.style.display !== 'none' && DOMESC.editingDocIdInput.value === docId) {
                closeAdminModal('editEffectSuperCategoryModal');
            }
            document.dispatchEvent(new CustomEvent('adminEditModalClosed', { detail: { modalId: 'editEffectSuperCategoryModal' } }));
            await refreshAllDataCallback();
        } catch (error) {
            console.error("[Effect Super Category Manager] Error logically deleting:", error);
            alert("効果大分類の論理削除に失敗しました。");
        }
    }
}
