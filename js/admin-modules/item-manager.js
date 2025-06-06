// js/admin-modules/item-manager.js
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, serverTimestamp, deleteField, getDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

const DOMI = {
    itemForm: null,
    itemIdToEditInput: null,
    itemNameInput: null,
    itemImageFileInput: null,
    itemImagePreview: null,
    itemImageUrlInput: null,
    itemPriceInput: null,
    uploadProgressContainer: null,
    uploadProgress: null,
    uploadProgressText: null,
    itemRaritySelector: null,
    itemRarityValueInput: null,

    toggleEffectsInputModeButton: null,
    structuredEffectsArea: null,
    structuredEffectsInputArea: null,
    manualEffectsArea: null,
    manualEffectsInputArea: null,
    manualEffectsStringTextarea: null,
    addManualEffectToListButton: null,
    effectTypeSelect: null,
    effectValueInput: null,
    effectUnitDisplay: null,
    addEffectToListButton: null,
    currentEffectsList: null,

    toggleSourceInputModeButton: null,
    treeSourceArea: null,
    treeSourceInputArea: null,
    manualSourceArea: null,
    manualSourceInputArea: null,
    manualSourceStringTextarea: null,
    addManualSourceToListButton: null,
    itemSourceButtonSelectionArea: null,
    selectedItemSourcePathDisplay: null,
    selectedItemSourceNodeId_temp: null,
    // ===== item-source-manager.js からの変更に合わせてDOM参照を追加 =====
    finalSourceDisplayPreviewInput: null, // プレビュー表示用
    // ===== ここまで =====
    addTreeSourceToListButton: null,
    currentSourcesList: null,

    itemTagsButtonContainer: null,
    deleteItemFromFormButton: null,
    saveItemButton: null,
    clearFormButton: null,
    itemsTableBody: null,
    itemSearchAdminInput: null,
};

let dbInstance = null;
let getAllItemsFuncCache = () => [];
let getAllTagsFuncCache = () => [];
let getAllCategoriesFuncCache = () => [];
let getEffectTypesFuncCache = () => [];
let getEffectUnitsFuncCache = () => [];
let getItemSourcesFuncCache = () => [];
let refreshAllDataCallback = async () => {};

let currentItemEffects = [];
let currentItemSources = [];
let selectedImageFile = null;
let IMAGE_UPLOAD_WORKER_URL_CONST = '';

let itemEffectEditMode = false;
let itemEffectEditingIndex = -1;
let itemSourceEditMode = false;
let itemSourceEditingIndex = -1;

let currentEffectsInputMode = 'structured';
let currentSourceInputMode = 'tree';

const MAX_RARITY = 5;

export function initItemManager(dependencies) {
    dbInstance = dependencies.db;
    getAllItemsFuncCache = dependencies.getItems;
    getAllTagsFuncCache = dependencies.getAllTags;
    getAllCategoriesFuncCache = dependencies.getAllCategories;
    getEffectTypesFuncCache = dependencies.getEffectTypes;
    getEffectUnitsFuncCache = dependencies.getEffectUnits;
    getItemSourcesFuncCache = dependencies.getItemSources;
    refreshAllDataCallback = dependencies.refreshAllData;
    IMAGE_UPLOAD_WORKER_URL_CONST = dependencies.uploadWorkerUrl;

    DOMI.itemForm = document.getElementById('itemForm');
    DOMI.itemIdToEditInput = document.getElementById('itemIdToEdit');
    DOMI.itemNameInput = document.getElementById('itemName');
    DOMI.itemImageFileInput = document.getElementById('itemImageFile');
    DOMI.itemImagePreview = document.getElementById('itemImagePreview');
    DOMI.itemImageUrlInput = document.getElementById('itemImageUrl');
    DOMI.itemPriceInput = document.getElementById('itemPrice');
    DOMI.uploadProgressContainer = document.getElementById('uploadProgressContainer');
    DOMI.uploadProgress = document.getElementById('uploadProgress');
    DOMI.uploadProgressText = document.getElementById('uploadProgressText');
    DOMI.itemRaritySelector = document.getElementById('itemRaritySelector');
    DOMI.itemRarityValueInput = document.getElementById('itemRarityValue');

    DOMI.toggleEffectsInputModeButton = document.getElementById('toggleEffectsInputModeButton');
    DOMI.structuredEffectsArea = document.getElementById('structuredEffectsArea');
    DOMI.structuredEffectsInputArea = document.getElementById('structuredEffectsInputArea');
    DOMI.manualEffectsArea = document.getElementById('manualEffectsArea');
    DOMI.manualEffectsInputArea = document.getElementById('manualEffectsInputArea');
    DOMI.manualEffectsStringTextarea = document.getElementById('manualEffectsString');
    DOMI.addManualEffectToListButton = document.getElementById('addManualEffectToListButton');
    DOMI.effectTypeSelect = document.getElementById('effectTypeSelect');
    DOMI.effectValueInput = document.getElementById('effectValueInput');
    DOMI.effectUnitDisplay = document.getElementById('effectUnitDisplay');
    DOMI.addEffectToListButton = document.getElementById('addEffectToListButton');
    DOMI.currentEffectsList = document.getElementById('currentEffectsList');

    DOMI.toggleSourceInputModeButton = document.getElementById('toggleSourceInputModeButton');
    DOMI.treeSourceArea = document.getElementById('treeSourceArea');
    DOMI.treeSourceInputArea = document.getElementById('treeSourceInputArea');
    DOMI.manualSourceArea = document.getElementById('manualSourceArea');
    DOMI.manualSourceInputArea = document.getElementById('manualSourceInputArea');
    DOMI.manualSourceStringTextarea = document.getElementById('manualSourceStringTextarea');
    DOMI.addManualSourceToListButton = document.getElementById('addManualSourceToListButton');
    DOMI.itemSourceButtonSelectionArea = document.getElementById('itemSourceButtonSelectionArea');
    DOMI.selectedItemSourcePathDisplay = document.getElementById('selectedItemSourcePathDisplay');
    DOMI.selectedItemSourceNodeId_temp = document.getElementById('selectedItemSourceNodeId_temp');
    // ===== item-source-manager.js からの変更に合わせてDOM参照を追加 =====
    DOMI.finalSourceDisplayPreviewInput = document.getElementById('finalSourceDisplayPreview');
    // ===== ここまで =====
    DOMI.addTreeSourceToListButton = document.getElementById('addTreeSourceToListButton');
    DOMI.currentSourcesList = document.getElementById('currentSourcesList');

    DOMI.itemTagsButtonContainer = document.getElementById('itemTagsButtonContainer');
    DOMI.deleteItemFromFormButton = document.getElementById('deleteItemFromFormButton');
    DOMI.saveItemButton = document.getElementById('saveItemButton');
    DOMI.clearFormButton = document.getElementById('clearFormButton');
    DOMI.itemsTableBody = document.querySelector('#itemsTable tbody');
    DOMI.itemSearchAdminInput = document.getElementById('itemSearchAdmin');

    if (DOMI.itemForm) DOMI.itemForm.addEventListener('submit', saveItem);
    if (DOMI.clearFormButton) DOMI.clearFormButton.addEventListener('click', clearItemFormInternal);
    if (DOMI.itemImageFileInput) DOMI.itemImageFileInput.addEventListener('change', handleImageFileSelect);

    if (DOMI.addEffectToListButton) DOMI.addEffectToListButton.addEventListener('click', handleAddOrUpdateStructuredEffect);
    if (DOMI.addManualEffectToListButton) DOMI.addManualEffectToListButton.addEventListener('click', handleAddManualEffect);
    if (DOMI.effectTypeSelect) DOMI.effectTypeSelect.addEventListener('change', updateItemFormEffectUnitDisplay);
    if (DOMI.toggleEffectsInputModeButton) {
        DOMI.toggleEffectsInputModeButton.addEventListener('click', () => {
            setEffectsInputMode(currentEffectsInputMode === 'structured' ? 'manual' : 'structured');
        });
    }

    if (DOMI.addTreeSourceToListButton) DOMI.addTreeSourceToListButton.addEventListener('click', handleAddTreeSource);
    if (DOMI.addManualSourceToListButton) DOMI.addManualSourceToListButton.addEventListener('click', handleAddManualSource);
    if (DOMI.toggleSourceInputModeButton) {
        DOMI.toggleSourceInputModeButton.addEventListener('click', () => {
            setSourceInputMode(currentSourceInputMode === 'tree' ? 'manual' : 'tree');
        });
    }

    if (DOMI.itemSearchAdminInput) DOMI.itemSearchAdminInput.addEventListener('input', _renderItemsAdminTableInternal);
    if (DOMI.deleteItemFromFormButton) {
        DOMI.deleteItemFromFormButton.addEventListener('click', () => {
            const itemId = DOMI.itemIdToEditInput.value;
            const itemName = DOMI.itemNameInput.value || '(名称未設定)';
            const itemImageUrl = DOMI.itemImageUrlInput.value;
            if (itemId) deleteItem(itemId, itemName, itemImageUrl);
            else alert("削除対象のアイテムが選択されていません。");
        });
    }

    initializeRaritySelector();
    if (window.adminModules && window.adminModules.itemSourceManager &&
        typeof window.adminModules.itemSourceManager.populateItemSourceLevelButtons === 'function') {
        window.adminModules.itemSourceManager.populateItemSourceLevelButtons(
            null, // parentId
            1,    // level
            DOMI.itemSourceButtonSelectionArea,
            DOMI.selectedItemSourcePathDisplay,
            DOMI.selectedItemSourceNodeId_temp,
            [],   // currentSelectedPath
            null, // initialSelectedNodeId
            // ===== 変更箇所: finalSourceDisplayPreviewInput を渡す =====
            DOMI.finalSourceDisplayPreviewInput
            // ===== ここまで =====
        );
    }
    console.log("[Item Manager] Initialized.");
}

