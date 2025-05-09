// admin.script.js (SortableJS, 階層表示, 単位管理機能対応, 表示・追加不具合修正, 関数補完)
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

    // Effect Unit Management
    const newEffectUnitNameInput = document.getElementById('newEffectUnitName');
    const newEffectUnitValueInput = document.getElementById('newEffectUnitValue');
    const addEffectUnitButton = document.getElementById('addEffectUnitButton');
    const effectUnitListContainer = document.getElementById('effectUnitListContainer');

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
    const effectUnitDisplay = document.getElementById('effectUnitDisplay');
    const addEffectToListButton = document.getElementById('addEffectToListButton');
    const currentEffectsList = document.getElementById('currentEffectsList');


    let allCategoriesCache = [];
    let allTagsCache = [];
    let itemsCache = [];
    let effectTypesCache = [];
    let effectUnitsCache = [];
    let currentItemEffects = [];
    let selectedImageFile = null;

    // --- Authentication ---
    onAuthStateChanged(auth, (user) => {
        if (user) {
            passwordPrompt.style.display = 'none';
            adminContent.style.display = 'block';
            if (currentUserEmailSpan) currentUserEmailSpan.textContent = `ログイン中: ${user.email}`;
            loadInitialData().catch(err => { // loadInitialData can now throw, catch it here
                 console.error("Failed to load initial data from onAuthStateChanged:", err);
                 alert("データの初期化中に重大なエラーが発生しました。ページを再読み込みするか、コンソールを確認してください。");
            });
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
        if (categoryListContainer) categoryListContainer.innerHTML = '';
        if (newCategoryParentButtons) newCategoryParentButtons.innerHTML = '';
        if (selectedNewParentCategoryIdInput) selectedNewParentCategoryIdInput.value = '';
        if (editingCategoryParentButtons) editingCategoryParentButtons.innerHTML = '';
        if (selectedEditingParentCategoryIdInput) selectedEditingParentCategoryIdInput.value = '';
        if (editingCategoryTagsSelector) editingCategoryTagsSelector.innerHTML = '';
        if (tagSearchModeGroup) tagSearchModeGroup.style.display = 'none';
        if (editingTagSearchModeSelect) editingTagSearchModeSelect.value = 'AND';
        if (editCategoryTagsGroup) editCategoryTagsGroup.style.display = 'block';

        if (tagListContainer) tagListContainer.innerHTML = '';
        if (newTagCategoriesCheckboxes) newTagCategoriesCheckboxes.innerHTML = '';
        if (editingTagCategoriesCheckboxes) editingTagCategoriesCheckboxes.innerHTML = '';

        if (effectTypeListContainer) effectTypeListContainer.innerHTML = '';
        if (effectTypeSelect) effectTypeSelect.innerHTML = '<option value="">効果種類を選択...</option>';
        if (newEffectTypeNameInput) newEffectTypeNameInput.value = '';
        if (newEffectTypeUnitSelect) newEffectTypeUnitSelect.innerHTML = ''; // Will be populated
        if (editingEffectTypeUnitSelect) editingEffectTypeUnitSelect.innerHTML = ''; // Will be populated


        if (effectUnitListContainer) effectUnitListContainer.innerHTML = '';
        if (newEffectUnitNameInput) newEffectUnitNameInput.value = '';
        if (newEffectUnitValueInput) newEffectUnitValueInput.value = '';


        if (itemsTableBody) itemsTableBody.innerHTML = '';
        if (itemTagsSelectorCheckboxes) itemTagsSelectorCheckboxes.innerHTML = '';
        clearItemForm();
    }

    async function loadInitialData() {
        console.log("[Initial Load] Starting...");
        // Ensure all load functions are awaited and errors are caught
        try {
            await loadEffectUnitsFromFirestore();
            await loadEffectTypesFromFirestore();
            await loadCategoriesFromFirestore();
            await loadTagsFromFirestore();
            await loadItemsFromFirestore(); // This was missing previously, now added.

            populateAllUIElements();
            initializeAllSortableLists(); // Initialize after all lists are rendered
            console.log("[Initial Load] Completed.");
        } catch (error) {
             console.error("Error during initial data load or UI population:", error); // Log specific error
             // Re-throw or handle more gracefully if needed
             throw error; // Propagate error to be caught by caller if any
        }
    }

    function populateAllUIElements() {
        console.log("[Populate UI] Starting...");
        populateParentCategoryButtons(newCategoryParentButtons, selectedNewParentCategoryIdInput);
        populateCategoryCheckboxesForTagAssignment(newTagCategoriesCheckboxes); // For new tag form
        populateTagCheckboxesForItemForm(); // For item form
        populateEffectTypeSelect(); // For item form's effect type dropdown
        populateEffectUnitSelect(newEffectTypeUnitSelect); // For new effect type form's unit dropdown

        renderCategoriesForManagement();
        renderTagsForManagement();
        renderEffectTypesForManagement();
        renderEffectUnitsForManagement();
        renderItemsAdminTable();
        console.log("[Populate UI] Completed.");
    }


    // --- SortableJS Helper ---
    function initializeSortableList(listElement, collectionName, onUpdateCallback, additionalSortableOptions = {}) {
        if (!listElement || typeof Sortable === 'undefined') {
            // console.warn(`Sortable cannot be initialized for ${collectionName}. Element or SortableJS missing.`);
            return;
        }
        if (listElement.sortableInstance) {
            listElement.sortableInstance.destroy();
        }
        listElement.sortableInstance = new Sortable(listElement, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            handle: '.list-item',
            ...additionalSortableOptions,
            onEnd: async function (evt) {
                if (typeof evt.oldIndex !== 'number' || typeof evt.newIndex !== 'number') {
                    console.error("Sortable event oldIndex/newIndex is not a number.");
                    if (onUpdateCallback) await onUpdateCallback(true);
                    return;
                }

                const items = Array.from(listElement.children);
                const batch = writeBatch(db);
                let reorderSuccess = true;

                items.forEach((itemElement, index) => {
                    const docId = itemElement.dataset.docId;
                    if (docId) {
                        const docRef = doc(db, collectionName, docId);
                        batch.update(docRef, { order: index });
                    } else {
                        reorderSuccess = false;
                    }
                });

                if (!reorderSuccess) {
                    alert(`${collectionName}の並び替え中にエラーが発生しました。リスト要素にIDがありません。`);
                    if (onUpdateCallback) await onUpdateCallback(true);
                    return;
                }

                try {
                    await batch.commit();
                    console.log(`${collectionName} order updated successfully.`);
                    if (onUpdateCallback) await onUpdateCallback(); // Callback reloads and re-renders
                } catch (error) {
                    console.error(`Error updating ${collectionName} order:`, error);
                    alert(`${collectionName}の順序更新に失敗しました。`);
                    if (onUpdateCallback) await onUpdateCallback(true);
                }
            }
        });
    }

    function initializeAllSortableLists() {
        console.log("Initializing all sortable lists...");
        if (categoryListContainer) {
            initializeSortableList(categoryListContainer, 'categories', async (errorOccurred = false) => {
                await loadCategoriesFromFirestore();
                renderCategoriesForManagement();
                populateParentCategoryButtons(newCategoryParentButtons, selectedNewParentCategoryIdInput);
                if (editCategoryModal.style.display === 'flex' && editingCategoryDocIdInput.value) {
                    const cat = allCategoriesCache.find(c => c.id === editingCategoryDocIdInput.value);
                    if (cat) populateParentCategoryButtons(editingCategoryParentButtons, selectedEditingParentCategoryIdInput, { currentCategoryIdToExclude: cat.id, selectedParentId: cat.parentId || "" });
                }
            });
        }
        if (tagListContainer) {
            initializeSortableList(tagListContainer, 'tags', async (errorOccurred = false) => {
                await loadTagsFromFirestore();
                renderTagsForManagement();
                const currentItem = itemIdToEditInput.value ? itemsCache.find(i => i.docId === itemIdToEditInput.value) : null;
                populateTagCheckboxesForItemForm(currentItem?.tags || []);
            });
        }
        if (effectUnitListContainer) {
            initializeSortableList(effectUnitListContainer, 'effect_units', async (errorOccurred = false) => {
                await loadEffectUnitsFromFirestore();
                renderEffectUnitsForManagement();
                populateEffectUnitSelect(newEffectTypeUnitSelect); // Update new effect type form's unit select
                if (editEffectTypeModal.style.display === 'flex' && editingEffectTypeDocIdInput.value) {
                    const et = effectTypesCache.find(e => e.id === editingEffectTypeDocIdInput.value);
                    if (et) populateEffectUnitSelect(editingEffectTypeUnitSelect, et.defaultUnit);
                }
            });
        }
    }


    // --- Effect Unit Management ---
    async function loadEffectUnitsFromFirestore() {
        console.log("[Effect Units] Loading...");
        try {
            const q = query(collection(db, 'effect_units'), orderBy('order', 'asc'));
            const snapshot = await getDocs(q);
            effectUnitsCache = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
            console.log("[Effect Units] Loaded:", effectUnitsCache.length);
        } catch (error) {
            console.error("[Effect Units] Error loading:", error);
            effectUnitsCache = []; // Ensure it's an empty array on error
        }
    }

    function populateEffectUnitSelect(selectElement, selectedValue = null) {
        if (!selectElement) return;
        const currentValInSelect = selectElement.value;
        selectElement.innerHTML = '';
        if (effectUnitsCache.length === 0) {
            selectElement.add(new Option("単位未登録", ""));
            selectElement.disabled = true;
            return;
        }
        selectElement.disabled = false;
        effectUnitsCache.forEach(unit => {
            selectElement.add(new Option(unit.name, unit.value));
        });

        if (selectedValue && effectUnitsCache.some(u => u.value === selectedValue)) {
            selectElement.value = selectedValue;
        } else if (currentValInSelect && effectUnitsCache.some(u => u.value === currentValInSelect)) {
            selectElement.value = currentValInSelect;
        } else if (effectUnitsCache.length > 0) {
            selectElement.value = effectUnitsCache[0].value;
        }
    }

    function renderEffectUnitsForManagement() {
        if (!effectUnitListContainer) return;
        effectUnitListContainer.innerHTML = '';
        if (effectUnitsCache.length === 0) {
            effectUnitListContainer.innerHTML = '<p>登録されている単位はありません。</p>';
            return;
        }
        // Firestore already sorts by order due to query, but explicit sort ensures client-side consistency if needed
        const sortedUnits = [...effectUnitsCache].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));

        sortedUnits.forEach(unit => {
            const div = document.createElement('div');
            div.classList.add('list-item');
            div.dataset.docId = unit.id;
            div.innerHTML = `
                <span>${unit.name} (値: ${unit.value})</span>
                <div>
                    <!-- <button class="edit-effect-unit action-button" data-id="${unit.id}" title="編集">✎</button> -->
                    <button class="delete-effect-unit action-button delete" data-id="${unit.id}" data-name="${unit.name}" title="削除">×</button>
                </div>
            `;
            effectUnitListContainer.appendChild(div);
            // div.querySelector('.edit-effect-unit').addEventListener('click', () => openEditEffectUnitModal(unit)); // Placeholder
            div.querySelector('.delete-effect-unit').addEventListener('click', (e) => deleteEffectUnit(e.currentTarget.dataset.id, e.currentTarget.dataset.name));
        });
    }

    if (addEffectUnitButton) {
        addEffectUnitButton.addEventListener('click', async () => {
            const name = newEffectUnitNameInput.value.trim();
            const value = newEffectUnitValueInput.value.trim();
            if (!name || !value) { alert("単位名と値を入力してください。"); return; }
            if (effectUnitsCache.some(u => u.name.toLowerCase() === name.toLowerCase() || u.value.toLowerCase() === value.toLowerCase())) {
                alert("同じ名前または値の単位が既に存在します。"); return;
            }
            try {
                const newOrder = effectUnitsCache.length;
                await addDoc(collection(db, 'effect_units'), { name, value, order: newOrder, createdAt: serverTimestamp() });
                newEffectUnitNameInput.value = '';
                newEffectUnitValueInput.value = '';
                await loadEffectUnitsFromFirestore();
                renderEffectUnitsForManagement();
                populateEffectUnitSelect(newEffectTypeUnitSelect);
                if (editEffectTypeModal.style.display === 'flex') {
                     const et = effectTypesCache.find(e => e.id === editingEffectTypeDocIdInput.value);
                     if(et) populateEffectUnitSelect(editingEffectTypeUnitSelect, et.defaultUnit);
                }
            } catch (error) {
                console.error("Error adding effect unit:", error);
                alert("単位の追加に失敗しました。");
            }
        });
    }

    async function deleteEffectUnit(id, name) {
        const unitToDelete = effectUnitsCache.find(u => u.id === id);
        if (!unitToDelete) { console.error("Unit to delete not found in cache:", id); return; }

        const usedByEffectTypes = effectTypesCache.filter(et => et.defaultUnit === unitToDelete.value);
        if (usedByEffectTypes.length > 0) {
            alert(`単位「${name}」は効果種類 (${usedByEffectTypes.map(et=>et.name).join(', ')}) でデフォルト単位として使用されているため削除できません。`);
            return;
        }
        const itemsUsingUnit = itemsCache.filter(item => item.structured_effects && item.structured_effects.some(eff => eff.unit === unitToDelete.value));
        if (itemsUsingUnit.length > 0) {
             alert(`単位「${name}」は${itemsUsingUnit.length}個のアイテムの効果で直接使用されています。`);
             return;
        }

        if (confirm(`単位「${name}」 (値: ${unitToDelete.value}) を削除しますか？`)) {
            try {
                const batch = writeBatch(db);
                batch.delete(doc(db, 'effect_units', id));
                effectUnitsCache.filter(u => u.id !== id)
                    .sort((a,b) => (a.order ?? Infinity) - (b.order ?? Infinity))
                    .forEach((unit, index) => {
                        if(unit.order !== index) {
                             batch.update(doc(db, 'effect_units', unit.id), { order: index });
                        }
                    });
                await batch.commit();
                await loadInitialData(); // Reload all for simplicity and consistency
            } catch (error) {
                console.error("Error deleting effect unit:", error);
                alert("単位の削除に失敗しました。");
            }
        }
    }


    // --- Effect Type Management ---
    async function loadEffectTypesFromFirestore() {
        console.log("[Effect Types] Loading...");
        try {
            const q = query(collection(db, 'effect_types'), orderBy('name')); // No user order for effect types
            const snapshot = await getDocs(q);
            effectTypesCache = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
            console.log("[Effect Types] Loaded:", effectTypesCache.length);
        } catch (error) {
            console.error("[Effect Types] Error loading:", error);
            effectTypesCache = [];
        }
    }

    function renderEffectTypesForManagement() {
        if (!effectTypeListContainer) return;
        effectTypeListContainer.innerHTML = '';
        if(effectTypesCache.length === 0) {
            effectTypeListContainer.innerHTML = "<p>登録されている効果種類はありません。</p>";
            return;
        }
        effectTypesCache.forEach(effectType => {
            const unitObj = effectUnitsCache.find(u => u.value === effectType.defaultUnit);
            const unitText = unitObj ? `(${unitObj.name})` : (effectType.defaultUnit && effectType.defaultUnit !== 'none' ? `(${effectType.defaultUnit})` : '(単位なし)');
            const calcText = effectType.calculationMethod === 'max' ? '(最大値)' : '(加算)';
            const div = document.createElement('div');
            div.classList.add('list-item'); // Not sortable by default
            div.innerHTML = `
                <span>${effectType.name} ${unitText} ${calcText}</span>
                <div>
                    <button class="edit-effect-type action-button" data-id="${effectType.id}" title="編集">✎</button>
                    <button class="delete-effect-type action-button delete" data-id="${effectType.id}" data-name="${effectType.name}" title="削除">×</button>
                </div>
            `;
            effectTypeListContainer.appendChild(div);
            div.querySelector('.edit-effect-type').addEventListener('click', () => openEditEffectTypeModal(effectType));
            div.querySelector('.delete-effect-type').addEventListener('click', (e) => deleteEffectType(e.currentTarget.dataset.id, e.currentTarget.dataset.name));
        });
    }

    if (addEffectTypeButton) {
        addEffectTypeButton.addEventListener('click', async () => {
            const name = newEffectTypeNameInput.value.trim();
            const unitValue = newEffectTypeUnitSelect.value;
            const calcMethodRadio = Array.from(newEffectTypeCalcMethodRadios).find(r => r.checked);
            const calcMethod = calcMethodRadio ? calcMethodRadio.value : 'sum';

            if (!name) { alert("効果種類名を入力してください。"); return; }
            if (!unitValue && effectUnitsCache.length > 0 && newEffectTypeUnitSelect.options.length > 0 && newEffectTypeUnitSelect.options[0].value !== "") { // Check if units are loaded and required
                 alert("デフォルト単位を選択してください。"); return;
            }
            if (effectTypesCache.some(et => et.name.toLowerCase() === name.toLowerCase())) {
                alert("同じ名前の効果種類が既に存在します。"); return;
            }
            try {
                await addDoc(collection(db, 'effect_types'), {
                    name: name,
                    defaultUnit: unitValue || "none", // Store unit's value, or "none"
                    calculationMethod: calcMethod,
                    createdAt: serverTimestamp()
                });
                newEffectTypeNameInput.value = '';
                populateEffectUnitSelect(newEffectTypeUnitSelect); // Reset unit select to default
                if(newEffectTypeCalcMethodRadios[0]) newEffectTypeCalcMethodRadios[0].checked = true;

                await loadEffectTypesFromFirestore();
                renderEffectTypesForManagement();
                populateEffectTypeSelect(); // For item form
            } catch (error) {
                console.error("[Effect Types] Error adding:", error);
                alert("効果種類の追加に失敗しました。");
            }
        });
    }

    function openEditEffectTypeModal(effectTypeData) {
        editingEffectTypeDocIdInput.value = effectTypeData.id;
        editingEffectTypeNameInput.value = effectTypeData.name;
        populateEffectUnitSelect(editingEffectTypeUnitSelect, effectTypeData.defaultUnit);

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
            const newUnitValue = editingEffectTypeUnitSelect.value;
            const editCalcMethodRadio = Array.from(editingEffectTypeCalcMethodRadios).find(r => r.checked);
            const newCalcMethod = editCalcMethodRadio ? editCalcMethodRadio.value : 'sum';

            if (!newName) { alert("効果種類名は空にできません。"); return; }
            if (!newUnitValue && effectUnitsCache.length > 0 && editingEffectTypeUnitSelect.options.length > 0 && editingEffectTypeUnitSelect.options[0].value !== "") {
                alert("デフォルト単位を選択してください。"); return;
            }
            if (effectTypesCache.some(et => et.id !== id && et.name.toLowerCase() === newName.toLowerCase())) {
                 alert("編集後の名前が他の効果種類と重複します。"); return;
            }
            try {
                await updateDoc(doc(db, 'effect_types', id), {
                    name: newName,
                    defaultUnit: newUnitValue || "none",
                    calculationMethod: newCalcMethod
                 });
                if (editEffectTypeModal) editEffectTypeModal.style.display = 'none';
                await loadInitialData(); // Reload relevant data
            } catch (error) {
                 console.error("[Effect Types] Error updating:", error);
                 alert("効果種類の更新に失敗しました。");
            }
        });
    }

    async function deleteEffectType(id, name) {
        const itemsUsingThisType = itemsCache.filter(item =>
            item.structured_effects && item.structured_effects.some(eff => eff.type === id)
        );
        if (itemsUsingThisType.length > 0) {
            alert(`効果種類「${name}」は${itemsUsingThisType.length}個のアイテムで使用されているため、直接削除できません。`);
            return;
        }
         if (confirm(`効果種類「${name}」を削除しますか？`)) {
             try {
                 await deleteDoc(doc(db, 'effect_types', id));
                 await loadInitialData(); // Reload
             } catch (error) {
                  console.error("[Effect Types] Error deleting:", error);
                  alert("効果種類の削除に失敗しました。");
             }
         }
    }

    // --- Category Management ---
    async function loadCategoriesFromFirestore() {
        console.log("[Categories] Loading...");
        try {
            const q = query(collection(db, 'categories'), orderBy('order', 'asc'));
            const snapshot = await getDocs(q);
            allCategoriesCache = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
            console.log("[Categories] Loaded:", allCategoriesCache.length);
        } catch (error) {
            console.error("[Categories] Error loading:", error);
            allCategoriesCache = [];
        }
    }
    // renderCategoriesForManagement is above, in SortableJS section for now
    if (addCategoryButton) {
        addCategoryButton.addEventListener('click', async () => {
            const name = newCategoryNameInput.value.trim();
            const parentId = selectedNewParentCategoryIdInput.value || "";
            if (!name) { alert("カテゴリ名を入力してください。"); return; }

            const q = query(collection(db, 'categories'), where('name', '==', name), where('parentId', '==', parentId));
            const existingQuery = await getDocs(q);
            if (!existingQuery.empty) { alert("同じ名前のカテゴリが同じ階層に既に存在します。"); return; }

            try {
                const siblings = allCategoriesCache.filter(c => (c.parentId || "") === parentId);
                const newOrder = siblings.length;

                const categoryData = {
                    name: name,
                    parentId: parentId,
                    order: newOrder,
                    createdAt: serverTimestamp(),
                };
                if (parentId) {
                    categoryData.tagSearchMode = 'AND';
                } else {
                    categoryData.tagSearchMode = deleteField(); // Ensure no search mode for parent
                }

                await addDoc(collection(db, 'categories'), categoryData);
                newCategoryNameInput.value = '';
                const topLevelButton = newCategoryParentButtons.querySelector('div[data-parent-id=""]');
                if(topLevelButton) selectParentCategoryButton(newCategoryParentButtons, selectedNewParentCategoryIdInput, topLevelButton, "");

                await loadInitialData(); // Full reload for consistency
            } catch (error) {
                console.error("[Category Add] Error:", error);
                alert("カテゴリの追加に失敗しました。");
            }
        });
    }

    function openEditCategoryModal(category) {
        editingCategoryDocIdInput.value = category.id;
        editingCategoryNameInput.value = category.name;
        const currentParentId = category.parentId || "";
        populateParentCategoryButtons(editingCategoryParentButtons, selectedEditingParentCategoryIdInput, { currentCategoryIdToExclude: category.id, selectedParentId: currentParentId });

        const isChildCategory = !!currentParentId;
        editCategoryTagsGroup.style.display = isChildCategory ? 'block' : 'none';
        tagSearchModeGroup.style.display = isChildCategory ? 'block' : 'none';

        if (isChildCategory) {
            populateTagsForCategoryEdit(editingCategoryTagsSelector, category.id);
            editingTagSearchModeSelect.value = category.tagSearchMode || 'AND';
        } else {
            editingCategoryTagsSelector.innerHTML = ''; // Clear tags if it becomes parent
        }
        editCategoryModal.style.display = 'flex';
    }

    if (saveCategoryEditButton) {
        saveCategoryEditButton.addEventListener('click', async () => {
            const docId = editingCategoryDocIdInput.value;
            const originalCategory = allCategoriesCache.find(c => c.id === docId);
            if (!originalCategory) { alert("元のカテゴリ情報が見つかりません。"); return; }

            const newName = editingCategoryNameInput.value.trim();
            const newParentId = selectedEditingParentCategoryIdInput.value || "";
            const newTagSearchMode = editingTagSearchModeSelect.value;
            const selectedTagIdsForThisCategory = Array.from(editingCategoryTagsSelector.querySelectorAll('.tag-filter.active')).map(btn => btn.dataset.tagId);

            if (!newName) { alert("カテゴリ名は空にできません。"); return; }
            if (docId === newParentId) { alert("自身を親カテゴリに設定することはできません。"); return; }

            const q = query(collection(db, 'categories'), where('name', '==', newName), where('parentId', '==', newParentId));
            const existingQuery = await getDocs(q);
            if (existingQuery.docs.some(d => d.id !== docId)) {
                alert("編集後の名前が、同じ階層の他の既存カテゴリと重複します。"); return;
            }

            if (newParentId) { // Circular dependency check
                let currentAncestorId = newParentId;
                const visited = new Set([docId]);
                while (currentAncestorId) {
                    if (visited.has(currentAncestorId)) {
                        alert("循環参照です。この親カテゴリ設定はできません。"); return;
                    }
                    visited.add(currentAncestorId);
                    const ancestor = allCategoriesCache.find(c => c.id === currentAncestorId);
                    currentAncestorId = ancestor ? (ancestor.parentId || "") : "";
                }
            }

            try {
                const batch = writeBatch(db);
                const categoryUpdateData = { name: newName, parentId: newParentId };

                if (originalCategory.parentId !== newParentId) {
                    categoryUpdateData.order = allCategoriesCache.filter(c => (c.parentId || "") === newParentId && c.id !== docId).length;
                    // Re-order in old parent group
                    const oldParentSiblings = allCategoriesCache
                        .filter(c => (c.parentId || "") === (originalCategory.parentId || "") && c.id !== docId)
                        .sort((a,b) => (a.order ?? Infinity) - (b.order ?? Infinity));
                    oldParentSiblings.forEach((sibling, index) => {
                        if (sibling.order !== index) {
                             batch.update(doc(db, 'categories', sibling.id), { order: index });
                        }
                    });
                } // If parent doesn't change, order is preserved (changed by D&D)

                if (newParentId) { // Is a child category
                    categoryUpdateData.tagSearchMode = newTagSearchMode;
                    // Link/unlink tags
                    const tagsCurrentlyAssociatedWithCat = allTagsCache.filter(tag => tag.categoryIds && tag.categoryIds.includes(docId)).map(t => t.id);
                    const tagsToAddLink = selectedTagIdsForThisCategory.filter(id => !tagsCurrentlyAssociatedWithCat.includes(id));
                    const tagsToRemoveLink = tagsCurrentlyAssociatedWithCat.filter(id => !selectedTagIdsForThisCategory.includes(id));
                    tagsToAddLink.forEach(tagId => batch.update(doc(db, 'tags', tagId), { categoryIds: arrayUnion(docId) }));
                    tagsToRemoveLink.forEach(tagId => batch.update(doc(db, 'tags', tagId), { categoryIds: arrayRemove(docId) }));
                } else { // Is becoming a parent category
                    categoryUpdateData.tagSearchMode = deleteField();
                    allTagsCache.forEach(tag => {
                        if (tag.categoryIds && tag.categoryIds.includes(docId)) {
                            batch.update(doc(db, 'tags', tag.id), { categoryIds: arrayRemove(docId) });
                        }
                    });
                }

                batch.update(doc(db, 'categories', docId), categoryUpdateData);
                await batch.commit();
                editCategoryModal.style.display = 'none';
                await loadInitialData();
            } catch (error) {
                console.error("[Category Edit] Error:", error);
                alert("カテゴリの更新に失敗しました。");
            }
        });
    }

    async function deleteCategory(docId, categoryName) {
        const childCheckQuery = query(collection(db, 'categories'), where('parentId', '==', docId));
        const childSnapshot = await getDocs(childCheckQuery);
        if (!childSnapshot.empty) {
            alert(`カテゴリ「${categoryName}」には子カテゴリが存在するため削除できません。`);
            return;
        }
        const categoryToDelete = allCategoriesCache.find(c => c.id === docId);
        if (categoryToDelete && categoryToDelete.parentId) { // Child category
            const tagsUsingThisCategoryQuery = query(collection(db, 'tags'), where('categoryIds', 'array-contains', docId));
            const tagsSnapshot = await getDocs(tagsUsingThisCategoryQuery);
            if (!tagsSnapshot.empty) {
                 alert(`カテゴリ「${categoryName}」は${tagsSnapshot.size}個のタグで使用されています。`);
                 return;
            }
        }

        if (confirm(`カテゴリ「${categoryName}」を削除しますか？`)) {
            try {
                const batch = writeBatch(db);
                if (categoryToDelete && categoryToDelete.parentId) { // Remove from tags if it was a child
                    const tagsToUpdateQuery = query(collection(db, 'tags'), where('categoryIds', 'array-contains', docId));
                    const tagsSnapshot = await getDocs(tagsToUpdateQuery);
                    tagsSnapshot.forEach(tagDoc => {
                        batch.update(tagDoc.ref, { categoryIds: arrayRemove(docId) });
                    });
                }
                batch.delete(doc(db, 'categories', docId));

                const parentIdOfDeleted = categoryToDelete?.parentId || "";
                allCategoriesCache.filter(c => (c.parentId || "") === parentIdOfDeleted && c.id !== docId)
                    .sort((a,b) => (a.order ?? Infinity) - (b.order ?? Infinity))
                    .forEach((sibling, index) => {
                         if (sibling.order !== index) {
                            batch.update(doc(db, 'categories', sibling.id), { order: index });
                         }
                    });
                await batch.commit();
                await loadInitialData();
            } catch (error) {
                console.error("[Category Delete] Error:", error);
                alert("カテゴリの削除に失敗しました。");
            }
        }
    }

    // --- Tag Management ---
    async function loadTagsFromFirestore() {
        console.log("[Tags] Loading...");
        try {
            const q = query(collection(db, 'tags'), orderBy('order', 'asc'));
            const snapshot = await getDocs(q);
            allTagsCache = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
            console.log("[Tags] Loaded:", allTagsCache.length);
        } catch (error) {
            console.error("[Tags] Error loading tags:", error);
            allTagsCache = [];
        }
    }
    // renderTagsForManagement is above
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
                const newOrder = allTagsCache.length;
                await addDoc(collection(db, 'tags'), {
                    name: name,
                    categoryIds: selectedCategoryIds,
                    order: newOrder,
                    createdAt: serverTimestamp()
                });
                newTagNameInput.value = '';
                newTagCategoriesCheckboxes.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
                await loadInitialData(); // Reload
            } catch (error) {
                console.error("[Tag Add] Error:", error);
                alert("タグの追加に失敗しました。");
            }
        });
    }

    function openEditTagModal(tag) { // Pass the whole tag object
        editingTagDocIdInput.value = tag.id;
        editingTagNameInput.value = tag.name;
        populateCategoryCheckboxesForTagAssignment(editingTagCategoriesCheckboxes, tag.categoryIds || []);
        editTagModal.style.display = 'flex';
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
            if (existingQuery.docs.some(d => d.id !== docId)) {
                alert("編集後の名前が、他の既存タグと重複します。"); return;
            }
            try {
                await updateDoc(doc(db, 'tags', docId), {
                    name: newName,
                    categoryIds: newSelectedCategoryIds
                    // Order is not changed here, only by D&D
                });
                editTagModal.style.display = 'none';
                await loadInitialData(); // Reload
            } catch (error) {
                console.error("[Tag Edit] Error:", error);
                alert("タグの更新に失敗しました。");
            }
        });
    }

    async function deleteTag(docId, tagName) {
        const itemsUsingTagQuery = query(collection(db, 'items'), where('tags', 'array-contains', docId));
        const itemsSnapshot = await getDocs(itemsUsingTagQuery);
        if (!itemsSnapshot.empty) {
            alert(`タグ「${tagName}」は${itemsSnapshot.size}個のアイテムで使用されています。`);
            return;
        }
        if (confirm(`タグ「${tagName}」を削除しますか？`)) {
            try {
                const batch = writeBatch(db);
                batch.delete(doc(db, 'tags', docId));
                allTagsCache.filter(t => t.id !== docId)
                    .sort((a,b) => (a.order ?? Infinity) - (b.order ?? Infinity))
                    .forEach((tag, index) => {
                        if(tag.order !== index) {
                             batch.update(doc(db, 'tags', tag.id), { order: index });
                        }
                    });
                await batch.commit();
                await loadInitialData();
            } catch (error) {
                console.error("[Tag Delete] Error:", error);
                alert("タグの削除に失敗しました。");
            }
        }
    }

    // --- Item Management ---
    // loadItemsFromFirestore, renderItemsAdminTable, loadItemForEdit, deleteItem are above (in Step 2)
    // itemForm submit, clearItemForm, populateTagCheckboxesForItemForm,
    // populateEffectTypeSelect, updateEffectUnitDisplay, renderCurrentItemEffectsList, addEffectToListButton
    // image upload functions, modal common handlers from previous full script.

    // (Re-pasting a few key item form related functions to ensure completeness)
    function populateTagCheckboxesForItemForm(selectedTagIds = []) {
        if (!itemTagsSelectorCheckboxes) return;
        itemTagsSelectorCheckboxes.innerHTML = '';
        if (allTagsCache.length === 0) {
            itemTagsSelectorCheckboxes.innerHTML = '<p>登録されているタグがありません。</p>';
            return;
        }
        const sortedTags = [...allTagsCache].sort((a,b) => (a.order ?? Infinity) - (b.order ?? Infinity) || (a.name||"").localeCompare(b.name||""));
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

    function populateEffectTypeSelect() {
        if (!effectTypeSelect) return;
        const currentVal = effectTypeSelect.value;
        effectTypeSelect.innerHTML = '<option value="">効果種類を選択...</option>';
        if (effectTypesCache.length === 0) {
            effectTypeSelect.disabled = true; return;
        }
        effectTypeSelect.disabled = false;
        effectTypesCache.forEach(et => {
            effectTypeSelect.add(new Option(et.name, et.id));
        });
        if (currentVal && effectTypesCache.some(et => et.id === currentVal)) {
            effectTypeSelect.value = currentVal;
        }
        updateEffectUnitDisplay();
    }

    function updateEffectUnitDisplay() {
        if (!effectTypeSelect || !effectUnitDisplay) return;
        const selectedTypeId = effectTypeSelect.value;
        const selectedEffectType = effectTypesCache.find(et => et.id === selectedTypeId);
        if (selectedEffectType && selectedEffectType.defaultUnit && selectedEffectType.defaultUnit !== 'none') {
            const unitObj = effectUnitsCache.find(u => u.value === selectedEffectType.defaultUnit);
            effectUnitDisplay.textContent = unitObj ? `(${unitObj.name})` : `(${selectedEffectType.defaultUnit})`;
        } else {
            effectUnitDisplay.textContent = '';
        }
    }
    if (effectTypeSelect) effectTypeSelect.addEventListener('change', updateEffectUnitDisplay);

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
            const unitObj = effectUnitsCache.find(u => u.value === effect.unit);
            const unitText = unitObj ? unitObj.name : (effect.unit !== 'none' ? effect.unit : '');
            const displayUnit = unitText ? `(${unitText})` : '';

            const div = document.createElement('div');
            div.classList.add('effect-list-item');
            div.innerHTML = `
                <span>${typeName}: ${effect.value}${displayUnit}</span>
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
            const unitValue = selectedEffectType ? (selectedEffectType.defaultUnit || 'none') : 'none';

            currentItemEffects.push({ type: typeId, value: value, unit: unitValue });
            renderCurrentItemEffectsList();
            effectTypeSelect.value = '';
            effectValueInput.value = '';
            updateEffectUnitDisplay();
        });
    }

    if (itemForm) {
        itemForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = itemNameInput.value.trim();
            const source = itemSourceInput.value.trim();
            const selectedItemTagIds = Array.from(itemTagsSelectorCheckboxes.querySelectorAll('input[type="checkbox"][name="itemTag"]:checked'))
                                            .map(cb => cb.value);
            const editingDocId = itemIdToEditInput.value;
            let imageUrl = itemImageUrlInput.value;

            saveItemButton.disabled = true; saveItemButton.textContent = "保存中...";
            try {
                if (selectedImageFile) {
                    imageUrl = await uploadImageToWorkerAndGetURL(selectedImageFile);
                    if (imageUrl === null && selectedImageFile) { // Check selectedImageFile to ensure error was due to upload
                        saveItemButton.disabled = false; saveItemButton.textContent = editingDocId ? "アイテム更新" : "アイテム保存";
                        return;
                    }
                }
                const itemData = {
                    name: name || "",
                    image: imageUrl || "",
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
                await loadItemsFromFirestore(); // Reload items
                renderItemsAdminTable();      // Re-render table
                clearItemForm();
            } catch (error) {
                console.error("[Item Save] Error:", error);
                alert(`アイテム保存エラー: ${error.message}`);
            } finally {
                saveItemButton.disabled = false;
                // Check itemIdToEditInput.value *again* because clearItemForm might have cleared it
                saveItemButton.textContent = document.getElementById('itemIdToEdit').value ? "アイテム更新" : "アイテム保存";
            }
        });
    }

    if (clearFormButton) clearFormButton.addEventListener('click', clearItemForm);

    function clearItemForm() {
        if (itemForm) itemForm.reset(); // Resets native form elements
        itemIdToEditInput.value = '';   // Clear hidden input
        itemNameInput.value = '';       // Explicitly clear text inputs
        itemImageUrlInput.value = '';   // Clear hidden URL
        itemSourceInput.value = '';     // Clear textarea

        if (itemImagePreview) { itemImagePreview.src = '#'; itemImagePreview.style.display = 'none'; }
        if (itemImageFileInput) itemImageFileInput.value = null; // Important for file input
        selectedImageFile = null;
        uploadProgressContainer.style.display = 'none';

        populateTagCheckboxesForItemForm(); // Clears and re-populates (effectively clearing selections)

        currentItemEffects = [];
        renderCurrentItemEffectsList(); // Clears effect list UI

        if(effectTypeSelect) effectTypeSelect.value = ''; // Reset select
        if(effectValueInput) effectValueInput.value = ''; // Clear input
        updateEffectUnitDisplay(); // Update unit display based on cleared select

        if (saveItemButton) saveItemButton.textContent = "アイテム保存";
    }

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
                uploadProgressContainer.style.display = 'none';
            } else {
                const existingUrl = itemImageUrlInput.value;
                if (existingUrl) {
                    itemImagePreview.src = existingUrl;
                    itemImagePreview.style.display = 'block';
                } else {
                    itemImagePreview.src = '#';
                    itemImagePreview.style.display = 'none';
                }
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
        formData.append('imageFile', file);
        try {
            uploadProgressText.textContent = 'アップロード中...';
            const response = await fetch(IMAGE_UPLOAD_WORKER_URL, { method: 'POST', body: formData });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'サーバーからの不明なエラー' }));
                alert(`画像のアップロードに失敗しました: ${errorData.error || response.statusText}`);
                uploadProgressContainer.style.display = 'none'; return null;
            }
            const result = await response.json();
            if (result.success && result.imageUrl) {
                uploadProgressText.textContent = 'アップロード完了!';
                setTimeout(() => { uploadProgressContainer.style.display = 'none'; }, 2000);
                return result.imageUrl;
            } else {
                alert(`画像のアップロードエラー: ${result.message || '不明な応答'}`);
                uploadProgressContainer.style.display = 'none'; return null;
            }
        } catch (error) {
            alert(`画像のアップロード中に通信エラー: ${error.message}`);
            uploadProgressContainer.style.display = 'none'; return null;
        }
    }

    function populateParentCategoryButtons(buttonContainer, hiddenInput, options = {}) {
        const { currentCategoryIdToExclude = null, selectedParentId = "" } = options;
        if (!buttonContainer || !hiddenInput) return;
        buttonContainer.innerHTML = '';

        const createButton = (text, parentIdVal) => {
            const btn = document.createElement('div');
            btn.classList.add('category-select-button');
            btn.textContent = text;
            btn.dataset.parentId = parentIdVal;
            if (String(selectedParentId) === String(parentIdVal)) { // Ensure type consistency for comparison
                btn.classList.add('active');
            }
            btn.addEventListener('click', () => {
                 selectParentCategoryButton(buttonContainer, hiddenInput, btn, parentIdVal);
            });
            return btn;
        };

        buttonContainer.appendChild(createButton('最上位カテゴリとして追加', ""));

        allCategoriesCache
            .filter(cat => (!cat.parentId || cat.parentId === "") && cat.id !== currentCategoryIdToExclude)
            .sort((a,b) => (a.order ?? Infinity) - (b.order ?? Infinity) || (a.name||"").localeCompare(b.name||""))
            .forEach(cat => {
                buttonContainer.appendChild(createButton(cat.name, cat.id));
            });

        hiddenInput.value = selectedParentId;
        if (buttonContainer === editingCategoryParentButtons) {
             const isParent = (selectedParentId === "");
             if (tagSearchModeGroup) tagSearchModeGroup.style.display = isParent ? 'none' : 'block';
             if (editCategoryTagsGroup) editCategoryTagsGroup.style.display = isParent ? 'none' : 'block';
        }
    }

    function selectParentCategoryButton(container, hiddenInput, clickedButton, parentId) {
        container.querySelectorAll('.category-select-button.active').forEach(activeBtn => {
            activeBtn.classList.remove('active');
        });
        clickedButton.classList.add('active');
        hiddenInput.value = parentId;

        if (container === editingCategoryParentButtons) {
             const isParent = (parentId === "");
             if (tagSearchModeGroup) tagSearchModeGroup.style.display = isParent ? 'none' : 'block';
             if (editCategoryTagsGroup) editCategoryTagsGroup.style.display = isParent ? 'none' : 'block';
             if (isParent && editingCategoryTagsSelector) editingCategoryTagsSelector.innerHTML = ''; // Clear tags if parent
        }
    }
    function populateTagsForCategoryEdit(containerElement, categoryId) {
        if (!containerElement) return;
        containerElement.innerHTML = '';
        if (allTagsCache.length === 0) {
            containerElement.innerHTML = '<p>タグがありません。</p>';
            return;
        }
        const sortedTags = [...allTagsCache].sort((a,b) => (a.order ?? Infinity) - (b.order ?? Infinity) || (a.name||"").localeCompare(b.name||""));
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


    // --- Modal common handlers ---
    document.querySelectorAll('.modal .close-button').forEach(btn => {
        btn.onclick = function() { btn.closest('.modal').style.display = "none"; }
    });
    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) event.target.style.display = "none";
    }
}); // End DOMContentLoaded
