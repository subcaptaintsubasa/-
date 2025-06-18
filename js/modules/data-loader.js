// main/js/modules/data-loader.js
import { collection, getDocs, query, orderBy, where, serverTimestamp, Timestamp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { 
    getAllFromDB, bulkPutToDB, bulkDeleteFromDB, getMetadata, setMetadata, clearStoreInDB 
} from './indexed-db-ops.js';

// キャッシュ変数 (IndexedDBからロードされたデータを保持)
let allItems = [];
let allCategories = [];
let allTags = [];
let effectTypesCache = [];
let effectUnitsCache = [];
let effectSuperCategoriesCache = [];
let characterBasesCache = {}; // { headShape: [...], color: [...] }
let itemSourcesCache = [];

// Firestoreコレクション名と対応するIndexedDBストア名、主キーフィールド名のマッピング
const COLLECTIONS_CONFIG = {
    items: { storeName: 'items', firestoreKey: 'docId', localKey: 'docId' },
    categories: { storeName: 'categories', firestoreKey: 'id', localKey: 'id' },
    tags: { storeName: 'tags', firestoreKey: 'id', localKey: 'id' },
    effect_types: { storeName: 'effect_types', firestoreKey: 'id', localKey: 'id' },
    effect_units: { storeName: 'effect_units', firestoreKey: 'id', localKey: 'id' },
    effect_super_categories: { storeName: 'effect_super_categories', firestoreKey: 'id', localKey: 'id' },
    item_sources: { storeName: 'item_sources', firestoreKey: 'id', localKey: 'id' },
    // character_bases は特殊なので別途処理
};
const CHARACTER_BASE_TYPES_FOR_LOADER = ["headShape", "correction", "color", "pattern"];


// 公開定数 (search-filters.js などで使われる)
export let EQUIPMENT_SLOT_TAG_IDS = {};
export const SIMULATOR_PARENT_CATEGORY_NAME = "装備";
export const SIMULATOR_EFFECT_CHILD_CATEGORY_NAME = "効果"; // これは現状の設計では直接使わないかも

let isDataLoading = false;
let isInitialLoadComplete = false; // 初回フルロードが完了したか

/**
 * Firestoreから指定されたコレクションの全ドキュメント（未削除）を取得します。
 * @param {FirebaseFirestore.Firestore} db - Firestoreインスタンス
 * @param {string} collectionName - コレクション名
 * @returns {Promise<Array<Object>>} ドキュメントデータの配列
 */
async function fetchAllFromFirestore(db, collectionName) {
    const q = query(collection(db, collectionName), where('isDeleted', '==', false));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ [COLLECTIONS_CONFIG[collectionName]?.firestoreKey || 'id']: doc.id, ...doc.data() }));
}

/**
 * Firestoreから指定されたコレクションの差分ドキュメント（未削除・論理削除済み）を取得します。
 * @param {FirebaseFirestore.Firestore} db - Firestoreインスタンス
 * @param {string} collectionName - コレクション名
 * @param {Timestamp} lastSyncTimestamp - 最終同期時刻
 * @returns {Promise<{updatedData: Array<Object>, deletedIds: Array<string>}>} 更新データと削除IDリスト
 */
async function fetchDiffFromFirestore(db, collectionName, lastSyncTimestamp) {
    const firestoreKey = COLLECTIONS_CONFIG[collectionName]?.firestoreKey || 'id';
    
    // 更新・追加されたデータ (isDeleted == false)
    const updatedQuery = query(
        collection(db, collectionName),
        where('updatedAt', '>', lastSyncTimestamp),
        where('isDeleted', '==', false)
    );
    const updatedSnapshot = await getDocs(updatedQuery);
    const updatedData = updatedSnapshot.docs.map(doc => ({ [firestoreKey]: doc.id, ...doc.data() }));

    // 論理削除されたデータ (isDeleted == true)
    const deletedQuery = query(
        collection(db, collectionName),
        where('updatedAt', '>', lastSyncTimestamp),
        where('isDeleted', '==', true)
    );
    const deletedSnapshot = await getDocs(deletedQuery);
    const deletedIds = deletedSnapshot.docs.map(doc => doc.id);

    return { updatedData, deletedIds };
}

async function fetchAllCharacterBasesFromFirestore(db) {
    const fetchedBases = {};
    for (const baseType of CHARACTER_BASE_TYPES_FOR_LOADER) {
        const optionsCollectionRef = collection(db, `character_bases/${baseType}/options`);
        const q_opts = query(optionsCollectionRef, where('isDeleted', '==', false));
        const snapshot = await getDocs(q_opts);
        fetchedBases[baseType] = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
    }
    return fetchedBases;
}

