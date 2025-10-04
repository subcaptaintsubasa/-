// js/admin-modules/effect-type-manager.js
import { collection, getDocs, addDoc, doc, updateDoc, query, orderBy, serverTimestamp, deleteField, where } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js"; // deleteDoc removed
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
    enlargeEffectTypeListButton: null, // Added for consistency if present
};

let dbInstance = null;
let getEffectTypesFuncCache = () => [];
let getEffectUnitsFuncCache = () => [];
let getEffectSuperCategoriesFuncCache = () => [];
let getItemsFuncCache = () => [];
let getCharacterBasesFuncCache = () => ({});
let refreshAllDataCallback = async () => {};
let openEnlargedListModalCallbackFromMain = (config) => {};

export function initEffectTypeManager(dependencies) {
    dbInstance = dependencies.db;
    getEffectTypesFuncCache = dependencies.getEffectTypes; // Assumes non-deleted
    getEffectUnitsFuncCache = dependencies.getEffectUnits; // Assumes non-deleted
    getEffectSuperCategoriesFuncCache = dependencies.getEffectSuperCategories; // Assumes non-deleted
    getItemsFuncCache = dependencies.getItems; // Assumes non-deleted
    getCharacterBasesFuncCache = dependencies.getCharacterBases; // Assumes non-deleted options
    refreshAllDataCallback = dependencies.refreshAllData;
    if (typeof dependencies.openEnlargedListModal === 'function') {
        openEnlargedListModalCallbackFromMain = dependencies.openEnlargedListModal;
    }


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

    DOMET.itemFormEffectTypeSelect = document.getElementById('effectTypeSelect'); // For item form
    DOMET.charBaseOptionEffectTypeSelect = document.getElementById('charBaseOptionEffectTypeSelect'); // For char base modal

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
                logicalDeleteEffectType(typeId, name); // Changed to logicalDelete
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
    if (DOMET.enlargeEffectTypeListButton) {
         DOMET.enlargeEffectTypeListButton.addEventListener('click', () => {
            if (typeof openEnlargedListModalCallbackFromMain === 'function') {
                openEnlargedListModalCallbackFromMain({
                    title: "効果種類一覧 (拡大)",
                    sourceFn: getEffectTypesFuncCache,
                    itemType: 'effectType', // This will be used to determine how to render items in the modal
                    editFunction: openEditEffectTypeModalById,
                    // displayRenderer might be needed if custom rendering like grouping is desired
                });
            }
        });
    }
    
    // Calculation method radio button change listeners
    [
        { radios: DOMET.newEffectTypeCalcMethodRadios, group: DOMET.newEffectTypeSumCapGroup, input: DOMET.newEffectTypeSumCapInput, sumRadioId: 'newCalcMethodSum' },
        { radios: DOMET.editingEffectTypeCalcMethodRadios, group: DOMET.editingEffectTypeSumCapGroup, input: DOMET.editingEffectTypeSumCapInput, sumRadioId: 'editCalcMethodSum' }
    ].forEach(({ radios, group, input, sumRadioId }) => {
        if (radios && group && input) {
            radios.forEach(radio => {
                radio.addEventListener('change', () => {
                    const sumRadioEl = document.getElementById(sumRadioId); // Get the specific sum radio
                    if (sumRadioEl) {
                        group.style.display = (sumRadioEl.checked) ? 'block' : 'none';
                        if (!sumRadioEl.checked) input.value = ''; // Clear sumCap if not sum method
                    }
                });
            });
            // Initial state based on default checked radio
            const initialSumRadio = document.getElementById(sumRadioId);
            if (initialSumRadio) {
               group.style.display = (initialSumRadio.checked) ? 'block' : 'none';
               if(!initialSumRadio.checked && input) input.value = '';
            } else if (group) { // Fallback if radio not found
                group.style.display = 'none'; 
                if (input) input.value = '';
            }
        }
    });
    console.log("[Effect Type Manager] Initialized for logical delete.");
}

function populateEffectUnitSelectsForTypeFormsUI() {
    const effectUnitsCache = getEffectUnitsFuncCache(); // Assumes non-deleted
    const options = [{ value: '', text: '単位なし' }, ...effectUnitsCache.map(u => ({ value: u.name, text: u.name })).sort((a,b) => a.text.localeCompare(b.text, 'ja'))];
    populateSelect(DOMET.newEffectTypeUnitSelect, options, null, ''); // null for defaultText means first option is selected if value is empty
    populateSelect(DOMET.editingEffectTypeUnitSelect, options, null, '');
}

