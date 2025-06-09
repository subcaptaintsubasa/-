// js/restore.js
import { auth, db } from '../firebase-config.js'; // Ensure this path is correct
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { collection, getDocs, writeBatch, doc, query, where } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

const DOMR = { // Renamed to avoid conflict if other DOM objects are used
    passwordPrompt: document.getElementById('password-prompt'),
    mainContent: document.getElementById('main-content'),
    loginButton: document.getElementById('loginButton'),
    logoutButton: document.getElementById('logoutButton'),
    adminEmailInput: document.getElementById('adminEmailInput'),
    adminPasswordInput: document.getElementById('adminPasswordInput'),
    passwordError: document.getElementById('passwordError'),
    backupFileInput: document.getElementById('backupFile'),
    analyzeButton: document.getElementById('analyzeButton'),
    tasksContainer: document.getElementById('tasksContainer'),
};

// --- Authentication ---
onAuthStateChanged(auth, user => {
    DOMR.passwordPrompt.style.display = user ? 'none' : 'flex';
    DOMR.mainContent.style.display = user ? 'block' : 'none';
    if (!user) {
        DOMR.adminEmailInput.value = '';
        DOMR.adminPasswordInput.value = '';
        DOMR.passwordError.textContent = '';
        resetAnalysisUI();
    }
});

DOMR.loginButton.addEventListener('click', () => {
    signInWithEmailAndPassword(auth, DOMR.adminEmailInput.value, DOMR.adminPasswordInput.value)
        .catch(err => {
            console.error("Login error:", err);
            DOMR.passwordError.textContent = `ログイン失敗: ${err.message}`;
        });
});

DOMR.logoutButton.addEventListener('click', () => {
    signOut(auth).catch(err => console.error("Logout error:", err));
});

// --- UI Control ---
DOMR.backupFileInput.addEventListener('change', () => {
    DOMR.analyzeButton.disabled = DOMR.backupFileInput.files.length === 0;
    if (DOMR.backupFileInput.files.length > 0) {
        DOMR.tasksContainer.innerHTML = '<p>バックアップファイルを選択しました。「分析＆リスト表示」ボタンを押してください。</p>';
    } else {
        resetAnalysisUI();
    }
});

function resetAnalysisUI() {
    DOMR.tasksContainer.innerHTML = '<p>バックアップファイルを選択し、分析ボタンを押してください。</p>';
    DOMR.backupFileInput.value = ''; // Clear file input
    DOMR.analyzeButton.disabled = true;
}


