// js/admin-modules/effect-unit-manager.js
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { openModal, closeModal } from './ui-helpers.js';

const DOMEU = {
    newEffectUnitNameInput: null,
    addEffectUnitButton: null,
    effectUnitListContainer: null,
    editEffectUnitModal: null,
    editingEffectUnitDocIdInput: null,
    editingEffectUnitNameInput: null,
    saveEffectUnitEditButton: null,
    deleteEffectUnitFromEditModalButton: null, // New delete button
    manageUnitsForNewEffectTypeButton: null,
    manageUnitsForEditingEffectTypeButton: null,
};

let dbInstance = null;
let getEffectUnitsFuncCache = () => [];
let getEffectTypesFuncCache = () => [];
let getItemsFuncCache = () => []; // For checking usage before delete
let getCharacterBasesFuncCache = () => ({}); // For checking usage before delete
let refreshAllDataCallback = async () => {};

export function initEffectUnitManager(dependencies) {
    dbInstance = dependencies.db;
    getEffectUnitsFuncCache = dependencies.getEffectUnits;
    getEffectTypesFuncCache = dependencies.getEffectTypes;
    getItemsFuncCache = dependencies.getItems;
    getCharacterBasesFuncCache = dependencies.getCharacterBases;
    refreshAllDataCallback = dependencies.refreshAllData;

    DOMEU.newEffectUnitNameInput = document.getElementById('newEffectUnitName');
    DOMEU.addEffectUnitButton = document.getElementById('addEffectUnitButton');
    DOMEU.effectUnitListContainer = document.getElementById('effectUnitListContainer');

    DOMEU.editEffectUnitModal = document.getElementById('editEffectUnitModal');
    DOMEU.editingEffectUnitDocIdInput = document.getElementById('editingEffectUnitDocId');
    DOMEU.editingEffectUnitNameInput = document.getElementById('editingEffectUnitName');
    DOMEU.saveEffectUnitEditButton = document.getElementById('saveEffectUnitEditButton');
    DOMEU.deleteEffectUnitFromEditModalButton = document.getElementById('deleteEffectUnitFromEditModalButton');

    DOMEU.manageUnitsForNewEffectTypeButton = document.getElementById('manageUnitsForNewEffectTypeButton');
    DOMEU.manageUnitsForEditingEffectTypeButton = document.getElementById('manageUnitsForEditingEffectTypeButton');


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
    
    // Event delegation for list item clicks
    if (DOMEU.effectUnitListContainer) {
        DOMEU.effectUnitListContainer.addEventListener('click', handleEffectUnitListClick);
    }

    // "単位管理" buttons in EffectType modals
    if (DOMEU.manageUnitsForNewEffectTypeButton) {
        DOMEU.manageUnitsForNewEffectTypeButton.addEventListener('click', () => {
            const effectUnitModal = document.getElementById('effectUnitManagementModal');
            if (effectUnitModal) {
                openModal('effectUnitManagementModal'); // Open the unit management modal
                // Optionally scroll to the add new unit form
                const newUnitInput = document.getElementById('newEffectUnitName');
                if(newUnitInput) newUnitInput.focus();
            }
        });
    }
    if (DOMEU.manageUnitsForEditingEffectTypeButton) {
        DOMEU.manageUnitsForEditingEffectTypeButton.addEventListener('click', () => {
            const effectUnitModal = document.getElementById('effectUnitManagementModal');
            if (effectUnitModal) {
                 openModal('effectUnitManagementModal');
                 const newUnitInput = document.getElementById('newEffectUnitName');
                 if(newUnitInput) newUnitInput.focus();
            }
        });
    }

    console.log("[Effect Unit Manager] Initialized.");
}

export function _renderEffectUnitsForManagementInternal() {
    if (!DOMEU.effectUnitListContainer) return;
    const effectUnitsCache = getEffectUnitsFuncCache();
    DOMEU.effectUnitListContainer.innerHTML = '';

    if (effectUnitsCache.length === 0) {
        DOMEU.effectUnitListContainer.innerHTML = '<p>効果単位が登録されていません。「なし」は自動的に利用可能です。</p>';
        return;
    }

    const sortedUnits = [...effectUnitsCache].sort((a,b) => a.name.localeCompare(b.name, 'ja'));

    sortedUnits.forEach(unit => {
        const div = document.createElement('div');
        div.classList.add('list-item');
        div.innerHTML = `
            <span class="list-item-name-clickable" data-id="${unit.id}" data-action="edit">${unit.name}</span>
            <div class="list-item-actions">
                <!-- Buttons removed from here -->
            </div>
        `;
        DOMEU.effectUnitListContainer.appendChild(div);
    });
    console.log("[Effect Unit Manager] Effect units rendered for management.");
}

