/**
 * Service Worker — Sommi PWA
 * Production build replaces CACHE_NAME + PRECACHE_ASSETS with hashed /assets/* URLs.
 * Offline: app shell (index.html + JS/CSS) must be precached or cache-first served.
 */

// Replaced at build time (vite closeBundle) — dev/preview keeps these fallbacks
const CACHE_NAME = 'wine-cellar-v1';
const RUNTIME_CACHE = 'wine-cellar-runtime';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/wine.svg',
];

function precacheInstall(cache) {
  return Promise.allSettled(PRECACHE_ASSETS.map((url) => cache.add(url))).then((results) => {
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.warn('[Service Worker] Precache skip:', PRECACHE_ASSETS[i], r.reason);
      }
    });
  });
}

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing…', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => precacheInstall(cache)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating…', CACHE_NAME);
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map((name) => {
            console.log('[Service Worker] Deleting old cache:', name);
            return caches.delete(name);
          })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.href.includes('supabase.co')) return;

  // SPA navigations: network, then cached index.html (paths like /cellar are not files)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((hit) => hit || caches.match('/index.html'))
        )
    );
    return;
  }

  // Immutable hashed bundles: cache first (critical for offline after precache)
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(RUNTIME_CACHE).then((c) => c.put(request, clone));
            }
            return response;
          })
          .catch((err) => {
            // Network failure for a hashed asset (poor signal, offline, etc.).
            // Return a synthetic 503 so the browser gets a clean HTTP error rather than
            // an unhandled promise rejection, which would surface as
            // "Importing a module script failed" and crash the entire React tree.
            console.warn('[Service Worker] Asset fetch failed (network error):', request.url, err && err.message);
            return new Response('Network error – asset unavailable offline', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'text/plain' },
            });
          });
      })
    );
    return;
  }

  // Other same-origin static files: try cache, then network, then cache again
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (
            response.status === 200 &&
            /\.(js|css|svg|png|jpg|jpeg|webp|woff2|ico|json)$/i.test(url.pathname)
          ) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request));
    })
  );
});

/**
 * Web Push delivery (server → push service → here).
 * Do NOT use setTimeout for closed-app reminders — iOS kills the SW.
 */
self.addEventListener('push', (event) => {
  let payload = {
    title: 'Sommi',
    body: '',
    tag: 'sommi-reminder',
    data: { url: '/cellar' },
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      payload = {
        title: parsed.title || payload.title,
        body: parsed.body || '',
        tag: parsed.tag || payload.tag,
        data: parsed.data && typeof parsed.data === 'object' ? parsed.data : payload.data,
      };
    }
  } catch (err) {
    console.warn('[Service Worker] Push payload parse failed', err);
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: payload.tag,
      renotify: false,
      requireInteraction: true,
      data: payload.data,
    })
  );
});

self.addEventListener('message', (event) => {
  const { data } = event;
  if (!data) return;

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  // Close an already-visible notification by tag (optional client helper)
  if (data.type === 'CLOSE_NOTIFICATION') {
    const tag = data.tag;
    if (!tag) return;
    self.registration
      .getNotifications({ tag })
      .then((notifications) => notifications.forEach((n) => n.close()))
      .catch(() => {});
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const rawUrl =
    (event.notification.data && event.notification.data.url) || '/cellar';
  const targetUrl = rawUrl.startsWith('http')
    ? rawUrl
    : new URL(rawUrl, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'navigate' in client) {
          try {
            client.navigate(targetUrl);
          } catch (_) {
            /* navigate may be unavailable */
          }
        }
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
