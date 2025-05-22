// js/admin-modules/item-manager.js
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp, deleteField, getDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { populateCheckboxGroup, getSelectedCheckboxValues, populateSelect, openModal as openHelperModal, closeModal as closeHelperModal } from './ui-helpers.js'; // closeModal is not directly used here but good practice

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
    effectTypeSelect: null,
    effectValueInput: null,
    effectUnitDisplay: null,
    addEffectToListButton: null,
    currentEffectsList: null,
    itemSourceInput: null,
    itemTagsSelectorCheckboxes: null,
    saveItemButton: null,
    clearFormButton: null,
    deleteItemFromFormButton: null, // ★★★ 追加 ★★★
    itemsTableBody: null,
    itemSearchAdminInput: null,
};

let dbInstance = null;
let getAllItemsFuncCache = () => [];
let getAllTagsFuncCache = () => [];
let getEffectTypesFuncCache = () => [];
let getEffectUnitsFuncCache = () => []; // ★★★ 追加: 単位名表示のため ★★★
let refreshAllDataCallback = async () => {};

let currentItemEffects = [];
let selectedImageFile = null;
let IMAGE_UPLOAD_WORKER_URL_CONST = '';

export function initItemManager(dependencies) {
    dbInstance = dependencies.db;
    getAllItemsFuncCache = dependencies.getItems;
    getAllTagsFuncCache = dependencies.getAllTags;
    getEffectTypesFuncCache = dependencies.getEffectTypes;
    getEffectUnitsFuncCache = dependencies.getEffectUnits; // ★★★ 取得 ★★★
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
    DOMI.effectTypeSelect = document.getElementById('effectTypeSelect');
    DOMI.effectValueInput = document.getElementById('effectValueInput');
    DOMI.effectUnitDisplay = document.getElementById('effectUnitDisplay');
    DOMI.addEffectToListButton = document.getElementById('addEffectToListButton');
    DOMI.currentEffectsList = document.getElementById('currentEffectsList');
    DOMI.itemSourceInput = document.getElementById('itemSource');
    DOMI.itemTagsSelectorCheckboxes = document.getElementById('itemTagsSelectorCheckboxes');
    DOMI.saveItemButton = document.getElementById('saveItemButton');
    DOMI.clearFormButton = document.getElementById('clearFormButton');
    DOMI.deleteItemFromFormButton = document.getElementById('deleteItemFromFormButton'); // ★★★ 取得 ★★★
    DOMI.itemsTableBody = document.querySelector('#itemsTable tbody');
    DOMI.itemSearchAdminInput = document.getElementById('itemSearchAdmin');

    if (DOMI.itemForm) DOMI.itemForm.addEventListener('submit', saveItem);
    if (DOMI.clearFormButton) DOMI.clearFormButton.addEventListener('click', clearItemFormInternal);
    if (DOMI.itemImageFileInput) DOMI.itemImageFileInput.addEventListener('change', handleImageFileSelect);
    if (DOMI.addEffectToListButton) DOMI.addEffectToListButton.addEventListener('click', addEffectToItemList);
    if (DOMI.effectTypeSelect) DOMI.effectTypeSelect.addEventListener('change', updateItemFormEffectUnitDisplay);
    if (DOMI.itemSearchAdminInput) DOMI.itemSearchAdminInput.addEventListener('input', _renderItemsAdminTableInternal);
    
    // ★★★ 新しい削除ボタンのイベントリスナー ★★★
    if (DOMI.deleteItemFromFormButton) {
        DOMI.deleteItemFromFormButton.addEventListener('click', () => {
            const itemId = DOMI.itemIdToEditInput.value;
            const itemName = DOMI.itemNameInput.value || "(名称未設定アイテム)";
            const itemImageUrl = DOMI.itemImageUrlInput.value || null;
            if (itemId) {
                deleteItem(itemId, itemName, itemImageUrl);
            } else {
                alert("削除するアイテムが選択されていません。");
            }
        });
    }

    // ★★★ テーブル行のアイテム名クリックイベントはテーブル生成時に直接付与する ★★★
    // initItemManager での itemsTableBody へのイベントデリゲーションは削除
    console.log("[Item Manager] Initialized.");
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
    if (DOMI.uploadProgressContainer) {
        DOMI.uploadProgressContainer.style.display = 'none';
        if (DOMI.uploadProgress) DOMI.uploadProgress.value = 0;
        if (DOMI.uploadProgressText) DOMI.uploadProgressText.textContent = '';
    }

    currentItemEffects = [];
    renderCurrentItemEffectsListUI();
    if (DOMI.effectTypeSelect) DOMI.effectTypeSelect.value = '';
    if (DOMI.effectValueInput) DOMI.effectValueInput.value = '';
    if (DOMI.effectUnitDisplay) DOMI.effectUnitDisplay.textContent = '';

    _populateTagCheckboxesForItemFormInternal(); 

    if (DOMI.saveItemButton) DOMI.saveItemButton.textContent = "アイテム保存";
    if (DOMI.deleteItemFromFormButton) DOMI.deleteItemFromFormButton.style.display = 'none'; // 新規作成時は非表示
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
    // console.log("[Item Manager] Tag checkboxes in item form populated."); // ログはrefreshAllDataでまとめられるので省略も可
}

function handleImageFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        if (file.size > 5 * 1024 * 1024) {
            alert("ファイルサイズが大きすぎます。5MB以下の画像を選択してください。");
            DOMI.itemImageFileInput.value = null; return;
        }
        if (!file.type.startsWith('image/')) {
            alert("画像ファイルを選択してください (例: JPG, PNG, GIF)。");
            DOMI.itemImageFileInput.value = null; return;
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
        // ファイル選択がクリアされた場合、既存のURLがあればプレビューを維持
        if (DOMI.itemImageUrlInput.value && DOMI.itemImagePreview) {
            DOMI.itemImagePreview.src = DOMI.itemImageUrlInput.value;
            DOMI.itemImagePreview.style.display = 'block';
        } else if (DOMI.itemImagePreview) {
            DOMI.itemImagePreview.style.display = 'none';
            DOMI.itemImagePreview.src = '#';
        }
    }
}

function updateItemFormEffectUnitDisplay() {
    if (!DOMI.effectUnitDisplay || !DOMI.effectTypeSelect) return;
    const selectedOption = DOMI.effectTypeSelect.options[DOMI.effectTypeSelect.selectedIndex];
    const unitName = selectedOption ? (selectedOption.dataset.unitName || '') : '';
    DOMI.effectUnitDisplay.textContent = unitName ? `${unitName}` : ''; // 括弧を削除
}


function addEffectToItemList() {
    const typeId = DOMI.effectTypeSelect.value;
    const valueStr = DOMI.effectValueInput.value;
    if (!typeId) { alert("効果種類を選択してください。"); return; }
    if (valueStr.trim() === '' || isNaN(parseFloat(valueStr))) { alert("効果の値を数値で入力してください。"); return; }

    const value = parseFloat(valueStr);
    const selectedEffectType = getEffectTypesFuncCache().find(et => et.id === typeId);
    const unitName = selectedEffectType ? (selectedEffectType.defaultUnit || '') : ''; // 単位名を取得

    currentItemEffects.push({ type: typeId, value: value, unit: unitName }); // 単位名を保存
    renderCurrentItemEffectsListUI();
    DOMI.effectTypeSelect.value = '';
    DOMI.effectValueInput.value = '';
    updateItemFormEffectUnitDisplay();
}

function renderCurrentItemEffectsListUI() {
    if (!DOMI.currentEffectsList) return;
    DOMI.currentEffectsList.innerHTML = '';
    const effectTypesCache = getEffectTypesFuncCache();

    if (currentItemEffects.length === 0) {
        DOMI.currentEffectsList.innerHTML = '<p>効果が追加されていません。</p>'; return;
    }
    currentItemEffects.forEach((effect, index) => {
        const effectType = effectTypesCache.find(et => et.id === effect.type);
        const typeName = effectType ? effectType.name : '不明な効果';
        const unitText = effect.unit && effect.unit !== '' ? `${effect.unit}` : ''; // 保存された単位名を使用
        const div = document.createElement('div');
        div.classList.add('effect-list-item');
        div.innerHTML = `
            <span>${typeName}: ${effect.value}${unitText}</span>
            <button type="button" class="delete-effect-from-list action-button delete" data-index="${index}" title="この効果を削除">×</button>
        `;
        div.querySelector('.delete-effect-from-list').addEventListener('click', (e) => {
            currentItemEffects.splice(parseInt(e.currentTarget.dataset.index, 10), 1);
            renderCurrentItemEffectsListUI();
        });
        DOMI.currentEffectsList.appendChild(div);
    });
}

