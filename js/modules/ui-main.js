// js/modules/ui-main.js
// Handles general UI interactions like hamburger menu, modal closing, etc.
// for the user-facing side.

let getIsSelectingForSimulatorCb = () => false;
let cancelItemSelectionCb = () => {};
let initializeSimulatorDisplayCb = () => {};

const DOM = {
    sideNav: null,
    hamburgerButton: null,
    closeNavButton: null,
    openSimulatorButtonNav: null,
    modals: null,
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

    DOM.sideNav = document.getElementById('sideNav');
    DOM.hamburgerButton = document.getElementById('hamburgerButton');
    DOM.closeNavButton = document.getElementById('closeNavButton');
    DOM.openSimulatorButtonNav = document.getElementById('openSimulatorButtonNav');
    DOM.modals = document.querySelectorAll('.modal');
    DOM.itemDetailModal = document.getElementById('itemDetailModal');
    DOM.itemDetailContent = document.getElementById('itemDetailContent');
    DOM.simulatorModal = document.getElementById('simulatorModal');
    DOM.imagePreviewModal = document.getElementById('imagePreviewModal');
    DOM.generatedImagePreview = document.getElementById('generatedImagePreview');
    DOM.searchToolMessageElement = document.getElementById('searchToolMessage');
    DOM.confirmSelectionButtonElement = document.getElementById('confirmSelectionButton');


    if (DOM.hamburgerButton && DOM.sideNav) {
        DOM.hamburgerButton.addEventListener('click', () => {
            DOM.sideNav.classList.add('open');
        });
    }

    if (DOM.closeNavButton && DOM.sideNav) {
        DOM.closeNavButton.addEventListener('click', () => {
            DOM.sideNav.classList.remove('open');
        });
    }

    if (DOM.openSimulatorButtonNav && DOM.simulatorModal) {
        DOM.openSimulatorButtonNav.addEventListener('click', () => {
            if (getIsSelectingForSimulatorCb()) {
                return;
            }
            DOM.simulatorModal.style.display = 'flex';
            if(initializeSimulatorDisplayCb) initializeSimulatorDisplayCb();
            if (DOM.sideNav) DOM.sideNav.classList.remove('open');
        });
    }

    DOM.modals.forEach(modal => {
        const closeButton = modal.querySelector('.close-button');
        if (closeButton) {
            if (!closeButton.dataset.listenerAttached) {
                closeButton.addEventListener('click', () => handleCloseButtonClick(modal));
                closeButton.dataset.listenerAttached = 'true';
            }
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

// --- レア度表示用のヘルパー関数 (item-manager.js から移植/共通化も検討) ---
function getRarityStarsHTML(rarityValue, maxStars = 5) {
    let starsHtml = '<div class="rarity-display-stars" style="margin-bottom: 10px;"><strong>レア度:</strong> '; // ラベル追加
    for (let i = 1; i <= maxStars; i++) {
        starsHtml += `<span class="star-icon ${i <= rarityValue ? 'selected' : ''}" style="font-size: 1.2em; color: ${i <= rarityValue ? '#ffc107' : '#ccc'}; margin-right: 2px;">★</span>`; // インラインスタイルで色指定
    }
    starsHtml += '</div>';
    return starsHtml;
}
// --- ここまで ---


export function openItemDetailModal(item, effectTypesCache, allTags, effectUnitsCache) {
    if (!item || !DOM.itemDetailContent || !DOM.itemDetailModal) {
        console.error("[ui-main] Item data, detail content, or modal element missing for detail view:", item ? item.docId : 'unknown item');
        return;
    }
    console.log("[ui-main] Opening item detail modal for:", item.name);

    DOM.itemDetailContent.innerHTML = '';

    const cardFull = document.createElement('div');
    cardFull.classList.add('item-card-full');

    let imageElementHTML;
    if (item.image && item.image.trim() !== "") {
        imageElementHTML = `<img src="${item.image}" alt="${item.name || 'アイテム画像'}" onerror="this.onerror=null; this.src='./images/placeholder_item.png'; this.alt='画像読み込みエラー';">`;
    } else {
        imageElementHTML = `<div class="item-image-text-placeholder">NoImage</div>`;
    }

    // --- レア度表示HTMLの生成 ---
    const rarityHtml = getRarityStarsHTML(item.rarity || 0);
    // --- ここまで ---

    let effectsHtml = '<p><strong>効果</strong> なし</p>'; 
    if (item.structured_effects && item.structured_effects.length > 0 && effectTypesCache && effectUnitsCache) {
        effectsHtml = `<div class="structured-effects"><strong>効果詳細</strong><ul>`; 
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
            if (tagObj) return `<span>${tagObj.name}</span>`;
            return null;
        }).filter(Boolean);

        if (displayableTags.length > 0) {
            tagsHtml = `<div class="tags">タグ ${displayableTags.join(' ')}</div>`; 
        }
    }

    const priceText = (typeof item.price === 'number' && !isNaN(item.price)) ? `${item.price}G` : '未設定';
    const sourceText = item.入手手段 || '不明';


    cardFull.innerHTML = `
        ${imageElementHTML}
        <h3>${item.name || '名称未設定'}</h3>
        ${rarityHtml} <!-- レア度表示の挿入 -->
        ${effectsHtml}
        <p><strong>入手手段</strong> ${sourceText}</p> 
        <p><strong>売値</strong> ${priceText}</p>
        ${tagsHtml}
    `; 
    DOM.itemDetailContent.appendChild(cardFull);
    DOM.itemDetailModal.style.display = 'flex';
}

export function handleCloseButtonClick(modalElement) {
    if (!modalElement) return;
    modalElement.style.display = "none";

    if (modalElement === DOM.simulatorModal && getIsSelectingForSimulatorCb()) {
        if(cancelItemSelectionCb) cancelItemSelectionCb();
    }
    if (modalElement === DOM.imagePreviewModal && DOM.generatedImagePreview) {
        DOM.generatedImagePreview.src = "#";
    }
    if (modalElement === DOM.itemDetailModal && DOM.itemDetailContent) {
        DOM.itemDetailContent.innerHTML = '';
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
    DOM.modals.forEach(modal => {
        modal.style.display = 'none';
    });
    if (DOM.generatedImagePreview) DOM.generatedImagePreview.src = "#";
    if (DOM.itemDetailContent) DOM.itemDetailContent.innerHTML = '';
}
