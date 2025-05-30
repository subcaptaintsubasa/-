// js/modules/ui-main.js
// Handles general UI interactions like hamburger menu, modal closing, etc.
// for the user-facing side.
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
    // modals: null, // querySelectorAll は動的なので、都度取得するか、特定のモーダルのみキャッシュ
    itemDetailModal: null, // キャッシュするが、open時に再取得も検討
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
    
    // 特定のモーダルをキャッシュ
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

    // すべてのモーダルを取得してイベントリスナーを設定
    const allModals = document.querySelectorAll('.modal');
    allModals.forEach(modal => {
        const closeButton = modal.querySelector('.close-button');
        if (closeButton) {
            // 古いリスナーを削除する最も確実な方法は、要素を複製して置き換えることです
            const newCloseButton = closeButton.cloneNode(true);
            closeButton.parentNode.replaceChild(newCloseButton, closeButton);
            newCloseButton.addEventListener('click', () => handleCloseButtonClick(modal));
        }
        // オーバーレイクリックで閉じる (モーダル自体を複製するのは影響が大きいので避ける)
        // 代わりに、リスナーが重複しないようにフラグで管理
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

function getItemSourceDisplayString(item, allItemSources) {
    console.log("[ui-main] getItemSourceDisplayString called for item:", JSON.parse(JSON.stringify(item)));
    console.log("[ui-main] allItemSources available for lookup:", allItemSources ? allItemSources.length : 'undefined');

    if (item.sourceInputMode === 'manual') {
        console.log("[ui-main] Source mode: manual, string:", item.manualSourceString);
        return item.manualSourceString ? item.manualSourceString.replace(/\n/g, '<br>') : '不明';
    } else if (item.sourceNodeId && allItemSources && allItemSources.length > 0) {
        console.log("[ui-main] Source mode: tree, nodeId:", item.sourceNodeId);
        const selectedNode = allItemSources.find(s => s.id === item.sourceNodeId);
        console.log("[ui-main] Found node in cache for sourceNodeId:", JSON.parse(JSON.stringify(selectedNode)));

        if (selectedNode && selectedNode.displayString && selectedNode.displayString.trim() !== "") {
            console.log("[ui-main] Using displayString from node:", selectedNode.displayString);
            return selectedNode.displayString;
        }
        const pathParts = [];
        let currentId = item.sourceNodeId;
        let sanityCheck = 0;
        while (currentId && sanityCheck < 10) { 
            const node = allItemSources.find(s => s.id === currentId);
            if (node) {
                pathParts.unshift(node.name);
                currentId = node.parentId;
            } else {
                pathParts.unshift(`[ID:${currentId.substring(0,5)}...]`); 
                console.warn(`[ui-main] Node not found for ID: ${currentId} during path construction.`);
                break;
            }
            sanityCheck++;
        }
        const constructedPath = pathParts.length > 0 ? pathParts.join(' > ') : `(経路ID: ${item.sourceNodeId.substring(0,8)}...)`;
        console.log("[ui-main] Constructed path:", constructedPath);
        return constructedPath;
    }
    console.log("[ui-main] Fallback to '不明' for item source display.");
    return '不明'; 
}


export function openItemDetailModal(item, effectTypesCache, allTags, effectUnitsCache) {
    const currentItemDetailModal = document.getElementById('itemDetailModal'); 
    const currentItemDetailContent = document.getElementById('itemDetailContent');

    if (!item || !currentItemDetailContent || !currentItemDetailModal) {
        console.error("[ui-main] Item data, detail content, or modal element missing for detail view. Item:", item, "Modal:", currentItemDetailModal, "Content:", currentItemDetailContent);
        return;
    }
    console.log("[ui-main] Opening item detail modal for:", item.name);
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

    let effectsHtml = '<p><strong>効果:</strong> なし</p>'; 
    if (item.effectsInputMode === 'manual' && typeof item.manualEffectsString === 'string') {
        effectsHtml = `<div class="structured-effects"><strong>効果:</strong><p style="margin-top: 5px;">${item.manualEffectsString.replace(/\n/g, '<br>')}</p></div>`;
    } else if (item.structured_effects && item.structured_effects.length > 0 && effectTypesCache && effectUnitsCache) {
        effectsHtml = `<div class="structured-effects"><strong>効果:</strong><ul style="margin-top: 5px; padding-left: 20px; list-style-type: disc;">`; 
        item.structured_effects.forEach(eff => {
            const effectType = effectTypesCache.find(et => et.id === eff.type);
            const typeName = effectType ? effectType.name : `不明(${eff.type})`;
            
            let effectTextPart;
            const unitName = eff.unit;
            if (unitName && unitName !== 'none') {
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
            effectsHtml += `<li>${typeName} ${effectTextPart}</li>`;
        });
        effectsHtml += `</ul></div>`;
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
    const sourceText = getItemSourceDisplayString(item, itemSourcesCacheForUI);

    cardFull.innerHTML = `
        ${imageElementHTML}
        <h3 style="margin-top: 10px; margin-bottom: 5px; font-size: 1.3em;">${item.name || '名称未設定'}</h3>
        ${rarityHtml}
        <div style="text-align: left; width: 100%; margin-top: 10px; font-size: 0.95em; line-height: 1.7;">
            ${effectsHtml}
            <p style="margin-top: 10px;"><strong>入手手段:</strong> ${sourceText}</p> 
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

    // 特定のモーダルクローズ時の追加処理
    if (modalElement.id === 'simulatorModal' && getIsSelectingForSimulatorCb()) {
        if(cancelItemSelectionCb) cancelItemSelectionCb();
    }
    if (modalElement.id === 'imagePreviewModal') {
        const imgPreview = document.getElementById('generatedImagePreview'); // DOMオブジェクトから取得する方が安全
        if (imgPreview) imgPreview.src = "#";
    }
    if (modalElement.id === 'itemDetailModal') {
        const content = document.getElementById('itemDetailContent'); // DOMオブジェクトから取得する方が安全
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
    const allModalsCurrentlyInDOM = document.querySelectorAll('.modal'); // 常に最新のDOMから取得
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
