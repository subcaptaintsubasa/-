// js/admin-modules/effect-super-category-manager.js
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, where, writeBatch, deleteField } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { openModal as openAdminModal, closeModal as closeAdminModal, populateTagButtonSelector, getSelectedTagButtonValues, openEnlargedListModal } from './ui-helpers.js'; // openEnlargedListModal をインポート

const DOMESC = {
    newEffectSuperCategoryNameInput: null,
    addEffectSuperCategoryButton: null,
    effectSuperCategoryListContainer: null,
    enlargeEffectSuperCategoryListButton: null, // ★★★ 追加 ★★★
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

export function initEffectSuperCategoryManager(dependencies) {
    dbInstance = dependencies.db;
    getEffectTypesFuncCache = dependencies.getEffectTypes;
    refreshAllDataCallback = dependencies.refreshAllData;

    DOMESC.newEffectSuperCategoryNameInput = document.getElementById('newEffectSuperCategoryName');
    DOMESC.addEffectSuperCategoryButton = document.getElementById('addEffectSuperCategoryButton');
    DOMESC.effectSuperCategoryListContainer = document.getElementById('effectSuperCategoryListContainer');
    DOMESC.enlargeEffectSuperCategoryListButton = document.getElementById('enlargeEffectSuperCategoryListButton'); // ★★★ 取得 ★★★

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
            const name = DOMESC.editingNameInput.value;
            if (docId) {
                deleteEffectSuperCategory(docId, name);
            }
        });
    }

    if (DOMESC.effectSuperCategoryListContainer) {
        DOMESC.effectSuperCategoryListContainer.addEventListener('click', handleListClick);
    }
    // ★★★ 拡大ボタンのイベントリスナー ★★★
    if (DOMESC.enlargeEffectSuperCategoryListButton) {
        DOMESC.enlargeEffectSuperCategoryListButton.addEventListener('click', () => {
            openEnlargedListModal(
                "効果大分類一覧 (拡大)",
                (container) => {
                    const listContent = buildEffectSuperCategoryListDOMForEnlargement(true);
                    if (listContent) {
                        container.appendChild(listContent);
                    } else {
                        container.innerHTML = '<p>表示する効果大分類がありません。</p>';
                    }
                }
            );
        });
    }
    console.log("[Effect Super Category Manager] Initialized.");
}

// ★★★ 効果大分類リストのDOMを生成する共通関数 ★★★
function buildEffectSuperCategoryListDOMForEnlargement(isEnlargedView = false) {
    const superCategoriesCache = getEffectSuperCategoriesFuncCache();
    // 現状、検索機能はないので、常に全件表示
    if (!superCategoriesCache || superCategoriesCache.length === 0) {
        const p = document.createElement('p');
        p.textContent = '効果大分類が登録されていません。';
        return p;
    }

    const ul = document.createElement('ul');
    ul.className = 'entity-list';
    const sortedSuperCategories = [...superCategoriesCache].sort((a, b) => a.name.localeCompare(b.name, 'ja'));

    sortedSuperCategories.forEach(sc => {
        const li = document.createElement('li');
        li.classList.add('list-item');
        
        const nameSpan = document.createElement('span');
        nameSpan.classList.add('list-item-name-clickable');
        nameSpan.textContent = sc.name;
        if (!isEnlargedView) {
            nameSpan.dataset.id = sc.id;
            nameSpan.dataset.action = "edit";
        }
        li.appendChild(nameSpan);

        if (!isEnlargedView) {
            const actionsDiv = document.createElement('div');
            actionsDiv.classList.add('list-item-actions');
            li.appendChild(actionsDiv);
        }
        ul.appendChild(li);
    });
    return ul;
}


export function _renderEffectSuperCategoriesForManagementInternal(superCategoriesCache) {
    // 引数でキャッシュを受け取るように変更 (admin-main.js から渡される)
    if (!DOMESC.effectSuperCategoryListContainer) return;
    getEffectSuperCategoriesFuncCache = () => superCategoriesCache; // ローカルのゲッターを更新

    DOMESC.effectSuperCategoryListContainer.innerHTML = '';
    const listContent = buildEffectSuperCategoryListDOMForEnlargement(false); // 通常表示
    if (listContent) {
        DOMESC.effectSuperCategoryListContainer.appendChild(listContent);
    }
    // メッセージは buildEffectSuperCategoryListDOMForEnlargement 内で処理
    console.log("[Effect Super Category Manager] List rendered.");
}


function handleListClick(event) {
    // (この関数は変更なし)
    const target = event.target;
    const clickableName = target.closest('.list-item-name-clickable[data-id]');
    if (clickableName && clickableName.dataset.action === 'edit') {
        openEditModalById(clickableName.dataset.id);
    }
}

