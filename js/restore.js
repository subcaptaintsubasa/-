import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, updateDoc, writeBatch } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// --- Firebase Configuration ---
// ※重要※ ここに実際のFirebaseプロジェクト設定を記述してください。
// admin-main.js などからコピーすることを想定しています。
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// --- Initialize Firebase ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Global Variables ---
let allCategoriesFromBackup = [];
let allCategoriesFromDB = []; // { id: string, name: string, parentId: string | null }[]

// --- DOM Elements ---
const passwordPrompt = document.getElementById('password-prompt');
const mainContent = document.getElementById('main-content');
const adminEmailInput = document.getElementById('adminEmailInput');
const adminPasswordInput = document.getElementById('adminPasswordInput');
const loginButton = document.getElementById('loginButton');
const logoutButton = document.getElementById('logoutButton');
const passwordError = document.getElementById('passwordError');
const backupFileElement = document.getElementById('backupFile');
const analyzeButton = document.getElementById('analyzeButton');
const tasksContainer = document.getElementById('tasksContainer');

// --- Authentication ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        passwordPrompt.style.display = 'none';
        mainContent.style.display = 'block';
        adminEmailInput.value = '';
        adminPasswordInput.value = '';
        loadCurrentDBCategories(); // ログイン後に現在のDBカテゴリを読み込む
    } else {
        passwordPrompt.style.display = 'flex';
        mainContent.style.display = 'none';
        tasksContainer.innerHTML = ''; // ログアウト時にタスクリストをクリア
        allCategoriesFromBackup = [];
        allCategoriesFromDB = [];
        backupFileElement.value = '';
        analyzeButton.disabled = true;
    }
});

loginButton.addEventListener('click', async () => {
    const email = adminEmailInput.value;
    const password = adminPasswordInput.value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
        passwordError.textContent = '';
    } catch (error) {
        console.error("Login failed:", error);
        passwordError.textContent = "ログインに失敗しました: " + error.message;
    }
});

logoutButton.addEventListener('click', async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Logout failed:", error);
        alert("ログアウトに失敗しました。");
    }
});

// --- File Handling ---
backupFileElement.addEventListener('change', (event) => {
    if (event.target.files.length > 0) {
        analyzeButton.disabled = false;
    } else {
        analyzeButton.disabled = true;
    }
});

analyzeButton.addEventListener('click', handleFileAndAnalyze);

async function handleFileAndAnalyze() {
    if (backupFileElement.files.length === 0) {
        alert("まずバックアップファイルを選択してください。");
        return;
    }
    const file = backupFileElement.files[0];
    const reader = new FileReader();

    reader.onload = async (e) => {
        try {
            const fileContent = e.target.result;
            const backupData = JSON.parse(fileContent);
            
            if (!backupData.categories || !Array.isArray(backupData.categories)) {
                throw new Error("バックアップファイルに 'categories' 配列が含まれていません。");
            }
            allCategoriesFromBackup = backupData.categories;
            console.log("Backup categories loaded:", allCategoriesFromBackup);

            if (allCategoriesFromDB.length === 0) {
                await loadCurrentDBCategories(); // 念のため再ロード
            }
            if (allCategoriesFromDB.length === 0) {
                 alert("現在のデータベースからカテゴリ情報を取得できませんでした。ログイン状態を確認してください。");
                 return;
            }

            displayCategoryRestorationTasks();
        } catch (error) {
            console.error("Error processing backup file:", error);
            alert("バックアップファイルの処理中にエラーが発生しました: " + error.message);
            tasksContainer.innerHTML = '<p style="color:red;">エラー: バックアップファイルを処理できませんでした。</p>';
        }
    };
    reader.onerror = () => {
        console.error("Error reading file:", reader.error);
        alert("ファイルの読み込み中にエラーが発生しました。");
        tasksContainer.innerHTML = '<p style="color:red;">エラー: ファイルを読み込めませんでした。</p>';
    };
    reader.readAsText(file);
}

