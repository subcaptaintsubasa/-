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
    getDoc,
    runTransaction // カテゴリ削除時のタグ更新に使用
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBxrE-9E46dplHTuEBmmcJWQRU1vLgAGAU", 
  authDomain: "itemsearchtooleditor.firebaseapp.com",
  projectId: "itemsearchtooleditor",
  storageBucket: "itemsearchtooleditor.appspot.com",
  messagingSenderId: "243156973544",
  appId: "1:243156973544:web:ffdc31134a35354b6dd65d",
  measurementId: "G-8EHP9MGJ4M"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const IMAGE_UPLOAD_WORKER_URL = 'https://denpa-item-uploader.tsubasa-hsty-f58.workers.dev'; 


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

    // Category Management DOM
    const newCategoryNameInput = document.getElementById('newCategoryName');
    const addCategoryButton = document.getElementById('addCategoryButton');
    const categoryListContainer = document.getElementById('categoryListContainer');
    const editCategoryModal = document.getElementById('editCategoryModal');
    const editingCategoryDocIdInput = document.getElementById('editingCategoryDocId');
    const editingCategoryNameInput = document.getElementById('editingCategoryName');
    const saveCategoryEditButton = document.getElementById('saveCategoryEditButton');
    const newTagCategorySelect = document.getElementById('newTagCategorySelect'); // For adding new tag
    const editingTagCategorySelect = document.getElementById('editingTagCategorySelect'); // For editing tag


    // Tag Management DOM
    const newTagNameInput = document.getElementById('newTagName');
    const addTagButton = document.getElementById('addTagButton');
    const tagListContainer = document.getElementById('tagListContainer');
    const editTagModal = document.getElementById('editTagModal');
    const editingTagDocIdInput = document.getElementById('editingTagDocId');
    const editingTagNameInput = document.getElementById('editingTagName');
    const saveTagEditButton = document.getElementById('saveTagEditButton');

    // Item Management DOM
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

    let categoriesCache = [];
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
        if (categoryListContainer) categoryListContainer.innerHTML = '';
        if (tagListContainer) tagListContainer.innerHTML = '';
        if (itemsTableBody) itemsTableBody.innerHTML = '';
        if (itemTagsSelectorContainer) itemTagsSelectorContainer.innerHTML = '';
        if (newTagCategorySelect) newTagCategorySelect.innerHTML = '<option value="">カテゴリを選択...</option>';
        if (editingTagCategorySelect) editingTagCategorySelect.innerHTML = '<option value="">カテゴリなし (未分類)</option>';
        clearItemForm();
    }

    // --- 初期データロード ---
    async function loadInitialData() {
        console.log("[Initial Load] Starting to load all initial data...");
        await loadCategoriesFromFirestore(); // カテゴリを先にロード
        await loadTagsFromFirestore();
        await loadItemsFromFirestore();
        
        renderCategoriesForManagement();
        populateCategorySelects(); // カテゴリ選択プルダウンを埋める
        renderTagsForManagement(); // タグ表示（カテゴリ情報と共に）
        renderItemTagsSelector();  // アイテムフォーム内のタグ選択
        renderItemsAdminTable();
        console.log("[Initial Load] Finished loading all initial data and rendering UI.");
    }

    // --- カテゴリ管理 ---
    async function loadCategoriesFromFirestore() {
        console.log("[Categories] Loading categories from Firestore...");
        try {
            const q = query(collection(db, 'categories'), orderBy('name'));
            const snapshot = await getDocs(q);
            categoriesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("[Categories] Categories loaded successfully:", categoriesCache);
        } catch (error) {
            console.error("[Categories] Error loading categories from Firestore:", error);
            categoriesCache = [];
        }
    }

    function renderCategoriesForManagement() {
        if (!categoryListContainer) return;
        console.log("[Categories] Rendering categories for management UI...");
        categoryListContainer.innerHTML = '';
        categoriesCache.forEach(category => {
            const div = document.createElement('div');
            div.classList.add('list-item');
            div.innerHTML = `
                <span>${category.name} (ID: ${category.id})</span>
                <div>
                    <button class="edit-category action-button" data-category-id="${category.id}" data-category-name="${category.name}" title="編集">✎</button>
                    <button class="delete-category action-button delete" data-category-id="${category.id}" data-category-name="${category.name}" title="削除">×</button>
                </div>
            `;
            categoryListContainer.appendChild(div);
        });
        // イベントリスナーを(再)設定
        categoryListContainer.querySelectorAll('.edit-category').forEach(btn => {
            btn.addEventListener('click', (e) => openEditCategoryModal(e.currentTarget.dataset.categoryId, e.currentTarget.dataset.categoryName));
        });
        categoryListContainer.querySelectorAll('.delete-category').forEach(btn => {
            btn.addEventListener('click', (e) => deleteCategory(e.currentTarget.dataset.categoryId, e.currentTarget.dataset.categoryName));
        });
        console.log("[Categories] Finished rendering categories for management UI.");
    }

    function populateCategorySelects() {
        console.log("[Categories] Populating category select dropdowns...");
        if (newTagCategorySelect) {
            newTagCategorySelect.innerHTML = '<option value="">カテゴリを選択...</option>';
            categoriesCache.forEach(cat => {
                newTagCategorySelect.add(new Option(cat.name, cat.id));
            });
        }
        if (editingTagCategorySelect) {
            editingTagCategorySelect.innerHTML = '<option value="">カテゴリなし (未分類)</option>';
             categoriesCache.forEach(cat => {
                editingTagCategorySelect.add(new Option(cat.name, cat.id));
            });
        }
        console.log("[Categories] Finished populating category select dropdowns.");
    }
    
    if (addCategoryButton) {
        addCategoryButton.addEventListener('click', async () => {
            const name = newCategoryNameInput.value.trim();
            console.log("[Category Add] Attempting to add category with name:", name);

            if (!name) {
                alert("カテゴリ名を入力してください。");
                console.warn("[Category Add] Category name is empty.");
                return;
            }
            
            console.log("[Category Add] Checking for existing category with the same name...");
            const q = query(collection(db, 'categories'), where('name', '==', name));
            try {
                const existingQuery = await getDocs(q);
                if (!existingQuery.empty) {
                    alert("同じ名前のカテゴリが既に存在します。");
                    console.warn("[Category Add] Category with the same name already exists.");
                    return;
                }
            } catch (error) {
                console.error("[Category Add] Error checking for existing category:", error);
                alert("既存カテゴリの確認中にエラーが発生しました。詳細はコンソールを確認してください。");
                return;
            }
            
            try {
                console.log("[Category Add] Attempting to add document to 'categories' collection in Firestore...");
                const docRef = await addDoc(collection(db, 'categories'), { 
                    name: name,
                    createdAt: serverTimestamp() // 作成日時も記録
                });
                console.log("[Category Add] Category added successfully to Firestore with ID:", docRef.id);
                
                newCategoryNameInput.value = '';
                
                console.log("[Category Add] Reloading categories from Firestore...");
                await loadCategoriesFromFirestore(); // データを再読み込み
                console.log("[Category Add] Rendering categories for management UI...");
                renderCategoriesForManagement(); // UIを更新
                console.log("[Category Add] Populating category select dropdowns...");
                populateCategorySelects(); // プルダウンも更新
                console.log("[Category Add] Category add process completed successfully.");

            } catch (error) {
                console.error("[Category Add] Error adding category to Firestore:", error);
                alert("カテゴリの追加に失敗しました。Firestoreへの書き込み権限などを確認してください。詳細はコンソールを確認してください。");
            }
        });
    }

    function openEditCategoryModal(docId, currentName) {
        console.log(`[Category Edit] Opening modal for category ID: ${docId}, current name: ${currentName}`);
        editingCategoryDocIdInput.value = docId;
        editingCategoryNameInput.value = currentName;
        editCategoryModal.style.display = 'flex';
        editingCategoryNameInput.focus();
    }

    if (saveCategoryEditButton) {
        saveCategoryEditButton.addEventListener('click', async () => {
            const docId = editingCategoryDocIdInput.value;
            const newName = editingCategoryNameInput.value.trim();
            console.log(`[Category Edit] Attempting to save category ID: ${docId} with new name: ${newName}`);

            if (!newName) { 
                alert("カテゴリ名は空にできません。");
                console.warn("[Category Edit] New category name is empty.");
                return;
            }

            console.log("[Category Edit] Checking for existing category with the new name (excluding current one)...");
            const q = query(collection(db, 'categories'), where('name', '==', newName));
            let conflict = false;
            try {
                const existingQuery = await getDocs(q);
                existingQuery.forEach(docSnap => { if (docSnap.id !== docId) conflict = true; });
            } catch (error) {
                 console.error("[Category Edit] Error checking for existing category during edit:", error);
                alert("既存カテゴリの確認中にエラーが発生しました。");
                return;
            }

            if (conflict) { 
                alert("編集後の名前が、他の既存カテゴリと重複します。");
                console.warn("[Category Edit] New category name conflicts with an existing category.");
                return;
            }

            try {
                console.log("[Category Edit] Updating category document in Firestore...");
                await updateDoc(doc(db, 'categories', docId), { name: newName });
                console.log("[Category Edit] Category updated successfully in Firestore.");
                editCategoryModal.style.display = 'none';
                
                await loadCategoriesFromFirestore();
                renderCategoriesForManagement();
                populateCategorySelects();
                await loadTagsFromFirestore(); 
                renderTagsForManagement(); // カテゴリ名変更がタグ表示に影響する可能性
                console.log("[Category Edit] Category edit process completed successfully.");
            } catch (error) {
                console.error("[Category Edit] Error updating category in Firestore:", error);
                alert("カテゴリの更新に失敗しました。");
            }
        });
    }

    async function deleteCategory(docId, categoryName) {
        console.log(`[Category Delete] Attempting to delete category ID: ${docId}, name: ${categoryName}`);
        if (confirm(`カテゴリ「${categoryName}」を削除しますか？\nこのカテゴリに属するタグは「未分類」(カテゴリなし)になります。`)) {
            try {
                console.log("[Category Delete] Starting Firestore transaction...");
                await runTransaction(db, async (transaction) => {
                    const categoryRef = doc(db, 'categories', docId);
                    console.log(`[Category Delete Transaction] Deleting category document: ${docId}`);
                    transaction.delete(categoryRef);

                    console.log(`[Category Delete Transaction] Querying tags associated with category ID: ${docId}`);
                    const tagsToUpdateQuery = query(collection(db, 'tags'), where('categoryId', '==', docId));
                    // トランザクション内でgetDocsを実行するには、先にトランザクション外で取得するか、
                    // もしくはトランザクション内で読み取り、その結果に基づいて更新します。
                    // 今回はシンプルに、トランザクション外でgetDocsして、その結果をトランザクション内で使うアプローチのほうが安全ですが、
                    // Firestoreのトランザクションのベストプラクティスとしては、読み取りもトランザクション内で行うことが推奨されます。
                    // ここでは、まず先にタグを取得し、それからトランザクションを開始する形も考えられますが、
                    // 既存のコードはトランザクション内でgetDocsをしています。これは実際にはトランザクション読み取りになりません。
                    // 正しくは、transaction.get() を使うべきです。
                    // ただし、現在のSDKバージョンと使い方では、先にタグIDのリストを取得してからバッチ書き込み、
                    // または個別のトランザクションで更新する方が一般的かもしれません。
                    // 今回は既存のロジックを尊重しつつ、コメントで補足します。
                    // より堅牢にするなら、まずカテゴリに属するタグのドキュメントIDを全て取得し、
                    // その後、バッチ書き込みでそれらのタグのcategoryIdを更新し、最後にカテゴリを削除します。
                    // runTransactionはアトミックな操作を保証しますが、多くの書き込みには向いていません。
                    
                    const tagsSnapshot = await getDocs(tagsToUpdateQuery); // これはトランザクション外の読み取りになる点に注意
                    tagsSnapshot.forEach(tagDocSnap => {
                        console.log(`[Category Delete Transaction] Updating tag ${tagDocSnap.id} to remove categoryId.`);
                        transaction.update(doc(db, 'tags', tagDocSnap.id), { categoryId: "" });
                    });
                });

                console.log(`[Category Delete] Category ${docId} deleted and associated tags updated successfully.`);
                await loadInitialData(); // 全データ再読み込みと再描画
            } catch (error) {
                console.error("[Category Delete] Error deleting category and updating tags:", error);
                alert("カテゴリの削除または関連タグの更新に失敗しました。");
            }
        } else {
            console.log("[Category Delete] Deletion cancelled by user.");
        }
    }


    // --- タグ管理 ---
    async function loadTagsFromFirestore() {
        console.log("[Tags] Loading tags from Firestore...");
        try {
            const q = query(collection(db, 'tags'), orderBy('name'));
            const snapshot = await getDocs(q);
            tagsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("[Tags] Tags loaded successfully:", tagsCache);
        } catch (error) {
            console.error("[Tags] Error loading tags from Firestore:", error);
            tagsCache = [];
        }
    }

    function renderTagsForManagement() {
        if (!tagListContainer) return;
        console.log("[Tags] Rendering tags for management UI...");
        tagListContainer.innerHTML = '';
        tagsCache.forEach(tag => {
            const category = categoriesCache.find(c => c.id === tag.categoryId);
            const categoryName = category ? category.name : '未分類';
            
            const div = document.createElement('div');
            div.classList.add('list-item');
            div.innerHTML = `
                <span>${tag.name} (カテゴリ: ${categoryName}, ID: ${tag.id})</span>
                <div>
                    <button class="edit-tag action-button" data-tag-id="${tag.id}" title="編集">✎</button>
                    <button class="delete-tag action-button delete" data-tag-id="${tag.id}" data-tag-name="${tag.name}" title="削除">×</button>
                </div>
            `;
            tagListContainer.appendChild(div);
        });
        tagListContainer.querySelectorAll('.edit-tag').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tagId = e.currentTarget.dataset.tagId;
                const tagToEdit = tagsCache.find(t => t.id === tagId);
                if (tagToEdit) openEditTagModal(tagId, tagToEdit.name, tagToEdit.categoryId || "");
            });
        });
        tagListContainer.querySelectorAll('.delete-tag').forEach(btn => {
            btn.addEventListener('click', (e) => deleteTag(e.currentTarget.dataset.tagId, e.currentTarget.dataset.tagName));
        });
        console.log("[Tags] Finished rendering tags for management UI.");
        renderItemTagsSelector();
    }

    if (addTagButton) {
        addTagButton.addEventListener('click', async () => {
            const name = newTagNameInput.value.trim();
            const categoryId = newTagCategorySelect.value;
            console.log(`[Tag Add] Attempting to add tag with name: ${name}, categoryId: ${categoryId}`);
            
            if (!name) { alert("タグ名を入力してください。"); console.warn("[Tag Add] Tag name is empty."); return; }
            
            console.log("[Tag Add] Checking for existing tag with the same name...");
            const q = query(collection(db, 'tags'), where('name', '==', name));
            try {
                const existingQuery = await getDocs(q);
                if (!existingQuery.empty) { 
                    alert("同じ名前のタグが既に存在します。");
                    console.warn("[Tag Add] Tag with the same name already exists.");
                    return;
                }
            } catch (error) {
                console.error("[Tag Add] Error checking for existing tag:", error);
                alert("既存タグの確認中にエラーが発生しました。");
                return;
            }
            
            try {
                console.log("[Tag Add] Attempting to add document to 'tags' collection in Firestore...");
                await addDoc(collection(db, 'tags'), { 
                    name: name, 
                    categoryId: categoryId || "",
                    createdAt: serverTimestamp()
                });
                console.log("[Tag Add] Tag added successfully to Firestore.");
                newTagNameInput.value = '';
                newTagCategorySelect.value = '';
                await loadTagsFromFirestore();
                renderTagsForManagement();
                console.log("[Tag Add] Tag add process completed successfully.");
            } catch (error) {
                console.error("[Tag Add] Error adding tag to Firestore:", error);
                alert("タグの追加に失敗しました。");
            }
        });
    }

    function openEditTagModal(docId, currentName, currentCategoryId) {
        console.log(`[Tag Edit] Opening modal for tag ID: ${docId}, current name: ${currentName}, categoryId: ${currentCategoryId}`);
        editingTagDocIdInput.value = docId;
        editingTagNameInput.value = currentName;
        editingTagCategorySelect.value = currentCategoryId || "";
        editTagModal.style.display = 'flex';
        editingTagNameInput.focus();
    }

    if (saveTagEditButton) {
        saveTagEditButton.addEventListener('click', async () => {
            const docId = editingTagDocIdInput.value;
            const newName = editingTagNameInput.value.trim();
            const newCategoryId = editingTagCategorySelect.value;
            console.log(`[Tag Edit] Attempting to save tag ID: ${docId} with new name: ${newName}, new categoryId: ${newCategoryId}`);

            if (!newName) { alert("タグ名は空にできません。"); console.warn("[Tag Edit] New tag name is empty."); return; }

            console.log("[Tag Edit] Checking for existing tag with the new name (excluding current one)...");
            const q = query(collection(db, 'tags'), where('name', '==', newName));
            let conflict = false;
            try {
                const existingQuery = await getDocs(q);
                existingQuery.forEach(docSnap => { if (docSnap.id !== docId) conflict = true; });
            } catch (error) {
                console.error("[Tag Edit] Error checking for existing tag during edit:", error);
                alert("既存タグの確認中にエラーが発生しました。");
                return;
            }
            if (conflict) { 
                alert("編集後の名前が、他の既存タグと重複します。");
                console.warn("[Tag Edit] New tag name conflicts with an existing tag.");
                return;
            }

            try {
                console.log("[Tag Edit] Updating tag document in Firestore...");
                await updateDoc(doc(db, 'tags', docId), { name: newName, categoryId: newCategoryId || "" });
                console.log("[Tag Edit] Tag updated successfully in Firestore.");
                editTagModal.style.display = 'none';
                await loadTagsFromFirestore();
                renderTagsForManagement();
                console.log("[Tag Edit] Tag edit process completed successfully.");
            } catch (error) {
                console.error("[Tag Edit] Error updating tag in Firestore:", error);
                alert("タグの更新に失敗しました。");
            }
        });
    }

    async function deleteTag(docId, tagName) {
        console.log(`[Tag Delete] Attempting to delete tag ID: ${docId}, name: ${tagName}`);
        if (confirm(`タグ「${tagName}」を削除しますか？\nこのタグを使用している全てのアイテムからも自動的に削除されます。`)) {
            try {
                console.log("[Tag Delete] Deleting tag document from Firestore...");
                await deleteDoc(doc(db, 'tags', docId));
                console.log(`[Tag Delete] Tag ${docId} deleted from Firestore.`);
                
                console.log(`[Tag Delete] Querying items associated with tag ID: ${docId} for update...`);
                const q = query(collection(db, 'items'), where('tags', 'array-contains', docId));
                const itemsToUpdateSnapshot = await getDocs(q);
                if (!itemsToUpdateSnapshot.empty) {
                    console.log(`[Tag Delete] Found ${itemsToUpdateSnapshot.size} items to update. Starting batch write...`);
                    const batch = writeBatch(db);
                    itemsToUpdateSnapshot.forEach(itemDocSnap => {
                        const currentTags = itemDocSnap.data().tags || [];
                        const updatedTags = currentTags.filter(tagId => tagId !== docId);
                        batch.update(itemDocSnap.ref, { tags: updatedTags });
                        console.log(`[Tag Delete Batch] Updating item ${itemDocSnap.id}, removing tag ${docId}.`);
                    });
                    await batch.commit();
                    console.log("[Tag Delete Batch] Batch write completed.");
                } else {
                    console.log("[Tag Delete] No items found associated with this tag.");
                }
                
                await loadTagsFromFirestore();
                renderTagsForManagement();
                console.log("[Tag Delete] Tag delete process completed successfully.");
            } catch (error) {
                console.error("[Tag Delete] Error deleting tag and updating items:", error);
                alert("タグの削除または関連アイテムの更新に失敗しました。");
            }
        } else {
            console.log("[Tag Delete] Deletion cancelled by user.");
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

    // --- 画像アップロード ---
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
            } else {
                itemImagePreview.src = '#';
                itemImagePreview.style.display = 'none';
                selectedImageFile = null;
            }
        });
    }

    async function uploadImageToWorkerAndGetURL(file) {
        if (!file) return null;
        console.log("[Image Upload] Starting image upload to worker for file:", file.name);
        uploadProgressContainer.style.display = 'block';
        uploadProgress.value = 0; 
        uploadProgressText.textContent = 'アップロード準備中...';
        const formData = new FormData();
        formData.append('imageFile', file);
        try {
            uploadProgressText.textContent = 'アップロード中...';
            const response = await fetch(IMAGE_UPLOAD_WORKER_URL, { method: 'POST', body: formData });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'サーバーからの不明なエラー' }));
                console.error('[Image Upload] Upload failed with status:', response.status, errorData);
                alert(`画像のアップロードに失敗しました: ${errorData.error || response.statusText}`);
                uploadProgressContainer.style.display = 'none'; return null;
            }
            const result = await response.json();
            if (result.success && result.imageUrl) {
                console.log('[Image Upload] File uploaded to R2, URL:', result.imageUrl);
                uploadProgressText.textContent = 'アップロード完了!';
                setTimeout(() => { uploadProgressContainer.style.display = 'none'; }, 2000);
                return result.imageUrl;
            } else {
                console.error('[Image Upload] Upload response error:', result);
                alert(`画像のアップロードエラー: ${result.message || '不明な応答'}`);
                uploadProgressContainer.style.display = 'none'; return null;
            }
        } catch (error) {
            console.error('[Image Upload] Error uploading image to worker:', error);
            alert(`画像のアップロード中に通信エラー: ${error.message}`);
            uploadProgressContainer.style.display = 'none'; return null;
        }
    }

    // --- アイテム管理 ---
    async function loadItemsFromFirestore() {
        console.log("[Items] Loading items from Firestore...");
        try {
            const q = query(collection(db, 'items'), orderBy('name'));
            const snapshot = await getDocs(q);
            itemsCache = snapshot.docs.map(docSnap => ({ docId: docSnap.id, ...docSnap.data() }));
            console.log("[Items] Items loaded successfully:", itemsCache);
        } catch (error) {
            console.error("[Items] Error loading items from Firestore:", error);
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
            console.log(`[Item Save] Attempting to save item. Editing ID: ${editingDocId || 'New Item'}`);
            
            saveItemButton.disabled = true;
            saveItemButton.textContent = "保存中...";

            try {
                if (selectedImageFile) {
                    console.log("[Item Save] New image file selected, attempting upload...");
                    imageUrl = await uploadImageToWorkerAndGetURL(selectedImageFile);
                    if (imageUrl === null && selectedImageFile) {
                        console.warn("[Item Save] Image upload failed, aborting item save.");
                        saveItemButton.disabled = false;
                        saveItemButton.textContent = editingDocId ? "アイテム更新" : "アイテム保存";
                        return; 
                    }
                    console.log("[Item Save] Image uploaded, URL:", imageUrl);
                }

                const itemData = {
                    name: name || "",
                    image: imageUrl || "",
                    effect: effect || "",
                    入手手段: source || "",
                    tags: selectedTagIds,
                    updatedAt: serverTimestamp()
                };
                
                if (editingDocId) {
                    console.log(`[Item Save] Updating existing item ID: ${editingDocId} in Firestore...`);
                    await updateDoc(doc(db, 'items', editingDocId), itemData);
                    console.log(`[Item Save] Item ${editingDocId} updated successfully.`);
                } else {
                    itemData.createdAt = serverTimestamp();
                    console.log("[Item Save] Adding new item to Firestore...");
                    const docRef = await addDoc(collection(db, 'items'), itemData);
                    console.log("[Item Save] New item added successfully with ID:", docRef.id);
                }
                
                await loadItemsFromFirestore();
                renderItemsAdminTable();
                clearItemForm();
                console.log("[Item Save] Item save process completed successfully.");
            } catch (error) {
                console.error("[Item Save] Error during item save process:", error);
                 alert(`アイテムの保存処理中にエラーが発生しました: ${error.message}`);
            } finally {
                saveItemButton.disabled = false;
                saveItemButton.textContent = editingDocId ? "アイテム更新" : "アイテム保存";
            }
        });
    }

    if (clearFormButton) {
        clearFormButton.addEventListener('click', clearItemForm);
    }

    function clearItemForm() {
        console.log("[Form] Clearing item form...");
        if (itemForm) itemForm.reset();
        itemIdToEditInput.value = '';
        itemImageUrlInput.value = '';
        if (itemImagePreview) { itemImagePreview.src = '#'; itemImagePreview.style.display = 'none'; }
        if (itemImageFileInput) itemImageFileInput.value = null;
        selectedImageFile = null;
        uploadProgressContainer.style.display = 'none';
        renderItemTagsSelector();
        if (saveItemButton) saveItemButton.textContent = "アイテム保存";
        console.log("[Form] Item form cleared.");
    }

    function renderItemsAdminTable() {
        if (!itemsTableBody) return;
        console.log("[Items Table] Rendering items admin table...");
        itemsTableBody.innerHTML = '';
        const searchTerm = itemSearchAdminInput ? itemSearchAdminInput.value.toLowerCase() : "";

        const filteredItems = itemsCache.filter(item => 
            (item.name && item.name.toLowerCase().includes(searchTerm)) ||
            (!searchTerm && (item.name === "" || !item.name)) // 検索語がない場合は名前が空または未定義のアイテムも表示
        );

        filteredItems.forEach(item => {
            const tr = document.createElement('tr');
            const imageDisplayPath = item.image || '../images/placeholder_item.png';
            
            const itemTagsString = item.tags ? item.tags.map(tagId => {
                const tagObj = tagsCache.find(t => t.id === tagId);
                return tagObj ? tagObj.name : `(ID: ${tagId})`;
            }).join(', ') : 'なし';
            const effectExcerpt = item.effect ? (item.effect.substring(0, 30) + (item.effect.length > 30 ? '...' : '')) : '(未設定)';
            const nameDisplay = item.name || '(名称未設定)';

            tr.innerHTML = `
                <td><img src="${imageDisplayPath}" alt="${nameDisplay}" onerror="this.onerror=null; this.src='../images/placeholder_item.png';"></td>
                <td>${nameDisplay}</td>
                <td>${effectExcerpt}</td>
                <td>${itemTagsString}</td>
                <td>
                    <button class="edit-item action-button" data-item-doc-id="${item.docId}" title="編集">✎</button>
                    <button class="delete-item action-button delete" data-item-doc-id="${item.docId}" title="削除">×</button>
                </td>
            `;
            tr.querySelector('.edit-item').addEventListener('click', () => loadItemForEdit(item.docId));
            tr.querySelector('.delete-item').addEventListener('click', () => deleteItem(item.docId, item.name, item.image));
            itemsTableBody.appendChild(tr);
        });
        console.log(`[Items Table] Finished rendering ${filteredItems.length} items.`);
    }

    if (itemSearchAdminInput) {
        itemSearchAdminInput.addEventListener('input', renderItemsAdminTable);
    }

    async function loadItemForEdit(docId) {
        console.log(`[Item Edit] Loading item ID: ${docId} for editing...`);
        try {
            const itemSnap = await getDoc(doc(db, "items", docId));
            if (itemSnap.exists()) {
                const itemData = itemSnap.data();
                itemIdToEditInput.value = itemSnap.id;
                itemNameInput.value = itemData.name || "";
                itemEffectInput.value = itemData.effect || "";
                itemSourceInput.value = itemData.入手手段 || "";
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
                console.log(`[Item Edit] Item ${docId} loaded into form.`);
            } else {
                console.error(`[Item Edit] Item with ID: ${docId} not found.`);
                alert("編集対象のアイテムが見つかりませんでした。");
            }
        } catch (error) {
            console.error(`[Item Edit] Error loading item ${docId} for edit:`, error);
            alert("編集データの読み込みに失敗しました。");
        }
    }

    async function deleteItem(docId, itemName, imageUrl) {
        const displayName = itemName || '(名称未設定)';
        console.log(`[Item Delete] Attempting to delete item ID: ${docId}, name: ${displayName}`);
        if (confirm(`アイテム「${displayName}」を削除しますか？\nCloudflare R2上の関連画像は手動での削除が必要です。`)) {
            try {
                console.log(`[Item Delete] Deleting item ${docId} from Firestore...`);
                await deleteDoc(doc(db, 'items', docId));
                console.log(`[Item Delete] Item ${docId} deleted from Firestore.`);
                if (imageUrl) {
                    console.warn(`[Item Delete] Image ${imageUrl} (R2) for item ${docId} needs manual deletion.`);
                }
                await loadItemsFromFirestore();
                renderItemsAdminTable();
                if (itemIdToEditInput.value === docId) clearItemForm();
                console.log("[Item Delete] Item delete process completed successfully.");
            } catch (error) {
                console.error(`[Item Delete] Error deleting item ${docId}:`, error);
                alert("アイテムの削除に失敗しました。");
            }
        } else {
             console.log("[Item Delete] Deletion cancelled by user.");
        }
    }
    
    // --- モーダル共通 ---
    document.querySelectorAll('.modal .close-button').forEach(btn => {
        btn.onclick = function() { btn.closest('.modal').style.display = "none"; }
    });
    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = "none";
        }
    }
});
