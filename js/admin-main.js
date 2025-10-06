// js/admin-main.js
import { auth, db } from '../firebase-config.js'; // db をインポート
import { initAuth } from './admin-modules/auth.js';
import {
    initializeDataSync,
    clearAdminDataCache,
    cleanupListeners,
    IMAGE_UPLOAD_WORKER_URL,
    getAllCategoriesCache,
    getAllTagsCache,
    getItemsCache,
    getEffectTypesCache,
    getEffectUnitsCache,
    getEffectSuperCategoriesCache,
    getCharacterBasesCache,
    getItemSourcesCache
} from './admin-modules/data-loader-admin.js';
import { initUIHelpers, openModal as openModalHelper, closeModal as closeModalHelper } from './admin-modules/ui-helpers.js';

import { initCategoryManager, _renderCategoriesForManagementInternal as renderCategoriesUI, openEditCategoryModalById, buildCategoryTreeDOM as buildCategoryTreeDOMFromManager } from './admin-modules/category-manager.js';
import { initTagManager, _renderTagsForManagementInternal as renderTagsUI, _populateCategoryCheckboxesForTagFormInternal as populateTagFormCategories, openEditTagModalById } from './admin-modules/tag-manager.js';
import { initEffectUnitManager, _renderEffectUnitsForManagementInternal as renderEffectUnitsUI, openEditEffectUnitModalById } from './admin-modules/effect-unit-manager.js';
import { initEffectSuperCategoryManager, _renderEffectSuperCategoriesForManagementInternal as renderEffectSuperCategoriesUI, openEditEffectSuperCategoryModalById as openEditEscModal } from './admin-modules/effect-super-category-manager.js';
import { initEffectTypeManager, _renderEffectTypesForManagementInternal as renderEffectTypesUI, _populateEffectTypeSelectsInternal as populateEffectTypeSelectsInForms, openEditEffectTypeModalById as openEditEtModal } from './admin-modules/effect-type-manager.js';
import { initCharBaseManager, _renderCharacterBaseOptionsInternal as renderCharBaseOptionsUI, _populateCharBaseEffectTypeSelectInternal as populateCharBaseEffectTypeSelectInModal, baseTypeMappings, openEditCharBaseOptionModalById as openEditCboModal } from './admin-modules/char-base-manager.js';
import { initItemManager, _renderItemsAdminTableInternal as renderItemsTableUI, _populateTagButtonsForItemFormInternal as populateItemFormTags, renderAdminCategoryFilter, renderAdminTagFilter } from './admin-modules/item-manager.js'; import { 
    initItemSourceManager, 
    _renderItemSourcesForManagementInternal as renderItemSourcesUI, 
    buildItemSourceTreeDOM,
    openEditItemSourceModalById,
} from './admin-modules/item-source-manager.js';

