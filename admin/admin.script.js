// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { getFirestore, collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp, writeBatch, getDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
// Cloudflare Worker使うのでFirebase Storageは不要

// Your web app's Firebase configuration - ★★★ オリジナルの内容を維持 ★★★
const firebaseConfig = {
  apiKey: "AIzaSyBxrE-9E46dplHTuEBmmcJWQRU1vLgAGAU",
  authDomain: "itemsearchtooleditor.firebaseapp.com",
  projectId: "itemsearchtooleditor",
  storageBucket: "itemsearchtooleditor.appspot.com",
  messagingSenderId: "243156973544",
  appId: "1:243156973544:web:ffdc31134a35354b6dd65d",
  measurementId: "G-8EHP9MGJ4M" // Optional
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ★★★ Cloudflare WorkerのエンドポイントURL ★★★
const IMAGE_UPLOAD_WORKER_URL = 'https://denpa-item-uploader.tsubasa-hsty-f58.workers.dev'; // あなたのWorkerのURL

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const passwordPrompt = document.getElementById('password-prompt');
    const adminContent = document.getElementById('admin-content');
    const loginButton = document.getElementById('loginButton');
    const adminEmailInput = document.getElementById('adminEmailInput');
    const adminPasswordInput = document.getElementById('adminPasswordInput');
    const passwordError = document.getElementById('passwordError');
    const logoutButton = document.getElementById('logoutButton');
    const currentUserEmailSpan = document.getElementById('currentUserEmail');

    const newTagNameInput = document.getElementById('newTagName');
    // const newTagLevelSelect = document.getElementById('newTagLevel'); // 階層削除
    // const newTagParentSelect = document.getElementById('newTagParent'); // 階層削除
    const addTagButton = document.getElementById('addTagButton');
    const tagListContainer = document.getElementById('tagListContainer');

    const itemForm = document.getElementById('itemForm');
    const itemIdToEditInput = document.getElementById('itemIdToEdit');
    const itemNameInput = document.getElementById('itemName');
    const itemImageFileInput = document.getElementById('itemImageFile');
    const itemImagePreview = document.getElementById('itemImagePreview');
    const itemImageUrlInput = document.getElementById('itemImageUrl');
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
    const editingTagDocIdInput = document.getElementById('editingTagDocId');
    const editingTagNameInput = document.getElementById('editingTagName');
    // const editingTagLevelInput = document.getElementById('editingTagLevel'); // 階層削除
    // const editingTagParentSelect = document.getElementById('editingTagParent'); // 階層削除
    const saveTagEditButton = document.getElementById('saveTagEditButton');

    let tagsCache = []; // {id, name} の配列に戻す
    let itemsCache = [];
    let selectedImageFile = null;

    // --- 認証 --- (変更なし)
    onAuthStateChanged(auth, (user) => { /* ... */ });
    if (loginButton) { loginButton.addEventListener('click', () => { /* ... */ }); }
    if (logoutButton) { logoutButton.addEventListener('click', () => { /* ... */ }); }
    function clearAdminUI() { /* ... */ }

    // --- 初期データロード ---
    async function loadInitialData() {
        await loadTagsFromFirestore(); // タグをロード
        await loadItemsFromFirestore(); // アイテムをロード
        renderTagsForManagement(); // タグ管理UI描画
        renderItemTagsSelector();   // アイテムフォーム用タグ選択肢描画
        renderItemsAdminTable();    // アイテム一覧描画
    }

    // --- タグ管理 (シンプル版) ---
    async function loadTagsFromFirestore() {
        try {
            // nameでソートして取得
            const q = query(collection(db, 'tags'), orderBy('name'));
            const snapshot = await getDocs(q);
            tagsCache = snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name })); // idとnameのみ
            console.log("Tags loaded from Firestore:", tagsCache);
        } catch (error) {
            console.error("Error loading tags:", error);
            tagsCache = [];
        }
    }

    function renderTagsForManagement() {
        if (!tagListContainer) return;
        tagListContainer.innerHTML = '';
        tagsCache.forEach(tag => {
            const tagBtn = createTagManagementButton(tag);
            tagListContainer.appendChild(tagBtn);
        });
        renderItemTagsSelector(); // アイテムフォームの選択肢も更新
    }

     function createTagManagementButton(tag) { // 編集・削除ボタンを付ける
        const tagBtn = document.createElement('button');
        tagBtn.classList.add('tag-button');
        tagBtn.textContent = tag.name;
        tagBtn.title = `ID: ${tag.id}`;

        const editIcon = document.createElement('span');
        editIcon.classList.add('edit-icon', 'action-icon');
        editIcon.innerHTML = ' ✎';
        editIcon.title = "このタグを編集";
        editIcon.onclick = (e) => { e.stopPropagation(); openEditTagModal(tag.id, tag.name); }; // IDと名前を渡す
        tagBtn.appendChild(editIcon);

        const deleteIcon = document.createElement('span');
        deleteIcon.classList.add('delete-icon', 'action-icon');
        deleteIcon.innerHTML = ' ×';
        deleteIcon.title = "このタグを削除";
        deleteIcon.onclick = (e) => { e.stopPropagation(); deleteTag(tag.id, tag.name); }; // IDと名前を渡す
        tagBtn.appendChild(deleteIcon);
        return tagBtn;
     }

    if (addTagButton) {
        addTagButton.addEventListener('click', async () => {
            const name = newTagNameInput.value.trim();
            if (!name) { alert("タグ名を入力してください。"); return; }

            // 単純な名前の重複チェック
            if (tagsCache.some(tag => tag.name.toLowerCase() === name.toLowerCase())) {
                alert("同じ名前のタグが既に存在します。"); return;
            }

            try {
                // levelやparentTagIdなしで追加
                const docRef = await addDoc(collection(db, 'tags'), { name: name });
                console.log("Tag added with ID: ", docRef.id);
                newTagNameInput.value = '';
                await loadTagsFromFirestore(); // 再読み込みしてキャッシュ更新
                renderTagsForManagement();     // UI更新
            } catch (error) {
                console.error("Error adding tag: ", error);
                alert("タグの追加に失敗しました。");
            }
        });
    }

    function openEditTagModal(docId, currentName) { // シンプル版
        editingTagDocIdInput.value = docId;
        editingTagNameInput.value = currentName;
        editTagModal.style.display = 'flex';
        editingTagNameInput.focus();
    }

    if (saveTagEditButton) { // シンプル版 (名前変更のみ)
        saveTagEditButton.addEventListener('click', async () => {
            const docId = editingTagDocIdInput.value;
            const newName = editingTagNameInput.value.trim();
            if (!newName) { alert("タグ名は空にできません。"); return; }

            // 他のタグとの名前重複チェック (自分自身を除く)
            if (tagsCache.some(tag => tag.id !== docId && tag.name.toLowerCase() === newName.toLowerCase())) {
                alert("編集後の名前が、他の既存タグと重複します。"); return;
            }

            try {
                const tagRef = doc(db, 'tags', docId);
                await updateDoc(tagRef, { name: newName });
                editTagModal.style.display = 'none';
                await loadTagsFromFirestore(); // 再読み込み
                renderTagsForManagement();     // UI更新
                await loadItemsFromFirestore(); // アイテムデータも更新 (タグ名が変わった可能性)
                renderItemsAdminTable();       // アイテム一覧も更新
            } catch (error) {
                console.error("Error updating tag name: ", error);
                alert("タグ名の更新に失敗しました。");
            }
        });
    }

    async function deleteTag(docId, tagName) { // シンプル版
        if (confirm(`タグ「${tagName}」(ID: ${docId})を削除しますか？\nこのタグを使用している全てのアイテムからも削除されます。`)) {
            try {
                const tagRef = doc(db, 'tags', docId);
                await deleteDoc(tagRef);

                // このタグIDを使用しているアイテムを検索して更新
                const q = query(collection(db, 'items'), where('tags', 'array-contains', docId));
                const itemsToUpdateSnapshot = await getDocs(q);
                if (!itemsToUpdateSnapshot.empty) {
                    const batch = writeBatch(db);
                    itemsToUpdateSnapshot.forEach(itemDocSnap => {
                        const currentTags = itemDocSnap.data().tags || [];
                        const updatedTags = currentTags.filter(tagId => tagId !== docId);
                        batch.update(itemDocSnap.ref, { tags: updatedTags });
                    });
                    await batch.commit();
                    console.log(`${itemsToUpdateSnapshot.size} items updated after tag deletion.`);
                }

                await loadInitialData(); // 全データ再読み込み & UI更新
            } catch (error) {
                console.error("Error deleting tag: ", error);
                alert("タグの削除または関連アイテムの更新に失敗しました。");
            }
        }
    }

    // アイテムフォームのタグ選択 (全タグ表示)
    function renderItemTagsSelector(selectedItemTagIds = []) {
        if (!itemTagsSelectorContainer) return;
        itemTagsSelectorContainer.innerHTML = '';
        tagsCache.forEach(tag => { // 全タグを表示
            const tagBtn = document.createElement('button');
            tagBtn.type = 'button';
            tagBtn.classList.add('tag-button');
            tagBtn.textContent = tag.name; // 名前のみ
            tagBtn.dataset.tagId = tag.id;
            if (selectedItemTagIds.includes(tag.id)) { tagBtn.classList.add('selected'); }
            tagBtn.addEventListener('click', () => { tagBtn.classList.toggle('selected'); });
            itemTagsSelectorContainer.appendChild(tagBtn);
        });
    }

    // --- 画像アップロード (Cloudflare Worker連携 - 変更なし) ---
    if (itemImageFileInput) { /* ... */ }
    async function uploadImageToWorkerAndGetURL(file) { /* ... */ }

    // --- アイテム管理 (Firestore) ---
    async function loadItemsFromFirestore() { // (変更なし)
        try {
            const q = query(collection(db, 'items'), orderBy('name')); // nameでソートして取得
            const snapshot = await getDocs(q);
            itemsCache = snapshot.docs.map(docSnap => ({ docId: docSnap.id, ...docSnap.data() }));
            console.log("Items loaded from Firestore:", itemsCache);
        } catch (error) { console.error("Error loading items:", error); itemsCache = []; }
    }

    // アイテム保存処理 (入力緩和対応済み、リセット呼び出し確認)
    if (itemForm) {
        itemForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = itemNameInput.value.trim();
            const effect = itemEffectInput.value.trim();
            const source = itemSourceInput.value.trim();
            const selectedTagIds = Array.from(itemTagsSelectorContainer.querySelectorAll('.tag-button.selected')).map(btn => btn.dataset.tagId);
            const editingDocId = itemIdToEditInput.value;
            let imageUrl = itemImageUrlInput.value;

            if (!name) { alert("名前は必須です。"); return; } // 名前のみ必須チェック

            saveItemButton.disabled = true; saveItemButton.textContent = "保存中...";

            try {
                if (selectedImageFile) {
                    const existingImageUrlForDeletion = editingDocId ? imageUrl : null;
                    imageUrl = await uploadImageToWorkerAndGetURL(selectedImageFile);
                    if (!imageUrl && selectedImageFile) { throw new Error("画像アップロード失敗"); }
                    // 古い画像の削除は手動運用 or Workerで
                    if (existingImageUrlForDeletion && existingImageUrlForDeletion !== imageUrl) {
                        console.warn(`Old image ${existingImageUrlForDeletion} (R2) should be deleted manually.`);
                    }
                }

                const itemData = {
                    name,
                    image: imageUrl || '',
                    effect: effect || '', // 空なら空文字を保存
                    入手手段: source || '', // 空なら空文字を保存
                    tags: selectedTagIds, // 選択されたタグIDの配列
                    updatedAt: serverTimestamp()
                };

                if (editingDocId) { // 更新
                    const itemRef = doc(db, 'items', editingDocId);
                    await updateDoc(itemRef, itemData);
                    console.log("Item updated with ID: ", editingDocId);
                } else { // 新規作成
                    itemData.createdAt = serverTimestamp();
                    const docRef = await addDoc(collection(db, 'items'), itemData);
                    console.log("Item added with ID: ", docRef.id);
                }

                await loadItemsFromFirestore(); // 保存後にデータを再読み込み
                renderItemsAdminTable();      // テーブルを再描画
                clearItemForm();              // ★★★ フォームをクリア ★★★
            } catch (error) {
                console.error("Error saving item:", error);
                alert(`アイテム保存エラー: ${error.message}`);
            } finally {
                saveItemButton.disabled = false;
                // ★ 編集モードだった場合、ボタンテキストを戻す
                saveItemButton.textContent = editingDocId ? "アイテム更新" : "アイテム保存";
            }
        });
    }

    // フォームクリア関数 (変更なし)
    if (clearFormButton) { clearFormButton.addEventListener('click', clearItemForm); }
    function clearItemForm() {
        if (itemForm) itemForm.reset();
        itemIdToEditInput.value = ''; // ★ 編集IDもクリア
        itemImageUrlInput.value = '';
        if (itemImagePreview) { itemImagePreview.src = '#'; itemImagePreview.style.display = 'none'; }
        if (itemImageFileInput) itemImageFileInput.value = null;
        selectedImageFile = null;
        uploadProgressContainer.style.display = 'none';
        renderItemTagsSelector(); // タグ選択もクリア
        if (saveItemButton) saveItemButton.textContent = "アイテム保存"; // ボタンテキストをデフォルトに
    }

    // アイテムテーブル描画 (タグ表示をシンプルに)
    function renderItemsAdminTable() {
        if (!itemsTableBody) return;
        itemsTableBody.innerHTML = '';
        const searchTerm = itemSearchAdminInput ? itemSearchAdminInput.value.toLowerCase() : "";
        const filteredItems = itemsCache.filter(item => item.name && item.name.toLowerCase().includes(searchTerm));

        filteredItems.forEach(item => {
            const tr = document.createElement('tr');
            const imageDisplayPath = item.image || '../images/placeholder_item.png';
            // タグ名をキャッシュから取得して表示
            const itemTagsString = item.tags ? item.tags.map(tagId => {
                const tagObj = tagsCache.find(t => t.id === tagId);
                return tagObj ? tagObj.name : ''; // 見つからない場合は空
            }).filter(Boolean).join(', ') : '---';
            const effectExcerpt = item.effect ? (item.effect.length > 30 ? item.effect.substring(0, 30) + '...' : item.effect) : '---';

            tr.innerHTML = `
                <td><img src="${imageDisplayPath}" alt="${item.name || ''}" onerror="this.onerror=null; this.src='../images/placeholder_item.png';"></td>
                <td>${item.name || ''}</td>
                <td>${effectExcerpt}</td>
                <td>${itemTagsString}</td>
                <td>
                    <button class="edit-item" data-item-doc-id="${item.docId}" title="編集">✎</button>
                    <button class="delete-item" data-item-doc-id="${item.docId}" title="削除">×</button>
                </td>
            `;
            const editBtn = tr.querySelector('.edit-item');
            const deleteBtn = tr.querySelector('.delete-item');
            // ★★★ イベントリスナー内で item オブジェクト全体を渡すように変更 ★★★
            if(editBtn) editBtn.addEventListener('click', () => loadItemForEdit(item)); // docIdではなくitemオブジェクトを渡す
            if(deleteBtn) deleteBtn.addEventListener('click', () => deleteItem(item.docId, item.name, item.image));
            itemsTableBody.appendChild(tr);
        });
    }

    // アイテム編集フォーム読み込み (itemオブジェクトを受け取るように修正)
    function loadItemForEdit(item) { // docIdではなくitemオブジェクトを受け取る
        if(!item || !item.docId) {
            console.error("Invalid item data passed to loadItemForEdit");
            return;
        }
        itemIdToEditInput.value = item.docId;
        itemNameInput.value = item.name || '';
        itemEffectInput.value = item.effect || '';
        itemSourceInput.value = item.入手手段 || '';
        itemImageUrlInput.value = item.image || '';

        if (item.image) {
            itemImagePreview.src = item.image;
            itemImagePreview.style.display = 'block';
        } else {
            itemImagePreview.src = '#';
            itemImagePreview.style.display = 'none';
        }
        if (itemImageFileInput) itemImageFileInput.value = null;
        selectedImageFile = null;

        renderItemTagsSelector(item.tags || []); // タグ選択状態を復元

        if (saveItemButton) saveItemButton.textContent = "アイテム更新"; // ボタンテキスト変更
        if (itemForm) itemForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }


    // アイテム削除処理 (変更なし)
    async function deleteItem(docId, itemName, imageUrl) {
        if (confirm(`アイテム「${itemName}」(Doc ID: ${docId})を削除しますか？\nR2上の画像は手動削除が必要です。`)) {
            try {
                await deleteDoc(doc(db, 'items', docId));
                console.log("Item deleted:", docId);
                if (imageUrl) console.warn(`Image ${imageUrl} needs manual deletion from R2.`);
                await loadItemsFromFirestore(); // 再読み込み
                renderItemsAdminTable();      // 再描画
                if (itemIdToEditInput.value === docId) clearItemForm(); // 編集中だったらフォームクリア
            } catch (error) { console.error("Error deleting item:", error); alert("削除失敗"); }
        }
    }

    // モーダル関連 (変更なし)
    // ...
});
