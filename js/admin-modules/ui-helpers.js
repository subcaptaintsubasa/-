// js/admin-modules/ui-helpers.js
// Contains helper functions for common UI tasks in the admin panel,
// such as modal handling, populating selects, rendering list items, etc.

// This module will be populated with functions that are used by multiple manager.js files.
// For now, it can start with modal helpers if they are generic enough.

const adminModals = {}; // Cache for admin modal elements: { modalId: element }

/**
 * Initializes common UI helper functionalities.
 * Currently focuses on generic modal close behavior.
 */
export function initUIHelpers() {
    // Generic modal close button handler
    document.querySelectorAll('#admin-content .modal .close-button').forEach(btn => {
        const modal = btn.closest('.modal');
        if (modal) {
            adminModals[modal.id] = modal; // Cache modal element
            btn.addEventListener('click', () => closeModal(modal.id));
        }
    });

    // Generic modal overlay click handler
    document.querySelectorAll('#admin-content .modal').forEach(modal => {
        if (!adminModals[modal.id]) adminModals[modal.id] = modal; // Cache if not already
        modal.addEventListener('click', (event) => {
            if (event.target === modal) { // Clicked on modal backdrop
                closeModal(modal.id);
            }
        });
    });
    console.log("Admin UI Helpers Initialized.");
}

/**
 * Opens a specific admin modal.
 * @param {string} modalId - The ID of the modal to open.
 */
export function openModal(modalId) {
    const modal = adminModals[modalId] || document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        if (!adminModals[modalId]) adminModals[modalId] = modal; // Cache if opened directly
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
        modal.style.display = 'none';
        // Add any generic cleanup for modals if needed
    } else {
        console.warn(`Modal with ID "${modalId}" not found or not cached for closing.`);
    }
}

/**
 * Populates a select element with options.
 * @param {HTMLSelectElement} selectElement - The select DOM element.
 * @param {Array<Object>} optionsArray - Array of { value: string, text: string } objects.
 * @param {string} [defaultText='Select...'] - Text for the default empty option.
 * @param {string} [selectedValue=''] - The value to pre-select.
 */
export function populateSelect(selectElement, optionsArray, defaultText = '選択してください...', selectedValue = '') {
    if (!selectElement) return;
    const currentValue = selectElement.value || selectedValue; // Preserve current value if exists

    selectElement.innerHTML = ''; // Clear existing options
    if (defaultText) {
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

    // Try to re-select the previous or specified value
    if (Array.from(selectElement.options).some(opt => opt.value === currentValue)) {
        selectElement.value = currentValue;
    } else if (defaultText) {
        selectElement.value = ''; // Fallback to default empty option
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
    if (!containerElement) return;
    containerElement.innerHTML = '';

    if (items.length === 0) {
        containerElement.innerHTML = '<p>利用可能な選択肢がありません。</p>';
        return;
    }

    items.forEach(item => {
        const checkboxId = `${idPrefix}${item.id}-${containerElement.id.replace(/\W/g, '')}`;
        const checkboxWrapper = document.createElement('div');
        checkboxWrapper.classList.add('checkbox-item');

        let labelText = item.name;
        if (item.parentName) { // For child categories, show parent name
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
    if (!containerElement) return;
    containerElement.innerHTML = '';

    if (tags.length === 0) {
        containerElement.innerHTML = '<p>利用可能なタグがありません。</p>';
        return;
    }

    tags.forEach(tag => {
        const button = document.createElement('div');
        // Assuming styles for '.tag-filter.admin-tag-select' exist from admin-lists.css
        button.className = 'tag-filter admin-tag-select';
        button.textContent = tag.name;
        button.dataset.tagId = tag.id;
        if (activeTagIds.includes(tag.id)) {
            button.classList.add('active');
        }
        button.addEventListener('click', () => {
            button.classList.toggle('active');
            // The calling manager module will read the active state when saving.
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
    if (!formElement) return;

    // Native form reset for <form> elements
    if (formElement.tagName === 'FORM') {
        formElement.reset();
    } else { // For other containers, manually clear inputs
        const inputs = formElement.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            if (input.type === 'checkbox' || input.type === 'radio') {
                input.checked = false;
            } else if (input.type === 'file') {
                input.value = null;
            } else {
                input.value = '';
            }
            // Trigger change event for selects if needed for dependent UI updates
            if (input.tagName === 'SELECT') {
                input.dispatchEvent(new Event('change'));
            }
        });
    }
    // Clear any custom "active" states on buttons if they are part of the form
    formElement.querySelectorAll('.active[data-tag-id], .active[data-parent-id]').forEach(activeEl => {
        activeEl.classList.remove('active');
    });
    // Special handling for "Top Level" parent category button if it exists and needs reset
    const topLevelButton = formElement.querySelector('.category-select-button[data-parent-id=""]');
    if (topLevelButton && formElement.querySelector('.category-select-button.active') === null) {
        // If no parent is active, make "Top Level" active by default (depends on form logic)
        // topLevelButton.classList.add('active');
    }
}
