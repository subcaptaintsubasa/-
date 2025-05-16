// js/admin-modules/effect-type-manager.js
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, deleteField } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { openModal, closeModal, populateSelect, clearForm } from './ui-helpers.js';

const DOMET = { // DOM elements for Effect Type Management
    newEffectTypeNameInput: null,
    newEffectTypeUnitSelect: null,
    newEffectTypeCalcMethodRadios: null,
    newEffectTypeSumCapInput: null,
    newEffectTypeSumCapGroup: null, // The form-group container for sumCap
    addEffectTypeButton: null,
    effectTypeListContainer: null,
    // Edit Modal Elements
    editEffectTypeModal: null,
    editingEffectTypeDocIdInput: null,
    editingEffectTypeNameInput: null,
    editingEffectTypeUnitSelect: null,
    editingEffectTypeCalcMethodRadios: null,
    editingEffectTypeSumCapInput: null,
    editingEffectTypeSumCapGroup: null,
    saveEffectTypeEditButton: null,
    // Selects that need to be repopulated when effect types change
    itemFormEffectTypeSelect: null,
    charBaseOptionEffectTypeSelect: null,
};

let dbInstance = null;
let getEffectTypesFuncCache = () => [];
let getEffectUnitsFuncCache = () => [];
let getItemsFuncCache = () => [];
let getCharacterBasesFuncCache = () => ({});
let refreshAllDataCallback = async () => {}; // To reload everything

export function initEffectTypeManager(dependencies) {
    dbInstance = dependencies.db;
    getEffectTypesFuncCache = dependencies.getEffectTypes;
    getEffectUnitsFuncCache = dependencies.getEffectUnits;
    getItemsFuncCache = dependencies.getItems;
    getCharacterBasesFuncCache = dependencies.getCharacterBases;
    refreshAllDataCallback = dependencies.refreshAllData;

    DOMET.newEffectTypeNameInput = document.getElementById('newEffectTypeName');
    DOMET.newEffectTypeUnitSelect = document.getElementById('newEffectTypeUnit');
    DOMET.newEffectTypeCalcMethodRadios = document.querySelectorAll('input[name="newCalcMethod"]');
    DOMET.newEffectTypeSumCapInput = document.getElementById('newEffectTypeSumCap');
    if(DOMET.newEffectTypeSumCapInput) DOMET.newEffectTypeSumCapGroup = DOMET.newEffectTypeSumCapInput.closest('.form-group');
    DOMET.addEffectTypeButton = document.getElementById('addEffectTypeButton');
    DOMET.effectTypeListContainer = document.getElementById('effectTypeListContainer');

    DOMET.editEffectTypeModal = document.getElementById('editEffectTypeModal');
    DOMET.editingEffectTypeDocIdInput = document.getElementById('editingEffectTypeDocId');
    DOMET.editingEffectTypeNameInput = document.getElementById('editingEffectTypeName');
    DOMET.editingEffectTypeUnitSelect = document.getElementById('editingEffectTypeUnit');
    DOMET.editingEffectTypeCalcMethodRadios = document.querySelectorAll('input[name="editCalcMethod"]');
    DOMET.editingEffectTypeSumCapInput = document.getElementById('editingEffectTypeSumCap');
    if(DOMET.editingEffectTypeSumCapInput) DOMET.editingEffectTypeSumCapGroup = DOMET.editingEffectTypeSumCapInput.closest('.form-group');
    DOMET.saveEffectTypeEditButton = document.getElementById('saveEffectTypeEditButton');

    DOMET.itemFormEffectTypeSelect = document.getElementById('effectTypeSelect'); // In item form
    DOMET.charBaseOptionEffectTypeSelect = document.getElementById('charBaseOptionEffectTypeSelect'); // In char base option modal

    if (DOMET.addEffectTypeButton) {
        DOMET.addEffectTypeButton.addEventListener('click', addEffectType);
    }
    if (DOMET.saveEffectTypeEditButton) {
        DOMET.saveEffectTypeEditButton.addEventListener('click', saveEffectTypeEdit);
    }

    // SumCap visibility toggling
    [DOMET.newEffectTypeCalcMethodRadios, DOMET.editingEffectTypeCalcMethodRadios].forEach((radioGroup, index) => {
        const sumCapGroup = index === 0 ? DOMET.newEffectTypeSumCapGroup : DOMET.editingEffectTypeSumCapGroup;
        const sumCapInput = index === 0 ? DOMET.newEffectTypeSumCapInput : DOMET.editingEffectTypeSumCapInput;
        if (radioGroup && sumCapGroup) {
            radioGroup.forEach(radio => {
                radio.addEventListener('change', (e) => {
                    sumCapGroup.style.display = (e.target.value === 'sum') ? 'block' : 'none';
                    if (e.target.value !== 'sum' && sumCapInput) {
                        sumCapInput.value = ''; // Clear sumCap if not 'sum'
                    }
                });
            });
            // Initial state
            const initialCalcMethod = Array.from(radioGroup).find(r => r.checked)?.value;
            sumCapGroup.style.display = (initialCalcMethod === 'sum') ? 'block' : 'none';
        }
    });


    renderEffectTypesForManagement();
    populateEffectUnitSelectsForTypeForms(); // Populates unit selects in add/edit forms
    _populateEffectTypeSelectsInternal(); // Populates selects that list effect types
}

