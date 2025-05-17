// js/modules/data-loader.js
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

let allItems = [];
let allCategories = [];
let allTags = [];
let effectTypesCache = [];
let characterBasesCache = {};

const characterBaseTypes = ["headShape", "correction", "color", "pattern"];
export let EQUIPMENT_SLOT_TAG_IDS = {}; // Exporting so it can be read by other modules after build
export const SIMULATOR_PARENT_CATEGORY_NAME = "装備";
export const SIMULATOR_EFFECT_CHILD_CATEGORY_NAME = "効果";


async function loadCharacterBasesFromFirestore(db) {
    console.log("[data-loader] Character Bases: Loading from Firestore...");
    characterBasesCache = {};
    try {
        for (const baseType of characterBaseTypes) {
            const optionsCollectionRef = collection(db, `character_bases/${baseType}/options`);
            const q_opts = query(optionsCollectionRef, orderBy("name")); // Assuming 'name' field exists for ordering
            const snapshot = await getDocs(q_opts);
            characterBasesCache[baseType] = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
        }
        console.log("[data-loader] Character Bases: Loaded successfully.", characterBasesCache);
    } catch (error) {
        console.error("[data-loader] Character Bases: Error loading from Firestore:", error);
        characterBasesCache = {}; // Reset on error
    }
}

function buildEquipmentSlotTagMap() { // Called after allTags are loaded
    console.log("[data-loader] Building equipment slot tag map...");
    EQUIPMENT_SLOT_TAG_IDS = {};
    const equipmentSlots = ["服", "顔", "首", "腕", "背中", "足"];
    if (!allTags || allTags.length === 0) {
        console.error("[data-loader] Tags data is not loaded or empty. Cannot build equipment slot tag map.");
        equipmentSlots.forEach(slotName => EQUIPMENT_SLOT_TAG_IDS[slotName] = null);
        return;
    }
    allTags.forEach(slotNameTag => { // Changed variable name to avoid confusion with actual slot names
        equipmentSlots.forEach(slotName => {
            if (slotNameTag.name === slotName) { // Check if the tag's name matches one of the equipment slot names
                EQUIPMENT_SLOT_TAG_IDS[slotName] = slotNameTag.id;
            }
        });
    });
    // Ensure all slots have an entry, even if null
    equipmentSlots.forEach(slotName => {
        if (!EQUIPMENT_SLOT_TAG_IDS.hasOwnProperty(slotName)) {
            EQUIPMENT_SLOT_TAG_IDS[slotName] = null;
            console.warn(`[data-loader] Slot tag "${slotName}" not found in Firestore tags collection during explicit check.`);
        }
    });
    console.log("[data-loader] Dynamically built EQUIPMENT_SLOT_TAG_IDS:", EQUIPMENT_SLOT_TAG_IDS);
}


export async function loadData(db) {
    console.log("[data-loader] Initiating data load sequence...");
    try {
        await loadCharacterBasesFromFirestore(db);

        console.log("[data-loader] Loading core game data (effects, categories, tags, items)...");
        const [effectTypesSnapshot, categoriesSnapshot, tagsSnapshot, itemsSnapshot] = await Promise.all([
            getDocs(query(collection(db, 'effect_types'), orderBy('name'))),
            getDocs(query(collection(db, 'categories'), orderBy('name'))),
            getDocs(query(collection(db, 'tags'), orderBy('name'))),
            getDocs(query(collection(db, 'items'), orderBy('name')))
        ]);

        effectTypesCache = effectTypesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`[data-loader] Loaded ${effectTypesCache.length} effect types.`);

        allCategories = categoriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`[data-loader] Loaded ${allCategories.length} categories.`);

        allTags = tagsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`[data-loader] Loaded ${allTags.length} tags.`);
        
        buildEquipmentSlotTagMap(); // Call after allTags are loaded

        allItems = itemsSnapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
        console.log(`[data-loader] Loaded ${allItems.length} items.`);


        console.log("[data-loader] All data loading complete.");
    } catch (error) {
        console.error("[data-loader] Critical error during data loading sequence:", error);
        allItems = [];
        allCategories = [];
        allTags = [];
        effectTypesCache = [];
        characterBasesCache = {};
        EQUIPMENT_SLOT_TAG_IDS = {};
        throw error;
    }
}

export const getAllItems = () => allItems;
export const getAllCategories = () => allCategories;
export const getAllTags = () => allTags;
export const getEffectTypesCache = () => effectTypesCache;
export const getCharacterBasesCache = () => characterBasesCache;
