import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { dailyScanEmailHtml, type ScanSummaryJson } from '../_shared/adminEmail/formatters.ts';
import { sendResendEmail } from '../_shared/adminEmail/resendSend.ts';

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

/** Allows manual testing (WEBHOOK_SECRET) or pg_cron calling with service role Bearer (Supabase scheduling docs pattern). */
function verifyInvokeAuth(req: Request, webhookSecret: string, serviceRoleKey: string | undefined): boolean {
  const auth = req.headers.get('Authorization')?.trim() ?? '';
  const prefix = 'Bearer ';
  if (!auth.startsWith(prefix)) return false;
  const token = auth.slice(prefix.length);
  if (timingSafeEqualString(token, webhookSecret)) return true;
  if (serviceRoleKey && timingSafeEqualString(token, serviceRoleKey)) return true;
  return false;
}

function parseStats(raw: unknown): ScanSummaryJson | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const scan_count = Number(o.scan_count) || 0;
  const distinct_users = Number(o.distinct_users) || 0;
  const first_scan_at = o.first_scan_at == null ? null : String(o.first_scan_at);
  const last_scan_at = o.last_scan_at == null ? null : String(o.last_scan_at);
  const topRaw = o.top_users;
  const top_users: Array<{ user_id: string; scans: number }> = [];
  if (Array.isArray(topRaw)) {
    for (const row of topRaw) {
      if (row && typeof row === 'object') {
        const r = row as Record<string, unknown>;
        if (typeof r.user_id === 'string') {
          const scans = typeof r.scans === 'number' ? r.scans : Number(r.scans);
          if (!Number.isNaN(scans)) top_users.push({ user_id: r.user_id, scans });
        }
      }
    }
  }
  return { scan_count, distinct_users, first_scan_at, last_scan_at, top_users };
}

serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
  }

  const webhookSecret = Deno.env.get('WEBHOOK_SECRET')?.trim();
  const resendKey = Deno.env.get('RESEND_API_KEY')?.trim();
  const adminEmail = Deno.env.get('ADMIN_EMAIL')?.trim();
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL')?.trim();
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();

  if (!webhookSecret || !resendKey || !adminEmail || !fromEmail || !supabaseUrl || !serviceKey) {
    console.error('[daily-bottle-scan-summary] Missing required env');
    return jsonResponse({ ok: false, error: 'Server misconfiguration' }, 500);
  }

  if (!verifyInvokeAuth(req, webhookSecret, serviceKey)) {
    console.warn('[daily-bottle-scan-summary] Invalid Authorization');
    return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
  }

  const hours = 24;
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const windowLabel = `last ${hours} hours (rolling), since UTC ${since}`;

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  try {
    const { data, error } = await supabase.rpc('admin_bottle_scan_summary_stats', {
      p_since: since,
    });

    if (error) {
      console.error('[daily-bottle-scan-summary] RPC error:', error.message);
      return jsonResponse({ ok: false, error: error.message }, 500);
    }

    const stats = parseStats(data);
    if (!stats) {
      return jsonResponse({ ok: false, error: 'Invalid RPC response' }, 500);
    }

    if (stats.scan_count === 0) {
      console.log('[daily-bottle-scan-summary] Zero scans — skipping email');
      return jsonResponse({ ok: true, skipped: true, reason: 'zero scans', stats });
    }

    const { subject, html } = dailyScanEmailHtml(stats, windowLabel);
    const send = await sendResendEmail({
      apiKey: resendKey,
      from: fromEmail,
      to: [adminEmail],
      subject,
      html,
    });

    if (!send.ok) {
      console.error('[daily-bottle-scan-summary] Resend:', send.status, send.error);
      return jsonResponse({ ok: false, error: send.error ?? 'Resend failed' }, 502);
    }

    console.log('[daily-bottle-scan-summary] Email sent', { id: send.id, scans: stats.scan_count });
    return jsonResponse({
      ok: true,
      resend_id: send.id,
      stats,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[daily-bottle-scan-summary]', msg);
    return jsonResponse({ ok: false, error: 'Internal error' }, 500);
  }
});
