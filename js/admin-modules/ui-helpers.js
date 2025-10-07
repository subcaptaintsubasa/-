// js/admin-modules/ui-helpers.js
// Contains helper functions for common UI tasks in the admin panel,
// such as modal handling, populating selects, rendering list items, etc.

const adminModals = {}; 

export function initUIHelpers() {
    console.log("[ui-helpers] initUIHelpers called");

    const closeButtons = document.querySelectorAll('body#admin-page .modal .close-button');
    closeButtons.forEach((btn) => {
        const modalElementForListener = btn.closest('.modal');
        if (modalElementForListener && modalElementForListener.id) {
            if (!adminModals[modalElementForListener.id]) {
                adminModals[modalElementForListener.id] = modalElementForListener;
            }
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', () => {
                const parentModal = newBtn.closest('.modal');
                if (parentModal && parentModal.id) {
                    closeModal(parentModal.id); 
                } else {
                    console.error("[ui-helpers] Could not find parent .modal for clicked close button:", newBtn);
                }
            });
        }
    });

    const allModalsForOverlay = document.querySelectorAll('body#admin-page .modal');
    allModalsForOverlay.forEach((modal) => {
        if (modal.id) {
            if (!adminModals[modal.id]) {
                adminModals[modal.id] = modal;
            }
            const newModal = modal.cloneNode(false); 
            while (modal.firstChild) {
                newModal.appendChild(modal.firstChild);
            }
            if (modal.parentNode) { 
                modal.parentNode.replaceChild(newModal, modal);
            }
            adminModals[modal.id] = newModal; 

            newModal.addEventListener('click', function(event) {
                if (event.target === this && this.id) {
                    closeModal(this.id);
                }
            });
        }
    });
}

export function openModal(modalId) {
    const modal = adminModals[modalId] || document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active-modal');
        if (!adminModals[modalId]) adminModals[modalId] = modal;
    } else {
        console.warn(`Modal with ID "${modalId}" not found.`);
    }
}

export function closeModal(modalId) {
    console.log(`[ui-helpers] closeModal called for: ${modalId}`);
    const modal = adminModals[modalId] || document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active-modal');
    } else {
        console.warn(`Modal with ID "${modalId}" not found or not cached for closing.`);
    }
}

export function populateSelect(selectElement, optionsArray, defaultText = '選択してください...', selectedValue = '') {
    if (!selectElement) {
        console.warn("populateSelect: selectElement is null");
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
        return;
    }

    optionsArray.forEach(optData => {
        const option = document.createElement('option');
        option.value = optData.value;
        option.textContent = optData.text;
        for (const key in optData) {
            if (key.startsWith('data-')) {
                option.dataset[key.substring(5)] = optData[key];
            }
        }
        selectElement.appendChild(option);
    });

    if (Array.from(selectElement.options).some(opt => opt.value === currentValue)) {
        selectElement.value = currentValue;
    } else if (defaultText !== null && selectElement.options[0]) {
        selectElement.value = selectElement.options[0].value;
    } else if (optionsArray.length > 0 && selectElement.options[0]) {
         selectElement.value = selectElement.options[0].value;
    }
}

export function populateCheckboxGroup(containerElement, items, selectedIds = [], checkboxName, idPrefix = 'cb-') {
    if (!containerElement) {
        console.warn("populateCheckboxGroup: containerElement is null");
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

export function populateTagButtonSelector(containerElement, tagsData, activeTagIds = [], datasetKey = 'tagId') {
    if (!containerElement) {
        console.warn("populateTagButtonSelector: containerElement is null");
        return;
    }
    containerElement.innerHTML = '';

    if (!tagsData || tagsData.length === 0) {
        containerElement.innerHTML = '<p>利用可能な選択肢がありません。</p>';
        return;
    }

    tagsData.forEach(tag => {
        const button = document.createElement('div'); 
        button.className = 'tag-filter admin-tag-select';
        button.textContent = tag.name;
        button.dataset[datasetKey] = tag.id; 
        if (activeTagIds.includes(tag.id)) {
            button.classList.add('active');
        }
        button.setAttribute('role', 'button'); 
        button.setAttribute('tabindex', '0');   
        button.addEventListener('click', () => {
            button.classList.toggle('active');
        });
        button.addEventListener('keydown', (e) => { 
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                button.classList.toggle('active');
            }
        });
        containerElement.appendChild(button);
    });
}

export function getSelectedCheckboxValues(containerElement, checkboxName) {
    if (!containerElement) return [];
    return Array.from(containerElement.querySelectorAll(`input[type="checkbox"][name="${checkboxName}"]:checked`))
        .map(cb => cb.value);
}

export function getSelectedTagButtonValues(containerElement, datasetKey = 'tagId') {
    if (!containerElement) {
        return [];
    }
    const selector = `.tag-filter.admin-tag-select.active[data-${datasetKey}]`;

    const activeButtons = containerElement.querySelectorAll(selector);
    
    const values = Array.from(activeButtons).map(btn => btn.dataset[datasetKey]);
    
    console.log(`[ui-helpers] Found ${values.length} active tags with selector "${selector}":`, values);
    return values;
}

function simpleUID(prefix = 'uid-') {
    return prefix + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}
