// admin-store.js
// アプリケーション全体で共有されるキャッシュデータを管理します。

// 各キャッシュをエクスポートして、他のモジュールから直接参照・更新できるようにします。
// より厳密な状態管理（例: Reduxのようなパターン）も可能ですが、
// まずはシンプルなエクスポートで実現します。

export let allCategoriesCache = [];
export let allTagsCache = [];
export let itemsCache = [];
export let effectTypesCache = [];
export let effectUnitsCache = [];
export let characterBasesCache = {}; // { headShape: [], correction: [], ... }

// 必要に応じて、キャッシュを更新するためのセッター関数をここに定義することもできます。
// 例:
// export function setAllCategoriesCache(data) {
//     allCategoriesCache = data;
// }
// export function setItemsCache(data) {
//     itemsCache = data;
// }
// ...など、各キャッシュに対応するセッター

// キャッシュをクリアする関数
export function clearAllCaches() {
    allCategoriesCache = [];
    allTagsCache = [];
    itemsCache = [];
    effectTypesCache = [];
    effectUnitsCache = [];
    characterBasesCache = {};
    console.log("All store caches cleared.");
}
