// js/admin-modules/ui-helpers.js
// Contains helper functions for common UI tasks in the admin panel,
// such as modal handling, populating selects, rendering list items, etc.

const adminModals = {}; // Cache for admin modal elements: { modalId: element }

/**
 * Initializes common UI helper functionalities.
 * Focuses on generic modal close behavior.
 */
export function initUIHelpers() {
    // Generic modal close button handler
    document.querySelectorAll('#admin-content .modal .close-button').forEach(btn => {
        const modalElement = btn.closest('.modal');
        if (modalElement && modalElement.id) {
            if (!adminModals[modalElement.id]) {
                adminModals[modalElement.id] = modalElement;
            }
            // Remove existing listener before adding a new one to prevent duplicates
            btn.removeEventListener('click', handleModalCloseButtonClick);
            btn.addEventListener('click', handleModalCloseButtonClick);
        } else {
            console.warn("Close button found without a parent .modal or modal ID:", btn);
        }
    });

    // Generic modal overlay click handler
    document.querySelectorAll('#admin-content .modal').forEach(modal => {
        if (modal.id) {
            if (!adminModals[modal.id]) {
                adminModals[modal.id] = modal;
            }
            // Remove existing listener before adding a new one
            modal.removeEventListener('click', handleModalOverlayClick);
            modal.addEventListener('click', handleModalOverlayClick);
        } else {
            console.warn("Modal element found without an ID:", modal);
        }
    });
    console.log("Admin UI Helpers Initialized.");
}

/**
 * Event handler for modal close buttons.
 * @param {Event} event - The click event.
 */
function handleModalCloseButtonClick(event) {
    const modalElement = event.currentTarget.closest('.modal');
    if (modalElement && modalElement.id) {
        closeModal(modalElement.id);
    }
}

/**
 * Event handler for modal overlay clicks.
 * @param {Event} event - The click event.
 */
function handleModalOverlayClick(event) {
    // `this` refers to the modal element the listener was attached to.
    if (event.target === this && this.id) {
        closeModal(this.id);
    }
}


/**
 * Opens a specific admin modal.
 * @param {string} modalId - The ID of the modal to open.
 */
export function openModal(modalId) {
    const modal = adminModals[modalId] || document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active-modal');
        if (modal.hasAttribute('style') && modal.style.display === 'none') {
            modal.style.display = ''; // Clear inline display:none if present from HTML
        }
        if (!adminModals[modalId]) adminModals[modalId] = modal;
    } else {
        console.warn(`Modal with ID "${modalId}" not found.`);
    }
}

/**
 * Closes a specific admin modal.
 * @param {string} modalId - The ID of the modal to close.
 */
export function closeModal(modalId) {
    const modal = adminModals[modalId];
    if (modal) {
        modal.classList.remove('active-modal');
        // Default display:none for .modal class in CSS should hide it.
        // No need to set modal.style.display = 'none'; if CSS is correctly set up.
    } else {
        console.warn(`Modal with ID "${modalId}" not found or not cached for closing.`);
    }
}

/**
 * Populates a select element with options.
 * @param {HTMLSelectElement} selectElement - The select DOM element.
 * @param {Array<Object>} optionsArray - Array of { value: string, text: string } objects.
 * @param {string | null} [defaultText='選択してください...'] - Text for the default empty option. Pass null to omit.
 * @param {string} [selectedValue=''] - The value to pre-select.
 */
export function populateSelect(selectElement, optionsArray, defaultText = '選択してください...', selectedValue = '') {
    if (!selectElement) {
        console.warn("populateSelect: selectElement is null or undefined for options:", optionsArray);
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

    optionsArray.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.text;
        selectElement.appendChild(option);
    });

    if (Array.from(selectElement.options).some(opt => opt.value === currentValue)) {
        selectElement.value = currentValue;
    } else if (defaultText !== null) {
        selectElement.value = '';
    } else if (optionsArray.length > 0) {
        selectElement.value = optionsArray[0].value;
    }
}


