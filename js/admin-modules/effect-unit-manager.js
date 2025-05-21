// js/admin-modules/effect-unit-manager.js
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { openModal, closeModal } from './ui-helpers.js';

const DOMEU = {
    newEffectUnitNameInput: null,
    newEffectUnitPositionRadios: null, // New
    addEffectUnitButton: null,
    effectUnitListContainer: null,
    editEffectUnitModal: null,
    editingEffectUnitDocIdInput: null,
    editingEffectUnitNameInput: null,
    editingEffectUnitPositionRadios: null, // New
    saveEffectUnitEditButton: null,
    manageUnitsForNewEffectTypeButton: null,
    manageUnitsForEditingEffectTypeButton: null,
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

    DOMEU.newEffectUnitNameInput = document.getElementById('newEffectUnitName');
    DOMEU.newEffectUnitPositionRadios = document.querySelectorAll('input[name="newEffectUnitPosition"]'); // New
    DOMEU.addEffectUnitButton = document.getElementById('addEffectUnitButton');
    DOMEU.effectUnitListContainer = document.getElementById('effectUnitListContainer');

    DOMEU.editEffectUnitModal = document.getElementById('editEffectUnitModal');
    DOMEU.editingEffectUnitDocIdInput = document.getElementById('editingEffectUnitDocId');
    DOMEU.editingEffectUnitNameInput = document.getElementById('editingEffectUnitName');
    DOMEU.editingEffectUnitPositionRadios = document.querySelectorAll('input[name="editEffectUnitPosition"]'); // New
    DOMEU.saveEffectUnitEditButton = document.getElementById('saveEffectUnitEditButton');

    DOMEU.manageUnitsForNewEffectTypeButton = document.getElementById('manageUnitsForNewEffectTypeButton');
    DOMEU.manageUnitsForEditingEffectTypeButton = document.getElementById('manageUnitsForEditingEffectTypeButton');


    if (DOMEU.addEffectUnitButton) {
        DOMEU.addEffectUnitButton.addEventListener('click', addEffectUnit);
    }
    if (DOMEU.saveEffectUnitEditButton) {
        DOMEU.saveEffectUnitEditButton.addEventListener('click', saveEffectUnitEdit);
    }
    if (DOMEU.manageUnitsForNewEffectTypeButton) {
        DOMEU.manageUnitsForNewEffectTypeButton.addEventListener('click', () => scrollToUnitSection('new'));
    }
    if (DOMEU.manageUnitsForEditingEffectTypeButton) {
        DOMEU.manageUnitsForEditingEffectTypeButton.addEventListener('click', () => scrollToUnitSection('edit'));
    }

    console.log("[Effect Unit Manager] Initialized.");
}

function scrollToUnitSection(context) {
    // This function remains unchanged, but ensure its target section exists in admin.html
    // The target section ID is 'effect-unit-management', which seems to be the parent of the modal button.
    // The actual modal content is in 'effectUnitManagementModal'.
    // To scroll to the modal or its form, a different approach might be needed if the modal isn't always in view.
    // However, for now, let's assume the button click opens the modal and this scroll is for navigating within the main page.
    const managementModalButton = document.querySelector(`button[data-modal-target="effectUnitManagementModal"]`);
    if (managementModalButton) {
        // If the intention is to open the modal and focus, that should be handled by the modal opening logic.
        // This scroll seems to be for the main page section.
        // Let's assume it refers to the section containing the form in the modal.
        const modalFormSection = document.getElementById('effectUnitManagementModal'); // The modal itself
        if (modalFormSection) {
            // If modal is not open, open it first.
            if (!modalFormSection.classList.contains('active-modal')) {
                 openModal('effectUnitManagementModal');
            }
            // Scrolling within a modal usually isn't done with scrollIntoView on the modal itself.
            // Instead, focus the input.
            if (context === 'new' && DOMEU.newEffectUnitNameInput) DOMEU.newEffectUnitNameInput.focus();
            // If the modal content is scrollable and you want to scroll to a specific part:
            // modalFormSection.querySelector('.modal-content').scrollTop = 0; // Scroll to top of modal content
        }
    } else {
         console.warn("Effect Unit management modal button not found for scrolling/focus.");
    }
}


