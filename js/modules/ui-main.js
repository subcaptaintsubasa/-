// js/modules/ui-main.js
// Handles general UI interactions like hamburger menu, modal closing, etc.
// for the user-facing side.

// Callbacks to be set by the main script
let getIsSelectingForSimulatorCb = () => false;
let cancelItemSelectionCb = () => {};
let initializeSimulatorDisplayCb = () => {};

// Cache for frequently accessed DOM elements
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

/**
 * Initializes main UI elements and event listeners.
 * @param {Function} getIsSelectingForSimulator - Callback to check simulator selection mode.
 * @param {Function} cancelItemSelection - Callback to cancel item selection for simulator.
 * @param {Function} initializeSimulatorDisplay - Callback to initialize/reset simulator display.
 */
export function initUIMain(getIsSelectingForSimulator, cancelItemSelection, initializeSimulatorDisplay) {
    getIsSelectingForSimulatorCb = getIsSelectingForSimulator;
    cancelItemSelectionCb = cancelItemSelection;
    initializeSimulatorDisplayCb = initializeSimulatorDisplay;

    // Query DOM elements once
    DOM.sideNav = document.getElementById('sideNav');
    DOM.hamburgerButton = document.getElementById('hamburgerButton');
    DOM.closeNavButton = document.getElementById('closeNavButton');
    DOM.openSimulatorButtonNav = document.getElementById('openSimulatorButtonNav');
    DOM.modals = document.querySelectorAll('.modal'); // Get all elements with class 'modal'
    DOM.itemDetailModal = document.getElementById('itemDetailModal');
    DOM.itemDetailContent = document.getElementById('itemDetailContent');
    DOM.simulatorModal = document.getElementById('simulatorModal');
    DOM.imagePreviewModal = document.getElementById('imagePreviewModal');
    DOM.generatedImagePreview = document.getElementById('generatedImagePreview');

    // Setup event listeners
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
                // If already in item selection mode for simulator, perhaps do nothing or show a message
                console.log("Already selecting an item for the simulator.");
                return;
            }
            DOM.simulatorModal.style.display = 'flex';
            if (initializeSimulatorDisplayCb) initializeSimulatorDisplayCb(); // Ensure simulator UI is fresh
            if (DOM.sideNav) DOM.sideNav.classList.remove('open'); // Close nav if open
        });
    }

    // Attach close handlers to all modal close buttons
    DOM.modals.forEach(modal => {
        const closeButton = modal.querySelector('.close-button');
        if (closeButton) {
            // Pass the modal itself to the handler
            closeButton.addEventListener('click', () => handleModalClose(modal));
        }
    });

    // Global click listener for closing side nav or modals on overlay click
    window.addEventListener('click', handleGlobalClick);
    console.log("UI Main Initialized.");
}

/**
 * Opens the item detail modal and populates it with item data.
 * @param {Object} item - The item object to display.
 * @param {Array} effectTypesCache - Cache of effect types for display.
 * @param {Array} allTags - Cache of all tags for display.
 * @param {Object} equipmentSlotTagIds - Map of slot names to tag IDs (to optionally filter slot tags from display).
 */
