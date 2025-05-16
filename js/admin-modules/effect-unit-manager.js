// js/admin-modules/effect-unit-manager.js
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { openModal, closeModal, clearForm } from './ui-helpers.js';

const DOMEU = { // DOM elements for Effect Unit Management
    newEffectUnitNameInput: null,
    addEffectUnitButton: null,
    effectUnitListContainer: null,
    // Edit Modal Elements
    editEffectUnitModal: null,
    editingEffectUnitDocIdInput: null,
    editingEffectUnitNameInput: null,
    saveEffectUnitEditButton: null,
    // Buttons to trigger scroll to this section
    manageUnitsForNewEffectTypeButton: null,
    manageUnitsForEditingEffectTypeButton: null,
};

let dbInstance = null;
let getEffectUnitsFuncCache = () => [];
let getEffectTypesFuncCache = () => []; // To check usage
let getItemsFuncCache = () => [];       // To check usage
let getCharacterBasesFuncCache = () => ({}); // To check usage
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


    renderEffectUnitsForManagement();
}

function scrollToUnitSection(context) {
    const section = document.getElementById('effect-unit-management');
    if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (context === 'new' && DOMEU.newEffectUnitNameInput) DOMEU.newEffectUnitNameInput.focus();
    }
}

function renderEffectUnitsForManagement() {
    if (!DOMEU.effectUnitListContainer) return;
    const effectUnitsCache = getEffectUnitsFuncCache();
    DOMEU.effectUnitListContainer.innerHTML = '';

    if (effectUnitsCache.length === 0) {
        DOMEU.effectUnitListContainer.innerHTML = '<p>効果単位が登録されていません。「なし」は自動的に利用可能です。</p>';
        // Still render, as 'なし' is implicit
    }
    effectUnitsCache.forEach(unit => {
        const div = document.createElement('div');
        div.classList.add('list-item');
        div.innerHTML = `
            <span>${unit.name}</span>
            <div>
                <button class="edit-effect-unit action-button" data-id="${unit.id}" title="編集">✎</button>
                <button class="delete-effect-unit action-button delete" data-id="${unit.id}" data-name="${unit.name}" title="削除">×</button>
            </div>
        `;
        DOMEU.effectUnitListContainer.appendChild(div);
    });

    DOMEU.effectUnitListContainer.querySelectorAll('.edit-effect-unit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const unitId = e.currentTarget.dataset.id;
            openEditEffectUnitModalById(unitId);
        });
    });
    DOMEU.effectUnitListContainer.querySelectorAll('.delete-effect-unit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            deleteEffectUnit(e.currentTarget.dataset.id, e.currentTarget.dataset.name);
        });
    });
}

