// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import {
    getFirestore,
    collection,
    getDocs,
    query,
    orderBy,
    where // where句を追加
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBxrE-9E46dplHTuEBmmcJWQRU1vLgAGAU", // ★★★ ご自身のAPIキー等に置き換えてください ★★★
  authDomain: "itemsearchtooleditor.firebaseapp.com",
  projectId: "itemsearchtooleditor",
  storageBucket: "itemsearchtooleditor.appspot.com",
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
    const categoryLevel1Container = document.getElementById('categoryLevel1Container');
    const categoryLevel2Section = document.getElementById('categoryLevel2Section');
    const categoryLevel2Container = document.getElementById('categoryLevel2Container');
    const itemList = document.getElementById('itemList');
    const itemCountDisplay = document.getElementById('itemCount');
    const resetFiltersButton = document.getElementById('resetFiltersButton');

    let allItems = [];        // アイテムデータ { docId, name, image, effect, 入手手段, categoryIds: [catId1,...] }
    let allCategories = [];   // 全カテゴリデータ { id: docId, name: catName, parentId: parentDocId | null, level: number }
    let selectedCategoryIds = []; // 選択されたカテゴリのID (どの階層でも)

    // Firestoreからデータをロードする関数
    async function loadData() {
        try {
            // カテゴリデータをFirestoreから取得 (level順、次にname順)
            const categoriesCollectionRef = collection(db, 'categories');
            const categoriesQuery = query(categoriesCollectionRef, orderBy('level', 'asc'), orderBy('name', 'asc'));
            const categoriesSnapshot = await getDocs(categoriesQuery);
            allCategories = categoriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("User site: Categories loaded", allCategories);

            // アイテムデータをFirestoreから取得 (名前順)
            const itemsCollectionRef = collection(db, 'items');
            const itemsQuery = query(itemsCollectionRef, orderBy('name', 'asc'));
            const itemsSnapshot = await getDocs(itemsQuery);
            allItems = itemsSnapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
            console.log("User site: Items loaded", allItems);

            renderCategoryFilters(); // カテゴリフィルターUIを生成
            filterAndRenderItems(); // 初期表示 (全アイテム)

        } catch (error) {
            console.error("Error loading data from Firestore: ", error);
            if (itemList) itemList.innerHTML = `<p style="color: red;">データの読み込みに失敗しました。</p>`;
            if (itemCountDisplay) itemCountDisplay.textContent = 'エラー';
            if (categoryLevel1Container) categoryLevel1Container.innerHTML = '<span class="placeholder error">カテゴリ読込エラー</span>';
        }
    }

    // カテゴリフィルターUIを生成/更新する関数
    function renderCategoryFilters(selectedLevel1Id = null) {
        if (!categoryLevel1Container || !categoryLevel2Container || !categoryLevel2Section) return;

        // --- 第1階層カテゴリの表示 ---
        categoryLevel1Container.innerHTML = ''; // クリア
        const level1Categories = allCategories.filter(cat => !cat.parentId || cat.level === 1);
        level1Categories.forEach(cat => {
            const button = createCategoryButton(cat, 1, selectedLevel1Id === cat.id);
            button.addEventListener('click', () => {
                selectedCategoryIds = [cat.id]; // 第1階層を選択し直したら第2階層以下はリセット
                renderCategoryFilters(cat.id); // 第2階層を更新
                filterAndRenderItems();
            });
            categoryLevel1Container.appendChild(button);
        });
        if (level1Categories.length === 0) {
             categoryLevel1Container.innerHTML = '<span class="placeholder">カテゴリ未登録</span>';
        }

        // --- 第2階層カテゴリの表示 ---
        categoryLevel2Container.innerHTML = ''; // クリア
        if (selectedLevel1Id) {
            const level2Categories = allCategories.filter(cat => cat.parentId === selectedLevel1Id);
            if (level2Categories.length > 0) {
                level2Categories.forEach(cat => {
                    const button = createCategoryButton(cat, 2, selectedCategoryIds.includes(cat.id));
                     button.addEventListener('click', () => {
                        // 第2階層を選択した場合の動作 (複数選択を許容するか、単一にするか)
                        // ここでは選択した第2階層IDのみをフィルター対象とする
                        selectedCategoryIds = [selectedLevel1Id, cat.id]; // 親と自身のIDを保持
                        // UIの選択状態を更新
                        categoryLevel2Container.querySelectorAll('.tag-filter').forEach(btn => btn.classList.remove('active'));
                        button.classList.add('active');
                        // 第1階層も選択状態にする
                         categoryLevel1Container.querySelectorAll('.tag-filter').forEach(btn => {
                             if(btn.dataset.categoryId === selectedLevel1Id) btn.classList.add('active');
                             else btn.classList.remove('active');
                         });
                        filterAndRenderItems();
                        // 第3階層があればここで表示更新
                    });
                    categoryLevel2Container.appendChild(button);
                });
                categoryLevel2Section.style.display = 'block'; // 第2階層セクション表示
            } else {
                categoryLevel2Section.style.display = 'none'; // 子カテゴリがなければ非表示
            }
        } else {
            categoryLevel2Section.style.display = 'none'; // 第1階層が未選択なら非表示
        }
    }

    // カテゴリボタン生成ヘルパー
    function createCategoryButton(category, level, isActive) {
        const button = document.createElement('div');
        button.classList.add('tag-filter', `level-${level}`); // レベルでクラス分け(任意)
        if (isActive) {
            button.classList.add('active');
        }
        button.textContent = category.name;
        button.dataset.categoryId = category.id;
        return button;
    }


    // アイテムリストを表示する関数 (No Image対応)
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

            // 画像表示部分の変更
            let imageElement = '';
            if (item.image && item.image.startsWith('http')) { // 有効なURLか簡易チェック
                 imageElement = `<img src="${item.image}" alt="${item.name || 'アイテム画像'}" onerror="this.onerror=null; this.parentElement.innerHTML = '<div class=\\'no-image\\'>画像読込失敗</div>';">`;
            } else {
                imageElement = '<div class="no-image">No Image</div>'; // 画像がない場合の表示
            }

            let categoryHtml = '';
            if (item.categoryIds && item.categoryIds.length > 0) {
                categoryHtml = `<div class="tags">カテゴリ: ${item.categoryIds.map(catId => {
                    const catObj = allCategories.find(c => c.id === catId);
                    return `<span>${catObj ? catObj.name : '不明'}</span>`;
                }).join(' ')}</div>`;
            }

            itemCard.innerHTML = `
                <div class="item-image-container">${imageElement}</div>
                <h3>${item.name || '名称未設定'}</h3>
                <p><strong>効果:</strong> ${item.effect || '---'}</p> <!-- 未入力時表示 -->
                <p><strong>入手手段:</strong> ${item.入手手段 || '---'}</p> <!-- 未入力時表示 -->
                ${categoryHtml}
            `;
            itemList.appendChild(itemCard);
        });
    }

    // アイテムフィルタリングロジック (カテゴリ対応)
    function filterAndRenderItems() {
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : "";
        
        let filteredItems = allItems.filter(item => {
            // テキスト検索
            const matchesSearchTerm = searchTerm === '' ||
                (item.name && item.name.toLowerCase().includes(searchTerm)) ||
                (item.effect && item.effect.toLowerCase().includes(searchTerm)) ||
                (item.入手手段 && item.入手手段.toLowerCase().includes(searchTerm));

            // カテゴリ検索 (選択されたカテゴリIDがアイテムのcategoryIdsに含まれているか)
            // 選択されたIDが複数ある場合、それら全てに部分的にでもマッチすればOKとするか、
            // 最下層のIDにマッチすればOKとするか、など戦略が必要。
            // ここでは、選択されたカテゴリIDリスト(selectedCategoryIds)の *いずれか* が
            // アイテムのcategoryIdsに含まれていればマッチ、とする(OR検索に近い)
            // もしAND検索にするなら .every() を使う
            const matchesCategory = selectedCategoryIds.length === 0 ||
                (item.categoryIds && selectedCategoryIds.some(selCatId => item.categoryIds.includes(selCatId)));
            
            return matchesSearchTerm && matchesCategory;
        });
        
        renderItems(filteredItems);
    }
    
    // フィルターリセット関数 (カテゴリ対応)
    function resetFilters() {
        if (searchInput) searchInput.value = '';
        selectedCategoryIds = [];
        renderCategoryFilters(); // カテゴリフィルターを初期状態に戻す
        filterAndRenderItems(); // 全アイテムを表示
    }

    // イベントリスナー
    if (searchInput) searchInput.addEventListener('input', filterAndRenderItems);
    if (resetFiltersButton) resetFiltersButton.addEventListener('click', resetFilters);

    // 初期データロードを実行
    loadData();
});