async function uploadImageToWorkerAndGetURL(file) {
    // ... (この関数は変更なし)
    if (!file || !IMAGE_UPLOAD_WORKER_URL_CONST) return null;
    if (DOMI.uploadProgressContainer) DOMI.uploadProgressContainer.style.display = 'block';
    if (DOMI.uploadProgress) DOMI.uploadProgress.value = 0;
    if (DOMI.uploadProgressText) DOMI.uploadProgressText.textContent = 'アップロード準備中... (0%)';
    
    const formData = new FormData();
    formData.append('imageFile', file);

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', IMAGE_UPLOAD_WORKER_URL_CONST, true);

        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                const percentComplete = Math.round((event.loaded / event.total) * 100);
                if (DOMI.uploadProgress) DOMI.uploadProgress.value = percentComplete;
                if (DOMI.uploadProgressText) DOMI.uploadProgressText.textContent = `アップロード中... (${percentComplete}%)`;
            }
        };

        xhr.onload = () => {
            if (DOMI.uploadProgressText) DOMI.uploadProgressText.textContent = '処理中...';
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const result = JSON.parse(xhr.responseText);
                    if (result.success && result.imageUrl) {
                        if (DOMI.uploadProgressText) DOMI.uploadProgressText.textContent = 'アップロード完了!';
                        setTimeout(() => { if (DOMI.uploadProgressContainer) DOMI.uploadProgressContainer.style.display = 'none'; }, 2000);
                        resolve(result.imageUrl);
                    } else {
                        console.error('[Image Upload] Worker response error:', result);
                        alert(`画像アップロードエラー(Worker): ${result.message || '予期せぬ応答'}`);
                        if (DOMI.uploadProgressText) DOMI.uploadProgressText.textContent = 'アップロードエラー。';
                        setTimeout(() => { if (DOMI.uploadProgressContainer) DOMI.uploadProgressContainer.style.display = 'none'; }, 3000);
                        resolve(null); 
                    }
                } catch (e) {
                    console.error('[Image Upload] Error parsing worker response:', e, xhr.responseText);
                    alert('画像アップロード応答の解析に失敗しました。');
                    if (DOMI.uploadProgressText) DOMI.uploadProgressText.textContent = '応答解析エラー。';
                    resolve(null);
                }
            } else {
                console.error('[Image Upload] Upload failed with status:', xhr.status, xhr.statusText, xhr.responseText);
                alert(`画像アップロードに失敗しました: ${xhr.statusText || 'サーバーエラー'}`);
                if (DOMI.uploadProgressText) DOMI.uploadProgressText.textContent = `失敗 (${xhr.status})。`;
                setTimeout(() => { if (DOMI.uploadProgressContainer) DOMI.uploadProgressContainer.style.display = 'none'; }, 3000);
                resolve(null); 
            }
        };
        xhr.onerror = () => {
            console.error('[Image Upload] Network error during upload.');
            alert('画像アップロード中に通信エラーが発生しました。');
            if (DOMI.uploadProgressText) DOMI.uploadProgressText.textContent = '通信エラー。';
            setTimeout(() => { if (DOMI.uploadProgressContainer) DOMI.uploadProgressContainer.style.display = 'none'; }, 3000);
            resolve(null); 
        };
        xhr.send(formData);
    });
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
    let finalImageUrl = DOMI.itemImageUrlInput.value || null; // Initialize with null if empty

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
            } else if (editingDocId) { // Upload failed, but we are editing, so retain old image if any
                const oldItemSnap = await getDoc(doc(dbInstance, "items", editingDocId));
                if (oldItemSnap.exists() && oldItemSnap.data().image) {
                    finalImageUrl = oldItemSnap.data().image;
                    alert("新しい画像のアップロードに失敗しました。既存の画像情報を保持します。");
                } else {
                    finalImageUrl = null; // No old image or upload failed for new item
                }
            } else { // New item and upload failed
                finalImageUrl = null;
            }
            selectedImageFile = null; // Clear selected file after attempting upload
            if(DOMI.itemImageFileInput) DOMI.itemImageFileInput.value = null; // Reset file input
        }


        const itemData = {
            name: name,
            image: finalImageUrl,
            structured_effects: currentItemEffects,
            入手手段: source,
            tags: selectedItemTagIds,
            updatedAt: serverTimestamp()
        };

        if (price !== null) itemData.price = price;
        else itemData.price = deleteField();

        if (editingDocId) {
            await updateDoc(doc(dbInstance, 'items', editingDocId), itemData);
        } else {
            itemData.createdAt = serverTimestamp();
            await addDoc(collection(dbInstance, 'items'), itemData);
        }

        clearItemFormInternal();
        await refreshAllDataCallback();

    } catch (error) {
        console.error("[Item Manager] Error saving item:", error);
        alert(`アイテム保存エラー: ${error.message}`);
    } finally {
        if (DOMI.saveItemButton) {
            DOMI.saveItemButton.disabled = false;
            DOMI.saveItemButton.textContent = DOMI.itemIdToEditInput.value ? "アイテム更新" : "アイテム保存";
        }
    }
}

