import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import {
    getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import {
    getFirestore, collection, getDocs, addDoc, doc, updateDoc, deleteDoc,
    query, where, orderBy, serverTimestamp, writeBatch, getDoc, runTransaction,
    arrayUnion, arrayRemove, deleteField // deleteField をインポート
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

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
    // --- DOM Elements ---
    const passwordPrompt = document.getElementById('password-prompt');
    const adminContent = document.getElementById('admin-content');
    const loginButton = document.getElementById('loginButton'); 
    const adminEmailInput = document.getElementById('adminEmailInput');
    const adminPasswordInput = document.getElementById('adminPasswordInput');
    const passwordError = document.getElementById('passwordError');
    const logoutButton = document.getElementById('logoutButton');
    const currentUserEmailSpan = document.getElementById('currentUserEmail');

    // Category Management
    const newCategoryNameInput = document.getElementById('newCategoryName');
    const newCategoryParentButtons = document.getElementById('newCategoryParentButtons'); 
    const selectedNewParentCategoryIdInput = document.getElementById('selectedNewParentCategoryId'); 
    const addCategoryButton = document.getElementById('addCategoryButton');
    const categoryListContainer = document.getElementById('categoryListContainer');
    const editCategoryModal = document.getElementById('editCategoryModal');
    const editingCategoryDocIdInput = document.getElementById('editingCategoryDocId');
    const editingCategoryNameInput = document.getElementById('editingCategoryName');
    const editingCategoryParentButtons = document.getElementById('editingCategoryParentButtons'); 
    const selectedEditingParentCategoryIdInput = document.getElementById('selectedEditingParentCategoryId'); 
    const editingCategoryTagsSelector = document.getElementById('editingCategoryTagsSelector'); 
    const tagSearchModeGroup = document.getElementById('tagSearchModeGroup'); 
    const editingTagSearchModeSelect = document.getElementById('editingTagSearchMode'); 
    const saveCategoryEditButton = document.getElementById('saveCategoryEditButton');

    // Tag Management
    const newTagNameInput = document.getElementById('newTagName');
    const newTagCategoriesCheckboxes = document.getElementById('newTagCategoriesCheckboxes'); 
    const addTagButton = document.getElementById('addTagButton');
    const tagListContainer = document.getElementById('tagListContainer');
    const editTagModal = document.getElementById('editTagModal');
    const editingTagDocIdInput = document.getElementById('editingTagDocId');
    const editingTagNameInput = document.getElementById('editingTagName');
    const editingTagCategoriesCheckboxes = document.getElementById('editingTagCategoriesCheckboxes'); 
    const saveTagEditButton = document.getElementById('saveTagEditButton');

    // Item Management
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
    const itemTagsSelectorCheckboxes = document.getElementById('itemTagsSelectorCheckboxes'); 
    const saveItemButton = document.getElementById('saveItemButton');
    const clearFormButton = document.getElementById('clearFormButton');
    const itemsTableBody = document.querySelector('#itemsTable tbody');
    const itemSearchAdminInput = document.getElementById('itemSearchAdmin');

    let allCategoriesCache = []; 
    let allTagsCache = [];      
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
        if (newCategoryParentButtons) newCategoryParentButtons.innerHTML = ''; 
        if (selectedNewParentCategoryIdInput) selectedNewParentCategoryIdInput.value = ''; 
        if (editingCategoryParentButtons) editingCategoryParentButtons.innerHTML = '';
        if (selectedEditingParentCategoryIdInput) selectedEditingParentCategoryIdInput.value = '';
        if (editingCategoryTagsSelector) editingCategoryTagsSelector.innerHTML = ''; 
        if (tagSearchModeGroup) tagSearchModeGroup.style.display = 'none'; 
        if (editingTagSearchModeSelect) editingTagSearchModeSelect.value = 'AND'; 
        
        if (tagListContainer) tagListContainer.innerHTML = '';
        if (newTagCategoriesCheckboxes) newTagCategoriesCheckboxes.innerHTML = ''; 
        if (editingTagCategoriesCheckboxes) editingTagCategoriesCheckboxes.innerHTML = '';

        if (itemsTableBody) itemsTableBody.innerHTML = '';
        if (itemTagsSelectorCheckboxes) itemTagsSelectorCheckboxes.innerHTML = ''; 
        clearItemForm();
    }

    async function loadInitialData() {
        console.log("[Initial Load] Starting...");
        await loadCategoriesFromFirestore();
        await loadTagsFromFirestore();
        await loadItemsFromFirestore();
        
        populateParentCategoryButtons(newCategoryParentButtons, selectedNewParentCategoryIdInput); 
        populateCategoryCheckboxesForTagAssignment(newTagCategoriesCheckboxes);
        populateTagCheckboxesForItemForm();

        renderCategoriesForManagement();
        renderTagsForManagement();
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

    function populateParentCategoryButtons(buttonContainer, hiddenInput, options = {}) {
        const { currentCategoryIdToExclude = null, selectedParentId = "" } = options;
        
        if (!buttonContainer || !hiddenInput) return;
        buttonContainer.innerHTML = ''; 

        const topLevelButton = document.createElement('div');
        topLevelButton.classList.add('category-select-button'); 
        topLevelButton.textContent = '最上位カテゴリとして追加';
        topLevelButton.dataset.parentId = ""; 
        if (selectedParentId === "") {
            topLevelButton.classList.add('active');
        }
        topLevelButton.addEventListener('click', () => {
            selectParentCategoryButton(buttonContainer, hiddenInput, topLevelButton, "");
        });
        buttonContainer.appendChild(topLevelButton);

        allCategoriesCache
            .filter(cat => (!cat.parentId || cat.parentId === "") && cat.id !== currentCategoryIdToExclude) 
            .forEach(cat => {
                const button = document.createElement('div');
                button.classList.add('category-select-button');
                button.textContent = cat.name;
                button.dataset.parentId = cat.id;
                if (selectedParentId === cat.id) {
                    button.classList.add('active');
                }
                button.addEventListener('click', () => {
                     selectParentCategoryButton(buttonContainer, hiddenInput, button, cat.id);
                });
                buttonContainer.appendChild(button);
            });
        
        hiddenInput.value = selectedParentId;
    }

    function selectParentCategoryButton(container, hiddenInput, clickedButton, parentId) {
        container.querySelectorAll('.category-select-button.active').forEach(activeBtn => {
            activeBtn.classList.remove('active');
        });
        clickedButton.classList.add('active');
        hiddenInput.value = parentId;
        console.log("[Category Parent Select] Selected Parent ID:", parentId);

        // カテゴリ編集モーダルでのみ、親カテゴリ選択時に検索モード表示/非表示を切り替え
        if (container === editingCategoryParentButtons) {
            if (parentId === "") { 
                if (tagSearchModeGroup) tagSearchModeGroup.style.display = 'none';
                 if(editingCategoryTagsSelector) editingCategoryTagsSelector.closest('.form-group').style.display = 'none'; // ★タグ選択も隠す
            } else { 
                 if (tagSearchModeGroup) tagSearchModeGroup.style.display = 'block';
                 if(editingCategoryTagsSelector) editingCategoryTagsSelector.closest('.form-group').style.display = 'block'; // ★タグ選択を表示
                 // 新しく子カテゴリにする場合、デフォルトは'AND'にする
                 if (editingTagSearchModeSelect) editingTagSearchModeSelect.value = 'AND';
            }
        }
    }
    
    // ★カテゴリ一覧に検索モード表示を追加
    function renderCategoriesForManagement() {
        if (!categoryListContainer) return;
        console.log("[Categories] Rendering categories for management list...");
        categoryListContainer.innerHTML = '';
        allCategoriesCache.forEach(category => {
            let displayInfo;
            let searchModeInfo = '';
            if (!category.parentId || category.parentId === "") {
                displayInfo = "(親)"; 
            } else {
                const parentCategory = allCategoriesCache.find(p => p.id === category.parentId);
                const parentName = parentCategory ? parentCategory.name : '不明'; 
                displayInfo = `(子, 親: ${parentName})`; 
                // ★子カテゴリの場合、検索モードを表示
                searchModeInfo = category.tagSearchMode === 'OR' ? ' (OR検索)' : ' (AND検索)';
            }
            
            const div = document.createElement('div');
            div.classList.add('list-item');
            // ★検索モードも表示
            div.innerHTML = `
                <span>${category.name} ${displayInfo}${searchModeInfo}</span> 
                <div>
                    <button class="edit-category action-button" data-category-id="${category.id}" title="編集">✎</button>
                    <button class="delete-category action-button delete" data-category-id="${category.id}" data-category-name="${category.name}" title="削除">×</button>
                </div>
            `;
            categoryListContainer.appendChild(div);
        });
        categoryListContainer.querySelectorAll('.edit-category').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const catId = e.currentTarget.dataset.categoryId;
                const catToEdit = allCategoriesCache.find(c => c.id === catId);
                if (catToEdit) openEditCategoryModal(catToEdit); 
            });
        });
        categoryListContainer.querySelectorAll('.delete-category').forEach(btn => {
            btn.addEventListener('click', (e) => deleteCategory(e.currentTarget.dataset.categoryId, e.currentTarget.dataset.categoryName));
        });
    }
    
    if (addCategoryButton) {
        addCategoryButton.addEventListener('click', async () => {
            const name = newCategoryNameInput.value.trim();
            const parentId = selectedNewParentCategoryIdInput.value; 
            console.log(`[Category Add] Attempting to add category: ${name}, parentId: ${parentId}`);

            if (!name) { alert("カテゴリ名を入力してください。"); return; }
            
            const q = query(collection(db, 'categories'), where('name', '==', name));
            const existingQuery = await getDocs(q);
            if (!existingQuery.empty) { alert("同じ名前のカテゴリが既に存在します。"); return; }
            
            try {
                const categoryData = { 
                    name: name,
                    parentId: parentId || "", 
                    createdAt: serverTimestamp()
                };
                if (parentId) { 
                    categoryData.tagSearchMode = 'AND'; 
                }

                await addDoc(collection(db, 'categories'), categoryData);
                console.log("[Category Add] Category added successfully.");
                newCategoryNameInput.value = '';
                
                // ★データを再取得してUIを再描画
                await loadCategoriesFromFirestore(); 
                populateParentCategoryButtons(newCategoryParentButtons, selectedNewParentCategoryIdInput); // ボタンも更新
                populateCategoryCheckboxesForTagAssignment(newTagCategoriesCheckboxes); 
                renderCategoriesForManagement(); 
                
                // ★編集モーダルが開いている場合も親カテゴリボタンを更新
                if (editCategoryModal.style.display === 'flex' && editingCategoryDocIdInput.value) {
                     const currentlyEditingCatId = editingCategoryDocIdInput.value;
                     const currentlyEditingCat = allCategoriesCache.find(c => c.id === currentlyEditingCatId);
                     if(currentlyEditingCat) {
                        populateParentCategoryButtons(editingCategoryParentButtons, selectedEditingParentCategoryIdInput, { currentCategoryIdToExclude: currentlyEditingCatId, selectedParentId: currentlyEditingCat.parentId || "" });
                     }
                }
                 if (editTagModal.style.display === 'flex' && editingTagDocIdInput.value) {
                    const tagToRePopulate = allTagsCache.find(t => t.id === editingTagDocIdInput.value);
                    populateCategoryCheckboxesForTagAssignment(editingTagCategoriesCheckboxes, tagToRePopulate ? (tagToRePopulate.categoryIds || []) : []);
                }


            } catch (error) {
                console.error("[Category Add] Error:", error);
                alert("カテゴリの追加に失敗しました。");
            }
        });
    }

    // ★編集対象が親カテゴリの場合、タグ選択と検索モードを隠す
    function openEditCategoryModal(category) { 
        const docId = category.id;
        const currentName = category.name;
        const currentParentId = category.parentId || "";
        const currentTagSearchMode = category.tagSearchMode || 'AND'; 

        console.log(`[Category Edit] Opening modal for ID: ${docId}, Name: ${currentName}, ParentID: ${currentParentId}, Mode: ${currentTagSearchMode}`);
        editingCategoryDocIdInput.value = docId;
        editingCategoryNameInput.value = currentName;
        
        populateParentCategoryButtons(editingCategoryParentButtons, selectedEditingParentCategoryIdInput, { currentCategoryIdToExclude: docId, selectedParentId: currentParentId });
        
        if (currentParentId) { // 子カテゴリの場合
            populateTagsForCategoryEdit(editingCategoryTagsSelector, docId);
            if(editingCategoryTagsSelector) editingCategoryTagsSelector.closest('.form-group').style.display = 'block'; // 表示
            if(tagSearchModeGroup) tagSearchModeGroup.style.display = 'block';
            if(editingTagSearchModeSelect) editingTagSearchModeSelect.value = currentTagSearchMode;
        } else { // 親カテゴリの場合
            if(editingCategoryTagsSelector) editingCategoryTagsSelector.innerHTML = '<p>親カテゴリには直接タグを紐付けません。</p>';
            if(editingCategoryTagsSelector) editingCategoryTagsSelector.closest('.form-group').style.display = 'none'; // 非表示
            if(tagSearchModeGroup) tagSearchModeGroup.style.display = 'none';
        }

        editCategoryModal.style.display = 'flex';
        editingCategoryNameInput.focus();
    }

    // ★この関数自体は変更なしだが、呼び出し元(openEditCategoryModal)で親カテゴリの場合は実行されないようにした
    function populateTagsForCategoryEdit(containerElement, categoryId) {
        if (!containerElement) return;
        containerElement.innerHTML = '';
        if (allTagsCache.length === 0) {
            containerElement.innerHTML = '<p>タグがありません。</p>';
            return;
        }
        // 子カテゴリの場合のみ実行される前提
        allTagsCache.forEach(tag => {
            const button = document.createElement('div');
            button.classList.add('tag-filter', 'admin-tag-select'); 
            button.textContent = tag.name;
            button.dataset.tagId = tag.id;
            if (tag.categoryIds && tag.categoryIds.includes(categoryId)) {
                button.classList.add('active');
            }
            button.addEventListener('click', () => {
                button.classList.toggle('active'); 
            });
            containerElement.appendChild(button);
        });
    }

    // ★カテゴリ保存時に tagSearchMode と、親カテゴリになる場合のタグ解除処理を追加
    if (saveCategoryEditButton) {
        saveCategoryEditButton.addEventListener('click', async () => {
            const docId = editingCategoryDocIdInput.value; 
            const newName = editingCategoryNameInput.value.trim();
            const newParentId = selectedEditingParentCategoryIdInput.value; 
            const newTagSearchMode = editingTagSearchModeSelect.value; 
            const selectedTagIds = Array.from(editingCategoryTagsSelector.querySelectorAll('.tag-filter.active'))
                                         .map(btn => btn.dataset.tagId);
            
            console.log(`[Category Edit] Saving ID: ${docId}, New Name: ${newName}, New ParentID: ${newParentId}, Mode: ${newTagSearchMode}, Selected Tag IDs:`, selectedTagIds);

            if (!newName) { alert("カテゴリ名を入力してください。"); return; }
            if (docId === newParentId) { alert("自身を親カテゴリに設定することはできません。"); return; }

            const q = query(collection(db, 'categories'), where('name', '==', newName));
            const existingQuery = await getDocs(q);
            let conflict = false;
            existingQuery.forEach(docSnap => { if (docSnap.id !== docId) conflict = true; });
            if (conflict) { alert("編集後の名前が、他の既存カテゴリと重複します。"); return; }

            if (newParentId) {
                let currentAncestorId = newParentId;
                let visited = new Set([docId]); 
                while (currentAncestorId) {
                    if (visited.has(currentAncestorId)) { 
                        alert("循環参照です。この親カテゴリ設定はできません。");
                        return;
                    }
                    visited.add(currentAncestorId);
                    const ancestor = allCategoriesCache.find(c => c.id === currentAncestorId);
                    currentAncestorId = ancestor ? (ancestor.parentId || "") : "";
                }
            }

            try {
                const batch = writeBatch(db);
                const categoryUpdateData = { 
                    name: newName,
                    parentId: newParentId || ""
                };
                
                const tagsBefore = allTagsCache.filter(tag => tag.categoryIds && tag.categoryIds.includes(docId)).map(t => t.id);

                if (newParentId) { // 子カテゴリになる、または子カテゴリのままの場合
                     categoryUpdateData.tagSearchMode = newTagSearchMode; // 検索モードを設定

                     // タグの関連付け更新
                     const tagsToAdd = selectedTagIds.filter(id => !tagsBefore.includes(id));
                     const tagsToRemove = tagsBefore.filter(id => !selectedTagIds.includes(id));

                     tagsToAdd.forEach(tagId => {
                         batch.update(doc(db, 'tags', tagId), { categoryIds: arrayUnion(docId) });
                     });
                     tagsToRemove.forEach(tagId => {
                          batch.update(doc(db, 'tags', tagId), { categoryIds: arrayRemove(docId) });
                     });
                } else { // 親カテゴリになる場合
                    // tagSearchMode フィールドを削除
                    categoryUpdateData.tagSearchMode = deleteField(); 
                    // 以前このカテゴリに紐づいていたタグから、このカテゴリIDを削除
                     tagsBefore.forEach(tagId => {
                          batch.update(doc(db, 'tags', tagId), { categoryIds: arrayRemove(docId) });
                          console.log(`[Category Edit] Removing category ${docId} from tag ${tagId} as it becomes a parent.`);
                     });
                }
                
                batch.update(doc(db, 'categories', docId), categoryUpdateData);

                await batch.commit();
                console.log("[Category Edit] Category and associated tags updated successfully.");

                editCategoryModal.style.display = 'none';
                await loadInitialData(); 

            } catch (error) {
                console.error("[Category Edit] Error:", error);
                alert("カテゴリの更新または関連タグの更新に失敗しました。");
            }
        });
    }

    async function deleteCategory(docId, categoryName) { /* 修正なし */ }


    // --- Tag Management ---
    async function loadTagsFromFirestore() { /* 修正なし */ }
    
    // ★タグの所属先カテゴリチェックボックス生成時に親カテゴリを除外
    function populateCategoryCheckboxesForTagAssignment(containerElement, selectedCategoryIds = []) {
        if (!containerElement) return;
        containerElement.innerHTML = ''; 
        
        // ★親カテゴリを除外
        const assignableCategories = allCategoriesCache.filter(cat => cat.parentId && cat.parentId !== "");

        if (assignableCategories.length === 0) {
            containerElement.innerHTML = '<p>登録されている子カテゴリがありません。</p>';
            return;
        }

        assignableCategories.forEach(category => {
            const checkboxId = `tag-cat-${category.id}-${containerElement.id.replace(/\W/g, '')}`;
            const checkboxWrapper = document.createElement('div');
            checkboxWrapper.classList.add('checkbox-item');
            let labelText = category.name;
            // 親カテゴリ名も表示
            const parentCat = allCategoriesCache.find(p => p.id === category.parentId);
            if (parentCat) {
                labelText += ` (親: ${parentCat.name})`;
            } else {
                labelText += ` (親: 不明)`;
            }
            checkboxWrapper.innerHTML = `
                <input type="checkbox" id="${checkboxId}" name="tagCategory" value="${category.id}" ${selectedCategoryIds.includes(category.id) ? 'checked' : ''}>
                <label for="${checkboxId}">${labelText}</label>
            `;
            containerElement.appendChild(checkboxWrapper);
        });
    }

    function renderTagsForManagement() { /* 修正なし */ }
    if (addTagButton) { /* 修正なし */ }
    function openEditTagModal(docId, currentName, currentCategoryIds) { /* 修正なし */ }
    if (saveTagEditButton) { /* 修正なし */ }
    async function deleteTag(docId, tagName) { /* 修正なし */ }
    
    // --- Item Management ---
    function populateTagCheckboxesForItemForm(selectedTagIds = []) { /* 修正なし */ }
    async function loadItemsFromFirestore() { /* 修正なし */ }
    if (itemForm) { /* 修正なし */ }
    if (clearFormButton) { /* 修正なし */ }
    function clearItemForm() { /* 修正なし */ }
    function renderItemsAdminTable() { /* 修正なし */ }
    if (itemSearchAdminInput) { /* 修正なし */ }
    async function loadItemForEdit(docId) { /* 修正なし */ }
    async function deleteItem(docId, itemName, imageUrl) { /* 修正なし */ }
    
    // --- Image Upload ---
    if (itemImageFileInput) { /* 修正なし */ }
    async function uploadImageToWorkerAndGetURL(file) { /* 修正なし */ }
    
    // --- Modal common handlers --- 
    document.querySelectorAll('.modal .close-button').forEach(btn => {
        btn.onclick = function() { btn.closest('.modal').style.display = "none"; }
    });
    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) event.target.style.display = "none";
    }
});
