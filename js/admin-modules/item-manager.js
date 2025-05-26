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
    effectTypeSelect: null,
    effectValueInput: null,
    effectUnitDisplay: null,
    addEffectToListButton: null,
    currentEffectsList: null,
    // itemSourceInput: null, // 削除
    itemSourceDisplay: null,
    selectedItemSourceNodeIdInput: null,
    selectItemSourceButton: null,
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
let getItemSourcesFuncCache = () => []; // <<< 追加
let refreshAllDataCallback = async () => {};

let currentItemEffects = [];
let selectedImageFile = null;
let IMAGE_UPLOAD_WORKER_URL_CONST = '';

let itemEffectEditMode = false;
let itemEffectEditingIndex = -1;

const MAX_RARITY = 5;

export function initItemManager(dependencies) {
    dbInstance = dependencies.db;
    getAllItemsFuncCache = dependencies.getItems;
    getAllTagsFuncCache = dependencies.getAllTags;
    getEffectTypesFuncCache = dependencies.getEffectTypes;
    getEffectUnitsFuncCache = dependencies.getEffectUnits;
    getItemSourcesFuncCache = dependencies.getItemSources; // <<< 追加
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

    DOMI.effectTypeSelect = document.getElementById('effectTypeSelect');
    DOMI.effectValueInput = document.getElementById('effectValueInput');
    DOMI.effectUnitDisplay = document.getElementById('effectUnitDisplay');
    DOMI.addEffectToListButton = document.getElementById('addEffectToListButton');
    DOMI.currentEffectsList = document.getElementById('currentEffectsList');
    
    // DOMI.itemSourceInput = document.getElementById('itemSource'); // 削除
    DOMI.itemSourceDisplay = document.getElementById('itemSourceDisplay');
    DOMI.selectedItemSourceNodeIdInput = document.getElementById('selectedItemSourceNodeId');
    DOMI.selectItemSourceButton = document.getElementById('selectItemSourceButton');

    DOMI.itemTagsSelectorCheckboxes = document.getElementById('itemTagsSelectorCheckboxes');
    DOMI.deleteItemFromFormButton = document.getElementById('deleteItemFromFormButton');
    DOMI.saveItemButton = document.getElementById('saveItemButton');
    DOMI.clearFormButton = document.getElementById('clearFormButton');
    DOMI.itemsTableBody = document.querySelector('#itemsTable tbody');
    DOMI.itemSearchAdminInput = document.getElementById('itemSearchAdmin');

    if (DOMI.itemForm) DOMI.itemForm.addEventListener('submit', saveItem);
    if (DOMI.clearFormButton) DOMI.clearFormButton.addEventListener('click', clearItemFormInternal);
    if (DOMI.itemImageFileInput) DOMI.itemImageFileInput.addEventListener('change', handleImageFileSelect);
    if (DOMI.addEffectToListButton) DOMI.addEffectToListButton.addEventListener('click', handleAddOrUpdateEffect);
    if (DOMI.effectTypeSelect) DOMI.effectTypeSelect.addEventListener('change', updateItemFormEffectUnitDisplay);
    if (DOMI.itemSearchAdminInput) DOMI.itemSearchAdminInput.addEventListener('input', _renderItemsAdminTableInternal);
    
    if (DOMI.selectItemSourceButton) {
        DOMI.selectItemSourceButton.addEventListener('click', () => {
            // itemSourceManagerの関数を呼び出す
            if (window.adminModules && window.adminModules.itemSourceManager && 
                typeof window.adminModules.itemSourceManager.openSelectItemSourceModalForItemForm === 'function') {
                window.adminModules.itemSourceManager.openSelectItemSourceModalForItemForm();
            } else {
                console.error("ItemSourceManager's openSelectItemSourceModalForItemForm function not found on window.adminModules.itemSourceManager");
                alert("入手経路選択機能の読み込みに失敗しました。");
            }
        });
    }

    if (DOMI.deleteItemFromFormButton) {
        DOMI.deleteItemFromFormButton.addEventListener('click', () => {
            const itemId = DOMI.itemIdToEditInput.value;
            const itemName = DOMI.itemNameInput.value || '(名称未設定)';
            const itemImageUrl = DOMI.itemImageUrlInput.value;
            if (itemId) {
                deleteItem(itemId, itemName, itemImageUrl);
            } else {
                alert("削除対象のアイテムが選択されていません。");
            }
        });
    }
    
    initializeRaritySelector();

    console.log("[Item Manager] Initialized. Worker URL:", IMAGE_UPLOAD_WORKER_URL_CONST);
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
    setRarityUI(value); 
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
    if (DOMI.addEffectToListButton) DOMI.addEffectToListButton.textContent = '効果を追加';
    if (DOMI.effectTypeSelect) DOMI.effectTypeSelect.value = '';
    if (DOMI.effectValueInput) DOMI.effectValueInput.value = '';
    updateItemFormEffectUnitDisplay();
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
    _populateTagCheckboxesForItemFormInternal();

    if (DOMI.itemSourceDisplay) DOMI.itemSourceDisplay.value = "";
    if (DOMI.selectedItemSourceNodeIdInput) DOMI.selectedItemSourceNodeIdInput.value = "";

    if (DOMI.saveItemButton) DOMI.saveItemButton.textContent = "アイテム保存";
    if (DOMI.deleteItemFromFormButton) DOMI.deleteItemFromFormButton.style.display = 'none';
    
    switchToAddEffectMode();
    renderCurrentItemEffectsListUI();

    if (DOMI.itemNameInput) DOMI.itemNameInput.focus();
    console.log("[Item Manager] Item form cleared.");
}


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