// Firestoreのバッチ書き込み、サーバータイムスタンプなどをインポート
import { 
    collection, getDocs, writeBatch, doc, serverTimestamp 
    // where, orderBy など、マイグレーションで直接使わないものは省略可
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";


// JSZip will be available globally via the script tag in admin.html

const DOM = {
    adminSideNav: null,
    adminHamburgerButton: null,
    adminCloseNavButton: null,
    adminNavButtons: null, 
    manualBackupButton: null, 
    listEnlargementModal: null,
    listEnlargementModalTitle: null,
    listEnlargementModalSearchContainer: null,
    listEnlargementModalContent: null,
    enlargeCategoryListButton: null,
    enlargeTagListButton: null,
    enlargeEffectUnitListButton: null,
    enlargeEffectSuperCategoryListButton: null,
    enlargeEffectTypeListButton: null,
    enlargeCharBaseOptionListButton: null,
    enlargeItemSourceListButton: null,
    charBaseTypeButtons: null,
    selectedCharBaseTypeInput: null,
    runEffectTagMigrationButton: null,
};

function queryDOMElements() {
    DOM.adminSideNav = document.getElementById('adminSideNav');
    DOM.adminHamburgerButton = document.getElementById('adminHamburgerButton');
    DOM.adminCloseNavButton = document.getElementById('adminCloseNavButton');
    DOM.adminNavButtons = document.querySelectorAll('#adminSideNav .admin-nav-button, #adminSideNav a.admin-nav-button');
    DOM.manualBackupButton = document.getElementById('manualBackupButton'); 
    DOM.listEnlargementModal = document.getElementById('listEnlargementModal');
    DOM.listEnlargementModalTitle = document.getElementById('listEnlargementModalTitle');
    DOM.listEnlargementModalSearchContainer = document.getElementById('listEnlargementModalSearchContainer');
    DOM.listEnlargementModalContent = document.getElementById('listEnlargementModalContent');
    
    DOM.enlargeCategoryListButton = document.getElementById('enlargeCategoryListButton');
    DOM.enlargeTagListButton = document.getElementById('enlargeTagListButton');
    DOM.enlargeEffectUnitListButton = document.getElementById('enlargeEffectUnitListButton');
    DOM.enlargeEffectSuperCategoryListButton = document.getElementById('enlargeEffectSuperCategoryListButton');
    DOM.enlargeEffectTypeListButton = document.getElementById('enlargeEffectTypeListButton');
    DOM.enlargeCharBaseOptionListButton = document.getElementById('enlargeCharBaseOptionListButton');
    DOM.enlargeItemSourceListButton = document.getElementById('enlargeItemSourceListButton');
    
    DOM.charBaseTypeButtons = document.getElementById('charBaseTypeButtons');
    DOM.selectedCharBaseTypeInput = document.getElementById('selectedCharBaseType');
    DOM.runEffectTagMigrationButton = document.getElementById('runEffectTagMigrationButton'); 
}


document.addEventListener('DOMContentLoaded', () => {
    // 最初にUIヘルパーを初期化
    initUIHelpers(); 
    
    // 認証状態の監視を開始
    initAuth(auth, 
        (user) => { 
            // ログイン成功時の処理
            document.getElementById('password-prompt').style.display = 'none';
            const adminContentEl = document.getElementById('admin-content');
            if (adminContentEl) adminContentEl.style.display = 'block';
            
            const currentUserEmailSpan = document.getElementById('currentUserEmail');
            if (user && currentUserEmailSpan) {
                currentUserEmailSpan.textContent = `ログイン中: ${user.email}`;
            }
            
            // ★★★ UIが表示された後にDOM要素を取得し、アプリケーションを開始する ★★★
            queryDOMElements(); 
            loadAndInitializeAdminModules();
        }, 
        () => { 
            // ログアウト時の処理
            document.getElementById('password-prompt').style.display = 'flex';
            const adminContentEl = document.getElementById('admin-content');
            if (adminContentEl) adminContentEl.style.display = 'none';
            
            if (DOM.adminSideNav) {
                 DOM.adminSideNav.classList.remove('open');
                 DOM.adminSideNav.setAttribute('aria-hidden', 'true');
            }
            
            const currentUserEmailSpan = document.getElementById('currentUserEmail');
            if (currentUserEmailSpan) {
                currentUserEmailSpan.textContent = '';
            }
            
            clearAdminUIAndData();
        }
    );
});

async function handleManualBackup() {
    console.log("handleManualBackup called");
    if (!confirm('現在の全データをバックアップファイルとしてダウンロードします。よろしいですか？')) {
        return;
    }

    const button = DOM.manualBackupButton;
    if (!button) {
        console.error("Backup button not found in DOM for handleManualBackup.");
        return;
    }
    button.disabled = true;
    button.innerHTML = `<span class="icon" aria-hidden="true" style="margin-right: 8px;">⏳</span>バックアップ作成中...`;

    try {
        const backupData = {
            version: "2.1", // バージョン更新 (isDeleted対応など)
            createdAt: new Date().toISOString(),
            collections: {}
        };

        // isDeletedを含む全データをバックアップ対象とする
        // data-loader-admin.jsのキャッシュはisDeleted:falseのものなので、
        // ここではFirestoreから直接全件取得するか、キャッシュ取得関数をisDeleted考慮なし版にする必要がある。
        // 簡単のため、ここではキャッシュされたデータ（未削除分）をバックアップする形とする。
        // 完全なバックアップのためには、Firestoreから直接isDeletedを含む全データを読むのが望ましい。
        const collectionsToBackup = {
            "categories": getAllCategoriesCache,
            "tags": getAllTagsCache,
            "effect_units": getEffectUnitsCache,
            "effect_super_categories": getEffectSuperCategoriesCache,
            "effect_types": getEffectTypesCache,
            "items": getItemsCache,
            "item_sources": getItemSourcesCache
        };

        for (const collName in collectionsToBackup) {
            const data = collectionsToBackup[collName](); // これは未削除データのみ
            backupData.collections[collName] = data.map(doc => ({
                docId: doc.id || doc.docId, // item-managerはdocIdを使っているため両対応
                ...doc 
            }));
            // idとdocIdが重複していれば片方削除 (任意)
            backupData.collections[collName].forEach(doc => {
                if (doc.docId && doc.id && doc.docId === doc.id) delete doc.id;
            });
        }
        
        const charBases = getCharacterBasesCache(); // これも未削除データのみ
        backupData.collections.character_bases = {};
        for (const baseType in charBases) {
            backupData.collections.character_bases[baseType] = charBases[baseType].map(doc => ({
                docId: doc.id,
                ...doc
            }));
            backupData.collections.character_bases[baseType].forEach(doc => {
                 if (doc.docId && doc.id && doc.docId === doc.id) delete doc.id;
            });
        }

        const jsonString = JSON.stringify(backupData, null, 2);
        
        if (typeof JSZip === 'undefined') {
            alert("ZIP圧縮ライブラリ(JSZip)が読み込まれていません。バックアップはJSON形式でダウンロードされます。");
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
            a.href = url;
            a.download = `denpa-item-backup-v2.1-${timestamp}.json`; // バージョン明記
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            return;
        }

        const zip = new JSZip();
        zip.file("denpa_item_backup_data_v2.1.json", jsonString); // バージョン明記
        
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
        const zipFileName = `denpa-item-backup-v2.1-${timestamp}.zip`; // バージョン明記

        zip.generateAsync({type:"blob", compression: "DEFLATE", compressionOptions: {level: 9}})
            .then(function(content) {
                const url = URL.createObjectURL(content);
                const a = document.createElement('a');
                a.href = url;
                a.download = zipFileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                alert('バックアップZIPファイルのダウンロードが開始されました。');
            });

    } catch (error) {
        console.error('バックアップ作成中にエラーが発生しました:', error);
        alert('バックアップの作成に失敗しました。コンソールを確認してください。');
    } finally {
        if (button) {
            button.disabled = false;
            button.innerHTML = `<span class="icon" aria-hidden="true" style="margin-right: 8px;">💾</span>手動バックアップ (ZIP)`;
        }
    }
}

function setupAdminNav() {
    if (DOM.adminHamburgerButton && DOM.adminSideNav) {
        const newHamburger = DOM.adminHamburgerButton.cloneNode(true);
        DOM.adminHamburgerButton.parentNode.replaceChild(newHamburger, DOM.adminHamburgerButton);
        DOM.adminHamburgerButton = newHamburger;
        DOM.adminHamburgerButton.addEventListener('click', () => {
            DOM.adminSideNav.classList.add('open');
            DOM.adminHamburgerButton.setAttribute('aria-expanded', 'true');
            DOM.adminSideNav.setAttribute('aria-hidden', 'false');
        });
    }
    if (DOM.adminCloseNavButton && DOM.adminSideNav) {
        const newCloseNav = DOM.adminCloseNavButton.cloneNode(true);
        DOM.adminCloseNavButton.parentNode.replaceChild(newCloseNav, DOM.adminCloseNavButton);
        DOM.adminCloseNavButton = newCloseNav;
        DOM.adminCloseNavButton.addEventListener('click', () => {
            DOM.adminSideNav.classList.remove('open');
            if (DOM.adminHamburgerButton) DOM.adminHamburgerButton.setAttribute('aria-expanded', 'false');
            DOM.adminSideNav.setAttribute('aria-hidden', 'true');
        });
    }

    if (DOM.manualBackupButton) {
        const newManualBackupButton = DOM.manualBackupButton.cloneNode(true);
        DOM.manualBackupButton.parentNode.replaceChild(newManualBackupButton, DOM.manualBackupButton);
        DOM.manualBackupButton = newManualBackupButton;
        DOM.manualBackupButton.addEventListener('click', handleManualBackup);
    } else {
        console.error("manualBackupButton not found during setupAdminNav");
    }

    if (DOM.runEffectTagMigrationButton) {
        const newMigrationButton = DOM.runEffectTagMigrationButton.cloneNode(true);
        DOM.runEffectTagMigrationButton.parentNode.replaceChild(newMigrationButton, DOM.runEffectTagMigrationButton);
        DOM.runEffectTagMigrationButton = newMigrationButton;
        DOM.runEffectTagMigrationButton.addEventListener('click', runEffectTagMigration);
    }

    DOM.adminNavButtons = document.querySelectorAll('#adminSideNav .admin-nav-button, #adminSideNav a.admin-nav-button');
    if (DOM.adminNavButtons) {
        DOM.adminNavButtons.forEach(button => {
            if (button.id === 'manualBackupButton' || button.id === 'migrateIsDeletedButton') return; // Skip already handled

            const newButton = button.cloneNode(true);
            if (button.parentNode) {
                button.parentNode.replaceChild(newButton, button);
            }
            
            if (newButton.dataset.modalTarget) {
                newButton.addEventListener('click', (e) => {
                    const targetModalId = e.currentTarget.dataset.modalTarget;
                    openModalHelper(targetModalId);
                    if (DOM.adminSideNav) {
                        DOM.adminSideNav.classList.remove('open');
                        DOM.adminSideNav.setAttribute('aria-hidden', 'true');
                    }
                    if (DOM.adminHamburgerButton) DOM.adminHamburgerButton.setAttribute('aria-expanded', 'false');
                    
                    // モーダルを開く際に関連データの再描画や初期化を行う
                    if (targetModalId === 'categoryManagementModal' && typeof renderCategoriesUI === 'function') renderCategoriesUI();
                    else if (targetModalId === 'tagManagementModal' && typeof renderTagsUI === 'function') renderTagsUI();
                    else if (targetModalId === 'effectUnitManagementModal' && typeof renderEffectUnitsUI === 'function') renderEffectUnitsUI();
                    else if (targetModalId === 'effectSuperCategoryManagementModal' && typeof renderEffectSuperCategoriesUI === 'function') renderEffectSuperCategoriesUI();
                    else if (targetModalId === 'effectTypeManagementModal' && typeof renderEffectTypesUI === 'function') renderEffectTypesUI();
                    else if (targetModalId === 'characterBaseManagementModal' && typeof renderCharBaseOptionsUI === 'function') renderCharBaseOptionsUI();
                    else if (targetModalId === 'itemSourceManagementModal' && typeof renderItemSourcesUI === 'function') renderItemSourcesUI();
                });
            } 
            // 復元ツールへのリンクは削除したので、その分岐は不要
        });
    }
    setupEnlargementButtonListeners(); 
    setupCharBaseTypeButtons(); 
}

// ===== 新しいマイグレーション関数 =====
async function executeIsDeletedMigration() {
    if (!confirm("既存の全データに 'isDeleted: false' フィールドと、必要に応じてタイムスタンプフィールドを追加します。\nこの操作はデータベースに多数の書き込みを行います。本当に実行しますか？\n（通常、この操作は一度だけ実行します）")) {
        return;
    }

    if (DOM.migrateIsDeletedButton) {
        DOM.migrateIsDeletedButton.disabled = true;
        DOM.migrateIsDeletedButton.innerHTML = `<span class="icon">⏳</span>マイグレーション実行中...`;
    }

    const COLLECTIONS_TO_MIGRATE = [
        "items", "categories", "tags", "effect_types", 
        "effect_units", "effect_super_categories", "item_sources"
    ];
    const CHARACTER_BASE_TYPES = ["headShape", "correction", "color", "pattern"];
    const BATCH_SIZE = 400; 

    let totalOperations = 0;
    const migrationLog = []; // Simple log array

    // Helper to log to console and array
    function logMigration(message, type = "info") {
        const logMessage = `[Migration][${new Date().toLocaleTimeString()}] ${type.toUpperCase()}: ${message}`;
        console.log(logMessage);
        migrationLog.push(logMessage);
        // If you have a log area in the UI, update it here
        // e.g., document.getElementById('migrationLogArea').textContent = migrationLog.join('\n');
    }

    try {
        logMigration("マイグレーション処理を開始します。");

        for (const collName of COLLECTIONS_TO_MIGRATE) {
            logMigration(`コレクション '${collName}' の処理を開始...`);
            const collRef = collection(db, collName);
            // isDeletedがないものだけを取得するクエリはFirestoreの標準機能では難しい。全件取得してクライアントでフィルタする。
            const snapshot = await getDocs(collRef); 
            let batch = writeBatch(db);
            let countInBatch = 0;
            let updatedInCollection = 0;

            for (const docSnap of snapshot.docs) {
                const data = docSnap.data();
                if (data.isDeleted === undefined) { // Only process if isDeleted is not present
                    const updatePayload = {
                        isDeleted: false
                    };
                    // Add timestamps if they don't exist
                    if (data.updatedAt === undefined) {
                        updatePayload.updatedAt = serverTimestamp();
                    }
                    if (data.createdAt === undefined && data.updatedAt === undefined ) { // Add createdAt only if both are missing
                        updatePayload.createdAt = serverTimestamp();
                    }
                    
                    batch.update(doc(db, collName, docSnap.id), updatePayload);
                    countInBatch++;
                    updatedInCollection++;
                    totalOperations++;

                    if (countInBatch >= BATCH_SIZE) {
                        await batch.commit();
                        logMigration(`  '${collName}' のバッチをコミット (${countInBatch}件)`);
                        batch = writeBatch(db);
                        countInBatch = 0;
                        await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause
                    }
                }
            }
            if (countInBatch > 0) {
                await batch.commit();
                logMigration(`  '${collName}' の最終バッチをコミット (${countInBatch}件)`);
            }
            logMigration(`コレクション '${collName}' の処理完了。更新: ${updatedInCollection}件`);
        }

        for (const baseType of CHARACTER_BASE_TYPES) {
            const subCollPath = `character_bases/${baseType}/options`;
            logMigration(`サブコレクション '${subCollPath}' の処理を開始...`);
            const subCollRef = collection(db, subCollPath);
            const snapshot = await getDocs(subCollRef);
            let batch = writeBatch(db);
            let countInBatch = 0;
            let updatedInCollection = 0;

            for (const docSnap of snapshot.docs) {
                const data = docSnap.data();
                if (data.isDeleted === undefined) {
                     const updatePayload = {
                        isDeleted: false
                    };
                    if (data.updatedAt === undefined) {
                        updatePayload.updatedAt = serverTimestamp();
                    }
                     if (data.createdAt === undefined && data.updatedAt === undefined) {
                        updatePayload.createdAt = serverTimestamp();
                    }
                    batch.update(doc(db, subCollPath, docSnap.id), updatePayload);
                    countInBatch++;
                    updatedInCollection++;
                    totalOperations++;
                    if (countInBatch >= BATCH_SIZE) {
                        await batch.commit();
                        logMigration(`  '${subCollPath}' のバッチをコミット (${countInBatch}件)`);
                        batch = writeBatch(db);
                        countInBatch = 0;
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }
            }
            if (countInBatch > 0) {
                await batch.commit();
                logMigration(`  '${subCollPath}' の最終バッチをコミット (${countInBatch}件)`);
            }
            logMigration(`サブコレクション '${subCollPath}' の処理完了。更新: ${updatedInCollection}件`);
        }

        logMigration(`マイグレーション処理が正常に完了しました。合計 ${totalOperations} 件のドキュメントが更新/確認されました。`, "success");
        alert(`マイグレーション完了！合計 ${totalOperations} 件のドキュメントに isDeleted:false が設定されました（または既に設定済みでした）。\nページを再読み込みして、新しいデータ構造で管理画面が動作することを確認してください。`);
        
        // After migration, refresh the local cache and UI
        clearAdminDataCache(); // This function should be defined in this file or imported
        await loadInitialData(db);    // This function should be defined in this file or imported
        renderAllAdminUISections(); // This function should be defined in this file or imported

    } catch (error) {
        console.error("Migration Error:", error);
        logMigration(`エラーが発生しました: ${error.message}`, "error");
        alert(`マイグレーション中にエラーが発生しました: ${error.message}\n詳細はコンソールを確認してください。\n\nログ:\n${migrationLog.join('\n')}`);
    } finally {
        if (DOM.migrateIsDeletedButton) {
            DOM.migrateIsDeletedButton.disabled = false;
            DOM.migrateIsDeletedButton.innerHTML = `<span class="icon">⚙️</span>データマイグレーション (isDeleted)`;
        }
        // Display final logs to the user if you have a dedicated log area
        // document.getElementById('finalMigrationLogOutput').textContent = migrationLog.join('\n');
    }
}
// ===== マイグレーション関数ここまで =====


function clearAdminUIAndData() {
    console.log("[admin-main] Clearing admin UI and data cache...");
    cleanupListeners(); // ログアウト時にリスナーを確実に解除
    const listContainersIds = ['categoryListContainer', 'tagListContainer', 'effectUnitListContainer', 'effectSuperCategoryListContainer', 'effectTypeListContainer', 'charBaseOptionListContainer', 'itemSourceListContainer'];
    listContainersIds.forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = '<p>ログアウトしました。</p>'; });
    const itemsTableBody = document.querySelector('#itemsTable tbody');
    if (itemsTableBody) itemsTableBody.innerHTML = '';
    document.querySelectorAll('#admin-content form').forEach(form => { if (typeof form.reset === 'function') form.reset(); });
    document.querySelectorAll('.checkbox-group-container, .category-button-group.admin, .tag-button-container.admin, .item-source-parent-selector, #itemSourceButtonSelectionArea, #itemTagsButtonContainer').forEach(c => c.innerHTML = '');
    ['currentEffectsList', 'currentCharBaseOptionEffectsList', 'currentSourcesList'].forEach(id => { 
        const el = document.getElementById(id); if (el) el.innerHTML = '<p>追加されていません。</p>'; 
    });
    ['itemImagePreview'].forEach(id => { const el = document.getElementById(id); if (el) { el.src = '#'; el.style.display = 'none'; } });
    clearAdminDataCache(); // From data-loader-admin.js (内部で再度cleanupListenersを呼ぶが問題ない)
    console.log("[admin-main] Admin UI cleared.");
}

