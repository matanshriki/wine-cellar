import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { purchaseEmailFromPaddle, signupEmailHtml, type ProfileRecord } from '../_shared/adminEmail/formatters.ts';
import { sendResendEmail } from '../_shared/adminEmail/resendSend.ts';

const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8' };

interface DbWebhookBody {
  type?: string;
  table?: string;
  schema?: string;
  record?: Record<string, unknown>;
  old_record?: Record<string, unknown> | null;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function verifyWebhookSecret(req: Request, secret: string): boolean {
  const auth = req.headers.get('Authorization')?.trim() ?? '';
  const expected = `Bearer ${secret}`;
  if (auth.length !== expected.length) return false;
  let ok = 0;
  for (let i = 0; i < auth.length; i++) ok |= auth.charCodeAt(i) ^ expected.charCodeAt(i);
  return ok === 0;
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
  }

  const webhookSecret = Deno.env.get('WEBHOOK_SECRET')?.trim();
  const resendKey = Deno.env.get('RESEND_API_KEY')?.trim();
  const adminEmail = Deno.env.get('ADMIN_EMAIL')?.trim();
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL')?.trim();

  if (!webhookSecret || !resendKey || !adminEmail || !fromEmail) {
    console.error('[admin-notifications] Missing required secrets');
    return jsonResponse({ ok: false, error: 'Server misconfiguration' }, 500);
  }

  if (!verifyWebhookSecret(req, webhookSecret)) {
    console.warn('[admin-notifications] Invalid or missing Authorization');
    return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
  }

  let body: DbWebhookBody;
  try {
    body = (await req.json()) as DbWebhookBody;
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON body' }, 400);
  }

  const op = (body.type ?? '').toUpperCase();
  if (op !== 'INSERT') {
    return jsonResponse({ ok: true, ignored: true, reason: 'not an INSERT' });
  }

  const table = (body.table ?? '').trim();
  const record = body.record;
  if (!record) {
    return jsonResponse({ ok: false, error: 'Missing record' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  const supabase =
    supabaseUrl && serviceKey
      ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
      : null;

  try {
    if (table === 'profiles') {
      const p = record as unknown as ProfileRecord;
      let provider: string | null = null;
      if (supabase && p.id) {
        const { data, error } = await supabase.auth.admin.getUserById(p.id);
        if (error) {
          console.warn('[admin-notifications] auth.admin.getUserById:', error.message);
        } else {
          const identities = data.user?.identities ?? [];
          if (identities.length > 0) {
            provider = identities.map((i) => i.provider).join(', ');
          } else if (data.user?.app_metadata && typeof data.user.app_metadata === 'object') {
            const prov = (data.user.app_metadata as Record<string, unknown>).provider;
            if (typeof prov === 'string') provider = prov;
          }
        }
      }

      const { subject, html } = signupEmailHtml(p, { provider });
      const send = await sendResendEmail({
        apiKey: resendKey,
        from: fromEmail,
        to: [adminEmail],
        subject,
        html,
      });
      if (!send.ok) {
        console.error('[admin-notifications] Resend error:', send.status, send.error);
        return jsonResponse({ ok: false, error: send.error ?? 'Resend failed' }, 502);
      }
      console.log('[admin-notifications] Signup email sent', { id: send.id, user: p.id });
      return jsonResponse({ ok: true, kind: 'signup', resend_id: send.id });
    }

    // Purchase path: `paddle_events` is the canonical row written for every Paddle webhook from
    // `apps/api` billing (idempotency + audit). We filter noisy event types in formatters.
    if (table === 'paddle_events') {
      const userId = typeof record.user_id === 'string' ? record.user_id : null;
      let userEmail: string | null = null;
      if (supabase && userId) {
        const { data, error } = await supabase.auth.admin.getUserById(userId);
        if (!error) userEmail = data.user?.email ?? null;
      }

      const purchase = purchaseEmailFromPaddle(
        {
          event_id: record.event_id as string | undefined,
          event_type: record.event_type as string | undefined,
          user_id: record.user_id as string | undefined,
          payload: record.payload as Record<string, unknown> | undefined,
          processed_at: record.processed_at as string | undefined,
        },
        userEmail,
      );

      if (!purchase) {
        console.log('[admin-notifications] paddle_events INSERT ignored (event type filtered)', {
          event_type: record.event_type,
        });
        return jsonResponse({ ok: true, ignored: true, reason: 'paddle event type not notified' });
      }

      const send = await sendResendEmail({
        apiKey: resendKey,
        from: fromEmail,
        to: [adminEmail],
        subject: purchase.subject,
        html: purchase.html,
      });
      if (!send.ok) {
        console.error('[admin-notifications] Resend error:', send.status, send.error);
        return jsonResponse({ ok: false, error: send.error ?? 'Resend failed' }, 502);
      }
      console.log('[admin-notifications] Purchase email sent', { id: send.id, event: record.event_type });
      return jsonResponse({ ok: true, kind: 'purchase', resend_id: send.id });
    }

    console.log('[admin-notifications] Unknown table — no-op', { table });
    return jsonResponse({ ok: true, ignored: true, reason: `table ${table} not handled` });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[admin-notifications] Unhandled:', msg);
    return jsonResponse({ ok: false, error: 'Internal error' }, 500);
  }
});
