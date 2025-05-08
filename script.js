import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import {
    getFirestore, collection, getDocs, query, orderBy, where
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

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

// ★効果種類キャッシュを追加（effect_typesコレクションがない場合は作成が必要）
let effectTypesCache = []; 
async function loadEffectTypes() {
    try {
        const q = query(collection(db, 'effect_types'), orderBy('name'));
        const snapshot = await getDocs(q);
        effectTypesCache = snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
        console.log("User site: Effect Types loaded:", effectTypesCache);
    } catch (error) {
        console.error("User site: Error loading effect types:", error);
    }
}


document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const parentCategoryFiltersContainer = document.getElementById('parentCategoryFiltersContainer');
    const childCategoriesAndTagsContainer = document.getElementById('childCategoriesAndTagsContainer');
    const itemList = document.getElementById('itemList');
    const itemCountDisplay = document.getElementById('itemCount');
    const resetFiltersButton = document.getElementById('resetFiltersButton');

    let allItems = [];
    let allCategories = []; 
    let allTags = [];       
    
    let selectedParentCategoryIds = [];
    let selectedTagIds = [];

    async function loadData() {
        try {
            await loadEffectTypes(); // ★効果種類もロード

            const categoriesSnapshot = await getDocs(query(collection(db, 'categories'), orderBy('name')));
            allCategories = categoriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("User site: All Categories loaded:", allCategories);

            const tagsSnapshot = await getDocs(query(collection(db, 'tags'), orderBy('name')));
            allTags = tagsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("User site: All Tags loaded:", allTags);
            
            const itemsSnapshot = await getDocs(query(collection(db, 'items'), orderBy('name')));
            allItems = itemsSnapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
            console.log("User site: Items loaded:", allItems);

            renderParentCategoryFilters();
            renderChildCategoriesAndTags(); 
            renderItems(allItems);

        } catch (error) {
            console.error("Error loading data:", error);
            if (itemList) itemList.innerHTML = `<p style="color: red;">データの読み込みに失敗しました。</p>`;
            if (itemCountDisplay) itemCountDisplay.textContent = 'エラー';
        }
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
                    // ★検索モード表示を修正 (AND がデフォルト)
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
    
    // ★アイテムカードに構造化効果も表示するように変更
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
            // const effectDisplay = item.effect || '後日追加予定'; // 従来のテキスト表示は不要に
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
            
            // ★構造化された効果を表示
            let structuredEffectsHtml = '';
            if (item.structured_effects && item.structured_effects.length > 0) {
                structuredEffectsHtml = `<div class="structured-effects"><strong>効果:</strong><ul>`;
                item.structured_effects.forEach(eff => {
                     const effectType = effectTypesCache.find(et => et.id === eff.type); // effectTypesCache を使用
                     const typeName = effectType ? effectType.name : '不明';
                     const unitText = eff.unit !== 'none' ? eff.unit : '';
                     structuredEffectsHtml += `<li>${typeName}: ${eff.value}${unitText}</li>`;
                });
                 structuredEffectsHtml += `</ul></div>`;
            } else {
                // 効果がない場合の表示（任意）
                 structuredEffectsHtml = `<p><strong>効果:</strong> なし</p>`;
            }

            itemCard.innerHTML = `
                ${imageElementHTML}
                <h3>${nameDisplay}</h3>
                ${structuredEffectsHtml} <!-- 構造化効果表示 -->
                <p><strong>入手手段:</strong> ${sourceDisplay}</p>
                ${tagsHtml}
            `;
            itemList.appendChild(itemCard);
        });
    }

    // ★フィルタリングロジックをOR/AND対応に更新
    function filterAndRenderItems() {
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : "";
        
        let filteredItems = allItems.filter(item => {
            const matchesSearchTerm = searchTerm === '' ||
                (item.name && item.name.toLowerCase().includes(searchTerm)) ||
                // structured_effects の内容も検索対象にする場合はここでロジック追加
                (item.入手手段 && item.入手手段.toLowerCase().includes(searchTerm));

            if (!matchesSearchTerm) return false;

            // カテゴリフィルタリング (選択された親カテゴリすべてに属するアイテム)
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

            // タグフィルタリング (OR/ANDを考慮)
            let matchesTags = true;
            if (selectedTagIds.length > 0) {
                // 選択されたタグが属する「子カテゴリ」のIDリストを取得
                const childCategoryIdsOfSelectedTags = new Set();
                 selectedTagIds.forEach(tagId => {
                    const tagObj = allTags.find(t => t.id === tagId);
                    (tagObj?.categoryIds || []).forEach(catId => {
                        const cat = allCategories.find(c => c.id === catId);
                        if (cat && cat.parentId) { // 子カテゴリのみを対象
                             childCategoryIdsOfSelectedTags.add(catId);
                        }
                    });
                });

                // 選択されたタグが単一の子カテゴリにのみ属するかどうかチェック
                let singleChildCategoryId = null;
                if (childCategoryIdsOfSelectedTags.size === 1) {
                     // すべての選択タグが、この単一子カテゴリに属しているか確認
                     const tempSingleCatId = [...childCategoryIdsOfSelectedTags][0];
                     const allSelectedTagsBelongToOneChild = selectedTagIds.every(tagId => {
                         const tagObj = allTags.find(t => t.id === tagId);
                         return tagObj?.categoryIds?.includes(tempSingleCatId);
                     });
                     if (allSelectedTagsBelongToOneChild) {
                          singleChildCategoryId = tempSingleCatId;
                     }
                }

                let searchMode = 'AND'; // デフォルトはAND
                if (singleChildCategoryId) {
                    const category = allCategories.find(c => c.id === singleChildCategoryId);
                    if (category && category.tagSearchMode === 'OR') {
                        searchMode = 'OR';
                    }
                }
                // 複数カテゴリにまたがる場合や、単一でもANDモードの場合はAND検索

                // フィルタリング実行
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

    if (searchInput) searchInput.addEventListener('input', filterAndRenderItems);
    if (resetFiltersButton) resetFiltersButton.addEventListener('click', resetFilters);

    loadData();
});
