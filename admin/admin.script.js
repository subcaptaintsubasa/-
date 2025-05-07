// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import {
    getAuth,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import {
    getFirestore,
    collection,
    getDocs,
    addDoc,
    doc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    serverTimestamp,
    writeBatch,
    getDoc
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import {
    getStorage,
    ref,
    uploadBytesResumable,
    getDownloadURL,
    deleteObject
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-storage.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBxrE-9E46dplHTuEBmmcJWQRU1vLgAGAU", // ご自身のAPIキー等に置き換えてください
  authDomain: "itemsearchtooleditor.firebaseapp.com",
  projectId: "itemsearchtooleditor",
  storageBucket: "itemsearchtooleditor.appspot.com", // Firebaseコンソールで確認
  messagingSenderId: "243156973544",
  appId: "1:243156973544:web:ffdc31134a35354b6dd65d",
  measurementId: "G-8EHP9MGJ4M" // Optional
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);


document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements (変更なし)
    const passwordPrompt = document.getElementById('password-prompt');
    const adminContent = document.getElementById('admin-content');
    const loginButton = document.getElementById('loginButton');
    const adminEmailInput = document.getElementById('adminEmailInput');
    const adminPasswordInput = document.getElementById('adminPasswordInput');
    const passwordError = document.getElementById('passwordError');
    const logoutButton = document.getElementById('logoutButton');
    const currentUserEmailSpan = document.getElementById('currentUserEmail');

    const newTagNameInput = document.getElementById('newTagName');
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
    const saveTagEditButton = document.getElementById('saveTagEditButton');

    let tagsCache = [];
    let itemsCache = [];
    let selectedImageFile = null;

    // --- 認証 ---
    onAuthStateChanged(auth, (user) => {
        if (user) {
            passwordPrompt.style.display = 'none';
            adminContent.style.display = 'block';
            if (currentUserEmailSpan) currentUserEmailSpan.textContent = `ログイン中: ${user.email}`;
            loadInitialData();
        } else {
            passwordPrompt.style.display = 'flex';
            adminContent.style.display = 'none';
            if (currentUserEmailSpan) currentUserEmailSpan.textContent = '';
            clearAdminUI();
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
            passwordError.textContent = '';
            signInWithEmailAndPassword(auth, email, password)
                .catch(error => {
                    console.error("Login error:", error);
                    passwordError.textContent = `ログインエラー: ${error.code} - ${error.message}`; // 詳細なエラー表示
                });
        });
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            signOut(auth).catch(error => console.error("Logout error:", error));
        });
    }
    
    function clearAdminUI() {
        if (tagListContainer) tagListContainer.innerHTML = '';
        if (itemsTableBody) itemsTableBody.innerHTML = '';
        if (itemTagsSelectorContainer) itemTagsSelectorContainer.innerHTML = '';
        clearItemForm();
    }

    // --- 初期データロード (Firestoreから) ---
    async function loadInitialData() {
        await loadTagsFromFirestore();
        await loadItemsFromFirestore();
        renderTagsForManagement();
        renderItemTagsSelector();
        renderItemsAdminTable();
    }

    // --- タグ管理 (Firestore) ---
    async function loadTagsFromFirestore() {
        try {
            const q = query(collection(db, 'tags'), orderBy('name'));
            const snapshot = await getDocs(q);
            tagsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("Tags loaded from Firestore:", tagsCache);
        } catch (error) {
            console.error("Error loading tags from Firestore:", error);
            tagsCache = [];
        }
    }

    function renderTagsForManagement() {
        // ... (前回から変更なし) ...
        if (!tagListContainer) return;
        tagListContainer.innerHTML = '';
        tagsCache.forEach(tag => {
            const tagBtn = document.createElement('button');
            tagBtn.classList.add('tag-button');
            tagBtn.textContent = tag.name;
            tagBtn.title = `Doc ID: ${tag.id}`;
            
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
        renderItemTagsSelector();
    }

    if (addTagButton) {
        // ... (前回から変更なし) ...
        addTagButton.addEventListener('click', async () => {
            const name = newTagNameInput.value.trim();
            if (!name) { alert("タグ名を入力してください。"); return; }
            
            const q = query(collection(db, 'tags'), where('name', '==', name));
            const existingTagQuery = await getDocs(q);
            if (!existingTagQuery.empty) {
                alert("同じ名前のタグが既に存在します。"); return;
            }
            
            try {
                const docRef = await addDoc(collection(db, 'tags'), { name: name });
                console.log("Tag added with ID: ", docRef.id);
                newTagNameInput.value = '';
                await loadTagsFromFirestore();
                renderTagsForManagement();
            } catch (error) {
                console.error("Error adding tag: ", error);
                alert("タグの追加に失敗しました。");
            }
        });
    }

    function openEditTagModal(docId, currentName) {
        // ... (前回から変更なし) ...
        editingTagDocIdInput.value = docId;
        editingTagNameInput.value = currentName;
        editTagModal.style.display = 'flex';
        editingTagNameInput.focus();
    }

    if (saveTagEditButton) {
        // ... (前回から変更なし) ...
        saveTagEditButton.addEventListener('click', async () => {
            const docId = editingTagDocIdInput.value;
            const newName = editingTagNameInput.value.trim();
            if (!newName) { alert("タグ名は空にできません。"); return; }

            const q = query(collection(db, 'tags'), where('name', '==', newName));
            const existingTagQuery = await getDocs(q);
            let conflict = false;
            existingTagQuery.forEach(docSnap => { 
                if (docSnap.id !== docId) conflict = true;
            });
            if (conflict) {
                alert("編集後の名前が、他の既存タグと重複します。"); return;
            }

            try {
                const tagRef = doc(db, 'tags', docId);
                await updateDoc(tagRef, { name: newName });
                editTagModal.style.display = 'none';
                await loadTagsFromFirestore();
                renderTagsForManagement();
            } catch (error) {
                console.error("Error updating tag: ", error);
                alert("タグの更新に失敗しました。");
            }
        });
    }

    async function deleteTag(docId, tagName) {
        // ... (前回から変更なし) ...
        if (confirm(`タグ「${tagName}」(Doc ID: ${docId})を削除しますか？\nこのタグを使用している全てのアイテムからも自動的に削除されます。`)) {
            try {
                const tagRef = doc(db, 'tags', docId);
                await deleteDoc(tagRef);
                
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
                
                await loadInitialData();
            } catch (error) {
                console.error("Error deleting tag and updating items: ", error);
                alert("タグの削除または関連アイテムの更新に失敗しました。");
            }
        }
    }
    
    function renderItemTagsSelector(selectedItemTagIds = []) {
        // ... (前回から変更なし) ...
        if (!itemTagsSelectorContainer) return;
        itemTagsSelectorContainer.innerHTML = '';
        tagsCache.forEach(tag => {
            const tagBtn = document.createElement('button');
            tagBtn.type = 'button';
            tagBtn.classList.add('tag-button');
            tagBtn.textContent = tag.name;
            tagBtn.dataset.tagId = tag.id;
            if (selectedItemTagIds.includes(tag.id)) {
                tagBtn.classList.add('selected');
            }
            tagBtn.addEventListener('click', () => {
                tagBtn.classList.toggle('selected');
            });
            itemTagsSelectorContainer.appendChild(tagBtn);
        });
    }

    // ★★★ 画像アップロード関連の修正箇所 ★★★
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
                uploadProgressContainer.style.display = 'none'; // 進捗表示をリセット
                uploadProgress.value = 0;
                uploadProgressText.textContent = '';
            } else {
                itemImagePreview.src = '#';
                itemImagePreview.style.display = 'none';
                selectedImageFile = null;
            }
        });
    }

    async function uploadImageAndGetURL(file) {
        if (!file) {
            console.log("No file selected for upload.");
            return null;
        }
        const imageName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`; // ファイル名からスペースを除去
        const storageImageRef = ref(storage, `item_images/${imageName}`);
        
        console.log(`Attempting to upload: ${imageName} to item_images/`);
        uploadProgressContainer.style.display = 'block';
        uploadProgress.value = 0;
        uploadProgressText.textContent = '0%';

        const uploadTask = uploadBytesResumable(storageImageRef, file);

        return new Promise((resolve, reject) => {
            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    console.log('Upload is ' + progress + '% done');
                    uploadProgress.value = progress;
                    uploadProgressText.textContent = `${Math.round(progress)}%`;
                    switch (snapshot.state) {
                        case 'paused':
                            console.log('Upload is paused');
                            break;
                        case 'running':
                            console.log('Upload is running');
                            break;
                    }
                },
                (error) => {
                    console.error("Upload failed:", error);
                    // エラーコードに基づいた詳細なエラーメッセージ
                    switch (error.code) {
                        case 'storage/unauthorized':
                            alert('画像のアップロード権限がありません。Firebase Storageのセキュリティルールを確認してください。');
                            break;
                        case 'storage/canceled':
                            alert('画像のアップロードがキャンセルされました。');
                            break;
                        case 'storage/unknown':
                            alert('不明なエラーにより画像のアップロードに失敗しました。コンソールを確認してください。');
                            break;
                        default:
                            alert(`画像のアップロードに失敗しました: ${error.message}`);
                    }
                    uploadProgressContainer.style.display = 'none';
                    reject(error); // Promiseをrejectで終了
                },
                async () => { // Complete callback
                    try {
                        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                        console.log('File available at', downloadURL);
                        uploadProgressContainer.style.display = 'none';
                        resolve(downloadURL); // Promiseをresolveで終了
                    } catch (error) {
                        console.error("Error getting download URL:", error);
                        uploadProgressContainer.style.display = 'none';
                        reject(error); // Promiseをrejectで終了
                    }
                }
            );
        });
    }
    // ★★★ ここまで画像アップロード関連の修正 ★★★

    async function loadItemsFromFirestore() {
        try {
            const q = query(collection(db, 'items'), orderBy('name'));
            const snapshot = await getDocs(q);
            itemsCache = snapshot.docs.map(docSnap => ({ docId: docSnap.id, ...docSnap.data() }));
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
            const editingDocId = itemIdToEditInput.value;
            let imageUrl = itemImageUrlInput.value;

            if (!name || !effect || !source) { alert("名前、効果、入手手段は必須です。"); return; }
            
            saveItemButton.disabled = true;
            saveItemButton.textContent = "保存中...";

            try {
                if (selectedImageFile) {
                    const existingImageUrlForDeletion = editingDocId ? imageUrl : null; // 編集時のみ既存URLを削除候補に

                    imageUrl = await uploadImageAndGetURL(selectedImageFile); // ここでPromiseが解決されるのを待つ

                    if (!imageUrl) { // アップロードが失敗した場合 (uploadImageAndGetURL内でalert表示済みのはず)
                        saveItemButton.disabled = false;
                        saveItemButton.textContent = editingDocId ? "アイテム更新" : "アイテム保存";
                        return; // ここで処理を中断
                    }
                    console.log("New image URL after upload:", imageUrl);

                    // 新しい画像が正常にアップロードされた後、古い画像を削除 (編集時のみ)
                    if (existingImageUrlForDeletion && existingImageUrlForDeletion !== imageUrl) {
                        try {
                            const oldImageRef = ref(storage, existingImageUrlForDeletion);
                            await deleteObject(oldImageRef);
                            console.log("Old image deleted from Storage:", existingImageUrlForDeletion);
                        } catch (error) {
                            if (error.code !== 'storage/object-not-found') {
                                console.warn("Could not delete old image from Storage (it might not exist or an error occurred):", error);
                            }
                        }
                    }

                } else if (!editingDocId && !imageUrl) {
                    // 新規作成で画像なしの場合は imageUrl は空のまま
                    console.log("No new image selected, and no existing image URL for new item.");
                }


                const itemData = {
                    name,
                    image: imageUrl || '',
                    effect,
                    入手手段: source,
                    tags: selectedTagIds,
                    updatedAt: serverTimestamp()
                };
                
                if (editingDocId) {
                    const itemRef = doc(db, 'items', editingDocId);
                    await updateDoc(itemRef, itemData);
                    console.log("Item updated with ID: ", editingDocId);
                } else {
                    itemData.createdAt = serverTimestamp();
                    const docRef = await addDoc(collection(db, 'items'), itemData);
                    console.log("Item added with ID: ", docRef.id);
                }
                
                await loadItemsFromFirestore(); // 保存後にデータを再読み込み
                renderItemsAdminTable();      // テーブルを再描画
                clearItemForm();              // フォームをクリア
            } catch (error) { // uploadImageAndGetURLからのrejectもここでキャッチされる
                console.error("Error during item save process: ", error);
                // alertはuploadImageAndGetURL内で行われるか、ここで一般的なエラーとして表示
                if (!error.message.includes('upload')) { // アップロード以外のエラーなら表示
                     alert(`アイテムの保存処理中にエラーが発生しました: ${error.message}`);
                }
            } finally {
                saveItemButton.disabled = false;
                saveItemButton.textContent = editingDocId ? "アイテム更新" : "アイテム保存";
            }
        });
    }

    if (clearFormButton) { // ... (前回から変更なし) ...
        clearFormButton.addEventListener('click', clearItemForm);
    }

    function clearItemForm() { // ... (前回から変更なし) ...
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

    function renderItemsAdminTable() { // ... (前回から変更なし、画像のonerrorパス修正) ...
        if (!itemsTableBody) return;
        itemsTableBody.innerHTML = '';
        const searchTerm = itemSearchAdminInput ? itemSearchAdminInput.value.toLowerCase() : "";

        const filteredItems = itemsCache.filter(item => 
            item.name && item.name.toLowerCase().includes(searchTerm)
        );

        filteredItems.forEach(item => {
            const tr = document.createElement('tr');
            const imageDisplayPath = item.image || '../images/placeholder_item.png'; // プレースホルダーはローカルパス
            
            const itemTagsString = item.tags ? item.tags.map(tagId => {
                const tagObj = tagsCache.find(t => t.id === tagId);
                return tagObj ? tagObj.name : `(ID: ${tagId})`;
            }).join(', ') : 'なし';
            const effectExcerpt = item.effect ? (item.effect.length > 30 ? item.effect.substring(0, 30) + '...' : item.effect) : '';

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
            if(editBtn) editBtn.addEventListener('click', () => loadItemForEdit(item.docId));
            if(deleteBtn) deleteBtn.addEventListener('click', () => deleteItem(item.docId, item.name, item.image));
            itemsTableBody.appendChild(tr);
        });
    }

    if (itemSearchAdminInput) { // ... (前回から変更なし) ...
        itemSearchAdminInput.addEventListener('input', renderItemsAdminTable);
    }

    async function loadItemForEdit(docId) { // ... (前回から変更なし) ...
        try {
            const itemRef = doc(db, "items", docId);
            const docSnap = await getDoc(itemRef);

            if (docSnap.exists()) {
                const itemData = docSnap.data();
                itemIdToEditInput.value = docSnap.id;
                itemNameInput.value = itemData.name;
                itemEffectInput.value = itemData.effect;
                itemSourceInput.value = itemData.入手手段;
                itemImageUrlInput.value = itemData.image || '';
                
                if (itemData.image) {
                    itemImagePreview.src = itemData.image;
                    itemImagePreview.style.display = 'block';
                } else {
                    itemImagePreview.src = '#';
                    itemImagePreview.style.display = 'none';
                }
                if (itemImageFileInput) itemImageFileInput.value = null;
                selectedImageFile = null;

                renderItemTagsSelector(itemData.tags || []);
                if (saveItemButton) saveItemButton.textContent = "アイテム更新";
                if (itemForm) itemForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
                console.error("編集するドキュメントが見つかりません:", docId);
                alert("編集対象のアイテムが見つかりませんでした。");
            }
        } catch (error) {
            console.error("編集用アイテムの読み込みエラー:", error);
            alert("編集データの読み込みに失敗しました。");
        }
    }

    async function deleteItem(docId, itemName, imageUrl) { // ... (前回から変更なし) ...
        if (confirm(`アイテム「${itemName}」(Doc ID: ${docId})を削除しますか？\nStorage上の画像も削除されます（存在する場合）。`)) {
            try {
                const itemRef = doc(db, 'items', docId);
                await deleteDoc(itemRef);
                console.log("Item deleted: ", docId);
                
                if (imageUrl) {
                    try {
                        const imageStorageRef = ref(storage, imageUrl);
                        await deleteObject(imageStorageRef);
                        console.log("Image deleted from Storage:", imageUrl);
                    } catch (storageError) {
                        if (storageError.code === 'storage/object-not-found') {
                            console.warn("Image not found in Storage, or already deleted:", imageUrl);
                        } else {
                            console.warn("Could not delete image from Storage:", storageError);
                        }
                    }
                }

                await loadItemsFromFirestore();
                renderItemsAdminTable();
                if (itemIdToEditInput.value === docId) clearItemForm();
            } catch (error) {
                console.error("Error deleting item: ", error);
                alert("アイテムの削除に失敗しました。");
            }
        }
    }
    
    // モーダル関連 (変更なし)
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
});
