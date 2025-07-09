// /-/sw.js - v1.5 (Simplified and more robust version)

// v6.5.4 を指定（最新のパッチバージョン）
importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js');

if (workbox) {
  console.log(`[SW] Workbox ${workbox.VERSION} is loaded.`);
  
  const { precacheAndRoute } = workbox.precaching;
  const { registerRoute } = workbox.routing;
  const { NetworkFirst, StaleWhileRevalidate, CacheFirst } = workbox.strategies;
  const { CacheableResponsePlugin } = workbox.cacheable_response;

  // デプロイごとにこのリビジョンを変更すると更新が確実になります
  const revision = 'app-rev-1.5'; 

  // プリキャッシュ対象: これらはService Workerインストール時にキャッシュされます
  // URLはService Workerファイルからの相対パスで記述します
  precacheAndRoute([
    { url: 'index.html', revision: revision },
    { url: 'css/base.css', revision: revision },
    { url: 'css/modal.css', revision: revision },
    { url: 'css/responsive.css', revision: revision },
    { url: 'css/search-tool.css', revision: revision },
    { url: 'css/simulator.css', revision: revision },
    { url: 'firebase-config.js', revision: revision },
    { url: 'js/script-main.js', revision: revision },
    { url: 'js/common/indexed-db-setup.js', revision: revision },
    { url: 'js/modules/data-loader.js', revision: revision },
    { url: 'js/modules/indexed-db-ops.js', revision: revision },
    { url: 'js/modules/search-filters.js', revision: revision },
    { url: 'js/modules/search-render.js', revision: revision },
    { url: 'js/modules/simulator-image.js', revision: revision },
    { url: 'js/modules/simulator-logic.js', revision: revision },
    { url: 'js/modules/simulator-ui.js', revision: revision },
    { url: 'js/modules/ui-main.js', revision: revision },
    { url: 'images/placeholder_item.png', revision: 'img-rev-1' },
    { url: 'images/placeholder_slot.png', revision: 'img-rev-1' },
  ]);

  // ページのキャッシュ戦略
  // ナビゲーションリクエスト（例: ユーザーが直接URLを入力、リンクをクリック）
  // NetworkFirst: まずネットワークにアクセスし、失敗したらキャッシュを返す
  registerRoute(
    ({ request }) => request.mode === 'navigate',
    new NetworkFirst({
      cacheName: 'pages-cache',
    })
  );

  // CSSとJSのキャッシュ戦略
  // StaleWhileRevalidate: まずキャッシュから返し、裏でネットワークから更新
  registerRoute(
    ({ request }) => request.destination === 'style' || request.destination === 'script',
    new StaleWhileRevalidate({
      cacheName: 'static-assets-cache',
    })
  );

  // 画像のキャッシュ戦略
  // CacheFirst: まずキャッシュを探し、あればそれを使い、なければネットワークから取得
  registerRoute(
    ({ request }) => request.destination === 'image',
    new CacheFirst({
      cacheName: 'images-cache',
      plugins: [
        new CacheableResponsePlugin({
          statuses: [0, 200], // 0はOpaque Responseを許容
        }),
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 50,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30日
        }),
      ],
    })
  );

  // Service Workerのライフサイクルを制御
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', () => self.clients.claim());

} else {
  console.error('[SW] Workbox could not be loaded. Offline functionality will not work.');
}
