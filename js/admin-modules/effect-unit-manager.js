// js/admin-modules/effect-unit-manager.js
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { openModal, closeModal, openEnlargedListModal } from './ui-helpers.js'; // ★★★ openEnlargedListModal をインポート ★★★

const DOMEU = {
    newEffectUnitNameInput: null,
    addEffectUnitButton: null,
    effectUnitListContainer: null,
    enlargeEffectUnitListButton: null, // ★★★ 追加 ★★★
    editEffectUnitModal: null,
    editingEffectUnitDocIdInput: null,
    editingEffectUnitNameInput: null,
    saveEffectUnitEditButton: null,
    deleteEffectUnitFromEditModalButton: null,
    manageUnitsForNewEffectTypeButton: null,
    manageUnitsForEditingEffectTypeButton: null,
};

let dbInstance = null;
let getEffectUnitsFuncCache = () => [];
let getEffectTypesFuncCache = () => [];
let getItemsFuncCache = () => [];
let getCharacterBasesFuncCache = () => ({});
let refreshAllDataCallback = async () => {};
// let openEnlargedListModalCallback = (title, contentGenerator) => {}; // ui-helpers から直接使う

export function initEffectUnitManager(dependencies) {
    dbInstance = dependencies.db;
    getEffectUnitsFuncCache = dependencies.getEffectUnits;
    getEffectTypesFuncCache = dependencies.getEffectTypes;
    getItemsFuncCache = dependencies.getItems;
    getCharacterBasesFuncCache = dependencies.getCharacterBases;
    refreshAllDataCallback = dependencies.refreshAllData;
    // openEnlargedListModalCallback = dependencies.openEnlargedListModal; // ui-helpers から直接使うので不要

    DOMET.newEffectUnitNameInput = document.getElementById('newEffectUnitName');
    DOMET.addEffectUnitButton = document.getElementById('addEffectUnitButton');
    DOMET.effectUnitListContainer = document.getElementById('effectUnitListContainer');
    DOMET.enlargeEffectUnitListButton = document.getElementById('enlargeEffectUnitListButton'); // ★★★ 取得 ★★★

    DOMET.editEffectUnitModal = document.getElementById('editEffectUnitModal');
    DOMET.editingEffectUnitDocIdInput = document.getElementById('editingEffectUnitDocId');
    DOMET.editingEffectUnitNameInput = document.getElementById('editingEffectUnitName');
    DOMET.saveEffectUnitEditButton = document.getElementById('saveEffectUnitEditButton');
    DOMET.deleteEffectUnitFromEditModalButton = document.getElementById('deleteEffectUnitFromEditModalButton');

    DOMET.manageUnitsForNewEffectTypeButton = document.getElementById('manageUnitsForNewEffectTypeButton');
    DOMET.manageUnitsForEditingEffectTypeButton = document.getElementById('manageUnitsForEditingEffectTypeButton');


    if (DOMET.addEffectUnitButton) {
        DOMET.addEffectUnitButton.addEventListener('click', addEffectUnit);
    }
    if (DOMET.saveEffectUnitEditButton) {
        DOMET.saveEffectUnitEditButton.addEventListener('click', saveEffectUnitEdit);
    }
    if (DOMET.deleteEffectUnitFromEditModalButton) {
        DOMET.deleteEffectUnitFromEditModalButton.addEventListener('click', () => {
            const unitId = DOMET.editingEffectUnitDocIdInput.value;
            const unit = getEffectUnitsFuncCache().find(u => u.id === unitId);
            if (unitId && unit) {
                deleteEffectUnit(unitId, unit.name);
            } else {
                alert("削除対象の効果単位IDが見つかりません。");
            }
        });
    }

    if (DOMET.effectUnitListContainer) {
        DOMET.effectUnitListContainer.addEventListener('click', handleEffectUnitListClick);
    }

    // ★★★ 拡大ボタンのイベントリスナー ★★★
    if (DOMET.enlargeEffectUnitListButton) {
        DOMET.enlargeEffectUnitListButton.addEventListener('click', () => {
            openEnlargedListModal(
                "効果単位一覧 (拡大)",
                (container) => {
                    const listContent = buildEffectUnitListDOMForEnlargement(true); // isEnlargedView = true
                    if (listContent) {
                        container.appendChild(listContent);
                    } else {
                        container.innerHTML = '<p>表示する効果単位がありません。</p>';
                    }
                }
            );
        });
    }

    if (DOMET.manageUnitsForNewEffectTypeButton) {
        DOMET.manageUnitsForNewEffectTypeButton.addEventListener('click', () => {
            const effectUnitModal = document.getElementById('effectUnitManagementModal');
            if (effectUnitModal) {
                openModal('effectUnitManagementModal');
                const newUnitInput = document.getElementById('newEffectUnitName');
                if(newUnitInput) newUnitInput.focus();
            }
        });
    }
    if (DOMET.manageUnitsForEditingEffectTypeButton) {
        DOMET.manageUnitsForEditingEffectTypeButton.addEventListener('click', () => {
            const effectUnitModal = document.getElementById('effectUnitManagementModal');
            if (effectUnitModal) {
                 openModal('effectUnitManagementModal');
                 const newUnitInput = document.getElementById('newEffectUnitName');
                 if(newUnitInput) newUnitInput.focus();
            }
        });
    }

    console.log("[Effect Unit Manager] Initialized.");
}