export function openItemDetailModal(item, effectTypesCache, allTags, equipmentSlotTagIds = {}) {
    if (!item || !DOM.itemDetailContent || !DOM.itemDetailModal) {
        console.error("Item data, detail content, or modal element missing for detail view:", item ? item.docId : 'unknown item');
        return;
    }

    DOM.itemDetailContent.innerHTML = ''; // Clear previous content

    const cardFull = document.createElement('div');
    cardFull.classList.add('item-card-full');

    // Image
    let imageElementHTML;
    if (item.image && item.image.trim() !== "") {
        imageElementHTML = `<img src="${item.image}" alt="${item.name || 'アイテム画像'}" onerror="this.onerror=null; this.src='./images/placeholder_item.png'; this.alt='画像読み込みエラー';">`;
    } else {
        imageElementHTML = `<div class="item-image-text-placeholder">NoImage</div>`;
    }

    // Effects
    let effectsHtml = '<p><strong>効果:</strong> Coming Soon</p>';
    if (item.structured_effects && item.structured_effects.length > 0 && Array.isArray(effectTypesCache)) {
        effectsHtml = `<div class="structured-effects"><strong>効果詳細:</strong><ul>`;
        item.structured_effects.forEach(eff => {
            const effectType = effectTypesCache.find(et => et.id === eff.type);
            const typeName = effectType ? effectType.name : `不明 (${eff.type.substring(0,6)}...)`;
            const unitText = (eff.unit && eff.unit !== 'none') ? eff.unit : '';
            effectsHtml += `<li>${typeName}: ${eff.value}${unitText}</li>`;
        });
        effectsHtml += `</ul></div>`;
    }

    // Tags (excluding slot tags)
    let tagsHtml = '';
    const validSlotTagIds = Object.values(equipmentSlotTagIds || {}).filter(id => id !== null);
    if (item.tags && item.tags.length > 0 && Array.isArray(allTags)) {
        const displayableTags = item.tags
            .map(tagId => {
                const tagObj = allTags.find(t => t.id === tagId);
                // Only display if it's a valid tag and NOT a slot-defining tag
                if (tagObj && !validSlotTagIds.includes(tagId)) {
                    return `<span>${tagObj.name}</span>`;
                }
                return null;
            })
            .filter(Boolean); // Remove nulls

        if (displayableTags.length > 0) {
            tagsHtml = `<div class="tags">タグ: ${displayableTags.join(' ')}</div>`;
        }
    }

    // Price and Source
    const priceText = (typeof item.price === 'number' && !isNaN(item.price)) ? `${item.price}G` : 'Coming Soon';
    const sourceText = item.入手手段 || 'Coming Soon'; // Ensure empty string if null/undefined

    // Assemble card content
    cardFull.innerHTML = `
        ${imageElementHTML}
        <h3 id="itemDetailModalTitle">${item.name || '名称未設定'}</h3> {/* Added id for aria-labelledby */}
        ${effectsHtml}
        <p><strong>入手手段:</strong> ${sourceText}</p>
        <p><strong>売値:</strong> ${priceText}</p>
        ${tagsHtml}
    `;
    DOM.itemDetailContent.appendChild(cardFull);
    DOM.itemDetailModal.style.display = 'flex';
}

/**
 * Handles closing a specific modal and performing cleanup.
 * @param {HTMLElement} modalElement - The modal element to close.
 */
function handleModalClose(modalElement) {
    if (!modalElement) return;
    modalElement.style.display = "none";

    // Specific cleanup based on which modal is closing
    if (modalElement === DOM.simulatorModal && getIsSelectingForSimulatorCb()) {
        if (cancelItemSelectionCb) cancelItemSelectionCb(); // Notify to cancel item selection mode
    }
    if (modalElement === DOM.imagePreviewModal && DOM.generatedImagePreview) {
        DOM.generatedImagePreview.src = "#"; // Clear preview image to free memory
    }
    if (modalElement === DOM.itemDetailModal && DOM.itemDetailContent) {
        DOM.itemDetailContent.innerHTML = ''; // Clear detail content
    }
}

/**
 * Handles global click events, e.g., for closing UI elements.
 * @param {Event} event - The click event.
 */
function handleGlobalClick(event) {
    // Close side nav if open and click is outside its area and not on the hamburger button
    if (DOM.sideNav && DOM.sideNav.classList.contains('open') &&
        !DOM.sideNav.contains(event.target) && event.target !== DOM.hamburgerButton) {
        DOM.sideNav.classList.remove('open');
    }

    // Close modal if click is directly on the modal overlay (not its content)
    if (event.target.classList.contains('modal')) {
        handleModalClose(event.target);
    }
}

/**
 * Displays or hides the search tool message (used for simulator item selection).
 * @param {string} message - The message to display. If empty/null, hides the message.
 * @param {boolean} [show=true] - Whether to show or hide the message.
 */
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

/**
 * Shows or hides the "Confirm Selection" button for the simulator.
 * @param {boolean} [show=true] - Whether to show or hide the button.
 */
export function showConfirmSelectionButton(show = true) {
    const confirmButton = document.getElementById('confirmSelectionButton');
    if (confirmButton) {
        confirmButton.style.display = show ? 'block' : 'none';
    }
}

/**
 * Closes all known modals.
 */
export function closeAllModals() {
    if (DOM.modals) {
        DOM.modals.forEach(modal => {
            // Use the specific handler to ensure cleanup logic is run
            handleModalClose(modal);
        });
    }
    // Additional global cleanup if necessary
    console.log("All modals closed.");
}
