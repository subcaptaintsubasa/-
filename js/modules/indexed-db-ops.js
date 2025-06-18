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
    await Promise.all(dataArray.map(item => store.put(item)));
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
    await Promise.all(keysArray.map(key => store.delete(key)));
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

/**
 * メタデータを取得または設定します。
 * @param {string} key - メタデータのキー (例: 'items_lastSync')
 * @param {any} [value] - 設定する値。省略した場合は現在の値を取得。
 * @returns {Promise<any>} 取得した値、または設定完了のPromise
 */
export async function getOrSetMetadata(key, value) {
    const db = await getDB();
    const storeName = 'metadata';
    if (value !== undefined) { // Set value
        // The keyPath for 'metadata' store is 'collectionName'
        // We are storing general metadata using a simple key string
        // So, we use an object structure like { collectionName: key, value: value }
        return db.put(storeName, { collectionName: key, value: value });
    } else { // Get value
        const record = await db.get(storeName, key);
        return record ? record.value : undefined;
    }
}

// メタデータ用に特化した関数 (より明確)
export async function getMetadata(key) {
    const db = await getDB();
    const record = await db.get('metadata', key);
    return record ? record.value : undefined;
}

export async function setMetadata(key, value) {
    const db = await getDB();
    // 'metadata' ストアの keyPath は 'collectionName' なので、
    // 'collectionName' プロパティにキーを、'value' プロパティに実際の値を格納する。
    // または、'lastSyncTimestamp' のような専用フィールドを metadata ストアのスキーマに定義しても良い。
    // ここでは { collectionName: 'items_lastSync', lastSyncTimestamp: timestamp } のような形を想定。
    // もし、キーが 'items_lastSync' で、値がタイムスタンプそのものなら、以下のように調整。
    const dataToPut = { collectionName: key };
    if (key.endsWith('_lastSyncTimestamp')) { //
        dataToPut.lastSyncTimestamp = value;
    } else {
        dataToPut.value = value; // General purpose metadata
    }
    return db.put('metadata', dataToPut);
}


// 特定のストアのアイテム数をカウントする (デバッグや情報表示用)
export async function countStoreItems(storeName) {
    const db = await getDB();
    return db.count(storeName);
}