export function _renderItemsAdminTableInternal() {
    if (!DOMI.itemsTableBody) return;
    const itemsCache = getAllItemsFuncCache();
    const allTags = getAllTagsFuncCache();
    const effectTypesCache = getEffectTypesFuncCache();
    // const effectUnitsCache = getEffectUnitsFuncCache(); // 単位名表示に必要

    DOMI.itemsTableBody.innerHTML = '';

    const searchTerm = DOMI.itemSearchAdminInput ? DOMI.itemSearchAdminInput.value.toLowerCase() : "";
    const filteredItems = itemsCache.filter(item =>
        (item.name && item.name.toLowerCase().includes(searchTerm)) ||
        (!searchTerm && (item.name === "" || !item.name))
    ).sort((a,b) => (a.name || "").localeCompare(b.name || "", 'ja'));

    if (filteredItems.length === 0) {
        const tr = DOMI.itemsTableBody.insertRow();
        const td = tr.insertCell();
        td.colSpan = 6; // ★★★ 列数に合わせて調整 (操作列がなくなるので5になる) ★★★
        td.textContent = searchTerm ? '検索条件に一致するアイテムはありません。' : 'アイテムが登録されていません。';
        td.style.textAlign = 'center';
        return;
    }

    filteredItems.forEach(item => {
        const tr = document.createElement('tr');
        const imageDisplayPath = item.image || './images/placeholder_item.png';
        const itemTagsString = (item.tags || [])
            .map(tagId => allTags.find(t => t.id === tagId)?.name)
            .filter(name => name)
            .sort((a,b) => a.localeCompare(b, 'ja'))
            .join(', ') || 'なし';

        let effectsDisplay = '効果なし';
        if (item.structured_effects && item.structured_effects.length > 0) {
            effectsDisplay = item.structured_effects.map(eff => {
                const typeInfo = effectTypesCache.find(et => et.id === eff.type);
                const typeName = typeInfo ? typeInfo.name : `不明`;
                const unitName = typeInfo && typeInfo.defaultUnit ? typeInfo.defaultUnit : ''; // 単位名
                return `${typeName}: ${eff.value}${unitName ? unitName : ''}`;
            }).join('; ');
            if (effectsDisplay.length > 50) effectsDisplay = effectsDisplay.substring(0, 47) + '...';
        }
        const priceDisplay = (typeof item.price === 'number' && !isNaN(item.price)) ? `${item.price}G` : '未設定';
        const nameDisplay = item.name || '(名称未設定)';

        // ★★★ 操作列を削除し、アイテム名をクリック可能にする ★★★
        tr.innerHTML = `
            <td><img src="${imageDisplayPath}" alt="${nameDisplay}" onerror="this.onerror=null; this.src='./images/no_image_placeholder.png'; this.style.backgroundColor='#eee';"></td>
            <td class="list-item-name-clickable" data-item-doc-id="${item.docId}" data-action="edit-item">${nameDisplay}</td>
            <td>${priceDisplay}</td>
            <td>${effectsDisplay}</td>
            <td>${itemTagsString}</td>
            <td></td> <!-- 空の操作列、または完全に削除 -->
            `;
        // アイテム名クリックで編集フォームにロード
        const nameCell = tr.querySelector('td.list-item-name-clickable');
        if (nameCell) {
            nameCell.addEventListener('click', () => loadItemForEdit(item.docId));
        }
        DOMI.itemsTableBody.appendChild(tr);
    });
    // ★★★ itemsTable の thead から「操作」ヘッダーを削除する必要がある (HTML側またはJSで) ★★★
    // ここではJSで列数を調整したため、HTML側のtheadの列数も合わせる必要があります。
    // または、JSで動的にtheadを書き換えるか、最後の<td>を完全に削除します。
    // 例: thead の <tr><th>画像</th><th>名前</th><th>売値</th><th>効果</th><th>タグ</th><!-- <th>操作</th> --></tr>

    console.log("[Item Manager] Items table rendered.");
}


