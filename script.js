document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const tagFiltersContainer = document.getElementById('tagFiltersContainer');
    const itemList = document.getElementById('itemList');
    const itemCountDisplay = document.getElementById('itemCount');
    const resetFiltersButton = document.getElementById('resetFiltersButton');

    let allItems = [];
    let availableTags = [];
    let selectedTags = [];

    // データとタグをロード
    async function loadData() {
        try {
            const [itemsResponse, tagsResponse] = await Promise.all([
                fetch('items.json'),
                fetch('tags.json')
            ]);
            if (!itemsResponse.ok || !tagsResponse.ok) {
                throw new Error('データの読み込みに失敗しました。');
            }
            allItems = await itemsResponse.json();
            const tagsData = await tagsResponse.json();
            availableTags = tagsData.available_tags;
            
            renderTags();
            renderItems(allItems);
        } catch (error) {
            console.error(error);
            itemList.innerHTML = `<p style="color: red;">${error.message}</p>`;
        }
    }

    // タグフィルターUIを生成
    function renderTags() {
        tagFiltersContainer.innerHTML = ''; // クリア
        availableTags.forEach(tag => {
            const tagButton = document.createElement('div');
            tagButton.classList.add('tag-filter');
            tagButton.textContent = tag.name;
            tagButton.dataset.tagId = tag.id;
            tagButton.addEventListener('click', () => toggleTag(tagButton, tag.id));
            tagFiltersContainer.appendChild(tagButton);
        });
    }

    // タグ選択のトグル
    function toggleTag(tagButton, tagId) {
        tagButton.classList.toggle('active');
        if (selectedTags.includes(tagId)) {
            selectedTags = selectedTags.filter(t => t !== tagId);
        } else {
            selectedTags.push(tagId);
        }
        filterAndRenderItems();
    }

    // アイテムリストを表示
    function renderItems(itemsToRender) {
        itemList.innerHTML = ''; // クリア
        itemCountDisplay.textContent = `${itemsToRender.length} 件のアイテムが見つかりました。`;

        if (itemsToRender.length === 0) {
            itemList.innerHTML = '<p>該当するアイテムは見つかりませんでした。</p>';
            return;
        }

        itemsToRender.forEach(item => {
            const itemCard = document.createElement('div');
            itemCard.classList.add('item-card');

            // 画像パスが空またはnullの場合、プレースホルダーを使用
            const imagePath = item.image && item.image.trim() !== "" ? item.image : 'images/placeholder_item.png';
            
            let tagsHtml = '';
            if (item.tags && item.tags.length > 0) {
                tagsHtml = `<div class="tags">タグ: ${item.tags.map(tag => `<span>${tag}</span>`).join(' ')}</div>`;
            }

            itemCard.innerHTML = `
                <img src="${imagePath}" alt="${item.name}" onerror="this.onerror=null; this.src='images/placeholder_item.png';">
                <h3>${item.name}</h3>
                <p><strong>効果:</strong> ${item.effect}</p>
                <p><strong>入手手段:</strong> ${item.入手手段}</p>
                ${tagsHtml}
            `;
            itemList.appendChild(itemCard);
        });
    }

    // フィルタリングしてアイテムを表示
    function filterAndRenderItems() {
        const searchTerm = searchInput.value.toLowerCase().trim();
        
        let filteredItems = allItems.filter(item => {
            // テキスト検索
            const matchesSearchTerm = searchTerm === '' ||
                item.name.toLowerCase().includes(searchTerm) ||
                item.effect.toLowerCase().includes(searchTerm) ||
                item.入手手段.toLowerCase().includes(searchTerm);

            // タグ検索 (AND検索)
            const matchesTags = selectedTags.length === 0 ||
                selectedTags.every(tagId => item.tags && item.tags.map(t => t.toLowerCase()).includes(tagId.toLowerCase()));
            
            return matchesSearchTerm && matchesTags;
        });
        
        renderItems(filteredItems);
    }

    // リセットボタンの処理
    function resetFilters() {
        searchInput.value = '';
        selectedTags = [];
        document.querySelectorAll('.tag-filter.active').forEach(button => {
            button.classList.remove('active');
        });
        filterAndRenderItems();
    }

    // イベントリスナー
    searchInput.addEventListener('input', filterAndRenderItems);
    resetFiltersButton.addEventListener('click', resetFilters);

    // 初期ロード
    loadData();
});
