// js/admin-modules/item-manager.js
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, serverTimestamp, deleteField, getDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { populateCheckboxGroup, getSelectedCheckboxValues } from './ui-helpers.js';

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
    effectsInputModeHiddenInput: null, 
    structuredEffectsArea: null,      // 効果の構造化入力エリア全体
    structuredEffectsInputArea: null, // 効果の個別入力部分 (select, input, addEffectToListButtonなど)
    manualEffectsArea: null,
    manualEffectsStringTextarea: null,
    addManualEffectToListButton: null, // 手動効果をリストに追加するボタン
    effectTypeSelect: null,
    effectValueInput: null,
    effectUnitDisplay: null,
    addEffectToListButton: null,      // 構造化効果をリストに追加するボタン (テキスト変更)
    currentEffectsList: null,         // 効果リスト表示エリア
    
    toggleSourceInputModeButton: null,
    sourceInputModeHiddenInput: null, 
    treeSourceArea: null,             // 入手手段のツリー選択エリア全体
    treeSourceInputArea: null,        // 入手手段のツリー選択の入力部分
    manualSourceArea: null,
    manualSourceStringTextarea: null,
    addManualSourceToListButton: null, // 手動入手手段をリストに追加するボタン
    itemSourceDisplay: null,          // ツリー選択された経路候補の表示 (readonly)
    selectedItemSourceNodeId_temp: null, // ツリー選択モーダルからの戻り値一時保持用
    selectItemSourceButton: null,     // ツリー選択モーダルを開くボタン
    addTreeSourceToListButton: null,  // ツリー選択された経路をリストに追加するボタン
    currentSourcesList: null,         // 入手手段リスト表示エリア

    itemTagsSelectorCheckboxes: null,
    deleteItemFromFormButton: null,
    saveItemButton: null,
    clearFormButton: null,
    itemsTableBody: null,
    itemSearchAdminInput: null,
};

let dbInstance = null;
let getAllItemsFuncCache = () => [];
let getAllTagsFuncCache = () => [];
let getEffectTypesFuncCache = () => [];
let getEffectUnitsFuncCache = () => [];
let getItemSourcesFuncCache = () => [];
let refreshAllDataCallback = async () => {};

let currentItemEffects = []; // 現在編集中のアイテムの効果リスト (構造化されたもの)
let currentItemSources = []; // 現在編集中のアイテムの入手手段リスト
let selectedImageFile = null;
let IMAGE_UPLOAD_WORKER_URL_CONST = '';

let itemEffectEditMode = false; // 効果リスト内のアイテムを編集中か
let itemEffectEditingIndex = -1;
let itemSourceEditMode = false; // 入手手段リスト内のアイテムを編集中か
let itemSourceEditingIndex = -1;


const MAX_RARITY = 5;

