// js/admin-modules/effect-type-manager.js
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, deleteField } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { openModal, closeModal, populateSelect } from './ui-helpers.js';

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
    deleteEffectTypeFromEditModalButton: null, 
    itemFormEffectTypeSelect: null,
    charBaseOptionEffectTypeSelect: null,
};

let dbInstance = null;
let getEffectTypesFuncCache = () => [];
let getEffectUnitsFuncCache = () => []; 
let getItemsFuncCache = () => [];
let getCharacterBasesFuncCache = () => ({});
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
    DOMET.newEffectTypeSumCapGroup = document.getElementById('newEffectTypeSumCapGroup'); 
    DOMET.addEffectTypeButton = document.getElementById('addEffectTypeButton');
    DOMET.effectTypeListContainer = document.getElementById('effectTypeListContainer');

    DOMET.editEffectTypeModal = document.getElementById('editEffectTypeModal');
    DOMET.editingEffectTypeDocIdInput = document.getElementById('editingEffectTypeDocId');
    DOMET.editingEffectTypeNameInput = document.getElementById('editingEffectTypeName');
    DOMET.editingEffectTypeUnitSelect = document.getElementById('editingEffectTypeUnit');
    DOMET.editingEffectTypeCalcMethodRadios = document.querySelectorAll('input[name="editCalcMethod"]');
    DOMET.editingEffectTypeSumCapInput = document.getElementById('editingEffectTypeSumCap');
    DOMET.editingEffectTypeSumCapGroup = document.getElementById('editingEffectTypeSumCapGroup'); 
    DOMET.saveEffectTypeEditButton = document.getElementById('saveEffectTypeEditButton');
    DOMET.deleteEffectTypeFromEditModalButton = document.getElementById('deleteEffectTypeFromEditModalButton');

    DOMET.itemFormEffectTypeSelect = document.getElementById('effectTypeSelect');
    DOMET.charBaseOptionEffectTypeSelect = document.getElementById('charBaseOptionEffectTypeSelect');

    if (DOMET.addEffectTypeButton) {
        DOMET.addEffectTypeButton.addEventListener('click', addEffectType);
    }
    if (DOMET.saveEffectTypeEditButton) {
        DOMET.saveEffectTypeEditButton.addEventListener('click', saveEffectTypeEdit);
    }
    if (DOMET.deleteEffectTypeFromEditModalButton) {
        DOMET.deleteEffectTypeFromEditModalButton.addEventListener('click', () => {
            const typeId = DOMET.editingEffectTypeDocIdInput.value;
            const type = getEffectTypesFuncCache().find(et => et.id === typeId);
            if (typeId && type) {
                deleteEffectType(typeId, type.name);
            } else {
                alert("削除対象の効果種類IDが見つかりません。");
            }
        });
    }

    if (DOMET.effectTypeListContainer) {
        DOMET.effectTypeListContainer.addEventListener('click', handleEffectTypeListClick);
    }

    [
        { radios: DOMET.newEffectTypeCalcMethodRadios, group: DOMET.newEffectTypeSumCapGroup, input: DOMET.newEffectTypeSumCapInput, sumRadioId: 'newCalcMethodSum' },
        { radios: DOMET.editingEffectTypeCalcMethodRadios, group: DOMET.editingEffectTypeSumCapGroup, input: DOMET.editingEffectTypeSumCapInput, sumRadioId: 'editCalcMethodSum' }
    ].forEach(({ radios, group, input, sumRadioId }) => {
        if (radios && group) {
            radios.forEach(radio => {
                radio.addEventListener('change', (e) => {
                    const sumRadio = document.getElementById(sumRadioId);
                    if (sumRadio) {
                        group.style.display = (sumRadio.checked) ? 'block' : 'none';
                        if (!sumRadio.checked && input) input.value = '';
                    }
                });
            });
            const initialSumRadio = document.getElementById(sumRadioId);
            if (initialSumRadio) {
                group.style.display = (initialSumRadio.checked) ? 'block' : 'none';
            }
        }
    });
    console.log("[Effect Type Manager] Initialized.");
}

function populateEffectUnitSelectsForTypeFormsUI() {
    const effectUnitsCache = getEffectUnitsFuncCache();
    const options = [{ value: '', text: '単位なし' }, ...effectUnitsCache.map(u => ({ value: u.name, text: u.name })).sort((a,b) => a.text.localeCompare(b.text, 'ja'))];
    
    populateSelect(DOMET.newEffectTypeUnitSelect, options, null, ''); 
    populateSelect(DOMET.editingEffectTypeUnitSelect, options, null, '');
}

export function _populateEffectTypeSelectsInternal() { 
    const effectTypesCache = getEffectTypesFuncCache();
    const options = effectTypesCache.map(et => ({ 
        value: et.id, 
        text: et.name,
        'data-unit-name': et.defaultUnit || '', // Store unit name for easy access by other JS
        'data-calc-method': et.calculationMethod || 'sum',
        'data-sum-cap': (et.sumCap !== undefined && et.sumCap !== null) ? String(et.sumCap) : ''
    })).sort((a,b) => a.text.localeCompare(b.text, 'ja'));
    
    populateSelect(DOMET.itemFormEffectTypeSelect, options, '効果種類を選択...');
    populateSelect(DOMET.charBaseOptionEffectTypeSelect, options, '効果種類を選択...');
    console.log("[Effect Type Manager] Effect type selects in other forms populated.");
}