function populateSuperCategorySelects() {
    const superCategories = getEffectSuperCategoriesFuncCache() || []; // Assumes non-deleted
    const options = superCategories.map(sc => ({ value: sc.id, text: sc.name })).sort((a,b) => a.text.localeCompare(b.text, 'ja'));
    populateSelect(DOMET.newEffectTypeSuperCategorySelect, options, '大分類を選択...');
    populateSelect(DOMET.editingEffectTypeSuperCategorySelect, options, '大分類を選択...');
}

export function _populateEffectTypeSelectsInternal() {
    // This function populates effect type selects in Item form and CharBaseOption modal.
    // It should use non-deleted effect types.
    const effectTypesCache = getEffectTypesFuncCache(); // Assumes non-deleted
    const superCategoriesCache = getEffectSuperCategoriesFuncCache() || []; // Assumes non-deleted

    const populateGroupedSelect = (selectElement) => {
        if (!selectElement) return;
        const currentValue = selectElement.value;
        selectElement.innerHTML = '<option value="">効果種類を選択...</option>';

        const sortedSuperCats = [...superCategoriesCache].sort((a,b) => a.name.localeCompare(b.name, 'ja'));

        sortedSuperCats.forEach(superCat => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = superCat.name;
            effectTypesCache.filter(et => et.superCategoryId === superCat.id)
                .sort((a,b) => a.name.localeCompare(b.name, 'ja'))
                .forEach(et => {
                    const option = document.createElement('option');
                    option.value = et.id; 
                    option.textContent = et.name;
                    option.dataset.unitName = (et.defaultUnit && et.defaultUnit !== 'none') ? et.defaultUnit : '';
                    optgroup.appendChild(option);
                });
            if (optgroup.childElementCount > 0) selectElement.appendChild(optgroup);
        });

        const unclassifiedTypes = effectTypesCache.filter(et => !et.superCategoryId || !superCategoriesCache.some(sc => sc.id === et.superCategoryId))
            .sort((a,b) => a.name.localeCompare(b.name, 'ja'));
        if (unclassifiedTypes.length > 0) {
            const unclassifiedOptgroup = document.createElement('optgroup');
            unclassifiedOptgroup.label = superCategoriesCache.length > 0 ? "未分類" : "効果種類";
            unclassifiedTypes.forEach(et => {
                const option = document.createElement('option');
                option.value = et.id; 
                option.textContent = et.name;
                option.dataset.unitName = (et.defaultUnit && et.defaultUnit !== 'none') ? et.defaultUnit : '';
                unclassifiedOptgroup.appendChild(option);
            });
             if (unclassifiedOptgroup.childElementCount > 0) selectElement.appendChild(unclassifiedOptgroup);
        }
        
        if (currentValue && Array.from(selectElement.options).some(opt => opt.value === currentValue)) {
            selectElement.value = currentValue;
        }
    };
    
    populateGroupedSelect(DOMET.itemFormEffectTypeSelect);
    // If charBaseOptionEffectTypeSelect is also a grouped select, call it:
    // populateGroupedSelect(DOMET.charBaseOptionEffectTypeSelect); 
    // For now, assuming it's handled by its own manager if logic differs, or populated here if same structure.
    // Let's assume it's also a grouped select for consistency:
    if (typeof window.adminModules !== 'undefined' && window.adminModules.charBaseManager && typeof window.adminModules.charBaseManager._populateCharBaseEffectTypeSelectInternal === 'function') {
        // If char-base-manager has its own populator, let it handle it
    } else if (DOMET.charBaseOptionEffectTypeSelect) {
        populateGroupedSelect(DOMET.charBaseOptionEffectTypeSelect);
    }
}

