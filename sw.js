// /-/sw.js (GitHub Pagesのリポジトリルートに配置する想定)

const WORKBOX_VERSION = '6.5.3';
try {
    importScripts(`https://storage.googleapis.com/workbox-cdn/releases/${WORKBOX_VERSION}/workbox-sw.js`);
} catch (error) {
    console.error(`[SW] Workbox (${WORKBOX_VERSION}) の importScripts に失敗しました:`, error);
}

if (typeof workbox !== 'undefined') {
    console.log(`[SW] Workbox ${workbox.VERSION} がロードされました。`);

    workbox.setConfig({
        debug: true,
    });

    // プリキャッシュリスト
    // sw.js が /-/sw.js にあるので、ここでのパスは /-/ からの相対パスになります。
    // GitHub Pagesのプロジェクトサイトの挙動を考えると、リポジトリルートからのパスでOKです。
    const filesToPrecache = [
        // HTML
        { url: 'index.html', revision: 'appshell-20231029-1' }, // /-/index.html
        { url: 'admin.html', revision: 'adminhtml-20231029-1' }, // /-/admin.html
        { url: 'restore.html', revision: 'restorehtml-20231029-1' }, // /-/restore.html

        // CSS (ルートからの相対パス)
        { url: 'css/base.css', revision: 'css-base-20231029-1' },
        { url: 'css/modal.css', revision: 'css-modal-20231029-1' },
        { url: 'css/search-tool.css', revision: 'css-search-20231029-1' },
        { url: 'css/simulator.css', revision: 'css-sim-20231029-1' },
        { url: 'css/responsive.css', revision: 'css-resp-20231029-1' },
        { url: 'css/admin-base.css', revision: 'css-adminbase-20231029-1' },
        { url: 'css/admin-forms.css', revision: 'css-adminforms-20231029-1' },
        { url: 'css/admin-lists.css', revision: 'css-adminlists-20231029-1' },
        { url: 'css/admin-modal.css', revision: 'css-adminmodal-20231029-1' },
        { url: 'css/admin-responsive.css', revision: 'css-adminresp-20231029-1' },

        // JavaScript (ルートからの相対パス)
        { url: 'js/script-main.js', revision: 'js-main-20231029-1' },
        { url: 'js/admin-main.js', revision: 'js-adminmain-20231029-1' },
        { url: 'js/restore.js', revision: 'js-restore-20231029-1' },
        { url: 'js/jszip.min.js', revision: 'js-jszip-20231029-1' }, // ローカルのJSZip

        { url: 'js/common/indexed-db-setup.js', revision: 'js-idbsetup-20231029-1' },
        { url: 'js/common/utils.js', revision: 'js-utils-20231029-1' },

        { url: 'js/modules/indexed-db-ops.js', revision: 'js-idbops-20231029-1' },
        { url: 'js/modules/data-loader.js', revision: 'js-dataload-20231029-1' },
        { url: 'js/modules/ui-main.js', revision: 'js-uimain-20231029-1'},
        { url: 'js/modules/search-filters.js', revision: 'js-searchfilt-20231029-1'},
        { url: 'js/modules/search-render.js', revision: 'js-searchrend-20231029-1'},
        { url: 'js/modules/simulator-ui.js', revision: 'js-simui-20231029-1'},
        { url: 'js/modules/simulator-logic.js', revision: 'js-simlogic-20231029-1'},
        { url: 'js/modules/simulator-image.js', revision: 'js-simimg-20231029-1'},

        { url: 'js/admin-modules/auth.js', revision: 'js-auth-20231029-1' },
        { url: 'js/admin-modules/category-manager.js', revision: 'js-catman-20231029-1' },
        { url: 'js/admin-modules/char-base-manager.js', revision: 'js-charman-20231029-1' },
        { url: 'js/admin-modules/data-loader-admin.js', revision: 'js-dataloadadm-20231029-1' },
        { url: 'js/admin-modules/effect-super-category-manager.js', revision: 'js-effsupercatman-20231029-1' },
        { url: 'js/admin-modules/effect-type-manager.js', revision: 'js-efftypeman-20231029-1' },
        { url: 'js/admin-modules/effect-unit-manager.js', revision: 'js-effunitman-20231029-1' },
        { url: 'js/admin-modules/item-manager.js', revision: 'js-itemman-20231029-1' },
        { url: 'js/admin-modules/item-source-manager.js', revision: 'js-itemsourceman-20231029-1' },
        { url: 'js/admin-modules/tag-manager.js', revision: 'js-tagman-20231029-1' },
        { url: 'js/admin-modules/ui-helpers.js', revision: 'js-uihelpers-20231029-1' },

        // firebase-config.js はルート直下
        { url: 'firebase-config.js', revision: 'fbconf-20231029-1' },

        // Images (ルートからの相対パス)
        { url: 'images/placeholder_item.png', revision: 'ph-item-v1.2' },
        { url: 'images/placeholder_slot.png', revision: 'ph-slot-v1.2' },
        { url: 'images/kakudai.png', revision: 'kakudai-v1.0' }, // 拡大アイコンも追加
    ];

    try {
        if (workbox.precaching) {
            workbox.precaching.precacheAndRoute(filesToPrecache, {
                ignoreURLParametersMatching: [/.*/], // URLのクエリパラメータを無視してキャッシュキーを生成
            });
            console.log('[SW] プリキャッシュファイルが登録されました。');
        } else {
            console.error('[SW] workbox.precaching モジュールが未定義です。');
        }
    } catch (error) {
        console.error('[SW] プリキャッシュ設定中にエラー:', error);
    }

    // ... (以降のルーティング設定は前回と同じでOKです) ...
    // ルーティング設定 (各サブモジュールの存在を確認してから使用)
    if (workbox.routing && workbox.strategies && workbox.cacheable_response && workbox.expiration) {
        try {
            workbox.routing.registerRoute(
                ({ request }) => request.mode === 'navigate',
                new workbox.strategies.NetworkFirst({
                    cacheName: 'pages-cache-gh-v1.2', // キャッシュ名更新
                    plugins: [
                        new workbox.cacheable_response.CacheableResponsePlugin({
                            statuses: [0, 200],
                        }),
                    ]
                })
            );
            console.log('[SW] ナビゲーションリクエストのルーティングが設定されました。');
        } catch(error) {
            console.error('[SW] ナビゲーションルーティング設定エラー:', error);
        }

        try {
            workbox.routing.registerRoute(
                ({ request }) => request.destination === 'style' || request.destination === 'script',
                new workbox.strategies.StaleWhileRevalidate({
                    cacheName: 'static-resources-cache-gh-v1.2', // キャッシュ名更新
                    plugins: [
                        new workbox.cacheable_response.CacheableResponsePlugin({
                            statuses: [0, 200],
                        }),
                    ]
                })
            );
            console.log('[SW] 静的リソース (CSS, JS) のルーティングが設定されました。');
        } catch(error) {
            console.error('[SW] 静的リソースルーティング設定エラー:', error);
        }

        try {
            workbox.routing.registerRoute(
                ({ request }) => request.destination === 'image',
                new workbox.strategies.CacheFirst({
                    cacheName: 'image-cache-gh-v1.2', // キャッシュ名更新
                    plugins: [
                        new workbox.expiration.ExpirationPlugin({
                            maxEntries: 150, // アイテム画像が増えることを見越して少し増やすか、R2専用キャッシュを検討
                            maxAgeSeconds: 30 * 24 * 60 * 60,
                            purgeOnQuotaError: true,
                        }),
                        new workbox.cacheable_response.CacheableResponsePlugin({
                            statuses: [0, 200],
                        }),
                    ],
                })
            );
            console.log('[SW] 画像のルーティングが設定されました。');
        } catch(error) {
            console.error('[SW] 画像ルーティング設定エラー:', error);
        }
    } else {
        console.error('[SW] Workboxのルーティング関連モジュールが未定義です (routing, strategies, cacheable_response, expiration)。');
    }


    if (workbox.core) {
        try {
            workbox.core.skipWaiting();
            workbox.core.clientsClaim();
            console.log('[SW] skipWaiting と clientsClaim が設定されました。');
        } catch(error) {
            console.error('[SW] skipWaiting/clientsClaim 設定エラー:', error);
        }
    } else {
        console.error('[SW] workbox.core モジュールが未定義です。');
    }

    console.log('[SW] Service Worker の設定が完了しました。');

} else {
    console.error('[SW] Workbox 自体が定義されていません。importScripts が失敗した可能性があります。');
}