function setEffectsInputMode(mode) {
    currentEffectsInputMode = mode;
    if (mode === 'manual') {
        if (DOMI.structuredEffectsInputArea) DOMI.structuredEffectsInputArea.style.display = 'none';
        if (DOMI.manualEffectsInputArea) DOMI.manualEffectsInputArea.style.display = 'block';
        if (DOMI.toggleEffectsInputModeButton) DOMI.toggleEffectsInputModeButton.textContent = '構造化入力に戻す';
        if(DOMI.manualEffectsStringTextarea) DOMI.manualEffectsStringTextarea.focus();
    } else {
        if (DOMI.structuredEffectsInputArea) DOMI.structuredEffectsInputArea.style.display = 'block';
        if (DOMI.manualEffectsInputArea) DOMI.manualEffectsInputArea.style.display = 'none';
        if (DOMI.toggleEffectsInputModeButton) DOMI.toggleEffectsInputModeButton.textContent = '入力欄に切り替え';
        if(DOMI.effectTypeSelect) DOMI.effectTypeSelect.focus();
    }
    switchToAddEffectMode();
}

function setSourceInputMode(mode) {
    currentSourceInputMode = mode;
    if (mode === 'manual') {
        if (DOMI.treeSourceInputArea) DOMI.treeSourceInputArea.style.display = 'none';
        if (DOMI.manualSourceInputArea) DOMI.manualSourceInputArea.style.display = 'block';
        if (DOMI.toggleSourceInputModeButton) DOMI.toggleSourceInputModeButton.textContent = '選択式に切り替え';
        if(DOMI.manualSourceStringTextarea) DOMI.manualSourceStringTextarea.focus();
    } else {
        if (DOMI.treeSourceInputArea) DOMI.treeSourceInputArea.style.display = 'block';
        if (DOMI.manualSourceInputArea) DOMI.manualSourceInputArea.style.display = 'none';
        if (DOMI.toggleSourceInputModeButton) DOMI.toggleSourceInputModeButton.textContent = '入力欄に切り替え';
        if (window.adminModules && window.adminModules.itemSourceManager &&
            typeof window.adminModules.itemSourceManager.populateItemSourceLevelButtons === 'function') {
            window.adminModules.itemSourceManager.populateItemSourceLevelButtons(
                null,
                1,
                DOMI.itemSourceButtonSelectionArea,
                DOMI.selectedItemSourcePathDisplay,
                DOMI.selectedItemSourceNodeId_temp,
                [],
                null,
                // ===== 変更箇所: finalSourceDisplayPreviewInput を渡す =====
                DOMI.finalSourceDisplayPreviewInput
                // ===== ここまで =====
            );
        }
    }
    switchToAddSourceMode();
}

function initializeRaritySelector() {
    if (!DOMI.itemRaritySelector || !DOMI.itemRarityValueInput) return;
    DOMI.itemRaritySelector.innerHTML = '';
    for (let i = 1; i <= MAX_RARITY; i++) {
        const star = document.createElement('span');
        star.classList.add('star');
        star.dataset.value = i;
        star.textContent = '★';
        star.addEventListener('click', () => handleRarityStarClick(i));
        DOMI.itemRaritySelector.appendChild(star);
    }
    setRarityUI(0);
}

function handleRarityStarClick(value) {
    const currentValue = parseInt(DOMI.itemRarityValueInput.value, 10);
    if (currentValue === value) {
        setRarityUI(0);
    } else {
        setRarityUI(value);
    }
}

function setRarityUI(value) {
    if (!DOMI.itemRaritySelector || !DOMI.itemRarityValueInput) return;
    DOMI.itemRarityValueInput.value = value;
    const stars = DOMI.itemRaritySelector.querySelectorAll('.star');
    stars.forEach(star => {
        if (parseInt(star.dataset.value, 10) <= value) {
            star.classList.add('selected');
        } else {
            star.classList.remove('selected');
        }
    });
}