// --- Firestore Data Fetching ---
async function loadCurrentDBCategories() {
    try {
        const categoriesCol = collection(db, "categories");
        const categorySnapshot = await getDocs(categoriesCol);
        allCategoriesFromDB = categorySnapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name || "名前なし", // nameがない場合を考慮
            parentId: doc.data().parentId || null
        }));
        console.log("Current DB categories loaded:", allCategoriesFromDB);
    } catch (error) {
        console.error("Error loading categories from DB:", error);
        alert("データベースから現在のカテゴリ情報を読み込めませんでした: " + error.message);
        allCategoriesFromDB = []; // エラー時は空にする
    }
}


// --- UI Rendering for Category Restoration ---
function displayCategoryRestorationTasks() {
    tasksContainer.innerHTML = ''; // Clear previous tasks

    if (allCategoriesFromBackup.length === 0) {
        tasksContainer.innerHTML = "<p>バックアップデータにカテゴリが見つかりません。</p>";
        return;
    }
    if (allCategoriesFromDB.length === 0) {
        tasksContainer.innerHTML = "<p>現在のデータベースからカテゴリ情報を取得できていません。</p>";
        return;
    }

    // 1. Group backup children by their old parentId
    const childrenByOldParentId = {};
    allCategoriesFromBackup.forEach(cat => {
        if (cat.parentId) { // Only consider children
            if (!childrenByOldParentId[cat.parentId]) {
                childrenByOldParentId[cat.parentId] = [];
            }
            childrenByOldParentId[cat.parentId].push(cat);
        }
    });

    if (Object.keys(childrenByOldParentId).length === 0) {
        tasksContainer.innerHTML = "<p>バックアップデータに親子関係を持つカテゴリが見つかりませんでした（ルートカテゴリのみか、データ構造が異なります）。</p>";
        return;
    }

    // 2. Get current potential parent categories from DB (those without a parentId)
    const currentPotentialParents = allCategoriesFromDB.filter(cat => !cat.parentId);
    currentPotentialParents.sort((a, b) => (a.name || "").localeCompare(b.name || ""));


    // 3. Create UI for each group
    for (const oldParentId in childrenByOldParentId) {
        const childGroupFromBackup = childrenByOldParentId[oldParentId];
        
        // Try to find the name of the old parent from the backup data
        // This assumes the oldParentId was an ID that existed on another category in the backup.
        // Since backup doesn't have explicit IDs, we can't directly look it up.
        // For now, we'll just show the oldParentId. A more advanced version might try to guess based on names.
        // OR, if your backup has a structure like { "oldIdValue": { name: "Parent", ... } }, this would be different.
        // Assuming parentId is just a string ID from the old system.
        const oldParentNameGuess = `(旧親ID: ${oldParentId})`; // Placeholder

        const groupDiv = document.createElement('div');
        groupDiv.className = 'task-group';
        groupDiv.dataset.oldParentId = oldParentId;

        let childrenHtml = childGroupFromBackup.map(child => `<li>${child.name || "名前なし"}</li>`).join('');
        
        groupDiv.innerHTML = `
            <h4>
                バックアップ時の親情報: <span class="old-parent-id-display">${oldParentNameGuess}</span>
            </h4>
            <p>このグループに属していた子カテゴリ (バックアップ時の名前):</p>
            <ul class="child-list">${childrenHtml}</ul>
            <div class="task-item">
                <label for="parent-select-${oldParentId}">現在の正しい親カテゴリを選択:</label>
                <select id="parent-select-${oldParentId}">
                    <option value="">親を選択...</option>
                    ${currentPotentialParents.map(p => `<option value="${p.id}">${p.name} (ID: ${p.id.substring(0,5)}...)</option>`).join('')}
                </select>
                <button class="update-parent-button" type="button">このグループの親を更新</button>
            </div>
            <div class="status-message" style="margin-top: 10px; font-style: italic;"></div>
        `;
        tasksContainer.appendChild(groupDiv);
    }

    // Add event listeners to "Update" buttons
    document.querySelectorAll('.update-parent-button').forEach(button => {
        button.addEventListener('click', handleUpdateParentForGroup);
    });
}

