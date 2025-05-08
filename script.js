body {
    font-family: sans-serif; margin: 0; background-color: #f4f4f4; color: #333;
}
.container {
    width: 90%; max-width: 1200px; margin: 20px auto; padding: 20px;
    background-color: #fff; box-shadow: 0 0 10px rgba(0,0,0,0.1); border-radius: 8px;
}
h1 { text-align: center; color: #333; margin-bottom: 30px; } 

/* ★メインコントロールエリア */
.main-controls {
    text-align: center; 
    margin-bottom: 20px;
}
#openSimulatorButton {
    padding: 12px 25px;
    font-size: 1.1em;
    background-color: #17a2b8; 
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    transition: background-color 0.2s;
}
#openSimulatorButton:hover {
    background-color: #138496;
}

.section-divider {
    border: 0;
    height: 1px;
    background-color: #e0e0e0;
    margin: 40px 0; 
}

/* --- 装備構成シミュレーター (モーダル内) --- */
/* ★モーダル共通スタイル */
.modal {
    position: fixed; z-index: 10001; left: 0; top: 0; width: 100%; height: 100%;
    overflow: auto; background-color: rgba(0,0,0,0.6); display: flex;
    align-items: center; justify-content: center;
}
.modal-content {
    background-color: #fff; margin: auto; padding: 25px 30px;
    border: none; width: 90%; border-radius: 8px;
    position: relative; box-shadow: 0 5px 15px rgba(0,0,0,0.3);
    animation: fadeInModal 0.3s ease-out;
    display: flex; /* 中身の高さ調整のため */
    flex-direction: column;
    max-height: 90vh; /* 高さが画面を超えないように */
}
@keyframes fadeInModal {
    from { opacity: 0; transform: translateY(-20px); }
    to { opacity: 1; transform: translateY(0); }
}
.modal-content h2, .modal-content h3 { /* モーダル内の見出し */
    margin-top: 0; margin-bottom: 15px; font-size: 1.4em; color: #343a40;
    border-bottom: 1px solid #eee; padding-bottom: 10px;
    flex-shrink: 0; /* 見出しは縮まない */
}
.modal-content h3 { font-size: 1.2em; margin-bottom: 10px;}

.close-button {
    color: #6c757d; position: absolute; top: 15px; right: 20px;
    font-size: 28px; font-weight: bold; line-height: 1;
    cursor: pointer; z-index: 10; /* 他の要素より手前に */
}
.close-button:hover,
.close-button:focus {
    color: #343a40; text-decoration: none; 
}

.simulator-modal .modal-content {
    max-width: 900px; 
}
/* simulator-section h2 は不要になった */

.equipment-slots {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); 
    gap: 20px;
    margin-bottom: 25px;
    flex-shrink: 0; /* スロット部分は縮まない */
}
.slot {
    background-color: #f9f9f9;
    padding: 15px;
    border: 1px solid #eee;
    border-radius: 5px;
    display: flex; 
    flex-direction: column;
}
.slot label {
    margin-bottom: 8px;
    font-weight: bold;
    color: #555;
}
.selected-item-display {
    display: flex;
    align-items: center;
    min-height: 40px; 
    background-color: #fff;
    padding: 8px; 
    border: 1px dashed #ddd;
    border-radius: 4px;
    flex-grow: 1; 
    position: relative; 
}
.selected-item-display .slot-image {
    width: 35px;
    height: 35px;
    object-fit: cover;
    margin-right: 10px;
    background-color: #f0f0f0;
    border-radius: 3px;
    flex-shrink: 0; 
}
.selected-item-display .slot-item-name {
    font-size: 0.95em;
    color: #333;
    flex-grow: 1; 
    margin-right: 5px; 
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap; 
}
.select-item-button, .clear-item-button {
    padding: 4px 8px;
    font-size: 0.8em;
    border: 1px solid #ccc;
    background-color: #eee;
    border-radius: 4px;
    cursor: pointer;
    margin-left: 5px;
    flex-shrink: 0;
    transition: background-color 0.2s;
}
.select-item-button:hover, .clear-item-button:hover {
    background-color: #ddd;
}
.clear-item-button {
    background-color: #f8d7da; 
    border-color: #f5c6cb;
    color: #721c24; 
}
.clear-item-button:hover {
     background-color: #f5c6cb;
}


