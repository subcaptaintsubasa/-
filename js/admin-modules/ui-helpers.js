// js/admin-modules/ui-helpers.js
// Contains helper functions for common UI tasks in the admin panel,
// such as modal handling, populating selects, rendering list items, etc.

const adminModals = {}; // Cache for admin modal elements: { modalId: element }

/**
 * Initializes common UI helper functionalities.
 * Focuses on generic modal close behavior.
 */
export function initUIHelpers() {
    console.log("[ui-helpers] initUIHelpers called"); // ★デバッグログ

    // Generic modal close button handler
    const closeButtons = document.querySelectorAll('#admin-content .modal .close-button');
    console.log("[ui-helpers] Close buttons found by querySelectorAll:", closeButtons.length, closeButtons); // ★デバッグログ
    closeButtons.forEach((btn, index) => {
        console.log(`[ui-helpers] Processing close button #${index}:`, btn); // ★どのボタンか特定
        const modalElementForListener = btn.closest('.modal');
        if (modalElementForListener && modalElementForListener.id) {
            if (!adminModals[modalElementForListener.id]) {
                adminModals[modalElementForListener.id] = modalElementForListener;
            }
            // イベントリスナーを一度削除してから追加（重複防止の試みだが、通常はinitUIHelpersが一度しか呼ばれないなら不要）
            // btn.removeEventListener('click', handleModalCloseButtonClick); // 名前付き関数での削除は一旦保留
            btn.addEventListener('click', (event) => { // ★デバッグのため一時的に匿名関数に戻す
                const clickedButton = event.currentTarget;
                const parentModal = clickedButton.closest('.modal');
                console.log("[ui-helpers] Close button CLICKED:", clickedButton); // ★デバッグログ
                console.log("[ui-helpers] Parent modal found for click:", parentModal); // ★デバッグログ
                if (parentModal && parentModal.id) {
                    closeModal(parentModal.id);
                } else {
                    console.error("[ui-helpers] Could not find parent .modal for clicked close button:", clickedButton);
                }
            });
            console.log(`[ui-helpers] SUCCESSFULLY Added click listener to close button for modal '${modalElementForListener.id}'. Button:`, btn); // ★デバッグログ
        } else {
            console.warn("[ui-helpers] Close button SKIPPED (no valid parent .modal with ID, or button not in modal). Button:", btn, "Found parent modal:", modalElementForListener); // ★デバッグログ
        }
    });

    // Generic modal overlay click handler
    const allModalsForOverlay = document.querySelectorAll('#admin-content .modal');
    console.log("[ui-helpers] Modals found for overlay click:", allModalsForOverlay.length, allModalsForOverlay); // ★デバッグログ
    allModalsForOverlay.forEach((modal, index) => {
        console.log(`[ui-helpers] Processing modal #${index} for overlay click:`, modal); // ★どのモーダルか特定
        if (modal.id) {
            if (!adminModals[modal.id]) {
                adminModals[modal.id] = modal;
            }
            // modal.removeEventListener('click', handleModalOverlayClick); // 名前付き関数での削除は一旦保留
            modal.addEventListener('click', function(event) { // ★デバッグのため一時的に匿名関数に戻す (this を使うため function キーワード)
                // console.log("[ui-helpers] Modal overlay area clicked. Target:", event.target, "CurrentTarget (this):", this); // より詳細なログが必要な場合
                if (event.target === this && this.id) { // Check if the click is directly on the modal overlay and it has an ID
                    console.log(`[ui-helpers] Overlay click detected for modal '${this.id}'. Closing.`); // ★デバッグログ
                    closeModal(this.id);
                }
            });
            console.log(`[ui-helpers] SUCCESSFULLY Added overlay click listener for modal '${modal.id}'.`); // ★デバッグログ
        } else {
            console.warn("[ui-helpers] Modal element found without an ID, cannot attach overlay click listener:", modal); // ★デバッグログ
        }
    });
    console.log("Admin UI Helpers Initialized with enhanced debug logs.");
}

/**
 * Opens a specific admin modal.
 * @param {string} modalId - The ID of the modal to open.
 */
