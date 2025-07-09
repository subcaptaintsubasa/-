// /-/sw.js

const WORKBOX_VERSION = '6.5.3';

try {
    importScripts(`https://storage.googleapis.com/workbox-cdn/releases/${WORKBOX_VERSION}/workbox-sw.js`);
    console.log(`[SW] Workbox ${WORKBOX_VERSION} loaded.`);
} catch (error) {
    console.error(`[SW] Failed to load Workbox:`, error);
    throw error;
}

if (workbox) {
    console.log(`[SW] Workbox is available.`);
    workbox.setConfig({ debug: false });

    const { registerRoute } = workbox.routing;
    const { CacheFirst, StaleWhileRevalidate, NetworkFirst } = workbox.strategies;
    const { CacheableResponsePlugin } = workbox.cacheable_response;
    const { ExpirationPlugin } = workbox.expiration;
    const { precacheAndRoute } = workbox.precaching;

    // Service Workerのライフサイクル
    self.addEventListener('install', (event) => {
        console.log('[SW] Event: install');
        event.waitUntil(self.skipWaiting());
    });

    self.addEventListener('activate', (event) => {
        console.log('[SW] Event: activate');
        event.waitUntil(self.clients.claim());
    });
        
    self.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SKIP_WAITING') {
            console.log('[SW] Received SKIP_WAITING message.');
            self.skipWaiting();
        }
    });

    // プリキャッシュ: Service Worker起動後すぐにキャッシュしたいファイル
    // revisionを更新すると、Service Workerが新しいバージョンとして認識され、キャッシュが更新される
    precacheAndRoute([
        // HTML/CSS/JS Core
        { url: 'index.html', revision: 'shell-v1.4' },
        { url: 'css/base.css', revision: 'style-v1.4' },
        { url: 'css/modal.css', revision: 'style-v1.4' },
        { url: 'css/search-tool.css', revision: 'style-v1.4' },
        { url: 'css/simulator.css', revision: 'style-v1.4' },
        { url: 'css/responsive.css', revision: 'style-v1.4' },
        { url: 'js/script-main.js', revision: 'main-v1.4' },
        { url: 'firebase-config.js', revision: 'fb-v1.4' },
        // Modules
        { url: 'js/common/indexed-db-setup.js', revision: 'modules-v1.4' },
        { url: 'js/modules/indexed-db-ops.js', revision: 'modules-v1.4' },
        { url: 'js/modules/data-loader.js', revision: 'modules-v1.4' },
        { url: 'js/modules/ui-main.js', revision: 'modules-v1.4' },
        { url: 'js/modules/search-filters.js', revision: 'modules-v1.4' },
        { url: 'js/modules/search-render.js', revision: 'modules-v1.4' },
        { url: 'js/modules/simulator-ui.js', revision: 'modules-v1.4' },
        { url: 'js/modules/simulator-logic.js', revision: 'modules-v1.4' },
        { url: 'js/modules/simulator-image.js', revision: 'modules-v1.4' },
        { url: 'js/common/utils.js', revision: 'modules-v1.4' },
        // Images
        { url: 'images/placeholder_item.png', revision: 'img-v1.4' },
        { url: 'images/placeholder_slot.png', revision: 'img-v1.4' },
        // Libraries
        { url: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', revision: 'h2c-1.4.1' },
        { url: 'https://cdn.jsdelivr.net/npm/idb@7/build/umd.js', revision: 'idb-7' }
    ]);

    // ナビゲーションリクエスト（ページ読み込み）の戦略
    // NetworkFirst: まずネットワークに試し、失敗したらキャッシュから返す
    registerRoute(
        ({ request }) => request.mode === 'navigate',
        new NetworkFirst({
            cacheName: 'pages-cache-v1.4',
            plugins: [
                new CacheableResponsePlugin({ statuses: [0, 200] })
            ]
        })
    );

    // CSS, JS ファイルの戦略
    // StaleWhileRevalidate: まずキャッシュから返し、裏でネットワークから新しいものを取得してキャッシュを更新
    registerRoute(
        ({ request }) => request.destination === 'style' || request.destination === 'script',
        new StaleWhileRevalidate({
            cacheName: 'static-assets-cache-v1.4',
            plugins: [
                new CacheableResponsePlugin({ statuses: [0, 200] })
            ]
        })
    );

    // 画像ファイルの戦略
    // CacheFirst: まずキャッシュを探し、あればそれを返す。なければネットワークから取得してキャッシュに保存
    registerRoute(
        ({ request }) => request.destination === 'image',
        new CacheFirst({
            cacheName: 'images-cache-v1.4',
            plugins: [
                new ExpirationPlugin({
                    maxEntries: 100, // キャッシュする画像の最大数
                    maxAgeSeconds: 30 * 24 * 60 * 60, // 30日間
                    purgeOnQuotaError: true, // 容量オーバー時に自動削除
                }),
                new CacheableResponsePlugin({ statuses: [0, 200] })
            ]
        })
    );

    console.log('[SW] Routing and precaching are configured.');

} else {
    console.error('[SW] Workbox did not initialize.');
}
