import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import {
    getFirestore, collection, getDocs, query, orderBy, where
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// ★部位名と対応するタグIDのマッピング (実際のタグIDに置き換えてください)
const EQUIPMENT_SLOT_TAG_IDS = {
    "服": "TAG_ID_FOR_CLOTHES",    // 例: 服タグのドキュメントID
    "顔": "TAG_ID_FOR_FACE",      // 例: 顔タグのドキュメントID
    "首": "TAG_ID_FOR_NECK",      // 例: 首タグのドキュメントID
    "手": "TAG_ID_FOR_HANDS",     // 例: 手タグのドキュメントID
    "背中": "TAG_ID_FOR_BACK",     // 例: 背中タグのドキュメントID
    "足": "TAG_ID_FOR_FEET"       // 例: 足タグのドキュメントID
};
// 上記の TAG_ID_FOR_... は実際のFirestore上のタグのドキュメントIDに書き換えてください。

const firebaseConfig = {
  apiKey: "AIzaSyBxrE-9E46dplHTuEBmmcJWQRU1vLgAGAU", 
  authDomain: "itemsearchtooleditor.firebaseapp.com",
  projectId: "itemsearchtooleditor",
  storageBucket: "itemsearchtooleditor.appspot.com",
  messagingSenderId: "243156973544",
  appId: "1:243156973544:web:ffdc31134a35354b6dd65d",
  measurementId: "G-8EHP9MGJ4M"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', () => {
    // --- 検索ツール用 DOM ---
    const searchInput = document.getElementById('searchInput');
    const parentCategoryFiltersContainer = document.getElementById('parentCategoryFiltersContainer');
    const childCategoriesAndTagsContainer = document.getElementById('childCategoriesAndTagsContainer');
    const itemList = document.getElementById('itemList');
    const itemCountDisplay = document.getElementById('itemCount');
    const resetFiltersButton = document.getElementById('resetFiltersButton');

    // --- シミュレーター用 DOM ---
    const equipmentSlotsContainer = document.querySelector('.equipment-slots');
    const totalEffectsDisplay = document.getElementById('totalEffectsDisplay');
    const saveImageButton = document.getElementById('saveImageButton');
    const resetSimulatorButton = document.getElementById('resetSimulatorButton');
    const imageExportArea = document.getElementById('imageExportArea'); 
    const exportSlots = document.getElementById('exportSlots');
    const exportEffects = document.getElementById('exportEffects');
    
    // ★アイテム選択モーダル DOM
    const itemSelectionModal = document.getElementById('itemSelectionModal');
    const itemSelectModalTitle = document.getElementById('itemSelectModalTitle');
    const itemSelectModalSearch = document.getElementById('itemSelectModalSearch');
    const itemSelectModalList = document.getElementById('itemSelectModalList');

    // --- データキャッシュ ---
    let allItems = [];
    let allCategories = []; 
    let allTags = [];       
    let effectTypesCache = []; 
    
    // --- 検索ツール用 状態変数 ---
    let selectedParentCategoryIds = [];
    let selectedTagIds = [];

    // --- シミュレーター用 状態変数 ---
    const equipmentSlots = ["服", "顔", "首", "手", "背中", "足"]; 
    let selectedEquipment = {}; // { "服": itemDocId | null, ... }
    let currentSelectingSlot = null; // ★モーダルで選択中のスロット名

    // --- 初期データロード ---
    async function loadData() {
        try {
            const effectTypesSnapshot = await getDocs(query(collection(db, 'effect_types'), orderBy('name')));
            effectTypesCache = effectTypesSnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
            console.log("User site: Effect Types loaded:", effectTypesCache);

            const categoriesSnapshot = await getDocs(query(collection(db, 'categories'), orderBy('name')));
            allCategories = categoriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("User site: All Categories loaded:", allCategories);

            const tagsSnapshot = await getDocs(query(collection(db, 'tags'), orderBy('name')));
            allTags = tagsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("User site: All Tags loaded:", allTags);
            
            const itemsSnapshot = await getDocs(query(collection(db, 'items'), orderBy('name')));
            allItems = itemsSnapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
            console.log("User site: Items loaded:", allItems);

            // --- UI初期化 ---
            renderParentCategoryFilters();
            renderChildCategoriesAndTags(); 
            renderItems([]); // 最初は空にしておくか、何か表示するか

            // シミュレーター初期化
            initializeSimulatorSlots(); // スロットのボタンにイベントリスナー設定
            initializeSimulatorDisplay(); 

        } catch (error) {
            console.error("Error loading data:", error);
            if (itemList) itemList.innerHTML = `<p style="color: red;">データの読み込みに失敗しました。</p>`;
            if (itemCountDisplay) itemCountDisplay.textContent = 'エラー';
            if (totalEffectsDisplay) totalEffectsDisplay.innerHTML = '<p style="color: red;">データ読込エラー</p>';
        }
    }

    // --- 検索ツール関連関数 ---
    // (renderParentCategoryFilters, toggleParentCategory, renderChildCategoriesAndTags, 
    //  toggleTag, renderItems, filterAndRenderItems, resetFilters は前回のコードと同じ)
     function renderParentCategoryFilters() {
        if (!parentCategoryFiltersContainer) return;
        parentCategoryFiltersContainer.innerHTML = '';
        const parentCategories = allCategories.filter(cat => !cat.parentId || cat.parentId === "");
        
        if (parentCategories.length === 0) {
            parentCategoryFiltersContainer.innerHTML = '<p>利用可能な親カテゴリはありません。</p>';
            return;
        }

        parentCategories.forEach(category => {
            const button = document.createElement('div');
            button.classList.add('category-filter-button');
            button.textContent = category.name;
            button.dataset.categoryId = category.id;
            if (selectedParentCategoryIds.includes(category.id)) {
                button.classList.add('active');
            }
            button.addEventListener('click', () => toggleParentCategory(button, category.id));
            parentCategoryFiltersContainer.appendChild(button);
        });
    }

    function toggleParentCategory(button, categoryId) {
        button.classList.toggle('active');
        if (selectedParentCategoryIds.includes(categoryId)) {
            selectedParentCategoryIds = selectedParentCategoryIds.filter(id => id !== categoryId);
        } else {
            selectedParentCategoryIds.push(categoryId);
        }
        selectedTagIds = []; 
        renderChildCategoriesAndTags();
        filterAndRenderItems();
    }

    function renderChildCategoriesAndTags() {
        if (!childCategoriesAndTagsContainer) return;
        childCategoriesAndTagsContainer.innerHTML = '';

        if (selectedParentCategoryIds.length === 0) {
            childCategoriesAndTagsContainer.innerHTML = '<p style="color: #777; margin-top: 10px;">親カテゴリを選択すると、関連する子カテゴリとタグが表示されます。</p>';
            return;
        }

        let hasContentToShow = false;

        selectedParentCategoryIds.forEach(parentId => {
            const parentCat = allCategories.find(c => c.id === parentId);
            if (!parentCat) return;

            const childCategories = allCategories.filter(cat => cat.parentId === parentId);

            if (childCategories.length > 0) {
                hasContentToShow = true;

                childCategories.forEach(childCat => {
                    const childCatSection = document.createElement('div');
                    childCatSection.classList.add('child-category-section');
                    
                    const childCatHeader = document.createElement('h4');
                    const searchModeText = childCat.tagSearchMode === 'OR' ? '(OR検索)' 
                                          : '(AND検索)'; 
                    childCatHeader.innerHTML = `${childCat.name} <span class="search-mode">${searchModeText}</span>`;
                    childCatSection.appendChild(childCatHeader);

                    const tagsForThisChild = allTags.filter(tag => tag.categoryIds && tag.categoryIds.includes(childCat.id));
                    
                    if (tagsForThisChild.length > 0) {
                        const tagsContainer = document.createElement('div');
                        tagsContainer.classList.add('tag-filters-inline');
                        tagsForThisChild.forEach(tag => {
                            const tagButton = document.createElement('div');
                            tagButton.classList.add('tag-filter');
                            tagButton.textContent = tag.name;
                            tagButton.dataset.tagId = tag.id;
                            if (selectedTagIds.includes(tag.id)) {
                                tagButton.classList.add('active');
                            }
                            tagButton.addEventListener('click', () => toggleTag(tagButton, tag.id));
                            tagsContainer.appendChild(tagButton);
                        });
                        childCatSection.appendChild(tagsContainer);
                    } else {
                        childCatSection.innerHTML += '<p class="no-tags-message">この子カテゴリに属するタグはありません。</p>';
                    }
                    childCategoriesAndTagsContainer.appendChild(childCatSection);
                });
            }
        });
        if (!hasContentToShow && selectedParentCategoryIds.length > 0) {
             childCategoriesAndTagsContainer.innerHTML = '<p style="color: #777; margin-top: 10px;">選択された親カテゴリには子カテゴリまたは表示可能なタグがありません。</p>';
        }
    }
    
    function toggleTag(tagButton, tagId) {
        tagButton.classList.toggle('active');
        if (selectedTagIds.includes(tagId)) {
            selectedTagIds = selectedTagIds.filter(id => id !== tagId);
        } else {
            selectedTagIds.push(tagId);
        }
        filterAndRenderItems();
    }
    
    function renderItems(itemsToRender) {
        if (!itemList) return;
        itemList.innerHTML = '';
        if (itemCountDisplay) {
            itemCountDisplay.textContent = `${itemsToRender.length} 件のアイテムが見つかりました。`;
        }
        if (itemsToRender.length === 0) {
            itemList.innerHTML = '<p>該当するアイテムは見つかりませんでした。</p>';
            return;
        }
        itemsToRender.forEach(item => {
            const itemCard = document.createElement('div');
            itemCard.classList.add('item-card');
            const nameDisplay = item.name || '名称未設定';
            const effectText = item.effect || ''; // 既存の効果テキスト (もしあれば)
            const sourceDisplay = item.入手手段 || '後日追加予定';
            let imageElementHTML;
            if (item.image && item.image.trim() !== "") {
                imageElementHTML = `<img src="${item.image}" alt="${nameDisplay}" onerror="this.onerror=null; this.src='./images/placeholder_item.png'; this.alt='画像読み込みエラー';">`;
            } else {
                imageElementHTML = `<div class="item-image-text-placeholder">NoImage</div>`;
            }
            let tagsHtml = '';
            if (item.tags && item.tags.length > 0) {
                tagsHtml = `<div class="tags">タグ: ${item.tags.map(tagId => {
                    const tagObj = allTags.find(t => t.id === tagId);
                    return `<span>${tagObj ? tagObj.name : '不明なタグ'}</span>`;
                }).join(' ')}</div>`;
            }
            // 構造化された効果を表示
            let structuredEffectsHtml = '';
            if (item.structured_effects && item.structured_effects.length > 0) {
                structuredEffectsHtml = `<div class="structured-effects"><strong>効果詳細:</strong><ul>`;
                item.structured_effects.forEach(eff => {
                     const effectType = effectTypesCache.find(et => et.id === eff.type);
                     const typeName = effectType ? effectType.name : '不明';
                     const unitText = eff.unit !== 'none' ? eff.unit : '';
                     structuredEffectsHtml += `<li>${typeName}: ${eff.value}${unitText}</li>`;
                });
                 structuredEffectsHtml += `</ul></div>`;
            } else if (effectText) {
                 // 構造化データがない場合は従来のテキストを表示（フォールバック）
                 structuredEffectsHtml = `<p><strong>効果:</strong> ${effectText}</p>`;
            } else {
                structuredEffectsHtml = `<p><strong>効果:</strong> 後日追加予定</p>`;
            }


            itemCard.innerHTML = `
                ${imageElementHTML}
                <h3>${nameDisplay}</h3>
                ${structuredEffectsHtml} {/* 効果表示 */}
                <p><strong>入手手段:</strong> ${sourceDisplay}</p>
                ${tagsHtml}
            `;
            itemList.appendChild(itemCard);
        });
    }

    function filterAndRenderItems() {
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : "";
        
        let filteredItems = allItems.filter(item => {
            const matchesSearchTerm = searchTerm === '' ||
                (item.name && item.name.toLowerCase().includes(searchTerm)) ||
                // 構造化効果のテキスト表現も検索対象にする (より高度)
                (item.structured_effects && item.structured_effects.some(eff => {
                     const typeInfo = effectTypesCache.find(et => et.id === eff.type);
                     const typeName = typeInfo ? typeInfo.name : '';
                     const unitText = eff.unit !== 'none' ? eff.unit : '';
                     return `${typeName}${eff.value}${unitText}`.toLowerCase().includes(searchTerm);
                })) ||
                (item.入手手段 && item.入手手段.toLowerCase().includes(searchTerm));

            if (!matchesSearchTerm) return false;

            let matchesCategories = true; 
            if (selectedParentCategoryIds.length > 0) {
                matchesCategories = selectedParentCategoryIds.every(parentId => {
                    const childCategoryIdsOfThisParent = allCategories
                        .filter(cat => cat.parentId === parentId)
                        .map(cat => cat.id);
                    if (childCategoryIdsOfThisParent.length === 0) return false; 
                    return (item.tags || []).some(itemTagId => {
                        const tagObj = allTags.find(t => t.id === itemTagId);
                        return tagObj?.categoryIds?.some(catId => childCategoryIdsOfThisParent.includes(catId));
                    });
                });
            }
            if (!matchesCategories) return false;

            let matchesTags = true;
            if (selectedTagIds.length > 0) {
                const categoryIdsOfSelectedTags = new Set();
                 selectedTagIds.forEach(tagId => {
                    const tagObj = allTags.find(t => t.id === tagId);
                    (tagObj?.categoryIds || []).forEach(catId => categoryIdsOfSelectedTags.add(catId));
                });
                let singleChildCategoryId = null;
                let belongsToMultipleChildCategories = false;
                if (categoryIdsOfSelectedTags.size > 0) {
                    let commonChildCategoryIds = [];
                    const firstTagId = selectedTagIds[0];
                    const firstTagObj = allTags.find(t => t.id === firstTagId);
                    const firstTagChildCategoryIds = (firstTagObj?.categoryIds || []).filter(catId => {
                        const cat = allCategories.find(c => c.id === catId);
                        return cat && cat.parentId; 
                    });
                    if (firstTagChildCategoryIds.length > 0) {
                        commonChildCategoryIds = firstTagChildCategoryIds;
                        for (let i = 1; i < selectedTagIds.length; i++) {
                            const currentTagId = selectedTagIds[i];
                            const currentTagObj = allTags.find(t => t.id === currentTagId);
                            const currentTagChildCategoryIds = new Set(
                                (currentTagObj?.categoryIds || []).filter(catId => {
                                    const cat = allCategories.find(c => c.id === catId);
                                    return cat && cat.parentId;
                                })
                            );
                            commonChildCategoryIds = commonChildCategoryIds.filter(catId => currentTagChildCategoryIds.has(catId));
                            if (commonChildCategoryIds.length === 0) break; 
                        }
                    }
                    if (commonChildCategoryIds.length === 1) {
                        singleChildCategoryId = commonChildCategoryIds[0];
                    } else if (commonChildCategoryIds.length > 1) {
                         belongsToMultipleChildCategories = true; 
                    }
                }
                let searchMode = 'AND'; 
                if (singleChildCategoryId) {
                    const category = allCategories.find(c => c.id === singleChildCategoryId);
                    if (category && category.tagSearchMode === 'OR') {
                        searchMode = 'OR';
                    }
                }
                 if (belongsToMultipleChildCategories) {
                     searchMode = 'AND';
                 }
                if (searchMode === 'OR') {
                    matchesTags = selectedTagIds.some(selTagId => item.tags && item.tags.includes(selTagId));
                } else {
                    matchesTags = selectedTagIds.every(selTagId => item.tags && item.tags.includes(selTagId));
                }
            }
            
            return matchesTags; 
        });
        renderItems(filteredItems);
    }
    function resetFilters() {
        if (searchInput) searchInput.value = '';
        selectedParentCategoryIds = [];
        selectedTagIds = [];
        renderParentCategoryFilters(); 
        renderChildCategoriesAndTags(); 
        filterAndRenderItems();
    }
    if (resetFiltersButton) resetFiltersButton.addEventListener('click', resetFilters);
    if (searchInput) searchInput.addEventListener('input', filterAndRenderItems);


    // --- シミュレーター関連関数 ---

    // ★スロットのボタンにイベントリスナーを設定
    function initializeSimulatorSlots() {
        equipmentSlotsContainer.querySelectorAll('.select-item-button').forEach(button => {
            button.addEventListener('click', openItemSelectionModal);
        });
         equipmentSlotsContainer.querySelectorAll('.clear-item-button').forEach(button => {
            button.addEventListener('click', clearEquipmentSlot);
        });
    }

    // ★アイテム選択モーダルを開く
    function openItemSelectionModal(event) {
        currentSelectingSlot = event.target.dataset.slot;
        if (!currentSelectingSlot) return;

        if (itemSelectModalTitle) itemSelectModalTitle.textContent = `${currentSelectingSlot}を選択`;
        if (itemSelectModalSearch) itemSelectModalSearch.value = ''; // 検索欄をクリア

        populateItemSelectionModalList(); // アイテムリストを表示

        if (itemSelectionModal) itemSelectionModal.style.display = 'flex';
        if (itemSelectModalSearch) itemSelectModalSearch.focus();
    }

    // ★モーダル内のアイテムリストを生成・表示
    function populateItemSelectionModalList() {
        if (!itemSelectModalList || !currentSelectingSlot) return;

        const slotTagId = EQUIPMENT_SLOT_TAG_IDS[currentSelectingSlot];
        if (!slotTagId) {
            itemSelectModalList.innerHTML = '<p>この部位に対応するタグが設定されていません。</p>';
            return;
        }
        
        const searchTerm = itemSelectModalSearch ? itemSelectModalSearch.value.toLowerCase() : '';

        // 該当部位タグを持ち、かつ検索語にマッチするアイテムをフィルタリング
        const slotItems = allItems.filter(item => 
            (item.tags && item.tags.includes(slotTagId)) &&
            (!searchTerm || (item.name && item.name.toLowerCase().includes(searchTerm)))
        );

        itemSelectModalList.innerHTML = ''; // リストをクリア
        if (slotItems.length === 0) {
             itemSelectModalList.innerHTML = '<p>該当するアイテムが見つかりません。</p>';
             return;
        }

        slotItems.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.classList.add('item-select-modal-item');
            itemDiv.dataset.itemId = item.docId;
            itemDiv.innerHTML = `
                <img src="${item.image || './images/placeholder_item.png'}" alt="${item.name || ''}">
                <span>${item.name || '(名称未設定)'}</span>
            `;
            itemDiv.addEventListener('click', selectItemFromModal);
            itemSelectModalList.appendChild(itemDiv);
        });
    }
    
    // ★モーダルでアイテムを選択した時の処理
    function selectItemFromModal(event) {
        const selectedItemId = event.currentTarget.dataset.itemId;
        if (!currentSelectingSlot || !selectedItemId) return;

        selectedEquipment[currentSelectingSlot] = selectedItemId; // 選択状態を更新

        updateSimulatorSlotDisplay(currentSelectingSlot); // スロット表示更新
        calculateAndDisplayTotalEffects(); // 合計効果再計算

        if (itemSelectionModal) itemSelectionModal.style.display = 'none'; // モーダルを閉じる
        currentSelectingSlot = null; // 選択中スロットをリセット
    }

    // ★部位の装備を解除する処理
    function clearEquipmentSlot(event) {
         const slotName = event.target.dataset.slot;
         if(!slotName) return;
         
         selectedEquipment[slotName] = null; // データ解除
         
         // プルダウンの名残でselectを探していたが、ボタンに変わったので不要
         // const selectElement = document.getElementById(`select-${slotName}`);
         // if(selectElement) selectElement.value = ""; 
         
         updateSimulatorSlotDisplay(slotName); // 表示更新
         calculateAndDisplayTotalEffects(); // 再計算
    }


    // ★モーダル内の検索入力イベント
    if (itemSelectModalSearch) {
        itemSelectModalSearch.addEventListener('input', populateItemSelectionModalList);
    }
    

    // ★選択された装備の表示を更新 (解除ボタンの表示制御を追加)
    function updateSimulatorSlotDisplay(slotName) {
        const slotElement = document.getElementById(`slot-${slotName}`);
        if (!slotElement) return;

        const imgElement = slotElement.querySelector('.slot-image');
        const nameElement = slotElement.querySelector('.slot-item-name');
        const clearButton = slotElement.querySelector('.clear-item-button');
        const selectButton = slotElement.querySelector('.select-item-button');
        const itemId = selectedEquipment[slotName];

        if (itemId) {
            const item = allItems.find(i => i.docId === itemId);
            if (item) {
                imgElement.src = item.image || './images/placeholder_item.png';
                imgElement.alt = item.name || 'アイテム画像';
                nameElement.textContent = item.name || '(名称未設定)';
                if(clearButton) clearButton.style.display = 'inline-block'; // 解除ボタン表示
                if(selectButton) selectButton.textContent = '変更'; // 選択ボタンのテキスト変更
            } else { 
                imgElement.src = './images/placeholder_slot.png';
                imgElement.alt = slotName;
                nameElement.textContent = 'エラー';
                 if(clearButton) clearButton.style.display = 'none';
                 if(selectButton) selectButton.textContent = '選択';
            }
        } else { 
            imgElement.src = './images/placeholder_slot.png';
            imgElement.alt = slotName;
            nameElement.textContent = '未選択';
             if(clearButton) clearButton.style.display = 'none'; // 解除ボタン非表示
             if(selectButton) selectButton.textContent = '選択'; // 選択ボタンのテキスト戻す
        }
    }
    
    // 合計効果を計算して表示 (変更なし)
    function calculateAndDisplayTotalEffects() {
        const totalEffects = {}; 

        Object.values(selectedEquipment).forEach(itemId => {
            if (!itemId) return; 
            const item = allItems.find(i => i.docId === itemId);
            if (!item || !item.structured_effects) return; 

            item.structured_effects.forEach(effect => {
                const { type, value, unit } = effect;
                if (type && typeof value === 'number') { 
                    const key = `${type}_${unit}`; 
                    if (!totalEffects[key]) {
                        totalEffects[key] = { typeId: type, value: 0, unit: unit };
                    }
                    totalEffects[key].value += value;
                }
            });
        });

        if (Object.keys(totalEffects).length === 0) {
            totalEffectsDisplay.innerHTML = '<p>効果はありません。</p>';
        } else {
            let html = '<ul>';
            Object.values(totalEffects).forEach(effect => {
                 const typeInfo = effectTypesCache.find(et => et.id === effect.typeId);
                 const typeName = typeInfo ? typeInfo.name : `不明(${effect.typeId})`;
                 const unitText = effect.unit !== 'none' ? effect.unit : '';
                 const displayValue = Math.round(effect.value * 100) / 100; 
                 html += `<li>${typeName}: ${displayValue}${unitText}</li>`;
            });
            html += '</ul>';
            totalEffectsDisplay.innerHTML = html;
        }
    }

    // シミュレーター表示の初期化 (変更なし)
    function initializeSimulatorDisplay() {
        equipmentSlots.forEach(slotName => {
            updateSimulatorSlotDisplay(slotName); 
        });
        calculateAndDisplayTotalEffects(); 
    }

    // 構成リセットボタンの処理 (★select要素ではなくボタンの状態をリセット)
    if(resetSimulatorButton) {
        resetSimulatorButton.addEventListener('click', () => {
             equipmentSlots.forEach(slotName => {
                 // select要素ではなく、保持データをリセット
                 selectedEquipment[slotName] = null; 
                 // 表示を更新
                 updateSimulatorSlotDisplay(slotName); 
             });
            // calculateAndDisplayTotalEffects(); // updateSimulatorSlotDisplay内で呼ばれるので不要かも
            console.log("Simulator reset.");
        });
    }

    // 画像保存ボタンの処理 (★出力内容の取得方法を修正)
    if (saveImageButton) {
        saveImageButton.addEventListener('click', async () => {
            // 1. 出力用要素に現在の構成と効果を反映
            exportSlots.innerHTML = ''; // クリア
            equipmentSlots.forEach(slotName => {
                const itemId = selectedEquipment[slotName];
                let itemHtml = `<div class="export-slot-item"><strong>${slotName}:</strong> `; // クラス追加
                if (itemId) {
                    const item = allItems.find(i => i.docId === itemId);
                    if (item) {
                         // ★ Base64 Data URL があればそれを使う、なければパス（CORS注意）
                         const imgSrc = item.imageBase64 || item.image || './images/placeholder_item.png'; 
                         itemHtml += `<img src="${imgSrc}" alt="" class="export-item-image"> <span>${item.name || '(名称未設定)'}</span>`;
                    } else {
                         itemHtml += '<span>エラー</span>';
                    }
                } else {
                    itemHtml += '<span>なし</span>';
                }
                itemHtml += '</div>';
                exportSlots.innerHTML += itemHtml;
            });
            exportEffects.innerHTML = totalEffectsDisplay.innerHTML; // 計算結果をコピー

            // 2. html2canvasで画像生成
            try {
                const canvasOptions = {
                    useCORS: true, 
                    allowTaint: true,
                    // scale: 2, // 高解像度にする場合
                    backgroundColor: '#ffffff' // 背景色を指定しないと透明になる場合がある
                };
                console.log("Generating image from:", imageExportArea);
                const canvas = await html2canvas(imageExportArea, canvasOptions); 
                
                // 3. 画像をダウンロード
                const link = document.createElement('a');
                link.download = '装備構成.png'; 
                link.href = canvas.toDataURL('image/png'); 
                link.click(); 
                console.log("Image download triggered.");
            } catch (error) {
                console.error("Image generation error:", error);
                alert("画像の生成に失敗しました。コンソールログを確認してください。");
            }
        });
    }


    // --- 初期データロード実行 ---
    loadData();

    // --- モーダル共通ハンドラ ---
     document.querySelectorAll('.modal .close-button').forEach(btn => {
        btn.onclick = function() { this.closest('.modal').style.display = "none"; }
    });
    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) event.target.style.display = "none";
    }


}); // End DOMContentLoaded