function switchToAddEffectMode() {
    itemEffectEditMode = false;
    itemEffectEditingIndex = -1;
    if (DOMI.addEffectToListButton) DOMI.addEffectToListButton.textContent = '効果をリストに追加';
    if (DOMI.addManualEffectToListButton) DOMI.addManualEffectToListButton.textContent = '手動入力をリストに追加';
    if (DOMI.effectTypeSelect) DOMI.effectTypeSelect.value = '';
    if (DOMI.effectValueInput) DOMI.effectValueInput.value = '';
    if (DOMI.manualEffectsStringTextarea) DOMI.manualEffectsStringTextarea.value = '';
    updateItemFormEffectUnitDisplay();
}

function switchToAddSourceMode() {
    itemSourceEditMode = false;
    itemSourceEditingIndex = -1;
    if (DOMI.addTreeSourceToListButton) DOMI.addTreeSourceToListButton.textContent = '選択した経路をリストに追加';
    if (DOMI.addManualSourceToListButton) DOMI.addManualSourceToListButton.textContent = '手動入力をリストに追加';
    if (DOMI.selectedItemSourcePathDisplay) DOMI.selectedItemSourcePathDisplay.value = '未選択';
    if (DOMI.selectedItemSourceNodeId_temp) DOMI.selectedItemSourceNodeId_temp.value = '';
    // ===== 追加: プレビューもクリア =====
    if (DOMI.finalSourceDisplayPreviewInput) DOMI.finalSourceDisplayPreviewInput.value = '';
    // ===== ここまで =====
    if (DOMI.manualSourceStringTextarea) DOMI.manualSourceStringTextarea.value = '';
    if (currentSourceInputMode === 'tree' && window.adminModules && window.adminModules.itemSourceManager &&
        typeof window.adminModules.itemSourceManager.populateItemSourceLevelButtons === 'function') {
        window.adminModules.itemSourceManager.populateItemSourceLevelButtons(
            null,
            1,
            DOMI.itemSourceButtonSelectionArea,
            DOMI.selectedItemSourcePathDisplay,
            DOMI.selectedItemSourceNodeId_temp,
            [],
            null,
            // ===== 変更箇所: finalSourceDisplayPreviewInput を渡す =====
            DOMI.finalSourceDisplayPreviewInput
            // ===== ここまで =====
        );
    }
}

function clearItemFormInternal() {
    if (DOMI.itemForm) DOMI.itemForm.reset();

    DOMI.itemIdToEditInput.value = '';
    DOMI.itemImageUrlInput.value = '';
    if (DOMI.itemImagePreview) {
        DOMI.itemImagePreview.src = '#';
        DOMI.itemImagePreview.style.display = 'none';
    }
    selectedImageFile = null;
    if (DOMI.itemImageFileInput) DOMI.itemImageFileInput.value = null;

    if (DOMI.uploadProgressContainer) {
        DOMI.uploadProgressContainer.style.display = 'none';
        if (DOMI.uploadProgress) DOMI.uploadProgress.value = 0;
        if (DOMI.uploadProgressText) DOMI.uploadProgressText.textContent = '';
    }

    setRarityUI(0);

    currentItemEffects = [];
    setEffectsInputMode('structured');
    renderCurrentItemEffectsListUI();

    currentItemSources = [];
    setSourceInputMode('tree'); // This will call populateItemSourceLevelButtons internally, which should handle the preview input
    renderCurrentItemSourcesListUI();
    // ===== 追加: フォームクリア時に明示的にプレビューもクリア =====
    if (DOMI.finalSourceDisplayPreviewInput) DOMI.finalSourceDisplayPreviewInput.value = '';
    // ===== ここまで =====


    _populateTagButtonsForItemFormInternal();

    if (DOMI.saveItemButton) DOMI.saveItemButton.textContent = "アイテム保存";
    if (DOMI.deleteItemFromFormButton) DOMI.deleteItemFromFormButton.style.display = 'none';

    if (DOMI.itemNameInput) DOMI.itemNameInput.focus();
    console.log("[Item Manager] Item form cleared.");
}

export function _populateTagButtonsForItemFormInternal(selectedTagIds = []) {
    if(!DOMI.itemTagsButtonContainer) {
        console.error("_populateTagButtonsForItemFormInternal: itemTagsButtonContainer not found in DOMI");
        return;
    }
    DOMI.itemTagsButtonContainer.innerHTML = '';
    const allTags = getAllTagsFuncCache();
    const allCategories = getAllCategoriesFuncCache();

    const tagsByCategory = {};
    const unclassifiedTags = [];

    allTags.forEach(tag => {
        let classified = false;
        if (tag.categoryIds && tag.categoryIds.length > 0) {
            tag.categoryIds.forEach(catId => {
                const category = allCategories.find(c => c.id === catId && c.parentId);
                if (category) {
                    const parentCategory = allCategories.find(p => p.id === category.parentId);
                    const categoryGroupName = parentCategory ? `${parentCategory.name} > ${category.name}` : category.name;
                    if (!tagsByCategory[categoryGroupName]) {
                        tagsByCategory[categoryGroupName] = [];
                    }
                    if(!tagsByCategory[categoryGroupName].find(t => t.id === tag.id)) {
                        tagsByCategory[categoryGroupName].push(tag);
                    }
                    classified = true;
                }
            });
        }
        if (!classified) {
            if(!unclassifiedTags.find(t => t.id === tag.id)) {
                 unclassifiedTags.push(tag);
            }
        }
    });

    const sortedCategoryNames = Object.keys(tagsByCategory).sort((a,b) => a.localeCompare(b, 'ja'));

    if (sortedCategoryNames.length === 0 && unclassifiedTags.length === 0) {
        DOMI.itemTagsButtonContainer.innerHTML = '<p>利用可能なタグがありません。</p>';
        return;
    }

    sortedCategoryNames.forEach(categoryName => {
        const categoryGroupDiv = document.createElement('div');
        categoryGroupDiv.classList.add('tag-category-group');
        const categoryHeader = document.createElement('h5');
        categoryHeader.textContent = categoryName;
        categoryGroupDiv.appendChild(categoryHeader);

        const tagsInThisCategory = tagsByCategory[categoryName].sort((a,b) => a.name.localeCompare(b.name, 'ja'));
        const tagButtonsDiv = document.createElement('div');
        tagButtonsDiv.classList.add('tag-buttons-wrapper');

        tagsInThisCategory.forEach(tag => {
            const button = document.createElement('div');
            button.className = 'tag-filter admin-tag-select';
            button.textContent = tag.name;
            button.dataset.tagId = tag.id;
            if (selectedTagIds.includes(tag.id)) {
                button.classList.add('active');
            }
            button.setAttribute('role', 'button');
            button.setAttribute('tabindex', '0');
            button.addEventListener('click', () => {
                button.classList.toggle('active');
            });
            button.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    button.classList.toggle('active');
                }
            });
            tagButtonsDiv.appendChild(button);
        });
        categoryGroupDiv.appendChild(tagButtonsDiv);
        DOMI.itemTagsButtonContainer.appendChild(categoryGroupDiv);
    });

    if (unclassifiedTags.length > 0) {
        const categoryGroupDiv = document.createElement('div');
        categoryGroupDiv.classList.add('tag-category-group');
        const categoryHeader = document.createElement('h5');
        categoryHeader.textContent = "未分類";
        categoryGroupDiv.appendChild(categoryHeader);
        const tagButtonsDiv = document.createElement('div');
        tagButtonsDiv.classList.add('tag-buttons-wrapper');
        unclassifiedTags.sort((a,b) => a.name.localeCompare(b.name, 'ja')).forEach(tag => {
            const button = document.createElement('div');
            button.className = 'tag-filter admin-tag-select';
            button.textContent = tag.name;
            button.dataset.tagId = tag.id;
            if (selectedTagIds.includes(tag.id)) button.classList.add('active');
            button.setAttribute('role', 'button');
            button.setAttribute('tabindex', '0');
            button.addEventListener('click', () => {
                button.classList.toggle('active');
            });
            button.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    button.classList.toggle('active');
                }
            });
            tagButtonsDiv.appendChild(button);
        });
        categoryGroupDiv.appendChild(tagButtonsDiv);
        DOMI.itemTagsButtonContainer.appendChild(categoryGroupDiv);
    }
}

function handleImageFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        if (file.size > 5 * 1024 * 1024) {
            alert("ファイルサイズが大きすぎます。5MB以下の画像を選択してください。");
            event.target.value = null;
            selectedImageFile = null;
            if (DOMI.itemImagePreview) { DOMI.itemImagePreview.style.display = 'none'; DOMI.itemImagePreview.src = '#';}
            return;
        }
        if (!file.type.startsWith('image/')) {
            alert("画像ファイルを選択してください (例: JPG, PNG, GIF)。");
            event.target.value = null;
            selectedImageFile = null;
            if (DOMI.itemImagePreview) { DOMI.itemImagePreview.style.display = 'none'; DOMI.itemImagePreview.src = '#';}
            return;
        }
        selectedImageFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            if (DOMI.itemImagePreview) {
                DOMI.itemImagePreview.src = e.target.result;
                DOMI.itemImagePreview.style.display = 'block';
            }
        }
        reader.readAsDataURL(selectedImageFile);
        DOMI.itemImageUrlInput.value = '';
        if (DOMI.uploadProgressContainer) DOMI.uploadProgressContainer.style.display = 'none';
    } else {
        selectedImageFile = null;
    }
}

function updateItemFormEffectUnitDisplay() {
    if (!DOMI.effectUnitDisplay || !DOMI.effectTypeSelect) return;
    const selectedOption = DOMI.effectTypeSelect.options[DOMI.effectTypeSelect.selectedIndex];
    const unitName = selectedOption ? selectedOption.dataset.unitName : null;
    DOMI.effectUnitDisplay.textContent = (unitName && unitName !== '' && unitName !== 'none') ? `(${unitName})` : '';
}

function handleAddOrUpdateStructuredEffect() {
    const typeId = DOMI.effectTypeSelect.value;
    const valueStr = DOMI.effectValueInput.value;

    if (!typeId) { alert("効果種類を選択してください。"); return; }
    if (valueStr.trim() === '' || isNaN(parseFloat(valueStr))) { alert("効果の値を数値で入力してください。"); return; }

    const value = parseFloat(valueStr);
    const selectedOption = DOMI.effectTypeSelect.options[DOMI.effectTypeSelect.selectedIndex];
    const unit = (selectedOption && selectedOption.dataset.unitName && selectedOption.dataset.unitName !== 'none') ? selectedOption.dataset.unitName : null;

    const newEffect = { type: "structured", effectTypeId: typeId, value: value, unit: unit };

    if (itemEffectEditMode && itemEffectEditingIndex >= 0 && itemEffectEditingIndex < currentItemEffects.length) {
        currentItemEffects[itemEffectEditingIndex] = newEffect;
    } else {
        currentItemEffects.push(newEffect);
    }
    renderCurrentItemEffectsListUI();
    switchToAddEffectMode();
}

function handleAddManualEffect() {
    const manualString = DOMI.manualEffectsStringTextarea.value.trim();
    if (!manualString) { alert("手動入力の効果文字列を入力してください。"); return; }

    const newEffect = { type: "manual", manualString: manualString };

    if (itemEffectEditMode && itemEffectEditingIndex >= 0 && itemEffectEditingIndex < currentItemEffects.length) {
        currentItemEffects[itemEffectEditingIndex] = newEffect;
    } else {
        currentItemEffects.push(newEffect);
    }
    renderCurrentItemEffectsListUI();
    switchToAddEffectMode();
}

function renderCurrentItemEffectsListUI() {
    if (!DOMI.currentEffectsList) return;
    DOMI.currentEffectsList.innerHTML = '';
    const effectTypesCache = getEffectTypesFuncCache();
    const effectUnitsCache = getEffectUnitsFuncCache();

    if (currentItemEffects.length === 0) {
        DOMI.currentEffectsList.innerHTML = '<p>効果が追加されていません。</p>'; return;
    }
    currentItemEffects.forEach((effect, index) => {
        let displayText = "";
        if (effect.type === "manual") {
            displayText = `手動: ${effect.manualString}`;
        } else if (effect.type === "structured") {
            const effectType = effectTypesCache.find(et => et.id === effect.effectTypeId);
            const typeName = effectType ? effectType.name : '不明な効果';
            let effectText;
            const unitName = effect.unit;
            if (unitName && unitName !== 'none') {
                const unitData = effectUnitsCache.find(u => u.name === unitName);
                const position = unitData ? unitData.position : 'suffix';
                if (position === 'prefix') effectText = `${unitName}${effect.value}`;
                else effectText = `${effect.value}${unitName}`;
            } else effectText = `${effect.value}`;
            displayText = `${typeName} ${effectText}`;
        } else {
            displayText = "不明な効果タイプ";
        }

        const div = document.createElement('div');
        div.classList.add('effect-list-item');
        div.innerHTML = `
            <span>${displayText}</span>
            <div>
                <button type="button" class="edit-effect-in-list action-button edit" data-index="${index}" title="この効果を編集">✎</button>
                <button type="button" class="delete-effect-from-list action-button delete" data-index="${index}" title="この効果を削除">×</button>
            </div>
        `;
        div.querySelector('.edit-effect-in-list').addEventListener('click', (e) => {
            const editIndex = parseInt(e.currentTarget.dataset.index, 10);
            const effectToEdit = currentItemEffects[editIndex];
            if (effectToEdit) {
                itemEffectEditMode = true;
                itemEffectEditingIndex = editIndex;
                if (effectToEdit.type === "manual") {
                    setEffectsInputMode('manual');
                    if(DOMI.manualEffectsStringTextarea) DOMI.manualEffectsStringTextarea.value = effectToEdit.manualString;
                    if(DOMI.addManualEffectToListButton) DOMI.addManualEffectToListButton.textContent = '手動入力を更新';
                    if(DOMI.addEffectToListButton) DOMI.addEffectToListButton.textContent = '効果をリストに追加';
                } else {
                    setEffectsInputMode('structured');
                    if(DOMI.effectTypeSelect) DOMI.effectTypeSelect.value = effectToEdit.effectTypeId;
                    if(DOMI.effectValueInput) DOMI.effectValueInput.value = effectToEdit.value;
                    updateItemFormEffectUnitDisplay();
                    if(DOMI.addEffectToListButton) DOMI.addEffectToListButton.textContent = '構造化効果を更新';
                    if(DOMI.addManualEffectToListButton) DOMI.addManualEffectToListButton.textContent = '手動入力をリストに追加';
                }
            }
        });
        div.querySelector('.delete-effect-from-list').addEventListener('click', (e) => {
            const deleteIndex = parseInt(e.currentTarget.dataset.index, 10);
            currentItemEffects.splice(deleteIndex, 1);
            renderCurrentItemEffectsListUI();
            if (itemEffectEditMode && itemEffectEditingIndex === deleteIndex) {
                switchToAddEffectMode();
            }
        });
        DOMI.currentEffectsList.appendChild(div);
    });
}

