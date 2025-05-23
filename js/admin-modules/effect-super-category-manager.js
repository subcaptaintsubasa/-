// js/admin-modules/effect-super-category-manager.js
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, writeBatch, deleteField } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { openModal as openAdminModal, closeModal as closeAdminModal, populateTagButtonSelector, getSelectedTagButtonValues } from './ui-helpers.js';
// openEnlargedListModal は admin-main.js から渡されるコールバックを使用

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
    getEffectSuperCategoriesFuncCache = dependencies.getEffectSuperCategories; // ★★★ 正しく取得 ★★★
    getEffectTypesFuncCache = dependencies.getEffectTypes;
    refreshAllDataCallback = dependencies.refreshAllData;
    if (typeof dependencies.openEnlargedListModal === 'function') { // ★★★ admin-main から渡されるコールバック ★★★
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
            const name = DOMESC.editingNameInput.value; // Get name from input as cache might not be updated yet
            if (docId) {
                // Find name from cache for confirmation if input is empty (should not happen)
                const currentName = name || (getEffectSuperCategoriesFuncCache().find(sc => sc.id === docId) || {}).name;
                deleteEffectSuperCategory(docId, currentName || "選択された大分類");
            } else {
                alert("削除対象の効果大分類IDが見つかりません。");
            }
        });
    }

    if (DOMESC.effectSuperCategoryListContainer) {
        DOMESC.effectSuperCategoryListContainer.addEventListener('click', handleListClick);
    }
    if (DOMESC.enlargeEffectSuperCategoryListButton) {
        DOMESC.enlargeEffectSuperCategoryListButton.addEventListener('click', () => {
            if (typeof openEnlargedListModalCallbackFromMain === 'function') {
                openEnlargedListModalCallbackFromMain({ // ★★★ admin-main の openEnlargedListModal に渡す設定オブジェクト ★★★
                    title: "効果大分類一覧 (拡大)",
                    sourceItems: getEffectSuperCategoriesFuncCache(), // 現在のキャッシュを渡す
                    itemType: 'effectSuperCategory',
                    // searchTermInputId: null, // このリストには専用検索がないため
                    editFunction: openEditEffectSuperCategoryModalById, // このマネージャーの編集関数
                    // displayRenderer は admin-main 側で itemType に応じて汎用的なものを使うか、
                    // このマネージャーから専用のレンダラを渡すこともできる。
                    // ここでは admin-main のデフォルトリストレンダラに任せる。
                });
            }
        });
    }
    console.log("[Effect Super Category Manager] Initialized.");
}

// This function now serves both regular list and can be adapted for enlarged view if needed by admin-main
// by passing its result to the enlarged modal's content area.
function buildEffectSuperCategoryListDOM(isEnlargedView = false) {
    const superCategoriesCache = getEffectSuperCategoriesFuncCache();
    if (!superCategoriesCache || superCategoriesCache.length === 0) {
        const p = document.createElement('p');
        p.textContent = '効果大分類が登録されていません。';
        return p; // Return a paragraph element directly
    }

    // Create a root UL or a DocumentFragment to hold list items
    const listRoot = document.createDocumentFragment(); // Use fragment to build efficiently

    const sortedSuperCategories = [...superCategoriesCache].sort((a, b) => a.name.localeCompare(b.name, 'ja'));

    sortedSuperCategories.forEach(sc => {
        const itemDiv = document.createElement('div'); // Each item as a div with class 'list-item'
        itemDiv.classList.add('list-item');

        const nameSpan = document.createElement('span');
        nameSpan.classList.add('list-item-name-clickable');
        nameSpan.textContent = sc.name;
        nameSpan.dataset.id = sc.id; // Always add data-id

        if (!isEnlargedView) { // For regular view, add data-action for direct click handling
            nameSpan.dataset.action = "edit";
        }
        // For enlarged view, click handling is attached in admin-main.js based on data-id

        itemDiv.appendChild(nameSpan);
        listRoot.appendChild(itemDiv);
    });
    return listRoot; // Return the fragment or the UL element
}

export function _renderEffectSuperCategoriesForManagementInternal() {
    if (!DOMESC.effectSuperCategoryListContainer) return;
    DOMESC.effectSuperCategoryListContainer.innerHTML = ''; // Clear previous content
    
    const listContent = buildEffectSuperCategoryListDOM(false); // false for regular view
    
    if (listContent.childNodes.length > 0) {
        DOMESC.effectSuperCategoryListContainer.appendChild(listContent);
    } else {
        // This case should be handled by buildEffectSuperCategoryListDOM returning a <p>
        DOMESC.effectSuperCategoryListContainer.appendChild(listContent); // Append the <p> element
    }
    // console.log("[Effect Super Category Manager] List rendered."); // Reduce logging
}

function handleListClick(event) {
    const target = event.target;
    // Ensure we are targeting the span that is clickable
    const clickableName = target.closest('.list-item-name-clickable[data-id][data-action="edit"]');
    if (clickableName) {
        openEditEffectSuperCategoryModalById(clickableName.dataset.id);
    }
}

