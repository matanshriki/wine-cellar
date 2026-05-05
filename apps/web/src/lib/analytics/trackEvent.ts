/**
 * Internal product event tracker — writes to Supabase app_events table.
 *
 * DESIGN
 * - Always fails silently; never throws, never blocks the caller.
 * - Completely independent from GA4 (services/analytics.ts).
 *   Call both if you want external + internal tracking.
 * - user_id is resolved from the current Supabase session at call time.
 * - session_id reuses the existing app_session_id from sessionStorage
 *   (already managed by services/analytics.ts).
 * - page defaults to window.location.pathname if not supplied.
 *
 * USAGE
 *   import { trackEvent } from '../lib/analytics/trackEvent';
 *
 *   trackEvent({ event_name: 'login_completed', source: 'email' });
 *   trackEvent({ event_name: 'bottle_scan_failed', event_type: 'error', metadata: { reason } });
 *
 * HOW TO ADD A NEW EVENT
 *   1. Call trackEvent() at the relevant action site.
 *   2. Use a snake_case event_name (e.g. 'wine_analysis_started').
 *   3. Add context via metadata — keep values scalar (string | number | boolean).
 *   4. The new event will appear in the admin Events tab automatically.
 *
 * TRACKED SO FAR (see call sites for details)
 *   user_signed_up       — SupabaseAuthContext: signUp success
 *   login_completed      — SupabaseAuthContext: onAuthStateChange SIGNED_IN
 *   bottle_scan_started  — AddBottleContext: handleSmartScan
 *   bottle_scan_completed — AddBottleContext: handleSmartScan success
 *   bottle_scan_failed   — AddBottleContext: handleSmartScan error
 */

import { supabase } from '../supabase';

export interface TrackEventParams {
  event_name: string;
  event_type?: string;
  source?: string;
  /** Defaults to window.location.pathname */
  page?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

/** Stable per-tab session ID reused from services/analytics.ts storage key. */
function getSessionId(): string | null {
  try {
    return sessionStorage.getItem('app_session_id');
  } catch {
    return null;
  }
}

/**
 * Track an internal product event. Fire-and-forget — never awaited by callers
 * for UX-critical paths. Safe to call from any component or context.
 */
export function trackEvent(params: TrackEventParams): void {
  // Run async in background — intentionally not awaited by caller.
  void (async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const page =
        params.page ??
        (typeof window !== 'undefined' ? window.location.pathname : null);

      await supabase.from('app_events').insert({
        user_id:    session?.user?.id ?? null,
        event_name: params.event_name,
        event_type: params.event_type ?? null,
        source:     params.source ?? null,
        page,
        session_id: getSessionId(),
        metadata:   params.metadata ?? {},
      });
    } catch {
      // Intentionally silent — event tracking must never break user experience.
    }
  })();
}
