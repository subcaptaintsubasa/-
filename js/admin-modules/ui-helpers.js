// js/admin-modules/ui-helpers.js
const adminModals = {};
let adminSideNavEl, adminHamburgerButtonEl, adminCloseNavButtonEl;

export function initUIHelpers() {
    console.log("[ui-helpers] initUIHelpers called");
    document.querySelectorAll('body#admin-page .modal .close-button').forEach(btn => {
        const modalElement = btn.closest('.modal');
        if (modalElement && modalElement.id) {
            if (!adminModals[modalElement.id]) {
                adminModals[modalElement.id] = modalElement;
            }
            btn.addEventListener('click', () => closeModal(modalElement.id));
        } else {
            console.warn("Close button found without a parent .modal or modal ID:", btn);
        }
    });

    document.querySelectorAll('body#admin-page .modal').forEach(modal => {
        if (modal.id) {
            if (!adminModals[modal.id]) {
                adminModals[modal.id] = modal;
            }
            modal.addEventListener('click', function(event) {
                if (event.target === this && this.id) {
                    closeModal(this.id);
                }
            });
        } else {
            console.warn("Modal element found without an ID, cannot attach overlay click:", modal);
        }
    });
    console.log("Admin UI Helpers Initialized.");
}

export function initAdminNavigation() {
    console.log("[ui-helpers] initAdminNavigation called");
    adminSideNavEl = document.getElementById('adminSideNav');
    adminHamburgerButtonEl = document.getElementById('adminHamburgerButton');
    adminCloseNavButtonEl = document.getElementById('adminCloseNavButton');
    const itemManagementSectionEl = document.getElementById('item-management'); // Get item management section

    if (adminHamburgerButtonEl && adminSideNavEl) {
        adminHamburgerButtonEl.addEventListener('click', () => {
            console.log("[ui-helpers] Admin hamburger clicked");
            adminSideNavEl.classList.add('open');
        });
    } else {
        console.warn("[ui-helpers] Admin hamburger button or side nav not found.");
    }

    if (adminCloseNavButtonEl && adminSideNavEl) {
        adminCloseNavButtonEl.addEventListener('click', () => {
            console.log("[ui-helpers] Admin close nav clicked");
            adminSideNavEl.classList.remove('open');
        });
    } else {
        console.warn("[ui-helpers] Admin close nav button or side nav not found.");
    }

    if (adminSideNavEl) {
        const navButtons = adminSideNavEl.querySelectorAll('.admin-nav-button');
        navButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                const clickedButton = event.currentTarget;
                const targetModalId = clickedButton.dataset.modalTarget;
                const targetViewId = clickedButton.dataset.viewTarget;

                navButtons.forEach(btn => btn.classList.remove('active-nav-item'));
                clickedButton.classList.add('active-nav-item');

                // Hide all management modals first
                document.querySelectorAll('.modal.admin-management-modal.active-modal').forEach(m => {
                    closeModal(m.id);
                });
                // Hide item management section by default if it's not the target
                if (itemManagementSectionEl && targetViewId !== 'item-management') {
                    itemManagementSectionEl.style.display = 'none';
                }


                if (targetModalId) {
                    console.log(`[ui-helpers] Admin nav button clicked for modal: ${targetModalId}`);
                    openModal(targetModalId);
                } else if (targetViewId) {
                    console.log(`[ui-helpers] Admin nav button clicked for view: ${targetViewId}`);
                    if (targetSectionEl = document.getElementById(targetViewId)) {
                        targetSectionEl.style.display = 'block'; // Or 'flex' or whatever its default is
                    }
                }
                if (adminSideNavEl) adminSideNavEl.classList.remove('open');
            });
        });
    } else {
        console.warn("[ui-helpers] Admin side nav not found for nav button listeners.");
    }
}

export function openModal(modalId) {
    const modal = adminModals[modalId] || document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active-modal');
        if (modal.hasAttribute('style') && modal.style.display === 'none') {
            modal.style.display = '';
        }
        if (!adminModals[modalId]) adminModals[modalId] = modal;
    } else {
        console.warn(`Modal with ID "${modalId}" not found.`);
    }
}

