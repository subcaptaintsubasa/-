// Firebase SDKのインポート (変更なし)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { getFirestore, collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp, writeBatch, getDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-storage.js"; // 画像削除を使うなら残す

// Firebase設定 (変更なし)
const firebaseConfig = { /* ... ご自身のもの ... */ };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app); // R2を使う場合でも、既存画像の削除のために一時的に残す？→R2削除はWorker推奨なので削除

// Cloudflare Worker URL (変更なし)
const IMAGE_UPLOAD_WORKER_URL = 'https://YOUR_WORKER_SUBDOMAIN.YOUR_ACCOUNT_NAME.workers.dev';

document.addEventListener('DOMContentLoaded', () => {
    // DOM要素取得 (カテゴリ関連を追加)
    const passwordPrompt = document.getElementById('password-prompt');
    // ... (他の要素は前回と同じ) ...
    const newCategoryNameInput = document.getElementById('newCategoryName');
    const newCategoryParentSelect = document.getElementById('newCategoryParent');
    const addCategoryButton = document.getElementById('addCategoryButton');
    const categoryTreeContainer = document.getElementById('categoryTree'); // ul要素
    const itemCategorySelectorContainer = document.getElementById('itemCategorySelector'); // アイテムフォーム用
    const editCategoryModal = document.getElementById('editCategoryModal');
    const editingCategoryDocIdInput = document.getElementById('editingCategoryDocId');
    const editingCategoryNameInput = document.getElementById('editingCategoryName');
    const editingCategoryParentSelect = document.getElementById('editingCategoryParent');
    const saveCategoryEditButton = document.getElementById('saveCategoryEditButton');
    const deleteCategoryButton = document.getElementById('deleteCategoryButton');

    let allCategoriesCache = []; // カテゴリデータのキャッシュ
    let itemsCache = [];
    let selectedImageFile = null;

    // --- 認証 --- (変更なし)
    onAuthStateChanged(auth, (user) => { /* ... */ });
    if (loginButton) { loginButton.addEventListener('click', () => { /* ... */ }); }
    if (logoutButton) { logoutButton.addEventListener('click', () => { /* ... */ }); }
    function clearAdminUI() { /* ... */ }

    // --- 初期データロード (カテゴリもロード) ---
    async function loadInitialData() {
        await loadCategoriesFromFirestore(); // ★ カテゴリを先にロード
        await loadItemsFromFirestore();
        populateCategoryDropdowns(); // ★ カテゴリドロップダウンを生成
        renderCategoryTree();        // ★ カテゴリツリーを表示
        renderItemCategorySelector(); // ★ アイテムフォームのセレクタを表示
        renderItemsAdminTable();
    }

    // --- カテゴリ管理 (新規) ---
    async function loadCategoriesFromFirestore() {
        try {
            const q = query(collection(db, 'categories'), orderBy('name')); // まず名前で取得
            const snapshot = await getDocs(q);
            allCategoriesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("Categories loaded from Firestore:", allCategoriesCache);
            // 必要であればここで level や親子関係を再計算/整理する
        } catch (error) {
            console.error("Error loading categories:", error);
            allCategoriesCache = [];
        }
    }

    // カテゴリ追加/編集用のドロップダウンを生成
    function populateCategoryDropdowns(excludeCategoryId = null) {
        const parentSelects = [newCategoryParentSelect, editingCategoryParentSelect];
        parentSelects.forEach(select => {
            if (!select) return;
            const currentValue = select.value; // 現在の選択値を保持
            select.innerHTML = '<option value="">-- 親カテゴリなし (第1階層) --</option>'; // 初期化
            // 第1階層と第2階層のみを親候補とする（無限ループ防止）
            const potentialParents = allCategoriesCache.filter(cat => (!cat.level || cat.level < 3) && cat.id !== excludeCategoryId);
            potentialParents.sort((a, b) => a.name.localeCompare(b.name));
            potentialParents.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.id;
                option.textContent = `${cat.name} (ID: ${cat.id.substring(0, 5)}...)`;
                select.appendChild(option);
            });
            select.value = currentValue; // 元の選択値を復元
        });
    }

    // カテゴリツリー表示 (ul/li形式)
    function renderCategoryTree(parentId = null, level = 1, parentElement = categoryTreeContainer) {
        if (level === 1) parentElement.innerHTML = ''; // 最初だけクリア
        const children = allCategoriesCache.filter(cat => (parentId ? cat.parentId === parentId : !cat.parentId));

        if (children.length > 0 && level <= 3) { // 表示階層を制限 (例: 3階層まで)
            children.forEach(cat => {
                const li = document.createElement('li');
                li.style.marginLeft = `${(level - 1) * 20}px`; // インデント

                const nameSpan = document.createElement('span');
                nameSpan.textContent = cat.name;
                nameSpan.style.cursor = 'pointer';
                nameSpan.style.marginRight = '10px';
                nameSpan.title = `ID: ${cat.id}`;
                nameSpan.onclick = () => openEditCategoryModal(cat.id); // クリックで編集モーダルを開く

                li.appendChild(nameSpan);
                parentElement.appendChild(li);
                renderCategoryTree(cat.id, level + 1, li); // 再帰的に子を表示
            });
        } else if (level === 1 && children.length === 0) {
             parentElement.innerHTML = '<li class="placeholder">カテゴリがありません</li>';
        }
    }


    // 新規カテゴリ追加
    if (addCategoryButton) {
        addCategoryButton.addEventListener('click', async () => {
            const name = newCategoryNameInput.value.trim();
            const parentId = newCategoryParentSelect.value || null; // 空文字列はnullに
            if (!name) { alert("カテゴリ名を入力してください。"); return; }

            // 同階層での名前重複チェック
            const siblingQuery = query(collection(db, 'categories'), where('parentId', '==', parentId), where('name', '==', name));
            const siblingSnapshot = await getDocs(siblingQuery);
            if (!siblingSnapshot.empty) {
                alert("同じ階層に同じ名前のカテゴリが既に存在します。"); return;
            }

            try {
                let level = 1;
                if (parentId) {
                    const parentCat = allCategoriesCache.find(c => c.id === parentId);
                    level = parentCat && parentCat.level ? parentCat.level + 1 : 2; // 親があればレベル+1
                }
                const newCategoryData = { name, parentId, level };
                await addDoc(collection(db, 'categories'), newCategoryData);
                newCategoryNameInput.value = '';
                newCategoryParentSelect.value = '';
                await loadCategoriesFromFirestore(); // 再読み込み
                populateCategoryDropdowns();       // ドロップダウン更新
                renderCategoryTree();              // ツリー更新
                renderItemCategorySelector();      // アイテムフォームも更新
            } catch (error) {
                console.error("Error adding category:", error);
                alert("カテゴリの追加に失敗しました。");
            }
        });
    }

    // カテゴリ編集モーダルを開く
    function openEditCategoryModal(categoryId) {
        const category = allCategoriesCache.find(c => c.id === categoryId);
        if (!category) return;
        editingCategoryDocIdInput.value = category.id;
        editingCategoryNameInput.value = category.name;
        populateCategoryDropdowns(categoryId); // 自分自身を親候補から除外
        editingCategoryParentSelect.value = category.parentId || "";
        editCategoryModal.style.display = 'flex';
    }

    // カテゴリ編集保存
    if (saveCategoryEditButton) {
        saveCategoryEditButton.addEventListener('click', async () => {
            const docId = editingCategoryDocIdInput.value;
            const newName = editingCategoryNameInput.value.trim();
            const newParentId = editingCategoryParentSelect.value || null;
            if (!newName) { alert("カテゴリ名は空にできません。"); return; }

            const originalCategory = allCategoriesCache.find(c => c.id === docId);
            if (!originalCategory) return;

            // 名前と親が両方同じなら何もしない
            if (originalCategory.name === newName && originalCategory.parentId === newParentId) {
                 editCategoryModal.style.display = 'none';
                 return;
            }

            // 同階層での名前重複チェック (自身を除く)
            const siblingQuery = query(collection(db, 'categories'), where('parentId', '==', newParentId), where('name', '==', newName));
            const siblingSnapshot = await getDocs(siblingQuery);
             let conflict = false;
             siblingSnapshot.forEach(docSnap => { if (docSnap.id !== docId) conflict = true; });
             if (conflict) {
                 alert("移動先の階層に同じ名前のカテゴリが既に存在します。"); return;
             }

            try {
                 let newLevel = 1;
                 if (newParentId) {
                     const parentCat = allCategoriesCache.find(c => c.id === newParentId);
                     newLevel = parentCat && parentCat.level ? parentCat.level + 1 : 2;
                 }
                 // TODO: 子カテゴリを持っているカテゴリを、その子孫カテゴリの下に移動させようとしていないかチェック (循環参照防止) - より高度な実装
                const categoryRef = doc(db, 'categories', docId);
                await updateDoc(categoryRef, { name: newName, parentId: newParentId, level: newLevel });
                editCategoryModal.style.display = 'none';
                await loadCategoriesFromFirestore();
                populateCategoryDropdowns();
                renderCategoryTree();
                renderItemCategorySelector();
                 // TODO: 必要であれば、このカテゴリIDを持つアイテムのデータも更新する（通常は不要）
            } catch (error) {
                console.error("Error updating category:", error);
                alert("カテゴリの更新に失敗しました。");
            }
        });
    }

     // カテゴリ削除
    if (deleteCategoryButton) {
        deleteCategoryButton.addEventListener('click', async () => {
            const docId = editingCategoryDocIdInput.value;
            const category = allCategoriesCache.find(c => c.id === docId);
            if (!category) return;

            // 子カテゴリが存在するかチェック
            const childrenExist = allCategoriesCache.some(c => c.parentId === docId);
            if (childrenExist) {
                alert("子カテゴリが存在するため、このカテゴリは削除できません。先に子カテゴリを削除または移動してください。");
                return;
            }

            if (confirm(`カテゴリ「${category.name}」を削除しますか？\nこのカテゴリを使用しているアイテムからも関連付けが解除されます。`)) {
                try {
                    // 1. カテゴリを削除
                    await deleteDoc(doc(db, 'categories', docId));

                    // 2. このカテゴリIDを使用しているアイテムからIDを削除
                    const itemsQuery = query(collection(db, 'items'), where('categoryIds', 'array-contains', docId));
                    const itemsSnapshot = await getDocs(itemsQuery);
                    if (!itemsSnapshot.empty) {
                         const batch = writeBatch(db);
                         itemsSnapshot.forEach(itemDoc => {
                             const currentCats = itemDoc.data().categoryIds || [];
                             const updatedCats = currentCats.filter(cId => cId !== docId);
                             batch.update(itemDoc.ref, { categoryIds: updatedCats });
                         });
                         await batch.commit();
                    }
                    editCategoryModal.style.display = 'none';
                    await loadInitialData(); // 全データ再読込＆再描画
                } catch (error) {
                    console.error("Error deleting category:", error);
                    alert("カテゴリの削除に失敗しました。");
                }
            }
        });
    }

    // --- アイテムフォームのカテゴリ選択 (チェックボックスツリー) ---
    function renderItemCategorySelector(selectedCategoryIds = []) {
        if (!itemCategorySelectorContainer) return;
        itemCategorySelectorContainer.innerHTML = ''; // クリア
        const buildTree = (parentId = null, level = 1, parentElement = itemCategorySelectorContainer) => {
            const children = allCategoriesCache.filter(cat => (parentId ? cat.parentId === parentId : !cat.parentId));
             if (children.length > 0 && level <= 3) { // 表示階層制限
                children.forEach(cat => {
                    const div = document.createElement('div');
                    div.style.marginLeft = `${(level - 1) * 20}px`;

                    const label = document.createElement('label');
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.value = cat.id;
                    checkbox.name = 'itemCategory';
                    checkbox.checked = selectedCategoryIds.includes(cat.id);
                    label.appendChild(checkbox);
                    label.appendChild(document.createTextNode(` ${cat.name}`));

                    div.appendChild(label);
                    parentElement.appendChild(div);
                    buildTree(cat.id, level + 1, div); // 再帰
                });
            }
        };
        buildTree(); // ルートから開始
         if (itemCategorySelectorContainer.innerHTML === '') {
             itemCategorySelectorContainer.innerHTML = '<span class="placeholder">カテゴリが登録されていません</span>';
         }
    }


    // --- 画像アップロード (変更なし) ---
    if (itemImageFileInput) { /* ... */ }
    async function uploadImageToWorkerAndGetURL(file) { /* ... */ }

    // --- アイテム読み込み (変更なし) ---
    async function loadItemsFromFirestore() { /* ... */ }

    // --- アイテム保存処理 (入力緩和、カテゴリID保存) ---
    if (itemForm) {
        itemForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = itemNameInput.value.trim();
            const effect = itemEffectInput.value.trim(); // ★ 必須ではなくなった
            const source = itemSourceInput.value.trim(); // ★ 必須ではなくなった
            const selectedCategoryIds = Array.from(itemCategorySelectorContainer.querySelectorAll('input[name="itemCategory"]:checked'))
                                             .map(cb => cb.value); // ★ カテゴリIDを取得
            const editingDocId = itemIdToEditInput.value;
            let imageUrl = itemImageUrlInput.value;

            // ★ 名前のみ必須チェック
            if (!name) { alert("名前は必須です。"); return; }
            
            saveItemButton.disabled = true;
            saveItemButton.textContent = "保存中...";

            try {
                // 画像アップロード処理 (変更なし)
                if (selectedImageFile) { /* ... */ imageUrl = await uploadImageToWorkerAndGetURL(selectedImageFile); if(!imageUrl){ /* ... */ return; } /* ... */ }

                const itemData = {
                    name,
                    image: imageUrl || '',
                    effect: effect, // 空文字列でもOK
                    入手手段: source, // 空文字列でもOK
                    categoryIds: selectedCategoryIds, // ★ categoryIdsを保存
                    updatedAt: serverTimestamp()
                };
                
                if (editingDocId) {
                    const itemRef = doc(db, 'items', editingDocId);
                    await updateDoc(itemRef, itemData);
                    console.log("Item updated with ID: ", editingDocId);
                } else {
                    itemData.createdAt = serverTimestamp();
                    const docRef = await addDoc(collection(db, 'items'), itemData);
                    console.log("Item added with ID: ", docRef.id);
                }
                
                await loadItemsFromFirestore();
                renderItemsAdminTable();
                clearItemForm();
            } catch (error) {
                console.error("Error saving item: ", error);
                alert(`アイテムの保存に失敗しました: ${error.message}`);
            } finally {
                saveItemButton.disabled = false;
                saveItemButton.textContent = editingDocId ? "アイテム更新" : "アイテム保存";
            }
        });
    }

    // --- フォームクリア、アイテム一覧表示、編集読み込み、削除 (カテゴリ表示対応) ---
    if (clearFormButton) clearFormButton.addEventListener('click', clearItemForm);

    function clearItemForm() {
        // ... (itemCategorySelector のチェックボックスもクリアする必要がある) ...
        if (itemForm) itemForm.reset();
        itemIdToEditInput.value = '';
        itemImageUrlInput.value = '';
        if (itemImagePreview) { itemImagePreview.src = '#'; itemImagePreview.style.display = 'none'; }
        if (itemImageFileInput) itemImageFileInput.value = null;
        selectedImageFile = null;
        uploadProgressContainer.style.display = 'none';
        renderItemCategorySelector(); // チェックボックスをリセット
        if (saveItemButton) saveItemButton.textContent = "アイテム保存";
    }

    function renderItemsAdminTable() {
        if (!itemsTableBody) return;
        itemsTableBody.innerHTML = '';
        const searchTerm = itemSearchAdminInput ? itemSearchAdminInput.value.toLowerCase() : "";
        const filteredItems = itemsCache.filter(item => item.name && item.name.toLowerCase().includes(searchTerm));

        filteredItems.forEach(item => {
            const tr = document.createElement('tr');
            const imageDisplayPath = item.image || '../images/placeholder_item.png';
            // ★ カテゴリ表示に変更
            const categoryString = item.categoryIds ? item.categoryIds.map(catId => {
                const catObj = allCategoriesCache.find(c => c.id === catId);
                return catObj ? catObj.name : `(ID:${catId.substring(0,4)})`;
            }).join(', ') : 'なし';

            tr.innerHTML = `
                <td><img src="${imageDisplayPath}" alt="${item.name || ''}" onerror="this.onerror=null; this.src='../images/placeholder_item.png';"></td>
                <td>${item.name || ''}</td>
                <td>${categoryString}</td> <!-- カテゴリ表示 -->
                <td>
                    <button class="edit-item" data-item-doc-id="${item.docId}" title="編集">✎</button>
                    <button class="delete-item" data-item-doc-id="${item.docId}" title="削除">×</button>
                </td>
            `;
            const editBtn = tr.querySelector('.edit-item');
            const deleteBtn = tr.querySelector('.delete-item');
            if(editBtn) editBtn.addEventListener('click', () => loadItemForEdit(item.docId));
            if(deleteBtn) deleteBtn.addEventListener('click', () => deleteItem(item.docId, item.name)); // imageUrl不要に
            itemsTableBody.appendChild(tr);
        });
    }

    async function loadItemForEdit(docId) {
        try {
            const itemRef = doc(db, "items", docId);
            const docSnap = await getDoc(itemRef);
            if (docSnap.exists()) {
                const itemData = docSnap.data();
                itemIdToEditInput.value = docSnap.id;
                itemNameInput.value = itemData.name;
                itemEffectInput.value = itemData.effect || ''; // 空の場合も考慮
                itemSourceInput.value = itemData.入手手段 || ''; // 空の場合も考慮
                itemImageUrlInput.value = itemData.image || '';
                if (itemData.image) { /* ...画像プレビュー処理...*/ }
                renderItemCategorySelector(itemData.categoryIds || []); // ★ カテゴリ選択復元
                if (saveItemButton) saveItemButton.textContent = "アイテム更新";
                if (itemForm) itemForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } // ... (エラー処理) ...
        } catch (error) { /* ... */ }
    }

    async function deleteItem(docId, itemName) { // ★ imageUrl引数削除
        if (confirm(`アイテム「${itemName}」を削除しますか？\n関連画像はCloudflare R2から手動削除が必要です。`)) {
            try {
                // ★ 画像削除ロジックはここでは行わない (必要なら別途実装)
                await deleteDoc(doc(db, 'items', docId));
                console.log("Item deleted from Firestore: ", docId);
                await loadItemsFromFirestore();
                renderItemsAdminTable();
                if (itemIdToEditInput.value === docId) clearItemForm();
            } catch (error) {
                console.error("Error deleting item:", error);
                alert("アイテムの削除に失敗しました。");
            }
        }
    }

    // --- モーダル関連 --- (変更なし)
    const closeButtons = document.querySelectorAll('.modal .close-button'); /* ... */
    window.onclick = function(event) { /* ... */ }

}); // DOMContentLoaded end