async function fetchDiffCharacterBasesFromFirestore(db, lastSyncTimestamps) {
    const diffBases = { updatedData: {}, deletedIds: {} }; // { headShape: [...], color: [...] }
    for (const baseType of CHARACTER_BASE_TYPES_FOR_LOADER) {
        const lastSync = lastSyncTimestamps[`character_bases_${baseType}`] || new Timestamp(0,0); // Default to epoch if no sync time
        const optionsCollectionRef = collection(db, `character_bases/${baseType}/options`);
        
        const updatedQuery = query(optionsCollectionRef, where('updatedAt', '>', lastSync), where('isDeleted', '==', false));
        const updatedSnapshot = await getDocs(updatedQuery);
        diffBases.updatedData[baseType] = updatedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const deletedQuery = query(optionsCollectionRef, where('updatedAt', '>', lastSync), where('isDeleted', '==', true));
        const deletedSnapshot = await getDocs(deletedQuery);
        diffBases.deletedIds[baseType] = deletedSnapshot.docs.map(doc => doc.id);
    }
    return diffBases;
}


async function loadAllDataToCache() {
    console.log("[data-loader] Loading all data from IndexedDB to memory cache...");
    try {
        const results = await Promise.all([
            getAllFromDB('items'),
            getAllFromDB('categories'),
            getAllFromDB('tags'),
            getAllFromDB('effect_types'),
            getAllFromDB('effect_units'),
            getAllFromDB('effect_super_categories'),
            getAllFromDB('item_sources'),
        ]);
        allItems = results[0] || [];
        allCategories = results[1] || [];
        allTags = results[2] || [];
        effectTypesCache = results[3] || [];
        effectUnitsCache = results[4] || [];
        effectSuperCategoriesCache = results[5] || [];
        itemSourcesCache = results[6] || [];

        characterBasesCache = {};
        const charBaseOptions = await getAllFromDB('character_bases_options');
        if (charBaseOptions) {
            CHARACTER_BASE_TYPES_FOR_LOADER.forEach(type => characterBasesCache[type] = []);
            charBaseOptions.forEach(option => {
                if (characterBasesCache[option.baseType]) {
                    characterBasesCache[option.baseType].push(option);
                }
            });
        }
        
        console.log("[data-loader] Memory cache populated from IndexedDB.");
        buildEquipmentSlotTagMapInternal(); // Rebuild map after loading tags
        isInitialLoadComplete = true; // Mark initial load from IDB as complete
    } catch (error) {
        console.error("[data-loader] Error loading data from IndexedDB to memory cache:", error);
        // Set to empty arrays to prevent errors in other modules
        allItems = []; allCategories = []; allTags = []; effectTypesCache = [];
        effectUnitsCache = []; effectSuperCategoriesCache = []; itemSourcesCache = [];
        characterBasesCache = {};
        isInitialLoadComplete = false;
    }
}

async function performFullSync(db) {
    console.log("[data-loader] Performing full sync from Firestore to IndexedDB...");
    let currentServerTime = serverTimestamp(); // Get a server timestamp for the new sync time
                                            // This needs to be resolved to an actual Timestamp object.
                                            // For simplicity now, we'll use client time after operations.

    try {
        // Clear existing stores before full sync (optional, but good for clean slate)
        // await Promise.all(Object.values(COLLECTIONS_CONFIG).map(config => clearStoreInDB(config.storeName)));
        // await clearStoreInDB('character_bases_options');
        // console.log("[data-loader] Cleared existing IndexedDB stores for full sync.");

        // Fetch all data from Firestore
        const firestoreFetchPromises = Object.keys(COLLECTIONS_CONFIG).map(collName => 
            fetchAllFromFirestore(db, collName)
        );
        firestoreFetchPromises.push(fetchAllCharacterBasesFromFirestore(db));

        const results = await Promise.all(firestoreFetchPromises);
        
        // Put fetched data into IndexedDB
        const idbPutPromises = [];
        let resultIndex = 0;
        for (const collName of Object.keys(COLLECTIONS_CONFIG)) {
            const config = COLLECTIONS_CONFIG[collName];
            idbPutPromises.push(bulkPutToDB(config.storeName, results[resultIndex]));
            resultIndex++;
        }
        
        const charBasesData = results[resultIndex]; // Last result is character_bases
        const allCharBaseOptionsToPut = [];
        for (const baseType in charBasesData) {
            charBasesData[baseType].forEach(option => {
                allCharBaseOptionsToPut.push({ ...option, baseType: baseType }); // Add baseType for querying
            });
        }
        if (allCharBaseOptionsToPut.length > 0) {
            idbPutPromises.push(bulkPutToDB('character_bases_options', allCharBaseOptionsToPut));
        }
        
        await Promise.all(idbPutPromises);
        console.log("[data-loader] Full sync: Data written to IndexedDB.");

        // Update last sync timestamps for all collections to now
        // A more accurate way is to get a server timestamp *before* starting the fetches,
        // or use the latest `updatedAt` from the fetched data.
        // For simplicity, using client time after sync. This is okay for pull model.
        const newSyncTimestamp = Timestamp.now(); // Firestore Timestamp
        const metadataPutPromises = [];
        for (const collName of Object.keys(COLLECTIONS_CONFIG)) {
            metadataPutPromises.push(setMetadata(`${collName}_lastSyncTimestamp`, newSyncTimestamp));
        }
        for (const baseType of CHARACTER_BASE_TYPES_FOR_LOADER) {
            metadataPutPromises.push(setMetadata(`character_bases_${baseType}_lastSyncTimestamp`, newSyncTimestamp));
        }
        await Promise.all(metadataPutPromises);
        console.log("[data-loader] Full sync: Metadata (lastSyncTimestamps) updated.");
        
        await loadAllDataToCache(); // Populate memory cache from newly synced IDB
    } catch (error) {
        console.error("[data-loader] Error during full sync:", error);
        isInitialLoadComplete = false; // Mark as incomplete on error
        throw error; // Re-throw to be caught by calling function
    }
}

