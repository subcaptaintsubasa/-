// js/script-main.js
import { db } from '../firebase-config.js';
import {
    loadData,
    isInitialDataLoaded, 
    getAllItems, 
    getAllCategories, 
    getAllTags, 
    getEffectTypesCache, 
    getCharacterBasesCache,
    getItemSourcesCache, 
    EQUIPMENT_SLOT_TAG_IDS, 
    SIMULATOR_PARENT_CATEGORY_NAME, 
    SIMULATOR_EFFECT_CHILD_CATEGORY_NAME
} from './modules/data-loader.js';
import {
    initUIMain,
    displaySearchToolMessage, 
    showConfirmSelectionButton,
    openItemDetailModal, 
    closeAllModals 
} from './modules/ui-main.js';
import {
    initSearchFilters, 
    applyFiltersAndRender,
    activateSimulatorSelectionMode, 
    deactivateSimulatorSelectionMode, 
    cancelItemSelection,
    setTemporarilySelectedItemExport,
    isSelectingForSimulatorState as getIsSelectingForSimulator,
    getCurrentSelectingSlotState as getCurrentSelectingSlot,
    renderParentCategoryFilters, // ★★★ インポート ★★★
    renderChildCategoriesAndTags // ★★★ インポート ★★★
} from './modules/search-filters.js';
import {
    initSearchRender 
} from './modules/search-render.js';
import {
    initSimulatorUI, 
    updateSimulatorSlotDisplay, 
    calculateAndDisplayTotalEffects, 
    initializeSimulatorDisplay,
    getSelectedEquipment, 
    getSelectedCharacterBase, 
    setSelectedCharacterBaseValue, 
    updateSelectedEquipment,
    getSimulatorDOMS 
} from './modules/simulator-ui.js';
import { initSimulatorLogic } from './modules/simulator-logic.js';
import { initSimulatorImage } from './modules/simulator-image.js';

// ===== Service Worker 登録処理 スタート =====
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => { 
        // URL: https://subcaptaintsubasa.github.io/-/
        // sw.js はリポジトリルート (この場合は '-') に配置される想定
        // register() に渡すパスは、HTMLファイル (index.html) から見た sw.js の相対パス、
        // またはサイトルートからの絶対パス。
        // index.html が /-/index.html で、sw.js が /-/sw.js の場合、
        // 相対パスなら 'sw.js'、ドメインルートからの絶対パスなら '/-/sw.js'
        // scope は '/-/' と明示的に指定するのが最も確実。
        navigator.serviceWorker.register('/-/sw.js', { scope: '/-/' }) 
            .then(registration => {
                console.log('[Main] Service Worker registered successfully with scope:', registration.scope);
            })
            .catch(error => {
                console.error('[Main] Service Worker registration failed:', error);
            });
    });
}
// ===== Service Worker 登録処理 エンド =====