function handleAddTreeSource() {
    const nodeId = DOMI.selectedItemSourceNodeId_temp.value;
    const displayPath = DOMI.selectedItemSourcePathDisplay.value;
    // ===== 変更箇所: プレビュー欄から最終表示テキストを取得 =====
    const finalDisplayFromPreview = DOMI.finalSourceDisplayPreviewInput ? DOMI.finalSourceDisplayPreviewInput.value : "";
    // ===== ここまで =====

    if (!nodeId) { alert("入手経路を選択してください（リストに追加するには、いずれかの経路ボタンが選択されている状態である必要があります）。"); return; }

    // ===== 変更箇所: resolvedDisplay にプレビューのテキストを使用 =====
    const newSource = { type: "tree", nodeId: nodeId, resolvedDisplay: finalDisplayFromPreview || displayPath }; // フォールバックとしてボタンパス名
    // ===== ここまで =====

    if (itemSourceEditMode && itemSourceEditingIndex >= 0 && itemSourceEditingIndex < currentItemSources.length) {
        currentItemSources[itemSourceEditingIndex] = newSource;
    } else {
        currentItemSources.push(newSource);
    }
    renderCurrentItemSourcesListUI();
    switchToAddSourceMode();
}

function handleAddManualSource() {
    const manualString = DOMI.manualSourceStringTextarea.value.trim();
    if (!manualString) { alert("手動入力の入手手段を入力してください。"); return; }

    const newSource = { type: "manual", manualString: manualString };

    if (itemSourceEditMode && itemSourceEditingIndex >= 0 && itemSourceEditingIndex < currentItemSources.length) {
        currentItemSources[itemSourceEditingIndex] = newSource;
    } else {
        currentItemSources.push(newSource);
    }
    renderCurrentItemSourcesListUI();
    switchToAddSourceMode();
}

function renderCurrentItemSourcesListUI() {
    if (!DOMI.currentSourcesList) return;
    DOMI.currentSourcesList.innerHTML = '';

    if (currentItemSources.length === 0) {
        DOMI.currentSourcesList.innerHTML = '<p>入手手段が追加されていません。</p>'; return;
    }

    currentItemSources.forEach((source, index) => {
        let displayText = "";
        if (source.type === "manual") {
            displayText = `手動: ${source.manualString}`;
        } else if (source.type === "tree") {
            displayText = source.resolvedDisplay || `経路ID: ${source.nodeId ? source.nodeId.substring(0,8) : '不明'}`;
        } else {
            displayText = "不明な入手手段タイプ";
        }

        const div = document.createElement('div');
        div.classList.add('effect-list-item');
        div.innerHTML = `
            <span>${displayText}</span>
            <div>
                <button type="button" class="edit-source-in-list action-button edit" data-index="${index}" title="この入手手段を編集">✎</button>
                <button type="button" class="delete-source-from-list action-button delete" data-index="${index}" title="この入手手段を削除">×</button>
            </div>
        `;
        div.querySelector('.edit-source-in-list').addEventListener('click', (e) => {
            const editIndex = parseInt(e.currentTarget.dataset.index, 10);
            const sourceToEdit = currentItemSources[editIndex];
            if (sourceToEdit) {
                itemSourceEditMode = true;
                itemSourceEditingIndex = editIndex;
                if (sourceToEdit.type === "manual") {
                    setSourceInputMode('manual');
                    if(DOMI.manualSourceStringTextarea) DOMI.manualSourceStringTextarea.value = sourceToEdit.manualString;
                    if(DOMI.addManualSourceToListButton) DOMI.addManualSourceToListButton.textContent = '手動入力を更新';
                    if(DOMI.addTreeSourceToListButton) DOMI.addTreeSourceToListButton.textContent = '選択した経路をリストに追加';

                } else {
                    setSourceInputMode('tree');
                    if(DOMI.selectedItemSourceNodeId_temp) DOMI.selectedItemSourceNodeId_temp.value = sourceToEdit.nodeId;
                    // ===== 変更箇所: resolvedDisplay を pathDisplay と preview の両方に設定 =====
                    const displayForPathAndPreview = sourceToEdit.resolvedDisplay || "";
                    if(DOMI.selectedItemSourcePathDisplay) DOMI.selectedItemSourcePathDisplay.value = displayForPathAndPreview; // ここはボタンパス名よりresolvedDisplayを優先
                    if(DOMI.finalSourceDisplayPreviewInput) DOMI.finalSourceDisplayPreviewInput.value = displayForPathAndPreview;
                    // ===== ここまで =====

                    if(DOMI.addTreeSourceToListButton) DOMI.addTreeSourceToListButton.textContent = '選択経路を更新';
                    if(DOMI.addManualSourceToListButton) DOMI.addManualSourceToListButton.textContent = '手動入力をリストに追加';

                    if (window.adminModules && window.adminModules.itemSourceManager &&
                        typeof window.adminModules.itemSourceManager.populateItemSourceLevelButtons === 'function') {
                        window.adminModules.itemSourceManager.populateItemSourceLevelButtons(
                            null,
                            1,
                            DOMI.itemSourceButtonSelectionArea,
                            DOMI.selectedItemSourcePathDisplay,
                            DOMI.selectedItemSourceNodeId_temp,
                            [], // パスの再構築は populate... 関数内で行われる
                            sourceToEdit.nodeId, // 初期選択ノードID
                            // ===== 変更箇所: finalSourceDisplayPreviewInput を渡す =====
                            DOMI.finalSourceDisplayPreviewInput
                            // ===== ここまで =====
                        );
                    }
                }
            }
        });
        div.querySelector('.delete-source-from-list').addEventListener('click', (e) => {
            const deleteIndex = parseInt(e.currentTarget.dataset.index, 10);
            currentItemSources.splice(deleteIndex, 1);
            renderCurrentItemSourcesListUI();
            if (itemSourceEditMode && itemSourceEditingIndex === deleteIndex) {
                switchToAddSourceMode();
            }
        });
        DOMI.currentSourcesList.appendChild(div);
    });
}

