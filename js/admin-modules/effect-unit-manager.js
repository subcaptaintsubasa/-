// js/admin-modules/effect-unit-manager.js
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { openModal, closeModal, openEnlargedListModal } from './ui-helpers.js';

const DOMEU = { // ★★★ 変数名を DOMEU に統一 ★★★
    newEffectUnitNameInput: null,
    addEffectUnitButton: null,
    effectUnitListContainer: null,
    enlargeEffectUnitListButton: null,
    editEffectUnitModal: null,
    editingEffectUnitDocIdInput: null,
    editingEffectUnitNameInput: null,
    saveEffectUnitEditButton: null,
    deleteEffectUnitFromEditModalButton: null,
    manageUnitsForNewEffectTypeButton: null, // これらは effect-type-manager 側で制御されるべきだったかもしれません
    manageUnitsForEditingEffectTypeButton: null, // 同上。一旦残しますが、関連ロジックを確認。
};

let dbInstance = null;
let getEffectUnitsFuncCache = () => [];
let getEffectTypesFuncCache = () => [];
let getItemsFuncCache = () => [];
let getCharacterBasesFuncCache = () => ({});
let refreshAllDataCallback = async () => {};

export function initEffectUnitManager(dependencies) {
    dbInstance = dependencies.db;
    getEffectUnitsFuncCache = dependencies.getEffectUnits;
    getEffectTypesFuncCache = dependencies.getEffectTypes;
    getItemsFuncCache = dependencies.getItems;
    getCharacterBasesFuncCache = dependencies.getCharacterBases;
    refreshAllDataCallback = dependencies.refreshAllData;

    // ★★★ ここから下の DOMET を DOMEU に修正 ★★★
    DOMEU.newEffectUnitNameInput = document.getElementById('newEffectUnitName');
    DOMEU.addEffectUnitButton = document.getElementById('addEffectUnitButton');
    DOMEU.effectUnitListContainer = document.getElementById('effectUnitListContainer');
    DOMEU.enlargeEffectUnitListButton = document.getElementById('enlargeEffectUnitListButton');

    DOMEU.editEffectUnitModal = document.getElementById('editEffectUnitModal');
    DOMEU.editingEffectUnitDocIdInput = document.getElementById('editingEffectUnitDocId');
    DOMEU.editingEffectUnitNameInput = document.getElementById('editingEffectUnitName');
    DOMEU.saveEffectUnitEditButton = document.getElementById('saveEffectUnitEditButton');
    DOMEU.deleteEffectUnitFromEditModalButton = document.getElementById('deleteEffectUnitFromEditModalButton');

    // manageUnitsFor... ボタンは effectTypeManagementModal にあるため、ここでは取得しない
    // DOMEU.manageUnitsForNewEffectTypeButton = document.getElementById('manageUnitsForNewEffectTypeButton');
    // DOMEU.manageUnitsForEditingEffectTypeButton = document.getElementById('manageUnitsForEditingEffectTypeButton');


    if (DOMEU.addEffectUnitButton) {
        DOMEU.addEffectUnitButton.addEventListener('click', addEffectUnit);
    }
    if (DOMEU.saveEffectUnitEditButton) {
        DOMEU.saveEffectUnitEditButton.addEventListener('click', saveEffectUnitEdit);
    }
    if (DOMEU.deleteEffectUnitFromEditModalButton) {
        DOMEU.deleteEffectUnitFromEditModalButton.addEventListener('click', () => {
            const unitId = DOMEU.editingEffectUnitDocIdInput.value;
            const unit = getEffectUnitsFuncCache().find(u => u.id === unitId);
            if (unitId && unit) {
                deleteEffectUnit(unitId, unit.name);
            } else {
                alert("削除対象の効果単位IDが見つかりません。");
            }
        });
    }

    if (DOMEU.effectUnitListContainer) {
        DOMEU.effectUnitListContainer.addEventListener('click', handleEffectUnitListClick);
    }

    if (DOMEU.enlargeEffectUnitListButton) {
        DOMEU.enlargeEffectUnitListButton.addEventListener('click', () => {
            openEnlargedListModal(
                "効果単位一覧 (拡大)",
                (container) => {
                    const listContent = buildEffectUnitListDOMForEnlargement(true);
                    if (listContent) {
                        container.appendChild(listContent);
                    } else {
                        container.innerHTML = '<p>表示する効果単位がありません。</p>';
                    }
                }
            );
        });
    }
    // manageUnitsFor... ボタンのリスナーは effect-type-manager.js で処理されるべき
    console.log("[Effect Unit Manager] Initialized.");
}

