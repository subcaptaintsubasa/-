// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js"; // 例: 9.6.10 (最新版を確認)
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
// Firebase Storageのimportは不要

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBxrE-9E46dplHTuEBmmcJWQRU1vLgAGAU", // 
  authDomain: "itemsearchtooleditor.firebaseapp.com",
  projectId: "itemsearchtooleditor",
  storageBucket: "itemsearchtooleditor.appspot.com", // Firebase Storageは使わないが念のため残してもOK
  messagingSenderId: "243156973544",
  appId: "1:243156973544:web:ffdc31134a35354b6dd65d",
  measurementId: "G-8EHP9MGJ4M" // Optional
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
// const storage = getStorage(app); // Firebase Storageは使わないのでコメントアウトまたは削除

// ★★★ Cloudflare WorkerのエンドポイントURL ★★★
const IMAGE_UPLOAD_WORKER_URL = 'https://denpa-item-uploader.tsubasa-hsty-f58.workers.dev'; // ★★★ あなたのWorkerのURLに置き換える ★★★


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
    const itemImageFileInput = document.getElementById('itemImageFile'); // HTML側のIDを確認
    const itemImagePreview = document.getElementById('itemImagePreview');
    const itemImageUrlInput = document.getElementById('itemImageUrl'); // R2のURLを保持
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

    // --- 認証 --- (変更なし)
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
                    passwordError.textContent = `ログインエラー: ${error.code} - ${error.message}`;
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

    // --- 初期データロード (Firestoreから) --- (変更なし)
    async function loadInitialData() {
        await loadTagsFromFirestore();
        await loadItemsFromFirestore();
        renderTagsForManagement();
        renderItemTagsSelector();
        renderItemsAdminTable();
    }

    // --- タグ管理 (Firestore) --- (変更なし)
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

    // ★★★ 画像アップロード (Cloudflare Worker連携) ★★★
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
                itemImageUrlInput.value = ''; 
                uploadProgressContainer.style.display = 'none';
                uploadProgress.value = 0;
                uploadProgressText.textContent = '';
            } else {
                itemImagePreview.src = '#';
                itemImagePreview.style.display = 'none';
                selectedImageFile = null;
            }
        });
    }

    async function uploadImageToWorkerAndGetURL(file) {
        if (!file) {
            console.log("No file selected for upload.");
            return null;
        }
        
        uploadProgressContainer.style.display = 'block';
        uploadProgress.value = 0; 
        uploadProgressText.textContent = 'アップロード準備中...'; // 初期メッセージ

        const formData = new FormData();
        formData.append('imageFile', file); // Workerスクリプトで期待するキー名

        try {
            // fetchリクエストの進捗は直接取得できないため、ここでは開始と完了のみ示す
            uploadProgressText.textContent = 'アップロード中... (0%)'; // 0%表示は仮

            const response = await fetch(IMAGE_UPLOAD_WORKER_URL, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'サーバーからの不明なエラー' }));
                console.error('Upload failed with status:', response.status, errorData);
                alert(`画像のアップロードに失敗しました: ${errorData.error || response.statusText}`);
                uploadProgressContainer.style.display = 'none';
                return null;
            }

            const result = await response.json();
            if (result.success && result.imageUrl) {
                console.log('File uploaded to R2, URL:', result.imageUrl);
                uploadProgressText.textContent = 'アップロード完了!';
                // 少し待ってから進捗表示を隠す (任意)
                setTimeout(() => { uploadProgressContainer.style.display = 'none'; }, 2000);
                return result.imageUrl;
            } else {
                console.error('Upload response error:', result);
                alert(`画像のアップロードに成功しましたが、URLの取得に問題がありました: ${result.message || '不明な応答'}`);
                uploadProgressContainer.style.display = 'none';
                return null;
            }
        } catch (error) {
            console.error('Error uploading image to worker:', error);
            uploadProgressContainer.style.display = 'none';
            alert(`画像のアップロード中に通信エラーが発生しました: ${error.message}`);
            return null;
        }
    }
    // ★★★ ここまで画像アップロード関連 ★★★

    async function loadItemsFromFirestore() { // (変更なし)
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
            let imageUrl = itemImageUrlInput.value; // 編集時は既存のURLがセットされている

            if (!name || !effect || !source) { alert("名前、効果、入手手段は必須です。"); return; }
            
            saveItemButton.disabled = true;
            saveItemButton.textContent = "保存中...";

            try {
                if (selectedImageFile) {
                    const existingImageUrlForDeletion = editingDocId ? imageUrl : null;

                    imageUrl = await uploadImageToWorkerAndGetURL(selectedImageFile);

                    if (!imageUrl) {
                        saveItemButton.disabled = false;
                        saveItemButton.textContent = editingDocId ? "アイテム更新" : "アイテム保存";
                        return; 
                    }
                    console.log("New image URL after upload to R2:", imageUrl);

                    // R2上の古い画像の削除は手動または専用Workerエンドポイントで行う (今回は行わない)
                    if (existingImageUrlForDeletion && existingImageUrlForDeletion !== imageUrl) {
                        console.warn(`Old image ${existingImageUrlForDeletion} (R2) should be deleted manually or via a dedicated worker endpoint.`);
                    }
                } else if (!editingDocId && !imageUrl) {
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
                
                await loadItemsFromFirestore();
                renderItemsAdminTable();
                clearItemForm();
            } catch (error) {
                console.error("Error during item save process: ", error);
                 alert(`アイテムの保存処理中にエラーが発生しました: ${error.message}`);
            } finally {
                saveItemButton.disabled = false;
                saveItemButton.textContent = editingDocId ? "アイテム更新" : "アイテム保存";
            }
        });
    }

    if (clearFormButton) { // (変更なし)
        clearFormButton.addEventListener('click', clearItemForm);
    }

    function clearItemForm() { // (変更なし)
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

    function renderItemsAdminTable() { // (画像のonerrorパス修正)
        if (!itemsTableBody) return;
        itemsTableBody.innerHTML = '';
        const searchTerm = itemSearchAdminInput ? itemSearchAdminInput.value.toLowerCase() : "";

        const filteredItems = itemsCache.filter(item => 
            item.name && item.name.toLowerCase().includes(searchTerm)
        );

        filteredItems.forEach(item => {
            const tr = document.createElement('tr');
            const imageDisplayPath = item.image || '../images/placeholder_item.png';
            
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
            if(deleteBtn) deleteBtn.addEventListener('click', () => deleteItem(item.docId, item.name, item.image)); // item.imageはR2のURL
            itemsTableBody.appendChild(tr);
        });
    }

    if (itemSearchAdminInput) { // (変更なし)
        itemSearchAdminInput.addEventListener('input', renderItemsAdminTable);
    }

    async function loadItemForEdit(docId) { // (変更なし)
        try {
            const itemRef = doc(db, "items", docId);
            const docSnap = await getDoc(itemRef);

            if (docSnap.exists()) {
                const itemData = docSnap.data();
                itemIdToEditInput.value = docSnap.id;
                itemNameInput.value = itemData.name;
                itemEffectInput.value = itemData.effect;
                itemSourceInput.value = itemData.入手手段;
                itemImageUrlInput.value = itemData.image || ''; // R2のURL
                
                if (itemData.image) {
                    itemImagePreview.src = itemData.image; // R2のURLでプレビュー
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

    async function deleteItem(docId, itemName, imageUrl) { // imageUrlはR2のURL
        if (confirm(`アイテム「${itemName}」(Doc ID: ${docId})を削除しますか？\nCloudflare R2上の関連画像は、手動で削除するか、別途削除用Workerを実装する必要があります。`)) {
            try {
                const itemRef = doc(db, 'items', docId);
                await deleteDoc(itemRef);
                console.log("Item deleted from Firestore: ", docId);
                
                if (imageUrl) {
                    console.warn(`Image ${imageUrl} (R2) associated with deleted item ${docId} needs to be manually deleted or via a dedicated worker endpoint for R2 deletion.`);
                    // R2からの自動削除は、クライアントからは安全に行えないため、ここでは行わない
                }

                await loadItemsFromFirestore();
                renderItemsAdminTable();
                if (itemIdToEditInput.value === docId) clearItemForm();
            } catch (error) {
                console.error("Error deleting item from Firestore: ", error);
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
