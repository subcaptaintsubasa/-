// main/js/modules/ui-main.js.txt

// js/modules/ui-main.js
import { getEffectUnitsCache as getEffectUnitsCacheFromLoader, getItemSourcesCache as getItemSourcesCacheFromLoader } from './data-loader.js';

let getIsSelectingForSimulatorCb = () => false;
let cancelItemSelectionCb = () => {};
let initializeSimulatorDisplayCb = () => {};
let itemSourcesCacheForUI = [];

const DOM = {
    sideNav: null,
    hamburgerButton: null,
    closeNavButton: null,
    openSimulatorButtonNav: null,
    itemDetailModal: null,
    itemDetailContent: null,
    simulatorModal: null,
    imagePreviewModal: null,
    generatedImagePreview: null,
    searchToolMessageElement: null,
    confirmSelectionButtonElement: null,
};

export function initUIMain(getIsSelectingForSimulator, cancelItemSelection, initializeSimulatorDisplay) {
    console.log("[ui-main] initUIMain called");
    getIsSelectingForSimulatorCb = getIsSelectingForSimulator;
    cancelItemSelectionCb = cancelItemSelection;
    initializeSimulatorDisplayCb = initializeSimulatorDisplay;
    itemSourcesCacheForUI = getItemSourcesCacheFromLoader();

    DOM.sideNav = document.getElementById('sideNav');
    DOM.hamburgerButton = document.getElementById('hamburgerButton');
    DOM.closeNavButton = document.getElementById('closeNavButton');
    DOM.openSimulatorButtonNav = document.getElementById('openSimulatorButtonNav');

    DOM.itemDetailModal = document.getElementById('itemDetailModal');
    DOM.itemDetailContent = document.getElementById('itemDetailContent');
    DOM.simulatorModal = document.getElementById('simulatorModal');
    DOM.imagePreviewModal = document.getElementById('imagePreviewModal');
    DOM.generatedImagePreview = document.getElementById('generatedImagePreview');

    DOM.searchToolMessageElement = document.getElementById('searchToolMessage');
    DOM.confirmSelectionButtonElement = document.getElementById('confirmSelectionButton');

    if (DOM.hamburgerButton && DOM.sideNav) {
        DOM.hamburgerButton.addEventListener('click', () => {
            if (DOM.sideNav) DOM.sideNav.classList.add('open');
        });
    }

    if (DOM.closeNavButton && DOM.sideNav) {
        DOM.closeNavButton.addEventListener('click', () => {
            if (DOM.sideNav) DOM.sideNav.classList.remove('open');
        });
    }

    if (DOM.openSimulatorButtonNav && DOM.simulatorModal) {
        DOM.openSimulatorButtonNav.addEventListener('click', () => {
            if (getIsSelectingForSimulatorCb()) {
                return;
            }
            if (DOM.simulatorModal) {
                DOM.simulatorModal.style.display = 'flex';
                if(initializeSimulatorDisplayCb) initializeSimulatorDisplayCb();
            }
            if (DOM.sideNav) DOM.sideNav.classList.remove('open');
        });
    }

    const allModals = document.querySelectorAll('.modal');
    allModals.forEach(modal => {
        const closeButton = modal.querySelector('.close-button');
        if (closeButton) {
            const newCloseButton = closeButton.cloneNode(true);
            closeButton.parentNode.replaceChild(newCloseButton, closeButton);
            newCloseButton.addEventListener('click', () => handleCloseButtonClick(modal));
        }
        if (!modal.dataset.overlayListenerAttached) {
            modal.addEventListener('click', function(event) {
                if (event.target === this) {
                    handleCloseButtonClick(this);
                }
            });
            modal.dataset.overlayListenerAttached = 'true';
        }
    });

    document.addEventListener('click', (event) => {
        if (DOM.sideNav && DOM.sideNav.classList.contains('open') &&
            !DOM.sideNav.contains(event.target) &&
            event.target !== DOM.hamburgerButton &&
            !event.target.closest('.side-navigation')) {
            DOM.sideNav.classList.remove('open');
        }
    });

    console.log("[ui-main] UI Main Initialized.");
}

