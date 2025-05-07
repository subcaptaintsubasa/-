document.addEventListener('DOMContentLoaded', () => {
    const CORRECT_PASSWORD = "your_very_secret_password123"; // ★★★ 必ず変更してください ★★★
    
    const passwordPrompt = document.getElementById('password-prompt');
    const adminContent = document.getElementById('admin-content');
    const loginButton = document.getElementById('loginButton');
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
    const saveItemButton = document.getElementById('saveItemButton');
    const clearFormButton = document.getElementById('clearFormButton');
    
    const itemsTableBody = document.querySelector('#itemsTable tbody');
    const itemSearchAdminInput = document.getElementById('itemSearchAdmin');

    let itemsData = []; // {id, name, image, effect, 入手手段, tags: []}
    let tagsData = [];  // {id, name} - idはタグの一意な文字列, nameは表示名

    // --- 認証 ---
    function checkLogin() {
        if (sessionStorage.getItem('isAdminAuthenticated') === 'true') {
            passwordPrompt.style.display = 'none';
            adminContent.style.display = 'block';
            initializeAdminPanel();
        } else {
            passwordPrompt.style.display = 'flex';
            adminContent.style.display = 'none';
        }
    }

    loginButton.addEventListener('click', () => {
        if (adminPasswordInput.value === CORRECT_PASSWORD) {
            sessionStorage.setItem('isAdminAuthenticated', 'true');
            checkLogin();
        } else {
            passwordError.textContent = 'パスワードが違います。';
            adminPasswordInput.value = '';
        }
    });

    logoutButton.addEventListener('click', () => {
        sessionStorage.removeItem('isAdminAuthenticated');
        itemsData = [];
        tagsData = [];
        checkLogin();
    });
    
    // --- 初期化 ---
    function initializeAdminPanel() {
        renderTagsAdmin();
        renderItemsAdminTable();
        renderItemTagsCheckboxes(); // アイテムフォーム内のタグも更新
    }

    // --- データI/O ---
    loadItemsFile.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    itemsData = JSON.parse(e.target.result);
                    if (!Array.isArray(itemsData)) itemsData = []; // 配列でなければ初期化
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

    loadTagsFile.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    // ユーザー向けtags.jsonは { "available_tags": [...] } の形式を想定
                    const loaded = JSON.parse(e.target.result);
                    if (loaded && Array.isArray(loaded.available_tags)) {
                        tagsData = loaded.available_tags;
                    } else if (Array.isArray(loaded)) { // もし直接配列だったら
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

    saveDataButton.addEventListener('click', () => {
        if (itemsData.length === 0 && tagsData.length === 0) {
            if (!confirm("データが空ですが、本当に保存しますか？")) return;
        }

        // items.json
        const itemsJsonString = JSON.stringify(itemsData, null, 2);
        downloadJson(itemsJsonString, 'items.json');

        // tags.json (ユーザー向けと同じ形式に)
        const tagsJsonForUser = { available_tags: tagsData };
        const tagsJsonString = JSON.stringify(tagsJsonForUser, null, 2);
        downloadJson(tagsJsonString, 'tags.json');

        alert("items.json と tags.json のダウンロードを開始します。");
    });

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
        renderItemTagsCheckboxes(); // アイテムフォームのタグ選択も更新
    }

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
        tagsData.sort((a, b) => a.name.localeCompare(b.name)); // 名前順ソート
        newTagIdInput.value = '';
        newTagNameInput.value = '';
        renderTagsAdmin();
    });

    function deleteTag(tagId) {
        if (confirm(`タグID「${tagId}」を削除しますか？このタグを使用しているアイテムからも削除されます。`)) {
            tagsData = tagsData.filter(tag => tag.id !== tagId);
            // アイテムデータからもこのタグを削除
            itemsData.forEach(item => {
                if (item.tags) {
                    item.tags = item.tags.filter(t => t !== tagId);
                }
            });
            renderTagsAdmin();
            renderItemsAdminTable(); // アイテムのタグも変更された可能性があるので再描画
        }
    }
    
    // --- アイテムフォームのタグチェックボックス ---
    function renderItemTagsCheckboxes(selectedTagIds = []) {
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
        // 簡単なID採番 (もしitemsDataにidが数値なら最大値+1、そうでなければUUID風文字列など)
        // 今回は、items.jsonにidフィールドが必須ではない想定で、配列のインデックスや
        // 編集時には既存のidを保持する形にするため、新規追加時には特別なIDは不要とする。
        // もしユニークIDが必要なら、 `Date.now().toString()` やライブラリを使う。
        // ここでは、新しいアイテムはIDなしで追加し、編集時に初めてIDが付与される（もしあれば）か、
        // ユーザーが指定する形を想定。items.jsonの形式に合わせる。
        // 今回は、アイテムの識別は配列内のオブジェクトそのものとし、
        // 編集時にはそのオブジェクトを直接更新する。
        // ユーザー向けitems.jsonにidが必要な場合は、保存時に自動採番するか、
        // 管理者が手動でユニークな値を入力するフィールドを設ける。
        // ここでは、ユーザー向けitems.jsonの各アイテムに `id` (数値) があると仮定し、それを自動採番。
        if (itemsData.length === 0) return 1;
        return Math.max(...itemsData.map(item => typeof item.id === 'number' ? item.id : 0)) + 1;
    }

    itemForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = itemNameInput.value.trim();
        const image = itemImageInput.value.trim(); // 例: "potion.png" または "items/potion.png"
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
            // id: editingId || getNextItemId(), // idを自動採番する場合
            name,
            image: image ? (image.startsWith('images/') ? image : `images/${image}`) : 'images/placeholder_item.png', // `images/` を補完
            effect,
            入手手段: source, // JSONのキー名に合わせる
            tags: selectedTags
        };
        
        // idをユーザー向けJSONの形式に合わせて付与 (もし`items.json`の各アイテムが`id`を持つ場合)
        if (editingId) {
            newItemData.id = editingId;
            const index = itemsData.findIndex(item => item.id === editingId);
            if (index > -1) {
                itemsData[index] = newItemData;
            } else { // IDが見つからない場合は新規として追加 (エラー処理)
                newItemData.id = getNextItemId();
                itemsData.push(newItemData);
            }
        } else {
            newItemData.id = getNextItemId(); // 新規アイテムには新しいIDを割り振る
            itemsData.push(newItemData);
        }
        
        itemsData.sort((a,b) => a.name.localeCompare(b.name)); //名前でソート
        renderItemsAdminTable();
        clearItemForm();
    });

    clearFormButton.addEventListener('click', clearItemForm);

    function clearItemForm() {
        itemForm.reset();
        itemIdToEditInput.value = '';
        renderItemTagsCheckboxes(); // チェックボックスもクリア
        saveItemButton.textContent = "アイテム保存";
    }

    function renderItemsAdminTable() {
        itemsTableBody.innerHTML = '';
        const searchTerm = itemSearchAdminInput.value.toLowerCase();

        const filteredItems = itemsData.filter(item => 
            item.name.toLowerCase().includes(searchTerm)
        );

        filteredItems.forEach((item, index) => { // indexは元のitemsDataでのインデックスではないので注意
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
            tr.querySelector('.edit-item').addEventListener('click', () => loadItemForEdit(item.id));
            tr.querySelector('.delete-item').addEventListener('click', () => deleteItem(item.id));
            itemsTableBody.appendChild(tr);
        });
    }

    itemSearchAdminInput.addEventListener('input', renderItemsAdminTable);

    function loadItemForEdit(itemId) {
        const item = itemsData.find(i => i.id === itemId);
        if (item) {
            itemIdToEditInput.value = item.id;
            itemNameInput.value = item.name;
            // 'images/' プレフィックスを除去して表示
            itemImageInput.value = item.image ? item.image.replace(/^images\//, '') : '';
            itemEffectInput.value = item.effect;
            itemSourceInput.value = item.入手手段;
            renderItemTagsCheckboxes(item.tags || []);
            saveItemButton.textContent = "アイテム更新";
            itemForm.scrollIntoView({ behavior: 'smooth' });
        }
    }

    function deleteItem(itemId) {
        if (confirm(`アイテムID「${itemId}」を削除しますか？`)) {
            itemsData = itemsData.filter(item => item.id !== itemId);
            renderItemsAdminTable();
            clearItemForm(); // もし削除したアイテムを編集中だったらフォームをクリア
        }
    }

    // 初期チェック
    checkLogin();
});