export function _renderEffectUnitsForManagementInternal() {
    if (!DOMEU.effectUnitListContainer) return;
    const effectUnitsCache = getEffectUnitsFuncCache();
    DOMEU.effectUnitListContainer.innerHTML = '';

    if (effectUnitsCache.length === 0) {
        DOMEU.effectUnitListContainer.innerHTML = '<p>効果単位が登録されていません。「なし」は自動的に利用可能です。</p>';
        return; // Added return to avoid processing empty cache
    }

    const sortedUnits = [...effectUnitsCache].sort((a,b) => a.name.localeCompare(b.name, 'ja'));

    sortedUnits.forEach(unit => {
        const positionText = unit.position === 'prefix' ? '(前)' : '(後)'; // Display position
        const div = document.createElement('div');
        div.classList.add('list-item');
        // Updated to show unit position
        div.innerHTML = `
            <span class="list-item-name-clickable" data-id="${unit.id}">${unit.name} <small>${positionText}</small></span>
            <div>
                <button class="edit-effect-unit action-button" data-id="${unit.id}" title="編集">✎</button>
                <button class="delete-effect-unit action-button delete" data-id="${unit.id}" data-name="${unit.name}" title="削除">×</button>
            </div>
        `;
        // Make the name clickable to open edit modal
        const nameSpan = div.querySelector('.list-item-name-clickable');
        if (nameSpan) {
            nameSpan.addEventListener('click', (e) => openEditEffectUnitModalById(e.currentTarget.dataset.id));
        }

        DOMEU.effectUnitListContainer.appendChild(div);
    });

    // Remove direct edit/delete button listeners from here as they are added above to the span/buttons respectively.
    // Ensure the span click works if action buttons are removed or handled differently.
    // The current structure with explicit buttons next to the name is fine.
    // If the whole list-item was meant to be clickable, that's different.
    // The prompt mentioned "項目名（単位名部分）をクリックすると編集モーダルが開きます"
    // So, attaching listener to list-item-name-clickable is correct.

    // Listeners for edit/delete buttons within the list items
    DOMEU.effectUnitListContainer.querySelectorAll('.edit-effect-unit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent event bubbling to the name span if it's also clickable
            openEditEffectUnitModalById(e.currentTarget.dataset.id);
        });
    });
    DOMEU.effectUnitListContainer.querySelectorAll('.delete-effect-unit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteEffectUnit(e.currentTarget.dataset.id, e.currentTarget.dataset.name);
        });
    });
    console.log("[Effect Unit Manager] Effect units rendered for management.");
}

async function addEffectUnit() {
    if (!DOMEU.newEffectUnitNameInput || !DOMEU.newEffectUnitPositionRadios) return;
    const name = DOMEU.newEffectUnitNameInput.value.trim();
    const selectedPositionRadio = Array.from(DOMEU.newEffectUnitPositionRadios).find(r => r.checked);
    const position = selectedPositionRadio ? selectedPositionRadio.value : 'suffix'; // Default to suffix
    const effectUnitsCache = getEffectUnitsFuncCache();

    if (!name) { alert("効果単位名を入力してください。"); return; }
    if (name.toLowerCase() === "なし") { alert("「なし」は予約語であり、単位として登録できません。"); return; }
    if (effectUnitsCache.some(u => u.name.toLowerCase() === name.toLowerCase())) {
        alert("同じ名前の効果単位が既に存在します。"); return;
    }

    try {
        await addDoc(collection(dbInstance, 'effect_units'), {
            name: name,
            position: position, // Save position
            createdAt: serverTimestamp()
        });
        DOMEU.newEffectUnitNameInput.value = '';
        // Reset position radio to default (suffix)
        const suffixRadio = Array.from(DOMEU.newEffectUnitPositionRadios).find(r => r.value === 'suffix');
        if (suffixRadio) suffixRadio.checked = true;

        await refreshAllDataCallback();
    } catch (error) {
        console.error("[Effect Unit Manager] Error adding effect unit:", error);
        alert("効果単位の追加に失敗しました。");
    }
}

function openEditEffectUnitModalById(unitId) {
    const effectUnitsCache = getEffectUnitsFuncCache();
    const unitData = effectUnitsCache.find(u => u.id === unitId);
    if (unitData && DOMEU.editingEffectUnitDocIdInput && DOMEU.editingEffectUnitNameInput && DOMEU.editingEffectUnitPositionRadios) {
        DOMEU.editingEffectUnitDocIdInput.value = unitData.id;
        DOMEU.editingEffectUnitNameInput.value = unitData.name;

        // Set position radio
        const positionToSelect = unitData.position || 'suffix'; // Default to suffix if not set
        const radioToSelect = Array.from(DOMEU.editingEffectUnitPositionRadios).find(r => r.value === positionToSelect);
        if (radioToSelect) {
            radioToSelect.checked = true;
        } else { // Fallback if specific value not found, check suffix
            const suffixRadio = Array.from(DOMEU.editingEffectUnitPositionRadios).find(r => r.value === 'suffix');
            if (suffixRadio) suffixRadio.checked = true;
        }

        openModal('editEffectUnitModal');
        DOMEU.editingEffectUnitNameInput.focus();
    } else {
        alert("編集する効果単位のデータが見つかりません。");
    }
}

