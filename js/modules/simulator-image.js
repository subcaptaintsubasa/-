// js/modules/simulator-image.js
// Handles generating and previewing/saving the simulator configuration as an image.
// Relies on html2canvas library.

// Dependencies (passed or imported from simulator-ui.js or data-loader.js)
let getSelectedCharacterBaseFunc = () => ({});
let getCharacterBasesCacheFunc = () => ({}); // Not strictly needed if names are in selectedCharacterBase
let getSelectedEquipmentFunc = () => ({});
let getAllItemsFunc = () => [];
let getTotalEffectsDisplayHTMLFunc = () => "";
let getSimulatorDOMSFunc = () => ({}); // To access export area elements

export function initSimulatorImage(dependencies) {
    getSelectedCharacterBaseFunc = dependencies.getSelectedCharacterBase;
    getCharacterBasesCacheFunc = dependencies.getCharacterBasesCache; // Potentially needed if option names aren't stored directly
    getSelectedEquipmentFunc = dependencies.getSelectedEquipment;
    getAllItemsFunc = dependencies.getAllItems;
    getTotalEffectsDisplayHTMLFunc = dependencies.getTotalEffectsDisplayHTML;
    getSimulatorDOMSFunc = dependencies.getSimulatorDOMS;


    const DOMS_IMG = getSimulatorDOMSFunc(); // Get DOM elements from simulator-ui

    if (DOMS_IMG.previewImageButton) {
        DOMS_IMG.previewImageButton.addEventListener('click', () => generateAndProcessImage(true));
    }

    if (DOMS_IMG.saveImageButton) {
        DOMS_IMG.saveImageButton.addEventListener('click', () => generateAndProcessImage(false));
    }
}

async function generateAndProcessImage(forPreview = false) {
    const DOMS_IMG = getSimulatorDOMSFunc();
    if (!DOMS_IMG.imageExportArea || !DOMS_IMG.exportCharBase || !DOMS_IMG.exportSlots || !DOMS_IMG.exportEffects) {
        console.error("Image export DOM elements not found.");
        alert("画像エクスポートに必要な要素が見つかりません。");
        return;
    }

    // 1. Populate Character Base Info for Export
    const selectedCharBase = getSelectedCharacterBaseFunc();
    DOMS_IMG.exportCharBase.innerHTML = '<h4>基礎情報:</h4>';
    let hasBaseInfo = false;
    const baseTypeDisplayNames = {
        headShape: "頭の形",
        correction: "補正",
        color: "色",
        pattern: "柄"
    };
    Object.entries(selectedCharBase).forEach(([baseTypeKey, selectedOption]) => {
        if (selectedOption && selectedOption.name) {
            const label = baseTypeDisplayNames[baseTypeKey] || baseTypeKey;
            DOMS_IMG.exportCharBase.innerHTML += `<div><strong>${label}:</strong> ${selectedOption.name}</div>`;
            hasBaseInfo = true;
        }
    });
    if (!hasBaseInfo && DOMS_IMG.exportCharBase.innerHTML === '<h4>基礎情報:</h4>') {
        DOMS_IMG.exportCharBase.innerHTML += '<div>選択なし</div>';
    }

    // 2. Populate Equipment Slots for Export
    const selectedEquipment = getSelectedEquipmentFunc();
    const allItems = getAllItemsFunc();
    DOMS_IMG.exportSlots.innerHTML = '';
    const equipmentSlotNames = ["服", "顔", "首", "腕", "背中", "足"]; // Should match simulator-ui
    equipmentSlotNames.forEach(slotName => {
        const itemId = selectedEquipment[slotName];
        let itemHtml = `<div class="export-slot-item"><strong>${slotName}:</strong> `;
        if (itemId) {
            const item = allItems.find(i => i.docId === itemId);
            itemHtml += item ?
                `<img src="${item.image || './images/placeholder_item.png'}" alt="" class="export-item-image" onerror="this.style.display='none';"> <span>${item.name || '(名称未設定)'}</span>` :
                '<span>エラー</span>';
        } else {
            itemHtml += '<span>なし</span>';
        }
        itemHtml += '</div>';
        DOMS_IMG.exportSlots.innerHTML += itemHtml;
    });

    // 3. Populate Total Effects for Export
    DOMS_IMG.exportEffects.innerHTML = getTotalEffectsDisplayHTMLFunc();

    // 4. Generate Canvas
    try {
        // Ensure images are loaded before capturing (simple timeout, more robust would be Promise.all on image.onload)
        await new Promise(resolve => setTimeout(resolve, 250)); // Small delay for images

        const canvas = await html2canvas(DOMS_IMG.imageExportArea, {
            useCORS: true, // Important if images are from other domains (e.g., Firebase Storage)
            backgroundColor: '#ffffff', // Explicit white background
            logging: false // Reduce console noise from html2canvas
        });
        const imageDataUrl = canvas.toDataURL('image/png');

        if (forPreview) {
            if (DOMS_IMG.generatedImagePreview && DOMS_IMG.imagePreviewModal) {
                DOMS_IMG.generatedImagePreview.src = imageDataUrl;
                DOMS_IMG.imagePreviewModal.style.display = 'flex';
            } else {
                console.error("Image preview elements not found.");
            }
        } else { // For saving
            const link = document.createElement('a');
            link.download = '装備構成.png';
            link.href = imageDataUrl;
            document.body.appendChild(link); // Required for Firefox
            link.click();
            document.body.removeChild(link);
        }
    } catch (error) {
        console.error("Image generation error:", error);
        alert("画像の生成に失敗しました。コンソールログを確認してください。\nCORS関連のエラーの場合、画像が正しく読み込めていない可能性があります。");
    }
}
