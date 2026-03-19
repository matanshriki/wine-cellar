/**
 * Service Worker for Wine Cellar Brain PWA
 * Provides offline support and session persistence
 */

const CACHE_NAME = 'wine-cellar-v1';
const RUNTIME_CACHE = 'wine-cellar-runtime';

// Assets to cache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/wine.svg',
];

// Install event - precache critical assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Precaching assets');
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => {
      // Force the waiting service worker to become the active service worker
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map((name) => {
            console.log('[Service Worker] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      // Take control of all pages immediately
      return self.clients.claim();
    })
  );
});

// Fetch event - network first, then cache fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Skip Supabase API requests (always go to network)
  if (url.href.includes('supabase.co')) {
    return;
  }

  // For navigation requests (pages)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful responses
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache if offline
          return caches.match(request).then((cached) => {
            return cached || caches.match('/index.html');
          });
        })
    );
    return;
  }

  // For all other requests - network first, cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful responses for static assets
        if (response.status === 200 && (
          request.url.endsWith('.js') ||
          request.url.endsWith('.css') ||
          request.url.endsWith('.svg') ||
          request.url.endsWith('.png') ||
          request.url.endsWith('.jpg') ||
          request.url.endsWith('.woff2')
        )) {
          const responseClone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Try to serve from cache
        return caches.match(request);
      })
  );
});

// ── Local notification scheduling ─────────────────────────────────────────────
//
// The app posts SCHEDULE_NOTIFICATION when a timer is created and
// CANCEL_NOTIFICATION when one is cancelled.  The service worker holds a
// Map of pending setTimeout handles so that notifications fire even when
// the browser tab is in the background.
//
// Limitation: if the OS fully terminates the service worker (e.g. the device
// is restarted, or the browser aggressively culls background SWs) the timeout
// is lost.  The in-app FloatingTimerPill modal is the fallback for that case.

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

    // Clear any existing timeout for this timer (e.g. re-scheduling)
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
    // Also dismiss any already-shown notification with this tag
    self.registration.getNotifications({ tag: `wine-timer-${timerId}` })
      .then(notifications => notifications.forEach(n => n.close()))
      .catch(() => {});
    return;
  }
});

// Open / focus the app when the user taps a notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If the app is already open, focus it
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      // Otherwise open a new window
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});