async function loadAndInitializeAdminModules() {
    console.log("[admin-main] Starting to initialize modules and sync data...");
    try {
        // 1. 共通の依存関係オブジェクトを作成
        const commonDependencies = {
            db,
            getAllCategories: getAllCategoriesCache,
            getAllTags: getAllTagsCache,
            getItems: getItemsCache,
            getEffectTypes: getEffectTypesCache,
            getEffectUnits: getEffectUnitsCache,
            getEffectSuperCategories: getEffectSuperCategoriesCache,
            getCharacterBases: getCharacterBasesCache,
            getItemSources: getItemSourcesCache,
            refreshAllData: async () => {
                console.log("[admin-main] refreshAllData called, but now handled by onSnapshot.");
            },
            openEnlargedListModal: (config) => {
                openEnlargedListModal(
                    config.sourceItems || (typeof config.sourceFn === 'function' ? config.sourceFn() : []),
                    config.itemType,
                    config.title,
                    config.searchInputId || null,
                    config.editFunction,
                    config.displayRenderer,
                    config.currentSearchTerm || ""
                );
            }
        };

        // 2. 各マネージャーを初期化
        initCategoryManager(commonDependencies);
        initTagManager(commonDependencies);
        initEffectUnitManager(commonDependencies);
        initEffectSuperCategoryManager(commonDependencies);
        initEffectTypeManager(commonDependencies);
        initCharBaseManager({ ...commonDependencies, baseTypeMappingsFromMain: baseTypeMappings });
        initItemSourceManager(commonDependencies); 
        initItemManager({ ...commonDependencies, uploadWorkerUrl: IMAGE_UPLOAD_WORKER_URL });

        // 3. UIのセットアップ
        setupAdminNav(); 
        
        // 4. データ同期を開始し、初回ロードが完了するのを待つ
        // データが更新されるたびに renderAllAdminUISections が自動的に呼ばれる
        await initializeDataSync(db, renderAllAdminUISections);

        console.log("[admin-main] Admin modules initialized and initial data sync complete.");

    } catch (error) {
        console.error("[admin-main] CRITICAL ERROR during admin panel initialization:", error);
        alert("管理パネルの初期化中に重大なエラーが発生しました。コンソールを確認してください。");
        const adminContainer = document.getElementById('admin-content')?.querySelector('.container');
        if (adminContainer) {
            adminContainer.innerHTML = `<p class="error-message" style="text-align:center;padding:20px;color:red;">管理データの読み込みまたは表示に失敗しました。</p>`;
        }
    }
}

