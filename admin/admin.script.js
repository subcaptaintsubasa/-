// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { getFirestore, collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp, writeBatch, getDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
// Cloudflare Workerを使うのでFirebase Storageは不要

// Your web app's Firebase configuration - ★★★ オリジナルの内容を維持 ★★★
const firebaseConfig = {
  apiKey: "AIzaSyBxrE-9E46dplHTuEBmmcJWQRU1vLgAGAU",
  authDomain: "itemsearchtooleditor.firebaseapp.com",
  projectId: "itemsearchtooleditor", // ← 必須！
  storageBucket: "itemsearchtooleditor.appspot.com", // ← Storage使わない場合でも設定は必要
  messagingSenderId: "243156973544",
  appId: "1:243156973544:web:ffdc31134a35354b6dd65d",
  measurementId: "G-8EHP9MGJ4M" // Optional
};

// Initialize Firebase
const app = initializeApp(firebaseConfig); // ← ここでエラーが出ていたはず
const auth = getAuth(app);
const db = getFirestore(app);
// const storage = getStorage(app); // Worker使うので不要

// ★★★ Cloudflare WorkerのエンドポイントURL ★★★
const IMAGE_UPLOAD_WORKER_URL = 'https://denpa-item-uploader.tsubasa-hsty-f58.workers.dev'; // あなたのWorkerのURLに置き換え済み

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements (変更なし)
    const passwordPrompt = document.getElementById('password-prompt');
    const adminContent = document.getElementById('admin-content');
    const loginButton = document.getElementById('loginButton');
    const adminEmailInput = document.getElementById('adminEmailInput');
    const adminPasswordInput = document.getElementById('adminPasswordInput');
    const passwordError = document.getElementById('passwordError');
    const logoutButton = document.getElementById('logoutButton');
    const currentUserEmailSpan = document.getElementById('currentUserEmail');

    const newTagNameInput = document.getElementById('newTagName');
    const newTagLevelSelect = document.getElementById('newTagLevel'); // 追加要素
    const newTagParentSelect = document.getElementById('newTagParent'); // 追加要素
    const addTagButton = document.getElementById('addTagButton');
    const tagListContainer = document.getElementById('tagListContainer');

    const itemForm = document.getElementById('itemForm');
    const itemIdToEditInput = document.getElementById('itemIdToEdit');
    const itemNameInput = document.getElementById('itemName');
    const itemImageFileInput = document.getElementById('itemImageFile');
    const itemImagePreview = document.getElementById('itemImagePreview');
    const itemImageUrlInput = document.getElementById('itemImageUrl');
    const uploadProgressContainer = document.getElementById('uploadProgressContainer');
    const uploadProgress = document.getElementById('uploadProgress');
    const uploadProgressText = document.getElementById('uploadProgressText');
    const itemEffectInput = document.getElementById('itemEffect'); // required削除済み
    const itemSourceInput = document.getElementById('itemSource'); // required削除済み
    const itemTagsSelectorContainer = document.getElementById('itemTagsSelector');
    const saveItemButton = document.getElementById('saveItemButton');
    const clearFormButton = document.getElementById('clearFormButton');

    const itemsTableBody = document.querySelector('#itemsTable tbody');
    const itemSearchAdminInput = document.getElementById('itemSearchAdmin');

    const editTagModal = document.getElementById('editTagModal');
    const editingTagDocIdInput = document.getElementById('editingTagDocId');
    const editingTagNameInput = document.getElementById('editingTagName');
    const editingTagLevelInput = document.getElementById('editingTagLevel'); // 追加要素
    const editingTagParentSelect = document.getElementById('editingTagParent'); // 追加要素
    const saveTagEditButton = document.getElementById('saveTagEditButton');

    let allTagsCache = [];
    let itemsCache = [];
    let selectedImageFile = null;

    // --- 認証 --- (変更なし)
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
                    passwordError.textContent = `ログインエラー: ${error.code} - ${error.message}`;
                });
        });
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            signOut(auth).catch(error => console.error("Logout error:", error));
        });
    }

    function clearAdminUI() { // (変更なし)
        if (tagListContainer) tagListContainer.innerHTML = '';
        if (itemsTableBody) itemsTableBody.innerHTML = '';
        if (itemTagsSelectorContainer) itemTagsSelectorContainer.innerHTML = '';
        clearItemForm();
    }

    // --- 初期データロード --- (変更なし)
    async function loadInitialData() {
        await loadTagsFromFirestore();
        await loadItemsFromFirestore();
        renderTagsForManagement();
        populateParentTagSelects();
        renderItemTagsSelector();
        renderItemsAdminTable();
    }

    // --- タグ管理 (階層対応) --- (変更なし - 前回の階層対応版と同じ)
    async function loadTagsFromFirestore() {
        try {
            const q = query(collection(db, 'tags'), orderBy('level'), orderBy('name'));
            const snapshot = await getDocs(q);
            allTagsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("All Tags loaded from Firestore:", allTagsCache);
        } catch (error) { console.error("Error loading tags:", error); allTagsCache = []; }
    }

    function populateParentTagSelects() { // (変更なし)
        newTagParentSelect.innerHTML = '<option value="">親タグを選択...</option>';
        editingTagParentSelect.innerHTML = '<option value="">親なし (レベル1)</option>';
        const level = parseInt(newTagLevelSelect.value, 10); // 新規追加時の選択レベル

        const level1Tags = allTagsCache.filter(tag => tag.level === 1);
        const level2Tags = allTagsCache.filter(tag => tag.level === 2);

        level1Tags.forEach(tag => {
            const option = new Option(`${tag.name} (L1)`, tag.id);
            if (level === 2) newTagParentSelect.appendChild(option.cloneNode(true));
            editingTagParentSelect.appendChild(option.cloneNode(true));
        });
        level2Tags.forEach(tag => {
            const option = new Option(`${tag.name} (L2)`, tag.id);
            if (level === 3) newTagParentSelect.appendChild(option.cloneNode(true));
            editingTagParentSelect.appendChild(option.cloneNode(true));
        });
        toggleParentSelect(); // 新規追加用selectのdisabled状態更新
    }

    function toggleParentSelect() { // (変更なし)
        const level = parseInt(newTagLevelSelect.value, 10);
        newTagParentSelect.disabled = (level === 1);
        if (level === 1) newTagParentSelect.value = "";
        else populateParentTagSelects(); // レベル変更時に選択肢を再生成
    }
    if(newTagLevelSelect) newTagLevelSelect.addEventListener('change', toggleParentSelect);


    function renderTagsForManagement() { // (変更なし)
        if (!tagListContainer) return;
        tagListContainer.innerHTML = '';
         [1, 2, 3].forEach(level => {
             const levelGroup = document.createElement('div');
             levelGroup.innerHTML = `<h4>レベル ${level}</h4>`;
             levelGroup.style.marginBottom = '10px';
             const tagsInLevel = allTagsCache.filter(tag => tag.level === level);
             if (tagsInLevel.length === 0) { levelGroup.innerHTML += '<p><i>(タグなし)</i></p>'; }
             else { tagsInLevel.forEach(tag => levelGroup.appendChild(createTagManagementButton(tag))); }
             tagListContainer.appendChild(levelGroup);
         });
    }

     function createTagManagementButton(tag) { // (変更なし)
        const tagBtn = document.createElement('button');
        tagBtn.classList.add('tag-button');
        const parentTag = tag.parentTagId ? allTagsCache.find(t => t.id === tag.parentTagId) : null;
        tagBtn.textContent = tag.name;
        tagBtn.title = `ID: ${tag.id}\nレベル: ${tag.level}${parentTag ? `\n親: ${parentTag.name}` : ''}`;
        const editIcon = document.createElement('span');
        editIcon.classList.add('edit-icon', 'action-icon');
        editIcon.innerHTML = ' ✎';
        editIcon.title = "このタグを編集";
        editIcon.onclick = (e) => { e.stopPropagation(); openEditTagModal(tag); };
        tagBtn.appendChild(editIcon);
        const deleteIcon = document.createElement('span');
        deleteIcon.classList.add('delete-icon', 'action-icon');
        deleteIcon.innerHTML = ' ×';
        deleteIcon.title = "このタグを削除";
        deleteIcon.onclick = (e) => { e.stopPropagation(); deleteTag(tag); };
        tagBtn.appendChild(deleteIcon);
        return tagBtn;
     }


    if (addTagButton) { // (変更なし)
        addTagButton.addEventListener('click', async () => {
            const name = newTagNameInput.value.trim();
            const level = parseInt(newTagLevelSelect.value, 10);
            const parentTagId = (level > 1 && newTagParentSelect.value) ? newTagParentSelect.value : null;
            if (!name) { alert("タグ名を入力してください。"); return; }
            if (level > 1 && !parentTagId) { alert(`レベル${level}のタグには親タグを選択してください。`); return; }
            const siblingTags = allTagsCache.filter(tag => tag.level === level && tag.parentTagId === parentTagId);
            if (siblingTags.some(tag => tag.name.toLowerCase() === name.toLowerCase())) {
                 alert("同じ階層に同じ名前のタグが既に存在します。"); return;
             }
            try {
                const newTagData = { name, level, parentTagId };
                const docRef = await addDoc(collection(db, 'tags'), newTagData);
                console.log("Tag added with ID: ", docRef.id);
                newTagNameInput.value = '';
                newTagLevelSelect.value = '1'; toggleParentSelect();
                await loadTagsFromFirestore();
                renderTagsForManagement();
                populateParentTagSelects();
                 renderItemTagsSelector();
            } catch (error) { console.error("Error adding tag: ", error); alert("タグの追加に失敗しました。"); }
        });
    }

    function openEditTagModal(tag) { // (変更なし)
        editingTagDocIdInput.value = tag.id;
        editingTagNameInput.value = tag.name;
        editingTagLevelInput.value = tag.level;
        populateParentTagSelects();
        editingTagParentSelect.value = tag.parentTagId || "";
        editTagModal.style.display = 'flex';
        editingTagNameInput.focus();
    }

    if (saveTagEditButton) { // (変更なし - 名前変更のみ)
        saveTagEditButton.addEventListener('click', async () => {
            const docId = editingTagDocIdInput.value;
            const newName = editingTagNameInput.value.trim();
            if (!newName) { alert("タグ名は空にできません。"); return; }
            const originalTag = allTagsCache.find(t => t.id === docId);
            if (!originalTag) return;
            if (newName !== originalTag.name) {
                 const siblingTags = allTagsCache.filter(tag => tag.id !== docId && tag.level === originalTag.level && tag.parentTagId === originalTag.parentTagId);
                 if (siblingTags.some(tag => tag.name.toLowerCase() === newName.toLowerCase())) { alert("同じ階層に同じ名前のタグが既に存在します。"); return; }
            }
            try {
                const tagRef = doc(db, 'tags', docId);
                await updateDoc(tagRef, { name: newName });
                editTagModal.style.display = 'none';
                await loadTagsFromFirestore();
                renderTagsForManagement();
                populateParentTagSelects();
                 renderItemTagsSelector();
            } catch (error) { console.error("Error updating tag name: ", error); alert("タグ名の更新に失敗しました。"); }
        });
    }

    async function deleteTag(tag) { // (変更なし)
        let hasChildren = false;
        if (tag.level < 3) {
             hasChildren = allTagsCache.some(child => child.parentTagId === tag.id);
             if (tag.level === 1 && !hasChildren) {
                 const level2Ids = allTagsCache.filter(t => t.parentTagId === tag.id).map(t => t.id);
                 hasChildren = allTagsCache.some(grandchild => level2Ids.includes(grandchild.parentTagId));
             }
        }
        if (hasChildren) { alert(`タグ「${tag.name}」には下位タグが存在するため削除できません。`); return; }
        if (confirm(`タグ「${tag.name}」(レベル${tag.level})を削除しますか？\nこのタグを使用しているアイテムからも削除されます。`)) {
            try {
                const tagRef = doc(db, 'tags', tag.id);
                await deleteDoc(tagRef);
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
                await loadInitialData();
            } catch (error) { console.error("Error deleting tag: ", error); alert("タグの削除に失敗しました。"); }
        }
    }

    // アイテムフォームのタグ選択 (レベル3のみ表示) - (変更なし)
    function renderItemTagsSelector(selectedItemTagIds = []) {
        if (!itemTagsSelectorContainer) return;
        itemTagsSelectorContainer.innerHTML = '';
        const level3Tags = allTagsCache.filter(tag => tag.level === 3);
        level3Tags.forEach(tag => {
            const tagBtn = document.createElement('button');
            tagBtn.type = 'button';
            tagBtn.classList.add('tag-button');
            const parentTag = allTagsCache.find(t => t.id === tag.parentTagId);
            tagBtn.textContent = tag.name + (parentTag ? ` (${parentTag.name})` : '');
            tagBtn.dataset.tagId = tag.id;
            if (selectedItemTagIds.includes(tag.id)) { tagBtn.classList.add('selected'); }
            tagBtn.addEventListener('click', () => { tagBtn.classList.toggle('selected'); });
            itemTagsSelectorContainer.appendChild(tagBtn);
        });
    }

    // 画像アップロード (Cloudflare Worker連携) - (変更なし)
    if (itemImageFileInput) { // (変更なし)
        itemImageFileInput.addEventListener('change', (event) => { /* ... */ });
    }
    async function uploadImageToWorkerAndGetURL(file) { // (変更なし)
        /* ... */
        if (!file) return null;
        uploadProgressContainer.style.display = 'block';
        uploadProgress.value = 0; uploadProgressText.textContent = 'アップロード準備中...';
        const formData = new FormData(); formData.append('imageFile', file);
        try {
            uploadProgressText.textContent = 'アップロード中... (0%)';
            const response = await fetch(IMAGE_UPLOAD_WORKER_URL, { method: 'POST', body: formData });
            if (!response.ok) { /* ...エラー処理... */ return null; }
            const result = await response.json();
            if (result.success && result.imageUrl) { /* ...成功処理... */ return result.imageUrl; }
            else { /* ...エラー処理... */ return null; }
        } catch (error) { /* ...エラー処理... */ return null; }
        finally { uploadProgressContainer.style.display = 'none'; }
    }

    // Firestoreからアイテムロード - (変更なし)
    async function loadItemsFromFirestore() { /* ... */ }

    // アイテム保存処理 - (変更なし - required削除対応は前回反映済み)
    if (itemForm) {
        itemForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = itemNameInput.value.trim();
            const effect = itemEffectInput.value.trim();
            const source = itemSourceInput.value.trim();
            const selectedTagIds = Array.from(itemTagsSelectorContainer.querySelectorAll('.tag-button.selected')).map(btn => btn.dataset.tagId);
            const editingDocId = itemIdToEditInput.value;
            let imageUrl = itemImageUrlInput.value;
            if (!name) { alert("名前は必須です。"); return; }
            saveItemButton.disabled = true; saveItemButton.textContent = "保存中...";
            try {
                if (selectedImageFile) { /* ...画像アップロード & 古い画像削除検討... */ imageUrl = await uploadImageToWorkerAndGetURL(selectedImageFile); if (!imageUrl && selectedImageFile) throw new Error("画像アップロード失敗"); }
                const itemData = { name, image: imageUrl || '', effect: effect || '', 入手手段: source || '', tags: selectedTagIds, updatedAt: serverTimestamp() };
                if (editingDocId) { await updateDoc(doc(db, 'items', editingDocId), itemData); }
                else { itemData.createdAt = serverTimestamp(); await addDoc(collection(db, 'items'), itemData); }
                await loadItemsFromFirestore(); renderItemsAdminTable(); clearItemForm();
            } catch (error) { console.error("Error saving item:", error); alert(`アイテム保存エラー: ${error.message}`); }
            finally { saveItemButton.disabled = false; saveItemButton.textContent = editingDocId ? "アイテム更新" : "アイテム保存"; }
        });
    }

    // フォームクリア - (変更なし)
    if (clearFormButton) { clearFormButton.addEventListener('click', clearItemForm); }
    function clearItemForm() { /* ... */ }

    // アイテムテーブル描画 - (変更なし - required削除対応は前回反映済み)
    function renderItemsAdminTable() { /* ... */ }
    if (itemSearchAdminInput) { itemSearchAdminInput.addEventListener('input', renderItemsAdminTable); }

    // アイテム編集フォーム読み込み - (変更なし - required削除対応は前回反映済み)
    async function loadItemForEdit(docId) { /* ... */ }

    // アイテム削除処理 - (変更なし)
    async function deleteItem(docId, itemName, imageUrl) { /* ... */ }

    // モーダル関連 - (変更なし)
    // ...
});