export function initItemManager(dependencies) {
    dbInstance = dependencies.db;
    getAllItemsFuncCache = dependencies.getItems;
    getAllTagsFuncCache = dependencies.getAllTags;
    getEffectTypesFuncCache = dependencies.getEffectTypes;
    getEffectUnitsFuncCache = dependencies.getEffectUnits;
    getItemSourcesFuncCache = dependencies.getItemSources;
    refreshAllDataCallback = dependencies.refreshAllData;
    IMAGE_UPLOAD_WORKER_URL_CONST = dependencies.uploadWorkerUrl;

    // DOM要素取得
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
    DOMI.effectsInputModeHiddenInput = document.getElementById('effectsInputMode');
    DOMI.structuredEffectsArea = document.getElementById('structuredEffectsArea'); // HTML側のIDと合わせる
    DOMI.structuredEffectsInputArea = document.getElementById('structuredEffectsInputArea');
    DOMI.manualEffectsArea = document.getElementById('manualEffectsArea');
    DOMI.manualEffectsStringTextarea = document.getElementById('manualEffectsString');
    DOMI.addManualEffectToListButton = document.getElementById('addManualEffectToListButton');
    DOMI.effectTypeSelect = document.getElementById('effectTypeSelect');
    DOMI.effectValueInput = document.getElementById('effectValueInput');
    DOMI.effectUnitDisplay = document.getElementById('effectUnitDisplay');
    DOMI.addEffectToListButton = document.getElementById('addEffectToListButton');
    DOMI.currentEffectsList = document.getElementById('currentEffectsList');
    
    DOMI.toggleSourceInputModeButton = document.getElementById('toggleSourceInputModeButton');
    DOMI.sourceInputModeHiddenInput = document.getElementById('sourceInputMode');
    DOMI.treeSourceArea = document.getElementById('treeSourceArea'); // HTML側のIDと合わせる
    DOMI.treeSourceInputArea = document.getElementById('treeSourceInputArea');
    DOMI.manualSourceArea = document.getElementById('manualSourceArea');
    DOMI.manualSourceStringTextarea = document.getElementById('manualSourceString'); // HTML側のIDと合わせる
    DOMI.addManualSourceToListButton = document.getElementById('addManualSourceToListButton');
    DOMI.itemSourceDisplay = document.getElementById('itemSourceDisplay');
    DOMI.selectedItemSourceNodeId_temp = document.getElementById('selectedItemSourceNodeId_temp');
    DOMI.selectItemSourceButton = document.getElementById('selectItemSourceButton');
    DOMI.addTreeSourceToListButton = document.getElementById('addTreeSourceToListButton');
    DOMI.currentSourcesList = document.getElementById('currentSourcesList');

    DOMI.itemTagsSelectorCheckboxes = document.getElementById('itemTagsSelectorCheckboxes');
    DOMI.deleteItemFromFormButton = document.getElementById('deleteItemFromFormButton');
    DOMI.saveItemButton = document.getElementById('saveItemButton');
    DOMI.clearFormButton = document.getElementById('clearFormButton');
    DOMI.itemsTableBody = document.querySelector('#itemsTable tbody');
    DOMI.itemSearchAdminInput = document.getElementById('itemSearchAdmin');

    // イベントリスナー設定
    if (DOMI.itemForm) DOMI.itemForm.addEventListener('submit', saveItem);
    if (DOMI.clearFormButton) DOMI.clearFormButton.addEventListener('click', clearItemFormInternal);
    if (DOMI.itemImageFileInput) DOMI.itemImageFileInput.addEventListener('change', handleImageFileSelect);
    
    // 効果設定関連リスナー
    if (DOMI.addEffectToListButton) DOMI.addEffectToListButton.addEventListener('click', handleAddOrUpdateStructuredEffect);
    if (DOMI.addManualEffectToListButton) DOMI.addManualEffectToListButton.addEventListener('click', handleAddManualEffect);
    if (DOMI.effectTypeSelect) DOMI.effectTypeSelect.addEventListener('change', updateItemFormEffectUnitDisplay);
    if (DOMI.toggleEffectsInputModeButton) {
        DOMI.toggleEffectsInputModeButton.addEventListener('click', () => {
            const currentMode = DOMI.effectsInputModeHiddenInput.value;
            if (currentMode === 'structured') {
                setEffectsInputMode('manual');
            } else {
                setEffectsInputMode('structured');
            }
        });
    }

    // 入手手段設定関連リスナー
    if (DOMI.selectItemSourceButton) {
        DOMI.selectItemSourceButton.addEventListener('click', () => {
            if (window.adminModules && window.adminModules.itemSourceManager && 
                typeof window.adminModules.itemSourceManager.openSelectItemSourceModalForItemForm === 'function') {
                // モーダルから選択された結果をコールバックで受け取るようにする
                window.adminModules.itemSourceManager.openSelectItemSourceModalForItemForm(
                    (nodeId, displayPath) => { // コールバック関数
                        if (nodeId && DOMI.selectedItemSourceNodeId_temp && DOMI.itemSourceDisplay) {
                            DOMI.selectedItemSourceNodeId_temp.value = nodeId;
                            DOMI.itemSourceDisplay.value = displayPath;
                        }
                    }
                );
            } else {
                console.error("ItemSourceManager's openSelectItemSourceModalForItemForm function not found.");
                alert("入手経路選択機能の読み込みに失敗しました。");
            }
        });
    }
    if (DOMI.addTreeSourceToListButton) DOMI.addTreeSourceToListButton.addEventListener('click', handleAddTreeSource);
    if (DOMI.addManualSourceToListButton) DOMI.addManualSourceToListButton.addEventListener('click', handleAddManualSource);
    if (DOMI.toggleSourceInputModeButton) {
        DOMI.toggleSourceInputModeButton.addEventListener('click', () => {
            const currentMode = DOMI.sourceInputModeHiddenInput.value;
            if (currentMode === 'tree') {
                setSourceInputMode('manual');
            } else {
                setSourceInputMode('tree');
            }
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
    console.log("[Item Manager] Initialized.");
}

// --- UIモード切り替え関数 ---
function setEffectsInputMode(mode) {
    if (!DOMI.effectsInputModeHiddenInput || !DOMI.structuredEffectsInputArea || !DOMI.manualEffectsInputArea || !DOMI.toggleEffectsInputModeButton) return;
    DOMI.effectsInputModeHiddenInput.value = mode;
    if (mode === 'manual') {
        DOMI.structuredEffectsInputArea.style.display = 'none';
        DOMI.manualEffectsInputArea.style.display = 'block';
        DOMI.toggleEffectsInputModeButton.textContent = '構造化入力に戻す';
        if(DOMI.manualEffectsStringTextarea) DOMI.manualEffectsStringTextarea.focus();
    } else { // structured
        DOMI.structuredEffectsInputArea.style.display = 'block';
        DOMI.manualEffectsInputArea.style.display = 'none';
        DOMI.toggleEffectsInputModeButton.textContent = '入力欄に切り替え';
        if(DOMI.effectTypeSelect) DOMI.effectTypeSelect.focus();
    }
}

function setSourceInputMode(mode) {
    if (!DOMI.sourceInputModeHiddenInput || !DOMI.treeSourceInputArea || !DOMI.manualSourceInputArea || !DOMI.toggleSourceInputModeButton) return;
    DOMI.sourceInputModeHiddenInput.value = mode;
    if (mode === 'manual') {
        DOMI.treeSourceInputArea.style.display = 'none';
        DOMI.manualSourceInputArea.style.display = 'block';
        DOMI.toggleSourceInputModeButton.textContent = '選択式に切り替え';
        if(DOMI.manualSourceStringTextarea) DOMI.manualSourceStringTextarea.focus();
    } else { // tree
        DOMI.treeSourceInputArea.style.display = 'block';
        DOMI.manualSourceInputArea.style.display = 'none';
        DOMI.toggleSourceInputModeButton.textContent = '入力欄に切り替え';
        if(DOMI.selectItemSourceButton) DOMI.selectItemSourceButton.focus();
    }
}


// --- (initializeRaritySelector, handleRarityStarClick, setRarityUI は変更なし) ---
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
    if (DOMI.itemSourceDisplay) DOMI.itemSourceDisplay.value = '';
    if (DOMI.selectedItemSourceNodeId_temp) DOMI.selectedItemSourceNodeId_temp.value = '';
    if (DOMI.manualSourceStringTextarea) DOMI.manualSourceStringTextarea.value = '';
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
    setEffectsInputMode('structured'); // デフォルトに戻す
    switchToAddEffectMode();
    renderCurrentItemEffectsListUI();

    currentItemSources = [];
    setSourceInputMode('tree'); // デフォルトに戻す
    switchToAddSourceMode();
    renderCurrentItemSourcesListUI();


    _populateTagCheckboxesForItemFormInternal();

    if (DOMI.saveItemButton) DOMI.saveItemButton.textContent = "アイテム保存";
    if (DOMI.deleteItemFromFormButton) DOMI.deleteItemFromFormButton.style.display = 'none';
    
    if (DOMI.itemNameInput) DOMI.itemNameInput.focus();
    console.log("[Item Manager] Item form cleared.");
}

// ... ( _populateTagCheckboxesForItemFormInternal, handleImageFileSelect, updateItemFormEffectUnitDisplay は変更なし)
export function _populateTagCheckboxesForItemFormInternal(selectedTagIds = []) {
    if(!DOMI.itemTagsSelectorCheckboxes) return;
    const allTags = getAllTagsFuncCache().sort((a,b) => a.name.localeCompare(b.name, 'ja'));
    const tagOptions = allTags.map(tag => ({ id: tag.id, name: tag.name }));
    populateCheckboxGroup(
        DOMI.itemTagsSelectorCheckboxes,
        tagOptions,
        selectedTagIds,
        'itemTag',
        'item-tag-sel-'
    );
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

// --- 効果リスト操作 ---
function handleAddOrUpdateStructuredEffect() { // 名前変更
    const typeId = DOMI.effectTypeSelect.value;
    const valueStr = DOMI.effectValueInput.value;

    if (!typeId) { alert("効果種類を選択してください。"); return; }
    if (valueStr.trim() === '' || isNaN(parseFloat(valueStr))) { alert("効果の値を数値で入力してください。"); return; }

    const value = parseFloat(valueStr);
    const selectedOption = DOMI.effectTypeSelect.options[DOMI.effectTypeSelect.selectedIndex];
    const unit = (selectedOption && selectedOption.dataset.unitName && selectedOption.dataset.unitName !== 'none') ? selectedOption.dataset.unitName : null;

    const newEffect = { type: "structured", effectTypeId: typeId, value: value, unit: unit }; // typeプロパティ追加

    if (itemEffectEditMode && itemEffectEditingIndex >= 0 && itemEffectEditingIndex < currentItemEffects.length) {
        currentItemEffects[itemEffectEditingIndex] = newEffect;
    } else {
        currentItemEffects.push(newEffect);
    }
    renderCurrentItemEffectsListUI();
    switchToAddEffectMode(); // フォームをリセット
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
    switchToAddEffectMode(); // フォームをリセット
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
        div.classList.add('effect-list-item'); // CSSクラスは共通で良いか確認
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
                } else { // structured
                    setEffectsInputMode('structured');
                    if(DOMI.effectTypeSelect) DOMI.effectTypeSelect.value = effectToEdit.effectTypeId;
                    if(DOMI.effectValueInput) DOMI.effectValueInput.value = effectToEdit.value;
                    updateItemFormEffectUnitDisplay(); // 単位表示を更新
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
                switchToAddEffectMode(); // 編集中のものが削除されたら追加モードに戻す
            }
        });
        DOMI.currentEffectsList.appendChild(div);
    });
}

