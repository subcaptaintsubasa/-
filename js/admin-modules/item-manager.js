// js/admin-modules/item-manager.js
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp, deleteField, getDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { populateCheckboxGroup, getSelectedCheckboxValues, populateSelect, clearForm as clearFormGeneric } from './ui-helpers.js'; // Using generic clearForm

const DOMI = { // DOM elements for Item Management
    itemForm: null,
    itemIdToEditInput: null,
    itemNameInput: null,
    itemImageFileInput: null,
    itemImagePreview: null,
    itemImageUrlInput: null, // Hidden input for existing/uploaded URL
    itemPriceInput: null,
    uploadProgressContainer: null,
    uploadProgress: null,
    uploadProgressText: null,
    // Effect input area in item form
    effectTypeSelect: null, // This is the item.structured_effects one
    effectValueInput: null,
    effectUnitDisplay: null,
    addEffectToListButton: null,
    currentEffectsList: null, // Container for added effects for the item
    itemSourceInput: null,
    itemTagsSelectorCheckboxes: null, // Container for tag checkboxes
    saveItemButton: null,
    clearFormButton: null,
    itemsTableBody: null,
    itemSearchAdminInput: null,
};

let dbInstance = null;
let getAllItemsFuncCache = () => [];
let getAllTagsFuncCache = () => [];
let getEffectTypesFuncCache = () => [];
let refreshAllDataCallback = async () => {};

// State for item form's effect list and image file
let currentItemEffects = []; // Array of { type: string, value: number, unit: string }
let selectedImageFile = null; // File object for new image upload
let IMAGE_UPLOAD_WORKER_URL_CONST = ''; // Passed in dependencies

export function initItemManager(dependencies) {
    dbInstance = dependencies.db;
    getAllItemsFuncCache = dependencies.getItems; // Note: getItems for item specific cache
    getAllTagsFuncCache = dependencies.getAllTags;
    getEffectTypesFuncCache = dependencies.getEffectTypes;
    refreshAllDataCallback = dependencies.refreshAllData;
    // setCurrentItemEffects = dependencies.setCurrentItemEffects; // Not needed if managed locally
    // getCurrentItemEffects = dependencies.getCurrentItemEffects; // Not needed if managed locally
    // setSelectedImageFile = dependencies.setSelectedImageFile; // Not needed if managed locally
    // getSelectedImageFile = dependencies.getSelectedImageFile; // Not needed if managed locally
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

    DOMI.effectTypeSelect = document.getElementById('effectTypeSelect');
    DOMI.effectValueInput = document.getElementById('effectValueInput');
    DOMI.effectUnitDisplay = document.getElementById('effectUnitDisplay');
    DOMI.addEffectToListButton = document.getElementById('addEffectToListButton');
    DOMI.currentEffectsList = document.getElementById('currentEffectsList');

    DOMI.itemSourceInput = document.getElementById('itemSource');
    DOMI.itemTagsSelectorCheckboxes = document.getElementById('itemTagsSelectorCheckboxes');
    DOMI.saveItemButton = document.getElementById('saveItemButton');
    DOMI.clearFormButton = document.getElementById('clearFormButton');
    DOMI.itemsTableBody = document.querySelector('#itemsTable tbody');
    DOMI.itemSearchAdminInput = document.getElementById('itemSearchAdmin');

    if (DOMI.itemForm) {
        DOMI.itemForm.addEventListener('submit', saveItem);
    }
    if (DOMI.clearFormButton) {
        DOMI.clearFormButton.addEventListener('click', clearItemFormInternal);
    }
    if (DOMI.itemImageFileInput) {
        DOMI.itemImageFileInput.addEventListener('change', handleImageFileSelect);
    }
    if (DOMI.addEffectToListButton) {
        DOMI.addEffectToListButton.addEventListener('click', addEffectToItemList);
    }
    if (DOMI.effectTypeSelect) {
        DOMI.effectTypeSelect.addEventListener('change', updateItemFormEffectUnitDisplay);
    }
    if (DOMI.itemSearchAdminInput) {
        DOMI.itemSearchAdminInput.addEventListener('input', renderItemsAdminTable);
    }

    // Initial population for item form elements
    populateTagCheckboxesForItemFormInternal();
    // Effect type select is populated by effect-type-manager via refreshAllData or direct call
    // _populateEffectTypeSelectsInternal(); in effect-type-manager handles DOMI.effectTypeSelect
    renderItemsAdminTable();
    renderCurrentItemEffectsListModal(); // Initial render of empty effects list
}

