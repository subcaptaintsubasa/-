// admin.script.js (Full version with all corrections and functions)
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
            loadInitialData().catch(err => {
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
        if (newEffectTypeUnitSelect) newEffectTypeUnitSelect.innerHTML = '';
        if (editingEffectTypeUnitSelect) editingEffectTypeUnitSelect.innerHTML = '';

        if (effectUnitListContainer) effectUnitListContainer.innerHTML = '';
        if (newEffectUnitNameInput) newEffectUnitNameInput.value = '';
        if (newEffectUnitValueInput) newEffectUnitValueInput.value = '';

        if (itemsTableBody) itemsTableBody.innerHTML = '';
        if (itemTagsSelectorCheckboxes) itemTagsSelectorCheckboxes.innerHTML = '';
        clearItemForm();
    }

    async function loadInitialData() {
        console.log("[Initial Load] Starting...");
        try {
            await loadEffectUnitsFromFirestore();
            await loadEffectTypesFromFirestore();
            await loadCategoriesFromFirestore();
            await loadTagsFromFirestore();
            await loadItemsFromFirestore(); // Make sure this is awaited

            populateAllUIElements();
            initializeAllSortableLists();
            console.log("[Initial Load] Completed.");
        } catch (error) {
             console.error("Error during initial data load or UI population:", error);
             throw error;
        }
    }

    function populateAllUIElements() {
        console.log("[Populate UI] Starting...");
        populateParentCategoryButtons(newCategoryParentButtons, selectedNewParentCategoryIdInput);
        populateCategoryCheckboxesForTagAssignment(newTagCategoriesCheckboxes);
        populateTagCheckboxesForItemForm();
        populateEffectTypeSelect();
        populateEffectUnitSelect(newEffectTypeUnitSelect);

        renderCategoriesForManagement();
        renderTagsForManagement();
        renderEffectTypesForManagement();
        renderEffectUnitsForManagement();
        renderItemsAdminTable();
        console.log("[Populate UI] Completed.");
    }

    function initializeSortableList(listElement, collectionName, onUpdateCallback, additionalSortableOptions = {}) {
        if (!listElement || typeof Sortable === 'undefined') {
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
                    if (onUpdateCallback) await onUpdateCallback(true);
                    return;
                }
                const items = Array.from(listElement.children);
                const batch = writeBatch(db);
                let reorderSuccess = true;
                items.forEach((itemElement, index) => {
                    const docId = itemElement.dataset.docId;
                    if (docId) {
                        batch.update(doc(db, collectionName, docId), { order: index });
                    } else {
                        reorderSuccess = false;
                    }
                });
                if (!reorderSuccess) {
                    alert(`${collectionName}の並び替え中にエラー(ID不備)。`);
                    if (onUpdateCallback) await onUpdateCallback(true);
                    return;
                }
                try {
                    await batch.commit();
                    if (onUpdateCallback) await onUpdateCallback();
                } catch (error) {
                    alert(`${collectionName}の順序更新失敗。`);
                    if (onUpdateCallback) await onUpdateCallback(true);
                }
            }
        });
    }

    function initializeAllSortableLists() {
        if (categoryListContainer) {
            initializeSortableList(categoryListContainer, 'categories', async () => {
                await loadCategoriesFromFirestore(); renderCategoriesForManagement();
                populateParentCategoryButtons(newCategoryParentButtons, selectedNewParentCategoryIdInput);
                if (editCategoryModal.style.display === 'flex' && editingCategoryDocIdInput.value) {
                    const cat = allCategoriesCache.find(c => c.id === editingCategoryDocIdInput.value);
                    if (cat) populateParentCategoryButtons(editingCategoryParentButtons, selectedEditingParentCategoryIdInput, { currentCategoryIdToExclude: cat.id, selectedParentId: cat.parentId || "" });
                }
            });
        }
        if (tagListContainer) {
            initializeSortableList(tagListContainer, 'tags', async () => {
                await loadTagsFromFirestore(); renderTagsForManagement();
                const currentItem = itemIdToEditInput.value ? itemsCache.find(i => i.docId === itemIdToEditInput.value) : null;
                populateTagCheckboxesForItemForm(currentItem?.tags || []);
            });
        }
        if (effectUnitListContainer) {
            initializeSortableList(effectUnitListContainer, 'effect_units', async () => {
                await loadEffectUnitsFromFirestore(); renderEffectUnitsForManagement();
                populateEffectUnitSelect(newEffectTypeUnitSelect);
                if (editEffectTypeModal.style.display === 'flex' && editingEffectTypeDocIdInput.value) {
                    const et = effectTypesCache.find(e => e.id === editingEffectTypeDocIdInput.value);
                    if (et) populateEffectUnitSelect(editingEffectTypeUnitSelect, et.defaultUnit);
                }
            });
        }
    }

    async function loadEffectUnitsFromFirestore() {
        console.log("[Effect Units] Loading...");
        try {
            const q = query(collection(db, 'effect_units'), orderBy('order', 'asc'));
            const snapshot = await getDocs(q);
            effectUnitsCache = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
            console.log("[Effect Units] Loaded:", effectUnitsCache.length);
        } catch (error) {
            console.error("[Effect Units] Error loading:", error); effectUnitsCache = [];
        }
    }

    function populateEffectUnitSelect(selectElement, selectedValue = null) {
        if (!selectElement) return;
        const currentValInSelect = selectElement.value;
        selectElement.innerHTML = '';
        if (effectUnitsCache.length === 0) {
            selectElement.add(new Option("単位未登録", "")); selectElement.disabled = true; return;
        }
        selectElement.disabled = false;
        effectUnitsCache.forEach(unit => selectElement.add(new Option(unit.name, unit.value)));
        if (selectedValue && effectUnitsCache.some(u => u.value === selectedValue)) selectElement.value = selectedValue;
        else if (currentValInSelect && effectUnitsCache.some(u => u.value === currentValInSelect)) selectElement.value = currentValInSelect;
        else if (effectUnitsCache.length > 0) selectElement.value = effectUnitsCache[0].value;
    }

    function renderEffectUnitsForManagement() {
        if (!effectUnitListContainer) return;
        effectUnitListContainer.innerHTML = '';
        if (effectUnitsCache.length === 0) { effectUnitListContainer.innerHTML = '<p>登録されている単位はありません。</p>'; return; }
        const sortedUnits = [...effectUnitsCache].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
        sortedUnits.forEach(unit => {
            const div = document.createElement('div');
            div.classList.add('list-item'); div.dataset.docId = unit.id;
            div.innerHTML = `<span>${unit.name} (値: ${unit.value})</span><div><button class="delete-effect-unit action-button delete" data-id="${unit.id}" data-name="${unit.name}" title="削除">×</button></div>`;
            effectUnitListContainer.appendChild(div);
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
                await addDoc(collection(db, 'effect_units'), { name, value, order: effectUnitsCache.length, createdAt: serverTimestamp() });
                newEffectUnitNameInput.value = ''; newEffectUnitValueInput.value = '';
                await loadInitialData(); // Full reload to ensure all dependent UI is updated
            } catch (error) { console.error("Error adding effect unit:", error); alert("単位の追加に失敗。"); }
        });
    }

    async function deleteEffectUnit(id, name) {
        const unitToDelete = effectUnitsCache.find(u => u.id === id);
        if (!unitToDelete) return;
        if (effectTypesCache.some(et => et.defaultUnit === unitToDelete.value) || itemsCache.some(item => item.structured_effects?.some(eff => eff.unit === unitToDelete.value))) {
            alert(`単位「${name}」は効果種類またはアイテムで使用中のため削除できません。`); return;
        }
        if (confirm(`単位「${name}」を削除しますか？`)) {
            try {
                const batch = writeBatch(db);
                batch.delete(doc(db, 'effect_units', id));
                effectUnitsCache.filter(u => u.id !== id).sort((a,b) => (a.order ?? Infinity) - (b.order ?? Infinity))
                    .forEach((unit, i) => { if(unit.order !== i) batch.update(doc(db, 'effect_units', unit.id), {order: i}); });
                await batch.commit();
                await loadInitialData();
            } catch (error) { console.error("Error deleting unit:", error); alert("単位削除失敗。"); }
        }
    }

    async function loadEffectTypesFromFirestore() {
        console.log("[Effect Types] Loading...");
        try {
            const q = query(collection(db, 'effect_types'), orderBy('name'));
            const snapshot = await getDocs(q);
            effectTypesCache = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
            console.log("[Effect Types] Loaded:", effectTypesCache.length);
        } catch (error) { console.error("[Effect Types] Error:", error); effectTypesCache = []; }
    }

    function renderEffectTypesForManagement() {
        if (!effectTypeListContainer) return;
        effectTypeListContainer.innerHTML = '';
        if(effectTypesCache.length === 0) { effectTypeListContainer.innerHTML = "<p>効果種類未登録</p>"; return;}
        effectTypesCache.forEach(et => {
            const unit = effectUnitsCache.find(u => u.value === et.defaultUnit);
            const unitName = unit ? `(${unit.name})` : (et.defaultUnit && et.defaultUnit !== 'none' ? `(${et.defaultUnit})` : '(単位なし)');
            const calc = et.calculationMethod === 'max' ? '(最大値)' : '(加算)';
            const div = document.createElement('div'); div.classList.add('list-item');
            div.innerHTML = `<span>${et.name} ${unitName} ${calc}</span><div><button class="edit-effect-type" data-id="${et.id}">✎</button><button class="delete-effect-type delete" data-id="${et.id}" data-name="${et.name}">×</button></div>`;
            effectTypeListContainer.appendChild(div);
            div.querySelector('.edit-effect-type').classList.add('action-button');
            div.querySelector('.delete-effect-type').classList.add('action-button');
            div.querySelector('.edit-effect-type').addEventListener('click', () => openEditEffectTypeModal(et));
            div.querySelector('.delete-effect-type').addEventListener('click', (e) => deleteEffectType(e.currentTarget.dataset.id, e.currentTarget.dataset.name));
        });
    }

    if (addEffectTypeButton) {
        addEffectTypeButton.addEventListener('click', async () => {
            const name = newEffectTypeNameInput.value.trim();
            const unitVal = newEffectTypeUnitSelect.value;
            const calcM = Array.from(newEffectTypeCalcMethodRadios).find(r=>r.checked)?.value || 'sum';
            if (!name || (!unitVal && effectUnitsCache.length > 0 && newEffectTypeUnitSelect.options[0]?.value !== "")) {
                alert("効果種類名と単位を入力/選択してください。"); return;
            }
            if (effectTypesCache.some(et => et.name.toLowerCase() === name.toLowerCase())) {
                alert("同名効果種類あり。"); return;
            }
            try {
                await addDoc(collection(db, 'effect_types'), {name, defaultUnit: unitVal||"none", calculationMethod: calcM, createdAt: serverTimestamp()});
                newEffectTypeNameInput.value = ''; populateEffectUnitSelect(newEffectTypeUnitSelect);
                if(newEffectTypeCalcMethodRadios[0]) newEffectTypeCalcMethodRadios[0].checked = true;
                await loadInitialData();
            } catch (e) { console.error("Err adding ET:", e); alert("効果種類追加失敗。");}
        });
    }

    function openEditEffectTypeModal(etData) {
        editingEffectTypeDocIdInput.value = etData.id;
        editingEffectTypeNameInput.value = etData.name;
        populateEffectUnitSelect(editingEffectTypeUnitSelect, etData.defaultUnit);
        const radio = Array.from(editingEffectTypeCalcMethodRadios).find(r=>r.value === (etData.calculationMethod||'sum'));
        if(radio) radio.checked = true; else if(editingEffectTypeCalcMethodRadios[0]) editingEffectTypeCalcMethodRadios[0].checked = true;
        if(editEffectTypeModal) editEffectTypeModal.style.display = 'flex';
    }

    if (saveEffectTypeEditButton) {
        saveEffectTypeEditButton.addEventListener('click', async () => {
            const id = editingEffectTypeDocIdInput.value;
            const name = editingEffectTypeNameInput.value.trim();
            const unitVal = editingEffectTypeUnitSelect.value;
            const calcM = Array.from(editingEffectTypeCalcMethodRadios).find(r=>r.checked)?.value || 'sum';
            if (!name || (!unitVal && effectUnitsCache.length > 0 && editingEffectTypeUnitSelect.options[0]?.value !== "")) {
                alert("効果種類名と単位を入力/選択。"); return;
            }
            if (effectTypesCache.some(et => et.id !== id && et.name.toLowerCase() === name.toLowerCase())) {
                alert("同名効果種類あり。"); return;
            }
            try {
                await updateDoc(doc(db, 'effect_types', id), {name, defaultUnit: unitVal||"none", calculationMethod: calcM});
                if(editEffectTypeModal) editEffectTypeModal.style.display = 'none';
                await loadInitialData();
            } catch (e) { console.error("Err updating ET:", e); alert("効果種類更新失敗。");}
        });
    }

    async function deleteEffectType(id, name) {
        if (itemsCache.some(item => item.structured_effects?.some(eff => eff.type === id))) {
            alert(`効果種類「${name}」はアイテムで使用中のため削除不可。`); return;
        }
        if (confirm(`効果種類「${name}」を削除しますか？`)) {
            try { await deleteDoc(doc(db, 'effect_types', id)); await loadInitialData(); }
            catch (e) { console.error("Err deleting ET:", e); alert("効果種類削除失敗。");}
        }
    }

    async function loadCategoriesFromFirestore() {
        console.log("[Categories] Loading...");
        try {
            const q = query(collection(db, 'categories'), orderBy('order', 'asc'));
            const snapshot = await getDocs(q);
            allCategoriesCache = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
            console.log("[Categories] Loaded:", allCategoriesCache.length);
        } catch (error) { console.error("[Cat] Load Error:", error); allCategoriesCache = []; }
    }

    function renderCategoriesForManagement() {
        if (!categoryListContainer) return;
        categoryListContainer.innerHTML = '';
        if (allCategoriesCache.length === 0) { categoryListContainer.innerHTML = '<p>カテゴリ未登録</p>'; return; }
        const sorted = [...allCategoriesCache].sort((a,b)=>(a.order??Infinity)-(b.order??Infinity)||(a.name||"").localeCompare(b.name||""));
        const parents = sorted.filter(c=>!c.parentId||c.parentId==="");
        parents.forEach(pCat => {
            appendCat(pCat, 0);
            sorted.filter(c=>c.parentId===pCat.id).forEach(cCat => appendCat(cCat,1));
        });
        function appendCat(cat, indent) {
            const div = document.createElement('div'); div.classList.add('list-item');
            div.style.marginLeft = `${indent*25}px`; div.dataset.docId = cat.id;
            const info = cat.parentId ? `(子${cat.tagSearchMode ? ' '+cat.tagSearchMode.toUpperCase()+'検索' : ''})` : "(親)";
            div.innerHTML = `<span class="cat-name">${cat.name}</span><span class="cat-info">${info}</span><div class="cat-actions"><button class="edit-cat" data-id="${cat.id}">✎</button><button class="del-cat delete" data-id="${cat.id}" data-name="${cat.name}">×</button></div>`;
            categoryListContainer.appendChild(div);
            // CSS classes for spans might need adjustment in admin.style.css
            div.querySelector('.edit-cat').classList.add('action-button', 'edit-category'); // Add base classes
            div.querySelector('.del-cat').classList.add('action-button', 'delete-category');
            div.querySelector('.edit-cat').addEventListener('click', ()=>openEditCategoryModal(cat));
            div.querySelector('.del-cat').addEventListener('click', (e)=>deleteCategory(e.currentTarget.dataset.id, e.currentTarget.dataset.name));
        }
    }

    if (addCategoryButton) {
        addCategoryButton.addEventListener('click', async () => {
            const name = newCategoryNameInput.value.trim();
            const parentId = selectedNewParentCategoryIdInput.value || "";
            if(!name){alert("カテゴリ名必須。"); return;}
            const q = query(collection(db,'categories'),where('name','==',name),where('parentId','==',parentId));
            if(!(await getDocs(q)).empty){alert("同名・同階層カテゴリあり。"); return;}
            try {
                const order = allCategoriesCache.filter(c=>(c.parentId||"")===parentId).length;
                const data = {name, parentId, order, createdAt:serverTimestamp(), tagSearchMode: parentId ? 'AND' : deleteField()};
                await addDoc(collection(db,'categories'), data);
                newCategoryNameInput.value = '';
                const topBtn = newCategoryParentButtons.querySelector('div[data-parent-id=""]');
                if(topBtn) selectParentCategoryButton(newCategoryParentButtons, selectedNewParentCategoryIdInput, topBtn, "");
                await loadInitialData();
            } catch(e){console.error("Err adding Cat:",e); alert("カテゴリ追加失敗。");}
        });
    }

    function openEditCategoryModal(cat) {
        editingCategoryDocIdInput.value = cat.id;
        editingCategoryNameInput.value = cat.name;
        const pId = cat.parentId||"";
        populateParentCategoryButtons(editingCategoryParentButtons,selectedEditingParentCategoryIdInput,{currentCategoryIdToExclude:cat.id,selectedParentId:pId});
        const isChild = !!pId;
        editCategoryTagsGroup.style.display = isChild?'block':'none';
        tagSearchModeGroup.style.display = isChild?'block':'none';
        if(isChild){ populateTagsForCategoryEdit(editingCategoryTagsSelector,cat.id); editingTagSearchModeSelect.value = cat.tagSearchMode||'AND';}
        else { editingCategoryTagsSelector.innerHTML = '';}
        editCategoryModal.style.display = 'flex';
    }

    if (saveCategoryEditButton) {
        saveCategoryEditButton.addEventListener('click', async () => {
            const id=editingCategoryDocIdInput.value; const origCat=allCategoriesCache.find(c=>c.id===id); if(!origCat)return;
            const name=editingCategoryNameInput.value.trim(); const pId=selectedEditingParentCategoryIdInput.value||"";
            const searchM=editingTagSearchModeSelect.value; const tags=Array.from(editingCategoryTagsSelector.querySelectorAll('.tag-filter.active')).map(b=>b.dataset.tagId);
            if(!name){alert("名必須");return;} if(id===pId){alert("自身親不可");return;}
            const q=query(collection(db,'categories'),where('name','==',name),where('parentId','==',pId));
            if((await getDocs(q)).docs.some(d=>d.id!==id)){alert("同名同階層あり");return;}
            if(pId){let anc=pId; const visited=new Set([id]); while(anc){if(visited.has(anc)){alert("循環参照");return;}visited.add(anc);anc=allCategoriesCache.find(c=>c.id===anc)?.parentId||"";}}
            try{
                const batch=writeBatch(db); const data={name,parentId:pId};
                if(origCat.parentId!==pId){data.order=allCategoriesCache.filter(c=>(c.parentId||"")===pId&&c.id!==id).length; const oldPSib=allCategoriesCache.filter(c=>(c.parentId||"")===(origCat.parentId||"")&&c.id!==id).sort((a,b)=>(a.order??Infinity)-(b.order??Infinity)); oldPSib.forEach((s,i)=>{if(s.order!==i)batch.update(doc(db,'categories',s.id),{order:i});});}
                if(pId){data.tagSearchMode=searchM; const curTags=allTagsCache.filter(t=>t.categoryIds?.includes(id)).map(t=>t.id); tags.filter(tid=>!curTags.includes(tid)).forEach(tid=>batch.update(doc(db,'tags',tid),{categoryIds:arrayUnion(id)})); curTags.filter(tid=>!tags.includes(tid)).forEach(tid=>batch.update(doc(db,'tags',tid),{categoryIds:arrayRemove(id)}));}
                else{data.tagSearchMode=deleteField(); allTagsCache.forEach(t=>{if(t.categoryIds?.includes(id))batch.update(doc(db,'tags',t.id),{categoryIds:arrayRemove(id)});});}
                batch.update(doc(db,'categories',id),data); await batch.commit();
                editCategoryModal.style.display='none'; await loadInitialData();
            }catch(e){console.error("Err saving Cat:",e);alert("カテゴリ更新失敗。");}
        });
    }

    async function deleteCategory(id, name) {
        if(!(await getDocs(query(collection(db,'categories'),where('parentId','==',id)))).empty){alert(`「${name}」子あり削除不可`);return;}
        const catDel=allCategoriesCache.find(c=>c.id===id);
        if(catDel?.parentId && !(await getDocs(query(collection(db,'tags'),where('categoryIds','array-contains',id)))).empty){alert(`「${name}」タグ使用中`);return;}
        if(confirm(`「${name}」削除しますか？`)){
            try{
                const batch=writeBatch(db);
                if(catDel?.parentId){(await getDocs(query(collection(db,'tags'),where('categoryIds','array-contains',id)))).forEach(td=>batch.update(td.ref,{categoryIds:arrayRemove(id)}));}
                batch.delete(doc(db,'categories',id));
                const pIdDel=catDel?.parentId||"";
                allCategoriesCache.filter(c=>(c.parentId||"")===pIdDel&&c.id!==id).sort((a,b)=>(a.order??Infinity)-(b.order??Infinity)).forEach((s,i)=>{if(s.order!==i)batch.update(doc(db,'categories',s.id),{order:i});});
                await batch.commit(); await loadInitialData();
            }catch(e){console.error("Err del Cat:",e);alert("カテゴリ削除失敗。");}
        }
    }

    async function loadTagsFromFirestore() {
        console.log("[Tags] Loading...");
        try {
            const q = query(collection(db, 'tags'), orderBy('order', 'asc'));
            const snapshot = await getDocs(q);
            allTagsCache = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
            console.log("[Tags] Loaded:", allTagsCache.length);
        } catch (error) { console.error("[Tags] Load Error:", error); allTagsCache = []; }
    }

    function renderTagsForManagement() {
        if (!tagListContainer) return;
        tagListContainer.innerHTML = '';
        if (allTagsCache.length === 0) { tagListContainer.innerHTML = '<p>タグ未登録</p>'; return; }
        const sortedTags = [...allTagsCache].sort((a,b)=>(a.order??Infinity)-(b.order??Infinity)||(a.name||"").localeCompare(b.name||""));
        sortedTags.forEach(tag => {
            const cats = (tag.categoryIds||[]).map(cid=>{const c=allCategoriesCache.find(x=>x.id===cid); if(!c||!c.parentId)return null; const p=allCategoriesCache.find(x=>x.id===c.parentId); return `${c.name}${p?`(親:${p.name})`:''}`;}).filter(Boolean).join(', ')||"未分類";
            const div = document.createElement('div'); div.classList.add('list-item'); div.dataset.docId = tag.id;
            div.innerHTML = `<span>${tag.name} (所属: ${cats})</span><div><button class="edit-tag action-button" data-id="${tag.id}">✎</button><button class="delete-tag action-button delete" data-id="${tag.id}" data-name="${tag.name}">×</button></div>`;
            tagListContainer.appendChild(div);
            div.querySelector('.edit-tag').addEventListener('click', ()=>openEditTagModal(tag));
            div.querySelector('.delete-tag').addEventListener('click', (e)=>deleteTag(e.currentTarget.dataset.id, e.currentTarget.dataset.name));
        });
    }
    // addTagButton, openEditTagModal, saveTagEditButton, deleteTag - Ensure these are complete and correct.
    // Re-checking addTagButton
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


    // Item Management functions (loadItemsFromFirestore, renderItemsAdminTable, etc. are defined above)
    // ... (The rest of your item management, image upload, and modal handler functions)
    // Ensure all functions previously provided are included and complete.
    // I am re-adding the item related functions that were provided in the previous step.

    async function loadItemsFromFirestore() {
        console.log("[Items] Loading items from Firestore...");
        try {
            const q = query(collection(db, 'items'), orderBy('name', 'asc'));
            const snapshot = await getDocs(q);
            itemsCache = snapshot.docs.map(docSnap => ({ docId: docSnap.id, ...docSnap.data() }));
            console.log("[Items] Items loaded successfully:", itemsCache.length);
        } catch (error) {
            console.error("[Items] Error loading items from Firestore:", error);
            itemsCache = [];
        }
    }

    function renderItemsAdminTable() {
        if (!itemsTableBody) return;
        itemsTableBody.innerHTML = '';
        const searchTerm = itemSearchAdminInput ? itemSearchAdminInput.value.toLowerCase() : "";

        if (!itemsCache) {
             console.warn("itemsCache is not ready for renderItemsAdminTable");
             const tr = itemsTableBody.insertRow();
             const td = tr.insertCell(); td.colSpan = 5; td.textContent = "アイテムデータ準備中...";
             return;
        }

        const filteredItems = itemsCache.filter(item =>
            (item.name && item.name.toLowerCase().includes(searchTerm)) ||
            (!searchTerm && (item.name === "" || !item.name))
        );

        if (filteredItems.length === 0) {
            const tr = itemsTableBody.insertRow();
            const td = tr.insertCell(); td.colSpan = 5;
            td.textContent = searchTerm ? "該当アイテムなし" : "アイテム未登録";
            td.style.textAlign = "center";
            return;
        }

        filteredItems.forEach(item => {
            const tr = document.createElement('tr');
            const imageDisplayPath = item.image || '../images/placeholder_item.png';
            const itemTagsString = (item.tags || [])
                .map(tagId => allTagsCache.find(t => t.id === tagId)?.name).filter(Boolean).join(', ') || 'なし';
            let effectsDisplay = '(未設定)';
            if (item.structured_effects?.length > 0) {
                 effectsDisplay = item.structured_effects.map(eff => {
                     const typeInfo = effectTypesCache.find(et => et.id === eff.type);
                     const typeName = typeInfo ? typeInfo.name : `不明(${eff.type})`;
                     const unitObj = effectUnitsCache.find(u => u.value === eff.unit);
                     const unitText = unitObj ? unitObj.name : (eff.unit && eff.unit !== 'none' ? eff.unit : '');
                     return `${typeName}: ${eff.value}${unitText ? `(${unitText})` : ''}`;
                 }).join('; ');
                 if (effectsDisplay.length > 50) effectsDisplay = effectsDisplay.substring(0, 50) + '...';
            }
            const nameDisplay = item.name || '(名称未設定)';
            tr.innerHTML = `<td><img src="${imageDisplayPath}" alt="${nameDisplay}" onerror="this.onerror=null; this.src='../images/placeholder_item.png';"></td><td>${nameDisplay}</td><td>${effectsDisplay}</td><td>${itemTagsString}</td><td><button class="edit-item action-button" data-item-doc-id="${item.docId}">✎</button><button class="delete-item action-button delete" data-item-doc-id="${item.docId}" data-item-name="${nameDisplay}">×</button></td>`;
            tr.querySelector('.edit-item').addEventListener('click', () => loadItemForEdit(item.docId));
            tr.querySelector('.delete-item').addEventListener('click', (e) => deleteItem(e.currentTarget.dataset.itemDocId, e.currentTarget.dataset.itemName, item.image));
            itemsTableBody.appendChild(tr);
        });
    }

    async function loadItemForEdit(docId) {
        try {
            const itemSnap = await getDoc(doc(db, "items", docId));
            if (itemSnap.exists()) {
                const itemData = itemSnap.data();
                itemIdToEditInput.value = itemSnap.id;
                itemNameInput.value = itemData.name || "";
                itemSourceInput.value = itemData.入手手段 || "";
                itemImageUrlInput.value = itemData.image || '';
                itemImagePreview.src = itemData.image || '#';
                itemImagePreview.style.display = itemData.image ? 'block' : 'none';
                if (itemImageFileInput) itemImageFileInput.value = null; selectedImageFile = null;
                populateTagCheckboxesForItemForm(itemData.tags || []);
                currentItemEffects = itemData.structured_effects || [];
                renderCurrentItemEffectsList();
                if(effectTypeSelect) effectTypeSelect.value = '';
                if(effectValueInput) effectValueInput.value = '';
                updateEffectUnitDisplay();
                if (saveItemButton) saveItemButton.textContent = "アイテム更新";
                itemForm?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else { alert("編集対象アイテムが見つかりません。"); }
        } catch (error) { console.error("Err loading item for edit:", error); alert("編集データ読込エラー"); }
    }
    // deleteItem is already provided above (with loadItemsFromFirestore)

    // Remaining functions like populateCategoryCheckboxesForTagAssignment,
    // populateTagsForCategoryEdit, selectParentCategoryButton,
    // image upload, modal handlers should be included from the previous full versions.
    // Ensuring a few more are here:
    function populateCategoryCheckboxesForTagAssignment(containerElement, selectedCategoryIds = []) {
        if (!containerElement) return;
        containerElement.innerHTML = '';
        const assignableCategories = allCategoriesCache.filter(cat => cat.parentId && cat.parentId !== "");
        if (assignableCategories.length === 0) {
            containerElement.innerHTML = '<p>登録されている子カテゴリがありません。</p>'; return;
        }
        assignableCategories.sort((a,b) => {
            const pA = allCategoriesCache.find(p=>p.id===a.parentId)?.name||''; const pB = allCategoriesCache.find(p=>p.id===b.parentId)?.name||'';
            return pA.localeCompare(pB) || a.name.localeCompare(b.name);
        });
        assignableCategories.forEach(category => {
            const checkboxId = `tag-cat-${category.id}-${containerElement.id.replace(/\W/g, '')}`;
            const wrapper = document.createElement('div'); wrapper.classList.add('checkbox-item');
            const parentName = allCategoriesCache.find(p=>p.id===category.parentId)?.name || '不明';
            wrapper.innerHTML = `<input type="checkbox" id="${checkboxId}" name="tagCategory" value="${category.id}" ${selectedCategoryIds.includes(category.id)?'checked':''}><label for="${checkboxId}">${category.name} (親: ${parentName})</label>`;
            containerElement.appendChild(wrapper);
        });
    }

    if (itemImageFileInput) {
        itemImageFileInput.addEventListener('change', (event) => {
            selectedImageFile = event.target.files[0];
            if (selectedImageFile) {
                const reader = new FileReader();
                reader.onload = (e) => { itemImagePreview.src = e.target.result; itemImagePreview.style.display = 'block'; }
                reader.readAsDataURL(selectedImageFile);
                uploadProgressContainer.style.display = 'none';
            } else {
                itemImagePreview.src = itemImageUrlInput.value || '#';
                itemImagePreview.style.display = itemImageUrlInput.value ? 'block' : 'none';
                selectedImageFile = null;
            }
        });
    }
    async function uploadImageToWorkerAndGetURL(file) {
        if (!file) return null;
        uploadProgressContainer.style.display = 'block'; uploadProgress.value = 0; uploadProgressText.textContent = '準備中...';
        const formData = new FormData(); formData.append('imageFile', file);
        try {
            uploadProgressText.textContent = 'アップロード中...';
            const res = await fetch(IMAGE_UPLOAD_WORKER_URL, { method: 'POST', body: formData });
            if (!res.ok) { const errD = await res.json().catch(()=>({})); alert(`画像アップロード失敗: ${errD.error||res.statusText}`); return null;}
            const result = await res.json();
            if (result.success && result.imageUrl) { uploadProgressText.textContent = '完了!'; setTimeout(()=>uploadProgressContainer.style.display='none',2000); return result.imageUrl;}
            else { alert(`画像アップロードエラー: ${result.message||'不明'}`); return null;}
        } catch (e) { alert(`画像アップロード通信エラー: ${e.message}`); return null;}
        finally { if (uploadProgressContainer.style.display === 'block' && uploadProgressText.textContent !== '完了!') uploadProgressContainer.style.display = 'none';}
    }

    document.querySelectorAll('.modal .close-button').forEach(btn => {
        btn.onclick = function() { btn.closest('.modal').style.display = "none"; }
    });
    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) event.target.style.display = "none";
    }

}); // End DOMContentLoaded