export function openModal(modalId) {
    console.log(`[ui-helpers] openModal called for: ${modalId}`);
    const modal = adminModals[modalId] || document.getElementById(modalId);
    if (modal) {
        console.log(`[ui-helpers] Modal element to open:`, modal);
        console.log(`[ui-helpers] Current classes before add: ${modal.className}`);
        modal.classList.add('active-modal');
        console.log(`[ui-helpers] Current classes after add: ${modal.className}`);
        // Clear inline display:none if it was set in HTML, so class rule can take over
        if (modal.hasAttribute('style') && modal.style.display === 'none') {
            modal.style.display = '';
        }
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
    console.log(`[ui-helpers] closeModal called for: ${modalId}`);
    const modal = adminModals[modalId];
    if (modal) {
        console.log(`[ui-helpers] Modal to close:`, modal);
        console.log(`[ui-helpers] Classes before remove: ${modal.className}`);
        modal.classList.remove('active-modal');
        console.log(`[ui-helpers] Classes after remove: ${modal.className}`);
        // CSS rule for .modal (without .active-modal) should handle display:none
    } else {
        console.warn(`Modal with ID "${modalId}" not found or not cached for closing.`);
    }
}

/**
 * Populates a select element with options.
 * @param {HTMLSelectElement | null} selectElement - The select DOM element.
 * @param {Array<Object>} optionsArray - Array of { value: string, text: string } objects.
 * @param {string | null} [defaultText='選択してください...'] - Text for the default empty option. Pass null to omit.
 * @param {string} [selectedValue=''] - The value to pre-select.
 */
export function populateSelect(selectElement, optionsArray, defaultText = '選択してください...', selectedValue = '') {
    if (!selectElement) {
        // console.warn("populateSelect: selectElement is null or undefined. Cannot populate options:", optionsArray);
        return;
    }
    const currentValue = selectElement.value || selectedValue;

    selectElement.innerHTML = ''; // Clear existing options
    if (defaultText !== null) {
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = defaultText;
        selectElement.appendChild(defaultOption);
    }

    if (!optionsArray || !Array.isArray(optionsArray)) {
        // console.warn("populateSelect: optionsArray is not a valid array for selectElement:", selectElement.id || selectElement);
        return;
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
    } else if (defaultText !== null) {
        selectElement.value = ''; // Fallback to default empty option if it exists
    } else if (optionsArray.length > 0 && selectElement.options[0]) { // Ensure options[0] exists
        selectElement.value = selectElement.options[0].value; // Select first actual option
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
        // console.warn("populateCheckboxGroup: containerElement is null or undefined.");
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
 * @param {HTMLElement | null} containerElement - The container to populate.
 * @param {Array<Object>} tags - Array of { id: string, name: string } tag objects.
 * @param {Array<string>} activeTagIds - Array of tag IDs that should be marked active.
 */
export function populateTagButtonSelector(containerElement, tags, activeTagIds = []) {
    if (!containerElement) {
        // console.warn("populateTagButtonSelector: containerElement is null or undefined.");
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
 * @returns {Array<string>} - Array of tag IDs of active tag buttons.
 */
export function getSelectedTagButtonValues(containerElement) {
    if (!containerElement) return [];
    return Array.from(containerElement.querySelectorAll('.tag-filter.admin-tag-select.active'))
        .map(btn => btn.dataset.tagId);
}


/**
 * Clears form fields within a given form or container element.
 * @param {HTMLElement | null} formElement - The form or container element.
 */
export function clearForm(formElement) {
    if (!formElement) {
        // console.warn("clearForm: formElement is null or undefined.");
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
                    input.selectedIndex = -1; // Deselect all options
                    // If there's a default empty option (usually the first one with value="")
                    if (input.options.length > 0 && input.options[0].value === "") {
                        input.selectedIndex = 0;
                    }
                    break;
                case 'file':
                    input.value = null; // For file inputs
                    break;
                default:
                    // For other input types, this might not be sufficient
                    // console.log("Clearing unknown input type or unhandled case:", type, input);
                    break;
            }
            // Trigger change event for selects if needed for dependent UI updates
            if (input.tagName === 'SELECT') {
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    }
    // Clear any custom "active" states on buttons if they are part of the form
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
