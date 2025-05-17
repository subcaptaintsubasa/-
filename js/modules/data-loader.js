// js/modules/data-loader.js
// Handles loading all necessary data from Firestore for the user-facing side (item search, simulator).
// Caches the data for efficient access by other modules.

import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// Module-level caches for data
let allItems = [];
let allCategories = [];
let allTags = [];
let effectTypesCache = [];
let characterBasesCache = {}; // { headShape: [options], color: [options], ... }

// Constants related to data structure or special names
const characterBaseTypes = ["headShape", "correction", "color", "pattern"];
export let EQUIPMENT_SLOT_TAG_IDS = {}; // Populated after tags are loaded
export const SIMULATOR_PARENT_CATEGORY_NAME = "装備"; // Used to pre-filter for simulator
export const SIMULATOR_EFFECT_CHILD_CATEGORY_NAME = "効果"; // Specific child category for effects in simulator

/**
 * Loads character base options from Firestore.
 * @param {Firestore} db - The Firestore instance.
 */
async function loadCharacterBasesFromFirestore(db) {
    console.log("[Data Loader] Loading character bases from Firestore...");
    characterBasesCache = {}; // Reset before loading
    try {
        for (const baseType of characterBaseTypes) {
            const optionsCollectionRef = collection(db, `character_bases/${baseType}/options`);
            const q_opts = query(optionsCollectionRef, orderBy("name")); // Order by name
            const snapshot = await getDocs(q_opts);
            characterBasesCache[baseType] = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
        }
        console.log("[Data Loader] Character bases loaded:", characterBasesCache);
    } catch (error) {
        console.error("[Data Loader] Error loading character bases from Firestore:", error);
        characterBasesCache = {}; // Ensure it's an empty object on error
    }
}

/**
 * Builds a map of equipment slot names to their corresponding tag IDs.
 * This must be called after `allTags` is populated.
 */
function buildEquipmentSlotTagMap() {
    EQUIPMENT_SLOT_TAG_IDS = {};
    const equipmentSlots = ["服", "顔", "首", "腕", "背中", "足"]; // This could be made configurable

    if (!allTags || allTags.length === 0) {
        console.warn("[Data Loader] Tags data is not loaded or empty. Cannot build equipment slot tag map.");
        equipmentSlots.forEach(slotName => EQUIPMENT_SLOT_TAG_IDS[slotName] = null);
        return;
    }

    equipmentSlots.forEach(slotName => {
        const foundTag = allTags.find(tag => tag.name === slotName);
        EQUIPMENT_SLOT_TAG_IDS[slotName] = foundTag ? foundTag.id : null;
        if (!foundTag) {
            console.warn(`[Data Loader] Slot Tag for "${slotName}" not found in Firestore tags collection.`);
        }
    });
    console.log("[Data Loader] Equipment slot tag IDs built:", EQUIPMENT_SLOT_TAG_IDS);
}

/**
 * Main data loading function for the user-facing application.
 * Fetches all required collections from Firestore and caches them.
 * @param {Firestore} db - The Firestore instance.
 * @throws Will re-throw errors from Firestore if data loading fails.
 */
export async function loadData(db) {
    console.log("[Data Loader] Starting all data load for user interface...");
    try {
        // Load character bases first as they are relatively independent
        await loadCharacterBasesFromFirestore(db);

        // Load other collections in parallel
        const [effectTypesSnapshot, categoriesSnapshot, tagsSnapshot, itemsSnapshot] = await Promise.all([
            getDocs(query(collection(db, 'effect_types'), orderBy('name'))),
            getDocs(query(collection(db, 'categories'), orderBy('name'))),
            getDocs(query(collection(db, 'tags'), orderBy('name'))),
            getDocs(query(collection(db, 'items'), orderBy('name')))
        ]);

        // Process snapshots into caches
        effectTypesCache = effectTypesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        allCategories = categoriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        allTags = tagsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        allItems = itemsSnapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() })); // Use docId for item documents

        console.log("[Data Loader] Collections loaded: Items(", allItems.length, "), Categories(", allCategories.length, "), Tags(", allTags.length, "), EffectTypes(", effectTypesCache.length, ")");

        // Build the slot tag map after tags are loaded
        buildEquipmentSlotTagMap();

        console.log("[Data Loader] All data loading and initial processing complete.");
    } catch (error) {
        console.error("[Data Loader] Critical error during data loading:", error);
        // Reset caches to prevent usage of partial or corrupt data
        allItems = [];
        allCategories = [];
        allTags = [];
        effectTypesCache = [];
        characterBasesCache = {};
        EQUIPMENT_SLOT_TAG_IDS = {};
        throw error; // Re-throw the error so the calling script (script-main.js) can handle UI feedback
    }
}

// Export getter functions for other modules to access the cached data
export const getAllItems = () => allItems;
export const getAllCategories = () => allCategories;
export const getAllTags = () => allTags;
export const getEffectTypesCache = () => effectTypesCache;
export const getCharacterBasesCache = () => characterBasesCache;
// EQUIPMENT_SLOT_TAG_IDS is already exported as a let variable
