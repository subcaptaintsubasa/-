// js/admin-modules/item-manager.js
import { collection, getDocs, addDoc, doc, updateDoc, query, serverTimestamp, deleteField, getDoc, where } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

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
    structuredEffectsArea: null, // Not directly used, but good to keep for context
    structuredEffectsInputArea: null,
    manualEffectsArea: null, // Not directly used
    manualEffectsInputArea: null,
    manualEffectsStringTextarea: null,
    addManualEffectToListButton: null,
    effectTypeSelect: null,
    effectValueInput: null,
    effectUnitDisplay: null,
    addEffectToListButton: null,
    currentEffectsList: null,

    toggleSourceInputModeButton: null,
    treeSourceArea: null, // Not directly used
    treeSourceInputArea: null,
    manualSourceArea: null, // Not directly used
    manualSourceInputArea: null,
    manualSourceStringTextarea: null,
    addManualSourceToListButton: null,
    itemSourceButtonSelectionArea: null,
    selectedItemSourcePathDisplay: null,
    selectedItemSourceNodeId_temp: null,
    finalSourceDisplayPreviewInput: null,
    addTreeSourceToListButton: null,
    currentSourcesList: null,

    itemTagsButtonContainer: null,
    deleteItemFromFormButton: null,
    saveItemButton: null,
    clearFormButton: null,
    itemsTableBody: null,
    itemSearchAdminInput: null,
    enlargedImagePreviewModal: null,
    enlargedImagePreview: null,
        adminCategoryFilterContainer: null,
    adminTagFilterContainer: null,
    resetAdminFiltersButton: null,
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
// フィルターの状態を管理するオブジェクト
const adminFilterState = {
    searchTerm: "",
    categoryIds: [],
    tagIds: [],
};
let adminCurrentPage = 1;
const ADMIN_ITEMS_PER_PAGE = 50; // 1ページあたりの表示件数

const MAX_RARITY = 5;

export function initItemManager(dependencies) {
    dbInstance = dependencies.db;
    getAllItemsFuncCache = dependencies.getItems; // Assumes this returns non-deleted items
    getAllTagsFuncCache = dependencies.getAllTags; // Assumes non-deleted
    getAllCategoriesFuncCache = dependencies.getAllCategories; // Assumes non-deleted
    getEffectTypesFuncCache = dependencies.getEffectTypes; // Assumes non-deleted
    getEffectUnitsFuncCache = dependencies.getEffectUnits; // Assumes non-deleted
    getItemSourcesFuncCache = dependencies.getItemSources; // Assumes non-deleted
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
    DOMI.finalSourceDisplayPreviewInput = document.getElementById('finalSourceDisplayPreview');
    DOMI.addTreeSourceToListButton = document.getElementById('addTreeSourceToListButton');
    DOMI.currentSourcesList = document.getElementById('currentSourcesList');

    DOMI.itemTagsButtonContainer = document.getElementById('itemTagsButtonContainer');
    DOMI.deleteItemFromFormButton = document.getElementById('deleteItemFromFormButton');
    DOMI.saveItemButton = document.getElementById('saveItemButton');
    DOMI.clearFormButton = document.getElementById('clearFormButton');
    DOMI.itemsTableBody = document.querySelector('#itemsTable tbody');
    DOMI.itemSearchAdminInput = document.getElementById('itemSearchAdmin');
        DOMI.adminCategoryFilterContainer = document.getElementById('adminCategoryFilterContainer');
    DOMI.adminTagFilterContainer = document.getElementById('adminTagFilterContainer');
    DOMI.resetAdminFiltersButton = document.getElementById('resetAdminFiltersButton');

    DOMI.enlargedImagePreviewModal = document.getElementById('imagePreviewModal');
    DOMI.enlargedImagePreview = document.getElementById('enlargedImagePreview');


    if (DOMI.itemForm) DOMI.itemForm.addEventListener('submit', saveItem);
    if (DOMI.clearFormButton) DOMI.clearFormButton.addEventListener('click', clearItemFormInternal);
    if (DOMI.itemImageFileInput) DOMI.itemImageFileInput.addEventListener('change', handleImageFileSelect);

    if (DOMI.itemImagePreview) {
        DOMI.itemImagePreview.addEventListener('click', () => {
            if (DOMI.itemImagePreview.src && DOMI.itemImagePreview.style.display !== 'none') {
                if (DOMI.enlargedImagePreview) {
                    DOMI.enlargedImagePreview.src = DOMI.itemImagePreview.src;
                }
                if (DOMI.enlargedImagePreviewModal) {
                    DOMI.enlargedImagePreviewModal.classList.add('active-modal');
                }
            }
        });
    }

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

    if (DOMI.itemSearchAdminInput) {
        DOMI.itemSearchAdminInput.addEventListener('input', (e) => {
            adminFilterState.searchTerm = e.target.value.toLowerCase().trim();
            adminCurrentPage = 1;
            _renderItemsAdminTableInternal();
        });
    }

    if (DOMI.adminCategoryFilterContainer) {
        DOMI.adminCategoryFilterContainer.addEventListener('change', () => {
            adminFilterState.categoryIds = Array.from(DOMI.adminCategoryFilterContainer.querySelectorAll('input:checked')).map(cb => cb.value);
            adminCurrentPage = 1;
            renderAdminTagFilter(); // 選択可能なタグを更新
            _renderItemsAdminTableInternal();
        });
    }

    if (DOMI.adminTagFilterContainer) {
        DOMI.adminTagFilterContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('tag-filter')) {
                e.target.classList.toggle('active');
                adminFilterState.tagIds = Array.from(DOMI.adminTagFilterContainer.querySelectorAll('.tag-filter.active')).map(btn => btn.dataset.tagId);
                adminCurrentPage = 1;
                _renderItemsAdminTableInternal();
            }
        });
    }

    if (DOMI.resetAdminFiltersButton) {
        DOMI.resetAdminFiltersButton.addEventListener('click', () => {
            adminFilterState.searchTerm = "";
            adminFilterState.categoryIds = [];
            adminFilterState.tagIds = [];
            if (DOMI.itemSearchAdminInput) DOMI.itemSearchAdminInput.value = "";
            adminCurrentPage = 1;
            renderAdminCategoryFilter();
            renderAdminTagFilter();
            _renderItemsAdminTableInternal();
        });
    }    if (DOMI.deleteItemFromFormButton) {
        DOMI.deleteItemFromFormButton.addEventListener('click', () => {
            const itemId = DOMI.itemIdToEditInput.value;
            const itemName = DOMI.itemNameInput.value || '(名称未設定)';
            if (itemId) {
                logicalDeleteItem(itemId, itemName);
            } else {
                alert("削除対象のアイテムが選択されていません。");
            }
        });
    }

    initializeRaritySelector();
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
            DOMI.finalSourceDisplayPreviewInput
        );
    }
    console.log("[Item Manager] Initialized for logical delete.");
}

