// js/admin-modules/ui-helpers.js
const adminModals = {};

export function initUIHelpers() {
    console.log("[ui-helpers] Initializing UI helpers for admin panel...");
    const allModals = document.querySelectorAll('body#admin-page div.modal');
    console.log(`[ui-helpers] Found ${allModals.length} modal elements.`);
    allModals.forEach((modal) => {
        if (!modal.id) {
            console.warn(`[ui-helpers] Modal element found without an ID, skipping event listener attachment:`, modal);
            return;
        }
        if (modal.dataset.uiHelperInit === 'true') { return; }
        adminModals[modal.id] = modal;
        modal.dataset.uiHelperInit = 'true';
        const closeButton = modal.querySelector('.close-button');
        if (closeButton) {
            closeButton.addEventListener('click', (event) => {
                closeModal(modal.id);
                event.stopPropagation();
            });
        }
        modal.addEventListener('click', function(event) {
            if (event.target === modal) { closeModal(modal.id); }
        });
    });
    console.log("[ui-helpers] UI Helper initialization complete. Cached modals:", Object.keys(adminModals).length);
}

export function openModal(modalId) {
    console.log(`[ui-helpers] Attempting to open modal: ${modalId}`);
    const modal = adminModals[modalId] || document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => { modal.classList.add('active-modal'); }, 10);
        if (!adminModals[modalId]) adminModals[modalId] = modal;
        console.log(`[ui-helpers] Modal '${modalId}' opened and class 'active-modal' added.`);
    } else {
        console.warn(`[ui-helpers] Modal with ID "${modalId}" not found for opening.`);
    }
}

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
        if (modalTransitionDuration > 0 && !isNaN(modalTransitionDuration)) {
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

// ★★★ 新しい関数: 拡大表示用モーダルを開く ★★★
export function openEnlargedListModal(title, contentGenerator) {
    const modalId = 'listEnlargementModal';
    const modalTitleElement = document.getElementById('listEnlargementModalTitle');
    const modalContentElement = document.getElementById('listEnlargementModalContent');
    // const modalSearchContainer = document.getElementById('listEnlargementModalSearchContainer'); // 必要なら

    if (modalTitleElement && modalContentElement) {
        modalTitleElement.textContent = title;
        modalContentElement.innerHTML = ''; // Clear previous content
        
        if (typeof contentGenerator === 'function') {
            contentGenerator(modalContentElement); // コンテンツ生成関数を呼び出し、コンテナを渡す
        } else if (typeof contentGenerator === 'string') {
            modalContentElement.innerHTML = contentGenerator; // HTML文字列を直接セット
        } else if (contentGenerator instanceof HTMLElement) {
            modalContentElement.appendChild(contentGenerator.cloneNode(true)); // DOM要素のクローンを追加
        } else {
            modalContentElement.innerHTML = '<p>表示する内容がありません。</p>';
        }
        
        openModal(modalId);
    } else {
        console.error("Enlargement modal elements not found!");
    }
}


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
        for (const key in optData) {
            if (optData.hasOwnProperty(key) && key.startsWith('data-')) {
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
        input.type = 'checkbox'; input.id = checkboxId; input.name = checkboxName; input.value = item.id;
        if (selectedIds.includes(item.id)) { input.checked = true; }
        const label = document.createElement('label');
        label.htmlFor = checkboxId;
        labelContent.forEach(node => label.appendChild(node));
        checkboxWrapper.appendChild(input); checkboxWrapper.appendChild(label);
        containerElement.appendChild(checkboxWrapper);
    });
}

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
        button.type = 'button'; button.className = 'tag-filter admin-tag-select';
        button.textContent = item.name;
        button.dataset[toCamelCase(dataAttributeName)] = item.id;
        if (activeItemIds.includes(item.id)) { button.classList.add('active'); }
        button.addEventListener('click', (e) => { e.preventDefault(); button.classList.toggle('active'); });
        containerElement.appendChild(button);
    });
}

export function getSelectedCheckboxValues(containerElement, checkboxName) {
    if (!containerElement) return [];
    return Array.from(containerElement.querySelectorAll(`input[type="checkbox"][name="${checkboxName}"]:checked`))
        .map(cb => cb.value);
}

export function getSelectedTagButtonValues(containerElement, dataAttributeName = 'tagId') {
    if (!containerElement) return [];
    return Array.from(containerElement.querySelectorAll('.tag-filter.admin-tag-select.active'))
        .map(btn => btn.dataset[toCamelCase(dataAttributeName)]);
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

function simpleUID(prefix = 'uid-') {
    return prefix + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

function toCamelCase(str) {
    if (typeof str !== 'string') return '';
    return str.toLowerCase().replace(/-(.)/g, (match, group1) => group1.toUpperCase());
}
