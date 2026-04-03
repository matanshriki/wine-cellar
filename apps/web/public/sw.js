/**
 * Service Worker — Wine Cellar Brain PWA
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
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(request, clone));
          }
          return response;
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

/** Map<timerId, timeoutHandle> */
const pendingNotifications = new Map();

self.addEventListener('message', (event) => {
  const { data } = event;
  if (!data) return;

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (data.type === 'SCHEDULE_NOTIFICATION') {
    const { timerId, title, body, delayMs, tag } = data;

    if (pendingNotifications.has(timerId)) {
      clearTimeout(pendingNotifications.get(timerId));
    }

    if (delayMs <= 0) return;

    const handle = setTimeout(() => {
      self.registration.showNotification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag,
        renotify: false,
        requireInteraction: true,
        data: { timerId, url: '/' },
      });
      pendingNotifications.delete(timerId);
    }, delayMs);

    pendingNotifications.set(timerId, handle);
    return;
  }

  if (data.type === 'CANCEL_NOTIFICATION') {
    const { timerId } = data;
    if (pendingNotifications.has(timerId)) {
      clearTimeout(pendingNotifications.get(timerId));
      pendingNotifications.delete(timerId);
    }
    self.registration
      .getNotifications({ tag: `wine-timer-${timerId}` })
      .then((notifications) => notifications.forEach((n) => n.close()))
      .catch(() => {});
    return;
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