function handleAddOrUpdateEffect() {
    const typeId = DOMI.effectTypeSelect.value;
    const valueStr = DOMI.effectValueInput.value;

    if (!typeId) { alert("効果種類を選択してください。"); return; }
    if (valueStr.trim() === '' || isNaN(parseFloat(valueStr))) { alert("効果の値を数値で入力してください。"); return; }

    const value = parseFloat(valueStr);
    const selectedOption = DOMI.effectTypeSelect.options[DOMI.effectTypeSelect.selectedIndex];
    const unit = (selectedOption && selectedOption.dataset.unitName && selectedOption.dataset.unitName !== 'none') ? selectedOption.dataset.unitName : null;

    const newEffect = { type: typeId, value: value, unit: unit };

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
        const effectType = effectTypesCache.find(et => et.id === effect.type);
        const typeName = effectType ? effectType.name : '不明な効果';
        
        let effectText;
        const unitName = effect.unit;
        if (unitName && unitName !== 'none') {
            const unitData = effectUnitsCache.find(u => u.name === unitName);
            const position = unitData ? unitData.position : 'suffix';
            if (position === 'prefix') {
                effectText = `${unitName}${effect.value}`;
            } else {
                effectText = `${effect.value}${unitName}`;
            }
        } else {
            effectText = `${effect.value}`;
        }

        const div = document.createElement('div');
        div.classList.add('effect-list-item');
        div.innerHTML = `
            <span>${typeName} ${effectText}</span>
            <div>
                <button type="button" class="edit-effect-in-list action-button edit" data-index="${index}" title="この効果を編集">✎</button>
                <button type="button" class="delete-effect-from-list action-button delete" data-index="${index}" title="この効果を削除">×</button>
            </div>
        `;
        div.querySelector('.edit-effect-in-list').addEventListener('click', (e) => {
            const editIndex = parseInt(e.currentTarget.dataset.index, 10);
            const effectToEdit = currentItemEffects[editIndex];
            if (effectToEdit) {
                DOMI.effectTypeSelect.value = effectToEdit.type;
                DOMI.effectValueInput.value = effectToEdit.value;
                updateItemFormEffectUnitDisplay();

                itemEffectEditMode = true;
                itemEffectEditingIndex = editIndex;
                if (DOMI.addEffectToListButton) DOMI.addEffectToListButton.textContent = '効果を更新';
                if (DOMI.effectTypeSelect) DOMI.effectTypeSelect.focus();
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

async function uploadImageToWorkerAndGetURL(file) {
    if (!file || !IMAGE_UPLOAD_WORKER_URL_CONST) {
        console.warn("uploadImageToWorkerAndGetURL: No file or Worker URL provided. URL:", IMAGE_UPLOAD_WORKER_URL_CONST);
        return null;
    }
    console.log("Starting image upload to (fetch):", IMAGE_UPLOAD_WORKER_URL_CONST);
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
                } else {
                    clearInterval(intervalId);
                }
            }, 150); 
        }

        const response = await fetch(IMAGE_UPLOAD_WORKER_URL_CONST, {
            method: 'POST',
            body: formData,
        });

        if (intervalId) clearInterval(intervalId); 
        if (DOMI.uploadProgress) DOMI.uploadProgress.value = 100; 

        if (!response.ok) {
            const errorText = await response.text(); 
            console.error('[Image Upload] Upload failed with status:', response.status, errorText);
            let errorMessage = `画像のアップロードに失敗しました (HTTP ${response.status})`;
            try { 
                const errorData = JSON.parse(errorText);
                if (errorData && errorData.message) errorMessage = `画像アップロードエラー: ${errorData.message}`;
                else if (errorData && errorData.error) errorMessage = `画像アップロードエラー: ${errorData.error}`;
            } catch (e) {
                if(errorText) errorMessage += `: ${errorText.substring(0,100)}`; 
                else if(response.statusText) errorMessage += `: ${response.statusText}`;
            }
            alert(errorMessage);
            if (DOMI.uploadProgressText) DOMI.uploadProgressText.textContent = 'アップロード失敗。';
            setTimeout(() => { if (DOMI.uploadProgressContainer) DOMI.uploadProgressContainer.style.display = 'none'; }, 3000);
            return null;
        }

        const result = await response.json();
        if (result.success && result.imageUrl) {
            if (DOMI.uploadProgressText) DOMI.uploadProgressText.textContent = 'アップロード完了!';
            setTimeout(() => { if (DOMI.uploadProgressContainer) DOMI.uploadProgressContainer.style.display = 'none'; }, 2000);
            return result.imageUrl;
        } else {
            console.error('[Image Upload] Worker response error:', result.message || 'Unknown error from worker', result);
            alert(`画像アップロードエラー(Worker): ${result.message || '予期せぬ応答'}`);
            if (DOMI.uploadProgressText) DOMI.uploadProgressText.textContent = 'アップロードエラー。';
            setTimeout(() => { if (DOMI.uploadProgressContainer) DOMI.uploadProgressContainer.style.display = 'none'; }, 3000);
            return null;
        }
    } catch (error) {
        if (intervalId) clearInterval(intervalId);
        console.error('[Image Upload] Error uploading image:', error);
        alert(`画像のアップロード中に予期せぬエラーが発生しました: ${error.message}`);
        if (DOMI.uploadProgressText) DOMI.uploadProgressText.textContent = '通信/処理エラー。';
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
    // const source = DOMI.itemSourceInput.value.trim(); // 削除
    const selectedSourceNodeId = DOMI.selectedItemSourceNodeIdInput.value; // <<< 追加
    const priceStr = DOMI.itemPriceInput.value.trim();
    const selectedItemTagIds = getSelectedCheckboxValues(DOMI.itemTagsSelectorCheckboxes, 'itemTag');
    const editingDocId = DOMI.itemIdToEditInput.value;
    
    const rarity = parseInt(DOMI.itemRarityValueInput.value, 10) || 0;

    let imageUrlToSave = DOMI.itemImageUrlInput.value || ""; 

    if (!name) {
        alert("アイテム名は必須です。");
        if (DOMI.saveItemButton) {
            DOMI.saveItemButton.disabled = false;
            DOMI.saveItemButton.textContent = editingDocId ? "アイテム更新" : "アイテム保存";
        }
        return;
    }

    let priceToSave = null; 
    if (priceStr !== "") {
        const parsedPrice = parseInt(priceStr, 10);
        if (!isNaN(parsedPrice) && parsedPrice >= 0) {
            priceToSave = parsedPrice;
        } else {
            alert("売値は0以上の数値を入力してください。");
            if (DOMI.saveItemButton) {
                DOMI.saveItemButton.disabled = false;
                DOMI.saveItemButton.textContent = editingDocId ? "アイテム更新" : "アイテム保存";
            }
            return;
        }
    }

    try {
        if (selectedImageFile) { 
            const uploadedUrl = await uploadImageToWorkerAndGetURL(selectedImageFile);
            if (uploadedUrl) {
                imageUrlToSave = uploadedUrl; 
            } else {
                console.warn("Image upload failed. Current imageUrlToSave:", imageUrlToSave);
                 // 画像アップロードに失敗しても、既存の画像URLがあればそれを使うか、
                 // もしくはエラーとして処理を中断するかは要件次第。ここでは続行する。
            }
        }

        const itemData = {
            name: name,
            image: imageUrlToSave, 
            rarity: rarity, 
            structured_effects: currentItemEffects,
            // 入手手段: source, // 削除
            sourceNodeId: selectedSourceNodeId || null, // <<< 追加
            tags: selectedItemTagIds,
            updatedAt: serverTimestamp()
        };
        // `入手手段` フィールドは削除 (もし存在したら null や deleteField() で更新時に消す)
        // itemData.入手手段 = deleteField(); // 更新時のみ必要
        
        if (editingDocId) {
            const updatePayload = { ...itemData };
            if (priceToSave !== null) {
                updatePayload.price = priceToSave;
            } else {
                updatePayload.price = deleteField(); 
            }
            
            if (selectedSourceNodeId) {
                updatePayload.sourceNodeId = selectedSourceNodeId;
            } else {
                updatePayload.sourceNodeId = deleteField();
            }
            updatePayload.入手手段 = deleteField(); // 古いフィールドを確実に削除

            await updateDoc(doc(dbInstance, 'items', editingDocId), updatePayload);
            console.log("Item updated:", editingDocId);
        } else { 
            itemData.createdAt = serverTimestamp();
            const dataToAdd = { ...itemData };
            if (priceToSave !== null) {
                dataToAdd.price = priceToSave;
            }
            // dataToAdd.sourceNodeId は itemData に含まれている
            // dataToAdd.入手手段 は itemData に含まれていないので、追加されない

            await addDoc(collection(dbInstance, 'items'), dataToAdd);
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
    const itemSourcesCache = getItemSourcesFuncCache(); // <<< 追加
    DOMI.itemsTableBody.innerHTML = '';

    const searchTerm = DOMI.itemSearchAdminInput ? DOMI.itemSearchAdminInput.value.toLowerCase() : "";
    const filteredItems = itemsCache.filter(item =>
        (item.name && item.name.toLowerCase().includes(searchTerm)) ||
        (!searchTerm && (item.name === "" || !item.name)) // 検索語がない場合は空の名前も含む
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
        
        let itemSourcePathDisplay = '不明'; // <<< 入手経路表示用
        if (item.sourceNodeId) {
            const pathParts = [];
            let currentId = item.sourceNodeId;
            let sanityCheck = 0;
            while(currentId && sanityCheck < 10) {
                const node = itemSourcesCache.find(s => s.id === currentId);
                if (node) {
                    pathParts.unshift(node.name);
                    currentId = node.parentId;
                } else {
                    pathParts.unshift(`[ID:${currentId.substring(0,5)}...]`);
                    break;
                }
                sanityCheck++;
            }
            if (pathParts.length > 0) itemSourcePathDisplay = pathParts.join(' > ');
            else if (item.sourceNodeId) itemSourcePathDisplay = `(経路ID: ${item.sourceNodeId.substring(0,8)}...)`;
        } else if (item.入手手段) { // 古いデータ形式のフォールバック
             itemSourcePathDisplay = item.入手手段;
        }
        
        const rarityDisplay = `星${item.rarity || 0}`;

        let effectsHtml = '<ul class="effect-list-in-table">';
        if (item.structured_effects && item.structured_effects.length > 0) {
            item.structured_effects.forEach(eff => {
                const typeInfo = effectTypesCache.find(et => et.id === eff.type);
                const typeName = typeInfo ? typeInfo.name : `不明(${eff.type.substring(0, 6)}...)`;
                let effectTextPart;
                const unitName = eff.unit;
                if (unitName && unitName !== 'none') {
                    const unitData = effectUnitsCache.find(u => u.name === unitName);
                    const position = unitData ? unitData.position : 'suffix';
                    effectTextPart = position === 'prefix' ? `${unitName}${eff.value}` : `${eff.value}${unitName}`;
                } else {
                    effectTextPart = `${eff.value}`;
                }
                effectsHtml += `<li>・${typeName} ${effectTextPart}</li>`;
            });
        } else {
            effectsHtml += '<li>効果なし</li>';
        }
        effectsHtml += '</ul>';

        let tagsHtml = '';
        if (item.tags && item.tags.length > 0) {
            tagsHtml = (item.tags || [])
                .map(tagId => {
                    const tag = allTags.find(t => t.id === tagId);
                    return tag ? `<span class="tag-display-in-table">${tag.name}</span>` : '';
                })
                .filter(name => name)
                .sort((a,b) => a.localeCompare(b, 'ja'))
                .join(' ');
        } else {
            tagsHtml = 'なし';
        }
        

        tr.innerHTML = `
            <td><img src="${imageDisplayPath}" alt="${nameDisplay}" onerror="this.onerror=null; this.src='./images/no_image_placeholder.png'; this.style.backgroundColor='#eee';"></td>
            <td>${nameDisplay}</td>
            <td>${rarityDisplay}</td>
            <td>${priceDisplay}</td>
            <td>${effectsHtml}</td>
            <td>${tagsHtml}</td>
            <td>${itemSourcePathDisplay}</td>`;
        
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
            // DOMI.itemSourceInput.value = itemData.入手手段 || ""; // 削除
            const sourceNodeId = itemData.sourceNodeId || ""; // <<< 追加
            DOMI.selectedItemSourceNodeIdInput.value = sourceNodeId; // <<< 追加
            
            // itemSourceManager の displaySelectedItemSourcePathOnLoad を呼び出す
            if (window.adminModules && window.adminModules.itemSourceManager && 
                typeof window.adminModules.itemSourceManager.displaySelectedItemSourcePathOnLoad === 'function') {
                await window.adminModules.itemSourceManager.displaySelectedItemSourcePathOnLoad(sourceNodeId);
            } else {
                console.warn("ItemSourceManager's displaySelectedItemSourcePathOnLoad function not found.");
                if (DOMI.itemSourceDisplay) { // フォールバック表示
                    DOMI.itemSourceDisplay.value = sourceNodeId ? `(選択済ID: ${sourceNodeId})` : "";
                }
            }

            DOMI.itemImageUrlInput.value = itemData.image || ''; 
            if (DOMI.itemPriceInput) DOMI.itemPriceInput.value = (typeof itemData.price === 'number' && !isNaN(itemData.price)) ? String(itemData.price) : '';
            
            setRarityUI(itemData.rarity || 0);

            if (itemData.image && DOMI.itemImagePreview) { 
                DOMI.itemImagePreview.src = itemData.image;
                DOMI.itemImagePreview.style.display = 'block';
            }
            selectedImageFile = null;
            if(DOMI.itemImageFileInput) DOMI.itemImageFileInput.value = null;

            _populateTagCheckboxesForItemFormInternal(itemData.tags || []);

            currentItemEffects = itemData.structured_effects ? JSON.parse(JSON.stringify(itemData.structured_effects)) : [];
            renderCurrentItemEffectsListUI(); 

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
