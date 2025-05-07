document.addEventListener('DOMContentLoaded', () => {
    // ▼▼▼ Firebaseプロジェクトの設定情報 (実際の値に置き換えてください) ▼▼▼
    const firebaseConfig = {
        apiKey: "YOUR_API_KEY",
        authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
        projectId: "YOUR_PROJECT_ID",
        storageBucket: "YOUR_PROJECT_ID.appspot.com",
        messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
        appId: "YOUR_APP_ID"
    };
    // ▲▲▲ Firebaseプロジェクトの設定情報 ▲▲▲

    // Firebaseアプリを初期化
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const auth = firebase.auth();
    const db = firebase.firestore();
    const storage = firebase.storage();

    // DOM Elements
    const passwordPrompt = document.getElementById('password-prompt');
    const adminContent = document.getElementById('admin-content');
    const loginButton = document.getElementById('loginButton');
    const adminEmailInput = document.getElementById('adminEmailInput'); // 追加
    const adminPasswordInput = document.getElementById('adminPasswordInput');
    const passwordError = document.getElementById('passwordError');
    const logoutButton = document.getElementById('logoutButton');
    const currentUserEmailSpan = document.getElementById('currentUserEmail');

    const newTagNameInput = document.getElementById('newTagName');
    const addTagButton = document.getElementById('addTagButton');
    const tagListContainer = document.getElementById('tagListContainer');

    const itemForm = document.getElementById('itemForm');
    const itemIdToEditInput = document.getElementById('itemIdToEdit'); // FirestoreドキュメントID用
    const itemNameInput = document.getElementById('itemName');
    const itemImageFileInput = document.getElementById('itemImageFile'); // <input type="file">
    const itemImagePreview = document.getElementById('itemImagePreview');
    const itemImageUrlInput = document.getElementById('itemImageUrl'); // 隠しinput: StorageのURL
    const uploadProgressContainer = document.getElementById('uploadProgressContainer');
    const uploadProgress = document.getElementById('uploadProgress');
    const uploadProgressText = document.getElementById('uploadProgressText');
    const itemEffectInput = document.getElementById('itemEffect');
    const itemSourceInput = document.getElementById('itemSource');
    const itemTagsSelectorContainer = document.getElementById('itemTagsSelector');
    const saveItemButton = document.getElementById('saveItemButton');
    const clearFormButton = document.getElementById('clearFormButton');
    
    const itemsTableBody = document.querySelector('#itemsTable tbody');
    const itemSearchAdminInput = document.getElementById('itemSearchAdmin');

    const editTagModal = document.getElementById('editTagModal');
    const editingTagDocIdInput = document.getElementById('editingTagDocId'); // FirestoreドキュメントID用
    const editingTagNameInput = document.getElementById('editingTagName');
    const saveTagEditButton = document.getElementById('saveTagEditButton');

    // --- 認証 ---
    auth.onAuthStateChanged(user => {
        if (user) {
            passwordPrompt.style.display = 'none';
            adminContent.style.display = 'block';
            if (currentUserEmailSpan) currentUserEmailSpan.textContent = `ログイン中: ${user.email}`;
            loadInitialData(); // ログイン後にデータをロード
        } else {
            passwordPrompt.style.display = 'flex';
            adminContent.style.display = 'none';
            if (currentUserEmailSpan) currentUserEmailSpan.textContent = '';
            // ログイン画面ではデータロードやUI初期化はしない
            clearAdminUI(); // 管理UIをクリア
        }
    });

    if (loginButton) {
        loginButton.addEventListener('click', () => {
            const email = adminEmailInput.value;
            const password = adminPasswordInput.value;
            if (!email || !password) {
                passwordError.textContent = 'メールアドレスとパスワードを入力してください。';
                return;
            }
            passwordError.textContent = ''; // エラーをクリア
            auth.signInWithEmailAndPassword(email, password)
                .catch(error => {
                    console.error("Login error:", error);
                    passwordError.textContent = `ログインエラー: ${error.message}`;
                });
        });
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            auth.signOut().catch(error => console.error("Logout error:", error));
        });
    }
    
    function clearAdminUI() {
        // 管理画面のリストなどをクリアする処理
        if (tagListContainer) tagListContainer.innerHTML = '';
        if (itemsTableBody) itemsTableBody.innerHTML = '';
        if (itemTagsSelectorContainer) itemTagsSelectorContainer.innerHTML = '';
        clearItemForm();
    }


    // --- 初期データロード (Firestoreから) ---
    async function loadInitialData() {
        await loadTagsFromFirestore();
        await loadItemsFromFirestore();
        // UIの再描画
        renderTagsForManagement();
        renderItemTagsSelector(); // アイテムフォーム内のタグ選択肢
        renderItemsAdminTable();
    }

    // --- タグ管理 (Firestore) ---
    let tagsCache = []; // Firestoreから読み込んだタグのキャッシュ {id: docId, name: tagName}

    async function loadTagsFromFirestore() {
        try {
            const snapshot = await db.collection('tags').orderBy('name').get();
            tagsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("Tags loaded from Firestore:", tagsCache);
        } catch (error) {
            console.error("Error loading tags from Firestore:", error);
            tagsCache = [];
        }
    }

    function renderTagsForManagement() {
        if (!tagListContainer) return;
        tagListContainer.innerHTML = '';
        tagsCache.forEach(tag => { // tagsCache を使用
            const tagBtn = document.createElement('button');
            tagBtn.classList.add('tag-button');
            tagBtn.textContent = tag.name;
            tagBtn.title = `Doc ID: ${tag.id}`; // FirestoreのドキュメントIDを表示
            
            const editIcon = document.createElement('span');
            editIcon.classList.add('edit-icon', 'action-icon');
            editIcon.innerHTML = ' ✎';
            editIcon.title = "このタグを編集";
            editIcon.onclick = (e) => { e.stopPropagation(); openEditTagModal(tag.id, tag.name); };
            tagBtn.appendChild(editIcon);

            const deleteIcon = document.createElement('span');
            deleteIcon.classList.add('delete-icon', 'action-icon');
            deleteIcon.innerHTML = ' ×';
            deleteIcon.title = "このタグを削除";
            deleteIcon.onclick = (e) => { e.stopPropagation(); deleteTag(tag.id, tag.name); };
            tagBtn.appendChild(deleteIcon);

            tagListContainer.appendChild(tagBtn);
        });
        renderItemTagsSelector(); // アイテムフォームのタグ選択も更新
    }

    if (addTagButton) {
        addTagButton.addEventListener('click', async () => {
            const name = newTagNameInput.value.trim();
            if (!name) { alert("タグ名を入力してください。"); return; }
            
            // Firestore内で名前の重複チェック (より確実)
            const existingTagQuery = await db.collection('tags').where('name', '==', name).get();
            if (!existingTagQuery.empty) {
                alert("同じ名前のタグが既に存在します。"); return;
            }
            
            try {
                const docRef = await db.collection('tags').add({ name: name });
                console.log("Tag added with ID: ", docRef.id);
                newTagNameInput.value = '';
                await loadTagsFromFirestore(); // Firestoreから再読み込み
                renderTagsForManagement();     // UI更新
            } catch (error) {
                console.error("Error adding tag: ", error);
                alert("タグの追加に失敗しました。");
            }
        });
    }

    function openEditTagModal(docId, currentName) { // docIdはFirestoreのドキュメントID
        editingTagDocIdInput.value = docId;
        editingTagNameInput.value = currentName;
        editTagModal.style.display = 'flex';
        editingTagNameInput.focus();
    }

    if (saveTagEditButton) {
        saveTagEditButton.addEventListener('click', async () => {
            const docId = editingTagDocIdInput.value;
            const newName = editingTagNameInput.value.trim();
            if (!newName) { alert("タグ名は空にできません。"); return; }

            // Firestore内で新しい名前の重複チェック (自身を除く)
            const existingTagQuery = await db.collection('tags').where('name', '==', newName).get();
            let conflict = false;
            existingTagQuery.forEach(doc => {
                if (doc.id !== docId) conflict = true;
            });
            if (conflict) {
                alert("編集後の名前が、他の既存タグと重複します。"); return;
            }

            try {
                await db.collection('tags').doc(docId).update({ name: newName });
                editTagModal.style.display = 'none';
                await loadTagsFromFirestore();
                renderTagsForManagement();
                // アイテムリストのタグ表示も更新されるべきだが、それはrenderItemsAdminTableが呼ばれる際に解決
            } catch (error) {
                console.error("Error updating tag: ", error);
                alert("タグの更新に失敗しました。");
            }
        });
    }

    async function deleteTag(docId, tagName) {
        if (confirm(`タグ「${tagName}」(Doc ID: ${docId})を削除しますか？\nこのタグを使用しているアイテムからも自動的に削除されます (アイテムの更新が必要です)。`)) {
            try {
                // 1. タグを削除
                await db.collection('tags').doc(docId).delete();
                
                // 2. このタグを使用しているアイテムを検索し、アイテムのtags配列からこのタグIDを削除 (バッチ書き込み推奨)
                const itemsToUpdateSnapshot = await db.collection('items').where('tags', 'array-contains', docId).get();
                if (!itemsToUpdateSnapshot.empty) {
                    const batch = db.batch();
                    itemsToUpdateSnapshot.forEach(itemDoc => {
                        const currentTags = itemDoc.data().tags || [];
                        const updatedTags = currentTags.filter(tagId => tagId !== docId);
                        batch.update(itemDoc.ref, { tags: updatedTags });
                    });
                    await batch.commit();
                    console.log(`${itemsToUpdateSnapshot.size} items updated after tag deletion.`);
                }
                
                await loadInitialData(); // 全データを再読み込みしてUIを更新
            } catch (error) {
                console.error("Error deleting tag and updating items: ", error);
                alert("タグの削除または関連アイテムの更新に失敗しました。");
            }
        }
    }
    
    // --- アイテムフォームのタグ選択 (tagsCacheから生成) ---
    function renderItemTagsSelector(selectedItemTagIds = []) {
        if (!itemTagsSelectorContainer) return;
        itemTagsSelectorContainer.innerHTML = '';
        tagsCache.forEach(tag => { // tagsCacheを使用
            const tagBtn = document.createElement('button');
            tagBtn.type = 'button';
            tagBtn.classList.add('tag-button');
            tagBtn.textContent = tag.name;
            tagBtn.dataset.tagId = tag.id; // FirestoreのドキュメントIDを保持
            if (selectedItemTagIds.includes(tag.id)) {
                tagBtn.classList.add('selected');
            }
            tagBtn.addEventListener('click', () => {
                tagBtn.classList.toggle('selected');
            });
            itemTagsSelectorContainer.appendChild(tagBtn);
        });
    }

    // --- 画像アップロードとプレビュー ---
    let selectedImageFile = null; // アップロード用に選択されたファイルを保持
    if (itemImageFileInput) {
        itemImageFileInput.addEventListener('change', (event) => {
            selectedImageFile = event.target.files[0];
            if (selectedImageFile) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    itemImagePreview.src = e.target.result;
                    itemImagePreview.style.display = 'block';
                }
                reader.readAsDataURL(selectedImageFile);
                itemImageUrlInput.value = ''; // 新しいファイルが選択されたら既存のURLはクリア
            } else {
                itemImagePreview.src = '#';
                itemImagePreview.style.display = 'none';
                selectedImageFile = null;
            }
        });
    }

    async function uploadImageAndGetURL(file) {
        if (!file) return null;
        const imageName = `${Date.now()}_${file.name}`; // ユニークなファイル名
        const storageRef = storage.ref(`item_images/${imageName}`);
        
        uploadProgressContainer.style.display = 'block';
        uploadProgress.value = 0;
        uploadProgressText.textContent = '0%';

        const uploadTask = storageRef.put(file);

        return new Promise((resolve, reject) => {
            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    uploadProgress.value = progress;
                    uploadProgressText.textContent = `${Math.round(progress)}%`;
                },
                (error) => {
                    console.error("Upload failed:", error);
                    uploadProgressContainer.style.display = 'none';
                    reject(error);
                },
                async () => {
                    const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
                    console.log('File available at', downloadURL);
                    uploadProgressContainer.style.display = 'none';
                    resolve(downloadURL);
                }
            );
        });
    }


    // --- アイテム管理 (Firestore) ---
    let itemsCache = []; // Firestoreから読み込んだアイテムのキャッシュ

    async function loadItemsFromFirestore() {
        try {
            const snapshot = await db.collection('items').orderBy('name').get();
            itemsCache = snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
            console.log("Items loaded from Firestore:", itemsCache);
        } catch (error) {
            console.error("Error loading items from Firestore:", error);
            itemsCache = [];
        }
    }
    
    if (itemForm) {
        itemForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = itemNameInput.value.trim();
            const effect = itemEffectInput.value.trim();
            const source = itemSourceInput.value.trim();
            const selectedTagIds = Array.from(itemTagsSelectorContainer.querySelectorAll('.tag-button.selected'))
                                      .map(btn => btn.dataset.tagId);
            const editingDocId = itemIdToEditInput.value; // FirestoreのドキュメントID
            let imageUrl = itemImageUrlInput.value; // 既存の画像URLまたはこれからアップロードするURL

            if (!name || !effect || !source) { alert("名前、効果、入手手段は必須です。"); return; }
            
            saveItemButton.disabled = true; // 連打防止

            try {
                if (selectedImageFile) { // 新しい画像ファイルが選択されている場合
                    imageUrl = await uploadImageAndGetURL(selectedImageFile);
                    if (!imageUrl) { // アップロード失敗
                        alert("画像のアップロードに失敗しました。");
                        saveItemButton.disabled = false;
                        return;
                    }
                } else if (!editingDocId && !imageUrl) { // 新規作成で画像未選択/URLなし
                    // 画像なしで保存するか、ここでエラーにするか。今回は画像なしで保存を許容
                    // imageUrl = 'images/placeholder_item.png'; // デフォルト画像など
                }

                const itemData = {
                    name,
                    image: imageUrl || '', // 画像URLがなければ空文字
                    effect,
                    入手手段: source,
                    tags: selectedTagIds,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                if (editingDocId) { // 更新
                    await db.collection('items').doc(editingDocId).update(itemData);
                    console.log("Item updated with ID: ", editingDocId);
                } else { // 新規作成
                    itemData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                    const docRef = await db.collection('items').add(itemData);
                    console.log("Item added with ID: ", docRef.id);
                }
                
                await loadItemsFromFirestore(); // Firestoreから再読み込み
                renderItemsAdminTable();    // UI更新
                clearItemForm();
            } catch (error) {
                console.error("Error saving item: ", error);
                alert(`アイテムの保存に失敗しました: ${error.message}`);
            } finally {
                saveItemButton.disabled = false;
            }
        });
    }

    if (clearFormButton) clearFormButton.addEventListener('click', clearItemForm);

    function clearItemForm() {
        if (itemForm) itemForm.reset();
        itemIdToEditInput.value = '';
        itemImageUrlInput.value = '';
        if (itemImagePreview) { itemImagePreview.src = '#'; itemImagePreview.style.display = 'none'; }
        if (itemImageFileInput) itemImageFileInput.value = null;
        selectedImageFile = null;
        uploadProgressContainer.style.display = 'none';
        renderItemTagsSelector();
        if (saveItemButton) saveItemButton.textContent = "アイテム保存";
    }

    function renderItemsAdminTable() {
        if (!itemsTableBody) return;
        itemsTableBody.innerHTML = '';
        const searchTerm = itemSearchAdminInput ? itemSearchAdminInput.value.toLowerCase() : "";

        const filteredItems = itemsCache.filter(item => 
            item.name && item.name.toLowerCase().includes(searchTerm)
        );

        filteredItems.forEach(item => {
            const tr = document.createElement('tr');
            // ユーザー向けサイトではGitHub Pagesのパス、管理画面ではStorageのURLを想定
            // ここではFirestoreに保存されたURL (item.image) を直接使う
            const imageDisplayPath = item.image || '../images/placeholder_item.png'; // '../' は不要かも
            
            const itemTagsString = item.tags ? item.tags.map(tagId => {
                const tagObj = tagsCache.find(t => t.id === tagId); // FirestoreのdocIdでマッチ
                return tagObj ? tagObj.name : `(ID: ${tagId})`;
            }).join(', ') : 'なし';
            const effectExcerpt = item.effect ? (item.effect.length > 30 ? item.effect.substring(0, 30) + '...' : item.effect) : '';

            tr.innerHTML = `
                <td><img src="${imageDisplayPath}" alt="${item.name}" onerror="this.onerror=null; this.src='../images/placeholder_item.png';"></td>
                <td>${item.name}</td>
                <td>${effectExcerpt}</td>
                <td>${itemTagsString}</td>
                <td>
                    <button class="edit-item" data-item-doc-id="${item.docId}" title="編集">✎</button>
                    <button class="delete-item" data-item-doc-id="${item.docId}" title="削除">×</button>
                </td>
            `;
            const editBtn = tr.querySelector('.edit-item');
            const deleteBtn = tr.querySelector('.delete-item');
            if(editBtn) editBtn.addEventListener('click', () => loadItemForEdit(item.docId));
            if(deleteBtn) deleteBtn.addEventListener('click', () => deleteItem(item.docId, item.name, item.image));
            itemsTableBody.appendChild(tr);
        });
    }

    if (itemSearchAdminInput) itemSearchAdminInput.addEventListener('input', renderItemsAdminTable);

    async function loadItemForEdit(docId) {
        try {
            const doc = await db.collection('items').doc(docId).get();
            if (doc.exists) {
                const itemData = doc.data();
                itemIdToEditInput.value = docId; // FirestoreのドキュメントID
                itemNameInput.value = itemData.name;
                itemEffectInput.value = itemData.effect;
                itemSourceInput.value = itemData.入手手段;
                itemImageUrlInput.value = itemData.image || ''; // 既存の画像URL
                
                if (itemData.image) {
                    itemImagePreview.src = itemData.image;
                    itemImagePreview.style.display = 'block';
                } else {
                    itemImagePreview.src = '#';
                    itemImagePreview.style.display = 'none';
                }
                if (itemImageFileInput) itemImageFileInput.value = null; // ファイル選択はクリア
                selectedImageFile = null;

                renderItemTagsSelector(itemData.tags || []);
                if (saveItemButton) saveItemButton.textContent = "アイテム更新";
                if (itemForm) itemForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
                console.error("No such document to edit!");
            }
        } catch (error) {
            console.error("Error fetching item for edit:", error);
            alert("編集データの読み込みに失敗しました。");
        }
    }

    async function deleteItem(docId, itemName, imageUrl) {
        if (confirm(`アイテム「${itemName}」(Doc ID: ${docId})を削除しますか？\nFirebase Storage上の関連画像は自動では削除されません。`)) {
            try {
                await db.collection('items').doc(docId).delete();
                console.log("Item deleted: ", docId);
                
                // オプション: Storageから画像も削除する場合（より高度）
                // if (imageUrl) {
                //     try {
                //         const imageRef = storage.refFromURL(imageUrl);
                //         await imageRef.delete();
                //         console.log("Image deleted from Storage:", imageUrl);
                //     } catch (storageError) {
                //         // 画像が存在しない、権限がないなどの場合。エラーでも処理は続行。
                //         console.warn("Could not delete image from Storage:", storageError);
                //     }
                // }

                await loadItemsFromFirestore();
                renderItemsAdminTable();
                if (itemIdToEditInput.value === docId) clearItemForm();
            } catch (error) {
                console.error("Error deleting item: ", error);
                alert("アイテムの削除に失敗しました。");
            }
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

    // 初期認証状態チェック
    // onAuthStateChangedが最初の状態をハンドルするので、ここでは不要な場合もあるが、念のため。
    // ただし、onAuthStateChanged内でUI初期化を行うので、ここでは呼び出さない。
});
