// js/admin-modules/ui-helpers.js
// Contains helper functions for common UI tasks in the admin panel,
// such as modal handling, populating selects, rendering list items, etc.

const adminModals = {}; // Cache for admin modal elements: { modalId: element }

/**
 * Initializes common UI helper functionalities.
 * Focuses on generic modal close behavior.
 */
export function initUIHelpers() {
    console.log("[ui-helpers] Initializing UI helpers for admin panel...");

    const allModals = document.querySelectorAll('body#admin-page div.modal');
    console.log(`[ui-helpers] Found ${allModals.length} modal elements.`);

    allModals.forEach((modal) => {
        if (!modal.id) {
            console.warn(`[ui-helpers] Modal element found without an ID, skipping event listener attachment:`, modal);
            return;
        }
        if (modal.dataset.uiHelperInit === 'true') {
            return;
        }
        adminModals[modal.id] = modal;
        modal.dataset.uiHelperInit = 'true';

        const closeButton = modal.querySelector('.close-button');
        if (closeButton) {
            closeButton.addEventListener('click', (event) => {
                console.log(`[ui-helpers] Close button clicked for modal: ${modal.id}`);
                closeModal(modal.id);
                event.stopPropagation();
            });
        }

        modal.addEventListener('click', function(event) {
            if (event.target === modal) {
                console.log(`[ui-helpers] Overlay click detected for modal '${modal.id}'. Closing.`);
                closeModal(modal.id);
            }
        });
    });
    console.log("[ui-helpers] UI Helper initialization complete. Cached modals:", Object.keys(adminModals).length);
}

/**
 * Opens a specific admin modal.
 * @param {string} modalId - The ID of the modal to open.
 */
export function openModal(modalId) {
    console.log(`[ui-helpers] Attempting to open modal: ${modalId}`);
    const modal = adminModals[modalId] || document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => {
            modal.classList.add('active-modal');
        }, 10);

        if (!adminModals[modalId]) adminModals[modalId] = modal;
        console.log(`[ui-helpers] Modal '${modalId}' opened and class 'active-modal' added.`);
    } else {
        console.warn(`[ui-helpers] Modal with ID "${modalId}" not found for opening.`);
    }
}

/**
 * Closes a specific admin modal.
 * @param {string} modalId - The ID of the modal to close.
 */
export function closeModal(modalId) {
    console.log(`[ui-helpers] Attempting to close modal: ${modalId}`);
    const modal = adminModals[modalId] || document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active-modal');
        const handleTransitionEnd = () => {
            if (!modal.classList.contains('active-modal')) {
                 modal.style.display = 'none';
            }
            modal.removeEventListener('transitionend', handleTransitionEnd);
        };
        const modalTransitionDuration = parseFloat(getComputedStyle(modal).transitionDuration) * 1000;
        if (modalTransitionDuration > 0 && !isNaN(modalTransitionDuration)) { // Ensure duration is a valid number
            modal.addEventListener('transitionend', handleTransitionEnd);
        } else {
             modal.style.display = 'none';
        }

        console.log(`[ui-helpers] Modal '${modalId}' closed and class 'active-modal' removed.`);
        const event = new CustomEvent('adminModalClosed', { detail: { modalId: modalId } });
        document.dispatchEvent(event);
    } else {
        console.warn(`[ui-helpers] Modal with ID "${modalId}" not found for closing.`);
    }
}

/**
 * Populates a select element with options.
 * @param {HTMLSelectElement | null} selectElement - The select DOM element.
 * @param {Array<Object>} optionsArray - Array of { value: string, text: string, [dataKey: string]: string } objects, where dataKey starts with 'data-'.
 * @param {string | null} [defaultText='選択してください...'] - Text for the default empty option. Pass null to omit.
 * @param {string} [selectedValue=''] - The value to pre-select.
 */