async function uploadImageToWorkerAndGetURL(file) {
    if (!file || !IMAGE_UPLOAD_WORKER_URL_CONST) {
        console.warn("uploadImageToWorkerAndGetURL: No file or Worker URL provided. URL:", IMAGE_UPLOAD_WORKER_URL_CONST);
        return null;
    }
    if (DOMI.uploadProgressContainer) DOMI.uploadProgressContainer.style.display = 'block';
    if (DOMI.uploadProgress) DOMI.uploadProgress.value = 0;
    if (DOMI.uploadProgressText) DOMI.uploadProgressText.textContent = 'アップロード準備中...';

    const formData = new FormData();
    formData.append('imageFile', file);
    let intervalId;
    try {
        if (DOMI.uploadProgressText) DOMI.uploadProgressText.textContent = 'アップロード中... (0%)';
        let progress = 0;
        if (DOMI.uploadProgress) {
            intervalId = setInterval(() => {
                progress += 10;
                if (progress <= 90) {
                    if (DOMI.uploadProgress) DOMI.uploadProgress.value = progress;
                    if (DOMI.uploadProgressText) DOMI.uploadProgressText.textContent = `アップロード中... (${progress}%)`;
                } else { clearInterval(intervalId); }
            }, 150);
        }
        const response = await fetch(IMAGE_UPLOAD_WORKER_URL_CONST, { method: 'POST', body: formData });
        if (intervalId) clearInterval(intervalId);
        if (DOMI.uploadProgress) DOMI.uploadProgress.value = 100;
        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Image Upload] Upload failed:', response.status, errorText);
            let errorMessage = `画像のアップロードに失敗 (HTTP ${response.status})`;
            try {
                const errorData = JSON.parse(errorText);
                if (errorData && errorData.message) errorMessage = `画像エラー: ${errorData.message}`;
                else if (errorData && errorData.error) errorMessage = `画像エラー: ${errorData.error}`;
            } catch (e) { if(errorText) errorMessage += `: ${errorText.substring(0,100)}`; }
            alert(errorMessage);
            if (DOMI.uploadProgressText) DOMI.uploadProgressText.textContent = '失敗';
            setTimeout(() => { if (DOMI.uploadProgressContainer) DOMI.uploadProgressContainer.style.display = 'none'; }, 3000);
            return null;
        }
        const result = await response.json();
        if (result.success && result.imageUrl) {
            if (DOMI.uploadProgressText) DOMI.uploadProgressText.textContent = '完了!';
            setTimeout(() => { if (DOMI.uploadProgressContainer) DOMI.uploadProgressContainer.style.display = 'none'; }, 2000);
            return result.imageUrl;
        } else {
            alert(`画像アップロードエラー(Worker): ${result.message || '不明な応答'}`);
            if (DOMI.uploadProgressText) DOMI.uploadProgressText.textContent = 'エラー';
            setTimeout(() => { if (DOMI.uploadProgressContainer) DOMI.uploadProgressContainer.style.display = 'none'; }, 3000);
            return null;
        }
    } catch (error) {
        if (intervalId) clearInterval(intervalId);
        alert(`画像アップロード中に予期せぬエラー: ${error.message}`);
        if (DOMI.uploadProgressText) DOMI.uploadProgressText.textContent = '通信エラー';
        setTimeout(() => { if (DOMI.uploadProgressContainer) DOMI.uploadProgressContainer.style.display = 'none'; }, 3000);
        return null;
    }
}

async function saveItem(event) {
    event.preventDefault();
    if (DOMI.saveItemButton) {
        DOMI.saveItemButton.disabled = true;
        DOMI.saveItemButton.textContent = "保存中...";
    }

    const name = DOMI.itemNameInput.value.trim();
    const priceStr = DOMI.itemPriceInput.value.trim();

    let selectedItemTagIds = [];
    if (DOMI.itemTagsButtonContainer) {
        const activeTagButtons = DOMI.itemTagsButtonContainer.querySelectorAll('.tag-filter.admin-tag-select.active[data-tag-id]');
        activeTagButtons.forEach(button => {
            if (button.dataset.tagId) {
                selectedItemTagIds.push(button.dataset.tagId);
            }
        });
        console.log("[Item Manager] Directly collected Tag IDs in saveItem:", selectedItemTagIds);
    } else {
        console.error("saveItem: DOMI.itemTagsButtonContainer is null. Cannot get selected tags.");
    }

    const editingDocId = DOMI.itemIdToEditInput.value;
    const rarity = parseInt(DOMI.itemRarityValueInput.value, 10) || 0;
    let imageUrlToSave = DOMI.itemImageUrlInput.value || "";

    if (!name) {
        alert("アイテム名は必須です。");
        if (DOMI.saveItemButton) { DOMI.saveItemButton.disabled = false; DOMI.saveItemButton.textContent = editingDocId ? "アイテム更新" : "アイテム保存"; }
        return;
    }
    let priceToSave = null;
    if (priceStr !== "") {
        const parsedPrice = parseInt(priceStr, 10);
        if (!isNaN(parsedPrice) && parsedPrice >= 0) priceToSave = parsedPrice;
        else { alert("売値は0以上の数値を入力してください。"); if (DOMI.saveItemButton) { DOMI.saveItemButton.disabled = false; DOMI.saveItemButton.textContent = editingDocId ? "アイテム更新" : "アイテム保存"; } return; }
    }

    try {
        if (selectedImageFile) {
            const uploadedUrl = await uploadImageToWorkerAndGetURL(selectedImageFile);
            if (uploadedUrl) imageUrlToSave = uploadedUrl;
        }

        const itemDataPayload = {
            name: name,
            image: imageUrlToSave,
            rarity: rarity,
            tags: selectedItemTagIds,
            effects: currentItemEffects,
            sources: currentItemSources,
        };

        if (priceToSave !== null) {
            itemDataPayload.price = priceToSave;
        } else if (editingDocId) {
            itemDataPayload.price = deleteField();
        }

        if (editingDocId) {
            itemDataPayload.updatedAt = serverTimestamp();
            itemDataPayload.effectsInputMode = deleteField();
            itemDataPayload.manualEffectsString = deleteField();
            itemDataPayload.structured_effects = deleteField();
            itemDataPayload.sourceInputMode = deleteField();
            itemDataPayload.manualSourceString = deleteField();
            itemDataPayload.sourceNodeId = deleteField();
            itemDataPayload.入手手段 = deleteField();

            await updateDoc(doc(dbInstance, 'items', editingDocId), itemDataPayload);
            console.log("Item updated:", editingDocId);
        } else {
            itemDataPayload.createdAt = serverTimestamp();
            itemDataPayload.updatedAt = serverTimestamp();
            await addDoc(collection(dbInstance, 'items'), itemDataPayload);
            console.log("Item added.");
        }
        clearItemFormInternal();
        await refreshAllDataCallback();
    } catch (error) {
        console.error("[Item Manager] Error saving item:", error);
        alert(`アイテム保存エラー: ${error.message}`);
    } finally {
        if (DOMI.saveItemButton) {
            DOMI.saveItemButton.disabled = false;
            DOMI.saveItemButton.textContent = document.getElementById('itemIdToEdit').value ? "アイテム更新" : "アイテム保存";
        }
    }
}

