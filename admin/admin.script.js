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

    // Effect Unit Management
    const newEffectUnitNameInput = document.getElementById('newEffectUnitName');
    const addEffectUnitButton = document.getElementById('addEffectUnitButton');
    const effectUnitListContainer = document.getElementById('effectUnitListContainer');
    const editEffectUnitModal = document.getElementById('editEffectUnitModal');
    const editingEffectUnitDocIdInput = document.getElementById('editingEffectUnitDocId');
    const editingEffectUnitNameInput = document.getElementById('editingEffectUnitName');
    const saveEffectUnitEditButton = document.getElementById('saveEffectUnitEditButton');
    const manageUnitsForNewEffectTypeButton = document.getElementById('manageUnitsForNewEffectTypeButton');
    const manageUnitsForEditingEffectTypeButton = document.getElementById('manageUnitsForEditingEffectTypeButton');


    // Effect Type Management
    const newEffectTypeNameInput = document.getElementById('newEffectTypeName');
    const newEffectTypeUnitSelect = document.getElementById('newEffectTypeUnit');
    const newEffectTypeCalcMethodRadios = document.querySelectorAll('input[name="newCalcMethod"]');
    const newEffectTypeMaxValueInput = document.getElementById('newEffectTypeMaxValue');
    const newEffectTypeMaxValueGroup = document.getElementById('newEffectTypeMaxValueGroup');
    const addEffectTypeButton = document.getElementById('addEffectTypeButton');
    const effectTypeListContainer = document.getElementById('effectTypeListContainer');
    const editEffectTypeModal = document.getElementById('editEffectTypeModal');
    const editingEffectTypeDocIdInput = document.getElementById('editingEffectTypeDocId');
    const editingEffectTypeNameInput = document.getElementById('editingEffectTypeName');
    const editingEffectTypeUnitSelect = document.getElementById('editingEffectTypeUnit');
    const editingEffectTypeCalcMethodRadios = document.querySelectorAll('input[name="editCalcMethodModal"]');
    const editingEffectTypeMaxValueInput = document.getElementById('editingEffectTypeMaxValue');
    const editingEffectTypeMaxValueGroup = document.getElementById('editingEffectTypeMaxValueGroup');
    const saveEffectTypeEditButton = document.getElementById('saveEffectTypeEditButton');
    const effectTypeSelect = document.getElementById('effectTypeSelect');

    // Character Base Management
    const charBaseTypeSelect = document.getElementById('charBaseTypeSelect');
    const addNewCharBaseOptionButton = document.getElementById('addNewCharBaseOptionButton');
    const selectedCharBaseTypeDisplay = document.getElementById('selectedCharBaseTypeDisplay');
    const charBaseOptionListContainer = document.getElementById('charBaseOptionListContainer');
    const editCharBaseOptionModal = document.getElementById('editCharBaseOptionModal');
    const editCharBaseOptionModalTitle = document.getElementById('editCharBaseOptionModalTitle');
    const editingCharBaseTypeInput = document.getElementById('editingCharBaseType');
    const editingCharBaseOptionDocIdInput = document.getElementById('editingCharBaseOptionDocId');
    const editingCharBaseOptionNameInput = document.getElementById('editingCharBaseOptionName');
    const charBaseOptionEffectTypeSelect = document.getElementById('charBaseOptionEffectTypeSelect');
    const charBaseOptionEffectValueInput = document.getElementById('charBaseOptionEffectValueInput');
    const charBaseOptionEffectUnitDisplay = document.getElementById('charBaseOptionEffectUnitDisplay');
    const addCharBaseOptionEffectButton = document.getElementById('addCharBaseOptionEffectButton');
    const currentCharBaseOptionEffectsList = document.getElementById('currentCharBaseOptionEffectsList');
    const saveCharBaseOptionButton = document.getElementById('saveCharBaseOptionButton');


    // Item Management
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
        // Clear Category UI
        if (newCategoryNameInput) newCategoryNameInput.value = '';
        if (categoryListContainer) categoryListContainer.innerHTML = '';
        if (newCategoryParentButtons) newCategoryParentButtons.innerHTML = '';
        if (selectedNewParentCategoryIdInput) selectedNewParentCategoryIdInput.value = '';
        if (editingCategoryParentButtons) editingCategoryParentButtons.innerHTML = '';
        if (selectedEditingParentCategoryIdInput) selectedEditingParentCategoryIdInput.value = '';
        if (editingCategoryTagsSelector) editingCategoryTagsSelector.innerHTML = '';
        if (tagSearchModeGroup) tagSearchModeGroup.style.display = 'none';
        if (editingTagSearchModeSelect) editingTagSearchModeSelect.value = 'AND';
        if (editCategoryTagsGroup) editCategoryTagsGroup.style.display = 'block';

        // Clear Tag UI
        if (newTagNameInput) newTagNameInput.value = '';
        if (tagListContainer) tagListContainer.innerHTML = '';
        if (newTagCategoriesCheckboxes) newTagCategoriesCheckboxes.innerHTML = '';
        if (editingTagCategoriesCheckboxes) editingTagCategoriesCheckboxes.innerHTML = '';

        // Clear Effect Unit UI
        if (effectUnitListContainer) effectUnitListContainer.innerHTML = '';
        if (newEffectUnitNameInput) newEffectUnitNameInput.value = '';

        // Clear Effect Type UI
        if (effectTypeListContainer) effectTypeListContainer.innerHTML = '';
        if (newEffectTypeNameInput) newEffectTypeNameInput.value = '';
        if (newEffectTypeUnitSelect) newEffectTypeUnitSelect.innerHTML = '<option value="none">なし</option>';
        if (newEffectTypeCalcMethodRadios[0]) newEffectTypeCalcMethodRadios[0].checked = true;
        if (newEffectTypeMaxValueInput) newEffectTypeMaxValueInput.value = '';
        if (newEffectTypeMaxValueGroup) newEffectTypeMaxValueGroup.style.display = 'block';

        // Clear Character Base UI
        if (charBaseOptionListContainer) charBaseOptionListContainer.innerHTML = '';
        if (selectedCharBaseTypeDisplay && charBaseTypeSelect) {
            selectedCharBaseTypeDisplay.textContent = charBaseTypeSelect.options[charBaseTypeSelect.selectedIndex]?.text || "頭の形";
        }


        // Clear Item UI
        if (itemsTableBody) itemsTableBody.innerHTML = '';
        if (itemTagsSelectorCheckboxes) itemTagsSelectorCheckboxes.innerHTML = '';
        if (effectTypeSelect) populateEffectTypeSelect(effectTypeSelect); // Repopulate with empty options initially
        if (charBaseOptionEffectTypeSelect) populateEffectTypeSelect(charBaseOptionEffectTypeSelect);

        clearItemForm();

        // Clear caches
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
        // Load in order of dependency
        await loadEffectUnitsFromFirestore();
        await loadEffectTypesFromFirestore(); // Depends on units for dropdown population
        await loadCategoriesFromFirestore();  // Needed by tags & items (indirectly)
        await loadTagsFromFirestore();        // Needed by items & categories edit
        await loadCharacterBasesFromFirestore(); // Load character base data
        await loadItemsFromFirestore();       // Main data

        // Populate UI elements that depend on the loaded data
        populateParentCategoryButtons(newCategoryParentButtons, selectedNewParentCategoryIdInput);
        populateCategoryCheckboxesForTagAssignment(newTagCategoriesCheckboxes);
        populateTagCheckboxesForItemForm();
        populateEffectUnitSelects(); // For effect type forms
        populateEffectTypeSelect(effectTypeSelect); // For item form
        populateEffectTypeSelect(charBaseOptionEffectTypeSelect); // For char base option modal

        renderCategoriesForManagement();
        renderTagsForManagement();
        renderEffectUnitsForManagement();
        renderEffectTypesForManagement();
        renderCharacterBaseOptions(); // Initial render for default selected base type
        renderItemsAdminTable();
        console.log("[Initial Load] Completed.");
    }

    // --- Effect Unit Management ---
    // ... (No changes, assumed correct from previous) ...
    async function loadEffectUnitsFromFirestore() {
        console.log("[Effect Units] Loading effect units...");
        try {
            const q = query(collection(db, 'effect_units'), orderBy('name'));
            const snapshot = await getDocs(q);
            effectUnitsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("[Effect Units] Loaded:", effectUnitsCache.length, effectUnitsCache);
        } catch (error) {
            console.error("[Effect Units] Error loading:", error);
            effectUnitsCache = [];
        }
    }

    function renderEffectUnitsForManagement(openModalForId = null) {
        if (!effectUnitListContainer) return;
        effectUnitListContainer.innerHTML = '';
        if (effectUnitsCache.length === 0) {
            effectUnitListContainer.innerHTML = '<p>効果単位が登録されていません。「なし」は自動的に利用可能です。</p>';
        }
        effectUnitsCache.forEach(unit => {
            const div = document.createElement('div');
            div.classList.add('list-item');
            div.innerHTML = `
                <span>${unit.name}</span>
                <div>
                    <button class="edit-effect-unit action-button" data-id="${unit.id}" title="編集">✎</button>
                    <button class="delete-effect-unit action-button delete" data-id="${unit.id}" data-name="${unit.name}" title="削除">×</button>
                </div>
            `;
            effectUnitListContainer.appendChild(div);
        });
        effectUnitListContainer.querySelectorAll('.edit-effect-unit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const unitId = e.currentTarget.dataset.id;
                const unitData = effectUnitsCache.find(u => u.id === unitId);
                if (unitData) openEditEffectUnitModal(unitData);
            });
        });
        effectUnitListContainer.querySelectorAll('.delete-effect-unit').forEach(btn => {
            btn.addEventListener('click', (e) => deleteEffectUnit(e.currentTarget.dataset.id, e.currentTarget.dataset.name));
        });

        if (openModalForId === "manageUnits") {
            if(editEffectUnitModal && effectUnitListContainer.offsetParent !== null) {
                effectUnitListContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }
    if(manageUnitsForNewEffectTypeButton) manageUnitsForNewEffectTypeButton.addEventListener('click', () => renderEffectUnitsForManagement("manageUnits"));
    if(manageUnitsForEditingEffectTypeButton) manageUnitsForEditingEffectTypeButton.addEventListener('click', () => renderEffectUnitsForManagement("manageUnits"));


    if (addEffectUnitButton) {
        addEffectUnitButton.addEventListener('click', async () => {
            const name = newEffectUnitNameInput.value.trim();
            if (!name) { alert("効果単位名を入力してください。"); return; }
            if (name.toLowerCase() === "なし") { alert("「なし」は予約語であり、単位として登録できません。"); return; }
            if (effectUnitsCache.some(u => u.name.toLowerCase() === name.toLowerCase())) {
                alert("同じ名前の効果単位が既に存在します。"); return;
            }
            try {
                await addDoc(collection(db, 'effect_units'), { name: name, createdAt: serverTimestamp() });
                newEffectUnitNameInput.value = '';
                await loadEffectUnitsFromFirestore();
                renderEffectUnitsForManagement();
                populateEffectUnitSelects();
            } catch (error) {
                console.error("[Effect Units] Error adding:", error);
                alert("効果単位の追加に失敗しました。");
            }
        });
    }

    function openEditEffectUnitModal(unitData) {
        editingEffectUnitDocIdInput.value = unitData.id;
        editingEffectUnitNameInput.value = unitData.name;
        if (editEffectUnitModal) editEffectUnitModal.style.display = 'flex';
    }

    if (saveEffectUnitEditButton) {
        saveEffectUnitEditButton.addEventListener('click', async () => {
            const id = editingEffectUnitDocIdInput.value;
            const newName = editingEffectUnitNameInput.value.trim();
            if (!newName) { alert("効果単位名は空にできません。"); return; }
            if (newName.toLowerCase() === "なし") { alert("「なし」は予約語であり、単位として登録できません。"); return; }
            if (effectUnitsCache.some(u => u.id !== id && u.name.toLowerCase() === newName.toLowerCase())) {
                alert("編集後の名前が他の効果単位と重複します。"); return;
            }
            try {
                const oldUnitName = effectUnitsCache.find(u => u.id === id)?.name;
                await updateDoc(doc(db, 'effect_units', id), { name: newName, updatedAt: serverTimestamp() });

                if (oldUnitName && oldUnitName !== newName) {
                    const batch = writeBatch(db);
                    effectTypesCache.forEach(et => {
                        if (et.defaultUnit === oldUnitName) {
                            batch.update(doc(db, 'effect_types', et.id), { defaultUnit: newName });
                        }
                    });
                    itemsCache.forEach(item => {
                        let itemEffectsUpdated = false;
                        const updatedEffects = (item.structured_effects || []).map(eff => {
                            if (eff.unit === oldUnitName) {
                                itemEffectsUpdated = true;
                                return { ...eff, unit: newName };
                            }
                            return eff;
                        });
                        if (itemEffectsUpdated) {
                            batch.update(doc(db, 'items', item.docId), { structured_effects: updatedEffects });
                        }
                    });
                    for (const baseKey in characterBasesCache) {
                        (characterBasesCache[baseKey] || []).forEach(option => {
                            let optionEffectsUpdated = false;
                            const updatedOptionEffects = (option.effects || []).map(eff => {
                                if (eff.unit === oldUnitName) {
                                    optionEffectsUpdated = true;
                                    return { ...eff, unit: newName };
                                }
                                return eff;
                            });
                            if (optionEffectsUpdated) {
                                batch.update(doc(db, `character_bases/${baseKey}/options`, option.id), { effects: updatedOptionEffects });
                            }
                        });
                    }

                    await batch.commit();
                    await loadInitialData(); // Full reload to ensure consistency
                } else { // If name didn't change or no old name, just reload units and repopulate selects
                    await loadEffectUnitsFromFirestore();
                    renderEffectUnitsForManagement();
                    populateEffectUnitSelects();
                }
                if (editEffectUnitModal) editEffectUnitModal.style.display = 'none';

            } catch (error) {
                console.error("[Effect Units] Error updating:", error);
                alert("効果単位の更新に失敗しました。");
            }
        });
    }

    async function deleteEffectUnit(id, name) {
        const usedByEffectType = effectTypesCache.find(et => et.defaultUnit === name);
        if (usedByEffectType) {
            alert(`効果単位「${name}」は効果種類「${usedByEffectType.name}」のデフォルト単位として使用されているため削除できません。\n先に効果種類のデフォルト単位を変更してください。`);
            return;
        }
        const usedByItem = itemsCache.find(item => item.structured_effects && item.structured_effects.some(eff => eff.unit === name));
        if (usedByItem) {
            alert(`効果単位「${name}」はアイテム「${usedByItem.name}」の効果で使用されているため削除できません。\n先にアイテムの効果設定を変更してください。`);
            return;
        }
        for (const baseKey in characterBasesCache) {
            const usedInBase = (characterBasesCache[baseKey] || []).find(option =>
                option.effects && option.effects.some(eff => eff.unit === name)
            );
            if (usedInBase) {
                alert(`効果単位「${name}」はキャラクター基礎情報「${baseTypeMappings[baseKey]} - ${usedInBase.name}」の効果で使用されているため削除できません。\n先に該当の基礎情報オプションの効果設定を変更してください。`);
                return;
            }
        }

        if (confirm(`効果単位「${name}」を削除しますか？`)) {
            try {
                await deleteDoc(doc(db, 'effect_units', id));
                await loadEffectUnitsFromFirestore();
                renderEffectUnitsForManagement();
                populateEffectUnitSelects();
            } catch (error) {
                console.error("[Effect Units] Error deleting:", error);
                alert("効果単位の削除に失敗しました。");
            }
        }
    }

    function populateEffectUnitSelects() {
        const selectsToUpdate = [newEffectTypeUnitSelect, editingEffectTypeUnitSelect];
        selectsToUpdate.forEach(selectElement => {
            if (!selectElement) return;
            const currentValue = selectElement.value;
            selectElement.innerHTML = '<option value="none">なし</option>';
            effectUnitsCache.forEach(unit => {
                selectElement.add(new Option(unit.name, unit.name));
            });
            if (Array.from(selectElement.options).some(opt => opt.value === currentValue)) {
                selectElement.value = currentValue;
            } else {
                selectElement.value = 'none';
            }
        });
    }


    // --- Effect Type Management ---
    async function loadEffectTypesFromFirestore() {
        console.log("[Effect Types] Loading effect types...");
        try {
            const q = query(collection(db, 'effect_types'), orderBy('name'));
            const snapshot = await getDocs(q);
            effectTypesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("[Effect Types] Loaded:", effectTypesCache.length);
        } catch (error) {
            console.error("[Effect Types] Error loading:", error);
            effectTypesCache = [];
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
            let calcText = effectType.calculationMethod === 'max' ? '(最大値)' : '(加算)';
            if (effectType.calculationMethod === 'sum' && typeof effectType.maxValue === 'number' && !isNaN(effectType.maxValue) ) {
                calcText += `, 最大: ${effectType.maxValue}`;
            }

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

    function toggleMaxValueInput(groupElement, inputElement, calcMethodValue) {
        if (groupElement) {
            groupElement.style.display = calcMethodValue === 'sum' ? 'block' : 'none';
            if (calcMethodValue !== 'sum' && inputElement) {
                inputElement.value = '';
            }
        }
    }

    newEffectTypeCalcMethodRadios.forEach(radio => {
        radio.addEventListener('change', () => toggleMaxValueInput(newEffectTypeMaxValueGroup, newEffectTypeMaxValueInput, radio.value));
    });
    editingEffectTypeCalcMethodRadios.forEach(radio => {
        radio.addEventListener('change', () => toggleMaxValueInput(editingEffectTypeMaxValueGroup, editingEffectTypeMaxValueInput, radio.value));
    });


    if (addEffectTypeButton) {
        addEffectTypeButton.addEventListener('click', async () => {
            const name = newEffectTypeNameInput.value.trim();
            const unit = newEffectTypeUnitSelect.value;
            const calcMethodRadio = Array.from(newEffectTypeCalcMethodRadios).find(r => r.checked);
            const calcMethod = calcMethodRadio ? calcMethodRadio.value : 'sum';
            const maxValueStr = newEffectTypeMaxValueInput.value.trim();
            let maxValue = null;

            if (calcMethod === 'sum' && maxValueStr !== "") {
                maxValue = parseFloat(maxValueStr);
                if (isNaN(maxValue)) {
                    alert("加算時の最大値は数値を入力してください。"); return;
                }
            }

            if (!name) { alert("効果種類名を入力してください。"); return; }
            if (effectTypesCache.some(et => et.name.toLowerCase() === name.toLowerCase())) {
                alert("同じ名前の効果種類が既に存在します。"); return;
            }
            try {
                const effectTypeData = {
                    name: name,
                    defaultUnit: unit,
                    calculationMethod: calcMethod,
                    createdAt: serverTimestamp()
                };
                if (calcMethod === 'sum' && maxValue !== null) {
                    effectTypeData.maxValue = maxValue;
                }

                await addDoc(collection(db, 'effect_types'), effectTypeData);
                newEffectTypeNameInput.value = '';
                newEffectTypeUnitSelect.value = 'none';
                if(newEffectTypeCalcMethodRadios[0]) newEffectTypeCalcMethodRadios[0].checked = true;
                if(newEffectTypeMaxValueInput) newEffectTypeMaxValueInput.value = '';
                toggleMaxValueInput(newEffectTypeMaxValueGroup, newEffectTypeMaxValueInput, 'sum'); // Reset display for sum


                await loadEffectTypesFromFirestore();
                renderEffectTypesForManagement();
                populateEffectTypeSelect(effectTypeSelect);
                populateEffectTypeSelect(charBaseOptionEffectTypeSelect);
            } catch (error) {
                console.error("[Effect Types] Error adding:", error);
                alert("効果種類の追加に失敗しました。");
            }
        });
    }

    function openEditEffectTypeModal(effectTypeData) {
        editingEffectTypeDocIdInput.value = effectTypeData.id;
        editingEffectTypeNameInput.value = effectTypeData.name;
        populateEffectUnitSelects();
        editingEffectTypeUnitSelect.value = effectTypeData.defaultUnit || 'none';

        const calcMethod = effectTypeData.calculationMethod || 'sum';
        const radioToCheck = Array.from(editingEffectTypeCalcMethodRadios).find(r => r.value === calcMethod);
        if (radioToCheck) {
            radioToCheck.checked = true;
        } else if (editingEffectTypeCalcMethodRadios[0]) {
            editingEffectTypeCalcMethodRadios[0].checked = true;
        }
        toggleMaxValueInput(editingEffectTypeMaxValueGroup, editingEffectTypeMaxValueInput, calcMethod);
        editingEffectTypeMaxValueInput.value = (calcMethod === 'sum' && typeof effectTypeData.maxValue === 'number') ? effectTypeData.maxValue : '';


        if (editEffectTypeModal) editEffectTypeModal.style.display = 'flex';
    }

     if (saveEffectTypeEditButton) {
        saveEffectTypeEditButton.addEventListener('click', async () => {
            const id = editingEffectTypeDocIdInput.value;
            const newName = editingEffectTypeNameInput.value.trim();
            const newUnit = editingEffectTypeUnitSelect.value;
            const editCalcMethodRadio = Array.from(editingEffectTypeCalcMethodRadios).find(r => r.checked);
            const newCalcMethod = editCalcMethodRadio ? editCalcMethodRadio.value : 'sum';
            const newMaxValueStr = editingEffectTypeMaxValueInput.value.trim();
            let newMaxValue = null;

            if (newCalcMethod === 'sum' && newMaxValueStr !== "") {
                newMaxValue = parseFloat(newMaxValueStr);
                if (isNaN(newMaxValue)) {
                    alert("加算時の最大値は数値を入力してください。"); return;
                }
            }

            if (!newName) { alert("効果種類名は空にできません。"); return; }
            if (effectTypesCache.some(et => et.id !== id && et.name.toLowerCase() === newName.toLowerCase())) {
                 alert("編集後の名前が他の効果種類と重複します。"); return;
            }
            try {
                const updateData = {
                    name: newName,
                    defaultUnit: newUnit,
                    calculationMethod: newCalcMethod,
                    updatedAt: serverTimestamp()
                };
                if (newCalcMethod === 'sum') {
                    if (newMaxValue !== null) {
                        updateData.maxValue = newMaxValue;
                    } else {
                        updateData.maxValue = deleteField();
                    }
                } else {
                    updateData.maxValue = deleteField();
                }


                await updateDoc(doc(db, 'effect_types', id), updateData);
                if (editEffectTypeModal) editEffectTypeModal.style.display = 'none';
                await loadEffectTypesFromFirestore();
                renderEffectTypesForManagement();
                populateEffectTypeSelect(effectTypeSelect);
                populateEffectTypeSelect(charBaseOptionEffectTypeSelect);
                await loadItemsFromFirestore();
                renderItemsAdminTable();
                 await loadCharacterBasesFromFirestore();
                 renderCharacterBaseOptions();


            } catch (error) {
                 console.error("[Effect Types] Error updating:", error);
                 alert("効果種類の更新に失敗しました。");
            }
        });
    }

    async function deleteEffectType(id, name) {
         if (confirm(`効果種類「${name}」を削除しますか？\n注意: この効果種類を使用しているアイテムやキャラクター基礎情報オプションの効果設定は残りますが、種類名が表示されなくなる可能性があります。`)) {
             try {
                let isUsedByItem = false;
                for (const item of itemsCache) {
                    if (item.structured_effects && item.structured_effects.some(eff => eff.type === id)) {
                        isUsedByItem = true;
                        alert(`効果種類「${name}」はアイテム「${item.name}」で使用されているため削除できません。\n先にアイテムの効果設定からこの種類を削除してください。`);
                        break;
                    }
                }
                if(isUsedByItem) return;

                let isUsedByBase = false;
                for (const baseKey in characterBasesCache) {
                    for (const option of characterBasesCache[baseKey] || []) {
                        if (option.effects && option.effects.some(eff => eff.type === id)) {
                            isUsedByBase = true;
                            alert(`効果種類「${name}」はキャラクター基礎情報「${baseTypeMappings[baseKey]} - ${option.name}」で使用されているため削除できません。\n先に該当の基礎情報オプションの効果設定からこの種類を削除してください。`);
                            break;
                        }
                    }
                    if (isUsedByBase) break;
                }
                if(isUsedByBase) return;


                 await deleteDoc(doc(db, 'effect_types', id));
                 await loadEffectTypesFromFirestore();
                 renderEffectTypesForManagement();
                 populateEffectTypeSelect(effectTypeSelect);
                 populateEffectTypeSelect(charBaseOptionEffectTypeSelect);
                 await loadItemsFromFirestore();
                 renderItemsAdminTable();

             } catch (error) {
                  console.error("[Effect Types] Error deleting:", error);
                  alert("効果種類の削除に失敗しました。");
             }
         }
    }


    // --- Category Management ---
    // ... (No changes from previous version)
    async function loadCategoriesFromFirestore() {
        console.log("[Categories] Loading all categories...");
        try {
            const q = query(collection(db, 'categories'), orderBy('name'));
            const snapshot = await getDocs(q);
            allCategoriesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("[Categories] All categories loaded:", allCategoriesCache.length);
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
        topLevelButton.textContent = '最上位カテゴリとして設定';
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

        hiddenInput.value = selectedParentId;
    }

    function selectParentCategoryButton(container, hiddenInput, clickedButton, parentId) {
        container.querySelectorAll('.category-select-button.active').forEach(activeBtn => {
            activeBtn.classList.remove('active');
        });
        clickedButton.classList.add('active');
        hiddenInput.value = parentId;

        if (container === editingCategoryParentButtons) {
             const isParentSelected = (parentId === "");
             if (tagSearchModeGroup) tagSearchModeGroup.style.display = isParentSelected ? 'none' : 'block';
             if (editCategoryTagsGroup) editCategoryTagsGroup.style.display = isParentSelected ? 'none' : 'block';
             if (!isParentSelected && editingTagSearchModeSelect) editingTagSearchModeSelect.value = 'AND';
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
                    parentId: parentId || "",
                    createdAt: serverTimestamp()
                };
                if (parentId) {
                    categoryData.tagSearchMode = 'AND';
                }

                await addDoc(collection(db, 'categories'), categoryData);
                newCategoryNameInput.value = '';
                populateParentCategoryButtons(newCategoryParentButtons, selectedNewParentCategoryIdInput);


                await loadCategoriesFromFirestore();
                renderCategoriesForManagement();
                populateCategoryCheckboxesForTagAssignment(newTagCategoriesCheckboxes);

                if (editCategoryModal.style.display === 'flex' && editingCategoryDocIdInput.value) {
                    const currentlyEditingCatId = editingCategoryDocIdInput.value;
                    const currentlyEditingCat = allCategoriesCache.find(c => c.id === currentlyEditingCatId);
                    if (currentlyEditingCat) {
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
            const selectedTagIdsForThisCategory = Array.from(editingCategoryTagsSelector.querySelectorAll('.tag-filter.active'))
                                         .map(btn => btn.dataset.tagId);

            if (!newName) { alert("カテゴリ名は空にできません。"); return; }
            if (docId === newParentId) { alert("自身を親カテゴリに設定することはできません。"); return; }

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

            if (newParentId) {
                let currentAncestorId = newParentId;
                const visited = new Set([docId]);
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

                const isBecomingChild = !!newParentId;

                if (isBecomingChild) {
                    categoryUpdateData.tagSearchMode = newTagSearchMode;
                } else {
                    categoryUpdateData.tagSearchMode = deleteField();
                }
                batch.update(doc(db, 'categories', docId), categoryUpdateData);

                allTagsCache.forEach(tag => {
                    const isCurrentlySelectedForCat = selectedTagIdsForThisCategory.includes(tag.id);
                    const isAlreadyAssociatedWithCat = tag.categoryIds && tag.categoryIds.includes(docId);

                    if (isBecomingChild) {
                        if (isCurrentlySelectedForCat && !isAlreadyAssociatedWithCat) {
                            batch.update(doc(db, 'tags', tag.id), { categoryIds: arrayUnion(docId) });
                        } else if (!isCurrentlySelectedForCat && isAlreadyAssociatedWithCat) {
                            batch.update(doc(db, 'tags', tag.id), { categoryIds: arrayRemove(docId) });
                        }
                    } else {
                        if (isAlreadyAssociatedWithCat) {
                             batch.update(doc(db, 'tags', tag.id), { categoryIds: arrayRemove(docId) });
                        }
                    }
                });

                await batch.commit();
                editCategoryModal.style.display = 'none';
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
                alert("カテゴリの削除または関連タグの更新に失敗しました。");
            }
        }
    }


    // --- Tag Management ---
    // ... (No changes) ...
    async function loadTagsFromFirestore() {
        console.log("[Tags] Loading all tags...");
        try {
            const q = query(collection(db, 'tags'), orderBy('name'));
            const snapshot = await getDocs(q);
            allTagsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("[Tags] All tags loaded:", allTagsCache.length);
        } catch (error) {
            console.error("[Tags] Error loading tags:", error);
            allTagsCache = [];
        }
    }

    function populateCategoryCheckboxesForTagAssignment(containerElement, selectedCategoryIds = []) {
        if (!containerElement) return;
        containerElement.innerHTML = '';

        const assignableCategories = allCategoriesCache.filter(cat => cat.parentId && cat.parentId !== "");

        if (assignableCategories.length === 0) {
            containerElement.innerHTML = '<p>タグを割り当て可能な子カテゴリが登録されていません。</p>';
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
                    if (cat && cat.parentId) {
                        let name = cat.name;
                        const parentCat = allCategoriesCache.find(p => p.id === cat.parentId);
                        name += parentCat ? ` (親:${parentCat.name})` : ` (親:不明)`;
                        return name;
                    }
                    return null;
                })
                .filter(name => name)
                .join(', ');
            const displayCategories = belongingCategoriesNames || '未分類';


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
                    categoryIds: selectedCategoryIdsForTag,
                    createdAt: serverTimestamp()
                });
                newTagNameInput.value = '';
                newTagCategoriesCheckboxes.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);

                await loadTagsFromFirestore();
                renderTagsForManagement();
                populateTagCheckboxesForItemForm();
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
                if (editCategoryModal.style.display === 'flex' && editingCategoryDocIdInput.value) {
                     populateTagsForCategoryEdit(editingCategoryTagsSelector, editingCategoryDocIdInput.value);
                }
                await loadItemsFromFirestore();
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

                const itemsToUpdateQuery = query(collection(db, 'items'), where('tags', 'array-contains', docId));
                const itemsSnapshot = await getDocs(itemsToUpdateQuery);
                itemsSnapshot.forEach(itemDoc => {
                    batch.update(itemDoc.ref, { tags: arrayRemove(docId) });
                });

                batch.delete(doc(db, 'tags', docId));

                await batch.commit();
                await loadInitialData();

            } catch (error) {
                console.error("[Tag Delete] Error:", error);
                alert("タグの削除または関連エンティティの更新に失敗しました。");
            }
        }
    }


    // --- Item Management ---
    // ... (No changes)
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

    function populateEffectTypeSelect(selectElement) { // Generic function for populating effect type dropdowns
        if (!selectElement) return;
        const currentVal = selectElement.value;
        selectElement.innerHTML = '<option value="">効果種類を選択...</option>';
        effectTypesCache.forEach(et => {
            selectElement.add(new Option(et.name, et.id));
        });
        if (currentVal && selectElement.querySelector(`option[value="${currentVal}"]`)) {
            selectElement.value = currentVal;
        }

        // Dispatch change only if a specific unit display is associated
        if (selectElement === effectTypeSelect && effectUnitDisplay) { // Item form
            if (selectElement.value) effectTypeSelect.dispatchEvent(new Event('change'));
            else effectUnitDisplay.textContent = '';
        } else if (selectElement === charBaseOptionEffectTypeSelect && charBaseOptionEffectUnitDisplay) { // Char base modal
            if (selectElement.value) charBaseOptionEffectTypeSelect.dispatchEvent(new Event('change'));
            else charBaseOptionEffectUnitDisplay.textContent = '';
        }
    }


    if (effectTypeSelect) { // For item form effects
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

    function renderCurrentItemEffectsList() { // For item form
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
                renderCurrentItemEffectsList();
            });
        });
    }

    if (addEffectToListButton) { // For item form
        addEffectToListButton.addEventListener('click', () => {
            const typeId = effectTypeSelect.value;
            const valueStr = effectValueInput.value;

            if (!typeId) { alert("効果種類を選択してください。"); return; }
            if (valueStr.trim() === '' || isNaN(parseFloat(valueStr))) {
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
            const q = query(collection(db, 'items'), orderBy('name'));
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

                if (price !== null) { // price が数値として有効な場合のみフィールドを追加
                    itemData.price = price;
                }


                if (editingDocId) {
                    const updatePayload = {...itemData};
                    if (price === null) {
                        // 編集時に price がクリアされた場合、フィールドを削除
                        updatePayload.price = deleteField();
                    }
                    await updateDoc(doc(db, 'items', editingDocId), updatePayload);
                } else {
                    itemData.createdAt = serverTimestamp();
                    const dataToAdd = {...itemData};
                     // 新規追加時、price が null ならフィールド自体を含めない
                    if (price === null) delete dataToAdd.price;
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

    if (clearFormButton) clearFormButton.addEventListener('click', clearItemForm);

    function clearItemForm() {
        if (itemForm) itemForm.reset();
        itemIdToEditInput.value = '';
        itemImageUrlInput.value = '';
        if (itemPriceInput) itemPriceInput.value = '';
        if (itemImagePreview) { itemImagePreview.src = '#'; itemImagePreview.style.display = 'none'; }
        if (itemImageFileInput) itemImageFileInput.value = null;
        selectedImageFile = null;
        uploadProgressContainer.style.display = 'none';
        uploadProgress.value = 0;
        uploadProgressText.textContent = '';

        populateTagCheckboxesForItemForm();

        currentItemEffects = [];
        renderCurrentItemEffectsList();
        if(effectTypeSelect) effectTypeSelect.value = '';
        if(effectValueInput) effectValueInput.value = '';
        if(effectUnitDisplay) effectUnitDisplay.textContent = '';

        if (saveItemButton) saveItemButton.textContent = "アイテム保存";
        itemNameInput.focus();
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
            (!searchTerm && (item.name === "" || !item.name))
        );

        if (filteredItems.length === 0) {
            const tr = itemsTableBody.insertRow();
            const td = tr.insertCell();
            td.colSpan = 6;
            td.textContent = searchTerm ? '検索条件に一致するアイテムはありません。' : 'アイテムが登録されていません。';
            td.style.textAlign = 'center';
            return;
        }

        filteredItems.forEach(item => {
            const tr = document.createElement('tr');
            const imageDisplayPath = item.image || '../images/placeholder_item.png';
            const itemTagsString = (item.tags || [])
                .map(tagId => allTagsCache.find(t => t.id === tagId)?.name)
                .filter(name => name)
                .join(', ') || 'なし';

            let effectsDisplay = 'Coming Soon';
            if (item.structured_effects && item.structured_effects.length > 0) {
                 effectsDisplay = item.structured_effects.map(eff => {
                     const typeInfo = effectTypesCache.find(et => et.id === eff.type);
                     const typeName = typeInfo ? typeInfo.name : `不明(${eff.type})`;
                     const unit = (eff.unit && eff.unit !== 'none') ? eff.unit : '';
                     return `${typeName}: ${eff.value}${unit}`;
                 }).join('; ');
                 if (effectsDisplay.length > 40) effectsDisplay = effectsDisplay.substring(0, 37) + '...';
            }
            const priceDisplay = (typeof item.price === 'number' && !isNaN(item.price)) ? `${item.price}G` : 'Coming Soon';

            const nameDisplay = item.name || '(名称未設定)';
            tr.innerHTML = `
                <td><img src="${imageDisplayPath}" alt="${nameDisplay}" onerror="this.onerror=null; this.src='../images/placeholder_item.png';"></td>
                <td>${nameDisplay}</td>
                <td>${priceDisplay}</td>
                <td>${effectsDisplay}</td>
                <td>${itemTagsString}</td>
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
                if (itemPriceInput) itemPriceInput.value = typeof itemData.price === 'number' && !isNaN(itemData.price) ? itemData.price : '';

                if (itemData.image) {
                    itemImagePreview.src = itemData.image; itemImagePreview.style.display = 'block';
                } else {
                    itemImagePreview.src = '#'; itemImagePreview.style.display = 'none';
                }
                if (itemImageFileInput) itemImageFileInput.value = null;
                selectedImageFile = null;

                populateTagCheckboxesForItemForm(itemData.tags || []);

                currentItemEffects = itemData.structured_effects || [];
                renderCurrentItemEffectsList();
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
                if (imageUrl) {
                    console.warn(`Image ${imageUrl} (associated with deleted item ${docId}) may need manual deletion from Cloudflare R2.`);
                }
                await loadItemsFromFirestore();
                renderItemsAdminTable();
                if (itemIdToEditInput.value === docId) {
                    clearItemForm();
                }
            } catch (error) {
                console.error(`[Item Delete] Error deleting item ${docId}:`, error);
                alert("アイテムの削除に失敗しました。");
            }
        }
    }

    // --- Image Upload ---
    // ... (No changes) ...
    if (itemImageFileInput) {
        itemImageFileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                if (file.size > 5 * 1024 * 1024) {
                    alert("ファイルサイズが大きすぎます。5MB以下の画像を選択してください。");
                    itemImageFileInput.value = null;
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
                itemImageUrlInput.value = '';
                uploadProgressContainer.style.display = 'none';
            } else {
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
            uploadProgressText.textContent = 'アップロード中... (0%)';
            let progress = 0;
            const interval = setInterval(() => {
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
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(event) {
            if (event.target === modal) {
                modal.style.display = "none";
            }
        });
    });
});
