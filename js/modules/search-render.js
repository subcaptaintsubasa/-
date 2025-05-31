// js/modules/search-render.js
// Handles rendering the item list and pagination.

import { openItemDetailModal } from './ui-main.js';
import { getEffectUnitsCache as getEffectUnitsCacheFromLoader, getItemSourcesCache as getItemSourcesCacheFromLoader } from './data-loader.js';


let getAllItemsFunc = () => [];
let getEffectTypesCacheFunc = () => [];
let getAllTagsFunc = () => [];
let getEffectUnitsCacheFunc = () => []; // For this module, get it from loader

let isSelectingForSimulatorState = false;
let temporarilySelectedItemState = null;

const DOMR = {
    itemList: null,
    itemCountDisplay: null,
    paginationControls: null,
};

export function initSearchRender(dependencies) {
    getAllItemsFunc = dependencies.getAllItems;
    getEffectTypesCacheFunc = dependencies.getEffectTypesCache;
    getAllTagsFunc = dependencies.getAllTags;
    getEffectUnitsCacheFunc = getEffectUnitsCacheFromLoader; // Use the one from data-loader

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
                    // Pass all necessary caches to openItemDetailModal
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
    const effectUnitsCache = getEffectUnitsCacheFunc(); // Use the module-scoped one

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
                this.src = './images/placeholder_item.png'; // Fallback image
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
        
        let summaryText = '効果なし';
        if (item.effects && item.effects.length > 0) {
            summaryText = item.effects.slice(0, 2).map(eff => { // Display first 2 effects
                if (eff.type === "manual") {
                    return eff.manualString ? eff.manualString.split('\n')[0] : '(手動効果)'; // Show first line
                } else if (eff.type === "structured") {
                    const effectType = effectTypesCache.find(et => et.id === eff.effectTypeId);
                    const typeName = effectType ? effectType.name : `不明`;
                    let effectTextPart = eff.value !== undefined ? eff.value.toString() : '';
                    if (eff.unit && eff.unit !== 'none' && effectUnitsCache) {
                        const unitData = effectUnitsCache.find(u => u.name === eff.unit);
                        const position = unitData ? unitData.position : 'suffix';
                        if (position === 'prefix') {
                            effectTextPart = `${eff.unit}${eff.value}`;
                        } else {
                            effectTextPart = `${eff.value}${eff.unit}`;
                        }
                    }
                    return `${typeName} ${effectTextPart}`;
                }
                return '';
            }).filter(s => s).join('; ');
            if (item.effects.length > 2) {
                summaryText += '...';
            }
        } else if (item.effectsInputMode === 'manual' && typeof item.manualEffectsString === 'string') { // Fallback to old format
            summaryText = item.manualEffectsString.split('\n')[0]; // Show first line
            if (item.manualEffectsString.includes('\n')) summaryText += '...';
        } else if (item.structured_effects && item.structured_effects.length > 0) { // Fallback to older format
             summaryText = item.structured_effects.slice(0, 2).map(eff => {
                const effectType = effectTypesCache.find(et => et.id === eff.type); // Old format used 'type'
                const typeName = effectType ? effectType.name : `不明`;
                let effectTextPart = eff.value !== undefined ? eff.value.toString() : '';
                if (eff.unit && eff.unit !== 'none' && effectUnitsCache) {
                    const unitData = effectUnitsCache.find(u => u.name === eff.unit);
                    const position = unitData ? unitData.position : 'suffix';
                    if (position === 'prefix') effectTextPart = `${eff.unit}${eff.value}`;
                    else effectTextPart = `${eff.value}${eff.unit}`;
                }
                return `${typeName} ${effectTextPart}`;
            }).filter(s => s).join('; ');
            if (item.structured_effects.length > 2) summaryText += '...';
        }
        effectsSummary.textContent = summaryText || '効果なし';


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
        // Ensure only one listener is attached or clone buttons if re-rendering often
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        newButton.addEventListener('click', (e) => {
            if (e.currentTarget.disabled) return;
            const newPage = parseInt(e.currentTarget.dataset.page);
            const event = new CustomEvent('pageChange', { detail: { newPage } });
            document.dispatchEvent(event);
        });
    });
}
