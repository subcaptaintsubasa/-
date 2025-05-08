// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js"; // 例: 9.6.10 (最新版を確認)
import {
    getFirestore,
    collection,
    getDocs,
    query,
    orderBy,
    where
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBxrE-9E46dplHTuEBmmcJWQRU1vLgAGAU", // ★★★ ご自身のAPIキー等に置き換えてください ★★★
  authDomain: "itemsearchtooleditor.firebaseapp.com",
  projectId: "itemsearchtooleditor",
  storageBucket: "itemsearchtooleditor.appspot.com", // Firebase Storageは使わないが念のため残してもOK
  messagingSenderId: "243156973544",
  appId: "1:243156973544:web:ffdc31134a35354b6dd65d",
  measurementId: "G-8EHP9MGJ4M" // Optional
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


document.addEventListener('DOMContentLoaded', () => {
    // DOM要素の取得
    const searchInput = document.getElementById('searchInput');
    const categoryFilterSelect = document.getElementById('categoryFilterSelect');
    const tagFiltersContainer = document.getElementById('tagFiltersContainer');
    const tagFilterPlaceholder = document.getElementById('tagFilterPlaceholder');
    const itemList = document.getElementById('itemList');
    const itemCountDisplay = document.getElementById('itemCount');
    const resetFiltersButton = document.getElementById('resetFiltersButton');

    let allItems = [];        // Firestoreから取得したアイテムデータ
    let availableCategories = []; // Firestoreから取得したカテゴリデータ { id: docId, name: categoryName }
    let availableTags = [];   // Firestoreから取得したタグデータ { id: docId, name: tagName, categoryId: categoryDocId }
    let selectedTags = [];    // 選択されたタグのドキュメントIDの配列
    let selectedCategoryId = ""; // 選択されたカテゴリのID

    // Firestoreからデータをロードする関数
    async function loadData() {
        try {
            // カテゴリのロード
            const categoriesCollectionRef = collection(db, 'categories');
            const categoriesQuery = query(categoriesCollectionRef, orderBy('name')); // 'order'フィールドがあればそちらでソートも可
            const categoriesSnapshot = await getDocs(categoriesQuery);
            availableCategories = categoriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("User site: Categories loaded from Firestore", availableCategories);

            // タグのロード
            const tagsCollectionRef = collection(db, 'tags');
            const tagsQuery = query(tagsCollectionRef, orderBy('name')); // 'order'フィールドがあればそちらでソートも可
            const tagsSnapshot = await getDocs(tagsQuery);
            availableTags = tagsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("User site: Tags loaded from Firestore", availableTags);
            
            // アイテムのロード
            const itemsCollectionRef = collection(db, 'items');
            const itemsQuery = query(itemsCollectionRef, orderBy('name'));
            const itemsSnapshot = await getDocs(itemsQuery);
            allItems = itemsSnapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
            console.log("User site: Items loaded from Firestore", allItems);

            renderCategories();
            renderTagsForSelectedCategory(); // 初期は空のはず
            renderItems(allItems); // 初期は全アイテム表示

        } catch (error) {
            console.error("Error loading data from Firestore for user site: ", error);
            if (itemList) {
                itemList.innerHTML = `<p style="color: red;">データの読み込みに失敗しました。設定を確認するか、しばらくしてから再度お試しください。</p>`;
            }
            if (itemCountDisplay) {
                itemCountDisplay.textContent = 'エラー';
            }
        }
    }

    // カテゴリフィルターUIを生成する関数
    function renderCategories() {
        if (!categoryFilterSelect) return;
        categoryFilterSelect.innerHTML = '<option value="">すべてのカテゴリ</option>'; // デフォルトオプション
        availableCategories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            categoryFilterSelect.appendChild(option);
        });
    }

    // 選択されたカテゴリに基づいてタグフィルターUIを生成する関数
    function renderTagsForSelectedCategory() {
        if (!tagFiltersContainer || !tagFilterPlaceholder) return;
        tagFiltersContainer.innerHTML = ''; // タグフィルターをクリア
        
        let tagsToDisplay = [];
        if (selectedCategoryId) {
            tagsToDisplay = availableTags.filter(tag => tag.categoryId === selectedCategoryId);
        } else {
            // カテゴリが選択されていない場合は、すべてのタグを表示するか、または何も表示しないか選択
            // 今回はカテゴリ選択を促すため、カテゴリ未選択時はタグを表示しない
             tagFiltersContainer.appendChild(tagFilterPlaceholder);
             tagFilterPlaceholder.style.display = 'block';
             return; // タグを表示しない
        }
        
        if (tagsToDisplay.length > 0) {
            tagFilterPlaceholder.style.display = 'none';
            tagsToDisplay.forEach(tag => {
                const tagButton = document.createElement('div');
                tagButton.classList.add('tag-filter');
                tagButton.textContent = tag.name;
                tagButton.dataset.tagId = tag.id;
                // 選択状態を復元
                if (selectedTags.includes(tag.id)) {
                    tagButton.classList.add('active');
                }
                tagButton.addEventListener('click', () => toggleTag(tagButton, tag.id));
                tagFiltersContainer.appendChild(tagButton);
            });
        } else if (selectedCategoryId) {
            tagFilterPlaceholder.textContent = 'このカテゴリにはタグがありません。';
            tagFilterPlaceholder.style.display = 'block';
            tagFiltersContainer.appendChild(tagFilterPlaceholder);
        } else {
            tagFilterPlaceholder.textContent = 'カテゴリを選択してください。';
            tagFilterPlaceholder.style.display = 'block';
            tagFiltersContainer.appendChild(tagFilterPlaceholder);
        }
    }


    // アイテムリストを表示する関数
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

    // テキスト検索とタグフィルターに基づいてアイテムをフィルタリングし再表示する関数
    function filterAndRenderItems() {
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : "";
        
        let filteredItems = allItems.filter(item => {
            const matchesSearchTerm = searchTerm === '' ||
                (item.name && item.name.toLowerCase().includes(searchTerm)) ||
                (item.effect && item.effect.toLowerCase().includes(searchTerm)) ||
                (item.入手手段 && item.入手手段.toLowerCase().includes(searchTerm));

            const matchesTags = selectedTags.length === 0 ||
                (item.tags && selectedTags.every(selTagId => item.tags.includes(selTagId)));
            
            // カテゴリによる絞り込み (任意: タグが選択されていればカテゴリも間接的に絞り込まれる)
            // もしカテゴリ単独でも絞り込みたい場合はここに追加ロジック
            // const matchesCategory = !selectedCategoryId || (item.tags && item.tags.some(tagId => {
            //     const tagObj = availableTags.find(t => t.id === tagId);
            //     return tagObj && tagObj.categoryId === selectedCategoryId;
            // }));
            // return matchesSearchTerm && matchesTags && matchesCategory;
            
            return matchesSearchTerm && matchesTags;
        });
        renderItems(filteredItems);
    }
    
    // タグ選択をトグルする関数
    function toggleTag(tagButton, tagId) {
        tagButton.classList.toggle('active');
        if (selectedTags.includes(tagId)) {
            selectedTags = selectedTags.filter(t => t !== tagId);
        } else {
            selectedTags.push(tagId);
        }
        filterAndRenderItems();
    }

    // フィルターをリセットする関数
    function resetFilters() {
        if (searchInput) searchInput.value = '';
        selectedCategoryId = "";
        if (categoryFilterSelect) categoryFilterSelect.value = "";
        selectedTags = [];
        renderTagsForSelectedCategory(); // タグ表示をリセット
        filterAndRenderItems();
    }

    // イベントリスナーの設定
    if (searchInput) searchInput.addEventListener('input', filterAndRenderItems);
    if (resetFiltersButton) resetFiltersButton.addEventListener('click', resetFilters);
    if (categoryFilterSelect) {
        categoryFilterSelect.addEventListener('change', (event) => {
            selectedCategoryId = event.target.value;
            // カテゴリ変更時に選択されていたタグはリセットする（UI/UXによる）
            selectedTags = []; 
            renderTagsForSelectedCategory();
            filterAndRenderItems(); // カテゴリ変更だけでもフィルタリング実行
        });
    }

    // 初期データロードを実行
    loadData();
});