export function _renderEffectTypesForManagementInternal() {
    if (!DOMET.effectTypeListContainer) return;
    const effectTypesCache = getEffectTypesFuncCache();
    DOMET.effectTypeListContainer.innerHTML = '';

    if (effectTypesCache.length === 0) {
        DOMET.effectTypeListContainer.innerHTML = '<p>効果種類が登録されていません。</p>';
        populateEffectUnitSelectsForTypeFormsUI();
        return;
    }

    const sortedEffectTypes = [...effectTypesCache].sort((a,b) => a.name.localeCompare(b.name, 'ja'));

    sortedEffectTypes.forEach(effectType => {
        const unitName = effectType.defaultUnit && effectType.defaultUnit !== '' ? effectType.defaultUnit : "なし";
        const unitText = `(${unitName})`;
        const calcText = effectType.calculationMethod === 'max' ? '(最大値)' : '(加算)';
        let sumCapText = '';
        if (effectType.calculationMethod === 'sum' && typeof effectType.sumCap === 'number' && !isNaN(effectType.sumCap)) {
            sumCapText = ` (上限: ${effectType.sumCap})`;
        }

        const div = document.createElement('div');
        div.classList.add('list-item');
        div.innerHTML = `
            <span class="list-item-name-clickable" data-id="${effectType.id}" data-action="edit">${effectType.name} <small>${unitText} ${calcText}${sumCapText}</small></span>
            <div class="list-item-actions">
            </div>
        `;
        DOMET.effectTypeListContainer.appendChild(div);
    });
    
    populateEffectUnitSelectsForTypeFormsUI();
    console.log("[Effect Type Manager] Effect types rendered for management.");
}

function handleEffectTypeListClick(event) {
    const target = event.target;
    const clickableName = target.closest('.list-item-name-clickable[data-id]');
    
    if (clickableName && clickableName.dataset.action === 'edit') {
        const typeId = clickableName.dataset.id;
        openEditEffectTypeModalById(typeId);
    }
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
        defaultUnit: unit === '' ? null : unit, 
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
        
        DOMET.newEffectTypeNameInput.value = '';
        DOMET.newEffectTypeUnitSelect.value = ''; 
        if(DOMET.newEffectTypeCalcMethodRadios[0]) DOMET.newEffectTypeCalcMethodRadios[0].checked = true; 
        DOMET.newEffectTypeSumCapInput.value = '';
        if (DOMET.newEffectTypeSumCapGroup) {
             DOMET.newEffectTypeSumCapGroup.style.display = 'block'; 
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
    DOMET.editingEffectTypeUnitSelect.value = effectTypeData.defaultUnit || ''; 

    const calcMethod = effectTypeData.calculationMethod || 'sum';
    const radioToCheck = Array.from(DOMET.editingEffectTypeCalcMethodRadios).find(r => r.value === calcMethod);
    if (radioToCheck) radioToCheck.checked = true;
    else if (DOMET.editingEffectTypeCalcMethodRadios[0]) DOMET.editingEffectTypeCalcMethodRadios[0].checked = true;

    DOMET.editingEffectTypeSumCapInput.value = (typeof effectTypeData.sumCap === 'number' && !isNaN(effectTypeData.sumCap)) ? String(effectTypeData.sumCap) : '';
    if(DOMET.editingEffectTypeSumCapGroup) {
        const sumRadio = document.getElementById('editCalcMethodSum'); // Get the specific sum radio
        DOMET.editingEffectTypeSumCapGroup.style.display = (sumRadio && sumRadio.checked) ? 'block' : 'none';
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
        defaultUnit: newUnit === '' ? null : newUnit,
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

    const usedByItem = itemsCache.find(item => item.structured_effects && item.structured_effects.some(eff => eff.type === id)); // eff.type is typeId
    if (usedByItem) {
        alert(`効果種類「${name}」はアイテム「${usedByItem.name}」の効果で使用されているため削除できません。`); return;
    }
    for (const baseKey in charBasesCache) {
        const usedInBase = (charBasesCache[baseKey] || []).find(option =>
            option.effects && option.effects.some(eff => eff.type === id) // eff.type is typeId
        );
        if (usedInBase) {
            alert(`効果種類「${name}」はキャラクター基礎情報「${baseKey} - ${usedInBase.name}」の効果で使用されているため削除できません。`); return;
        }
    }

    if (confirm(`効果種類「${name}」を削除しますか？\nこの操作は元に戻せません。`)) {
        try {
            await deleteDoc(doc(dbInstance, 'effect_types', id));
            closeModal('editEffectTypeModal'); 
            await refreshAllDataCallback();
        } catch (error) {
            console.error("[Effect Type Manager] Error deleting effect type:", error);
            alert("効果種類の削除に失敗しました。");
        }
    }
}