function getRarityStarsHTML(rarityValue, maxStars = 5) {
    let starsHtml = '<div class="rarity-display-stars" style="margin-bottom: 10px;"><strong>レア度:</strong> ';
    for (let i = 1; i <= maxStars; i++) {
        starsHtml += `<span class="star-icon ${i <= rarityValue ? 'selected' : ''}" style="font-size: 1.2em; color: ${i <= rarityValue ? '#ffc107' : '#ccc'}; margin-right: 2px;">★</span>`;
    }
    starsHtml += '</div>';
    return starsHtml;
}

function buildFullPathForItemSourceInternal(nodeId, allItemSources) {
    if (!nodeId || !allItemSources || allItemSources.length === 0) {
        return "経路情報なし";
    }

    const pathParts = [];
    let currentId = nodeId;
    let sanityCheck = 0;
    while(currentId && sanityCheck < 10) {
        const node = allItemSources.find(s => s.id === currentId);
        if (node) {
            pathParts.unshift(node.name);
            currentId = node.parentId;
        } else {
            pathParts.unshift(`[ID:${currentId.substring(0,5)}...]`);
            break;
        }
        sanityCheck++;
    }
    return pathParts.join(' > ');
}


export function openItemDetailModal(item, effectTypesCache, allTags, effectUnitsCache) {
    const currentItemDetailModal = document.getElementById('itemDetailModal');
    const currentItemDetailContent = document.getElementById('itemDetailContent');

    if (!item || !currentItemDetailContent || !currentItemDetailModal) {
        console.error("[ui-main] Item data, detail content, or modal element missing for detail view. Item:", item, "Modal:", currentItemDetailModal, "Content:", currentItemDetailContent);
        return;
    }
    console.log("[ui-main] Opening item detail modal for:", item.name, JSON.parse(JSON.stringify(item)));
    itemSourcesCacheForUI = getItemSourcesCacheFromLoader();

    currentItemDetailContent.innerHTML = '';

    const cardFull = document.createElement('div');
    cardFull.classList.add('item-card-full');

    let imageElementHTML;
    if (item.image && item.image.trim() !== "") {
        imageElementHTML = `<img src="${item.image}" alt="${item.name || 'アイテム画像'}" onerror="this.onerror=null; this.src='./images/placeholder_item.png'; this.alt='画像読み込みエラー';">`;
    } else {
        imageElementHTML = `<div class="item-image-text-placeholder">NoImage</div>`;
    }

    const rarityHtml = getRarityStarsHTML(item.rarity || 0);

    let effectsDisplayHtml = '<p><strong>効果:</strong> なし</p>';
    if (item.effects && Array.isArray(item.effects) && item.effects.length > 0) {
        effectsDisplayHtml = '<div class="structured-effects"><strong>効果:</strong><ul style="margin-top: 5px; padding-left: 20px; list-style-type: disc;">';
        item.effects.forEach(eff => {
            if (eff.type === "manual") {
                effectsDisplayHtml += `<li>${eff.manualString ? eff.manualString.replace(/\n/g, '<br>') : '(記載なし)'}</li>`;
            } else if (eff.type === "structured") {
                const effectType = effectTypesCache.find(et => et.id === eff.effectTypeId);
                const typeName = effectType ? effectType.name : `不明`;
                let effectTextPart = eff.value !== undefined ? eff.value.toString() : '';
                if (eff.unit && eff.unit !== 'none') {
                    const unitData = effectUnitsCache.find(u => u.name === eff.unit);
                    const position = unitData ? unitData.position : 'suffix';
                    if (position === 'prefix') effectTextPart = `${eff.unit}${eff.value}`;
                    else effectTextPart = `${eff.value}${eff.unit}`;
                }
                effectsDisplayHtml += `<li>${typeName} ${effectTextPart}</li>`;
            }
        });
        effectsDisplayHtml += '</ul></div>';
    } else if (item.effectsInputMode === 'manual' && typeof item.manualEffectsString === 'string' && item.manualEffectsString.trim() !== "") {
        effectsDisplayHtml = `<div class="structured-effects"><strong>効果:</strong><p style="margin-top: 5px;">${item.manualEffectsString.replace(/\n/g, '<br>')}</p></div>`;
    } else if (item.structured_effects && item.structured_effects.length > 0 ) {
        effectsDisplayHtml = '<div class="structured-effects"><strong>効果:</strong><ul style="margin-top: 5px; padding-left: 20px; list-style-type: disc;">';
        item.structured_effects.forEach(eff => {
            const effectType = effectTypesCache.find(et => et.id === eff.type);
            const typeName = effectType ? effectType.name : `不明`;
            let effectTextPart = eff.value !== undefined ? eff.value.toString() : '';
            if (eff.unit && eff.unit !== 'none') {
                const unitData = effectUnitsCache.find(u => u.name === eff.unit);
                const position = unitData ? unitData.position : 'suffix';
                if (position === 'prefix') effectTextPart = `${eff.unit}${eff.value}`;
                else effectTextPart = `${eff.value}${eff.unit}`;
            }
            effectsDisplayHtml += `<li>${typeName} ${effectTextPart} (旧形式)</li>`;
        });
        effectsDisplayHtml += '</ul></div>';
    }


    let sourcesDisplayHtml = '<p><strong>入手手段:</strong> 不明</p>';
    if (item.sources && Array.isArray(item.sources) && item.sources.length > 0) {
        if (item.sources.length === 1) {
            const src = item.sources[0];
            let text = '不明';
            if (src.type === 'manual') {
                text = src.manualString ? src.manualString.replace(/\n/g, '<br>') : '(記載なし)';
            } else if (src.type === 'tree' && src.nodeId) {
                if (src.resolvedDisplay) {
                    text = src.resolvedDisplay;
                } else {
                    text = buildFullPathForItemSourceInternal(src.nodeId, itemSourcesCacheForUI);
                }
            }
            sourcesDisplayHtml = `<p style="margin-top: 10px;"><strong>入手手段:</strong> ${text}</p>`;
        } else {
            sourcesDisplayHtml = '<div style="margin-top: 10px;"><strong>入手手段:</strong><ul style="margin-top: 5px; padding-left: 20px; list-style-type: disc;">';
            item.sources.forEach(src => {
                if (src.type === 'manual') {
                    sourcesDisplayHtml += `<li>${src.manualString ? src.manualString.replace(/\n/g, '<br>') : '(記載なし)'}</li>`;
                } else if (src.type === 'tree' && src.nodeId) {
                    let pathText;
                    if (src.resolvedDisplay) {
                        pathText = src.resolvedDisplay;
                    } else {
                        pathText = buildFullPathForItemSourceInternal(src.nodeId, itemSourcesCacheForUI);
                    }
                    sourcesDisplayHtml += `<li>${pathText}</li>`;
                }
            });
            sourcesDisplayHtml += '</ul></div>';
        }
    } else if (item.sourceInputMode === 'manual' && typeof item.manualSourceString === 'string' && item.manualSourceString.trim() !== "") {
        sourcesDisplayHtml = `<p style="margin-top: 10px;"><strong>入手手段:</strong> ${item.manualSourceString.replace(/\n/g, '<br>')}</p>`;
    } else if (item.sourceNodeId && itemSourcesCacheForUI && itemSourcesCacheForUI.length > 0) {
        const text = buildFullPathForItemSourceInternal(item.sourceNodeId, itemSourcesCacheForUI);
        sourcesDisplayHtml = `<p style="margin-top: 10px;"><strong>入手手段:</strong> ${text} (旧形式)</p>`;
    } else if (typeof item.入手手段 === 'string' && item.入手手段.trim() !== "") {
         sourcesDisplayHtml = `<p style="margin-top: 10px;"><strong>入手手段:</strong> ${item.入手手段} (最旧形式)</p>`;
    }


    let tagsHtml = '';
    if (item.tags && item.tags.length > 0 && allTags) {
        const displayableTags = item.tags.map(tagId => {
            const tagObj = allTags.find(t => t.id === tagId);
            if (tagObj) return `<span style="background-color: #f0f0f0; padding: 2px 6px; border-radius: 10px; margin-right: 5px; font-size: 0.9em;">${tagObj.name}</span>`;
            return null;
        }).filter(Boolean);

        if (displayableTags.length > 0) {
            tagsHtml = `<div class="tags" style="margin-top:10px;"><strong>タグ:</strong> ${displayableTags.join(' ')}</div>`;
        }
    }

    const priceText = (typeof item.price === 'number' && !isNaN(item.price)) ? `${item.price}G` : '未設定';

    cardFull.innerHTML = `
        ${imageElementHTML}
        <h3 style="margin-top: 10px; margin-bottom: 5px; font-size: 1.3em;">${item.name || '名称未設定'}</h3>
        ${rarityHtml}
        <div style="text-align: left; width: 100%; margin-top: 10px; font-size: 0.95em; line-height: 1.7;">
            ${effectsDisplayHtml}
            ${sourcesDisplayHtml}
            <p style="margin-top: 5px;"><strong>売値:</strong> ${priceText}</p>
            ${tagsHtml}
        </div>
    `;
    currentItemDetailContent.appendChild(cardFull);

    currentItemDetailModal.style.display = 'flex';

    console.log("[ui-main] Item detail modal content set. Current display style:", currentItemDetailModal.style.display);
    if (getComputedStyle(currentItemDetailModal).display !== 'flex') {
        console.warn("[ui-main] Modal display style was not set to flex! Computed style:", getComputedStyle(currentItemDetailModal).display);
    }
}

