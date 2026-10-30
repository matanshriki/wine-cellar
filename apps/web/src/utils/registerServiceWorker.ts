/**
 * Service Worker Registration
 * Registers the service worker for PWA support.
 * Update UX (prompt, Later, Update now) lives in serviceWorkerUpdate.ts.
 */

export {
  registerServiceWorker,
  unregisterServiceWorker,
  serviceWorkerUpdateController,
} from './serviceWorkerUpdate';
