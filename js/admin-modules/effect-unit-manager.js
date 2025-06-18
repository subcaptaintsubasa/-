// js/admin-modules/effect-unit-manager.js
import { collection, getDocs, addDoc, doc, updateDoc, query, orderBy, serverTimestamp, where } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js"; // deleteDoc removed, writeBatch not needed for single updates
import { openModal, closeModal } from './ui-helpers.js';

const DOMEU = {
    newEffectUnitNameInput: null,
    newEffectUnitPositionRadios: null,
    addEffectUnitButton: null,
    effectUnitListContainer: null,
    editEffectUnitModal: null,
    editingEffectUnitDocIdInput: null,
    editingEffectUnitNameInput: null,
    editingEffectUnitPositionRadios: null,
    saveEffectUnitEditButton: null,
    manageUnitsForNewEffectTypeButton: null, // Not directly used for data, but part of UI
    manageUnitsForEditingEffectTypeButton: null, // Not directly used for data
    deleteEffectUnitFromEditModalButton: null,
};

let dbInstance = null;
let getEffectUnitsFuncCache = () => [];
let getEffectTypesFuncCache = () => []; // For checking usage on delete
let getItemsFuncCache = () => []; // For checking usage on delete
let getCharacterBasesFuncCache = () => ({}); // For checking usage on delete
let refreshAllDataCallback = async () => {};

export function initEffectUnitManager(dependencies) {
    dbInstance = dependencies.db;
    getEffectUnitsFuncCache = dependencies.getEffectUnits; // Assumes this returns non-deleted
    getEffectTypesFuncCache = dependencies.getEffectTypes; // Assumes non-deleted
    getItemsFuncCache = dependencies.getItems; // Assumes non-deleted
    getCharacterBasesFuncCache = dependencies.getCharacterBases; // Assumes non-deleted options
    refreshAllDataCallback = dependencies.refreshAllData;

    DOMEU.newEffectUnitNameInput = document.getElementById('newEffectUnitName');
    DOMEU.newEffectUnitPositionRadios = document.querySelectorAll('input[name="newEffectUnitPosition"]');
    DOMEU.addEffectUnitButton = document.getElementById('addEffectUnitButton');
    DOMEU.effectUnitListContainer = document.getElementById('effectUnitListContainer');

    DOMEU.editEffectUnitModal = document.getElementById('editEffectUnitModal');
    DOMEU.editingEffectUnitDocIdInput = document.getElementById('editingEffectUnitDocId');
    DOMEU.editingEffectUnitNameInput = document.getElementById('editingEffectUnitName');
    DOMEU.editingEffectUnitPositionRadios = document.querySelectorAll('input[name="editEffectUnitPosition"]');
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
                logicalDeleteEffectUnit(unitId, unit.name); // Changed to logicalDelete
            } else {
                alert("削除対象の効果単位IDが見つかりません。");
            }
        });
    }
    // manageUnits buttons don't interact with data directly, so no change for logical delete
    if (DOMEU.manageUnitsForNewEffectTypeButton) {
        DOMEU.manageUnitsForNewEffectTypeButton.addEventListener('click', () => scrollToUnitSection('new'));
    }
    if (DOMEU.manageUnitsForEditingEffectTypeButton) {
        DOMEU.manageUnitsForEditingEffectTypeButton.addEventListener('click', () => scrollToUnitSection('edit'));
    }

    if (DOMEU.effectUnitListContainer) {
        DOMEU.effectUnitListContainer.addEventListener('click', (event) => {
            const clickableName = event.target.closest('.list-item-name-clickable[data-id]');
            if (clickableName) {
                openEditEffectUnitModalById(clickableName.dataset.id);
            }
        });
    }
    console.log("[Effect Unit Manager] Initialized for logical delete.");
}

// scrollToUnitSection remains the same
function scrollToUnitSection(context) {
    const effectUnitManagementModalEl = document.getElementById('effectUnitManagementModal');
    if (effectUnitManagementModalEl && effectUnitManagementModalEl.style.display !== 'none') {
        const inputToFocus = (context === 'new') ? DOMEU.newEffectUnitNameInput : null;
        if (inputToFocus) {
            inputToFocus.focus();
        }
        const scrollableContent = effectUnitManagementModalEl.querySelector('.modal-content.scrollable-content');
        if (scrollableContent) scrollableContent.scrollTop = 0;
    } else {
        console.warn("scrollToUnitSection: Modal not open or section not found for scrolling.");
    }
}


