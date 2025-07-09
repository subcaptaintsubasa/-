// /-/sw.js - v1.8 (Final Attempt with Async Initialization)

const WORKBOX_VERSION = '6.5.4';

// ライブラリの読み込み
importScripts(`https://storage.googleapis.com/workbox-cdn/releases/${WORKBOX_VERSION}/workbox-sw.js`);

// Service Workerのライフサイクルを制御
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Workboxが正常に読み込まれた場合のみ、ルーティングを設定
if (self.workbox) {
  console.log(`[SW] Workbox ${self.workbox.VERSION} is available.`);
  
  // Workboxの各種モジュールを分割代入で取得
  const { precacheAndRoute } = self.workbox.precaching;
  const { registerRoute } = self.workbox.routing;
  const { NetworkFirst, StaleWhileRevalidate, CacheFirst } = self.workbox.strategies;
  const { CacheableResponsePlugin } = self.workbox.cacheable_response;
  const { ExpirationPlugin } = self.workbox.expiration;

  // デバッグモードを無効化
  self.workbox.setConfig({ debug: false });

  // プリキャッシュ: Service Workerインストール時に必須のファイルをキャッシュ
  precacheAndRoute([
    { url: 'index.html', revision: 'shell-v1.8' },
    { url: 'css/base.css', revision: 'style-v1.8' },
    { url: 'css/modal.css', revision: 'style-v1.8' },
    { url: 'css/responsive.css', revision: 'style-v1.8' },
    { url: 'css/search-tool.css', revision: 'style-v1.8' },
    { url: 'css/simulator.css', revision: 'style-v1.8' },
    { url: 'firebase-config.js', revision: 'fb-v1.8' },
    { url: 'js/script-main.js', revision: 'main-v1.8' },
  ]);

  // ナビゲーションリクエスト（ページ読み込み）の戦略
  registerRoute(
    ({ request }) => request.mode === 'navigate',
    new NetworkFirst({ cacheName: 'pages-cache-v1.8' })
  );

  // CSSとJSファイルのキャッシュ戦略
  registerRoute(
    ({ request }) => request.destination === 'style' || request.destination === 'script',
    new StaleWhileRevalidate({ cacheName: 'static-assets-cache-v1.8' })
  );

  // 画像ファイルのキャッシュ戦略
  registerRoute(
    ({ request }) => request.destination === 'image',
    new CacheFirst({
      cacheName: 'images-cache-v1.8',
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 }),
      ],
    })
  );
  
  // CDNライブラリのキャッシュ戦略
  registerRoute(
    ({url}) => url.origin === 'https://cdnjs.cloudflare.com' || url.origin === 'https://cdn.jsdelivr.net',
    new CacheFirst({
      cacheName: 'third-party-libs-cache-v1.8',
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({ maxAgeSeconds: 365 * 24 * 60 * 60 }), // 1年間キャッシュ
      ],
    })
  );

  console.log('[SW] Routing and precaching have been configured.');

} else {
  console.error('[SW] Workbox could not be loaded. Offline functionality will not work.');
}
