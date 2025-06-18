// /-/sw.js (GitHub Pagesのリポジトリルートに配置する想定)

// WorkboxライブラリをCDNからインポート
try {
    // importScriptsはService Workerのグローバルスコープでのみ利用可能
    // このパスはService Workerファイルからの相対パスまたは絶対パスである必要があります。
    // Service Workerが /-/sw.js にある場合、WorkboxのCDNパスはそのまま絶対URLでOKです。
    importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.3/workbox-sw.js');
} catch (e) {
    console.error("Workboxライブラリの読み込みに失敗しました:", e);
}

if (typeof workbox !== 'undefined') {
    console.log(`[SW] Workbox ${workbox.VERSION} がロードされました。`);

    // サイトのベースパス (リポジトリ名)
    const basePath = '/-'; // GitHub Pagesのリポジトリ名がパスになる

    // プリキャッシュするファイルリスト
    // URLは `basePath` を含めた、ブラウザから見た絶対パスに近い形で指定します。
    // Workboxは通常、Service Workerのスコープからの相対パスを解決しますが、
    // 明示的に basePath を含めることで混乱を避けます。
    // ただし、workbox.precaching.precacheAndRoute はSWの場所からの相対パスを期待することが多いので、
    // sw.js が /-/sw.js にあるなら、プリキャッシュURLは /index.html のように、
    // basePath を除いた形でも動作することが多いです。ここではより安全な方法を試します。
    // GitHub Pages の場合、precacheAndRoute に渡す URL は /index.html のような
    // リポジトリルートからの相対パスで良いことが多いです。
    // Service Worker のスコープが /-/ に設定されていれば、自動的に解決されます。
    // ここでは、最も一般的なGitHub Pagesのプロジェクトサイトの挙動を想定し、
    // /index.html のようなリポジトリ内でのルートからのパスで記述します。
    // Service Workerの登録時にスコープが正しく /-/ になっていれば問題ありません。

    workbox.precaching.precacheAndRoute([
        // App Shell と主要なHTML
        // basePath を含めず、Service Workerのスコープからの相対パスで記述
        { url: 'index.html', revision: 'appshell-20231028-1' }, // /-/index.html に解決される想定

        // 主要なCSSファイル
        { url: 'css/base.css', revision: 'css-base-20231028-1' },
        { url: 'css/modal.css', revision: 'css-modal-20231028-1' },
        { url: 'css/search-tool.css', revision: 'css-search-20231028-1' },
        { url: 'css/simulator.css', revision: 'css-sim-20231028-1' },
        { url: 'css/responsive.css', revision: 'css-resp-20231028-1' },

        // 主要なJavaScriptファイル
        { url: 'js/script-main.js', revision: 'js-main-20231028-1' },
        { url: 'js/common/indexed-db-setup.js', revision: 'js-idbsetup-20231028-1' },
        { url: 'js/modules/indexed-db-ops.js', revision: 'js-idbops-20231028-1' },
        { url: 'js/modules/data-loader.js', revision: 'js-dataload-20231028-1' },
        // 以下、他の主要なJSモジュールがあれば追加
        { url: 'js/firebase-config.js', revision: 'js-fbconf-20231028-1'}, // firebase-configもキャッシュ対象に
        { url: 'js/modules/ui-main.js', revision: 'js-uimain-20231028-1'},
        { url: 'js/modules/search-filters.js', revision: 'js-searchfilt-20231028-1'},
        { url: 'js/modules/search-render.js', revision: 'js-searchrend-20231028-1'},
        { url: 'js/modules/simulator-ui.js', revision: 'js-simui-20231028-1'},
        { url: 'js/modules/simulator-logic.js', revision: 'js-simlogic-20231028-1'},
        { url: 'js/modules/simulator-image.js', revision: 'js-simimg-20231028-1'},


        // UI画像やプレースホルダー
        { url: 'images/placeholder_item.png', revision: 'placeholder-item-v1.1' }, // revision更新
        { url: 'images/placeholder_slot.png', revision: 'placeholder-slot-v1.1' }, // revision更新
        // { url: 'images/logo.png', revision: 'logo-v1' }, // ロゴがあれば
        // { url: 'manifest.json', revision: 'manifest-v1' }, // PWAにするなら
    ], {
        // オプション: プリキャッシュされるURLのディレクトリを無視する
        // これにより、/repo-name/index.html が index.html としてキャッシュされる
        // GitHub Pagesのプロジェクトサイトではこれがうまくいくことが多い
        ignoreURLParametersMatching: [/.*/], // クエリパラメータを無視
        // directoryIndex: 'index.html' // /folder/ がリクエストされたら /folder/index.html を返す (通常不要)
    });
    console.log('[SW] プリキャッシュファイルが登録されました。');

    // ナビゲーションリクエストのルーティング (HTMLページへのアクセス)
    // NetworkFirst: まずネットワークを試し、失敗したらキャッシュから返す
    workbox.routing.registerRoute(
        ({ request }) => request.mode === 'navigate',
        new workbox.strategies.NetworkFirst({
            cacheName: 'pages-cache-gh-v1', // キャッシュ名を変更して以前のキャッシュと区別
            plugins: [
                new workbox.cacheable_response.CacheableResponsePlugin({
                    statuses: [0, 200],
                }),
            ]
        })
    );
    console.log('[SW] ナビゲーションリクエストのルーティングが設定されました。');

    // 静的リソース (CSS, JS) のキャッシュ戦略
    // StaleWhileRevalidate: キャッシュからすぐに返し、バックグラウンドでネットワークから更新
    workbox.routing.registerRoute(
        ({ request }) => request.destination === 'style' || request.destination === 'script',
        new workbox.strategies.StaleWhileRevalidate({
            cacheName: 'static-resources-cache-gh-v1',
            plugins: [
                new workbox.cacheable_response.CacheableResponsePlugin({
                    statuses: [0, 200],
                }),
            ]
        })
    );
    console.log('[SW] 静的リソース (CSS, JS) のルーティングが設定されました。');

    // 画像のキャッシュ戦略
    // CacheFirst: キャッシュにあればそれを使う
    workbox.routing.registerRoute(
        ({ request }) => request.destination === 'image',
        new workbox.strategies.CacheFirst({
            cacheName: 'image-cache-gh-v1',
            plugins: [
                new workbox.expiration.ExpirationPlugin({
                    maxEntries: 150,
                    maxAgeSeconds: 30 * 24 * 60 * 60, // 30日間
                    purgeOnQuotaError: true,
                }),
                new workbox.cacheable_response.CacheableResponsePlugin({
                    statuses: [0, 200],
                }),
            ],
        })
    );
    console.log('[SW] 画像のルーティングが設定されました。');

    // (オプション) Cloudflare R2からのアイテム画像に特化した戦略
    // あなたのR2の完全な公開URLドメインに置き換えてください
    // const r2ImageOrigin = 'https://your-r2-public-id.r2.cloudflarestorage.com'; // 例
    // if (r2ImageOrigin !== 'https://your-r2-public-id.r2.cloudflarestorage.com') { // 設定されていれば有効化
    //     workbox.routing.registerRoute(
    //         ({url}) => url.origin === r2ImageOrigin, // R2ドメインからのリクエスト
    //         new workbox.strategies.CacheFirst({
    //             cacheName: 'r2-item-images-cache-gh-v1',
    //             plugins: [
    //                 new workbox.expiration.ExpirationPlugin({
    //                     maxEntries: 300,
    //                     maxAgeSeconds: 14 * 24 * 60 * 60, // 14日間
    //                     purgeOnQuotaError: true,
    //                 }),
    //                 new workbox.cacheable_response.CacheableResponsePlugin({
    //                     statuses: [0, 200],
    //                 }),
    //             ],
    //         })
    //     );
    //     console.log('[SW] R2アイテム画像のルーティングが設定されました。');
    // }


    // Service Workerのライフサイクル制御
    workbox.core.skipWaiting();
    workbox.core.clientsClaim();

    console.log('[SW] Service Worker の設定が完了しました。');

} else {
    console.error('[SW] Workbox がロードされていません。importScriptsのパスやネットワークを確認してください。');
}
