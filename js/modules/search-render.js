// js/modules/search-render.js
// Handles rendering the item list and pagination.

import { openItemDetailModal } from './ui-main.js'; // For item detail view
// Dependencies from data-loader will be passed or accessed via getters
let getAllItemsFunc = () => [];
let getEffectTypesCacheFunc = () => [];
let getAllTagsFunc = () => [];

// State/Config passed from search-filters or main
let isSelectingForSimulatorState = false;
let temporarilySelectedItemState = null;
let currentSelectingSlotState = null; // Used for highlighting, if needed directly here

const DOMR = { // DOM elements relevant to rendering
    itemList: null,
    itemCountDisplay: null,
    paginationControls: null,
};

export function initSearchRender(dependencies) {
    getAllItemsFunc = dependencies.getAllItems;
    getEffectTypesCacheFunc = dependencies.getEffectTypesCache;
    getAllTagsFunc = dependencies.getAllTags;

    DOMR.itemList = document.getElementById('itemList');
    DOMR.itemCountDisplay = document.getElementById('itemCount');
    DOMR.paginationControls = document.getElementById('paginationControls');

    // Event delegation for item card clicks if preferred, or direct binding in renderItems
    if (DOMR.itemList) {
        DOMR.itemList.addEventListener('click', (event) => {
            const card = event.target.closest('.item-card-compact');
            if (card && card.dataset.itemId) {
                const itemId = card.dataset.itemId;
                const item = getAllItemsFunc().find(i => i.docId === itemId);
                if (!item) return;

                if (isSelectingForSimulatorState) {
                    // Notify search-filters or main script about temporary selection
                    if (dependencies.onItemTempSelect) {
                        dependencies.onItemTempSelect(itemId);
                    }
                    // Visually update the selected card (could also be handled by renderItems based on state)
                    const allCards = DOMR.itemList.querySelectorAll('.item-card-compact');
                    allCards.forEach(c => c.classList.remove('selected-for-simulator'));
                    card.classList.add('selected-for-simulator');
                } else {
                    openItemDetailModal(item, getEffectTypesCacheFunc(), getAllTagsFunc());
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
    if (config.currentSelectingSlot !== undefined) {
        currentSelectingSlotState = config.currentSelectingSlot;
    }
}


export function renderItems(itemsToRenderOnPage, totalFilteredCount, currentPage, itemsPerPage) {
    if (!DOMR.itemList || !DOMR.itemCountDisplay) return;

    DOMR.itemList.innerHTML = ''; // Clear previous items

    const countText = isSelectingForSimulatorState ?
        `該当部位のアイテム: ${totalFilteredCount} 件` :
        `${totalFilteredCount} 件のアイテムが見つかりました。`;
    DOMR.itemCountDisplay.textContent = countText;

    if (itemsToRenderOnPage.length === 0) {
        DOMR.itemList.innerHTML = totalFilteredCount > 0 ?
            '<p>このページに表示するアイテムはありません。</p>' :
            '<p>該当するアイテムは見つかりませんでした。</p>';
        renderPaginationControls(totalFilteredCount, currentPage, itemsPerPage); // Still render pagination if other pages exist
        return;
    }

    const effectTypesCache = getEffectTypesCacheFunc();

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
                this.src = './images/placeholder_item.png';
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
                const unitText = (eff.unit && eff.unit !== 'none') ? eff.unit : '';
                return `${typeName}: ${eff.value}${unitText}`;
            }).slice(0, 2).join('; ') + (item.structured_effects.length > 2 ? '...' : '');
        } else {
            effectsSummary.textContent = '効果: Coming Soon';
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

    // Add event listener for pagination buttons
    DOMR.paginationControls.querySelectorAll('.pagination-button').forEach(button => {
        button.addEventListener('click', (e) => {
            if (e.currentTarget.disabled) return;
            const newPage = parseInt(e.currentTarget.dataset.page);
            // Notify search-filters or main script to change page and re-filter/render
            const event = new CustomEvent('pageChange', { detail: { newPage } });
            document.dispatchEvent(event); // Or call a passed callback
        });
    });
}