function populateEffectUnitSelectsForTypeForms() {
    const effectUnitsCache = getEffectUnitsFuncCache();
    const options = [{ value: 'none', text: 'なし' }, ...effectUnitsCache.map(u => ({ value: u.name, text: u.name }))];
    populateSelect(DOMET.newEffectTypeUnitSelect, options, null, 'none'); // No "Select..." default, default to 'none'
    populateSelect(DOMET.editingEffectTypeUnitSelect, options, null, 'none');
}

function _populateEffectTypeSelectsInternal() { // Renamed to avoid conflict if exported directly
    const effectTypesCache = getEffectTypesFuncCache();
    const options = effectTypesCache.map(et => ({ value: et.id, text: et.name }));
    populateSelect(DOMET.itemFormEffectTypeSelect, options, '効果種類を選択...');
    populateSelect(DOMET.charBaseOptionEffectTypeSelect, options, '効果種類を選択...');
}


function renderEffectTypesForManagement() {
    if (!DOMET.effectTypeListContainer) return;
    const effectTypesCache = getEffectTypesFuncCache();
    DOMET.effectTypeListContainer.innerHTML = '';

    if (effectTypesCache.length === 0) {
        DOMET.effectTypeListContainer.innerHTML = '<p>効果種類が登録されていません。</p>';
        return;
    }
    effectTypesCache.forEach(effectType => {
        const unitText = effectType.defaultUnit && effectType.defaultUnit !== 'none' ? `(${effectType.defaultUnit})` : '(単位なし)';
        const calcText = effectType.calculationMethod === 'max' ? '(最大値)' : '(加算)';
        let sumCapText = '';
        if (effectType.calculationMethod === 'sum' && typeof effectType.sumCap === 'number' && !isNaN(effectType.sumCap)) {
            sumCapText = ` (上限: ${effectType.sumCap})`;
        }

        const div = document.createElement('div');
        div.classList.add('list-item');
        div.innerHTML = `
            <span>${effectType.name} <small style="color:#555;">${unitText} ${calcText}${sumCapText}</small></span>
            <div>
                <button class="edit-effect-type action-button" data-id="${effectType.id}" title="編集">✎</button>
                <button class="delete-effect-type action-button delete" data-id="${effectType.id}" data-name="${effectType.name}" title="削除">×</button>
            </div>
        `;
        DOMET.effectTypeListContainer.appendChild(div);
    });

    DOMET.effectTypeListContainer.querySelectorAll('.edit-effect-type').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const effectTypeId = e.currentTarget.dataset.id;
            openEditEffectTypeModalById(effectTypeId);
        });
    });
    DOMET.effectTypeListContainer.querySelectorAll('.delete-effect-type').forEach(btn => {
        btn.addEventListener('click', (e) => {
            deleteEffectType(e.currentTarget.dataset.id, e.currentTarget.dataset.name);
        });
    });
}

async function addEffectType() {
    const name = DOMET.newEffectTypeNameInput.value.trim();
    const unit = DOMET.newEffectTypeUnitSelect.value;
    const calcMethodRadio = Array.from(DOMET.newEffectTypeCalcMethodRadios).find(r => r.checked);
    const calcMethod = calcMethodRadio ? calcMethodRadio.value : 'sum';
    const sumCapStr = DOMET.newEffectTypeSumCapInput.value.trim();
    const effectTypesCache = getEffectTypesFuncCache();

    if (!name) { alert("効果種類名を入力してください。"); return; }
    if (effectTypesCache.some(et => et.name.toLowerCase() === name.toLowerCase())) {
        alert("同じ名前の効果種類が既に存在します。"); return;
    }

    const effectData = {
        name: name,
        defaultUnit: unit,
        calculationMethod: calcMethod,
        createdAt: serverTimestamp()
    };

    if (calcMethod === 'sum' && sumCapStr !== "") {
        const sumCap = parseFloat(sumCapStr);
        if (!isNaN(sumCap) && sumCap >= 0) {
            effectData.sumCap = sumCap;
        } else {
            alert("加算時の最大値は0以上の数値を入力してください。"); return;
        }
    }

    try {
        await addDoc(collection(dbInstance, 'effect_types'), effectData);
        clearForm(DOMET.newEffectTypeNameInput.closest('section')); // Clear relevant part of form
        // Reset sumCap visibility for new form
        if (DOMET.newEffectTypeSumCapGroup && DOMET.newEffectTypeCalcMethodRadios.length > 0) {
            DOMET.newEffectTypeSumCapGroup.style.display = (DOMET.newEffectTypeCalcMethodRadios[0].value === 'sum') ? 'block' : 'none';
             if (DOMET.newEffectTypeCalcMethodRadios[0].value !== 'sum' && DOMET.newEffectTypeSumCapInput) {
                 DOMET.newEffectTypeSumCapInput.value = '';
             }
        }

        await refreshAllDataCallback(); // This will re-render lists and repopulate selects
    } catch (error) {
        console.error("[Effect Types] Error adding:", error);
        alert("効果種類の追加に失敗しました。");
    }
}

