// /-/sw.js - v1.7 (Final fix for module loading)

const WORKBOX_VERSION = '6.5.4';
importScripts(`https://storage.googleapis.com/workbox-cdn/releases/${WORKBOX_VERSION}/workbox-sw.js`);

// Service Workerのライフサイクルを制御
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

if (workbox) {
  console.log(`[SW] Workbox ${workbox.VERSION} is loaded.`);
  
  // Workboxのサブモジュールを明示的にロード
  workbox.loadModule('workbox-precaching');
  workbox.loadModule('workbox-routing');
  workbox.loadModule('workbox-strategies');
  workbox.loadModule('workbox-cacheable-response');
  workbox.loadModule('workbox-expiration');

  const { precacheAndRoute } = workbox.precaching;
  const { registerRoute } = workbox.routing;
  const { NetworkFirst, StaleWhileRevalidate, CacheFirst } = workbox.strategies;
  const { CacheableResponsePlugin } = workbox.cacheable_response;
  const { ExpirationPlugin } = workbox.expiration;

  workbox.setConfig({ debug: false });

  // プリキャッシュ対象
  precacheAndRoute([
    { url: 'index.html', revision: 'shell-v1.7' },
    { url: 'css/base.css', revision: 'style-v1.7' },
    { url: 'css/modal.css', revision: 'style-v1.7' },
    { url: 'css/responsive.css', revision: 'style-v1.7' },
    { url: 'css/search-tool.css', revision: 'style-v1.7' },
    { url: 'css/simulator.css', revision: 'style-v1.7' },
    { url: 'firebase-config.js', revision: 'fb-v1.7' },
    { url: 'js/script-main.js', revision: 'main-v1.7' },
    { url: 'js/common/indexed-db-setup.js', revision: 'modules-v1.7' },
    { url: 'js/modules/data-loader.js', revision: 'modules-v1.7' },
    { url: 'js/modules/indexed-db-ops.js', revision: 'modules-v1.7' },
    { url: 'js/modules/search-filters.js', revision: 'modules-v1.7' },
    { url: 'js/modules/search-render.js', revision: 'modules-v1.7' },
    { url: 'js/modules/simulator-image.js', revision: 'modules-v1.7' },
    { url: 'js/modules/simulator-logic.js', revision: 'modules-v1.7' },
    { url: 'js/modules/simulator-ui.js', revision: 'modules-v1.7' },
    { url: 'js/modules/ui-main.js', revision: 'modules-v1.7' },
    { url: 'images/placeholder_item.png', revision: 'img-rev-1.7' },
    { url: 'images/placeholder_slot.png', revision: 'img-rev-1.7' },
  ]);

  // ナビゲーションリクエスト（ページ読み込み）
  registerRoute(
    ({ request }) => request.mode === 'navigate',
    new NetworkFirst({
      cacheName: 'pages-cache-v1.7',
    })
  );

  // CSSとJS
  registerRoute(
    ({ request }) => request.destination === 'style' || request.destination === 'script',
    new StaleWhileRevalidate({
      cacheName: 'static-assets-cache-v1.7',
    })
  );

  // 画像
  registerRoute(
    ({ request }) => request.destination === 'image',
    new CacheFirst({
      cacheName: 'images-cache-v1.7',
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 }),
      ],
    })
  );
  
  // CDNライブラリ
  registerRoute(
    ({url}) => url.origin === 'https://cdnjs.cloudflare.com' || url.origin === 'https://cdn.jsdelivr.net',
    new CacheFirst({ // 外部ライブラリは変更が少ないのでCacheFirstが適している場合が多い
      cacheName: 'third-party-libs-cache-v1.7',
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({ maxAgeSeconds: 365 * 24 * 60 * 60 }), // 1年間キャッシュ
      ],
    })
  );

  console.log('[SW] Routing and precaching are configured.');

} else {
  console.error('[SW] Workbox could not be loaded.');
}
