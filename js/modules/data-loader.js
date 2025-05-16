// js/modules/data-loader.js
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

let allItems = [];
let allCategories = [];
let allTags = [];
let effectTypesCache = [];
let characterBasesCache = {};

const characterBaseTypes = ["headShape", "correction", "color", "pattern"];
export let EQUIPMENT_SLOT_TAG_IDS = {};
export const SIMULATOR_PARENT_CATEGORY_NAME = "装備";
export const SIMULATOR_EFFECT_CHILD_CATEGORY_NAME = "効果";


async function loadCharacterBasesFromFirestore(db) {
    console.log("[Character Bases] Loading from Firestore...");
    characterBasesCache = {};
    try {
        for (const baseType of characterBaseTypes) {
            const optionsCollectionRef = collection(db, `character_bases/${baseType}/options`);
            const q_opts = query(optionsCollectionRef, orderBy("name"));
            const snapshot = await getDocs(q_opts);
            characterBasesCache[baseType] = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
        }
        console.log("[Character Bases] Loaded from Firestore:", characterBasesCache);
    } catch (error) {
        console.error("[Character Bases] Error loading from Firestore:", error);
        characterBasesCache = {}; // Reset on error
    }
}

function buildEquipmentSlotTagMap() {
    EQUIPMENT_SLOT_TAG_IDS = {};
    const equipmentSlots = ["服", "顔", "首", "腕", "背中", "足"]; // This could be configurable
    if (!allTags || allTags.length === 0) {
        console.error("Tags data is not loaded or empty. Cannot build equipment slot tag map.");
        equipmentSlots.forEach(slotName => EQUIPMENT_SLOT_TAG_IDS[slotName] = null);
        return;
    }
    equipmentSlots.forEach(slotName => {
        const foundTag = allTags.find(tag => tag.name === slotName);
        EQUIPMENT_SLOT_TAG_IDS[slotName] = foundTag ? foundTag.id : null;
        if (!foundTag) {
            console.warn(`部位タグ「${slotName}」がFirestoreのtagsコレクションに見つかりません。`);
        }
    });
    console.log("Dynamically built EQUIPMENT_SLOT_TAG_IDS:", EQUIPMENT_SLOT_TAG_IDS);
}


export async function loadData(db) {
    console.log("Loading data from data-loader.js...");
    try {
        await loadCharacterBasesFromFirestore(db);

        const [effectTypesSnapshot, categoriesSnapshot, tagsSnapshot, itemsSnapshot] = await Promise.all([
            getDocs(query(collection(db, 'effect_types'), orderBy('name'))),
            getDocs(query(collection(db, 'categories'), orderBy('name'))),
            getDocs(query(collection(db, 'tags'), orderBy('name'))),
            getDocs(query(collection(db, 'items'), orderBy('name')))
        ]);

        effectTypesCache = effectTypesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        allCategories = categoriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        allTags = tagsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        allItems = itemsSnapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));

        buildEquipmentSlotTagMap(); // Depends on allTags

        console.log("Data loading complete from data-loader.js.");
        // Data is now stored in the module-level variables
    } catch (error) {
        console.error("Error loading data in data-loader:", error);
        // Reset caches on error to prevent partial data usage
        effectTypesCache = [];
        allCategories = [];
        allTags = [];
        allItems = [];
        characterBasesCache = {};
        throw error; // Re-throw for the main script to handle UI update
    }
}

// Export getters for the cached data
export const getAllItems = () => allItems;
export const getAllCategories = () => allCategories;
export const getAllTags = () => allTags;
export const getEffectTypesCache = () => effectTypesCache;
export const getCharacterBasesCache = () => characterBasesCache;
// EQUIPMENT_SLOT_TAG_IDS is already exported
