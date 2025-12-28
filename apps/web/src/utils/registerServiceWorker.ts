/**
 * Service Worker Registration
 * Registers the service worker for PWA support
 */

export async function registerServiceWorker(): Promise<void> {
  // Only register in production and if service workers are supported
  if (
    'serviceWorker' in navigator &&
    (import.meta.env.PROD || import.meta.env.VITE_ENABLE_SW === 'true')
  ) {
    try {
      console.log('[PWA] Registering service worker...');
      
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      console.log('[PWA] Service worker registered:', registration.scope);

      // Check for updates periodically
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[PWA] New service worker available, will update on next load');
              // Optionally, show a toast to the user asking to reload
            }
          });
        }
      });

      // Handle controller change (new SW activated)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[PWA] Service worker controller changed, reloading page');
        window.location.reload();
      });

    } catch (error) {
      console.error('[PWA] Service worker registration failed:', error);
    }
  } else {
    console.log('[PWA] Service worker not supported or not in production mode');
  }
}

export async function unregisterServiceWorker(): Promise<void> {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      await registration.unregister();
    }
    console.log('[PWA] Service worker unregistered');
  }
}