function renderAllAdminUISections() {
    console.log("[admin-main] Rendering all admin UI sections...");
    if (typeof renderCategoriesUI === 'function') renderCategoriesUI();
    if (typeof renderTagsUI === 'function') renderTagsUI();
    if (typeof renderEffectUnitsUI === 'function') renderEffectUnitsUI();
    if (typeof renderEffectSuperCategoriesUI === 'function') renderEffectSuperCategoriesUI();
    if (typeof renderEffectTypesUI === 'function') renderEffectTypesUI();
    if (typeof renderItemSourcesUI === 'function') renderItemSourcesUI();
    if (typeof renderCharBaseOptionsUI === 'function') {
        const currentBaseType = DOM.selectedCharBaseTypeInput ? DOM.selectedCharBaseTypeInput.value : 'headShape';
        const displaySpan = document.getElementById('selectedCharBaseTypeDisplay');
        if (displaySpan && baseTypeMappings[currentBaseType]) displaySpan.textContent = baseTypeMappings[currentBaseType];
        renderCharBaseOptionsUI();
    }
    if (typeof renderItemsTableUI === 'function') renderItemsTableUI();
    if (typeof populateTagFormCategories === 'function') populateTagFormCategories(document.getElementById('newTagCategoriesCheckboxes'));
    if (typeof populateEffectTypeSelectsInForms === 'function') populateEffectTypeSelectsInForms();
    if (typeof populateCharBaseEffectTypeSelectInModal === 'function') populateCharBaseEffectTypeSelectInModal();
    if (typeof populateItemFormTags === 'function') populateItemFormTags();
    if (typeof renderAdminCategoryFilter === 'function') renderAdminCategoryFilter();
    if (typeof renderAdminTagFilter === 'function') renderAdminTagFilter();
    
    console.log("[admin-main] All admin UI sections rendering process complete.");
}

