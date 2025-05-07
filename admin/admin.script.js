document.addEventListener('DOMContentLoaded', () => {
    const CORRECT_PASSWORD = "your_very_secret_password123"; // ★★★ 必ず変更してください ★★★
    
    // DOM Elements (主要なもの)
    const passwordPrompt = document.getElementById('password-prompt');
    const adminContent = document.getElementById('admin-content');
    const loginButton = document.getElementById('loginButton');
    const adminPasswordInput = document.getElementById('adminPasswordInput');
    const passwordError = document.getElementById('passwordError');
    const logoutButton = document.getElementById('logoutButton');

    const loadItemsFile = document.getElementById('loadItemsFile');
    const loadTagsFile = document.getElementById('loadTagsFile');
    const loadItemsMessage = document.getElementById('loadItemsMessage');
    const loadTagsMessage = document.getElementById('loadTagsMessage');
    const saveDataButton = document.getElementById('saveDataButton');

    const newTagNameInput = document.getElementById('newTagName');
    const addTagButton = document.getElementById('addTagButton');
    const tagListContainer = document.getElementById('tagListContainer');

    const itemForm = document.getElementById('itemForm');
    const itemIdToEditInput = document.getElementById('itemIdToEdit');
    const itemNameInput = document.getElementById('itemName');
    const itemImageFilenameInput = document.getElementById('itemImageFilename');
    const itemImagePreviewFileInput = document.getElementById('itemImagePreviewFile');
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


    let itemsData = []; // {id, name, image, effect, 入手手段, tags: [tagId1, tagId2]}
    let tagsData = [];  // {id, name}

    // --- ユーティリティ ---
    function generateTagId(name) {
        if (!name) return '';
        return name.trim().toLowerCase()
            .replace(/\s+/g, '_') // スペースをアンダースコアに
            .replace(/[^a-z0-9_]/g, ''); // 英数字とアンダースコア以外を除去
    }

    // --- 認証 ---
    function showAdminPanel() {
        passwordPrompt.style.display = 'none';
        adminContent.style.display = 'block';
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

    if (loginButton) {
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
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            sessionStorage.removeItem('isAdminAuthenticated');
            itemsData = []; tagsData = [];
            showLoginPrompt();
        });
    }
    
    // --- 初期化 ---
    function initializeAdminPanel() {
        renderTagsForManagement();
        renderItemTagsSelector();
        renderItemsAdminTable();
    }

    // --- データI/O ---
    if (loadItemsFile) {
        loadItemsFile.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        itemsData = JSON.parse(e.target.result);
                        if (!Array.isArray(itemsData)) itemsData = [];
                        loadItemsMessage.textContent = `${itemsData.length}件のアイテムを読み込みました。ファイル名: ${file.name}`;
                        renderItemsAdminTable();
                    } catch (err) {
                        loadItemsMessage.textContent = `items.json の読み込みエラー: ${err}`; itemsData = [];
                    }
                };
                reader.readAsText(file);
            }
        });
    }
    if (loadTagsFile) {
        loadTagsFile.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const loaded = JSON.parse(e.target.result);
                        tagsData = (loaded && Array.isArray(loaded.available_tags)) ? loaded.available_tags : (Array.isArray(loaded) ? loaded : []);
                        loadTagsMessage.textContent = `${tagsData.length}件のタグを読み込みました。ファイル名: ${file.name}`;
                        initializeAdminPanel(); // タグデータが変わったので全体を再描画
                    } catch (err) {
                        loadTagsMessage.textContent = `tags.json の読み込みエラー: ${err}`; tagsData = [];
                    }
                };
                reader.readAsText(file);
            }
        });
    }
    if (saveDataButton) {
        saveDataButton.addEventListener('click', () => {
            if (itemsData.length === 0 && tagsData.length === 0 && !confirm("データが空ですが、本当に保存しますか？")) return;
            downloadJson(JSON.stringify(itemsData, null, 2), 'items.json');
            downloadJson(JSON.stringify({ available_tags: tagsData }, null, 2), 'tags.json');
            alert("items.json と tags.json のダウンロードを開始します。\nGitHubリポジトリへのアップロードを忘れないでください。");
        });
    }
    function downloadJson(jsonString, filename) {
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    }

    // --- タグ管理 ---
    function renderTagsForManagement() {
        if (!tagListContainer) return;
        tagListContainer.innerHTML = '';
        tagsData.sort((a, b) => a.name.localeCompare(b.name)).forEach(tag => {
            const tagBtn = document.createElement('button');
            tagBtn.classList.add('tag-button');
            tagBtn.textContent = tag.name;
            tagBtn.title = `ID: ${tag.id}`;
            
            const editIcon = document.createElement('span');
            editIcon.classList.add('edit-icon');
            editIcon.innerHTML = ' ✎'; // Pencil icon
            editIcon.title = "このタグを編集";
            editIcon.onclick = (e) => { e.stopPropagation(); openEditTagModal(tag.id, tag.name); };
            tagBtn.appendChild(editIcon);

            const deleteIcon = document.createElement('span');
            deleteIcon.classList.add('delete-icon');
            deleteIcon.innerHTML = ' ×'; // Multiplication sign for delete
            deleteIcon.title = "このタグを削除";
            deleteIcon.onclick = (e) => { e.stopPropagation(); deleteTag(tag.id, tag.name); };
            tagBtn.appendChild(deleteIcon);

            tagListContainer.appendChild(tagBtn);
        });
        renderItemTagsSelector(); // アイテムフォームのタグ選択も更新
    }

    if (addTagButton) {
        addTagButton.addEventListener('click', () => {
            const name = newTagNameInput.value.trim();
            if (!name) { alert("タグ名を入力してください。"); return; }
            const id = generateTagId(name);
            if (!id) { alert("有効なタグIDを生成できませんでした。別の名前を試してください。"); return; }
            if (tagsData.some(tag => tag.id === id || tag.name.toLowerCase() === name.toLowerCase())) {
                alert("同じ名前またはIDのタグが既に存在します。"); return;
            }
            tagsData.push({ id, name });
            newTagNameInput.value = '';
            renderTagsForManagement();
        });
    }

    function openEditTagModal(tagId, currentName) {
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

            const newId = generateTagId(newName);
            if (!newId) { alert("有効な新しいタグIDを生成できませんでした。"); return; }

            // 新しい名前やIDが他の既存タグと衝突しないかチェック (編集対象自身を除く)
            if (tagsData.some(tag => tag.id !== oldId && (tag.id === newId || tag.name.toLowerCase() === newName.toLowerCase()))) {
                alert("編集後の名前またはIDが、他の既存タグと重複します。"); return;
            }

            const tagIndex = tagsData.findIndex(t => t.id === oldId);
            if (tagIndex > -1) {
                tagsData[tagIndex].name = newName;
                const oldGeneratedId = tagsData[tagIndex].id; // IDも更新する
                tagsData[tagIndex].id = newId; 

                // アイテムデータ内のタグIDも更新
                itemsData.forEach(item => {
                    if (item.tags && item.tags.includes(oldGeneratedId)) {
                        item.tags = item.tags.map(tId => tId === oldGeneratedId ? newId : tId);
                    }
                });
            }
            editTagModal.style.display = 'none';
            renderTagsForManagement();
            renderItemsAdminTable(); // アイテムの表示も更新
        });
    }


    function deleteTag(tagId, tagName) {
        if (confirm(`タグ「${tagName}」(ID: ${tagId})を削除しますか？\nこのタグを使用している全てのアイテムからも削除されます。`)) {
            tagsData = tagsData.filter(tag => tag.id !== tagId);
            itemsData.forEach(item => {
                if (item.tags) item.tags = item.tags.filter(t => t !== tagId);
            });
            renderTagsForManagement();
            renderItemsAdminTable();
        }
    }
    
    // --- アイテムフォームのタグ選択 ---
    function renderItemTagsSelector(selectedItemTags = []) {
        if (!itemTagsSelectorContainer) return;
        itemTagsSelectorContainer.innerHTML = '';
        tagsData.forEach(tag => {
            const tagBtn = document.createElement('button');
            tagBtn.type = 'button'; // formのsubmitを防ぐ
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

    // --- 画像プレビュー ---
    if (itemImagePreviewFileInput) {
        itemImagePreviewFileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    itemImagePreview.src = e.target.result;
                    itemImagePreview.style.display = 'block';
                }
                reader.readAsDataURL(file);
                // プレビュー用に選択されたファイル名を自動でファイル名入力欄に入れる (任意)
                // itemImageFilenameInput.value = file.name; 
            } else {
                itemImagePreview.src = '#';
                itemImagePreview.style.display = 'none';
            }
        });
    }

    // --- アイテム管理 ---
    function getNextItemId() {
        if (itemsData.length === 0) return 1;
        const maxId = Math.max(0, ...itemsData.map(item => (typeof item.id === 'number' ? item.id : 0)));
        return maxId + 1;
    }

    if (itemForm) {
        itemForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = itemNameInput.value.trim();
            const imageFilename = itemImageFilenameInput.value.trim();
            const effect = itemEffectInput.value.trim();
            const source = itemSourceInput.value.trim();
            const selectedTagIds = Array.from(itemTagsSelectorContainer.querySelectorAll('.tag-button.selected'))
                                      .map(btn => btn.dataset.tagId);
            const editingId = itemIdToEditInput.value ? parseInt(itemIdToEditInput.value, 10) : null;

            if (!name || !effect || !source) { alert("名前、効果、入手手段は必須です。"); return; }
            if (!imageFilename) { alert("画像ファイル名を入力してください。"); return; }


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
                else { newItemData.id = getNextItemId(); itemsData.push(newItemData); } // Fallback
            } else {
                newItemData.id = getNextItemId();
                itemsData.push(newItemData);
            }
            
            itemsData.sort((a,b) => a.name.localeCompare(b.name));
            renderItemsAdminTable();
            clearItemForm();
        });
    }

    if (clearFormButton) clearFormButton.addEventListener('click', clearItemForm);

    function clearItemForm() {
        if (itemForm) itemForm.reset();
        if (itemIdToEditInput) itemIdToEditInput.value = '';
        if (itemImagePreview) { itemImagePreview.src = '#'; itemImagePreview.style.display = 'none'; }
        if (itemImagePreviewFileInput) itemImagePreviewFileInput.value = null; // クリア
        renderItemTagsSelector(); // タグ選択もクリア
        if (saveItemButton) saveItemButton.textContent = "アイテム保存";
    }

    function renderItemsAdminTable() {
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

    if (itemSearchAdminInput) itemSearchAdminInput.addEventListener('input', renderItemsAdminTable);

    function loadItemForEdit(itemId) {
        const item = itemsData.find(i => i.id === itemId);
        if (item) {
            if(itemIdToEditInput) itemIdToEditInput.value = item.id;
            if(itemNameInput) itemNameInput.value = item.name;
            if(itemImageFilenameInput) itemImageFilenameInput.value = item.image ? item.image.replace(/^images\//, '') : '';
            if(itemEffectInput) itemEffectInput.value = item.effect;
            if(itemSourceInput) itemSourceInput.value = item.入手手段;
            renderItemTagsSelector(item.tags || []);
            if(saveItemButton) saveItemButton.textContent = "アイテム更新";

            itemImagePreview.src = item.image ? `../${item.image}` : '#'; // プレビュー画像も設定
            itemImagePreview.style.display = item.image ? 'block' : 'none';
            if (itemImagePreviewFileInput) itemImagePreviewFileInput.value = null; 


            if(itemForm) itemForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    function deleteItem(itemId) {
        const itemToDelete = itemsData.find(i => i.id === itemId);
        if (itemToDelete && confirm(`アイテム「${itemToDelete.name}」(ID: ${itemId})を削除しますか？`)) {
            itemsData = itemsData.filter(item => item.id !== itemId);
            renderItemsAdminTable();
            if (itemIdToEditInput.value === String(itemId)) clearItemForm();
        }
    }
    
    // モーダルの閉じるボタン (もしあれば)
    const closeButtons = document.querySelectorAll('.modal .close-button');
    closeButtons.forEach(btn => {
        btn.onclick = function() {
            btn.closest('.modal').style.display = "none";
        }
    });
    window.onclick = function(event) { // モーダル外クリックで閉じる
        if (event.target.classList.contains('modal')) {
            event.target.style.display = "none";
        }
    }

    checkLoginState(); // 初期認証チェック
});