async function addEffectUnit() {
    if (!DOMEU.newEffectUnitNameInput) return;
    const name = DOMEU.newEffectUnitNameInput.value.trim();
    const effectUnitsCache = getEffectUnitsFuncCache();

    if (!name) {
        alert("効果単位名を入力してください。");
        return;
    }
    if (name.toLowerCase() === "なし") {
        alert("「なし」は予約語であり、単位として登録できません。");
        return;
    }
    if (effectUnitsCache.some(u => u.name.toLowerCase() === name.toLowerCase())) {
        alert("同じ名前の効果単位が既に存在します。");
        return;
    }

    try {
        await addDoc(collection(dbInstance, 'effect_units'), {
            name: name,
            createdAt: serverTimestamp()
        });
        DOMEU.newEffectUnitNameInput.value = '';
        await refreshAllDataCallback(); // Reload and re-render all, including effect type selects
    } catch (error) {
        console.error("[Effect Units] Error adding:", error);
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

    if (!newName) {
        alert("効果単位名は空にできません。");
        return;
    }
    if (newName.toLowerCase() === "なし") {
        alert("「なし」は予約語であり、単位として登録できません。");
        return;
    }
    if (effectUnitsCache.some(u => u.id !== id && u.name.toLowerCase() === newName.toLowerCase())) {
        alert("編集後の名前が他の効果単位と重複します。");
        return;
    }

    try {
        const oldUnitData = effectUnitsCache.find(u => u.id === id);
        const oldUnitName = oldUnitData ? oldUnitData.name : null;

        await updateDoc(doc(dbInstance, 'effect_units', id), {
            name: newName,
            updatedAt: serverTimestamp()
        });

        // If unit name changed, update related entities (effect types, items, char bases)
        if (oldUnitName && oldUnitName !== newName) {
            const batch = writeBatch(dbInstance);
            let updatesMade = false;

            // Update Effect Types
            getEffectTypesFuncCache().forEach(et => {
                if (et.defaultUnit === oldUnitName) {
                    batch.update(doc(dbInstance, 'effect_types', et.id), { defaultUnit: newName });
                    updatesMade = true;
                }
            });

            // Update Items
            getItemsFuncCache().forEach(item => {
                let itemEffectsUpdated = false;
                const updatedEffects = (item.structured_effects || []).map(eff => {
                    if (eff.unit === oldUnitName) {
                        itemEffectsUpdated = true;
                        return { ...eff, unit: newName };
                    }
                    return eff;
                });
                if (itemEffectsUpdated) {
                    batch.update(doc(dbInstance, 'items', item.docId), { structured_effects: updatedEffects });
                    updatesMade = true;
                }
            });

            // Update Character Base Options
            const charBases = getCharacterBasesFuncCache();
            for (const baseKey in charBases) {
                (charBases[baseKey] || []).forEach(option => {
                    let optionEffectsUpdated = false;
                    const updatedOptionEffects = (option.effects || []).map(eff => {
                        if (eff.unit === oldUnitName) {
                            optionEffectsUpdated = true;
                            return { ...eff, unit: newName };
                        }
                        return eff;
                    });
                    if (optionEffectsUpdated) {
                        batch.update(doc(dbInstance, `character_bases/${baseKey}/options`, option.id), { effects: updatedOptionEffects });
                        updatesMade = true;
                    }
                });
            }

            if (updatesMade) {
                await batch.commit();
            }
        }
        closeModal('editEffectUnitModal');
        await refreshAllDataCallback(); // Always refresh to ensure UI consistency
    } catch (error) {
        console.error("[Effect Units] Error updating:", error);
        alert("効果単位の更新または関連エンティティの更新に失敗しました。");
    }
}

async function deleteEffectUnit(id, name) {
    // Check for usage before deleting
    const effectTypesCache = getEffectTypesFuncCache();
    const itemsCache = getItemsFuncCache();
    const charBasesCache = getCharacterBasesFuncCache();

    const usedByEffectType = effectTypesCache.find(et => et.defaultUnit === name);
    if (usedByEffectType) {
        alert(`効果単位「${name}」は効果種類「${usedByEffectType.name}」のデフォルト単位として使用されているため削除できません。`);
        return;
    }
    const usedByItem = itemsCache.find(item => item.structured_effects && item.structured_effects.some(eff => eff.unit === name));
    if (usedByItem) {
        alert(`効果単位「${name}」はアイテム「${usedByItem.name}」の効果で使用されているため削除できません。`);
        return;
    }
    for (const baseKey in charBasesCache) {
        const usedInBase = (charBasesCache[baseKey] || []).find(option =>
            option.effects && option.effects.some(eff => eff.unit === name)
        );
        if (usedInBase) {
            // Assuming baseTypeMappings is available via import or passed if needed for the alert message
            // For simplicity, using baseKey directly here.
            alert(`効果単位「${name}」はキャラクター基礎情報「${baseKey} - ${usedInBase.name}」の効果で使用されているため削除できません。`);
            return;
        }
    }

    if (confirm(`効果単位「${name}」を削除しますか？`)) {
        try {
            await deleteDoc(doc(dbInstance, 'effect_units', id));
            await refreshAllDataCallback();
        } catch (error) {
            console.error("[Effect Units] Error deleting:", error);
            alert("効果単位の削除に失敗しました。");
        }
    }
}
export { renderEffectUnitsForManagement as _renderEffectUnitsForManagementInternal };