export function closeModal(modalId) {
    const modal = adminModals[modalId];
    if (modal) {
        modal.classList.remove('active-modal');
    } else {
        console.warn(`Modal with ID "${modalId}" not found or not cached for closing.`);
    }
}

export function populateSelect(selectElement, optionsArray, defaultText = '選択してください...', selectedValue = '') {
    if (!selectElement) { return; }
    const currentValue = selectElement.value || selectedValue;
    selectElement.innerHTML = '';
    if (defaultText !== null) {
        const defaultOption = document.createElement('option');
        defaultOption.value = ''; defaultOption.textContent = defaultText;
        selectElement.appendChild(defaultOption);
    }
    if (!optionsArray || !Array.isArray(optionsArray)) { return; }
    optionsArray.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value; option.textContent = opt.text;
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

export function populateCheckboxGroup(containerElement, items, selectedIds = [], checkboxName, idPrefix = 'cb-') {
    if (!containerElement) { return; }
    containerElement.innerHTML = '';
    if (!items || items.length === 0) {
        containerElement.innerHTML = '<p>利用可能な選択肢がありません。</p>'; return;
    }
    items.forEach(item => {
        const safeContainerId = containerElement.id ? containerElement.id.replace(/\W/g, '') : simpleUID('container');
        const checkboxId = `${idPrefix}${item.id}-${safeContainerId}`;
        const checkboxWrapper = document.createElement('div');
        checkboxWrapper.classList.add('checkbox-item');
        let labelText = item.name;
        if (item.parentName) { labelText += ` (親: ${item.parentName})`; }
        const input = document.createElement('input');
        input.type = 'checkbox'; input.id = checkboxId; input.name = checkboxName; input.value = item.id;
        if (selectedIds.includes(item.id)) { input.checked = true; }
        const label = document.createElement('label');
        label.htmlFor = checkboxId; label.textContent = labelText;
        checkboxWrapper.appendChild(input); checkboxWrapper.appendChild(label);
        containerElement.appendChild(checkboxWrapper);
    });
}

export function populateTagButtonSelector(containerElement, tags, activeTagIds = []) {
    if (!containerElement) { return; }
    containerElement.innerHTML = '';
    if (!tags || tags.length === 0) {
        containerElement.innerHTML = '<p>利用可能なタグがありません。</p>'; return;
    }
    tags.forEach(tag => {
        const button = document.createElement('div');
        button.className = 'tag-filter admin-tag-select'; button.textContent = tag.name; button.dataset.tagId = tag.id;
        if (activeTagIds.includes(tag.id)) { button.classList.add('active'); }
        button.addEventListener('click', () => button.classList.toggle('active'));
        containerElement.appendChild(button);
    });
}

export function getSelectedCheckboxValues(containerElement, checkboxName) {
    if (!containerElement) return [];
    return Array.from(containerElement.querySelectorAll(`input[type="checkbox"][name="${checkboxName}"]:checked`)).map(cb => cb.value);
}

export function getSelectedTagButtonValues(containerElement) {
    if (!containerElement) return [];
    return Array.from(containerElement.querySelectorAll('.tag-filter.admin-tag-select.active')).map(btn => btn.dataset.tagId);
}

export function clearForm(formElement) {
    if (!formElement) { return; }
    if (formElement.tagName === 'FORM') { formElement.reset(); }
    else {
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
                    if (input.options.length > 0 && input.options[0].value === "") { input.selectedIndex = 0; }
                    break;
                case 'file': input.value = null; break;
            }
            if (input.tagName === 'SELECT') { input.dispatchEvent(new Event('change', { bubbles: true })); }
        });
    }
    formElement.querySelectorAll('.active[data-tag-id], .active[data-parent-id]').forEach(activeEl => activeEl.classList.remove('active'));
}

function simpleUID(prefix = 'uid-') {
    return prefix + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}