function openEditEffectTypeModalById(effectTypeId) {
    const effectTypesCache = getEffectTypesFuncCache();
    const effectTypeData = effectTypesCache.find(et => et.id === effectTypeId);
    if (!effectTypeData) {
        alert("編集する効果種類のデータが見つかりません。"); return;
    }

    DOMET.editingEffectTypeDocIdInput.value = effectTypeData.id;
    DOMET.editingEffectTypeNameInput.value = effectTypeData.name;
    // Unit select already populated by populateEffectUnitSelectsForTypeForms
    DOMET.editingEffectTypeUnitSelect.value = effectTypeData.defaultUnit || 'none';

    const calcMethod = effectTypeData.calculationMethod || 'sum';
    const radioToCheck = Array.from(DOMET.editingEffectTypeCalcMethodRadios).find(r => r.value === calcMethod);
    if (radioToCheck) radioToCheck.checked = true;
    else if (DOMET.editingEffectTypeCalcMethodRadios[0]) DOMET.editingEffectTypeCalcMethodRadios[0].checked = true;

    DOMET.editingEffectTypeSumCapInput.value = (typeof effectTypeData.sumCap === 'number' && !isNaN(effectTypeData.sumCap)) ? effectTypeData.sumCap : '';
    if(DOMET.editingEffectTypeSumCapGroup) {
        DOMET.editingEffectTypeSumCapGroup.style.display = (calcMethod === 'sum') ? 'block' : 'none';
    }


    openModal('editEffectTypeModal');
    DOMET.editingEffectTypeNameInput.focus();
}

async function saveEffectTypeEdit() {
    const id = DOMET.editingEffectTypeDocIdInput.value;
    const newName = DOMET.editingEffectTypeNameInput.value.trim();
    const newUnit = DOMET.editingEffectTypeUnitSelect.value;
    const editCalcMethodRadio = Array.from(DOMET.editingEffectTypeCalcMethodRadios).find(r => r.checked);
    const newCalcMethod = editCalcMethodRadio ? editCalcMethodRadio.value : 'sum';
    const newSumCapStr = DOMET.editingEffectTypeSumCapInput.value.trim();
    const effectTypesCache = getEffectTypesFuncCache();

    if (!newName) { alert("効果種類名は空にできません。"); return; }
    if (effectTypesCache.some(et => et.id !== id && et.name.toLowerCase() === newName.toLowerCase())) {
        alert("編集後の名前が他の効果種類と重複します。"); return;
    }

    const updateData = {
        name: newName,
        defaultUnit: newUnit,
        calculationMethod: newCalcMethod,
        updatedAt: serverTimestamp()
    };

    if (newCalcMethod === 'sum') {
        if (newSumCapStr !== "") {
            const sumCap = parseFloat(newSumCapStr);
            if (!isNaN(sumCap) && sumCap >= 0) {
                updateData.sumCap = sumCap;
            } else {
                alert("加算時の最大値は0以上の数値を入力してください。"); return;
            }
        } else {
            updateData.sumCap = deleteField(); // Remove sumCap if empty
        }
    } else {
        updateData.sumCap = deleteField(); // Remove sumCap if not 'sum'
    }

    try {
        await updateDoc(doc(dbInstance, 'effect_types', id), updateData);
        closeModal('editEffectTypeModal');
        await refreshAllDataCallback();
    } catch (error) {
        console.error("[Effect Types] Error updating:", error);
        alert("効果種類の更新に失敗しました。");
    }
}

async function deleteEffectType(id, name) {
    const itemsCache = getItemsFuncCache();
    const charBasesCache = getCharacterBasesFuncCache();

    // Check usage in items
    const usedByItem = itemsCache.find(item => item.structured_effects && item.structured_effects.some(eff => eff.type === id));
    if (usedByItem) {
        alert(`効果種類「${name}」はアイテム「${usedByItem.name}」で使用されているため削除できません。`);
        return;
    }
    // Check usage in character bases
    for (const baseKey in charBasesCache) {
        const usedInBase = (charBasesCache[baseKey] || []).find(option =>
            option.effects && option.effects.some(eff => eff.type === id)
        );
        if (usedInBase) {
            alert(`効果種類「${name}」はキャラクター基礎情報「${baseKey} - ${usedInBase.name}」で使用されているため削除できません。`);
            return;
        }
    }

    if (confirm(`効果種類「${name}」を削除しますか？\nこの操作は元に戻せません。`)) {
        try {
            await deleteDoc(doc(dbInstance, 'effect_types', id));
            await refreshAllDataCallback();
        } catch (error) {
            console.error("[Effect Types] Error deleting:", error);
            alert("効果種類の削除に失敗しました。");
        }
    }
}

export { renderEffectTypesForManagement as _renderEffectTypesForManagementInternal, _populateEffectTypeSelectsInternal };
