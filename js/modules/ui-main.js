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
    modals: null, // NodeList of all modals
    itemDetailModal: null,
    itemDetailContent: null,
    simulatorModal: null,
    imagePreviewModal: null,
    generatedImagePreview: null,
};

export function initUIMain(getIsSelectingForSimulator, cancelItemSelection, initializeSimulatorDisplay) {
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
            if (getIsSelectingForSimulatorCb()) return; // Don't open if already selecting an item
            DOM.simulatorModal.style.display = 'flex';
            if(initializeSimulatorDisplayCb) initializeSimulatorDisplayCb();
            if (DOM.sideNav) DOM.sideNav.classList.remove('open');
        });
    }

    // Modal close buttons
    DOM.modals.forEach(modal => {
        const closeButton = modal.querySelector('.close-button');
        if (closeButton) {
            closeButton.addEventListener('click', () => handleCloseButtonClick(modal));
        }
    });

    // Close modal on overlay click
    window.addEventListener('click', handleGlobalClick);
}

export function openItemDetailModal(item, effectTypesCache, allTags) {
    if (!item || !DOM.itemDetailContent || !DOM.itemDetailModal) {
        console.error("Item data, detail content, or modal element missing for detail view:", item ? item.docId : 'unknown');
        return;
    }

    DOM.itemDetailContent.innerHTML = ''; // Clear previous content

    const cardFull = document.createElement('div');
    cardFull.classList.add('item-card-full');

    let imageElementHTML;
    if (item.image && item.image.trim() !== "") {
        imageElementHTML = `<img src="${item.image}" alt="${item.name || 'アイテム画像'}" onerror="this.onerror=null; this.src='./images/placeholder_item.png'; this.alt='画像読み込みエラー';">`;
    } else {
        imageElementHTML = `<div class="item-image-text-placeholder">NoImage</div>`;
    }

    let effectsHtml = '<p><strong>効果:</strong> Coming Soon</p>';
    if (item.structured_effects && item.structured_effects.length > 0 && effectTypesCache) {
        effectsHtml = `<div class="structured-effects"><strong>効果詳細:</strong><ul>`;
        item.structured_effects.forEach(eff => {
            const effectType = effectTypesCache.find(et => et.id === eff.type);
            const typeName = effectType ? effectType.name : `不明(${eff.type})`;
            const unitText = (eff.unit && eff.unit !== 'none') ? eff.unit : '';
            effectsHtml += `<li>${typeName}: ${eff.value}${unitText}</li>`;
        });
        effectsHtml += `</ul></div>`;
    }

    let tagsHtml = '';
    // Assuming EQUIPMENT_SLOT_TAG_IDS is available or passed if needed for filtering
    // For simplicity, this example doesn't filter slot tags from display here.
    // If needed, pass EQUIPMENT_SLOT_TAG_IDS and filter.
    if (item.tags && item.tags.length > 0 && allTags) {
        const validSlotTagIds = []; // If EQUIPMENT_SLOT_TAG_IDS is available, populate this
        const displayableTags = item.tags.map(tagId => {
            const tagObj = allTags.find(t => t.id === tagId);
            // Example: if (tagObj && !validSlotTagIds.includes(tagId)) return `<span>${tagObj.name}</span>`;
            if (tagObj) return `<span>${tagObj.name}</span>`; // Simplified: show all tags
            return null;
        }).filter(Boolean);

        if (displayableTags.length > 0) {
            tagsHtml = `<div class="tags">タグ: ${displayableTags.join(' ')}</div>`;
        }
    }

    const priceText = (typeof item.price === 'number' && !isNaN(item.price)) ? `${item.price}G` : 'Coming Soon';
    const sourceText = item.入手手段 || 'Coming Soon';


    cardFull.innerHTML = `
        ${imageElementHTML}
        <h3>${item.name || '名称未設定'}</h3>
        ${effectsHtml}
        <p><strong>入手手段:</strong> ${sourceText}</p>
        <p><strong>売値:</strong> ${priceText}</p>
        ${tagsHtml}
    `;
    DOM.itemDetailContent.appendChild(cardFull);
    DOM.itemDetailModal.style.display = 'flex';
}

export function handleCloseButtonClick(modalElement) {
    modalElement.style.display = "none";
    // Specific modal cleanup logic
    if (modalElement === DOM.simulatorModal && getIsSelectingForSimulatorCb()) {
        if(cancelItemSelectionCb) cancelItemSelectionCb();
    }
    if (modalElement === DOM.imagePreviewModal && DOM.generatedImagePreview) {
        DOM.generatedImagePreview.src = "#"; // Clear preview image
    }
    if (modalElement === DOM.itemDetailModal && DOM.itemDetailContent) {
        DOM.itemDetailContent.innerHTML = ''; // Clear detail content
    }
}

export function handleGlobalClick(event) {
    // Close side nav if open and click is outside
    if (DOM.sideNav && DOM.sideNav.classList.contains('open') && !DOM.sideNav.contains(event.target) && event.target !== DOM.hamburgerButton) {
        DOM.sideNav.classList.remove('open');
    }

    // Close modal if click is on overlay
    if (event.target.classList.contains('modal')) {
        handleCloseButtonClick(event.target);
    }
}

export function displaySearchToolMessage(message, show = true) {
    const searchToolMessageEl = document.getElementById('searchToolMessage');
    if (searchToolMessageEl) {
        if (show && message) {
            searchToolMessageEl.textContent = message;
            searchToolMessageEl.style.display = 'block';
        } else {
            searchToolMessageEl.style.display = 'none';
        }
    }
}

export function showConfirmSelectionButton(show = true) {
    const confirmButton = document.getElementById('confirmSelectionButton');
    if (confirmButton) {
        confirmButton.style.display = show ? 'block' : 'none';
    }
}

// Placeholder for closing all modals, if ever needed
export function closeAllModals() {
    DOM.modals.forEach(modal => {
        modal.style.display = 'none';
    });
    // Reset any specific modal states if necessary
    if (DOM.generatedImagePreview) DOM.generatedImagePreview.src = "#";
    if (DOM.itemDetailContent) DOM.itemDetailContent.innerHTML = '';
}
