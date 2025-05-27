// js/modules/data-loader.js
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

let allItems = [];
let allCategories = [];
let allTags = [];
let effectTypesCache = [];
let effectUnitsCache = [];
let characterBasesCache = {};
let itemSourcesCache = []; // <<< 追加: 入手経路データ用キャッシュ

const characterBaseTypes = ["headShape", "correction", "color", "pattern"];
export let EQUIPMENT_SLOT_TAG_IDS = {};
export const SIMULATOR_PARENT_CATEGORY_NAME = "装備";
export const SIMULATOR_EFFECT_CHILD_CATEGORY_NAME = "効果";


async function loadCharacterBasesFromFirestore(db) {
    console.log("[data-loader] Character Bases: Loading from Firestore...");
    characterBasesCache = {};
    try {
        for (const baseType of characterBaseTypes) {
            const optionsCollectionRef = collection(db, `character_bases/${baseType}/options`);
            const q_opts = query(optionsCollectionRef, orderBy("name"));
            const snapshot = await getDocs(q_opts);
            characterBasesCache[baseType] = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
        }
        console.log("[data-loader] Character Bases: Loaded successfully.");
    } catch (error) {
        console.error("[data-loader] Character Bases: Error loading from Firestore:", error);
        characterBasesCache = {};
    }
}

function buildEquipmentSlotTagMap() {
    console.log("[data-loader] Building equipment slot tag map...");
    EQUIPMENT_SLOT_TAG_IDS = {};
    const equipmentSlots = ["服", "顔", "首", "腕", "背中", "足"];
    if (!allTags || allTags.length === 0) {
        console.error("[data-loader] Tags data is not loaded or empty. Cannot build equipment slot tag map.");
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
            console.warn(`[data-loader] Slot tag "${slotName}" not found in Firestore tags collection during explicit check.`);
        }
    });
    console.log("[data-loader] Dynamically built EQUIPMENT_SLOT_TAG_IDS:", EQUIPMENT_SLOT_TAG_IDS);
}

// <<< 追加: 入手経路データをロードする関数 >>>
async function loadItemSourcesFromFirestore(db) {
    console.log("[data-loader] ItemSources: Loading from Firestore...");
    try {
        // ユーザー側では表示のみなので、Firestoreのインデックスに依存しないシンプルなクエリでも可
        // もしくは管理側と同様のクエリを使用する
        const q = query(collection(db, 'item_sources'), orderBy('depth'), orderBy('name'));
        const snapshot = await getDocs(q);
        itemSourcesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`[data-loader] Loaded ${itemSourcesCache.length} item sources.`);
    } catch (error) {
        console.error("[data-loader] ItemSources: Error loading from Firestore:", error);
        itemSourcesCache = []; // エラー時は空にする
    }
}


export async function loadData(db) {
    console.log("[data-loader] Initiating data load sequence...");
    try {
        await loadCharacterBasesFromFirestore(db);

        console.log("[data-loader] Loading core game data (effects, categories, tags, items, units, sources)...");
        const [
            effectTypesSnapshot, 
            categoriesSnapshot, 
            tagsSnapshot, 
            itemsSnapshot, 
            effectUnitsSnapshot,
            itemSourcesSnapshot // <<< 追加
        ] = await Promise.all([
            getDocs(query(collection(db, 'effect_types'), orderBy('name'))),
            getDocs(query(collection(db, 'categories'), orderBy('name'))),
            getDocs(query(collection(db, 'tags'), orderBy('name'))),
            getDocs(query(collection(db, 'items'), orderBy('name'))),
            getDocs(query(collection(db, 'effect_units'), orderBy('name'))),
            loadItemSourcesFromFirestore(db) // <<< 変更: 直接Promiseを解決させるか、中でキャッシュにセット
        ]);

        effectTypesCache = effectTypesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`[data-loader] Loaded ${effectTypesCache.length} effect types.`);

        allCategories = categoriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`[data-loader] Loaded ${allCategories.length} categories.`);

        allTags = tagsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`[data-loader] Loaded ${allTags.length} tags.`);
        
        buildEquipmentSlotTagMap();

        allItems = itemsSnapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
        console.log(`[data-loader] Loaded ${allItems.length} items.`);

        effectUnitsCache = effectUnitsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`[data-loader] Loaded ${effectUnitsCache.length} effect units.`);
        
        // loadItemSourcesFromFirestore は内部で itemSourcesCache を設定するので、ここでは不要
        // itemSourcesCache = itemSourcesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // console.log(`[data-loader] Loaded ${itemSourcesCache.length} item sources.`);


        console.log("[data-loader] All data loading complete.");
    } catch (error) {
        console.error("[data-loader] Critical error during data loading sequence:", error);
        allItems = [];
        allCategories = [];
        allTags = [];
        effectTypesCache = [];
        effectUnitsCache = [];
        characterBasesCache = {};
        itemSourcesCache = []; // <<< 追加
        EQUIPMENT_SLOT_TAG_IDS = {};
        throw error;
    }
}

export const getAllItems = () => allItems;
export const getAllCategories = () => allCategories;
export const getAllTags = () => allTags;
export const getEffectTypesCache = () => effectTypesCache;
export const getEffectUnitsCache = () => effectUnitsCache;
export const getCharacterBasesCache = () => characterBasesCache;
export const getItemSourcesCache = () => itemSourcesCache; // <<< 追加: ゲッター