function buildEffectUnitListDOMForEnlargement(isEnlargedView = false) {
    const effectUnitsCache = getEffectUnitsFuncCache();

    if (!effectUnitsCache || effectUnitsCache.length === 0) {
        const p = document.createElement('p');
        p.textContent = '効果単位が登録されていません。「なし」は自動的に利用可能です。';
        return p;
    }

    const ul = document.createElement('ul');
    ul.className = 'entity-list';
    const sortedUnits = [...effectUnitsCache].sort((a,b) => a.name.localeCompare(b.name, 'ja'));

    sortedUnits.forEach(unit => {
        const li = document.createElement('li');
        li.classList.add('list-item');

        const nameSpan = document.createElement('span');
        nameSpan.classList.add('list-item-name-clickable');
        nameSpan.textContent = unit.name;
        if (!isEnlargedView) {
            nameSpan.dataset.id = unit.id;
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


export function _renderEffectUnitsForManagementInternal() {
    if (!DOMEU.effectUnitListContainer) return; // ★★★ DOMEU を使用 ★★★
    DOMEU.effectUnitListContainer.innerHTML = '';

    const listContent = buildEffectUnitListDOMForEnlargement(false);
    if (listContent) {
        DOMEU.effectUnitListContainer.appendChild(listContent); // ★★★ DOMEU を使用 ★★★
    }
    console.log("[Effect Unit Manager] Effect units rendered for management.");
}


function handleEffectUnitListClick(event) {
    const target = event.target;
    const clickableName = target.closest('.list-item-name-clickable[data-id]');
    if (clickableName && clickableName.dataset.action === 'edit') {
        openEditEffectUnitModalById(clickableName.dataset.id);
    }
}

async function addEffectUnit() {
    if (!DOMEU.newEffectUnitNameInput) return; // ★★★ DOMEU を使用 ★★★
    const name = DOMEU.newEffectUnitNameInput.value.trim(); // ★★★ DOMEU を使用 ★★★
    const effectUnitsCache = getEffectUnitsFuncCache();
    if (!name) { alert("効果単位名を入力してください。"); return; }
    if (name.toLowerCase() === "なし") { alert("「なし」は予約語であり、単位として登録できません。"); return; }
    if (effectUnitsCache.some(u => u.name.toLowerCase() === name.toLowerCase())) {
        alert("同じ名前の効果単位が既に存在します。"); return;
    }
    try {
        await addDoc(collection(dbInstance, 'effect_units'), { name: name, createdAt: serverTimestamp() });
        DOMEU.newEffectUnitNameInput.value = ''; // ★★★ DOMEU を使用 ★★★
        await refreshAllDataCallback();
    } catch (error) {
        console.error("[Effect Unit Manager] Error adding effect unit:", error);
        alert("効果単位の追加に失敗しました。");
    }
}

function openEditEffectUnitModalById(unitId) {
    const effectUnitsCache = getEffectUnitsFuncCache();
    const unitData = effectUnitsCache.find(u => u.id === unitId);
    if (unitData && DOMEU.editingEffectUnitDocIdInput && DOMEU.editingEffectUnitNameInput) { // ★★★ DOMEU を使用 ★★★
        DOMEU.editingEffectUnitDocIdInput.value = unitData.id; // ★★★ DOMEU を使用 ★★★
        DOMEU.editingEffectUnitNameInput.value = unitData.name; // ★★★ DOMEU を使用 ★★★
        openModal('editEffectUnitModal');
        DOMEU.editingEffectUnitNameInput.focus(); // ★★★ DOMEU を使用 ★★★
    } else {
        alert("編集する効果単位のデータが見つかりません。");
    }
}

async function saveEffectUnitEdit() {
    const id = DOMEU.editingEffectUnitDocIdInput.value; // ★★★ DOMEU を使用 ★★★
    const newName = DOMEU.editingEffectUnitNameInput.value.trim(); // ★★★ DOMEU を使用 ★★★
    const effectUnitsCache = getEffectUnitsFuncCache();
    if (!newName) { alert("効果単位名は空にできません。"); return; }
    if (newName.toLowerCase() === "なし") { alert("「なし」は予約語であり、単位として登録できません。"); return; }
    if (effectUnitsCache.some(u => u.id !== id && u.name.toLowerCase() === newName.toLowerCase())) {
        alert("編集後の名前が他の効果単位と重複します。"); return;
    }
    try {
        const oldUnitData = effectUnitsCache.find(u => u.id === id);
        const oldUnitName = oldUnitData ? oldUnitData.name : null;
        await updateDoc(doc(dbInstance, 'effect_units', id), { name: newName, updatedAt: serverTimestamp() });
        if (oldUnitName && oldUnitName !== newName) {
            console.log(`Effect unit name changed from "${oldUnitName}" to "${newName}". Dependent entities might need manual review or a more robust update mechanism if unit names are denormalized.`);
        }
        closeModal('editEffectUnitModal');
        await refreshAllDataCallback();
    } catch (error) {
        console.error("[Effect Unit Manager] Error updating effect unit:", error);
        alert("効果単位の更新に失敗しました。");
    }
}

async function deleteEffectUnit(id, name) {
    const effectTypesCache = getEffectTypesFuncCache();
    const usedByEffectType = effectTypesCache.find(et => et.defaultUnit === name);
    if (usedByEffectType) {
        alert(`効果単位「${name}」は効果種類「${usedByEffectType.name}」のデフォルト単位として使用されているため削除できません。`); return;
    }
    if (confirm(`効果単位「${name}」を削除しますか？この操作は元に戻せません。`)) {
        try {
            await deleteDoc(doc(dbInstance, 'effect_units', id));
            closeModal('editEffectUnitModal');
            await refreshAllDataCallback();
        } catch (error) {
            console.error("[Effect Unit Manager] Error deleting effect unit:", error);
            alert("効果単位の削除に失敗しました。");
        }
    }
}