/**
 * Creates and populates a container with checkbox items.
 * @param {HTMLElement} containerElement - The container to populate.
 * @param {Array<Object>} items - Array of { id: string, name: string, parentName?: string } objects for checkboxes.
 * @param {Array<string>} selectedIds - Array of IDs that should be checked.
 * @param {string} checkboxName - The name attribute for the checkboxes.
 * @param {string} idPrefix - A prefix for generating unique checkbox IDs.
 */
export function populateCheckboxGroup(containerElement, items, selectedIds = [], checkboxName, idPrefix = 'cb-') {
    if (!containerElement) {
        console.warn("populateCheckboxGroup: containerElement is null or undefined.");
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
        if (item.parentName) {
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
 * @param {HTMLElement} containerElement - The container to populate.
 * @param {Array<Object>} tags - Array of { id: string, name: string } tag objects.
 * @param {Array<string>} activeTagIds - Array of tag IDs that should be marked active.
 */
export function populateTagButtonSelector(containerElement, tags, activeTagIds = []) {
    if (!containerElement) {
        console.warn("populateTagButtonSelector: containerElement is null or undefined.");
        return;
    }
    containerElement.innerHTML = '';

    if (!tags || tags.length === 0) {
        containerElement.innerHTML = '<p>利用可能なタグがありません。</p>';
        return;
    }

    tags.forEach(tag => {
        const button = document.createElement('div');
        button.className = 'tag-filter admin-tag-select';
        button.textContent = tag.name;
        button.dataset.tagId = tag.id;
        if (activeTagIds.includes(tag.id)) {
            button.classList.add('active');
        }
        button.addEventListener('click', () => {
            button.classList.toggle('active');
        });
        containerElement.appendChild(button);
    });
}


/**
 * Gets an array of selected values from a group of checkboxes.
 * @param {HTMLElement} containerElement - The container holding the checkboxes.
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
 * @param {HTMLElement} containerElement - The container holding the tag buttons.
 * @returns {Array<string>} - Array of tag IDs of active tag buttons.
 */
export function getSelectedTagButtonValues(containerElement) {
    if (!containerElement) return [];
    return Array.from(containerElement.querySelectorAll('.tag-filter.admin-tag-select.active'))
        .map(btn => btn.dataset.tagId);
}


/**
 * Clears form fields within a given form or container element.
 * @param {HTMLElement} formElement - The form or container element.
 */
export function clearForm(formElement) {
    if (!formElement) {
        console.warn("clearForm: formElement is null or undefined.");
        return;
    }

    if (formElement.tagName === 'FORM') {
        formElement.reset();
    } else {
        const inputs = formElement.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            const type = input.type ? input.type.toLowerCase() : input.tagName.toLowerCase();
            switch (type) {
                case 'text':
                case 'password':
                case 'textarea':
                case 'hidden':
                case 'number':
                case 'email':
                case 'url':
                case 'search':
                case 'tel':
                    input.value = '';
                    break;
                case 'checkbox':
                case 'radio':
                    input.checked = false;
                    break;
                case 'select-one':
                case 'select-multiple':
                case 'select':
                    input.selectedIndex = -1;
                    if (input.options.length > 0 && input.options[0].value === "") {
                        input.selectedIndex = 0;
                    }
                    break;
                case 'file':
                    input.value = null;
                    break;
                default:
                    // console.log("Clearing unknown input type:", type, input);
                    break;
            }
            if (input.tagName === 'SELECT') {
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    }
    formElement.querySelectorAll('.active[data-tag-id], .active[data-parent-id]').forEach(activeEl => {
        activeEl.classList.remove('active');
    });
}

/**
 * Generates a simple unique ID. Not for cryptographic purposes.
 * @param {string} [prefix='uid-'] - Optional prefix for the ID.
 * @returns {string}
 */
function simpleUID(prefix = 'uid-') { // This was added here temporarily, ideally from utils.js
    return prefix + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}