function clearItemFormInternal() {
    if (DOMI.itemForm) clearFormGeneric(DOMI.itemForm); // Use generic helper

    // Specific resets not handled by generic clearForm
    DOMI.itemIdToEditInput.value = '';
    DOMI.itemImageUrlInput.value = '';
    if (DOMI.itemImagePreview) {
        DOMI.itemImagePreview.src = '#';
        DOMI.itemImagePreview.style.display = 'none';
    }
    // itemImageFileInput is reset by form.reset()
    selectedImageFile = null;
    if (DOMI.uploadProgressContainer) {
        DOMI.uploadProgressContainer.style.display = 'none';
        if (DOMI.uploadProgress) DOMI.uploadProgress.value = 0;
        if (DOMI.uploadProgressText) DOMI.uploadProgressText.textContent = '';
    }

    currentItemEffects = [];
    renderCurrentItemEffectsListModal();
    if (DOMI.effectTypeSelect) DOMI.effectTypeSelect.value = ''; // Reset dropdown
    if (DOMI.effectValueInput) DOMI.effectValueInput.value = '';
    if (DOMI.effectUnitDisplay) DOMI.effectUnitDisplay.textContent = '';

    populateTagCheckboxesForItemFormInternal(); // Re-populate (clears selections)

    if (DOMI.saveItemButton) DOMI.saveItemButton.textContent = "アイテム保存";
    if (DOMI.itemNameInput) DOMI.itemNameInput.focus();
}


function populateTagCheckboxesForItemFormInternal(selectedTagIds = []) {
    const allTags = getAllTagsFuncCache();
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
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            alert("ファイルサイズが大きすぎます。5MB以下の画像を選択してください。");
            DOMI.itemImageFileInput.value = null; // Reset file input
            return;
        }
        if (!file.type.startsWith('image/')) {
            alert("画像ファイルを選択してください (例: JPG, PNG, GIF)。");
            DOMI.itemImageFileInput.value = null;
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
        DOMI.itemImageUrlInput.value = ''; // Clear manual URL if a file is chosen
        if (DOMI.uploadProgressContainer) DOMI.uploadProgressContainer.style.display = 'none';
    } else {
        selectedImageFile = null;
        // If user cancels, don't clear existing preview if editing an item
    }
}

function updateItemFormEffectUnitDisplay() {
    if (!DOMI.effectUnitDisplay || !DOMI.effectTypeSelect) return;
    const selectedTypeId = DOMI.effectTypeSelect.value;
    const effectTypesCache = getEffectTypesFuncCache();
    const selectedEffectType = effectTypesCache.find(et => et.id === selectedTypeId);

    if (selectedEffectType && selectedEffectType.defaultUnit && selectedEffectType.defaultUnit !== 'none') {
        DOMI.effectUnitDisplay.textContent = `(${selectedEffectType.defaultUnit})`;
    } else {
        DOMI.effectUnitDisplay.textContent = '';
    }
}

function addEffectToItemList() {
    const typeId = DOMI.effectTypeSelect.value;
    const valueStr = DOMI.effectValueInput.value;
    const effectTypesCache = getEffectTypesFuncCache();

    if (!typeId) { alert("効果種類を選択してください。"); return; }
    if (valueStr.trim() === '' || isNaN(parseFloat(valueStr))) {
        alert("効果の値を数値で入力してください。"); return;
    }
    const value = parseFloat(valueStr);
    const selectedEffectType = effectTypesCache.find(et => et.id === typeId);
    const unit = selectedEffectType ? (selectedEffectType.defaultUnit || 'none') : 'none';

    currentItemEffects.push({ type: typeId, value: value, unit: unit });
    renderCurrentItemEffectsListModal();

    DOMI.effectTypeSelect.value = '';
    DOMI.effectValueInput.value = '';
    updateItemFormEffectUnitDisplay(); // Clear unit
}

