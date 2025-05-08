import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import {
    getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import {
    getFirestore, collection, getDocs, addDoc, doc, updateDoc, deleteDoc,
    query, where, orderBy, serverTimestamp, writeBatch, getDoc, runTransaction,
    arrayUnion, arrayRemove 
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
        
        // hidden input の値も初期化時に確実に設定
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
            } else { 
                 if (tagSearchModeGroup) tagSearchModeGroup.style.display = 'block';
                 // 新しく子カテゴリにする場合、デフォルトは'AND'にする
                 if (editingTagSearchModeSelect) editingTagSearchModeSelect.value = 'AND';
            }
        }
    }
    
    function renderCategoriesForManagement() {
        if (!categoryListContainer) return;
        console.log("[Categories] Rendering categories for management list...");
        categoryListContainer.innerHTML = '';
        allCategoriesCache.forEach(category => {
            let displayInfo;
            if (!category.parentId || category.parentId === "") {
                displayInfo = "(親)"; 
            } else {
                const parentCategory = allCategoriesCache.find(p => p.id === category.parentId);
                const parentName = parentCategory ? parentCategory.name : '不明'; 
                displayInfo = `(子, 親: ${parentName})`; 
            }
            
            const div = document.createElement('div');
            div.classList.add('list-item');
            div.innerHTML = `
                <span>${category.name} ${displayInfo}</span> 
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
                    categoryData.tagSearchMode = 'AND'; // 子カテゴリはデフォルトAND
                }

                await addDoc(collection(db, 'categories'), categoryData);
                console.log("[Category Add] Category added successfully.");
                newCategoryNameInput.value = '';
                
                // ★データを再取得してUIを再描画
                await loadCategoriesFromFirestore(); // カテゴリデータを再取得
                populateParentCategoryButtons(newCategoryParentButtons, selectedNewParentCategoryIdInput); // 新規追加欄のボタン更新
                populateCategoryCheckboxesForTagAssignment(newTagCategoriesCheckboxes); // タグ追加欄のチェックボックス更新
                renderCategoriesForManagement(); // カテゴリリスト更新
                
                // モーダルが開いていれば、そこも更新
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

    function openEditCategoryModal(category) { 
        const docId = category.id;
        const currentName = category.name;
        const currentParentId = category.parentId || "";
        const currentTagSearchMode = category.tagSearchMode || 'AND'; 

        console.log(`[Category Edit] Opening modal for ID: ${docId}, Name: ${currentName}, ParentID: ${currentParentId}, Mode: ${currentTagSearchMode}`);
        editingCategoryDocIdInput.value = docId;
        editingCategoryNameInput.value = currentName;
        
        populateParentCategoryButtons(editingCategoryParentButtons, selectedEditingParentCategoryIdInput, { currentCategoryIdToExclude: docId, selectedParentId: currentParentId });
        populateTagsForCategoryEdit(editingCategoryTagsSelector, docId);

        if (currentParentId) { 
            if(tagSearchModeGroup) tagSearchModeGroup.style.display = 'block';
            if(editingTagSearchModeSelect) editingTagSearchModeSelect.value = currentTagSearchMode;
        } else { 
             if(tagSearchModeGroup) tagSearchModeGroup.style.display = 'none';
        }

        editCategoryModal.style.display = 'flex';
        editingCategoryNameInput.focus();
    }

    function populateTagsForCategoryEdit(containerElement, categoryId) {
        if (!containerElement) return;
        containerElement.innerHTML = '';
        if (allTagsCache.length === 0) {
            containerElement.innerHTML = '<p>タグがありません。</p>';
            return;
        }
        // ★子カテゴリの場合のみタグ選択を表示（親カテゴリは子を管理するだけ）
        const category = allCategoriesCache.find(c => c.id === categoryId);
        if (!category || !category.parentId) { // 親カテゴリの場合
             containerElement.innerHTML = '<p>親カテゴリには直接タグを紐付けません。</p>';
             return;
        }
        // 子カテゴリの場合、タグ選択を表示
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

    if (saveCategoryEditButton) {
        saveCategoryEditButton.addEventListener('click', async () => {
            const docId = editingCategoryDocIdInput.value; 
            const newName = editingCategoryNameInput.value.trim();
            const newParentId = selectedEditingParentCategoryIdInput.value; 
            const newTagSearchMode = editingTagSearchModeSelect.value; 
            const selectedTagIds = Array.from(editingCategoryTagsSelector.querySelectorAll('.tag-filter.active'))
                                         .map(btn => btn.dataset.tagId);
            
            console.log(`[Category Edit] Saving ID: ${docId}, New Name: ${newName}, New ParentID: ${newParentId}, Mode: ${newTagSearchMode}, Selected Tag IDs:`, selectedTagIds);

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
                const categoryUpdateData = { 
                    name: newName,
                    parentId: newParentId || ""
                };
                if (newParentId) { // 子カテゴリの場合のみ検索モードを設定
                     categoryUpdateData.tagSearchMode = newTagSearchMode;
                } else {
                    // 親カテゴリになった場合、検索モードフィールドを削除（ update に含めない）
                    // 確実に削除したい場合は deleteField() を使う
                }
                batch.update(doc(db, 'categories', docId), categoryUpdateData);

                // タグ更新ロジック（カテゴリが子の場合のみ実行）
                if (newParentId) {
                     const tagsBefore = allTagsCache.filter(tag => tag.categoryIds && tag.categoryIds.includes(docId)).map(t => t.id);
                     const tagsToAdd = selectedTagIds.filter(id => !tagsBefore.includes(id));
                     const tagsToRemove = tagsBefore.filter(id => !selectedTagIds.includes(id));

                     tagsToAdd.forEach(tagId => {
                         batch.update(doc(db, 'tags', tagId), { categoryIds: arrayUnion(docId) });
                     });
                     tagsToRemove.forEach(tagId => {
                          batch.update(doc(db, 'tags', tagId), { categoryIds: arrayRemove(docId) });
                     });
                } else {
                    // 親カテゴリになる場合は、以前このカテゴリに属していたタグからこのカテゴリIDを削除
                    const tagsToRemoveLink = allTagsCache.filter(tag => tag.categoryIds && tag.categoryIds.includes(docId)).map(t => t.id);
                     tagsToRemoveLink.forEach(tagId => {
                          batch.update(doc(db, 'tags', tagId), { categoryIds: arrayRemove(docId) });
                          console.log(`[Category Edit] Removing category ${docId} from tag ${tagId} as it becomes a parent.`);
                     });
                }

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
    async function loadTagsFromFirestore() {
        console.log("[Tags] Loading all tags...");
        try {
            const q = query(collection(db, 'tags'), orderBy('name'));
            const snapshot = await getDocs(q);
            allTagsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("[Tags] All tags loaded:", allTagsCache);
        } catch (error) {
            console.error("[Tags] Error loading tags:", error);
            allTagsCache = [];
        }
    }
    
    function populateCategoryCheckboxesForTagAssignment(containerElement, selectedCategoryIds = []) {
        if (!containerElement) return;
        containerElement.innerHTML = ''; 
        
        if (allCategoriesCache.length === 0) {
            containerElement.innerHTML = '<p>登録されているカテゴリがありません。</p>';
            return;
        }

        allCategoriesCache.forEach(category => {
            const checkboxId = `tag-cat-${category.id}-${containerElement.id.replace(/\W/g, '')}`;
            const checkboxWrapper = document.createElement('div');
            checkboxWrapper.classList.add('checkbox-item');
            let labelText = category.name;
            if (category.parentId) {
                const parentCat = allCategoriesCache.find(p => p.id === category.parentId);
                if (parentCat) {
                    labelText += ` (親: ${parentCat.name})`;
                } else {
                    labelText += ` (親: 不明)`;
                }
            } else {
                 labelText += ` (親カテゴリ)`;
            }
            checkboxWrapper.innerHTML = `
                <input type="checkbox" id="${checkboxId}" name="tagCategory" value="${category.id}" ${selectedCategoryIds.includes(category.id) ? 'checked' : ''}>
                <label for="${checkboxId}">${labelText}</label>
            `;
            containerElement.appendChild(checkboxWrapper);
        });
    }

    function renderTagsForManagement() {
        if (!tagListContainer) return;
        tagListContainer.innerHTML = '';
        allTagsCache.forEach(tag => {
            const belongingCategories = (tag.categoryIds || [])
                .map(catId => {
                    const cat = allCategoriesCache.find(c => c.id === catId);
                    if (!cat) return null;
                    let name = cat.name;
                    if (cat.parentId) {
                        const parentCat = allCategoriesCache.find(p => p.id === cat.parentId);
                         name += parentCat ? ` (親:${parentCat.name})` : ` (親:不明)`;
                    } else {
                        name += ` (親)`;
                    }
                    return name;
                })
                .filter(name => name)
                .join(', ') || '未分類';
            
            const div = document.createElement('div');
            div.classList.add('list-item');
            div.innerHTML = `
                <span>${tag.name} (所属: ${belongingCategories})</span>
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
                const tagToEdit = allTagsCache.find(t => t.id === tagId);
                if (tagToEdit) openEditTagModal(tagId, tagToEdit.name, tagToEdit.categoryIds || []);
            });
        });
        tagListContainer.querySelectorAll('.delete-tag').forEach(btn => {
            btn.addEventListener('click', (e) => deleteTag(e.currentTarget.dataset.tagId, e.currentTarget.dataset.tagName));
        });
    }

    if (addTagButton) {
        addTagButton.addEventListener('click', async () => {
            const name = newTagNameInput.value.trim();
            const selectedCategoryIds = Array.from(newTagCategoriesCheckboxes.querySelectorAll('input[type="checkbox"][name="tagCategory"]:checked'))
                                            .map(cb => cb.value);
            
            if (!name) { alert("タグ名を入力してください。"); return; }

            const q = query(collection(db, 'tags'), where('name', '==', name));
            const existingQuery = await getDocs(q);
            if (!existingQuery.empty) { alert("同じ名前のタグが既に存在します。"); return; }
            
            try {
                console.log(`[Tag Add] Adding tag '${name}' with categoryIds:`, selectedCategoryIds);
                await addDoc(collection(db, 'tags'), { 
                    name: name, 
                    categoryIds: selectedCategoryIds, 
                    createdAt: serverTimestamp()
                });
                newTagNameInput.value = '';
                newTagCategoriesCheckboxes.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
                
                await loadTagsFromFirestore();
                renderTagsForManagement();
                populateTagCheckboxesForItemForm(); 
                console.log("[Tag Add] Success.");
            } catch (error) {
                console.error("[Tag Add] Error:", error);
                alert("タグの追加に失敗しました。");
            }
        });
    }

    function openEditTagModal(docId, currentName, currentCategoryIds) {
        editingTagDocIdInput.value = docId;
        editingTagNameInput.value = currentName;
        populateCategoryCheckboxesForTagAssignment(editingTagCategoriesCheckboxes, currentCategoryIds);
        editTagModal.style.display = 'flex';
        editingTagNameInput.focus();
    }

    if (saveTagEditButton) {
        saveTagEditButton.addEventListener('click', async () => {
            const docId = editingTagDocIdInput.value;
            const newName = editingTagNameInput.value.trim();
            const newSelectedCategoryIds = Array.from(editingTagCategoriesCheckboxes.querySelectorAll('input[type="checkbox"][name="tagCategory"]:checked'))
                                                .map(cb => cb.value);

            if (!newName) { alert("タグ名は空にできません。"); return; }

            const q = query(collection(db, 'tags'), where('name', '==', newName));
            const existingQuery = await getDocs(q);
            let conflict = false;
            existingQuery.forEach(docSnap => { if (docSnap.id !== docId) conflict = true; });
            if (conflict) { alert("編集後の名前が、他の既存タグと重複します。"); return; }

            try {
                console.log(`[Tag Edit] Updating tag ${docId} with name '${newName}' and categoryIds:`, newSelectedCategoryIds);
                await updateDoc(doc(db, 'tags', docId), { 
                    name: newName, 
                    categoryIds: newSelectedCategoryIds 
                });
                editTagModal.style.display = 'none';
                await loadTagsFromFirestore();
                renderTagsForManagement();
                populateTagCheckboxesForItemForm();
                await loadItemsFromFirestore(); 
                renderItemsAdminTable();
                console.log("[Tag Edit] Success.");
            } catch (error) {
                console.error("[Tag Edit] Error:", error);
                alert("タグの更新に失敗しました。");
            }
        });
    }

    async function deleteTag(docId, tagName) {
        console.log(`[Tag Delete] Attempting to delete ID: ${docId}, Name: ${tagName}`);
        if (confirm(`タグ「${tagName}」を削除しますか？\nこのタグを使用している全てのアイテムからも自動的に解除されます。`)) {
            try {
                await deleteDoc(doc(db, 'tags', docId));
                console.log(`[Tag Delete] Tag ${docId} deleted from Firestore.`);
                
                const itemsToUpdateQuery = query(collection(db, 'items'), where('tags', 'array-contains', docId));
                const itemsSnapshot = await getDocs(itemsToUpdateQuery);
                if (!itemsSnapshot.empty) {
                    const batch = writeBatch(db);
                    itemsSnapshot.forEach(itemDoc => {
                        const currentItemTags = itemDoc.data().tags || [];
                        const updatedItemTags = currentItemTags.filter(id => id !== docId);
                        batch.update(itemDoc.ref, { tags: updatedItemTags });
                    });
                    await batch.commit();
                    console.log(`[Tag Delete] Updated ${itemsSnapshot.size} items to remove tag ${docId}.`);
                }
                
                await loadTagsFromFirestore();
                renderTagsForManagement();
                populateTagCheckboxesForItemForm();
                await loadItemsFromFirestore(); 
                renderItemsAdminTable();

            } catch (error) {
                console.error("[Tag Delete] Error:", error);
                alert("タグの削除または関連アイテムの更新に失敗しました。");
            }
        }
    }
    
    // --- Item Management ---
    function populateTagCheckboxesForItemForm(selectedTagIds = []) {
        if (!itemTagsSelectorCheckboxes) return;
        itemTagsSelectorCheckboxes.innerHTML = '';
        if (allTagsCache.length === 0) {
            itemTagsSelectorCheckboxes.innerHTML = '<p>登録されているタグがありません。</p>';
            return;
        }
        allTagsCache.forEach(tag => {
            const checkboxId = `item-tag-sel-${tag.id}`;
            const checkboxWrapper = document.createElement('div');
            checkboxWrapper.classList.add('checkbox-item');
            checkboxWrapper.innerHTML = `
                <input type="checkbox" id="${checkboxId}" name="itemTag" value="${tag.id}" ${selectedTagIds.includes(tag.id) ? 'checked' : ''}>
                <label for="${checkboxId}">${tag.name}</label>
            `;
            itemTagsSelectorCheckboxes.appendChild(checkboxWrapper);
        });
    }
    
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
            const selectedItemTagIds = Array.from(itemTagsSelectorCheckboxes.querySelectorAll('input[type="checkbox"][name="itemTag"]:checked'))
                                            .map(cb => cb.value); 
            const editingDocId = itemIdToEditInput.value;
            let imageUrl = itemImageUrlInput.value;
            
            saveItemButton.disabled = true; saveItemButton.textContent = "保存中...";
            try {
                if (selectedImageFile) {
                    imageUrl = await uploadImageToWorkerAndGetURL(selectedImageFile);
                    if (imageUrl === null && selectedImageFile) {
                        saveItemButton.disabled = false; saveItemButton.textContent = editingDocId ? "アイテム更新" : "アイテム保存";
                        return; 
                    }
                }
                const itemData = {
                    name: name || "", image: imageUrl || "", effect: effect || "",
                    入手手段: source || "", tags: selectedItemTagIds, 
                    updatedAt: serverTimestamp()
                };
                if (editingDocId) {
                     console.log(`[Item Save] Updating item ${editingDocId} with tags:`, selectedItemTagIds);
                    await updateDoc(doc(db, 'items', editingDocId), itemData);
                } else {
                    itemData.createdAt = serverTimestamp();
                    console.log(`[Item Save] Adding new item with tags:`, selectedItemTagIds);
                    await addDoc(collection(db, 'items'), itemData);
                }
                await loadItemsFromFirestore();
                renderItemsAdminTable();
                clearItemForm();
                console.log("[Item Save] Success.");
            } catch (error) {
                console.error("[Item Save] Error:", error);
                alert(`アイテム保存エラー: ${error.message}`);
            } finally {
                saveItemButton.disabled = false;
                saveItemButton.textContent = editingDocId ? "アイテム更新" : "アイテム保存";
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
        populateTagCheckboxesForItemForm(); 
        if (saveItemButton) saveItemButton.textContent = "アイテム保存";
    }

    function renderItemsAdminTable() {
        if (!itemsTableBody) return;
        itemsTableBody.innerHTML = '';
        const searchTerm = itemSearchAdminInput ? itemSearchAdminInput.value.toLowerCase() : "";
        const filteredItems = itemsCache.filter(item => 
            (item.name && item.name.toLowerCase().includes(searchTerm)) ||
            (!searchTerm && (item.name === "" || !item.name))
        );
        filteredItems.forEach(item => {
            const tr = document.createElement('tr');
            const imageDisplayPath = item.image || '../images/placeholder_item.png';
            const itemTagsString = (item.tags || [])
                .map(tagId => allTagsCache.find(t => t.id === tagId)?.name)
                .filter(name => name)
                .join(', ') || 'なし';
            const effectExcerpt = item.effect ? (item.effect.substring(0, 30) + (item.effect.length > 30 ? '...' : '')) : '(未設定)';
            const nameDisplay = item.name || '(名称未設定)';
            tr.innerHTML = `
                <td><img src="${imageDisplayPath}" alt="${nameDisplay}" onerror="this.onerror=null; this.src='../images/placeholder_item.png';"></td>
                <td>${nameDisplay}</td><td>${effectExcerpt}</td><td>${itemTagsString}</td>
                <td>
                    <button class="edit-item action-button" data-item-doc-id="${item.docId}" title="編集">✎</button>
                    <button class="delete-item action-button delete" data-item-doc-id="${item.docId}" title="削除">×</button>
                </td>`;
            tr.querySelector('.edit-item').addEventListener('click', () => loadItemForEdit(item.docId));
            tr.querySelector('.delete-item').addEventListener('click', () => deleteItem(item.docId, item.name, item.image));
            itemsTableBody.appendChild(tr);
        });
    }

    if (itemSearchAdminInput) itemSearchAdminInput.addEventListener('input', renderItemsAdminTable);

    async function loadItemForEdit(docId) {
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
                    itemImagePreview.src = itemData.image; itemImagePreview.style.display = 'block';
                } else {
                    itemImagePreview.src = '#'; itemImagePreview.style.display = 'none';
                }
                if (itemImageFileInput) itemImageFileInput.value = null; selectedImageFile = null;
                populateTagCheckboxesForItemForm(itemData.tags || []); 
                if (saveItemButton) saveItemButton.textContent = "アイテム更新";
                if (itemForm) itemForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else { alert("編集対象のアイテムが見つかりませんでした。"); }
        } catch (error) { console.error("[Item Edit] Error loading:", error); alert("編集データ読込エラー"); }
    }
    
    async function deleteItem(docId, itemName, imageUrl) {
        const displayName = itemName || '(名称未設定)';
        if (confirm(`アイテム「${displayName}」を削除しますか？\nCloudflare R2上の関連画像は手動での削除が必要です。`)) {
            try {
                await deleteDoc(doc(db, 'items', docId));
                if (imageUrl) {
                    console.warn(`Image ${imageUrl} (R2) for item ${docId} needs manual deletion.`);
                }
                await loadItemsFromFirestore();
                renderItemsAdminTable();
                if (itemIdToEditInput.value === docId) clearItemForm();
            } catch (error) {
                console.error(`[Item Delete] Error deleting item ${docId}:`, error);
                alert("アイテムの削除に失敗しました。");
            }
        }
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
    
    // --- Modal common handlers --- 
    document.querySelectorAll('.modal .close-button').forEach(btn => {
        btn.onclick = function() { btn.closest('.modal').style.display = "none"; }
    });
    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) event.target.style.display = "none";
    }
});
