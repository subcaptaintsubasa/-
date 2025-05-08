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

            // 親カテゴリ自身も表示エリアの区切りとして名前を出す (任意)
            // const parentNameHeader = document.createElement('h3');
            // parentNameHeader.classList.add('displayed-parent-category-name');
            // parentNameHeader.textContent = parentCat.name;
            // childCategoriesAndTagsContainer.appendChild(parentNameHeader);


            const childCategories = allCategories.filter(cat => cat.parentId === parentId);

            // 親カテゴリに直接紐づくタグも表示する場合 (今回は子カテゴリ経由のみ)
            // const tagsDirectlyUnderParent = allTags.filter(tag => tag.categoryIds && tag.categoryIds.includes(parentId) && !childCategories.some(cc => tag.categoryIds.includes(cc.id)));


            if (childCategories.length > 0) {
                hasContentToShow = true;
                childCategories.forEach(childCat => {
                    const childCatSection = document.createElement('div');
                    childCatSection.classList.add('child-category-section');
                    
                    const childCatHeader = document.createElement('h4');
                    childCatHeader.textContent = childCat.name;
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
            const effectDisplay = item.effect || '後日追加予定';
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
            let matchesCategories = true; // No parent category selected means no category filter
            if (selectedParentCategoryIds.length > 0) {
                // 選択された親カテゴリ「すべて」にAND条件で合致するアイテム
                // つまり、選択された各親カテゴリについて、その配下の子カテゴリのタグをアイテムが持っている必要がある
                matchesCategories = selectedParentCategoryIds.every(parentId => {
                    const childCategoryIdsOfThisParent = allCategories
                        .filter(cat => cat.parentId === parentId)
                        .map(cat => cat.id);
                    
                    // 親カテゴリ自身がタグを持つケースは現状考慮しない (子カテゴリがタグを管理する方針)
                    // もし親カテゴリも直接タグを持てるなら、childCategoryIdsOfThisParentにparentIdも追加する

                    if (childCategoryIdsOfThisParent.length === 0) {
                        // この親カテゴリには子カテゴリがない。
                        // この親カテゴリ指定が無意味になるか、この親が直接タグを持つかで挙動が変わる。
                        // 現状は「子カテゴリがタグを持つ」なので、この親ではマッチするタグがないことになる。
                        // AND条件なので、一つでも子カテゴリがない（＝マッチするタグがない）親があれば、全体としてfalse。
                        // ただし、アイテムがタグを全く持たない場合との兼ね合いも考慮。
                        // アイテムもタグを持たず、この親も子を持たないなら、この親カテゴリの条件は「満たせない」
                        return (item.tags || []).length === 0 ? false : false; // 親に子がなくアイテムにタグがない場合、またはアイテムにタグがある場合もfalse
                    }

                    return (item.tags || []).some(itemTagId => {
                        const tagObj = allTags.find(t => t.id === itemTagId);
                        return tagObj && tagObj.categoryIds && tagObj.categoryIds.some(catId => childCategoryIdsOfThisParent.includes(catId));
                    });
                });
            }
            
            if (!matchesCategories) return false;

            let matchesTags = true;
            if (selectedTagIds.length > 0) {
                // 選択されたタグを「すべて」持つアイテム
                matchesTags = selectedTagIds.every(selTagId => item.tags && item.tags.includes(selTagId));
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