export function _renderEffectUnitsForManagementInternal() {
    if (!DOMEU.effectUnitListContainer) return;
    const effectUnitsCache = getEffectUnitsFuncCache(); // Assumes this returns non-deleted units
    DOMEU.effectUnitListContainer.innerHTML = '';

    if (effectUnitsCache.length === 0) {
        DOMEU.effectUnitListContainer.innerHTML = '<p>効果単位が登録されていません。「なし」は自動的に利用可能です。</p>';
        return;
    }
    const sortedUnits = [...effectUnitsCache].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    sortedUnits.forEach(unit => {
        // No need to check unit.isDeleted here as cache is pre-filtered
        const positionText = unit.position === 'prefix' ? '(前)' : '(後)';
        const div = document.createElement('div');
        div.classList.add('list-item');
        
        const nameSpan = document.createElement('span');
        nameSpan.classList.add('list-item-name-clickable');
        nameSpan.dataset.id = unit.id;
        
        const nameTextNode = document.createTextNode(`${unit.name} `);
        const smallInfo = document.createElement('small');
        smallInfo.textContent = positionText;
        
        nameSpan.appendChild(nameTextNode);
        nameSpan.appendChild(smallInfo);
        div.appendChild(nameSpan);
        
        DOMEU.effectUnitListContainer.appendChild(div);
    });
}

async function addEffectUnit() {
    if (!DOMEU.newEffectUnitNameInput || !DOMEU.newEffectUnitPositionRadios) return;
    const name = DOMEU.newEffectUnitNameInput.value.trim();
    const selectedPositionRadio = Array.from(DOMEU.newEffectUnitPositionRadios).find(r => r.checked);
    const position = selectedPositionRadio ? selectedPositionRadio.value : 'suffix';
    const effectUnitsCache = getEffectUnitsFuncCache(); // Assumes non-deleted

    if (!name) { alert("効果単位名を入力してください。"); return; }
    if (name.toLowerCase() === "なし") { alert("「なし」は予約語であり、単位として登録できません。"); return; }
    
    // Check for duplicates among non-deleted units
    if (effectUnitsCache.some(u => u.name.toLowerCase() === name.toLowerCase())) {
        alert("同じ名前の効果単位が既に存在します。"); return;
    }

    try {
        await addDoc(collection(dbInstance, 'effect_units'), {
            name: name, 
            position: position, 
            isDeleted: false, // New units are not deleted
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp() // Add updatedAt
        });
        DOMEU.newEffectUnitNameInput.value = '';
        if (DOMEU.newEffectUnitPositionRadios.length > 0) DOMEU.newEffectUnitPositionRadios[0].checked = true; // Default selection
        await refreshAllDataCallback();
    } catch (error) {
        console.error("[Effect Unit Manager] Error adding effect unit:", error);
        alert("効果単位の追加に失敗しました。");
    }
}

export function openEditEffectUnitModalById(unitId) {
    const effectUnitsCache = getEffectUnitsFuncCache(); // Assumes non-deleted
    const unitData = effectUnitsCache.find(u => u.id === unitId);
    if (unitData && DOMEU.editingEffectUnitDocIdInput && DOMEU.editingEffectUnitNameInput && DOMEU.editingEffectUnitPositionRadios) {
        DOMEU.editingEffectUnitDocIdInput.value = unitData.id;
        DOMEU.editingEffectUnitNameInput.value = unitData.name;
        const positionToSelect = unitData.position || 'suffix';
        DOMEU.editingEffectUnitPositionRadios.forEach(radio => {
            radio.checked = radio.value === positionToSelect;
        });
        openModal('editEffectUnitModal');
        if (DOMEU.editingEffectUnitNameInput) DOMEU.editingEffectUnitNameInput.focus();
    } else {
        alert("編集する効果単位のデータが見つかりません。");
    }
}

