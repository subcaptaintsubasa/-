// admin.script.js (抜粋ではなく、必要な変更を加えた完全版の想定)
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

// --- 定数 ---
const DEFAULT_EFFECT_UNITS_LIST = ['ポイント', '%', '倍', '回', '秒', 'なし'];
const EFFECT_UNITS_LS_KEY = 'customEffectUnits';


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
    const newCategoryOrderInput = document.getElementById('newCategoryOrder');
    const newCategoryParentButtons = document.getElementById('newCategoryParentButtons');
    const selectedNewParentCategoryIdInput = document.getElementById('selectedNewParentCategoryId');
    const addCategoryButton = document.getElementById('addCategoryButton');
    const categoryListContainer = document.getElementById('categoryListContainer');
    const editCategoryModal = document.getElementById('editCategoryModal');
    const editingCategoryDocIdInput = document.getElementById('editingCategoryDocId');
    const editingCategoryNameInput = document.getElementById('editingCategoryName');
    const editingCategoryOrderInput = document.getElementById('editingCategoryOrder');
    const editingCategoryParentButtons = document.getElementById('editingCategoryParentButtons');
    const selectedEditingParentCategoryIdInput = document.getElementById('selectedEditingParentCategoryId');
    const editingCategoryTagsSelector = document.getElementById('editingCategoryTagsSelector');
    const tagSearchModeGroup = document.getElementById('tagSearchModeGroup');
    const editingTagSearchModeSelect = document.getElementById('editingTagSearchMode');
    const saveCategoryEditButton = document.getElementById('saveCategoryEditButton');
    const editCategoryTagsGroup = document.getElementById('editCategoryTagsGroup');

    // Tag Management
    const newTagNameInput = document.getElementById('newTagName');
    const newTagOrderInput = document.getElementById('newTagOrder');
    const newTagCategoriesCheckboxes = document.getElementById('newTagCategoriesCheckboxes');
    const addTagButton = document.getElementById('addTagButton');
    const tagListContainer = document.getElementById('tagListContainer');
    const editTagModal = document.getElementById('editTagModal');
    const editingTagDocIdInput = document.getElementById('editingTagDocId');
    const editingTagNameInput = document.getElementById('editingTagName');
    const editingTagOrderInput = document.getElementById('editingTagOrder');
    const editingTagCategoriesCheckboxes = document.getElementById('editingTagCategoriesCheckboxes');
    const saveTagEditButton = document.getElementById('saveTagEditButton');

    // Effect Type Management
    const newEffectTypeNameInput = document.getElementById('newEffectTypeName');
    const newEffectTypeOrderInput = document.getElementById('newEffectTypeOrder');
    const newEffectTypeUnitSelect = document.getElementById('newEffectTypeUnit');
    const editEffectUnitsButton = document.getElementById('editEffectUnitsButton');
    const newEffectTypeCalcMethodRadios = document.querySelectorAll('input[name="newCalcMethod"]');
    const addEffectTypeButton = document.getElementById('addEffectTypeButton');
    const effectTypeListContainer = document.getElementById('effectTypeListContainer');
    const editEffectTypeModal = document.getElementById('editEffectTypeModal');
    const editingEffectTypeDocIdInput = document.getElementById('editingEffectTypeDocId');
    const editingEffectTypeNameInput = document.getElementById('editingEffectTypeName');
    const editingEffectTypeOrderInput = document.getElementById('editingEffectTypeOrder');
    const editingEffectTypeUnitSelect = document.getElementById('editingEffectTypeUnit');
    const editingEffectTypeCalcMethodRadios = document.querySelectorAll('input[name="editCalcMethod"]');
    const saveEffectTypeEditButton = document.getElementById('saveEffectTypeEditButton');
    const effectTypeSelect = document.getElementById('effectTypeSelect'); // For item form

    // Effect Units Modal
    const editEffectUnitsModal = document.getElementById('editEffectUnitsModal');
    const newEffectUnitInput = document.getElementById('newEffectUnitInput');
    const addEffectUnitToListButton = document.getElementById('addEffectUnitToList');
    const currentEffectUnitsListContainer = document.getElementById('currentEffectUnitsList');
    const saveEffectUnitsButton = document.getElementById('saveEffectUnitsButton');


    // Item Management (existing elements)
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
    const effectUnitDisplay = document.getElementById('effectUnitDisplay');
    const addEffectToListButton = document.getElementById('addEffectToListButton');
    const currentEffectsList = document.getElementById('currentEffectsList');

    let allCategoriesCache = [];
    let allTagsCache = [];
    let itemsCache = [];
    let effectTypesCache = [];
    let currentItemEffects = [];
    let selectedImageFile = null;
    let currentCustomEffectUnits = [];

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
                    passwordError.textContent = `ログインエラー: ${error.message}`;
                });
        });
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            signOut(auth).catch(error => console.error("Logout error:", error));
        });
    }

    function clearAdminUI() {
        // Clear category form and list
        if (newCategoryNameInput) newCategoryNameInput.value = '';
        if (newCategoryOrderInput) newCategoryOrderInput.value = '';
        if (categoryListContainer) categoryListContainer.innerHTML = '';
        if (newCategoryParentButtons) newCategoryParentButtons.innerHTML = '';
        if (selectedNewParentCategoryIdInput) selectedNewParentCategoryIdInput.value = '';
        if (editingCategoryParentButtons) editingCategoryParentButtons.innerHTML = '';
        if (selectedEditingParentCategoryIdInput) selectedEditingParentCategoryIdInput.value = '';
        if (editingCategoryTagsSelector) editingCategoryTagsSelector.innerHTML = '';
        if (tagSearchModeGroup) tagSearchModeGroup.style.display = 'none';
        if (editingTagSearchModeSelect) editingTagSearchModeSelect.value = 'AND';
        if (editCategoryTagsGroup) editCategoryTagsGroup.style.display = 'block';

        // Clear tag form and list
        if (newTagNameInput) newTagNameInput.value = '';
        if (newTagOrderInput) newTagOrderInput.value = '';
        if (tagListContainer) tagListContainer.innerHTML = '';
        if (newTagCategoriesCheckboxes) newTagCategoriesCheckboxes.innerHTML = '';
        if (editingTagCategoriesCheckboxes) editingTagCategoriesCheckboxes.innerHTML = '';

        // Clear effect type form and list
        if (newEffectTypeNameInput) newEffectTypeNameInput.value = '';
        if (newEffectTypeOrderInput) newEffectTypeOrderInput.value = '';
        if (effectTypeListContainer) effectTypeListContainer.innerHTML = '';
        if (effectTypeSelect) effectTypeSelect.innerHTML = '<option value="">効果種類を選択...</option>';
        if (newEffectTypeUnitSelect) newEffectTypeUnitSelect.innerHTML = ''; // Will be populated
        if (editingEffectTypeUnitSelect) editingEffectTypeUnitSelect.innerHTML = ''; // Will be populated
        if (newEffectTypeCalcMethodRadios[0]) newEffectTypeCalcMethodRadios[0].checked = true;

        // Clear item form and list
        if (itemsTableBody) itemsTableBody.innerHTML = '';
        if (itemTagsSelectorCheckboxes) itemTagsSelectorCheckboxes.innerHTML = '';
        clearItemForm();
    }

    async function loadInitialData() {
        console.log("[Initial Load] Starting...");
        loadEffectUnitsFromStorage(); // Load custom units first
        populateEffectUnitSelects();  // Populate ALL unit dropdowns

        await loadEffectTypesFromFirestore();
        await loadCategoriesFromFirestore();
        await loadTagsFromFirestore();
        await loadItemsFromFirestore();

        populateParentCategoryButtons(newCategoryParentButtons, selectedNewParentCategoryIdInput);
        populateCategoryCheckboxesForTagAssignment(newTagCategoriesCheckboxes);
        populateTagCheckboxesForItemForm();
        populateEffectTypeSelectForItemForm(); // Item form's effect type dropdown

        renderCategoriesForManagement();
        renderTagsForManagement();
        renderEffectTypesForManagement();
        renderItemsAdminTable();
        console.log("[Initial Load] Completed.");
    }

    // --- Effect Unit Management (New) ---
    function loadEffectUnitsFromStorage() {
        const storedUnits = localStorage.getItem(EFFECT_UNITS_LS_KEY);
        if (storedUnits) {
            currentCustomEffectUnits = JSON.parse(storedUnits);
        } else {
            currentCustomEffectUnits = [...DEFAULT_EFFECT_UNITS_LIST];
        }
        console.log("Loaded effect units:", currentCustomEffectUnits);
    }

    function saveEffectUnitsToStorage() {
        localStorage.setItem(EFFECT_UNITS_LS_KEY, JSON.stringify(currentCustomEffectUnits));
        populateEffectUnitSelects(); // Update all relevant dropdowns
        console.log("Saved effect units to localStorage and updated dropdowns.");
    }

    function populateEffectUnitSelects() {
        const selectsToUpdate = [newEffectTypeUnitSelect, editingEffectTypeUnitSelect];
        selectsToUpdate.forEach(selectElement => {
            if (selectElement) {
                const currentValue = selectElement.value;
                selectElement.innerHTML = '';
                currentCustomEffectUnits.forEach(unit => {
                    const option = new Option(unit, unit);
                    selectElement.add(option);
                });
                // Restore previous selection if still valid
                if (currentCustomEffectUnits.includes(currentValue)) {
                    selectElement.value = currentValue;
                } else if (currentCustomEffectUnits.length > 0) {
                    selectElement.value = currentCustomEffectUnits[0]; // Default to first if old one gone
                }
            }
        });
    }

    function renderCurrentEffectUnitsList() {
        if (!currentEffectUnitsListContainer) return;
        currentEffectUnitsListContainer.innerHTML = '';
        if (currentCustomEffectUnits.length === 0) {
            currentEffectUnitsListContainer.innerHTML = '<p>単位が登録されていません。</p>';
            return;
        }
        currentCustomEffectUnits.forEach((unit, index) => {
            const div = document.createElement('div');
            div.classList.add('list-item');
            div.innerHTML = `
                <span>${unit}</span>
                <button type="button" class="delete-effect-unit action-button delete" data-index="${index}" title="削除">×</button>
            `;
            div.querySelector('.delete-effect-unit').addEventListener('click', (e) => {
                const idxToRemove = parseInt(e.currentTarget.dataset.index, 10);
                currentCustomEffectUnits.splice(idxToRemove, 1);
                renderCurrentEffectUnitsList(); // Re-render the list in modal
            });
            currentEffectUnitsListContainer.appendChild(div);
        });
    }

    if (editEffectUnitsButton) {
        editEffectUnitsButton.addEventListener('click', () => {
            loadEffectUnitsFromStorage(); // Ensure we have the latest from LS
            renderCurrentEffectUnitsList();
            if (editEffectUnitsModal) editEffectUnitsModal.style.display = 'flex';
        });
    }

    if (addEffectUnitToListButton) {
        addEffectUnitToListButton.addEventListener('click', () => {
            const newUnit = newEffectUnitInput.value.trim();
            if (newUnit && !currentCustomEffectUnits.includes(newUnit)) {
                currentCustomEffectUnits.push(newUnit);
                newEffectUnitInput.value = '';
                renderCurrentEffectUnitsList();
            } else if (currentCustomEffectUnits.includes(newUnit)) {
                alert("この単位は既に追加されています。");
            } else {
                alert("単位名を入力してください。");
            }
        });
    }

    if (saveEffectUnitsButton) {
        saveEffectUnitsButton.addEventListener('click', () => {
            saveEffectUnitsToStorage();
            if (editEffectUnitsModal) editEffectUnitsModal.style.display = 'none';
            alert("単位リストが保存されました。");
        });
    }


    // --- Effect Type Management (Modified for order and units) ---
    async function loadEffectTypesFromFirestore() {
        console.log("[Effect Types] Loading effect types...");
        try {
            const q = query(collection(db, 'effect_types'), orderBy('order', 'asc'), orderBy('name', 'asc'));
            const snapshot = await getDocs(q);
            effectTypesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
            const unitText = effectType.defaultUnit ? `(${effectType.defaultUnit})` : '(単位未設定)';
            const calcText = effectType.calculationMethod === 'max' ? '(最大値)' : '(加算)';
            const order = effectType.order !== undefined ? effectType.order : "-";

            const div = document.createElement('div');
            div.classList.add('list-item');
            // Added order input
            div.innerHTML = `
                <span>
                    <input type="number" class="order-input form-control-short" value="${order}" data-id="${effectType.id}" data-type="effect_type" title="表示順 (Enterで保存)" style="width: 60px; margin-right: 8px;">
                    ${effectType.name} ${unitText} ${calcText}
                </span>
                <div>
                    <button class="edit-effect-type action-button" data-id="${effectType.id}" title="編集">✎</button>
                    <button class="delete-effect-type action-button delete" data-id="${effectType.id}" data-name="${effectType.name}" title="削除">×</button>
                </div>
            `;
            effectTypeListContainer.appendChild(div);
        });
        // Add event listeners for order input changes (common function later)
        addOrderInputListeners(effectTypeListContainer);

        effectTypeListContainer.querySelectorAll('.edit-effect-type').forEach(btn => {
            btn.addEventListener('click', (e) => {
                 const effectTypeId = e.currentTarget.dataset.id;
                 const effectTypeData = effectTypesCache.find(et => et.id === effectTypeId);
                 if (effectTypeData) openEditEffectTypeModal(effectTypeData);
                 else console.error("Effect type data not found for id:", effectTypeId);
            });
        });
        effectTypeListContainer.querySelectorAll('.delete-effect-type').forEach(btn => {
             btn.addEventListener('click', (e) => deleteEffectType(e.currentTarget.dataset.id, e.currentTarget.dataset.name));
        });
    }

    if (addEffectTypeButton) {
        addEffectTypeButton.addEventListener('click', async () => {
            const name = newEffectTypeNameInput.value.trim();
            const order = parseInt(newEffectTypeOrderInput.value, 10) || (effectTypesCache.length > 0 ? Math.max(...effectTypesCache.map(et => et.order || 0)) + 10 : 10);
            const unit = newEffectTypeUnitSelect.value;
            const calcMethodRadio = Array.from(newEffectTypeCalcMethodRadios).find(r => r.checked);
            const calcMethod = calcMethodRadio ? calcMethodRadio.value : 'sum';

            if (!name) { alert("効果種類名を入力してください。"); return; }
            if (effectTypesCache.some(et => et.name.toLowerCase() === name.toLowerCase())) {
                alert("同じ名前の効果種類が既に存在します。"); return;
            }
            try {
                await addDoc(collection(db, 'effect_types'), {
                    name: name,
                    order: order,
                    defaultUnit: unit,
                    calculationMethod: calcMethod,
                    createdAt: serverTimestamp()
                });
                newEffectTypeNameInput.value = '';
                newEffectTypeOrderInput.value = '';
                // newEffectTypeUnitSelect.value = currentCustomEffectUnits[0] || ''; // Reset to first available unit
                if(newEffectTypeCalcMethodRadios[0]) newEffectTypeCalcMethodRadios[0].checked = true;

                await loadEffectTypesFromFirestore();
                renderEffectTypesForManagement();
                populateEffectTypeSelectForItemForm();
            } catch (error) {
                console.error("[Effect Types] Error adding:", error);
                alert("効果種類の追加に失敗しました。");
            }
        });
    }

    function openEditEffectTypeModal(effectTypeData) {
        editingEffectTypeDocIdInput.value = effectTypeData.id;
        editingEffectTypeNameInput.value = effectTypeData.name;
        editingEffectTypeOrderInput.value = effectTypeData.order || '';
        editingEffectTypeUnitSelect.value = effectTypeData.defaultUnit || (currentCustomEffectUnits[0] || '');

        const calcMethod = effectTypeData.calculationMethod || 'sum';
        const radioToCheck = Array.from(editingEffectTypeCalcMethodRadios).find(r => r.value === calcMethod);
        if (radioToCheck) radioToCheck.checked = true;
        else if (editingEffectTypeCalcMethodRadios[0]) editingEffectTypeCalcMethodRadios[0].checked = true;

        if (editEffectTypeModal) editEffectTypeModal.style.display = 'flex';
    }

    if (saveEffectTypeEditButton) {
        saveEffectTypeEditButton.addEventListener('click', async () => {
            const id = editingEffectTypeDocIdInput.value;
            const newName = editingEffectTypeNameInput.value.trim();
            const newOrder = parseInt(editingEffectTypeOrderInput.value, 10);
            const newUnit = editingEffectTypeUnitSelect.value;
            const editCalcMethodRadio = Array.from(editingEffectTypeCalcMethodRadios).find(r => r.checked);
            const newCalcMethod = editCalcMethodRadio ? editCalcMethodRadio.value : 'sum';

            if (!newName) { alert("効果種類名は空にできません。"); return; }
            if (isNaN(newOrder)) { alert("表示順は数値で入力してください。"); return; }
            if (effectTypesCache.some(et => et.id !== id && et.name.toLowerCase() === newName.toLowerCase())) {
                 alert("編集後の名前が他の効果種類と重複します。"); return;
            }
            try {
                await updateDoc(doc(db, 'effect_types', id), {
                    name: newName,
                    order: newOrder,
                    defaultUnit: newUnit,
                    calculationMethod: newCalcMethod
                 });
                if (editEffectTypeModal) editEffectTypeModal.style.display = 'none';
                await loadEffectTypesFromFirestore();
                renderEffectTypesForManagement();
                populateEffectTypeSelectForItemForm();
                await loadItemsFromFirestore(); // Effects in items might need re-rendering if names changed
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
                 populateEffectTypeSelectForItemForm();
                 await loadItemsFromFirestore();
                 renderItemsAdminTable();
             } catch (error) {
                  console.error("[Effect Types] Error deleting:", error);
                  alert("効果種類の削除に失敗しました。");
             }
         }
    }

    // --- Category Management (Modified for order and parent/child display) ---
    async function loadCategoriesFromFirestore() {
        console.log("[Categories] Loading all categories...");
        try {
            const q = query(collection(db, 'categories'), orderBy('order', 'asc'), orderBy('name', 'asc'));
            const snapshot = await getDocs(q);
            allCategoriesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("[Categories] All categories loaded:", allCategoriesCache);
        } catch (error) {
            console.error("[Categories] Error loading categories:", error);
            allCategoriesCache = [];
        }
    }

    function renderCategoriesForManagement() {
        if (!categoryListContainer) return;
        categoryListContainer.innerHTML = '';

        const parentCategories = allCategoriesCache
            .filter(c => !c.parentId)
            .sort((a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name));

        parentCategories.forEach(parent => {
            appendCategoryToList(parent, 0); // Level 0 for parents
            const children = allCategoriesCache
                .filter(c => c.parentId === parent.id)
                .sort((a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name));
            children.forEach(child => {
                appendCategoryToList(child, 1); // Level 1 for children
            });
        });
        addOrderInputListeners(categoryListContainer); // Add listeners for new order inputs
    }

    function appendCategoryToList(category, level) {
        const div = document.createElement('div');
        div.classList.add('list-item');
        if (level > 0) {
            div.style.marginLeft = `${level * 20}px`; // Indent children
        }
        let displayInfo = level === 0 ? "(親)" : "";
        let searchModeInfo = '';
        if (level > 0 && category.parentId) { // Is a child
             const parentCategory = allCategoriesCache.find(p => p.id === category.parentId);
             const parentName = parentCategory ? parentCategory.name : '不明';
             // displayInfo += ` (親: ${parentName})`; // Redundant if grouped under parent
             searchModeInfo = category.tagSearchMode === 'OR' ? ' (OR検索)' : ' (AND検索)';
        }
        const order = category.order !== undefined ? category.order : "-";

        div.innerHTML = `
            <span>
                <input type="number" class="order-input form-control-short" value="${order}" data-id="${category.id}" data-type="category" title="表示順 (Enterで保存)" style="width: 60px; margin-right: 8px;">
                ${category.name} ${displayInfo}${searchModeInfo}
            </span>
            <div>
                <button class="edit-category action-button" data-category-id="${category.id}" title="編集">✎</button>
                <button class="delete-category action-button delete" data-category-id="${category.id}" data-category-name="${category.name}" title="削除">×</button>
            </div>
        `;
        categoryListContainer.appendChild(div);

        div.querySelector('.edit-category').addEventListener('click', (e) => {
            const catToEdit = allCategoriesCache.find(c => c.id === e.currentTarget.dataset.categoryId);
            if (catToEdit) openEditCategoryModal(catToEdit);
        });
        div.querySelector('.delete-category').addEventListener('click', (e) => {
            deleteCategory(e.currentTarget.dataset.categoryId, e.currentTarget.dataset.categoryName);
        });
    }


    if (addCategoryButton) {
        addCategoryButton.addEventListener('click', async () => {
            const name = newCategoryNameInput.value.trim();
            const parentId = selectedNewParentCategoryIdInput.value;
            const order = parseInt(newCategoryOrderInput.value, 10) || (allCategoriesCache.length > 0 ? Math.max(...allCategoriesCache.map(c => c.order || 0)) + 10 : 10);

            if (!name) { alert("カテゴリ名を入力してください。"); return; }
            const q = query(collection(db, 'categories'), where('name', '==', name), where('parentId', '==', (parentId || ""))); // Check name uniqueness within same parent
            const existingQuery = await getDocs(q);
            if (!existingQuery.empty) { alert("同じ親カテゴリ内に同じ名前のカテゴリが既に存在します。"); return; }

            try {
                const categoryData = {
                    name: name,
                    parentId: parentId || "",
                    order: order,
                    createdAt: serverTimestamp()
                };
                if (parentId) categoryData.tagSearchMode = 'AND'; // Default for new child

                await addDoc(collection(db, 'categories'), categoryData);
                newCategoryNameInput.value = '';
                newCategoryOrderInput.value = '';
                // selectedNewParentCategoryIdInput.value = ''; // Keep parent selected for multiple adds?
                // newCategoryParentButtons.querySelectorAll('.active').forEach(b => b.classList.remove('active'));


                await loadCategoriesFromFirestore();
                populateParentCategoryButtons(newCategoryParentButtons, selectedNewParentCategoryIdInput, {selectedParentId: parentId}); // Repopulate with current selection
                populateCategoryCheckboxesForTagAssignment(newTagCategoriesCheckboxes);
                renderCategoriesForManagement();

                // Update modals if open
                if (editCategoryModal.style.display === 'flex' && editingCategoryDocIdInput.value) {
                    const cat = allCategoriesCache.find(c => c.id === editingCategoryDocIdInput.value);
                    if(cat) populateParentCategoryButtons(editingCategoryParentButtons, selectedEditingParentCategoryIdInput, { currentCategoryIdToExclude: cat.id, selectedParentId: cat.parentId || "" });
                }
                if (editTagModal.style.display === 'flex' && editingTagDocIdInput.value) {
                    const tag = allTagsCache.find(t => t.id === editingTagDocIdInput.value);
                    populateCategoryCheckboxesForTagAssignment(editingTagCategoriesCheckboxes, tag ? (tag.categoryIds || []) : []);
                }

            } catch (error) {
                console.error("[Category Add] Error:", error);
                alert("カテゴリの追加に失敗しました。");
            }
        });
    }

    function openEditCategoryModal(category) {
        editingCategoryDocIdInput.value = category.id;
        editingCategoryNameInput.value = category.name;
        editingCategoryOrderInput.value = category.order || '';
        const currentParentId = category.parentId || "";
        populateParentCategoryButtons(editingCategoryParentButtons, selectedEditingParentCategoryIdInput, { currentCategoryIdToExclude: category.id, selectedParentId: currentParentId });

        const isParentCategory = !currentParentId;
        if (editCategoryTagsGroup) editCategoryTagsGroup.style.display = isParentCategory ? 'none' : 'block';
        if (tagSearchModeGroup) tagSearchModeGroup.style.display = isParentCategory ? 'none' : 'block';

        if (!isParentCategory) {
            populateTagsForCategoryEdit(editingCategoryTagsSelector, category.id);
            if(editingTagSearchModeSelect) editingTagSearchModeSelect.value = category.tagSearchMode || 'AND';
        } else {
             if(editingCategoryTagsSelector) editingCategoryTagsSelector.innerHTML = '';
        }
        editCategoryModal.style.display = 'flex';
    }

    if (saveCategoryEditButton) {
        saveCategoryEditButton.addEventListener('click', async () => {
            const docId = editingCategoryDocIdInput.value;
            const newName = editingCategoryNameInput.value.trim();
            const newOrder = parseInt(editingCategoryOrderInput.value, 10);
            const newParentId = selectedEditingParentCategoryIdInput.value;
            const newTagSearchMode = editingTagSearchModeSelect.value;
            const selectedTagIds = Array.from(editingCategoryTagsSelector.querySelectorAll('.tag-filter.active'))
                                         .map(btn => btn.dataset.tagId);

            if (!newName) { alert("カテゴリ名は空にできません。"); return; }
            if (isNaN(newOrder)) { alert("表示順は数値で入力してください。"); return; }
            if (docId === newParentId) { alert("自身を親カテゴリに設定することはできません。"); return; }

            const q = query(collection(db, 'categories'), where('name', '==', newName), where('parentId', '==', (newParentId || "")));
            const existingQuery = await getDocs(q);
            if (existingQuery.docs.some(docSnap => docSnap.id !== docId)) {
                alert("編集後の名前が、同じ親カテゴリ内の他の既存カテゴリと重複します。"); return;
            }
            // Circular dependency check (simplified, assumes max 1 level nesting for now)
            if (newParentId) {
                const parentCand = allCategoriesCache.find(c => c.id === newParentId);
                if (parentCand && parentCand.parentId === docId) {
                    alert("循環参照です。この親カテゴリ設定はできません (例: 子を親の親にはできない)。"); return;
                }
            }

            try {
                const batch = writeBatch(db);
                const categoryUpdateData = {
                    name: newName,
                    order: newOrder,
                    parentId: newParentId || ""
                };

                const tagsBefore = allTagsCache.filter(tag => tag.categoryIds && tag.categoryIds.includes(docId)).map(t => t.id);
                const isChild = !!newParentId;

                if (isChild) {
                     categoryUpdateData.tagSearchMode = newTagSearchMode;
                     const tagsToAdd = selectedTagIds.filter(id => !tagsBefore.includes(id));
                     const tagsToRemove = tagsBefore.filter(id => !selectedTagIds.includes(id));
                     tagsToAdd.forEach(tagId => batch.update(doc(db, 'tags', tagId), { categoryIds: arrayUnion(docId) }));
                     tagsToRemove.forEach(tagId => batch.update(doc(db, 'tags', tagId), { categoryIds: arrayRemove(docId) }));
                } else { // Becoming a parent or staying a parent
                    categoryUpdateData.tagSearchMode = deleteField(); // Remove mode if it becomes a parent
                     // Remove this category from all tags previously associated if it's becoming a parent
                    tagsBefore.forEach(tagId => batch.update(doc(db, 'tags', tagId), { categoryIds: arrayRemove(docId) }));
                }

                batch.update(doc(db, 'categories', docId), categoryUpdateData);
                await batch.commit();
                editCategoryModal.style.display = 'none';
                await loadInitialData(); // Reload everything to reflect changes

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
            alert(`カテゴリ「${categoryName}」は他のカテゴリの親として使用されているため削除できません。\nまず子カテゴリの親設定を変更するか、子カテゴリを削除してください。`);
            return;
        }

        if (confirm(`カテゴリ「${categoryName}」を削除しますか？\nこのカテゴリを参照しているタグの関連付けも解除されます。`)) {
            try {
                const batch = writeBatch(db);
                // Remove this category from categoryIds array in all tags
                const tagsToUpdateQuery = query(collection(db, 'tags'), where('categoryIds', 'array-contains', docId));
                const tagsSnapshot = await getDocs(tagsToUpdateQuery);
                tagsSnapshot.forEach(tagDoc => {
                    batch.update(tagDoc.ref, { categoryIds: arrayRemove(docId) });
                });
                batch.delete(doc(db, 'categories', docId));
                await batch.commit();
                await loadInitialData();
            } catch (error) {
                console.error("[Category Delete] Error:", error);
                alert("カテゴリの削除に失敗しました。");
            }
        }
    }


    // --- Tag Management (Modified for order) ---
    async function loadTagsFromFirestore() {
        console.log("[Tags] Loading all tags...");
        try {
            const q = query(collection(db, 'tags'), orderBy('order', 'asc'), orderBy('name', 'asc'));
            const snapshot = await getDocs(q);
            allTagsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("[Tags] All tags loaded:", allTagsCache);
        } catch (error) {
            console.error("[Tags] Error loading tags:", error);
            allTagsCache = [];
        }
    }

    function renderTagsForManagement() {
        if (!tagListContainer) return;
        tagListContainer.innerHTML = '';
        allTagsCache.forEach(tag => {
            const belongingCategories = (tag.categoryIds || [])
                .map(catId => {
                    const cat = allCategoriesCache.find(c => c.id === catId);
                    if (!cat || !cat.parentId) return null; // Only show if child category
                    let name = cat.name;
                    const parentCat = allCategoriesCache.find(p => p.id === cat.parentId);
                    name += parentCat ? ` (親:${parentCat.name})` : ` (親:不明)`;
                    return name;
                })
                .filter(name => name)
                .join(', ') || '未分類';
            const order = tag.order !== undefined ? tag.order : "-";

            const div = document.createElement('div');
            div.classList.add('list-item');
            div.innerHTML = `
                <span>
                    <input type="number" class="order-input form-control-short" value="${order}" data-id="${tag.id}" data-type="tag" title="表示順 (Enterで保存)" style="width: 60px; margin-right: 8px;">
                    ${tag.name} (所属: ${belongingCategories})
                </span>
                <div>
                    <button class="edit-tag action-button" data-tag-id="${tag.id}" title="編集">✎</button>
                    <button class="delete-tag action-button delete" data-tag-id="${tag.id}" data-tag-name="${tag.name}" title="削除">×</button>
                </div>
            `;
            tagListContainer.appendChild(div);
        });
        addOrderInputListeners(tagListContainer);

        tagListContainer.querySelectorAll('.edit-tag').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tagId = e.currentTarget.dataset.tagId;
                const tagToEdit = allTagsCache.find(t => t.id === tagId);
                if (tagToEdit) openEditTagModal(tagId, tagToEdit.name, tagToEdit.order, tagToEdit.categoryIds || []);
                else console.error("Could not find tag data for ID:", tagId);
            });
        });
        tagListContainer.querySelectorAll('.delete-tag').forEach(btn => {
            btn.addEventListener('click', (e) => deleteTag(e.currentTarget.dataset.tagId, e.currentTarget.dataset.tagName));
        });
    }

    if (addTagButton) {
        addTagButton.addEventListener('click', async () => {
            const name = newTagNameInput.value.trim();
            const order = parseInt(newTagOrderInput.value, 10) || (allTagsCache.length > 0 ? Math.max(...allTagsCache.map(t => t.order || 0)) + 10 : 10);
            const selectedCategoryIds = Array.from(newTagCategoriesCheckboxes.querySelectorAll('input[type="checkbox"][name="tagCategory"]:checked'))
                                            .map(cb => cb.value);

            if (!name) { alert("タグ名を入力してください。"); return; }
            const q = query(collection(db, 'tags'), where('name', '==', name));
            const existingQuery = await getDocs(q);
            if (!existingQuery.empty) { alert("同じ名前のタグが既に存在します。"); return; }

            try {
                await addDoc(collection(db, 'tags'), {
                    name: name,
                    order: order,
                    categoryIds: selectedCategoryIds,
                    createdAt: serverTimestamp()
                });
                newTagNameInput.value = '';
                newTagOrderInput.value = '';
                newTagCategoriesCheckboxes.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);

                await loadTagsFromFirestore();
                renderTagsForManagement();
                populateTagCheckboxesForItemForm();
            } catch (error) {
                console.error("[Tag Add] Error:", error);
                alert("タグの追加に失敗しました。");
            }
        });
    }

    function openEditTagModal(docId, currentName, currentOrder, currentCategoryIds) {
        editingTagDocIdInput.value = docId;
        editingTagNameInput.value = currentName;
        editingTagOrderInput.value = currentOrder || '';
        populateCategoryCheckboxesForTagAssignment(editingTagCategoriesCheckboxes, currentCategoryIds);
        editTagModal.style.display = 'flex';
    }

    if (saveTagEditButton) {
        saveTagEditButton.addEventListener('click', async () => {
            const docId = editingTagDocIdInput.value;
            const newName = editingTagNameInput.value.trim();
            const newOrder = parseInt(editingTagOrderInput.value, 10);
            const newSelectedCategoryIds = Array.from(editingTagCategoriesCheckboxes.querySelectorAll('input[type="checkbox"][name="tagCategory"]:checked'))
                                                .map(cb => cb.value);

            if (!newName) { alert("タグ名は空にできません。"); return; }
            if (isNaN(newOrder)) { alert("表示順は数値で入力してください。"); return; }

            const q = query(collection(db, 'tags'), where('name', '==', newName));
            const existingQuery = await getDocs(q);
            if (existingQuery.docs.some(docSnap => docSnap.id !== docId)) {
                 alert("編集後の名前が、他の既存タグと重複します。"); return;
            }

            try {
                await updateDoc(doc(db, 'tags', docId), {
                    name: newName,
                    order: newOrder,
                    categoryIds: newSelectedCategoryIds
                });
                editTagModal.style.display = 'none';
                await loadTagsFromFirestore();
                renderTagsForManagement();
                populateTagCheckboxesForItemForm();
                await loadItemsFromFirestore(); // If tags changed, item display might be affected
                renderItemsAdminTable();
            } catch (error) {
                console.error("[Tag Edit] Error:", error);
                alert("タグの更新に失敗しました。");
            }
        });
    }

    async function deleteTag(docId, tagName) {
        if (confirm(`タグ「${tagName}」を削除しますか？\nこのタグを使用している全てのアイテムからも自動的に解除されます。`)) {
            try {
                await deleteDoc(doc(db, 'tags', docId));
                const itemsToUpdateQuery = query(collection(db, 'items'), where('tags', 'array-contains', docId));
                const itemsSnapshot = await getDocs(itemsToUpdateQuery);
                if (!itemsSnapshot.empty) {
                    const batch = writeBatch(db);
                    itemsSnapshot.forEach(itemDoc => {
                        batch.update(itemDoc.ref, { tags: arrayRemove(docId) });
                    });
                    await batch.commit();
                }
                await loadInitialData(); // Reload all data
            } catch (error) {
                console.error("[Tag Delete] Error:", error);
                alert("タグの削除または関連アイテムの更新に失敗しました。");
            }
        }
    }

    // --- Common function for order input listeners ---
    function addOrderInputListeners(container) {
        container.querySelectorAll('.order-input').forEach(input => {
            // Debounce or throttle might be good here for production
            input.addEventListener('change', async (e) => { // Or 'blur'
                const id = e.target.dataset.id;
                const type = e.target.dataset.type; // 'category', 'tag', 'effect_type'
                const newOrder = parseInt(e.target.value, 10);

                if (isNaN(newOrder)) {
                    alert("表示順は数値で入力してください。");
                    // Optionally, revert to old value from cache if change is invalid
                    const itemCache = type === 'category' ? allCategoriesCache : (type === 'tag' ? allTagsCache : effectTypesCache);
                    const item = itemCache.find(i => i.id === id);
                    e.target.value = item ? (item.order || '') : '';
                    return;
                }

                try {
                    let collectionName = '';
                    if (type === 'category') collectionName = 'categories';
                    else if (type === 'tag') collectionName = 'tags';
                    else if (type === 'effect_type') collectionName = 'effect_types';
                    else return;

                    await updateDoc(doc(db, collectionName, id), { order: newOrder });
                    console.log(`${type} ${id} order updated to ${newOrder}`);
                    // Re-fetch and re-render for that specific list, or full reload if easier
                    if (type === 'category') { await loadCategoriesFromFirestore(); renderCategoriesForManagement(); }
                    else if (type === 'tag') { await loadTagsFromFirestore(); renderTagsForManagement(); }
                    else if (type === 'effect_type') { await loadEffectTypesFromFirestore(); renderEffectTypesForManagement(); }

                } catch (error) {
                    console.error(`Error updating order for ${type} ${id}:`, error);
                    alert("表示順の更新に失敗しました。");
                }
            });
        });
    }


    // --- Item Management (largely unchanged, but ensure dropdowns are populated correctly) ---
    function populateTagCheckboxesForItemForm(selectedTagIds = []) {
        if (!itemTagsSelectorCheckboxes) return;
        itemTagsSelectorCheckboxes.innerHTML = '';
        if (allTagsCache.length === 0) {
            itemTagsSelectorCheckboxes.innerHTML = '<p>登録されているタグがありません。</p>';
            return;
        }
        // Sort tags by order, then name for consistent display
        const sortedTags = [...allTagsCache].sort((a,b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name));

        sortedTags.forEach(tag => {
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

    function populateEffectTypeSelectForItemForm() { // Renamed for clarity
        if (!effectTypeSelect) return; // This is the one in the item form
        const currentVal = effectTypeSelect.value;
        effectTypeSelect.innerHTML = '<option value="">効果種類を選択...</option>';
        // Sort effect types by order, then name
        const sortedEffectTypes = [...effectTypesCache].sort((a,b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name));

        sortedEffectTypes.forEach(et => {
            effectTypeSelect.add(new Option(et.name, et.id));
        });
        if (currentVal && effectTypeSelect.querySelector(`option[value="${currentVal}"]`)) {
            effectTypeSelect.value = currentVal;
        }
        if (effectUnitDisplay) effectUnitDisplay.textContent = ''; // Clear unit on initial population
    }

    if (effectTypeSelect) { // Item form's effect type dropdown
        effectTypeSelect.addEventListener('change', () => {
            const selectedTypeId = effectTypeSelect.value;
            const selectedEffectType = effectTypesCache.find(et => et.id === selectedTypeId);
            if (effectUnitDisplay) {
                 if (selectedEffectType && selectedEffectType.defaultUnit && selectedEffectType.defaultUnit !== 'none') {
                     effectUnitDisplay.textContent = `(${selectedEffectType.defaultUnit})`;
                 } else {
                     effectUnitDisplay.textContent = '';
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
            const unitText = (effect.unit && effect.unit !== 'none') ? `(${effect.unit})` : '';

            const div = document.createElement('div');
            div.classList.add('effect-list-item');
            div.innerHTML = `
                <span>${typeName}: ${effect.value}${unitText}</span>
                <button type="button" class="delete-effect-from-list action-button delete" data-index="${index}" title="削除">×</button>
            `;
            div.querySelector('.delete-effect-from-list').addEventListener('click', (e) => {
                const indexToRemove = parseInt(e.currentTarget.dataset.index, 10);
                currentItemEffects.splice(indexToRemove, 1);
                renderCurrentItemEffectsList();
            });
            currentEffectsList.appendChild(div);
        });
    }

    if (addEffectToListButton) {
        addEffectToListButton.addEventListener('click', () => {
            const typeId = effectTypeSelect.value;
            const valueStr = effectValueInput.value;

            if (!typeId) { alert("効果種類を選択してください。"); return; }
            if (valueStr === '' || isNaN(parseFloat(valueStr))) {
                alert("効果の値を数値で入力してください。"); return;
            }
            const value = parseFloat(valueStr);

            const selectedEffectType = effectTypesCache.find(et => et.id === typeId);
            const unit = selectedEffectType ? (selectedEffectType.defaultUnit || 'none') : 'none';

            currentItemEffects.push({ type: typeId, value: value, unit: unit });
            renderCurrentItemEffectsList();

            effectTypeSelect.value = '';
            effectValueInput.value = '';
            if(effectUnitDisplay) effectUnitDisplay.textContent = '';
        });
    }

    async function loadItemsFromFirestore() {
        console.log("[Items] Loading items from Firestore...");
        try {
            // No 'order' field for items in this design, sort by name
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
            const source = itemSourceInput.value.trim();
            const selectedItemTagIds = Array.from(itemTagsSelectorCheckboxes.querySelectorAll('input[type="checkbox"][name="itemTag"]:checked'))
                                            .map(cb => cb.value);
            const editingDocId = itemIdToEditInput.value;
            let imageUrl = itemImageUrlInput.value; // Existing URL if not uploading new file

            saveItemButton.disabled = true; saveItemButton.textContent = "保存中...";
            try {
                if (selectedImageFile) { // If a new file was selected
                    imageUrl = await uploadImageToWorkerAndGetURL(selectedImageFile);
                    if (imageUrl === null) { // Upload failed
                        saveItemButton.disabled = false; saveItemButton.textContent = editingDocId ? "アイテム更新" : "アイテム保存";
                        return;
                    }
                }
                const itemData = {
                    name: name || "", // Ensure name is not undefined
                    image: imageUrl || "", // Ensure image URL is not undefined
                    structured_effects: currentItemEffects,
                    入手手段: source || "",
                    tags: selectedItemTagIds,
                    updatedAt: serverTimestamp()
                };
                if (editingDocId) {
                    await updateDoc(doc(db, 'items', editingDocId), itemData);
                } else {
                    itemData.createdAt = serverTimestamp();
                    await addDoc(collection(db, 'items'), itemData);
                }
                await loadItemsFromFirestore();
                renderItemsAdminTable();
                clearItemForm();
            } catch (error) {
                console.error("[Item Save] Error:", error);
                alert(`アイテム保存エラー: ${error.message}`);
            } finally {
                saveItemButton.disabled = false;
                saveItemButton.textContent = itemIdToEditInput.value ? "アイテム更新" : "アイテム保存"; // Check itemIdToEdit again
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
        if (uploadProgressContainer) uploadProgressContainer.style.display = 'none';
        populateTagCheckboxesForItemForm(); // Clear and repopulate tags

        currentItemEffects = [];
        renderCurrentItemEffectsList();
        if(effectTypeSelect) {
            effectTypeSelect.value = ''; // Clear effect type selection
            if(effectUnitDisplay) effectUnitDisplay.textContent = ''; // Clear unit display
        }
        if(effectValueInput) effectValueInput.value = '';


        if (saveItemButton) saveItemButton.textContent = "アイテム保存";
    }

    function renderItemsAdminTable() {
        if (!itemsTableBody || !effectTypesCache) return;
        itemsTableBody.innerHTML = '';
        const searchTerm = itemSearchAdminInput ? itemSearchAdminInput.value.toLowerCase() : "";
        const filteredItems = itemsCache.filter(item =>
            (item.name && item.name.toLowerCase().includes(searchTerm)) ||
            (!searchTerm && (item.name === "" || !item.name)) // Show unnamed if search is empty
        );

        filteredItems.forEach(item => {
            const tr = document.createElement('tr');
            const imageDisplayPath = item.image || '../images/placeholder_item.png';
            const itemTagsString = (item.tags || [])
                .map(tagId => allTagsCache.find(t => t.id === tagId)?.name)
                .filter(name => name)
                .join(', ') || 'なし';

            let effectsDisplay = '(未設定)';
            if (item.structured_effects && item.structured_effects.length > 0) {
                 effectsDisplay = item.structured_effects.map(eff => {
                     const typeInfo = effectTypesCache.find(et => et.id === eff.type);
                     const typeName = typeInfo ? typeInfo.name : `不明(${eff.type})`;
                     const unit = (eff.unit && eff.unit !== 'none') ? eff.unit : '';
                     return `${typeName}: ${eff.value}${unit}`;
                 }).join('; ');
                 if (effectsDisplay.length > 50) effectsDisplay = effectsDisplay.substring(0, 50) + '...';
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
                itemImageUrlInput.value = itemData.image || '';
                if (itemData.image) {
                    itemImagePreview.src = itemData.image; itemImagePreview.style.display = 'block';
                } else {
                    itemImagePreview.src = '#'; itemImagePreview.style.display = 'none';
                }
                if (itemImageFileInput) itemImageFileInput.value = null; selectedImageFile = null;

                populateTagCheckboxesForItemForm(itemData.tags || []);

                currentItemEffects = itemData.structured_effects || [];
                renderCurrentItemEffectsList();
                if(effectTypeSelect) effectTypeSelect.value = ''; // Clear effect input area
                if(effectValueInput) effectValueInput.value = '';
                if(effectUnitDisplay) effectUnitDisplay.textContent = '';

                if (saveItemButton) saveItemButton.textContent = "アイテム更新";
                if (itemForm) itemForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else { alert("編集対象のアイテムが見つかりませんでした。"); }
        } catch (error) { console.error("[Item Edit] Error loading:", error); alert("編集データ読込エラー"); }
    }

    async function deleteItem(docId, itemName, imageUrl) {
        if (confirm(`アイテム「${itemName}」を削除しますか？\nCloudflare R2上の関連画像は手動での削除が必要です。`)) {
            try {
                await deleteDoc(doc(db, 'items', docId));
                if (imageUrl && imageUrl.includes('workers.dev')) { // Basic check if it's likely an R2 URL
                    console.warn(`Image ${imageUrl} (potentially R2) for item ${docId} needs manual deletion.`);
                }
                await loadItemsFromFirestore();
                renderItemsAdminTable();
                if (itemIdToEditInput.value === docId) clearItemForm(); // Clear form if deleted item was being edited
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
                itemImageUrlInput.value = ''; // Clear any existing URL if new file is chosen
                if(uploadProgressContainer) uploadProgressContainer.style.display = 'none';
            } else { // No file selected or selection cancelled
                itemImagePreview.src = '#';
                itemImagePreview.style.display = 'none';
                selectedImageFile = null;
                // Do not clear itemImageUrlInput.value here, user might want to keep existing URL
            }
        });
    }
    async function uploadImageToWorkerAndGetURL(file) {
        if (!file) return null;
        if(uploadProgressContainer) uploadProgressContainer.style.display = 'block';
        if(uploadProgress) uploadProgress.value = 0;
        if(uploadProgressText) uploadProgressText.textContent = 'アップロード準備中...';
        const formData = new FormData();
        formData.append('imageFile', file);
        try {
            if(uploadProgressText) uploadProgressText.textContent = 'アップロード中...';
            const response = await fetch(IMAGE_UPLOAD_WORKER_URL, { method: 'POST', body: formData });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'サーバーからの不明なエラー' }));
                console.error('[Image Upload] Upload failed with status:', response.status, errorData);
                alert(`画像のアップロードに失敗しました: ${errorData.error || response.statusText}`);
                if(uploadProgressContainer) uploadProgressContainer.style.display = 'none'; return null;
            }
            const result = await response.json();
            if (result.success && result.imageUrl) {
                if(uploadProgressText) uploadProgressText.textContent = 'アップロード完了!';
                setTimeout(() => { if(uploadProgressContainer) uploadProgressContainer.style.display = 'none'; }, 2000);
                return result.imageUrl;
            } else {
                console.error('[Image Upload] Upload response error:', result);
                alert(`画像のアップロードエラー: ${result.message || '不明な応答'}`);
                if(uploadProgressContainer) uploadProgressContainer.style.display = 'none'; return null;
            }
        } catch (error) {
            console.error('[Image Upload] Error uploading image to worker:', error);
            alert(`画像のアップロード中に通信エラー: ${error.message}`);
            if(uploadProgressContainer) uploadProgressContainer.style.display = 'none'; return null;
        }
    }

    // --- Modal common handlers ---
    document.querySelectorAll('.modal .close-button').forEach(btn => {
        btn.onclick = function() { btn.closest('.modal').style.display = "none"; }
    });
    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) event.target.style.display = "none";
    }

    // Helper: Populate parent category buttons (common for new and edit)
    function populateParentCategoryButtons(buttonContainer, hiddenInput, options = {}) {
        const { currentCategoryIdToExclude = null, selectedParentId = "" } = options;
        if (!buttonContainer || !hiddenInput) return;
        buttonContainer.innerHTML = '';

        const topLevelButton = document.createElement('div');
        topLevelButton.classList.add('category-select-button');
        topLevelButton.textContent = '最上位カテゴリとして設定'; // Changed text slightly
        topLevelButton.dataset.parentId = "";
        if (selectedParentId === "") topLevelButton.classList.add('active');
        topLevelButton.addEventListener('click', () => {
            selectParentCategoryButton(buttonContainer, hiddenInput, topLevelButton, "");
        });
        buttonContainer.appendChild(topLevelButton);

        allCategoriesCache
            .filter(cat => (!cat.parentId || cat.parentId === "") && cat.id !== currentCategoryIdToExclude)
            .sort((a,b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name)) // Sort by order then name
            .forEach(cat => {
                const button = document.createElement('div');
                button.classList.add('category-select-button');
                button.textContent = cat.name;
                button.dataset.parentId = cat.id;
                if (selectedParentId === cat.id) button.classList.add('active');
                button.addEventListener('click', () => {
                     selectParentCategoryButton(buttonContainer, hiddenInput, button, cat.id);
                });
                buttonContainer.appendChild(button);
            });
        hiddenInput.value = selectedParentId; // Set initial hidden input value
    }

    function selectParentCategoryButton(container, hiddenInput, clickedButton, parentId) {
        container.querySelectorAll('.category-select-button.active').forEach(activeBtn => {
            activeBtn.classList.remove('active');
        });
        clickedButton.classList.add('active');
        hiddenInput.value = parentId;

        // Show/hide tag selector and mode only in EDIT modal for CHILD categories
        if (container === editingCategoryParentButtons) {
             const isChild = (parentId !== "");
             if (tagSearchModeGroup) tagSearchModeGroup.style.display = isChild ? 'block' : 'none';
             if (editCategoryTagsGroup) editCategoryTagsGroup.style.display = isChild ? 'block' : 'none';
             if (isChild && editingTagSearchModeSelect) {
                // If category already exists, load its mode. Else, default to AND
                const editingCatId = editingCategoryDocIdInput.value;
                const catData = allCategoriesCache.find(c => c.id === editingCatId && c.parentId === parentId);
                editingTagSearchModeSelect.value = catData ? (catData.tagSearchMode || 'AND') : 'AND';
             }
        }
    }

    // Helper: Populate category checkboxes for tag assignment
    function populateCategoryCheckboxesForTagAssignment(containerElement, selectedCategoryIds = []) {
        if (!containerElement) return;
        containerElement.innerHTML = '';
        const assignableCategories = allCategoriesCache
            .filter(cat => cat.parentId && cat.parentId !== "") // Only child categories
            .sort((a,b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name)); // Sort

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
            if (parentCat) labelText += ` (親: ${parentCat.name})`;

            checkboxWrapper.innerHTML = `
                <input type="checkbox" id="${checkboxId}" name="tagCategory" value="${category.id}" ${selectedCategoryIds.includes(category.id) ? 'checked' : ''}>
                <label for="${checkboxId}">${labelText}</label>
            `;
            containerElement.appendChild(checkboxWrapper);
        });
    }
    // Helper for populating tags for category edit modal
    function populateTagsForCategoryEdit(containerElement, categoryId) {
        if (!containerElement) return;
        containerElement.innerHTML = '';
        if (allTagsCache.length === 0) {
            containerElement.innerHTML = '<p>タグがありません。</p>';
            return;
        }
        const sortedTags = [...allTagsCache].sort((a,b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name));

        sortedTags.forEach(tag => {
            const button = document.createElement('div');
            button.classList.add('tag-filter', 'admin-tag-select');
            button.textContent = tag.name;
            button.dataset.tagId = tag.id;
            if (tag.categoryIds && tag.categoryIds.includes(categoryId)) {
                button.classList.add('active');
            }
            button.addEventListener('click', () => button.classList.toggle('active'));
            containerElement.appendChild(button);
        });
    }
}); // End DOMContentLoaded
