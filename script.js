// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js"; // 例: 9.6.10 (最新版を確認)
import {
    getFirestore,
    collection,
    getDocs,
    query,
    orderBy,
    where // where句を使う可能性があるのでインポートしておく
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// Your web app's Firebase configuration - ★★★ オリジナルの内容を維持 ★★★
const firebaseConfig = {
  apiKey: "AIzaSyBxrE-9E46dplHTuEBmmcJWQRU1vLgAGAU",
  authDomain: "itemsearchtooleditor.firebaseapp.com",
  projectId: "itemsearchtooleditor", // ← 必須！
  storageBucket: "itemsearchtooleditor.appspot.com", // ← 設定は必要
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

    let allItems = [];        // Firestoreから読み込んだ全アイテムデータ
    let allTags = [];         // Firestoreから読み込んだ全タグデータ {id, name, level, parentTagId}
    let selectedLevel1TagId = null;
    let selectedLevel2TagId = null;
    let selectedLevel3TagId = null;
    let currentTagSearchMode = 'AND'; // 'AND' or 'OR'
    let currentDisplayMode = 'card'; // 'card', 'list', 'table'
    let currentSortOrder = 'name_asc'; // デフォルトのソート順

    // Firestoreからデータロード
    async function loadData() {
        try {
            // アイテムデータ (クライアントサイドでソートするため、一旦全件取得)
            const itemsSnapshot = await getDocs(collection(db, 'items'));
            allItems = itemsSnapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));

            // 全タグデータ (階層構造と名前参照のため)
            const tagsSnapshot = await getDocs(query(collection(db, 'tags'), orderBy('level'), orderBy('name')));
            allTags = tagsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            console.log("User site: Items loaded", allItems);
            console.log("User site: All Tags loaded", allTags);

            populateCategoryFilters(); // カテゴリフィルターの初期化
            applyFiltersAndRender(); // 初期表示

        } catch (error) {
            console.error("Error loading data from Firestore:", error);
            if (itemList) itemList.innerHTML = `<p style="color: red;">データの読み込みに失敗しました。</p>`;
            if (itemCountDisplay) itemCountDisplay.textContent = 'エラー';
        }
    }

    // カテゴリフィルターのドロップダウン生成
    function populateCategoryFilters() {
        const level1Tags = allTags.filter(tag => tag.level === 1);
        populateSelect(categoryLevel1Select, level1Tags, "カテゴリ1を選択");
        // Level 2, 3 は初期状態では空＆無効
        populateSelect(categoryLevel2Select, [], "カテゴリ2を選択", true);
        populateSelect(categoryLevel3Select, [], "カテゴリ3を選択", true);
    }

    // カテゴリ選択変更時のハンドラ
    function handleCategoryChange(event) {
        const level = parseInt(event.target.id.replace('categoryLevel', ''), 10);
        const selectedParentId = event.target.value || null; // 空文字はnull扱い

        if (level === 1) {
            selectedLevel1TagId = selectedParentId;
            selectedLevel2TagId = null; // 下位をリセット
            selectedLevel3TagId = null;
            populateSelect(categoryLevel2Select, filterTagsByParent(selectedLevel1TagId, 2), "カテゴリ2を選択", !selectedLevel1TagId);
            populateSelect(categoryLevel3Select, [], "カテゴリ3を選択", true);
        } else if (level === 2) {
            selectedLevel2TagId = selectedParentId;
            selectedLevel3TagId = null; // Level 3 をリセット
            populateSelect(categoryLevel3Select, filterTagsByParent(selectedLevel2TagId, 3), "カテゴリ3を選択", !selectedLevel2TagId);
        }
        // Level 1 or 2 の変更でもフィルターを即時適用
        applyFiltersAndRender();
    }

     // Level 3 選択変更時のハンドラ
     function handleLevel3Change() {
        selectedLevel3TagId = categoryLevel3Select.value || null;
        applyFiltersAndRender();
     }

    // Select要素にオプションを追加するヘルパー関数
    function populateSelect(selectElement, tags, defaultOptionText, disable = false) {
        if (!selectElement) return;
        selectElement.innerHTML = `<option value="">${defaultOptionText}</option>`;
        tags.forEach(tag => {
            const option = document.createElement('option');
            option.value = tag.id;
            option.textContent = tag.name;
            selectElement.appendChild(option);
        });
        selectElement.disabled = disable;
        if (disable) selectElement.value = ""; // 無効化時は選択をクリア
    }

    // 親IDとレベルに基づいてタグをフィルタリングする関数
    function filterTagsByParent(parentId, targetLevel) {
        if (!parentId) return [];
        return allTags.filter(tag => tag.level === targetLevel && tag.parentTagId === parentId);
    }

    // アイテムリストを表示するメイン関数 (表示モード対応)
    function renderItems(itemsToRender) {
        if (!itemList) return;
        itemList.innerHTML = ''; // 表示をクリア

        // 表示モードに応じてクラスを切り替え (CSSで実際のレイアウトを制御)
        itemList.className = 'item-list'; // 基本クラスリセット
        itemList.classList.add(`display-mode-${currentDisplayMode}`);

        if (itemCountDisplay) {
            itemCountDisplay.textContent = `${itemsToRender.length} 件のアイテムが見つかりました。`;
        }
        if (itemsToRender.length === 0) {
            itemList.innerHTML = '<p>該当するアイテムは見つかりませんでした。</p>';
            return;
        }

        // 表示モードに応じてレンダリング関数を呼び出し
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
            // 画像表示 or No Image表示
            const imageHtml = item.image
                ? `<img src="${item.image}" alt="${item.name || 'アイテム画像'}" onerror="this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='flex';">
                   <div class="no-image-placeholder" style="display: none;">No Image</div>`
                : `<div class="no-image-placeholder">No Image</div>`;

            let tagsHtml = '';
            if (item.tags && item.tags.length > 0) {
                tagsHtml = `<div class="tags">タグ: ${item.tags.map(tagId => {
                    const tagObj = allTags.find(t => t.id === tagId);
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

    // リスト表示のレンダリング (簡易版)
    function renderListView(items) {
        const ul = document.createElement('ul');
        ul.classList.add('list-view');
        items.forEach(item => {
            const li = document.createElement('li');
            li.textContent = item.name || '名称未設定';
            li.title = `効果: ${item.effect || '---'}\n入手手段: ${item.入手手段 || '---'}`; // 簡易ツールチップ
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

        // 2. タグフィルター (階層考慮 & AND/OR)
        selectedLevel3TagId = categoryLevel3Select ? categoryLevel3Select.value : null; // Level3の値が優先
        let targetTagIds = []; // フィルター対象となるレベル3タグIDのリスト

        if (selectedLevel3TagId) {
            targetTagIds = [selectedLevel3TagId]; // Level 3が選択されていれば、それが対象
        } else if (selectedLevel2TagId) { // Level 2が選択されていれば、その下のLevel 3全てが対象
             targetTagIds = allTags.filter(t => t.level === 3 && t.parentTagId === selectedLevel2TagId).map(t => t.id);
        } else if (selectedLevel1TagId) { // Level 1が選択されていれば、その下のLevel 3全てが対象
            const level2Ids = allTags.filter(t => t.level === 2 && t.parentTagId === selectedLevel1TagId).map(t => t.id);
            targetTagIds = allTags.filter(t => t.level === 3 && level2Ids.includes(t.parentTagId)).map(t => t.id);
        }
        // targetTagIds には、選択された階層フィルターに基づいて絞り込むべきLevel 3のタグIDが入る

        if (targetTagIds.length > 0) {
            currentTagSearchMode = tagSearchAndRadio && tagSearchAndRadio.checked ? 'AND' : 'OR';
            if (currentTagSearchMode === 'AND') {
                // AND検索: フィルター対象のすべてのタグIDをアイテムが含んでいるか
                filteredItems = filteredItems.filter(item => item.tags && targetTagIds.every(tagId => item.tags.includes(tagId)));
            } else { // OR
                // OR検索: フィルター対象のタグIDのいずれかをアイテムが含んでいるか
                filteredItems = filteredItems.filter(item => item.tags && targetTagIds.some(tagId => item.tags.includes(tagId)));
            }
        }
        // targetTagIdsが空（カテゴリフィルター未選択）の場合は、タグでの絞り込みは行わない

        // 3. ソート
        sortItems(filteredItems, currentSortOrder);

        // 4. レンダリング
        renderItems(filteredItems);
    }

    // ソート関数
    function sortItems(items, sortOrder) {
         const [field, direction] = sortOrder.split('_');

         items.sort((a, b) => {
             let valA = a[field];
             let valB = b[field];

             if (field === 'createdAt' || field === 'updatedAt') {
                 valA = a[field]?.toDate ? a[field].toDate().getTime() : 0;
                 valB = b[field]?.toDate ? b[field].toDate().getTime() : 0;
             } else if (field === 'name') {
                 valA = valA || ''; // 名前がない場合は空文字として比較
                 valB = valB || '';
             } else {
                 // 他のフィールド（数値など）の比較が必要な場合はここに追加
                 valA = valA || 0; // デフォルトは数値比較を想定
                 valB = valB || 0;
             }

             let comparison = 0;
             if (typeof valA === 'string' && typeof valB === 'string') {
                 comparison = valA.localeCompare(valB, 'ja');
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
    // カテゴリフィルター
    if (categoryLevel1Select) categoryLevel1Select.addEventListener('change', handleCategoryChange);
    if (categoryLevel2Select) categoryLevel2Select.addEventListener('change', handleCategoryChange);
    if (categoryLevel3Select) categoryLevel3Select.addEventListener('change', handleLevel3Change); // Level 3 専用ハンドラ
    // AND/OR切り替え
    if (tagSearchAndRadio) tagSearchAndRadio.addEventListener('change', handleFilterChange);
    if (tagSearchOrRadio) tagSearchOrRadio.addEventListener('change', handleFilterChange);
    // ソート順
    if (sortOrderSelect) sortOrderSelect.addEventListener('change', (e) => {
        currentSortOrder = e.target.value;
        handleFilterChange();
    });
    // 表示モード
    displayModeButtons.forEach(button => {
        button.addEventListener('click', () => {
            currentDisplayMode = button.dataset.mode;
            displayModeButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            applyFiltersAndRender(); // フィルター/ソート状態を維持して再描画
        });
    });
    // リセットボタン
    if (resetFiltersButton) {
        resetFiltersButton.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            if (categoryLevel1Select) categoryLevel1Select.value = "";
            populateSelect(categoryLevel2Select, [], "カテゴリ2を選択", true);
            populateSelect(categoryLevel3Select, [], "カテゴリ3を選択", true);
            selectedLevel1TagId = null;
            selectedLevel2TagId = null;
            selectedLevel3TagId = null;
            if (tagSearchAndRadio) tagSearchAndRadio.checked = true;
            currentTagSearchMode = 'AND';
            if (sortOrderSelect) sortOrderSelect.value = 'name_asc';
            currentSortOrder = 'name_asc';

            // 表示モードをカードにリセット
            displayModeButtons.forEach(btn => btn.classList.remove('active'));
            const cardButton = document.querySelector('.display-mode-button[data-mode="card"]');
            if (cardButton) cardButton.classList.add('active');
            currentDisplayMode = 'card';

            applyFiltersAndRender();
        });
    }

    // 初期データロードを実行
    loadData();
});
