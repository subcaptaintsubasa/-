// js/admin-main.js
import { auth, db } from '../firebase-config.js'; // Firebase設定をインポート
import { initAuth } from './admin-modules/auth.js';
import { loadInitialData, clearAdminUI, getAllCategoriesCache, getAllTagsCache, getItemsCache, getEffectTypesCache, getEffectUnitsCache, getCharacterBasesCache, setCurrentItemEffects, getCurrentItemEffects, setSelectedImageFile, getSelectedImageFile, IMAGE_UPLOAD_WORKER_URL, setCurrentCharBaseOptionEffects, getCurrentCharBaseOptionEffects } from './admin-modules/data-loader-admin.js'; // Admin specific data loader/state
import { initUIHelpers } from './admin-modules/ui-helpers.js';
import { initCategoryManager } from './admin-modules/category-manager.js';
import { initTagManager } from './admin-modules/tag-manager.js';
import { initEffectUnitManager } from './admin-modules/effect-unit-manager.js';
import { initEffectTypeManager } from './admin-modules/effect-type-manager.js';
import { initCharBaseManager, baseTypeMappings } from './admin-modules/char-base-manager.js';
import { initItemManager } from './admin-modules/item-manager.js';


document.addEventListener('DOMContentLoaded', () => {
    // Initialize UI Helpers (modal closing, etc.)
    initUIHelpers();

    // Initialize Authentication
    initAuth(auth,
        () => { // onLogin
            document.getElementById('password-prompt').style.display = 'none';
            document.getElementById('admin-content').style.display = 'block';
            const user = auth.currentUser;
            if (user && document.getElementById('currentUserEmail')) {
                document.getElementById('currentUserEmail').textContent = `ログイン中: ${user.email}`;
            }
            loadAndInitializeAdminModules();
        },
        () => { // onLogout
            document.getElementById('password-prompt').style.display = 'flex';
            document.getElementById('admin-content').style.display = 'none';
            if (document.getElementById('currentUserEmail')) {
                 document.getElementById('currentUserEmail').textContent = '';
            }
            clearAdminUI(); // Clear UI and caches
        }
    );
});

async function loadAndInitializeAdminModules() {
    try {
        await loadInitialData(db); // Load all necessary data for admin panel

        // Pass db and cache access functions to each manager
        const commonDeps = {
            db,
            getAllCategories: getAllCategoriesCache,
            getAllTags: getAllTagsCache,
            getItems: getItemsCache,
            getEffectTypes: getEffectTypesCache,
            getEffectUnits: getEffectUnitsCache,
            getCharacterBases: getCharacterBasesCache,
            // Functions to trigger re-loading or re-rendering in other modules if needed
            refreshAllData: loadInitialData, // Simplified: re-load everything
            // More granular refresh functions can be added if performance becomes an issue
            // e.g., refreshCategories: () => { loadCategoriesFromFirestore(); renderCategoriesForManagement(); ... }
        };

        const itemFormDeps = {
            setCurrentItemEffects,
            getCurrentItemEffects,
            setSelectedImageFile,
            getSelectedImageFile,
            uploadWorkerUrl: IMAGE_UPLOAD_WORKER_URL,
        };
        
        const charBaseFormDeps = {
            setCurrentCharBaseOptionEffects,
            getCurrentCharBaseOptionEffects,
            baseTypeMappings,
        };


        initEffectUnitManager({ ...commonDeps });
        initEffectTypeManager({ ...commonDeps }); // Depends on effect units being loaded for selects
        initCategoryManager({ ...commonDeps });
        initTagManager({ ...commonDeps }); // Depends on categories for assignment
        initCharBaseManager({ ...commonDeps, ...charBaseFormDeps }); // Depends on effect types for effects
        initItemManager({ ...commonDeps, ...itemFormDeps }); // Depends on tags, effect types

        console.log("Admin modules initialized.");

    } catch (error) {
        console.error("Error loading initial data for admin panel:", error);
        alert("管理パネルのデータ読み込みに失敗しました。");
    }
}