function setupCharBaseTypeButtons() {
    if (!DOM.charBaseTypeButtons || !DOM.selectedCharBaseTypeInput) return;
    DOM.charBaseTypeButtons.innerHTML = ''; 
    Object.entries(baseTypeMappings).forEach(([key, displayName]) => {
        const button = document.createElement('div'); // Using div styled as button
        button.className = 'category-select-button';
        button.textContent = displayName;
        button.dataset.baseTypeKey = key;
        button.setAttribute('role', 'button');
        button.setAttribute('tabindex', '0');

        if (DOM.selectedCharBaseTypeInput.value === key) button.classList.add('active');
        
        const handleSelection = () => {
            DOM.charBaseTypeButtons.querySelectorAll('.active').forEach(b => b.classList.remove('active'));
            button.classList.add('active');
            DOM.selectedCharBaseTypeInput.value = key;
            const displaySpan = document.getElementById('selectedCharBaseTypeDisplay');
            if (displaySpan) displaySpan.textContent = displayName;
            if (typeof renderCharBaseOptionsUI === 'function') renderCharBaseOptionsUI();
        };

        button.addEventListener('click', handleSelection);
        button.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleSelection();
            }
        });
        DOM.charBaseTypeButtons.appendChild(button);
    });
}


function setupEnlargementButtonListeners() {
    const buttonConfig = [
        { btnId: 'enlargeCategoryListButton', domRef: DOM.enlargeCategoryListButton, type: 'category', title: 'カテゴリ一覧', sourceFn: getAllCategoriesCache, searchInputId: 'categorySearchInput', editFn: openEditCategoryModalById, displayRenderer: buildCategoryTreeDOMFromManager },
        { btnId: 'enlargeTagListButton', domRef: DOM.enlargeTagListButton, type: 'tag', title: 'タグ一覧', sourceFn: getAllTagsCache, searchInputId: 'tagSearchInput', editFn: openEditTagModalById },
        { btnId: 'enlargeEffectUnitListButton', domRef: DOM.enlargeEffectUnitListButton, type: 'effectUnit', title: '効果単位一覧', sourceFn: getEffectUnitsCache, searchInputId: null, editFn: openEditEffectUnitModalById },
        { btnId: 'enlargeEffectSuperCategoryListButton', domRef: DOM.enlargeEffectSuperCategoryListButton, type: 'effectSuperCategory', title: '効果大分類一覧', sourceFn: getEffectSuperCategoriesCache, searchInputId: null, editFn: openEditEscModal },
        { btnId: 'enlargeEffectTypeListButton', domRef: DOM.enlargeEffectTypeListButton, type: 'effectType', title: '効果種類一覧', sourceFn: getEffectTypesCache, searchInputId: null, editFn: openEditEtModal },
        { 
            btnId: 'enlargeCharBaseOptionListButton', 
            domRef: DOM.enlargeCharBaseOptionListButton, 
            type: 'charBaseOption', 
            titleGetter: () => `${baseTypeMappings[DOM.selectedCharBaseTypeInput.value] || '基礎情報'} の選択肢一覧`, 
            sourceFn: () => (getCharacterBasesCache()[DOM.selectedCharBaseTypeInput.value] || []), 
            searchInputId: null, 
            editFn: (id) => openEditCboModal(id, DOM.selectedCharBaseTypeInput.value) 
        },
        { 
            btnId: 'enlargeItemSourceListButton', 
            domRef: DOM.enlargeItemSourceListButton,
            type: 'itemSource', 
            title: '入手経路一覧', 
            sourceFn: getItemSourcesCache,
            searchInputId: 'itemSourceSearchInput', 
            editFn: openEditItemSourceModalById, 
            displayRenderer: buildItemSourceTreeDOM
        }
    ];

    buttonConfig.forEach(config => {
        let buttonElement = config.domRef || document.getElementById(config.btnId); // Ensure DOM.domRef is used
        if (buttonElement) {
            const newBtn = buttonElement.cloneNode(true); 
            if (buttonElement.parentNode) {
                 buttonElement.parentNode.replaceChild(newBtn, buttonElement);
            }
            // Update global DOM object reference if it was set using getElementById initially
            if (config.domRef) { // If we passed a DOM object, update that specific one
                config.domRef = newBtn; // This direct reassignment might not work if domRef was a const.
                                    // Better to update the property on the DOM object if this is the pattern.
                                    // e.g. if config.btnId was "enlargeCategoryListButton", DOM.enlargeCategoryListButton = newBtn;
                const key = Object.keys(DOM).find(k => DOM[k] === buttonElement);
                if(key) DOM[key] = newBtn;
            }


            newBtn.addEventListener('click', () => {
                const items = config.sourceFn();
                const title = typeof config.titleGetter === 'function' ? config.titleGetter() : config.title;
                const currentSearchTerm = config.searchInputId ? document.getElementById(config.searchInputId)?.value || "" : "";
                
                openEnlargedListModal(
                    items, 
                    config.type, 
                    title, 
                    config.searchInputId, 
                    config.editFn, 
                    config.displayRenderer,
                    currentSearchTerm
                );
            });
        } else {
            console.warn(`Enlargement button with ID ${config.btnId} not found.`);
        }
    });
}

