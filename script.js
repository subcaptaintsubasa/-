import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import {
    getFirestore, collection, getDocs, query, orderBy, where
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// ★部位名と対応するタグIDのマッピング (実際のタグIDに置き換えてください)
const EQUIPMENT_SLOT_TAG_IDS = {
    "服": "YOUR_CLOTHES_TAG_ID",    // 例: 服タグのドキュメントID
    "顔": "YOUR_FACE_TAG_ID",      // 例: 顔タグのドキュメントID
    "首": "YOUR_NECK_TAG_ID",      // 例: 首タグのドキュメントID
    "手": "YOUR_HANDS_TAG_ID",     // 例: 手タグのドキュメントID
    "背中": "YOUR_BACK_TAG_ID",     // 例: 背中タグのドキュメントID
    "足": "YOUR_FEET_TAG_ID"       // 例: 足タグのドキュメントID
};
// 上記 YOUR_..._TAG_ID は実際のFirestore上の部位タグのIDに書き換えてください。

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
    // --- DOM Elements ---
    const searchInput = document.getElementById('searchInput');
    const parentCategoryFiltersContainer = document.getElementById('parentCategoryFiltersContainer');
    const childCategoriesAndTagsContainer = document.getElementById('childCategoriesAndTagsContainer');
    const itemList = document.getElementById('itemList');
    const itemCountDisplay = document.getElementById('itemCount');
    const resetFiltersButton = document.getElementById('resetFiltersButton');
    const openSimulatorButton = document.getElementById('openSimulatorButton'); // ★追加
    const simulatorModal = document.getElementById('simulatorModal'); // ★追加
    const confirmSelectionButton = document.getElementById('confirmSelectionButton'); // ★追加
    const searchToolMessage = document.getElementById('searchToolMessage'); // ★追加

    // Simulator DOM
    const equipmentSlotsContainer = document.querySelector('.equipment-slots');
    const totalEffectsDisplay = document.getElementById('totalEffectsDisplay');
    const saveImageButton = document.getElementById('saveImageButton');
    const resetSimulatorButton = document.getElementById('resetSimulatorButton');
    const imageExportArea = document.getElementById('imageExportArea'); 
    const exportSlots = document.getElementById('exportSlots');
    const exportEffects = document.getElementById('exportEffects');
    
    // --- Data Cache ---
    let allItems = [];
    let allCategories = []; 
    let allTags = [];       
    let effectTypesCache = []; 
    
    // --- Search Tool State ---
    let selectedParentCategoryIds = [];
    let selectedTagIds = [];
    let isSelectingForSimulator = false; // ★シミュレーター連携中かどうかのフラグ

    // --- Simulator State ---
    const equipmentSlots = ["服", "顔", "首", "手", "背中", "足"]; 
    let selectedEquipment = {}; 
    let currentSelectingSlot = null; 
    let temporarilySelectedItem = null; // ★検索ツールで仮選択中のアイテムID

    // --- Initial Data Load ---
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

            // UI Initialization
            renderParentCategoryFilters();
            renderChildCategoriesAndTags(); 
            renderItems([]); // 初期状態ではアイテムリストは空に
            initializeSimulatorSlots(); 
            initializeSimulatorDisplay(); 

        } catch (error) {
            console.error("Error loading data:", error);
            if (itemList) itemList.innerHTML = `<p style="color: red;">データの読み込みに失敗しました。</p>`;
            if (itemCountDisplay) itemCountDisplay.textContent = 'エラー';
            if (totalEffectsDisplay) totalEffectsDisplay.innerHTML = '<p style="color: red;">データ読込エラー</p>';
        }
    }

    // --- Search Tool Functions ---
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
             // ★シミュレータ連携中はボタンを無効化
             if (isSelectingForSimulator) {
                 button.classList.add('disabled'); 
             } else {
                button.classList.remove('disabled');
             }
            button.textContent = category.name;
            button.dataset.categoryId = category.id;
            if (selectedParentCategoryIds.includes(category.id)) {
                button.classList.add('active');
            }
            button.addEventListener('click', () => {
                if (!isSelectingForSimulator) { // ★連携中以外のみ動作
                    toggleParentCategory(button, category.id);
                }
            });
            parentCategoryFiltersContainer.appendChild(button);
        });
    }

    function toggleParentCategory(button, categoryId) {
        if (isSelectingForSimulator) return; // 念のためガード
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

        // ★シミュレータ連携中は表示しない
        if (isSelectingForSimulator) {
             childCategoriesAndTagsContainer.style.display = 'none';
             return;
        } else {
            childCategoriesAndTagsContainer.style.display = 'block';
        }


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
                            // 部位タグは選択不可にする (シミュレータ連携時)
                            if (isSelectingForSimulator && Object.values(EQUIPMENT_SLOT_TAG_IDS).includes(tag.id)) {
                                tagButton.classList.add('disabled');
                            } else {
                                tagButton.classList.remove('disabled');
                                if (selectedTagIds.includes(tag.id)) {
                                    tagButton.classList.add('active');
                                }
                                tagButton.addEventListener('click', () => {
                                     if (!isSelectingForSimulator || !Object.values(EQUIPMENT_SLOT_TAG_IDS).includes(tag.id)) {
                                        toggleTag(tagButton, tag.id);
                                    }
                                });
                            }
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
         // 部位タグは直接選択・解除させない（シミュレータ連携時）
        if (isSelectingForSimulator && Object.values(EQUIPMENT_SLOT_TAG_IDS).includes(tagId)) {
            return; 
        }

        tagButton.classList.toggle('active');
        if (selectedTagIds.includes(tagId)) {
            selectedTagIds = selectedTagIds.filter(id => id !== tagId);
        } else {
            selectedTagIds.push(tagId);
        }
        filterAndRenderItems();
    }
    
    // ★アイテムカードにクリックイベントを追加し、選択状態を管理
    function renderItems(itemsToRender) {
        if (!itemList) return;
        itemList.innerHTML = '';
        if (itemCountDisplay) {
            // シミュレータ連携中は件数表示を調整しても良い
            const countText = isSelectingForSimulator ? `該当部位のアイテム: ${itemsToRender.length} 件` : `${itemsToRender.length} 件のアイテムが見つかりました。`;
            itemCountDisplay.textContent = countText;
        }
        if (itemsToRender.length === 0) {
            itemList.innerHTML = '<p>該当するアイテムは見つかりませんでした。</p>';
            return;
        }
        itemsToRender.forEach(item => {
            const itemCard = document.createElement('div');
            itemCard.classList.add('item-card');
            // ★シミュレータ連携中は選択可能クラスを追加
            if (isSelectingForSimulator) {
                itemCard.classList.add('selectable');
                 // ★仮選択中のアイテムをハイライト
                if (temporarilySelectedItem === item.docId) {
                    itemCard.classList.add('selected-for-simulator');
                }
            }
            itemCard.dataset.itemId = item.docId; // データ属性にIDを持たせる

            const nameDisplay = item.name || '名称未設定';
            // const effectDisplay = item.effect || '後日追加予定'; // 構造化データを表示
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
                    // 部位タグは表示しないようにする（任意）
                    // if (tagObj && Object.values(EQUIPMENT_SLOT_TAG_IDS).includes(tagId)) return null; 
                    return `<span>${tagObj ? tagObj.name : '不明'}</span>`;
                }).filter(Boolean).join(' ')}</div>`;
            }
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
            } else {
                structuredEffectsHtml = `<p><strong>効果:</strong> 後日追加予定</p>`;
            }

            itemCard.innerHTML = `
                ${imageElementHTML}
                <h3>${nameDisplay}</h3>
                ${structuredEffectsHtml}
                <p><strong>入手手段:</strong> ${sourceDisplay}</p>
                ${tagsHtml}
            `;
            
            // ★シミュレータ連携中にクリックイベントを追加
            if (isSelectingForSimulator) {
                itemCard.addEventListener('click', handleItemCardClick);
            }

            itemList.appendChild(itemCard);
        });
    }

    // ★アイテムカードクリック時の処理 (シミュレータ連携中)
    function handleItemCardClick(event) {
        if (!isSelectingForSimulator) return;
        
        const clickedCard = event.currentTarget;
        const itemId = clickedCard.dataset.itemId;

        // 他のカードの選択状態を解除
        itemList.querySelectorAll('.item-card.selected-for-simulator').forEach(card => {
            card.classList.remove('selected-for-simulator');
        });

        // クリックされたカードを選択状態に
        clickedCard.classList.add('selected-for-simulator');
        temporarilySelectedItem = itemId; // 仮選択IDを更新
        console.log("Temporarily selected item:", itemId);
    }

    // ★フィルター＆レンダリング（OR/AND考慮）
    function filterAndRenderItems() {
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : "";
        
        let filteredItems = allItems.filter(item => {
            // ★部位タグによる絞り込み (シミュレータ連携時)
            if (isSelectingForSimulator && currentSelectingSlot) {
                const requiredSlotTagId = EQUIPMENT_SLOT_TAG_IDS[currentSelectingSlot];
                if (!item.tags || !item.tags.includes(requiredSlotTagId)) {
                    return false; // 必須の部位タグがなければ除外
                }
            }

            const matchesSearchTerm = searchTerm === '' ||
                (item.name && item.name.toLowerCase().includes(searchTerm)) ||
                (item.structured_effects && item.structured_effects.some(eff => {
                     const typeInfo = effectTypesCache.find(et => et.id === eff.type);
                     const typeName = typeInfo ? typeInfo.name : '';
                     const unitText = eff.unit !== 'none' ? eff.unit : '';
                     return `${typeName}${eff.value}${unitText}`.toLowerCase().includes(searchTerm);
                })) ||
                (item.入手手段 && item.入手手段.toLowerCase().includes(searchTerm));

            if (!matchesSearchTerm) return false;

            let matchesCategories = true; 
            if (selectedParentCategoryIds.length > 0 && !isSelectingForSimulator) { // ★連携中はカテゴリ無視
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
            // ★部位タグは selectedTagIds から除外して判定
            const actualSelectedTags = selectedTagIds.filter(tagId => !Object.values(EQUIPMENT_SLOT_TAG_IDS).includes(tagId)); 
            
            if (actualSelectedTags.length > 0) {
                const categoryIdsOfSelectedTags = new Set();
                 actualSelectedTags.forEach(tagId => {
                    const tagObj = allTags.find(t => t.id === tagId);
                    (tagObj?.categoryIds || []).forEach(catId => categoryIdsOfSelectedTags.add(catId));
                });
                let singleChildCategoryId = null;
                let belongsToMultipleChildCategories = false;
                if (categoryIdsOfSelectedTags.size > 0) {
                    let commonChildCategoryIds = [];
                    const firstTagId = actualSelectedTags[0];
                    const firstTagObj = allTags.find(t => t.id === firstTagId);
                    const firstTagChildCategoryIds = (firstTagObj?.categoryIds || []).filter(catId => {
                        const cat = allCategories.find(c => c.id === catId);
                        return cat && cat.parentId; 
                    });
                    if (firstTagChildCategoryIds.length > 0) {
                        commonChildCategoryIds = firstTagChildCategoryIds;
                        for (let i = 1; i < actualSelectedTags.length; i++) {
                            const currentTagId = actualSelectedTags[i];
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
                    matchesTags = actualSelectedTags.some(selTagId => item.tags && item.tags.includes(selTagId));
                } else {
                    matchesTags = actualSelectedTags.every(selTagId => item.tags && item.tags.includes(selTagId));
                }
            }
            
            return matchesTags; 
        });
        renderItems(filteredItems); // アイテムリストをレンダリング（カードにイベントリスナー付与含む）
    }

    // ★フィルターリセット処理を更新
    function resetFilters() {
        // シミュレータ連携中はリセットしない、または別の動作
        if (isSelectingForSimulator) {
            console.log("Cannot reset filters while selecting for simulator.");
            // 必要であれば、検索バーの内容だけリセットするなど
            // if (searchInput) searchInput.value = '';
            // filterAndRenderItems(); 
            return; 
        }

        if (searchInput) searchInput.value = '';
        selectedParentCategoryIds = [];
        selectedTagIds = [];
        
        renderParentCategoryFilters(); 
        renderChildCategoriesAndTags(); 
        filterAndRenderItems(); // アイテムリストも更新
    }
    if (resetFiltersButton) resetFiltersButton.addEventListener('click', resetFilters);
    if (searchInput) searchInput.addEventListener('input', filterAndRenderItems);


    // --- シミュレーター関連関数 ---

    function initializeSimulatorSlots() {
        equipmentSlotsContainer.querySelectorAll('.select-item-button').forEach(button => {
            button.addEventListener('click', startItemSelectionForSlot); // ★新しい関数を呼ぶ
        });
         equipmentSlotsContainer.querySelectorAll('.clear-item-button').forEach(button => {
            button.addEventListener('click', clearEquipmentSlot);
        });
    }

    // ★アイテム選択開始処理
    function startItemSelectionForSlot(event) {
        currentSelectingSlot = event.target.dataset.slot;
        if (!currentSelectingSlot) return;

        const slotTagId = EQUIPMENT_SLOT_TAG_IDS[currentSelectingSlot];
        if (!slotTagId) {
            alert(`部位「${currentSelectingSlot}」に対応するタグIDが設定されていません。`);
            return;
        }

        isSelectingForSimulator = true; // ★連携モード開始
        temporarilySelectedItem = selectedEquipment[currentSelectingSlot]; // 現在の選択を仮選択に

        // 1. シミュレータモーダルを閉じる
        if (simulatorModal) simulatorModal.style.display = 'none';

        // 2. 検索ツールを連携モードに設定
        selectedParentCategoryIds = []; // 親カテゴリ選択解除
        selectedTagIds = [slotTagId];    // 部位タグのみ選択状態にする
        
        // 3. UI更新
        renderParentCategoryFilters(); // 無効化状態で再描画
        renderChildCategoriesAndTags(); // 非表示にする
        filterAndRenderItems();         // 部位タグでアイテムリストを絞り込み表示
        
        // 4. メッセージと決定ボタン表示
        if (searchToolMessage) {
            searchToolMessage.textContent = `「${currentSelectingSlot}」のアイテムを選択し、「決定」ボタンを押してください。`;
            searchToolMessage.style.display = 'block';
        }
        if (confirmSelectionButton) confirmSelectionButton.style.display = 'block';
    }

    // ★選択決定ボタンの処理
    if (confirmSelectionButton) {
        confirmSelectionButton.addEventListener('click', () => {
            if (!currentSelectingSlot || !temporarilySelectedItem) {
                alert("アイテムが選択されていません。");
                return;
            }

            // 装備データを更新
            selectedEquipment[currentSelectingSlot] = temporarilySelectedItem;

            // 連携モード終了
            isSelectingForSimulator = false;
            currentSelectingSlot = null;
            temporarilySelectedItem = null;

            // UIを通常モードに戻す
            if (searchToolMessage) searchToolMessage.style.display = 'none';
            if (confirmSelectionButton) confirmSelectionButton.style.display = 'none';
            
            // 検索ツールのフィルター状態をリセット（または前の状態に戻すか検討）
            selectedTagIds = []; // 部位タグ選択を解除
            renderParentCategoryFilters(); // 有効化して再描画
            renderChildCategoriesAndTags(); // 再表示
            renderItems([]); // アイテムリストはクリア（または全表示）

            // シミュレーターモーダルを再表示
            if (simulatorModal) simulatorModal.style.display = 'flex';
            updateSimulatorSlotDisplay(Object.keys(selectedEquipment).find(key => selectedEquipment[key] === temporarilySelectedItem)); // 更新されたスロットを表示
            calculateAndDisplayTotalEffects(); // 合計効果を更新
        });
    }


    function clearEquipmentSlot(event) { /* 変更なし */ }
    function updateSimulatorSlotDisplay(slotName) { /* 変更なし */ }
    function calculateAndDisplayTotalEffects() { /* 変更なし */ }
    function initializeSimulatorDisplay() { /* 変更なし */ }
    if (resetSimulatorButton) { /* 変更なし */ }
    if (saveImageButton) { /* 変更なし */ }


    // --- モーダル関連 ---
    if (openSimulatorButton) {
        openSimulatorButton.addEventListener('click', () => {
            if (simulatorModal) simulatorModal.style.display = 'flex';
            // モーダルを開いたときに現在の選択状態を表示
            initializeSimulatorDisplay(); 
        });
    }
     document.querySelectorAll('.modal .close-button').forEach(btn => {
        btn.onclick = function() { this.closest('.modal').style.display = "none"; }
    });
    window.onclick = function(event) {
        // アイテム選択モーダル以外をクリックした場合も閉じる（任意）
        // if (event.target == itemSelectionModal) {
        //    itemSelectionModal.style.display = "none";
        // }
         if (event.target == simulatorModal) {
            simulatorModal.style.display = "none";
         }
    }

    // --- 初期データロード実行 ---
    loadData();

}); // End DOMContentLoaded