.calculation-result-area {
    margin-top: 20px;
    padding: 15px;
    border: 1px solid #e0e0e0;
    border-radius: 5px;
    background-color: #f9f9f9;
    overflow-y: auto; /* 効果が多い場合にスクロール */
    flex-grow: 1; /* 残りの高さを埋める */
}
.calculation-result-area h3 {
    margin-top: 0;
    margin-bottom: 10px;
    font-size: 1.1em;
    color: #333;
}
.effects-display ul {
    list-style: disc;
    padding-left: 20px;
    margin: 0;
    font-size: 0.95em;
}
.effects-display li {
    margin-bottom: 5px;
    color: #444;
}

.simulator-actions {
    margin-top: 20px;
    display: flex;
    gap: 10px;
    justify-content: flex-end; 
    flex-shrink: 0; /* アクションボタンは縮まない */
}
#saveImageButton, #resetSimulatorButton {
     padding: 10px 20px;
     font-size: 1em;
     cursor: pointer;
     border-radius: 5px;
     border: none;
}
#saveImageButton {
    background-color: #28a745;
    color: white;
}
#saveImageButton:hover {
     background-color: #218838;
}
#resetSimulatorButton {
     background-color: #dc3545;
     color: white;
}
#resetSimulatorButton:hover {
     background-color: #c82333;
}

/* 画像出力用エリアのスタイル（通常は非表示） */
.image-export-container {
    position: absolute; 
    left: -9999px; 
    width: 600px; 
    background: white; 
    padding: 20px; 
    border: 1px solid black; 
    font-family: sans-serif; 
    color: #333;
    line-height: 1.5;
}
.image-export-container h2, .image-export-container h3 {
    color: #333;
    margin-bottom: 10px;
    border-bottom: 1px solid #eee;
    padding-bottom: 5px;
}
.export-slots-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr); 
    gap: 10px;
    margin-bottom: 15px;
}
.export-slot-item {
    display: flex;
    align-items: center;
    font-size: 0.9em;
}
.export-slot-item strong {
    min-width: 40px; 
}
.export-item-image {
    width: 25px;
    height: 25px;
    object-fit: cover;
    margin-left: 5px;
    margin-right: 5px;
    vertical-align: middle;
    background-color: #eee;
    border: 1px solid #ddd;
}
#exportEffects ul { 
     list-style: disc;
     padding-left: 20px;
     margin: 0;
     font-size: 0.9em;
}
#exportEffects li {
     margin-bottom: 4px;
}


/* --- アイテム検索ツール --- */
.search-tool-section h2 {
     font-size: 1.4em;
     color: #333;
     margin-bottom: 20px;
     border-bottom: 2px solid #6c757d; 
     padding-bottom: 5px;
}
.search-controls {
    margin-bottom: 20px; padding: 15px; border: 1px solid #ddd;
    border-radius: 5px; background-color: #f9f9f9;
    transition: opacity 0.3s ease-in-out; /* 連携時のフェード効果 */
}
/* ★検索ツール連携中のスタイル */
.search-controls.selecting-mode {
    opacity: 0.7; /* 少し透明に */
    /* pointer-events: none; */ /* container全体ではなく、個別の要素で制御 */
}
.search-tool-message {
    background-color: #d1ecf1;
    color: #0c5460;
    padding: 10px 15px;
    margin-bottom: 15px;
    border: 1px solid #bee5eb;
    border-radius: 4px;
    text-align: center;
    font-size: 0.9em;
}

