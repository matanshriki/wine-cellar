/**
 * Application Entry Point
 * 
 * Initializes:
 * - i18n (internationalization) with language detection and RTL support
 * - React app with strict mode for better development experience
 * - Service Worker for PWA support and session persistence
 * - Global styles
 */

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
 * Initialize Google Analytics 4
 * Only runs if VITE_ANALYTICS_ENABLED=true and measurement ID is provided
 * Privacy-first: No PII is tracked
 */
initializeAnalytics();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

