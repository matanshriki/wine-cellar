/**
 * Monitoring Helpers — Sommi Frontend
 *
 * Thin wrappers around Sentry that:
 *  - Are all no-ops when Sentry is not initialized (no DSN)
 *  - Enforce privacy by only accepting safe, typed context
 *  - Apply the shared scrubber before forwarding data
 *
 * Usage:
 *   import { setMonitoringUser, captureAppError, addMonitoringBreadcrumb } from './monitoring';
 */

import * as Sentry from '@sentry/react';
import { isSentryInitialized } from './sentry';
import { scrubObject } from './sentryPrivacy';

// Re-export scrubObject for internal callers
function safe(data: Record<string, unknown>): Record<string, unknown> {
  return scrubObject(data) as Record<string, unknown>;
}

// ── User identity ─────────────────────────────────────────────────────────────

/**
 * Set the Sentry user context.
 * Only accepts an internal UUID — never email, name, or payment info.
 */
export function setMonitoringUser(user: { id: string }): void {
  if (!isSentryInitialized()) return;
  Sentry.setUser({ id: user.id });
}

/** Clear the Sentry user context on sign-out. */
export function clearMonitoringUser(): void {
  if (!isSentryInitialized()) return;
  Sentry.setUser(null);
}

// ── Error capture ─────────────────────────────────────────────────────────────

/**
 * Capture an application error with optional safe context.
 * Scrubs the context object before sending.
 */
export function captureAppError(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  if (!isSentryInitialized()) {
    console.error('[monitoring] captureAppError (Sentry not active):', error, context);
    return;
  }
  Sentry.withScope((scope) => {
    if (context) {
      scope.setExtras(safe(context));
    }
    Sentry.captureException(error);
  });
}

// ── Breadcrumbs ───────────────────────────────────────────────────────────────

export type BreadcrumbCategory =
  | 'navigation'
  | 'ui'
  | 'ai'
  | 'billing'
  | 'user'
  | 'auth'
  | 'network';

/**
 * Add a structured breadcrumb for a key user/app flow.
 * Data is scrubbed before storage.
 *
 * @param message  Short description of what happened
 * @param category Logical grouping (ai, billing, ui, etc.)
 * @param data     Safe key/value context — no PII, no secrets, no payloads
 */
export function addMonitoringBreadcrumb(
  message: string,
  category: BreadcrumbCategory,
  data?: Record<string, unknown>,
): void {
  if (!isSentryInitialized()) return;
  Sentry.addBreadcrumb({
    message,
    category,
    data: data ? (safe(data) as Record<string, unknown>) : undefined,
    level: 'info',
  });
}

// ── Context ───────────────────────────────────────────────────────────────────

/**
 * Set a named context object on the current Sentry scope.
 * Context is scrubbed before storage.
 */
export function setMonitoringContext(
  name: string,
  context: Record<string, unknown>,
): void {
  if (!isSentryInitialized()) return;
  Sentry.setContext(name, safe(context));
}