// --- 入手手段リスト操作 ---
function handleAddTreeSource() {
    const nodeId = DOMI.selectedItemSourceNodeId_temp.value;
    const displayPath = DOMI.itemSourceDisplay.value; // モーダルで選択された表示パス
    if (!nodeId) { alert("入手経路を選択してください。"); return; }

    // displayStringをitem_sourcesから取得する
    const nodeData = getItemSourcesFuncCache().find(s => s.id === nodeId);
    const actualDisplayString = (nodeData && nodeData.displayString) ? nodeData.displayString : displayPath; // displayStringがあれば優先

    const newSource = { type: "tree", nodeId: nodeId, resolvedDisplay: actualDisplayString };

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
    const itemSourcesCache = getItemSourcesFuncCache();

    if (currentItemSources.length === 0) {
        DOMI.currentSourcesList.innerHTML = '<p>入手手段が追加されていません。</p>'; return;
    }

    currentItemSources.forEach((source, index) => {
        let displayText = "";
        if (source.type === "manual") {
            displayText = `手動: ${source.manualString}`;
        } else if (source.type === "tree") {
            if (source.resolvedDisplay) { // 保存時に解決した表示名を使う
                displayText = source.resolvedDisplay;
            } else { // フォールバック (本来はresolvedDisplayがあるはず)
                const node = itemSourcesCache.find(s => s.id === source.nodeId);
                if (node) {
                    displayText = node.displayString || node.name; // ノードのdisplayStringかname
                } else {
                    displayText = `不明な経路 (ID: ${source.nodeId ? source.nodeId.substring(0,8) : 'なし'})`;
                }
            }
        } else {
            displayText = "不明な入手手段タイプ";
        }

        const div = document.createElement('div');
        div.classList.add('effect-list-item'); // CSSクラスは効果リストと共通
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

                } else { // tree
                    setSourceInputMode('tree');
                    if(DOMI.selectedItemSourceNodeId_temp) DOMI.selectedItemSourceNodeId_temp.value = sourceToEdit.nodeId;
                    // itemSourceDisplayには、編集対象の表示名をセットする (itemSourceManagerから取得)
                    if (window.adminModules && window.adminModules.itemSourceManager && 
                        typeof window.adminModules.itemSourceManager.displaySelectedItemSourcePathOnLoad === 'function') {
                        // この関数はitemSourceDisplayを直接更新するので、その結果を利用
                         window.adminModules.itemSourceManager.displaySelectedItemSourcePathOnLoad(sourceToEdit.nodeId)
                            .then(() => {
                                // DOMI.itemSourceDisplay.value は displaySelectedItemSourcePathOnLoad によって設定される
                            });
                    } else {
                         if(DOMI.itemSourceDisplay) DOMI.itemSourceDisplay.value = sourceToEdit.resolvedDisplay || `(ID: ${sourceToEdit.nodeId})`;
                    }
                    if(DOMI.addTreeSourceToListButton) DOMI.addTreeSourceToListButton.textContent = '選択経路を更新';
                    if(DOMI.addManualSourceToListButton) DOMI.addManualSourceToListButton.textContent = '手動入力をリストに追加';
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


// ... (uploadImageToWorkerAndGetURL は変更なし)
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
    const selectedItemTagIds = getSelectedCheckboxValues(DOMI.itemTagsSelectorCheckboxes, 'itemTag');
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

        // 以前の入力モード関連フィールドは削除し、新しい sources 配列と effects 配列を使用
        const itemDataPayload = {
            name: name,
            image: imageUrlToSave, 
            rarity: rarity, 
            tags: selectedItemTagIds,
            effects: currentItemEffects, // 新しい効果データ構造
            sources: currentItemSources, // 新しい入手手段データ構造
        };
        
        if (priceToSave !== null) {
            itemDataPayload.price = priceToSave;
        } else if (editingDocId) { 
            itemDataPayload.price = deleteField();
        }
        
        if (editingDocId) {
            itemDataPayload.updatedAt = serverTimestamp();
            // 古い可能性のあるフィールドを削除
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
    const itemSourcesCache = getItemSourcesFuncCache();
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
                    effectsDisplayHtml += `<li>・${eff.manualString.replace(/\n/g, '<br>')} (手動)</li>`;
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
        } else { effectsDisplayHtml += '<li>効果なし</li>'; }
        effectsDisplayHtml += '</ul>';

        let sourceDisplayHtml = '<ul class="effect-list-in-table">'; // リスト形式で表示
        if (item.sources && item.sources.length > 0) {
            item.sources.forEach(src => {
                if (src.type === 'manual') {
                    sourceDisplayHtml += `<li>・${src.manualString.replace(/\n/g, '<br>')} (手動)</li>`;
                } else if (src.type === 'tree' && src.nodeId) {
                    const selectedSourceNode = itemSourcesCache.find(s => s.id === src.nodeId);
                    let pathText = `(経路ID: ${src.nodeId.substring(0,8)}...)`; // デフォルト
                    if (selectedSourceNode && selectedSourceNode.displayString && selectedSourceNode.displayString.trim() !== "") {
                        pathText = selectedSourceNode.displayString;
                    } else if (selectedSourceNode) { // displayStringがない場合はパスを構築
                        const pathParts = [];
                        let currentId = src.nodeId;
                        let sanityCheck = 0;
                        while(currentId && sanityCheck < 10) {
                            const node = itemSourcesCache.find(s => s.id === currentId);
                            if (node) { pathParts.unshift(node.name); currentId = node.parentId; }
                            else { pathParts.unshift(`[ID:${currentId.substring(0,5)}...]`); break; }
                            sanityCheck++;
                        }
                        if (pathParts.length > 0) pathText = pathParts.join(' > ');
                    }
                    sourceDisplayHtml += `<li>・${pathText}</li>`;
                }
            });
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

            // 効果設定の読み込み
            currentItemEffects = itemData.effects ? JSON.parse(JSON.stringify(itemData.effects)) : [];
            renderCurrentItemEffectsListUI(); 
            // effectsInputMode は削除されたので、関連するUI切り替えロジックも不要になる
            // もし古いデータにeffectsInputModeが残っていても、新しいeffects配列を見るので問題ないはず
            setEffectsInputMode('structured'); // UIは常に構造化入力から開始

            // 入手手段の読み込み
            currentItemSources = itemData.sources ? JSON.parse(JSON.stringify(itemData.sources)) : [];
            renderCurrentItemSourcesListUI();
            // sourceInputMode も削除された
            setSourceInputMode('tree'); // UIは常にツリー選択から開始
            

            _populateTagCheckboxesForItemFormInternal(itemData.tags || []);
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