export function populateSelect(selectElement, optionsArray, defaultText = '選択してください...', selectedValue = '') {
    if (!selectElement) {
        console.warn("[ui-helpers] populateSelect: selectElement is null for defaultText:", defaultText);
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
        console.warn("[ui-helpers] populateSelect: optionsArray is invalid for selectElement:", selectElement.id);
        return;
    }

    optionsArray.forEach(optData => {
        const option = document.createElement('option');
        option.value = optData.value;
        option.textContent = optData.text;
        // Add any additional data attributes from the optData object
        for (const key in optData) {
            if (optData.hasOwnProperty(key) && key.startsWith('data-')) {
                // Convert 'data-foo-bar' to 'fooBar' for dataset property
                const datasetKey = toCamelCase(key.substring(5));
                option.dataset[datasetKey] = optData[key];
            }
        }
        selectElement.appendChild(option);
    });

    if (Array.from(selectElement.options).some(opt => opt.value === currentValue)) {
        selectElement.value = currentValue;
    } else if (defaultText !== null) {
        selectElement.value = '';
    } else if (optionsArray.length > 0 && selectElement.options[0]) {
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
        console.warn("[ui-helpers] populateCheckboxGroup: containerElement is null for checkboxName:", checkboxName);
        return;
    }
    containerElement.innerHTML = '';

    if (!items || items.length === 0) {
        containerElement.innerHTML = '<p style="font-size:0.9em; color: #6c757d;">利用可能な選択肢がありません。</p>';
        return;
    }

    items.forEach(item => {
        const safeContainerId = containerElement.id ? containerElement.id.replace(/\W/g, '') : simpleUID('container');
        const checkboxId = `${idPrefix}${item.id}-${safeContainerId}`;
        const checkboxWrapper = document.createElement('div');
        checkboxWrapper.classList.add('checkbox-item');

        let labelContent = [];
        const mainLabelText = document.createTextNode(item.name);
        labelContent.push(mainLabelText);

        if (item.parentName) {
            const small = document.createElement('small');
            small.textContent = ` (親: ${item.parentName})`;
            labelContent.push(small);
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
        labelContent.forEach(node => label.appendChild(node));

        checkboxWrapper.appendChild(input);
        checkboxWrapper.appendChild(label);
        containerElement.appendChild(checkboxWrapper);
    });
}

/**
 * Creates and populates a container with selectable tag-like buttons.
 * @param {HTMLElement | null} containerElement - The container to populate.
 * @param {Array<Object>} items - Array of { id: string, name: string } items.
 * @param {Array<string>} activeItemIds - Array of item IDs that should be marked active.
 * @param {string} [dataAttributeName='tagId'] - The name of the data attribute to store the item's ID (without 'data-').
 */
export function populateTagButtonSelector(containerElement, items, activeItemIds = [], dataAttributeName = 'tagId') {
    if (!containerElement) {
        console.warn("[ui-helpers] populateTagButtonSelector: containerElement is null.");
        return;
    }
    containerElement.innerHTML = '';

    if (!items || items.length === 0) {
        containerElement.innerHTML = '<p style="font-size:0.9em; color: #6c757d;">利用可能な選択肢がありません。</p>';
        return;
    }

    items.forEach(item => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'tag-filter admin-tag-select';
        button.textContent = item.name;
        button.dataset[toCamelCase(dataAttributeName)] = item.id;
        if (activeItemIds.includes(item.id)) {
            button.classList.add('active');
        }
        button.addEventListener('click', (e) => {
            e.preventDefault();
            button.classList.toggle('active');
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
 * Gets an array of selected IDs from a tag button selector.
 * @param {HTMLElement | null} containerElement - The container holding the tag buttons.
 * @param {string} [dataAttributeName='tagId'] - The name of the data attribute storing the ID (without 'data-').
 * @returns {Array<string>} - Array of IDs of active tag buttons.
 */
export function getSelectedTagButtonValues(containerElement, dataAttributeName = 'tagId') {
    if (!containerElement) return [];
    return Array.from(containerElement.querySelectorAll('.tag-filter.admin-tag-select.active'))
        .map(btn => btn.dataset[toCamelCase(dataAttributeName)]);
}


/**
 * Clears form fields within a given form or container element.
 * @param {HTMLElement | null} formElement - The form or container element.
 */
export function clearForm(formElement) {
    if (!formElement) {
        return;
    }

    if (formElement.tagName === 'FORM' && typeof formElement.reset === 'function') {
        formElement.reset();
    } else {
        const inputs = formElement.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            const type = input.type ? input.type.toLowerCase() : input.tagName.toLowerCase();
            switch (type) {
                case 'text': case 'password': case 'textarea': case 'hidden':
                case 'number': case 'email': case 'url': case 'search': case 'tel':
                    input.value = ''; break;
                case 'checkbox': case 'radio':
                    input.checked = false; break;
                case 'select-one': case 'select-multiple': case 'select':
                    input.selectedIndex = -1;
                    if (input.options.length > 0 && input.options[0].value === "") {
                        input.selectedIndex = 0;
                    }
                    break;
                case 'file':
                    input.value = null;
                    break;
                default:
                    break;
            }
            if (input.tagName === 'SELECT') {
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    }
    formElement.querySelectorAll('.active[data-tag-id], .active[data-parent-id], .category-select-button.active').forEach(activeEl => {
        activeEl.classList.remove('active');
    });
    const itemImagePreview = formElement.querySelector('#itemImagePreview');
    if (itemImagePreview) {
        itemImagePreview.style.display = 'none';
        itemImagePreview.src = '#';
    }
    const currentEffectsList = formElement.querySelector('#currentEffectsList');
    if (currentEffectsList) {
        currentEffectsList.innerHTML = '<p>効果が追加されていません。</p>';
    }
}

/**
 * Generates a simple unique ID. Not for cryptographic purposes.
 * @param {string} [prefix='uid-'] - Optional prefix for the ID.
 * @returns {string}
 */
function simpleUID(prefix = 'uid-') {
    return prefix + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

/**
 * Converts a kebab-case string to camelCase.
 * e.g., 'foo-bar' -> 'fooBar'
 * @param {string} str - The string to convert.
 * @returns {string}
 */
function toCamelCase(str) {
    if (typeof str !== 'string') return '';
    return str.toLowerCase().replace(/-(.)/g, (match, group1) => group1.toUpperCase());
}