export function handleCloseButtonClick(modalElement) {
    if (!modalElement) return;
    console.log(`[ui-main] Closing modal: ${modalElement.id}`);
    modalElement.style.display = "none";

    // 閉じられたモーダルがシミュレーターモーダルであり、かつアイテム選択中だった場合
    if (modalElement.id === 'simulatorModal' && getIsSelectingForSimulatorCb()) {
        // search-filters.js に定義されたキャンセル処理を呼び出す
        if(cancelItemSelectionCb) {
            console.log("[ui-main] Implicit cancellation of simulator selection detected. Resetting filters.");
            cancelItemSelectionCb();
        }
    }
    
    if (modalElement.id === 'imagePreviewModal') {
        const imgPreview = document.getElementById('generatedImagePreview');
        if (imgPreview) imgPreview.src = "#";
    }
    if (modalElement.id === 'itemDetailModal') {
        const content = document.getElementById('itemDetailContent');
        if (content) content.innerHTML = '';
    }
}

export function displaySearchToolMessage(message, show = true) {
    if (DOM.searchToolMessageElement) {
        if (show && message) {
            DOM.searchToolMessageElement.textContent = message;
            DOM.searchToolMessageElement.style.display = 'block';
        } else {
            DOM.searchToolMessageElement.style.display = 'none';
        }
    }
}

export function showConfirmSelectionButton(show = true) {
    if (DOM.confirmSelectionButtonElement) {
        DOM.confirmSelectionButtonElement.style.display = show ? 'block' : 'none';
    }
}

export function closeAllModals() {
    console.log("[ui-main] closeAllModals called");
    const allModalsCurrentlyInDOM = document.querySelectorAll('.modal');
    if (allModalsCurrentlyInDOM) {
        allModalsCurrentlyInDOM.forEach(modal => {
            if(modal) modal.style.display = 'none';
        });
    }
    const genImgPreview = document.getElementById('generatedImagePreview');
    if (genImgPreview) genImgPreview.src = "#";
    const detailContent = document.getElementById('itemDetailContent');
    if (detailContent) detailContent.innerHTML = '';
}
