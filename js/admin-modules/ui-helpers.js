// js/admin-modules/ui-helpers.js

const adminModals = {}; 

export function initUIHelpers() {
    console.log("[ui-helpers] Initializing UI helpers for admin panel...");

    const allModals = document.querySelectorAll('body#admin-page div.modal');
    console.log(`[ui-helpers] Found ${allModals.length} modal elements.`);

    allModals.forEach((modal) => { // Removed index as it's not used
        if (!modal.id) {
            console.warn(`[ui-helpers] Modal element found without an ID, skipping event listener attachment:`, modal);
            return;
        }
        // Ensure we don't double-cache or attach multiple listeners if re-initialized
        if (adminModals[modal.id] && adminModals[modal.id].dataset.uiHelperInit === 'true') {
            // console.log(`[ui-helpers] Modal ${modal.id} already initialized. Skipping.`);
            return;
        }
        adminModals[modal.id] = modal; 
        modal.dataset.uiHelperInit = 'true'; // Mark as initialized

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

export function openModal(modalId) {
    console.log(`[ui-helpers] Attempting to open modal: ${modalId}`);
    const modal = adminModals[modalId] || document.getElementById(modalId); 
    if (modal) {
        modal.style.display = 'flex'; 
        // Add class after a very short delay to ensure transition happens
        setTimeout(() => {
            modal.classList.add('active-modal');
        }, 10); // Small delay, e.g., 10ms
        
        if (!adminModals[modalId]) adminModals[modalId] = modal; 
        console.log(`[ui-helpers] Modal '${modalId}' opened and class 'active-modal' added.`);
    } else {
        console.warn(`[ui-helpers] Modal with ID "${modalId}" not found for opening.`);
    }
}

export function closeModal(modalId) {
    console.log(`[ui-helpers] Attempting to close modal: ${modalId}`);
    const modal = adminModals[modalId] || document.getElementById(modalId); // Try cache first, then by ID
    if (modal) {
        modal.classList.remove('active-modal');
        // Listen for transition end to set display to none, if transitions are used for opacity/transform
        // Otherwise, set display to none directly or after a short timeout to allow fade-out
        // For simplicity here, direct hide or rely on CSS for .modal { display: none; }
        // If using a fade-out animation on .active-modal removal, use transitionend:
        const handleTransitionEnd = () => {
            if (!modal.classList.contains('active-modal')) { // Double check if it's still meant to be hidden
                 modal.style.display = 'none';
            }
            modal.removeEventListener('transitionend', handleTransitionEnd);
        };
        // Check if there's a transition duration set in CSS for the modal opacity or transform
        const modalTransitionDuration = parseFloat(getComputedStyle(modal).transitionDuration) * 1000;
        if (modalTransitionDuration > 0) {
            modal.addEventListener('transitionend', handleTransitionEnd);
        } else {
             modal.style.display = 'none'; // No transition, hide immediately
        }

        console.log(`[ui-helpers] Modal '${modalId}' closed and class 'active-modal' removed.`);

        const event = new CustomEvent('adminModalClosed', { detail: { modalId: modalId } });
        document.dispatchEvent(event);

    } else {
        console.warn(`[ui-helpers] Modal with ID "${modalId}" not found for closing.`);
    }
}

export function populateSelect(selectElement, optionsArray, defaultText = '選択してください...', selectedValue = '') {
    if (!selectElement) {
        console.warn("[ui-helpers] populateSelect: selectElement is null for defaultText:", defaultText);
        return;
    }
    const currentValue = selectElement.value || selectedValue; // Preserve current selection if possible

    selectElement.innerHTML = ''; // Clear existing options
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

    optionsArray.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.text;
        selectElement.appendChild(option);
    });

    // Try to re-select the previous value if it's still valid
    if (Array.from(selectElement.options).some(opt => opt.value === currentValue)) {
        selectElement.value = currentValue;
    } else if (defaultText !== null) { // Fallback to default if current value is no longer valid
        selectElement.value = '';
    } else if (optionsArray.length > 0 && selectElement.options[0]) { // Fallback to first actual option if no default
        selectElement.value = selectElement.options[0].value;
    }
}

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

export function populateTagButtonSelector(containerElement, tags, activeTagIds = []) {
    if (!containerElement) {
        console.warn("[ui-helpers] populateTagButtonSelector: containerElement is null.");
        return;
    }
    containerElement.innerHTML = '';

    if (!tags || tags.length === 0) {
        containerElement.innerHTML = '<p style="font-size:0.9em; color: #6c757d;">利用可能なタグがありません。</p>';
        return;
    }

    tags.forEach(tag => {
        const button = document.createElement('button'); 
        button.type = 'button'; 
        button.className = 'tag-filter admin-tag-select'; 
        button.textContent = tag.name;
        button.dataset.tagId = tag.id;
        if (activeTagIds.includes(tag.id)) {
            button.classList.add('active');
        }
        button.addEventListener('click', (e) => {
            e.preventDefault(); 
            button.classList.toggle('active');
        });
        containerElement.appendChild(button);
    });
}

export function getSelectedCheckboxValues(containerElement, checkboxName) {
    if (!containerElement) return [];
    return Array.from(containerElement.querySelectorAll(`input[type="checkbox"][name="${checkboxName}"]:checked`))
        .map(cb => cb.value);
}

export function getSelectedTagButtonValues(containerElement) {
    if (!containerElement) return [];
    return Array.from(containerElement.querySelectorAll('.tag-filter.admin-tag-select.active'))
        .map(btn => btn.dataset.tagId);
}

export function clearForm(formElement) {
    if (!formElement) return;
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
                    if (input.options.length > 0 && input.options[0].value === "") input.selectedIndex = 0;
                    break;
                case 'file': input.value = null; break;
            }
            if (input.tagName === 'SELECT') input.dispatchEvent(new Event('change', { bubbles: true }));
        });
    }
    formElement.querySelectorAll('.active[data-tag-id], .active[data-parent-id], .category-select-button.active').forEach(activeEl => {
        activeEl.classList.remove('active');
    });
     // Clear specific preview images or lists if needed, e.g., item image preview
    const itemImagePreview = formElement.querySelector('#itemImagePreview'); // Assuming formElement can be the itemForm
    if (itemImagePreview) {
        itemImagePreview.style.display = 'none';
        itemImagePreview.src = '#';
    }
    const currentEffectsList = formElement.querySelector('#currentEffectsList'); // Assuming formElement can be the itemForm
    if (currentEffectsList) {
        currentEffectsList.innerHTML = '<p>効果が追加されていません。</p>';
    }
}

function simpleUID(prefix = 'uid-') {
    return prefix + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}