// --- Update Logic ---
async function handleUpdateParentForGroup(event) {
    const button = event.target;
    const groupDiv = button.closest('.task-group');
    const oldParentId = groupDiv.dataset.oldParentId;
    const selectElement = groupDiv.querySelector('select');
    const newParentDbId = selectElement.value;
    const statusMessageDiv = groupDiv.querySelector('.status-message');

    statusMessageDiv.textContent = '更新中...';
    button.disabled = true;
    selectElement.disabled = true;

    if (!newParentDbId) {
        alert("新しい親カテゴリを選択してください。");
        statusMessageDiv.textContent = 'エラー: 新しい親が選択されていません。';
        statusMessageDiv.style.color = 'red';
        button.disabled = false;
        selectElement.disabled = false;
        return;
    }

    const childGroupFromBackup = allCategoriesFromBackup.filter(cat => cat.parentId === oldParentId);

    if (childGroupFromBackup.length === 0) {
        statusMessageDiv.textContent = 'エラー: 更新対象の子カテゴリが見つかりません (バックアップデータ内)。';
        statusMessageDiv.style.color = 'red';
        button.disabled = false;
        selectElement.disabled = false;
        return;
    }
    
    const batch = writeBatch(db);
    let updatesCount = 0;
    const updatedChildrenInfo = [];

    for (const backupChild of childGroupFromBackup) {
        // Find the corresponding child in the current DB by name
        const currentDbChild = allCategoriesFromDB.find(dbCat => dbCat.name === backupChild.name);
        
        if (currentDbChild) {
            if (currentDbChild.parentId !== newParentDbId) { // Only update if different
                const childRef = doc(db, "categories", currentDbChild.id);
                batch.update(childRef, { parentId: newParentDbId });
                updatesCount++;
                updatedChildrenInfo.push(`"${backupChild.name}" (DB ID: ${currentDbChild.id.substring(0,5)}...)`);
            } else {
                 updatedChildrenInfo.push(`"${backupChild.name}" は既に正しい親です。`);
            }
        } else {
            console.warn(`Backup child "${backupChild.name}" not found in current DB by name.`);
            updatedChildrenInfo.push(`警告: "${backupChild.name}" は現在のDBに見つかりませんでした。`);
        }
    }

    if (updatesCount > 0) {
        try {
            await batch.commit();
            statusMessageDiv.textContent = `${updatesCount}件の子カテゴリの親を更新しました: ${updatedChildrenInfo.join(', ')}. ページを再読み込みして確認してください。`;
            statusMessageDiv.style.color = 'green';
            // Reflect change in local allCategoriesFromDB for subsequent operations (optional, better to re-fetch)
            childGroupFromBackup.forEach(backupChild => {
                const currentDbChild = allCategoriesFromDB.find(dbCat => dbCat.name === backupChild.name);
                if (currentDbChild) currentDbChild.parentId = newParentDbId;
            });

        } catch (error) {
            console.error("Error updating parent IDs:", error);
            statusMessageDiv.textContent = `エラー: 親IDの更新中に問題が発生しました: ${error.message}`;
            statusMessageDiv.style.color = 'red';
        }
    } else {
        statusMessageDiv.textContent = `更新する変更はありませんでした。(${updatedChildrenInfo.join(', ')})`;
        statusMessageDiv.style.color = 'orange';
    }
    button.disabled = false; // Re-enable button, but not select, to prevent re-submitting same group
    // selectElement.disabled = false; // If you want to allow re-selection
}

// --- Initial Load (if already logged in) ---
// This is handled by onAuthStateChanged