// buildEffectTypeListDOM and _renderEffectTypesForManagementInternal use caches that are already filtered
function buildEffectTypeListDOM() {
    const effectTypesCache = getEffectTypesFuncCache(); // Assumes non-deleted
    const superCategoriesCache = getEffectSuperCategoriesFuncCache() || []; // Assumes non-deleted

    if (!effectTypesCache || effectTypesCache.length === 0) {
        const p = document.createElement('p');
        p.textContent = '効果種類が登録されていません。';
        return p;
    }
    const fragment = document.createDocumentFragment();
    const typesBySuperCategory = new Map();
    const unclassifiedTypes = [];

    effectTypesCache.forEach(type => {
        // No need to check type.isDeleted here
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
            groupDiv.classList.add('effect-super-category-group'); // Use existing class for grouping
            const groupHeader = document.createElement('h5');
            groupHeader.classList.add('effect-super-category-header');
            groupHeader.textContent = `${superCat.name}`;
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
        groupHeader.textContent = superCategoriesCache.length > 0 ? '未分類の効果種類' : '効果種類';
        groupDiv.appendChild(groupHeader);
        unclassifiedTypes.sort((a,b) => a.name.localeCompare(b.name, 'ja')).forEach(effectType => {
            appendEffectTypeToList(effectType, groupDiv);
        });
        fragment.appendChild(groupDiv);
    }

    if (!hasRenderedContent && effectTypesCache.length > 0) { // Should not happen if cache isn't empty
         const p = document.createElement('p');
         p.textContent = '表示できるグループ化された効果種類はありません。';
         fragment.appendChild(p);
    }
    return fragment.childNodes.length > 0 ? fragment : null; // Return null if truly empty
}

export function _renderEffectTypesForManagementInternal() {
    if (!DOMET.effectTypeListContainer) return;
    DOMET.effectTypeListContainer.innerHTML = '';
    const listContent = buildEffectTypeListDOM();
    if (listContent && (listContent.childNodes.length > 0 || listContent.nodeName === 'P')) {
        DOMET.effectTypeListContainer.appendChild(listContent);
    } else { // If buildEffectTypeListDOM returned null or an empty fragment
        DOMET.effectTypeListContainer.innerHTML = '<p>効果種類が登録されていません。</p>';
    }
    populateEffectUnitSelectsForTypeFormsUI();
    populateSuperCategorySelects();
}

function appendEffectTypeToList(effectType, containerElement) {
    // Assumes effectType is not deleted
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
    const name = DOMET.newEffectTypeNameInput.value.trim();
    const superCategoryId = DOMET.newEffectTypeSuperCategorySelect.value;
    const unit = DOMET.newEffectTypeUnitSelect.value;
    const calcMethodRadio = Array.from(DOMET.newEffectTypeCalcMethodRadios).find(r => r.checked);
    const calcMethod = calcMethodRadio ? calcMethodRadio.value : 'sum'; // Default to sum
    const sumCapStr = DOMET.newEffectTypeSumCapInput.value.trim();
    
    const effectTypesCache = getEffectTypesFuncCache(); // Assumes non-deleted

    if (!name) { alert("効果種類名を入力してください。"); return; }
    // Check for duplicates among non-deleted types
    if (effectTypesCache.some(et => et.name.toLowerCase() === name.toLowerCase())) {
        alert("同じ名前の効果種類が既に存在します。"); return;
    }

    const effectData = { 
        name: name, 
        superCategoryId: superCategoryId || null, 
        defaultUnit: (unit === '' || unit === 'none') ? null : unit, 
        calculationMethod: calcMethod, 
        isDeleted: false, // New types are not deleted
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp() // Add updatedAt
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
        // Reset form
        DOMET.newEffectTypeNameInput.value = '';
        DOMET.newEffectTypeSuperCategorySelect.value = '';
        DOMET.newEffectTypeUnitSelect.value = '';
        if(DOMET.newEffectTypeCalcMethodRadios[0]) DOMET.newEffectTypeCalcMethodRadios[0].checked = true; // Default calc method
        DOMET.newEffectTypeSumCapInput.value = '';
        if (DOMET.newEffectTypeSumCapGroup) { // Update sumCap group visibility
             const sumRadioEl = document.getElementById('newCalcMethodSum');
             DOMET.newEffectTypeSumCapGroup.style.display = (sumRadioEl && sumRadioEl.checked) ? 'block' : 'none';
        }
        
    } catch (error) {
        console.error("[Effect Type Manager] Error adding effect type:", error);
        alert("効果種類の追加に失敗しました。");
    }
}

export function openEditEffectTypeModalById(effectTypeId) {
    const effectTypesCache = getEffectTypesFuncCache(); // Assumes non-deleted
    const effectTypeData = effectTypesCache.find(et => et.id === effectTypeId);
    if (!effectTypeData) { alert("編集する効果種類のデータが見つかりません。"); return; }

    DOMET.editingEffectTypeDocIdInput.value = effectTypeData.id;
    DOMET.editingEffectTypeNameInput.value = effectTypeData.name;
    DOMET.editingEffectTypeSuperCategorySelect.value = effectTypeData.superCategoryId || '';
    DOMET.editingEffectTypeUnitSelect.value = (effectTypeData.defaultUnit === null || effectTypeData.defaultUnit === 'none') ? '' : effectTypeData.defaultUnit;

    const calcMethod = effectTypeData.calculationMethod || 'sum';
    const radioToCheck = Array.from(DOMET.editingEffectTypeCalcMethodRadios).find(r => r.value === calcMethod);
    if (radioToCheck) radioToCheck.checked = true;
    else if (DOMET.editingEffectTypeCalcMethodRadios[0]) DOMET.editingEffectTypeCalcMethodRadios[0].checked = true; // Default to first if not found

    DOMET.editingEffectTypeSumCapInput.value = (typeof effectTypeData.sumCap === 'number' && !isNaN(effectTypeData.sumCap)) ? String(effectTypeData.sumCap) : '';
    if(DOMET.editingEffectTypeSumCapGroup) { // Update sumCap group visibility
        const sumRadio = document.getElementById('editCalcMethodSum');
        DOMET.editingEffectTypeSumCapGroup.style.display = (sumRadio && sumRadio.checked) ? 'block' : 'none';
    }

    openModal('editEffectTypeModal');
    if (DOMET.editingEffectTypeNameInput) DOMET.editingEffectTypeNameInput.focus();
}

async function saveEffectTypeEdit() {
    const id = DOMET.editingEffectTypeDocIdInput.value;
    const newName = DOMET.editingEffectTypeNameInput.value.trim();
    const newSuperCategoryId = DOMET.editingEffectTypeSuperCategorySelect.value;
    const newUnit = DOMET.editingEffectTypeUnitSelect.value;
    const editCalcMethodRadio = Array.from(DOMET.editingEffectTypeCalcMethodRadios).find(r => r.checked);
    const newCalcMethod = editCalcMethodRadio ? editCalcMethodRadio.value : 'sum';
    const newSumCapStr = DOMET.editingEffectTypeSumCapInput.value.trim();
    
    const effectTypesCache = getEffectTypesFuncCache(); // Assumes non-deleted

    if (!newName) { alert("効果種類名は空にできません。"); return; }
    // Check for duplicates among other non-deleted types
    if (effectTypesCache.some(et => et.id !== id && et.name.toLowerCase() === newName.toLowerCase())) {
        alert("編集後の名前が他の効果種類と重複します。"); return;
    }

    const updateData = { 
        name: newName, 
        superCategoryId: newSuperCategoryId || null, 
        defaultUnit: (newUnit === '' || newUnit === 'none') ? null : newUnit, 
        calculationMethod: newCalcMethod, 
        updatedAt: serverTimestamp() // Update timestamp
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
            updateData.sumCap = deleteField(); // Remove sumCap if empty string
        }
    } else { 
        updateData.sumCap = deleteField(); // Remove sumCap if not sum method
    }
    
    try {
        await updateDoc(doc(dbInstance, 'effect_types', id), updateData);
        closeModal('editEffectTypeModal');
        document.dispatchEvent(new CustomEvent('adminEditModalClosed', { detail: { modalId: 'editEffectTypeModal' } }));
    } catch (error) {
        console.error("[Effect Type Manager] Error updating effect type:", error);
        alert("効果種類の更新に失敗しました。");
    }
}

