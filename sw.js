// /-/sw.js

const WORKBOX_VERSION = '6.5.3';

try {
    importScripts(`https://storage.googleapis.com/workbox-cdn/releases/${WORKBOX_VERSION}/workbox-sw.js`);
} catch (error) {
    console.error(`[SW] Workbox (${WORKBOX_VERSION}) の importScripts に失敗しました:`, error);
    throw error; // インストールを失敗させる
}

if (typeof workbox === 'undefined') {
    console.error('[SW] Workboxオブジェクトが定義されていません。Service Workerは正しく機能しません。');
    // ここで処理を終了させるか、エラーをスローする
    throw new Error("Workbox could not be loaded.");
}

console.log(`[SW] Workbox ${workbox.VERSION} がロードされました。`);
workbox.setConfig({ debug: true });

// Service Workerのライフサイクルイベント
self.addEventListener('install', (event) => {
    console.log('[SW] Installイベント発生');
    // 新しいSWがインストールされたら、すぐに古いSWと置き換わるように指示
    // これにより、"waiting"状態をスキップしてactivateに進む
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    console.log('[SW] Activateイベント発生');
    // Service Workerがアクティベートされたら、すぐにページ(クライアント)を制御下に置く
    // これにより、ページをリロードしなくても新しいSWが有効になる
    event.waitUntil(self.clients.claim());
    console.log('[SW] clients.claim() 完了。ルーティング設定を開始します。');

    // ルーティング設定は activate イベント内で行うことで、
    // workbox のサブモジュールが確実に利用可能になってから実行されることを期待
    if (workbox.routing && workbox.strategies && workbox.cacheable_response && workbox.expiration && workbox.precaching) {
        console.log('[SW] Activate: ルーティングモジュールは利用可能です。');

        const filesToPrecache = [
            // ユーザー画面に必須なものに絞る例
            { url: 'index.html', revision: 'appshell-20231101-1' },
            { url: 'css/base.css', revision: 'css-base-20231101-1' },
            { url: 'css/modal.css', revision: 'css-modal-20231101-1' },
            { url: 'css/search-tool.css', revision: 'css-search-20231101-1' },
            { url: 'css/simulator.css', revision: 'css-sim-20231101-1' },
            { url: 'css/responsive.css', revision: 'css-resp-20231101-1' },

            { url: 'firebase-config.js', revision: 'fbconf-20231101-1' },
            { url: 'js/script-main.js', revision: 'js-main-20231101-1' },
            { url: 'js/common/indexed-db-setup.js', revision: 'js-idbsetup-20231101-1' },
            { url: 'js/modules/indexed-db-ops.js', revision: 'js-idbops-20231101-1' },
            { url: 'js/modules/data-loader.js', revision: 'js-dataload-20231101-1' },
            { url: 'js/modules/ui-main.js', revision: 'js-uimain-20231101-1'},
            { url: 'js/modules/search-filters.js', revision: 'js-searchfilt-20231101-1'},
            { url: 'js/modules/search-render.js', revision: 'js-searchrend-20231101-1'},
            { url: 'js/modules/simulator-ui.js', revision: 'js-simui-20231101-1'},
            { url: 'js/modules/simulator-logic.js', revision: 'js-simlogic-20231101-1'},
            { url: 'js/modules/simulator-image.js', revision: 'js-simimg-20231101-1'},
            // ユーティリティも必要なら
            { url: 'js/common/utils.js', revision: 'js-utils-20231101-1' },


            // 確実に存在するUI画像
            { url: 'images/placeholder_item.png', revision: 'ph-item-v1.4' }, // パスと存在を再確認
            { url: 'images/placeholder_slot.png', revision: 'ph-slot-v1.4' }, // パスと存在を再確認
            { url: 'images/kakudai.png', revision: 'kakudai-v1.2' },      // パスと存在を再確認
        ];
        try {
            workbox.precaching.precacheAndRoute(filesToPrecache, {
                ignoreURLParametersMatching: [/.*/],
            });
            console.log('[SW] プリキャッシュファイルが登録されました。');
        } catch (error) {
            console.error('[SW] プリキャッシュ設定中にエラー:', error);
        }

        try { /* Nav */ workbox.routing.registerRoute( ({ request }) => request.mode === 'navigate', new workbox.strategies.NetworkFirst({ cacheName: 'pages-cache-gh-v1.4', plugins: [ new workbox.cacheable_response.CacheableResponsePlugin({ statuses: [0, 200] }) ] }) ); console.log('[SW] ナビゲーションルーティング設定完了。'); } catch(e) { console.error('[SW] ナビゲーションルーティングエラー:', e); }
        try { /* Static */ workbox.routing.registerRoute( ({ request }) => request.destination === 'style' || request.destination === 'script', new workbox.strategies.StaleWhileRevalidate({ cacheName: 'static-resources-cache-gh-v1.4', plugins: [ new workbox.cacheable_response.CacheableResponsePlugin({ statuses: [0, 200] }) ] }) ); console.log('[SW] 静的リソースルーティング設定完了。'); } catch(e) { console.error('[SW] 静的リソースルーティングエラー:', e); }
        try { /* Images */ workbox.routing.registerRoute( ({ request }) => request.destination === 'image', new workbox.strategies.CacheFirst({ cacheName: 'image-cache-gh-v1.4', plugins: [ new workbox.expiration.ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60, purgeOnQuotaError: true }), new workbox.cacheable_response.CacheableResponsePlugin({ statuses: [0, 200] }) ] }) ); console.log('[SW] 画像ルーティング設定完了。'); } catch(e) { console.error('[SW] 画像ルーティングエラー:', e); }

    } else {
        console.error('[SW] Activateイベント: Workboxのルーティング関連モジュールが未定義です。');
    }
    console.log('[SW] Activateイベント完了。');
});
    
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log('[SW] SKIP_WAITING メッセージを受信。skipWaiting()を実行します。');
        self.skipWaiting();
    }
});

console.log('[SW] Service Worker スクリプトの評価が完了しました。');
