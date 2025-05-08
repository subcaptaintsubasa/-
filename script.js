import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import {
    getFirestore, collection, getDocs, query, orderBy, where
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// ★部位名と対応するタグIDのマッピング -> 動的に生成するため削除または空にする
// const EQUIPMENT_SLOT_TAG_IDS = { ... }; 
let EQUIPMENT_SLOT_TAG_IDS = {}; // 空のオブジェクトとして初期化

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
    const openSimulatorButton = document.getElementById('openSimulatorButton'); 
    const simulatorModal = document.getElementById('simulatorModal'); 
    const confirmSelectionButton = document.getElementById('confirmSelectionButton'); 
    const searchToolMessage = document.getElementById('searchToolMessage'); 
    const searchControlsElement = document.querySelector('.search-controls'); 

    // Simulator DOM
    const equipmentSlotsContainer = document.querySelector('.equipment-slots');
    const totalEffectsDisplay = document.getElementById('totalEffectsDisplay');
    const saveImageButton = document.getElementById('saveImageButton');
    const resetSimulatorButton = document.getElementById('resetSimulatorButton');
    const imageExportArea = document.getElementById('imageExportArea'); 
    const exportSlots = document.getElementById('exportSlots');
    const exportEffects = document.getElementById('exportEffects');
    
    // Item Selection Modal DOM
    const itemSelectionModal = document.getElementById('itemSelectionModal');
    const itemSelectModalTitle = document.getElementById('itemSelectModalTitle');
    const itemSelectModalSearch = document.getElementById('itemSelectModalSearch');
    const itemSelectModalList = document.getElementById('itemSelectModalList');

    // --- Data Cache ---
    let allItems = [];
    let allCategories = []; 
    let allTags = [];       
    let effectTypesCache = []; 
    
    // --- Search Tool State ---
    let selectedParentCategoryIds = [];
    let selectedTagIds = [];
    let isSelectingForSimulator = false; 

    // --- Simulator State ---
    const equipmentSlots = ["服", "顔", "首", "手", "背中", "足"]; 
    let selectedEquipment = {}; 
    let currentSelectingSlot = null; 
    let temporarilySelectedItem = null; 

    // --- Initial Data Load ---
    async function loadData() {
        try {
            // Effect Types, Categories, Tags, Items を並行 or 順次ロード
            const [effectTypesSnapshot, categoriesSnapshot, tagsSnapshot, itemsSnapshot] = await Promise.all([
                getDocs(query(collection(db, 'effect_types'), orderBy('name'))),
                getDocs(query(collection(db, 'categories'), orderBy('name'))),
                getDocs(query(collection(db, 'tags'), orderBy('name'))),
                getDocs(query(collection(db, 'items'), orderBy('name')))
            ]);

            effectTypesCache = effectTypesSnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
            console.log("User site: Effect Types loaded:", effectTypesCache);

            allCategories = categoriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("User site: All Categories loaded:", allCategories);

            allTags = tagsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("User site: All Tags loaded:", allTags);
            
            allItems = itemsSnapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
            console.log("User site: Items loaded:", allItems);

            // ★部位タグIDのマッピングを動的に生成
            buildEquipmentSlotTagMap(); 

            // --- UI Initialization ---
            initializeSimulatorSlots(); 
            initializeSimulatorDisplay(); 
            renderParentCategoryFilters();
            renderChildCategoriesAndTags(); 
            filterAndRenderItems(); // 初期フィルターでアイテムリスト描画

        } catch (error) {
            console.error("Error loading data:", error);
            if (itemList) itemList.innerHTML = `<p style="color: red;">データの読み込みに失敗しました。</p>`;
            if (itemCountDisplay) itemCountDisplay.textContent = 'エラー';
            if (totalEffectsDisplay) totalEffectsDisplay.innerHTML = '<p style="color: red;">データ読込エラー</p>';
        }
    }

    // ★新規: 部位タグIDのマッピングを動的に生成する関数
    function buildEquipmentSlotTagMap() {
        EQUIPMENT_SLOT_TAG_IDS = {}; // 既存のマッピングをクリア
        equipmentSlots.forEach(slotName => {
            const foundTag = allTags.find(tag => tag.name === slotName);
            if (foundTag) {
                EQUIPMENT_SLOT_TAG_IDS[slotName] = foundTag.id;
            } else {
                console.warn(`部位タグ「${slotName}」がFirestoreのtagsコレクションに見つかりません。`);
                // IDが見つからない場合、nullなどを設定しておくか、エラーハンドリングを検討
                EQUIPMENT_SLOT_TAG_IDS[slotName] = null; 
            }
        });
        console.log("Dynamically built EQUIPMENT_SLOT_TAG_IDS:", EQUIPMENT_SLOT_TAG_IDS);
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
                if (!isSelectingForSimulator) { 
                    toggleParentCategory(button, category.id);
                }
            });
            parentCategoryFiltersContainer.appendChild(button);
        });
        if (searchControlsElement) { // クラス付け替え
            if (isSelectingForSimulator) {
                searchControlsElement.classList.add('selecting-mode');
            } else {
                searchControlsElement.classList.remove('selecting-mode');
            }
        }
    }

    function toggleParentCategory(button, categoryId) {
        if (isSelectingForSimulator) return; 
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
                            
                            const isSlotTag = Object.values(EQUIPMENT_SLOT_TAG_IDS).includes(tag.id);
                            if (isSelectingForSimulator && isSlotTag) {
                                tagButton.classList.add('disabled'); 
                            } else {
                                tagButton.classList.remove('disabled');
                                if (selectedTagIds.includes(tag.id)) {
                                    tagButton.classList.add('active');
                                }
                                tagButton.addEventListener('click', () => {
                                     if (!isSelectingForSimulator || !isSlotTag) { 
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
    
    function renderItems(itemsToRender) {
        if (!itemList) return;
        itemList.innerHTML = ''; 
        
        if (itemCountDisplay) {
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
            if (isSelectingForSimulator) {
                itemCard.classList.add('selectable');
                if (temporarilySelectedItem === item.docId) {
                    itemCard.classList.add('selected-for-simulator');
                }
            }
            itemCard.dataset.itemId = item.docId; 

            const nameDisplay = item.name || '名称未設定';
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
                    if (tagObj && Object.values(EQUIPMENT_SLOT_TAG_IDS).includes(tagId)) return null; 
                    return `<span>${tagObj ? tagObj.name : '不明'}</span>`;
                }).filter(Boolean).join(' ')}</div>`;
                 if (tagsHtml === '<div class="tags">タグ: </div>') tagsHtml = '';
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
            
            if (isSelectingForSimulator) {
                itemCard.addEventListener('click', handleItemCardClick);
            }

            itemList.appendChild(itemCard);
        });
    }

    function handleItemCardClick(event) {
        if (!isSelectingForSimulator) return;
        
        const clickedCard = event.currentTarget;
        const itemId = clickedCard.dataset.itemId;

        itemList.querySelectorAll('.item-card.selected-for-simulator').forEach(card => {
            card.classList.remove('selected-for-simulator');
        });

        clickedCard.classList.add('selected-for-simulator');
        temporarilySelectedItem = itemId; 
        console.log("Temporarily selected item:", itemId);
    }

    function filterAndRenderItems() {
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : "";
        
        let filteredItems = allItems.filter(item => {
            if (isSelectingForSimulator && currentSelectingSlot) {
                const requiredSlotTagId = EQUIPMENT_SLOT_TAG_IDS[currentSelectingSlot];
                // 部位タグIDが見つからない場合も除外
                if (!requiredSlotTagId || !item.tags || !item.tags.includes(requiredSlotTagId)) { 
                    return false; 
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
            if (selectedParentCategoryIds.length > 0 && !isSelectingForSimulator) { 
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
        renderItems(filteredItems); 
    }

    function resetFilters() {
        if (isSelectingForSimulator) {
            console.log("Cannot reset filters while selecting for simulator.");
            return; 
        }
        if (searchInput) searchInput.value = '';
        selectedParentCategoryIds = [];
        selectedTagIds = [];
        renderParentCategoryFilters(); 
        renderChildCategoriesAndTags(); 
        filterAndRenderItems(); 
    }
    if (resetFiltersButton) resetFiltersButton.addEventListener('click', resetFilters);
    if (searchInput) searchInput.addEventListener('input', filterAndRenderItems);


    // --- Simulator Functions ---

    function initializeSimulatorSlots() {
        equipmentSlotsContainer.querySelectorAll('.select-item-button').forEach(button => {
            button.removeEventListener('click', startItemSelectionForSlot); // 既存リスナー削除
            button.addEventListener('click', startItemSelectionForSlot); 
        });
         equipmentSlotsContainer.querySelectorAll('.clear-item-button').forEach(button => {
             button.removeEventListener('click', clearEquipmentSlot); // 既存リスナー削除
            button.addEventListener('click', clearEquipmentSlot);
        });
    }

    function startItemSelectionForSlot(event) {
        currentSelectingSlot = event.target.dataset.slot;
        if (!currentSelectingSlot) return;

        const slotTagId = EQUIPMENT_SLOT_TAG_IDS[currentSelectingSlot];
        // ★ IDが見つからない、またはプレースホルダーのままの場合のエラー処理を強化
        if (!slotTagId || slotTagId.startsWith('YOUR_')) { 
            alert(`部位「${currentSelectingSlot}」に対応するタグIDが script.js 内で正しく設定されていないか、tagsコレクションに見つかりません。`);
            return;
        }

        isSelectingForSimulator = true; 
        temporarilySelectedItem = selectedEquipment[currentSelectingSlot] || null; 

        if (simulatorModal) simulatorModal.style.display = 'none';

        selectedParentCategoryIds = []; 
        selectedTagIds = [slotTagId];    
        
        if(searchInput) searchInput.value = ''; 

        renderParentCategoryFilters(); 
        renderChildCategoriesAndTags(); 
        filterAndRenderItems();         
        
        if (searchToolMessage) {
            searchToolMessage.textContent = `「${currentSelectingSlot}」のアイテムを選択し、「決定」ボタンを押してください。`;
            searchToolMessage.style.display = 'block';
        }
        if (confirmSelectionButton) confirmSelectionButton.style.display = 'block';
        window.scrollTo({ top: searchToolMessage.offsetTop - 20, behavior: 'smooth' }); 
    }
    
    if (confirmSelectionButton) {
        confirmSelectionButton.addEventListener('click', () => {
            if (!currentSelectingSlot) { 
                console.error("No slot is currently being selected.");
                cancelItemSelection(); 
                return;
            }
            // ★ アイテム未選択でも決定できるように変更（解除の場合）
            // if (!temporarilySelectedItem) {
            //    alert("アイテムが選択されていません。リストからアイテムをクリックしてください。");
            //    return;
            // }

            selectedEquipment[currentSelectingSlot] = temporarilySelectedItem; // null の場合もある

            const previouslySelectedSlot = currentSelectingSlot; 

            isSelectingForSimulator = false;
            currentSelectingSlot = null;
            temporarilySelectedItem = null;

            if (searchToolMessage) searchToolMessage.style.display = 'none';
            if (confirmSelectionButton) confirmSelectionButton.style.display = 'none';
            
            selectedTagIds = []; 
            renderParentCategoryFilters(); 
            renderChildCategoriesAndTags(); 
            renderItems([]); // アイテムリストクリア

            if (simulatorModal) simulatorModal.style.display = 'flex';
            updateSimulatorSlotDisplay(previouslySelectedSlot); 
            calculateAndDisplayTotalEffects(); 
        });
    }

    function clearEquipmentSlot(event) {
         const slotName = event.target.dataset.slot;
         if(!slotName) return;
         selectedEquipment[slotName] = null; 
         updateSimulatorSlotDisplay(slotName); 
         calculateAndDisplayTotalEffects(); 
    }

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
                if(clearButton) clearButton.style.display = 'inline-block'; 
                if(selectButton) selectButton.textContent = '変更'; 
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
             if(clearButton) clearButton.style.display = 'none'; 
             if(selectButton) selectButton.textContent = '選択'; 
        }
    }
    
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

    function initializeSimulatorDisplay() {
        equipmentSlots.forEach(slotName => {
            updateSimulatorSlotDisplay(slotName); 
        });
        calculateAndDisplayTotalEffects(); 
    }

    if(resetSimulatorButton) {
        resetSimulatorButton.addEventListener('click', () => {
             equipmentSlots.forEach(slotName => {
                 selectedEquipment[slotName] = null; 
                 updateSimulatorSlotDisplay(slotName); 
             });
            calculateAndDisplayTotalEffects(); 
            console.log("Simulator reset.");
        });
    }

    if (saveImageButton) {
        saveImageButton.addEventListener('click', async () => {
            exportSlots.innerHTML = ''; 
            equipmentSlots.forEach(slotName => {
                const itemId = selectedEquipment[slotName];
                let itemHtml = `<div class="export-slot-item"><strong>${slotName}:</strong> `; 
                if (itemId) {
                    const item = allItems.find(i => i.docId === itemId);
                    if (item) {
                         const imgSrc = item.image || './images/placeholder_item.png'; 
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
            exportEffects.innerHTML = totalEffectsDisplay.innerHTML; 

            try {
                const canvasOptions = {
                    useCORS: true, 
                    allowTaint: true,
                    backgroundColor: '#ffffff' 
                };
                console.log("Generating image from:", imageExportArea);
                // 少し待機してから実行（レンダリングが追いつくように）
                await new Promise(resolve => setTimeout(resolve, 100)); 
                const canvas = await html2canvas(imageExportArea, canvasOptions); 
                
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


    // --- Modal & Init ---
    if (openSimulatorButton) {
        openSimulatorButton.addEventListener('click', () => {
            if (isSelectingForSimulator) return; 
            if (simulatorModal) simulatorModal.style.display = 'flex';
            initializeSimulatorDisplay(); 
        });
    }
     document.querySelectorAll('.modal .close-button').forEach(btn => {
        btn.onclick = function() { 
            const modal = this.closest('.modal');
            modal.style.display = "none"; 
            if (modal === itemSelectionModal && isSelectingForSimulator) {
                 cancelItemSelection();
            }
            if (modal === simulatorModal && isSelectingForSimulator) {
                 cancelItemSelection();
            }
        }
    });
    window.onclick = function(event) {
         if (event.target == simulatorModal) {
            simulatorModal.style.display = "none";
             if (isSelectingForSimulator) { cancelItemSelection(); } 
         }
          if (event.target == itemSelectionModal) { 
             itemSelectionModal.style.display = "none";
             if (isSelectingForSimulator) { cancelItemSelection(); } 
         }
    }

    function cancelItemSelection() {
         console.log("Item selection cancelled.");
         isSelectingForSimulator = false;
         currentSelectingSlot = null;
         temporarilySelectedItem = null;

         if (searchToolMessage) searchToolMessage.style.display = 'none';
         if (confirmSelectionButton) confirmSelectionButton.style.display = 'none';
         
         selectedTagIds = []; 
         renderParentCategoryFilters(); 
         renderChildCategoriesAndTags(); 
         // ★アイテムリストは連携前の状態に戻すか、クリアするか。ここではクリア
         renderItems([]); 
         if (itemCountDisplay) itemCountDisplay.textContent = ''; // 件数表示もクリア

         // シミュレーターモーダルが開いていれば再表示（閉じられたのがアイテム選択モーダルだった場合）
         // ただし、ユーザーがシミュレータモーダル自体をクリックして閉じた場合もあるので、安易に再表示しない方が良いかも
         // if (simulatorModal && simulatorModal.style.display === 'none') {
         //     simulatorModal.style.display = 'flex';
         // }
    }

    if (itemSelectModalSearch) {
        itemSelectModalSearch.addEventListener('input', populateItemSelectionModalList);
    }

    // --- Initial Data Load Trigger ---
    loadData();

}); // End DOMContentLoaded
