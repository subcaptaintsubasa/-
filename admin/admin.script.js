/* admin.style.css に追記例 */
.list-item {
    /* display: flex; は既存のスタイルでOKなはず */
    /* justify-content: space-between; */ /* これがあるとインデントが難しくなるかも */
    /* align-items: center; */
}
.list-item .category-name-display {
    flex-grow: 1; /* 名前ができるだけ幅を取るように */
    margin-right: 10px;
}
.list-item .category-info-display {
    color: #555;
    font-size: 0.9em;
    margin-right: 10px;
    white-space: nowrap;
}
.list-item .category-actions { /* ボタン類を右端に寄せる */
    margin-left: auto;
    white-space: nowrap;
}

/* SortableJS 用のスタイル例 */
.sortable-ghost {
    opacity: 0.4;
    background-color: #c8ebfb;
}
.sortable-chosen {
    /* background-color: #e2e2e2; */ /* 必要に応じて */
}
.sortable-drag {
    /* opacity: 0.9; */ /* 必要に応じて */
}