.parent-category-filters {
    margin-bottom: 20px;
    padding-bottom: 15px;
    border-bottom: 1px solid #e0e0e0;
}
.parent-category-filters h2 {
    font-size: 1.1em;
    margin-top: 0;
    margin-bottom: 10px;
    color: #444;
}
.category-button-group {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
}
.category-filter-button {
    padding: 8px 15px;
    background-color: #e9ecef;
    border: 1px solid #ced4da;
    border-radius: 20px;
    cursor: pointer;
    font-size: 0.95em;
    transition: background-color 0.2s, color 0.2s, border-color 0.2s, opacity 0.2s;
}
.category-filter-button.disabled { 
    opacity: 0.5;
    cursor: not-allowed;
}
.category-filter-button:hover:not(.disabled) { 
    background-color: #dee2e6;
    border-color: #adb5bd;
}
.category-filter-button.active {
    background-color: #007bff;
    color: white;
    border-color: #0056b3;
}
#childCategoriesAndTagsContainer {
    margin-top: 15px;
    margin-bottom: 20px;
    padding-bottom: 15px;
    transition: opacity 0.2s; 
}
.child-category-section {
    margin-bottom: 15px;
    padding: 10px;
    border: 1px solid #f0f0f0; 
    border-radius: 5px;
    background-color: #fdfdfd;
}
.child-category-section h4 { 
    font-size: 1em;
    color: #333;
    margin-top: 0;
    margin-bottom: 8px;
    padding-bottom: 5px;
    border-bottom: 1px dashed #e0e0e0;
    display: flex; 
    justify-content: space-between; 
    align-items: center; 
    flex-wrap: wrap; 
}
.child-category-section h4 .search-mode {
    font-size: 0.8em;
    font-weight: normal;
    color: #6c757d; 
    margin-left: 8px; 
    white-space: nowrap; 
    flex-shrink: 0; 
}
.tag-filters-inline { 
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}
.tag-filter { 
    padding: 6px 10px; 
    background-color: #f0f0f0;
    border: 1px solid #ddd;
    border-radius: 15px;
    cursor: pointer;
    font-size: 0.85em;
    transition: background-color 0.2s, color 0.2s, opacity 0.2s;
}
.tag-filter.disabled { 
     opacity: 0.5;
     cursor: not-allowed;
}
.tag-filter:hover:not(.disabled) { 
     background-color: #e0e0e0;
}
.tag-filter.active {
    background-color: #28a745; 
    color: white;
    border-color: #1e7e34;
}
.no-tags-message {
    font-size: 0.85em;
    color: #888;
    font-style: italic;
}
#resetFiltersButton {
    padding: 10px 15px; background-color: #6c757d; color: white;
    border: none; border-radius: 4px; cursor: pointer;
    transition: background-color 0.2s;
    margin-top: 10px; 
}
#resetFiltersButton:hover { background-color: #5a6268; }
#itemCount { margin-bottom: 15px; font-weight: bold; color: #555; }
.item-list {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 20px;
}
.item-card {
    background-color: #fff; border: 1px solid #e0e0e0; border-radius: 8px;
    padding: 15px; box-shadow: 0 2px 5px rgba(0,0,0,0.07);
    display: flex; flex-direction: column; transition: box-shadow 0.2s ease-in-out, border-color 0.2s ease-in-out;
}
.item-card.selectable {
    cursor: pointer;
    border-color: #80bdff; 
}
.item-card.selectable:hover {
     box-shadow: 0 4px 12px rgba(0, 123, 255, 0.2); 
}
.item-card.selected-for-simulator {
    border-color: #007bff;
    box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.5); 
    background-color: #e7f3ff;
}
.item-card:hover:not(.selectable) { /* 通常のホバー効果 */
    box-shadow: 0 4px 10px rgba(0,0,0,0.1); 
}
.item-card img {
    width: 120px; height: 120px; object-fit: cover; border-radius: 4px;
    margin-bottom: 12px; align-self: center; background-color: #eee; 
}
.item-image-text-placeholder {
    width: 120px; height: 120px; border-radius: 4px; margin-bottom: 12px;
    align-self: center; background-color: #f0f0f0; display: flex;
    justify-content: center; align-items: center; color: #888;
    font-size: 1.1em; font-weight: bold; border: 1px dashed #ccc; box-sizing: border-box;
}
.item-card h3 {
    margin-top: 0; margin-bottom: 10px; font-size: 1.25em; color: #0056b3; word-break: break-word;
}
.item-card p {
    margin-bottom: 8px; font-size: 0.95em; line-height: 1.5; color: #444;
    flex-grow: 1; word-break: break-word;
}
.item-card p strong { color: #333; }
.item-card .tags {
    margin-top: 12px; font-size: 0.85em; color: #555;
}
.item-card .tags span {
    background-color: #f0f0f0; padding: 4px 8px; border-radius: 12px;
    margin-right: 6px; margin-bottom: 6px; display: inline-block;
}
.item-card .structured-effects {
    margin-top: 10px; font-size: 0.85em; color: #555;
    border-top: 1px solid #eee; padding-top: 8px;
}
.item-card .structured-effects ul {
    list-style: disc; padding-left: 20px; margin: 5px 0 0 0;
}
.item-card .structured-effects li { margin-bottom: 3px; }

/* アイテム選択モーダル */
.modal.item-select-modal { /* 既存のモーダルスタイルを継承 */ }
.item-select-modal .modal-content {
     max-width: 80%; 
     max-height: 80vh; 
     display: flex; 
     flex-direction: column;
}
.item-select-modal-content h3 { margin-bottom: 15px; flex-shrink: 0;}
#itemSelectModalSearch {
     width: 100%; padding: 10px; margin-bottom: 15px;
     border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;
     flex-shrink: 0;
}
.item-select-list {
     flex-grow: 1; 
     overflow-y: auto;
     display: grid;
     grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); 
     gap: 15px; 
     padding: 5px; /* スクロールバーとの隙間 */
}
.item-select-modal-item {
     display: flex; flex-direction: column; align-items: center;
     padding: 10px; border: 1px solid #eee; border-radius: 5px;
     cursor: pointer; transition: background-color 0.2s, box-shadow 0.2s;
     text-align: center; background-color: #fff;
}
.item-select-modal-item:hover {
     background-color: #f0f8ff; 
     box-shadow: 0 2px 5px rgba(0,0,0,0.1);
}
.item-select-modal-item img {
     width: 60px; height: 60px; object-fit: cover; margin-bottom: 8px;
     border-radius: 4px; background-color: #eee;
}
.item-select-modal-item span {
     font-size: 0.9em; color: #333; word-break: break-word;
}

/* 選択決定ボタン */
.confirm-selection-button {
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 12px 25px;
    font-size: 1.1em;
    background-color: #28a745; 
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    z-index: 1000; 
    transition: opacity 0.3s, transform 0.3s;
}
.confirm-selection-button:hover {
    background-color: #218838;
    transform: translateY(-2px);
}


@media (max-width: 768px) {
    .equipment-slots {
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
        gap: 15px;
    }
    .slot { padding: 10px; }
    .simulator-actions { flex-direction: column; align-items: stretch; } 
    #saveImageButton, #resetSimulatorButton { width: 100%; margin-right: 0;} 
    
    .category-button-group { justify-content: center; }
    .child-category-section { padding: 8px; }
    .child-category-section h4 .search-mode { /* 折り返し時調整 */ }
    .tag-filters-inline { gap: 6px; }
    .tag-filter { padding: 5px 8px; font-size: 0.8em; }
    
    .item-select-modal .modal-content { max-width: 95%; max-height: 85vh;}
    .item-select-list { grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; } 
    .item-select-modal-item img { width: 50px; height: 50px; }

     .confirm-selection-button { 
        padding: 10px 20px;
        font-size: 1em;
        right: 10px;
        bottom: 10px;
    }
}
