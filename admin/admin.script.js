// admin.script.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import {
    getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import {
    getFirestore, collection, getDocs, addDoc, doc, updateDoc, deleteDoc,
    query, where, orderBy, serverTimestamp, writeBatch, getDoc,
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

    const newTagNameInput = document.getElementById('newTagName');
    const newTagCategoriesCheckboxes = document.getElementById('newTagCategoriesCheckboxes');
    const addTagButton = document.getElementById('addTagButton');
    const tagListContainer = document.getElementById('tagListContainer');
    const editTagModal = document.getElementById('editTagModal');
    const editingTagDocIdInput = document.getElementById('editingTagDocId');
    const editingTagNameInput = document.getElementById('editingTagName');
    const editingTagCategoriesCheckboxes = document.getElementById('editingTagCategoriesCheckboxes');
    const saveTagEditButton = document.getElementById('saveTagEditButton');

    const newEffectUnitNameInput = document.getElementById('newEffectUnitName');
    const addEffectUnitButton = document.getElementById('addEffectUnitButton');
    const effectUnitListContainer = document.getElementById('effectUnitListContainer');
    const editEffectUnitModal = document.getElementById('editEffectUnitModal');
    const editingEffectUnitDocIdInput = document.getElementById('editingEffectUnitDocId');
    const editingEffectUnitNameInput = document.getElementById('editingEffectUnitName');
    const saveEffectUnitEditButton = document.getElementById('saveEffectUnitEditButton');
    const manageUnitsForNewEffectTypeButton = document.getElementById('manageUnitsForNewEffectTypeButton');
    const manageUnitsForEditingEffectTypeButton = document.getElementById('manageUnitsForEditingEffectTypeButton');

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

    const characterBaseTypeSelect = document.getElementById('characterBaseTypeSelect');
    const characterBaseOptionForm = document.getElementById('characterBaseOptionForm');
    const editingCharacterBaseOptionDocIdInput = document.getElementById('editingCharacterBaseOptionDocId');
    const characterBaseOptionNameInput = document.getElementById('characterBaseOptionName');
    const charBaseEffectTypeSelect = document.getElementById('charBaseEffectTypeSelect');
    const charBaseEffectValueInput = document.getElementById('charBaseEffectValueInput');
    const charBaseEffectUnitDisplay = document.getElementById('charBaseEffectUnitDisplay');
    const addCharBaseEffectToListButton = document.getElementById('addCharBaseEffectToListButton');
    const currentCharBaseEffectsList = document.getElementById('currentCharBaseEffectsList');
    const saveCharacterBaseOptionButton = document.getElementById('saveCharacterBaseOptionButton');
    const clearCharacterBaseOptionFormButton = document.getElementById('clearCharacterBaseOptionFormButton');
    const selectedCharacterBaseTypeNameSpan = document.getElementById('selectedCharacterBaseTypeName');
    const characterBaseOptionListContainer = document.getElementById('characterBaseOptionListContainer');

    const itemForm = document.getElementById('itemForm');
    const itemIdToEditInput = document.getElementById('itemIdToEdit');
    const itemNameInput = document.getElementById('itemName');
    const itemImageFileInput = document.getElementById('itemImageFile');
    const itemImagePreview = document.getElementById('itemImagePreview');
    const itemImageUrlInput = document.getElementById('itemImageUrl');
    const itemPriceInput = document.getElementById('itemPrice');
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
    let characterBasesCache = {};
    let currentItemEffects = [];
    let currentCharBaseOptionEffects = [];
    let selectedImageFile = null;

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

    if (loginButton) { /* ... (existing code) ... */ }
    if (logoutButton) { /* ... (existing code) ... */ }

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

        if (effectUnitListContainer) effectUnitListContainer.innerHTML = '';
        if (newEffectUnitNameInput) newEffectUnitNameInput.value = '';

        if (effectTypeListContainer) effectTypeListContainer.innerHTML = '';
        if (effectTypeSelect) effectTypeSelect.innerHTML = '<option value="">効果種類を選択...</option>';
        if (newEffectTypeNameInput) newEffectTypeNameInput.value = '';
        if (newEffectTypeUnitSelect) newEffectTypeUnitSelect.innerHTML = '<option value="none">なし</option>';
        if (newEffectTypeCalcMethodRadios[0]) newEffectTypeCalcMethodRadios[0].checked = true;

        if (characterBaseTypeSelect) characterBaseTypeSelect.value = 'headShape';
        if (characterBaseOptionForm) characterBaseOptionForm.reset();
        if (editingCharacterBaseOptionDocIdInput) editingCharacterBaseOptionDocIdInput.value = '';
        if (currentCharBaseEffectsList) currentCharBaseEffectsList.innerHTML = '<p>効果が追加されていません。</p>';
        if (characterBaseOptionListContainer) characterBaseOptionListContainer.innerHTML = '';
        if (selectedCharacterBaseTypeNameSpan && characterBaseTypeSelect) {
             const selectedOption = characterBaseTypeSelect.options[characterBaseTypeSelect.selectedIndex];
             selectedCharacterBaseTypeNameSpan.textContent = selectedOption ? selectedOption.text : '頭の形';
        }
        currentCharBaseOptionEffects = [];

        if (itemsTableBody) itemsTableBody.innerHTML = '';
        if (itemTagsSelectorCheckboxes) itemTagsSelectorCheckboxes.innerHTML = '';
        clearItemForm();

        allCategoriesCache = [];
        allTagsCache = [];
        itemsCache = [];
        effectTypesCache = [];
        effectUnitsCache = [];
        characterBasesCache = {};
        currentItemEffects = [];
        currentCharBaseOptionEffects = [];
    }

    async function loadInitialData() {
        console.log("[Initial Load] Starting...");
        await loadEffectUnitsFromFirestore();
        await loadEffectTypesFromFirestore();
        await loadCategoriesFromFirestore();
        await loadTagsFromFirestore();
        await loadCharacterBasesFromFirestore();
        await loadItemsFromFirestore();

        populateParentCategoryButtons(newCategoryParentButtons, selectedNewParentCategoryIdInput);
        populateCategoryCheckboxesForTagAssignment(newTagCategoriesCheckboxes);
        populateTagCheckboxesForItemForm();
        populateEffectUnitSelects();
        populateEffectTypeSelect(effectTypeSelect); // For item form
        populateEffectTypeSelect(charBaseEffectTypeSelect); // For char base form

        renderCategoriesForManagement();
        renderTagsForManagement();
        renderEffectUnitsForManagement();
        renderEffectTypesForManagement();
        if (characterBaseTypeSelect) { // Initial render for default selected base type
            const selectedOption = characterBaseTypeSelect.options[characterBaseTypeSelect.selectedIndex];
            if(selectedCharacterBaseTypeNameSpan && selectedOption) selectedCharacterBaseTypeNameSpan.textContent = selectedOption.text;
            renderCharacterBaseOptionsList();
        }
        renderItemsAdminTable();
        console.log("[Initial Load] Completed.");
    }

    // --- Effect Unit Management ---
    async function loadEffectUnitsFromFirestore() { /* ... (no changes) ... */ }
    function renderEffectUnitsForManagement(openModalForId = null) { /* ... (no changes) ... */ }
    if(manageUnitsForNewEffectTypeButton) manageUnitsForNewEffectTypeButton.addEventListener('click', () => renderEffectUnitsForManagement("manageUnits"));
    if(manageUnitsForEditingEffectTypeButton) manageUnitsForEditingEffectTypeButton.addEventListener('click', () => renderEffectUnitsForManagement("manageUnits"));
    if (addEffectUnitButton) { addEffectUnitButton.addEventListener('click', async () => { /* ... (no changes) ... */ }); }
    function openEditEffectUnitModal(unitData) { /* ... (no changes) ... */ }
    if (saveEffectUnitEditButton) { saveEffectUnitEditButton.addEventListener('click', async () => { /* ... (no changes, ensure loadInitialData or relevant reloads happen) ... */ }); }
    async function deleteEffectUnit(id, name) { /* ... (no changes, ensure loadInitialData or relevant reloads happen) ... */ }
    function populateEffectUnitSelects() { /* ... (no changes) ... */ }


    // --- Effect Type Management ---
    async function loadEffectTypesFromFirestore() { /* ... (no changes) ... */ }
    function renderEffectTypesForManagement() { /* ... (no changes) ... */ }
    if (addEffectTypeButton) { addEffectTypeButton.addEventListener('click', async () => { /* ... (no changes) ... */ }); }
    function openEditEffectTypeModal(effectTypeData) { /* ... (no changes) ... */ }
    if (saveEffectTypeEditButton) { saveEffectTypeEditButton.addEventListener('click', async () => { /* ... (no changes) ... */ }); }
    async function deleteEffectType(id, name) { /* ... (no changes) ... */ }
    function populateEffectTypeSelect(targetSelectElement) { /* ... (no changes) ... */ }
    if (effectTypeSelect) { effectTypeSelect.addEventListener('change', () => updateUnitDisplayForEffectType(effectTypeSelect, effectUnitDisplay)); }
    if (charBaseEffectTypeSelect) { charBaseEffectTypeSelect.addEventListener('change', () => updateUnitDisplayForEffectType(charBaseEffectTypeSelect, charBaseEffectUnitDisplay));}
    function updateUnitDisplayForEffectType(typeSelectElement, unitDisplayElement) { /* ... (no changes) ... */ }


    // --- Category Management ---
    async function loadCategoriesFromFirestore() { /* ... (no changes) ... */ }
    function populateParentCategoryButtons(buttonContainer, hiddenInput, options = {}) { /* ... (no changes) ... */ }
    function selectParentCategoryButton(container, hiddenInput, clickedButton, parentId) { /* ... (no changes) ... */ }
    function renderCategoriesForManagement() { /* ... (no changes) ... */ }
    if (addCategoryButton) { addCategoryButton.addEventListener('click', async () => { /* ... (no changes) ... */ }); }
    function openEditCategoryModal(category) { /* ... (no changes) ... */ }
    function populateTagsForCategoryEdit(containerElement, categoryId) { /* ... (no changes) ... */ }
    if (saveCategoryEditButton) { saveCategoryEditButton.addEventListener('click', async () => { /* ... (no changes) ... */ }); }
    async function deleteCategory(docId, categoryName) { /* ... (no changes) ... */ }


    // --- Tag Management ---
    async function loadTagsFromFirestore() { /* ... (no changes) ... */ }
    function populateCategoryCheckboxesForTagAssignment(containerElement, selectedCategoryIds = []) { /* ... (no changes) ... */ }
    function renderTagsForManagement() { /* ... (no changes) ... */ }
    if (addTagButton) { addTagButton.addEventListener('click', async () => { /* ... (no changes) ... */ }); }
    function openEditTagModal(docId, currentName, currentCategoryIds) { /* ... (no changes) ... */ }
    if (saveTagEditButton) { saveTagEditButton.addEventListener('click', async () => { /* ... (no changes) ... */ }); }
    async function deleteTag(docId, tagName) { /* ... (no changes) ... */ }

    // --- Character Base Management (NEW SECTION) ---
    const CHARACTER_BASE_COLLECTION_PREFIX = "char_base_";

    async function loadCharacterBasesFromFirestore() {
        console.log("[Character Bases] Loading all character base options...");
        characterBasesCache = {};
        const baseTypes = ['headShape', 'correction', 'color', 'pattern'];
        try {
            for (const type of baseTypes) {
                const collectionName = `${CHARACTER_BASE_COLLECTION_PREFIX}${type}`;
                const q = query(collection(db, collectionName), orderBy('name'));
                const snapshot = await getDocs(q);
                characterBasesCache[type] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                console.log(`[Character Bases] Loaded ${type}:`, characterBasesCache[type].length);
            }
            console.log("[Character Bases] All loaded:", characterBasesCache);
        } catch (error) {
            console.error("[Character Bases] Error loading:", error);
        }
    }

    if (characterBaseTypeSelect) {
        characterBaseTypeSelect.addEventListener('change', () => {
            const selectedOptionText = characterBaseTypeSelect.options[characterBaseTypeSelect.selectedIndex].text;
            if(selectedCharacterBaseTypeNameSpan) selectedCharacterBaseTypeNameSpan.textContent = selectedOptionText;
            clearCharacterBaseOptionForm();
            renderCharacterBaseOptionsList();
        });
    }

    function clearCharacterBaseOptionForm() {
        if(characterBaseOptionForm) characterBaseOptionForm.reset();
        if(editingCharacterBaseOptionDocIdInput) editingCharacterBaseOptionDocIdInput.value = '';
        if(currentCharBaseEffectsList) currentCharBaseEffectsList.innerHTML = '<p>効果が追加されていません。</p>';
        currentCharBaseOptionEffects = [];
        if(charBaseEffectTypeSelect) charBaseEffectTypeSelect.value = '';
        if(charBaseEffectValueInput) charBaseEffectValueInput.value = '';
        if(charBaseEffectUnitDisplay) charBaseEffectUnitDisplay.textContent = '';
        if(characterBaseOptionNameInput) characterBaseOptionNameInput.focus();
    }
    if(clearCharacterBaseOptionFormButton) clearCharacterBaseOptionFormButton.addEventListener('click', clearCharacterBaseOptionForm);


    function renderCharacterBaseOptionsList() {
        if (!characterBaseOptionListContainer || !characterBaseTypeSelect) return;
        const selectedTypeKey = characterBaseTypeSelect.value;
        characterBaseOptionListContainer.innerHTML = '';
        const options = characterBasesCache[selectedTypeKey] || [];

        if (options.length === 0) {
            characterBaseOptionListContainer.innerHTML = '<p>この種類のオプションはまだ登録されていません。</p>';
            return;
        }

        options.forEach(option => {
            let effectsSummary = 'なし';
            if (option.effects && option.effects.length > 0) {
                effectsSummary = option.effects.map(eff => {
                    const typeInfo = effectTypesCache.find(et => et.id === eff.type);
                    const unitText = (eff.unit && eff.unit !== 'none') ? `(${eff.unit})` : '';
                    return `${typeInfo ? typeInfo.name : '不明'}: ${eff.value}${unitText}`;
                }).join(', ');
                 if(effectsSummary.length > 30) effectsSummary = effectsSummary.substring(0, 27) + "...";
            }

            const div = document.createElement('div');
            div.classList.add('list-item');
            div.innerHTML = `
                <span>${option.name} <small style="color: #555;">(効果: ${effectsSummary})</small></span>
                <div>
                    <button class="edit-char-base-option action-button" data-id="${option.id}" title="編集">✎</button>
                    <button class="delete-char-base-option action-button delete" data-id="${option.id}" data-name="${option.name}" title="削除">×</button>
                </div>
            `;
            characterBaseOptionListContainer.appendChild(div);
        });

        characterBaseOptionListContainer.querySelectorAll('.edit-char-base-option').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const optionId = e.currentTarget.dataset.id;
                const optionData = characterBasesCache[selectedTypeKey]?.find(opt => opt.id === optionId);
                if (optionData) loadCharacterBaseOptionForEdit(optionData);
            });
        });
        characterBaseOptionListContainer.querySelectorAll('.delete-char-base-option').forEach(btn => {
            btn.addEventListener('click', (e) => deleteCharacterBaseOption(e.currentTarget.dataset.id, e.currentTarget.dataset.name));
        });
    }

    function loadCharacterBaseOptionForEdit(optionData) {
        editingCharacterBaseOptionDocIdInput.value = optionData.id;
        characterBaseOptionNameInput.value = optionData.name;
        currentCharBaseOptionEffects = optionData.effects ? JSON.parse(JSON.stringify(optionData.effects)) : [];
        renderCurrentCharBaseEffectsList();
        characterBaseOptionNameInput.focus();
    }

    if (addCharBaseEffectToListButton) {
        addCharBaseEffectToListButton.addEventListener('click', () => {
            const typeId = charBaseEffectTypeSelect.value;
            const valueStr = charBaseEffectValueInput.value;
            if (!typeId) { alert("効果種類を選択してください。"); return; }
            if (valueStr.trim() === '' || isNaN(parseFloat(valueStr))) { alert("効果の値を数値で入力してください。"); return; }
            const value = parseFloat(valueStr);
            const selectedEffectType = effectTypesCache.find(et => et.id === typeId);
            const unit = selectedEffectType ? (selectedEffectType.defaultUnit || 'none') : 'none';

            currentCharBaseOptionEffects.push({ type: typeId, value: value, unit: unit });
            renderCurrentCharBaseEffectsList();
            charBaseEffectTypeSelect.value = '';
            charBaseEffectValueInput.value = '';
            if(charBaseEffectUnitDisplay) charBaseEffectUnitDisplay.textContent = '';
        });
    }

    function renderCurrentCharBaseEffectsList() {
        if (!currentCharBaseEffectsList) return;
        currentCharBaseEffectsList.innerHTML = '';
        if (currentCharBaseOptionEffects.length === 0) {
            currentCharBaseEffectsList.innerHTML = '<p>効果が追加されていません。</p>';
            return;
        }
        currentCharBaseOptionEffects.forEach((effect, index) => {
            const effectType = effectTypesCache.find(et => et.id === effect.type);
            const typeName = effectType ? effectType.name : '不明';
            const unitText = effect.unit && effect.unit !== 'none' ? `(${effect.unit})` : '';
            const div = document.createElement('div');
            div.classList.add('effect-list-item');
            div.innerHTML = `
                <span>${typeName}: ${effect.value}${unitText}</span>
                <button type="button" class="delete-effect-from-list" data-index="${index}" title="削除">×</button>
            `; // Note: Reusing .delete-effect-from-list, ensure its click handler is specific or use a new class
            currentCharBaseEffectsList.appendChild(div);
        });
        currentCharBaseEffectsList.querySelectorAll('.delete-effect-from-list').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const indexToRemove = parseInt(e.currentTarget.dataset.index, 10);
                currentCharBaseOptionEffects.splice(indexToRemove, 1);
                renderCurrentCharBaseEffectsList();
            });
        });
    }


    if (characterBaseOptionForm) {
        characterBaseOptionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const optionName = characterBaseOptionNameInput.value.trim();
            if (!optionName) { alert("オプション名を入力してください。"); return; }

            const selectedTypeKey = characterBaseTypeSelect.value;
            const collectionName = `${CHARACTER_BASE_COLLECTION_PREFIX}${selectedTypeKey}`;
            const editingId = editingCharacterBaseOptionDocIdInput.value;

            const optionData = {
                name: optionName,
                effects: currentCharBaseOptionEffects,
                updatedAt: serverTimestamp()
            };

            try {
                if (editingId) {
                    if (characterBasesCache[selectedTypeKey]?.some(opt => opt.id !== editingId && opt.name.toLowerCase() === optionName.toLowerCase())) {
                        alert("同じ種類の基礎情報内に同じ名前のオプションが既に存在します。"); return;
                    }
                    await updateDoc(doc(db, collectionName, editingId), optionData);
                } else {
                    if (characterBasesCache[selectedTypeKey]?.some(opt => opt.name.toLowerCase() === optionName.toLowerCase())) {
                        alert("同じ種類の基礎情報内に同じ名前のオプションが既に存在します。"); return;
                    }
                    optionData.createdAt = serverTimestamp();
                    await addDoc(collection(db, collectionName), optionData);
                }
                clearCharacterBaseOptionForm();
                await loadCharacterBasesFromFirestore();
                renderCharacterBaseOptionsList();
            } catch (error) {
                console.error("[Character Base Option Save] Error:", error);
                alert("基礎情報オプションの保存に失敗しました。");
            }
        });
    }

    async function deleteCharacterBaseOption(optionId, optionName) {
        const selectedTypeKey = characterBaseTypeSelect.value;
        const typeNameText = characterBaseTypeSelect.options[characterBaseTypeSelect.selectedIndex].text;
        if (confirm(`「${typeNameText}」のオプション「${optionName}」を削除しますか？`)) {
            try {
                const collectionName = `${CHARACTER_BASE_COLLECTION_PREFIX}${selectedTypeKey}`;
                await deleteDoc(doc(db, collectionName, optionId));
                await loadCharacterBasesFromFirestore();
                renderCharacterBaseOptionsList();
                 if (editingCharacterBaseOptionDocIdInput.value === optionId) {
                    clearCharacterBaseOptionForm();
                 }
            } catch (error) {
                console.error("[Character Base Option Delete] Error:", error);
                alert("基礎情報オプションの削除に失敗しました。");
            }
        }
    }


    // --- Item Management ---
    // ... (populateTagCheckboxesForItemForm, populateEffectTypeSelect for item form, effectTypeSelect listener for item form) ...
    // ... (renderCurrentItemEffectsList for item form, addEffectToListButton listener for item form) ...
    // ... (loadItemsFromFirestore, itemForm submit listener (ensure 'price' is handled, deleteField removed correctly)) ...
    // ... (clearItemForm (ensure 'price' is cleared)) ...
    // ... (renderItemsAdminTable (ensure 'price' and "Coming Soon" for price is displayed)) ...
    // ... (loadItemForEdit (ensure 'price' is loaded)) ...
    // ... (deleteItem) ...
    function populateTagCheckboxesForItemForm(selectedTagIds = []) { /* ... (no changes) ... */ }
    // populateEffectTypeSelect は共通化されたので、アイテム用も charBase用も同じ関数を使う
    // effectTypeSelect.addEventListener('change', ...) は共通化された updateUnitDisplayForEffectType を使うので、個別のリスナーは不要

    function renderCurrentItemEffectsList() { /* ... (no changes) ... */ }
    if (addEffectToListButton) { /* ... (no changes) ... */ }
    async function loadItemsFromFirestore() { /* ... (no changes) ... */ }

    if (itemForm) { /* ... (existing submit listener from previous version, ensure 'price' and deleteField logic is correct) ... */
        itemForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = itemNameInput.value.trim();
            const source = itemSourceInput.value.trim();
            const priceStr = itemPriceInput.value.trim();
            const selectedItemTagIds = Array.from(itemTagsSelectorCheckboxes.querySelectorAll('input[type="checkbox"][name="itemTag"]:checked'))
                                            .map(cb => cb.value);
            const editingDocId = itemIdToEditInput.value;
            let finalImageUrl = itemImageUrlInput.value;

            let price = null;
            if (priceStr !== "") {
                price = parseInt(priceStr, 10);
                if (isNaN(price) || price < 0) {
                    alert("売値は0以上の数値を入力してください。");
                    saveItemButton.disabled = false; saveItemButton.textContent = editingDocId ? "アイテム更新" : "アイテム保存";
                    return;
                }
            }

            saveItemButton.disabled = true; saveItemButton.textContent = "保存中...";
            try {
                if (selectedImageFile) {
                    const uploadedUrl = await uploadImageToWorkerAndGetURL(selectedImageFile);
                    if (uploadedUrl) {
                        finalImageUrl = uploadedUrl;
                    } else {
                        alert("画像アップロードに失敗しましたが、他の情報は保存を試みます。画像は後で更新してください。");
                    }
                }

                const itemData = {
                    name: name || "",
                    image: finalImageUrl || "",
                    structured_effects: currentItemEffects,
                    入手手段: source || "",
                    tags: selectedItemTagIds,
                    updatedAt: serverTimestamp()
                };

                if (price !== null) {
                    itemData.price = price;
                }


                if (editingDocId) {
                    const updatePayload = {...itemData};
                    if (price === null) {
                        updatePayload.price = deleteField();
                    }
                    await updateDoc(doc(db, 'items', editingDocId), updatePayload);
                } else {
                    itemData.createdAt = serverTimestamp();
                    const dataToAdd = {...itemData};
                    if (price === null && dataToAdd.hasOwnProperty('price')) delete dataToAdd.price;
                    await addDoc(collection(db, 'items'), dataToAdd);
                }
                await loadItemsFromFirestore();
                renderItemsAdminTable();
                clearItemForm();
            } catch (error) {
                console.error("[Item Save] Error:", error);
                alert(`アイテム保存エラー: ${error.message}`);
            } finally {
                saveItemButton.disabled = false;
                saveItemButton.textContent = itemIdToEditInput.value ? "アイテム更新" : "アイテム保存";
            }
        });
    }


    function clearItemForm() { /* ... (no changes from previous version) ... */ }
    function renderItemsAdminTable() { /* ... (no changes from previous version, ensure 'price' and "Coming Soon" display) ... */ }
    async function loadItemForEdit(docId) { /* ... (no changes from previous version, ensure 'price' is loaded) ... */ }
    async function deleteItem(docId, itemName, imageUrl) { /* ... (no changes) ... */ }


    // --- Image Upload ---
    if (itemImageFileInput) { /* ... (no changes) ... */ }
    async function uploadImageToWorkerAndGetURL(file) { /* ... (no changes) ... */ }

    // --- Modal common handlers ---
    document.querySelectorAll('.modal .close-button').forEach(btn => {
        btn.onclick = function() { btn.closest('.modal').style.display = "none"; }
    });
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(event) {
            if (event.target === modal) {
                modal.style.display = "none";
            }
        });
    });
});
