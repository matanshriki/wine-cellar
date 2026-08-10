/**
 * reset-monthly-credits — Scheduled Edge Function
 *
 * Calls the reset_monthly_credits() RPC to reset free-user balances and
 * restore paid subscribers whose credits were not refreshed by Paddle.
 *
 * Invocation methods:
 *   1. Supabase Dashboard → Functions → Schedule (cron: "5 0 1 * *")
 *      No additional auth setup needed when invoked by the Supabase scheduler.
 *   2. pg_cron via net.http_post (if pg_net is available) — see admin docs.
 *   3. Manual curl (useful for testing and emergency resets):
 *        curl -X POST https://<project>.supabase.co/functions/v1/reset-monthly-credits \
 *          -H "Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>"
 *
 * Security:
 *   verify_jwt is FALSE for this function (config.toml).
 *   Instead, it validates that the Bearer token equals SUPABASE_SERVICE_ROLE_KEY
 *   so only the service itself (or pg_cron / Supabase scheduler) can trigger it.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8' };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let ok = 0;
  for (let i = 0; i < a.length; i++) ok |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return ok === 0;
}

/**
 * Accept the service-role key as Bearer token.
 * This is the same pattern as daily-bottle-scan-summary.
 */
function verifyAuth(req: Request, serviceRoleKey: string): boolean {
  const auth = req.headers.get('Authorization')?.trim() ?? '';
  const prefix = 'Bearer ';
  if (!auth.startsWith(prefix)) return false;
  const token = auth.slice(prefix.length);
  return timingSafeEqualString(token, serviceRoleKey);
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();

  if (!supabaseUrl || !serviceKey) {
    console.error('[reset-monthly-credits] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return jsonResponse({ ok: false, error: 'Server misconfiguration' }, 500);
  }

  if (!verifyAuth(req, serviceKey)) {
    console.warn('[reset-monthly-credits] Unauthorized — invalid or missing Bearer token');
    return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log('[reset-monthly-credits] Starting monthly credit reset...');

  try {
    const { data, error } = await supabase.rpc('reset_monthly_credits');

    if (error) {
      console.error('[reset-monthly-credits] RPC error:', error.message);
      return jsonResponse({ ok: false, error: error.message }, 500);
    }

    const result = data as {
      free_users_reset:    number;
      paid_users_restored: number;
      run_at:              string;
    };

    console.log(
      '[reset-monthly-credits] Done.',
      JSON.stringify({
        free_users_reset:    result.free_users_reset,
        paid_users_restored: result.paid_users_restored,
        run_at:              result.run_at,
      }),
    );

    return jsonResponse({
      ok:                  true,
      free_users_reset:    result.free_users_reset,
      paid_users_restored: result.paid_users_restored,
      run_at:              result.run_at,
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[reset-monthly-credits] Unexpected error:', msg);
    return jsonResponse({ ok: false, error: 'Internal error' }, 500);
  }
});
