// admin.script.js (SortableJS, 階層表示, 単位管理機能対応)
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
    const effectTypeSelect = document.getElementById('effectTypeSelect');

    // Effect Unit Management (New)
    const newEffectUnitNameInput = document.getElementById('newEffectUnitName');
    const newEffectUnitValueInput = document.getElementById('newEffectUnitValue');
    const addEffectUnitButton = document.getElementById('addEffectUnitButton');
    const effectUnitListContainer = document.getElementById('effectUnitListContainer');
    // const editEffectUnitModal = document.getElementById('editEffectUnitModal'); // 必要に応じて
    // const editingEffectUnitDocIdInput = document.getElementById('editingEffectUnitDocId'); // 必要に応じて
    // const editingEffectUnitNameInput = document.getElementById('editingEffectUnitName'); // 必要に応じて
    // const editingEffectUnitValueInput = document.getElementById('editingEffectUnitValue'); // 必要に応じて
    // const saveEffectUnitEditButton = document.getElementById('saveEffectUnitEditButton'); // 必要に応じて


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
    let effectUnitsCache = []; // New
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
                    passwordError.textContent = `ログインエラー: ${error.message}`; // error.code は不要な場合あり
                });
        });
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            signOut(auth).catch(error => console.error("Logout error:", error));
        });
    }

    function clearAdminUI() {
        // ... (既存のクリア処理) ...
        if (effectUnitListContainer) effectUnitListContainer.innerHTML = '';
        // プルダウンも初期化
        if (newEffectTypeUnitSelect) newEffectTypeUnitSelect.innerHTML = '';
        if (editingEffectTypeUnitSelect) editingEffectTypeUnitSelect.innerHTML = '';
    }

    async function loadInitialData() {
        console.log("[Initial Load] Starting...");
        await loadEffectUnitsFromFirestore(); // 単位を先にロード
        await loadEffectTypesFromFirestore();
        await loadCategoriesFromFirestore();
        await loadTagsFromFirestore();
        await loadItemsFromFirestore();

        populateParentCategoryButtons(newCategoryParentButtons, selectedNewParentCategoryIdInput);
        populateCategoryCheckboxesForTagAssignment(newTagCategoriesCheckboxes);
        populateTagCheckboxesForItemForm();
        populateEffectTypeSelect();
        populateEffectUnitSelect(newEffectTypeUnitSelect); // 新規効果種類用
        // populateEffectUnitSelect(editingEffectTypeUnitSelect); // 編集効果種類用はモーダル表示時に

        renderCategoriesForManagement();
        renderTagsForManagement();
        renderEffectTypesForManagement();
        renderEffectUnitsForManagement(); // New
        renderItemsAdminTable();

        initializeAllSortableLists(); // SortableJSの初期化を最後に
        console.log("[Initial Load] Completed.");
    }

    // --- SortableJS Helper ---
    function initializeSortableList(listElement, collectionName, onUpdateCallback, additionalSortableOptions = {}) {
        if (!listElement || typeof Sortable === 'undefined') return;
        new Sortable(listElement, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            ...additionalSortableOptions,
            onEnd: async function (evt) {
                const items = Array.from(listElement.children);
                const batch = writeBatch(db);
                let reorderSuccess = true;
                items.forEach((itemElement, index) => {
                    const docId = itemElement.dataset.docId;
                    if (docId) {
                        const docRef = doc(db, collectionName, docId);
                        batch.update(docRef, { order: index });
                    } else {
                        console.warn("Sortable item missing data-doc-id:", itemElement);
                        reorderSuccess = false; // 一つでもIDがなければ更新しない方が安全
                    }
                });

                if (!reorderSuccess) {
                    alert(`${collectionName}の並び替え中にエラーが発生しました。要素のIDが正しく設定されていません。`);
                    if (onUpdateCallback) await onUpdateCallback(true); // エラーフラグを渡してリロードを強制
                    return;
                }

                try {
                    await batch.commit();
                    console.log(`${collectionName} order updated successfully.`);
                    if (onUpdateCallback) await onUpdateCallback();
                } catch (error) {
                    console.error(`Error updating ${collectionName} order:`, error);
                    alert(`${collectionName}の順序更新に失敗しました。`);
                    if (onUpdateCallback) await onUpdateCallback(true); // エラーでもコールバックを呼んでUIを元に戻す試み
                }
            }
        });
    }

    function initializeAllSortableLists() {
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
                populateTagCheckboxesForItemForm((itemIdToEditInput.value && itemsCache.find(i => i.docId === itemIdToEditInput.value)?.tags) || []);
            });
        }
        if (effectUnitListContainer) {
            initializeSortableList(effectUnitListContainer, 'effect_units', async (errorOccurred = false) => {
                await loadEffectUnitsFromFirestore();
                renderEffectUnitsForManagement();
                populateEffectUnitSelect(newEffectTypeUnitSelect);
                if (editEffectTypeModal.style.display === 'flex' && editingEffectTypeDocIdInput.value) {
                    const et = effectTypesCache.find(e => e.id === editingEffectTypeDocIdInput.value);
                    if(et) populateEffectUnitSelect(editingEffectTypeUnitSelect, et.defaultUnit);
                }
            });
        }
    }


    // --- Effect Unit Management (New) ---
    async function loadEffectUnitsFromFirestore() {
        console.log("[Effect Units] Loading effect units...");
        try {
            const q = query(collection(db, 'effect_units'), orderBy('order', 'asc'), orderBy('name', 'asc'));
            const snapshot = await getDocs(q);
            effectUnitsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("[Effect Units] Loaded:", effectUnitsCache);
        } catch (error) {
            console.error("[Effect Units] Error loading:", error);
            effectUnitsCache = [];
        }
    }

    function populateEffectUnitSelect(selectElement, selectedValue = null) {
        if (!selectElement) return;
        const currentValue = selectElement.value; // ユーザーが変更中の値を保持
        selectElement.innerHTML = '';
        if (effectUnitsCache.length === 0) {
            selectElement.add(new Option("単位未登録", ""));
            return;
        }
        effectUnitsCache.forEach(unit => {
            selectElement.add(new Option(unit.name, unit.value));
        });

        if (selectedValue && effectUnitsCache.some(u => u.value === selectedValue)) {
            selectElement.value = selectedValue;
        } else if (currentValue && effectUnitsCache.some(u => u.value === currentValue)) {
            selectElement.value = currentValue;
        } else if (effectUnitsCache.length > 0) {
            selectElement.value = effectUnitsCache[0].value;
        }
    }

    function renderEffectUnitsForManagement() {
        if (!effectUnitListContainer) return;
        effectUnitListContainer.innerHTML = '';
        if(effectUnitsCache.length === 0) {
            effectUnitListContainer.innerHTML = '<p>登録されている単位はありません。</p>';
            return;
        }
        effectUnitsCache.forEach(unit => {
            const div = document.createElement('div');
            div.classList.add('list-item');
            div.dataset.docId = unit.id; // For SortableJS
            div.innerHTML = `
                <span>${unit.name} (値: ${unit.value})</span>
                <div>
                    <!-- <button class="edit-effect-unit action-button" data-id="${unit.id}" title="編集">✎</button> -->
                    <button class="delete-effect-unit action-button delete" data-id="${unit.id}" data-name="${unit.name}" title="削除">×</button>
                </div>
            `;
            effectUnitListContainer.appendChild(div);

            // div.querySelector('.edit-effect-unit').addEventListener('click', () => openEditEffectUnitModal(unit));
            div.querySelector('.delete-effect-unit').addEventListener('click', (e) => deleteEffectUnit(e.currentTarget.dataset.id, e.currentTarget.dataset.name));
        });
    }

    if (addEffectUnitButton) {
        addEffectUnitButton.addEventListener('click', async () => {
            const name = newEffectUnitNameInput.value.trim();
            const value = newEffectUnitValueInput.value.trim();
            if (!name || !value) {
                alert("単位名と値を入力してください。"); return;
            }
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
                // If edit modal is open, update its select too
                if (editEffectTypeModal.style.display === 'flex') {
                     const currentEffectType = effectTypesCache.find(et => et.id === editingEffectTypeDocIdInput.value);
                     if(currentEffectType) populateEffectUnitSelect(editingEffectTypeUnitSelect, currentEffectType.defaultUnit);
                }
            } catch (error) {
                console.error("Error adding effect unit:", error);
                alert("単位の追加に失敗しました。");
            }
        });
    }

    async function deleteEffectUnit(id, name) {
        // 念のため、この単位を使用している効果種類がないか確認
        const usedByEffectTypes = effectTypesCache.filter(et => et.defaultUnit === effectUnitsCache.find(u=>u.id===id)?.value);
        if (usedByEffectTypes.length > 0) {
            alert(`単位「${name}」は以下の効果種類で使用されているため削除できません:\n${usedByEffectTypes.map(et => et.name).join(', ')}\nまず効果種類のデフォルト単位を変更してください。`);
            return;
        }

        if (confirm(`単位「${name}」を削除しますか？`)) {
            try {
                await deleteDoc(doc(db, 'effect_units', id));
                await loadEffectUnitsFromFirestore();
                renderEffectUnitsForManagement();
                populateEffectUnitSelect(newEffectTypeUnitSelect);
                if (editEffectTypeModal.style.display === 'flex') {
                     const currentEffectType = effectTypesCache.find(et => et.id === editingEffectTypeDocIdInput.value);
                     if(currentEffectType) populateEffectUnitSelect(editingEffectTypeUnitSelect, currentEffectType.defaultUnit);
                }
            } catch (error) {
                console.error("Error deleting effect unit:", error);
                alert("単位の削除に失敗しました。");
            }
        }
    }
    // TODO: openEditEffectUnitModal and saveEffectUnitEdit functions (similar to other entities)


    // --- Effect Type Management ---
    async function loadEffectTypesFromFirestore() {
        console.log("[Effect Types] Loading effect types...");
        try {
            const q = query(collection(db, 'effect_types'), orderBy('name'));
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
        if(effectTypesCache.length === 0) {
            effectTypeListContainer.innerHTML = "<p>登録されている効果種類はありません。</p>";
            return;
        }
        effectTypesCache.forEach(effectType => {
            const unitObj = effectUnitsCache.find(u => u.value === effectType.defaultUnit);
            const unitText = unitObj ? `(${unitObj.name})` : '(単位未設定)';
            const calcText = effectType.calculationMethod === 'max' ? '(最大値)' : '(加算)';
            const div = document.createElement('div');
            div.classList.add('list-item');
            // div.dataset.docId = effectType.id; // 効果種類は現状並び替え対象外
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
            const unitValue = newEffectTypeUnitSelect.value; // これは単位の value (e.g., "point")
            const calcMethodRadio = Array.from(newEffectTypeCalcMethodRadios).find(r => r.checked);
            const calcMethod = calcMethodRadio ? calcMethodRadio.value : 'sum';

            if (!name) { alert("効果種類名を入力してください。"); return; }
            if (!unitValue && effectUnitsCache.length > 0) { alert("デフォルト単位を選択してください。"); return; } // 単位が登録されている場合のみ必須
            if (effectTypesCache.some(et => et.name.toLowerCase() === name.toLowerCase())) {
                alert("同じ名前の効果種類が既に存在します。"); return;
            }
            try {
                await addDoc(collection(db, 'effect_types'), {
                    name: name,
                    defaultUnit: unitValue, // 保存するのは単位のvalue
                    calculationMethod: calcMethod,
                    createdAt: serverTimestamp()
                });
                newEffectTypeNameInput.value = '';
                if(effectUnitsCache.length > 0) newEffectTypeUnitSelect.value = effectUnitsCache[0].value; // Reset select
                if(newEffectTypeCalcMethodRadios[0]) newEffectTypeCalcMethodRadios[0].checked = true;

                await loadEffectTypesFromFirestore();
                renderEffectTypesForManagement();
                populateEffectTypeSelect(); // Item form's select
            } catch (error) {
                console.error("[Effect Types] Error adding:", error);
                alert("効果種類の追加に失敗しました。");
            }
        });
    }

    function openEditEffectTypeModal(effectTypeData) {
        editingEffectTypeDocIdInput.value = effectTypeData.id;
        editingEffectTypeNameInput.value = effectTypeData.name;
        populateEffectUnitSelect(editingEffectTypeUnitSelect, effectTypeData.defaultUnit); // Populate and set current unit

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
            if (!newUnitValue && effectUnitsCache.length > 0) { alert("デフォルト単位を選択してください。"); return; }
            if (effectTypesCache.some(et => et.id !== id && et.name.toLowerCase() === newName.toLowerCase())) {
                 alert("編集後の名前が他の効果種類と重複します。"); return;
            }
            try {
                await updateDoc(doc(db, 'effect_types', id), {
                    name: newName,
                    defaultUnit: newUnitValue,
                    calculationMethod: newCalcMethod
                 });
                if (editEffectTypeModal) editEffectTypeModal.style.display = 'none';
                await loadEffectTypesFromFirestore();
                renderEffectTypesForManagement();
                populateEffectTypeSelect();
                await loadItemsFromFirestore(); // Effects in items might need re-rendering if type name changes
                renderItemsAdminTable();
            } catch (error) {
                 console.error("[Effect Types] Error updating:", error);
                 alert("効果種類の更新に失敗しました。");
            }
        });
    }

    async function deleteEffectType(id, name) {
        // 念のため、この効果種類を使用しているアイテムがないか確認
        const itemsUsingThisType = itemsCache.filter(item =>
            item.structured_effects && item.structured_effects.some(eff => eff.type === id)
        );
        if (itemsUsingThisType.length > 0) {
            alert(`効果種類「${name}」は${itemsUsingThisType.length}個のアイテムで使用されているため、直接削除できません。\nまず該当アイテムの効果設定からこの種類を削除してください。`);
            return;
        }

         if (confirm(`効果種類「${name}」を削除しますか？`)) {
             try {
                 await deleteDoc(doc(db, 'effect_types', id));
                 await loadEffectTypesFromFirestore();
                 renderEffectTypesForManagement();
                 populateEffectTypeSelect();
                 // Items don't need reload as we checked they don't use this type
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
            const q = query(collection(db, 'categories'), orderBy('order', 'asc'), orderBy('name', 'asc'));
            const snapshot = await getDocs(q);
            allCategoriesCache = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
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

        const createButton = (text, parentIdVal) => {
            const btn = document.createElement('div');
            btn.classList.add('category-select-button');
            btn.textContent = text;
            btn.dataset.parentId = parentIdVal;
            if (selectedParentId === parentIdVal) {
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
            .sort((a,b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.name.localeCompare(b.name)) // Sort by order then name
            .forEach(cat => {
                buttonContainer.appendChild(createButton(cat.name, cat.id));
            });

        hiddenInput.value = selectedParentId; // Ensure hidden input is set
        // Trigger visual update for modal based on current parent selection
        if (buttonContainer === editingCategoryParentButtons) {
             const isParent = (selectedParentId === "");
             if (tagSearchModeGroup) tagSearchModeGroup.style.display = isParent ? 'none' : 'block';
             if (editCategoryTagsGroup) editCategoryTagsGroup.style.display = isParent ? 'none' : 'block';
        }
    }

    function selectParentCategoryButton(container, hiddenInput, clickedButton, parentId) {
        // ... (既存の selectParentCategoryButton ロジックはほぼ同じ) ...
        container.querySelectorAll('.category-select-button.active').forEach(activeBtn => {
            activeBtn.classList.remove('active');
        });
        clickedButton.classList.add('active');
        hiddenInput.value = parentId;
        console.log("[Category Parent Select] Selected Parent ID:", parentId);

        if (container === editingCategoryParentButtons) { // For edit category modal
             const isParent = (parentId === "");
             if (tagSearchModeGroup) tagSearchModeGroup.style.display = isParent ? 'none' : 'block';
             if (editCategoryTagsGroup) editCategoryTagsGroup.style.display = isParent ? 'none' : 'block';
             if (!isParent && editingTagSearchModeSelect) editingTagSearchModeSelect.value = allCategoriesCache.find(c=>c.id === editingCategoryDocIdInput.value)?.tagSearchMode || 'AND';
        }
    }

    function renderCategoriesForManagement() { // Hierarchical display
        if (!categoryListContainer) return;
        categoryListContainer.innerHTML = '';
        if (allCategoriesCache.length === 0) {
            categoryListContainer.innerHTML = '<p>登録されているカテゴリはありません。</p>';
            return;
        }

        const sortedCategories = [...allCategoriesCache].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.name.localeCompare(b.name));
        const parentCategories = sortedCategories.filter(category => !category.parentId || category.parentId === "");

        parentCategories.forEach(parentCategory => {
            appendCategoryToList(parentCategory, 0);
            const childCategories = sortedCategories.filter(category => category.parentId === parentCategory.id);
            childCategories.forEach(childCategory => {
                appendCategoryToList(childCategory, 1);
            });
        });

        function appendCategoryToList(category, indentLevel) {
            const div = document.createElement('div');
            div.classList.add('list-item');
            div.style.marginLeft = `${indentLevel * 25}px`; // Indent child categories
            div.dataset.docId = category.id; // For SortableJS

            let displayInfo = category.parentId ? `(子)` : "(親)";
            let searchModeInfo = category.parentId && category.tagSearchMode ? ` (${category.tagSearchMode}検索)` : '';

            div.innerHTML = `
                <span class="category-name-display">${category.name}</span>
                <span class="category-info-display">${displayInfo}${searchModeInfo}</span>
                <div class="category-actions">
                    <button class="edit-category action-button" data-category-id="${category.id}" title="編集">✎</button>
                    <button class="delete-category action-button delete" data-category-id="${category.id}" data-category-name="${category.name}" title="削除">×</button>
                </div>
            `;
            // Adjust styling for these new spans if needed in admin.style.css
            // e.g., .list-item { display: flex; justify-content: space-between; align-items: center; }
            // .list-item > span { flex-grow: 1; } /* Let name take up space */
            // .category-info-display { margin-left: 10px; color: #666; font-size: 0.9em; }
            // .category-actions { white-space: nowrap; }


            categoryListContainer.appendChild(div);
            div.querySelector('.edit-category').addEventListener('click', () => openEditCategoryModal(category));
            div.querySelector('.delete-category').addEventListener('click', (e) => deleteCategory(e.currentTarget.dataset.categoryId, e.currentTarget.dataset.categoryName));
        }
    }


    if (addCategoryButton) {
        addCategoryButton.addEventListener('click', async () => {
            const name = newCategoryNameInput.value.trim();
            const parentId = selectedNewParentCategoryIdInput.value;
            if (!name) { alert("カテゴリ名を入力してください。"); return; }

            const q = query(collection(db, 'categories'), where('name', '==', name), where('parentId', '==', parentId || ""));
            const existingQuery = await getDocs(q);
            if (!existingQuery.empty) { alert("同じ名前のカテゴリが同じ階層に既に存在します。"); return; }

            try {
                const newOrder = allCategoriesCache.filter(c => (c.parentId || "") === (parentId || "")).length;
                const categoryData = {
                    name: name,
                    parentId: parentId || "",
                    order: newOrder,
                    createdAt: serverTimestamp()
                };
                if (parentId) categoryData.tagSearchMode = 'AND'; // Default for new child

                await addDoc(collection(db, 'categories'), categoryData);
                newCategoryNameInput.value = '';
                // Reset parent selection to "Top Level"
                selectParentCategoryButton(newCategoryParentButtons, selectedNewParentCategoryIdInput, newCategoryParentButtons.querySelector('[data-parent-id=""]'), "");


                await loadCategoriesFromFirestore();
                renderCategoriesForManagement();
                populateParentCategoryButtons(newCategoryParentButtons, selectedNewParentCategoryIdInput); // Re-populate for new category to appear if it was a parent
                populateCategoryCheckboxesForTagAssignment(newTagCategoriesCheckboxes);
                // Update modals if open
                if (editCategoryModal.style.display === 'flex' && editingCategoryDocIdInput.value) {
                     const cat = allCategoriesCache.find(c => c.id === editingCategoryDocIdInput.value);
                     if(cat) populateParentCategoryButtons(editingCategoryParentButtons, selectedEditingParentCategoryIdInput, { currentCategoryIdToExclude: cat.id, selectedParentId: cat.parentId || "" });
                }
                 if (editTagModal.style.display === 'flex' && editingTagDocIdInput.value) {
                    const tagToRePopulate = allTagsCache.find(t => t.id === editingTagDocIdInput.value);
                    populateCategoryCheckboxesForTagAssignment(editingTagCategoriesCheckboxes, tagToRePopulate?.categoryIds || []);
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
        const currentParentId = category.parentId || "";
        populateParentCategoryButtons(editingCategoryParentButtons, selectedEditingParentCategoryIdInput, { currentCategoryIdToExclude: category.id, selectedParentId: currentParentId });

        const isParentCategory = !currentParentId;
        editCategoryTagsGroup.style.display = isParentCategory ? 'none' : 'block';
        tagSearchModeGroup.style.display = isParentCategory ? 'none' : 'block';

        if (!isParentCategory) {
            populateTagsForCategoryEdit(editingCategoryTagsSelector, category.id);
            editingTagSearchModeSelect.value = category.tagSearchMode || 'AND';
        } else {
            editingCategoryTagsSelector.innerHTML = '';
        }
        editCategoryModal.style.display = 'flex';
    }

    // ... (populateTagsForCategoryEdit, saveCategoryEditButton, deleteCategory - 既存のものを確認・調整。特にdeleteは子カテゴリやタグの連動削除に注意)
    // saveCategoryEditButton: parentIdの変更はorderの再計算も必要になる可能性
    // deleteCategory: 削除対象が親の場合、その子カテゴリのparentIdをクリアするか、一緒に削除するかの仕様。またorderの再計算。

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

            // Circular dependency check for parent change
            if (newParentId) {
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

                // Handle order if parentId changes
                if (originalCategory.parentId !== newParentId) {
                    // This category will be last in its new parent group
                    categoryUpdateData.order = allCategoriesCache.filter(c => (c.parentId || "") === newParentId && c.id !== docId).length;
                    // Re-order items in the old parent group (if it was not a top-level item before)
                    if (originalCategory.parentId) {
                        allCategoriesCache.filter(c => c.parentId === originalCategory.parentId && c.id !== docId)
                            .sort((a,b) => (a.order ?? Infinity) - (b.order ?? Infinity))
                            .forEach((sibling, index) => {
                                if (sibling.order !== index) { // Only update if order changed
                                     batch.update(doc(db, 'categories', sibling.id), { order: index });
                                }
                            });
                    }
                }


                if (newParentId) { // Is a child category
                    categoryUpdateData.tagSearchMode = newTagSearchMode;
                    const tagsCurrentlyAssociatedWithCat = allTagsCache.filter(tag => tag.categoryIds && tag.categoryIds.includes(docId)).map(t => t.id);

                    const tagsToAddLink = selectedTagIdsForThisCategory.filter(id => !tagsCurrentlyAssociatedWithCat.includes(id));
                    const tagsToRemoveLink = tagsCurrentlyAssociatedWithCat.filter(id => !selectedTagIdsForThisCategory.includes(id));

                    tagsToAddLink.forEach(tagId => batch.update(doc(db, 'tags', tagId), { categoryIds: arrayUnion(docId) }));
                    tagsToRemoveLink.forEach(tagId => batch.update(doc(db, 'tags', tagId), { categoryIds: arrayRemove(docId) }));
                } else { // Is becoming a parent category
                    categoryUpdateData.tagSearchMode = deleteField(); // Remove search mode
                    // Remove this category from all tags that might have had it
                    allTagsCache.forEach(tag => {
                        if (tag.categoryIds && tag.categoryIds.includes(docId)) {
                            batch.update(doc(db, 'tags', tag.id), { categoryIds: arrayRemove(docId) });
                        }
                    });
                }

                batch.update(doc(db, 'categories', docId), categoryUpdateData);
                await batch.commit();

                editCategoryModal.style.display = 'none';
                await loadInitialData(); // Reload all data as multiple collections might be affected

            } catch (error) {
                console.error("[Category Edit] Error:", error);
                alert("カテゴリの更新または関連情報の更新に失敗しました。");
            }
        });
    }

    async function deleteCategory(docId, categoryName) {
        // Check for child categories
        const childCheckQuery = query(collection(db, 'categories'), where('parentId', '==', docId));
        const childSnapshot = await getDocs(childCheckQuery);
        if (!childSnapshot.empty) {
            alert(`カテゴリ「${categoryName}」には子カテゴリが存在するため削除できません。\nまず子カテゴリを削除または移動してください。`);
            return;
        }

        // Check for tags associated with this category (if it's a child category)
        // For parent categories, tags are not directly associated in this model, but items might be via child cats/tags
        const categoryToDelete = allCategoriesCache.find(c => c.id === docId);
        if (categoryToDelete && categoryToDelete.parentId) { // If it's a child category
            const tagsUsingThisCategoryQuery = query(collection(db, 'tags'), where('categoryIds', 'array-contains', docId));
            const tagsSnapshot = await getDocs(tagsUsingThisCategoryQuery);
            if (!tagsSnapshot.empty) {
                 alert(`カテゴリ「${categoryName}」は${tagsSnapshot.size}個のタグで使用されています。\nまずタグの関連付けを解除してください（カテゴリ編集画面から）。`);
                 return;
            }
        }


        if (confirm(`カテゴリ「${categoryName}」を削除しますか？\nこのカテゴリを参照しているタグの関連付けも解除されます（自動）。\n(注意: このカテゴリ内のアイテムの扱いについては別途確認が必要です)`)) {
            try {
                const batch = writeBatch(db);
                // If it's a child category, remove its ID from tags' categoryIds
                if (categoryToDelete && categoryToDelete.parentId) {
                    const tagsToUpdateQuery = query(collection(db, 'tags'), where('categoryIds', 'array-contains', docId));
                    const tagsSnapshot = await getDocs(tagsToUpdateQuery);
                    tagsSnapshot.forEach(tagDoc => {
                        batch.update(tagDoc.ref, { categoryIds: arrayRemove(docId) });
                    });
                }
                batch.delete(doc(db, 'categories', docId));

                // Re-order siblings of the deleted category
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
                alert("カテゴリの削除または関連情報の更新に失敗しました。");
            }
        }
    }


    // --- Tag Management ---
    async function loadTagsFromFirestore() {
        console.log("[Tags] Loading all tags...");
        try {
            const q = query(collection(db, 'tags'), orderBy('order', 'asc'), orderBy('name', 'asc'));
            const snapshot = await getDocs(q);
            allTagsCache = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
            console.log("[Tags] All tags loaded:", allTagsCache);
        } catch (error) {
            console.error("[Tags] Error loading tags:", error);
            allTagsCache = [];
        }
    }

    function populateCategoryCheckboxesForTagAssignment(containerElement, selectedCategoryIds = []) {
        if (!containerElement) return;
        containerElement.innerHTML = '';
        const assignableCategories = allCategoriesCache.filter(cat => cat.parentId && cat.parentId !== ""); // Only child categories

        if (assignableCategories.length === 0) {
            containerElement.innerHTML = '<p>登録されている子カテゴリがありません。</p>';
            return;
        }
        // Sort assignable categories by parent name, then child name for better readability
        assignableCategories.sort((a,b) => {
            const parentA = allCategoriesCache.find(p => p.id === a.parentId)?.name || '';
            const parentB = allCategoriesCache.find(p => p.id === b.parentId)?.name || '';
            if (parentA !== parentB) return parentA.localeCompare(parentB);
            return a.name.localeCompare(b.name);
        });


        assignableCategories.forEach(category => {
            const checkboxId = `tag-cat-${category.id}-${containerElement.id.replace(/\W/g, '')}`; // Unique ID
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

    function renderTagsForManagement() {
        if (!tagListContainer) return;
        tagListContainer.innerHTML = '';
        if (allTagsCache.length === 0) {
            tagListContainer.innerHTML = '<p>登録されているタグはありません。</p>';
            return;
        }
        allTagsCache.forEach(tag => {
            const belongingCategories = (tag.categoryIds || [])
                .map(catId => {
                    const cat = allCategoriesCache.find(c => c.id === catId);
                    if (!cat || !cat.parentId) return null; // Ensure it's a child category
                    let name = cat.name;
                    const parentCat = allCategoriesCache.find(p => p.id === cat.parentId);
                    name += parentCat ? ` (親:${parentCat.name})` : ` (親:不明)`;
                    return name;
                })
                .filter(name => name)
                .join(', ') || '未分類';

            const div = document.createElement('div');
            div.classList.add('list-item');
            div.dataset.docId = tag.id; // For SortableJS
            div.innerHTML = `
                <span>${tag.name} (所属: ${belongingCategories})</span>
                <div>
                    <button class="edit-tag action-button" data-tag-id="${tag.id}" title="編集">✎</button>
                    <button class="delete-tag action-button delete" data-tag-id="${tag.id}" data-tag-name="${tag.name}" title="削除">×</button>
                </div>
            `;
            tagListContainer.appendChild(div);
            div.querySelector('.edit-tag').addEventListener('click', () => openEditTagModal(tag));
            div.querySelector('.delete-tag').addEventListener('click', (e) => deleteTag(e.currentTarget.dataset.tagId, e.currentTarget.dataset.tagName));
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
                const newOrder = allTagsCache.length;
                await addDoc(collection(db, 'tags'), {
                    name: name,
                    categoryIds: selectedCategoryIds,
                    order: newOrder,
                    createdAt: serverTimestamp()
                });
                newTagNameInput.value = '';
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

    function openEditTagModal(tag) {
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
                });
                editTagModal.style.display = 'none';
                await loadTagsFromFirestore();
                renderTagsForManagement();
                populateTagCheckboxesForItemForm((itemIdToEditInput.value && itemsCache.find(i => i.docId === itemIdToEditInput.value)?.tags) || []);
                await loadItemsFromFirestore(); // Items using this tag might need UI update in items list
                renderItemsAdminTable();
            } catch (error) {
                console.error("[Tag Edit] Error:", error);
                alert("タグの更新に失敗しました。");
            }
        });
    }

    async function deleteTag(docId, tagName) {
        // Check if items use this tag
        const itemsUsingTagQuery = query(collection(db, 'items'), where('tags', 'array-contains', docId));
        const itemsSnapshot = await getDocs(itemsUsingTagQuery);
        if (!itemsSnapshot.empty) {
            alert(`タグ「${tagName}」は${itemsSnapshot.size}個のアイテムで使用されています。\nまずアイテムからこのタグを削除してください。`);
            return;
        }

        if (confirm(`タグ「${tagName}」を削除しますか？`)) {
            try {
                const batch = writeBatch(db);
                batch.delete(doc(db, 'tags', docId));

                // Re-order remaining tags
                allTagsCache.filter(t => t.id !== docId)
                    .sort((a,b) => (a.order ?? Infinity) - (b.order ?? Infinity))
                    .forEach((tag, index) => {
                        if(tag.order !== index) {
                             batch.update(doc(db, 'tags', tag.id), { order: index });
                        }
                    });

                await batch.commit();
                await loadTagsFromFirestore();
                renderTagsForManagement();
                populateTagCheckboxesForItemForm((itemIdToEditInput.value && itemsCache.find(i => i.docId === itemIdToEditInput.value)?.tags) || []);
                // No need to reload items if we confirmed no items use it.
            } catch (error) {
                console.error("[Tag Delete] Error:", error);
                alert("タグの削除に失敗しました。");
            }
        }
    }


    // --- Item Management (Effect Type Select & Unit Display) ---
    function populateTagCheckboxesForItemForm(selectedTagIds = []) {
        if (!itemTagsSelectorCheckboxes) return;
        itemTagsSelectorCheckboxes.innerHTML = '';
        if (allTagsCache.length === 0) {
            itemTagsSelectorCheckboxes.innerHTML = '<p>登録されているタグがありません。</p>';
            return;
        }
        // Sort tags for consistent display
        const sortedTags = [...allTagsCache].sort((a,b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.name.localeCompare(b.name));

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

    function populateEffectTypeSelect() { // For item form
        if (!effectTypeSelect) return;
        const currentVal = effectTypeSelect.value;
        effectTypeSelect.innerHTML = '<option value="">効果種類を選択...</option>';
        effectTypesCache.forEach(et => {
            effectTypeSelect.add(new Option(et.name, et.id));
        });
        if (currentVal && effectTypesCache.some(et => et.id === currentVal)) {
            effectTypeSelect.value = currentVal;
        }
        updateEffectUnitDisplay(); // Update unit display based on (potentially cleared) selection
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
        // ... (既存の renderCurrentItemEffectsList のロジック) ...
        // Ensure unit display uses unit name from effectUnitsCache if possible
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
            // Use the defaultUnit from the selected effect type
            const unitValue = selectedEffectType ? (selectedEffectType.defaultUnit || 'none') : 'none';

            currentItemEffects.push({ type: typeId, value: value, unit: unitValue }); // Store unit's value
            renderCurrentItemEffectsList();

            effectTypeSelect.value = '';
            effectValueInput.value = '';
            updateEffectUnitDisplay(); // Clear unit display
        });
    }

    // --- Item Management (Load, Save, Delete, Render Table) ---
    async function loadItemsFromFirestore() {
        console.log("[Items] Loading items from Firestore...");
        try {
            // Items don't have a user-defined order, sort by name or timestamp
            const q = query(collection(db, 'items'), orderBy('name', 'asc'));
            const snapshot = await getDocs(q);
            itemsCache = snapshot.docs.map(docSnap => ({ docId: docSnap.id, ...docSnap.data() }));
            console.log("[Items] Items loaded successfully:", itemsCache.length);
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
            let imageUrl = itemImageUrlInput.value; // Existing URL

            saveItemButton.disabled = true; saveItemButton.textContent = "保存中...";
            try {
                if (selectedImageFile) { // If new file is selected, upload it
                    imageUrl = await uploadImageToWorkerAndGetURL(selectedImageFile);
                    if (imageUrl === null) { // Upload failed
                        saveItemButton.disabled = false; saveItemButton.textContent = editingDocId ? "アイテム更新" : "アイテム保存";
                        return;
                    }
                }
                const itemData = {
                    name: name || "",
                    image: imageUrl || "", // Use uploaded or existing URL
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
                saveItemButton.textContent = itemIdToEditInput.value ? "アイテム更新" : "アイテム保存"; // Check original itemIdToEdit
            }
        });
    }

    if (clearFormButton) clearFormButton.addEventListener('click', clearItemForm);

    function clearItemForm() {
        if (itemForm) itemForm.reset();
        itemIdToEditInput.value = '';
        itemImageUrlInput.value = ''; // Clear hidden URL field
        if (itemImagePreview) { itemImagePreview.src = '#'; itemImagePreview.style.display = 'none'; }
        if (itemImageFileInput) itemImageFileInput.value = null; // Clear file input
        selectedImageFile = null; // Clear JS variable
        uploadProgressContainer.style.display = 'none';
        populateTagCheckboxesForItemForm(); // Clear tag selections

        currentItemEffects = [];
        renderCurrentItemEffectsList();
        if(effectTypeSelect) effectTypeSelect.value = '';
        if(effectValueInput) effectValueInput.value = '';
        updateEffectUnitDisplay(); // Clear unit display

        if (saveItemButton) saveItemButton.textContent = "アイテム保存";
    }

    function renderItemsAdminTable() {
        if (!itemsTableBody) return;
        itemsTableBody.innerHTML = '';
        const searchTerm = itemSearchAdminInput ? itemSearchAdminInput.value.toLowerCase() : "";
        const filteredItems = itemsCache.filter(item =>
            (item.name && item.name.toLowerCase().includes(searchTerm)) ||
            (!searchTerm && (item.name === "" || !item.name)) // Show unnamed if search is empty
        );

        if (filteredItems.length === 0) {
            const tr = itemsTableBody.insertRow();
            const td = tr.insertCell();
            td.colSpan = 5; // Number of columns
            td.textContent = searchTerm ? "該当するアイテムはありません。" : "登録されているアイテムはありません。";
            td.style.textAlign = "center";
            return;
        }

        filteredItems.forEach(item => {
            const tr = document.createElement('tr');
            const imageDisplayPath = item.image || '../images/placeholder_item.png'; // Fallback placeholder
            const itemTagsString = (item.tags || [])
                .map(tagId => allTagsCache.find(t => t.id === tagId)?.name)
                .filter(name => name)
                .join(', ') || 'なし';

            let effectsDisplay = '(未設定)';
            if (item.structured_effects && item.structured_effects.length > 0) {
                 effectsDisplay = item.structured_effects.map(eff => {
                     const typeInfo = effectTypesCache.find(et => et.id === eff.type);
                     const typeName = typeInfo ? typeInfo.name : `不明(${eff.type})`;
                     const unitObj = effectUnitsCache.find(u => u.value === eff.unit);
                     const unitText = unitObj ? unitObj.name : (eff.unit !== 'none' ? eff.unit : '');
                     const displayUnit = unitText ? `(${unitText})` : '';
                     return `${typeName}: ${eff.value}${displayUnit}`;
                 }).join('; ');
                 if (effectsDisplay.length > 50) effectsDisplay = effectsDisplay.substring(0, 50) + '...';
            }

            const nameDisplay = item.name || '(名称未設定)';
            tr.innerHTML = `
                <td><img src="${imageDisplayPath}" alt="${nameDisplay}" onerror="this.onerror=null; this.src='../images/placeholder_item.png';"></td>
                <td>${nameDisplay}</td><td>${effectsDisplay}</td><td>${itemTagsString}</td>
                <td>
                    <button class="edit-item action-button" data-item-doc-id="${item.docId}" title="編集">✎</button>
                    <button class="delete-item action-button delete" data-item-doc-id="${item.docId}" data-item-name="${nameDisplay}" title="削除">×</button>
                </td>`; // Pass name for delete confirmation
            tr.querySelector('.edit-item').addEventListener('click', () => loadItemForEdit(item.docId));
            tr.querySelector('.delete-item').addEventListener('click', (e) => deleteItem(e.currentTarget.dataset.itemDocId, e.currentTarget.dataset.itemName, item.image));
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
                itemImageUrlInput.value = itemData.image || ''; // Store existing URL
                if (itemData.image) {
                    itemImagePreview.src = itemData.image; itemImagePreview.style.display = 'block';
                } else {
                    itemImagePreview.src = '#'; itemImagePreview.style.display = 'none';
                }
                if (itemImageFileInput) itemImageFileInput.value = null; selectedImageFile = null; // Clear file input

                populateTagCheckboxesForItemForm(itemData.tags || []);

                currentItemEffects = itemData.structured_effects || [];
                renderCurrentItemEffectsList();
                if(effectTypeSelect) effectTypeSelect.value = '';
                if(effectValueInput) effectValueInput.value = '';
                updateEffectUnitDisplay();

                if (saveItemButton) saveItemButton.textContent = "アイテム更新";
                if (itemForm) itemForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else { alert("編集対象のアイテムが見つかりませんでした。"); }
        } catch (error) { console.error("[Item Edit] Error loading:", error); alert("編集データ読込エラー"); }
    }

    async function deleteItem(docId, itemName, imageUrl) { // itemName passed for confirmation
        if (confirm(`アイテム「${itemName}」を削除しますか？\nCloudflare R2上の関連画像は手動での削除が必要です。`)) {
            try {
                await deleteDoc(doc(db, 'items', docId));
                if (imageUrl) {
                    console.warn(`Image ${imageUrl} (R2) for item ${docId} might need manual deletion if it's not referenced elsewhere.`);
                }
                await loadItemsFromFirestore(); // Reload to reflect deletion
                renderItemsAdminTable();
                if (itemIdToEditInput.value === docId) clearItemForm(); // If deleting the item currently in form
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
                // itemImageUrlInput.value = ''; // Don't clear if user wants to revert to existing URL by not saving
                uploadProgressContainer.style.display = 'none'; // Hide progress until upload starts
            } else { // File deselected
                // Revert to existing image if available, or hide preview
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
        // ... (既存の uploadImageToWorkerAndGetURL ロジック) ...
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