function setEffectsInputMode(mode) {
    currentEffectsInputMode = mode;
    if (mode === 'manual') {
        if (DOMI.structuredEffectsInputArea) DOMI.structuredEffectsInputArea.style.display = 'none';
        if (DOMI.manualEffectsInputArea) DOMI.manualEffectsInputArea.style.display = 'block';
        if (DOMI.toggleEffectsInputModeButton) DOMI.toggleEffectsInputModeButton.textContent = '構造化入力に戻す';
        if(DOMI.manualEffectsStringTextarea) DOMI.manualEffectsStringTextarea.focus();
    } else { // structured
        if (DOMI.structuredEffectsInputArea) DOMI.structuredEffectsInputArea.style.display = 'block';
        if (DOMI.manualEffectsInputArea) DOMI.manualEffectsInputArea.style.display = 'none';
        if (DOMI.toggleEffectsInputModeButton) DOMI.toggleEffectsInputModeButton.textContent = '入力欄に切り替え';
        if(DOMI.effectTypeSelect) DOMI.effectTypeSelect.focus();
    }
    switchToAddEffectMode(); // Reset input fields for the current mode
}

function setSourceInputMode(mode) {
    currentSourceInputMode = mode;
    if (mode === 'manual') {
        if (DOMI.treeSourceInputArea) DOMI.treeSourceInputArea.style.display = 'none';
        if (DOMI.manualSourceInputArea) DOMI.manualSourceInputArea.style.display = 'block';
        if (DOMI.toggleSourceInputModeButton) DOMI.toggleSourceInputModeButton.textContent = '選択式に切り替え';
        if(DOMI.manualSourceStringTextarea) DOMI.manualSourceStringTextarea.focus();
    } else { // tree
        if (DOMI.treeSourceInputArea) DOMI.treeSourceInputArea.style.display = 'block';
        if (DOMI.manualSourceInputArea) DOMI.manualSourceInputArea.style.display = 'none';
        if (DOMI.toggleSourceInputModeButton) DOMI.toggleSourceInputModeButton.textContent = '入力欄に切り替え';
        // Re-populate tree source buttons if switching to tree mode
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
                DOMI.finalSourceDisplayPreviewInput
            );
        }
    }
    switchToAddSourceMode(); // Reset input fields for the current mode
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
    setRarityUI(0); // Default to 0 stars
}

