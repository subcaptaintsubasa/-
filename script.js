document.addEventListener('DOMContentLoaded', () => {
    // ▼▼▼ Firebaseプロジェクトの設定情報 (admin.script.js と同じものに置き換えてください) ▼▼▼
    const firebaseConfig = {
        apiKey: "YOUR_API_KEY",
        authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
        projectId: "YOUR_PROJECT_ID",
        storageBucket: "YOUR_PROJECT_ID.appspot.com",
        messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
        appId: "YOUR_APP_ID"
    };
    // ▲▲▲ Firebaseプロジェクトの設定情報 ▲▲▲

    // Firebaseアプリを初期化 (既に初期化済みでなければ)
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const db = firebase.firestore();

    // DOM要素の取得
    const searchInput = document.getElementById('searchInput');
    const tagFiltersContainer = document.getElementById('tagFiltersContainer');
    const itemList = document.getElementById('itemList');
    const itemCountDisplay = document.getElementById('itemCount');
    const resetFiltersButton = document.getElementById('resetFiltersButton');

    let allItems = [];        // Firestoreから取得したアイテムデータ { docId, name, image, effect, 入手手段, tags: [tagDocId1,...] }
    let availableTags = [];   // Firestoreから取得したタグデータ { id: docId, name: tagName }
    let selectedTags = [];    // 選択されたタグのドキュメントIDの配列

    // Firestoreからデータをロードする関数
    async function loadData() {
        try {
            // アイテムデータをFirestoreから取得 (名前順でソート)
            const itemsSnapshot = await db.collection('items').orderBy('name').get();
            allItems = itemsSnapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));

            // タグデータをFirestoreから取得 (名前順でソート)
            const tagsSnapshot = await db.collection('tags').orderBy('name').get();
            availableTags = tagsSnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name })); // idはFirestoreのdoc.id, nameはdoc.data().name

            console.log("User site: Items loaded from Firestore", allItems);
            console.log("User site: Tags loaded from Firestore", availableTags);

            renderTags();          // タグフィルターUIを生成
            renderItems(allItems); // 全アイテムを初期表示
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

    // タグフィルターUIを生成する関数
    function renderTags() {
        if (!tagFiltersContainer) return;
        tagFiltersContainer.innerHTML = ''; // 既存のタグをクリア

        availableTags.forEach(tag => { // availableTagsは {id: docId, name: tagName}
            const tagButton = document.createElement('div');
            tagButton.classList.add('tag-filter');
            tagButton.textContent = tag.name;        // 表示名
            tagButton.dataset.tagId = tag.id;        // FirestoreのドキュメントIDをdata属性に保持

            tagButton.addEventListener('click', () => toggleTag(tagButton, tag.id));
            tagFiltersContainer.appendChild(tagButton);
        });
    }

    // アイテムリストを表示する関数
    function renderItems(itemsToRender) {
        if (!itemList) return;
        itemList.innerHTML = ''; // 既存のアイテムをクリア

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

            // item.image は Firebase Storage の公開URL、またはプレースホルダーのパス
            const imagePath = item.image || 'images/placeholder_item.png';
            
            let tagsHtml = '';
            if (item.tags && item.tags.length > 0) {
                // item.tags にはタグのドキュメントIDの配列が入っている
                tagsHtml = `<div class="tags">タグ: ${item.tags.map(tagId => {
                    const tagObj = availableTags.find(t => t.id === tagId); // FirestoreのdocIdでマッチ
                    return `<span>${tagObj ? tagObj.name : '不明なタグ'}</span>`;
                }).join(' ')}</div>`;
            }

            itemCard.innerHTML = `
                <img src="${imagePath}" alt="${item.name || 'アイテム画像'}" onerror="this.onerror=null; this.src='images/placeholder_item.png';">
                <h3>${item.name || '名称未設定'}</h3>
                <p><strong>効果:</strong> ${item.effect || '未設定'}</p>
                <p><strong>入手手段:</strong> ${item.入手手段 || '未設定'}</p>
                ${tagsHtml}
            `;
            itemList.appendChild(itemCard);
        });
    }

    // テキスト検索とタグフィルターに基づいてアイテムをフィルタリングし再表示する関数
    function filterAndRenderItems() {
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : "";
        
        let filteredItems = allItems.filter(item => {
            // テキスト検索 (名前, 効果, 入手手段)
            const matchesSearchTerm = searchTerm === '' ||
                (item.name && item.name.toLowerCase().includes(searchTerm)) ||
                (item.effect && item.effect.toLowerCase().includes(searchTerm)) ||
                (item.入手手段 && item.入手手段.toLowerCase().includes(searchTerm));

            // タグ検索 (AND検索)
            // item.tags には選択されたタグのID(FirestoreのdocId)がすべて含まれているか
            const matchesTags = selectedTags.length === 0 ||
                (item.tags && selectedTags.every(selTagId => item.tags.includes(selTagId)));
            
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
        filterAndRenderItems(); // フィルターを適用して再表示
    }

    // フィルターをリセットする関数
    function resetFilters() {
        if (searchInput) searchInput.value = '';
        selectedTags = [];
        if (tagFiltersContainer) {
            tagFiltersContainer.querySelectorAll('.tag-filter.active').forEach(button => {
                button.classList.remove('active');
            });
        }
        filterAndRenderItems(); // フィルターを適用して再表示
    }

    // イベントリスナーの設定
    if (searchInput) {
        searchInput.addEventListener('input', filterAndRenderItems);
    }
    if (resetFiltersButton) {
        resetFiltersButton.addEventListener('click', resetFilters);
    }

    // 初期データロードを実行
    loadData();
});