async function addEffectSuperCategory() {
    // (この関数は変更なし)
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

function openEditModalById(docId) {
    // (この関数は変更なし、ただし populateTagButtonSelector の呼び出しを修正)
    const superCategory = getEffectSuperCategoriesFuncCache().find(sc => sc.id === docId);
    if (superCategory && DOMESC.editingDocIdInput && DOMESC.editingNameInput && DOMESC.editModal && DOMESC.editingEffectTypesSelector) {
        DOMESC.editingDocIdInput.value = superCategory.id;
        DOMESC.editingNameInput.value = superCategory.name;
        const allEffectTypes = getEffectTypesFuncCache();
        const effectTypesInThisSuperCat = allEffectTypes.filter(et => et.superCategoryId === docId).map(et => et.id);
        const effectTypeOptionsForButtons = allEffectTypes.map(et => ({ id: et.id, name: et.name }))
                                                    .sort((a,b) => a.name.localeCompare(b.name, 'ja'));
        populateTagButtonSelector(DOMESC.editingEffectTypesSelector, effectTypeOptionsForButtons, effectTypesInThisSuperCat, 'effectTypeId'); // ★★★ dataAttributeName を修正 ★★★
        openAdminModal('editEffectSuperCategoryModal');
        DOMESC.editingNameInput.focus();
    } else {
        alert("編集する効果大分類が見つかりません。");
    }
}

async function saveEffectSuperCategoryEdit() {
    // (この関数は変更なし、ただし getSelectedTagButtonValues の呼び出しを修正)
    const docId = DOMESC.editingDocIdInput.value;
    const newName = DOMESC.editingNameInput.value.trim();
    if (!newName) { alert("効果はい、承知いたしました。
では、残りの管理モーダル（効果大分類、効果種類、キャラクター基礎情報オプション）に一覧拡大表示機能を追加するためのJavaScriptの修正案を提示します。

CSSファイル (`admin-lists.css`) は、前回カテゴリ管理モーダルとタグ管理モーダル用に修正した `.button-like-icon` スタイルがそのまま適用されるため、今回は変更ありません。

---

**修正対象ファイル:**

*   `main/js/admin-modules/effect-super-category-manager.js`
*   `main/js/admin-modules/effect-type-manager.js`
*   `main/js/admin-modules/char-base-manager.js`

---

**1. `main/js/admin-modules/effect-super-category-manager.js` の修正案 (全文):**

```javascript
// js/admin-modules/effect-super-category-manager.js
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, where, writeBatch, deleteField } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { openModal as openAdminModal, closeModal as closeAdminModal, populateTagButtonSelector, getSelectedTagButtonValues, openEnlargedListModal } from './ui-helpers.js';

const DOMESC = {
    newEffectSuperCategoryNameInput: null,
    addEffectSuperCategoryButton: null,
    effectSuperCategoryListContainer: null,
    enlargeEffectSuperCategoryListButton: null, // ★★★ 追加 ★★★
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

export function initEffectSuperCategoryManager(dependencies) {
    dbInstance = dependencies.db;
    getEffectTypesFuncCache = dependencies.getEffectTypes;
    refreshAllDataCallback = dependencies.refreshAllData;

    DOMESC.newEffectSuperCategoryNameInput = document.getElementById('newEffectSuperCategoryName');
    DOMESC.addEffectSuperCategoryButton = document.getElementById('addEffectSuperCategoryButton');
    DOMESC.effectSuperCategoryListContainer = document.getElementById('effectSuperCategoryListContainer');
    DOMESC.enlargeEffectSuperCategoryListButton = document.getElementById('enlargeEffectSuperCategoryListButton'); // ★★★ 取得 ★★★

    DOMESC.editModal = document.getElementById('editEffectSuperCategoryModal');
    DOMESC.editingDocIdInput = document.getElementById('editingEffectSuperCategoryDocId');
    DOMESC.editingNameInput = document.getElementById('editingEffectSuperCategoryName');
    DOMESC.editingEffectTypesSelector = document.getElementById('editingSuperCategoryEffectTypesSelector');
    DOMESC.saveEditButton = document.getElementById('saveEffectSuperCategoryEditButton');
    DOMESC.deleteFromEditModalButton = document大分類名は空にできません。"); return; }
    const currentSuperCategories = getEffectSuperCategoriesFuncCache();
    if (currentSuperCategories.some(sc => sc.id !== docId && sc.name.toLowerCase() === newName.toLowerCase())) {
        alert("編集後の名前が他の効果大分類と重複します。"); return;
    }
    const selectedEffectTypeIds = getSelectedTagButtonValues(DOMESC.editingEffectTypesSelector, 'effectTypeId'); // ★★★ dataAttributeName を修正 ★★★
    try {
        const batch = writeBatch(dbInstance);
        batch.update(doc(dbInstance, 'effect_super_categories', docId), { name: newName, updatedAt: serverTimestamp() });
        const allEffectTypes = getEffectTypesFuncCache();
        allEffectTypes.forEach(et => {
            const effectTypeRef = doc(dbInstance, 'effect_types', et.id);
            const isCurrentlySelected = selectedEffectTypeIds.includes(et.id);
            const wasPreviouslyAssigned = et.superCategoryId === docId;
            if (isCurrentlySelected && !wasPreviouslyAssigned) {
                batch.update(effectTypeRef, { superCategoryId: docId });
            } else if (!isCurrentlySelected && wasPreviouslyAssigned) {
                batch.update(effectTypeRef, { superCategoryId: null });
            }
        });
        await batch.commit();
        closeAdminModal('editEffectSuperCategoryModal');
        await refreshAllDataCallback();
    } catch (error) {
        console.error("[Effect Super Category Manager] Error updating:", error);
        alert("効果大分類の更新または関連する効果種類の更新に失敗しました。");
    }
}

async function deleteEffectSuperCategory(docId, name) {
    // (この関数は変更なし)
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
