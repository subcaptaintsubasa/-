// js/admin-modules/effect-super-category-manager.js
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, where, writeBatch, deleteField } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { openModal as openAdminModal, closeModal as closeAdminModal, populateTagButtonSelector, getSelectedTagButtonValues } from './ui-helpers.js';

const DOMESC = {
    newEffectSuperCategoryNameInput: null,
    addEffectSuperCategoryButton: null,
    effectSuperCategoryListContainer: null,
    editModal: null,
    editingDocIdInput: null,
    editingNameInput: null,
    editingEffectTypesSelector: null, // ★★★ 追加: 効果種類選択エリア ★★★
    saveEditButton: null,
    deleteFromEditModalButton: null,
};

let dbInstance = null;
let getEffectSuperCategoriesFuncCache = () => [];
let getEffectTypesFuncCache = () => [];
let refreshAllDataCallback = async () => {};

export function initEffectSuperCategoryManager(dependencies) {
    dbInstance = dependencies.db;
    getEffectTypesFuncCache = dependencies.getEffectTypes;
    refreshAllDataCallback = dependencies.refreshAllData;
    // getEffectSuperCategoriesFuncCache は _render で設定

    DOMESC.newEffectSuperCategoryNameInput = document.getElementById('newEffectSuperCategoryName');
    DOMESC.addEffectSuperCategoryButton = document.getElementById('addEffectSuperCategoryButton');
    DOMESC.effectSuperCategoryListContainer = document.getElementById('effectSuperCategoryListContainer');

    DOMESC.editModal = document.getElementById('editEffectSuperCategoryModal');
    DOMESC.editingDocIdInput = document.getElementById('editingEffectSuperCategoryDocId');
    DOMESC.editingNameInput = document.getElementById('editingEffectSuperCategoryName');
    DOMESC.editingEffectTypesSelector = document.getElementById('editingSuperCategoryEffectTypesSelector'); // ★★★ 取得 ★★★
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
            const name = DOMESC.editingNameInput.value;
            if (docId) {
                deleteEffectSuperCategory(docId, name);
            }
        });
    }

    if (DOMESC.effectSuperCategoryListContainer) {
        DOMESC.effectSuperCategoryListContainer.addEventListener('click', handleListClick);
    }
    console.log("[Effect Super Category Manager] Initialized.");
}

export function _renderEffectSuperCategoriesForManagementInternal(superCategoriesCache) {
    if (!DOMESC.effectSuperCategoryListContainer) return;
    getEffectSuperCategoriesFuncCache = () => superCategoriesCache;

    DOMESC.effectSuperCategoryListContainer.innerHTML = '';
    if (!superCategoriesCache || superCategoriesCache.length === 0) {
        DOMESC.effectSuperCategoryListContainer.innerHTML = '<p>効果大分類が登録されていません。</p>';
        return;
    }

    const sortedSuperCategories = [...superCategoriesCache].sort((a, b) => a.name.localeCompare(b.name, 'ja'));

    sortedSuperCategories.forEach(sc => {
        const div = document.createElement('div');
        div.classList.add('list-item');
        div.innerHTML = `
            <span class="list-item-name-clickable" data-id="${sc.id}" data-action="edit">${sc.name}</span>
            <div class="list-item-actions">
            </div>
        `;
        DOMESC.effectSuperCategoryListContainer.appendChild(div);
    });
    console.log("[Effect Super Category Manager] List rendered.");
}

function handleListClick(event) {
    const target = event.target;
    const clickableName = target.closest('.list-item-name-clickable[data-id]');
    if (clickableName && clickableName.dataset.action === 'edit') {
        openEditModalById(clickableName.dataset.id);
    }
}

async function addEffectSuperCategory() {
    if (!DOMESC.newEffectSuperCategoryNameInput) return;
    const name = DOMESC.newEffectSuperCategoryNameInput.value.trim();
    if (!name) {
        alert("効果大分類名を入力してください。");
        return;
    }
    const currentSuperCategories = getEffectSuperCategoriesFuncCache();
    if (currentSuperCategories.some(sc => sc.name.toLowerCase() === name.toLowerCase())) {
        alert("同じ名前の効果大分類が既に存在します。");
        return;
    }

    try {
        await addDoc(collection(dbInstance, 'effect_super_categories'), {
            name: name,
            createdAt: serverTimestamp()
        });
        DOMESC.newEffectSuperCategoryNameInput.value = '';
        await refreshAllDataCallback();
    } catch (error) {
        console.error("[Effect Super Category Manager] Error adding:", error);
        alert("効果大分類の追加に失敗しました。");
    }
}

