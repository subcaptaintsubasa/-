// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import {
    getFirestore,
    collection,
    getDocs,
    query,
    orderBy,
    where // フィルター用に where を追加
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBxrE-9E46dplHTuEBmmcJWQRU1vLgAGAU", // ご自身のAPIキー等に置き換えてください
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
    const categoryLevel1Select = document.getElementById('categoryLevel1');
    const categoryLevel2Select = document.getElementById('categoryLevel2');
    const categoryLevel3Select = document.getElementById('categoryLevel3');
    const tagSearchAndRadio = document.getElementById('tagSearchAnd');
    const tagSearchOrRadio = document.getElementById('tagSearchOr');
    const resetFiltersButton = document.getElementById('resetFiltersButton');
    const sortOrderSelect = document.getElementById('sortOrder');
    const displayModeButtons = document.querySelectorAll('.display-mode-button');
    const itemList = document.getElementById('itemList');
    const itemCountDisplay = document.getElementById('itemCount');

    let allItems = [];
    let allTags = []; // 全てのタグ情報 {id, name, level, parentTagId} を保持
    let selectedLevel1TagId = null;
    let selectedLevel2TagId = null;
    let selectedLevel3TagId = null; // 実際にフィルタリングに使うのはこれ
    let currentTagSearchMode = 'AND'; // 'AND' or 'OR'
    let currentDisplayMode = 'card'; // 'card', 'list', 'table'
    let currentSortOrder = 'name_asc'; // 例: 'name_asc', 'createdAt_desc'

    // データロード
    async function loadData() {
        try {
            // アイテムデータ (並び替えを考慮し、クライアントサイドソート用に一旦全件取得)
            // TODO: アイテム数が多い場合は、Firestoreクエリでのソート・フィルタリングを検討
            const itemsSnapshot = await getDocs(collection(db, 'items'));
            allItems = itemsSnapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));

            // 全タグデータ (階層構造を処理するため)
            const tagsSnapshot = await getDocs(query(collection(db, 'tags'), orderBy('level'), orderBy('name')));
            allTags = tagsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            console.log("User site: Items loaded", allItems);
            console.log("User site: All Tags loaded", allTags);

            populateCategoryFilters();
            applyFiltersAndRender(); // 初期表示

        } catch (error) {
            console.error("Error loading data from Firestore for user site: ", error);
            if (itemList) itemList.innerHTML = `<p style="color: red;">データの読み込みに失敗しました。</p>`;
            if (itemCountDisplay) itemCountDisplay.textContent = 'エラー';
        }
    }

    // カテゴリフィルターのドロップダウンを生成
    function populateCategoryFilters() {
        // Level 1
        const level1Tags = allTags.filter(tag => tag.level === 1);
        populateSelect(categoryLevel1Select, level1Tags, "カテゴリ1を選択");

        // Level 2とLevel 3の連動 (イベントリスナー内で処理)
        categoryLevel1Select.addEventListener('change', handleCategoryChange);
        categoryLevel2Select.addEventListener('change', handleCategoryChange);
        categoryLevel3Select.addEventListener('change', handleFilterChange); // Level 3 選択でフィルター実行
    }

    function handleCategoryChange(event) {
        const level = parseInt(event.target.id.replace('categoryLevel', ''), 10);
        const selectedParentId = event.target.value;

        // 選択状態を更新
        if (level === 1) {
            selectedLevel1TagId = selectedParentId || null;
            selectedLevel2TagId = null;
            selectedLevel3TagId = null; // 下位もリセット
            populateSelect(categoryLevel2Select, filterTagsByParent(selectedLevel1TagId, 2), "カテゴリ2を選択", true);
            populateSelect(categoryLevel3Select, [], "カテゴリ3を選択", true); // Level 3もクリア
        } else if (level === 2) {
            selectedLevel2TagId = selectedParentId || null;
            selectedLevel3TagId = null; // Level 3 をリセット
            populateSelect(categoryLevel3Select, filterTagsByParent(selectedLevel2TagId, 3), "カテゴリ3を選択", true);
        }
        // Level 1 or 2 の変更ではまだフィルタリングしない (Level 3の選択を待つか、別途ボタンを設ける)
         applyFiltersAndRender(); // ★変更: Level1,2変更でも即時反映
    }

    function populateSelect(selectElement, tags, defaultOptionText, disable = false) {
        selectElement.innerHTML = `<option value="">${defaultOptionText}</option>`;
        tags.forEach(tag => {
            const option = document.createElement('option');
            option.value = tag.id;
            option.textContent = tag.name;
            selectElement.appendChild(option);
        });
        selectElement.disabled = disable || tags.length === 0;
        if(selectElement.disabled) { // disabledなら選択をクリア
             selectElement.value = "";
        }
    }

    function filterTagsByParent(parentId, targetLevel) {
        if (!parentId) return [];
        return allTags.filter(tag => tag.level === targetLevel && tag.parentTagId === parentId);
    }

    // アイテムリストを表示する関数 (表示モード対応)
    function renderItems(itemsToRender) {
        if (!itemList) return;
        itemList.innerHTML = ''; // クリア

        // 現在の表示モードに応じてクラスを切り替え (CSSで制御)
        itemList.className = 'item-list'; // Reset classes
        itemList.classList.add(`display-mode-${currentDisplayMode}`);

        if (itemCountDisplay) {
            itemCountDisplay.textContent = `${itemsToRender.length} 件のアイテムが見つかりました。`;
        }
        if (itemsToRender.length === 0) {
            itemList.innerHTML = '<p>該当するアイテムは見つかりませんでした。</p>';
            return;
        }

        // 表示モードに応じてHTML構造を生成
        if (currentDisplayMode === 'card') {
            renderCardView(itemsToRender);
        } else if (currentDisplayMode === 'list') {
            renderListView(itemsToRender);
        } else if (currentDisplayMode === 'table') {
            renderTableView(itemsToRender);
        }
    }

    // カード表示のレンダリング
    function renderCardView(items) {
        items.forEach(item => {
            const itemCard = document.createElement('div');
            itemCard.classList.add('item-card');
            const imageHtml = item.image
                ? `<img src="${item.image}" alt="${item.name || 'アイテム画像'}" onerror="this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='flex';">
                   <div class="no-image-placeholder" style="display: none;">No Image</div>`
                : `<div class="no-image-placeholder">No Image</div>`; // 画像なしの場合

            let tagsHtml = '';
            if (item.tags && item.tags.length > 0) {
                tagsHtml = `<div class="tags">タグ: ${item.tags.map(tagId => {
                    const tagObj = allTags.find(t => t.id === tagId); // allTagsから検索
                    return `<span>${tagObj ? tagObj.name : '不明'}</span>`;
                }).join(' ')}</div>`;
            }
            itemCard.innerHTML = `
                <div class="item-card-image-container">${imageHtml}</div>
                <h3>${item.name || '名称未設定'}</h3>
                <p><strong>効果:</strong> ${item.effect || '---'}</p>
                <p><strong>入手手段:</strong> ${item.入手手段 || '---'}</p>
                ${tagsHtml}
            `;
            itemList.appendChild(itemCard);
        });
    }

    // リスト表示のレンダリング (簡易版 - クリック詳細未実装)
    function renderListView(items) {
        const ul = document.createElement('ul');
        ul.classList.add('list-view');
        items.forEach(item => {
            const li = document.createElement('li');
            li.textContent = item.name || '名称未設定';
            // TODO: クリックで詳細表示のイベントリスナーを追加
            li.addEventListener('click', () => alert(`詳細表示 (未実装):\n名前: ${item.name}\n効果: ${item.effect}\n入手手段: ${item.入手手段}`));
            ul.appendChild(li);
        });
        itemList.appendChild(ul);
    }

    // テーブル表示のレンダリング (簡易版 - 画像なし)
    function renderTableView(items) {
        const table = document.createElement('table');
        table.classList.add('table-view');
        const thead = table.createTHead();
        const headerRow = thead.insertRow();
        ['名前', '効果', '入手手段', 'タグ'].forEach(text => {
            const th = document.createElement('th');
            th.textContent = text;
            headerRow.appendChild(th);
        });

        const tbody = table.createTBody();
        items.forEach(item => {
            const row = tbody.insertRow();
            const tagsString = item.tags ? item.tags.map(tagId => {
                 const tagObj = allTags.find(t => t.id === tagId);
                 return tagObj ? tagObj.name : '';
            }).filter(Boolean).join(', ') : '---';

            row.insertCell().textContent = item.name || '---';
            row.insertCell().textContent = item.effect || '---';
            row.insertCell().textContent = item.入手手段 || '---';
            row.insertCell().textContent = tagsString;
        });
        itemList.appendChild(table);
    }


    // フィルターとソートを適用して再描画するメイン関数
    function applyFiltersAndRender() {
        let filteredItems = [...allItems]; // 元の配列をコピー

        // 1. テキスト検索フィルター
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : "";
        if (searchTerm) {
            filteredItems = filteredItems.filter(item =>
                (item.name && item.name.toLowerCase().includes(searchTerm)) ||
                (item.effect && item.effect.toLowerCase().includes(searchTerm)) ||
                (item.入手手段 && item.入手手段.toLowerCase().includes(searchTerm))
            );
        }

        // 2. タグフィルター (Level 3 のみ)
        selectedLevel3TagId = categoryLevel3Select ? categoryLevel3Select.value : null; // Level3の選択値を取得
        if (selectedLevel3TagId) {
            filteredItems = filteredItems.filter(item => item.tags && item.tags.includes(selectedLevel3TagId));
        } else if (selectedLevel2TagId) { // Level 3未選択だがLevel 2が選択されている場合
             const level3IdsUnderLevel2 = allTags.filter(t => t.level === 3 && t.parentTagId === selectedLevel2TagId).map(t => t.id);
             filteredItems = filteredItems.filter(item => item.tags && item.tags.some(tId => level3IdsUnderLevel2.includes(tId)));
        } else if (selectedLevel1TagId) { // Level 2, 3未選択だがLevel 1が選択されている場合
            const level2IdsUnderLevel1 = allTags.filter(t => t.level === 2 && t.parentTagId === selectedLevel1TagId).map(t => t.id);
            const level3IdsUnderLevel1 = allTags.filter(t => t.level === 3 && level2IdsUnderLevel1.includes(t.parentTagId)).map(t => t.id);
             filteredItems = filteredItems.filter(item => item.tags && item.tags.some(tId => level3IdsUnderLevel1.includes(tId)));
        }
        // ★★★ AND/OR検索のロジック修正 - 上記階層フィルターを優先し、従来のselectedTagsは一旦使わない方向で調整 ★★★
        // もし複数タグ選択をUIで許容するなら、この部分でAND/ORを実装
        // const currentTagSearchMode = tagSearchAndRadio && tagSearchAndRadio.checked ? 'AND' : 'OR';
        // if (selectedTags.length > 0) { // selectedTagsに選択されたタグIDを入れる処理が必要
        //     if (currentTagSearchMode === 'AND') {
        //         filteredItems = filteredItems.filter(item => item.tags && selectedTags.every(selTagId => item.tags.includes(selTagId)));
        //     } else { // OR
        //         filteredItems = filteredItems.filter(item => item.tags && selectedTags.some(selTagId => item.tags.includes(selTagId)));
        //     }
        // }

        // 3. ソート
        // TODO: ソート機能の実装 (currentSortOrderに基づいてfilteredItemsをソート)
        sortItems(filteredItems, currentSortOrder);


        // 4. レンダリング
        renderItems(filteredItems);
    }

    // ソート関数 (簡易版)
    function sortItems(items, sortOrder) {
         const [field, direction] = sortOrder.split('_'); //例: "name_asc" -> ["name", "asc"]

         items.sort((a, b) => {
             let valA = a[field];
             let valB = b[field];

             // FirestoreのTimestampオブジェクトを比較可能にする (もしcreatedAtを使う場合)
             if (field === 'createdAt' || field === 'updatedAt') {
                 valA = a[field]?.toDate ? a[field].toDate().getTime() : 0;
                 valB = b[field]?.toDate ? b[field].toDate().getTime() : 0;
             }
              // nameがない場合などはデフォルト値を設定
             if (field === 'name') {
                 valA = valA || '';
                 valB = valB || '';
             }


             let comparison = 0;
             if (typeof valA === 'string' && typeof valB === 'string') {
                 comparison = valA.localeCompare(valB, 'ja'); // 日本語対応
             } else {
                 if (valA < valB) comparison = -1;
                 if (valA > valB) comparison = 1;
             }

             return direction === 'desc' ? comparison * -1 : comparison;
         });
    }


    // フィルター条件変更時の共通ハンドラ
    function handleFilterChange() {
        applyFiltersAndRender();
    }

    // イベントリスナーの設定
    if (searchInput) searchInput.addEventListener('input', handleFilterChange);
    if (tagSearchAndRadio) tagSearchAndRadio.addEventListener('change', handleFilterChange);
    if (tagSearchOrRadio) tagSearchOrRadio.addEventListener('change', handleFilterChange);
    if (sortOrderSelect) sortOrderSelect.addEventListener('change', (e) => {
        currentSortOrder = e.target.value;
        handleFilterChange();
    });

    // 表示モード切り替え
    displayModeButtons.forEach(button => {
        button.addEventListener('click', () => {
            currentDisplayMode = button.dataset.mode;
            // アクティブなボタンのスタイル変更
            displayModeButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            // アイテムリストのクラスを更新して再描画（スタイルはCSSで制御）
            if (itemList) {
                 itemList.className = 'item-list'; // Reset
                 itemList.classList.add(`display-mode-${currentDisplayMode}`);
                 // 再描画が必要な場合は filterAndRenderItems を呼ぶか、
                 // renderItems だけを呼ぶ (フィルターやソートは変えずに表示だけ変える)
                 applyFiltersAndRender(); // 今回はフィルター/ソート状態を維持して再描画
            }
        });
    });

    // リセットボタン
    if (resetFiltersButton) {
        resetFiltersButton.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            categoryLevel1Select.value = "";
            populateSelect(categoryLevel2Select, [], "カテゴリ2を選択", true);
            populateSelect(categoryLevel3Select, [], "カテゴリ3を選択", true);
            selectedLevel1TagId = null;
            selectedLevel2TagId = null;
            selectedLevel3TagId = null;
            if (tagSearchAndRadio) tagSearchAndRadio.checked = true; // デフォルトAND
            currentTagSearchMode = 'AND';
            sortOrderSelect.value = 'name_asc'; // デフォルトソート
            currentSortOrder = 'name_asc';

             // 表示モードボタンのデフォルト（カード）をアクティブに
            displayModeButtons.forEach(btn => btn.classList.remove('active'));
            document.querySelector('.display-mode-button[data-mode="card"]').classList.add('active');
            currentDisplayMode = 'card';


            applyFiltersAndRender();
        });
    }

    // 初期データロードを実行
    loadData();
});
