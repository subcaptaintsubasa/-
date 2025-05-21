// js/admin-modules/effect-unit-manager.js
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { openModal, closeModal } from './ui-helpers.js';

const DOMEU = {
    newEffectUnitNameInput: null,
    newEffectUnitPositionRadios: null, // Added
    addEffectUnitButton: null,
    effectUnitListContainer: null,
    editEffectUnitModal: null,
    editingEffectUnitDocIdInput: null,
    editingEffectUnitNameInput: null,
    editingEffectUnitPositionRadios: null, // Added
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
    DOMEU.newEffectUnitPositionRadios = document.querySelectorAll('input[name="newEffectUnitPosition"]'); // Added
    DOMEU.addEffectUnitButton = document.getElementById('addEffectUnitButton');
    DOMEU.effectUnitListContainer = document.getElementById('effectUnitListContainer');

    DOMEU.editEffectUnitModal = document.getElementById('editEffectUnitModal');
    DOMEU.editingEffectUnitDocIdInput = document.getElementById('editingEffectUnitDocId');
    DOMEU.editingEffectUnitNameInput = document.getElementById('editingEffectUnitName');
    DOMEU.editingEffectUnitPositionRadios = document.querySelectorAll('input[name="editEffectUnitPosition"]'); // Added
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
    // This function implementation seems fine, assuming effect-unit-management is the ID of the section.
    const effectUnitManagementSection = document.querySelector('#effectUnitManagementModal').closest('section') || document.getElementById('effect-unit-management'); // Fallback if section ID changes.
    if (effectUnitManagementSection) {
         // Attempt to open the modal first if it's not already open, then scroll within it or to it.
         // For simplicity, assuming the modal containing this section is opened by a nav button.
         // This function is more about focusing the input within an already visible/soon-to-be-visible section.
        const modal = document.getElementById('effectUnitManagementModal');
        if (modal && modal.style.display !== 'none') { // if modal is open
            const inputToFocus = (context === 'new') ? DOMEU.newEffectUnitNameInput : DOMEU.editingEffectUnitNameInput;
            if (inputToFocus) {
                inputToFocus.focus();
                 // Simple scroll to top of modal content if input is not directly visible
                modal.querySelector('.modal-content.scrollable-content').scrollTop = 0;
            }
        } else {
            // If the modal is not open, the button that usually opens it should be used.
            // This helper is more for internal navigation within the already opened modal/page.
            // If we want this button to also open the modal, that logic needs to be added.
            // For now, just focusing if section is visible.
            const sectionContainer = document.getElementById('effect-unit-management'); // Assuming this is a section on main admin page
            if(sectionContainer) {
                sectionContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
                 if (context === 'new' && DOMEU.newEffectUnitNameInput) DOMEU.newEffectUnitNameInput.focus();
            }
        }
    }
}