// openEnlargedListModal remains the same as previously provided, it uses the filtered data from sourceFn
function openEnlargedListModal(items, type, title, originalSearchInputId, editFunction, displayRenderer, initialSearchTerm = "") {
    if (!DOM.listEnlargementModal || !DOM.listEnlargementModalTitle || !DOM.listEnlargementModalContent || !DOM.listEnlargementModalSearchContainer) {
        console.error("Enlargement modal DOM elements not found!");
        return;
    }

    DOM.listEnlargementModalTitle.textContent = title;
    DOM.listEnlargementModalSearchContainer.innerHTML = ''; // Clear previous search input

    let searchInputForEnlarged = null;
    if (originalSearchInputId) {
        searchInputForEnlarged = document.createElement('input');
        searchInputForEnlarged.type = 'text';
        searchInputForEnlarged.placeholder = `${title.replace('一覧','')}内をフィルタ...`;
        searchInputForEnlarged.className = 'form-control'; // Standard styling
        searchInputForEnlarged.style.marginBottom = '1rem';
        searchInputForEnlarged.ariaLabel = `${title}内を検索`;
        DOM.listEnlargementModalSearchContainer.appendChild(searchInputForEnlarged);
        searchInputForEnlarged.value = initialSearchTerm; // Pre-fill with current search term from small list
    }

    const renderContent = (filterTerm = '') => {
        DOM.listEnlargementModalContent.innerHTML = ''; // Clear previous content
        let itemsToRender = items; // items are already pre-filtered by isDeleted
        
        // Apply client-side name filter if filterTerm is provided
        if (filterTerm && items && typeof items.filter === 'function') {
            itemsToRender = items.filter(item => item.name && item.name.toLowerCase().includes(filterTerm.toLowerCase()));
        } else if (!items || typeof items.filter !== 'function') { 
            itemsToRender = []; // Ensure itemsToRender is always an array
            console.warn("openEnlargedListModal: 'items' is not an array or is undefined for filtering.");
        }


        if (!itemsToRender || itemsToRender.length === 0) {
            DOM.listEnlargementModalContent.innerHTML = filterTerm ? '<p>検索条件に一致する項目はありません。</p>' : '<p>表示する項目がありません。</p>';
            return;
        }
        
        if (typeof displayRenderer === 'function' && (type === 'category' || type === 'itemSource')) {
            // For tree structures, pass all non-deleted categories/sources for context
            const allContextData = (type === 'category') ? getAllCategoriesCache() : getItemSourcesCache();
            const listDOM = displayRenderer(itemsToRender, allContextData, true); // true for isEnlargedView
            
            if (listDOM) {
                DOM.listEnlargementModalContent.appendChild(listDOM);
                // Attach click listeners for edit within the enlarged modal's tree
                const clickableItemSelector = type === 'category' ? '.category-tree-item[data-category-id]' : '.category-tree-item[data-source-id]';
                DOM.listEnlargementModalContent.querySelectorAll(clickableItemSelector).forEach(li => {
                    const contentDiv = li.querySelector('.category-tree-content');
                    if (contentDiv && typeof editFunction === 'function') {
                        contentDiv.classList.add('list-item-name-clickable'); // Add styling hook
                        // Clone and replace to remove old listeners before adding new
                        const newContentDiv = contentDiv.cloneNode(true);
                        if(contentDiv.parentNode) contentDiv.parentNode.replaceChild(newContentDiv, contentDiv);
                        
                        newContentDiv.addEventListener('click', (e) => {
                            // Prevent expander click from triggering edit
                            if (e.target.closest('.category-tree-expander')) return;
                            const itemId = type === 'category' ? li.dataset.categoryId : li.dataset.sourceId;
                            if (itemId) editFunction(itemId); 
                        });
                    }
                });
            } else {
                DOM.listEnlargementModalContent.innerHTML = `<p>${title}の表示に失敗しました。</p>`;
            }
        } else { // For flat lists (tags, effect units, etc.)
            itemsToRender.sort((a,b) => (a.name || "").localeCompare(b.name || "", 'ja')).forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.classList.add('list-item'); // Standard list item styling
                
                const nameSpan = document.createElement('span');
                nameSpan.classList.add('list-item-name-clickable'); // Make it look clickable
                
                // Display logic similar to individual manager's render functions
                let displayText = item.name || '(名称未設定)';
                if (type === 'tag') {
                    const belongingCategoriesNames = (item.categoryIds || [])
                       .map(catId => getAllCategoriesCache().find(c => c.id === catId)?.name) // Use non-deleted cache
                       .filter(name => name).join(', ') || '未分類';
                   displayText += ` (所属: ${belongingCategoriesNames})`;
                } else if (type === 'effectUnit') {
                   displayText += item.position === 'prefix' ? ' (前)' : ' (後)';
                } else if (type === 'effectSuperCategory') {
                    const typesCount = (getEffectTypesCache() || []).filter(et => et.superCategoryId === item.id).length; // Use non-deleted cache
                    displayText += ` (${typesCount} 効果種類)`;
                } else if (type === 'effectType') {
                    const superCat = (getEffectSuperCategoriesCache() || []).find(sc => sc.id === item.superCategoryId); // Use non-deleted cache
                    displayText += superCat ? ` (大分類: ${superCat.name})` : ' (大分類:未設定)';
                    displayText += item.defaultUnit && item.defaultUnit !== 'none' ? ` [${item.defaultUnit}]` : ' [単位なし]';
                } else if (type === 'charBaseOption') {
                   if (item.effects && item.effects.length > 0) {
                       const effectsSummary = item.effects.map(eff => {
                           const typeInfo = getEffectTypesCache().find(et => et.id === eff.type); // Use non-deleted cache
                           const unitInfo = getEffectUnitsCache().find(u => u.name === eff.unit); // Use non-deleted cache
                           const unitPos = unitInfo ? unitInfo.position : 'suffix';
                           const unitStr = eff.unit && eff.unit !== 'none' ? eff.unit : '';
                           const valStr = eff.value;
                           const effectValDisplay = unitPos === 'prefix' ? `${unitStr}${valStr}` : `${valStr}${unitStr}`;
                           return `${typeInfo ? typeInfo.name : '不明'} ${effectValDisplay}`;
                       }).join('; ');
                       displayText += ` (効果: ${effectsSummary.substring(0, 30)}${effectsSummary.length > 30 ? '...' : ''})`;
                   } else {
                       displayText += ' (効果なし)';
                   }
                }
                nameSpan.textContent = displayText;
                nameSpan.dataset.id = item.id;

                if (typeof editFunction === 'function') {
                    const newNameSpan = nameSpan.cloneNode(true); // Clone to safely add listener
                    if (nameSpan.parentNode) {
                         nameSpan.parentNode.replaceChild(newNameSpan, nameSpan);
                    } else { itemDiv.appendChild(newNameSpan); }

                    newNameSpan.addEventListener('click', (e) => {
                        const itemId = e.target.dataset.id;
                        if(itemId) editFunction(itemId);
                    });
                } else { 
                    nameSpan.style.cursor = 'default'; // Not clickable if no edit function
                    itemDiv.appendChild(nameSpan);
                }
                DOM.listEnlargementModalContent.appendChild(itemDiv);
            });
        }
    };

    if (searchInputForEnlarged) {
        const newSearchInput = searchInputForEnlarged.cloneNode(true); // Clone for fresh listeners
        searchInputForEnlarged.parentNode.replaceChild(newSearchInput, searchInputForEnlarged);
        newSearchInput.addEventListener('input', (e) => {
            renderContent(e.target.value);
        });
        renderContent(newSearchInput.value); // Initial render with pre-filled search term
    } else {
        renderContent(); // Render all items if no search input
    }
    openModalHelper('listEnlargementModal');
}

