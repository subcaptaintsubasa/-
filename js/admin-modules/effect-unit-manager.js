// js/admin-modules/effect-unit-manager.js
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
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
    DOMEU.newEffectUnitPositionRadios = document.querySelectorAll('input[name="newEffectUnitPosition"]');
    DOMEU.addEffectUnitButton = document.getElementById('addEffectUnitButton');
    DOMEU.effectUnitListContainer = document.getElementById('effectUnitListContainer');

    DOMEU.editEffectUnitModal = document.getElementById('editEffectUnitModal');
    DOMEU.editingEffectUnitDocIdInput = document.getElementById('editingEffectUnitDocId');
    DOMEU.editingEffectUnitNameInput = document.getElementById('editingEffectUnitName');
    DOMEU.editingEffectUnitPositionRadios = document.querySelectorAll('input[name="editEffectUnitPosition"]');
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
    const effectUnitManagementSection = document.querySelector('#effectUnitManagementModal').closest('section') || document.getElementById('effect-unit-management');
    if (effectUnitManagementSection) {
        const modal = document.getElementById('effectUnitManagementModal');
        if (modal && modal.style.display !== 'none') {
            const inputToFocus = (context === 'new') ? DOMEU.newEffectUnitNameInput : DOMEU.editingEffectUnitNameInput; // This would be for the edit modal, not the add form.
            if (inputToFocus && context === 'new') { // Only focus for 'new' in the main modal. Edit modal focus handled separately.
                inputToFocus.focus();
                modal.querySelector('.modal-content.scrollable-content').scrollTop = 0;
            } else {
                 modal.querySelector('.modal-content.scrollable-content').scrollTop = 0;
            }
        } else {
            const sectionContainer = document.getElementById('effect-unit-management');
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
        return;
    }

    const sortedUnits = [...effectUnitsCache].sort((a, b) => a.name.localeCompare(b.name, 'ja'));

    sortedUnits.forEach(unit => {
        const positionText = unit.position === 'prefix' ? '(前)' : '(後)';
        const div = document.createElement('div');
        div.classList.add('list-item'); // Keeps the overall list item structure

        const nameSpan = document.createElement('span');
        nameSpan.classList.add('list-item-name-clickable'); // Make the name part clickable
        nameSpan.textContent = `${unit.name} `;
        nameSpan.dataset.id = unit.id;
        nameSpan.addEventListener('click', () => openEditEffectUnitModalById(unit.id));

        const smallInfo = document.createElement('small');
        smallInfo.textContent = positionText;
        nameSpan.appendChild(smallInfo);

        div.appendChild(nameSpan);
        // Action buttons (edit/delete) are removed from here as per instruction.
        // Delete functionality is now only available within the edit modal.

        DOMEU.effectUnitListContainer.appendChild(div);
    });
    console.log("[Effect Unit Manager] Effect units rendered for management.");
}

async function addEffectUnit() {
    if (!DOMEU.newEffectUnitNameInput || !DOMEU.newEffectUnitPositionRadios) return;
    const name = DOMEU.newEffectUnitNameInput.value.trim();
    const selectedPositionRadio = Array.from(DOMEU.newEffectUnitPositionRadios).find(r => r.checked);
    const position = selectedPositionRadio ? selectedPositionRadio.value : 'suffix';
    const effectUnitsCache = getEffectUnitsFuncCache();

    if (!name) { alert("効果単位名を入力してください。"); return; }
    if (name.toLowerCase() === "なし") { alert("「なし」は予約語であり、単位として登録できません。"); return; }
    if (effectUnitsCache.some(u => u.name.toLowerCase() === name.toLowerCase())) {
        alert("同じ名前の効果単位が既に存在します。"); return;
    }

    try {
        await addDoc(collection(dbInstance, 'effect_units'), {
            name: name,
            position: position,
            createdAt: serverTimestamp()
        });
        DOMEU.newEffectUnitNameInput.value = '';
        if (DOMEU.newEffectUnitPositionRadios.length > 0) DOMEU.newEffectUnitPositionRadios[0].checked = true;
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

        const positionToSelect = unitData.position || 'suffix';
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

        const updateData = {
            name: newName,
            position: newPosition,
            updatedAt: serverTimestamp()
        };

        await updateDoc(doc(dbInstance, 'effect_units', id), updateData);

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
        alert(`効果単位「${name}」は効果種類「${usedByEffectType.name}」のデフォルト単位として使用されているため削除できません。\n先に効果種類「${usedByEffectType.name}」のデフォルト単位を変更してください。`); return;
    }
    const usedByItem = itemsCache.find(item => item.structured_effects && item.structured_effects.some(eff => eff.unit === name));
    if (usedByItem) {
        alert(`効果単位「${name}」はアイテム「${usedByItem.name}」の効果で使用されているため削除できません。\n先にアイテム「${usedByItem.name}」の効果からこの単位を削除するか、単位を変更してください。`); return;
    }
    for (const baseKey in charBasesCache) {
        const usedInBase = (charBasesCache[baseKey] || []).find(option =>
            option.effects && option.effects.some(eff => eff.unit === name)
        );
        if (usedInBase) {
            alert(`効果単位「${name}」はキャラクター基礎情報「${baseKey} - ${usedInBase.name}」の効果で使用されているため削除できません。\n先に該当の基礎情報オプションの効果からこの単位を削除するか、単位を変更してください。`); return;
        }
    }

    if (confirm(`効果単位「${name}」を削除しますか？\nこの操作は元に戻せません。`)) {
        try {
            await deleteDoc(doc(dbInstance, 'effect_units', id));
            await refreshAllDataCallback();
            // Make sure the edit modal is closed if the currently edited item was deleted.
            if (DOMEU.editEffectUnitModal.style.display !== 'none' && DOMEU.editingEffectUnitDocIdInput.value === id) {
                closeModal('editEffectUnitModal');
            }
        } catch (error) {
            console.error("[Effect Unit Manager] Error deleting effect unit:", error);
            alert("効果単位の削除に失敗しました。");
        }
    }
}
