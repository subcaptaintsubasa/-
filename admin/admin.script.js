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

    // ★新規: Effect Type Management DOM
    const newEffectTypeNameInput = document.getElementById('newEffectTypeName');
    const addEffectTypeButton = document.getElementById('addEffectTypeButton');
    const effectTypeListContainer = document.getElementById('effectTypeListContainer');
    const editEffectTypeModal = document.getElementById('editEffectTypeModal');
    const editingEffectTypeDocIdInput = document.getElementById('editingEffectTypeDocId');
    const editingEffectTypeNameInput = document.getElementById('editingEffectTypeName');
    const saveEffectTypeEditButton = document.getElementById('saveEffectTypeEditButton');
    const effectTypeSelect = document.getElementById('effectTypeSelect'); // アイテムフォームの効果種類選択

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
    // const itemEffectInput = document.getElementById('itemEffect'); // 従来のテキストエリアは削除
    const itemSourceInput = document.getElementById('itemSource');
    const itemTagsSelectorCheckboxes = document.getElementById('itemTagsSelectorCheckboxes'); 
    const saveItemButton = document.getElementById('saveItemButton');
    const clearFormButton = document.getElementById('clearFormButton');
    const itemsTableBody = document.querySelector('#itemsTable tbody');
    const itemSearchAdminInput = document.getElementById('itemSearchAdmin');
    
    // ★新規: Item Form Effect Input Area DOM
    const effectValueInput = document.getElementById('effectValueInput');
    const effectUnitSelect = document.getElementById('effectUnitSelect');
    const addEffectToListButton = document.getElementById('addEffectToListButton');
    const currentEffectsList = document.getElementById('currentEffectsList');

    let allCategoriesCache = []; 
    let allTagsCache = [];      
    let itemsCache = [];
    let effectTypesCache = []; // ★追加: 効果種類キャッシュ
    let currentItemEffects = []; // ★追加: 編集中のアイテムの効果リスト保持用
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

    if (loginButton) { /* 変更なし */ }
    if (logoutButton) { /* 変更なし */ }
    
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

        if (effectTypeListContainer) effectTypeListContainer.innerHTML = ''; // 効果種類リストクリア
        if (effectTypeSelect) effectTypeSelect.innerHTML = '<option value="">効果種類を選択...</option>'; // 効果種類選択クリア

        if (itemsTableBody) itemsTableBody.innerHTML = '';
        if (itemTagsSelectorCheckboxes) itemTagsSelectorCheckboxes.innerHTML = ''; 
        clearItemForm();
    }

    async function loadInitialData() {
        console.log("[Initial Load] Starting...");
        await loadEffectTypesFromFirestore(); // ★効果種類を先にロード
        await loadCategoriesFromFirestore();
        await loadTagsFromFirestore();
        await loadItemsFromFirestore();
        
        populateParentCategoryButtons(newCategoryParentButtons, selectedNewParentCategoryIdInput); 
        populateCategoryCheckboxesForTagAssignment(newTagCategoriesCheckboxes);
        populateTagCheckboxesForItemForm();
        populateEffectTypeSelect(); // ★アイテムフォームの効果種類選択を埋める

        renderCategoriesForManagement();
        renderTagsForManagement();
        renderEffectTypesForManagement(); // ★効果種類リスト表示
        renderItemsAdminTable();
        console.log("[Initial Load] Completed.");
    }

    // --- Effect Type Management (★新規) ---
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
            // 重複チェック (任意)
            if (effectTypesCache.some(et => et.name.toLowerCase() === name.toLowerCase())) {
                alert("同じ名前の効果種類が既に存在します。"); return;
            }
            try {
                await addDoc(collection(db, 'effect_types'), { name: name });
                newEffectTypeNameInput.value = '';
                await loadEffectTypesFromFirestore();
                renderEffectTypesForManagement();
                populateEffectTypeSelect(); // アイテムフォームの選択肢も更新
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
            // 重複チェック (自身を除く)
            if (effectTypesCache.some(et => et.id !== id && et.name.toLowerCase() === newName.toLowerCase())) {
                 alert("編集後の名前が他の効果種類と重複します。"); return;
            }
            try {
                await updateDoc(doc(db, 'effect_types', id), { name: newName });
                if (editEffectTypeModal) editEffectTypeModal.style.display = 'none';
                await loadEffectTypesFromFirestore();
                renderEffectTypesForManagement();
                populateEffectTypeSelect();
                 // ★注意: アイテムデータの structured_effects 内の type 名は自動更新されない
                 // 必要であれば、関連アイテムを検索して更新する処理が必要だが、今回は省略
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
                  // ★注意: アイテムデータの structured_effects 内の type ID を削除する処理も必要なら実装
                  // 例: 関連アイテムを検索し、該当する効果オブジェクトを配列から削除するバッチ処理
             } catch (error) {
                  console.error("[Effect Types] Error deleting:", error);
                  alert("効果種類の削除に失敗しました。");
             }
         }
    }

    // --- Category Management ---
    async function loadCategoriesFromFirestore() { /* 修正なし */ }
    function populateParentCategoryButtons(buttonContainer, hiddenInput, options = {}) { /* 修正なし */ }
    function selectParentCategoryButton(container, hiddenInput, clickedButton, parentId) { /* 修正なし */ } 
    function renderCategoriesForManagement() { /* 修正なし (一覧への検索モード表示は追加済み) */ }
    if (addCategoryButton) { /* 修正なし (子カテゴリのデフォルト検索モード設定は追加済み) */ } 
    // ★編集モーダル表示時に親カテゴリはタグ・検索モード設定を隠す
    function openEditCategoryModal(category) { 
        const docId = category.id;
        const currentName = category.name;
        const currentParentId = category.parentId || "";
        const currentTagSearchMode = category.tagSearchMode || 'AND'; 

        console.log(`[Category Edit] Opening modal for ID: ${docId}, Name: ${currentName}, ParentID: ${currentParentId}, Mode: ${currentTagSearchMode}`);
        editingCategoryDocIdInput.value = docId;
        editingCategoryNameInput.value = currentName;
        
        populateParentCategoryButtons(editingCategoryParentButtons, selectedEditingParentCategoryIdInput, { currentCategoryIdToExclude: docId, selectedParentId: currentParentId });
        
        if (currentParentId) { // 子カテゴリの場合
            populateTagsForCategoryEdit(editingCategoryTagsSelector, docId);
            if(editingCategoryTagsSelector) editingCategoryTagsSelector.closest('.form-group').style.display = 'block'; 
            if(tagSearchModeGroup) tagSearchModeGroup.style.display = 'block';
            if(editingTagSearchModeSelect) editingTagSearchModeSelect.value = currentTagSearchMode;
        } else { // 親カテゴリの場合
            if(editingCategoryTagsSelector) editingCategoryTagsSelector.innerHTML = '<p>親カテゴリには直接タグを紐付けません。</p>';
            if(editingCategoryTagsSelector) editingCategoryTagsSelector.closest('.form-group').style.display = 'none'; 
            if(tagSearchModeGroup) tagSearchModeGroup.style.display = 'none';
        }

        editCategoryModal.style.display = 'flex';
        editingCategoryNameInput.focus();
    }
    function populateTagsForCategoryEdit(containerElement, categoryId) { /* 修正なし */ }
    if (saveCategoryEditButton) { /* 修正なし (tagSearchMode保存、親になる場合のタグ解除は実装済み) */ }
    async function deleteCategory(docId, categoryName) { /* 修正なし */ }


    // --- Tag Management ---
    async function loadTagsFromFirestore() { /* 修正なし */ }
    // ★所属カテゴリ選択肢から親カテゴリを除外
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

    // ★アイテムフォームの効果種類選択肢を生成
    function populateEffectTypeSelect() {
        if (!effectTypeSelect) return;
        // 現在の値とオプションを保持しておく（再生成時に復元するため）
        const currentVal = effectTypeSelect.value;
        const existingOptionsHTML = Array.from(effectTypeSelect.options).map(opt => opt.outerHTML).join('');

        effectTypeSelect.innerHTML = '<option value="">効果種類を選択...</option>';
        effectTypesCache.forEach(et => {
            // ID を value に、名前を text に設定
            effectTypeSelect.add(new Option(et.name, et.id));
        });

        // 以前に選択されていた値を復元しようと試みる
        if (currentVal && effectTypeSelect.querySelector(`option[value="${currentVal}"]`)) {
            effectTypeSelect.value = currentVal;
        } else {
            // 以前の値がない、または削除された場合は、デフォルト（最初のオプション）のまま
        }
    }

    // ★アイテムフォームの効果リスト表示・操作
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
            const unitText = effect.unit !== 'none' ? effect.unit : ''; // 単位なしの場合は空

            const div = document.createElement('div');
            div.classList.add('effect-list-item');
            div.innerHTML = `
                <span>${typeName}: ${effect.value}${unitText}</span>
                <button type="button" class="delete-effect-from-list action-button delete" data-index="${index}" title="削除">×</button>
            `;
            currentEffectsList.appendChild(div);
        });
        // 削除ボタンにイベントリスナーを追加
        currentEffectsList.querySelectorAll('.delete-effect-from-list').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const indexToRemove = parseInt(e.currentTarget.dataset.index, 10);
                currentItemEffects.splice(indexToRemove, 1); // 配列から削除
                renderCurrentItemEffectsList(); // リスト再描画
            });
        });
    }

    // ★「効果を追加」ボタンの処理
    if (addEffectToListButton) {
        addEffectToListButton.addEventListener('click', () => {
            const typeId = effectTypeSelect.value;
            const valueStr = effectValueInput.value;
            const unit = effectUnitSelect.value;

            if (!typeId) { alert("効果種類を選択してください。"); return; }
            if (valueStr === '' || isNaN(parseFloat(valueStr))) { // 数値かどうかのチェック
                alert("効果の値を数値で入力してください。"); return;
            }
            const value = parseFloat(valueStr);

            // currentItemEffects 配列に追加
            currentItemEffects.push({ type: typeId, value: value, unit: unit });
            
            // リスト表示を更新
            renderCurrentItemEffectsList();

            // 入力欄をクリア
            effectTypeSelect.value = '';
            effectValueInput.value = '';
            effectUnitSelect.value = 'point'; // デフォルトに戻す
        });
    }

    async function loadItemsFromFirestore() { /* 修正なし */ }
    
    // ★アイテム保存処理で structured_effects を保存
    if (itemForm) {
        itemForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = itemNameInput.value.trim();
            // const effect = itemEffectInput.value.trim(); // 従来のテキスト入力は削除
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
                // ★ itemData に structured_effects を含める
                const itemData = {
                    name: name || "", 
                    image: imageUrl || "", 
                    // effect: "", // 従来の effect フィールドは削除または空にする
                    structured_effects: currentItemEffects, // ★現在の効果リストを保存
                    入手手段: source || "", 
                    tags: selectedItemTagIds, 
                    updatedAt: serverTimestamp()
                };
                if (editingDocId) {
                     console.log(`[Item Save] Updating item ${editingDocId} with effects:`, currentItemEffects);
                    await updateDoc(doc(db, 'items', editingDocId), itemData);
                } else {
                    itemData.createdAt = serverTimestamp();
                    console.log(`[Item Save] Adding new item with effects:`, currentItemEffects);
                    await addDoc(collection(db, 'items'), itemData);
                }
                await loadItemsFromFirestore();
                renderItemsAdminTable();
                clearItemForm(); // currentItemEffects もクリアされる
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

    // ★フォームクリア時に currentItemEffects もリセット
    function clearItemForm() {
        if (itemForm) itemForm.reset();
        itemIdToEditInput.value = '';
        itemImageUrlInput.value = '';
        if (itemImagePreview) { itemImagePreview.src = '#'; itemImagePreview.style.display = 'none'; }
        if (itemImageFileInput) itemImageFileInput.value = null;
        selectedImageFile = null;
        uploadProgressContainer.style.display = 'none';
        populateTagCheckboxesForItemForm(); 
        
        // ★効果リストと入力欄もクリア
        currentItemEffects = [];
        renderCurrentItemEffectsList();
        if(effectTypeSelect) effectTypeSelect.value = '';
        if(effectValueInput) effectValueInput.value = '';
        if(effectUnitSelect) effectUnitSelect.value = 'point';

        if (saveItemButton) saveItemButton.textContent = "アイテム保存";
    }

    // ★アイテムテーブルの効果表示を structured_effects ベースに変更
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
            
            // ★効果の表示を生成
            let effectsDisplay = '(未設定)';
            if (item.structured_effects && item.structured_effects.length > 0) {
                 effectsDisplay = item.structured_effects.map(eff => {
                     const type = effectTypesCache.find(et => et.id === eff.type)?.name || '不明';
                     const unit = eff.unit !== 'none' ? eff.unit : '';
                     return `${type}: ${eff.value}${unit}`;
                 }).join(', ');
                 if (effectsDisplay.length > 30) effectsDisplay = effectsDisplay.substring(0, 30) + '...';
            }

            const nameDisplay = item.name || '(名称未設定)';
            tr.innerHTML = `
                <td><img src="${imageDisplayPath}" alt="${nameDisplay}" onerror="this.onerror=null; this.src='../images/placeholder_item.png';"></td>
                <td>${nameDisplay}</td><td>${effectsDisplay}</td><td>${itemTagsString}</td>
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

    // ★アイテム編集読み込み時に structured_effects を currentItemEffects にセット
    async function loadItemForEdit(docId) {
        try {
            const itemSnap = await getDoc(doc(db, "items", docId));
            if (itemSnap.exists()) {
                const itemData = itemSnap.data();
                itemIdToEditInput.value = itemSnap.id;
                itemNameInput.value = itemData.name || "";
                // itemEffectInput.value = itemData.effect || ""; // 従来のテキスト欄は削除
                itemSourceInput.value = itemData.入手手段 || "";
                itemImageUrlInput.value = itemData.image || '';
                if (itemData.image) {
                    itemImagePreview.src = itemData.image; itemImagePreview.style.display = 'block';
                } else {
                    itemImagePreview.src = '#'; itemImagePreview.style.display = 'none';
                }
                if (itemImageFileInput) itemImageFileInput.value = null; selectedImageFile = null;
                
                populateTagCheckboxesForItemForm(itemData.tags || []); 
                
                // ★効果リストを設定・表示
                currentItemEffects = itemData.structured_effects || [];
                renderCurrentItemEffectsList();

                if (saveItemButton) saveItemButton.textContent = "アイテム更新";
                if (itemForm) itemForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else { alert("編集対象のアイテムが見つかりませんでした。"); }
        } catch (error) { console.error("[Item Edit] Error loading:", error); alert("編集データ読込エラー"); }
    }
    
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
