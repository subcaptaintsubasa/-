// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js"; // 例: 9.6.10 (最新版を確認)
import {
    getFirestore,
    collection,
    getDocs,
    query,
    orderBy,
    where // where句を使用
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBxrE-9E46dplHTuEBmmcJWQRU1vLgAGAU", // ★★★ ご自身のAPIキー等に置き換えてください ★★★
  authDomain: "itemsearchtooleditor.firebaseapp.com",
  projectId: "itemsearchtooleditor",
  storageBucket: "itemsearchtooleditor.appspot.com",
  messagingSenderId: "243156973544",
  appId: "1:243156973544:web:ffdc31134a35354b6dd65d",
  measurementId: "G-8EHP9MGJ4M"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


document.addEventListener('DOMContentLoaded', () => {
    // DOM要素の取得
    const searchInput = document.getElementById('searchInput');
    const parentCategoryFilterSelect = document.getElementById('parentCategoryFilterSelect');
    const childCategoryFilterSelect = document.getElementById('childCategoryFilterSelect');
    const tagFiltersContainer = document.getElementById('tagFiltersContainer');
    const tagFilterPlaceholder = document.getElementById('tagFilterPlaceholder');
    const itemList = document.getElementById('itemList');
    const itemCountDisplay = document.getElementById('itemCount');
    const resetFiltersButton = document.getElementById('resetFiltersButton');

    let allItems = [];
    let allCategories = []; // 全カテゴリ (親子含む) { id, name, parentId }
    let availableTags = []; // { id, name, categoryId (子カテゴリIDを指す) }
    
    let selectedParentCategoryId = "";
    let selectedChildCategoryId = "";
    let selectedTags = [];

    async function loadData() {
        try {
            // カテゴリのロード (parentIdを持つものも含む)
            const categoriesCollectionRef = collection(db, 'categories');
            const categoriesQuery = query(categoriesCollectionRef, orderBy('name'));
            const categoriesSnapshot = await getDocs(categoriesQuery);
            allCategories = categoriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("User site: All Categories loaded:", allCategories);

            // タグのロード
            const tagsCollectionRef = collection(db, 'tags');
            const tagsQuery = query(tagsCollectionRef, orderBy('name'));
            const tagsSnapshot = await getDocs(tagsQuery);
            availableTags = tagsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("User site: Tags loaded:", availableTags);
            
            // アイテムのロード
            const itemsCollectionRef = collection(db, 'items');
            const itemsQuery = query(itemsCollectionRef, orderBy('name'));
            const itemsSnapshot = await getDocs(itemsQuery);
            allItems = itemsSnapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
            console.log("User site: Items loaded:", allItems);

            renderParentCategories();
            renderChildCategories(); // 初期は空のはず
            renderTagsForSelectedChildCategory(); // 初期は空のはず
            renderItems(allItems);

        } catch (error) {
            console.error("Error loading data from Firestore for user site: ", error);
            if (itemList) itemList.innerHTML = `<p style="color: red;">データの読み込みに失敗しました。</p>`;
            if (itemCountDisplay) itemCountDisplay.textContent = 'エラー';
        }
    }

    function renderParentCategories() {
        if (!parentCategoryFilterSelect) return;
        parentCategoryFilterSelect.innerHTML = '<option value="">すべて</option>';
        const parentCategories = allCategories.filter(cat => !cat.parentId || cat.parentId === ""); // parentIdがない、または空のものが親
        parentCategories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            parentCategoryFilterSelect.appendChild(option);
        });
    }

    function renderChildCategories() {
        if (!childCategoryFilterSelect) return;
        childCategoryFilterSelect.innerHTML = '<option value="">すべて</option>';
        childCategoryFilterSelect.disabled = true; // デフォルトは無効

        if (selectedParentCategoryId) {
            const childCategories = allCategories.filter(cat => cat.parentId === selectedParentCategoryId);
            if (childCategories.length > 0) {
                childCategories.forEach(category => {
                    const option = document.createElement('option');
                    option.value = category.id;
                    option.textContent = category.name;
                    childCategoryFilterSelect.appendChild(option);
                });
                childCategoryFilterSelect.disabled = false; // 子カテゴリがあれば有効化
            }
        }
        // 既存の選択を復元（もしあれば）
        childCategoryFilterSelect.value = selectedChildCategoryId;
    }

    function renderTagsForSelectedChildCategory() {
        if (!tagFiltersContainer || !tagFilterPlaceholder) return;
        tagFiltersContainer.innerHTML = ''; // タグフィルターをクリア
        
        let tagsToDisplay = [];
        if (selectedChildCategoryId) { // 子カテゴリが選択されている場合
            tagsToDisplay = availableTags.filter(tag => tag.categoryId === selectedChildCategoryId);
        } else if (selectedParentCategoryId) { // 親カテゴリのみ選択され、子カテゴリが「すべて」の場合
             // この場合、その親カテゴリに属する全ての子カテゴリのタグを表示するか、あるいはタグ選択をさせないか
             // 今回は子カテゴリ選択を促すため、タグは表示しない
            tagFilterPlaceholder.textContent = '子カテゴリを選択してください。';
            tagFiltersContainer.appendChild(tagFilterPlaceholder);
            tagFilterPlaceholder.style.display = 'block';
            return;
        } else { // 親も子も「すべて」の場合、または親未選択
            tagFilterPlaceholder.textContent = '子カテゴリを選択してください。'; // もしくは「親カテゴリから選択してください」
            tagFiltersContainer.appendChild(tagFilterPlaceholder);
            tagFilterPlaceholder.style.display = 'block';
            return;
        }
        
        if (tagsToDisplay.length > 0) {
            tagFilterPlaceholder.style.display = 'none';
            tagsToDisplay.forEach(tag => {
                const tagButton = document.createElement('div');
                tagButton.classList.add('tag-filter');
                tagButton.textContent = tag.name;
                tagButton.dataset.tagId = tag.id;
                if (selectedTags.includes(tag.id)) {
                    tagButton.classList.add('active');
                }
                tagButton.addEventListener('click', () => toggleTag(tagButton, tag.id));
                tagFiltersContainer.appendChild(tagButton);
            });
        } else if (selectedChildCategoryId) {
            tagFilterPlaceholder.textContent = 'この子カテゴリにはタグがありません。';
            tagFilterPlaceholder.style.display = 'block';
            tagFiltersContainer.appendChild(tagFilterPlaceholder);
        } else {
            // 上の分岐で処理済みのため、ここに来る場合は tagFilterPlaceholder.textContent の調整が必要なら行う
            // 現状は、selectedParentCategoryId があっても selectedChildCategoryId がないとタグを表示しない仕様
            if (tagFilterPlaceholder) tagFilterPlaceholder.textContent = '子カテゴリを選択してください。';
            tagFilterPlaceholder.style.display = 'block';
            tagFiltersContainer.appendChild(tagFilterPlaceholder);
        }
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
                    const tagObj = availableTags.find(t => t.id === tagId);
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

            let matchesCategoryAndTags = true; // デフォルトは絞り込みなし
            if (selectedTags.length > 0) { // タグが選択されていれば、それでフィルタリング
                matchesCategoryAndTags = item.tags && selectedTags.every(selTagId => item.tags.includes(selTagId));
            } else if (selectedChildCategoryId) { // タグ未選択だが、子カテゴリが選択されている場合
                // この子カテゴリに属するタグを持つアイテムを対象とする
                matchesCategoryAndTags = item.tags && item.tags.some(tagId => {
                    const tagObj = availableTags.find(t => t.id === tagId);
                    return tagObj && tagObj.categoryId === selectedChildCategoryId;
                });
            } else if (selectedParentCategoryId) { // 親カテゴリのみ選択されている場合
                 // この親カテゴリに属するいずれかの（子）カテゴリのタグを持つアイテムを対象とする
                const childCategoryIdsOfSelectedParent = allCategories
                    .filter(cat => cat.parentId === selectedParentCategoryId)
                    .map(cat => cat.id);
                
                if (childCategoryIdsOfSelectedParent.length > 0) {
                    matchesCategoryAndTags = item.tags && item.tags.some(tagId => {
                        const tagObj = availableTags.find(t => t.id === tagId);
                        // タグが、選択された親カテゴリ配下の子カテゴリに属しているか
                        return tagObj && childCategoryIdsOfSelectedParent.includes(tagObj.categoryId);
                    });
                } else {
                    // 親カテゴリに子カテゴリがない場合は、その親カテゴリ指定では何もマッチしない
                    matchesCategoryAndTags = false; 
                }
            }
            // それ以外（カテゴリもタグも未選択）の場合は、カテゴリ/タグによる絞り込みはなし (trueのまま)

            return matchesSearchTerm && matchesCategoryAndTags;
        });
        renderItems(filteredItems);
    }
    
    function toggleTag(tagButton, tagId) {
        tagButton.classList.toggle('active');
        if (selectedTags.includes(tagId)) {
            selectedTags = selectedTags.filter(t => t !== tagId);
        } else {
            selectedTags.push(tagId);
        }
        filterAndRenderItems();
    }

    function resetFilters() {
        if (searchInput) searchInput.value = '';
        selectedParentCategoryId = "";
        selectedChildCategoryId = "";
        selectedTags = [];
        
        if (parentCategoryFilterSelect) parentCategoryFilterSelect.value = "";
        if (childCategoryFilterSelect) {
            childCategoryFilterSelect.value = "";
            // 子カテゴリの選択肢もクリアして、disabled状態に戻す
            childCategoryFilterSelect.innerHTML = '<option value="">すべて</option>'; 
            childCategoryFilterSelect.disabled = true;
        }
        renderTagsForSelectedChildCategory(); // タグ表示をリセット（プレースホルダーに戻るはず）
        filterAndRenderItems();
    }

    // イベントリスナー
    if (searchInput) searchInput.addEventListener('input', filterAndRenderItems);
    if (resetFiltersButton) resetFiltersButton.addEventListener('click', resetFilters);

    if (parentCategoryFilterSelect) {
        parentCategoryFilterSelect.addEventListener('change', (event) => {
            selectedParentCategoryId = event.target.value;
            selectedChildCategoryId = ""; // 親が変わったら子はリセット
            selectedTags = []; // 親が変わったらタグもリセット（UI上もクリアされるように）
            
            renderChildCategories(); // 子カテゴリの選択肢を更新
            renderTagsForSelectedChildCategory(); // タグの選択肢も更新（通常はプレースホルダーに戻る）
            filterAndRenderItems(); // アイテムリストをフィルタリング
        });
    }

    if (childCategoryFilterSelect) {
        childCategoryFilterSelect.addEventListener('change', (event) => {
            selectedChildCategoryId = event.target.value;
            selectedTags = []; // 子が変わったらタグもリセット（UI上もクリアされるように）
            
            renderTagsForSelectedChildCategory(); // タグの選択肢を更新
            filterAndRenderItems(); // アイテムリストをフィルタリング
        });
    }

    loadData();
});
