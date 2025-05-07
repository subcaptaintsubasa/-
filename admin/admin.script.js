document.addEventListener('DOMContentLoaded', () => {
    const CORRECT_PASSWORD = "your_very_secret_password123"; // ★★★ 必ず変更してください ★★★
    const LOCAL_STORAGE_ITEMS_KEY = 'adminToolItemsData';
    const LOCAL_STORAGE_TAGS_KEY = 'adminToolTagsData';
    
    // DOM Elements
    const passwordPrompt = document.getElementById('password-prompt');
    const adminContent = document.getElementById('admin-content');
    const loginButton = document.getElementById('loginButton');
    const adminPasswordInput = document.getElementById('adminPasswordInput');
    const passwordError = document.getElementById('passwordError');
    const logoutButton = document.getElementById('logoutButton');
    const exportAllDataButton = document.getElementById('exportAllDataButton');

    const newTagNameInput = document.getElementById('newTagName');
    const addTagButton = document.getElementById('addTagButton');
    const tagListContainer = document.getElementById('tagListContainer');

    const itemForm = document.getElementById('itemForm');
    const itemIdToEditInput = document.getElementById('itemIdToEdit');
    const itemNameInput = document.getElementById('itemName');
    const itemImageFilenameInput = document.getElementById('itemImageFilename');
    const itemImageFilePicker = document.getElementById('itemImageFilePicker'); // ID変更
    const itemImagePreview = document.getElementById('itemImagePreview');
    const itemEffectInput = document.getElementById('itemEffect');
    const itemSourceInput = document.getElementById('itemSource');
    const itemTagsSelectorContainer = document.getElementById('itemTagsSelector');
    const saveItemButton = document.getElementById('saveItemButton');
    const clearFormButton = document.getElementById('clearFormButton');
    
    const itemsTableBody = document.querySelector('#itemsTable tbody');
    const itemSearchAdminInput = document.getElementById('itemSearchAdmin');

    const editTagModal = document.getElementById('editTagModal');
    const editingTagOldIdInput = document.getElementById('editingTagOldId');
    const editingTagNameInput = document.getElementById('editingTagName');
    const saveTagEditButton = document.getElementById('saveTagEditButton');

    let itemsData = [];
    let tagsData = [];

    // --- データ永続化 (localStorage) ---
    function saveDataToLocalStorage() {
        try {
            localStorage.setItem(LOCAL_STORAGE_ITEMS_KEY, JSON.stringify(itemsData));
            localStorage.setItem(LOCAL_STORAGE_TAGS_KEY, JSON.stringify(tagsData));
            console.log("Data saved to localStorage.");
        } catch (e) {
            console.error("Error saving data to localStorage:", e);
            // クォータ超過などのエラーハンドリングをここに追加可能
            alert("ブラウザストレージへのデータの保存に失敗しました。容量がいっぱいである可能性があります。");
        }
    }

    function loadDataFromLocalStorage() {
        const storedItems = localStorage.getItem(LOCAL_STORAGE_ITEMS_KEY);
        const storedTags = localStorage.getItem(LOCAL_STORAGE_TAGS_KEY);
        if (storedItems) {
            try {
                itemsData = JSON.parse(storedItems);
                if (!Array.isArray(itemsData)) itemsData = [];
            } catch (e) { console.error("Error parsing items from localStorage:", e); itemsData = []; }
        }
        if (storedTags) {
            try {
                tagsData = JSON.parse(storedTags);
                if (!Array.isArray(tagsData)) tagsData = [];
            } catch (e) { console.error("Error parsing tags from localStorage:", e); tagsData = []; }
        }
        console.log("Data loaded from localStorage.");
    }

    // --- ユーティリティ ---
    function generateTagId(name) {
        // 提案: タイムスタンプ + ランダム文字列でほぼユニークなIDを生成
        // 表示名とは独立させることで、表示名変更時のID変更問題を回避
        // または、表示名をURLセーフな形に変換し、衝突時はサフィックスをつけるなど
        // 今回はシンプルに、表示名から生成し、衝突を避けるようにする
        if (!name) return `tag_${Date.now()}`; // 空の場合のフォールバック
        let baseId = name.trim().toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[^\w\u3040-\u309f\u30a0-\u30ff\uff66-\uff9f\u4e00-\u9faf-]+/g, ''); // 日本語と英数字アンダースコア以外を除去（甘め）
        if (!baseId) baseId = `tag_${Date.now()}`; // 変換後空になった場合

        let finalId = baseId;
        let counter = 1;
        // 既存IDとの衝突を避ける
        while (tagsData.some(tag => tag.id === finalId)) {
            finalId = `${baseId}_${counter}`;
            counter++;
        }
        return finalId;
    }
    
    function downloadJson(jsonString, filename) {
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    }


    // --- 認証 ---
    function showAdminPanel() {
        passwordPrompt.style.display = 'none';
        adminContent.style.display = 'block';
        loadDataFromLocalStorage(); // localStorageからデータを読み込む
        initializeAdminPanel();
    }
    function showLoginPrompt() {
        passwordPrompt.style.display = 'flex';
        adminContent.style.display = 'none';
        passwordError.textContent = '';
        adminPasswordInput.value = '';
    }
    function checkLoginState() {
        if (sessionStorage.getItem('isAdminAuthenticated') === 'true') {
            showAdminPanel();
        } else {
            showLoginPrompt();
        }
    }

    if (loginButton) { /* ... (変更なし) ... */
        loginButton.addEventListener('click', () => {
            if (adminPasswordInput.value === CORRECT_PASSWORD) {
                sessionStorage.setItem('isAdminAuthenticated', 'true');
                showAdminPanel();
            } else {
                passwordError.textContent = 'パスワードが違います。';
                adminPasswordInput.value = '';
                adminPasswordInput.focus();
            }
        });
    }
    if (logoutButton) { /* ... (変更なし) ... */
        logoutButton.addEventListener('click', () => {
            if (confirm("ログアウトしますか？\n現在の作業内容はブラウザに保存されていますが、エクスポートしていない変更は失われる可能性があります。")) {
                sessionStorage.removeItem('isAdminAuthenticated');
                // itemsData と tagsData は localStorage に残るのでクリアしない
                showLoginPrompt();
            }
        });
    }
    
    // --- エクスポートボタン ---
    if (exportAllDataButton) {
        exportAllDataButton.addEventListener('click', () => {
            if (itemsData.length === 0 && tagsData.length === 0) {
                if (!confirm("データが空ですが、本当にエクスポートしますか？")) return;
            }
            // エクスポート時はユーザー向けサイトと同じ形式にする
            const itemsToExport = itemsData; // そのまま
            const tagsToExport = { available_tags: tagsData };

            downloadJson(JSON.stringify(itemsToExport, null, 2), 'items.json');
            downloadJson(JSON.stringify(tagsToExport, null, 2), 'tags.json');
            alert("items.json と tags.json のダウンロードを開始します。\nGitHubリポジトリへのアップロードを忘れないでください。");
        });
    }

    // --- 初期化 ---
    function initializeAdminPanel() {
        renderTagsForManagement();
        renderItemTagsSelector();
        renderItemsAdminTable();
    }

    // --- タグ管理 ---
    function renderTagsForManagement() { /* ... (変更なし、ID生成ロジックはaddTagButton内で使う) ... */
        if (!tagListContainer) return;
        tagListContainer.innerHTML = '';
        tagsData.sort((a, b) => a.name.localeCompare(b.name)).forEach(tag => {
            const tagBtn = document.createElement('button');
            tagBtn.classList.add('tag-button');
            tagBtn.textContent = tag.name;
            tagBtn.title = `ID: ${tag.id}`;
            
            const editIcon = document.createElement('span');
            editIcon.classList.add('edit-icon', 'action-icon'); // action-iconクラス追加
            editIcon.innerHTML = ' ✎';
            editIcon.title = "このタグを編集";
            editIcon.onclick = (e) => { e.stopPropagation(); openEditTagModal(tag.id, tag.name); };
            tagBtn.appendChild(editIcon);

            const deleteIcon = document.createElement('span');
            deleteIcon.classList.add('delete-icon', 'action-icon'); // action-iconクラス追加
            deleteIcon.innerHTML = ' ×';
            deleteIcon.title = "このタグを削除";
            deleteIcon.onclick = (e) => { e.stopPropagation(); deleteTag(tag.id, tag.name); };
            tagBtn.appendChild(deleteIcon);

            tagListContainer.appendChild(tagBtn);
        });
        renderItemTagsSelector();
    }


    if (addTagButton) {
        addTagButton.addEventListener('click', () => {
            const name = newTagNameInput.value.trim();
            if (!name) { alert("タグ名を入力してください。"); return; }
            
            // 表示名で重複チェック
            if (tagsData.some(tag => tag.name.toLowerCase() === name.toLowerCase())) {
                alert("同じ名前のタグが既に存在します。"); return;
            }
            
            const id = generateTagId(name); // 新しいID生成ロジック
            if (!id) { // 通常はフォールバックがあるので空にはならないはず
                alert("タグIDの生成に失敗しました。"); return;
            }

            tagsData.push({ id, name });
            newTagNameInput.value = '';
            renderTagsForManagement();
            saveDataToLocalStorage(); // ★ 自動保存
        });
    }

    function openEditTagModal(tagId, currentName) { /* ... (変更なし) ... */
        editingTagOldIdInput.value = tagId;
        editingTagNameInput.value = currentName;
        editTagModal.style.display = 'flex';
        editingTagNameInput.focus();
    }

    if (saveTagEditButton) {
        saveTagEditButton.addEventListener('click', () => {
            const oldId = editingTagOldIdInput.value;
            const newName = editingTagNameInput.value.trim();
            if (!newName) { alert("タグ名は空にできません。"); return; }

            // 新しい名前が他の既存タグと衝突しないかチェック (編集対象自身を除く)
            if (tagsData.some(tag => tag.id !== oldId && tag.name.toLowerCase() === newName.toLowerCase())) {
                alert("編集後の名前が、他の既存タグと重複します。"); return;
            }
            
            const tagToUpdate = tagsData.find(t => t.id === oldId);
            if (tagToUpdate) {
                // IDは変更せず、名前のみ変更する方針に（ID変更は影響範囲が大きいので）
                // もしIDも表示名追従で変えたいなら、generateTagId(newName) で新しいIDを生成し、
                // itemsData内の参照もすべて更新する必要がある。
                tagToUpdate.name = newName;
            }

            editTagModal.style.display = 'none';
            renderTagsForManagement();
            renderItemsAdminTable();
            saveDataToLocalStorage(); // ★ 自動保存
        });
    }

    function deleteTag(tagId, tagName) { /* ... (変更部分のみ) ... */
        if (confirm(`タグ「${tagName}」(ID: ${tagId})を削除しますか？\nこのタグを使用している全てのアイテムからも削除されます。`)) {
            tagsData = tagsData.filter(tag => tag.id !== tagId);
            itemsData.forEach(item => {
                if (item.tags) item.tags = item.tags.filter(t => t !== tagId);
            });
            renderTagsForManagement();
            renderItemsAdminTable();
            saveDataToLocalStorage(); // ★ 自動保存
        }
    }
    
    // --- アイテムフォームのタグ選択 ---
    function renderItemTagsSelector(selectedItemTags = []) { /* ... (変更なし) ... */
        if (!itemTagsSelectorContainer) return;
        itemTagsSelectorContainer.innerHTML = '';
        tagsData.forEach(tag => {
            const tagBtn = document.createElement('button');
            tagBtn.type = 'button';
            tagBtn.classList.add('tag-button');
            tagBtn.textContent = tag.name;
            tagBtn.dataset.tagId = tag.id;
            if (selectedItemTags.includes(tag.id)) {
                tagBtn.classList.add('selected');
            }
            tagBtn.addEventListener('click', () => {
                tagBtn.classList.toggle('selected');
            });
            itemTagsSelectorContainer.appendChild(tagBtn);
        });
    }

    // --- 画像ファイルピッカーとプレビュー ---
    if (itemImageFilePicker) {
        itemImageFilePicker.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    itemImagePreview.src = e.target.result;
                    itemImagePreview.style.display = 'block';
                }
                reader.readAsDataURL(file);
                // ファイル名を自動で入力欄にセット
                if (itemImageFilenameInput) {
                    itemImageFilenameInput.value = file.name;
                }
            } else {
                itemImagePreview.src = '#';
                itemImagePreview.style.display = 'none';
                // ファイル選択がキャンセルされた場合、ファイル名入力欄はクリアしない方が良いかもしれない
                // (手動で入力したファイル名を保持するため)
            }
        });
    }

    // --- アイテム管理 ---
    function getNextItemId() { /* ... (変更なし) ... */
        if (itemsData.length === 0) return 1;
        const maxId = Math.max(0, ...itemsData.map(item => (typeof item.id === 'number' ? item.id : 0)));
        return maxId + 1;
    }

    if (itemForm) {
        itemForm.addEventListener('submit', (e) => { /* ... (変更部分のみ) ... */
            e.preventDefault();
            const name = itemNameInput.value.trim();
            const imageFilename = itemImageFilenameInput.value.trim(); // ★ 必須入力になった
            const effect = itemEffectInput.value.trim();
            const source = itemSourceInput.value.trim();
            const selectedTagIds = Array.from(itemTagsSelectorContainer.querySelectorAll('.tag-button.selected'))
                                      .map(btn => btn.dataset.tagId);
            const editingId = itemIdToEditInput.value ? parseInt(itemIdToEditInput.value, 10) : null;

            if (!name || !imageFilename || !effect || !source) { // imageFilenameもチェック
                alert("名前、画像ファイル名、効果、入手手段は必須です。"); return; 
            }
            
            // ... (以降のアイテムデータ作成、保存ロジックはほぼ同じ) ...
            const newItemData = {
                name,
                image: imageFilename.startsWith('images/') ? imageFilename : `images/${imageFilename}`,
                effect,
                入手手段: source,
                tags: selectedTagIds
            };
            
            if (editingId) {
                newItemData.id = editingId;
                const index = itemsData.findIndex(item => item.id === editingId);
                if (index > -1) itemsData[index] = newItemData;
                else { newItemData.id = getNextItemId(); itemsData.push(newItemData); }
            } else {
                newItemData.id = getNextItemId();
                itemsData.push(newItemData);
            }
            
            itemsData.sort((a,b) => a.name.localeCompare(b.name));
            renderItemsAdminTable();
            clearItemForm();
            saveDataToLocalStorage(); // ★ 自動保存
        });
    }

    if (clearFormButton) { /* ... (変更なし) ... */
        clearFormButton.addEventListener('click', clearItemForm);
    }

    function clearItemForm() { /* ... (変更なし、itemImageFilePickerのクリアも含む) ... */
        if (itemForm) itemForm.reset();
        if (itemIdToEditInput) itemIdToEditInput.value = '';
        if (itemImagePreview) { itemImagePreview.src = '#'; itemImagePreview.style.display = 'none'; }
        if (itemImageFilePicker) itemImageFilePicker.value = null; 
        renderItemTagsSelector();
        if (saveItemButton) saveItemButton.textContent = "アイテム保存";
    }

    function renderItemsAdminTable() { /* ... (変更なし) ... */
        if (!itemsTableBody) return;
        itemsTableBody.innerHTML = '';
        const searchTerm = itemSearchAdminInput ? itemSearchAdminInput.value.toLowerCase() : "";

        const filteredItems = itemsData.filter(item => item.name.toLowerCase().includes(searchTerm));

        filteredItems.forEach(item => {
            const tr = document.createElement('tr');
            const imagePath = item.image || 'images/placeholder_item.png';
            const itemTagsString = item.tags ? item.tags.map(tagId => {
                const tagObj = tagsData.find(t => t.id === tagId);
                return tagObj ? tagObj.name : `(ID: ${tagId})`;
            }).join(', ') : 'なし';
            const effectExcerpt = item.effect ? (item.effect.length > 30 ? item.effect.substring(0, 30) + '...' : item.effect) : '';


            tr.innerHTML = `
                <td><img src="../${imagePath}" alt="${item.name}" onerror="this.src='../images/placeholder_item.png';"></td>
                <td>${item.name} (ID: ${item.id || '未設定'})</td>
                <td>${effectExcerpt}</td>
                <td>${itemTagsString}</td>
                <td>
                    <button class="edit-item" data-item-id="${item.id}" title="編集">✎</button>
                    <button class="delete-item" data-item-id="${item.id}" title="削除">×</button>
                </td>
            `;
            const editBtn = tr.querySelector('.edit-item');
            const deleteBtn = tr.querySelector('.delete-item');
            if(editBtn) editBtn.addEventListener('click', () => loadItemForEdit(item.id));
            if(deleteBtn) deleteBtn.addEventListener('click', () => deleteItem(item.id));
            itemsTableBody.appendChild(tr);
        });
    }

    if (itemSearchAdminInput) { /* ... (変更なし) ... */
        itemSearchAdminInput.addEventListener('input', renderItemsAdminTable);
    }

    function loadItemForEdit(itemId) { /* ... (変更なし、itemImageFilePickerのクリアも含む) ... */
        const item = itemsData.find(i => i.id === itemId);
        if (item) {
            if(itemIdToEditInput) itemIdToEditInput.value = item.id;
            if(itemNameInput) itemNameInput.value = item.name;
            if(itemImageFilenameInput) itemImageFilenameInput.value = item.image ? item.image.replace(/^images\//, '') : '';
            if(itemEffectInput) itemEffectInput.value = item.effect;
            if(itemSourceInput) itemSourceInput.value = item.入手手段;
            renderItemTagsSelector(item.tags || []);
            if(saveItemButton) saveItemButton.textContent = "アイテム更新";

            itemImagePreview.src = item.image ? `../${item.image}` : '#';
            itemImagePreview.style.display = item.image ? 'block' : 'none';
            if (itemImageFilePicker) itemImageFilePicker.value = null; 


            if(itemForm) itemForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    function deleteItem(itemId) { /* ... (変更部分のみ) ... */
        const itemToDelete = itemsData.find(i => i.id === itemId);
        if (itemToDelete && confirm(`アイテム「${itemToDelete.name}」(ID: ${itemId})を削除しますか？`)) {
            itemsData = itemsData.filter(item => item.id !== itemId);
            renderItemsAdminTable();
            if (itemIdToEditInput.value === String(itemId)) clearItemForm();
            saveDataToLocalStorage(); // ★ 自動保存
        }
    }
    
    // モーダル関連
    const closeButtons = document.querySelectorAll('.modal .close-button');
    closeButtons.forEach(btn => {
        btn.onclick = function() {
            btn.closest('.modal').style.display = "none";
        }
    });
    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = "none";
        }
    }

    checkLoginState();
});