export function _renderItemsAdminTableInternal() {
    if (!DOMI.itemsTableBody) return;
    const itemsCache = getAllItemsFuncCache();
    const allTags = getAllTagsFuncCache();
    const effectTypesCache = getEffectTypesFuncCache();
    const effectUnitsCache = getEffectUnitsFuncCache();
    const itemSourcesCacheData = getItemSourcesFuncCache(); // itemSourcesCache を itemSourcesCacheData に変更
    DOMI.itemsTableBody.innerHTML = '';

    const searchTerm = DOMI.itemSearchAdminInput ? DOMI.itemSearchAdminInput.value.toLowerCase() : "";
    const filteredItems = itemsCache.filter(item =>
        (item.name && item.name.toLowerCase().includes(searchTerm)) ||
        (!searchTerm && (item.name === "" || !item.name))
    ).sort((a,b) => (a.name || "").localeCompare(b.name || "", 'ja'));

    if (filteredItems.length === 0) {
        const tr = DOMI.itemsTableBody.insertRow();
        const td = tr.insertCell();
        td.colSpan = 7;
        td.textContent = searchTerm ? '検索条件に一致するアイテムはありません。' : 'アイテムが登録されていません。';
        td.style.textAlign = 'center';
        return;
    }

    filteredItems.forEach(item => {
        const tr = document.createElement('tr');
        tr.classList.add('table-row-clickable');
        tr.dataset.itemDocId = item.docId;

        const imageDisplayPath = item.image || './images/placeholder_item.png';
        const nameDisplay = item.name || '(名称未設定)';
        const priceDisplay = (typeof item.price === 'number' && !isNaN(item.price)) ? `${item.price}G` : '未設定';
        const rarityDisplay = `星${item.rarity || 0}`;

        let effectsDisplayHtml = '<ul class="effect-list-in-table">';
        if (item.effects && item.effects.length > 0) {
            item.effects.forEach(eff => {
                if (eff.type === "manual") {
                    effectsDisplayHtml += `<li>・${eff.manualString ? eff.manualString.replace(/\n/g, '<br>') : ''}</li>`;
                } else if (eff.type === "structured") {
                    const typeInfo = effectTypesCache.find(et => et.id === eff.effectTypeId);
                    const typeName = typeInfo ? typeInfo.name : `不明(${eff.effectTypeId ? eff.effectTypeId.substring(0, 6) : 'IDなし'}...)`;
                    let effectTextPart;
                    const unitName = eff.unit;
                    if (unitName && unitName !== 'none') {
                        const unitData = effectUnitsCache.find(u => u.name === unitName);
                        const position = unitData ? unitData.position : 'suffix';
                        effectTextPart = position === 'prefix' ? `${unitName}${eff.value}` : `${eff.value}${unitName}`;
                    } else { effectTextPart = `${eff.value}`; }
                    effectsDisplayHtml += `<li>・${typeName} ${effectTextPart}</li>`;
                }
            });
        } else if (item.effectsInputMode === 'manual' && item.manualEffectsString) {
             effectsDisplayHtml += `<li>・${item.manualEffectsString.replace(/\n/g, '<br>')}</li>`;
        } else if (item.structured_effects && item.structured_effects.length > 0) {
            item.structured_effects.forEach(eff => {
                const typeInfo = effectTypesCache.find(et => et.id === eff.type);
                const typeName = typeInfo ? typeInfo.name : `不明(${eff.type ? eff.type.substring(0, 6) : 'IDなし'}...)`;
                let effectTextPart;
                const unitName = eff.unit;
                if (unitName && unitName !== 'none') {
                    const unitData = effectUnitsCache.find(u => u.name === unitName);
                    const position = unitData ? unitData.position : 'suffix';
                    effectTextPart = position === 'prefix' ? `${unitName}${eff.value}` : `${eff.value}${unitName}`;
                } else { effectTextPart = `${eff.value}`; }
                effectsDisplayHtml += `<li>・${typeName} ${effectTextPart}</li>`;
            });
        } else { effectsDisplayHtml += '<li>効果なし</li>'; }
        effectsDisplayHtml += '</ul>';

        let sourceDisplayHtml = '<ul class="effect-list-in-table">';
        if (item.sources && item.sources.length > 0) {
            item.sources.forEach(src => {
                if (src.type === 'manual') {
                    sourceDisplayHtml += `<li>・${src.manualString ? src.manualString.replace(/\n/g, '<br>') : ''}</li>`;
                } else if (src.type === 'tree' && src.nodeId) {
                    let pathText = src.resolvedDisplay;
                    if (!pathText && window.adminModules && window.adminModules.itemSourceManager && typeof window.adminModules.itemSourceManager.buildDisplayPathForSourceNode === 'function') {
                        pathText = window.adminModules.itemSourceManager.buildDisplayPathForSourceNode(src.nodeId, itemSourcesCacheData);
                    } else if (!pathText) {
                        pathText = `経路ID: ${src.nodeId.substring(0,8)}...`;
                    }
                    sourceDisplayHtml += `<li>・${pathText}</li>`;
                }
            });
        } else if (item.sourceInputMode === 'manual' && item.manualSourceString) {
            sourceDisplayHtml += `<li>・${item.manualSourceString.replace(/\n/g, '<br>')}</li>`;
        } else if (item.sourceNodeId && itemSourcesCacheData.length > 0) {
            let pathText = `(経路ID: ${item.sourceNodeId.substring(0,8)}...)`;
            if (window.adminModules && window.adminModules.itemSourceManager && typeof window.adminModules.itemSourceManager.buildDisplayPathForSourceNode === 'function') {
                pathText = window.adminModules.itemSourceManager.buildDisplayPathForSourceNode(item.sourceNodeId, itemSourcesCacheData);
            }
            sourceDisplayHtml += `<li>・${pathText}</li>`;
        } else if (item.入手手段) {
             sourceDisplayHtml += `<li>・${item.入手手段}</li>`;
        } else { sourceDisplayHtml += '<li>不明</li>'; }
        sourceDisplayHtml += '</ul>';

        let tagsHtml = '';
        if (item.tags && item.tags.length > 0) {
            tagsHtml = (item.tags || [])
                .map(tagId => { const tag = allTags.find(t => t.id === tagId); return tag ? `<span class="tag-display-in-table">${tag.name}</span>` : ''; })
                .filter(name => name).sort((a,b) => a.localeCompare(b, 'ja')).join(' ');
        } else { tagsHtml = 'なし'; }

        tr.innerHTML = `
            <td><img src="${imageDisplayPath}" alt="${nameDisplay}" onerror="this.onerror=null; this.src='./images/no_image_placeholder.png'; this.style.backgroundColor='#eee';"></td>
            <td>${nameDisplay}</td>
            <td>${rarityDisplay}</td>
            <td>${priceDisplay}</td>
            <td>${effectsDisplayHtml}</td>
            <td>${tagsHtml}</td>
            <td>${sourceDisplayHtml}</td>`;

        tr.addEventListener('click', () => loadItemForEdit(item.docId));
        DOMI.itemsTableBody.appendChild(tr);
    });
}