function handleRarityStarClick(value) {
    const currentValue = parseInt(DOMI.itemRarityValueInput.value, 10);
    if (currentValue === value) { // Clicked on the same star count, means deselect all
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
    updateItemFormEffectUnitDisplay(); // Clear unit display
}

function switchToAddSourceMode() {
    itemSourceEditMode = false;
    itemSourceEditingIndex = -1;
    if (DOMI.addTreeSourceToListButton) DOMI.addTreeSourceToListButton.textContent = '選択した経路をリストに追加';
    if (DOMI.addManualSourceToListButton) DOMI.addManualSourceToListButton.textContent = '手動入力をリストに追加';
    
    if (DOMI.selectedItemSourcePathDisplay) DOMI.selectedItemSourcePathDisplay.value = '未選択';
    if (DOMI.selectedItemSourceNodeId_temp) DOMI.selectedItemSourceNodeId_temp.value = '';
    if (DOMI.finalSourceDisplayPreviewInput) DOMI.finalSourceDisplayPreviewInput.value = '';
    if (DOMI.manualSourceStringTextarea) DOMI.manualSourceStringTextarea.value = '';

    // If current mode is tree, reset the tree selection UI
    if (currentSourceInputMode === 'tree') {
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
                DOMI.finalSourceDisplayPreviewInput
            );
        }
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
    if (DOMI.itemImageFileInput) DOMI.itemImageFileInput.value = null; // Clear file input

    if (DOMI.uploadProgressContainer) {
        DOMI.uploadProgressContainer.style.display = 'none';
        if (DOMI.uploadProgress) DOMI.uploadProgress.value = 0;
        if (DOMI.uploadProgressText) DOMI.uploadProgressText.textContent = '';
    }

    setRarityUI(0);

    currentItemEffects = [];
    setEffectsInputMode('structured'); // Default to structured
    renderCurrentItemEffectsListUI();

    currentItemSources = [];
    setSourceInputMode('tree'); // Default to tree
    renderCurrentItemSourcesListUI();
    if (DOMI.finalSourceDisplayPreviewInput) DOMI.finalSourceDisplayPreviewInput.value = ''; // Clear preview


    _populateTagButtonsForItemFormInternal(); // This will render non-deleted tags

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
    const allTags = getAllTagsFuncCache(); // Assumes non-deleted
    const allCategories = getAllCategoriesFuncCache(); // Assumes non-deleted

    const tagsByCategory = {};
    const unclassifiedTags = [];

    allTags.forEach(tag => {
        // No need to check tag.isDeleted here as getAllTagsFuncCache should handle it
        let classified = false;
        if (tag.categoryIds && tag.categoryIds.length > 0) {
            tag.categoryIds.forEach(catId => {
                const category = allCategories.find(c => c.id === catId && c.parentId); // Ensure category is a child and not deleted
                if (category) {
                    const parentCategory = allCategories.find(p => p.id === category.parentId); // Ensure parent is not deleted
                    const categoryGroupName = parentCategory ? `${parentCategory.name} > ${category.name}` : category.name;
                    if (!tagsByCategory[categoryGroupName]) {
                        tagsByCategory[categoryGroupName] = [];
                    }
                    if(!tagsByCategory[categoryGroupName].find(t => t.id === tag.id)) { // Avoid duplicates if tag belongs to multiple cats under same group name
                        tagsByCategory[categoryGroupName].push(tag);
                    }
                    classified = true;
                }
            });
        }
        if (!classified) {
            if(!unclassifiedTags.find(t => t.id === tag.id)) { // Avoid duplicates
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
            const button = document.createElement('div'); // Changed from button to div for styling flexibility
            button.className = 'tag-filter admin-tag-select';
            button.textContent = tag.name;
            button.dataset.tagId = tag.id;
            if (selectedTagIds.includes(tag.id)) {
                button.classList.add('active');
            }
            button.setAttribute('role', 'button'); // For accessibility
            button.setAttribute('tabindex', '0');   // For keyboard navigation
            button.addEventListener('click', () => {
                button.classList.toggle('active');
            });
            button.addEventListener('keydown', (e) => { // Allow selection with Space/Enter
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


function processImageFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const maxDim = Math.max(img.width, img.height);
                const canvas = document.createElement('canvas');
                canvas.width = maxDim;
                canvas.height = maxDim;
                
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = 'white'; // Ensure background is white for non-transparent parts
                ctx.fillRect(0, 0, maxDim, maxDim);

                const dx = (maxDim - img.width) / 2;
                const dy = (maxDim - img.height) / 2;
                ctx.drawImage(img, dx, dy, img.width, img.height);
                
                canvas.toBlob((blob) => {
                    if (blob) {
                        const filename = file.name.replace(/\.[^/.]+$/, "") + ".png";
                        const processedFile = new File([blob], filename, { type: 'image/png' });
                        resolve(processedFile);
                    } else {
                        reject(new Error('Canvas to Blob conversion failed.'));
                    }
                }, 'image/png', 0.95); // PNG format
            };
            img.onerror = (err) => reject(new Error('Image could not be loaded.'));
            img.src = e.target.result;
        };
        reader.onerror = (err) => reject(new Error('File could not be read.'));
        reader.readAsDataURL(file);
    });
}


function handleImageFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            alert("ファイルサイズが大きすぎます。5MB以下の画像を選択してください。");
            event.target.value = null; // Reset file input
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

        processImageFile(file).then(processedFile => {
            selectedImageFile = processedFile; // Store the processed file
            
            const previewReader = new FileReader();
            previewReader.onload = (e) => {
                if (DOMI.itemImagePreview) {
                    DOMI.itemImagePreview.src = e.target.result;
                    DOMI.itemImagePreview.style.display = 'block';
                }
            };
            previewReader.readAsDataURL(processedFile); // Preview the processed file

            DOMI.itemImageUrlInput.value = ''; // Clear URL input if a file is selected
            if (DOMI.uploadProgressContainer) DOMI.uploadProgressContainer.style.display = 'none';

        }).catch(error => {
            console.error("Image processing error:", error);
            alert("画像の加工に失敗しました。詳細はコンソールで確認してください。");
            event.target.value = null;
            selectedImageFile = null;
        });

    } else {
        selectedImageFile = null; // No file selected
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
    const effectTypesCache = getEffectTypesFuncCache(); // Assumes non-deleted
    const effectUnitsCache = getEffectUnitsFuncCache(); // Assumes non-deleted

    if (currentItemEffects.length === 0) {
        DOMI.currentEffectsList.innerHTML = '<p>効果が追加されていません。</p>'; return;
    }
    currentItemEffects.forEach((effect, index) => {
        let displayText = "";
        if (effect.type === "manual") {
            displayText = `手動: ${effect.manualString}`;
        } else if (effect.type === "structured") {
            const effectType = effectTypesCache.find(et => et.id === effect.effectTypeId); // Already filtered
            const typeName = effectType ? effectType.name : '不明な効果';
            let effectText;
            const unitName = effect.unit;
            if (unitName && unitName !== 'none') {
                const unitData = effectUnitsCache.find(u => u.name === unitName); // Already filtered
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
                    if(DOMI.addEffectToListButton) DOMI.addEffectToListButton.textContent = '効果をリストに追加'; // Reset other button
                } else { // structured
                    setEffectsInputMode('structured');
                    if(DOMI.effectTypeSelect) DOMI.effectTypeSelect.value = effectToEdit.effectTypeId;
                    if(DOMI.effectValueInput) DOMI.effectValueInput.value = effectToEdit.value;
                    updateItemFormEffectUnitDisplay();
                    if(DOMI.addEffectToListButton) DOMI.addEffectToListButton.textContent = '構造化効果を更新';
                    if(DOMI.addManualEffectToListButton) DOMI.addManualEffectToListButton.textContent = '手動入力をリストに追加'; // Reset other button
                }
                // Focus appropriate field
                if (currentEffectsInputMode === 'manual' && DOMI.manualEffectsStringTextarea) DOMI.manualEffectsStringTextarea.focus();
                else if (currentEffectsInputMode === 'structured' && DOMI.effectTypeSelect) DOMI.effectTypeSelect.focus();
            }
        });
        div.querySelector('.delete-effect-from-list').addEventListener('click', (e) => {
            const deleteIndex = parseInt(e.currentTarget.dataset.index, 10);
            currentItemEffects.splice(deleteIndex, 1);
            renderCurrentItemEffectsListUI();
            // If the deleted item was being edited, reset to add mode
            if (itemEffectEditMode && itemEffectEditingIndex === deleteIndex) {
                switchToAddEffectMode(); // This will also handle button text reset
            }
        });
        DOMI.currentEffectsList.appendChild(div);
    });
}

