import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import {
    getFirestore, collection, getDocs, query, orderBy, where
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

let EQUIPMENT_SLOT_TAG_IDS = {};
const SIMULATOR_PARENT_CATEGORY_NAME = "装備";
const SIMULATOR_EFFECT_CHILD_CATEGORY_NAME = "効果";


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
    let selectedTagIds = [];
    let isSelectingForSimulator = false;

    // --- Simulator State ---
    const equipmentSlots = ["服", "顔", "首", "腕", "背中", "足"];
    let selectedEquipment = {};
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
            console.log("Effect Types loaded:", effectTypesCache.length);

            allCategories = categoriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("All Categories loaded:", allCategories.length);

            allTags = tagsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("All Tags loaded:", allTags.length);

            allItems = itemsSnapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
            console.log("Items loaded:", allItems.length);

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
            let isDisabledForSimulator = false;
            if (isSelectingForSimulator) {
                if (category.name !== SIMULATOR_PARENT_CATEGORY_NAME) {
                    isDisabledForSimulator = true;
                }
            }
            button.classList.toggle('disabled', isDisabledForSimulator);
            button.textContent = category.name;
            button.dataset.categoryId = category.id;
            button.classList.toggle('active', selectedParentCategoryIds.includes(category.id));

            button.addEventListener('click', () => {
                if (!isDisabledForSimulator) {
                    toggleParentCategory(button, category.id);
                }
            });
            parentCategoryFiltersContainer.appendChild(button);
        });

        if (searchControlsElement) {
             // selecting-mode クラスは、検索バー以外のコントロールを無効化するために使う想定だったが、
             // 今回の要件で検索バーは有効にするので、このクラスの付け外しは一旦コメントアウト。
             // 個別要素の disabled 属性やイベントリスナーで制御する。
            // searchControlsElement.classList.toggle('selecting-mode', isSelectingForSimulator);
        }
    }

    function toggleParentCategory(button, categoryId) {
        if (isSelectingForSimulator && allCategories.find(c => c.id === categoryId)?.name === SIMULATOR_PARENT_CATEGORY_NAME) {
            return;
        }

        button.classList.toggle('active');
        const index = selectedParentCategoryIds.indexOf(categoryId);
        if (index > -1) {
            selectedParentCategoryIds.splice(index, 1);
        } else {
            selectedParentCategoryIds.push(categoryId);
        }
        selectedTagIds = [];
        if (isSelectingForSimulator && currentSelectingSlot) {
            const slotTagId = EQUIPMENT_SLOT_TAG_IDS[currentSelectingSlot];
            if (slotTagId) selectedTagIds.push(slotTagId);
        }
        renderChildCategoriesAndTags();
        filterAndRenderItems();
    }

    function renderChildCategoriesAndTags() {
        if (!childCategoriesAndTagsContainer) return;
        childCategoriesAndTagsContainer.innerHTML = '';

        let displayChildCategories = false;
        if (!isSelectingForSimulator && selectedParentCategoryIds.length > 0) {
            displayChildCategories = true;
        } else if (isSelectingForSimulator) {
            const equipmentParent = allCategories.find(c => c.name === SIMULATOR_PARENT_CATEGORY_NAME && (!c.parentId || c.parentId === ""));
            if (equipmentParent && selectedParentCategoryIds.includes(equipmentParent.id)) {
                displayChildCategories = true; // 「装備」親カテゴリが選択されていれば子カテゴリセクション自体は表示
            }
        }

        if (!displayChildCategories) {
            childCategoriesAndTagsContainer.style.display = 'none';
            if (selectedParentCategoryIds.length === 0 && !isSelectingForSimulator) {
                childCategoriesAndTagsContainer.innerHTML = '<p style="color: #777; margin-top: 10px;">親カテゴリを選択すると、関連する子カテゴリとタグが表示されます。</p>';
                childCategoriesAndTagsContainer.style.display = 'block';
            }
            return;
        }
        childCategoriesAndTagsContainer.style.display = 'block';


        let hasContentToShow = false;
        const validSlotTagIds = Object.values(EQUIPMENT_SLOT_TAG_IDS).filter(id => id !== null);

        selectedParentCategoryIds.forEach(parentId => {
            const parentCat = allCategories.find(c => c.id === parentId);
            if (!parentCat) return;

            const childCategoriesOfParent = allCategories.filter(cat => cat.parentId === parentId);

            if (childCategoriesOfParent.length > 0) {
                childCategoriesOfParent.forEach(childCat => {
                    if (isSelectingForSimulator && parentCat.name === SIMULATOR_PARENT_CATEGORY_NAME && childCat.name !== SIMULATOR_EFFECT_CHILD_CATEGORY_NAME) {
                        return;
                    }
                    hasContentToShow = true;

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

                            let isDisabledTag = false;
                            if (isSelectingForSimulator) {
                                if (childCat.name !== SIMULATOR_EFFECT_CHILD_CATEGORY_NAME) { // 「効果」カテゴリ以外のタグは操作不可
                                     isDisabledTag = true;
                                     if (isSlotTag && tag.id === EQUIPMENT_SLOT_TAG_IDS[currentSelectingSlot]) {
                                         isDisabledTag = false; // ただし現在選択中の部位タグは有効（見た目上アクティブにするため）
                                     }
                                }
                            }

                            tagButton.classList.toggle('disabled', isDisabledTag);
                            tagButton.classList.toggle('active', selectedTagIds.includes(tag.id) && !isDisabledTag);


                            tagButton.addEventListener('click', () => {
                                if (!isDisabledTag) {
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

    function toggleTag(button, tagId) {
        if (isSelectingForSimulator && currentSelectingSlot && tagId === EQUIPMENT_SLOT_TAG_IDS[currentSelectingSlot]) {
            return; // 現在選択中の部位タグは変更不可
        }

        button.classList.toggle('active');
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
            const sourceDisplay = item.入手手段 || 'Coming Soon';
            const priceDisplay = (typeof item.price === 'number' && !isNaN(item.price)) ? `売値: ${item.price}G` : '売値: Coming Soon';


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
                    if (!tagObj || validSlotTagIds.includes(tagId)) return null;
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
                structuredEffectsHtml = `<p><strong>効果:</strong> Coming Soon</p>`;
            }

            itemCard.innerHTML = `
                ${imageElementHTML}
                <h3>${nameDisplay}</h3>
                ${structuredEffectsHtml}
                <p><strong>入手手段:</strong> ${sourceDisplay}</p>
                <p><strong>${priceDisplay}</strong></p>
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
            if (isSelectingForSimulator && currentSelectingSlot) {
                const requiredSlotTagId = EQUIPMENT_SLOT_TAG_IDS[currentSelectingSlot];
                if (requiredSlotTagId && (!item.tags || !item.tags.includes(requiredSlotTagId))) {
                    return false;
                }
            }

            if (searchTerm) {
                const nameMatch = item.name && item.name.toLowerCase().includes(searchTerm);
                const sourceMatch = item.入手手段 && item.入手手段.toLowerCase().includes(searchTerm);
                const priceMatch = typeof item.price === 'number' && String(item.price).includes(searchTerm);
                const effectMatch = item.structured_effects && item.structured_effects.some(eff => {
                    const typeInfo = effectTypesCache.find(et => et.id === eff.type);
                    const typeName = typeInfo ? typeInfo.name.toLowerCase() : '';
                    const unitText = (eff.unit && eff.unit !== 'none') ? eff.unit.toLowerCase() : '';
                    const valueText = String(eff.value).toLowerCase();
                    return `${typeName}${valueText}${unitText}`.includes(searchTerm) ||
                           typeName.includes(searchTerm) ||
                           `${valueText}${unitText}`.includes(searchTerm);
                });
                if (!nameMatch && !sourceMatch && !effectMatch && !priceMatch) return false;
            }

            if (selectedParentCategoryIds.length > 0) {
                if (!isSelectingForSimulator || (isSelectingForSimulator && !selectedParentCategoryIds.some(id => allCategories.find(c=>c.id === id)?.name === SIMULATOR_PARENT_CATEGORY_NAME))) {
                    const itemChildCategoryIds = (item.tags || []).reduce((acc, tagId) => {
                        const tag = allTags.find(t => t.id === tagId);
                        if (tag && tag.categoryIds) {
                            tag.categoryIds.forEach(catId => {
                                const category = allCategories.find(c => c.id === catId);
                                if (category && category.parentId) {
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
            }

            if (selectedTagIds.length > 0) {
                let tagsToFilterByEffective = [...selectedTagIds];
                if (isSelectingForSimulator && currentSelectingSlot) {
                    const currentSlotTagId = EQUIPMENT_SLOT_TAG_IDS[currentSelectingSlot];
                    // 部位タグ自体は必須条件として上で処理済み。ここではそれ以外のタグ（効果カテゴリのタグなど）でフィルタリング。
                    tagsToFilterByEffective = selectedTagIds.filter(tid => tid !== currentSlotTagId);
                }


                if (tagsToFilterByEffective.length > 0) {
                    let effectiveSearchMode = 'AND';
                    const categoriesOfSelectedTags = new Map();

                    tagsToFilterByEffective.forEach(tagId => {
                        const tag = allTags.find(t => t.id === tagId);
                        if (tag && tag.categoryIds) {
                            tag.categoryIds.forEach(catId => {
                                const category = allCategories.find(c => c.id === catId);
                                if (category && category.parentId) {
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

                    if (categoriesOfSelectedTags.size === 1) {
                        const [catData] = categoriesOfSelectedTags.values();
                        if (catData.mode === 'OR' && catData.tags.length === tagsToFilterByEffective.length) {
                            effectiveSearchMode = 'OR';
                        }
                    }

                    if (effectiveSearchMode === 'OR') {
                        if (!tagsToFilterByEffective.some(tagId => item.tags && item.tags.includes(tagId))) {
                            return false;
                        }
                    } else {
                        if (!tagsToFilterByEffective.every(tagId => item.tags && item.tags.includes(tagId))) {
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
    if (searchInput) searchInput.addEventListener('input', () => {
        filterAndRenderItems();
    });


    function resetFilters() {
        // if (isSelectingForSimulator) return; // 通常検索時もシミュレーター選択時もリセットボタンはフィルターをクリアする
        if (searchInput) searchInput.value = '';
        selectedParentCategoryIds = [];
        selectedTagIds = [];

        // シミュレーター選択モードの場合、部位タグと「装備」親カテゴリは維持
        if (isSelectingForSimulator && currentSelectingSlot) {
            const slotTagId = EQUIPMENT_SLOT_TAG_IDS[currentSelectingSlot];
            if (slotTagId) selectedTagIds.push(slotTagId);

            const equipmentParentCategory = allCategories.find(c => c.name === SIMULATOR_PARENT_CATEGORY_NAME && (!c.parentId || c.parentId === ""));
            if (equipmentParentCategory) selectedParentCategoryIds.push(equipmentParentCategory.id);
        }

        renderParentCategoryFilters();
        renderChildCategoriesAndTags();
        filterAndRenderItems();
    }

    function initializeSimulatorSlots() {
        equipmentSlotsContainer.querySelectorAll('.select-item-button').forEach(button => {
            button.removeEventListener('click', startItemSelectionForSlot);
            button.addEventListener('click', startItemSelectionForSlot);
        });
        equipmentSlotsContainer.querySelectorAll('.clear-item-button').forEach(button => {
            button.removeEventListener('click', clearEquipmentSlot);
            button.addEventListener('click', clearEquipmentSlot);
        });
    }

    function startItemSelectionForSlot(event) {
        currentSelectingSlot = event.target.dataset.slot;
        if (!currentSelectingSlot) return;

        const slotTagId = EQUIPMENT_SLOT_TAG_IDS[currentSelectingSlot];
        if (slotTagId === undefined || slotTagId === null) {
            alert(`部位「${currentSelectingSlot}」に対応するタグIDが設定されていません。管理画面で「${currentSelectingSlot}」という名前のタグが正しく登録されているか確認してください。`);
            return;
        }

        isSelectingForSimulator = true;
        temporarilySelectedItem = selectedEquipment[currentSelectingSlot] || null;

        if (simulatorModal) simulatorModal.style.display = 'none';

        const equipmentParentCategory = allCategories.find(c => c.name === SIMULATOR_PARENT_CATEGORY_NAME && (!c.parentId || c.parentId === ""));
        if (equipmentParentCategory) {
            selectedParentCategoryIds = [equipmentParentCategory.id];
        } else {
            selectedParentCategoryIds = [];
            console.warn(`親カテゴリ「${SIMULATOR_PARENT_CATEGORY_NAME}」が見つかりません。`);
        }
        selectedTagIds = [slotTagId]; // 部位タグは必須

        // 検索入力は維持
        // if (searchInput) searchInput.value = '';

        renderParentCategoryFilters();
        renderChildCategoriesAndTags();
        filterAndRenderItems();

        if (searchToolMessage) {
            searchToolMessage.textContent = `「${currentSelectingSlot}」のアイテムを選択し、「決定」ボタンを押してください。`;
            searchToolMessage.style.display = 'block';
        }
        if (confirmSelectionButton) confirmSelectionButton.style.display = 'block';
        if (searchToolMessage.offsetParent !== null) {
             window.scrollTo({ top: searchToolMessage.offsetTop - 70, behavior: 'smooth' });
        } else if (searchControlsElement.offsetParent !== null) {
            window.scrollTo({ top: searchControlsElement.offsetTop - 20, behavior: 'smooth' });
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        if(searchInput) searchInput.disabled = false;
        if(searchControlsElement) searchControlsElement.classList.remove('selecting-mode');
    }


    if (confirmSelectionButton) {
        confirmSelectionButton.addEventListener('click', () => {
            if (!currentSelectingSlot) {
                cancelItemSelection();
                return;
            }
            selectedEquipment[currentSelectingSlot] = temporarilySelectedItem;
            const previouslySelectedSlot = currentSelectingSlot;

            isSelectingForSimulator = false;
            currentSelectingSlot = null;
            temporarilySelectedItem = null;

            if (searchToolMessage) searchToolMessage.style.display = 'none';
            if (confirmSelectionButton) confirmSelectionButton.style.display = 'none';

            selectedParentCategoryIds = [];
            selectedTagIds = [];
            if (searchInput) searchInput.value = '';
            if (searchInput) searchInput.disabled = false;

            renderParentCategoryFilters();
            renderChildCategoriesAndTags();
            filterAndRenderItems();

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
        const slotElement = document.getElementById(`slot-${slotName.replace(/\s/g, '')}`);
        if (!slotElement) {
            console.error(`Slot element for "${slotName}" not found.`);
            return;
        }

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
            } else {
                imgElement.src = './images/placeholder_slot.png';
                imgElement.alt = slotName;
                nameElement.textContent = 'エラー(データ不整合)';
                clearButton.style.display = 'none';
                selectButton.textContent = '選択';
            }
        } else {
            imgElement.src = './images/placeholder_slot.png';
            imgElement.alt = slotName;
            nameElement.textContent = '未選択';
            clearButton.style.display = 'none';
            selectButton.textContent = '選択';
        }
    }

    function calculateAndDisplayTotalEffects() {
        const totalEffectsMap = new Map();

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
                    return;
                }

                const calculationMethod = effectTypeInfo.calculationMethod || 'sum';
                const currentUnit = unit || 'none';
                const effectKey = `${effectTypeId}_${currentUnit}`;

                if (!totalEffectsMap.has(effectKey)) {
                    totalEffectsMap.set(effectKey, {
                        typeId: effectTypeId,
                        typeName: effectTypeInfo.name,
                        value: 0,
                        unit: currentUnit,
                        calculationMethod: calculationMethod,
                        valuesForMax: []
                    });
                }

                const currentEffectData = totalEffectsMap.get(effectKey);
                if (calculationMethod === 'max') {
                    currentEffectData.valuesForMax.push(value);
                } else {
                    currentEffectData.value += value;
                }
            });
        });

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
                await new Promise(resolve => setTimeout(resolve, 150));
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
            if (isSelectingForSimulator) return;
            if (simulatorModal) simulatorModal.style.display = 'flex';
            initializeSimulatorDisplay();
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
        if(searchInput) searchInput.disabled = false;
        if(searchControlsElement) searchControlsElement.classList.remove('selecting-mode');


        selectedParentCategoryIds = [];
        selectedTagIds = [];
        if (searchInput) searchInput.value = '';

        renderParentCategoryFilters();
        renderChildCategoriesAndTags();
        filterAndRenderItems();
    }

    loadData();
});
