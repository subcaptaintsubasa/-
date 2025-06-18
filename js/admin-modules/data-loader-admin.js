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


async function loadCategoriesFromFirestore(db) {
    console.log("[Admin][Data Loader][Categories] Loading categories...");
    try {
        // Add where clause for isDeleted
        const q = query(collection(db, 'categories'), where('isDeleted', '==', false), orderBy('name'));
        const snapshot = await getDocs(q);
        allCategoriesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("[Admin][Data Loader][Categories] Loaded (non-deleted):", allCategoriesCache.length);
    } catch (error) {
        console.error("[Admin][Data Loader][Categories] Error loading:", error);
        allCategoriesCache = [];
    }
}

async function loadTagsFromFirestore(db) {
    console.log("[Admin][Data Loader][Tags] Loading tags...");
    try {
        // Add where clause for isDeleted
        const q = query(collection(db, 'tags'), where('isDeleted', '==', false), orderBy('name'));
        const snapshot = await getDocs(q);
        allTagsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("[Admin][Data Loader][Tags] Loaded (non-deleted):", allTagsCache.length);
    } catch (error) {
        console.error("[Admin][Data Loader][Tags] Error loading:", error);
        allTagsCache = [];
    }
}

async function loadItemsFromFirestore(db) {
    console.log("[Admin][Data Loader][Items] Loading items...");
    try {
        // Add where clause for isDeleted
        const q = query(collection(db, 'items'), where('isDeleted', '==', false), orderBy('name'));
        const snapshot = await getDocs(q);
        itemsCache = snapshot.docs.map(docSnap => ({ docId: docSnap.id, ...docSnap.data() }));
        console.log("[Admin][Data Loader][Items] Loaded (non-deleted):", itemsCache.length);
    } catch (error) {
        console.error("[Admin][Data Loader][Items] Error loading:", error);
        itemsCache = [];
    }
}

async function loadEffectTypesFromFirestore(db) {
    console.log("[Admin][Data Loader][EffectTypes] Loading effect types...");
    try {
        // Add where clause for isDeleted
        const q = query(collection(db, 'effect_types'), where('isDeleted', '==', false), orderBy('name'));
        const snapshot = await getDocs(q);
        effectTypesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("[Admin][Data Loader][EffectTypes] Loaded (non-deleted):", effectTypesCache.length);
    } catch (error) {
        console.error("[Admin][Data Loader][EffectTypes] Error loading:", error);
        effectTypesCache = [];
    }
}

async function loadEffectUnitsFromFirestore(db) {
    console.log("[Admin][Data Loader][EffectUnits] Loading effect units...");
    try {
        // Add where clause for isDeleted
        const q = query(collection(db, 'effect_units'), where('isDeleted', '==', false), orderBy('name'));
        const snapshot = await getDocs(q);
        effectUnitsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("[Admin][Data Loader][EffectUnits] Loaded (non-deleted):", effectUnitsCache.length);
    } catch (error) {
        console.error("[Admin][Data Loader][EffectUnits] Error loading:", error);
        effectUnitsCache = [];
    }
}

async function loadEffectSuperCategoriesFromFirestore(db) {
    console.log("[Admin][Data Loader][EffectSuperCategories] Loading effect super categories...");
    try {
        // Add where clause for isDeleted
        const q = query(collection(db, 'effect_super_categories'), where('isDeleted', '==', false), orderBy('name'));
        const snapshot = await getDocs(q);
        effectSuperCategoriesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("[Admin][Data Loader][EffectSuperCategories] Loaded (non-deleted):", effectSuperCategoriesCache.length);
    } catch (error) {
        console.error("[Admin][Data Loader][EffectSuperCategories] Error loading:", error);
        effectSuperCategoriesCache = [];
    }
}


async function loadCharacterBasesFromFirestore(db) {
    console.log("[Admin][Data Loader][CharBases] Loading character bases options...");
    characterBasesCache = {};
    const baseTypes = Object.keys(baseTypeMappingsForLoader);
    try {
        for (const baseType of baseTypes) {
            const optionsCollectionRef = collection(db, `character_bases/${baseType}/options`);
            // Add where clause for isDeleted
            const q_opts = query(optionsCollectionRef, where('isDeleted', '==', false), orderBy("name"));
            const snapshot = await getDocs(q_opts);
            characterBasesCache[baseType] = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
        }
        console.log("[Admin][Data Loader][CharBases] Loaded (non-deleted options).");
    } catch (error) {
        console.error("[Admin][Data Loader][CharBases] Error loading:", error);
    }
}

async function loadItemSourcesFromFirestore(db) {
    console.log("[Admin][Data Loader][ItemSources] Loading item sources...");
    try {
        // Add where clause for isDeleted
        const q = query(collection(db, 'item_sources'), where('isDeleted', '==', false), orderBy('depth'), orderBy('name'));
        const snapshot = await getDocs(q);
        itemSourcesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("[Admin][Data Loader][ItemSources] Loaded (non-deleted):", itemSourcesCache.length);
    } catch (error) {
        console.error("[Admin][Data Loader][ItemSources] Error loading:", error);
        itemSourcesCache = [];
    }
}

export async function loadInitialData(db) {
    console.log("[Admin][Data Loader] Starting initial data load sequence (with isDeleted filter)...");
    try {
        // Order is less critical now, but keep related things somewhat together
        await Promise.all([
            loadEffectUnitsFromFirestore(db),       // Base data
            loadEffectSuperCategoriesFromFirestore(db), // Depends on nothing
            loadCategoriesFromFirestore(db),        // Depends on nothing
            loadItemSourcesFromFirestore(db),       // Depends on nothing

            loadEffectTypesFromFirestore(db),       // Depends on Units, SuperCategories (for display/logic)
            loadTagsFromFirestore(db),              // Depends on Categories (for display/logic)
            loadCharacterBasesFromFirestore(db),  // Depends on EffectTypes, Units (for effects)
            
            loadItemsFromFirestore(db)              // Depends on Tags, EffectTypes, ItemSources
        ]);
        console.log("[Admin][Data Loader] All initial data load promises (with isDeleted filter) settled.");
    } catch (error) {
        console.error("[Admin][Data Loader] Error during parallel data loading (with isDeleted filter):", error);
    }
    console.log("[Admin][Data Loader] Initial data load sequence (with isDeleted filter) complete.");
}

export function clearAdminDataCache() {
    allCategoriesCache = [];
    allTagsCache = [];
    itemsCache = [];
    effectTypesCache = [];
    effectUnitsCache = [];
    effectSuperCategoriesCache = [];
    characterBasesCache = {};
    itemSourcesCache = [];
    console.log("[Admin][Data Loader] All admin data caches cleared.");
}

// Getter functions remain the same, they will now return data filtered by isDeleted:false
export const getAllCategoriesCache = () => allCategoriesCache;
export const getAllTagsCache = () => allTagsCache;
export const getItemsCache = () => itemsCache;
export const getEffectTypesCache = () => effectTypesCache;
export const getEffectUnitsCache = () => effectUnitsCache;
export const getEffectSuperCategoriesCache = () => effectSuperCategoriesCache;
export const getCharacterBasesCache = () => characterBasesCache;
export const getItemSourcesCache = () => itemSourcesCache;