function handleEffectUnitListClick(event) {
    const target = event.target;
    const clickableName = target.closest('.list-item-name-clickable[data-id]');
    
    if (clickableName && clickableName.dataset.action === 'edit') {
        const unitId = clickableName.dataset.id;
        openEditEffectUnitModalById(unitId);
    }
}

async function addEffectUnit() {
    if (!DOMEU.newEffectUnitNameInput) return;
    const name = DOMEU.newEffectUnitNameInput.value.trim();
    const effectUnitsCache = getEffectUnitsFuncCache();

    if (!name) { alert("効果単位名を入力してください。"); return; }
    if (name.toLowerCase() === "なし") { alert("「なし」は予約語であり、単位として登録できません。"); return; }
    if (effectUnitsCache.some(u => u.name.toLowerCase() === name.toLowerCase())) {
        alert("同じ名前の効果単位が既に存在します。"); return;
    }

    try {
        await addDoc(collection(dbInstance, 'effect_units'), {
            name: name,
            createdAt: serverTimestamp()
        });
        DOMEU.newEffectUnitNameInput.value = '';
        await refreshAllDataCallback();
    } catch (error) {
        console.error("[Effect Unit Manager] Error adding effect unit:", error);
        alert("効果単位の追加に失敗しました。");
    }
}

function openEditEffectUnitModalById(unitId) {
    const effectUnitsCache = getEffectUnitsFuncCache();
    const unitData = effectUnitsCache.find(u => u.id === unitId);
    if (unitData && DOMEU.editingEffectUnitDocIdInput && DOMEU.editingEffectUnitNameInput) {
        DOMEU.editingEffectUnitDocIdInput.value = unitData.id;
        DOMEU.editingEffectUnitNameInput.value = unitData.name;
        openModal('editEffectUnitModal');
        DOMEU.editingEffectUnitNameInput.focus();
    } else {
        alert("編集する効果単位のデータが見つかりません。");
    }
}

async function saveEffectUnitEdit() {
    const id = DOMEU.editingEffectUnitDocIdInput.value;
    const newName = DOMEU.editingEffectUnitNameInput.value.trim();
    const effectUnitsCache = getEffectUnitsFuncCache();

    if (!newName) { alert("効果単位名は空にできません。"); return; }
    if (newName.toLowerCase() === "なし") { alert("「なし」は予約語であり、単位として登録できません。"); return; }
    if (effectUnitsCache.some(u => u.id !== id && u.name.toLowerCase() === newName.toLowerCase())) {
        alert("編集後の名前が他の効果単位と重複します。"); return;
    }

    try {
        const oldUnitData = effectUnitsCache.find(u => u.id === id);
        const oldUnitName = oldUnitData ? oldUnitData.name : null;

        await updateDoc(doc(dbInstance, 'effect_units', id), {
            name: newName,
            updatedAt: serverTimestamp()
        });

        if (oldUnitName && oldUnitName !== newName) {
            // 以前はここで関連エンティティの単位名を更新していたが、
            // effect_types.defaultUnit はID参照ではなく文字列だったため、
            // この更新はEffectType編集時に行うのがより適切。
            // アイテムやキャラ基礎情報の効果リスト内の `unit` プロパティは現状存在しないため、更新不要。
            // もし将来的に効果インスタンスごとに単位を保存するなら、ここでの更新が必要。
            console.log(`Effect unit name changed from "${oldUnitName}" to "${newName}". Dependent entities might need manual review or a more robust update mechanism if unit names are denormalized.`);
        }
        closeModal('editEffectUnitModal');
        await refreshAllDataCallback(); // This reloads all data, including effect types
    } catch (error) {
        console.error("[Effect Unit Manager] Error updating effect unit:", error);
        alert("効果単位の更新に失敗しました。");
    }
}

async function deleteEffectUnit(id, name) {
    const effectTypesCache = getEffectTypesFuncCache();
    // アイテムやキャラ基礎情報の効果リスト内の `unit` は現在保存していないため、チェック不要。
    // 効果種類の `defaultUnit` がこの単位名(name)を参照しているか確認
    const usedByEffectType = effectTypesCache.find(et => et.defaultUnit === name);
    if (usedByEffectType) {
        alert(`効果単位「${name}」は効果種類「${usedByEffectType.name}」のデフォルト単位として使用されているため削除できません。`); return;
    }

    if (confirm(`効果単位「${name}」を削除しますか？この操作は元に戻せません。`)) {
        try {
            await deleteDoc(doc(dbInstance, 'effect_units', id));
            closeModal('editEffectUnitModal'); // 編集モーダルが開いていたら閉じる
            await refreshAllDataCallback();
        } catch (error) {
            console.error("[Effect Unit Manager] Error deleting effect unit:", error);
            alert("効果単位の削除に失敗しました。");
        }
    }
}
