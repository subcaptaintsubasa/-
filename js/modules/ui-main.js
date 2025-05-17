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
    console.log("[ui-main] initUIMain called"); // ★追加
    getIsSelectingForSimulatorCb = getIsSelectingForSimulator;
    cancelItemSelectionCb = cancelItemSelection;
    initializeSimulatorDisplayCb = initializeSimulatorDisplay;

    DOM.sideNav = document.getElementById('sideNav');
    DOM.hamburgerButton = document.getElementById('hamburgerButton');
    DOM.closeNavButton = document.getElementById('closeNavButton');
    DOM.openSimulatorButtonNav = document.getElementById('openSimulatorButtonNav');
    DOM.modals = document.querySelectorAll('.modal'); // Select all modals for generic handling
    DOM.itemDetailModal = document.getElementById('itemDetailModal');
    DOM.itemDetailContent = document.getElementById('itemDetailContent');
    DOM.simulatorModal = document.getElementById('simulatorModal');
    DOM.imagePreviewModal = document.getElementById('imagePreviewModal');
    DOM.generatedImagePreview = document.getElementById('generatedImagePreview');

    console.log("[ui-main] hamburgerButton:", DOM.hamburgerButton); // ★追加
    console.log("[ui-main] closeNavButton:", DOM.closeNavButton); // ★追加
    console.log("[ui-main] sideNav:", DOM.sideNav); // ★追加

    if (DOM.hamburgerButton && DOM.sideNav) {
        DOM.hamburgerButton.addEventListener('click', () => {
            console.log("[ui-main] Hamburger button clicked"); // ★追加
            DOM.sideNav.classList.add('open');
        });
        console.log("[ui-main] Added listener to hamburgerButton"); // ★追加
    } else {
        console.warn("[ui-main] Hamburger button or sideNav not found."); // ★追加
    }

    if (DOM.closeNavButton && DOM.sideNav) {
        DOM.closeNavButton.addEventListener('click', () => {
            console.log("[ui-main] Close nav button clicked"); // ★追加
            DOM.sideNav.classList.remove('open');
        });
        console.log("[ui-main] Added listener to closeNavButton"); // ★追加
    } else {
        console.warn("[ui-main] Close nav button or sideNav not found."); // ★追加
    }

    if (DOM.openSimulatorButtonNav && DOM.simulatorModal) {
        DOM.openSimulatorButtonNav.addEventListener('click', () => {
            console.log("[ui-main] Open simulator button (nav) clicked"); // ★追加
            if (getIsSelectingForSimulatorCb()) {
                console.log("[ui-main] Simulator selection in progress, not opening simulator modal."); // ★追加
                return;
            }
            DOM.simulatorModal.style.display = 'flex';
            if(initializeSimulatorDisplayCb) initializeSimulatorDisplayCb();
            if (DOM.sideNav) DOM.sideNav.classList.remove('open');
        });
        console.log("[ui-main] Added listener to openSimulatorButtonNav"); // ★追加
    } else {
        console.warn("[ui-main] openSimulatorButtonNav or simulatorModal not found."); // ★追加
    }

    // Modal close buttons (generic for all modals on user side)
    DOM.modals.forEach(modal => {
        const closeButton = modal.querySelector('.close-button');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                console.log(`[ui-main] Close button clicked for modal: ${modal.id || 'unknown'}`); // ★追加
                handleCloseButtonClick(modal);
            });
        }
    });

    // Close modal on overlay click (generic for all modals on user side)
    window.addEventListener('click', handleGlobalClick);
    console.log("[ui-main] UI Main Initialized."); // ★追加
}

export function openItemDetailModal(item, effectTypesCache, allTags) {
    if (!item || !DOM.itemDetailContent || !DOM.itemDetailModal) {
        console.error("[ui-main] Item data, detail content, or modal element missing for detail view:", item ? item.docId : 'unknown item');
        return;
    }
    console.log("[ui-main] Opening item detail modal for:", item.name); // ★追加

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
    if (item.tags && item.tags.length > 0 && allTags) {
        // Assuming EQUIPMENT_SLOT_TAG_IDS is available globally or passed if needed for filtering
        // For this example, it's simplified to show all tags.
        // const validSlotTagIds = Object.values(EQUIPMENT_SLOT_TAG_IDS || {}).filter(id => id !== null);
        const displayableTags = item.tags.map(tagId => {
            const tagObj = allTags.find(t => t.id === tagId);
            // if (tagObj && !validSlotTagIds.includes(tagId)) return `<span>${tagObj.name}</span>`;
            if (tagObj) return `<span>${tagObj.name}</span>`;
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
    console.log(`[ui-main] handleCloseButtonClick for modal:`, modalElement ? (modalElement.id || 'unknown') : 'null element'); // ★追加
    if (!modalElement) return;
    modalElement.style.display = "none";

    if (modalElement === DOM.simulatorModal && getIsSelectingForSimulatorCb()) {
        console.log("[ui-main] Simulator modal closed during item selection, cancelling selection."); // ★追加
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
        console.log("[ui-main] Global click detected outside open sideNav, closing nav."); // ★追加
        DOM.sideNav.classList.remove('open');
    }

    // Close modal if click is on overlay
    if (event.target.classList.contains('modal')) {
        console.log("[ui-main] Global click detected on modal overlay:", event.target.id || 'unknown modal'); // ★追加
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

export function closeAllModals() {
    console.log("[ui-main] closeAllModals called"); // ★追加
    DOM.modals.forEach(modal => {
        modal.style.display = 'none';
    });
    if (DOM.generatedImagePreview) DOM.generatedImagePreview.src = "#";
    if (DOM.itemDetailContent) DOM.itemDetailContent.innerHTML = '';
}
