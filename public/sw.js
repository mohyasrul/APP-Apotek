// ================================================================
// MediSir Service Worker
// Strategi: cache-first untuk static assets, network-first untuk API
// Cache name includes build version for automatic invalidation
// ================================================================

// Build version passed via URL parameter from main.tsx
const url = new URL(self.location.href);
const buildVersion = url.searchParams.get('v') || 'v1';
const CACHE_NAME = `medisir-${buildVersion}`;

// Static assets yang dicache saat install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
];

// Install: precache shell utama
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting();
});

// Activate: bersihkan cache lama
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch:
// - Supabase & API calls → selalu network (tidak boleh dicache karena data sensitif)
// - Static assets (JS, CSS, font, image) → cache-first (cepat + offline)
// - Navigasi HTML → network-first dengan fallback ke index.html (SPA)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const reqUrl = new URL(request.url);

  // Jangan cache request ke Supabase, API eksternal, atau non-GET
  if (
    request.method !== 'GET' ||
    reqUrl.hostname.includes('supabase.co') ||
    reqUrl.hostname.includes('supabase.io') ||
    reqUrl.pathname.startsWith('/rest/') ||
    reqUrl.pathname.startsWith('/auth/') ||
    reqUrl.pathname.startsWith('/realtime/') ||
    reqUrl.pathname.startsWith('/storage/') ||
    request.headers.has('authorization') ||
    request.headers.has('apikey')
  ) {
    return; // biarkan browser handle normally
  }

  // Static assets (JS/CSS/font/img dengan hash di filename) → cache-first
  if (
    reqUrl.pathname.match(/\.(js|css|woff2?|ttf|otf|eot|png|jpg|jpeg|svg|webp|ico)$/) ||
    reqUrl.pathname.startsWith('/assets/')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Navigasi HTML → network-first, fallback index.html (SPA offline support)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/index.html').then((cached) => {
          if (cached) return cached;
          return new Response(
            '<html><body style="font-family:sans-serif;text-align:center;padding:4rem"><h2>Anda sedang offline</h2><p>Silakan coba lagi saat terhubung ke internet.</p></body></html>',
            { headers: { 'Content-Type': 'text/html; charset=UTF-8' } }
          );
        })
      )
    );
  }
});
