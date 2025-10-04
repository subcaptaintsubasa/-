// js/admin-modules/data-loader-admin.js
import { collection, getDocs, query, orderBy, where } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

let allCategoriesCache = [];
let allTagsCache = [];
let itemsCache = [];
let effectTypesCache = [];
let effectUnitsCache = [];
let effectSuperCategoriesCache = [];
let characterBasesCache = {};
let itemSourcesCache = [];

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
            // エラーが発生した場合でも、後続処理に進むためにPromiseを解決する
            // エラーメッセージはコンソールで確認
            return Promise.resolve();
        });
}

/**
 * 指定されたコレクションのonSnapshotリスナーをセットアップする汎用関数
 * @param {Firestore} db
 * @param {string} collectionPath - コレクション名またはサブコレクションへのパス
 * @param {Function} cacheUpdater - キャッシュを更新する関数
 * @param {string} keyField - ドキュメントIDを格納するフィールド名
 * @param {string} [orderByField] - 単一のソートキー
 * @param {Array<string>} [orderByFields] - 複数のソートキー
 * @returns {Promise<void>} 初回データ取得が完了した時点で解決されるPromise
 */
function setupSnapshotListener(db, collectionPath, cacheUpdater, keyField, orderByField, orderByFields) {
    return new Promise((resolve, reject) => {
        const orderClauses = orderByFields ? orderByFields.map(field => orderBy(field)) : (orderByField ? [orderBy(orderByField)] : []);
        const q = query(collection(db, collectionPath), where('isDeleted', '==', false), ...orderClauses);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            console.log(`[Snapshot] Received update for '${collectionPath}'`);
            let currentCache = [];
            // まずは全データを構築
            snapshot.forEach(doc => {
                currentCache.push({ [keyField]: doc.id, ...doc.data() });
            });
            // キャッシュ全体を更新
            cacheUpdater(currentCache);
            
            // UI更新コールバックを呼び出す
            if (onDataUpdateCallback) {
                onDataUpdateCallback();
            }
            resolve(); // 初回取得が完了したことを通知
        }, (error) => {
            console.error(`[Snapshot] Error listening to '${collectionPath}':`, error);
            reject(error);
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

// 既存のGetter関数は変更なし (キャッシュからデータを返す)
export const getAllCategoriesCache = () => allCategoriesCache;
export const getAllTagsCache = () => allTagsCache;
export const getItemsCache = () => itemsCache;
export const getEffectTypesCache = () => effectTypesCache;
export const getEffectUnitsCache = () => effectUnitsCache;
export const getEffectSuperCategoriesCache = () => effectSuperCategoriesCache;
export const getCharacterBasesCache = () => characterBasesCache;
export const getItemSourcesCache = () => itemSourcesCache;

// addItemToCache, updateItemInCache, removeItemFromCache は onSnapshot によって不要になるため削除
export function addItemToCache(item) {
    if (item && item.docId) {
        // 重複を避ける
        const index = itemsCache.findIndex(i => i.docId === item.docId);
        if (index === -1) {
            itemsCache.push(item);
            console.log(`[Cache] Added item: ${item.docId}`);
        } else {
            // 既にあれば更新として扱う
            itemsCache[index] = item;
            console.warn(`[Cache] addItemToCache: Item with docId ${item.docId} already exists. Updated instead.`);
        }
    }
}

export function updateItemInCache(updatedItem) {
    if (updatedItem && updatedItem.docId) {
        const index = itemsCache.findIndex(item => item.docId === updatedItem.docId);
        if (index > -1) {
            // 元のオブジェクトとマージして、createdAtなどを保持する
            itemsCache[index] = { ...itemsCache[index], ...updatedItem };
            console.log(`[Cache] Updated item: ${updatedItem.docId}`);
        } else {
            // 見つからなければ追加として扱う
            itemsCache.push(updatedItem);
            console.warn(`[Cache] updateItemInCache: Item with docId ${updatedItem.docId} not found. Added instead.`);
        }
    }
}

export function removeItemFromCache(itemId) {
    const index = itemsCache.findIndex(item => item.docId === itemId);
    if (index > -1) {
        itemsCache.splice(index, 1);
        console.log(`[Cache] Removed item: ${itemId}`);
    }
}
