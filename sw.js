// /sw.js (またはプロジェクトルート/sw.js)

// WorkboxライブラリをCDNからインポート
try {
    importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.3/workbox-sw.js'); // 最新バージョンを確認・適宜変更
} catch (e) {
    console.error("Workboxライブラリの読み込みに失敗しました:", e);
}

if (typeof workbox !== 'undefined') {
    console.log(`[SW] Workbox ${workbox.VERSION} がロードされました。`);

    // 1. プリキャッシュ設定 (Service Workerインストール時にキャッシュするファイル)
    // revision はファイル内容が変更されたら更新する文字列 (例: 'v1.1', ファイルハッシュなど)
    // これにより、ファイル更新時にService Workerが新しいバージョンを検知しやすくなります。
    workbox.precaching.precacheAndRoute([
        // App Shell と主要なHTML
        { url: '/index.html', revision: 'appshell-20231027-1' }, // パスはサイトのルートからの相対パス

        // 主要なCSSファイル
        { url: '/css/base.css', revision: 'css-base-20231027-1' },
        { url: '/css/modal.css', revision: 'css-modal-20231027-1' },
        { url: '/css/search-tool.css', revision: 'css-search-20231027-1' },
        { url: '/css/simulator.css', revision: 'css-sim-20231027-1' },
        { url: '/css/responsive.css', revision: 'css-resp-20231027-1' },

        // 主要なJavaScriptファイル (バンドルしている場合はそのファイル)
        // モジュールローダーやエントリーポイントとなるJSを指定
        { url: '/js/script-main.js', revision: 'js-main-20231027-1' },
        // IndexedDB関連やデータローダーもキャッシュしておくとオフライン起動がスムーズ
        { url: '/js/common/indexed-db-setup.js', revision: 'js-idbsetup-20231027-1' },
        { url: '/js/modules/indexed-db-ops.js', revision: 'js-idbops-20231027-1' },
        { url: '/js/modules/data-loader.js', revision: 'js-dataload-20231027-1' },
        // idbライブラリ自体はCDNからなので、ここではキャッシュしません (ブラウザキャッシュに期待)
        // html2canvasもCDNからなので同様

        // UI画像やプレースホルダー
        { url: '/images/placeholder_item.png', revision: 'placeholder-item-v1' },
        { url: '/images/placeholder_slot.png', revision: 'placeholder-slot-v1' },
        // { url: '/images/logo.png', revision: 'logo-v1' }, // ロゴがあれば

        // (オプション) PWAにするならマニフェストファイル
        // { url: '/manifest.json', revision: 'manifest-v1' },
    ]);
    console.log('[SW] プリキャッシュファイルが登録されました。');

    // 2. ナビゲーションリクエストのルーティング (HTMLページへのアクセス)
    // 戦略: NetworkFirst (まずネットワークを試し、失敗したらキャッシュから返す)
    // これにより、オンライン時は常に最新のHTMLを取得しようとし、オフライン時はキャッシュされたApp Shellを表示
    workbox.routing.registerRoute(
        ({ request }) => request.mode === 'navigate',
        new workbox.strategies.NetworkFirst({
            cacheName: 'pages-cache-v1',
            plugins: [
                new workbox.cacheable_response.CacheableResponsePlugin({
                    statuses: [0, 200], // 0はオフライン時の不透明なレスポンス
                }),
                // (オプション) フォールバックHTMLを指定する場合
                // new workbox.routing.NetworkOnly({
                //     plugins: [
                //         new workbox.backgroundSync.BackgroundSyncPlugin('page-fallbacks', {
                //             maxRetentionTime: 24 * 60 // 分
                //         })
                //     ],
                //     fetchOptions: {method: 'GET'},
                //     handler: {
                //         handle: async ({event}) => {
                //             try {
                //                 return await fetch(event.request);
                //             } catch (error) {
                //                 return caches.match(workbox.precaching.getCacheKeyForURL('/offline.html') || '/index.html');
                //             }
                //         }
                //     }
                // })
            ]
        })
    );
    console.log('[SW] ナビゲーションリクエストのルーティングが設定されました。');

    // 3. 静的リソース (CSS, JS) のキャッシュ戦略
    // 戦略: StaleWhileRevalidate (キャッシュからすぐに返し、バックグラウンドでネットワークから更新)
    workbox.routing.registerRoute(
        ({ request }) => request.destination === 'style' || request.destination === 'script',
        new workbox.strategies.StaleWhileRevalidate({
            cacheName: 'static-resources-cache-v1',
            plugins: [
                new workbox.cacheable_response.CacheableResponsePlugin({
                    statuses: [0, 200],
                }),
            ]
        })
    );
    console.log('[SW] 静的リソース (CSS, JS) のルーティングが設定されました。');

    // 4. 画像のキャッシュ戦略
    // 戦略: CacheFirst (キャッシュにあればそれを使い、なければネットワークから取得してキャッシュ)
    workbox.routing.registerRoute(
        ({ request }) => request.destination === 'image',
        new workbox.strategies.CacheFirst({
            cacheName: 'image-cache-v1',
            plugins: [
                new workbox.expiration.ExpirationPlugin({
                    maxEntries: 150, // キャッシュする画像の最大エントリ数
                    maxAgeSeconds: 30 * 24 * 60 * 60, // 30日間キャッシュ保持
                    purgeOnQuotaError: true, // ストレージ圧迫時に自動削除
                }),
                new workbox.cacheable_response.CacheableResponsePlugin({
                    statuses: [0, 200],
                }),
            ],
        })
    );
    console.log('[SW] 画像のルーティングが設定されました。');

    // (オプション) Cloudflare R2からのアイテム画像に特化した戦略
    // もしR2のドメインが `https://xxxx.cloudflarestorage.com` のような場合
    // const r2ImageOrigin = 'https://your-r2-public-bucket-url.com'; // あなたのR2の公開URLドメインに置き換えてください
    // workbox.routing.registerRoute(
    //     ({url}) => url.origin === r2ImageOrigin && url.pathname.includes('/item_images/'), // 例: /item_images/ ディレクトリ以下
    //     new workbox.strategies.CacheFirst({
    //         cacheName: 'r2-item-images-cache-v1',
    //         plugins: [
    //             new workbox.expiration.ExpirationPlugin({
    //                 maxEntries: 300, // アイテム画像は多めに
    //                 maxAgeSeconds: 14 * 24 * 60 * 60, // 14日間
    //                 purgeOnQuotaError: true,
    //             }),
    //             new workbox.cacheable_response.CacheableResponsePlugin({
    //                 statuses: [0, 200],
    //             }),
    //         ],
    //     })
    // );
    // console.log('[SW] R2アイテム画像のルーティングが設定されました。');


    // Service Workerのライフサイクル制御
    workbox.core.skipWaiting(); // インストール後すぐにアクティベート
    workbox.core.clientsClaim(); // アクティベート後すぐにページを制御下に置く

    console.log('[SW] Service Worker の設定が完了しました。');

} else {
    console.error('[SW] Workbox がロードされていません。');
}
