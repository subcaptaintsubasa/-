// js/admin-modules/data-loader-admin.js
// Handles loading all necessary data from Firestore for the admin panel
// and acts as a central cache for this data.

import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// Cache variables for admin panel data
let allCategoriesCache = [];
let allTagsCache = [];
let itemsCache = [];
let effectTypesCache = [];
let effectUnitsCache = [];
let characterBasesCache = {}; // e.g., { headShape: [ {id, name, effects}, ... ], color: [...] }

// Constants (could also be imported or passed if they vary)
export const baseTypeMappingsForLoader = { // Consistent with char-base-manager
    headShape: "頭の形",
    correction: "補正",
    color: "色",
    pattern: "柄"
};
export const IMAGE_UPLOAD_WORKER_URL = 'https://denpa-item-uploader.tsubasa-hsty-f58.workers.dev'; // Make configurable if needed

// --- Internal Loader Functions ---

async function loadCategoriesFromFirestore(db) {
    console.log("[Admin][Categories] Loading categories...");
    try {
        const q = query(collection(db, 'categories'), orderBy('name'));
        const snapshot = await getDocs(q);
        allCategoriesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("[Admin][Categories] Loaded:", allCategoriesCache.length);
    } catch (error) {
        console.error("[Admin][Categories] Error loading:", error);
        allCategoriesCache = [];
    }
}

async function loadTagsFromFirestore(db) {
    console.log("[Admin][Tags] Loading tags...");
    try {
        const q = query(collection(db, 'tags'), orderBy('name'));
        const snapshot = await getDocs(q);
        allTagsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("[Admin][Tags] Loaded:", allTagsCache.length);
    } catch (error) {
        console.error("[Admin][Tags] Error loading:", error);
        allTagsCache = [];
    }
}

async function loadItemsFromFirestore(db) {
    console.log("[Admin][Items] Loading items...");
    try {
        const q = query(collection(db, 'items'), orderBy('name'));
        const snapshot = await getDocs(q);
        itemsCache = snapshot.docs.map(docSnap => ({ docId: docSnap.id, ...docSnap.data() }));
        console.log("[Admin][Items] Loaded:", itemsCache.length);
    } catch (error) {
        console.error("[Admin][Items] Error loading:", error);
        itemsCache = [];
    }
}

async function loadEffectTypesFromFirestore(db) {
    console.log("[Admin][EffectTypes] Loading effect types...");
    try {
        const q = query(collection(db, 'effect_types'), orderBy('name'));
        const snapshot = await getDocs(q);
        effectTypesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("[Admin][EffectTypes] Loaded:", effectTypesCache.length);
    } catch (error) {
        console.error("[Admin][EffectTypes] Error loading:", error);
        effectTypesCache = [];
    }
}

async function loadEffectUnitsFromFirestore(db) {
    console.log("[Admin][EffectUnits] Loading effect units...");
    try {
        const q = query(collection(db, 'effect_units'), orderBy('name'));
        const snapshot = await getDocs(q);
        effectUnitsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("[Admin][EffectUnits] Loaded:", effectUnitsCache.length);
    } catch (error) {
        console.error("[Admin][EffectUnits] Error loading:", error);
        effectUnitsCache = [];
    }
}

async function loadCharacterBasesFromFirestore(db) {
    console.log("[Admin][CharBases] Loading character bases...");
    characterBasesCache = {};
    const baseTypes = Object.keys(baseTypeMappingsForLoader);
    try {
        for (const baseType of baseTypes) {
            const optionsCollectionRef = collection(db, `character_bases/${baseType}/options`);
            const q_opts = query(optionsCollectionRef, orderBy("name"));
            const snapshot = await getDocs(q_opts);
            characterBasesCache[baseType] = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
        }
        console.log("[Admin][CharBases] Loaded:", characterBasesCache);
    } catch (error) {
        console.error("[Admin][CharBases] Error loading:", error);
    }
}

// --- Main Data Loading Function ---
/**
 * Loads all necessary data for the admin panel from Firestore.
 * This function should be called after successful authentication.
 * @param {Firestore} db - The Firestore instance.
 */
export async function loadInitialData(db) {
    console.log("[Admin][Data Loader] Starting initial data load...");
    // Load in a sensible order, e.g., units before types that use units
    await loadEffectUnitsFromFirestore(db);
    await loadEffectTypesFromFirestore(db);
    await loadCategoriesFromFirestore(db); // Categories before tags that use categories
    await loadTagsFromFirestore(db);
    await loadCharacterBasesFromFirestore(db); // Char bases might use effect types
    await loadItemsFromFirestore(db);         // Items use tags, effect types
    console.log("[Admin][Data Loader] Initial data load complete.");
    // After loading, individual manager modules will use the getters below
    // to access this cached data and render their respective UI sections.
}

/**
 * Clears all cached admin data.
 * Typically called on logout.
 */
export function clearAdminDataCache() {
    allCategoriesCache = [];
    allTagsCache = [];
    itemsCache = [];
    effectTypesCache = [];
    effectUnitsCache = [];
    characterBasesCache = {};
    console.log("[Admin][Data Loader] All admin data caches cleared.");
}


// --- Getters for Cached Data ---
export const getAllCategoriesCache = () => allCategoriesCache;
export const getAllTagsCache = () => allTagsCache;
export const getItemsCache = () => itemsCache; // Renamed for clarity from itemsCache
export const getEffectTypesCache = () => effectTypesCache;
export const getEffectUnitsCache = () => effectUnitsCache;
export const getCharacterBasesCache = () => characterBasesCache;

// Note: State for individual forms (like currentItemEffects, selectedImageFile)
// is managed within their respective manager modules (e.g., item-manager.js).
// This data-loader focuses on Firestore data caches.
// If truly global form state is needed, it could be added here, but it's often cleaner
// to keep form-specific transient state within the module that manages that form.