async function loadItemForEdit(docId) {
    try {
        const itemSnap = await getDoc(doc(dbInstance, "items", docId));
        if (itemSnap.exists()) {
            const itemData = itemSnap.data();
            clearItemFormInternal();

            DOMI.itemIdToEditInput.value = itemSnap.id;
            DOMI.itemNameInput.value = itemData.name || "";
            DOMI.itemImageUrlInput.value = itemData.image || '';
            if (DOMI.itemPriceInput) DOMI.itemPriceInput.value = (typeof itemData.price === 'number' && !isNaN(itemData.price)) ? String(itemData.price) : '';
            setRarityUI(itemData.rarity || 0);
            if (itemData.image && DOMI.itemImagePreview) {
                DOMI.itemImagePreview.src = itemData.image;
                DOMI.itemImagePreview.style.display = 'block';
            }
            selectedImageFile = null;
            if(DOMI.itemImageFileInput) DOMI.itemImageFileInput.value = null;

            if (itemData.effects && Array.isArray(itemData.effects)) {
                currentItemEffects = JSON.parse(JSON.stringify(itemData.effects));
            } else {
                currentItemEffects = [];
                if (itemData.effectsInputMode === 'manual' && itemData.manualEffectsString) {
                    currentItemEffects.push({ type: 'manual', manualString: itemData.manualEffectsString });
                } else if (itemData.structured_effects && Array.isArray(itemData.structured_effects)) {
                    itemData.structured_effects.forEach(oldEff => {
                        currentItemEffects.push({ type: 'structured', effectTypeId: oldEff.type, value: oldEff.value, unit: oldEff.unit });
                    });
                }
            }
            renderCurrentItemEffectsListUI();
            setEffectsInputMode('structured');

            if (itemData.sources && Array.isArray(itemData.sources)) {
                currentItemSources = JSON.parse(JSON.stringify(itemData.sources));
                for (const src of currentItemSources) {
                    if(src.type === 'tree' && src.nodeId && !src.resolvedDisplay) {
                        if (window.adminModules && window.adminModules.itemSourceManager && typeof window.adminModules.itemSourceManager.buildDisplayPathForSourceNode === 'function') {
                             src.resolvedDisplay = window.adminModules.itemSourceManager.buildDisplayPathForSourceNode(src.nodeId, getItemSourcesFuncCache());
                        } else {
                             src.resolvedDisplay = `経路ID(再構築不可): ${src.nodeId.substring(0,8)}...`;
                        }
                    }
                }
            } else {
                currentItemSources = [];
                if (itemData.sourceInputMode === 'manual' && itemData.manualSourceString) {
                    currentItemSources.push({ type: 'manual', manualString: itemData.manualSourceString });
                } else if (itemData.sourceNodeId) {
                    let display = `ID:${itemData.sourceNodeId.substring(0,5)}..`;
                    if (window.adminModules && window.adminModules.itemSourceManager && typeof window.adminModules.itemSourceManager.buildDisplayPathForSourceNode === 'function') {
                        display = window.adminModules.itemSourceManager.buildDisplayPathForSourceNode(itemData.sourceNodeId, getItemSourcesFuncCache());
                    }
                    currentItemSources.push({ type: 'tree', nodeId: itemData.sourceNodeId, resolvedDisplay: display });
                } else if (itemData.入手手段) {
                     currentItemSources.push({ type: 'manual', manualString: itemData.入手手段 });
                }
            }
            renderCurrentItemSourcesListUI();
            setSourceInputMode('tree');
            // ===== 変更箇所: 編集読み込み時に、選択式入手手段のプレビューも初期化 =====
            if (DOMI.finalSourceDisplayPreviewInput) DOMI.finalSourceDisplayPreviewInput.value = '';
            // もし、編集対象アイテムの最初の tree source があれば、それを populateItemSourceLevelButtons で初期選択し、プレビューも更新
            const firstTreeSource = currentItemSources.find(s => s.type === 'tree' && s.nodeId);
            if (firstTreeSource && window.adminModules && window.adminModules.itemSourceManager &&
                typeof window.adminModules.itemSourceManager.populateItemSourceLevelButtons === 'function') {
                window.adminModules.itemSourceManager.populateItemSourceLevelButtons(
                    null,
                    1,
                    DOMI.itemSourceButtonSelectionArea,
                    DOMI.selectedItemSourcePathDisplay,
                    DOMI.selectedItemSourceNodeId_temp,
                    [],
                    firstTreeSource.nodeId, // このノードを初期選択
                    DOMI.finalSourceDisplayPreviewInput
                );
                // populateItemSourceLevelButtons がプレビューを更新するはず
            }
            // ===== ここまで =====


            _populateTagButtonsForItemFormInternal(itemData.tags || []);
            if (DOMI.saveItemButton) DOMI.saveItemButton.textContent = "アイテム更新";
            if (DOMI.deleteItemFromFormButton) DOMI.deleteItemFromFormButton.style.display = 'inline-block';

            const itemFormSection = document.getElementById('item-management');
            if (itemFormSection) itemFormSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            DOMI.itemNameInput.focus();
        } else { alert("編集対象のアイテムが見つかりませんでした。"); }
    } catch (error) { console.error("[Item Manager] Error loading item for edit:", error); alert("編集データの読み込み中にエラーが発生しました。"); }
}

async function deleteItem(docId, itemName, imageUrl) {
    if (confirm(`アイテム「${itemName}」を削除しますか？\n注意: Cloudflare R2上の関連画像は、この操作では削除されません。\nこの操作は元に戻せません。`)) {
        try {
            await deleteDoc(doc(dbInstance, 'items', docId));
            if (imageUrl) {
                console.warn(`Image ${imageUrl} (associated with deleted item ${docId}) may need manual deletion from Cloudflare R2.`);
            }
            if (DOMI.itemIdToEditInput.value === docId) {
                clearItemFormInternal();
            }
            await refreshAllDataCallback();
        } catch (error) {
            console.error(`[Item Manager] Error deleting item ${docId}:`, error);
            alert("アイテムの削除に失敗しました。");
        }
    }
}
