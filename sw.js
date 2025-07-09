// /-/sw.js - v1.6 (Resolves redundancy warning)

// v6.5.4 を指定（最新のパッチバージョン）
importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js');

if (workbox) {
  console.log(`[SW] Workbox ${workbox.VERSION} is loaded.`);
  
  const { precacheAndRoute } = workbox.precaching;
  const { registerRoute } = workbox.routing;
  const { StaleWhileRevalidate, CacheFirst } = workbox.strategies;
  const { CacheableResponsePlugin } = workbox.cacheable_response;

  // Service Workerのライフサイクルを制御
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', () => self.clients.claim());
  
  self.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'SKIP_WAITING') {
          self.skipWaiting();
      }
  });

  // プリキャッシュ: Service Worker起動後すぐにキャッシュしたいファイル
  // index.htmlをプリキャッシュに含めることで、オフラインでのアクセスが可能になる
  precacheAndRoute([
    { url: 'index.html', revision: 'shell-v1.6' },
    { url: 'css/base.css', revision: 'style-v1.6' },
    { url: 'css/modal.css', revision: 'style-v1.6' },
    { url: 'css/responsive.css', revision: 'style-v1.6' },
    { url: 'css/search-tool.css', revision: 'style-v1.6' },
    { url: 'css/simulator.css', revision: 'style-v1.6' },
    { url: 'firebase-config.js', revision: 'fb-v1.6' },
    { url: 'js/script-main.js', revision: 'main-v1.6' },
    { url: 'js/common/indexed-db-setup.js', revision: 'modules-v1.6' },
    { url: 'js/modules/data-loader.js', revision: 'modules-v1.6' },
    { url: 'js/modules/indexed-db-ops.js', revision: 'modules-v1.6' },
    { url: 'js/modules/search-filters.js', revision: 'modules-v1.6' },
    { url: 'js/modules/search-render.js', revision: 'modules-v1.6' },
    { url: 'js/modules/simulator-image.js', revision: 'modules-v1.6' },
    { url: 'js/modules/simulator-logic.js', revision: 'modules-v1.6' },
    { url: 'js/modules/simulator-ui.js', revision: 'modules-v1.6' },
    { url: 'js/modules/ui-main.js', revision: 'modules-v1.6' },
    { url: 'images/placeholder_item.png', revision: 'img-rev-1.6' },
    { url: 'images/placeholder_slot.png', revision: 'img-rev-1.6' },
  ]);

  // 警告の原因となっていたナビゲーションルートを削除
  // precacheAndRouteに 'index.html' が含まれているため、
  // Workboxが自動的にナビゲーションリクエストを処理してくれます。

  // CSSとJSのキャッシュ戦略 (StaleWhileRevalidate)
  registerRoute(
    ({ request }) => request.destination === 'style' || request.destination === 'script',
    new StaleWhileRevalidate({
      cacheName: 'static-assets-cache-v1.6',
    })
  );

  // 画像のキャッシュ戦略 (CacheFirst)
  registerRoute(
    ({ request }) => request.destination === 'image',
    new CacheFirst({
      cacheName: 'images-cache-v1.6',
      plugins: [
        new CacheableResponsePlugin({
          statuses: [0, 200],
        }),
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 50,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30日
        }),
      ],
    })
  );
  
  // CDNからのライブラリもキャッシュする
  registerRoute(
    ({url}) => url.origin === 'https://cdnjs.cloudflare.com' || url.origin === 'https://cdn.jsdelivr.net',
    new StaleWhileRevalidate({
      cacheName: 'third-party-libs-cache'
    })
  );


  console.log('[SW] Routing and precaching are configured.');

} else {
  console.error('[SW] Workbox could not be loaded. Offline functionality will not work.');
}