async function saveEffectUnitEdit() {
    if (!DOMEU.editingEffectUnitDocIdInput || !DOMEU.editingEffectUnitNameInput || !DOMEU.editingEffectUnitPositionRadios) return;
    const id = DOMEU.editingEffectUnitDocIdInput.value;
    const newName = DOMEU.editingEffectUnitNameInput.value.trim();
    const selectedPositionRadio = Array.from(DOMEU.editingEffectUnitPositionRadios).find(r => r.checked);
    const newPosition = selectedPositionRadio ? selectedPositionRadio.value : 'suffix'; // Default to suffix
    const effectUnitsCache = getEffectUnitsFuncCache();

    if (!newName) { alert("効果単位名は空にできません。"); return; }
    if (newName.toLowerCase() === "なし") { alert("「なし」は予約語であり、単位として登録できません。"); return; }
    if (effectUnitsCache.some(u => u.id !== id && u.name.toLowerCase() === newName.toLowerCase())) {
        alert("編集後の名前が他の効果単位と重複します。"); return;
    }

    try {
        const oldUnitData = effectUnitsCache.find(u => u.id === id);
        const oldUnitName = oldUnitData ? oldUnitData.name : null;
        // Note: oldUnitPosition is not explicitly used here for updating other entities,
        // as position only affects display, not the stored unit name itself.

        await updateDoc(doc(dbInstance, 'effect_units', id), {
            name: newName,
            position: newPosition, // Save new position
            updatedAt: serverTimestamp()
        });

        // If unit NAME changed, update related entities
        if (oldUnitName && oldUnitName !== newName) {
            const batch = writeBatch(dbInstance);
            let updatesMade = false;

            getEffectTypesFuncCache().forEach(et => {
                if (et.defaultUnit === oldUnitName) {
                    batch.update(doc(dbInstance, 'effect_types', et.id), { defaultUnit: newName });
                    updatesMade = true;
                }
            });
            getItemsFuncCache().forEach(item => {
                let itemEffectsUpdated = false;
                const updatedEffects = (item.structured_effects || []).map(eff => {
                    if (eff.unit === oldUnitName) { itemEffectsUpdated = true; return { ...eff, unit: newName }; }
                    return eff;
                });
                if (itemEffectsUpdated) {
                    batch.update(doc(dbInstance, 'items', item.docId), { structured_effects: updatedEffects });
                    updatesMade = true;
                }
            });
            const charBases = getCharacterBasesFuncCache();
            for (const baseKey in charBases) {
                (charBases[baseKey] || []).forEach(option => {
                    let optionEffectsUpdated = false;
                    const updatedOptionEffects = (option.effects || []).map(eff => {
                        if (eff.unit === oldUnitName) { optionEffectsUpdated = true; return { ...eff, unit: newName }; }
                        return eff;
                    });
                    if (optionEffectsUpdated) {
                        batch.update(doc(dbInstance, `character_bases/${baseKey}/options`, option.id), { effects: updatedOptionEffects });
                        updatesMade = true;
                    }
                });
            }
            if (updatesMade) await batch.commit();
        }
        closeModal('editEffectUnitModal');
        await refreshAllDataCallback();
    } catch (error) {
        console.error("[Effect Unit Manager] Error updating effect unit:", error);
        alert("効果単位の更新または関連エンティティの更新に失敗しました。");
    }
}

async function deleteEffectUnit(id, name) {
    const effectTypesCache = getEffectTypesFuncCache();
    const itemsCache = getItemsFuncCache();
    const charBasesCache = getCharacterBasesFuncCache();

    const usedByEffectType = effectTypesCache.find(et => et.defaultUnit === name);
    if (usedByEffectType) {
        alert(`効果単位「${name}」は効果種類「${usedByEffectType.name}」のデフォルト単位として使用されているため削除できません。`); return;
    }
    const usedByItem = itemsCache.find(item => item.structured_effects && item.structured_effects.some(eff => eff.unit === name));
    if (usedByItem) {
        alert(`効果単位「${name}」はアイテム「${usedByItem.name}」の効果で使用されているため削除できません。`); return;
    }
    for (const baseKey in charBasesCache) {
        const usedInBase = (charBasesCache[baseKey] || []).find(option =>
            option.effects && option.effects.some(eff => eff.unit === name)
        );
        if (usedInBase) {
            alert(`効果単位「${name}」はキャラクター基礎情報「${baseKey} - ${usedInBase.name}」の効果で使用されているため削除できません。`); return;
        }
    }

    if (confirm(`効果単位「${name}」を削除しますか？この操作は元に戻せません。`)) {
        try {
            await deleteDoc(doc(dbInstance, 'effect_units', id));
            await refreshAllDataCallback();
        } catch (error) {
            console.error("[Effect Unit Manager] Error deleting effect unit:", error);
            alert("効果単位の削除に失敗しました。");
        }
    }
}
