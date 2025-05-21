// js/modules/search-render.js
// Handles rendering the item list and pagination.

import { openItemDetailModal } from './ui-main.js';
// data-loaderから getEffectUnitsCache をインポート
import { getEffectUnitsCache as getEffectUnitsCacheFromLoader } from './data-loader.js';


let getAllItemsFunc = () => [];
let getEffectTypesCacheFunc = () => [];
let getAllTagsFunc = () => [];
let getEffectUnitsCacheFunc = () => []; // ローカルのキャッシュ関数ポインタ

// State/Config passed from search-filters or main
let isSelectingForSimulatorState = false;
let temporarilySelectedItemState = null;
// currentSelectingSlotState is not directly used here for rendering logic based on current code,
// but kept if needed for future highlighting based on slot type.

const DOMR = {
    itemList: null,
    itemCountDisplay: null,
    paginationControls: null,
};

export function initSearchRender(dependencies) {
    getAllItemsFunc = dependencies.getAllItems;
    getEffectTypesCacheFunc = dependencies.getEffectTypesCache;
    getAllTagsFunc = dependencies.getAllTags;
    getEffectUnitsCacheFunc = getEffectUnitsCacheFromLoader; // data-loaderから取得

    DOMR.itemList = document.getElementById('itemList');
    DOMR.itemCountDisplay = document.getElementById('itemCount');
    DOMR.paginationControls = document.getElementById('paginationControls');

    if (DOMR.itemList) {
        DOMR.itemList.addEventListener('click', (event) => {
            const card = event.target.closest('.item-card-compact');
            if (card && card.dataset.itemId) {
                const itemId = card.dataset.itemId;
                const item = getAllItemsFunc().find(i => i.docId === itemId);
                if (!item) return;

                if (isSelectingForSimulatorState) {
                    if (dependencies.onItemTempSelect) {
                        dependencies.onItemTempSelect(itemId);
                    }
                    const allCards = DOMR.itemList.querySelectorAll('.item-card-compact');
                    allCards.forEach(c => c.classList.remove('selected-for-simulator'));
                    card.classList.add('selected-for-simulator');
                } else {
                    // openItemDetailModal に effectUnitsCache を渡す
                    openItemDetailModal(item, getEffectTypesCacheFunc(), getAllTagsFunc(), getEffectUnitsCacheFunc());
                }
            }
        });
    }
}

export function updateRenderConfig(config) {
    if (config.isSelectingForSimulator !== undefined) {
        isSelectingForSimulatorState = config.isSelectingForSimulator;
    }
    if (config.temporarilySelectedItem !== undefined) {
        temporarilySelectedItemState = config.temporarilySelectedItem;
    }
    // currentSelectingSlotState update if needed
}


