// main/js/modules/indexed-db-ops.js
import { openDB } from '../common/indexed-db-setup.js'; // IndexedDBのスキーマ定義と初期化をインポート

const DB_NAME = 'DenpaItemDB'; // indexed-db-setup.js と同じDB名

let dbPromise = null;

function getDB() {
    if (!dbPromise) {
        dbPromise = openDB();
    }
    return dbPromise;
}

/**
 * 指定されたストアから全てのデータを取得します。
 * @param {string} storeName - オブジェクトストア名
 * @returns {Promise<Array<Object>>} データ配列のPromise
 */
export async function getAllFromDB(storeName) {
    const db = await getDB();
    return db.getAll(storeName);
}

/**
 * 指定されたストアからIDで単一のデータを取得します。
 * @param {string} storeName - オブジェクトストア名
 * @param {string | number} key - 取得するデータのキー
 * @returns {Promise<Object | undefined>} データオブジェクトまたはundefinedのPromise
 */
export async function getFromDB(storeName, key) {
    const db = await getDB();
    return db.get(storeName, key);
}

/**
 * 指定されたストアに複数のデータを一括で書き込み（追加または更新）ます。
 * @param {string} storeName - オブジェクトストア名
 * @param {Array<Object>} dataArray - 書き込むデータの配列
 * @returns {Promise<void>}
 */
export async function bulkPutToDB(storeName, dataArray) {
    if (!dataArray || dataArray.length === 0) return Promise.resolve();
    const db = await getDB();
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    // No need to await Promise.all here, tx.done handles it
    dataArray.forEach(item => store.put(item));
    await tx.done;
    console.log(`[IDB Ops] Bulk put ${dataArray.length} items to ${storeName}`);
}

/**
 * 指定されたストアから複数のデータをIDで一括削除します。
 * @param {string} storeName - オブジェクトストア名
 * @param {Array<string | number>} keysArray - 削除するデータのキーの配列
 * @returns {Promise<void>}
 */
export async function bulkDeleteFromDB(storeName, keysArray) {
    if (!keysArray || keysArray.length === 0) return Promise.resolve();
    const db = await getDB();
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    keysArray.forEach(key => store.delete(key));
    await tx.done;
    console.log(`[IDB Ops] Bulk deleted ${keysArray.length} items from ${storeName}`);
}

/**
 * 指定されたストアの全データをクリアします。
 * @param {string} storeName - オブジェクトストア名
 * @returns {Promise<void>}
 */
export async function clearStoreInDB(storeName) {
    const db = await getDB();
    const tx = db.transaction(storeName, 'readwrite');
    await tx.objectStore(storeName).clear();
    await tx.done;
    console.log(`[IDB Ops] Cleared store: ${storeName}`);
}

// ★★★ metadataストア用の関数を修正 ★★★
/**
 * メタデータを取得します。
 * @param {string} key - メタデータのキー (例: 'items_lastSyncTimestamp')
 * @returns {Promise<any | undefined>} 取得した値 (存在しない場合は undefined)
 */
export async function getMetadata(key) {
    const db = await getDB();
    // 'metadata' ストアの keyPath は 'collectionName'
    // 保存されるオブジェクトは { collectionName: "the_key", actualValue: <the_timestamp> }
    const record = await db.get('metadata', key); 
    return record ? record.actualValue : undefined;
}

/**
 * メタデータを設定します。
 * @param {string} key - メタデータのキー (例: 'items_lastSyncTimestamp')
 * @param {any} value - 設定する値 (例: Firestore Timestampオブジェクト)
 * @returns {Promise<IDBValidKey>} put操作のキー
 */
export async function setMetadata(key, value) {
    const db = await getDB();
    // 'metadata' ストアの keyPath は 'collectionName'
    // 保存するオブジェクト: { collectionName: "キー名", actualValue: 実際の値 }
    return db.put('metadata', { collectionName: key, actualValue: value });
}
// ★★★ 修正ここまで ★★★

export async function countStoreItems(storeName) {
    const db = await getDB();
    return db.count(storeName);
}