// --- Analysis and Rendering ---
DOMR.analyzeButton.addEventListener('click', async () => {
    const file = DOMR.backupFileInput.files[0];
    if (!file) {
        alert("バックアップファイルを選択してください。");
        return;
    }

    DOMR.analyzeButton.disabled = true;
    DOMR.analyzeButton.textContent = '分析中...';
    DOMR.tasksContainer.innerHTML = '<p>データを読み込んで分析しています...</p>';

    try {
        const oldBackupString = await file.text();
        const parsedBackup = JSON.parse(oldBackupString);
        
        if (!parsedBackup.collections || !parsedBackup.collections.categories) {
            throw new Error("バックアップファイルの形式が正しくありません。'collections.categories' が見つかりません。");
        }
        const oldCategories = parsedBackup.collections.categories;

        console.log("Old categories from backup:", oldCategories.length);

        const currentCategoriesSnapshot = await getDocs(collection(db, 'categories'));
        const currentCategories = currentCategoriesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        
        console.log("Current categories from DB:", currentCategories.length);

        DOMR.tasksContainer.innerHTML = ''; 
        
        const currentParentCategoryCandidates = currentCategories
            .filter(c => !c.parentId || c.parentId === "")
            .sort((a,b) => a.name.localeCompare(b.name, 'ja'));
        
        console.log("Current parent candidates:", currentParentCategoryCandidates.length);

        // Group old child categories by their old parentId
        const oldChildrenGroups = {};
        oldCategories.forEach(cat => {
            if (cat.parentId && cat.parentId !== "") { // Ensure it's a child
                if (!oldChildrenGroups[cat.parentId]) {
                    const oldParent = oldCategories.find(p => p.id === cat.parentId);
                    oldChildrenGroups[cat.parentId] = {
                        oldParentName: oldParent ? oldParent.name : `不明な親 (旧ID: ${cat.parentId})`,
                        oldParentId: cat.parentId, 
                        childNames: []
                    };
                }
                oldChildrenGroups[cat.parentId].childNames.push(cat.name);
            }
        });
        
        const sortedOldParentIds = Object.keys(oldChildrenGroups).sort((a,b) => {
            return oldChildrenGroups[a].oldParentName.localeCompare(oldChildrenGroups[b].oldParentName, 'ja');
        });

        if (sortedOldParentIds.length === 0) {
            DOMR.tasksContainer.innerHTML = '<p>バックアップファイルに子カテゴリ（parentIdを持つカテゴリ）が見つかりませんでした。</p>';
            return;
        }

        sortedOldParentIds.forEach(oldParentIdKey => {
            const groupData = oldChildrenGroups[oldParentIdKey];
            const groupDiv = document.createElement('div');
            groupDiv.className = 'task-group';

            const header = document.createElement('h4');
            header.textContent = `旧 親カテゴリ: 「${groupData.oldParentName}」 `;
            const oldIdSpan = document.createElement('span');
            oldIdSpan.className = 'old-id';
            oldIdSpan.textContent = `(旧ID: ${groupData.oldParentId})`;
            header.appendChild(oldIdSpan);
            groupDiv.appendChild(header);

            const taskItem = document.createElement('div');
            taskItem.className = 'task-item';

            const childListDiv = document.createElement('div');
            childListDiv.className = 'child-list';
            childListDiv.innerHTML = `<strong>このグループの子カテゴリ (${groupData.childNames.length}件):</strong><ul>${groupData.childNames.map(name => `<li>${name}</li>`).join('')}</ul>`;

            const selectorContainerDiv = document.createElement('div');
            selectorContainerDiv.className = 'selector-container';
            const selectorLabel = document.createElement('label');
            selectorLabel.htmlFor = `selector-${oldParentIdKey}`;
            selectorLabel.textContent = '新しい親カテゴリを選択:';
            
            const selector = document.createElement('select');
            selector.id = `selector-${oldParentIdKey}`;
            let optionsHtml = '<option value="">親なし (最上位にする)</option>';
            currentParentCategoryCandidates.forEach(p => {
                const isRecommended = (p.name === groupData.oldParentName); // Match by name
                optionsHtml += `<option value="${p.id}" ${isRecommended ? 'selected' : ''}>${p.name} (現ID: ${p.id.substring(0,5)}...)</option>`;
            });
            selector.innerHTML = optionsHtml;

            const updateButton = document.createElement('button');
            updateButton.textContent = 'このグループの親を更新';
            updateButton.addEventListener('click', async () => {
                const newParentId = selector.value; // Empty string if "親なし"
                const selectedOptionText = selector.options[selector.selectedIndex].text;
                
                if (!confirm(`子カテゴリグループ (${groupData.childNames.slice(0,3).join(', ')}${groupData.childNames.length > 3 ? '...' : ''}) の親を「${selectedOptionText}」に設定しますか？`)) {
                    return;
                }
                
                updateButton.disabled = true;
                updateButton.textContent = '更新中...';
                let statusMessage = taskItem.querySelector('.status-message');
                if (!statusMessage) {
                    statusMessage = document.createElement('p');
                    statusMessage.className = 'status-message';
                    taskItem.appendChild(statusMessage);
                }
                statusMessage.textContent = "処理中...";
                statusMessage.style.color = "orange";

                try {
                    const batch = writeBatch(db);
                    let updatesCount = 0;
                    for (const childName of groupData.childNames) {
                        // Find current DB categories by name.
                        // This assumes names are unique enough for this restoration pass.
                        const matchingCurrentChildren = currentCategories.filter(c => c.name === childName);
                        
                        if (matchingCurrentChildren.length === 0) {
                            console.warn(`現在のDBに子カテゴリ「${childName}」(旧親: ${groupData.oldParentName}) が見つかりませんでした。スキップします。`);
                            continue;
                        }
                        
                        matchingCurrentChildren.forEach(childToUpdate => {
                            if ((childToUpdate.parentId || "") !== newParentId) {
                                const docRef = doc(db, 'categories', childToUpdate.id);
                                batch.update(docRef, { parentId: newParentId }); // newParentId can be ""
                                updatesCount++;
                                console.log(`Updating ${childToUpdate.name} (ID: ${childToUpdate.id}) parent to ${newParentId || "NONE"}`);
                            } else {
                                console.log(`${childToUpdate.name} (ID: ${childToUpdate.id}) already has parent ${newParentId || "NONE"}. No update needed.`);
                            }
                        });
                    }

                    if (updatesCount > 0) {
                        await batch.commit();
                        statusMessage.textContent = `${updatesCount}件の子カテゴリの親を更新しました。`;
                        statusMessage.style.color = 'green';
                    } else {
                         statusMessage.textContent = '更新対象のカテゴリはありませんでした (既に正しい状態か、DBに子カテゴリが見つかりません)。';
                         statusMessage.style.color = 'blue';
                    }
                    
                    taskItem.style.backgroundColor = '#d4edda'; 
                    selector.disabled = true; 
                    updateButton.textContent = '更新完了'; 
                    // updateButton.disabled = true; // Keep disabled

                    // Refresh currentCategories in memory
                    const updatedSnapshot = await getDocs(collection(db, 'categories'));
                    currentCategories.length = 0; 
                    updatedSnapshot.docs.forEach(d => currentCategories.push({ id: d.id, ...d.data() }));

                } catch (err) {
                    console.error("Update error:", err);
                    statusMessage.textContent = `更新失敗: ${err.message}`;
                    statusMessage.style.color = 'red';
                    updateButton.disabled = false;
                    updateButton.textContent = 'このグループの親を更新';
                }
            });
            
            selectorContainerDiv.appendChild(selectorLabel);
            selectorContainerDiv.appendChild(selector);
            
            taskItem.appendChild(childListDiv);
            taskItem.appendChild(selectorContainerDiv);
            taskItem.appendChild(updateButton);
            
            groupDiv.appendChild(taskItem);
            DOMR.tasksContainer.appendChild(groupDiv);
        });
        
    } catch (error) {
        console.error("Analysis error:", error);
        DOMR.tasksContainer.innerHTML = `<p style="color: red;">ファイル処理エラー: ${error.message}</p><p>コンソールで詳細を確認してください。</p>`;
    } finally {
        DOMR.analyzeButton.disabled = false;
        DOMR.analyzeButton.textContent = '分析＆リスト表示';
    }
});