function renderCurrentItemEffectsListModal() {
    if (!DOMI.currentEffectsList) return;
    DOMI.currentEffectsList.innerHTML = '';
    const effectTypesCache = getEffectTypesFuncCache();

    if (currentItemEffects.length === 0) {
        DOMI.currentEffectsList.innerHTML = '<p>効果が追加されていません。</p>';
        return;
    }
    currentItemEffects.forEach((effect, index) => {
        const effectType = effectTypesCache.find(et => et.id === effect.type);
        const typeName = effectType ? effectType.name : '不明な効果';
        const unitText = effect.unit && effect.unit !== 'none' ? `(${effect.unit})` : '';
        const div = document.createElement('div');
        div.classList.add('effect-list-item');
        div.innerHTML = `
            <span>${typeName}: ${effect.value}${unitText}</span>
            <button type="button" class="delete-effect-from-list action-button delete" data-index="${index}" title="この効果を削除">×</button>
        `;
        DOMI.currentEffectsList.appendChild(div);
    });

    DOMI.currentEffectsList.querySelectorAll('.delete-effect-from-list').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const indexToRemove = parseInt(e.currentTarget.dataset.index, 10);
            currentItemEffects.splice(indexToRemove, 1);
            renderCurrentItemEffectsListModal();
        });
    });
}

async function uploadImageToWorkerAndGetURL(file) {
    if (!file || !IMAGE_UPLOAD_WORKER_URL_CONST) return null;
    if (DOMI.uploadProgressContainer) DOMI.uploadProgressContainer.style.display = 'block';
    if (DOMI.uploadProgress) DOMI.uploadProgress.value = 0;
    if (DOMI.uploadProgressText) DOMI.uploadProgressText.textContent = 'アップロード準備中...';

    const formData = new FormData();
    formData.append('imageFile', file);

    let intervalId;
    try {
        if (DOMI.uploadProgressText) DOMI.uploadProgressText.textContent = 'アップロード中... (0%)';
        let progress = 0;
        intervalId = setInterval(() => {
            progress += 10;
            if (progress <= 90) {
                if (DOMI.uploadProgress) DOMI.uploadProgress.value = progress;
                if (DOMI.uploadProgressText) DOMI.uploadProgressText.textContent = `アップロード中... (${progress}%)`;
            } else {
                clearInterval(intervalId); // Stop at 90% before fetch completes
            }
        }, 100); // Simulate progress

        const response = await fetch(IMAGE_UPLOAD_WORKER_URL_CONST, { method: 'POST', body: formData });
        clearInterval(intervalId);
        if (DOMI.uploadProgress) DOMI.uploadProgress.value = 100;

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'サーバーからの不明なエラーレスポンス' }));
            console.error('[Image Upload] Upload failed with status:', response.status, errorData);
            alert(`画像のアップロードに失敗しました: ${errorData.error || response.statusText}`);
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
            console.error('[Image Upload] Upload response error:', result);
            alert(`画像のアップロードエラー: ${result.message || 'Workerからの予期せぬ応答'}`);
            if (DOMI.uploadProgressText) DOMI.uploadProgressText.textContent = 'アップロードエラー。';
            setTimeout(() => { if (DOMI.uploadProgressContainer) DOMI.uploadProgressContainer.style.display = 'none'; }, 3000);
            return null;
        }
    } catch (error) {
        if(intervalId) clearInterval(intervalId);
        console.error('[Image Upload] Error uploading image to worker:', error);
        alert(`画像のアップロード中に通信エラーが発生しました: ${error.message}`);
        if (DOMI.uploadProgressText) DOMI.uploadProgressText.textContent = '通信エラー。';
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
    const source = DOMI.itemSourceInput.value.trim();
    const priceStr = DOMI.itemPriceInput.value.trim();
    const selectedItemTagIds = getSelectedCheckboxValues(DOMI.itemTagsSelectorCheckboxes, 'itemTag');
    const editingDocId = DOMI.itemIdToEditInput.value;
    let finalImageUrl = DOMI.itemImageUrlInput.value; // Existing or manually entered URL

    let price = null;
    if (priceStr !== "") {
        price = parseInt(priceStr, 10);
        if (isNaN(price) || price < 0) {
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
                finalImageUrl = uploadedUrl;
            } else {
                // Optional: alert user about upload failure but proceed with saving other data
                // alert("画像アップロードに失敗しましたが、他の情報は保存を試みます。");
            }
        }

        const itemData = {
            name: name || "", // Store empty string if name is cleared
            image: finalImageUrl || "",
            structured_effects: currentItemEffects,
            入手手段: source || "",
            tags: selectedItemTagIds,
            updatedAt: serverTimestamp()
        };
        
        if (price !== null) {
            itemData.price = price;
        }

        if (editingDocId) {
            const updatePayload = {...itemData};
             if (price === null && itemData.hasOwnProperty('price')) { // If price field was cleared explicitly
                 updatePayload.price = deleteField();
             } else if (price === null && !itemData.hasOwnProperty('price')) {
                 // If price was not in itemData and field is cleared, ensure it's removed if it existed
                 const originalItemSnap = await getDoc(doc(dbInstance, 'items', editingDocId));
                 if (originalItemSnap.exists() && originalItemSnap.data().hasOwnProperty('price')) {
                     updatePayload.price = deleteField();
                 }
             }
            await updateDoc(doc(dbInstance, 'items', editingDocId), updatePayload);
        } else {
            itemData.createdAt = serverTimestamp();
            const dataToAdd = {...itemData};
            if (price === null) delete dataToAdd.price; // Don't add price field if it's null
            await addDoc(collection(dbInstance, 'items'), dataToAdd);
        }

        clearItemFormInternal(); // Clear form after successful save
        await refreshAllDataCallback(); // Reload items and re-render table

    } catch (error) {
        console.error("[Item Save] Error:", error);
        alert(`アイテム保存エラー: ${error.message}`);
    } finally {
        if (DOMI.saveItemButton) {
            DOMI.saveItemButton.disabled = false;
            DOMI.saveItemButton.textContent = DOMI.itemIdToEditInput.value ? "アイテム更新" : "アイテム保存";
        }
    }
}