function openEditModalById(docId) {
    const superCategory = getEffectSuperCategoriesFuncCache().find(sc => sc.id === docId);
    if (superCategory && DOMESC.editingDocIdInput && DOMESC.editingNameInput && DOMESC.editModal && DOMESC.editingEffectTypesSelector) {
        DOMESC.editingDocIdInput.value = superCategory.id;
        DOMESC.editingNameInput.value = superCategory.name;

        // ★★★ 効果種類ボタンセレクタを生成・表示 ★★★
        const allEffectTypes = getEffectTypesFuncCache();
        const effectTypesInThisSuperCat = allEffectTypes.filter(et => et.superCategoryId === docId).map(et => et.id);
        
        // populateTagButtonSelector を流用するが、data属性を 'data-effect-type-id' にするなど、
        // または専用の populateEffectTypeButtonSelector 関数を作成する。
        // ここでは populateTagButtonSelector を使い、data属性は汎用的に扱えるようにする。
        const effectTypeOptionsForButtons = allEffectTypes.map(et => ({ id: et.id, name: et.name }))
                                                    .sort((a,b) => a.name.localeCompare(b.name, 'ja'));
        populateTagButtonSelector(DOMESC.editingEffectTypesSelector, effectTypeOptionsForButtons, effectTypesInThisSuperCat, 'effect-type-id');


        openAdminModal('editEffectSuperCategoryModal');
        DOMESC.editingNameInput.focus();
    } else {
        alert("編集する効果大分類が見つかりません。");
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

    // ★★★ 選択された効果種類IDを取得 ★★★
    const selectedEffectTypeIds = getSelectedTagButtonValues(DOMESC.editingEffectTypesSelector, 'effect-type-id');

    try {
        const batch = writeBatch(dbInstance);

        // 1. 効果大分類自体の名前を更新
        batch.update(doc(dbInstance, 'effect_super_categories', docId), {
            name: newName,
            updatedAt: serverTimestamp()
        });

        // 2. 効果種類の superCategoryId を更新
        const allEffectTypes = getEffectTypesFuncCache();
        allEffectTypes.forEach(et => {
            const effectTypeRef = doc(dbInstance, 'effect_types', et.id);
            const isCurrentlySelected = selectedEffectTypeIds.includes(et.id);
            const wasPreviouslyAssigned = et.superCategoryId === docId;

            if (isCurrentlySelected && !wasPreviouslyAssigned) {
                // 新しくこの大分類に割り当てられた
                batch.update(effectTypeRef, { superCategoryId: docId });
            } else if (!isCurrentlySelected && wasPreviouslyAssigned) {
                // この大分類から割り当てが解除された
                batch.update(effectTypeRef, { superCategoryId: null }); // または deleteField()
            }
        });

        await batch.commit();
        closeAdminModal('editEffectSuperCategoryModal');
        await refreshAllDataCallback(); // 全データ再読み込みとUI再描画
    } catch (error) {
        console.error("[Effect Super Category Manager] Error updating:", error);
        alert("効果大分類の更新または関連する効果種類の更新に失敗しました。");
    }
}

async function deleteEffectSuperCategory(docId, name) {
    const effectTypes = getEffectTypesFuncCache();
    const usedBy = effectTypes.find(et => et.superCategoryId === docId);
    
    if (usedBy) {
        alert(`効果大分類「${name}」は効果種類「${usedBy.name}」で使用されているため削除できません。先に効果種類からこの大分類の割り当てを解除してください。`);
        return;
    }

    if (confirm(`効果大分類「${name}」を削除しますか？この操作は元に戻せません。`)) {
        try {
            await deleteDoc(doc(dbInstance, 'effect_super_categories', docId));
            closeAdminModal('editEffectSuperCategoryModal');
            await refreshAllDataCallback();
        } catch (error) {
            console.error("[Effect Super Category Manager] Error deleting:", error);
            alert("効果大分類の削除に失敗しました。");
        }
    }
}