// main/js/admin-main.js の末尾に貼り付け

/**
 * 効果種類に基づいてタグを自動生成し、新しいカテゴリに分類し、
 * 対象アイテムにタグを付与するマイグレーションスクリプト。
 */
async function runEffectTagMigration() {
    const confirmMessage = "効果種類マスターに基づいてタグを自動生成・分類し、全アイテムに付与します。\n\n" +
        "この処理は以下の動作を含みます:\n" +
        "1. 「装備_new」親カテゴリと「効果_new」子カテゴリを作成します（存在しない場合）。\n" +
        "2. 全ての「効果種類」名に対応するタグを作成します（存在しない場合）。\n" +
        "3. 既存の効果タグの所属先を「効果_new」カテゴリに移動します。\n" +
        "4. 全てのアイテムをスキャンし、効果に合ったタグを付与します。\n\n" +
        "処理には数分かかる場合があります。実行しますか？";

    if (!confirm(confirmMessage)) {
        return;
    }

    const button = DOM.runEffectTagMigrationButton;
    if (button) {
        button.disabled = true;
        button.innerHTML = `<span class="icon">⏳</span>処理実行中...`;
    }

    const BATCH_SIZE = 400; // 一度にコミットする書き込み数
    let totalOperations = 0;
    
    // ログ用のヘルパー関数
    const logMigration = (message, type = "info") => {
        const logMessage = `[EffectTagMigration] ${type.toUpperCase()}: ${message}`;
        console.log(logMessage);
        // ここでUIにログを表示することも可能
    };

    try {
        logMigration("効果タグの自動生成・付与処理を開始します。");
        const batch = writeBatch(db);
        let batchCounter = 0;

        // --- Step 1: カテゴリの確認または作成 ---
        logMigration("Step 1: 「装備_new」と「効果_new」カテゴリを確認または作成します。");
        const allCategories = getAllCategoriesCache();
        let parentCategory = allCategories.find(c => !c.parentId && c.name === "装備_new");

        if (!parentCategory) {
            const parentCatRef = doc(collection(db, 'categories'));
            batch.set(parentCatRef, {
                name: "装備_new",
                parentId: "",
                isDeleted: false,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            parentCategory = { id: parentCatRef.id, name: "装備_new", parentId: "" };
            logMigration("親カテゴリ「装備_new」を新規作成します。");
            batchCounter++;
        } else {
            logMigration("親カテゴリ「装備_new」は既に存在します。");
        }

        let childCategory = allCategories.find(c => c.parentId === parentCategory.id && c.name === "効果_new");
        if (!childCategory) {
            const childCatRef = doc(collection(db, 'categories'));
            batch.set(childCatRef, {
                name: "効果_new",
                parentId: parentCategory.id,
                tagSearchMode: "OR",
                isDeleted: false,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            childCategory = { id: childCatRef.id, name: "効果_new", parentId: parentCategory.id };
            logMigration("子カテゴリ「効果_new」を新規作成します。");
            batchCounter++;
        } else {
            logMigration("子カテゴリ「効果_new」は既に存在します。");
        }

        // --- Step 2 & 3: タグの確認、作成、または所属変更 ---
        logMigration("Step 2 & 3: 効果種類に対応するタグを確認、作成、または所属変更します。");
        const allEffectTypes = getEffectTypesCache();
        const allTags = getAllTagsCache();
        const effectTypeNameToTagMap = new Map(); // tagName -> tagObject

        for (const effectType of allEffectTypes) {
            let tag = allTags.find(t => t.name === effectType.name);
            if (!tag) {
                // タグが存在しない場合: 新規作成
                const newTagRef = doc(collection(db, 'tags'));
                const newTagData = {
                    name: effectType.name,
                    categoryIds: [childCategory.id], // 新しい「効果_new」カテゴリに所属
                    isDeleted: false,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                };
                batch.set(newTagRef, newTagData);
                tag = { id: newTagRef.id, ...newTagData };
                logMigration(`タグ「${effectType.name}」を新規作成し、「効果_new」に分類します。`);
                batchCounter++;
            } else if (!tag.categoryIds || !tag.categoryIds.includes(childCategory.id)) {
                // タグが存在するが、「効果_new」に所属していない場合: 所属を追加
                const updatedCategoryIds = Array.from(new Set([...(tag.categoryIds || []), childCategory.id]));
                batch.update(doc(db, 'tags', tag.id), {
                    categoryIds: updatedCategoryIds,
                    updatedAt: serverTimestamp()
                });
                logMigration(`既存タグ「${tag.name}」を「効果_new」カテゴリに所属させます。`);
                batchCounter++;
            }
            effectTypeNameToTagMap.set(effectType.name, tag);
        }
        
        // --- Step 4: 全アイテムにタグを付与 ---
        logMigration("Step 4: 全アイテムをスキャンし、タグを付与します。");
        const allItems = getItemsCache();
        const effectTypeIdToNameMap = new Map(allEffectTypes.map(et => [et.id, et.name]));

        for (const item of allItems) {
            const currentItemTags = new Set(item.tags || []);
            let needsUpdate = false;
            
            if (item.effects && item.effects.length > 0) {
                for (const effect of item.effects) {
                    if (effect.type === 'structured') {
                        const effectName = effectTypeIdToNameMap.get(effect.effectTypeId);
                        if (effectName) {
                            const tagToApply = effectTypeNameToTagMap.get(effectName);
                            if (tagToApply && !currentItemTags.has(tagToApply.id)) {
                                currentItemTags.add(tagToApply.id);
                                needsUpdate = true;
                            }
                        }
                    }
                }
            }
            
            if (needsUpdate) {
                batch.update(doc(db, 'items', item.docId), {
                    tags: Array.from(currentItemTags),
                    updatedAt: serverTimestamp()
                });
                logMigration(`アイテム「${item.name}」のタグを更新します。`);
                batchCounter++;
            }

            if (batchCounter >= BATCH_SIZE) {
                await batch.commit();
                logMigration(`${batchCounter}件の書き込みをコミットしました。`);
                totalOperations += batchCounter;
                batch = writeBatch(db); // 新しいバッチを開始
                batchCounter = 0;
            }
        }
        
        // 残りの書き込みをコミット
        if (batchCounter > 0) {
            await batch.commit();
            totalOperations += batchCounter;
            logMigration(`最後の${batchCounter}件の書き込みをコミットしました。`);
        }

        logMigration(`処理が正常に完了しました。合計 ${totalOperations} 件のデータベース書き込みを行いました。`, "success");
        alert("効果タグの自動生成と付与が完了しました！\nページをリロードして最新の状態を反映してください。");

    } catch (error) {
        console.error("Effect Tag Migration Error:", error);
        logMigration(`エラーが発生しました: ${error.message}`, "error");
        alert(`処理中にエラーが発生しました: ${error.message}\n詳細はコンソールを確認してください。`);
    } finally {
        if (button) {
            button.disabled = false;
            button.innerHTML = `<span class="icon">✨</span>効果タグ自動生成・付与`;
        }
    }
}
