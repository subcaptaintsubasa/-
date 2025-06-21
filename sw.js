// /-/sw.js (GitHub Pagesのリポジトリルートに配置する想定)

const WORKBOX_VERSION = '6.5.3';
let workboxLoaded = false; // Workboxがロードされたかどうかのフラグ

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

if (workboxLoaded) { // workboxが確実にロードされた場合のみ実行
    console.log(`[SW] Workboxの初期化を開始します...`);

    workbox.setConfig({
        debug: true,
    });

    // プリキャッシュリスト - ご提示いただいたリストをベースにします
    const filesToPrecache = [
        // HTML
        { url: 'index.html', revision: 'appshell-20231031-1' },
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
        { url: 'firebase-config.js', revision: 'fbconf-20231031-1' }, // revisionは適宜更新
        { url: 'js/jszip.min.js', revision: 'js-jszip-20231030-1' }, // 以前のrevisionのまま
        { url: 'js/script-main.js', revision: 'js-main-20231031-1' }, // revisionは適宜更新
        { url: 'js/admin-main.js', revision: 'js-adminmain-20231031-1' }, // revisionは適宜更新
        { url: 'js/restore.js', revision: 'js-restore-20231030-1' }, // 以前のrevisionのまま
        
        // JavaScript (common)
        { url: 'js/common/indexed-db-setup.js', revision: 'js-idbsetup-20231031-2' }, // revisionは適宜更新
        { url: 'js/common/utils.js', revision: 'js-utils-20231030-1' }, // 以前のrevisionのまま

        // JavaScript (modules - ユーザー画面用)
        { url: 'js/modules/indexed-db-ops.js', revision: 'js-idbops-20231031-1' }, // revisionは適宜更新
        { url: 'js/modules/data-loader.js', revision: 'js-dataload-20231031-1' }, // revisionは適宜更新
        { url: 'js/modules/ui-main.js', revision: 'js-uimain-20231030-1'},
        { url: 'js/modules/search-filters.js', revision: 'js-searchfilt-20231030-1'},
        { url: 'js/modules/search-render.js', revision: 'js-searchrend-20231030-1'},
        { url: 'js/modules/simulator-ui.js', revision: 'js-simui-20231030-1'},
        { url: 'js/modules/simulator-logic.js', revision: 'js-simlogic-20231030-1'},
        { url: 'js/modules/simulator-image.js', revision: 'js-simimg-20231030-1'},

        // JavaScript (admin-modules) - ご提示のリストには含まれていませんでしたが、必要なら追加
        // { url: 'js/admin-modules/auth.js', revision: 'js-auth-20231030-1' },
        // ... 他の admin-modules

        // Images
        { url: 'images/placeholder_item.png', revision: 'ph-item-v1.3' },
        { url: 'images/placeholder_slot.png', revision: 'ph-slot-v1.3' },
        { url: 'images/kakudai.png', revision: 'kakudai-v1.1' },
    ];

    try {
        if (workbox.precaching) {
            workbox.precaching.precacheAndRoute(filesToPrecache, {
                ignoreURLParametersMatching: [/.*/],
            });
            console.log('[SW] プリキャッシュファイルが登録されました。');
        } else {
            console.error('[SW] workbox.precaching モジュールが未定義です。Workboxのロードに問題がある可能性があります。');
        }
    } catch (error) {
        console.error('[SW] プリキャッシュ設定中にエラー:', error);
    }

    // ルーティング設定 (各サブモジュールの存在を確認してから使用)
    if (workbox.routing && workbox.strategies && workbox.cacheable_response && workbox.expiration) {
        console.log('[SW] ルーティングモジュールは利用可能です。ルーティングを設定します。');
        try {
            workbox.routing.registerRoute(
                ({ request }) => request.mode === 'navigate',
                new workbox.strategies.NetworkFirst({
                    cacheName: 'pages-cache-gh-v1.3', // キャッシュ名を適宜更新
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
                    cacheName: 'static-resources-cache-gh-v1.3', // キャッシュ名を適宜更新
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
                    cacheName: 'image-cache-gh-v1.3', // キャッシュ名を適宜更新
                    plugins: [
                        new workbox.expiration.ExpirationPlugin({
                            maxEntries: 150,
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
        console.error('[SW] Workboxのルーティング関連モジュールが未定義です (routing, strategies, cacheable_response, expiration)。Workboxのロードに問題がある可能性があります。');
    }

    // ★★★ Service Workerのライフサイクル制御 (修正箇所) ★★★
    self.addEventListener('install', (event) => {
        console.log('[SW] Installイベント: skipWaiting() を呼び出します。');
        self.skipWaiting();
    });

    self.addEventListener('activate', (event) => {
        console.log('[SW] Activateイベント: clients.claim() を呼び出します。');
        event.waitUntil(self.clients.claim());
    });
    // ★★★ 修正ここまで ★★★
    
    self.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SKIP_WAITING') {
            console.log('[SW] SKIP_WAITING メッセージを受信。skipWaiting()を再度呼び出します。');
            self.skipWaiting();
        }
    });

    console.log('[SW] Service Worker の設定が完了しました。');

} else {
    console.error('[SW] Workbox 自体が定義されていません。importScripts が失敗したか、ライブラリに問題がある可能性があります。');
}
