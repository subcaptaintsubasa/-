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

// Constants
export const baseTypeMappingsForLoader = { // Used internally and can be exported if needed elsewhere
    headShape: "頭の形",
    correction: "補正",
    color: "色",
    pattern: "柄"
};
// This URL is specific to your Cloudflare Worker for image uploads
export const IMAGE_UPLOAD_WORKER_URL = 'https://denpa-item-uploader.tsubasa-hsty-f58.workers.dev'; // Example URL


async function loadCategoriesFromFirestore(db) {
    console.log("[Admin][Data Loader][Categories] Loading categories...");
    try {
        const q = query(collection(db, 'categories'), orderBy('name'));
        const snapshot = await getDocs(q);
        allCategoriesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("[Admin][Data Loader][Categories] Loaded:", allCategoriesCache.length);
    } catch (error) {
        console.error("[Admin][Data Loader][Categories] Error loading:", error);
        allCategoriesCache = []; // Reset cache on error
    }
}

async function loadTagsFromFirestore(db) {
    console.log("[Admin][Data Loader][Tags] Loading tags...");
    try {
        const q = query(collection(db, 'tags'), orderBy('name'));
        const snapshot = await getDocs(q);
        allTagsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("[Admin][Data Loader][Tags] Loaded:", allTagsCache.length);
    } catch (error) {
        console.error("[Admin][Data Loader][Tags] Error loading:", error);
        allTagsCache = [];
    }
}

async function loadItemsFromFirestore(db) {
    console.log("[Admin][Data Loader][Items] Loading items...");
    try {
        // Items might not always have a 'name' to order by if names can be empty.
        // Consider ordering by a timestamp or another consistent field if 'name' is not reliable.
        // For now, assuming 'name' exists for sorting. If not, remove orderBy or use a fallback.
        const q = query(collection(db, 'items'), orderBy('name')); // Or orderBy('createdAt', 'desc')
        const snapshot = await getDocs(q);
        itemsCache = snapshot.docs.map(docSnap => ({ docId: docSnap.id, ...docSnap.data() })); // Changed 'id' to 'docId' for items for clarity
        console.log("[Admin][Data Loader][Items] Loaded:", itemsCache.length);
    } catch (error) {
        console.error("[Admin][Data Loader][Items] Error loading:", error);
        itemsCache = [];
    }
}

async function loadEffectTypesFromFirestore(db) {
    console.log("[Admin][Data Loader][EffectTypes] Loading effect types...");
    try {
        const q = query(collection(db, 'effect_types'), orderBy('name'));
        const snapshot = await getDocs(q);
        effectTypesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("[Admin][Data Loader][EffectTypes] Loaded:", effectTypesCache.length);
    } catch (error) {
        console.error("[Admin][Data Loader][EffectTypes] Error loading:", error);
        effectTypesCache = [];
    }
}

async function loadEffectUnitsFromFirestore(db) {
    console.log("[Admin][Data Loader][EffectUnits] Loading effect units...");
    try {
        const q = query(collection(db, 'effect_units'), orderBy('name'));
        const snapshot = await getDocs(q);
        effectUnitsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("[Admin][Data Loader][EffectUnits] Loaded:", effectUnitsCache.length);
    } catch (error) {
        console.error("[Admin][Data Loader][EffectUnits] Error loading:", error);
        effectUnitsCache = [];
    }
}

async function loadCharacterBasesFromFirestore(db) {
    console.log("[Admin][Data Loader][CharBases] Loading character bases...");
    const tempCache = {}; // Use a temporary cache for this load operation
    const baseTypes = Object.keys(baseTypeMappingsForLoader);
    try {
        for (const baseType of baseTypes) {
            // The collection path was `character_bases/${baseType}/options`
            // Assuming it should be `charBaseOptions_${baseType}` as used in char-base-manager.js
            const optionsCollectionRef = collection(db, `charBaseOptions_${baseType}`);
            const q_opts = query(optionsCollectionRef, orderBy("name"));
            const snapshot = await getDocs(q_opts);
            tempCache[baseType] = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
        }
        characterBasesCache = tempCache; // Assign to global cache only on successful load of all types
        console.log("[Admin][Data Loader][CharBases] Loaded successfully:", characterBasesCache);
    } catch (error) {
        console.error("[Admin][Data Loader][CharBases] Error loading:", error);
        // Decide on error strategy: clear all, or keep partially loaded?
        // For now, if any fails, the global cache might not be updated or might be partially updated.
        // To be safer, one might clear characterBasesCache if an error occurs.
        characterBasesCache = {}; // Reset on error for consistency
    }
}

export async function loadInitialData(db) {
    console.log("[Admin][Data Loader] Starting initial data load sequence...");
    // Load units first, as effect types might reference them (if defaultUnit was an ID)
    // However, current effect_type stores unit name as string, so order is less critical here.
    try {
        await Promise.all([
            loadEffectUnitsFromFirestore(db), // Load units
            loadCategoriesFromFirestore(db),
            loadTagsFromFirestore(db),
            loadCharacterBasesFromFirestore(db) 
            // Effect types and Items are loaded after their dependencies if any were ID-based
        ]);
        // Load effect types after units (if units were by ID, this order matters more)
        await loadEffectTypesFromFirestore(db);
        // Load items last as they reference tags, categories (implicitly), and effect types
        await loadItemsFromFirestore(db);

        console.log("[Admin][Data Loader] All initial data load promises settled.");
    } catch (error) {
        console.error("[Admin][Data Loader] Error during sequential/parallel data loading:", error);
        // Individual loaders reset their caches. Consider a more global error state if needed.
    }
    console.log("[Admin][Data Loader] Initial data load sequence complete.");
}

export function clearAdminDataCache() {
    allCategoriesCache = [];
    allTagsCache = [];
    itemsCache = [];
    effectTypesCache = [];
    effectUnitsCache = [];
    characterBasesCache = {};
    console.log("[Admin][Data Loader] All admin data caches cleared.");
}

// Getter functions for the cached data
export const getAllCategoriesCache = () => allCategoriesCache;
export const getAllTagsCache = () => allTagsCache;
export const getItemsCache = () => itemsCache; // Used by item-manager
export const getEffectTypesCache = () => effectTypesCache;
export const getEffectUnitsCache = () => effectUnitsCache;
export const getCharacterBasesCache = () => characterBasesCache;