async function logicalDeleteEffectType(id, name) {
    // Check if used by non-deleted Items or CharacterBaseOptions
    const itemsCache = getItemsFuncCache(); // Assumes non-deleted
    const charBasesCache = getCharacterBasesFuncCache(); // Assumes non-deleted options

    const usedByItem = itemsCache.find(item => 
        item.effects && item.effects.some(eff => eff.type === 'structured' && eff.effectTypeId === id)
    );
    if (usedByItem) { 
        alert(`効果種類「${name}」はアイテム「${usedByItem.name}」の効果で使用されているため、論理削除できません。`); 
        return; 
    }
    
    for (const baseKey in charBasesCache) {
        const usedInBase = (charBasesCache[baseKey] || []).find(option => 
            option.effects && option.effects.some(eff => eff.type === id) // Assuming char base effects store effectTypeId as 'type'
        );
        if (usedInBase) { 
            // baseTypeMappings not directly available.
            alert(`効果種類「${name}」はキャラクター基礎情報「${baseKey}タイプ の ${usedInBase.name}」の効果で使用されているため、論理削除できません。`); 
            return; 
        }
    }

    if (confirm(`効果種類「${name}」を論理削除しますか？\nこの効果種類は一覧などには表示されなくなりますが、データは残ります。`)) {
        try {
            await updateDoc(doc(dbInstance, 'effect_types', id), {
                isDeleted: true,
                updatedAt: serverTimestamp() // Update timestamp
            });
            
            if (DOMET.editEffectTypeModal.style.display !== 'none' && DOMET.editingEffectTypeDocIdInput.value === id) {
                closeModal('editEffectTypeModal'); 
            }
            document.dispatchEvent(new CustomEvent('adminEditModalClosed', { detail: { modalId: 'editEffectTypeModal_directDelete' } }));
        } catch (error) {
            console.error("[Effect Type Manager] Error logically deleting effect type:", error);
            alert("効果種類の論理削除に失敗しました。");
        }
    }
}
