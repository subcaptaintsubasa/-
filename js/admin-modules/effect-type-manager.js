// js/admin-modules/effect-type-manager.js
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, deleteField } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { openModal, closeModal, populateSelect } from './ui-helpers.js'; // Removed clearForm as form clearing is handled more specifically

const DOMET = {
    newEffectTypeNameInput: null,
    newEffectTypeUnitSelect: null,
    newEffectTypeCalcMethodRadios: null,
    newEffectTypeSumCapInput: null,
    newEffectTypeSumCapGroup: null,
    addEffectTypeButton: null,
    effectTypeListContainer: null,
    editEffectTypeModal: null,
    editingEffectTypeDocIdInput: null,
    editingEffectTypeNameInput: null,
    editingEffectTypeUnitSelect: null,
    editingEffectTypeCalcMethodRadios: null,
    editingEffectTypeSumCapInput: null,
    editingEffectTypeSumCapGroup: null,
    saveEffectTypeEditButton: null,
    // Selects in other forms that list effect types
    itemFormEffectTypeSelect: null,
    charBaseOptionEffectTypeSelect: null,
};

let dbInstance = null;
let getEffectTypesFuncCache = () => [];
let getEffectUnitsFuncCache = () => [];
let getItemsFuncCache = () => [];
let getCharacterBasesFuncCache = () => ({});
// import { baseTypeMappings } from './char-base-manager.js'; // If needed for delete checks
let refreshAllDataCallback = async () => {};

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

    DOMET.itemFormEffectTypeSelect = document.getElementById('effectTypeSelect');
    DOMET.charBaseOptionEffectTypeSelect = document.getElementById('charBaseOptionEffectTypeSelect');

    if (DOMET.addEffectTypeButton) {
        DOMET.addEffectTypeButton.addEventListener('click', addEffectType);
    }
    if (DOMET.saveEffectTypeEditButton) {
        DOMET.saveEffectTypeEditButton.addEventListener('click', saveEffectTypeEdit);
    }

    [
        { radios: DOMET.newEffectTypeCalcMethodRadios, group: DOMET.newEffectTypeSumCapGroup, input: DOMET.newEffectTypeSumCapInput },
        { radios: DOMET.editingEffectTypeCalcMethodRadios, group: DOMET.editingEffectTypeSumCapGroup, input: DOMET.editingEffectTypeSumCapInput }
    ].forEach(({ radios, group, input }) => {
        if (radios && group) {
            radios.forEach(radio => {
                radio.addEventListener('change', (e) => {
                    group.style.display = (e.target.value === 'sum') ? 'block' : 'none';
                    if (e.target.value !== 'sum' && input) input.value = '';
                });
            });
            // Initial state check
            const initialCalcMethod = Array.from(radios).find(r => r.checked)?.value;
            group.style.display = (initialCalcMethod === 'sum') ? 'block' : 'none';
            if (initialCalcMethod !== 'sum' && input) input.value = '';
        }
    });
    console.log("[Effect Type Manager] Initialized.");
}

function populateEffectUnitSelectsForTypeFormsUI() {
    const effectUnitsCache = getEffectUnitsFuncCache();
    const options = [{ value: 'none', text: 'なし' }, ...effectUnitsCache.map(u => ({ value: u.name, text: u.name }))];
    populateSelect(DOMET.newEffectTypeUnitSelect, options, null, 'none');
    populateSelect(DOMET.editingEffectTypeUnitSelect, options, null, 'none');
}

export function _populateEffectTypeSelectsInternal() {
    const effectTypesCache = getEffectTypesFuncCache();
    const options = effectTypesCache.map(et => ({ value: et.id, text: et.name })).sort((a,b) => a.text.localeCompare(b.text, 'ja'));
    populateSelect(DOMET.itemFormEffectTypeSelect, options, '効果種類を選択...');
    populateSelect(DOMET.charBaseOptionEffectTypeSelect, options, '効果種類を選択...');
    console.log("[Effect Type Manager] Effect type selects in other forms populated.");
}