async function performDiffSync(db) {
    console.log("[data-loader] Performing differential sync from Firestore to IndexedDB...");
    const lastSyncTimestamps = {};
    const metadataGetPromises = [];

    for (const collName of Object.keys(COLLECTIONS_CONFIG)) {
        metadataGetPromises.push(getMetadata(`${collName}_lastSyncTimestamp`).then(ts => lastSyncTimestamps[collName] = ts));
    }
    for (const baseType of CHARACTER_BASE_TYPES_FOR_LOADER) {
        metadataGetPromises.push(getMetadata(`character_bases_${baseType}_lastSyncTimestamp`).then(ts => lastSyncTimestamps[`character_bases_${baseType}`] = ts));
    }
    await Promise.all(metadataGetPromises);
    console.log("[data-loader] Diff sync: Retrieved last sync timestamps:", lastSyncTimestamps);

    try {
        const firestoreFetchPromises = [];
        for (const collName of Object.keys(COLLECTIONS_CONFIG)) {
            const lastSync = lastSyncTimestamps[collName] || new Timestamp(0,0); // Default to epoch if never synced
            firestoreFetchPromises.push(fetchDiffFromFirestore(db, collName, lastSync));
        }
        firestoreFetchPromises.push(fetchDiffCharacterBasesFromFirestore(db, lastSyncTimestamps));

        const diffResults = await Promise.all(firestoreFetchPromises);

        const idbWritePromises = [];
        let resultIndex = 0;
        for (const collName of Object.keys(COLLECTIONS_CONFIG)) {
            const { updatedData, deletedIds } = diffResults[resultIndex];
            const config = COLLECTIONS_CONFIG[collName];
            if (updatedData.length > 0) {
                idbWritePromises.push(bulkPutToDB(config.storeName, updatedData));
            }
            if (deletedIds.length > 0) {
                idbWritePromises.push(bulkDeleteFromDB(config.storeName, deletedIds.map(id => id))); // Ensure keys match keyPath
            }
            resultIndex++;
        }

        const charBasesDiff = diffResults[resultIndex];
        const allCharBaseOptionsToPut = [];
        const allCharBaseOptionsToDelete = [];
        for (const baseType in charBasesDiff.updatedData) {
            charBasesDiff.updatedData[baseType].forEach(option => {
                allCharBaseOptionsToPut.push({ ...option, baseType: baseType });
            });
        }
        for (const baseType in charBasesDiff.deletedIds) {
            charBasesDiff.deletedIds[baseType].forEach(optionId => {
                allCharBaseOptionsToDelete.push(optionId); // Assuming ID is the keyPath
            });
        }
        if (allCharBaseOptionsToPut.length > 0) {
            idbWritePromises.push(bulkPutToDB('character_bases_options', allCharBaseOptionsToPut));
        }
        if (allCharBaseOptionsToDelete.length > 0) {
            idbWritePromises.push(bulkDeleteFromDB('character_bases_options', allCharBaseOptionsToDelete));
        }

        await Promise.all(idbWritePromises);
        console.log("[data-loader] Diff sync: Data changes applied to IndexedDB.");
        
        // Update last sync timestamps
        const newSyncTimestamp = Timestamp.now();
        const metadataPutPromises = [];
        for (const collName of Object.keys(COLLECTIONS_CONFIG)) {
            metadataPutPromises.push(setMetadata(`${collName}_lastSyncTimestamp`, newSyncTimestamp));
        }
        for (const baseType of CHARACTER_BASE_TYPES_FOR_LOADER) {
            metadataPutPromises.push(setMetadata(`character_bases_${baseType}_lastSyncTimestamp`, newSyncTimestamp));
        }
        await Promise.all(metadataPutPromises);
        console.log("[data-loader] Diff sync: Metadata (lastSyncTimestamps) updated.");

        await loadAllDataToCache(); // Refresh memory cache
    } catch (error) {
        console.error("[data-loader] Error during differential sync:", error);
        // Don't throw here, allow app to run with existing cache if diff sync fails
    }
}


