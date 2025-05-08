import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import {
    getFirestore, collection, getDocs, query, orderBy, where
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// ★ EQUIPMENT_SLOT_TAG_IDS は buildEquipmentSlotTagMap で初期化されるので、
// グローバルスコープでの初期値は空オブジェクトでよい
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

    // Item Selection Modal DOM
    // const itemSelectionModal = document.getElementById('itemSelectionModal'); // 未使用のためコメントアウト
    // const itemSelectModalTitle = document.getElementById('itemSelectModalTitle'); // 未使用
    // const itemSelectModalSearch = document.getElementById('itemSelectModalSearch'); // 未使用
    // const itemSelectModalList = document.getElementById('itemSelectModalList'); // 未使用

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
            const [effectTypesSnapshot, categoriesSnapshot, tagsSnapshot, itemsSnapshot] = await Promise.all([
                getDocs(query(collection(db, 'effect_types'), orderBy('name'))),
                getDocs(query(collection(db, 'categories'), orderBy('name'))),
                getDocs(query(collection(db, 'tags'), orderBy('name'))),
                getDocs(query(collection(db, 'items'), orderBy('name')))
            ]);

            effectTypesCache = effectTypesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("User site: Effect Types loaded:", effectTypesCache);

            allCategories = categoriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("User site: All Categories loaded:", allCategories);

            allTags = tagsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("User site: All Tags loaded:", allTags);

            allItems = itemsSnapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
            console.log("User site: Items loaded:", allItems);

            buildEquipmentSlotTagMap(); // タグデータロード後に実行

            initializeSimulatorSlots();
            initializeSimulatorDisplay();
            renderParentCategoryFilters();
            renderChildCategoriesAndTags();
            filterAndRenderItems(); // 初期フィルターでアイテムリスト描画

        } catch (error) {
            console.error("Error loading data:", error);
            if (itemList) itemList.innerHTML = `<p style="color: red;">データの読み込みに失敗しました。エラーの詳細はコンソールを確認してください。</p>`;
            if (itemCountDisplay) itemCountDisplay.textContent = 'エラー';
            if (totalEffectsDisplay) totalEffectsDisplay.innerHTML = '<p style="color: red;">データ読込エラー</p>';
        }
    }

    function buildEquipmentSlotTagMap() {
        EQUIPMENT_SLOT_TAG_IDS = {}; // 既存のマッピングをクリア
        if (!allTags || allTags.length === 0) {
            console.error("Tags data is not loaded or empty. Cannot build equipment slot tag map.");
            equipmentSlots.forEach(slotName => {
                EQUIPMENT_SLOT_TAG_IDS[slotName] = null;
            });
            alert("タグデータの読み込みに失敗したため、装備部位によるアイテム絞り込みが正しく動作しない可能性があります。");
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
        if (searchControlsElement) {
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
        const validSlotTagIds = Object.values(EQUIPMENT_SLOT_TAG_IDS).filter(id => id !== null);

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
            childCategoriesAndTagsContainer.innerHTML = '<p style="color: #777; margin-top: 10px;">選択された親カテゴリには表示可能な子カテゴリがありません。</p>';
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
            const countText = isSelectingForSimulator ? `該当部位のアイテム: ${itemsToRender.length} 件` : `${itemsToRender.length} 件のアイテムが見つかりました。`;
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
                const displayableTags = item.tags.map(tagId => {
                    const tagObj = allTags.find(t => t.id === tagId);
                    if (tagObj && validSlotTagIds.includes(tagId)) return null;
                    return tagObj ? `<span>${tagObj.name}</span>` : null;
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
                    const typeName = effectType ? effectType.name : '不明な効果種別';
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
        console.log("Temporarily selected item:", itemId);
    }

    function filterAndRenderItems() {
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : "";

        let filteredItems = allItems.filter(item => {
            let matchesSlotTag = true;
            if (isSelectingForSimulator && currentSelectingSlot) {
                const requiredSlotTagId = EQUIPMENT_SLOT_TAG_IDS[currentSelectingSlot];
                if (requiredSlotTagId) {
                    matchesSlotTag = (item.tags && item.tags.includes(requiredSlotTagId));
                } else {
                    // 部位タグIDが見つからない場合、この部位の絞り込みはスキップ
                    // console.warn(`No valid tag ID for slot ${currentSelectingSlot}, slot filter skipped.`);
                }
            }
            if (!matchesSlotTag) return false;

            const matchesSearchTerm = searchTerm === '' ||
                (item.name && item.name.toLowerCase().includes(searchTerm)) ||
                (item.structured_effects && item.structured_effects.some(eff => {
                    const typeInfo = effectTypesCache.find(et => et.id === eff.type);
                    const typeName = typeInfo ? typeInfo.name : '';
                    const unitText = (eff.unit && eff.unit !== 'none') ? eff.unit : '';
                    return `${typeName}${eff.value}${unitText}`.toLowerCase().includes(searchTerm);
                })) ||
                (item.入手手段 && item.入手手段.toLowerCase().includes(searchTerm));

            if (!matchesSearchTerm) return false;

            let matchesCategories = true;
            if (selectedParentCategoryIds.length > 0 && !isSelectingForSimulator) {
                const allChildCategoryIdsUnderSelectedParents = selectedParentCategoryIds.flatMap(parentId =>
                    allCategories.filter(cat => cat.parentId === parentId).map(cat => cat.id)
                );

                if (allChildCategoryIdsUnderSelectedParents.length > 0) {
                    matchesCategories = (item.tags || []).some(itemTagId => {
                        const tagObj = allTags.find(t => t.id === itemTagId);
                        return tagObj?.categoryIds?.some(catIdOfItemTag =>
                            allChildCategoryIdsUnderSelectedParents.includes(catIdOfItemTag)
                        );
                    });
                } else {
                    matchesCategories = false;
                }
            }
            if (!matchesCategories) return false;

            let matchesTags = true;
            if (!isSelectingForSimulator && selectedTagIds.length > 0) {
                const validSlotTagIds = Object.values(EQUIPMENT_SLOT_TAG_IDS).filter(id => id !== null);
                const actualSelectedTags = selectedTagIds.filter(tagId => !validSlotTagIds.includes(tagId));

                if (actualSelectedTags.length > 0) {
                    let effectiveSearchMode = 'AND';
                    if (actualSelectedTags.length > 0) {
                        const firstTagObj = allTags.find(t => t.id === actualSelectedTags[0]);
                        const categoriesOfFirstTag = (firstTagObj?.categoryIds || [])
                            .map(catId => allCategories.find(c => c.id === catId && c.parentId))
                            .filter(Boolean); // Ensure category exists and is a child category

                        if (categoriesOfFirstTag.length === 1 && categoriesOfFirstTag[0].tagSearchMode === 'OR') {
                            let allTagsInSameOrCategory = true;
                            for (let i = 1; i < actualSelectedTags.length; i++) {
                                const currentTagObj = allTags.find(t => t.id === actualSelectedTags[i]);
                                if (!currentTagObj?.categoryIds?.includes(categoriesOfFirstTag[0].id)) {
                                    allTagsInSameOrCategory = false;
                                    break;
                                }
                            }
                            if (allTagsInSameOrCategory) effectiveSearchMode = 'OR';
                        }
                    }

                    if (effectiveSearchMode === 'OR') {
                        matchesTags = actualSelectedTags.some(selTagId => item.tags && item.tags.includes(selTagId));
                    } else { // AND
                        matchesTags = actualSelectedTags.every(selTagId => item.tags && item.tags.includes(selTagId));
                    }
                }
            }
            return matchesTags;
        });
        renderItems(filteredItems);
    }

    if (resetFiltersButton) resetFiltersButton.addEventListener('click', resetFilters);
    if (searchInput) searchInput.addEventListener('input', filterAndRenderItems);

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
        if (!currentSelectingSlot) {
            console.error("No slot name found on button dataset.");
            return;
        }

        const slotTagId = EQUIPMENT_SLOT_TAG_IDS[currentSelectingSlot];
        if (slotTagId === undefined || slotTagId === null) {
            alert(`部位「${currentSelectingSlot}」に対応するタグIDが設定されていません。管理画面でタグを確認・設定してください。`);
            console.error(`Tag ID for slot "${currentSelectingSlot}" is missing or null in EQUIPMENT_SLOT_TAG_IDS.`);
            return;
        }

        isSelectingForSimulator = true;
        temporarilySelectedItem = selectedEquipment[currentSelectingSlot] || null;

        if (simulatorModal) simulatorModal.style.display = 'none';

        selectedParentCategoryIds = [];
        selectedTagIds = [slotTagId];

        if (searchInput) searchInput.value = '';

        renderParentCategoryFilters();
        renderChildCategoriesAndTags();
        filterAndRenderItems();

        if (searchToolMessage) {
            searchToolMessage.textContent = `「${currentSelectingSlot}」のアイテムを選択し、「決定」ボタンを押してください。`;
            searchToolMessage.style.display = 'block';
        }
        if (confirmSelectionButton) confirmSelectionButton.style.display = 'block';
        if (searchToolMessage.offsetParent !== null) {
            window.scrollTo({ top: searchToolMessage.offsetTop - 20, behavior: 'smooth' });
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    if (confirmSelectionButton) {
        confirmSelectionButton.addEventListener('click', () => {
            if (!currentSelectingSlot) {
                console.error("No slot is currently being selected.");
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

            selectedParentCategoryIds = []; // 通常検索のフィルターもリセット
            selectedTagIds = [];
            if(searchInput) searchInput.value = '';

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
                if (clearButton) clearButton.style.display = 'inline-block';
                if (selectButton) selectButton.textContent = '変更';
            } else {
                imgElement.src = './images/placeholder_slot.png';
                imgElement.alt = slotName;
                nameElement.textContent = 'エラー';
                if (clearButton) clearButton.style.display = 'none';
                if (selectButton) selectButton.textContent = '選択';
            }
        } else {
            imgElement.src = './images/placeholder_slot.png';
            imgElement.alt = slotName;
            nameElement.textContent = '未選択';
            if (clearButton) clearButton.style.display = 'none';
            if (selectButton) selectButton.textContent = '選択';
        }
    }

    function calculateAndDisplayTotalEffects() {
        const totalEffectsMap = new Map();

        Object.values(selectedEquipment).forEach(itemId => {
            if (!itemId) return;
            const item = allItems.find(i => i.docId === itemId);
            if (!item || !item.structured_effects) return;

            item.structured_effects.forEach(effect => {
                const { type, value, unit } = effect;
                if (type && typeof value === 'number') {
                    const effectTypeInfo = effectTypesCache.find(et => et.id === type);
                    if (!effectTypeInfo) {
                        console.warn(`Unknown effect type ID: ${type} for item ID: ${itemId}`);
                        return;
                    }

                    const calculationMethod = effectTypeInfo.calculationMethod || 'sum';
                    const effectKey = `${type}_${unit || 'none'}`;

                    if (!totalEffectsMap.has(effectKey)) {
                        totalEffectsMap.set(effectKey, {
                            typeId: type,
                            typeName: effectTypeInfo.name,
                            value: 0,
                            unit: unit || 'none',
                            calculationMethod: calculationMethod,
                            values: []
                        });
                    }

                    const currentEffectData = totalEffectsMap.get(effectKey);
                    if (calculationMethod === 'max') {
                        currentEffectData.values.push(value);
                    } else { // sum
                        currentEffectData.value += value;
                    }
                }
            });
        });

        totalEffectsMap.forEach(effectData => {
            if (effectData.calculationMethod === 'max' && effectData.values.length > 0) {
                effectData.value = Math.max(...effectData.values);
            }
        });

        if (totalEffectsMap.size === 0) {
            totalEffectsDisplay.innerHTML = '<p>効果はありません。</p>';
        } else {
            let html = '<ul>';
            totalEffectsMap.forEach(effect => {
                const unitText = (effect.unit && effect.unit !== 'none') ? effect.unit : '';
                const displayValue = Math.round(effect.value * 100) / 100;
                html += `<li>${effect.typeName}: ${displayValue}${unitText}</li>`;
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
            // itemSelectionModal は現在使用していないため、関連する cancelItemSelection の呼び出しは不要
            // if (modal === itemSelectionModal && isSelectingForSimulator) {
            //      cancelItemSelection();
            // }
            if (modal === simulatorModal && isSelectingForSimulator) {
                cancelItemSelection();
            }
        }
    });
    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) { // モーダル背景クリックで閉じる
             event.target.style.display = "none";
             if (event.target === simulatorModal && isSelectingForSimulator) {
                 cancelItemSelection();
             }
             // itemSelectionModal は現在使用していないため、関連する cancelItemSelection の呼び出しは不要
             // if (event.target === itemSelectionModal && isSelectingForSimulator) {
             //     cancelItemSelection();
             // }
        }
    }

    function cancelItemSelection() {
        console.log("Item selection cancelled.");
        isSelectingForSimulator = false;
        currentSelectingSlot = null;
        temporarilySelectedItem = null;

        if (searchToolMessage) searchToolMessage.style.display = 'none';
        if (confirmSelectionButton) confirmSelectionButton.style.display = 'none';

        selectedParentCategoryIds = [];
        selectedTagIds = [];
        if (searchInput) searchInput.value = '';

        renderParentCategoryFilters();
        renderChildCategoriesAndTags();
        filterAndRenderItems();
    }

    // const itemSelectModalSearch = document.getElementById('itemSelectModalSearch');
    // if (itemSelectModalSearch) {
    //     itemSelectModalSearch.addEventListener('input', populateItemSelectionModalList);
    // }
    // function populateItemSelectionModalList() { /* ... (not implemented) ... */ }

    loadData();
});