// ★★★ 効果単位リストのDOMを生成する共通関数 ★★★
function buildEffectUnitListDOMForEnlargement(isEnlargedView = false) {
    const effectUnitsCache = getEffectUnitsFuncCache();
    // ここでは検索フィルタはまだ実装しないので、全件表示
    
    if (!effectUnitsCache || effectUnitsCache.length === 0) {
        const p = document.createElement('p');
        p.textContent = '効果単位が登録されていません。「なし」は自動的に利用可能です。';
        return p;
    }

    const ul = document.createElement('ul');
    ul.className = 'entity-list'; // admin-lists.css のスタイルを適用
    const sortedUnits = [...effectUnitsCache].sort((a,b) => a.name.localeCompare(b.name, 'ja'));

    sortedUnits.forEach(unit => {
        const li = document.createElement('li');
        li.classList.add('list-item'); // 既存の list-item スタイルを流用
        
        const nameSpan = document.createElement('span');
        nameSpan.classList.add('list-item-name-clickable');
        nameSpan.textContent = unit.name;
        if (!isEnlargedView) { // 拡大表示では編集アクションを無効化
            nameSpan.dataset.id = unit.id;
            nameSpan.dataset.action = "edit";
        }
        li.appendChild(nameSpan);

        // 拡大表示ではアクションボタンは不要
        if (!isEnlargedView) {
            const actionsDiv = document.createElement('div');
            actionsDiv.classList.add('list-item-actions'); 
            // 現在のUIでは一覧にボタンはないので空のまま
            li.appendChild(actionsDiv);
        }
        ul.appendChild(li);
    });
    return ul;
}


export function _renderEffectUnitsForManagementInternal() {
    if (!DOMET.effectUnitListContainer) return;
    DOMET.effectUnitListContainer.innerHTML = ''; // Clear previous content

    const listContent = buildEffectUnitListDOMForEnlargement(false); // 通常表示
    if (listContent) {
        DOMET.effectUnitListContainer.appendChild(listContent);
    }
    // メッセージは buildEffectUnitListDOMForEnlargement 内で処理される
    console.log("[Effect Unit Manager] Effect units rendered for management.");
}


function handleEffectUnitListClick(event) {
    const target = event.target;
    const clickableName = target.closest('.list-item-name-clickable[data-id]');
    if (clickableName && clickableName.dataset.action === 'edit') {
        openEditEffectUnitModalById(clickableName.dataset.id);
    }
}

