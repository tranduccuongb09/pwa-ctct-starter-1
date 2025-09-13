// sw.js — PWA CTĐ, CTCT (không cần đổi version thủ công)
const RUNTIME_CACHE = 'runtime-cache';
const STATIC_CACHE  = 'static-cache'; // cho icon, css

// Các file tĩnh ít đổi (cache-first)
const STATIC_ASSETS = [
  '/style.css',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/manifest.webmanifest'
];

// Cài đặt: cache sẵn assets tĩnh
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Kích hoạt: dọn cache cũ nếu có
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => ![STATIC_CACHE, RUNTIME_CACHE].includes(k))
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Chiến lược:
// - HTML/JS/JSON: network-first (luôn lấy bản mới; offline mới dùng cache)
// - CSS/ảnh/icon: cache-first
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isHTML = req.headers.get('accept')?.includes('text/html');
  const isJS   = url.pathname.endsWith('.js');
  const isJSON = url.pathname.endsWith('.json') || url.searchParams.get('action') === 'questions';
  const isCSS  = url.pathname.endsWith('.css');
  const isImg  = /\.(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(url.pathname);

  // cache-first cho css & ảnh/icon
  if (isCSS || isImg) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // network-first cho html/js/json (app.js, index.html, quiz.html, data, Apps Script api)
  if (isHTML || isJS || isJSON) {
    event.respondWith(networkFirst(req));
    return;
  }

  // mặc định: network-first
  event.respondWith(networkFirst(req));
});

async function cacheFirst(req) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(req, { ignoreSearch: true });
  if (cached) return cached;
  const fresh = await fetch(req);
  cache.put(req, fresh.clone());
  return fresh;
}

async function networkFirst(req) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const fresh = await fetch(req, { cache: 'no-store' });
    cache.put(req, fresh.clone());
    return fresh;
  } catch (e) {
    const cached = await cache.match(req, { ignoreSearch: true }) ||
                   await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;
    // fallback đơn giản
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}
