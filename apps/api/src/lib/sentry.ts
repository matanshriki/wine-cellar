/**
 * Sentry Initialization — Sommi API (Express/Node)
 *
 * Must be imported and initialized at the very top of index.ts, BEFORE
 * any other imports, so Sentry can instrument all loaded modules.
 *
 * Environment variables (set in Railway):
 *   SENTRY_DSN          — Node DSN from the sommi-api project
 *   SENTRY_ENVIRONMENT  — 'production' | 'staging' | 'development'
 *   SENTRY_RELEASE      — Release tag, e.g. commit SHA or version
 */

import * as Sentry from '@sentry/node';

const REDACTED_HEADERS = new Set([
  'authorization',
  'cookie',
  'x-api-key',
  'x-service-role',
  'x-supabase-api-key',
]);

const REDACTED_BODY_FIELDS = new Set([
  'password',
  'token',
  'access_token',
  'refresh_token',
  'api_key',
  'apikey',
  'secret',
  'service_role',
  'private_key',
  'prompt',
  'image_url',
  'image',
  'base64',
  'card',
  'customer_email',
]);

function scrubHeaders(headers: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(headers)) {
    result[key] = REDACTED_HEADERS.has(key.toLowerCase()) ? '[Filtered]' : value;
  }
  return result;
}

function scrubBody(body: unknown, depth = 0): unknown {
  if (depth > 5 || body === null || body === undefined) return body;
  if (typeof body === 'string') return body.length > 500 ? body.slice(0, 500) + '…' : body;
  if (typeof body !== 'object') return body;
  if (Array.isArray(body)) return body.map(i => scrubBody(i, depth + 1));
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    const lower = key.toLowerCase();
    if (REDACTED_BODY_FIELDS.has(lower) || lower.includes('secret') || lower.includes('token') || lower.includes('key')) {
      result[key] = '[Filtered]';
    } else {
      result[key] = scrubBody(value, depth + 1);
    }
  }
  return result;
}

let initialized = false;

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  if (initialized) return;

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
    release: process.env.SENTRY_RELEASE ?? 'unknown',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 0,
    integrations: [
      Sentry.httpIntegration({ breadcrumbs: true }),
    ],
    beforeSend(event) {
      // Strip sensitive request data
      if (event.request) {
        if (event.request.headers) {
          event.request.headers = scrubHeaders(
            event.request.headers as Record<string, unknown>,
          ) as typeof event.request.headers;
        }
        // Never send raw body
        delete event.request.data;
        // Never send cookies
        delete event.request.cookies;
      }
      return event;
    },
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.data) {
        breadcrumb.data = scrubBody(breadcrumb.data) as typeof breadcrumb.data;
      }
      return breadcrumb;
    },
  });

  initialized = true;
}

/**
 * Attach Sentry's error handler to an Express app.
 * Must be called after all routes are mounted.
 * In @sentry/node v8, this replaces the old expressErrorHandler middleware pattern.
 */
export function setupSentryExpressErrorHandler(app: import('express').Express): void {
  if (!initialized) return;
  Sentry.setupExpressErrorHandler(app);
}

export function isSentryInitialized(): boolean {
  return initialized;
}

export { Sentry };
