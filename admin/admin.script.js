// admin.script.js (省略なし・完全版)
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
    const editCategoryTagsGroup = document.getElementById('editCategoryTagsGroup');

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
    const newEffectTypeUnitSelect = document.getElementById('newEffectTypeUnit');
    const newEffectTypeCalcMethodRadios = document.querySelectorAll('input[name="newCalcMethod"]');
    const addEffectTypeButton = document.getElementById('addEffectTypeButton');
    const effectTypeListContainer = document.getElementById('effectTypeListContainer');
    const editEffectTypeModal = document.getElementById('editEffectTypeModal');
    const editingEffectTypeDocIdInput = document.getElementById('editingEffectTypeDocId');
    const editingEffectTypeNameInput = document.getElementById('editingEffectTypeName');
    const editingEffectTypeUnitSelect = document.getElementById('editingEffectTypeUnit');
    const editingEffectTypeCalcMethodRadios = document.querySelectorAll('input[name="editCalcMethod"]');
    const saveEffectTypeEditButton = document.getElementById('saveEffectTypeEditButton');
    const effectTypeSelect = document.getElementById('effectTypeSelect'); // For item form

    // Item Management
    const itemForm = document.getElementById('itemForm');
    const itemIdToEditInput = document.getElementById('itemIdToEdit');
    const itemNameInput = document.getElementById('itemName');
    const itemImageFileInput = document.getElementById('itemImageFile');
    const itemImagePreview = document.getElementById('itemImagePreview');
    const itemImageUrlInput = document.getElementById('itemImageUrl'); // Hidden input for image URL
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
    const effectUnitDisplay = document.getElementById('effectUnitDisplay');
    const addEffectToListButton = document.getElementById('addEffectToListButton');
    const currentEffectsList = document.getElementById('currentEffectsList');

    let allCategoriesCache = [];
    let allTagsCache = [];
    let itemsCache = [];
    let effectTypesCache = [];
    let currentItemEffects = []; // [{ type: 'typeId', value: 10, unit: '%' }, ...]
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
            clearAdminUI(); // Clear data when logged out
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
                    passwordError.textContent = `ログインエラー: ${error.message}`; // More user-friendly
                });
        });
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            signOut(auth).catch(error => console.error("Logout error:", error));
        });
    }

    function clearAdminUI() {
        // Clear category UI
        if (categoryListContainer) categoryListContainer.innerHTML = '';
        if (newCategoryParentButtons) newCategoryParentButtons.innerHTML = '';
        if (selectedNewParentCategoryIdInput) selectedNewParentCategoryIdInput.value = '';
        if (editingCategoryParentButtons) editingCategoryParentButtons.innerHTML = '';
        if (selectedEditingParentCategoryIdInput) selectedEditingParentCategoryIdInput.value = '';
        if (editingCategoryTagsSelector) editingCategoryTagsSelector.innerHTML = '';
        if (tagSearchModeGroup) tagSearchModeGroup.style.display = 'none';
        if (editingTagSearchModeSelect) editingTagSearchModeSelect.value = 'AND';
        if (editCategoryTagsGroup) editCategoryTagsGroup.style.display = 'block'; // Default for child

        // Clear tag UI
        if (tagListContainer) tagListContainer.innerHTML = '';
        if (newTagCategoriesCheckboxes) newTagCategoriesCheckboxes.innerHTML = '';
        if (editingTagCategoriesCheckboxes) editingTagCategoriesCheckboxes.innerHTML = '';

        // Clear effect type UI
        if (effectTypeListContainer) effectTypeListContainer.innerHTML = '';
        if (effectTypeSelect) effectTypeSelect.innerHTML = '<option value="">効果種類を選択...</option>';
        if (newEffectTypeNameInput) newEffectTypeNameInput.value = '';
        if (newEffectTypeUnitSelect) newEffectTypeUnitSelect.value = 'point';
        if (newEffectTypeCalcMethodRadios[0]) newEffectTypeCalcMethodRadios[0].checked = true;

        // Clear item UI
        if (itemsTableBody) itemsTableBody.innerHTML = '';
        if (itemTagsSelectorCheckboxes) itemTagsSelectorCheckboxes.innerHTML = '';
        clearItemForm(); // Resets the item form itself

        // Clear caches
        allCategoriesCache = [];
        allTagsCache = [];
        itemsCache = [];
        effectTypesCache = [];
        currentItemEffects = [];
    }

    async function loadInitialData() {
        console.log("[Initial Load] Starting...");
        // Load in order of dependency or parallel if no strict dependency
        await loadEffectTypesFromFirestore(); // Needed by items
        await loadCategoriesFromFirestore();  // Needed by tags & items (indirectly)
        await loadTagsFromFirestore();        // Needed by items & categories edit
        await loadItemsFromFirestore();       // Main data

        // Populate UI elements that depend on the loaded data
        populateParentCategoryButtons(newCategoryParentButtons, selectedNewParentCategoryIdInput);
        populateCategoryCheckboxesForTagAssignment(newTagCategoriesCheckboxes);
        populateTagCheckboxesForItemForm();
        populateEffectTypeSelect(); // For item form

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
            effectTypesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("[Effect Types] Loaded:", effectTypesCache.length, effectTypesCache);
        } catch (error) {
            console.error("[Effect Types] Error loading:", error);
            effectTypesCache = []; // Ensure it's an empty array on error
        }
    }

    function renderEffectTypesForManagement() {
        if (!effectTypeListContainer) return;
        effectTypeListContainer.innerHTML = '';
        if (effectTypesCache.length === 0) {
            effectTypeListContainer.innerHTML = '<p>効果種類が登録されていません。</p>';
            return;
        }
        effectTypesCache.forEach(effectType => {
            const unitText = effectType.defaultUnit && effectType.defaultUnit !== 'none' ? `(${effectType.defaultUnit})` : '(単位なし)';
            const calcText = effectType.calculationMethod === 'max' ? '(最大値)' : '(加算)';
            const div = document.createElement('div');
            div.classList.add('list-item');
            div.innerHTML = `
                <span>${effectType.name} ${unitText} ${calcText}</span>
                <div>
                    <button class="edit-effect-type action-button" data-id="${effectType.id}" title="編集">✎</button>
                    <button class="delete-effect-type action-button delete" data-id="${effectType.id}" data-name="${effectType.name}" title="削除">×</button>
                </div>
            `;
            effectTypeListContainer.appendChild(div);
        });
        effectTypeListContainer.querySelectorAll('.edit-effect-type').forEach(btn => {
            btn.addEventListener('click', (e) => {
                 const effectTypeId = e.currentTarget.dataset.id;
                 const effectTypeData = effectTypesCache.find(et => et.id === effectTypeId);
                 if (effectTypeData) {
                    openEditEffectTypeModal(effectTypeData);
                 } else {
                     console.error("Effect type data not found for id:", effectTypeId);
                     alert("編集する効果種類のデータが見つかりません。");
                 }
            });
        });
        effectTypeListContainer.querySelectorAll('.delete-effect-type').forEach(btn => {
             btn.addEventListener('click', (e) => deleteEffectType(e.currentTarget.dataset.id, e.currentTarget.dataset.name));
        });
    }

    if (addEffectTypeButton) {
        addEffectTypeButton.addEventListener('click', async () => {
            const name = newEffectTypeNameInput.value.trim();
            const unit = newEffectTypeUnitSelect.value;
            const calcMethodRadio = Array.from(newEffectTypeCalcMethodRadios).find(r => r.checked);
            const calcMethod = calcMethodRadio ? calcMethodRadio.value : 'sum'; // Default to sum

            if (!name) { alert("効果種類名を入力してください。"); return; }
            if (effectTypesCache.some(et => et.name.toLowerCase() === name.toLowerCase())) {
                alert("同じ名前の効果種類が既に存在します。"); return;
            }
            try {
                await addDoc(collection(db, 'effect_types'), {
                    name: name,
                    defaultUnit: unit,
                    calculationMethod: calcMethod,
                    createdAt: serverTimestamp() // Optional: for tracking
                });
                newEffectTypeNameInput.value = '';
                newEffectTypeUnitSelect.value = 'point'; // Reset to default
                if(newEffectTypeCalcMethodRadios[0]) newEffectTypeCalcMethodRadios[0].checked = true;

                await loadEffectTypesFromFirestore(); // Reload cache
                renderEffectTypesForManagement();    // Re-render list
                populateEffectTypeSelect();          // Update dropdown in item form
            } catch (error) {
                console.error("[Effect Types] Error adding:", error);
                alert("効果種類の追加に失敗しました。");
            }
        });
    }

    function openEditEffectTypeModal(effectTypeData) {
        editingEffectTypeDocIdInput.value = effectTypeData.id;
        editingEffectTypeNameInput.value = effectTypeData.name;
        editingEffectTypeUnitSelect.value = effectTypeData.defaultUnit || 'point';

        const calcMethod = effectTypeData.calculationMethod || 'sum';
        const radioToCheck = Array.from(editingEffectTypeCalcMethodRadios).find(r => r.value === calcMethod);
        if (radioToCheck) {
            radioToCheck.checked = true;
        } else if (editingEffectTypeCalcMethodRadios[0]) { // Fallback to first option
            editingEffectTypeCalcMethodRadios[0].checked = true;
        }

        if (editEffectTypeModal) editEffectTypeModal.style.display = 'flex';
    }

     if (saveEffectTypeEditButton) {
        saveEffectTypeEditButton.addEventListener('click', async () => {
            const id = editingEffectTypeDocIdInput.value;
            const newName = editingEffectTypeNameInput.value.trim();
            const newUnit = editingEffectTypeUnitSelect.value;
            const editCalcMethodRadio = Array.from(editingEffectTypeCalcMethodRadios).find(r => r.checked);
            const newCalcMethod = editCalcMethodRadio ? editCalcMethodRadio.value : 'sum';

            if (!newName) { alert("効果種類名は空にできません。"); return; }
            if (effectTypesCache.some(et => et.id !== id && et.name.toLowerCase() === newName.toLowerCase())) {
                 alert("編集後の名前が他の効果種類と重複します。"); return;
            }
            try {
                await updateDoc(doc(db, 'effect_types', id), {
                    name: newName,
                    defaultUnit: newUnit,
                    calculationMethod: newCalcMethod,
                    updatedAt: serverTimestamp() // Optional
                 });
                if (editEffectTypeModal) editEffectTypeModal.style.display = 'none';
                await loadEffectTypesFromFirestore();
                renderEffectTypesForManagement();
                populateEffectTypeSelect();
                await loadItemsFromFirestore(); // Items might depend on this for display
                renderItemsAdminTable();
            } catch (error) {
                 console.error("[Effect Types] Error updating:", error);
                 alert("効果種類の更新に失敗しました。");
            }
        });
    }

    async function deleteEffectType(id, name) {
         if (confirm(`効果種類「${name}」を削除しますか？\n注意: この効果種類を使用しているアイテムの効果設定は残りますが、種類名が表示されなくなる可能性があります。`)) {
             try {
                 await deleteDoc(doc(db, 'effect_types', id));
                 await loadEffectTypesFromFirestore();
                 renderEffectTypesForManagement();
                 populateEffectTypeSelect();
                 await loadItemsFromFirestore(); // Refresh items display
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
            console.log("[Categories] All categories loaded:", allCategoriesCache.length, allCategoriesCache);
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
        topLevelButton.textContent = '最上位カテゴリとして設定'; // Changed text
        topLevelButton.dataset.parentId = "";
        topLevelButton.classList.toggle('active', selectedParentId === "");
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
                button.classList.toggle('active', selectedParentId === cat.id);
                button.addEventListener('click', () => {
                     selectParentCategoryButton(buttonContainer, hiddenInput, button, cat.id);
                });
                buttonContainer.appendChild(button);
            });

        hiddenInput.value = selectedParentId; // Ensure hidden input is set
    }

    function selectParentCategoryButton(container, hiddenInput, clickedButton, parentId) {
        container.querySelectorAll('.category-select-button.active').forEach(activeBtn => {
            activeBtn.classList.remove('active');
        });
        clickedButton.classList.add('active');
        hiddenInput.value = parentId;

        // Special handling for the edit category modal
        if (container === editingCategoryParentButtons) {
             const isParentSelected = (parentId === ""); // True if "最上位" is selected
             // Show/hide tag selection and search mode only if a parent is *not* selected (i.e., it's a child)
             if (tagSearchModeGroup) tagSearchModeGroup.style.display = isParentSelected ? 'none' : 'block';
             if (editCategoryTagsGroup) editCategoryTagsGroup.style.display = isParentSelected ? 'none' : 'block';
             if (!isParentSelected && editingTagSearchModeSelect) editingTagSearchModeSelect.value = 'AND'; // Default for new child
        }
    }

    function renderCategoriesForManagement() {
        if (!categoryListContainer) return;
        categoryListContainer.innerHTML = '';
        if (allCategoriesCache.length === 0) {
            categoryListContainer.innerHTML = '<p>カテゴリが登録されていません。</p>';
            return;
        }
        allCategoriesCache.forEach(category => {
            let displayInfo = '';
            let searchModeInfo = '';
            if (!category.parentId || category.parentId === "") {
                displayInfo = "(親カテゴリ)";
            } else {
                const parentCategory = allCategoriesCache.find(p => p.id === category.parentId);
                const parentName = parentCategory ? parentCategory.name : '不明な親';
                displayInfo = `(子カテゴリ, 親: ${parentName})`;
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
                else alert("編集するカテゴリのデータが見つかりません。");
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

            if (!name) { alert("カテゴリ名を入力してください。"); return; }

            const q = query(collection(db, 'categories'), where('name', '==', name), where('parentId', '==', parentId || ""));
            const existingQuery = await getDocs(q);
            if (!existingQuery.empty) {
                 alert(parentId ? "同じ親カテゴリ内に同じ名前の子カテゴリが既に存在します。" : "同じ名前の親カテゴリが既に存在します。");
                 return;
            }

            try {
                const categoryData = {
                    name: name,
                    parentId: parentId || "", // Ensure empty string if no parent
                    createdAt: serverTimestamp()
                };
                if (parentId) { // If it's a child category
                    categoryData.tagSearchMode = 'AND'; // Default search mode
                }

                await addDoc(collection(db, 'categories'), categoryData);
                newCategoryNameInput.value = '';
                // selectedNewParentCategoryIdInput.value = ''; // Keep parent selection or reset? User preference.
                // For now, reset the parent selection UI for new category addition
                populateParentCategoryButtons(newCategoryParentButtons, selectedNewParentCategoryIdInput);


                await loadCategoriesFromFirestore();
                renderCategoriesForManagement();
                // populateParentCategoryButtons(newCategoryParentButtons, selectedNewParentCategoryIdInput); // Re-populate for next add // Already done above
                populateCategoryCheckboxesForTagAssignment(newTagCategoriesCheckboxes); // Update tag assignment options

                // Update parent selection in edit modal if it's open and a category was just added
                if (editCategoryModal.style.display === 'flex' && editingCategoryDocIdInput.value) {
                    const currentlyEditingCatId = editingCategoryDocIdInput.value;
                    const currentlyEditingCat = allCategoriesCache.find(c => c.id === currentlyEditingCatId);
                    if (currentlyEditingCat) {
                        populateParentCategoryButtons(editingCategoryParentButtons, selectedEditingParentCategoryIdInput, { currentCategoryIdToExclude: currentlyEditingCatId, selectedParentId: currentlyEditingCat.parentId || "" });
                    }
                }
                // Update category checkboxes in edit tag modal
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

        editingCategoryDocIdInput.value = docId;
        editingCategoryNameInput.value = currentName;

        populateParentCategoryButtons(editingCategoryParentButtons, selectedEditingParentCategoryIdInput, { currentCategoryIdToExclude: docId, selectedParentId: currentParentId });

        const isParentCategory = !currentParentId;
        if (editCategoryTagsGroup) editCategoryTagsGroup.style.display = isParentCategory ? 'none' : 'block';
        if (tagSearchModeGroup) tagSearchModeGroup.style.display = isParentCategory ? 'none' : 'block';

        if (!isParentCategory) {
            populateTagsForCategoryEdit(editingCategoryTagsSelector, docId);
            if(editingTagSearchModeSelect) editingTagSearchModeSelect.value = currentTagSearchMode;
        } else {
             if(editingCategoryTagsSelector) editingCategoryTagsSelector.innerHTML = '';
        }

        editCategoryModal.style.display = 'flex';
        editingCategoryNameInput.focus();
    }

    function populateTagsForCategoryEdit(containerElement, categoryId) {
        if (!containerElement) return;
        containerElement.innerHTML = '';
        if (allTagsCache.length === 0) {
            containerElement.innerHTML = '<p>利用可能なタグがありません。</p>';
            return;
        }

        // Display all tags, and mark as active if they are associated with THIS category
        allTagsCache.forEach(tag => {
            const button = document.createElement('div');
            button.classList.add('tag-filter', 'admin-tag-select');
            button.textContent = tag.name;
            button.dataset.tagId = tag.id;
            // A tag is active if its categoryIds array includes the current categoryId
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
            const selectedTagIdsForThisCategory = Array.from(editingCategoryTagsSelector.querySelectorAll('.tag-filter.active'))
                                         .map(btn => btn.dataset.tagId);

            if (!newName) { alert("カテゴリ名は空にできません。"); return; }
            if (docId === newParentId) { alert("自身を親カテゴリに設定することはできません。"); return; }

            // Check for name conflict (only if name or parentId changed to avoid self-conflict on no-name-change)
            const originalCategory = allCategoriesCache.find(c => c.id === docId);
            if (originalCategory && (originalCategory.name !== newName || originalCategory.parentId !== (newParentId || ""))) {
                const q = query(collection(db, 'categories'), where('name', '==', newName), where('parentId', '==', newParentId || ""));
                const existingQuery = await getDocs(q);
                let conflict = false;
                existingQuery.forEach(docSnap => { if (docSnap.id !== docId) conflict = true; });
                if (conflict) {
                    alert(newParentId ? "同じ親カテゴリ内に同じ名前の子カテゴリが既に存在します。" : "同じ名前の親カテゴリが既に存在します。");
                    return;
                }
            }

            // Circular dependency check
            if (newParentId) { // Only if trying to set a parent
                let currentAncestorId = newParentId;
                const visited = new Set([docId]); // Start with the category being edited
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

                const isBecomingChild = !!newParentId; // True if newParentId is not empty

                if (isBecomingChild) {
                    categoryUpdateData.tagSearchMode = newTagSearchMode;
                } else { // Is becoming a parent category
                    categoryUpdateData.tagSearchMode = deleteField(); // Remove search mode if it's a parent
                }
                batch.update(doc(db, 'categories', docId), categoryUpdateData);

                // Update tags:
                // For all tags, check if their association with this category needs to change.
                allTagsCache.forEach(tag => {
                    const isCurrentlySelectedForCat = selectedTagIdsForThisCategory.includes(tag.id);
                    const isAlreadyAssociatedWithCat = tag.categoryIds && tag.categoryIds.includes(docId);

                    if (isBecomingChild) { // Only associate tags if it's a child category
                        if (isCurrentlySelectedForCat && !isAlreadyAssociatedWithCat) {
                            // Add this category to the tag's list
                            batch.update(doc(db, 'tags', tag.id), { categoryIds: arrayUnion(docId) });
                        } else if (!isCurrentlySelectedForCat && isAlreadyAssociatedWithCat) {
                            // Remove this category from the tag's list
                            batch.update(doc(db, 'tags', tag.id), { categoryIds: arrayRemove(docId) });
                        }
                    } else { // If becoming a parent, remove all tag associations from this category
                        if (isAlreadyAssociatedWithCat) {
                             batch.update(doc(db, 'tags', tag.id), { categoryIds: arrayRemove(docId) });
                        }
                    }
                });


                await batch.commit();
                editCategoryModal.style.display = 'none';
                // Full reload to ensure all caches and UI are consistent
                await loadInitialData();

            } catch (error) {
                console.error("[Category Edit] Error:", error);
                alert("カテゴリの更新または関連タグの更新に失敗しました。");
            }
        });
    }

    async function deleteCategory(docId, categoryName) {
        const childCheckQuery = query(collection(db, 'categories'), where('parentId', '==', docId));
        const childSnapshot = await getDocs(childCheckQuery);
        if (!childSnapshot.empty) {
            alert(`カテゴリ「${categoryName}」は他のカテゴリの親として使用されているため削除できません。\nまず子カテゴリの親設定を変更または子カテゴリを削除してください。`);
            return;
        }

        if (confirm(`カテゴリ「${categoryName}」を削除しますか？\nこのカテゴリに紐づいているタグの関連付けも解除されます。`)) {
            try {
                const batch = writeBatch(db);
                // Remove this categoryId from all tags that might reference it
                const tagsToUpdateQuery = query(collection(db, 'tags'), where('categoryIds', 'array-contains', docId));
                const tagsSnapshot = await getDocs(tagsToUpdateQuery);
                tagsSnapshot.forEach(tagDoc => {
                    batch.update(tagDoc.ref, { categoryIds: arrayRemove(docId) });
                });

                batch.delete(doc(db, 'categories', docId)); // Delete the category itself

                await batch.commit();
                await loadInitialData(); // Reload all data and refresh UI
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
            console.log("[Tags] All tags loaded:", allTagsCache.length, allTagsCache);
        } catch (error) {
            console.error("[Tags] Error loading tags:", error);
            allTagsCache = [];
        }
    }

    function populateCategoryCheckboxesForTagAssignment(containerElement, selectedCategoryIds = []) {
        if (!containerElement) return;
        containerElement.innerHTML = '';

        // Only child categories can have tags assigned to them directly via this UI
        const assignableCategories = allCategoriesCache.filter(cat => cat.parentId && cat.parentId !== "");

        if (assignableCategories.length === 0) {
            containerElement.innerHTML = '<p>タグを割り当て可能な子カテゴリが登録されていません。</p>';
            return;
        }

        assignableCategories.forEach(category => {
            const checkboxId = `tag-cat-${category.id}-${containerElement.id.replace(/\W/g, '')}`; // Unique ID
            const checkboxWrapper = document.createElement('div');
            checkboxWrapper.classList.add('checkbox-item');
            let labelText = category.name;
            const parentCat = allCategoriesCache.find(p => p.id === category.parentId);
            if (parentCat) {
                labelText += ` (親: ${parentCat.name})`;
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
        if (allTagsCache.length === 0) {
            tagListContainer.innerHTML = '<p>タグが登録されていません。</p>';
            return;
        }
        allTagsCache.forEach(tag => {
            const belongingCategoriesNames = (tag.categoryIds || [])
                .map(catId => {
                    const cat = allCategoriesCache.find(c => c.id === catId);
                    // Only show if it's a child category for clarity
                    if (cat && cat.parentId) {
                        let name = cat.name;
                        const parentCat = allCategoriesCache.find(p => p.id === cat.parentId);
                        name += parentCat ? ` (親:${parentCat.name})` : ` (親:不明)`;
                        return name;
                    }
                    return null; // Don't list if it's a parent category association (shouldn't happen via UI)
                })
                .filter(name => name) // Remove nulls
                .join(', ');
            const displayCategories = belongingCategoriesNames || '未分類 (どの特定の子カテゴリにも属していません)';


            const div = document.createElement('div');
            div.classList.add('list-item');
            div.innerHTML = `
                <span>${tag.name} (所属: ${displayCategories})</span>
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
                if (tagToEdit) {
                    openEditTagModal(tagId, tagToEdit.name, tagToEdit.categoryIds || []);
                } else {
                    alert("編集するタグのデータが見つかりません。");
                }
            });
        });
        tagListContainer.querySelectorAll('.delete-tag').forEach(btn => {
            btn.addEventListener('click', (e) => {
                 deleteTag(e.currentTarget.dataset.tagId, e.currentTarget.dataset.tagName);
            });
        });
    }

    if (addTagButton) {
        addTagButton.addEventListener('click', async () => {
            const name = newTagNameInput.value.trim();
            const selectedCategoryIdsForTag = Array.from(newTagCategoriesCheckboxes.querySelectorAll('input[type="checkbox"][name="tagCategory"]:checked'))
                                            .map(cb => cb.value);

            if (!name) { alert("タグ名を入力してください。"); return; }

            const q = query(collection(db, 'tags'), where('name', '==', name));
            const existingQuery = await getDocs(q);
            if (!existingQuery.empty) { alert("同じ名前のタグが既に存在します。"); return; }

            try {
                await addDoc(collection(db, 'tags'), {
                    name: name,
                    categoryIds: selectedCategoryIdsForTag, // Store array of child category IDs
                    createdAt: serverTimestamp()
                });
                newTagNameInput.value = '';
                newTagCategoriesCheckboxes.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);

                await loadTagsFromFirestore();
                renderTagsForManagement();
                populateTagCheckboxesForItemForm(); // Update item form's tag selector
                // Also, if category edit modal is open, its tag list might need refresh if relevant
                if (editCategoryModal.style.display === 'flex' && editingCategoryDocIdInput.value) {
                    populateTagsForCategoryEdit(editingCategoryTagsSelector, editingCategoryDocIdInput.value);
                }

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
            const newSelectedCategoryIdsForTag = Array.from(editingTagCategoriesCheckboxes.querySelectorAll('input[type="checkbox"][name="tagCategory"]:checked'))
                                                .map(cb => cb.value);

            if (!newName) { alert("タグ名は空にできません。"); return; }

            // Check for name conflict (only if name changed)
            const originalTag = allTagsCache.find(t => t.id === docId);
            if (originalTag && originalTag.name !== newName) {
                const q = query(collection(db, 'tags'), where('name', '==', newName));
                const existingQuery = await getDocs(q);
                let conflict = false;
                existingQuery.forEach(docSnap => { if (docSnap.id !== docId) conflict = true; });
                if (conflict) { alert("編集後の名前が、他の既存タグと重複します。"); return; }
            }


            try {
                await updateDoc(doc(db, 'tags', docId), {
                    name: newName,
                    categoryIds: newSelectedCategoryIdsForTag,
                    updatedAt: serverTimestamp()
                });
                editTagModal.style.display = 'none';
                await loadTagsFromFirestore();
                renderTagsForManagement();
                populateTagCheckboxesForItemForm();
                // If category edit modal is open and this tag was listed, refresh its state
                if (editCategoryModal.style.display === 'flex' && editingCategoryDocIdInput.value) {
                     populateTagsForCategoryEdit(editingCategoryTagsSelector, editingCategoryDocIdInput.value);
                }
                await loadItemsFromFirestore(); // Item display might use tag names
                renderItemsAdminTable();

            } catch (error) {
                console.error("[Tag Edit] Error:", error);
                alert("タグの更新に失敗しました。");
            }
        });
    }

    async function deleteTag(docId, tagName) {
        if (confirm(`タグ「${tagName}」を削除しますか？\nこのタグを使用している全てのアイテムからも自動的に解除されます。\nまた、このタグを参照しているカテゴリの関連付けも解除されます。`)) {
            try {
                const batch = writeBatch(db);

                // Remove tag from items
                const itemsToUpdateQuery = query(collection(db, 'items'), where('tags', 'array-contains', docId));
                const itemsSnapshot = await getDocs(itemsToUpdateQuery);
                itemsSnapshot.forEach(itemDoc => {
                    batch.update(itemDoc.ref, { tags: arrayRemove(docId) });
                });

                // Remove this tag from any category's categoryIds list (if it's somehow there, though UI focuses on child cats for tags)
                // This is more of a cleanup for direct associations if they were ever made.
                // The primary link is tag.categoryIds -> category.
                // If a category was associated with this tag (via its own UI to pick tags), that's handled by tag.categoryIds.
                // This loop is for safety, if a category had a direct `tags: [tagId]` field (which is not the current model).
                // The current model is `tag.categoryIds = [childCategoryId]`.
                // And `category.tagSearchMode` with tags selected in `editingCategoryTagsSelector`.
                // When a category is edited, `saveCategoryEditButton` handles updating tag.categoryIds.
                // So, when deleting a tag, we primarily need to ensure items are cleaned up.
                // Categories that *used* to list this tag (in their `editingCategoryTagsSelector`) will simply no longer see it.

                batch.delete(doc(db, 'tags', docId)); // Delete the tag itself

                await batch.commit();
                await loadInitialData(); // Reload all

            } catch (error) {
                console.error("[Tag Delete] Error:", error);
                alert("タグの削除または関連エンティティの更新に失敗しました。");
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

    function populateEffectTypeSelect() {
        if (!effectTypeSelect) return;
        const currentVal = effectTypeSelect.value; // Preserve selection if possible
        effectTypeSelect.innerHTML = '<option value="">効果種類を選択...</option>';
        effectTypesCache.forEach(et => {
            effectTypeSelect.add(new Option(et.name, et.id));
        });
        if (currentVal && effectTypeSelect.querySelector(`option[value="${currentVal}"]`)) {
            effectTypeSelect.value = currentVal;
        }
        // Trigger change to update unit display if a value was restored
        if (effectTypeSelect.value) {
            effectTypeSelect.dispatchEvent(new Event('change'));
        } else {
            if (effectUnitDisplay) effectUnitDisplay.textContent = ''; // Clear if no selection
        }
    }

    if (effectTypeSelect) { // For item effect input
        effectTypeSelect.addEventListener('change', () => {
            const selectedTypeId = effectTypeSelect.value;
            const selectedEffectType = effectTypesCache.find(et => et.id === selectedTypeId);
            if (effectUnitDisplay) {
                 if (selectedEffectType && selectedEffectType.defaultUnit && selectedEffectType.defaultUnit !== 'none') {
                     effectUnitDisplay.textContent = `(${selectedEffectType.defaultUnit})`;
                 } else {
                     effectUnitDisplay.textContent = ''; // Clear if no unit or "none"
                 }
            }
        });
    }

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
            const unitText = effect.unit && effect.unit !== 'none' ? `(${effect.unit})` : '';

            const div = document.createElement('div');
            div.classList.add('effect-list-item');
            div.innerHTML = `
                <span>${typeName}: ${effect.value}${unitText}</span>
                <button type="button" class="delete-effect-from-list action-button delete" data-index="${index}" title="この効果を削除">×</button>
            `;
            currentEffectsList.appendChild(div);
        });
        currentEffectsList.querySelectorAll('.delete-effect-from-list').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const indexToRemove = parseInt(e.currentTarget.dataset.index, 10);
                currentItemEffects.splice(indexToRemove, 1);
                renderCurrentItemEffectsList(); // Re-render the list of current effects
            });
        });
    }

    if (addEffectToListButton) {
        addEffectToListButton.addEventListener('click', () => {
            const typeId = effectTypeSelect.value;
            const valueStr = effectValueInput.value;

            if (!typeId) { alert("効果種類を選択してください。"); return; }
            if (valueStr.trim() === '' || isNaN(parseFloat(valueStr))) {
                alert("効果の値を数値で入力してください。"); return;
            }
            const value = parseFloat(valueStr);

            const selectedEffectType = effectTypesCache.find(et => et.id === typeId);
            // Use the defaultUnit from the selected effect type
            const unit = selectedEffectType ? (selectedEffectType.defaultUnit || 'point') : 'point';

            currentItemEffects.push({ type: typeId, value: value, unit: unit });
            renderCurrentItemEffectsList();

            // Reset input fields for next effect
            effectTypeSelect.value = '';
            effectValueInput.value = '';
            if(effectUnitDisplay) effectUnitDisplay.textContent = ''; // Clear unit display
        });
    }

    async function loadItemsFromFirestore() {
        console.log("[Items] Loading items from Firestore...");
        try {
            const q = query(collection(db, 'items'), orderBy('name'));
            const snapshot = await getDocs(q);
            itemsCache = snapshot.docs.map(docSnap => ({ docId: docSnap.id, ...docSnap.data() }));
            console.log("[Items] Items loaded successfully:", itemsCache.length, itemsCache);
        } catch (error) {
            console.error("[Items] Error loading items from Firestore:", error);
            itemsCache = [];
        }
    }

    if (itemForm) {
        itemForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = itemNameInput.value.trim();
            const source = itemSourceInput.value.trim();
            const selectedItemTagIds = Array.from(itemTagsSelectorCheckboxes.querySelectorAll('input[type="checkbox"][name="itemTag"]:checked'))
                                            .map(cb => cb.value);
            const editingDocId = itemIdToEditInput.value;
            let finalImageUrl = itemImageUrlInput.value; // Use existing URL by default

            saveItemButton.disabled = true; saveItemButton.textContent = "保存中...";
            try {
                if (selectedImageFile) { // If a new file was selected
                    const uploadedUrl = await uploadImageToWorkerAndGetURL(selectedImageFile);
                    if (uploadedUrl) {
                        finalImageUrl = uploadedUrl;
                    } else { // Upload failed, but a file was selected
                        alert("画像アップロードに失敗しましたが、他の情報は保存を試みます。画像は後で更新してください。");
                        // Optionally, prevent save:
                        // saveItemButton.disabled = false; saveItemButton.textContent = editingDocId ? "アイテム更新" : "アイテム保存";
                        // return;
                    }
                }

                const itemData = {
                    name: name || "", // Ensure empty string if blank
                    image: finalImageUrl || "", // Ensure empty string
                    structured_effects: currentItemEffects, // Already an array of objects
                    入手手段: source || "",
                    tags: selectedItemTagIds, // Array of tag IDs
                    updatedAt: serverTimestamp()
                };

                if (editingDocId) {
                    await updateDoc(doc(db, 'items', editingDocId), itemData);
                } else {
                    itemData.createdAt = serverTimestamp();
                    await addDoc(collection(db, 'items'), itemData);
                }
                await loadItemsFromFirestore(); // Reload items
                renderItemsAdminTable();    // Re-render table
                clearItemForm();            // Clear form for next entry
            } catch (error) {
                console.error("[Item Save] Error:", error);
                alert(`アイテム保存エラー: ${error.message}`);
            } finally {
                saveItemButton.disabled = false;
                saveItemButton.textContent = itemIdToEditInput.value ? "アイテム更新" : "アイテム保存"; // Reset button text based on mode
            }
        });
    }

    if (clearFormButton) clearFormButton.addEventListener('click', clearItemForm);

    function clearItemForm() {
        if (itemForm) itemForm.reset(); // Resets basic form inputs
        itemIdToEditInput.value = ''; // Clear hidden ID
        itemImageUrlInput.value = ''; // Clear hidden image URL
        if (itemImagePreview) { itemImagePreview.src = '#'; itemImagePreview.style.display = 'none'; }
        if (itemImageFileInput) itemImageFileInput.value = null; // Clear file input
        selectedImageFile = null; // Clear stored file object
        uploadProgressContainer.style.display = 'none';
        uploadProgress.value = 0;
        uploadProgressText.textContent = '';

        populateTagCheckboxesForItemForm(); // Reset tag checkboxes (no selection)

        currentItemEffects = []; // Clear effects array
        renderCurrentItemEffectsList(); // Update effects display
        if(effectTypeSelect) effectTypeSelect.value = ''; // Reset effect type dropdown
        if(effectValueInput) effectValueInput.value = ''; // Clear effect value input
        if(effectUnitDisplay) effectUnitDisplay.textContent = ''; // Clear unit display

        if (saveItemButton) saveItemButton.textContent = "アイテム保存"; // Reset button text
        itemNameInput.focus(); // Focus on name for new entry
    }

    function renderItemsAdminTable() {
        if (!itemsTableBody || !effectTypesCache) {
            console.warn("Items table body or effect types cache not available for rendering.");
            return;
        }
        itemsTableBody.innerHTML = '';
        const searchTerm = itemSearchAdminInput ? itemSearchAdminInput.value.toLowerCase() : "";
        const filteredItems = itemsCache.filter(item =>
            (item.name && item.name.toLowerCase().includes(searchTerm)) ||
            (!searchTerm && (item.name === "" || !item.name)) // Show unnamed if search is empty
        );

        if (filteredItems.length === 0) {
            const tr = itemsTableBody.insertRow();
            const td = tr.insertCell();
            td.colSpan = 5; // Number of columns in the table
            td.textContent = searchTerm ? '検索条件に一致するアイテムはありません。' : 'アイテムが登録されていません。';
            td.style.textAlign = 'center';
            return;
        }

        filteredItems.forEach(item => {
            const tr = document.createElement('tr');
            const imageDisplayPath = item.image || '../images/placeholder_item.png'; // Fallback image
            const itemTagsString = (item.tags || [])
                .map(tagId => allTagsCache.find(t => t.id === tagId)?.name)
                .filter(name => name) // Filter out undefined if tag not found
                .join(', ') || 'なし';

            let effectsDisplay = '(未設定)';
            if (item.structured_effects && item.structured_effects.length > 0) {
                 effectsDisplay = item.structured_effects.map(eff => {
                     const typeInfo = effectTypesCache.find(et => et.id === eff.type);
                     const typeName = typeInfo ? typeInfo.name : `不明(${eff.type})`;
                     const unit = (eff.unit && eff.unit !== 'none') ? eff.unit : '';
                     return `${typeName}: ${eff.value}${unit}`;
                 }).join('; ');
                 if (effectsDisplay.length > 50) effectsDisplay = effectsDisplay.substring(0, 47) + '...'; // Truncate if too long
            }

            const nameDisplay = item.name || '(名称未設定)';
            tr.innerHTML = `
                <td><img src="${imageDisplayPath}" alt="${nameDisplay}" onerror="this.onerror=null; this.src='../images/placeholder_item.png';"></td>
                <td>${nameDisplay}</td><td>${effectsDisplay}</td><td>${itemTagsString}</td>
                <td>
                    <button class="edit-item action-button" data-item-doc-id="${item.docId}" title="編集">✎</button>
                    <button class="delete-item action-button delete" data-item-doc-id="${item.docId}" data-item-name="${nameDisplay}" data-item-image="${item.image || ''}" title="削除">×</button>
                </td>`;
            tr.querySelector('.edit-item').addEventListener('click', () => loadItemForEdit(item.docId));
            tr.querySelector('.delete-item').addEventListener('click', (e) => {
                const button = e.currentTarget;
                deleteItem(button.dataset.itemDocId, button.dataset.itemName, button.dataset.itemImage);
            });
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
                itemSourceInput.value = itemData.入手手段 || "";
                itemImageUrlInput.value = itemData.image || ''; // Store current image URL
                if (itemData.image) {
                    itemImagePreview.src = itemData.image; itemImagePreview.style.display = 'block';
                } else {
                    itemImagePreview.src = '#'; itemImagePreview.style.display = 'none';
                }
                if (itemImageFileInput) itemImageFileInput.value = null; // Clear file input
                selectedImageFile = null; // Clear selected file object

                populateTagCheckboxesForItemForm(itemData.tags || []);

                currentItemEffects = itemData.structured_effects || [];
                renderCurrentItemEffectsList();
                // Reset effect input fields when loading an item for edit
                if(effectTypeSelect) effectTypeSelect.value = '';
                if(effectValueInput) effectValueInput.value = '';
                if(effectUnitDisplay) effectUnitDisplay.textContent = '';

                if (saveItemButton) saveItemButton.textContent = "アイテム更新";
                if (itemForm) itemForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
                itemNameInput.focus();
            } else { alert("編集対象のアイテムが見つかりませんでした。"); }
        } catch (error) { console.error("[Item Edit] Error loading:", error); alert("編集データの読み込み中にエラーが発生しました。"); }
    }

    async function deleteItem(docId, itemName, imageUrl) {
        if (confirm(`アイテム「${itemName}」を削除しますか？\n注意: Cloudflare R2上の関連画像は、この操作では削除されません。必要に応じて手動で削除してください。`)) {
            try {
                await deleteDoc(doc(db, 'items', docId));
                if (imageUrl) { // Log if there was an image for manual R2 cleanup
                    console.warn(`Image ${imageUrl} (associated with deleted item ${docId}) may need manual deletion from Cloudflare R2.`);
                }
                await loadItemsFromFirestore(); // Reload cache
                renderItemsAdminTable();    // Re-render table
                if (itemIdToEditInput.value === docId) { // If deleted item was being edited
                    clearItemForm();
                }
            } catch (error) {
                console.error(`[Item Delete] Error deleting item ${docId}:`, error);
                alert("アイテムの削除に失敗しました。");
            }
        }
    }

    // --- Image Upload ---
    if (itemImageFileInput) {
        itemImageFileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                // Basic validation (optional)
                if (file.size > 5 * 1024 * 1024) { // e.g., 5MB limit
                    alert("ファイルサイズが大きすぎます。5MB以下の画像を選択してください。");
                    itemImageFileInput.value = null; // Reset file input
                    return;
                }
                if (!file.type.startsWith('image/')) {
                    alert("画像ファイルを選択してください (例: JPG, PNG, GIF)。");
                    itemImageFileInput.value = null;
                    return;
                }

                selectedImageFile = file;
                const reader = new FileReader();
                reader.onload = (e) => {
                    itemImagePreview.src = e.target.result;
                    itemImagePreview.style.display = 'block';
                }
                reader.readAsDataURL(selectedImageFile);
                itemImageUrlInput.value = ''; // Clear any existing URL if new file is chosen
                uploadProgressContainer.style.display = 'none'; // Hide progress bar until upload starts
            } else { // No file selected (e.g., user cancelled)
                selectedImageFile = null;
            }
        });
    }
    async function uploadImageToWorkerAndGetURL(file) {
        if (!file) return null;
        uploadProgressContainer.style.display = 'block';
        uploadProgress.value = 0;
        uploadProgressText.textContent = 'アップロード準備中...';
        const formData = new FormData();
        formData.append('imageFile', file); // Key must match worker's expectation

        try {
            uploadProgressText.textContent = 'アップロード中... (0%)';
            let progress = 0;
            const interval = setInterval(() => { // Simple progress simulation
                progress += 10;
                if (progress <= 90) {
                    uploadProgress.value = progress;
                    uploadProgressText.textContent = `アップロード中... (${progress}%)`;
                } else {
                    clearInterval(interval);
                }
            }, 100);


            const response = await fetch(IMAGE_UPLOAD_WORKER_URL, { method: 'POST', body: formData });
            clearInterval(interval);
            uploadProgress.value = 100;


            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'サーバーからの不明なエラーレスポンス' }));
                console.error('[Image Upload] Upload failed with status:', response.status, errorData);
                alert(`画像のアップロードに失敗しました: ${errorData.error || response.statusText}`);
                uploadProgressText.textContent = 'アップロード失敗。';
                setTimeout(() => { uploadProgressContainer.style.display = 'none'; }, 3000);
                return null;
            }

            const result = await response.json();
            if (result.success && result.imageUrl) {
                uploadProgressText.textContent = 'アップロード完了!';
                setTimeout(() => { uploadProgressContainer.style.display = 'none'; }, 2000);
                return result.imageUrl;
            } else {
                console.error('[Image Upload] Upload response error:', result);
                alert(`画像のアップロードエラー: ${result.message || 'Workerからの予期せぬ応答'}`);
                uploadProgressText.textContent = 'アップロードエラー。';
                setTimeout(() => { uploadProgressContainer.style.display = 'none'; }, 3000);
                return null;
            }
        } catch (error) {
            if(typeof interval !== 'undefined') clearInterval(interval);
            console.error('[Image Upload] Error uploading image to worker:', error);
            alert(`画像のアップロード中に通信エラーが発生しました: ${error.message}`);
            uploadProgressText.textContent = '通信エラー。';
            setTimeout(() => { uploadProgressContainer.style.display = 'none'; }, 3000);
            return null;
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
