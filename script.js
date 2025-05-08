// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import {
    getFirestore, collection, getDocs, query, orderBy, where
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// Your web app's Firebase configuration
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
    const searchInput = document.getElementById('searchInput');
    const parentCategoryFiltersContainer = document.getElementById('parentCategoryFiltersContainer');
    const childCategoriesAndTagsContainer = document.getElementById('childCategoriesAndTagsContainer');
    const itemList = document.getElementById('itemList');
    const itemCountDisplay = document.getElementById('itemCount');
    const resetFiltersButton = document.getElementById('resetFiltersButton');

    let allItems = [];
    let allCategories = []; // { id, name, parentId }
    let allTags = [];       // { id, name, categoryIds: [childCatId1, childCatId2,...] }
    
    let selectedParentCategoryIds = [];
    let selectedTagIds = [];

    async function loadData() {
        try {
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
            renderChildCategoriesAndTags(); // Initially empty or placeholder
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
        // 親カテゴリ選択が変わったら、表示する子カテゴリとタグ、選択済みタグもリセット
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
                // Optional: Display parent category name as a header for this section
                // const parentHeader = document.createElement('h3');
                // parentHeader.textContent = parentCat.name;
                // parentHeader.classList.add('parent-category-tag-header');
                // childCategoriesAndTagsContainer.appendChild(parentHeader);

                childCategories.forEach(childCat => {
                    const childCatSection = document.createElement('div');
                    childCatSection.classList.add('child-category-section');
                    
                    const childCatHeader = document.createElement('h4');
                    childCatHeader.textContent = childCat.name;
                    childCatSection.appendChild(childCatHeader);

                    const tagsForThisChild = allTags.filter(tag => tag.categoryIds && tag.categoryIds.includes(childCat.id));
                    
                    if (tagsForThisChild.length > 0) {
                        const tagsContainer = document.createElement('div');
                        tagsContainer.classList.add('tag-filters-inline'); // new class for styling
                        tagsForThisChild.forEach(tag => {
                            const tagButton = document.createElement('div');
                            tagButton.classList.add('tag-filter'); // existing class
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
             childCategoriesAndTagsContainer.innerHTML = '<p style="color: #777; margin-top: 10px;">選択された親カテゴリには子カテゴリまたはタグがありません。</p>';
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
        // ... (この関数は変更なし、前回のコードをそのまま使用)
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
            const effectDisplay = item.effect || '後日追加予定';
            const sourceDisplay = item.入手手段 || '後日追加予定';
            let imageElementHTML;
            if (item.image && item.image.trim() !== "") {
                imageElementHTML = `<img src="${item.image}" alt="${nameDisplay}" onerror="this.onerror=null; this.src='./images/placeholder_item.png'; this.alt='画像読み込みエラー';">`;
            } else {
                imageElementHTML = `<div class="item-image-text-placeholder">NoImage</div>`;
            }
            let tagsHtml = '';
            if (item.tags && item.tags.length > 0) { // item.tags はアイテムが持つタグIDの配列
                tagsHtml = `<div class="tags">タグ: ${item.tags.map(tagId => {
                    const tagObj = allTags.find(t => t.id === tagId); // allTags から検索
                    return `<span>${tagObj ? tagObj.name : '不明なタグ'}</span>`;
                }).join(' ')}</div>`;
            }
            itemCard.innerHTML = `
                ${imageElementHTML}
                <h3>${nameDisplay}</h3>
                <p><strong>効果:</strong> ${effectDisplay}</p>
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
                (item.effect && item.effect.toLowerCase().includes(searchTerm)) ||
                (item.入手手段 && item.入手手段.toLowerCase().includes(searchTerm));

            if (!matchesSearchTerm) return false;

            // カテゴリとタグのフィルタリング
            let matchesCategories = true;
            if (selectedParentCategoryIds.length > 0) {
                // 選択された親カテゴリのいずれかに属する子カテゴリのタグを持つか
                const relevantChildCategoryIds = allCategories
                    .filter(cat => selectedParentCategoryIds.includes(cat.parentId) || selectedParentCategoryIds.includes(cat.id)) // 親自身も子カテゴリと見なす場合 or 親の子
                    .map(cat => cat.id);
                
                // アイテムが持つタグIDを取得
                const itemTagIds = item.tags || [];
                if (itemTagIds.length === 0 && relevantChildCategoryIds.length > 0) { // アイテムにタグがないが、カテゴリ指定がある
                    matchesCategories = false;
                } else if (relevantChildCategoryIds.length > 0) { // 関連する子カテゴリがある場合
                    matchesCategories = itemTagIds.some(itemTagId => {
                        const tagObj = allTags.find(t => t.id === itemTagId);
                        // タグが、選択された親カテゴリ群のいずれかの子カテゴリに属しているか
                        return tagObj && tagObj.categoryIds && tagObj.categoryIds.some(catId => relevantChildCategoryIds.includes(catId));
                    });
                }
                // relevantChildCategoryIdsが空なら、親カテゴリ指定が無意味なので絞り込まない (true)
            }
            
            if (!matchesCategories) return false;

            let matchesTags = true;
            if (selectedTagIds.length > 0) {
                matchesTags = selectedTagIds.every(selTagId => item.tags && item.tags.includes(selTagId));
            }
            
            return matchesTags; // searchTerm は既にチェック済み
        });
        renderItems(filteredItems);
    }

    function resetFilters() {
        if (searchInput) searchInput.value = '';
        selectedParentCategoryIds = [];
        selectedTagIds = [];
        
        renderParentCategoryFilters(); // ボタンのアクティブ状態をリセット
        renderChildCategoriesAndTags(); // 子カテゴリとタグの表示をリセット
        filterAndRenderItems();
    }

    if (searchInput) searchInput.addEventListener('input', filterAndRenderItems);
    if (resetFiltersButton) resetFiltersButton.addEventListener('click', resetFilters);

    loadData();
});
