/**
 * Sentry Wrapper for Supabase Edge Functions (Deno)
 *
 * Provides a withSentry() higher-order function that:
 *  - Initializes Sentry only when SENTRY_DSN is set
 *  - Sets function_name, environment, and release tags
 *  - Catches unhandled exceptions and reports them to Sentry
 *  - Flushes the Sentry queue before returning an error response
 *  - Never captures: Authorization header, service role key, prompt text,
 *    image URLs, payment data, or raw request bodies
 *
 * Usage:
 *   import { withSentry } from '../_shared/sentry.ts'
 *   serve(withSentry('my-function', async (req) => { ... }))
 *
 * Environment variables (set in Supabase dashboard → Project Settings → Edge Functions):
 *   SENTRY_DSN         — Deno DSN from the sommi-edge-functions project
 *   SENTRY_ENVIRONMENT — 'production' | 'staging' | 'development'
 *   SENTRY_RELEASE     — Optional release tag
 */

// Sentry Deno SDK via npm specifier (supported by Supabase Edge Functions)
import * as Sentry from 'npm:@sentry/deno'

// Fields that must never appear in Sentry events
const REDACTED_FIELDS = new Set([
  'authorization',
  'cookie',
  'x-api-key',
  'apikey',
  'token',
  'access_token',
  'refresh_token',
  'service_role',
  'service_role_key',
  'password',
  'secret',
  'private_key',
  'prompt',
  'image_url',
  'image',
  'base64',
  'payment',
  'card',
  'customer_email',
  'openai_api_key',
  'perplexity_api_key',
])

function scrubRecord(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    const lower = key.toLowerCase()
    if (
      REDACTED_FIELDS.has(lower) ||
      lower.includes('secret') ||
      lower.includes('key') ||
      lower.includes('token')
    ) {
      result[key] = '[Filtered]'
    } else if (typeof value === 'string' && value.length > 500) {
      result[key] = value.slice(0, 500) + '…'
    } else {
      result[key] = value
    }
  }
  return result
}

let _initialized = false

function ensureInit(functionName: string): boolean {
  const dsn = Deno.env.get('SENTRY_DSN')
  if (!dsn) return false

  if (!_initialized) {
    Sentry.init({
      dsn,
      environment: Deno.env.get('SENTRY_ENVIRONMENT') ?? 'production',
      release: Deno.env.get('SENTRY_RELEASE') ?? 'unknown',
      tracesSampleRate: 0,
      beforeSend(event) {
        // Strip request headers and body
        if (event.request) {
          if (event.request.headers) {
            event.request.headers = scrubRecord(
              event.request.headers as Record<string, unknown>,
            ) as typeof event.request.headers
          }
          delete event.request.data
          delete event.request.cookies
        }
        return event
      },
    })
    _initialized = true
  }

  Sentry.setTag('function_name', functionName)
  return true
}

/**
 * Wrap a Supabase Edge Function handler with Sentry error monitoring.
 *
 * @param functionName  Name of the edge function (used as a Sentry tag)
 * @param handler       The actual request handler
 */
export function withSentry(
  functionName: string,
  handler: (req: Request) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    const sentryActive = ensureInit(functionName)

    try {
      return await handler(req)
    } catch (err: unknown) {
      if (sentryActive) {
        Sentry.captureException(err)
        // Flush with a short timeout so we don't add significant latency to error responses
        await Sentry.flush(2000)
      }
      // Re-throw so the caller's outer try/catch can return its own error response
      throw err
    }
  }
}

/**
 * Set safe wine operation context on the current Sentry scope.
 * Only pass IDs and metadata — never prompt text, image URLs, or secrets.
 */
export function setSentryWineContext(ctx: {
  user_id?: string
  bottle_id?: string
  wine_id?: string
  language?: string
  operation?: string
  provider?: string
  dry_run?: boolean
}): void {
  if (!_initialized) return
  Sentry.setContext('wine_operation', ctx)
  if (ctx.user_id) Sentry.setUser({ id: ctx.user_id })
}
