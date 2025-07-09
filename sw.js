// /-/sw.js - v1.9 (Final)

// Workboxライブラリをインポートします
importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js');

// Service Workerのライフサイクルイベントを登録します
// これらはWorkboxの初期化とは独立して設定します
self.addEventListener('install', () => {
  console.log('[SW] Install event');
  self.skipWaiting();
});

self.addEventListener('activate', () => {
  console.log('[SW] Activate event');
  self.clients.claim();
});

// workboxオブジェクトが正常にロードされたことを確認してから、すべての設定を行います
if (workbox) {
  console.log(`[SW] Workbox ${workbox.version} is loaded and available.`);

  // デバッグモードを無効にします（本番環境推奨）
  workbox.setConfig({ debug: false });

  // 必要なモジュールを分割代入で取得します
  const { precacheAndRoute } = workbox.precaching;
  const { registerRoute } = workbox.routing;
  const { NetworkFirst, StaleWhileRevalidate, CacheFirst } = workbox.strategies;
  const { CacheableResponsePlugin } = workbox.cacheable_response;
  const { ExpirationPlugin } = workbox.expiration;

  // プリキャッシュ: Service Workerのインストール時に必須ファイルをキャッシュします
  // revisionはファイルを更新するたびに変更すると、キャッシュが更新されます
  precacheAndRoute([
    { url: 'index.html', revision: 'shell-v1.9' },
    { url: 'css/base.css', revision: 'style-v1.9' },
    { url: 'css/modal.css', revision: 'style-v1.9' },
    { url: 'css/responsive.css', revision: 'style-v1.9' },
    { url: 'css/search-tool.css', revision: 'style-v1.9' },
    { url: 'css/simulator.css', revision: 'style-v1.9' },
    { url: 'firebase-config.js', revision: 'fb-v1.9' },
    { url: 'js/script-main.js', revision: 'main-v1.9' },
    // 必要に応じて他の重要なJSファイルも追加できます
  ]);

  // ルーティング設定
  // 1. ページ本体 (HTML) のキャッシュ戦略
  registerRoute(
    ({ request }) => request.mode === 'navigate',
    new NetworkFirst({
      cacheName: 'pages-cache-v1.9',
    })
  );

  // 2. CSSとJSファイルのキャッシュ戦略
  registerRoute(
    ({ request }) => request.destination === 'style' || request.destination === 'script',
    new StaleWhileRevalidate({
      cacheName: 'static-assets-cache-v1.9',
    })
  );

  // 3. 画像ファイルのキャッシュ戦略
  registerRoute(
    ({ request }) => request.destination === 'image',
    new CacheFirst({
      cacheName: 'images-cache-v1.9',
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({
          maxEntries: 100, // キャッシュする画像の最大数
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30日間
        }),
      ],
    })
  );
  
  // 4. CDNから読み込む外部ライブラリのキャッシュ戦略
  registerRoute(
    ({ url }) => url.origin === 'https://cdnjs.cloudflare.com' || url.origin === 'https://cdn.jsdelivr.net',
    new CacheFirst({ // ライブラリは頻繁に変わらないのでCacheFirstが適しています
      cacheName: 'third-party-libs-cache-v1.9',
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({ maxAgeSeconds: 365 * 24 * 60 * 60 }), // 1年間キャッシュ
      ],
    })
  );

  console.log('[SW] All routing rules have been set up.');

} else {
  console.error('[SW] Workbox could not be loaded. Offline functionality will not work.');
}
