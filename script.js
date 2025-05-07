// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js"; // 例: 9.6.10 (最新版を確認)
import {
    getFirestore,
    collection,
    getDocs,
    query,
    orderBy
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBxrE-9E46dplHTuEBmmcJWQRU1vLgAGAU", // ご自身のAPIキー等に置き換えてください
  authDomain: "itemsearchtooleditor.firebaseapp.com",
  projectId: "itemsearchtooleditor",
  storageBucket: "itemsearchtooleditor.appspot.com", // Firebaseコンソールで確認 (末尾が .appspot.com か .firebasestorage.app か)
  messagingSenderId: "243156973544",
  appId: "1:243156973544:web:ffdc31134a35354b6dd65d",
  measurementId: "G-8EHP9MGJ4M" // Optional
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


document.addEventListener('DOMContentLoaded', () => {
    // DOM要素の取得
    const searchInput = document.getElementById('searchInput');
    const tagFiltersContainer = document.getElementById('tagFiltersContainer');
    const itemList = document.getElementById('itemList');
    const itemCountDisplay = document.getElementById('itemCount');
    const resetFiltersButton = document.getElementById('resetFiltersButton');

    let allItems = [];
    let availableTags = [];
    let selectedTags = [];

    async function loadData() {
        try {
            const itemsCollectionRef = collection(db, 'items');
            const itemsQuery = query(itemsCollectionRef, orderBy('name'));
            const itemsSnapshot = await getDocs(itemsQuery);
            allItems = itemsSnapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));

            const tagsCollectionRef = collection(db, 'tags');
            const tagsQuery = query(tagsCollectionRef, orderBy('name'));
            const tagsSnapshot = await getDocs(tagsQuery);
            availableTags = tagsSnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));

            console.log("User site: Items loaded from Firestore", allItems);
            console.log("User site: Tags loaded from Firestore", availableTags);

            renderTags();
            renderItems(allItems);
        } catch (error) {
            console.error("Error loading data from Firestore for user site: ", error);
            if (itemList) {
                itemList.innerHTML = `<p style="color: red;">データの読み込みに失敗しました。設定を確認するか、しばらくしてから再度お試しください。</p>`;
            }
            if (itemCountDisplay) {
                itemCountDisplay.textContent = 'エラー';
            }
        }
    }

    function renderTags() {
        if (!tagFiltersContainer) return;
        tagFiltersContainer.innerHTML = '';
        availableTags.forEach(tag => {
            const tagButton = document.createElement('div');
            tagButton.classList.add('tag-filter');
            tagButton.textContent = tag.name;
            tagButton.dataset.tagId = tag.id;
            tagButton.addEventListener('click', () => toggleTag(tagButton, tag.id));
            tagFiltersContainer.appendChild(tagButton);
        });
    }

    function renderItems(itemsToRender) {
        if (!itemList) return;
        itemList.innerHTML = '';
        if (itemCountDisplay) {
            itemCountDisplay.textContent = `${itemsToRender.length} 件のアイテムが見つかりました。`;
        }
        if (itemsToRender.length === 0) {
            itemList.innerHTML = '<p>該当するアイテムは見つかりませんでした。</p>';
            return;
        }
        itemsToRender.forEach(item => {
            const itemCard = document.createElement('div');
            itemCard.classList.add('item-card');
            const imagePath = item.image || './images/placeholder_item.png'; // ローカルのプレースホルダー
            let tagsHtml = '';
            if (item.tags && item.tags.length > 0) {
                tagsHtml = `<div class="tags">タグ: ${item.tags.map(tagId => {
                    const tagObj = availableTags.find(t => t.id === tagId);
                    return `<span>${tagObj ? tagObj.name : '不明なタグ'}</span>`;
                }).join(' ')}</div>`;
            }
            itemCard.innerHTML = `
                <img src="${imagePath}" alt="${item.name || 'アイテム画像'}" onerror="this.onerror=null; this.src='./images/placeholder_item.png';">
                <h3>${item.name || '名称未設定'}</h3>
                <p><strong>効果:</strong> ${item.effect || '未設定'}</p>
                <p><strong>入手手段:</strong> ${item.入手手段 || '未設定'}</p>
                ${tagsHtml}
            `;
            itemList.appendChild(itemCard);
        });
    }

    function filterAndRenderItems() {
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : "";
        let filteredItems = allItems.filter(item => {
            const matchesSearchTerm = searchTerm === '' ||
                (item.name && item.name.toLowerCase().includes(searchTerm)) ||
                (item.effect && item.effect.toLowerCase().includes(searchTerm)) ||
                (item.入手手段 && item.入手手段.toLowerCase().includes(searchTerm));
            const matchesTags = selectedTags.length === 0 ||
                (item.tags && selectedTags.every(selTagId => item.tags.includes(selTagId)));
            return matchesSearchTerm && matchesTags;
        });
        renderItems(filteredItems);
    }
    
    function toggleTag(tagButton, tagId) {
        tagButton.classList.toggle('active');
        if (selectedTags.includes(tagId)) {
            selectedTags = selectedTags.filter(t => t !== tagId);
        } else {
            selectedTags.push(tagId);
        }
        filterAndRenderItems();
    }

    function resetFilters() {
        if (searchInput) searchInput.value = '';
        selectedTags = [];
        if (tagFiltersContainer) {
            tagFiltersContainer.querySelectorAll('.tag-filter.active').forEach(button => {
                button.classList.remove('active');
            });
        }
        filterAndRenderItems();
    }

    if (searchInput) searchInput.addEventListener('input', filterAndRenderItems);
    if (resetFiltersButton) resetFiltersButton.addEventListener('click', resetFilters);

    loadData();
});
