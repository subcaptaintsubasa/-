// admin-store.js
// アプリケーション全体で共有されるキャッシュデータを管理します。

export let allCategoriesCache = [];
export let allTagsCache = [];
export let itemsCache = [];
export let effectTypesCache = [];
export let effectUnitsCache = [];
export let characterBasesCache = {}; // e.g., { headShape: [ {id, name, effects}, ... ], color: [...] }

// キャッシュ更新用のセッター関数 (必要に応じて)
export function setAllCategoriesCache(data) { allCategoriesCache = data; }
export function setAllTagsCache(data) { allTagsCache = data; }
export function setItemsCache(data) { itemsCache = data; }
export function setEffectTypesCache(data) { effectTypesCache = data; }
export function setEffectUnitsCache(data) { effectUnitsCache = data; }
export function setCharacterBasesCache(data) { characterBasesCache = data; }


export function clearAllCaches() {
    allCategoriesCache = [];
    allTagsCache = [];
    itemsCache = [];
    effectTypesCache = [];
    effectUnitsCache = [];
    characterBasesCache = {};
    console.log("All store caches cleared.");
}
