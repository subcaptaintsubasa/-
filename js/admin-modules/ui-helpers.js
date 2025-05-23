// js/admin-modules/ui-helpers.js
// Contains helper functions for common UI tasks in the admin panel,
// such as modal handling, populating selects, rendering list items, etc.

const adminModals = {}; // Cache for admin modal elements: { modalId: element }

/**
 * Initializes common UI helper functionalities.
 * Focuses on generic modal close behavior.
 */
export function initUIHelpers() {
    console.log("[ui-helpers] initUIHelpers called");

    const closeButtons = document.querySelectorAll('body#admin-page .modal .close-button');
    closeButtons.forEach((btn) => {
        const modalElementForListener = btn.closest('.modal');
        if (modalElementForListener && modalElementForListener.id) {
            if (!adminModals[modalElementForListener.id]) {
                adminModals[modalElementForListener.id] = modalElementForListener;
            }
            // Prevent multiple listeners by replacing the button or using a flag
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', () => {
                const parentModal = newBtn.closest('.modal');
                if (parentModal && parentModal.id) {
                    closeModal(parentModal.id); // Use the closeModal function which will dispatch event
                } else {
                    console.error("[ui-helpers] Could not find parent .modal for clicked close button:", newBtn);
                }
            });
        } else {
            // console.warn("[ui-helpers] Close button SKIPPED (no valid parent .modal with ID). Button:", btn);
        }
    });

    const allModalsForOverlay = document.querySelectorAll('body#admin-page .modal');
    allModalsForOverlay.forEach((modal) => {
        if (modal.id) {
            if (!adminModals[modal.id]) {
                adminModals[modal.id] = modal;
            }
            // Prevent multiple listeners
            const newModal = modal.cloneNode(false); // Shallow clone for event listener re-attachment
            while (modal.firstChild) { // Move children
                newModal.appendChild(modal.firstChild);
            }
            modal.parentNode.replaceChild(newModal, modal);
            adminModals[modal.id] = newModal; // Update cache

            newModal.addEventListener('click', function(event) {
                if (event.target === this && this.id) {
                    closeModal(this.id); // Use the closeModal function
                }
            });
        } else {
            // console.warn("[ui-helpers] Modal element found without an ID, cannot attach overlay click listener:", modal);
        }
    });
    // console.log("Admin UI Helpers Initialized with robust listeners.");
}

/**
 * Opens a specific admin modal.
 * @param {string} modalId - The ID of the modal to open.
 */
export function openModal(modalId) {
    // console.log(`[ui-helpers] openModal called for: ${modalId}`);
    const modal = adminModals[modalId] || document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active-modal');
        if (modal.style.display === 'none') {
            modal.style.display = '';
        }
        if (!adminModals[modalId]) adminModals[modalId] = modal;
    } else {
        console.warn(`Modal with ID "${modalId}" not found.`);
    }
}

/**
 * Closes a specific admin modal and dispatches a custom event if it's an edit/management modal.
 * @param {string} modalId - The ID of the modal to close.
 */
export function closeModal(modalId) {
    console.log(`[ui-helpers] closeModal called for: ${modalId}`);
    const modal = adminModals[modalId] || document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active-modal');
        
        // ★★★ カスタムイベントを発行 ★★★
        // Check if it's an "edit" modal or a "management" modal (which might contain an edit form)
        // Exclude listEnlargementModal from dispatching this specific event, as it has its own handling.
        if (modalId !== 'listEnlargementModal' && 
            (modalId.toLowerCase().includes('edit') || modalId.toLowerCase().includes('management'))) {
            const event = new CustomEvent('adminEditModalClosed', { 
                detail: { modalId: modalId },
                bubbles: true,
                cancelable: true
            });
            document.dispatchEvent(event);
            console.log(`[ui-helpers] Dispatched adminEditModalClosed for ${modalId}`);
        }
    } else {
        console.warn(`Modal with ID "${modalId}" not found or not cached for closing.`);
    }
}

/**
 * Populates a select element with options.
 * @param {HTMLSelectElement | null} selectElement - The select DOM element.
 * @param {Array<Object>} optionsArray - Array of { value: string, text: string, 'data-attribute'?: string } objects.
 * @param {string | null} [defaultText='選択してください...'] - Text for the default empty option. Pass null to omit.
 * @param {string} [selectedValue=''] - The value to pre-select.
 */
export function populateSelect(selectElement, optionsArray, defaultText = '選択してください...', selectedValue = '') {
    if (!selectElement) {
        // console.warn("populateSelect: selectElement is null");
        return;
    }
    const currentValue = selectElement.value || selectedValue;

    selectElement.innerHTML = '';
    if (defaultText !== null) {
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = defaultText;
        selectElement.appendChild(defaultOption);
    }

    if (!optionsArray || !Array.isArray(optionsArray)) {
        // console.warn("populateSelect: optionsArray is invalid or empty", optionsArray);
        return;
    }

    optionsArray.forEach(optData => {
        const option = document.createElement('option');
        option.value = optData.value;
        option.textContent = optData.text;
        // Add any data attributes
        for (const key in optData) {
            if (key.startsWith('data-')) {
                option.dataset[key.substring(5)] = optData[key];
            }
        }
        selectElement.appendChild(option);
    });

    // Attempt to restore previous selection or set default
    if (Array.from(selectElement.options).some(opt => opt.value === currentValue)) {
        selectElement.value = currentValue;
    } else if (defaultText !== null && selectElement.options[0]) {
        selectElement.value = selectElement.options[0].value; // Default to the empty/placeholder option
    } else if (optionsArray.length > 0 && selectElement.options[0]) { // If no default text, select first actual option
         selectElement.value = selectElement.options[0].value;
    }
}


