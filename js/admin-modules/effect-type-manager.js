// js/admin-modules/effect-type-manager.js
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, deleteField } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { openModal, closeModal, populateSelect } from './ui-helpers.js';

const DOMET = {
    newEffectTypeNameInput: null,
    newEffectTypeSuperCategorySelect: null,
    newEffectTypeUnitSelect: null,
    newEffectTypeCalcMethodRadios: null,
    newEffectTypeSumCapInput: null,
    newEffectTypeSumCapGroup: null,
    addEffectTypeButton: null,
    effectTypeListContainer: null,
    editEffectTypeModal: null,
    editingEffectTypeDocIdInput: null,
    editingEffectTypeNameInput: null,
    editingEffectTypeSuperCategorySelect: null,
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
let getEffectSuperCategoriesFuncCache = () => [];
let getItemsFuncCache = () => [];
let getCharacterBasesFuncCache = () => ({});
let refreshAllDataCallback = async () => {};
// let openEnlargedListModalCallbackFromMain = (config) => {}; // Not directly used by this manager

export function initEffectTypeManager(dependencies) {
    dbInstance = dependencies.db;
    getEffectTypesFuncCache = dependencies.getEffectTypes;
    getEffectUnitsFuncCache = dependencies.getEffectUnits;
    getEffectSuperCategoriesFuncCache = dependencies.getEffectSuperCategories;
    getItemsFuncCache = dependencies.getItems;
    getCharacterBasesFuncCache = dependencies.getCharacterBases;
    refreshAllDataCallback = dependencies.refreshAllData;
    // openEnlargedListModalCallbackFromMain = dependencies.openEnlargedListModal;

    DOMET.newEffectTypeNameInput = document.getElementById('newEffectTypeName');
    DOMET.newEffectTypeSuperCategorySelect = document.getElementById('newEffectTypeSuperCategory');
    DOMET.newEffectTypeUnitSelect = document.getElementById('newEffectTypeUnit');
    DOMET.newEffectTypeCalcMethodRadios = document.querySelectorAll('input[name="newCalcMethod"]');
    DOMET.newEffectTypeSumCapInput = document.getElementById('newEffectTypeSumCap');
    DOMET.newEffectTypeSumCapGroup = document.getElementById('newEffectTypeSumCapGroup');
    DOMET.addEffectTypeButton = document.getElementById('addEffectTypeButton');
    DOMET.effectTypeListContainer = document.getElementById('effectTypeListContainer');

    DOMET.editEffectTypeModal = document.getElementById('editEffectTypeModal');
    DOMET.editingEffectTypeDocIdInput = document.getElementById('editingEffectTypeDocId');
    DOMET.editingEffectTypeNameInput = document.getElementById('editingEffectTypeName');
    DOMET.editingEffectTypeSuperCategorySelect = document.getElementById('editingEffectTypeSuperCategory');
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
            const name = type ? type.name : DOMET.editingEffectTypeNameInput.value;

            if (typeId && name) {
                deleteEffectType(typeId, name);
            } else if (!typeId) {
                alert("削除対象の効果種類IDが見つかりません。");
            } else {
                 alert("削除対象の効果種類名が不明です。");
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
        if (radios && group && input) {
            radios.forEach(radio => {
                radio.addEventListener('change', () => {
                    const sumRadioEl = document.getElementById(sumRadioId);
                    if (sumRadioEl) {
                        group.style.display = (sumRadioEl.checked) ? 'block' : 'none';
                        if (!sumRadioEl.checked) input.value = '';
                    }
                });
            });
            const initialSumRadio = document.getElementById(sumRadioId);
            if (initialSumRadio) {
               group.style.display = (initialSumRadio.checked) ? 'block' : 'none';
               if(!initialSumRadio.checked) input.value = '';
            } else if (group) {
                group.style.display = 'none';
                if (input) input.value = '';
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

function populateSuperCategorySelects() {
    const superCategories = getEffectSuperCategoriesFuncCache() || [];
    const options = superCategories.map(sc => ({ value: sc.id, text: sc.name })).sort((a,b) => a.text.localeCompare(b.text, 'ja'));
    populateSelect(DOMET.newEffectTypeSuperCategorySelect, options, '大分類を選択...');
    populateSelect(DOMET.editingEffectTypeSuperCategorySelect, options, '大分類を選択...');
}

export function _populateEffectTypeSelectsInternal() {
    const effectTypesCache = getEffectTypesFuncCache();
    const superCategoriesCache = getEffectSuperCategoriesFuncCache() || [];

    if (DOMET.itemFormEffectTypeSelect) {
        const selectElement = DOMET.itemFormEffectTypeSelect;
        const currentValue = selectElement.value;
        selectElement.innerHTML = '<option value="">効果種類を選択...</option>';
        const sortedSuperCats = [...superCategoriesCache].sort((a,b) => a.name.localeCompare(b.name, 'ja'));
        sortedSuperCats.forEach(superCat => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = superCat.name;
            effectTypesCache.filter(et => et.superCategoryId === superCat.id).sort((a,b) => a.name.localeCompare(b.name, 'ja'))
                .forEach(et => {
                    const option = document.createElement('option');
                    option.value = et.id; option.textContent = et.name;
                    option.dataset.unitName = (et.defaultUnit && et.defaultUnit !== 'none') ? et.defaultUnit : '';
                    optgroup.appendChild(option);
                });
            if (optgroup.childElementCount > 0) selectElement.appendChild(optgroup);
        });
        const unclassifiedTypes = effectTypesCache.filter(et => !et.superCategoryId || !superCategoriesCache.some(sc => sc.id === et.superCategoryId)).sort((a,b) => a.name.localeCompare(b.name, 'ja'));
        if (unclassifiedTypes.length > 0) {
            const unclassifiedOptgroup = document.createElement('optgroup');
            unclassifiedOptgroup.label = superCategoriesCache.length > 0 ? "未分類" : "効果種類";
            unclassifiedTypes.forEach(et => {
                const option = document.createElement('option');
                option.value = et.id; option.textContent = et.name;
                option.dataset.unitName = (et.defaultUnit && et.defaultUnit !== 'none') ? et.defaultUnit : '';
                unclassifiedOptgroup.appendChild(option);
            });
             if (unclassifiedOptgroup.childElementCount > 0) selectElement.appendChild(unclassifiedOptgroup);
        }
        if (currentValue && Array.from(selectElement.options).some(opt => opt.value === currentValue)) {
            selectElement.value = currentValue;
        }
    }
}

function buildEffectTypeListDOM() {
    const effectTypesCache = getEffectTypesFuncCache();
    const superCategoriesCache = getEffectSuperCategoriesFuncCache() || [];
    if (!effectTypesCache || effectTypesCache.length === 0) {
        const p = document.createElement('p');
        p.textContent = '効果種類が登録されていません。';
        return p;
    }
    const fragment = document.createDocumentFragment();
    const typesBySuperCategory = new Map();
    const unclassifiedTypes = [];

    effectTypesCache.forEach(type => {
        if (type.superCategoryId && superCategoriesCache.some(sc => sc.id === type.superCategoryId)) {
            if (!typesBySuperCategory.has(type.superCategoryId)) typesBySuperCategory.set(type.superCategoryId, []);
            typesBySuperCategory.get(type.superCategoryId).push(type);
        } else {
            unclassifiedTypes.push(type);
        }
    });

    let hasRenderedContent = false;
    const sortedSuperCats = [...superCategoriesCache].sort((a,b) => a.name.localeCompare(b.name, 'ja'));

    sortedSuperCats.forEach(superCat => {
        const typesInThisSuperCat = (typesBySuperCategory.get(superCat.id) || []).sort((a,b) => a.name.localeCompare(b.name, 'ja'));
        if (typesInThisSuperCat.length > 0) {
            hasRenderedContent = true;
            const groupDiv = document.createElement('div');
            groupDiv.classList.add('effect-super-category-group');
            const groupHeader = document.createElement('h5');
            groupHeader.classList.add('effect-super-category-header');
            groupHeader.textContent = `${superCat.name}`; // Removed colon
            groupDiv.appendChild(groupHeader);
            typesInThisSuperCat.forEach(effectType => appendEffectTypeToList(effectType, groupDiv));
            fragment.appendChild(groupDiv);
        }
    });

    if (unclassifiedTypes.length > 0) {
        hasRenderedContent = true;
        const groupDiv = document.createElement('div');
        groupDiv.classList.add('effect-super-category-group');
        const groupHeader = document.createElement('h5');
        groupHeader.classList.add('effect-super-category-header');
        groupHeader.textContent = superCategoriesCache.length > 0 ? '未分類の効果種類' : '効果種類'; // Removed colon
        groupDiv.appendChild(groupHeader);
        unclassifiedTypes.sort((a,b) => a.name.localeCompare(b.name, 'ja')).forEach(effectType => {
            appendEffectTypeToList(effectType, groupDiv);
        });
        fragment.appendChild(groupDiv);
    }

    if (!hasRenderedContent && effectTypesCache.length > 0) {
         const p = document.createElement('p');
         p.textContent = '表示できるグループ化された効果種類はありません（データ不整合の可能性）。';
         fragment.appendChild(p);
    }
    return fragment.childNodes.length > 0 ? fragment : null;
}

export function _renderEffectTypesForManagementInternal() {
    if (!DOMET.effectTypeListContainer) return;
    DOMET.effectTypeListContainer.innerHTML = '';
    const listContent = buildEffectTypeListDOM();
    if (listContent && (listContent.childNodes.length > 0 || listContent.nodeName === 'P')) {
        DOMET.effectTypeListContainer.appendChild(listContent);
    } else {
        DOMET.effectTypeListContainer.innerHTML = '<p>効果種類が登録されていません。</p>';
    }
    populateEffectUnitSelectsForTypeFormsUI();
    populateSuperCategorySelects();
}

function appendEffectTypeToList(effectType, containerElement) {
    const unitText = effectType.defaultUnit && effectType.defaultUnit !== '' && effectType.defaultUnit !== 'none' ? `(${effectType.defaultUnit})` : '(単位なし)';
    const calcText = effectType.calculationMethod === 'max' ? '(最大値)' : '(加算)';
    let sumCapText = '';
    if (effectType.calculationMethod === 'sum' && typeof effectType.sumCap === 'number' && !isNaN(effectType.sumCap)) {
        sumCapText = ` (上限: ${effectType.sumCap})`;
    }
    const div = document.createElement('div');
    div.classList.add('list-item');
    const nameSpan = document.createElement('span');
    nameSpan.classList.add('list-item-name-clickable');
    nameSpan.innerHTML = `${effectType.name} <small>${unitText} ${calcText}${sumCapText}</small>`;
    nameSpan.dataset.id = effectType.id;
    div.appendChild(nameSpan);
    containerElement.appendChild(div);
}

function handleEffectTypeListClick(event) {
    const target = event.target;
    const clickableName = target.closest('.list-item-name-clickable[data-id]');
    if (clickableName) {
        openEditEffectTypeModalById(clickableName.dataset.id);
    }
}

async function addEffectType() {
    // ... (変更なし) ...
    const name = DOMET.newEffectTypeNameInput.value.trim();
    const superCategoryId = DOMET.newEffectTypeSuperCategorySelect.value;
    const unit = DOMET.newEffectTypeUnitSelect.value;
    const calcMethodRadio = Array.from(DOMET.newEffectTypeCalcMethodRadios).find(r => r.checked);
    const calcMethod = calcMethodRadio ? calcMethodRadio.value : 'sum';
    const sumCapStr = DOMET.newEffectTypeSumCapInput.value.trim();
    const effectTypesCache = getEffectTypesFuncCache();
    if (!name) { alert("効果種類名を入力してください。"); return; }
    if (effectTypesCache.some(et => et.name.toLowerCase() === name.toLowerCase())) {
        alert("同じ名前の効果種類が既に存在します。"); return;
    }
    const effectData = { name: name, superCategoryId: superCategoryId || null, defaultUnit: (unit === '' || unit === 'none') ? null : unit, calculationMethod: calcMethod, createdAt: serverTimestamp() };
    if (calcMethod === 'sum' && sumCapStr !== "") {
        const sumCap = parseFloat(sumCapStr);
        if (!isNaN(sumCap) && sumCap >= 0) { effectData.sumCap = sumCap; }
        else { alert("加算時の最大値は0以上の数値を入力してください。"); return; }
    }
    try {
        await addDoc(collection(dbInstance, 'effect_types'), effectData);
        DOMET.newEffectTypeNameInput.value = '';
        DOMET.newEffectTypeSuperCategorySelect.value = '';
        DOMET.newEffectTypeUnitSelect.value = '';
        if(DOMET.newEffectTypeCalcMethodRadios[0]) DOMET.newEffectTypeCalcMethodRadios[0].checked = true;
        DOMET.newEffectTypeSumCapInput.value = '';
        if (DOMET.newEffectTypeSumCapGroup) {
             const sumRadioEl = document.getElementById('newCalcMethodSum');
             DOMET.newEffectTypeSumCapGroup.style.display = (sumRadioEl && sumRadioEl.checked) ? 'block' : 'none';
        }
        await refreshAllDataCallback();
    } catch (error) {
        console.error("[Effect Type Manager] Error adding effect type:", error);
        alert("効果種類の追加に失敗しました。");
    }
}

export function openEditEffectTypeModalById(effectTypeId) {
    // ... (変更なし) ...
    const effectTypesCache = getEffectTypesFuncCache();
    const effectTypeData = effectTypesCache.find(et => et.id === effectTypeId);
    if (!effectTypeData) { alert("編集する効果種類のデータが見つかりません。"); return; }
    DOMET.editingEffectTypeDocIdInput.value = effectTypeData.id;
    DOMET.editingEffectTypeNameInput.value = effectTypeData.name;
    DOMET.editingEffectTypeSuperCategorySelect.value = effectTypeData.superCategoryId || '';
    DOMET.editingEffectTypeUnitSelect.value = (effectTypeData.defaultUnit === null || effectTypeData.defaultUnit === 'none') ? '' : effectTypeData.defaultUnit;

    const calcMethod = effectTypeData.calculationMethod || 'sum';
    const radioToCheck = Array.from(DOMET.editingEffectTypeCalcMethodRadios).find(r => r.value === calcMethod);
    if (radioToCheck) radioToCheck.checked = true;
    else if (DOMET.editingEffectTypeCalcMethodRadios[0]) DOMET.editingEffectTypeCalcMethodRadios[0].checked = true;

    DOMET.editingEffectTypeSumCapInput.value = (typeof effectTypeData.sumCap === 'number' && !isNaN(effectTypeData.sumCap)) ? String(effectTypeData.sumCap) : '';
    if(DOMET.editingEffectTypeSumCapGroup) {
        const sumRadio = document.getElementById('editCalcMethodSum');
        DOMET.editingEffectTypeSumCapGroup.style.display = (sumRadio && sumRadio.checked) ? 'block' : 'none';
    }
    openModal('editEffectTypeModal');
    if (DOMET.editingEffectTypeNameInput) DOMET.editingEffectTypeNameInput.focus();
}

async function saveEffectTypeEdit() {
    // ... (変更なし) ...
    const id = DOMET.editingEffectTypeDocIdInput.value;
    const newName = DOMET.editingEffectTypeNameInput.value.trim();
    const newSuperCategoryId = DOMET.editingEffectTypeSuperCategorySelect.value;
    const newUnit = DOMET.editingEffectTypeUnitSelect.value;
    const editCalcMethodRadio = Array.from(DOMET.editingEffectTypeCalcMethodRadios).find(r => r.checked);
    const newCalcMethod = editCalcMethodRadio ? editCalcMethodRadio.value : 'sum';
    const newSumCapStr = DOMET.editingEffectTypeSumCapInput.value.trim();
    const effectTypesCache = getEffectTypesFuncCache();
    if (!newName) { alert("効果種類名は空にできません。"); return; }
    if (effectTypesCache.some(et => et.id !== id && et.name.toLowerCase() === newName.toLowerCase())) {
        alert("編集後の名前が他の効果種類と重複します。"); return;
    }
    const updateData = { name: newName, superCategoryId: newSuperCategoryId || null, defaultUnit: (newUnit === '' || newUnit === 'none') ? null : newUnit, calculationMethod: newCalcMethod, updatedAt: serverTimestamp() };
    if (newCalcMethod === 'sum') {
        if (newSumCapStr !== "") {
            const sumCap = parseFloat(newSumCapStr);
            if (!isNaN(sumCap) && sumCap >= 0) { updateData.sumCap = sumCap; }
            else { alert("加算時の最大値は0以上の数値を入力してください。"); return; }
        } else { updateData.sumCap = deleteField(); }
    } else { updateData.sumCap = deleteField(); }
    try {
        await updateDoc(doc(dbInstance, 'effect_types', id), updateData);
        closeModal('editEffectTypeModal');
        document.dispatchEvent(new CustomEvent('adminEditModalClosed', { detail: { modalId: 'editEffectTypeModal' } }));
        await refreshAllDataCallback();
    } catch (error) {
        console.error("[Effect Type Manager] Error updating effect type:", error);
        alert("効果種類の更新に失敗しました。");
    }
}

async function deleteEffectType(id, name) {
    const itemsCache = getItemsFuncCache();
    const charBasesCache = getCharacterBasesFuncCache();
    const usedByItem = itemsCache.find(item => item.structured_effects && item.structured_effects.some(eff => eff.type === id));
    if (usedByItem) { alert(`効果種類「${name}」はアイテム「${usedByItem.name}」の効果で使用されているため削除できません。`); return; }
    
    // ★★★ baseTypeMappings への依存を削除 ★★★
    for (const baseKey in charBasesCache) {
        const usedInBase = (charBasesCache[baseKey] || []).find(option => 
            option.effects && option.effects.some(eff => eff.type === id)
        );
        // baseTypeMappings[baseKey] が未定義の場合があるので、直接 baseKey を使うか、
        // もし表示名が必要なら admin-main から渡されたマッピングを使う (今回はメッセージを簡略化)
        if (usedInBase) { 
            alert(`効果種類「${name}」はキャラクター基礎情報「${baseKey} タイプ の ${usedInBase.name}」の効果で使用されているため削除できません。`); 
            return; 
        }
    }

    if (confirm(`効果種類「${name}」を削除しますか？\nこの操作は元に戻せません。`)) {
        try {
            await deleteDoc(doc(dbInstance, 'effect_types', id));
            if (DOMET.editEffectTypeModal.style.display !== 'none' && DOMET.editingEffectTypeDocIdInput.value === id) {
                closeModal('editEffectTypeModal'); // This will now dispatch the event
            } else {
                // If not closing the edit modal, manually dispatch if needed for other listeners,
                // but usually a delete action from within a modal implies the modal closes.
                // Forcing event dispatch if modal wasn't closed by the closeModal helper
                // document.dispatchEvent(new CustomEvent('adminEditModalClosed', { detail: { modalId: 'editEffectTypeModal_directDelete' } }));
            }
            // The closeModal above should trigger the event that admin-main listens to.
            // If a delete happens NOT from the modal, then a manual dispatch might be needed here if specific logic depends on it.
            // However, for consistency, delete actions are usually within the edit modal.
            await refreshAllDataCallback();
        } catch (error) {
            console.error("[Effect Type Manager] Error deleting effect type:", error);
            alert("効果種類の削除に失敗しました。");
        }
    }
}