function renderItemsAdminTable() {
    if (!DOMI.itemsTableBody) return;
    const itemsCache = getAllItemsFuncCache();
    const allTags = getAllTagsFuncCache();
    const effectTypesCache = getEffectTypesFuncCache();
    DOMI.itemsTableBody.innerHTML = '';

    const searchTerm = DOMI.itemSearchAdminInput ? DOMI.itemSearchAdminInput.value.toLowerCase() : "";
    const filteredItems = itemsCache.filter(item =>
        (item.name && item.name.toLowerCase().includes(searchTerm)) ||
        (!searchTerm && (item.name === "" || !item.name))
    );

    if (filteredItems.length === 0) {
        const tr = DOMI.itemsTableBody.insertRow();
        const td = tr.insertCell();
        td.colSpan = 6;
        td.textContent = searchTerm ? '検索条件に一致するアイテムはありません。' : 'アイテムが登録されていません。';
        td.style.textAlign = 'center';
        return;
    }

    filteredItems.forEach(item => {
        const tr = document.createElement('tr');
        const imageDisplayPath = item.image || './images/placeholder_item.png'; // Default placeholder
        const itemTagsString = (item.tags || [])
            .map(tagId => allTags.find(t => t.id === tagId)?.name)
            .filter(name => name)
            .join(', ') || 'なし';

        let effectsDisplay = '効果なし';
        if (item.structured_effects && item.structured_effects.length > 0) {
            effectsDisplay = item.structured_effects.map(eff => {
                const typeInfo = effectTypesCache.find(et => et.id === eff.type);
                const typeName = typeInfo ? typeInfo.name : `不明(${eff.type.substring(0, 6)}...)`;
                const unit = (eff.unit && eff.unit !== 'none') ? eff.unit : '';
                return `${typeName}: ${eff.value}${unit}`;
            }).join('; ');
            if (effectsDisplay.length > 40) effectsDisplay = effectsDisplay.substring(0, 37) + '...';
        }
        const priceDisplay = (typeof item.price === 'number' && !isNaN(item.price)) ? `${item.price}G` : '未設定';
        const nameDisplay = item.name || '(名称未設定)';

        tr.innerHTML = `
            <td><img src="${imageDisplayPath}" alt="${nameDisplay}" onerror="this.onerror=null; this.src='./images/placeholder_item.png'; this.style.backgroundColor='#eee';"></td>
            <td>${nameDisplay}</td>
            <td>${priceDisplay}</td>
            <td>${effectsDisplay}</td>
            <td>${itemTagsString}</td>
            <td>
                <button class="edit-item action-button" data-item-doc-id="${item.docId}" title="編集">✎</button>
                <button class="delete-item action-button delete" data-item-doc-id="${item.docId}" data-item-name="${nameDisplay}" data-item-image="${item.image || ''}" title="削除">×</button>
            </td>`;
        tr.querySelector('.edit-item').addEventListener('click', () => loadItemForEdit(item.docId));
        tr.querySelector('.delete-item').addEventListener('click', (e) => {
            const button = e.currentTarget;
            deleteItem(button.dataset.itemDocId, button.dataset.itemName, button.dataset.itemImage);
        });
        DOMI.itemsTableBody.appendChild(tr);
    });
}