document.addEventListener('DOMContentLoaded', async () => {
    console.log("[script-main] DOMContentLoaded, starting app init...");

    // ★★★ グローバルな状態管理オブジェクトを初期化 ★★★
    window.appState = {
        isDataStale: false
    };

    const simulatorModal = document.getElementById('simulatorModal'); 

    initUIMain(
        getIsSelectingForSimulator, 
        cancelItemSelection,        
        initializeSimulatorDisplay  
    );

    try {
        console.log("[script-main] Calling loadData to populate/sync IndexedDB and load to memory...");
        await loadData(db); 
        console.log("[script-main] loadData call completed. Initial data (from IDB) should be in memory if available.");

        if (isInitialDataLoaded()) {
            console.log("[script-main] Initial data loaded into memory. Initializing data-dependent modules.");

            initSearchRender({
                getAllItems: getAllItems,
                getEffectTypesCache: getEffectTypesCache,
                getAllTags: getAllTags,
                onItemTempSelect: (itemId) => { 
                    setTemporarilySelectedItemExport(itemId);
                }
            });

            initSearchFilters(db, { 
                getAllItems: getAllItems,
                getAllCategories: getAllCategories,
                getAllTags: getAllTags,
                getEffectTypesCache: getEffectTypesCache,
                getSlotTagId: (slotName) => EQUIPMENT_SLOT_TAG_IDS[slotName],
                simulatorParentCategoryName: SIMULATOR_PARENT_CATEGORY_NAME,
                simulatorEffectChildCategoryName: SIMULATOR_EFFECT_CHILD_CATEGORY_NAME,
                onFilterChange: applyFiltersAndRender, 
                onSelectionConfirmed: (slotName, selectedItemId) => {
                    console.log(`[script-main] Simulator selection confirmed for slot '${slotName}', item ID: '${selectedItemId}'`);
                    updateSelectedEquipment(slotName, selectedItemId); 
                    deactivateSimulatorSelectionMode(); 
                    if (simulatorModal) simulatorModal.style.display = 'flex'; 
                    updateSimulatorSlotDisplay(slotName); 
                    calculateAndDisplayTotalEffects(); 
                },
                displaySearchToolMessage: displaySearchToolMessage, 
                showConfirmSelectionButton: showConfirmSelectionButton, 
            });

            initSimulatorUI(db, { 
                getAllItems: getAllItems,
                getEffectTypesCache: getEffectTypesCache,
                getCharacterBasesCache: getCharacterBasesCache,
                onSlotSelectStart: (slotName) => {
                    console.log(`[script-main] Starting item selection for slot: ${slotName}`);
                    if (simulatorModal) simulatorModal.style.display = 'none'; 
                    const slotTagId = EQUIPMENT_SLOT_TAG_IDS[slotName];
                    if (slotTagId === undefined || slotTagId === null) {
                        alert(`部位「${slotName}」に対応するタグIDが設定されていません。管理画面で設定を確認してください。`);
                        if (simulatorModal) simulatorModal.style.display = 'flex'; 
                        return;
                    }
                    activateSimulatorSelectionMode(slotName, slotTagId, getSelectedEquipment()[slotName] || null);
                },
                onSlotClear: (slotName) => {
                    console.log(`[script-main] Clearing slot: ${slotName}`);
                    updateSelectedEquipment(slotName, null);
                    updateSimulatorSlotDisplay(slotName);
                    calculateAndDisplayTotalEffects();
                },
                getCharacterBaseOptionData: (baseType, optionId) => { 
                    const bases = getCharacterBasesCache();
                    return bases[baseType] ? (bases[baseType].find(opt => opt.id === optionId) || null) : null;
                }
            });

            initSimulatorLogic({
                getSelectedCharacterBase: getSelectedCharacterBase,
                setSelectedCharacterBaseValue: setSelectedCharacterBaseValue,
                calculateAndDisplayTotalEffects: calculateAndDisplayTotalEffects,
                getCharacterBasesCache: getCharacterBasesCache,
            });

            initSimulatorImage({
                getSelectedCharacterBase: getSelectedCharacterBase,
                getCharacterBasesCache: getCharacterBasesCache, 
                getSelectedEquipment: getSelectedEquipment,
                getAllItems: getAllItems, 
                getTotalEffectsDisplayHTML: () => {
                    const displayElement = document.getElementById('totalEffectsDisplay');
                    return displayElement ? displayElement.innerHTML : "<p>効果なし</p>";
                },
                getSimulatorDOMS: getSimulatorDOMS 
            });

            // ★★★ データ更新イベントリスナーを追加 ★★★
            document.addEventListener('dataRefreshed', () => {
                showUpdateNotification('データが更新されました。');
            });


            console.log("[script-main] Performing initial item list render based on default filters...");
            applyFiltersAndRender(); 
            
            console.log("[script-main] Performing initial simulator display setup...");
            initializeSimulatorDisplay(); 

        } else {
            console.error("[script-main] Critical: Initial data could not be loaded into memory cache even after loadData call. App cannot function correctly.");
            const itemListEl = document.getElementById('itemList');
            if (itemListEl) {
                itemListEl.innerHTML = `<p style="color: red; text-align: center; padding: 20px;">データ準備エラー: アプリケーションのデータが読み込めませんでした。時間をおいてページを再読み込みするか、管理者にお問い合わせください。</p>`;
            }
        }
        console.log("[script-main] Application initialization sequence complete.");

    } catch (error) {
        console.error("[script-main] CRITICAL ERROR during app initialization:", error);
        const containerEl = document.querySelector('.container');
        if(containerEl) {
            containerEl.innerHTML = `<div style="padding: 20px; text-align: center;">
                                        <h2 style="color: red;">アプリケーションエラー</h2>
                                        <p>申し訳ありませんが、アプリケーションの起動中に問題が発生しました。</p>
                                        <p>時間をおいてページを再読み込みしてみてください。</p>
                                        <p><small>詳細: ${error.message}</small></p>
                                     </div>`;
        }
        closeAllModals(); 
    }
});


// ★★★ ユーザーへの更新通知用の関数（新規追加） ★★★
function showUpdateNotification(message) {
    const existingNotification = document.querySelector('.update-notification');
    if (existingNotification) return; // 既に表示中の場合は何もしない

    const notification = document.createElement('div');
    notification.className = 'update-notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background-color: #28a745;
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        z-index: 10002;
        opacity: 0;
        transition: opacity 0.5s, transform 0.5s;
        transform: translate(-50%, 10px);
    `;
    document.body.appendChild(notification);
    
    // フェードイン・アニメーション
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(-50%)';
    }, 10);
    
    // フェードアウト・アニメーション
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translate(-50%, 10px)';
        setTimeout(() => document.body.removeChild(notification), 500);
    }, 3000);
}
