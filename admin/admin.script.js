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
    const editCategoryTagsGroup = document.getElementById('editCategoryTagsGroup'); // ★追加

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
    const newEffectTypeUnitSelect = document.getElementById('newEffectTypeUnit'); // ★追加
    const newEffectTypeCalcMethodRadios = document.querySelectorAll('input[name="newCalcMethod"]'); // ★追加
    const addEffectTypeButton = document.getElementById('addEffectTypeButton');
    const effectTypeListContainer = document.getElementById('effectTypeListContainer');
    const editEffectTypeModal = document.getElementById('editEffectTypeModal');
    const editingEffectTypeDocIdInput = document.getElementById('editingEffectTypeDocId');
    const editingEffectTypeNameInput = document.getElementById('editingEffectTypeName');
    const editingEffectTypeUnitSelect = document.getElementById('editingEffectTypeUnit'); // ★追加
    const editingEffectTypeCalcMethodRadios = document.querySelectorAll('input[name="editCalcMethod"]'); // ★追加
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
    // const effectUnitSelect = document.getElementById('effectUnitSelect'); // ★削除
    const effectUnitDisplay = document.getElementById('effectUnitDisplay'); // ★追加
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

    if (loginButton) { /* (変更なし) */ }
    if (logoutButton) { /* (変更なし) */ }
    
    function clearAdminUI() {
        if (categoryListContainer) categoryListContainer.innerHTML = '';
        if (newCategoryParentButtons) newCategoryParentButtons.innerHTML = ''; 
        if (selectedNewParentCategoryIdInput) selectedNewParentCategoryIdInput.value = ''; 
        if (editingCategoryParentButtons) editingCategoryParentButtons.innerHTML = '';
        if (selectedEditingParentCategoryIdInput) selectedEditingParentCategoryIdInput.value = '';
        if (editingCategoryTagsSelector) editingCategoryTagsSelector.innerHTML = ''; 
        if (tagSearchModeGroup) tagSearchModeGroup.style.display = 'none'; 
        if (editingTagSearchModeSelect) editingTagSearchModeSelect.value = 'AND'; 
        if (editCategoryTagsGroup) editCategoryTagsGroup.style.display = 'block'; // デフォルト表示に戻す
        
        if (tagListContainer) tagListContainer.innerHTML = '';
        if (newTagCategoriesCheckboxes) newTagCategoriesCheckboxes.innerHTML = ''; 
        if (editingTagCategoriesCheckboxes) editingTagCategoriesCheckboxes.innerHTML = '';

        if (effectTypeListContainer) effectTypeListContainer.innerHTML = ''; 
        if (effectTypeSelect) effectTypeSelect.innerHTML = '<option value="">効果種類を選択...</option>'; 
        if (newEffectTypeNameInput) newEffectTypeNameInput.value = '';
        if (newEffectTypeUnitSelect) newEffectTypeUnitSelect.value = 'point';
        if (newEffectTypeCalcMethodRadios[0]) newEffectTypeCalcMethodRadios[0].checked = true;


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
            // ★ calculationMethod と defaultUnit も取得
            effectTypesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); 
            console.log("[Effect Types] Loaded:", effectTypesCache);
        } catch (error) {
            console.error("[Effect Types] Error loading:", error);
            effectTypesCache = [];
        }
    }

    // ★一覧に単位と計算方法も表示
    function renderEffectTypesForManagement() {
        if (!effectTypeListContainer) return;
        effectTypeListContainer.innerHTML = '';
        effectTypesCache.forEach(effectType => {
            const unitText = effectType.defaultUnit ? `(${effectType.defaultUnit})` : '(単位未設定)';
            const calcText = effectType.calculationMethod === 'max' ? '(最大値)' : '(加算)'; // デフォルト加算
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
            // ★ オブジェクトを渡すように変更
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
    
    // ★追加時に単位と計算方法も保存
    if (addEffectTypeButton) {
        addEffectTypeButton.addEventListener('click', async () => {
            const name = newEffectTypeNameInput.value.trim();
            const unit = newEffectTypeUnitSelect.value;
            const calcMethodRadio = Array.from(newEffectTypeCalcMethodRadios).find(r => r.checked);
            const calcMethod = calcMethodRadio ? calcMethodRadio.value : 'sum'; // デフォルト加算

            if (!name) { alert("効果種類名を入力してください。"); return; }
            if (effectTypesCache.some(et => et.name.toLowerCase() === name.toLowerCase())) {
                alert("同じ名前の効果種類が既に存在します。"); return;
            }
            try {
                await addDoc(collection(db, 'effect_types'), { 
                    name: name,
                    defaultUnit: unit, // ★保存
                    calculationMethod: calcMethod // ★保存
                });
                newEffectTypeNameInput.value = '';
                newEffectTypeUnitSelect.value = 'point'; // リセット
                if(newEffectTypeCalcMethodRadios[0]) newEffectTypeCalcMethodRadios[0].checked = true; // リセット

                await loadEffectTypesFromFirestore();
                renderEffectTypesForManagement();
                populateEffectTypeSelect(); 
            } catch (error) {
                console.error("[Effect Types] Error adding:", error);
                alert("効果種類の追加に失敗しました。");
            }
        });
    }
    
    // ★引数をオブジェクトに変更し、単位と計算方法をセット
    function openEditEffectTypeModal(effectTypeData) {
        editingEffectTypeDocIdInput.value = effectTypeData.id;
        editingEffectTypeNameInput.value = effectTypeData.name;
        editingEffectTypeUnitSelect.value = effectTypeData.defaultUnit || 'point'; // デフォルト値設定
        
        // 計算方法ラジオボタンを設定
        const calcMethod = effectTypeData.calculationMethod || 'sum';
        const radioToCheck = Array.from(editingEffectTypeCalcMethodRadios).find(r => r.value === calcMethod);
        if (radioToCheck) {
            radioToCheck.checked = true;
        } else if (editingEffectTypeCalcMethodRadios[0]) {
            editingEffectTypeCalcMethodRadios[0].checked = true; // sum をデフォルトに
        }

        if (editEffectTypeModal) editEffectTypeModal.style.display = 'flex';
    }

     // ★保存時に単位と計算方法も更新
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
                    defaultUnit: newUnit, // ★更新
                    calculationMethod: newCalcMethod // ★更新
                 });
                if (editEffectTypeModal) editEffectTypeModal.style.display = 'none';
                await loadEffectTypesFromFirestore();
                renderEffectTypesForManagement();
                populateEffectTypeSelect();
                await loadItemsFromFirestore();
                renderItemsAdminTable();            
            } catch (error) {
                 console.error("[Effect Types] Error updating:", error);
                 alert("効果種類の更新に失敗しました。");
            }
        });
    }

    async function deleteEffectType(id, name) { /* 修正なし */ }

    // --- Category Management ---
    async function loadCategoriesFromFirestore() { /* 修正なし */ }
    function populateParentCategoryButtons(buttonContainer, hiddenInput, options = {}) { /* 修正なし */ }
    function selectParentCategoryButton(container, hiddenInput, clickedButton, parentId) { /* 修正なし */ } 
    function renderCategoriesForManagement() { /* 修正なし (一覧への検索モード表示は追加済み) */ }
    if (addCategoryButton) { /* 修正なし (子カテゴリのデフォルト検索モード設定は追加済み) */ } 
    // ★ openEditCategoryModalで親カテゴリの場合はタグ選択と検索モードを隠す処理は追加済み
    function openEditCategoryModal(category) { 
        const docId = category.id;
        const currentName = category.name;
        const currentParentId = category.parentId || "";
        const currentTagSearchMode = category.tagSearchMode || 'AND'; 

        console.log(`[Category Edit] Opening modal for ID: ${docId}, Name: ${currentName}, ParentID: ${currentParentId}, Mode: ${currentTagSearchMode}`);
        editingCategoryDocIdInput.value = docId;
        editingCategoryNameInput.value = currentName;
        
        populateParentCategoryButtons(editingCategoryParentButtons, selectedEditingParentCategoryIdInput, { currentCategoryIdToExclude: docId, selectedParentId: currentParentId });
        
        const isParentCategory = !currentParentId;
        // ★編集対象が親カテゴリの場合、タグ選択と検索モードを非表示にする
        if (editCategoryTagsGroup) editCategoryTagsGroup.style.display = isParentCategory ? 'none' : 'block'; 
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
    // ★ populateTagsForCategoryEdit も親カテゴリの場合呼び出されないように修正済み
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
    if (saveCategoryEditButton) { /* 修正なし (tagSearchMode保存、親になる場合の処理は実装済み) */ }
    async function deleteCategory(docId, categoryName) { /* 修正なし */ }


    // --- Tag Management ---
    async function loadTagsFromFirestore() { /* 修正なし */ }
    // ★ タグ割当用のカテゴリ選択肢から親カテゴリを除外
    function populateCategoryCheckboxesForTagAssignment(containerElement, selectedCategoryIds = []) {
        if (!containerElement) return;
        containerElement.innerHTML = ''; 
        
        // ★parentIdを持つカテゴリ（子カテゴリ）のみをリストアップ
        const assignableCategories = allCategoriesCache.filter(cat => cat.parentId && cat.parentId !== ""); 

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
    function renderTagsForManagement() { /* 修正なし */ }
    if (addTagButton) { /* 修正なし */ }
    function openEditTagModal(docId, currentName, currentCategoryIds) { /* 修正なし */ }
    if (saveTagEditButton) { /* 修正なし */ }
    async function deleteTag(docId, tagName) { /* 修正なし */ }
    
    // --- Item Management ---
    function populateTagCheckboxesForItemForm(selectedTagIds = []) { /* 修正なし */ }

    // ★アイテムフォームの効果種類選択肢生成（loadInitialDataで呼び出し済み）
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
    
    // ★効果種類選択時に単位を表示するイベントリスナーを追加
    if (effectTypeSelect) {
        effectTypeSelect.addEventListener('change', () => {
            const selectedTypeId = effectTypeSelect.value;
            const selectedEffectType = effectTypesCache.find(et => et.id === selectedTypeId);
            if (effectUnitDisplay) {
                 if (selectedEffectType && selectedEffectType.defaultUnit && selectedEffectType.defaultUnit !== 'none') {
                     effectUnitDisplay.textContent = `(${selectedEffectType.defaultUnit})`; // 単位を表示
                 } else {
                     effectUnitDisplay.textContent = ''; // 単位なし or 未選択時は非表示
                 }
            }
             // 単位入力欄があった場合の値設定（今回は削除したので不要）
             // if (effectUnitSelect && selectedEffectType) {
             //    effectUnitSelect.value = selectedEffectType.defaultUnit || 'point';
             // }
        });
    }


    // ★アイテムフォームの効果リスト表示・操作（修正なし）
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
            const unitText = effect.unit !== 'none' ? `(${effect.unit})` : ''; // 単位表示を括弧付きに

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

    // ★「効果を追加」ボタン（単位は選択された種類から取得）
    if (addEffectToListButton) {
        addEffectToListButton.addEventListener('click', () => {
            const typeId = effectTypeSelect.value;
            const valueStr = effectValueInput.value;
            // const unit = effectUnitSelect.value; // ★単位選択は削除

            if (!typeId) { alert("効果種類を選択してください。"); return; }
            if (valueStr === '' || isNaN(parseFloat(valueStr))) { 
                alert("効果の値を数値で入力してください。"); return;
            }
            const value = parseFloat(valueStr);
            
            // ★選択された効果種類から単位を取得
            const selectedEffectType = effectTypesCache.find(et => et.id === typeId);
            const unit = selectedEffectType ? (selectedEffectType.defaultUnit || 'point') : 'point'; // 見つからない場合point

            currentItemEffects.push({ type: typeId, value: value, unit: unit }); // ★取得した単位で保存
            renderCurrentItemEffectsList();

            effectTypeSelect.value = '';
            effectValueInput.value = '';
            if(effectUnitDisplay) effectUnitDisplay.textContent = ''; // 単位表示もクリア
            // effectUnitSelect.value = 'point'; // 削除したので不要
        });
    }

    async function loadItemsFromFirestore() { /* 修正なし */ }
    
    if (itemForm) { /* 修正なし (structured_effects保存は実装済み) */ }
    if (clearFormButton) { /* 修正なし */ }
    function clearItemForm() { /* 修正なし (currentItemEffectsクリアは実装済み) */ }
    function renderItemsAdminTable() { /* 修正なし (効果表示は実装済み) */ }
    if (itemSearchAdminInput) { /* 修正なし */ }
    function loadItemForEdit(docId) { /* 修正なし (currentItemEffects設定は実装済み) */ }
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
