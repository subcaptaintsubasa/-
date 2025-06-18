// /-/sw.js

// WorkboxライブラリをCDNからインポート
// importScriptsはService Workerのトップレベルで実行する必要があります。
// また、これが失敗すると以降のコードは実行されないか、workboxがundefinedになります。
const WORKBOX_VERSION = '6.5.3'; // バージョンを定数化
try {
    importScripts(`https://storage.googleapis.com/workbox-cdn/releases/${WORKBOX_VERSION}/workbox-sw.js`);
} catch (error) {
    console.error(`[SW] Workbox (${WORKBOX_VERSION}) の importScripts に失敗しました:`, error);
    // importScriptsが失敗した場合、ここに来る前にエラーで停止する可能性が高い
}

// workboxがグローバルスコープにロードされたかを確認
if (typeof workbox !== 'undefined') {
    console.log(`[SW] Workbox ${workbox.VERSION} がロードされました。`);

    workbox.setConfig({
        debug: true, // 開発中はtrueにすると詳細なログが出る
    });

    // 1. プリキャッシュ設定
    try {
        workbox.precaching.precacheAndRoute([
            // ... (プリキャッシュリストは前回と同様) ...
            // App Shell と主要なHTML
            { url: 'index.html', revision: 'appshell-20231028-1' }, 
            { url: 'css/base.css', revision: 'css-base-20231028-1' },
            { url: 'css/modal.css', revision: 'css-modal-20231028-1' },
            { url: 'css/search-tool.css', revision: 'css-search-20231028-1' },
            { url: 'css/simulator.css', revision: 'css-sim-20231028-1' },
            { url: 'css/responsive.css', revision: 'css-resp-20231028-1' },
            { url: 'js/script-main.js', revision: 'js-main-20231028-2' }, // revision 更新例
            { url: 'js/common/indexed-db-setup.js', revision: 'js-idbsetup-20231028-1' },
            { url: 'js/modules/indexed-db-ops.js', revision: 'js-idbops-20231028-1' },
            { url: 'js/modules/data-loader.js', revision: 'js-dataload-20231028-2' }, // revision 更新例
            { url: 'js/firebase-config.js', revision: 'js-fbconf-20231028-1'},
            { url: 'js/modules/ui-main.js', revision: 'js-uimain-20231028-1'},
            { url: 'js/modules/search-filters.js', revision: 'js-searchfilt-20231028-1'},
            { url: 'js/modules/search-render.js', revision: 'js-searchrend-20231028-1'},
            { url: 'js/modules/simulator-ui.js', revision: 'js-simui-20231028-1'},
            { url: 'js/modules/simulator-logic.js', revision: 'js-simlogic-20231028-1'},
            { url: 'js/modules/simulator-image.js', revision: 'js-simimg-20231028-1'},
            { url: 'images/placeholder_item.png', revision: 'placeholder-item-v1.1' },
            { url: 'images/placeholder_slot.png', revision: 'placeholder-slot-v1.1' },
        ], {
            ignoreURLParametersMatching: [/.*/],
        });
        console.log('[SW] プリキャッシュファイルが登録されました。');
    } catch (error) {
        console.error('[SW] プリキャッシュ設定中にエラー:', error);
    }

    // 2. ナビゲーションリクエストのルーティング
    try {
        workbox.routing.registerRoute(
            ({ request }) => request.mode === 'navigate',
            new workbox.strategies.NetworkFirst({
                cacheName: 'pages-cache-gh-v1.1', // キャッシュ名更新
                plugins: [
                    new workbox.cacheable_response.CacheableResponsePlugin({ // ★ ここでエラーが出ていた
                        statuses: [0, 200],
                    }),
                ]
            })
        );
        console.log('[SW] ナビゲーションリクエストのルーティングが設定されました。');
    } catch(error) {
        console.error('[SW] ナビゲーションルーティング設定エラー:', error);
    }

    // 3. 静的リソース (CSS, JS) のキャッシュ戦略
    try {
        workbox.routing.registerRoute(
            ({ request }) => request.destination === 'style' || request.destination === 'script',
            new workbox.strategies.StaleWhileRevalidate({
                cacheName: 'static-resources-cache-gh-v1.1', // キャッシュ名更新
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


    // 4. 画像のキャッシュ戦略
    try {
        workbox.routing.registerRoute(
            ({ request }) => request.destination === 'image',
            new workbox.strategies.CacheFirst({
                cacheName: 'image-cache-gh-v1.1', // キャッシュ名更新
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

    // R2画像のルーティング (オプション、コメントアウトのまま)
    // ...

    // Service Workerのライフサイクル制御
    try {
        workbox.core.skipWaiting();
        workbox.core.clientsClaim();
        console.log('[SW] skipWaiting と clientsClaim が設定されました。');
    } catch(error) {
        console.error('[SW] skipWaiting/clientsClaim 設定エラー:', error);
    }

    console.log('[SW] Service Worker の設定が完了しました。');

} else {
    // このブロックは、importScriptsが成功してもworkboxが未定義の場合、または
    // importScripts自体が失敗して、このif文に到達しないが、
    // typeof workbox が 'undefined' になる場合に実行される可能性がある。
    // ただし、importScriptsが失敗するとスクリプト評価自体が止まることが多い。
    console.error('[SW] Workbox が定義されていません。importScripts が失敗したか、ライブラリに問題がある可能性があります。');
}
