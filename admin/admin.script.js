// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { getFirestore, collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp, writeBatch, getDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-storage.js"; // Cloudflare Worker使うなら不要

// ★★★ Cloudflare Worker URL (使う場合) ★★★
const IMAGE_UPLOAD_WORKER_URL = 'https://YOUR_WORKER_SUBDOMAIN.YOUR_ACCOUNT_NAME.workers.dev'; // あなたのWorkerのURL

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBxrE-9E46dplHTuEBmmcJWQRU1vLgAGAU", /* ★ご自身のものに★ */};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
// const storage = getStorage(app); // Worker使うなら不要

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const passwordPrompt = document.getElementById('password-prompt');
    // ... (他のDOM要素取得は省略、HTMLに合わせて追加・削除)
    const newTagNameInput = document.getElementById('newTagName');
    const newTagLevelSelect = document.getElementById('newTagLevel');
    const newTagParentSelect = document.getElementById('newTagParent');
    const addTagButton = document.getElementById('addTagButton');
    const tagListContainer = document.getElementById('tagListContainer');
    const itemEffectInput = document.getElementById('itemEffect'); // requiredなし
    const itemSourceInput = document.getElementById('itemSource'); // requiredなし
    const itemTagsSelectorContainer = document.getElementById('itemTagsSelector');
    // タグ編集モーダルの要素
    const editTagModal = document.getElementById('editTagModal');
    const editingTagDocIdInput = document.getElementById('editingTagDocId');
    const editingTagNameInput = document.getElementById('editingTagName');
    const editingTagLevelInput = document.getElementById('editingTagLevel');
    const editingTagParentSelect = document.getElementById('editingTagParent');
    const saveTagEditButton = document.getElementById('saveTagEditButton');
    // ... (その他必要なDOM要素)

    let allTagsCache = []; // 全タグデータ {id, name, level, parentTagId}
    let itemsCache = [];
    let selectedImageFile = null;

    // --- 認証 --- (変更なし)
    // ... onAuthStateChanged, signInWithEmailAndPassword, signOut ...

    // --- 初期データロード ---
    async function loadInitialData() {
        await loadTagsFromFirestore(); // 先にタグをロード
        await loadItemsFromFirestore();
        renderTagsForManagement();
        populateParentTagSelects(); // 親タグ選択肢を生成
        renderItemTagsSelector();   // アイテムフォーム用タグ選択肢 (Level 3 のみ)
        renderItemsAdminTable();
    }

    // --- タグ管理 (階層対応) ---
    async function loadTagsFromFirestore() {
        try {
            // level昇順、次にname昇順で取得
            const q = query(collection(db, 'tags'), orderBy('level'), orderBy('name'));
            const snapshot = await getDocs(q);
            allTagsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("All Tags loaded from Firestore:", allTagsCache);
        } catch (error) {
            console.error("Error loading tags from Firestore:", error);
            allTagsCache = [];
        }
    }

    // 親タグ選択ドロップダウンを生成する関数
    function populateParentTagSelects() {
        newTagParentSelect.innerHTML = '<option value="">親タグを選択...</option>';
        editingTagParentSelect.innerHTML = '<option value="">親なし (レベル1)</option>';

        const level1Tags = allTagsCache.filter(tag => tag.level === 1);
        const level2Tags = allTagsCache.filter(tag => tag.level === 2);

        level1Tags.forEach(tag => {
            const option = new Option(`${tag.name} (L1)`, tag.id);
            // レベル2の親候補として追加
            if (newTagLevelSelect.value === '2') newTagParentSelect.appendChild(option.cloneNode(true));
            // 編集モーダル用 (表示のみ)
             editingTagParentSelect.appendChild(option.cloneNode(true));
        });
         level2Tags.forEach(tag => {
            const option = new Option(`${tag.name} (L2)`, tag.id);
            // レベル3の親候補として追加
            if (newTagLevelSelect.value === '3') newTagParentSelect.appendChild(option.cloneNode(true));
            // 編集モーダル用 (表示のみ)
             editingTagParentSelect.appendChild(option.cloneNode(true));
        });

        // 新規追加時の親選択の有効/無効を切り替え
        toggleParentSelect();
    }

    // 新規タグレベル選択に応じて親タグ選択を有効化/無効化
    newTagLevelSelect.addEventListener('change', toggleParentSelect);
    function toggleParentSelect() {
        const level = parseInt(newTagLevelSelect.value, 10);
        if (level === 1) {
            newTagParentSelect.disabled = true;
            newTagParentSelect.value = "";
        } else {
            newTagParentSelect.disabled = false;
            // 選択肢を再生成
             populateParentTagSelects();
        }
    }


    function renderTagsForManagement() {
        if (!tagListContainer) return;
        tagListContainer.innerHTML = '';
        // レベルごとにグループ化して表示 (任意)
         [1, 2, 3].forEach(level => {
             const levelGroup = document.createElement('div');
             levelGroup.innerHTML = `<h4>レベル ${level}</h4>`;
             levelGroup.style.marginBottom = '10px';
             const tagsInLevel = allTagsCache.filter(tag => tag.level === level);
             if (tagsInLevel.length === 0) {
                 levelGroup.innerHTML += '<p><i>(タグなし)</i></p>';
             } else {
                tagsInLevel.forEach(tag => {
                    const tagBtn = createTagManagementButton(tag);
                    levelGroup.appendChild(tagBtn);
                });
            }
            tagListContainer.appendChild(levelGroup);
         });
    }

     function createTagManagementButton(tag) {
        const tagBtn = document.createElement('button');
        tagBtn.classList.add('tag-button');
        const parentTag = tag.parentTagId ? allTagsCache.find(t => t.id === tag.parentTagId) : null;
        tagBtn.textContent = tag.name;
         tagBtn.title = `ID: ${tag.id}\nレベル: ${tag.level}${parentTag ? `\n親: ${parentTag.name}` : ''}`;

        const editIcon = document.createElement('span');
        editIcon.classList.add('edit-icon', 'action-icon');
        editIcon.innerHTML = ' ✎';
        editIcon.title = "このタグを編集";
        editIcon.onclick = (e) => { e.stopPropagation(); openEditTagModal(tag); }; // tagオブジェクトを渡す
        tagBtn.appendChild(editIcon);

        const deleteIcon = document.createElement('span');
        deleteIcon.classList.add('delete-icon', 'action-icon');
        deleteIcon.innerHTML = ' ×';
        deleteIcon.title = "このタグを削除";
        deleteIcon.onclick = (e) => { e.stopPropagation(); deleteTag(tag); }; // tagオブジェクトを渡す
        tagBtn.appendChild(deleteIcon);
        return tagBtn;
     }


    if (addTagButton) {
        addTagButton.addEventListener('click', async () => {
            const name = newTagNameInput.value.trim();
            const level = parseInt(newTagLevelSelect.value, 10);
            const parentTagId = (level > 1 && newTagParentSelect.value) ? newTagParentSelect.value : null;

            if (!name) { alert("タグ名を入力してください。"); return; }
            if (level > 1 && !parentTagId) { alert(`レベル${level}のタグには親タグを選択してください。`); return; }

            // 同じレベル・同じ親の下で名前が重複しないかチェック
             const siblingTags = allTagsCache.filter(tag => tag.level === level && tag.parentTagId === parentTagId);
             if (siblingTags.some(tag => tag.name.toLowerCase() === name.toLowerCase())) {
                 alert("同じ階層に同じ名前のタグが既に存在します。"); return;
             }

            try {
                const newTagData = { name, level, parentTagId };
                const docRef = await addDoc(collection(db, 'tags'), newTagData);
                console.log("Tag added with ID: ", docRef.id);
                newTagNameInput.value = '';
                newTagLevelSelect.value = '1'; // Reset form
                toggleParentSelect();
                await loadTagsFromFirestore(); // 再読み込み
                renderTagsForManagement();
                populateParentTagSelects();
                 renderItemTagsSelector();
            } catch (error) {
                console.error("Error adding tag: ", error);
                alert("タグの追加に失敗しました。");
            }
        });
    }

    function openEditTagModal(tag) { // tagオブジェクトを受け取る
        editingTagDocIdInput.value = tag.id;
        editingTagNameInput.value = tag.name;
         editingTagLevelInput.value = tag.level;
         populateParentTagSelects(); // モーダル内の親選択肢を更新
         editingTagParentSelect.value = tag.parentTagId || ""; // 親IDを設定
         editTagModal.style.display = 'flex';
        editingTagNameInput.focus();
    }

    if (saveTagEditButton) {
        saveTagEditButton.addEventListener('click', async () => {
            const docId = editingTagDocIdInput.value;
            const newName = editingTagNameInput.value.trim();
            // レベルと親の変更はUI上は無効化（今回は名前変更のみ）
            // const level = parseInt(editingTagLevelInput.value, 10);
            // const parentTagId = editingTagParentSelect.value || null;

            if (!newName) { alert("タグ名は空にできません。"); return; }

            const originalTag = allTagsCache.find(t => t.id === docId);
            if (!originalTag) return; // 元のタグが見つからない

            // 名前が変更された場合、兄弟要素との重複チェック
             if (newName !== originalTag.name) {
                 const siblingTags = allTagsCache.filter(tag =>
                    tag.id !== docId &&
                    tag.level === originalTag.level &&
                    tag.parentTagId === originalTag.parentTagId
                 );
                 if (siblingTags.some(tag => tag.name.toLowerCase() === newName.toLowerCase())) {
                    alert("同じ階層に同じ名前のタグが既に存在します。"); return;
                 }
             }

            try {
                const tagRef = doc(db, 'tags', docId);
                await updateDoc(tagRef, { name: newName }); // 名前だけ更新
                editTagModal.style.display = 'none';
                await loadTagsFromFirestore(); // 再読み込み
                renderTagsForManagement();
                populateParentTagSelects();
                 renderItemTagsSelector();
            } catch (error) {
                console.error("Error updating tag name: ", error);
                alert("タグ名の更新に失敗しました。");
            }
        });
    }

    async function deleteTag(tag) { // tagオブジェクトを受け取る
        // 子タグや孫タグが存在する場合は削除できないようにする (安全策)
        let hasChildren = false;
        if (tag.level < 3) {
             hasChildren = allTagsCache.some(child => child.parentTagId === tag.id);
             if (tag.level === 1 && !hasChildren) { // Level 1の場合、孫の存在もチェック
                 const level2Ids = allTagsCache.filter(t => t.parentTagId === tag.id).map(t => t.id);
                 hasChildren = allTagsCache.some(grandchild => level2Ids.includes(grandchild.parentTagId));
             }
        }

        if (hasChildren) {
            alert(`タグ「${tag.name}」には下位タグが存在するため削除できません。先に下位タグを削除または移動してください。`);
            return;
        }

        if (confirm(`タグ「${tag.name}」(レベル${tag.level})を削除しますか？\nこのタグを使用しているアイテムからも削除されます。`)) {
            try {
                const tagRef = doc(db, 'tags', tag.id);
                await deleteDoc(tagRef);
                
                // このタグを使用しているアイテムから削除 (レベル3タグのみがアイテムに紐づく想定)
                if (tag.level === 3) {
                    const q = query(collection(db, 'items'), where('tags', 'array-contains', tag.id));
                    const itemsToUpdateSnapshot = await getDocs(q);
                    if (!itemsToUpdateSnapshot.empty) {
                        const batch = writeBatch(db);
                        itemsToUpdateSnapshot.forEach(itemDocSnap => {
                            const currentTags = itemDocSnap.data().tags || [];
                            const updatedTags = currentTags.filter(tagId => tagId !== tag.id);
                            batch.update(itemDocSnap.ref, { tags: updatedTags });
                        });
                        await batch.commit();
                        console.log(`${itemsToUpdateSnapshot.size} items updated after tag deletion.`);
                    }
                }
                
                await loadInitialData(); // 全データ再読み込み
            } catch (error) {
                console.error("Error deleting tag: ", error);
                alert("タグの削除に失敗しました。");
            }
        }
    }
    
    // アイテムフォームのタグ選択 (レベル3のみ表示)
    function renderItemTagsSelector(selectedItemTagIds = []) {
        if (!itemTagsSelectorContainer) return;
        itemTagsSelectorContainer.innerHTML = '';
        const level3Tags = allTagsCache.filter(tag => tag.level === 3);
        level3Tags.forEach(tag => {
            const tagBtn = document.createElement('button');
            tagBtn.type = 'button';
            tagBtn.classList.add('tag-button');
            const parentTag = allTagsCache.find(t => t.id === tag.parentTagId);
            tagBtn.textContent = tag.name + (parentTag ? ` (${parentTag.name})` : ''); // 親の名前も表示 (任意)
            tagBtn.dataset.tagId = tag.id;
            if (selectedItemTagIds.includes(tag.id)) {
                tagBtn.classList.add('selected');
            }
            tagBtn.addEventListener('click', () => {
                tagBtn.classList.toggle('selected');
            });
            itemTagsSelectorContainer.appendChild(tagBtn);
        });
    }

    // 画像アップロード (Cloudflare Worker連携 - 変更なし)
    // ... uploadImageToWorkerAndGetURL ...

    async function loadItemsFromFirestore() { // (変更なし)
        // ...
    }
    
    // アイテム保存処理
    if (itemForm) {
        itemForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = itemNameInput.value.trim();
            const effect = itemEffectInput.value.trim(); // ★ required削除したので、空でもOK
            const source = itemSourceInput.value.trim(); // ★ required削除したので、空でもOK
            const selectedTagIds = Array.from(itemTagsSelectorContainer.querySelectorAll('.tag-button.selected'))
                                      .map(btn => btn.dataset.tagId); // レベル3タグのID
            const editingDocId = itemIdToEditInput.value;
            let imageUrl = itemImageUrlInput.value; 

            // ★ バリデーション変更: 名前のみ必須
            if (!name) { alert("名前は必須です。"); return; }
            // 画像も必須にするならここでチェック: if (!selectedImageFile && !imageUrl) { alert("画像を選択または既存の画像があることを確認してください。"); return; }
            
            saveItemButton.disabled = true;
            saveItemButton.textContent = "保存中...";

            try {
                // 画像アップロード処理 (変更なし)
                if (selectedImageFile) {
                    // ... (Workerへのアップロード、古い画像の削除検討など) ...
                    imageUrl = await uploadImageToWorkerAndGetURL(selectedImageFile);
                    if (!imageUrl && selectedImageFile) { // アップロード失敗した場合
                         saveItemButton.disabled = false;
                         saveItemButton.textContent = editingDocId ? "アイテム更新" : "アイテム保存";
                         return; // 中断
                    }
                }

                const itemData = {
                    name,
                    image: imageUrl || '', // R2 URL or 空
                    effect: effect || '', // ★空を許容
                    入手手段: source || '', // ★空を許容
                    tags: selectedTagIds, // レベル3タグIDの配列
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
                 alert(`アイテムの保存処理中にエラーが発生しました: ${error.message}`);
            } finally {
                saveItemButton.disabled = false;
                saveItemButton.textContent = editingDocId ? "アイテム更新" : "アイテム保存";
            }
        });
    }

    function clearItemForm() { // (変更なし)
        // ...
    }

    function renderItemsAdminTable() { // テーブルのタグ列表示を調整
        if (!itemsTableBody) return;
        itemsTableBody.innerHTML = '';
        const searchTerm = itemSearchAdminInput ? itemSearchAdminInput.value.toLowerCase() : "";
        const filteredItems = itemsCache.filter(item => item.name && item.name.toLowerCase().includes(searchTerm));

        filteredItems.forEach(item => {
            const tr = document.createElement('tr');
            const imageDisplayPath = item.image || '../images/placeholder_item.png';
            
            // レベル3のタグ名のみ表示
            const itemTagsString = item.tags ? item.tags.map(tagId => {
                const tagObj = allTagsCache.find(t => t.id === tagId && t.level === 3);
                return tagObj ? tagObj.name : '';
            }).filter(Boolean).join(', ') : '---'; // 空を除去して結合
            const effectExcerpt = item.effect ? (item.effect.length > 30 ? item.effect.substring(0, 30) + '...' : item.effect) : '---'; // 空の場合

            tr.innerHTML = `
                <td><img src="${imageDisplayPath}" alt="${item.name || ''}" onerror="this.onerror=null; this.src='../images/placeholder_item.png';"></td>
                <td>${item.name || ''}</td>
                <td>${effectExcerpt}</td>
                <td>${itemTagsString}</td>
                <td>
                    <button class="edit-item" data-item-doc-id="${item.docId}" title="編集">✎</button>
                    <button class="delete-item" data-item-doc-id="${item.docId}" title="削除">×</button>
                </td>
            `;
            const editBtn = tr.querySelector('.edit-item');
            const deleteBtn = tr.querySelector('.delete-item');
            if(editBtn) editBtn.addEventListener('click', () => loadItemForEdit(item.docId));
            if(deleteBtn) deleteBtn.addEventListener('click', () => deleteItem(item.docId, item.name, item.image));
            itemsTableBody.appendChild(tr);
        });
    }

    async function loadItemForEdit(docId) { // アイテムフォームのタグ選択をレベル3のみに
        try {
            const itemRef = doc(db, "items", docId);
            const docSnap = await getDoc(itemRef);
            if (docSnap.exists()) {
                const itemData = docSnap.data();
                // ... (他のフィールド設定は同じ) ...
                itemIdToEditInput.value = docSnap.id;
                itemNameInput.value = itemData.name;
                itemEffectInput.value = itemData.effect || ''; // 空の場合に対応
                itemSourceInput.value = itemData.入手手段 || ''; // 空の場合に対応
                itemImageUrlInput.value = itemData.image || '';
                if (itemData.image) { /* ... 画像プレビュー ... */ } else { /* ... */}
                // ...

                renderItemTagsSelector(itemData.tags || []); // レベル3タグの選択状態を復元

                if (saveItemButton) saveItemButton.textContent = "アイテム更新";
                if (itemForm) itemForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else { /* ... エラー処理 ... */ }
        } catch (error) { /* ... エラー処理 ... */ }
    }

    async function deleteItem(docId, itemName, imageUrl) { // (変更なし)
        // ...
    }
    
    // モーダル関連 (変更なし)
    // ...
});
