// main/js/common/indexed-db-setup.js
// This file will handle IndexedDB database setup, including schema definition and upgrades.
// It will be used by both the admin panel and the user-facing application.

const DB_NAME = 'DenpaItemDB';
const DB_VERSION = 1; // Increment version to trigger an upgrade

// Define object stores and their indexes
// This schema should mirror your Firestore collections and needed query patterns
const OBJECT_STORES_SCHEMA = [
    {
        name: 'items',
        keyPath: 'docId',
        indexes: [
            { name: 'name_lc', keyPath: 'name_lc', options: { unique: false } }, // For case-insensitive search
            { name: 'tags', keyPath: 'tags', options: { unique: false, multiEntry: true } },
            { name: 'price', keyPath: 'price', options: { unique: false } },
            { name: 'rarity', keyPath: 'rarity', options: { unique: false } },
            { name: 'updatedAt', keyPath: 'updatedAt', options: { unique: false } },
            // Add isDeleted if you plan to sync logically deleted items to IDB first before removing
            // { name: 'isDeleted', keyPath: 'isDeleted', options: { unique: false } }
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
            { name: 'name', keyPath: 'name', options: { unique: true } }, // Unit names should be unique
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
        name: 'character_bases_options', // Store all character base options in one store
        keyPath: 'id', // Firestore document ID will be unique across base types
        indexes: [
            { name: 'baseType', keyPath: 'baseType', options: { unique: false } }, // 'headShape', 'color' etc.
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
        name: 'metadata', // For storing last sync timestamps etc.
        keyPath: 'collectionName', // e.g., 'items', 'categories'
        indexes: [
            { name: 'lastSyncTimestamp', keyPath: 'lastSyncTimestamp', options: { unique: false } }
        ]
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
                    storeSchema.indexes.forEach(indexSchema => {
                        store.createIndex(indexSchema.name, indexSchema.keyPath, indexSchema.options);
                        console.log(`Created index '${indexSchema.name}' on store '${storeSchema.name}'`);
                    });
                } else {
                    // Handle upgrades for existing stores if needed (e.g., adding new indexes)
                    const store = transaction.objectStore(storeSchema.name);
                    storeSchema.indexes.forEach(indexSchema => {
                        if (!store.indexNames.contains(indexSchema.name)) {
                            store.createIndex(indexSchema.name, indexSchema.keyPath, indexSchema.options);
                            console.log(`Upgraded store '${storeSchema.name}', added index '${indexSchema.name}'`);
                        }
                    });
                }
            });
            console.log("IndexedDB upgrade complete.");
        },
        blocked() {
            console.warn("IndexedDB open operation blocked. Please close other tabs using this database.");
            alert("データベースの準備ができませんでした。このサイトを開いている他のタブを閉じてから、ページを再読み込みしてください。");
        },
        blocking() {
            // If other tabs are blocking the upgrade, you might want to notify the user
            // or close the DB in other tabs.
            console.warn("IndexedDB upgrade blocked by other connection. Attempting to close...");
            // db.close(); // This might be called in the other tab
        },
        terminated() {
            // Handle unexpected termination
            console.error("IndexedDB connection terminated unexpectedly. Please reload the page.");
            alert("データベース接続が予期せず終了しました。ページを再読み込みしてください。");
        }
    });
}

// Example of how to use it (this would typically be in your main data loading logic)
/*
let dbPromise = null;
export function getDB() {
    if (!dbPromise) {
        dbPromise = openDB();
    }
    return dbPromise;
}

// Example usage in another module:
// import { getDB } from './indexed-db-setup.js';
// async function someOperation() {
//   const db = await getDB();
//   const tx = db.transaction('items', 'readonly');
//   const store = tx.objectStore('items');
//   const allItems = await store.getAll();
//   await tx.done;
//   console.log(allItems);
// }
*/
