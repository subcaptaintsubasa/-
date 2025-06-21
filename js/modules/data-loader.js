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
};
const CHARACTER_BASE_TYPES_FOR_LOADER = ["headShape", "correction", "color", "pattern"];


// 公開定数
export let EQUIPMENT_SLOT_TAG_IDS = {};
export const SIMULATOR_PARENT_CATEGORY_NAME = "装備";
export const SIMULATOR_EFFECT_CHILD_CATEGORY_NAME = "効果";

let isDataLoading = false;
let isInitialLoadComplete = false;

async function fetchAllFromFirestore(db, collectionName) {
    const q = query(collection(db, collectionName), where('isDeleted', '==', false));
    const snapshot = await getDocs(q);
    const keyField = COLLECTIONS_CONFIG[collectionName]?.firestoreKey || 'id';
    return snapshot.docs.map(doc => ({ [keyField]: doc.id, ...doc.data() }));
}

async function fetchDiffFromFirestore(db, collectionName, lastSyncTimestamp) {
    const firestoreKey = COLLECTIONS_CONFIG[collectionName]?.firestoreKey || 'id';
    
    const updatedQuery = query(
        collection(db, collectionName),
        where('updatedAt', '>', lastSyncTimestamp),
        where('isDeleted', '==', false)
    );
    const updatedSnapshot = await getDocs(updatedQuery);
    const updatedData = updatedSnapshot.docs.map(doc => ({ [firestoreKey]: doc.id, ...doc.data() }));

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

async function fetchDiffCharacterBasesFromFirestore(db, lastSyncTimestampsByType) {
    const diffBases = { updatedData: {}, deletedIds: {} };
    for (const baseType of CHARACTER_BASE_TYPES_FOR_LOADER) {
        const metaKey = `character_bases_${baseType}_lastSyncTimestamp`;
        const lastSync = lastSyncTimestampsByType[metaKey] || new Timestamp(0,0);
        
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
        const storesToFetch = [
            'items', 'categories', 'tags', 'effect_types', 
            'effect_units', 'effect_super_categories', 'item_sources',
            'character_bases_options'
        ];
        const results = await Promise.all(
            storesToFetch.map(storeName => getAllFromDB(storeName))
        );
        
        allItems = results[0] || [];
        allCategories = results[1] || [];
        allTags = results[2] || [];
        effectTypesCache = results[3] || [];
        effectUnitsCache = results[4] || [];
        effectSuperCategoriesCache = results[5] || [];
        itemSourcesCache = results[6] || [];

        characterBasesCache = {};
        const charBaseOptionsFromDB = results[7] || [];
        if (charBaseOptionsFromDB) {
            CHARACTER_BASE_TYPES_FOR_LOADER.forEach(type => characterBasesCache[type] = []);
            charBaseOptionsFromDB.forEach(option => {
                if (characterBasesCache[option.baseType]) {
                    characterBasesCache[option.baseType].push(option);
                } else {
                    console.warn(`[data-loader] Option with unknown baseType found in character_bases_options:`, option);
                }
            });
        }
        
        console.log("[data-loader] Memory cache populated from IndexedDB.");
        buildEquipmentSlotTagMapInternal();
        isInitialLoadComplete = true; 
    } catch (error) {
        console.error("[data-loader] Error loading data from IndexedDB to memory cache:", error);
        allItems = []; allCategories = []; allTags = []; effectTypesCache = [];
        effectUnitsCache = []; effectSuperCategoriesCache = []; itemSourcesCache = [];
        characterBasesCache = {};
        isInitialLoadComplete = false;
    }
}

async function performFullSync(db) {
    console.log("[data-loader] Performing full sync from Firestore to IndexedDB...");
    try {
        const firestoreFetchPromises = Object.keys(COLLECTIONS_CONFIG).map(collName => 
            fetchAllFromFirestore(db, collName)
        );
        firestoreFetchPromises.push(fetchAllCharacterBasesFromFirestore(db));
        const results = await Promise.all(firestoreFetchPromises);
        
        const idbPutPromises = [];
        let resultIndex = 0;
        for (const collName of Object.keys(COLLECTIONS_CONFIG)) {
            const config = COLLECTIONS_CONFIG[collName];
            idbPutPromises.push(bulkPutToDB(config.storeName, results[resultIndex]));
            resultIndex++;
        }
        
        const charBasesData = results[resultIndex];
        const allCharBaseOptionsToPut = [];
        for (const baseType in charBasesData) {
            (charBasesData[baseType] || []).forEach(option => {
                allCharBaseOptionsToPut.push({ ...option, baseType: baseType });
            });
        }
        if (allCharBaseOptionsToPut.length > 0) {
            idbPutPromises.push(bulkPutToDB('character_bases_options', allCharBaseOptionsToPut));
        }
        
        await Promise.all(idbPutPromises);
        console.log("[data-loader] Full sync: Data written to IndexedDB.");

        const newSyncTimestamp = Timestamp.now();
        const metadataPutPromises = [];
        for (const collName of Object.keys(COLLECTIONS_CONFIG)) {
            metadataPutPromises.push(setMetadata(`${collName}_lastSyncTimestamp`, newSyncTimestamp));
        }
        for (const baseType of CHARACTER_BASE_TYPES_FOR_LOADER) {
            metadataPutPromises.push(setMetadata(`character_bases_${baseType}_lastSyncTimestamp`, newSyncTimestamp));
        }
        await Promise.all(metadataPutPromises);
        console.log("[data-loader] Full sync: Metadata (lastSyncTimestamps) updated.");
        
        await loadAllDataToCache(); 
    } catch (error) {
        console.error("[data-loader] Error during full sync:", error);
        isInitialLoadComplete = false; 
        throw error; 
    }
}

async function performDiffSync(db) {
    console.log("[data-loader] Performing differential sync from Firestore to IndexedDB...");
    const lastSyncTimestamps = {}; // For regular collections
    const charBaseLastSyncTimestamps = {}; // For character_bases subcollections, keyed by metaKey
    const metadataGetPromises = [];

    for (const collName of Object.keys(COLLECTIONS_CONFIG)) {
        const metaKey = `${collName}_lastSyncTimestamp`;
        metadataGetPromises.push(
            getMetadata(metaKey).then(tsData => {
                if (tsData && typeof tsData.seconds === 'number' && typeof tsData.nanoseconds === 'number') {
                    lastSyncTimestamps[collName] = new Timestamp(tsData.seconds, tsData.nanoseconds);
                } else {
                    lastSyncTimestamps[collName] = new Timestamp(0,0); 
                }
                console.log(`[data-loader] DiffSync: ${collName} lastSync:`, lastSyncTimestamps[collName].toDate());
            })
        );
    }
    for (const baseType of CHARACTER_BASE_TYPES_FOR_LOADER) {
        const metaKey = `character_bases_${baseType}_lastSyncTimestamp`;
        metadataGetPromises.push(
            getMetadata(metaKey).then(tsData => {
                if (tsData && typeof tsData.seconds === 'number' && typeof tsData.nanoseconds === 'number') {
                    charBaseLastSyncTimestamps[metaKey] = new Timestamp(tsData.seconds, tsData.nanoseconds);
                } else {
                    charBaseLastSyncTimestamps[metaKey] = new Timestamp(0,0);
                }
                 console.log(`[data-loader] DiffSync: ${metaKey} lastSync:`, charBaseLastSyncTimestamps[metaKey].toDate());
            })
        );
    }

    await Promise.all(metadataGetPromises);
    console.log("[data-loader] Diff sync: Retrieved and processed all last sync timestamps.");

    try {
        const firestoreFetchPromises = [];
        for (const collName of Object.keys(COLLECTIONS_CONFIG)) {
            const lastSync = lastSyncTimestamps[collName]; // Already a Timestamp instance or epoch
            firestoreFetchPromises.push(fetchDiffFromFirestore(db, collName, lastSync));
        }
        // Pass the object pajak charBaseLastSyncTimestamps (keyed by metaKey)
        firestoreFetchPromises.push(fetchDiffCharacterBasesFromFirestore(db, charBaseLastSyncTimestamps));

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
                idbWritePromises.push(bulkDeleteFromDB(config.storeName, deletedIds)); 
            }
            resultIndex++;
        }

        const charBasesDiff = diffResults[resultIndex];
        const allCharBaseOptionsToPut = [];
        const allCharBaseOptionsToDelete = [];
        for (const baseType in charBasesDiff.updatedData) {
            (charBasesDiff.updatedData[baseType] || []).forEach(option => {
                allCharBaseOptionsToPut.push({ ...option, baseType: baseType });
            });
        }
        for (const baseType in charBasesDiff.deletedIds) {
            (charBasesDiff.deletedIds[baseType] || []).forEach(optionId => {
                allCharBaseOptionsToDelete.push(optionId);
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
        
        const newSyncTimestamp = Timestamp.now();
        const metadataPutPromises = [];
        for (const collName of Object.keys(COLLECTIONS_CONFIG)) {
            metadataPutPromises.push(setMetadata(`${collName}_lastSyncTimestamp`, newSyncTimestamp));
        }
        for (const baseType of CHARACTER_BASE_TYPES_FOR_LOADER) {
            metadataPutPromises.push(setMetadata(`character_bases_${baseType}_lastSyncTimestamp`, newSyncTimestamp));
        }
        await Promise.all(metadataPutPromises);
        console.log("[data-loader] Diff sync: Metadata (lastSyncTimestamps) updated to new time.");

        await loadAllDataToCache(); 
    } catch (error) {
        console.error("[data-loader] Error during differential sync processing:", error);
    }
}


export async function loadData(db) {
    if (isDataLoading) {
        console.warn("[data-loader] Data loading already in progress.");
        return;
    }
    isDataLoading = true;
    isInitialLoadComplete = false; 
    console.log("[data-loader] Initiating data load sequence (with IndexedDB)...");

    try {
        console.log("[data-loader] Attempting to load initial data from IndexedDB to memory cache...");
        await loadAllDataToCache();

        const itemsLastSync = await getMetadata('items_lastSyncTimestamp');
        // ★★★ デバッグログ追加 ★★★
        console.log('[data-loader] Retrieved items_lastSyncTimestamp from getMetadata:', itemsLastSync);
        if (itemsLastSync && typeof itemsLastSync.toDate === 'function') { 
            console.log('[data-loader] itemsLastSync is a valid Timestamp:', itemsLastSync.toDate());
        } else if (itemsLastSync) {
            console.warn('[data-loader] itemsLastSync is NOT a Timestamp object, but has a value:', itemsLastSync);
        } else {
            console.log('[data-loader] itemsLastSync is undefined or null.');
        }
        // ★★★ デバッグログ追加ここまで ★★★

        if (!itemsLastSync) {
            console.log("[data-loader] No previous sync found (itemsLastSync is falsy). Performing initial full sync.");
            await performFullSync(db);
        } else {
            console.log("[data-loader] Previous sync found (itemsLastSync is truthy). Performing differential sync.");
            performDiffSync(db).catch(err => {
                console.error("[data-loader] Background diff sync failed:", err);
            });
        }
    } catch (error) {
        console.error("[data-loader] Critical error during data loading sequence:", error);
        allItems = []; allCategories = []; allTags = []; effectTypesCache = [];
        effectUnitsCache = []; effectSuperCategoriesCache = []; itemSourcesCache = [];
        characterBasesCache = {}; EQUIPMENT_SLOT_TAG_IDS = {};
        isInitialLoadComplete = false;
        throw error; 
    } finally {
        isDataLoading = false;
    }
    console.log("[data-loader] Data loading sequence complete. isInitialLoadComplete:", isInitialLoadComplete);
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
    allTags.forEach(slotNameTag => {
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

export const getAllItems = () => allItems;
export const getAllCategories = () => allCategories;
export const getAllTags = () => allTags;
export const getEffectTypesCache = () => effectTypesCache;
export const getEffectUnitsCache = () => effectUnitsCache;
export const getEffectSuperCategoriesCache = () => effectSuperCategoriesCache;
export const getCharacterBasesCache = () => characterBasesCache;
export const getItemSourcesCache = () => itemSourcesCache;
export const isInitialDataLoaded = () => isInitialLoadComplete;
