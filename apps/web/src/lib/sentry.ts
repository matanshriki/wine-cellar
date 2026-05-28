/**
 * Sentry Initialization — Sommi Frontend
 *
 * Initializes Sentry only when VITE_SENTRY_DSN is present.
 * Safe to import in all environments — all calls are no-ops when DSN is absent.
 *
 * Environment variables (all VITE_ prefix = exposed to browser):
 *   VITE_SENTRY_DSN           — Browser ingest DSN from sommi-web project
 *   VITE_SENTRY_ENVIRONMENT   — 'production' | 'preview' | 'development'
 *   VITE_APP_VERSION          — Release version tag, e.g. '2.1.0-smart-scan-unified'
 *
 * Build-only (NOT exposed to browser, used by Vite plugin in vite.config.ts):
 *   SENTRY_AUTH_TOKEN         — Source map upload token
 *   SENTRY_ORG                — Sentry org slug
 *   SENTRY_PROJECT            — 'sommi-web'
 */

import * as Sentry from '@sentry/react';
import { scrubEvent, scrubBreadcrumb } from './sentryPrivacy';

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const environment = (import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined) ?? 'development';
const release = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? 'unknown';
const isProduction = environment === 'production';

let _initialized = false;

export function initSentry(): void {
  if (!dsn) return;
  if (_initialized) return;

  Sentry.init({
    dsn,
    environment,
    release,

    // Conservative: capture 5% of transactions in production, none in dev
    tracesSampleRate: isProduction ? 0.05 : 0,

    // Session replays: off by default, error-only at 10%
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.1,

    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        // Privacy: mask all text and block all media in replays
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Privacy scrubber — runs before every event is sent
    beforeSend(event) {
      return scrubEvent(event);
    },

    // Privacy scrubber — runs before every breadcrumb is stored
    beforeBreadcrumb(breadcrumb) {
      return scrubBreadcrumb(breadcrumb);
    },

    // Do not send events for localhost unless DSN is explicitly set
    // (DSN absent = no-op, so this is belt-and-suspenders)
    enabled: !!dsn,
  });

  _initialized = true;
}

/** Returns true if Sentry has been initialized with a DSN. */
export function isSentryInitialized(): boolean {
  return _initialized;
}

export { Sentry };
