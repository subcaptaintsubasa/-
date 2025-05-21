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
let effectSuperCategoriesCache = []; // ★★★ 追加 ★★★
let characterBasesCache = {}; // e.g., { headShape: [ {id, name, effects}, ... ], color: [...] }

// Constants
export const baseTypeMappingsForLoader = {
    headShape: "頭の形",
    correction: "補正",
    color: "色",
    pattern: "柄"
};
// This URL is specific to your Cloudflare Worker for image uploads
export const IMAGE_UPLOAD_WORKER_URL = 'https://denpa-item-uploader.tsubasa-hsty-f58.workers.dev';


async function loadCategoriesFromFirestore(db) {
    console.log("[Admin][Data Loader][Categories] Loading categories...");
    try {
        const q = query(collection(db, 'categories'), orderBy('name'));
        const snapshot = await getDocs(q);
        allCategoriesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("[Admin][Data Loader][Categories] Loaded:", allCategoriesCache.length, /* allCategoriesCache */); // Avoid logging large objects
    } catch (error) {
        console.error("[Admin][Data Loader][Categories] Error loading:", error);
        allCategoriesCache = [];
    }
}

async function loadTagsFromFirestore(db) {
    console.log("[Admin][Data Loader][Tags] Loading tags...");
    try {
        const q = query(collection(db, 'tags'), orderBy('name'));
        const snapshot = await getDocs(q);
        allTagsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("[Admin][Data Loader][Tags] Loaded:", allTagsCache.length, /* allTagsCache */);
    } catch (error) {
        console.error("[Admin][Data Loader][Tags] Error loading:", error);
        allTagsCache = [];
    }
}

async function loadItemsFromFirestore(db) {
    console.log("[Admin][Data Loader][Items] Loading items...");
    try {
        const q = query(collection(db, 'items'), orderBy('name'));
        const snapshot = await getDocs(q);
        itemsCache = snapshot.docs.map(docSnap => ({ docId: docSnap.id, ...docSnap.data() }));
        console.log("[Admin][Data Loader][Items] Loaded:", itemsCache.length, /* itemsCache */);
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
        console.log("[Admin][Data Loader][EffectTypes] Loaded:", effectTypesCache.length, /* effectTypesCache */);
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
        console.log("[Admin][Data Loader][EffectUnits] Loaded:", effectUnitsCache.length, /* effectUnitsCache */);
    } catch (error) {
        console.error("[Admin][Data Loader][EffectUnits] Error loading:", error);
        effectUnitsCache = [];
    }
}

// ★★★ 追加: 効果大分類を読み込む関数 ★★★
async function loadEffectSuperCategoriesFromFirestore(db) {
    console.log("[Admin][Data Loader][EffectSuperCategories] Loading effect super categories...");
    try {
        const q = query(collection(db, 'effect_super_categories'), orderBy('name')); // 'effect_super_categories' はコレクション名と仮定
        const snapshot = await getDocs(q);
        effectSuperCategoriesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("[Admin][Data Loader][EffectSuperCategories] Loaded:", effectSuperCategoriesCache.length, /* effectSuperCategoriesCache */);
    } catch (error) {
        console.error("[Admin][Data Loader][EffectSuperCategories] Error loading:", error);
        effectSuperCategoriesCache = [];
    }
}


async function loadCharacterBasesFromFirestore(db) {
    console.log("[Admin][Data Loader][CharBases] Loading character bases...");
    characterBasesCache = {};
    const baseTypes = Object.keys(baseTypeMappingsForLoader);
    try {
        for (const baseType of baseTypes) {
            const optionsCollectionRef = collection(db, `character_bases/${baseType}/options`);
            const q_opts = query(optionsCollectionRef, orderBy("name"));
            const snapshot = await getDocs(q_opts);
            characterBasesCache[baseType] = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
        }
        console.log("[Admin][Data Loader][CharBases] Loaded:", /* characterBasesCache */);
    } catch (error) {
        console.error("[Admin][Data Loader][CharBases] Error loading:", error);
    }
}

export async function loadInitialData(db) {
    console.log("[Admin][Data Loader] Starting initial data load sequence...");
    try {
        await Promise.all([
            loadEffectUnitsFromFirestore(db),
            loadEffectSuperCategoriesFromFirestore(db), // ★★★ 追加 ★★★
            loadEffectTypesFromFirestore(db),
            loadCategoriesFromFirestore(db),
            loadTagsFromFirestore(db),
            loadCharacterBasesFromFirestore(db),
            loadItemsFromFirestore(db)
        ]);
        console.log("[Admin][Data Loader] All initial data load promises settled.");
    } catch (error) {
        console.error("[Admin][Data Loader] Error during parallel data loading:", error);
    }
    console.log("[Admin][Data Loader] Initial data load sequence complete.");
}

export function clearAdminDataCache() {
    allCategoriesCache = [];
    allTagsCache = [];
    itemsCache = [];
    effectTypesCache = [];
    effectUnitsCache = [];
    effectSuperCategoriesCache = []; // ★★★ 追加 ★★★
    characterBasesCache = {};
    console.log("[Admin][Data Loader] All admin data caches cleared.");
}

export const getAllCategoriesCache = () => allCategoriesCache;
export const getAllTagsCache = () => allTagsCache;
export const getItemsCache = () => itemsCache;
export const getEffectTypesCache = () => effectTypesCache;
export const getEffectUnitsCache = () => effectUnitsCache;
export const getEffectSuperCategoriesCache = () => effectSuperCategoriesCache; // ★★★ 追加 ★★★
export const getCharacterBasesCache = () => characterBasesCache;