async function addEffectUnit() {
    // (この関数は変更なし)
    if (!DOMET.newEffectUnitNameInput) return;
    const name = DOMET.newEffectUnitNameInput.value.trim();
    const effectUnitsCache = getEffectUnitsFuncCache();
    if (!name) { alert("効果単位名を入力してください。"); return; }
    if (name.toLowerCase() === "なし") { alert("「なし」は予約語であり、単位として登録できません。"); return; }
    if (effectUnitsCache.some(u => u.name.toLowerCase() === name.toLowerCase())) {
        alert("同じ名前の効果単位が既に存在します。"); return;
    }
    try {
        await addDoc(collection(dbInstance, 'effect_units'), { name: name, createdAt: serverTimestamp() });
        DOMET.newEffectUnitNameInput.value = '';
        await refreshAllDataCallback();
    } catch (error) {
        console.error("[Effect Unit Manager] Error adding effect unit:", error);
        alert("効果単位の追加に失敗しました。");
    }
}

function openEditEffectUnitModalById(unitId) {
    // (この関数は変更なし)
    const effectUnitsCache = getEffectUnitsFuncCache();
    const unitData = effectUnitsCache.find(u => u.id === unitId);
    if (unitData && DOMET.editingEffectUnitDocIdInput && DOMET.editingEffectUnitNameInput) {
        DOMET.editingEffectUnitDocIdInput.value = unitData.id;
        DOMET.editingEffectUnitNameInput.value = unitData.name;
        openModal('editEffectUnitModal');
        DOMET.editingEffectUnitNameInput.focus();
    } else {
        alert("編集する効果単位のデータが見つかりません。");
    }
}

async function saveEffectUnitEdit() {
    // (この関数は変更なし)
    const id = DOMET.editingEffectUnitDocIdInput.value;
    const newName = DOMET.editingEffectUnitNameInput.value.trim();
    const effectUnitsCache = getEffectUnitsFuncCache();
    if (!newName) { alert("効果単位名は空にできません。"); return; }
    if (newName.toLowerCase() === "なし") { alert("「なし」は予約語であり、単位として登録できません。"); return; }
    if (effectUnitsCache.some(u => u.id !== id && u.name.toLowerCase() === newName.toLowerCase())) {
        alert("編集後の名前が他の効果単位と重複します。"); return;
    }
    try {
        const oldUnitData = effectUnitsCache.find(u => u.id === id);
        const oldUnitName = oldUnitData ? oldUnitData.name : null;
        await updateDoc(doc(dbInstance, 'effect_units', id), { name: newName, updatedAt: serverTimestamp() });
        if (oldUnitName && oldUnitName !== newName) {
            console.log(`Effect unit name changed from "${oldUnitName}" to "${newName}". Dependent entities might need manual review or a more robust update mechanism if unit names are denormalized.`);
        }
        closeModal('editEffectUnitModal');
        await refreshAllDataCallback();
    } catch (error) {
        console.error("[Effect Unit Manager] Error updating effect unit:", error);
        alert("効果単位の更新に失敗しました。");
    }
}

async function deleteEffectUnit(id, name) {
    // (この関数は変更なし)
    const effectTypesCache = getEffectTypesFuncCache();
    const usedByEffectType = effectTypesCache.find(et => et.defaultUnit === name);
    if (usedByEffectType) {
        alert(`効果単位「${name}」は効果種類「${usedByEffectType.name}」のデフォルト単位として使用されているため削除できません。`); return;
    }
    if (confirm(`効果単位「${name}」を削除しますか？この操作は元に戻せません。`)) {
        try {
            await deleteDoc(doc(dbInstance, 'effect_units', id));
            closeModal('editEffectUnitModal');
            await refreshAllDataCallback();
        } catch (error) {
            console.error("[Effect Unit Manager] Error deleting effect unit:", error);
            alert("効果単位の削除に失敗しました。");
        }
    }
}