function handleAddTreeSource() {
    const nodeId = DOMI.selectedItemSourceNodeId_temp.value;
    const displayPath = DOMI.selectedItemSourcePathDisplay.value; // This is the button-based path
    const finalDisplayFromPreview = DOMI.finalSourceDisplayPreviewInput ? DOMI.finalSourceDisplayPreviewInput.value : ""; // This is the final user-facing string

    // Use finalDisplayFromPreview if available and not empty, otherwise fallback to displayPath
    const resolvedDisplayString = (finalDisplayFromPreview && finalDisplayFromPreview.trim() !== "") ? finalDisplayFromPreview : displayPath;

    if (!nodeId) { alert("入手経路を選択してください（リストに追加するには、いずれかの経路ボタンが選択されている状態である必要があります）。"); return; }
    if (!resolvedDisplayString || resolvedDisplayString === "未選択") { alert("有効な表示経路が選択されていません。"); return; }


    const newSource = { type: "tree", nodeId: nodeId, resolvedDisplay: resolvedDisplayString };

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
            // Use resolvedDisplay if available, otherwise indicate it's just an ID
            displayText = source.resolvedDisplay || `経路ID: ${source.nodeId ? source.nodeId.substring(0,8) : '不明'}... (表示名なし)`;
        } else {
            displayText = "不明な入手手段タイプ";
        }

        const div = document.createElement('div');
        div.classList.add('effect-list-item'); // Re-use effect-list-item style for consistency
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
                    if(DOMI.addTreeSourceToListButton) DOMI.addTreeSourceToListButton.textContent = '選択した経路をリストに追加'; // Reset other
                } else { // tree
                    setSourceInputMode('tree');
                    if(DOMI.selectedItemSourceNodeId_temp) DOMI.selectedItemSourceNodeId_temp.value = sourceToEdit.nodeId;
                    
                    // For editing a tree source, repopulate the tree UI to select the existing node
                    if (window.adminModules && window.adminModules.itemSourceManager &&
                        typeof window.adminModules.itemSourceManager.populateItemSourceLevelButtons === 'function') {
                        window.adminModules.itemSourceManager.populateItemSourceLevelButtons(
                            null, // parentId (start from root)
                            1,    // level
                            DOMI.itemSourceButtonSelectionArea,
                            DOMI.selectedItemSourcePathDisplay,
                            DOMI.selectedItemSourceNodeId_temp,
                            [],   // currentSelectedPath (will be rebuilt)
                            sourceToEdit.nodeId, // initialSelectedNodeId
                            DOMI.finalSourceDisplayPreviewInput
                        );
                    }
                    if(DOMI.addTreeSourceToListButton) DOMI.addTreeSourceToListButton.textContent = '選択経路を更新';
                    if(DOMI.addManualSourceToListButton) DOMI.addManualSourceToListButton.textContent = '手動入力をリストに追加'; // Reset other
                }
                // Focus appropriate field
                if (currentSourceInputMode === 'manual' && DOMI.manualSourceStringTextarea) DOMI.manualSourceStringTextarea.focus();
                // For tree mode, focus might not be on a single input.
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
    let intervalId; // For simulating progress
    try {
        if (DOMI.uploadProgressText) DOMI.uploadProgressText.textContent = 'アップロード中... (0%)';
        let progress = 0;
        if (DOMI.uploadProgress) {
            // Simulate progress for better UX as fetch doesn't directly provide it for simple POSTs
            intervalId = setInterval(() => {
                progress += 10;
                if (progress <= 90) { // Don't go to 100% until response
                    if (DOMI.uploadProgress) DOMI.uploadProgress.value = progress;
                    if (DOMI.uploadProgressText) DOMI.uploadProgressText.textContent = `アップロード中... (${progress}%)`;
                } else {
                    clearInterval(intervalId); // Stop at 90%
                }
            }, 150);
        }

        const response = await fetch(IMAGE_UPLOAD_WORKER_URL_CONST, {
            method: 'POST',
            body: formData,
        });

        if (intervalId) clearInterval(intervalId); // Clear simulation interval
        if (DOMI.uploadProgress) DOMI.uploadProgress.value = 100; // Set to 100% on response

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Image Upload] Upload failed:', response.status, errorText);
            let errorMessage = `画像のアップロードに失敗 (HTTP ${response.status})`;
            try {
                const errorData = JSON.parse(errorText);
                if (errorData && errorData.message) errorMessage = `画像エラー: ${errorData.message}`;
                else if (errorData && errorData.error) errorMessage = `画像エラー: ${errorData.error}`;
            } catch (e) {
                if(errorText) errorMessage += `: ${errorText.substring(0,100)}`;
            }
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
        console.error("Error during image upload fetch:", error);
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
        if (!isNaN(parsedPrice) && parsedPrice >= 0) {
            priceToSave = parsedPrice;
        } else {
            alert("売値は0以上の数値を入力してください。");
            if (DOMI.saveItemButton) { DOMI.saveItemButton.disabled = false; DOMI.saveItemButton.textContent = editingDocId ? "アイテム更新" : "アイテム保存"; }
            return;
        }
    }

    try {
        if (selectedImageFile) {
            const uploadedUrl = await uploadImageToWorkerAndGetURL(selectedImageFile);
            if (uploadedUrl) {
                imageUrlToSave = uploadedUrl;
            } else if (editingDocId) {
                try {
                    const oldItemSnap = await getDoc(doc(dbInstance, "items", editingDocId));
                    imageUrlToSave = (oldItemSnap.exists() && oldItemSnap.data().image) ? oldItemSnap.data().image : "";
                    alert("画像アップロードに失敗しました。既存の画像情報を保持します（もしあれば）。");
                } catch (e) {
                    console.error("Error fetching old item data for image fallback:", e);
                    imageUrlToSave = "";
                    alert("画像アップロードに失敗し、既存の画像情報の取得もできませんでした。");
                }
            } else {
                 imageUrlToSave = "";
                 alert("画像アップロードに失敗したため、画像なしでアイテムが保存されます。");
            }
        }

        const itemDataForFirestore = {
            name: name,
            image: imageUrlToSave,
            rarity: rarity,
            tags: selectedItemTagIds,
            effects: currentItemEffects,
            sources: currentItemSources,
            isDeleted: false,
            updatedAt: serverTimestamp(),
        };

        const dataForCache = { ...itemDataForFirestore };
        dataForCache.updatedAt = new Date(); // キャッシュ用は即時反映できるDateオブジェクト

        if (priceToSave !== null) {
            itemDataForFirestore.price = priceToSave;
            dataForCache.price = priceToSave;
        } else {
            if (editingDocId) {
                itemDataForFirestore.price = deleteField();
            }
            delete dataForCache.price;
        }

        if (editingDocId) {
            // 更新
            await updateDoc(doc(dbInstance, 'items', editingDocId), itemDataForFirestore);
            console.log("Item updated in Firestore:", editingDocId);

        } else {
            // 新規追加
            itemDataForFirestore.createdAt = serverTimestamp();
            const docRef = await addDoc(collection(dbInstance, 'items'), itemDataForFirestore);
            console.log("Item added in Firestore:", docRef.id);
        }

        clearItemFormInternal();

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


// main/js/admin-modules/item-manager.js に貼り付け

export function _renderItemsAdminTableInternal() {
    // 1. DOM要素の存在チェック
    if (!DOMI.itemsTableBody) {
        console.warn("_renderItemsAdminTableInternal called before DOMI.itemsTableBody is ready.");
        return;
    }
    
    // 2. 必要なキャッシュデータを取得
    const itemsCache = getAllItemsFuncCache();
    const allTags = getAllTagsFuncCache();
    const effectTypesCache = getEffectTypesFuncCache();
    const effectUnitsCache = getEffectUnitsFuncCache();
    const itemSourcesCacheData = getItemSourcesFuncCache();

    DOMI.itemsTableBody.innerHTML = '';

    // 3. フィルター状態に基づいてデータをフィルタリング
    const searchTerm = adminFilterState.searchTerm;
    let filteredItems = [...itemsCache];

    // 名前フィルター
    if (searchTerm) {
        filteredItems = filteredItems.filter(item =>
            item.name && item.name.toLowerCase().includes(searchTerm)
        );
    }

    // カテゴリフィルター
    if (adminFilterState.categoryIds.length > 0) {
        const selectedCategorySet = new Set(adminFilterState.categoryIds);
        
        // アイテムが持つタグIDをキー、そのタグが属する子カテゴリIDのSetを値とするMapを作成（事前計算）
        const tagToChildCategoriesMap = new Map();
        allTags.forEach(tag => {
            if (tag.categoryIds) {
                tagToChildCategoriesMap.set(tag.id, new Set(tag.categoryIds));
            }
        });

        filteredItems = filteredItems.filter(item => {
            if (!item.tags || item.tags.length === 0) return false;
            
            // アイテムが持ついずれかのタグが、選択されたカテゴリのいずれかに属しているかチェック
            return item.tags.some(tagId => {
                const childCategoryIds = tagToChildCategoriesMap.get(tagId);
                if (!childCategoryIds) return false;
                // Setのhasを使った高速なチェック
                return [...childCategoryIds].some(catId => selectedCategorySet.has(catId));
            });
        });
    }

    // タグフィルター (AND検索)
    if (adminFilterState.tagIds.length > 0) {
        filteredItems = filteredItems.filter(item => {
            if (!item.tags || item.tags.length === 0) return false;
            const itemTagSet = new Set(item.tags);
            return adminFilterState.tagIds.every(tagId => itemTagSet.has(tagId));
        });
    }

    // ソート
    filteredItems.sort((a,b) => (a.name || "").localeCompare(b.name || "", 'ja'));
    
    // 4. ページネーション処理
    const totalFilteredCount = filteredItems.length;
    const startIndex = (adminCurrentPage - 1) * ADMIN_ITEMS_PER_PAGE;
    const endIndex = startIndex + ADMIN_ITEMS_PER_PAGE;
    const itemsToRender = filteredItems.slice(startIndex, endIndex);

    // 5. ページネーションコントロールの描画
    renderAdminPaginationControls(totalFilteredCount, adminCurrentPage, ADMIN_ITEMS_PER_PAGE);

    // 6. テーブルの描画
    if (itemsToRender.length === 0) {
        const tr = DOMI.itemsTableBody.insertRow();
        const td = tr.insertCell();
        td.colSpan = 7;
        td.textContent = totalFilteredCount > 0 ? 'このページに表示するアイテムはありません。' : (searchTerm || adminFilterState.categoryIds.length > 0 || adminFilterState.tagIds.length > 0 ? 'フィルター条件に一致するアイテムはありません。' : 'アイテムが登録されていません。');
        td.style.textAlign = 'center';
        return;
    }

    itemsToRender.forEach(item => {
        const tr = document.createElement('tr');
        tr.classList.add('table-row-clickable');
        tr.dataset.itemDocId = item.docId;

        const imageDisplayPath = item.image || './images/placeholder_item.png';
        const nameDisplay = item.name || '(名称未設定)';
        const priceDisplay = (typeof item.price === 'number' && !isNaN(item.price)) ? `${item.price}G` : '未設定';
        const rarityDisplay = `星${item.rarity || 0}`;

        // Effects display
        let effectsDisplayHtml = '<ul class="effect-list-in-table">';
        if (item.effects && item.effects.length > 0) {
            item.effects.forEach(eff => {
                if (eff.type === "manual") {
                    effectsDisplayHtml += `<li>・${eff.manualString ? eff.manualString.replace(/\n/g, '<br>') : '(手動効果)'}</li>`;
                } else if (eff.type === "structured") {
                    const typeInfo = effectTypesCache.find(et => et.id === eff.effectTypeId);
                    const typeName = typeInfo ? typeInfo.name : `不明`;
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

        // Sources display
        let sourceDisplayHtml = '<ul class="effect-list-in-table">';
        if (item.sources && item.sources.length > 0) {
            item.sources.forEach(src => {
                if (src.type === 'manual') {
                    sourceDisplayHtml += `<li>・${src.manualString ? src.manualString.replace(/\n/g, '<br>') : '(手動入力)'}</li>`;
                } else if (src.type === 'tree' && src.nodeId) {
                    let pathText = src.resolvedDisplay;
                    if (!pathText && window.adminModules && window.adminModules.itemSourceManager && typeof window.adminModules.itemSourceManager.buildFullPathForSourceNode === 'function') {
                        pathText = window.adminModules.itemSourceManager.buildFullPathForSourceNode(src.nodeId, itemSourcesCacheData);
                    } else if (!pathText) {
                        pathText = `経路ID: ... (表示不可)`;
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
        const itemRef = doc(dbInstance, "items", docId);
        const itemSnap = await getDoc(itemRef);
        
        if (itemSnap.exists() && !itemSnap.data().isDeleted) { // Check isDeleted flag
            const itemData = itemSnap.data();
            clearItemFormInternal(); // Reset form before loading

            DOMI.itemIdToEditInput.value = itemSnap.id;
            DOMI.itemNameInput.value = itemData.name || "";
            DOMI.itemImageUrlInput.value = itemData.image || ''; // Existing URL
            if (DOMI.itemPriceInput) DOMI.itemPriceInput.value = (typeof itemData.price === 'number' && !isNaN(itemData.price)) ? String(itemData.price) : '';
            setRarityUI(itemData.rarity || 0);

            if (itemData.image && DOMI.itemImagePreview) {
                DOMI.itemImagePreview.src = itemData.image;
                DOMI.itemImagePreview.style.display = 'block';
            }
            selectedImageFile = null; // Reset selected file
            if(DOMI.itemImageFileInput) DOMI.itemImageFileInput.value = null; // Clear file input

            // Load effects from new unified 'effects' array
            if (itemData.effects && Array.isArray(itemData.effects)) {
                currentItemEffects = JSON.parse(JSON.stringify(itemData.effects));
            } else { // Fallback for older data structures (if any)
                currentItemEffects = [];
            }
            renderCurrentItemEffectsListUI();
            setEffectsInputMode('structured');

            // Load sources from new unified 'sources' array
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
            }
            renderCurrentItemSourcesListUI();
            setSourceInputMode('tree');
            if (DOMI.finalSourceDisplayPreviewInput) DOMI.finalSourceDisplayPreviewInput.value = '';

            const firstTreeSource = currentItemSources.find(s => s.type === 'tree' && s.nodeId);
            if (firstTreeSource && window.adminModules && window.adminModules.itemSourceManager &&
                typeof window.adminModules.itemSourceManager.populateItemSourceLevelButtons === 'function') {
                window.adminModules.itemSourceManager.populateItemSourceLevelButtons(
                    null, 1, DOMI.itemSourceButtonSelectionArea,
                    DOMI.selectedItemSourcePathDisplay, DOMI.selectedItemSourceNodeId_temp,
                    [], firstTreeSource.nodeId, DOMI.finalSourceDisplayPreviewInput
                );
            }


            _populateTagButtonsForItemFormInternal(itemData.tags || []);
            if (DOMI.saveItemButton) DOMI.saveItemButton.textContent = "アイテム更新";
            if (DOMI.deleteItemFromFormButton) DOMI.deleteItemFromFormButton.style.display = 'inline-block';

            const itemFormSection = document.getElementById('item-management');
            if (itemFormSection) itemFormSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            if (DOMI.itemNameInput) DOMI.itemNameInput.focus();

        } else {
            alert("編集対象のアイテムが見つからないか、削除済みです。");
        }
    } catch (error) {
        console.error("[Item Manager] Error loading item for edit:", error);
        alert("編集データの読み込み中にエラーが発生しました。");
    }
}

async function logicalDeleteItem(docId, itemName) {
    if (confirm(`アイテム「${itemName}」を論理削除しますか？データは残りますが一覧には表示されなくなります。`)) {
        try {
            await updateDoc(doc(dbInstance, 'items', docId), {
                isDeleted: true,
                updatedAt: serverTimestamp()
            });

            console.warn(`Item ${docId} (${itemName}) logically deleted. Image on R2 is NOT deleted.`);



            if (DOMI.itemIdToEditInput.value === docId) {
                clearItemFormInternal();
            }

            
        } catch (error) {
            console.error(`[Item Manager] Error logically deleting item ${docId}:`, error);
            alert("アイテムの論理削除に失敗しました。");
        }
    }
}

/**
 * 管理画面用のページネーションコントロールを生成・描画する
 * @param {number} totalItems - フィルタリング後のアイテム総数
 * @param {number} currentPage - 現在のページ番号
 * @param {number} itemsPerPage - 1ページあたりのアイテム数
 */
function renderAdminPaginationControls(totalItems, currentPage, itemsPerPage) {
    const paginationControls = document.getElementById('adminPaginationControls');
    if (!paginationControls) return;

    paginationControls.innerHTML = '';
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    if (totalPages <= 1) {
        return; // 1ページ以下の場合は何も表示しない
    }

    const createButton = (text, page, isDisabled = false, isCurrent = false) => {
        const button = document.createElement('button');
        button.textContent = text;
        button.disabled = isDisabled;
        if (isCurrent) {
            button.classList.add('active'); // CSSでスタイルを当てるためのクラス
            button.style.fontWeight = 'bold';
            button.style.backgroundColor = '#007bff';
            button.style.color = 'white';
        } else {
            button.classList.add('pagination-button'); // 既存のスタイルを流用
            button.style.backgroundColor = '#f0f0f0';
            button.style.color = '#333';
        }

        button.addEventListener('click', () => {
            adminCurrentPage = page;
            _renderItemsAdminTableInternal(); // テーブルを再描画
            // テーブルの上部にスクロール
            const tableElement = document.getElementById('itemsTable');
            if (tableElement) {
                tableElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
        return button;
    };

    // 「前へ」ボタン
    paginationControls.appendChild(createButton('前へ', currentPage - 1, currentPage === 1));

    // ページ情報
    const pageInfo = document.createElement('span');
    pageInfo.textContent = `${currentPage} / ${totalPages} ページ (${totalItems}件)`;
    pageInfo.style.margin = '0 10px';
    paginationControls.appendChild(pageInfo);

    // 「次へ」ボタン
    paginationControls.appendChild(createButton('次へ', currentPage + 1, currentPage === totalPages));
}

/**
 * 管理画面のカテゴリフィルター（チェックボックス）を描画する
 */
function renderAdminCategoryFilter() {
    if (!DOMI.adminCategoryFilterContainer) return;
    DOMI.adminCategoryFilterContainer.innerHTML = '';
    const allCategories = getAllCategoriesFuncCache();
    
    const childCategories = allCategories
        .filter(cat => cat.parentId) // 子カテゴリのみ
        .map(cat => {
            const parent = allCategories.find(p => p.id === cat.parentId);
            return {
                id: cat.id,
                name: `${parent ? parent.name + ' > ' : ''}${cat.name}`
            };
        })
        .sort((a, b) => a.name.localeCompare(b.name, 'ja'));

    if (childCategories.length === 0) {
        DOMI.adminCategoryFilterContainer.innerHTML = '<p>利用可能な子カテゴリがありません。</p>';
        return;
    }

    childCategories.forEach(cat => {
        const wrapper = document.createElement('div');
        wrapper.className = 'checkbox-item';
        const checkboxId = `admin-cat-filter-${cat.id}`;
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = checkboxId;
        checkbox.value = cat.id;
        checkbox.checked = adminFilterState.categoryIds.includes(cat.id);

        const label = document.createElement('label');
        label.htmlFor = checkboxId;
        label.textContent = cat.name;

        wrapper.appendChild(checkbox);
        wrapper.appendChild(label);
        DOMI.adminCategoryFilterContainer.appendChild(wrapper);
    });
}

/**
 * 管理画面のタグフィルター（ボタン）を描画する
 * 選択中のカテゴリに属するタグのみを表示する
 */
function renderAdminTagFilter() {
    if (!DOMI.adminTagFilterContainer) return;
    DOMI.adminTagFilterContainer.innerHTML = '';
    const allTags = getAllTagsFuncCache();

    let tagsToShow = [];
    if (adminFilterState.categoryIds.length > 0) {
        // カテゴリが選択されている場合は、それらのカテゴリに属するタグのみ表示
        const selectedCategorySet = new Set(adminFilterState.categoryIds);
        tagsToShow = allTags.filter(tag => 
            tag.categoryIds && tag.categoryIds.some(catId => selectedCategorySet.has(catId))
        );
    } else {
        // カテゴリが選択されていない場合は、全てのタグを表示
        tagsToShow = allTags;
    }

    // 選択中のタグがフィルター後のリストに含まれない場合、選択状態を解除
    adminFilterState.tagIds = adminFilterState.tagIds.filter(tagId => tagsToShow.some(t => t.id === tagId));

    if (tagsToShow.length === 0) {
        DOMI.adminTagFilterContainer.innerHTML = adminFilterState.categoryIds.length > 0 ?
            '<p>選択されたカテゴリに属するタグはありません。</p>' :
            '<p>利用可能なタグがありません。</p>';
        return;
    }
    
    tagsToShow.sort((a,b) => a.name.localeCompare(b.name, 'ja')).forEach(tag => {
        const button = document.createElement('div');
        button.className = 'tag-filter admin-tag-select';
        button.textContent = tag.name;
        button.dataset.tagId = tag.id;
        if (adminFilterState.tagIds.includes(tag.id)) {
            button.classList.add('active');
        }
        DOMI.adminTagFilterContainer.appendChild(button);
    });
}