async function saveEffectUnitEdit() {
    const id = DOMEU.editingEffectUnitDocIdInput.value;
    const newName = DOMEU.editingEffectUnitNameInput.value.trim();
    const selectedPositionRadio = Array.from(DOMEU.editingEffectUnitPositionRadios).find(r => r.checked);
    const newPosition = selectedPositionRadio ? selectedPositionRadio.value : 'suffix';
    const effectUnitsCache = getEffectUnitsFuncCache(); // Assumes non-deleted

    if (!newName) { alert("効果単位名は空にできません。"); return; }
    if (newName.toLowerCase() === "なし") { alert("「なし」は予約語であり、単位として登録できません。"); return; }
    
    // Check for duplicates among other non-deleted units
    if (effectUnitsCache.some(u => u.id !== id && u.name.toLowerCase() === newName.toLowerCase())) {
        alert("編集後の名前が他の効果単位と重複します。"); return;
    }

    try {
        const oldUnitData = effectUnitsCache.find(u => u.id === id);
        const oldUnitName = oldUnitData ? oldUnitData.name : null;

        const updateData = { 
            name: newName, 
            position: newPosition, 
            updatedAt: serverTimestamp() // Update timestamp
        };
        await updateDoc(doc(dbInstance, 'effect_units', id), updateData);

        // If unit name changed, update references in other collections (EffectTypes, Items, CharBaseOptions)
        // This part can be complex and might require batched writes if many references exist.
        // For simplicity, we'll assume this might be handled by a more robust update or a separate process.
        // However, if you want to do it here:
        if (oldUnitName && oldUnitName !== newName) {
            console.warn(`EffectUnit name changed from "${oldUnitName}" to "${newName}". References in EffectTypes, Items, and CharacterBases might need manual or scripted updates if not handled automatically by a batch process.`);
            // A full implementation would query and batch update all referencing documents.
            // This example focuses on the unit itself.
            // For a complete solution, you'd need to:
            // 1. Query effect_types where defaultUnit === oldUnitName, update to newName.
            // 2. Query items where structured_effects[any].unit === oldUnitName, update to newName.
            // 3. Query character_bases subcollections where effects[any].unit === oldUnitName, update to newName.
            // This would involve write batches and could be extensive.
        }

        closeModal('editEffectUnitModal');
        await refreshAllDataCallback();
    } catch (error) {
        console.error("[Effect Unit Manager] Error updating effect unit:", error);
        alert("効果単位の更新に失敗しました。");
    }
}

async function logicalDeleteEffectUnit(id, name) {
    // Check if this unit is used by any *non-deleted* EffectTypes, Items, or CharacterBaseOptions
    const effectTypesCache = getEffectTypesFuncCache(); // Assumes non-deleted
    const itemsCache = getItemsFuncCache(); // Assumes non-deleted
    const charBasesCache = getCharacterBasesFuncCache(); // Assumes non-deleted options

    const usedByEffectType = effectTypesCache.find(et => et.defaultUnit === name);
    if (usedByEffectType) {
        alert(`効果単位「${name}」は効果種類「${usedByEffectType.name}」のデフォルト単位として使用されているため、論理削除できません。\n先に効果種類「${usedByEffectType.name}」のデフォルト単位を変更してください。`);
        return;
    }

    const usedByItem = itemsCache.find(item => 
        item.effects && item.effects.some(eff => eff.type === 'structured' && eff.unit === name)
    );
    if (usedByItem) {
        alert(`効果単位「${name}」はアイテム「${usedByItem.name}」の効果で使用されているため、論理削除できません。\n先にアイテム「${usedByItem.name}」の効果からこの単位を削除するか、単位を変更してください。`);
        return;
    }

    for (const baseKey in charBasesCache) {
        const usedInBase = (charBasesCache[baseKey] || []).find(option =>
            option.effects && option.effects.some(eff => eff.unit === name)
        );
        if (usedInBase) {
            // baseTypeMappings is not directly available here. Use baseKey for now.
            alert(`効果単位「${name}」はキャラクター基礎情報「${baseKey}タイプ - ${usedInBase.name}」の効果で使用されているため、論理削除できません。\n先に該当の基礎情報オプションの効果からこの単位を削除するか、単位を変更してください。`);
            return;
        }
    }

    if (confirm(`効果単位「${name}」を論理削除しますか？\nこの単位は一覧などには表示されなくなりますが、データは残ります。`)) {
        try {
            await updateDoc(doc(dbInstance, 'effect_units', id), {
                isDeleted: true,
                updatedAt: serverTimestamp() // Update timestamp
            });
            
            if (DOMEU.editEffectUnitModal.style.display !== 'none' && DOMEU.editingEffectUnitDocIdInput.value === id) {
                closeModal('editEffectUnitModal');
            }
            await refreshAllDataCallback();
        } catch (error) {
            console.error("[Effect Unit Manager] Error logically deleting effect unit:", error);
            alert("効果単位の論理削除に失敗しました。");
        }
    }
}
