/**
 * Sentry Privacy Scrubber
 *
 * Deep-traverses Sentry events and breadcrumbs to remove or redact fields
 * that must never leave the client. Applied in beforeSend / beforeBreadcrumb.
 *
 * Rules:
 *  - Any key matching REDACTED_FIELDS is replaced with '[Filtered]'
 *  - String values exceeding MAX_STRING_LENGTH are truncated
 *  - request.headers strips authorization / cookie
 *  - request.data (raw body) is always dropped
 */

import type { ErrorEvent, Breadcrumb } from '@sentry/react';

export const REDACTED_FIELDS = new Set([
  'token',
  'access_token',
  'refresh_token',
  'authorization',
  'cookie',
  'apikey',
  'api_key',
  'password',
  'secret',
  'service_role',
  'service_role_key',
  'private_key',
  'prompt',
  'image_url',
  'image',
  'base64',
  'payment',
  'card',
  'customer_email',
  'cvv',
  'pan',
  'openai_api_key',
  'perplexity_api_key',
  'paddle_api_key',
  'resend_api_key',
]);

const MAX_STRING_LENGTH = 500;

export function truncateLong(value: string, max = MAX_STRING_LENGTH): string {
  if (value.length <= max) return value;
  return value.slice(0, max) + '…[truncated]';
}

function isRedactedKey(key: string): boolean {
  const lower = key.toLowerCase();
  // Exact match
  if (REDACTED_FIELDS.has(lower)) return true;
  // Substring match for common patterns
  if (lower.includes('secret') || lower.includes('password') || lower.includes('token') || lower.includes('api_key') || lower.includes('apikey')) return true;
  return false;
}

export function scrubObject(obj: unknown, depth = 0): unknown {
  // Prevent circular / infinite recursion
  if (depth > 8) return '[MaxDepth]';
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return truncateLong(obj);
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => scrubObject(item, depth + 1));
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (isRedactedKey(key)) {
      result[key] = '[Filtered]';
    } else {
      result[key] = scrubObject(value, depth + 1);
    }
  }
  return result;
}

/**
 * Scrub a Sentry ErrorEvent before it is sent.
 * Returns null to drop the event, or the scrubbed event.
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent | null {
  // Strip raw request body — never send
  if (event.request) {
    const { data: _data, ...safeRequest } = event.request as Record<string, unknown> & { data?: unknown };

    // Strip sensitive headers
    if (safeRequest.headers && typeof safeRequest.headers === 'object') {
      const headers = { ...(safeRequest.headers as Record<string, unknown>) };
      for (const key of Object.keys(headers)) {
        if (isRedactedKey(key)) {
          headers[key] = '[Filtered]';
        }
      }
      safeRequest.headers = headers;
    }

    event.request = safeRequest as ErrorEvent['request'];
  }

  // Scrub extra / contexts
  if (event.extra) {
    event.extra = scrubObject(event.extra) as typeof event.extra;
  }
  if (event.contexts) {
    event.contexts = scrubObject(event.contexts) as typeof event.contexts;
  }

  return event;
}

/**
 * Scrub a Sentry Breadcrumb before it is stored.
 */
export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (breadcrumb.data) {
    breadcrumb.data = scrubObject(breadcrumb.data) as typeof breadcrumb.data;
  }
  if (breadcrumb.message) {
    breadcrumb.message = truncateLong(breadcrumb.message, 200);
  }
  return breadcrumb;
}