export function _renderEffectTypesForManagementInternal() { // Renamed
    if (!DOMET.effectTypeListContainer) return;
    const effectTypesCache = getEffectTypesFuncCache();
    DOMET.effectTypeListContainer.innerHTML = '';

    if (effectTypesCache.length === 0) {
        DOMET.effectTypeListContainer.innerHTML = '<p>効果種類が登録されていません。</p>';
        populateEffectUnitSelectsForTypeFormsUI(); // Ensure unit select is populated for add form
        return;
    }

    const sortedEffectTypes = [...effectTypesCache].sort((a,b) => a.name.localeCompare(b.name, 'ja'));

    sortedEffectTypes.forEach(effectType => {
        const unitText = effectType.defaultUnit && effectType.defaultUnit !== 'none' ? `(${effectType.defaultUnit})` : '(単位なし)';
        const calcText = effectType.calculationMethod === 'max' ? '(最大値)' : '(加算)';
        let sumCapText = '';
        if (effectType.calculationMethod === 'sum' && typeof effectType.sumCap === 'number' && !isNaN(effectType.sumCap)) {
            sumCapText = ` (上限: ${effectType.sumCap})`;
        }

        const div = document.createElement('div');
        div.classList.add('list-item');
        div.innerHTML = `
            <span>${effectType.name} <small>${unitText} ${calcText}${sumCapText}</small></span>
            <div>
                <button class="edit-effect-type action-button" data-id="${effectType.id}" title="編集">✎</button>
                <button class="delete-effect-type action-button delete" data-id="${effectType.id}" data-name="${effectType.name}" title="削除">×</button>
            </div>
        `;
        DOMET.effectTypeListContainer.appendChild(div);
    });

    DOMET.effectTypeListContainer.querySelectorAll('.edit-effect-type').forEach(btn => {
        btn.addEventListener('click', (e) => openEditEffectTypeModalById(e.currentTarget.dataset.id));
    });
    DOMET.effectTypeListContainer.querySelectorAll('.delete-effect-type').forEach(btn => {
        btn.addEventListener('click', (e) => deleteEffectType(e.currentTarget.dataset.id, e.currentTarget.dataset.name));
    });

    populateEffectUnitSelectsForTypeFormsUI(); // Populate unit select in "add new" form
    console.log("[Effect Type Manager] Effect types rendered for management.");
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
    } // If not 'sum' or sumCapStr is empty, sumCap field is not added

    try {
        await addDoc(collection(dbInstance, 'effect_types'), effectData);
        
        DOMET.newEffectTypeNameInput.value = '';
        DOMET.newEffectTypeUnitSelect.value = 'none';
        if(DOMET.newEffectTypeCalcMethodRadios[0]) DOMET.newEffectTypeCalcMethodRadios[0].checked = true;
        DOMET.newEffectTypeSumCapInput.value = '';
        if (DOMET.newEffectTypeSumCapGroup) { // Reset visibility
             DOMET.newEffectTypeSumCapGroup.style.display = (DOMET.newEffectTypeCalcMethodRadios[0].value === 'sum') ? 'block' : 'none';
        }

        await refreshAllDataCallback();
    } catch (error) {
        console.error("[Effect Type Manager] Error adding effect type:", error);
        alert("効果種類の追加に失敗しました。");
    }
}

function openEditEffectTypeModalById(effectTypeId) {
    const effectTypesCache = getEffectTypesFuncCache();
    const effectTypeData = effectTypesCache.find(et => et.id === effectTypeId);
    if (!effectTypeData) { alert("編集する効果種類のデータが見つかりません。"); return; }

    DOMET.editingEffectTypeDocIdInput.value = effectTypeData.id;
    DOMET.editingEffectTypeNameInput.value = effectTypeData.name;
    DOMET.editingEffectTypeUnitSelect.value = effectTypeData.defaultUnit || 'none'; // Unit select is populated by _renderEffectTypesForManagementInternal

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
            updateData.sumCap = deleteField();
        }
    } else {
        updateData.sumCap = deleteField();
    }

    try {
        await updateDoc(doc(dbInstance, 'effect_types', id), updateData);
        closeModal('editEffectTypeModal');
        await refreshAllDataCallback();
    } catch (error) {
        console.error("[Effect Type Manager] Error updating effect type:", error);
        alert("効果種類の更新に失敗しました。");
    }
}

async function deleteEffectType(id, name) {
    const itemsCache = getItemsFuncCache();
    const charBasesCache = getCharacterBasesFuncCache();
    // const baseTypeMappingsData = (await import('./char-base-manager.js')).baseTypeMappings; // For more descriptive names

    const usedByItem = itemsCache.find(item => item.structured_effects && item.structured_effects.some(eff => eff.type === id));
    if (usedByItem) {
        alert(`効果種類「${name}」はアイテム「${usedByItem.name}」で使用されているため削除できません。`); return;
    }
    for (const baseKey in charBasesCache) {
        const usedInBase = (charBasesCache[baseKey] || []).find(option =>
            option.effects && option.effects.some(eff => eff.type === id)
        );
        if (usedInBase) {
            // const typeDisplayName = baseTypeMappingsData[baseKey] || baseKey;
            alert(`効果種類「${name}」はキャラクター基礎情報「${baseKey} - ${usedInBase.name}」で使用されているため削除できません。`); return;
        }
    }

    if (confirm(`効果種類「${name}」を削除しますか？\nこの操作は元に戻せません。`)) {
        try {
            await deleteDoc(doc(dbInstance, 'effect_types', id));
            await refreshAllDataCallback();
        } catch (error) {
            console.error("[Effect Type Manager] Error deleting effect type:", error);
            alert("効果種類の削除に失敗しました。");
        }
    }
}
