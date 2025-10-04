// js/admin-modules/data-loader-admin.js
import { collection, onSnapshot, query, where, orderBy } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// キャッシュ変数
let allCategoriesCache = [];
let allTagsCache = [];
let itemsCache = [];
let effectTypesCache = [];
let effectUnitsCache = [];
let effectSuperCategoriesCache = [];
let characterBasesCache = {};
let itemSourcesCache = [];

// 定数
export const baseTypeMappingsForLoader = {
    headShape: "頭の形",
    correction: "補正",
    color: "色",
    pattern: "柄"
};
export const IMAGE_UPLOAD_WORKER_URL = 'https://denpa-item-uploader.tsubasa-hsty-f58.workers.dev';

// onSnapshotのリスナー解除関数を保持する配列
let unsubscribeFunctions = [];
// UI更新をトリガーするためのコールバック関数
let onDataUpdateCallback = () => { console.warn("onDataUpdateCallback not set in data-loader-admin.js"); };

/**
 * 全てのコレクションに対するリアルタイムリスナーをセットアップし、初回データ同期を行う
 * @param {Firestore} db - Firestoreインスタンス
 * @param {Function} onUpdate - データ更新時に呼び出されるコールバック関数
 * @returns {Promise<void>} 初回データ取得が全て完了した時点で解決されるPromise
 */
export function initializeDataSync(db, onUpdate) {
    console.log("[Admin][Data Loader] Starting real-time data synchronization...");
    onDataUpdateCallback = onUpdate;
    
    // 既存のリスナーがあれば全て解除
    cleanupListeners();

    const collectionsToSync = [
        { name: 'categories', cache: (data) => allCategoriesCache = data, orderByField: 'name' },
        { name: 'tags', cache: (data) => allTagsCache = data, orderByField: 'name' },
        { name: 'items', cache: (data) => itemsCache = data, keyField: 'docId', orderByField: 'name' },
        { name: 'effect_types', cache: (data) => effectTypesCache = data, orderByField: 'name' },
        { name: 'effect_units', cache: (data) => effectUnitsCache = data, orderByField: 'name' },
        { name: 'effect_super_categories', cache: (data) => effectSuperCategoriesCache = data, orderByField: 'name' },
        { name: 'item_sources', cache: (data) => itemSourcesCache = data, orderByFields: ['depth', 'name'] },
    ];

    const initialLoadPromises = collectionsToSync.map(config =>
        setupSnapshotListener(db, config.name, config.cache, config.keyField || 'id', config.orderByField, config.orderByFields)
    );

    // CharacterBasesの同期
    characterBasesCache = {}; // 初期化
    const charBasePromises = Object.keys(baseTypeMappingsForLoader).map(baseType => {
        const path = `character_bases/${baseType}/options`;
        characterBasesCache[baseType] = []; // 各タイプのキャッシュを初期化
        const cacheUpdater = (data) => characterBasesCache[baseType] = data;
        return setupSnapshotListener(db, path, cacheUpdater, 'id', 'name');
    });

    return Promise.all([...initialLoadPromises, ...charBasePromises])
        .then(() => {
            console.log("[Admin][Data Loader] Initial data snapshot received for all collections.");
        }).catch(error => {
            console.error("[Admin][Data Loader] Critical error during initial data sync:", error);
            throw error; // エラーを再スローして呼び出し元で捕捉できるようにする
        });
}

/**
 * 指定されたコレクションのonSnapshotリスナーをセットアップする汎用関数
 */
function setupSnapshotListener(db, collectionPath, cacheUpdater, keyField, orderByField, orderByFields) {
    return new Promise((resolve, reject) => {
        const orderClauses = orderByFields ? orderByFields.map(field => orderBy(field)) : (orderByField ? [orderBy(orderByField)] : []);
        const q = query(collection(db, collectionPath), where('isDeleted', '==', false), ...orderClauses);

        let isFirstSnapshot = true; // 初回データ取得かどうかのフラグ

        const unsubscribe = onSnapshot(q, (snapshot) => {
            console.log(`[Snapshot] Received update for '${collectionPath}'. Changes: ${snapshot.docChanges().length}`);
            
            // onSnapshotは常に完全なデータセットを返すため、キャッシュを丸ごと置き換えるのが最も安全
            let currentCache = [];
            snapshot.forEach(doc => {
                currentCache.push({ [keyField]: doc.id, ...doc.data() });
            });
            cacheUpdater(currentCache);
            
            // UI更新コールバックを呼び出す
            if (onDataUpdateCallback) {
                onDataUpdateCallback();
            }

            if (isFirstSnapshot) {
                isFirstSnapshot = false;
                resolve(); // 初回取得が完了したことを通知
            }

        }, (error) => {
            console.error(`[Snapshot] Error listening to '${collectionPath}':`, error);
            if (isFirstSnapshot) {
                isFirstSnapshot = false;
                reject(error); // 初回取得時にエラーが発生した場合はPromiseをreject
            }
        });

        unsubscribeFunctions.push(unsubscribe);
    });
}

/**
 * 全てのonSnapshotリスナーを解除する
 */
export function cleanupListeners() {
    console.log(`[Admin][Data Loader] Cleaning up ${unsubscribeFunctions.length} listeners...`);
    unsubscribeFunctions.forEach(unsub => unsub());
    unsubscribeFunctions = [];
}

/**
 * ログアウト時やページ離脱時にキャッシュとリスナーをクリーンアップする
 */
export function clearAdminDataCache() {
    cleanupListeners(); // リスナーもここで解除する
    allCategoriesCache = [];
    allTagsCache = [];
    itemsCache = [];
    effectTypesCache = [];
    effectUnitsCache = [];
    effectSuperCategoriesCache = [];
    characterBasesCache = {};
    itemSourcesCache = [];
    console.log("[Admin][Data Loader] All admin data caches and listeners cleared.");
}

// 既存のGetter関数は変更なし
export const getAllCategoriesCache = () => allCategoriesCache;
export const getAllTagsCache = () => allTagsCache;
export const getItemsCache = () => itemsCache;
export const getEffectTypesCache = () => effectTypesCache;
export const getEffectUnitsCache = () => effectUnitsCache;
export const getEffectSuperCategoriesCache = () => effectSuperCategoriesCache;
export const getCharacterBasesCache = () => characterBasesCache;
export const getItemSourcesCache = () => itemSourcesCache;

// onSnapshot管理に移行するため、手動でのキャッシュ操作関数は不要になります
// addItemToCache, updateItemInCache, removeItemFromCache は削除します
