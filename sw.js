// /-/sw.js (GitHub Pagesのリポジトリルートに配置する想定)

const WORKBOX_VERSION = '6.5.3';
let workboxLoaded = false;

try {
    importScripts(`https://storage.googleapis.com/workbox-cdn/releases/${WORKBOX_VERSION}/workbox-sw.js`);
    if (typeof workbox !== 'undefined') {
        console.log(`[SW] Workbox ${workbox.VERSION} が正常にインポートされました。`);
        workboxLoaded = true;
    } else {
        console.error('[SW] importScriptsは成功しましたが、workboxオブジェクトが定義されていません。');
    }
} catch (error) {
    console.error(`[SW] Workbox (${WORKBOX_VERSION}) の importScripts に失敗しました:`, error);
}

if (workboxLoaded) {
    console.log(`[SW] Workboxの初期化を開始します...`);

    workbox.setConfig({
        debug: true, // 開発中はtrue、本番ではfalseに
    });

    // プリキャッシュするファイルリスト
    // revisionはファイル更新時に変更してください
    const filesToPrecache = [
        // HTML
        { url: 'index.html', revision: 'appshell-20231031-1' }, // revision は適宜更新
        { url: 'admin.html', revision: 'adminhtml-20231031-1' },
        { url: 'restore.html', revision: 'restorehtml-20231031-1' },

        // CSS
        { url: 'css/base.css', revision: 'css-base-20231031-1' },
        { url: 'css/modal.css', revision: 'css-modal-20231031-1' },
        { url: 'css/search-tool.css', revision: 'css-search-20231031-1' },
        { url: 'css/simulator.css', revision: 'css-sim-20231031-1' },
        { url: 'css/responsive.css', revision: 'css-resp-20231031-1' },
        { url: 'css/admin-base.css', revision: 'css-adminbase-20231031-1' },
        { url: 'css/admin-forms.css', revision: 'css-adminforms-20231031-1' },
        { url: 'css/admin-lists.css', revision: 'css-adminlists-20231031-1' },
        { url: 'css/admin-modal.css', revision: 'css-adminmodal-20231031-1' },
        { url: 'css/admin-responsive.css', revision: 'css-adminresp-20231031-1' },

        // JavaScript (ルート)
        { url: 'firebase-config.js', revision: 'fbconf-20231031-1' },
        { url: 'js/jszip.min.js', revision: 'js-jszip-v1' },
        { url: 'js/script-main.js', revision: 'js-main-20231031-1' }, // ★ script-main.js を含める
        { url: 'js/admin-main.js', revision: 'js-adminmain-20231031-1' }, // ★ admin-main.js を含める
        { url: 'js/restore.js', revision: 'js-restore-20231031-1' },
        
        // JavaScript (common)
        { url: 'js/common/indexed-db-setup.js', revision: 'js-idbsetup-20231031-1' },
        { url: 'js/common/utils.js', revision: 'js-utils-20231031-1' },

        // JavaScript (modules - ユーザー画面用)
        { url: 'js/modules/indexed-db-ops.js', revision: 'js-idbops-20231031-1' },
        { url: 'js/modules/data-loader.js', revision: 'js-dataload-20231031-1' },
        { url: 'js/modules/ui-main.js', revision: 'js-uimain-20231031-1'},
        { url: 'js/modules/search-filters.js', revision: 'js-searchfilt-20231031-1'},
        { url: 'js/modules/search-render.js', revision: 'js-searchrend-20231031-1'},
        { url: 'js/modules/simulator-ui.js', revision: 'js-simui-20231031-1'},
        { url: 'js/modules/simulator-logic.js', revision: 'js-simlogic-20231031-1'},
        { url: 'js/modules/simulator-image.js', revision: 'js-simimg-20231031-1'},

        // JavaScript (admin-modules)
        { url: 'js/admin-modules/auth.js', revision: 'js-auth-20231031-1' },
        { url: 'js/admin-modules/data-loader-admin.js', revision: 'js-dataloadadm-20231031-1' },
        { url: 'js/admin-modules/ui-helpers.js', revision: 'js-uihelpers-20231031-1' },
        { url: 'js/admin-modules/category-manager.js', revision: 'js-catman-20231031-1' },
        { url: 'js/admin-modules/tag-manager.js', revision: 'js-tagman-20231031-1' },
        { url: 'js/admin-modules/effect-unit-manager.js', revision: 'js-effunitman-20231031-1' },
        { url: 'js/admin-modules/effect-super-category-manager.js', revision: 'js-effscatman-20231031-1' },
        { url: 'js/admin-modules/effect-type-manager.js', revision: 'js-efftypeman-20231031-1' },
        { url: 'js/admin-modules/char-base-manager.js', revision: 'js-charbaseman-20231031-1' },
        { url: 'js/admin-modules/item-source-manager.js', revision: 'js-isrcman-20231031-1' },
        { url: 'js/admin-modules/item-manager.js', revision: 'js-itemman-20231031-1' },

        // Images
        { url: 'images/placeholder_item.png', revision: 'ph-item-v1.3' }, // パスと存在を確認
        { url: 'images/placeholder_slot.png', revision: 'ph-slot-v1.3' }, // パスと存在を確認
        { url: 'images/kakudai.png', revision: 'kakudai-v1.1' },      // パスと存在を確認
    ];

    try {
        if (workbox.precaching) {
            workbox.precaching.precacheAndRoute(filesToPrecache, {
                ignoreURLParametersMatching: [/.*/],
            });
            console.log('[SW] プリキャッシュファイルが登録されました。');
        } else {
            console.error('[SW] workbox.precaching モジュールが未定義です。');
        }
    } catch (error) {
        console.error('[SW] プリキャッシュ設定中にエラー:', error);
    }

    // ルーティング設定
    if (workbox.routing && workbox.strategies && workbox.cacheable_response && workbox.expiration) {
        console.log('[SW] ルーティングモジュールは利用可能です。ルーティングを設定します。');
        try { // Nav
            workbox.routing.registerRoute(
                ({ request }) => request.mode === 'navigate',
                new workbox.strategies.NetworkFirst({
                    cacheName: 'pages-cache-gh-v1.3', // キャッシュ名を更新
                    plugins: [ new workbox.cacheable_response.CacheableResponsePlugin({ statuses: [0, 200] }) ]
                })
            );
            console.log('[SW] ナビゲーションルーティング設定完了。');
        } catch(error) { console.error('[SW] ナビゲーションルーティングエラー:', error); }
        
        try { // Static (CSS, JS)
            workbox.routing.registerRoute(
                ({ request }) => request.destination === 'style' || request.destination === 'script',
                new workbox.strategies.StaleWhileRevalidate({
                    cacheName: 'static-resources-cache-gh-v1.3', // キャッシュ名を更新
                    plugins: [ new workbox.cacheable_response.CacheableResponsePlugin({ statuses: [0, 200] }) ]
                })
            );
            console.log('[SW] 静的リソースルーティング設定完了。');
        } catch(error) { console.error('[SW] 静的リソースルーティングエラー:', error); }
        
        try { // Images (ローカル画像など)
            workbox.routing.registerRoute(
                ({ request }) => request.destination === 'image',
                new workbox.strategies.CacheFirst({
                    cacheName: 'image-cache-gh-v1.3', // キャッシュ名を更新
                    plugins: [
                        new workbox.expiration.ExpirationPlugin({ maxEntries: 150, maxAgeSeconds: 30 * 24 * 60 * 60, purgeOnQuotaError: true }),
                        new workbox.cacheable_response.CacheableResponsePlugin({ statuses: [0, 200] })
                    ]
                })
            );
            console.log('[SW] 画像ルーティング設定完了。');
        } catch(error) { console.error('[SW] 画像ルーティングエラー:', error); }

    } else {
        console.error('[SW] Workboxのルーティング関連モジュールが未定義です。');
    }

    // Service Workerのライフサイクル制御
    self.skipWaiting();
    self.clients.claim();
    console.log('[SW] skipWaiting と clientsClaim が設定されました (selfを使用)。');
    
    self.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SKIP_WAITING') {
            console.log('[SW] SKIP_WAITING メッセージを受信。skipWaitingを実行します。');
            self.skipWaiting();
        }
    });

    console.log('[SW] Service Worker の設定が完了しました。');

} else {
    console.error('[SW] Workbox 自体が定義されていません。importScripts が失敗したか、ライブラリに問題がある可能性があります。');
}
