import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import {
    getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import {
    getFirestore, collection, getDocs, addDoc, doc, updateDoc, deleteDoc,
    query, where, orderBy, serverTimestamp, writeBatch, getDoc, runTransaction,
    arrayUnion, arrayRemove // 配列操作に使用
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
    // const newCategoryParentSelect = document.getElementById('newCategoryParentSelect'); // 廃止
    const newCategoryParentButtons = document.getElementById('newCategoryParentButtons'); // ★追加
    const selectedNewParentCategoryIdInput = document.getElementById('selectedNewParentCategoryId'); // ★追加
    const addCategoryButton = document.getElementById('addCategoryButton');
    const categoryListContainer = document.getElementById('categoryListContainer');
    const editCategoryModal = document.getElementById('editCategoryModal');
    const editingCategoryDocIdInput = document.getElementById('editingCategoryDocId');
    const editingCategoryNameInput = document.getElementById('editingCategoryName');
    // const editingCategoryParentSelect = document.getElementById('editingCategoryParentSelect'); // 廃止
    const editingCategoryParentButtons = document.getElementById('editingCategoryParentButtons'); // ★追加
    const selectedEditingParentCategoryIdInput = document.getElementById('selectedEditingParentCategoryId'); // ★追加
    const editingCategoryTagsSelector = document.getElementById('editingCategoryTagsSelector'); // ★追加
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
        if (newCategoryParentButtons) newCategoryParentButtons.innerHTML = ''; // ボタンコンテナをクリア
        if (selectedNewParentCategoryIdInput) selectedNewParentCategoryIdInput.value = ''; // hidden inputもクリア
        if (editingCategoryParentButtons) editingCategoryParentButtons.innerHTML = '';
        if (selectedEditingParentCategoryIdInput) selectedEditingParentCategoryIdInput.value = '';
        if (editingCategoryTagsSelector) editingCategoryTagsSelector.innerHTML = ''; // カテゴリ編集モーダルのタグ選択もクリア
        
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
        
        // ★変更: SelectではなくButtonを生成
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

    // ★新規: 親カテゴリ選択ボタン生成関数
    function populateParentCategoryButtons(buttonContainer, hiddenInput, options = {}) {
        const { currentCategoryIdToExclude = null, selectedParentId = "" } = options;
        
        if (!buttonContainer || !hiddenInput) return;
        buttonContainer.innerHTML = ''; // Clear existing buttons

        // 1. 「最上位」ボタン
        const topLevelButton = document.createElement('div');
        topLevelButton.classList.add('category-select-button'); // 新しいクラス名 or category-filter-button を流用
        topLevelButton.textContent = '最上位カテゴリとして追加';
        topLevelButton.dataset.parentId = ""; // value は空文字列
        if (selectedParentId === "") {
            topLevelButton.classList.add('active');
        }
        topLevelButton.addEventListener('click', () => {
            selectParentCategoryButton(buttonContainer, hiddenInput, topLevelButton, "");
        });
        buttonContainer.appendChild(topLevelButton);

        // 2. 既存の親カテゴリボタン
        allCategoriesCache
            .filter(cat => (!cat.parentId || cat.parentId === "") && cat.id !== currentCategoryIdToExclude) // 親カテゴリのみ & 自分自身を除く
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
        
        // 初期選択をhidden inputに反映
        hiddenInput.value = selectedParentId;
    }

    // ★新規: 親カテゴリボタン選択時の処理
    function selectParentCategoryButton(container, hiddenInput, clickedButton, parentId) {
        // 他のボタンのアクティブ状態を解除
        container.querySelectorAll('.category-select-button.active').forEach(activeBtn => {
            activeBtn.classList.remove('active');
        });
        // クリックされたボタンをアクティブに
        clickedButton.classList.add('active');
        // hidden input に選択された parentId を設定
        hiddenInput.value = parentId;
        console.log("[Category Parent Select] Selected Parent ID:", parentId);
    }
    
    // カテゴリ管理リスト表示 (★表示文字列を変更)
    function renderCategoriesForManagement() {
        if (!categoryListContainer) return;
        console.log("[Categories] Rendering categories for management list...");
        categoryListContainer.innerHTML = '';
        allCategoriesCache.forEach(category => {
            let displayInfo;
            if (!category.parentId || category.parentId === "") {
                displayInfo = "(親)"; // 親カテゴリの場合
            } else {
                const parentCategory = allCategoriesCache.find(p => p.id === category.parentId);
                const parentName = parentCategory ? parentCategory.name : '不明な親';
                displayInfo = `(子, 親: ${parentName})`; // 子カテゴリの場合
            }
            
            const div = document.createElement('div');
            div.classList.add('list-item');
            // ★変更: ID表示を削除し、階層情報を表示
            div.innerHTML = `
                <span>${category.name} ${displayInfo}</span> 
                <div>
                    <button class="edit-category action-button" data-category-id="${category.id}" title="編集">✎</button>
                    <button class="delete-category action-button delete" data-category-id="${category.id}" data-category-name="${category.name}" title="削除">×</button>
                </div>
            `;
            categoryListContainer.appendChild(div);
        });
        // イベントリスナー (変更なし)
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
    
    // カテゴリ追加 (★親IDの取得方法を変更)
    if (addCategoryButton) {
        addCategoryButton.addEventListener('click', async () => {
            const name = newCategoryNameInput.value.trim();
            // ★変更: hidden input から親IDを取得
            const parentId = selectedNewParentCategoryIdInput.value; 
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
                // ★変更: ボタン選択状態をリセット
                populateParentCategoryButtons(newCategoryParentButtons, selectedNewParentCategoryIdInput); 
                
                await loadCategoriesFromFirestore();
                populateCategoryCheckboxesForTagAssignment(newTagCategoriesCheckboxes); 
                if (editTagModal.style.display === 'flex' && editingTagDocIdInput.value) {
                    const tagToRePopulate = allTagsCache.find(t => t.id === editingTagDocIdInput.value);
                    populateCategoryCheckboxesForTagAssignment(editingTagCategoriesCheckboxes, tagToRePopulate ? (tagToRePopulate.categoryIds || []) : []);
                }
                renderCategoriesForManagement();
            } catch (error) {
                console.error("[Category Add] Error:", error);
                alert("カテゴリの追加に失敗しました。");
            }
        });
    }

    // カテゴリ編集モーダル表示 (★タグ選択ボタン生成を追加)
    function openEditCategoryModal(docId, currentName, currentParentId) {
        console.log(`[Category Edit] Opening modal for ID: ${docId}, Name: ${currentName}, ParentID: ${currentParentId}`);
        editingCategoryDocIdInput.value = docId;
        editingCategoryNameInput.value = currentName;
        // ★変更: ボタン形式で親を選択
        populateParentCategoryButtons(editingCategoryParentButtons, selectedEditingParentCategoryIdInput, { currentCategoryIdToExclude: docId, selectedParentId: currentParentId });
        
        // ★追加: 所属タグ選択ボタンを表示
        populateTagsForCategoryEdit(editingCategoryTagsSelector, docId);

        editCategoryModal.style.display = 'flex';
        editingCategoryNameInput.focus();
    }

    // ★新規: カテゴリ編集モーダル用のタグ選択ボタン生成
    function populateTagsForCategoryEdit(containerElement, categoryId) {
        if (!containerElement) return;
        containerElement.innerHTML = '';
        if (allTagsCache.length === 0) {
            containerElement.innerHTML = '<p>タグがありません。</p>';
            return;
        }
        allTagsCache.forEach(tag => {
            const button = document.createElement('div');
            // ユーザー画面のタグフィルターと同じスタイルを使う
            button.classList.add('tag-filter', 'admin-tag-select'); // 管理用クラス追加
            button.textContent = tag.name;
            button.dataset.tagId = tag.id;
            // このカテゴリが既にタグのcategoryIdsに含まれていれば active
            if (tag.categoryIds && tag.categoryIds.includes(categoryId)) {
                button.classList.add('active');
            }
            button.addEventListener('click', () => {
                button.classList.toggle('active'); // クリックで状態をトグル
            });
            containerElement.appendChild(button);
        });
    }


    // カテゴリ編集保存 (★親ID取得方法変更 + タグ更新処理追加)
    if (saveCategoryEditButton) {
        saveCategoryEditButton.addEventListener('click', async () => {
            const docId = editingCategoryDocIdInput.value; // 編集対象のカテゴリID
            const newName = editingCategoryNameInput.value.trim();
            // ★変更: hidden input から親IDを取得
            const newParentId = selectedEditingParentCategoryIdInput.value; 
            
            // ★追加: 選択されたタグIDを取得
            const selectedTagIds = Array.from(editingCategoryTagsSelector.querySelectorAll('.tag-filter.active'))
                                         .map(btn => btn.dataset.tagId);
            
            console.log(`[Category Edit] Saving ID: ${docId}, New Name: ${newName}, New ParentID: ${newParentId}, Selected Tag IDs:`, selectedTagIds);

            if (!newName) { alert("カテゴリ名は空にできません。"); return; }
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

                // 1. カテゴリ自体の名前と親IDを更新
                batch.update(doc(db, 'categories', docId), { 
                    name: newName,
                    parentId: newParentId || ""
                });

                // 2. タグの categoryIds を更新
                // 編集前の状態と比較して、追加/削除されたタグを特定
                const tagsBefore = allTagsCache.filter(tag => tag.categoryIds && tag.categoryIds.includes(docId)).map(t => t.id);
                const tagsToAdd = selectedTagIds.filter(id => !tagsBefore.includes(id));
                const tagsToRemove = tagsBefore.filter(id => !selectedTagIds.includes(id));

                tagsToAdd.forEach(tagId => {
                    batch.update(doc(db, 'tags', tagId), {
                        categoryIds: arrayUnion(docId) // 配列にカテゴリIDを追加
                    });
                    console.log(`[Category Edit] Adding category ${docId} to tag ${tagId}`);
                });
                tagsToRemove.forEach(tagId => {
                     batch.update(doc(db, 'tags', tagId), {
                        categoryIds: arrayRemove(docId) // 配列からカテゴリIDを削除
                    });
                    console.log(`[Category Edit] Removing category ${docId} from tag ${tagId}`);
                });

                // 3. バッチ処理を実行
                await batch.commit();
                console.log("[Category Edit] Category and associated tags updated successfully.");

                editCategoryModal.style.display = 'none';
                
                // UI更新 (データ再読み込みが必要)
                await loadInitialData(); // 全データ再読み込みが確実

            } catch (error) {
                console.error("[Category Edit] Error:", error);
                alert("カテゴリの更新または関連タグの更新に失敗しました。");
            }
        });
    }

    // カテゴリ削除 (修正なし)
    async function deleteCategory(docId, categoryName) {
        console.log(`[Category Delete] Attempting ID: ${docId}, Name: ${categoryName}`);
        const childCheckQuery = query(collection(db, 'categories'), where('parentId', '==', docId));
        const childSnapshot = await getDocs(childCheckQuery);
        if (!childSnapshot.empty) {
            alert(`カテゴリ「${categoryName}」は他のカテゴリの親として使用されているため削除できません。\nまず子カテゴリの親設定を変更してください。`);
            return;
        }

        if (confirm(`カテゴリ「${categoryName}」を削除しますか？\nこのカテゴリを参照しているタグの関連付けも解除されます（自動）。`)) {
            try {
                const batch = writeBatch(db);
                const tagsToUpdateQuery = query(collection(db, 'tags'), where('categoryIds', 'array-contains', docId));
                const tagsSnapshot = await getDocs(tagsToUpdateQuery);
                tagsSnapshot.forEach(tagDoc => {
                    const currentCategoryIds = tagDoc.data().categoryIds || [];
                    const updatedCategoryIds = currentCategoryIds.filter(id => id !== docId);
                    batch.update(tagDoc.ref, { categoryIds: updatedCategoryIds });
                });
                
                batch.delete(doc(db, 'categories', docId)); 
                
                await batch.commit();
                console.log(`[Category Delete] Category ${docId} deleted and updated ${tagsSnapshot.size} tags.`);

                await loadInitialData();
            } catch (error) {
                console.error("[Category Delete] Error:", error);
                alert("カテゴリの削除または関連タグの更新に失敗しました。");
            }
        }
    }


    // --- Tag Management ---
    async function loadTagsFromFirestore() { /* 修正なし */ }
    function populateCategoryCheckboxesForTagAssignment(containerElement, selectedCategoryIds = []) { /* 修正なし */ }
    function renderTagsForManagement() { /* 修正なし */ }
    if (addTagButton) { /* 修正なし (チェックボックスからの値取得は前回の修正で対応済み) */ }
    function openEditTagModal(docId, currentName, currentCategoryIds) { /* 修正なし */ }
    if (saveTagEditButton) { /* 修正なし (チェックボックスからの値取得は前回の修正で対応済み) */ }
    async function deleteTag(docId, tagName) { /* 修正なし */ }
    
    // --- Item Management ---
    function populateTagCheckboxesForItemForm(selectedTagIds = []) { /* 修正なし */ }
    async function loadItemsFromFirestore() { /* 修正なし */ }
    if (itemForm) { /* 修正なし (チェックボックスからのタグID取得は前回の修正で対応済み) */ }
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
