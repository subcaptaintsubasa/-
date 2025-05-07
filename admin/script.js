document.addEventListener('DOMContentLoaded', () => {
    const CORRECT_PASSWORD = "your_very_secret_password123"; // ★★★ 必ず変更してください ★★★
    
    const passwordPrompt = document.getElementById('password-prompt');
    const adminContent = document.getElementById('admin-content');
    const loginButton = document.getElementById('loginButton'); // IDがHTMLと一致しているか確認
    const adminPasswordInput = document.getElementById('adminPasswordInput');
    const passwordError = document.getElementById('passwordError');
    const logoutButton = document.getElementById('logoutButton');

    const loadItemsFile = document.getElementById('loadItemsFile');
    const loadTagsFile = document.getElementById('loadTagsFile');
    const saveDataButton = document.getElementById('saveDataButton');

    const newTagIdInput = document.getElementById('newTagId');
    const newTagNameInput = document.getElementById('newTagName');
    const addTagButton = document.getElementById('addTagButton');
    const tagListContainer = document.getElementById('tagListContainer');

    const itemForm = document.getElementById('itemForm');
    const itemIdToEditInput = document.getElementById('itemIdToEdit');
    const itemNameInput = document.getElementById('itemName');
    const itemImageInput = document.getElementById('itemImage');
    const itemEffectInput = document.getElementById('itemEffect');
    const itemSourceInput = document.getElementById('itemSource');
    const itemTagsCheckboxesContainer = document.getElementById('itemTagsCheckboxes');
    const saveItemButton = document.getElementById('saveItemButton'); // HTMLにこのIDがあるか確認
    const clearFormButton = document.getElementById('clearFormButton');
    
    const itemsTableBody = document.querySelector('#itemsTable tbody');
    const itemSearchAdminInput = document.getElementById('itemSearchAdmin');

    let itemsData = [];
    let tagsData = [];

    // --- 認証 ---
    function showAdminPanel() {
        passwordPrompt.style.display = 'none';
        adminContent.style.display = 'block';
        initializeAdminPanel(); // 管理パネルのコンテンツを初期化・表示
    }

    function showLoginPrompt() {
        passwordPrompt.style.display = 'flex'; // flexで中央寄せを維持
        adminContent.style.display = 'none';
        passwordError.textContent = ''; // エラーメッセージをクリア
        adminPasswordInput.value = ''; // パスワード入力欄をクリア
    }

    function checkLoginState() {
        if (sessionStorage.getItem('isAdminAuthenticated') === 'true') {
            showAdminPanel();
        } else {
            showLoginPrompt();
        }
    }

    // ログインボタンのイベントリスナーは、要素が確実に存在してから設定
    if (loginButton) {
        loginButton.addEventListener('click', () => {
            if (adminPasswordInput.value === CORRECT_PASSWORD) {
                sessionStorage.setItem('isAdminAuthenticated', 'true');
                showAdminPanel(); // ログイン成功、管理パネル表示
            } else {
                passwordError.textContent = 'パスワードが違います。';
                adminPasswordInput.value = ''; // 間違えたら入力欄をクリア
                adminPasswordInput.focus(); // 再度入力しやすいようにフォーカス
            }
        });
    } else {
        console.error("Login button not found. Check ID 'loginButton' in admin.html.");
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            sessionStorage.removeItem('isAdminAuthenticated');
            itemsData = []; // ログアウト時にデータをクリア
            tagsData = [];
            showLoginPrompt(); // ログアウト後、ログイン画面表示
        });
    } else {
        console.error("Logout button not found. Check ID 'logoutButton' in admin.html.");
    }
    
    // --- 初期化 ---
    function initializeAdminPanel() {
        // データの読み込みや表示処理はここで行う
        // (既存のJSONファイルがあれば読み込む、タグリスト表示、アイテムリスト表示など)
        // この関数は、認証成功後に一度だけ呼ばれるのが理想
        renderTagsAdmin();
        renderItemsAdminTable();
        renderItemTagsCheckboxes();
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
                        alert(`${itemsData.length}件のアイテムを読み込みました。`);
                        renderItemsAdminTable();
                    } catch (err) {
                        alert("items.json の読み込みまたはパースに失敗: " + err);
                        itemsData = [];
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
                        if (loaded && Array.isArray(loaded.available_tags)) {
                            tagsData = loaded.available_tags;
                        } else if (Array.isArray(loaded)) {
                            tagsData = loaded;
                        } else {
                            tagsData = [];
                        }
                        alert(`${tagsData.length}件のタグを読み込みました。`);
                        renderTagsAdmin();
                        renderItemTagsCheckboxes();
                    } catch (err) {
                        alert("tags.json の読み込みまたはパースに失敗: " + err);
                        tagsData = [];
                    }
                };
                reader.readAsText(file);
            }
        });
    }

    if (saveDataButton) {
        saveDataButton.addEventListener('click', () => {
            if (itemsData.length === 0 && tagsData.length === 0) {
                if (!confirm("データが空ですが、本当に保存しますか？")) return;
            }
            const itemsJsonString = JSON.stringify(itemsData, null, 2);
            downloadJson(itemsJsonString, 'items.json');
            const tagsJsonForUser = { available_tags: tagsData };
            const tagsJsonString = JSON.stringify(tagsJsonForUser, null, 2);
            downloadJson(tagsJsonString, 'tags.json');
            alert("items.json と tags.json のダウンロードを開始します。");
        });
    }

    function downloadJson(jsonString, filename) {
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // --- タグ管理 ---
    function renderTagsAdmin() {
        if (!tagListContainer) return; // 要素がなければ何もしない
        tagListContainer.innerHTML = '';
        tagsData.forEach(tag => {
            const tagDiv = document.createElement('div');
            tagDiv.classList.add('tag-item');
            tagDiv.innerHTML = `
                <span>ID: ${tag.id}, 表示名: ${tag.name}</span>
                <button data-tag-id="${tag.id}">削除</button>
            `;
            tagDiv.querySelector('button').addEventListener('click', () => deleteTag(tag.id));
            tagListContainer.appendChild(tagDiv);
        });
        renderItemTagsCheckboxes();
    }

    if (addTagButton) {
        addTagButton.addEventListener('click', () => {
            const id = newTagIdInput.value.trim();
            const name = newTagNameInput.value.trim();
            if (!id || !name) {
                alert("タグIDと表示名の両方を入力してください。");
                return;
            }
            if (tagsData.some(tag => tag.id === id)) {
                alert("同じIDのタグが既に存在します。");
                return;
            }
            tagsData.push({ id, name });
            tagsData.sort((a, b) => a.name.localeCompare(b.name));
            newTagIdInput.value = '';
            newTagNameInput.value = '';
            renderTagsAdmin();
        });
    }

    function deleteTag(tagId) {
        if (confirm(`タグID「${tagId}」を削除しますか？このタグを使用しているアイテムからも削除されます。`)) {
            tagsData = tagsData.filter(tag => tag.id !== tagId);
            itemsData.forEach(item => {
                if (item.tags) {
                    item.tags = item.tags.filter(t => t !== tagId);
                }
            });
            renderTagsAdmin();
            renderItemsAdminTable();
        }
    }
    
    // --- アイテムフォームのタグチェックボックス ---
    function renderItemTagsCheckboxes(selectedTagIds = []) {
        if (!itemTagsCheckboxesContainer) return; // 要素がなければ何もしない
        itemTagsCheckboxesContainer.innerHTML = '';
        tagsData.forEach(tag => {
            const label = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = tag.id;
            checkbox.name = 'itemTag';
            checkbox.checked = selectedTagIds.includes(tag.id);
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(` ${tag.name} (${tag.id})`));
            itemTagsCheckboxesContainer.appendChild(label);
        });
    }

    // --- アイテム管理 ---
    function getNextItemId() {
        if (itemsData.length === 0) return 1;
        const maxId = Math.max(...itemsData.map(item => (typeof item.id === 'number' ? item.id : 0)));
        return maxId + 1;
    }

    if (itemForm) {
        itemForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = itemNameInput.value.trim();
            const image = itemImageInput.value.trim();
            const effect = itemEffectInput.value.trim();
            const source = itemSourceInput.value.trim();
            const selectedTags = Array.from(itemTagsCheckboxesContainer.querySelectorAll('input[name="itemTag"]:checked'))
                                      .map(cb => cb.value);
            const editingId = itemIdToEditInput.value ? parseInt(itemIdToEditInput.value, 10) : null;

            if (!name || !effect || !source) {
                alert("名前、効果、入手手段は必須です。");
                return;
            }

            const newItemData = {
                name,
                image: image ? (image.startsWith('images/') ? image : `images/${image}`) : 'images/placeholder_item.png',
                effect,
                入手手段: source,
                tags: selectedTags
            };
            
            if (editingId) {
                newItemData.id = editingId;
                const index = itemsData.findIndex(item => item.id === editingId);
                if (index > -1) {
                    itemsData[index] = newItemData;
                } else {
                    newItemData.id = getNextItemId();
                    itemsData.push(newItemData);
                }
            } else {
                newItemData.id = getNextItemId();
                itemsData.push(newItemData);
            }
            
            itemsData.sort((a,b) => a.name.localeCompare(b.name));
            renderItemsAdminTable();
            clearItemForm();
        });
    }

    if (clearFormButton) {
        clearFormButton.addEventListener('click', clearItemForm);
    }

    function clearItemForm() {
        if (itemForm) itemForm.reset();
        if (itemIdToEditInput) itemIdToEditInput.value = '';
        renderItemTagsCheckboxes();
        if (saveItemButton) saveItemButton.textContent = "アイテム保存";
    }

    function renderItemsAdminTable() {
        if (!itemsTableBody) return;
        itemsTableBody.innerHTML = '';
        const searchTerm = itemSearchAdminInput ? itemSearchAdminInput.value.toLowerCase() : "";

        const filteredItems = itemsData.filter(item => 
            item.name.toLowerCase().includes(searchTerm)
        );

        filteredItems.forEach(item => {
            const tr = document.createElement('tr');
            const imagePath = item.image || 'images/placeholder_item.png';
            const itemTagsString = item.tags ? item.tags.map(tagId => {
                const tagObj = tagsData.find(t => t.id === tagId);
                return tagObj ? tagObj.name : tagId;
            }).join(', ') : '';

            tr.innerHTML = `
                <td><img src="../${imagePath}" alt="${item.name}" onerror="this.src='../images/placeholder_item.png';"></td>
                <td>${item.name} (ID: ${item.id || '未設定'})</td>
                <td>${itemTagsString}</td>
                <td>
                    <button class="edit-item" data-item-id="${item.id}">編集</button>
                    <button class="delete-item" data-item-id="${item.id}">削除</button>
                </td>
            `;
            const editBtn = tr.querySelector('.edit-item');
            const deleteBtn = tr.querySelector('.delete-item');
            if(editBtn) editBtn.addEventListener('click', () => loadItemForEdit(item.id));
            if(deleteBtn) deleteBtn.addEventListener('click', () => deleteItem(item.id));
            itemsTableBody.appendChild(tr);
        });
    }

    if (itemSearchAdminInput) {
        itemSearchAdminInput.addEventListener('input', renderItemsAdminTable);
    }

    function loadItemForEdit(itemId) {
        const item = itemsData.find(i => i.id === itemId);
        if (item) {
            if(itemIdToEditInput) itemIdToEditInput.value = item.id;
            if(itemNameInput) itemNameInput.value = item.name;
            if(itemImageInput) itemImageInput.value = item.image ? item.image.replace(/^images\//, '') : '';
            if(itemEffectInput) itemEffectInput.value = item.effect;
            if(itemSourceInput) itemSourceInput.value = item.入手手段;
            renderItemTagsCheckboxes(item.tags || []);
            if(saveItemButton) saveItemButton.textContent = "アイテム更新";
            if(itemForm) itemForm.scrollIntoView({ behavior: 'smooth' });
        }
    }

    function deleteItem(itemId) {
        if (confirm(`アイテムID「${itemId}」を削除しますか？`)) {
            itemsData = itemsData.filter(item => item.id !== itemId);
            renderItemsAdminTable();
            clearItemForm();
        }
    }

    // 初期状態チェック (ページ読み込み時に実行)
    checkLoginState();
});
