const CACHE_NAME = 'pixelraj-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
];

// Install: cache static shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

// Activate: delete ALL old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: DO NOT cache /src/ files (Vite dev server modules)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET, supabase API, chrome-extension, and Vite dev modules
  if (
    event.request.method !== 'GET' ||
    url.hostname.includes('supabase') ||
    url.protocol === 'chrome-extension:' ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/node_modules/')
  ) {
    return;
  }

  // For JS/CSS/images in production only: cache first, then network
  if (url.pathname.match(/\.(js|css|png|svg|ico|woff2?)$/)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        const response = await fetch(event.request);
        if (response.ok) cache.put(event.request, response.clone());
        return response;
      })
    );
    return;
  }

  // For navigation (HTML): network first, fall back to cached /index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match('/index.html')
      )
    );
    return;
  }

  // Default: network only
  event.respondWith(fetch(event.request));
});