export function _renderEffectUnitsForManagementInternal() {
    if (!DOMEU.effectUnitListContainer) return;
    const effectUnitsCache = getEffectUnitsFuncCache();
    DOMEU.effectUnitListContainer.innerHTML = '';

    if (effectUnitsCache.length === 0) {
        DOMEU.effectUnitListContainer.innerHTML = '<p>効果単位が登録されていません。「なし」は自動的に利用可能です。</p>';
        return; // No need to populate selects if no units, they default to "なし"
    }

    const sortedUnits = [...effectUnitsCache].sort((a, b) => a.name.localeCompare(b.name, 'ja'));

    sortedUnits.forEach(unit => {
        const positionText = unit.position === 'prefix' ? '(前)' : '(後)'; // Display position
        const div = document.createElement('div');
        div.classList.add('list-item');
        // Make the unit name part clickable
        const nameSpan = document.createElement('span');
        nameSpan.classList.add('list-item-name-clickable');
        nameSpan.textContent = `${unit.name} `;
        nameSpan.dataset.id = unit.id; // Add data-id for click handling
        nameSpan.addEventListener('click', () => openEditEffectUnitModalById(unit.id));


        const smallInfo = document.createElement('small');
        smallInfo.textContent = positionText;
        nameSpan.appendChild(smallInfo);

        div.appendChild(nameSpan);

        const actionsDiv = document.createElement('div');
        actionsDiv.classList.add('list-item-actions');
        actionsDiv.innerHTML = `
            <button class="edit-effect-unit action-button" data-id="${unit.id}" title="編集">✎</button>
            <button class="delete-effect-unit action-button delete" data-id="${unit.id}" data-name="${unit.name}" title="削除">×</button>
        `;
        div.appendChild(actionsDiv);

        DOMEU.effectUnitListContainer.appendChild(div);
    });

    // Event listeners for edit/delete buttons (moved from individual item creation for efficiency if list is large)
    // However, for clickable names, it's fine to add listener during creation or delegate.
    // The existing querySelectorAll for buttons is fine too.
    DOMEU.effectUnitListContainer.querySelectorAll('.edit-effect-unit').forEach(btn => {
        btn.addEventListener('click', (e) => openEditEffectUnitModalById(e.currentTarget.dataset.id));
    });
    DOMEU.effectUnitListContainer.querySelectorAll('.delete-effect-unit').forEach(btn => {
        btn.addEventListener('click', (e) => deleteEffectUnit(e.currentTarget.dataset.id, e.currentTarget.dataset.name));
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
        if (DOMEU.newEffectUnitPositionRadios.length > 0) DOMEU.newEffectUnitPositionRadios[0].checked = true; // Reset to suffix
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

        const positionToSelect = unitData.position || 'suffix'; // Default to suffix if undefined
        DOMEU.editingEffectUnitPositionRadios.forEach(radio => {
            radio.checked = radio.value === positionToSelect;
        });

        openModal('editEffectUnitModal');
        DOMEU.editingEffectUnitNameInput.focus();
    } else {
        alert("編集する効果単位のデータが見つかりません。");
    }
}

async function saveEffectUnitEdit() {
    const id = DOMEU.editingEffectUnitDocIdInput.value;
    const newName = DOMEU.editingEffectUnitNameInput.value.trim();
    const selectedPositionRadio = Array.from(DOMEU.editingEffectUnitPositionRadios).find(r => r.checked);
    const newPosition = selectedPositionRadio ? selectedPositionRadio.value : 'suffix';
    const effectUnitsCache = getEffectUnitsFuncCache();

    if (!newName) { alert("効果単位名は空にできません。"); return; }
    if (newName.toLowerCase() === "なし") { alert("「なし」は予約語であり、単位として登録できません。"); return; }
    if (effectUnitsCache.some(u => u.id !== id && u.name.toLowerCase() === newName.toLowerCase())) {
        alert("編集後の名前が他の効果単位と重複します。"); return;
    }

    try {
        const oldUnitData = effectUnitsCache.find(u => u.id === id);
        const oldUnitName = oldUnitData ? oldUnitData.name : null;

        // Prepare data for update
        const updateData = {
            name: newName,
            position: newPosition, // Save new position
            updatedAt: serverTimestamp()
        };

        await updateDoc(doc(dbInstance, 'effect_units', id), updateData);

        // If unit name changed, update related entities (this part seems correct as is)
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

    // Check usage in effect_types defaultUnit
    const usedByEffectType = effectTypesCache.find(et => et.defaultUnit === name);
    if (usedByEffectType) {
        alert(`効果単位「${name}」は効果種類「${usedByEffectType.name}」のデフォルト単位として使用されているため削除できません。`); return;
    }
    // Check usage in items structured_effects
    const usedByItem = itemsCache.find(item => item.structured_effects && item.structured_effects.some(eff => eff.unit === name));
    if (usedByItem) {
        alert(`効果単位「${name}」はアイテム「${usedByItem.name}」の効果で使用されているため削除できません。`); return;
    }
    // Check usage in character_bases options effects
    for (const baseKey in charBasesCache) {
        const usedInBase = (charBasesCache[baseKey] || []).find(option =>
            option.effects && option.effects.some(eff => eff.unit === name)
        );
        if (usedInBase) {
            // const typeDisplayName = baseTypeMappings[baseKey] || baseKey; // If baseTypeMappings is available
            alert(`効果単位「${name}」はキャラクター基礎情報「${baseKey} - ${usedInBase.name}」の効果で使用されているため削除できません。`); return;
        }
    }

    if (confirm(`効果単位「${name}」を削除しますか？\nこの操作は元に戻せません。`)) {
        try {
            await deleteDoc(doc(dbInstance, 'effect_units', id));
            await refreshAllDataCallback(); // Refresh data and UI
        } catch (error) {
            console.error("[Effect Unit Manager] Error deleting effect unit:", error);
            alert("効果単位の削除に失敗しました。");
        }
    }
}