async function loadItemForEdit(docId) {
    try {
        const itemSnap = await getDoc(doc(dbInstance, "items", docId));
        if (itemSnap.exists()) {
            const itemData = itemSnap.data();
            clearItemFormInternal(); // Clear form before populating

            DOMI.itemIdToEditInput.value = itemSnap.id;
            DOMI.itemNameInput.value = itemData.name || "";
            DOMI.itemSourceInput.value = itemData.入手手段 || "";
            DOMI.itemImageUrlInput.value = itemData.image || '';
            if (DOMI.itemPriceInput) DOMI.itemPriceInput.value = (typeof itemData.price === 'number' && !isNaN(itemData.price)) ? String(itemData.price) : '';

            if (itemData.image && DOMI.itemImagePreview) {
                DOMI.itemImagePreview.src = itemData.image;
                DOMI.itemImagePreview.style.display = 'block';
            }

            _populateTagCheckboxesForItemFormInternal(itemData.tags || []);

            currentItemEffects = itemData.structured_effects ? JSON.parse(JSON.stringify(itemData.structured_effects)) : [];
            renderCurrentItemEffectsListUI();

            if (DOMI.saveItemButton) DOMI.saveItemButton.textContent = "アイテム更新";
            if (DOMI.deleteItemFromFormButton) DOMI.deleteItemFromFormButton.style.display = 'inline-block'; // 編集時は表示

            const itemFormSection = document.getElementById('item-management');
            if (itemFormSection) itemFormSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            DOMI.itemNameInput.focus();
        } else { alert("編集対象のアイテムが見つかりませんでした。"); }
    } catch (error) { console.error("[Item Manager] Error loading item for edit:", error); alert("編集データの読み込み中にエラーが発生しました。"); }
}

async function deleteItem(docId, itemName, imageUrl) {
    if (confirm(`アイテム「${itemName}」を削除しますか？\nこの操作は元に戻せません。\n(Cloudflare R2上の画像は自動削除されません)`)) {
        try {
            await deleteDoc(doc(dbInstance, 'items', docId));
            if (imageUrl) {
                console.warn(`Image ${imageUrl} (associated with deleted item ${docId}) may need manual deletion from Cloudflare R2 or other storage if not using Firebase Storage directly managed by this app.`);
            }
            // フォームをクリアし、削除ボタンを非表示にする
            if (DOMI.itemIdToEditInput.value === docId) { // 削除したアイテムが現在フォームに表示されている場合
                clearItemFormInternal(); // これで削除ボタンも非表示になるはず
            }
            await refreshAllDataCallback();
        } catch (error) {
            console.error(`[Item Manager] Error deleting item ${docId}:`, error);
            alert("アイテムの削除に失敗しました。");
        }
    }
}
