// js/admin-modules/effect-type-manager.js
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, deleteField } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { openModal, closeModal, populateSelect, openEnlargedListModal } from './ui-helpers.js';

const DOMET = {
    newEffectTypeNameInput: null,
    newEffectTypeSuperCategorySelect: null,
    newEffectTypeUnitSelect: null,
    newEffectTypeCalcMethodRadios: null,
    newEffectTypeSumCapInput: null,
    newEffectTypeSumCapGroup: null,
    addEffectTypeButton: null,
    effectTypeListContainer: null,
    enlargeEffectTypeListButton: null,
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

export function initEffectTypeManager(dependencies) {
    dbInstance = dependencies.db;
    getEffectTypesFuncCache = dependencies.getEffectTypes;
    getEffectUnitsFuncCache = dependencies.getEffectUnits;
    getEffectSuperCategoriesFuncCache = dependencies.getEffectSuperCategories;
    getItemsFuncCache = dependencies.getItems;
    getCharacterBasesFuncCache = dependencies.getCharacterBases;
    refreshAllDataCallback = dependencies.refreshAllData;

    DOMET.newEffectTypeNameInput = document.getElementById('newEffectTypeName');
    DOMET.newEffectTypeSuperCategorySelect = document.getElementById('newEffectTypeSuperCategory');
    DOMET.newEffectTypeUnitSelect = document.getElementById('newEffectTypeUnit');
    DOMET.newEffectTypeCalcMethodRadios = document.querySelectorAll('input[name="newCalcMethod"]');
    DOMET.newEffectTypeSumCapInput = document.getElementById('newEffectTypeSumCap');
    DOMET.newEffectTypeSumCapGroup = document.getElementById('newEffectTypeSumCapGroup');
    DOMET.addEffectTypeButton = document.getElementById('addEffectTypeButton');
    DOMET.effectTypeListContainer = document.getElementById('effectTypeListContainer');
    DOMET.enlargeEffectTypeListButton = document.getElementById('enlargeEffectTypeListButton');

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
    if (DOMET.enlargeEffectTypeListButton) {
        DOMET.enlargeEffectTypeListButton.addEventListener('click', () => {
            openEnlargedListModal(
                "効果種類一覧 (拡大)",
                (container) => {
                    const listContent = buildEffectTypeListDOMForEnlargement(true);
                    if (listContent) {
                        container.appendChild(listContent);
                    } else {
                        container.innerHTML = '<p>表示する効果種類がありません。</p>';
                    }
                }
            );
        });
    }

    // SumCap group visibility toggles
    [
        { radios: DOMET.newEffectTypeCalcMethodRadios, group: DOMET.newEffectTypeSumCapGroup, input: DOMET.newEffectTypeSumCapInput, sumRadioId: 'newCalcMethodSum' },
        { radios: DOMET.editingEffectTypeCalcMethodRadios, group: DOMET.editingEffectTypeSumCapGroup, input: DOMET.editingEffectTypeSumCapInput, sumRadioId: 'editCalcMethodSum' }
    ].forEach(({ radios, group, input, sumRadioId }) => {
        if (radios && group && input) { // ★★★ input の存在も確認 ★★★
            radios.forEach(radio => {
                radio.addEventListener('change', (e) => {
                    const sumRadioEl = document.getElementById(sumRadioId);
                    if (sumRadioEl) {
                        group.style.display = (sumRadioEl.checked) ? 'block' : 'none';
                        if (!sumRadioEl.checked) input.value = ''; // sumRadioEl.checked が false なら input をクリア
                    }
                });
            });
            const initialSumRadio = document.getElementById(sumRadioId);
            if (initialSumRadio) {
               group.style.display = (initialSumRadio.checked) ? 'block' : 'none';
               if(!initialSumRadio.checked) input.value = ''; // 初期表示でもクリア
            } else {
                group.style.display = 'none'; // sumRadioId が見つからない場合は非表示
                input.value = '';
            }
        } else {
            // console.warn("Missing elements for sumCap group visibility toggle:", {radios, group, input, sumRadioId});
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
    const superCategories = getEffectSuperCategoriesFuncCache();
    const options = superCategories.map(sc => ({ value: sc.id, text: sc.name })).sort((a,b) => a.text.localeCompare(b.text, 'ja'));
    populateSelect(DOMET.newEffectTypeSuperCategorySelect, options, '大分類を選択...');
    populateSelect(DOMET.editingEffectTypeSuperCategorySelect, options, '大分類を選択...');
    console.log("[Effect Type Manager] Super category selects populated.");
}

export function _populateEffectTypeSelectsInternal() {
    const effectTypesCache = getEffectTypesFuncCache();
    const superCategoriesCache = getEffectSuperCategoriesFuncCache();
    if (DOMET.itemFormEffectTypeSelect) {
        const selectElement = DOMET.itemFormEffectTypeSelect;
        const currentValue = selectElement.value;
        selectElement.innerHTML = '<option value="">効果種類を選択...</option>';
        superCategoriesCache.sort((a,b) => a.name.localeCompare(b.name, 'ja')).forEach(superCat => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = superCat.name;
            effectTypesCache.filter(et => et.superCategoryId === superCat.id).sort((a,b) => a.name.localeCompare(b.name, 'ja'))
                .forEach(et => {
                    const option = document.createElement('option');
                    option.value = et.id; option.textContent = et.name;
                    option.dataset.unitName = et.defaultUnit || '';
                    optgroup.appendChild(option);
                });
            if (optgroup.childElementCount > 0) selectElement.appendChild(optgroup);
        });
        const unclassifiedTypes = effectTypesCache.filter(et => !et.superCategoryId).sort((a,b) => a.name.localeCompare(b.name, 'ja'));
        if (unclassifiedTypes.length > 0) {
            const unclassifiedOptgroup = document.createElement('optgroup');
            unclassifiedOptgroup.label = "未分類";
            unclassifiedTypes.forEach(et => {
                const option = document.createElement('option');
                option.value = et.id; option.textContent = et.name;
                option.dataset.unitName = et.defaultUnit || '';
                unclassifiedOptgroup.appendChild(option);
            });
            selectElement.appendChild(unclassifiedOptgroup);
        }
        if (currentValue && Array.from(selectElement.options).some(opt => opt.value === currentValue)) {
            selectElement.value = currentValue;
        }
    }
    if (DOMET.charBaseOptionEffectTypeSelect) {
        const optionsForCharBase = effectTypesCache.map(et => ({ value: et.id, text: et.name, 'data-unit-name': et.defaultUnit || '', }))
                                                .sort((a,b) => a.text.localeCompare(b.text, 'ja'));
        populateSelect(DOMET.charBaseOptionEffectTypeSelect, optionsForCharBase, '効果種類を選択...');
    }
    console.log("[Effect Type Manager] Effect type selects in item/char-base forms populated (with optgroups for item form).");
}

function buildEffectTypeListDOMForEnlargement(isEnlargedView = false) {
    const effectTypesCache = getEffectTypesFuncCache();
    const superCategoriesCache = getEffectSuperCategoriesFuncCache();
    if (!effectTypesCache || effectTypesCache.length === 0) {
        const p = document.createElement('p');
        p.textContent = '効果種類が登録されていません。';
        return p;
    }
    const fragment = document.createDocumentFragment();
    const typesBySuperCategory = new Map();
    const unclassifiedTypes = [];
    effectTypesCache.forEach(type => {
        if (type.superCategoryId) {
            if (!typesBySuperCategory.has(type.superCategoryId)) typesBySuperCategory.set(type.superCategoryId, []);
            typesBySuperCategory.get(type.superCategoryId).push(type);
        } else {
            unclassifiedTypes.push(type);
        }
    });
    let hasRenderedContent = false;
    superCategoriesCache.sort((a,b) => a.name.localeCompare(b.name, 'ja')).forEach(superCat => {
        const typesInThisSuperCat = (typesBySuperCategory.get(superCat.id) || []).sort((a,b) => a.name.localeCompare(b.name, 'ja'));
        if (typesInThisSuperCat.length > 0) {
            hasRenderedContent = true;
            const groupDiv = document.createElement('div');
            groupDiv.classList.add('effect-super-category-group');
            const groupHeader = document.createElement('h5');
            groupHeader.classList.add('effect-super-category-header');
            groupHeader.textContent = `${superCat.name}:`;
            groupDiv.appendChild(groupHeader);
            typesInThisSuperCat.forEach(effectType => appendEffectTypeToList(effectType, groupDiv, isEnlargedView));
            fragment.appendChild(groupDiv);
        }
    });
    if (unclassifiedTypes.length > 0) {
        hasRenderedContent = true;
        const groupDiv = document.createElement('div');
        groupDiv.classList.add('effect-super-category-group');
        const groupHeader = document.createElement('h5');
        groupHeader.classList.add('effect-super-category-header');
        groupHeader.textContent = '未分類の効果種類:';
        groupDiv.appendChild(groupHeader);
        unclassifiedTypes.sort((a,b) => a.name.localeCompare(b.name, 'ja')).forEach(effectType => {
            appendEffectTypeToList(effectType, groupDiv, isEnlargedView);
        });
        fragment.appendChild(groupDiv);
    }
    if (!hasRenderedContent && effectTypesCache.length > 0) {
         const p = document.createElement('p');
         p.textContent = '表示できるグループ化された効果種類はありません。';
         fragment.appendChild(p);
    }
    return fragment.childNodes.length > 0 ? fragment : null;
}

export function _renderEffectTypesForManagementInternal() {
    if (!DOMET.effectTypeListContainer) return;
    DOMET.effectTypeListContainer.innerHTML = '';
    const listContent = buildEffectTypeListDOMForEnlargement(false);
    if (listContent) {
        DOMET.effectTypeListContainer.appendChild(listContent);
    }
    populateEffectUnitSelectsForTypeFormsUI();
    populateSuperCategorySelects();
    console.log("[Effect Type Manager] Effect types rendered by super category group for management.");
}

function appendEffectTypeToList(effectType, containerElement, isEnlargedView = false) {
    const unitText = effectType.defaultUnit && effectType.defaultUnit !== '' ? `(${effectType.defaultUnit})` : '(単位なし)';
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
    if (!isEnlargedView) {
        nameSpan.dataset.id = effectType.id;
        nameSpan.dataset.action = "edit";
    }
    div.appendChild(nameSpan);
    // Action div is removed as per previous changes, ensure this is intended for non-enlarged view too.
    // If actions were needed in the list (e.g. direct delete), they would be added here for non-enlarged view.
    containerElement.appendChild(div);
}


function handleEffectTypeListClick(event) {
    const target = event.target;
    const clickableName = target.closest('.list-item-name-clickable[data-id]');
    if (clickableName && clickableName.dataset.action === 'edit') {
        openEditEffectTypeModalById(clickableName.dataset.id);
    }
}

async function addEffectType() {
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
    const effectData = { name: name, superCategoryId: superCategoryId || null, defaultUnit: unit === '' ? null : unit, calculationMethod: calcMethod, createdAt: serverTimestamp() };
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
    DOMET.editingEffectTypeSuperCategorySelect.value = effectTypeData.superCategoryId || '';
    DOMET.editingEffectTypeUnitSelect.value = effectTypeData.defaultUnit || '';
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
    DOMET.editingEffectTypeNameInput.focus();
}

async function saveEffectTypeEdit() {
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
    const updateData = { name: newName, superCategoryId: newSuperCategoryId || null, defaultUnit: newUnit === '' ? null : newUnit, calculationMethod: newCalcMethod, updatedAt: serverTimestamp() };
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
    for (const baseKey in charBasesCache) {
        const usedInBase = (charBasesCache[baseKey] || []).find(option => option.effects && option.effects.some(eff => eff.type === id));
        if (usedInBase) { alert(`効果種類「${name}」はキャラクター基礎情報「${baseKey} - ${usedInBase.name}」の効果で使用されているため削除できません。`); return; }
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