export function renderItems(itemsToRenderOnPage, totalFilteredCount, currentPage, itemsPerPage) {
    if (!DOMR.itemList || !DOMR.itemCountDisplay) return;

    DOMR.itemList.innerHTML = '';

    const countText = isSelectingForSimulatorState ?
        `該当部位のアイテム: ${totalFilteredCount} 件` :
        `${totalFilteredCount} 件のアイテムが見つかりました。`;
    DOMR.itemCountDisplay.textContent = countText;

    if (itemsToRenderOnPage.length === 0) {
        DOMR.itemList.innerHTML = totalFilteredCount > 0 ?
            '<p>このページに表示するアイテムはありません。</p>' :
            '<p>該当するアイテムは見つかりませんでした。</p>';
        renderPaginationControls(totalFilteredCount, currentPage, itemsPerPage);
        return;
    }

    const effectTypesCache = getEffectTypesCacheFunc();
    const effectUnitsCache = getEffectUnitsCacheFunc(); // ★★★ 追加 ★★★

    itemsToRenderOnPage.forEach(item => {
        const itemCardCompact = document.createElement('div');
        itemCardCompact.classList.add('item-card-compact');
        itemCardCompact.dataset.itemId = item.docId;

        if (isSelectingForSimulatorState) {
            itemCardCompact.classList.add('selectable');
            if (temporarilySelectedItemState === item.docId) {
                itemCardCompact.classList.add('selected-for-simulator');
            }
        }

        const imageContainer = document.createElement('div');
        imageContainer.classList.add('item-image-container');
        let imageElement;
        if (item.image && item.image.trim() !== "") {
            imageElement = document.createElement('img');
            imageElement.src = item.image;
            imageElement.alt = item.name || 'アイテム画像';
            imageElement.onerror = function() {
                this.onerror = null;
                this.src = './images/placeholder_item.png'; // Ensure this path is correct relative to index.html
                this.alt = '画像読込エラー';
            };
        } else {
            imageElement = document.createElement('div');
            imageElement.classList.add('item-image-text-placeholder');
            imageElement.textContent = 'NoImg';
        }
        imageContainer.appendChild(imageElement);
        itemCardCompact.appendChild(imageContainer);

        const infoCompact = document.createElement('div');
        infoCompact.classList.add('item-info-compact');

        const nameCompact = document.createElement('div');
        nameCompact.classList.add('item-name-compact');
        nameCompact.textContent = item.name || '名称未設定';
        infoCompact.appendChild(nameCompact);

        const effectsSummary = document.createElement('div');
        effectsSummary.classList.add('item-effects-summary-compact');
        if (item.structured_effects && item.structured_effects.length > 0) {
            effectsSummary.textContent = item.structured_effects.map(eff => {
                const effectType = effectTypesCache.find(et => et.id === eff.type);
                const typeName = effectType ? effectType.name : `不明`;
                
                let effectTextPart;
                const unitName = eff.unit;
                if (unitName && unitName !== 'none' && effectUnitsCache) { // ★★★ effectUnitsCache を確認 ★★★
                    const unitData = effectUnitsCache.find(u => u.name === unitName);
                    const position = unitData ? unitData.position : 'suffix';
                    if (position === 'prefix') {
                        effectTextPart = `${unitName}${eff.value}`;
                    } else {
                        effectTextPart = `${eff.value}${unitName}`;
                    }
                } else {
                    effectTextPart = `${eff.value}`;
                }
                return `${typeName}: ${effectTextPart}`;
            }).slice(0, 2).join('; ') + (item.structured_effects.length > 2 ? '...' : '');
        } else {
            effectsSummary.textContent = '効果なし'; // Changed from "Coming Soon"
        }
        infoCompact.appendChild(effectsSummary);
        itemCardCompact.appendChild(infoCompact);

        DOMR.itemList.appendChild(itemCardCompact);
    });

    renderPaginationControls(totalFilteredCount, currentPage, itemsPerPage);
}

function renderPaginationControls(totalFilteredCount, currentPage, itemsPerPage) {
    if (!DOMR.paginationControls) return;
    DOMR.paginationControls.innerHTML = '';
    const totalPages = Math.ceil(totalFilteredCount / itemsPerPage);

    if (totalPages <= 1) return;

    const createButton = (text, page, isDisabled) => {
        const button = document.createElement('button');
        button.classList.add('pagination-button');
        button.textContent = text;
        button.disabled = isDisabled;
        button.dataset.page = page;
        return button;
    };

    const prevButton = createButton('前へ', currentPage - 1, currentPage === 1);
    DOMR.paginationControls.appendChild(prevButton);

    const pageInfo = document.createElement('span');
    pageInfo.classList.add('page-info');
    pageInfo.textContent = `${currentPage} / ${totalPages} ページ`;
    DOMR.paginationControls.appendChild(pageInfo);

    const nextButton = createButton('次へ', currentPage + 1, currentPage === totalPages);
    DOMR.paginationControls.appendChild(nextButton);

    DOMR.paginationControls.querySelectorAll('.pagination-button').forEach(button => {
        button.addEventListener('click', (e) => {
            if (e.currentTarget.disabled) return;
            const newPage = parseInt(e.currentTarget.dataset.page);
            const event = new CustomEvent('pageChange', { detail: { newPage } });
            document.dispatchEvent(event);
        });
    });
}