async function loadItemForEdit(docId) {
    try {
        const itemSnap = await getDoc(doc(dbInstance, "items", docId));
        if (itemSnap.exists()) {
            const itemData = itemSnap.data();
            clearItemFormInternal(); // Start with a clean form

            DOMI.itemIdToEditInput.value = itemSnap.id;
            DOMI.itemNameInput.value = itemData.name || "";
            DOMI.itemSourceInput.value = itemData.入手手段 || "";
            DOMI.itemImageUrlInput.value = itemData.image || '';
            if (DOMI.itemPriceInput) DOMI.itemPriceInput.value = (typeof itemData.price === 'number' && !isNaN(itemData.price)) ? itemData.price : '';


            if (itemData.image && DOMI.itemImagePreview) {
                DOMI.itemImagePreview.src = itemData.image;
                DOMI.itemImagePreview.style.display = 'block';
            }

            populateTagCheckboxesForItemFormInternal(itemData.tags || []);

            currentItemEffects = itemData.structured_effects ? JSON.parse(JSON.stringify(itemData.structured_effects)) : [];
            renderCurrentItemEffectsListModal();
            // effectTypeSelect and value are cleared by clearItemFormInternal, unit display will update on change.

            if (DOMI.saveItemButton) DOMI.saveItemButton.textContent = "アイテム更新";
            if (DOMI.itemForm) DOMI.itemForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
            DOMI.itemNameInput.focus();
        } else {
            alert("編集対象のアイテムが見つかりませんでした。");
        }
    } catch (error) {
        console.error("[Item Edit] Error loading:", error);
        alert("編集データの読み込み中にエラーが発生しました。");
    }
}

async function deleteItem(docId, itemName, imageUrl) {
    if (confirm(`アイテム「${itemName}」を削除しますか？\n注意: Cloudflare R2上の関連画像は、この操作では削除されません。`)) {
        try {
            await deleteDoc(doc(dbInstance, 'items', docId));
            // Note: Image on Cloudflare R2 is not deleted by this Firestore operation.
            // Manual deletion or a separate backend process would be needed if R2 cleanup is required.
            console.warn(`Image ${imageUrl} (associated with deleted item ${docId}) may need manual deletion from Cloudflare R2 if it was uploaded via the worker and is no longer needed.`);

            if (DOMI.itemIdToEditInput.value === docId) { // If the deleted item was being edited
                clearItemFormInternal();
            }
            await refreshAllDataCallback(); // Reload items and re-render table
        } catch (error) {
            console.error(`[Item Delete] Error deleting item ${docId}:`, error);
            alert("アイテムの削除に失敗しました。");
        }
    }
}

export { renderItemsAdminTable as _renderItemsAdminTableInternal, populateTagCheckboxesForItemFormInternal as _populateTagCheckboxesForItemFormInternal };
