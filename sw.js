// /-/sw.js

const WORKBOX_VERSION = '6.5.3';

try {
    importScripts(`https://storage.googleapis.com/workbox-cdn/releases/${WORKBOX_VERSION}/workbox-sw.js`);
} catch (error) {
    console.error(`[SW] Workbox (${WORKBOX_VERSION}) の importScripts に失敗しました:`, error);
    throw error;
}

if (typeof workbox === 'undefined') {
    console.error('[SW] Workboxオブジェクトが定義されていません。Service Workerは正しく機能しません。');
    throw new Error("Workbox could not be loaded.");
}

const { registerRoute } = workbox.routing;
const { CacheFirst, StaleWhileRevalidate, NetworkFirst } = workbox.strategies;
const { CacheableResponsePlugin } = workbox.cacheable_response;
const { ExpirationPlugin } = workbox.expiration;
const { precacheAndRoute, createHandlerBoundToURL } = workbox.precaching;

console.log(`[SW] Workbox ${workbox.VERSION} がロードされました。`);
workbox.setConfig({ debug: false }); // 本番環境ではfalseを推奨

// Service Workerのライフサイクル
self.addEventListener('install', (event) => {
    console.log('[SW] Installイベント発生');
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    console.log('[SW] Activateイベント発生');
    event.waitUntil(self.clients.claim());
});
    
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log('[SW] SKIP_WAITING メッセージを受信。');
        self.skipWaiting();
    }
});

// プリキャッシュ対象ファイルリスト
// revisionはファイルを更新するたびに変更してください
precacheAndRoute([
    { url: 'index.html', revision: 'appshell-v1.3' },
    { url: 'css/base.css', revision: 'css-v1.3' },
    { url: 'css/modal.css', revision: 'css-v1.3' },
    { url: 'css/search-tool.css', revision: 'css-v1.3' },
    { url: 'css/simulator.css', revision: 'css-v1.3' },
    { url: 'css/responsive.css', revision: 'css-v1.3' },
    { url: 'firebase-config.js', revision: 'fbconf-v1.3' },
    { url: 'js/script-main.js', revision: 'js-main-v1.3' },
    { url: 'js/common/indexed-db-setup.js', revision: 'js-idb-v1.3' },
    { url: 'js/modules/data-loader.js', revision: 'js-loader-v1.3' },
    { url: 'images/placeholder_item.png', revision: 'img-v1.3' },
    { url: 'images/placeholder_slot.png', revision: 'img-v1.3' },
    { url: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', revision: 'h2c-1.4.1' },
    { url: 'https://cdn.jsdelivr.net/npm/idb@7/build/umd.js', revision: 'idb-7' }
]);

// ナビゲーションリクエスト（ページ遷移）のルーティング
// URLが '/-/' で終わるか、ナビゲーションリクエストの場合に 'index.html' を返す
const handler = createHandlerBoundToURL('index.html');
const navigationRoute = new workbox.routing.NavigationRoute(handler, {
    // 必要に応じてブラックリスト・ホワイトリストを設定
    // denylist: [/^\/admin/] 
});
registerRoute(navigationRoute);

// CSS, JS, Workerのキャッシュ戦略 (StaleWhileRevalidate)
registerRoute(
    ({ request }) => ['style', 'script', 'worker'].includes(request.destination),
    new StaleWhileRevalidate({
        cacheName: 'static-resources-cache-v1.3',
        plugins: [
            new CacheableResponsePlugin({ statuses: [0, 200] })
        ]
    })
);

// 画像のキャッシュ戦略 (CacheFirst)
registerRoute(
    ({ request }) => request.destination === 'image',
    new CacheFirst({
        cacheName: 'image-cache-v1.3',
        plugins: [
            new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60, purgeOnQuotaError: true }), // 30 Days
            new CacheableResponsePlugin({ statuses: [0, 200] })
        ]
    })
);

console.log('[SW] Service Worker スクリプトの評価が完了しました。');