async function addEffectSuperCategory() {
    if (!DOMESC.newEffectSuperCategoryNameInput) return;
    const name = DOMESC.newEffectSuperCategoryNameInput.value.trim();
    if (!name) { alert("効果大分類名を入力してください。"); return; }

    const currentSuperCategories = getEffectSuperCategoriesFuncCache();
    if (currentSuperCategories.some(sc => sc.name.toLowerCase() === name.toLowerCase())) {
        alert("同じ名前の効果大分類が既に存在します。"); return;
    }
    try {
        await addDoc(collection(dbInstance, 'effect_super_categories'), { name: name, createdAt: serverTimestamp() });
        DOMESC.newEffectSuperCategoryNameInput.value = '';
        await refreshAllDataCallback();
    } catch (error) {
        console.error("[Effect Super Category Manager] Error adding:", error);
        alert("効果大分類の追加に失敗しました。");
    }
}

// ★★★ EXPORTED for admin-main.js ★★★
export function openEditEffectSuperCategoryModalById(docId) {
    const superCategory = getEffectSuperCategoriesFuncCache().find(sc => sc.id === docId);
    if (!superCategory) {
        alert("編集する効果大分類が見つかりません。");
        return;
    }
    if (DOMESC.editModal && DOMESC.editingDocIdInput && DOMESC.editingNameInput && DOMESC.editingEffectTypesSelector) {
        DOMESC.editingDocIdInput.value = superCategory.id;
        DOMESC.editingNameInput.value = superCategory.name;
        
        const allEffectTypes = getEffectTypesFuncCache() || [];
        const effectTypesInThisSuperCat = allEffectTypes.filter(et => et.superCategoryId === docId).map(et => et.id);
        const effectTypeOptionsForButtons = allEffectTypes.map(et => ({ id: et.id, name: et.name }))
                                                    .sort((a,b) => a.name.localeCompare(b.name, 'ja'));
                                                    
        populateTagButtonSelector(DOMESC.editingEffectTypesSelector, effectTypeOptionsForButtons, effectTypesInThisSuperCat); // Removed 'effectTypeId' as it's default for this helper

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
    const currentSuperCategories = getEffectSuperCategoriesFuncCache();
    if (currentSuperCategories.some(sc => sc.id !== docId && sc.name.toLowerCase() === newName.toLowerCase())) {
        alert("編集後の名前が他の効果大分類と重複します。");
        return;
    }
    const selectedEffectTypeIds = getSelectedTagButtonValues(DOMESC.editingEffectTypesSelector); // Removed 'effectTypeId'
    try {
        const batch = writeBatch(dbInstance);
        batch.update(doc(dbInstance, 'effect_super_categories', docId), {
            name: newName,
            updatedAt: serverTimestamp()
        });
        const allEffectTypes = getEffectTypesFuncCache() || [];
        allEffectTypes.forEach(et => {
            const effectTypeRef = doc(dbInstance, 'effect_types', et.id);
            const isCurrentlySelected = selectedEffectTypeIds.includes(et.id);
            const wasPreviouslyAssigned = et.superCategoryId === docId;

            if (isCurrentlySelected && !wasPreviouslyAssigned) {
                // Assign to this super category
                batch.update(effectTypeRef, { superCategoryId: docId });
            } else if (!isCurrentlySelected && wasPreviouslyAssigned) {
                // Unassign from this super category
                batch.update(effectTypeRef, { superCategoryId: null }); // Or deleteField() if preferred
            }
        });
        await batch.commit();
        closeAdminModal('editEffectSuperCategoryModal');
        // Dispatch custom event when edit modal is closed
        document.dispatchEvent(new CustomEvent('adminEditModalClosed', { detail: { modalId: 'editEffectSuperCategoryModal' } }));
        await refreshAllDataCallback();
    } catch (error) {
        console.error("[Effect Super Category Manager] Error updating:", error);
        alert("効果大分類の更新または関連する効果種類の更新に失敗しました。");
    }
}

async function deleteEffectSuperCategory(docId, name) {
    const effectTypes = getEffectTypesFuncCache() || [];
    const usedBy = effectTypes.find(et => et.superCategoryId === docId);
    if (usedBy) {
        alert(`効果大分類「${name}」は効果種類「${usedBy.name}」で使用されているため削除できません。\n先に効果種類からこの大分類の割り当てを解除してください。`);
        return;
    }
    if (confirm(`効果大分類「${name}」を削除しますか？\nこの操作は元に戻せません。`)) {
        try {
            // Unassign this supercategory from any effect types (should be none due to check above, but as a safeguard)
            const batch = writeBatch(dbInstance);
            const typesToUpdateQuery = query(collection(dbInstance, 'effect_types'), where('superCategoryId', '==', docId));
            const typesSnapshot = await getDocs(typesToUpdateQuery);
            typesSnapshot.forEach(typeDoc => {
                batch.update(typeDoc.ref, { superCategoryId: null }); // or deleteField()
            });

            batch.delete(doc(dbInstance, 'effect_super_categories', docId));
            await batch.commit();
            
            if (DOMESC.editModal.style.display !== 'none' && DOMESC.editingDocIdInput.value === docId) {
                closeAdminModal('editEffectSuperCategoryModal');
            }
            // Dispatch custom event when edit modal is closed
            document.dispatchEvent(new CustomEvent('adminEditModalClosed', { detail: { modalId: 'editEffectSuperCategoryModal' } }));
            await refreshAllDataCallback();
        } catch (error) {
            console.error("[Effect Super Category Manager] Error deleting:", error);
            alert("効果大分類の削除に失敗しました。");
        }
    }
}