/**
 * Creates and populates a container with checkbox items.
 * @param {HTMLElement | null} containerElement - The container to populate.
 * @param {Array<Object>} items - Array of { id: string, name: string, parentName?: string } objects for checkboxes.
 * @param {Array<string>} selectedIds - Array of IDs that should be checked.
 * @param {string} checkboxName - The name attribute for the checkboxes.
 * @param {string} idPrefix - A prefix for generating unique checkbox IDs.
 */
export function populateCheckboxGroup(containerElement, items, selectedIds = [], checkboxName, idPrefix = 'cb-') {
    if (!containerElement) {
        // console.warn("populateCheckboxGroup: containerElement is null");
        return;
    }
    containerElement.innerHTML = '';

    if (!items || items.length === 0) {
        containerElement.innerHTML = '<p>利用可能な選択肢がありません。</p>';
        return;
    }

    items.forEach(item => {
        const safeContainerId = containerElement.id ? containerElement.id.replace(/\W/g, '') : simpleUID('container');
        const checkboxId = `${idPrefix}${item.id}-${safeContainerId}`;
        const checkboxWrapper = document.createElement('div');
        checkboxWrapper.classList.add('checkbox-item');

        let labelText = item.name;
        if (item.parentName) { // For categories with parent info
            labelText += ` (親: ${item.parentName})`;
        }

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = checkboxId;
        input.name = checkboxName;
        input.value = item.id;
        if (selectedIds.includes(item.id)) {
            input.checked = true;
        }

        const label = document.createElement('label');
        label.htmlFor = checkboxId;
        label.textContent = labelText;

        checkboxWrapper.appendChild(input);
        checkboxWrapper.appendChild(label);
        containerElement.appendChild(checkboxWrapper);
    });
}

/**
 * Creates and populates a container with selectable tag-like buttons.
 * @param {HTMLElement | null} containerElement - The container to populate.
 * @param {Array<Object>} tagsData - Array of { id: string, name: string } tag objects.
 * @param {Array<string>} activeTagIds - Array of tag IDs that should be marked active.
 * @param {string} [datasetKey='tagId'] - The data attribute key to store the ID (e.g., 'tagId', 'effectTypeId').
 */
export function populateTagButtonSelector(containerElement, tagsData, activeTagIds = [], datasetKey = 'tagId') {
    if (!containerElement) {
        // console.warn("populateTagButtonSelector: containerElement is null");
        return;
    }
    containerElement.innerHTML = '';

    if (!tagsData || tagsData.length === 0) {
        containerElement.innerHTML = '<p>利用可能な選択肢がありません。</p>';
        return;
    }

    tagsData.forEach(tag => {
        const button = document.createElement('div'); // Using div for more flexible styling, acts like a button
        button.className = 'tag-filter admin-tag-select'; // Use existing classes
        button.textContent = tag.name;
        button.dataset[datasetKey] = tag.id; // Use dynamic datasetKey
        if (activeTagIds.includes(tag.id)) {
            button.classList.add('active');
        }
        button.setAttribute('role', 'button'); // ARIA role
        button.setAttribute('tabindex', '0');   // Make it focusable
        button.addEventListener('click', () => {
            button.classList.toggle('active');
        });
        button.addEventListener('keydown', (e) => { // Keyboard support
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                button.classList.toggle('active');
            }
        });
        containerElement.appendChild(button);
    });
}


/**
 * Gets an array of selected values from a group of checkboxes.
 * @param {HTMLElement | null} containerElement - The container holding the checkboxes.
 * @param {string} checkboxName - The name attribute of the checkboxes.
 * @returns {Array<string>} - Array of values of checked checkboxes.
 */
export function getSelectedCheckboxValues(containerElement, checkboxName) {
    if (!containerElement) return [];
    return Array.from(containerElement.querySelectorAll(`input[type="checkbox"][name="${checkboxName}"]:checked`))
        .map(cb => cb.value);
}

/**
 * Gets an array of selected tag IDs from a tag button selector.
 * @param {HTMLElement | null} containerElement - The container holding the tag buttons.
 * @param {string} [datasetKey='tagId'] - The data attribute key used to store the ID.
 * @returns {Array<string>} - Array of tag IDs of active tag buttons.
 */
export function getSelectedTagButtonValues(containerElement, datasetKey = 'tagId') {
    if (!containerElement) return [];
    return Array.from(containerElement.querySelectorAll(`.tag-filter.admin-tag-select.active[data-${datasetKey}]`))
        .map(btn => btn.dataset[datasetKey]);
}

/**
 * Generates a simple unique ID.
 * @param {string} [prefix='uid-'] - Optional prefix for the ID.
 * @returns {string}
 */
function simpleUID(prefix = 'uid-') {
    return prefix + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

// clearForm is no longer exported as it's handled by form.reset() and specific manager logic