export async function loadData(db) {
    if (isDataLoading) {
        console.warn("[data-loader] Data loading already in progress.");
        return;
    }
    isDataLoading = true;
    console.log("[data-loader] Initiating data load sequence (with IndexedDB)...");

    try {
        // Try to load from IndexedDB first to make the app responsive quickly
        await loadAllDataToCache();

        // Check if a sync has ever happened for 'items' (as a proxy for all data)
        const itemsLastSync = await getMetadata('items_lastSyncTimestamp');
        if (!itemsLastSync) {
            console.log("[data-loader] No previous sync found. Performing initial full sync.");
            await performFullSync(db);
        } else {
            console.log("[data-loader] Previous sync found. Performing differential sync.");
            // Perform diff sync in the background (don't await here if UI is already populated)
            performDiffSync(db).catch(err => {
                console.error("[data-loader] Background diff sync failed:", err);
                // Optionally notify user that data might not be the absolute latest
            });
        }
    } catch (error) {
        console.error("[data-loader] Critical error during data loading sequence:", error);
        // Reset all caches to prevent inconsistent state
        allItems = []; allCategories = []; allTags = []; effectTypesCache = [];
        effectUnitsCache = []; effectSuperCategoriesCache = []; itemSourcesCache = [];
        characterBasesCache = {}; EQUIPMENT_SLOT_TAG_IDS = {};
        isInitialLoadComplete = false;
        throw error; // Re-throw for main script to catch and display global error
    } finally {
        isDataLoading = false;
    }
    console.log("[data-loader] Data loading sequence complete.");
}

function buildEquipmentSlotTagMapInternal() {
    console.log("[data-loader] Building equipment slot tag map from memory cache...");
    EQUIPMENT_SLOT_TAG_IDS = {};
    const equipmentSlots = ["服", "顔", "首", "腕", "背中", "足"];
    if (!allTags || allTags.length === 0) {
        console.warn("[data-loader] Tags data is not loaded or empty in memory cache. Cannot build equipment slot tag map.");
        equipmentSlots.forEach(slotName => EQUIPMENT_SLOT_TAG_IDS[slotName] = null);
        return;
    }
    allTags.forEach(slotNameTag => { // allTags are already filtered for non-deleted
        equipmentSlots.forEach(slotName => {
            if (slotNameTag.name === slotName) {
                EQUIPMENT_SLOT_TAG_IDS[slotName] = slotNameTag.id;
            }
        });
    });
    equipmentSlots.forEach(slotName => {
        if (!EQUIPMENT_SLOT_TAG_IDS.hasOwnProperty(slotName)) {
            EQUIPMENT_SLOT_TAG_IDS[slotName] = null;
            console.warn(`[data-loader] Slot tag "${slotName}" not found in cached tags.`);
        }
    });
    console.log("[data-loader] Dynamically built EQUIPMENT_SLOT_TAG_IDS from cache:", EQUIPMENT_SLOT_TAG_IDS);
}

// Getter functions now return data from memory cache, which is populated from IndexedDB
export const getAllItems = () => allItems;
export const getAllCategories = () => allCategories;
export const getAllTags = () => allTags;
export const getEffectTypesCache = () => effectTypesCache;
export const getEffectUnitsCache = () => effectUnitsCache;
export const getEffectSuperCategoriesCache = () => effectSuperCategoriesCache;
export const getCharacterBasesCache = () => characterBasesCache;
export const getItemSourcesCache = () => itemSourcesCache;

// Helper to check if initial data (from IDB or Firestore full sync) has been loaded into memory
export const isInitialDataLoaded = () => isInitialLoadComplete;
