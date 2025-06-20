// main/js/common/indexed-db-setup.js
// This file will handle IndexedDB database setup, including schema definition and upgrades.
// It will be used by both the admin panel and the user-facing application.

const DB_NAME = 'DenpaItemDB';
const DB_VERSION = 2; // ★★★ バージョンをインクリメント ★★★

// Define object stores and their indexes
// This schema should mirror your Firestore collections and needed query patterns
const OBJECT_STORES_SCHEMA = [
    {
        name: 'items',
        keyPath: 'docId',
        indexes: [
            { name: 'name_lc', keyPath: 'name_lc', options: { unique: false } }, 
            { name: 'tags', keyPath: 'tags', options: { unique: false, multiEntry: true } },
            { name: 'price', keyPath: 'price', options: { unique: false } },
            { name: 'rarity', keyPath: 'rarity', options: { unique: false } },
            { name: 'updatedAt', keyPath: 'updatedAt', options: { unique: false } },
        ]
    },
    {
        name: 'categories',
        keyPath: 'id',
        indexes: [
            { name: 'name', keyPath: 'name', options: { unique: false } },
            { name: 'parentId', keyPath: 'parentId', options: { unique: false } },
            { name: 'updatedAt', keyPath: 'updatedAt', options: { unique: false } },
        ]
    },
    {
        name: 'tags',
        keyPath: 'id',
        indexes: [
            { name: 'name', keyPath: 'name', options: { unique: false } },
            { name: 'categoryIds', keyPath: 'categoryIds', options: { unique: false, multiEntry: true } },
            { name: 'updatedAt', keyPath: 'updatedAt', options: { unique: false } },
        ]
    },
    {
        name: 'effect_types',
        keyPath: 'id',
        indexes: [
            { name: 'name', keyPath: 'name', options: { unique: false } },
            { name: 'superCategoryId', keyPath: 'superCategoryId', options: { unique: false } },
            { name: 'updatedAt', keyPath: 'updatedAt', options: { unique: false } },
        ]
    },
    {
        name: 'effect_units',
        keyPath: 'id',
        indexes: [
            { name: 'name', keyPath: 'name', options: { unique: true } }, 
            { name: 'updatedAt', keyPath: 'updatedAt', options: { unique: false } },
        ]
    },
    {
        name: 'effect_super_categories',
        keyPath: 'id',
        indexes: [
            { name: 'name', keyPath: 'name', options: { unique: false } },
            { name: 'updatedAt', keyPath: 'updatedAt', options: { unique: false } },
        ]
    },
    {
        name: 'character_bases_options', 
        keyPath: 'id', 
        indexes: [
            { name: 'baseType', keyPath: 'baseType', options: { unique: false } }, 
            { name: 'name', keyPath: 'name', options: { unique: false } },
            { name: 'updatedAt', keyPath: 'updatedAt', options: { unique: false } },
        ]
    },
    {
        name: 'item_sources',
        keyPath: 'id',
        indexes: [
            { name: 'name', keyPath: 'name', options: { unique: false } },
            { name: 'parentId', keyPath: 'parentId', options: { unique: false } },
            { name: 'depth', keyPath: 'depth', options: { unique: false } },
            { name: 'updatedAt', keyPath: 'updatedAt', options: { unique: false } },
        ]
    },
    {
        name: 'metadata', 
        keyPath: 'collectionName', // 主キーは 'items_lastSyncTimestamp' のような文字列
        // indexes: [ // ★★★ このインデックスは必須ではないためコメントアウト（または削除） ★★★
        //     { name: 'lastSyncTimestamp', keyPath: 'lastSyncTimestamp', options: { unique: false } }
        // ]
    }
];

/**
 * Opens and initializes the IndexedDB database.
 * Handles schema creation and upgrades.
 * @returns {Promise<IDBPDatabase>} A promise that resolves with the database instance.
 */
export async function openDB() {
    if (!('indexedDB' in window)) {
        console.error("This browser doesn't support IndexedDB. Offline capabilities will be limited.");
        return Promise.reject(new Error("IndexedDB not supported"));
    }
    if (typeof idb === 'undefined') {
        console.error("idb library is not loaded. Cannot initialize IndexedDB.");
        return Promise.reject(new Error("idb library not loaded"));
    }

    return idb.openDB(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion, newVersion, transaction) {
            console.log(`Upgrading IndexedDB from version ${oldVersion} to ${newVersion}`);
            OBJECT_STORES_SCHEMA.forEach(storeSchema => {
                if (!db.objectStoreNames.contains(storeSchema.name)) {
                    const store = db.createObjectStore(storeSchema.name, { keyPath: storeSchema.keyPath, autoIncrement: storeSchema.autoIncrement });
                    console.log(`Created object store: ${storeSchema.name}`);
                    (storeSchema.indexes || []).forEach(indexSchema => { // safety check for indexes
                        store.createIndex(indexSchema.name, indexSchema.keyPath, indexSchema.options);
                        console.log(`Created index '${indexSchema.name}' on store '${storeSchema.name}'`);
                    });
                } else {
                    const store = transaction.objectStore(storeSchema.name);
                    (storeSchema.indexes || []).forEach(indexSchema => { // safety check for indexes
                        if (!store.indexNames.contains(indexSchema.name)) {
                            store.createIndex(indexSchema.name, indexSchema.keyPath, indexSchema.options);
                            console.log(`Upgraded store '${storeSchema.name}', added index '${indexSchema.name}'`);
                        }
                    });
                    // ここで古いバージョンのインデックスを削除する処理も追加できる
                    // 例: if (oldVersion < 2 && store.indexNames.contains('oldIndexToRemove')) { store.deleteIndex('oldIndexToRemove'); }
                    if (storeSchema.name === 'metadata' && oldVersion < 2) {
                        // バージョン2へのアップグレードで、もし 'lastSyncTimestamp' インデックスが存在すれば削除
                        if (store.indexNames.contains('lastSyncTimestamp')) {
                            store.deleteIndex('lastSyncTimestamp');
                            console.log("Deleted old 'lastSyncTimestamp' index from 'metadata' store.");
                        }
                    }
                }
            });
            console.log("IndexedDB upgrade complete.");
        },
        blocked() {
            console.warn("IndexedDB open operation blocked. Please close other tabs using this database.");
            alert("データベースの準備ができませんでした。このサイトを開いている他のタブを閉じてから、ページを再読み込みしてください。");
        },
        blocking(currentVersion, blockedVersion, event) {
            console.warn(`IndexedDB upgrade from version ${currentVersion} to ${blockedVersion} blocked. Attempting to close...`);
            // event.target.result.close(); // IDBPDatabase インスタンスから close() を呼ぶ
        },
        terminated() {
            console.error("IndexedDB connection terminated unexpectedly. Please reload the page.");
            alert("データベース接続が予期せず終了しました。ページを再読み込みしてください。");
        }
    });
}
