import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import {
    getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import {
    getFirestore, collection, getDocs, addDoc, doc, updateDoc, deleteDoc,
    query, where, orderBy, serverTimestamp, writeBatch, getDoc, runTransaction,
    arrayUnion, arrayRemove, deleteField 
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

    // Effect Type Management
    const newEffectTypeNameInput = document.getElementById('newEffectTypeName');
    const addEffectTypeButton = document.getElementById('addEffectTypeButton');
    const effectTypeListContainer = document.getElementById('effectTypeListContainer');
    const editEffectTypeModal = document.getElementById('editEffectTypeModal');
    const editingEffectTypeDocIdInput = document.getElementById('editingEffectTypeDocId');
    const editingEffectTypeNameInput = document.getElementById('editingEffectTypeName');
    const saveEffectTypeEditButton = document.getElementById('saveEffectTypeEditButton');
    const effectTypeSelect = document.getElementById('effectTypeSelect'); 

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
    const itemSourceInput = document.getElementById('itemSource');
    const itemTagsSelectorCheckboxes = document.getElementById('itemTagsSelectorCheckboxes'); 
    const saveItemButton = document.getElementById('saveItemButton');
    const clearFormButton = document.getElementById('clearFormButton');
    const itemsTableBody = document.querySelector('#itemsTable tbody');
    const itemSearchAdminInput = document.getElementById('itemSearchAdmin');
    const effectValueInput = document.getElementById('effectValueInput');
    const effectUnitSelect = document.getElementById('effectUnitSelect');
    const addEffectToListButton = document.getElementById('addEffectToListButton');
    const currentEffectsList = document.getElementById('currentEffectsList');

    let allCategoriesCache = []; 
    let allTagsCache = [];      
    let itemsCache = [];
    let effectTypesCache = []; 
    let currentItemEffects = []; 
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

        if (effectTypeListContainer) effectTypeListContainer.innerHTML = ''; 
        if (effectTypeSelect) effectTypeSelect.innerHTML = '<option value="">効果種類を選択...</option>'; 

        if (itemsTableBody) itemsTableBody.innerHTML = '';
        if (itemTagsSelectorCheckboxes) itemTagsSelectorCheckboxes.innerHTML = ''; 
        clearItemForm();
    }

    async function loadInitialData() {
        console.log("[Initial Load] Starting...");
        await loadEffectTypesFromFirestore(); 
        await loadCategoriesFromFirestore();
        await loadTagsFromFirestore();
        await loadItemsFromFirestore();
        
        populateParentCategoryButtons(newCategoryParentButtons, selectedNewParentCategoryIdInput); 
        populateCategoryCheckboxesForTagAssignment(newTagCategoriesCheckboxes);
        populateTagCheckboxesForItemForm();
        populateEffectTypeSelect(); 

        renderCategoriesForManagement();
        renderTagsForManagement();
        renderEffectTypesForManagement(); 
        renderItemsAdminTable();
        console.log("[Initial Load] Completed.");
    }

    // --- Effect Type Management ---
    async function loadEffectTypesFromFirestore() {
        console.log("[Effect Types] Loading effect types...");
        try {
            const q = query(collection(db, 'effect_types'), orderBy('name'));
            const snapshot = await getDocs(q);
            effectTypesCache = snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
            console.log("[Effect Types] Loaded:", effectTypesCache);
        } catch (error) {
            console.error("[Effect Types] Error loading:", error);
            effectTypesCache = [];
        }
    }

    function renderEffectTypesForManagement() {
        if (!effectTypeListContainer) return;
        effectTypeListContainer.innerHTML = '';
        effectTypesCache.forEach(effectType => {
            const div = document.createElement('div');
            div.classList.add('list-item');
            div.innerHTML = `
                <span>${effectType.name}</span>
                <div>
                    <button class="edit-effect-type action-button" data-id="${effectType.id}" data-name="${effectType.name}" title="編集">✎</button>
                    <button class="delete-effect-type action-button delete" data-id="${effectType.id}" data-name="${effectType.name}" title="削除">×</button>
                </div>
            `;
            effectTypeListContainer.appendChild(div);
        });
        // Add event listeners
        effectTypeListContainer.querySelectorAll('.edit-effect-type').forEach(btn => {
            btn.addEventListener('click', (e) => openEditEffectTypeModal(e.currentTarget.dataset.id, e.currentTarget.dataset.name));
        });
        effectTypeListContainer.querySelectorAll('.delete-effect-type').forEach(btn => {
             btn.addEventListener('click', (e) => deleteEffectType(e.currentTarget.dataset.id, e.currentTarget.dataset.name));
        });
    }
    
    if (addEffectTypeButton) {
        addEffectTypeButton.addEventListener('click', async () => {
            const name = newEffectTypeNameInput.value.trim();
            if (!name) { alert("効果種類名を入力してください。"); return; }
            if (effectTypesCache.some(et => et.name.toLowerCase() === name.toLowerCase())) {
                alert("同じ名前の効果種類が既に存在します。"); return;
            }
            try {
                await addDoc(collection(db, 'effect_types'), { name: name });
                newEffectTypeNameInput.value = '';
                await loadEffectTypesFromFirestore();
                renderEffectTypesForManagement();
                populateEffectTypeSelect(); 
            } catch (error) {
                console.error("[Effect Types] Error adding:", error);
                alert("効果種類の追加に失敗しました。");
            }
        });
    }

    function openEditEffectTypeModal(id, name) {
        editingEffectTypeDocIdInput.value = id;
        editingEffectTypeNameInput.value = name;
        if (editEffectTypeModal) editEffectTypeModal.style.display = 'flex';
    }

     if (saveEffectTypeEditButton) {
        saveEffectTypeEditButton.addEventListener('click', async () => {
            const id = editingEffectTypeDocIdInput.value;
            const newName = editingEffectTypeNameInput.value.trim();
            if (!newName) { alert("効果種類名は空にできません。"); return; }
            if (effectTypesCache.some(et => et.id !== id && et.name.toLowerCase() === newName.toLowerCase())) {
                 alert("編集後の名前が他の効果種類と重複します。"); return;
            }
            try {
                await updateDoc(doc(db, 'effect_types', id), { name: newName });
                if (editEffectTypeModal) editEffectTypeModal.style.display = 'none';
                await loadEffectTypesFromFirestore();
                renderEffectTypesForManagement();
                populateEffectTypeSelect();
                // アイテムの効果表示も更新されるべきだが、リアルタイム更新は複雑なので一旦保留
                await loadItemsFromFirestore();
                renderItemsAdminTable(); 
            } catch (error) {
                 console.error("[Effect Types] Error updating:", error);
                 alert("効果種類の更新に失敗しました。");
            }
        });
    }

    async function deleteEffectType(id, name) {
         if (confirm(`効果種類「${name}」を削除しますか？\n注意: この効果種類を使用しているアイテムの効果設定は残りますが、種類名が表示されなくなります。`)) {
             try {
                 await deleteDoc(doc(db, 'effect_types', id));
                 await loadEffectTypesFromFirestore();
                 renderEffectTypesForManagement();
                 populateEffectTypeSelect();
                 // アイテムデータ内の効果からも削除する処理（必要に応じて）
                 // const batch = writeBatch(db);
                 // const itemsQuery = query(collection(db, 'items'), where('structured_effects', 'array-contains', { type: id })); // これは直接は機能しない
                 // Find items and filter effects manually
                 // await batch.commit();
                 await loadItemsFromFirestore(); // 関連アイテムの表示更新のため
                 renderItemsAdminTable();
             } catch (error) {
                  console.error("[Effect Types] Error deleting:", error);
                  alert("効果種類の削除に失敗しました。");
             }
         }
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
             const isParent = (parentId === "");
             if (tagSearchModeGroup) tagSearchModeGroup.style.display = isParent ? 'none' : 'block';
             if (editingCategoryTagsSelector) editingCategoryTagsSelector.closest('.form-group').style.display = isParent ? 'none' : 'block';
             if (!isParent && editingTagSearchModeSelect) editingTagSearchModeSelect.value = 'AND'; // 子にする場合はデフォルトAND
        }
    }
    
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
                searchModeInfo = category.tagSearchMode === 'OR' ? ' (OR検索)' : ' (AND検索)';
            }
            
            const div = document.createElement('div');
            div.classList.add('list-item');
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
                
                await loadCategoriesFromFirestore(); 
                // ★親カテゴリボタン群を再生成して即時反映
                populateParentCategoryButtons(newCategoryParentButtons, selectedNewParentCategoryIdInput); 
                // ★タグ割当用チェックボックスも更新 (新しいカテゴリが含まれるように)
                populateCategoryCheckboxesForTagAssignment(newTagCategoriesCheckboxes); 
                renderCategoriesForManagement(); 
                
                // ★編集モーダルが開いている場合も親ボタンを更新
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
        
        // ★親カテゴリの場合はタグ選択と検索モードを非表示
        const isParentCategory = !currentParentId;
        if (editingCategoryTagsSelector) editingCategoryTagsSelector.closest('.form-group').style.display = isParentCategory ? 'none' : 'block';
        if (tagSearchModeGroup) tagSearchModeGroup.style.display = isParentCategory ? 'none' : 'block';

        if (!isParentCategory) { // 子カテゴリの場合のみタグと検索モードを設定
            populateTagsForCategoryEdit(editingCategoryTagsSelector, docId);
            if(editingTagSearchModeSelect) editingTagSearchModeSelect.value = currentTagSearchMode;
        } else {
             if(editingCategoryTagsSelector) editingCategoryTagsSelector.innerHTML = ''; // 親の場合はクリア
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
                
                const tagsBefore = allTagsCache.filter(tag => tag.categoryIds && tag.categoryIds.includes(docId)).map(t => t.id);

                if (newParentId) { // 子カテゴリになる、または子カテゴリのままの場合
                     categoryUpdateData.tagSearchMode = newTagSearchMode; 
                     const tagsToAdd = selectedTagIds.filter(id => !tagsBefore.includes(id));
                     const tagsToRemove = tagsBefore.filter(id => !selectedTagIds.includes(id));
                     tagsToAdd.forEach(tagId => batch.update(doc(db, 'tags', tagId), { categoryIds: arrayUnion(docId) }));
                     tagsToRemove.forEach(tagId => batch.update(doc(db, 'tags', tagId), { categoryIds: arrayRemove(docId) }));
                } else { // 親カテゴリになる場合
                    categoryUpdateData.tagSearchMode = deleteField(); 
                     tagsBefore.forEach(tagId => batch.update(doc(db, 'tags', tagId), { categoryIds: arrayRemove(docId) }));
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
    
    // ★タグ割当用のカテゴリ選択肢から親カテゴリを除外
    function populateCategoryCheckboxesForTagAssignment(containerElement, selectedCategoryIds = []) {
        if (!containerElement) return;
        containerElement.innerHTML = ''; 
        
        const assignableCategories = allCategoriesCache.filter(cat => cat.parentId && cat.parentId !== ""); // parentIdを持つもののみ

        if (assignableCategories.length === 0) {
            containerElement.innerHTML = '<p>登録されている子カテゴリがありません。</p>';
            return;
        }

        assignableCategories.forEach(category => {
            const checkboxId = `tag-cat-${category.id}-${containerElement.id.replace(/\W/g, '')}`;
            const checkboxWrapper = document.createElement('div');
            checkboxWrapper.classList.add('checkbox-item');
            let labelText = category.name;
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

    // ★タグ一覧の所属カテゴリ表示を調整（親カテゴリは表示しない）
    function renderTagsForManagement() {
        if (!tagListContainer) return;
        tagListContainer.innerHTML = '';
        allTagsCache.forEach(tag => {
            const belongingCategories = (tag.categoryIds || [])
                .map(catId => {
                    const cat = allCategoriesCache.find(c => c.id === catId);
                    // ★親カテゴリは表示しない（もしデータが混入していても）
                    if (!cat || !cat.parentId) return null; 
                    let name = cat.name;
                    const parentCat = allCategoriesCache.find(p => p.id === cat.parentId);
                    name += parentCat ? ` (親:${parentCat.name})` : ` (親:不明)`;
                    return name;
                })
                .filter(name => name) // nullを除去
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
        // イベントリスナーは変更なし
        tagListContainer.querySelectorAll('.edit-tag').forEach(btn => { /* ... */ });
        tagListContainer.querySelectorAll('.delete-tag').forEach(btn => { /* ... */ });
    }

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

    // ★アイテムフォームの効果種類選択肢を生成する関数を追加
    function populateEffectTypeSelect() {
        if (!effectTypeSelect) return;
        const currentVal = effectTypeSelect.value;
        effectTypeSelect.innerHTML = '<option value="">効果種類を選択...</option>';
        effectTypesCache.forEach(et => {
            effectTypeSelect.add(new Option(et.name, et.id));
        });
        if (currentVal && effectTypeSelect.querySelector(`option[value="${currentVal}"]`)) {
            effectTypeSelect.value = currentVal;
        }
    }
    
    // ★アイテムフォームの効果リスト表示・操作関数を追加
    function renderCurrentItemEffectsList() {
        if (!currentEffectsList) return;
        currentEffectsList.innerHTML = '';
        if (currentItemEffects.length === 0) {
            currentEffectsList.innerHTML = '<p>効果が追加されていません。</p>';
            return;
        }
        currentItemEffects.forEach((effect, index) => {
            const effectType = effectTypesCache.find(et => et.id === effect.type);
            const typeName = effectType ? effectType.name : '不明な効果';
            const unitText = effect.unit !== 'none' ? effect.unit : ''; 

            const div = document.createElement('div');
            div.classList.add('effect-list-item');
            div.innerHTML = `
                <span>${typeName}: ${effect.value}${unitText}</span>
                <button type="button" class="delete-effect-from-list action-button delete" data-index="${index}" title="削除">×</button>
            `;
            currentEffectsList.appendChild(div);
        });
        currentEffectsList.querySelectorAll('.delete-effect-from-list').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const indexToRemove = parseInt(e.currentTarget.dataset.index, 10);
                currentItemEffects.splice(indexToRemove, 1); 
                renderCurrentItemEffectsList(); 
            });
        });
    }
    
    // ★「効果を追加」ボタンの処理を追加
    if (addEffectToListButton) {
        addEffectToListButton.addEventListener('click', () => {
            const typeId = effectTypeSelect.value;
            const valueStr = effectValueInput.value;
            const unit = effectUnitSelect.value;

            if (!typeId) { alert("効果種類を選択してください。"); return; }
            if (valueStr === '' || isNaN(parseFloat(valueStr))) { 
                alert("効果の値を数値で入力してください。"); return;
            }
            const value = parseFloat(valueStr);

            currentItemEffects.push({ type: typeId, value: value, unit: unit });
            renderCurrentItemEffectsList();
            effectTypeSelect.value = '';
            effectValueInput.value = '';
            effectUnitSelect.value = 'point'; 
        });
    }
});
