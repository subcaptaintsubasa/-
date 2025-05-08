// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import {
    getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import {
    getFirestore, collection, getDocs, addDoc, doc, updateDoc, deleteDoc,
    query, where, orderBy, serverTimestamp, writeBatch, getDoc, runTransaction
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBxrE-9E46dplHTuEBmmcJWQRU1vLgAGAU", 
  authDomain: "itemsearchtooleditor.firebaseapp.com",
  projectId: "itemsearchtooleditor",
  storageBucket: "itemsearchtooleditor.appspot.com",
  messagingSenderId: "243156973544",
  appId: "1:243156973544:web:ffdc31134a35354b6dd65d",
  measurementId: "G-8EHP9MGJ4M"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const IMAGE_UPLOAD_WORKER_URL = 'https://denpa-item-uploader.tsubasa-hsty-f58.workers.dev';

document.addEventListener('DOMContentLoaded', () => {
    // Common DOM Elements
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
    const newCategoryParentSelect = document.getElementById('newCategoryParentSelect');
    const addCategoryButton = document.getElementById('addCategoryButton');
    const categoryListContainer = document.getElementById('categoryListContainer');
    const editCategoryModal = document.getElementById('editCategoryModal');
    const editingCategoryDocIdInput = document.getElementById('editingCategoryDocId');
    const editingCategoryNameInput = document.getElementById('editingCategoryName');
    const editingCategoryParentSelect = document.getElementById('editingCategoryParentSelect');
    const saveCategoryEditButton = document.getElementById('saveCategoryEditButton');

    // Tag Management DOM
    const newTagNameInput = document.getElementById('newTagName');
    const newTagCategorySelect = document.getElementById('newTagCategorySelect');
    const addTagButton = document.getElementById('addTagButton');
    const tagListContainer = document.getElementById('tagListContainer');
    const editTagModal = document.getElementById('editTagModal');
    const editingTagDocIdInput = document.getElementById('editingTagDocId');
    const editingTagNameInput = document.getElementById('editingTagName');
    const editingTagCategorySelect = document.getElementById('editingTagCategorySelect');
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

    let allCategoriesCache = []; // {id, name, parentId}
    let tagsCache = [];         // {id, name, categoryId (子カテゴリID)}
    let itemsCache = [];
    let selectedImageFile = null;

    // --- Authentication ---
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
        if (newCategoryParentSelect) newCategoryParentSelect.innerHTML = '<option value="">親カテゴリなし (最上位)</option>';
        if (editingCategoryParentSelect) editingCategoryParentSelect.innerHTML = '<option value="">親カテゴリなし (最上位)</option>';
        
        if (tagListContainer) tagListContainer.innerHTML = '';
        if (newTagCategorySelect) newTagCategorySelect.innerHTML = '<option value="">所属カテゴリを選択...</option>';
        if (editingTagCategorySelect) editingTagCategorySelect.innerHTML = '<option value="">カテゴリなし (未分類)</option>';

        if (itemsTableBody) itemsTableBody.innerHTML = '';
        if (itemTagsSelectorContainer) itemTagsSelectorContainer.innerHTML = '';
        clearItemForm();
    }

    async function loadInitialData() {
        console.log("[Initial Load] Starting...");
        await loadCategoriesFromFirestore();
        await loadTagsFromFirestore();
        await loadItemsFromFirestore();
        
        populateParentCategorySelects();
        populateChildCategorySelectsForTag(); // This should list all categories as potential parents for tags
        renderCategoriesForManagement();
        renderTagsForManagement();
        renderItemTagsSelector();
        renderItemsAdminTable();
        console.log("[Initial Load] Completed.");
    }

    // --- Category Management ---
    async function loadCategoriesFromFirestore() {
        console.log("[Categories] Loading all categories...");
        try {
            const q = query(collection(db, 'categories'), orderBy('name'));
            const snapshot = await getDocs(q);
            allCategoriesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("[Categories] All categories loaded:", allCategoriesCache);
        } catch (error) {
            console.error("[Categories] Error loading categories:", error);
            allCategoriesCache = [];
        }
    }

    function populateParentCategorySelects(currentCategoryIdToExclude = null) {
        console.log("[Categories] Populating parent category selects (excluding ID if provided):", currentCategoryIdToExclude);
        const selects = [newCategoryParentSelect, editingCategoryParentSelect];
        selects.forEach(selectEl => {
            if (!selectEl) return;
            const currentValue = selectEl.value; 
            selectEl.innerHTML = '<option value="">親カテゴリなし (最上位)</option>';
            allCategoriesCache.forEach(cat => {
                if (cat.id !== currentCategoryIdToExclude) { 
                    selectEl.add(new Option(cat.name, cat.id));
                }
            });
            // Restore previous selection if valid
            if (currentValue && Array.from(selectEl.options).some(opt => opt.value === currentValue)) {
                 selectEl.value = currentValue;
            }
        });
    }
    
    function populateChildCategorySelectsForTag() {
        console.log("[Categories] Populating category selects for tag assignment...");
        const selects = [newTagCategorySelect, editingTagCategorySelect];
        selects.forEach(selectEl => {
            if (!selectEl) return;
            const currentValue = selectEl.value;
            selectEl.innerHTML = '<option value="">所属カテゴリを選択...</option>'; 
            allCategoriesCache.forEach(cat => { // All categories can be a parent for a tag
                selectEl.add(new Option(cat.name, cat.id));
            });
            if (currentValue && Array.from(selectEl.options).some(opt => opt.value === currentValue)) {
                selectEl.value = currentValue;
            }
        });
    }

    function renderCategoriesForManagement() {
        if (!categoryListContainer) return;
        console.log("[Categories] Rendering categories for management list...");
        categoryListContainer.innerHTML = '';
        allCategoriesCache.forEach(category => {
            const parentCategory = allCategoriesCache.find(p => p.id === category.parentId);
            const parentName = parentCategory ? parentCategory.name : 'なし (最上位)';
            
            const div = document.createElement('div');
            div.classList.add('list-item');
            // Display parent name for clarity
            div.innerHTML = `
                <span>${category.name} (親: ${parentName}, ID: ${category.id})</span>
                <div>
                    <button class="edit-category action-button" data-category-id="${category.id}" title="編集">✎</button>
                    <button class="delete-category action-button delete" data-category-id="${category.id}" data-category-name="${category.name}" title="削除">×</button>
                </div>
            `;
            categoryListContainer.appendChild(div);
        });
        // Re-attach event listeners
        categoryListContainer.querySelectorAll('.edit-category').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const catId = e.currentTarget.dataset.categoryId;
                const catToEdit = allCategoriesCache.find(c => c.id === catId);
                if (catToEdit) openEditCategoryModal(catId, catToEdit.name, catToEdit.parentId || "");
            });
        });
        categoryListContainer.querySelectorAll('.delete-category').forEach(btn => {
            btn.addEventListener('click', (e) => deleteCategory(e.currentTarget.dataset.categoryId, e.currentTarget.dataset.categoryName));
        });
    }
    
    if (addCategoryButton) {
        addCategoryButton.addEventListener('click', async () => {
            const name = newCategoryNameInput.value.trim();
            const parentId = newCategoryParentSelect.value;
            console.log(`[Category Add] Attempting to add category: ${name}, parentId: ${parentId}`);

            if (!name) { alert("カテゴリ名を入力してください。"); return; }
            
            const q = query(collection(db, 'categories'), where('name', '==', name));
            const existingQuery = await getDocs(q);
            if (!existingQuery.empty) { alert("同じ名前のカテゴリが既に存在します。"); return; }
            
            try {
                await addDoc(collection(db, 'categories'), { 
                    name: name,
                    parentId: parentId || "", 
                    createdAt: serverTimestamp()
                });
                console.log("[Category Add] Category added successfully.");
                newCategoryNameInput.value = '';
                newCategoryParentSelect.value = '';
                
                await loadCategoriesFromFirestore(); // Reload categories
                populateParentCategorySelects();    // Repopulate parent selects
                populateChildCategorySelectsForTag(); // Repopulate tag category selects
                renderCategoriesForManagement();    // Rerender list
            } catch (error) {
                console.error("[Category Add] Error:", error);
                alert("カテゴリの追加に失敗しました。");
            }
        });
    }

    function openEditCategoryModal(docId, currentName, currentParentId) {
        console.log(`[Category Edit] Opening modal for ID: ${docId}, Name: ${currentName}, ParentID: ${currentParentId}`);
        editingCategoryDocIdInput.value = docId;
        editingCategoryNameInput.value = currentName;
        populateParentCategorySelects(docId); // Exclude self from parent options
        editingCategoryParentSelect.value = currentParentId || "";
        editCategoryModal.style.display = 'flex';
        editingCategoryNameInput.focus();
    }

    if (saveCategoryEditButton) {
        saveCategoryEditButton.addEventListener('click', async () => {
            const docId = editingCategoryDocIdInput.value;
            const newName = editingCategoryNameInput.value.trim();
            const newParentId = editingCategoryParentSelect.value;
            console.log(`[Category Edit] Saving ID: ${docId}, New Name: ${newName}, New ParentID: ${newParentId}`);

            if (!newName) { alert("カテゴリ名は空にできません。"); return; }
            if (docId === newParentId) { alert("自身を親カテゴリに設定することはできません。"); return; }

            const q = query(collection(db, 'categories'), where('name', '==', newName));
            const existingQuery = await getDocs(q);
            let conflict = false;
            existingQuery.forEach(docSnap => { if (docSnap.id !== docId) conflict = true; });
            if (conflict) { alert("編集後の名前が、他の既存カテゴリと重複します。"); return; }

            // Basic cycle check (A -> B, then trying B -> A)
            // More complex cycle detection (A->B->C->A) is harder and not implemented here.
            if (newParentId) {
                let currentAncestorId = newParentId;
                let visited = new Set(); // To detect longer cycles
                while (currentAncestorId) {
                    if (currentAncestorId === docId) {
                        alert("循環参照です。この親カテゴリ設定はできません。");
                        return;
                    }
                    if (visited.has(currentAncestorId)) break; // Already checked this path
                    visited.add(currentAncestorId);
                    const ancestor = allCategoriesCache.find(c => c.id === currentAncestorId);
                    currentAncestorId = ancestor ? (ancestor.parentId || "") : "";
                }
            }


            try {
                await updateDoc(doc(db, 'categories', docId), { 
                    name: newName,
                    parentId: newParentId || ""
                });
                console.log("[Category Edit] Category updated successfully.");
                editCategoryModal.style.display = 'none';
                
                await loadCategoriesFromFirestore();
                populateParentCategorySelects();
                populateChildCategorySelectsForTag();
                renderCategoriesForManagement();
                // Tags might need re-rendering if their category display name changed due to parent change
                await loadTagsFromFirestore(); 
                renderTagsForManagement(); 
            } catch (error) {
                console.error("[Category Edit] Error:", error);
                alert("カテゴリの更新に失敗しました。");
            }
        });
    }

    async function deleteCategory(docId, categoryName) {
        console.log(`[Category Delete] Attempting to delete ID: ${docId}, Name: ${categoryName}`);
        
        const childCheckQuery = query(collection(db, 'categories'), where('parentId', '==', docId));
        const childSnapshot = await getDocs(childCheckQuery);
        if (!childSnapshot.empty) {
            alert(`カテゴリ「${categoryName}」は他のカテゴリの親として使用されているため削除できません。\nまず子カテゴリの親設定を変更してください。`);
            return;
        }

        if (confirm(`カテゴリ「${categoryName}」を削除しますか？\nこのカテゴリに属するタグは「未分類」になります。`)) {
            try {
                await runTransaction(db, async (transaction) => {
                    transaction.delete(doc(db, 'categories', docId));
                    
                    const tagsToUpdateQuery = query(collection(db, 'tags'), where('categoryId', '==', docId));
                    const tagsSnapshot = await getDocs(tagsToUpdateQuery); 
                    tagsSnapshot.forEach(tagDoc => {
                        transaction.update(doc(db, 'tags', tagDoc.id), { categoryId: "" });
                    });
                });
                console.log("[Category Delete] Category and associated tags updated successfully.");
                await loadInitialData(); // Reload all data and re-render
            } catch (error) {
                console.error("[Category Delete] Error:", error);
                alert("カテゴリの削除または関連タグの更新に失敗しました。");
            }
        }
    }

    // --- Tag Management ---
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
        console.log("[Tags] Rendering tags for management list...");
        tagListContainer.innerHTML = '';
        tagsCache.forEach(tag => {
            const category = allCategoriesCache.find(c => c.id === tag.categoryId);
            const categoryName = category ? category.name : '未分類';
            
            const div = document.createElement('div');
            div.classList.add('list-item');
            div.innerHTML = `
                <span>${tag.name} (所属カテゴリ: ${categoryName}, ID: ${tag.id})</span>
                <div>
                    <button class="edit-tag action-button" data-tag-id="${tag.id}" title="編集">✎</button>
                    <button class="delete-tag action-button delete" data-tag-id="${tag.id}" data-tag-name="${tag.name}" title="削除">×</button>
                </div>
            `;
            tagListContainer.appendChild(div);
        });
        // Re-attach event listeners
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
        renderItemTagsSelector(); // Also update item form tag selector
    }

    if (addTagButton) {
        addTagButton.addEventListener('click', async () => {
            const name = newTagNameInput.value.trim();
            const categoryId = newTagCategorySelect.value;
            console.log(`[Tag Add] Attempting to add tag: ${name}, categoryId: ${categoryId}`);
            
            if (!name) { alert("タグ名を入力してください。"); return; }
            
            const q = query(collection(db, 'tags'), where('name', '==', name));
            const existingQuery = await getDocs(q);
            if (!existingQuery.empty) { alert("同じ名前のタグが既に存在します。"); return; }
            
            try {
                await addDoc(collection(db, 'tags'), { 
                    name: name, 
                    categoryId: categoryId || "",
                    createdAt: serverTimestamp()
                });
                console.log("[Tag Add] Tag added successfully.");
                newTagNameInput.value = '';
                newTagCategorySelect.value = '';
                await loadTagsFromFirestore();
                renderTagsForManagement();
            } catch (error) {
                console.error("[Tag Add] Error:", error);
                alert("タグの追加に失敗しました。");
            }
        });
    }

    function openEditTagModal(docId, currentName, currentCategoryId) {
        console.log(`[Tag Edit] Opening modal for ID: ${docId}, Name: ${currentName}, CategoryID: ${currentCategoryId}`);
        editingTagDocIdInput.value = docId;
        editingTagNameInput.value = currentName;
        // Ensure the select is populated before setting value
        // populateChildCategorySelectsForTag(); // Usually done at init, but can be defensive here
        editingTagCategorySelect.value = currentCategoryId || "";
        editTagModal.style.display = 'flex';
        editingTagNameInput.focus();
    }

    if (saveTagEditButton) {
        saveTagEditButton.addEventListener('click', async () => {
            const docId = editingTagDocIdInput.value;
            const newName = editingTagNameInput.value.trim();
            const newCategoryId = editingTagCategorySelect.value;
            console.log(`[Tag Edit] Saving ID: ${docId}, New Name: ${newName}, New CategoryID: ${newCategoryId}`);

            if (!newName) { alert("タグ名は空にできません。"); return; }

            const q = query(collection(db, 'tags'), where('name', '==', newName));
            const existingQuery = await getDocs(q);
            let conflict = false;
            existingQuery.forEach(docSnap => { if (docSnap.id !== docId) conflict = true; });
            if (conflict) { alert("編集後の名前が、他の既存タグと重複します。"); return; }

            try {
                await updateDoc(doc(db, 'tags', docId), { 
                    name: newName, 
                    categoryId: newCategoryId || ""
                });
                console.log("[Tag Edit] Tag updated successfully.");
                editTagModal.style.display = 'none';
                await loadTagsFromFirestore();
                renderTagsForManagement();
            } catch (error) {
                console.error("[Tag Edit] Error:", error);
                alert("タグの更新に失敗しました。");
            }
        });
    }

    async function deleteTag(docId, tagName) {
        console.log(`[Tag Delete] Attempting to delete ID: ${docId}, Name: ${tagName}`);
        if (confirm(`タグ「${tagName}」を削除しますか？\nこのタグを使用している全てのアイテムからも自動的に削除されます。`)) {
            try {
                await deleteDoc(doc(db, 'tags', docId));
                console.log(`[Tag Delete] Tag ${docId} deleted from Firestore.`);
                
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
                    console.log(`[Tag Delete] Updated ${itemsToUpdateSnapshot.size} items.`);
                }
                
                await loadTagsFromFirestore(); // Reload and re-render tags
                renderTagsForManagement();
                // Optionally, reload items if tag deletion affects item display directly in admin table beyond tag names
                // await loadItemsFromFirestore(); renderItemsAdminTable();
            } catch (error) {
                console.error("[Tag Delete] Error:", error);
                alert("タグの削除または関連アイテムの更新に失敗しました。");
            }
        }
    }
    
    function renderItemTagsSelector(selectedItemTagIds = []) {
        if (!itemTagsSelectorContainer) return;
        itemTagsSelectorContainer.innerHTML = '';
        tagsCache.forEach(tag => { // Use full tagsCache
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

    // --- Image Upload ---
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

    // --- Item Management ---
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
                    if (imageUrl === null && selectedImageFile) { // Check if upload failed but a file was selected
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
        renderItemTagsSelector(); // Clear selected tags in the form
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
            (!searchTerm && (item.name === "" || !item.name)) // Include items with empty/undefined name if no search term
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
                if (itemIdToEditInput.value === docId) clearItemForm(); // Clear form if deleted item was being edited
                console.log("[Item Delete] Item delete process completed successfully.");
            } catch (error) {
                console.error(`[Item Delete] Error deleting item ${docId}:`, error);
                alert("アイテムの削除に失敗しました。");
            }
        } else {
             console.log("[Item Delete] Deletion cancelled by user.");
        }
    }
    
    // --- Modal common handlers ---
    document.querySelectorAll('.modal .close-button').forEach(btn => {
        btn.onclick = function() { btn.closest('.modal').style.display = "none"; }
    });
    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = "none";
        }
    }
});
