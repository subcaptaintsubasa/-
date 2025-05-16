// js/modules/simulator-logic.js
// Handles the logic for character base selection changes and their impact on effects.

// Dependencies (passed or imported)
let getSelectedCharacterBaseFunc = () => ({});
let setSelectedCharacterBaseValueFunc = (baseType, optionData) => {};
let calculateAndDisplayTotalEffectsFunc = () => {};
let getCharacterBasesCacheFunc = () => ({});


export function initSimulatorLogic(dependencies) {
    getSelectedCharacterBaseFunc = dependencies.getSelectedCharacterBase;
    setSelectedCharacterBaseValueFunc = dependencies.setSelectedCharacterBaseValue;
    calculateAndDisplayTotalEffectsFunc = dependencies.calculateAndDisplayTotalEffects;
    getCharacterBasesCacheFunc = dependencies.getCharacterBasesCache;

    // Listen for custom charBaseChange event dispatched from simulator-ui.js
    document.addEventListener('charBaseChange', handleCharacterBaseChangeEvent);
}

function handleCharacterBaseChangeEvent(event) {
    if (!event.detail) return;
    const { baseType, selectedOptionId } = event.detail;
    handleCharacterBaseChange(baseType, selectedOptionId);
}


function handleCharacterBaseChange(baseType, selectedOptionId) {
    const characterBasesCache = getCharacterBasesCacheFunc();

    if (baseType && selectedCharacterBaseFunc().hasOwnProperty(baseType)) {
        let selectedOptionData = null;
        if (selectedOptionId && characterBasesCache[baseType]) {
            selectedOptionData = characterBasesCache[baseType].find(opt => opt.id === selectedOptionId);
        }
        setSelectedCharacterBaseValueFunc(baseType, selectedOptionData || null);
        calculateAndDisplayTotalEffectsFunc();
    } else {
        console.warn("Invalid baseType or selectedCharacterBase structure:", baseType);
    }
}

// Helper to get the current selected character base state (if needed by other modules directly)
// Though typically, other modules would get it from simulator-ui.js if it's the state owner.
export const selectedCharacterBaseFunc = () => {
    // This function might be redundant if simulator-ui.js.getSelectedCharacterBase is used.
    // It depends on how state ownership is strictly defined.
    // For now, assuming simulator-ui is the primary state owner.
    return getSelectedCharacterBaseFunc();
};
