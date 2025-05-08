import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import {
    getFirestore, collection, getDocs, query, orderBy, where
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

let EQUIPMENT_SLOT_TAG_IDS = {};

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

    // --- Data Cache ---
    let allItems = [];
    let allCategories = [];
    let allTags = [];
    let effectTypesCache = [];

    // --- Search Tool State ---
    let selectedParentCategoryIds = [];
    let selectedTagIds = []; // 部位タグも含む可能性あり
    let isSelectingForSimulator = false;

    // --- Simulator State ---
    const equipmentSlots = ["服", "顔", "首", "手", "背中", "足"];
    let selectedEquipment = {}; // { "服": "itemId1", "顔": null, ... }
    let currentSelectingSlot = null;
    let temporarilySelectedItem = null;

    // --- Initial Data Load ---
    async function loadData() {
        console.log("Loading data...");
        try {
            const [effectTypesSnapshot, categoriesSnapshot, tagsSnapshot, itemsSnapshot] = await Promise.all([
                getDocs(query(collection(db, 'effect_types'), orderBy('name'))),
                getDocs(query(collection(db, 'categories'), orderBy('name'))),
                getDocs(query(collection(db, 'tags'), orderBy('name'))),
                getDocs(query(collection(db, 'items'), orderBy('name')))
            ]);

            effectTypesCache = effectTypesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("Effect Types loaded:", effectTypesCache.length, effectTypesCache);

            allCategories = categoriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("All Categories loaded:", allCategories.length, allCategories);

            allTags = tagsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("All Tags loaded:", allTags.length, allTags);

            allItems = itemsSnapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
            console.log("Items loaded:", allItems.length, allItems);

            buildEquipmentSlotTagMap();

            initializeSimulatorSlots();
            initializeSimulatorDisplay();
            renderParentCategoryFilters();
            renderChildCategoriesAndTags();
            filterAndRenderItems();
            console.log("Data loading and initial setup complete.");

        } catch (error) {
            console.error("Error loading data:", error);
            if (itemList) itemList.innerHTML = `<p style="color: red;">データの読み込みに失敗しました。エラーの詳細はコンソールを確認してください。</p>`;
            if (itemCountDisplay) itemCountDisplay.textContent = 'エラー';
            if (totalEffectsDisplay) totalEffectsDisplay.innerHTML = '<p style="color: red;">データ読込エラー</p>';
        }
    }

    function buildEquipmentSlotTagMap() {
        EQUIPMENT_SLOT_TAG_IDS = {};
        if (!allTags || allTags.length === 0) {
            console.error("Tags data is not loaded or empty. Cannot build equipment slot tag map.");
            equipmentSlots.forEach(slotName => {
                EQUIPMENT_SLOT_TAG_IDS[slotName] = null;
            });
            // alert("タグデータの読み込みに失敗したため、装備部位によるアイテム絞り込みが正しく動作しない可能性があります。");
            return;
        }
        equipmentSlots.forEach(slotName => {
            const foundTag = allTags.find(tag => tag.name === slotName);
            if (foundTag) {
                EQUIPMENT_SLOT_TAG_IDS[slotName] = foundTag.id;
            } else {
                console.warn(`部位タグ「${slotName}」がFirestoreのtagsコレクションに見つかりません。この部位のアイテム選択が正しく機能しない可能性があります。`);
                EQUIPMENT_SLOT_TAG_IDS[slotName] = null;
            }
        });
        console.log("Dynamically built EQUIPMENT_SLOT_TAG_IDS:", EQUIPMENT_SLOT_TAG_IDS);
    }

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
            button.classList.toggle('disabled', isSelectingForSimulator);
            button.textContent = category.name;
            button.dataset.categoryId = category.id;
            button.classList.toggle('active', selectedParentCategoryIds.includes(category.id));
            button.addEventListener('click', () => {
                if (!isSelectingForSimulator) {
                    toggleParentCategory(button, category.id);
                }
            });
            parentCategoryFiltersContainer.appendChild(button);
        });

        if (searchControlsElement) {
            searchControlsElement.classList.toggle('selecting-mode', isSelectingForSimulator);
        }
    }

    function toggleParentCategory(button, categoryId) {
        button.classList.toggle('active');
        const index = selectedParentCategoryIds.indexOf(categoryId);
        if (index > -1) {
            selectedParentCategoryIds.splice(index, 1);
        } else {
            selectedParentCategoryIds.push(categoryId);
        }
        selectedTagIds = []; // 親カテゴリ変更時はタグ選択をリセット
        renderChildCategoriesAndTags();
        filterAndRenderItems();
    }

    function renderChildCategoriesAndTags() {
        if (!childCategoriesAndTagsContainer) return;
        childCategoriesAndTagsContainer.innerHTML = '';
        childCategoriesAndTagsContainer.style.display = isSelectingForSimulator ? 'none' : 'block';

        if (isSelectingForSimulator || selectedParentCategoryIds.length === 0) {
            if (!isSelectingForSimulator && selectedParentCategoryIds.length === 0) {
                 childCategoriesAndTagsContainer.innerHTML = '<p style="color: #777; margin-top: 10px;">親カテゴリを選択すると、関連する子カテゴリとタグが表示されます。</p>';
            }
            return;
        }

        let hasContentToShow = false;
        const validSlotTagIds = Object.values(EQUIPMENT_SLOT_TAG_IDS).filter(id => id !== null);

        selectedParentCategoryIds.forEach(parentId => {
            const parentCat = allCategories.find(c => c.id === parentId);
            if (!parentCat) return;

            const childCategoriesOfParent = allCategories.filter(cat => cat.parentId === parentId);

            if (childCategoriesOfParent.length > 0) {
                hasContentToShow = true;
                childCategoriesOfParent.forEach(childCat => {
                    const childCatSection = document.createElement('div');
                    childCatSection.classList.add('child-category-section');

                    const childCatHeader = document.createElement('h4');
                    const searchModeText = childCat.tagSearchMode === 'OR' ? '(OR検索)' : '(AND検索)';
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
                            const isSlotTag = validSlotTagIds.includes(tag.id);

                            tagButton.classList.toggle('disabled', isSelectingForSimulator && isSlotTag);
                            tagButton.classList.toggle('active', selectedTagIds.includes(tag.id) && !(isSelectingForSimulator && isSlotTag));

                            tagButton.addEventListener('click', () => {
                                if (!(isSelectingForSimulator && isSlotTag)) {
                                    toggleTag(tagButton, tag.id);
                                }
                            });
                            tagsContainer.appendChild(tagButton);
                        });
                        childCatSection.appendChild(tagsContainer);
                    } else {
                        childCatSection.appendChild(Object.assign(document.createElement('p'), {
                            className: 'no-tags-message',
                            textContent: 'この子カテゴリに属するタグはありません。'
                        }));
                    }
                    childCategoriesAndTagsContainer.appendChild(childCatSection);
                });
            }
        });

        if (!hasContentToShow && selectedParentCategoryIds.length > 0) {
            childCategoriesAndTagsContainer.innerHTML = '<p style="color: #777; margin-top: 10px;">選択された親カテゴリには表示可能な子カテゴリがありません。</p>';
        }
    }

    function toggleTag(tagButton, tagId) {
        tagButton.classList.toggle('active');
        const index = selectedTagIds.indexOf(tagId);
        if (index > -1) {
            selectedTagIds.splice(index, 1);
        } else {
            selectedTagIds.push(tagId);
        }
        filterAndRenderItems();
    }

    function renderItems(itemsToRender) {
        if (!itemList) return;
        itemList.innerHTML = '';

        if (itemCountDisplay) {
            const countText = isSelectingForSimulator ?
                `該当部位のアイテム: ${itemsToRender.length} 件` :
                `${itemsToRender.length} 件のアイテムが見つかりました。`;
            itemCountDisplay.textContent = countText;
        }

        if (itemsToRender.length === 0) {
            itemList.innerHTML = '<p>該当するアイテムは見つかりませんでした。</p>';
            return;
        }

        const validSlotTagIds = Object.values(EQUIPMENT_SLOT_TAG_IDS).filter(id => id !== null);

        itemsToRender.forEach(item => {
            const itemCard = document.createElement('div');
            itemCard.classList.add('item-card');
            itemCard.classList.toggle('selectable', isSelectingForSimulator);
            if (isSelectingForSimulator && temporarilySelectedItem === item.docId) {
                itemCard.classList.add('selected-for-simulator');
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
                const displayableTags = item.tags.map(tagId => {
                    const tagObj = allTags.find(t => t.id === tagId);
                    if (!tagObj || validSlotTagIds.includes(tagId)) return null; // 部位タグは表示しない
                    return `<span>${tagObj.name}</span>`;
                }).filter(Boolean);

                if (displayableTags.length > 0) {
                    tagsHtml = `<div class="tags">タグ: ${displayableTags.join(' ')}</div>`;
                }
            }

            let structuredEffectsHtml = '';
            if (item.structured_effects && item.structured_effects.length > 0) {
                structuredEffectsHtml = `<div class="structured-effects"><strong>効果詳細:</strong><ul>`;
                item.structured_effects.forEach(eff => {
                    const effectType = effectTypesCache.find(et => et.id === eff.type);
                    const typeName = effectType ? effectType.name : `不明(${eff.type})`;
                    const unitText = (eff.unit && eff.unit !== 'none') ? eff.unit : '';
                    structuredEffectsHtml += `<li>${typeName}: ${eff.value}${unitText}</li>`;
                });
                structuredEffectsHtml += `</ul></div>`;
            } else {
                structuredEffectsHtml = `<p><strong>効果:</strong> なし</p>`;
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
    }

    function filterAndRenderItems() {
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : "";
        const validSlotTagIds = Object.values(EQUIPMENT_SLOT_TAG_IDS).filter(id => id !== null);

        let filteredItems = allItems.filter(item => {
            // 1. 部位タグによる絞り込み (シミュレーター選択モード時)
            if (isSelectingForSimulator && currentSelectingSlot) {
                const requiredSlotTagId = EQUIPMENT_SLOT_TAG_IDS[currentSelectingSlot];
                if (requiredSlotTagId && (!item.tags || !item.tags.includes(requiredSlotTagId))) {
                    return false;
                }
            }

            // 2. 検索語による絞り込み
            if (searchTerm) {
                const nameMatch = item.name && item.name.toLowerCase().includes(searchTerm);
                const sourceMatch = item.入手手段 && item.入手手段.toLowerCase().includes(searchTerm);
                const effectMatch = item.structured_effects && item.structured_effects.some(eff => {
                    const typeInfo = effectTypesCache.find(et => et.id === eff.type);
                    const typeName = typeInfo ? typeInfo.name.toLowerCase() : '';
                    const unitText = (eff.unit && eff.unit !== 'none') ? eff.unit.toLowerCase() : '';
                    const valueText = String(eff.value).toLowerCase();
                    return `${typeName}${valueText}${unitText}`.includes(searchTerm) || // 効果名+値+単位
                           typeName.includes(searchTerm) || // 効果名のみ
                           `${valueText}${unitText}`.includes(searchTerm); // 値+単位
                });
                if (!nameMatch && !sourceMatch && !effectMatch) return false;
            }

            // 3. 親カテゴリによる絞り込み (通常検索モード時)
            if (!isSelectingForSimulator && selectedParentCategoryIds.length > 0) {
                const itemChildCategoryIds = (item.tags || []).reduce((acc, tagId) => {
                    const tag = allTags.find(t => t.id === tagId);
                    if (tag && tag.categoryIds) {
                        tag.categoryIds.forEach(catId => {
                            const category = allCategories.find(c => c.id === catId);
                            if (category && category.parentId) { // Ensure it's a child category
                                acc.add(catId);
                            }
                        });
                    }
                    return acc;
                }, new Set());

                const matchesAnySelectedParent = selectedParentCategoryIds.some(selectedParentId => {
                    return Array.from(itemChildCategoryIds).some(itemCatId => {
                        const category = allCategories.find(c => c.id === itemCatId);
                        return category && category.parentId === selectedParentId;
                    });
                });
                if (!matchesAnySelectedParent) return false;
            }


            // 4. タグによる絞り込み (通常検索モード時、部位タグを除く)
            if (!isSelectingForSimulator && selectedTagIds.length > 0) {
                const nonSlotSelectedTagIds = selectedTagIds.filter(tagId => !validSlotTagIds.includes(tagId));
                if (nonSlotSelectedTagIds.length > 0) {
                    // Determine search mode (AND/OR) based on the categories of selected tags
                    let effectiveSearchMode = 'AND'; // Default
                    const categoriesOfSelectedTags = new Map(); // childCategoryId -> { mode: 'AND'/'OR', tags: [tagId1, tagId2] }

                    nonSlotSelectedTagIds.forEach(tagId => {
                        const tag = allTags.find(t => t.id === tagId);
                        if (tag && tag.categoryIds) {
                            tag.categoryIds.forEach(catId => {
                                const category = allCategories.find(c => c.id === catId);
                                if (category && category.parentId) { // Is a child category
                                    if (!categoriesOfSelectedTags.has(catId)) {
                                        categoriesOfSelectedTags.set(catId, {
                                            mode: category.tagSearchMode || 'AND',
                                            tags: []
                                        });
                                    }
                                    categoriesOfSelectedTags.get(catId).tags.push(tagId);
                                }
                            });
                        }
                    });

                    // If all selected tags belong to a single child category with OR mode
                    if (categoriesOfSelectedTags.size === 1) {
                        const [catData] = categoriesOfSelectedTags.values();
                        if (catData.mode === 'OR' && catData.tags.length === nonSlotSelectedTagIds.length) {
                            effectiveSearchMode = 'OR';
                        }
                    } else if (categoriesOfSelectedTags.size > 1) {
                        // If tags span multiple child categories, generally treat as AND across those categories' requirements,
                        // or if any child category involved has AND, then overall tends to AND.
                        // This simplified logic will use AND if tags are from different groups or complex relations.
                        // More sophisticated logic might be needed for precise cross-category OR.
                    }


                    if (effectiveSearchMode === 'OR') {
                        if (!nonSlotSelectedTagIds.some(tagId => item.tags && item.tags.includes(tagId))) {
                            return false;
                        }
                    } else { // AND
                        if (!nonSlotSelectedTagIds.every(tagId => item.tags && item.tags.includes(tagId))) {
                            return false;
                        }
                    }
                }
            }
            return true;
        });
        renderItems(filteredItems);
    }


    if (resetFiltersButton) resetFiltersButton.addEventListener('click', resetFilters);
    if (searchInput) searchInput.addEventListener('input', filterAndRenderItems);

    function resetFilters() {
        if (isSelectingForSimulator) return;
        if (searchInput) searchInput.value = '';
        selectedParentCategoryIds = [];
        selectedTagIds = [];
        renderParentCategoryFilters();
        renderChildCategoriesAndTags();
        filterAndRenderItems();
    }

    function initializeSimulatorSlots() {
        equipmentSlotsContainer.querySelectorAll('.select-item-button').forEach(button => {
            button.removeEventListener('click', startItemSelectionForSlot); // Clean up old
            button.addEventListener('click', startItemSelectionForSlot);
        });
        equipmentSlotsContainer.querySelectorAll('.clear-item-button').forEach(button => {
            button.removeEventListener('click', clearEquipmentSlot); // Clean up old
            button.addEventListener('click', clearEquipmentSlot);
        });
    }

    function startItemSelectionForSlot(event) {
        currentSelectingSlot = event.target.dataset.slot;
        if (!currentSelectingSlot) return;

        const slotTagId = EQUIPMENT_SLOT_TAG_IDS[currentSelectingSlot];
        if (slotTagId === undefined || slotTagId === null) {
            alert(`部位「${currentSelectingSlot}」に対応するタグIDが設定されていません。管理画面でタグを確認・設定してください。`);
            return;
        }

        isSelectingForSimulator = true;
        temporarilySelectedItem = selectedEquipment[currentSelectingSlot] || null;

        if (simulatorModal) simulatorModal.style.display = 'none';

        // Reset filters for slot selection mode
        selectedParentCategoryIds = [];
        selectedTagIds = [slotTagId]; // Only the slot tag is active for filtering
        if (searchInput) searchInput.value = '';

        renderParentCategoryFilters(); // Will disable parent category buttons
        renderChildCategoriesAndTags(); // Will hide child/tag filters
        filterAndRenderItems(); // Filter by slot tag and search term

        if (searchToolMessage) {
            searchToolMessage.textContent = `「${currentSelectingSlot}」のアイテムを選択し、「決定」ボタンを押してください。`;
            searchToolMessage.style.display = 'block';
        }
        if (confirmSelectionButton) confirmSelectionButton.style.display = 'block';
        if (searchToolMessage.offsetParent !== null) { // Check if visible
            window.scrollTo({ top: searchToolMessage.offsetTop - 20, behavior: 'smooth' });
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' }); // Fallback scroll to top
        }
    }

    if (confirmSelectionButton) {
        confirmSelectionButton.addEventListener('click', () => {
            if (!currentSelectingSlot) {
                cancelItemSelection(); // Should not happen if UI logic is correct
                return;
            }
            selectedEquipment[currentSelectingSlot] = temporarilySelectedItem;
            const previouslySelectedSlot = currentSelectingSlot;

            // Reset selection state
            isSelectingForSimulator = false;
            currentSelectingSlot = null;
            temporarilySelectedItem = null;

            if (searchToolMessage) searchToolMessage.style.display = 'none';
            if (confirmSelectionButton) confirmSelectionButton.style.display = 'none';

            // Reset main search filters to their previous state or clear them
            selectedParentCategoryIds = []; // Or restore previous state if desired
            selectedTagIds = [];          // Or restore previous state
            if (searchInput) searchInput.value = '';

            renderParentCategoryFilters();
            renderChildCategoriesAndTags();
            filterAndRenderItems(); // Render with cleared/restored filters

            if (simulatorModal) simulatorModal.style.display = 'flex';
            updateSimulatorSlotDisplay(previouslySelectedSlot);
            calculateAndDisplayTotalEffects();
        });
    }

    function clearEquipmentSlot(event) {
        const slotName = event.target.dataset.slot;
        if (!slotName) return;
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
                clearButton.style.display = 'inline-block';
                selectButton.textContent = '変更';
            } else { // Item ID exists but item not found (data inconsistency?)
                imgElement.src = './images/placeholder_slot.png';
                imgElement.alt = slotName;
                nameElement.textContent = 'エラー(データ不整合)';
                clearButton.style.display = 'none';
                selectButton.textContent = '選択';
            }
        } else { // No item selected for this slot
            imgElement.src = './images/placeholder_slot.png';
            imgElement.alt = slotName;
            nameElement.textContent = '未選択';
            clearButton.style.display = 'none';
            selectButton.textContent = '選択';
        }
    }

    function calculateAndDisplayTotalEffects() {
        const totalEffectsMap = new Map(); // key: effectTypeId_unit, value: { typeId, typeName, value, unit, calculationMethod, valuesForMax[] }

        Object.values(selectedEquipment).forEach(itemId => {
            if (!itemId) return;
            const item = allItems.find(i => i.docId === itemId);
            if (!item || !item.structured_effects) return;

            item.structured_effects.forEach(effect => {
                const { type: effectTypeId, value, unit } = effect;
                if (!effectTypeId || typeof value !== 'number') return;

                const effectTypeInfo = effectTypesCache.find(et => et.id === effectTypeId);
                if (!effectTypeInfo) {
                    console.warn(`Unknown effect type ID: ${effectTypeId} for item ID: ${itemId}`);
                    return; // Skip if effect type definition is missing
                }

                const calculationMethod = effectTypeInfo.calculationMethod || 'sum'; // Default to sum
                const currentUnit = unit || 'none'; // Default unit if not specified
                const effectKey = `${effectTypeId}_${currentUnit}`;

                if (!totalEffectsMap.has(effectKey)) {
                    totalEffectsMap.set(effectKey, {
                        typeId: effectTypeId,
                        typeName: effectTypeInfo.name,
                        value: 0, // For 'sum', this accumulates. For 'max', this will be set at the end.
                        unit: currentUnit,
                        calculationMethod: calculationMethod,
                        valuesForMax: [] // Only used if calculationMethod is 'max'
                    });
                }

                const currentEffectData = totalEffectsMap.get(effectKey);
                if (calculationMethod === 'max') {
                    currentEffectData.valuesForMax.push(value);
                } else { // 'sum'
                    currentEffectData.value += value;
                }
            });
        });

        // Finalize values for 'max' calculation method
        totalEffectsMap.forEach(effectData => {
            if (effectData.calculationMethod === 'max' && effectData.valuesForMax.length > 0) {
                effectData.value = Math.max(...effectData.valuesForMax);
            }
        });

        if (totalEffectsMap.size === 0) {
            totalEffectsDisplay.innerHTML = '<p>効果はありません。</p>';
        } else {
            let html = '<ul>';
            totalEffectsMap.forEach(effData => {
                const unitText = (effData.unit && effData.unit !== 'none') ? effData.unit : '';
                // Round to avoid floating point inaccuracies for display
                const displayValue = Math.round(effData.value * 1000) / 1000;
                html += `<li>${effData.typeName}: ${displayValue}${unitText}</li>`;
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

    if (resetSimulatorButton) {
        resetSimulatorButton.addEventListener('click', () => {
            equipmentSlots.forEach(slotName => selectedEquipment[slotName] = null);
            initializeSimulatorDisplay();
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
                    itemHtml += item ?
                        `<img src="${item.image || './images/placeholder_item.png'}" alt="" class="export-item-image"> <span>${item.name || '(名称未設定)'}</span>` :
                        '<span>エラー</span>';
                } else {
                    itemHtml += '<span>なし</span>';
                }
                itemHtml += '</div>';
                exportSlots.innerHTML += itemHtml;
            });
            exportEffects.innerHTML = totalEffectsDisplay.innerHTML;

            try {
                await new Promise(resolve => setTimeout(resolve, 150)); // Ensure rendering
                const canvas = await html2canvas(imageExportArea, { useCORS: true, backgroundColor: '#ffffff' });
                const link = document.createElement('a');
                link.download = '装備構成.png';
                link.href = canvas.toDataURL('image/png');
                link.click();
            } catch (error) {
                console.error("Image generation error:", error);
                alert("画像の生成に失敗しました。コンソールログを確認してください。");
            }
        });
    }

    if (openSimulatorButton) {
        openSimulatorButton.addEventListener('click', () => {
            if (isSelectingForSimulator) return; // Avoid opening while in selection mode
            if (simulatorModal) simulatorModal.style.display = 'flex';
            initializeSimulatorDisplay(); // Refresh display
        });
    }

    document.querySelectorAll('.modal .close-button').forEach(btn => {
        btn.onclick = function() {
            const modal = this.closest('.modal');
            modal.style.display = "none";
            if (modal === simulatorModal && isSelectingForSimulator) {
                cancelItemSelection();
            }
        }
    });

    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = "none";
            if (event.target === simulatorModal && isSelectingForSimulator) {
                cancelItemSelection();
            }
        }
    }

    function cancelItemSelection() {
        isSelectingForSimulator = false;
        currentSelectingSlot = null;
        temporarilySelectedItem = null;

        if (searchToolMessage) searchToolMessage.style.display = 'none';
        if (confirmSelectionButton) confirmSelectionButton.style.display = 'none';

        // Restore general search filters or clear them
        // For simplicity, let's clear them. A more advanced version might restore previous state.
        selectedParentCategoryIds = [];
        selectedTagIds = [];
        if (searchInput) searchInput.value = '';

        renderParentCategoryFilters();
        renderChildCategoriesAndTags();
        filterAndRenderItems(); // Re-render with general (cleared) filters
    }

    loadData();
});
