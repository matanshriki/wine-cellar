/**
 * Application Entry Point
 * 
 * Initializes:
 * - i18n (internationalization) with language detection and RTL support
 * - React app with strict mode for better development experience
 * - Service Worker for PWA support and session persistence
 * - Global styles
 */

// App version for deployment verification
const APP_VERSION = '2.1.0-smart-scan-unified';
console.log(`🍷 Sommi v${APP_VERSION}`);

import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';

// Import i18n configuration to initialize before app renders
import './i18n/config';
import { initializeDirection } from './i18n/config';

// Import service worker registration
import { registerServiceWorker } from './utils/registerServiceWorker';

// Import analytics initialization
import { initializeAnalytics } from './services/analytics';

// Import AI attribution capture (runs before consent — no data sent to GA here)
import { captureAttribution } from './services/aiAttribution';

// Import PWA animation fixes
import { initPWAAnimationFixes } from './utils/pwaAnimationFix';

/**
 * Initialize document direction based on selected language
 * Must be called before React renders to prevent FOUC (Flash of Unstyled Content)
 */
initializeDirection();

/**
 * Register service worker for PWA support
 * This enables session persistence and offline capabilities
 */
registerServiceWorker().catch(console.error);

/**
 * Initialize PWA animation fixes
 * Fixes animation issues in standalone mode where prefers-reduced-motion is incorrectly reported
 * and requestAnimationFrame doesn't fire properly on initial load
 */
initPWAAnimationFixes();

/**
 * Capture AI / UTM attribution data immediately — before any React renders or
 * redirects that might clobber the raw referrer or URL params.
 * Stores to localStorage only; no data is sent to GA at this point.
 */
captureAttribution();

/**
 * Initialize Google Analytics 4
 * Only runs if VITE_ANALYTICS_ENABLED=true, measurement ID is provided, AND user has given consent.
 * Internally calls sendAttributionToGA() once GA is ready.
 * Privacy-first: No PII is tracked.
 * Note: Analytics may initialize later after user logs in and accepts consent.
 */
initializeAnalytics();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

