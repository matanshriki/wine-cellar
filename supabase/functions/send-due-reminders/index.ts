/**
 * send-due-reminders
 *
 * Cron / webhook: claim due wine_reminders and send Web Push to each of the
 * user's device subscriptions. Deletes expired endpoints (410/404).
 *
 * Auth (Bearer): WINE_REMINDER_CRON_SECRET (preferred), or WEBHOOK_SECRET
 * (optional legacy), or SUPABASE_SERVICE_ROLE_KEY.
 * Does not require overwriting the shared WEBHOOK_SECRET used by other functions.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { configureWebPush, sendWebPush, type PushPayload } from '../_shared/webPushSend.ts';

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

function verifyInvokeAuth(
  req: Request,
  allowedSecrets: string[],
  serviceRoleKey: string | undefined,
): boolean {
  const auth = req.headers.get('Authorization')?.trim() ?? '';
  const prefix = 'Bearer ';
  if (!auth.startsWith(prefix)) return false;
  const token = auth.slice(prefix.length);
  for (const secret of allowedSecrets) {
    if (secret && timingSafeEqualString(token, secret)) return true;
  }
  if (serviceRoleKey && timingSafeEqualString(token, serviceRoleKey)) return true;
  return false;
}

function buildDeepLink(row: {
  reminder_type: string;
  history_id: string | null;
  bottle_id: string | null;
  wine_name: string | null;
  producer: string | null;
}): string {
  const params = new URLSearchParams();
  // Pass through decant | rate | keep (do not collapse unknown → decant).
  params.set('reminder', row.reminder_type);
  if (row.history_id) params.set('historyId', row.history_id);
  if (row.bottle_id) params.set('bottleId', row.bottle_id);
  if (row.wine_name) params.set('wineName', row.wine_name);
  if (row.producer) params.set('producer', row.producer);
  return `/cellar?${params.toString()}`;
}

function buildPayload(row: {
  id: string;
  reminder_type: string;
  wine_name: string | null;
  producer: string | null;
  history_id: string | null;
  bottle_id: string | null;
}): PushPayload {
  const wine = [row.producer, row.wine_name].filter(Boolean).join(' ') || 'your wine';
  const type = row.reminder_type;
  let title = 'Decanting complete';
  let body = `${wine} is ready to pour.`;
  if (type === 'rate') {
    title = 'Time to rate your wine';
    body = `How was ${wine}? Open Sommi to rate it.`;
  } else if (type === 'keep') {
    title = 'Your Keep day is here';
    body = `${wine} — the occasion you reserved it for is today.`;
  }
  return {
    title,
    body,
    tag: `wine-reminder-${row.id}`,
    data: {
      url: buildDeepLink(row),
      reminderId: row.id,
      type: row.reminder_type,
      historyId: row.history_id,
      bottleId: row.bottle_id,
    },
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
  }

  const wineReminderCronSecret = Deno.env.get('WINE_REMINDER_CRON_SECRET')?.trim();
  const webhookSecret = Deno.env.get('WEBHOOK_SECRET')?.trim();
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')?.trim();
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')?.trim();
  const vapidSubject = Deno.env.get('VAPID_SUBJECT')?.trim() || 'mailto:hello@sommi-ai.com';

  const allowedSecrets = [wineReminderCronSecret, webhookSecret].filter(
    (s): s is string => !!s,
  );

  if (!allowedSecrets.length || !supabaseUrl || !serviceKey || !vapidPublic || !vapidPrivate) {
    console.error('[send-due-reminders] Missing required env');
    return jsonResponse({ ok: false, error: 'Server misconfiguration' }, 500);
  }

  if (!verifyInvokeAuth(req, allowedSecrets, serviceKey)) {
    console.warn('[send-due-reminders] Invalid Authorization');
    return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
  }

  configureWebPush(vapidPublic, vapidPrivate, vapidSubject);

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  let batchSize = 50;
  try {
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      if (body && typeof body.batch_size === 'number') {
        batchSize = body.batch_size;
      }
    }
  } catch {
    /* ignore */
  }

  const { data: claimed, error: claimError } = await supabase.rpc('claim_due_wine_reminders', {
    batch_size: batchSize,
  });

  if (claimError) {
    console.error('[send-due-reminders] claim failed', claimError);
    return jsonResponse({ ok: false, error: claimError.message }, 500);
  }

  const rows = (claimed ?? []) as Array<{
    id: string;
    user_id: string;
    reminder_type: string;
    wine_name: string | null;
    producer: string | null;
    history_id: string | null;
    bottle_id: string | null;
  }>;

  let sent = 0;
  let failed = 0;
  let canceledSkipped = 0;
  let pushes = 0;
  let expiredSubs = 0;

  for (const row of rows) {
    // Re-check cancellation (user may have canceled between claim and send)
    const { data: fresh } = await supabase
      .from('wine_reminders')
      .select('status')
      .eq('id', row.id)
      .maybeSingle();

    // Cancel may race after claim (client allows pending|sending → canceled).
    // Leave status as canceled; do not send; do not flip back to pending.
    if (fresh?.status === 'canceled') {
      canceledSkipped += 1;
      continue;
    }

    const { data: subs, error: subErr } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', row.user_id);

    if (subErr) {
      console.error('[send-due-reminders] sub fetch', subErr);
      // Retryable: return to pending so a later cron tick can claim again.
      await supabase
        .from('wine_reminders')
        .update({ status: 'pending', last_error: subErr.message })
        .eq('id', row.id)
        .eq('status', 'sending');
      failed += 1;
      continue;
    }

    const payload = buildPayload(row);
    let anyOk = false;
    let lastError: string | null = null;
    let expiredAll = (subs?.length ?? 0) > 0;

    for (const sub of subs ?? []) {
      const result = await sendWebPush(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        payload,
      );
      pushes += 1;
      if (result.ok) {
        anyOk = true;
        expiredAll = false;
      } else {
        lastError = result.error;
        if (result.expired) {
          expiredSubs += 1;
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        } else {
          expiredAll = false;
        }
      }
    }

    // No subscriptions, or only gone endpoints: finalize (do not retry forever)
    if (!(subs?.length) || anyOk || expiredAll) {
      await supabase
        .from('wine_reminders')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          last_error: !(subs?.length)
            ? 'no_subscriptions'
            : expiredAll && !anyOk
              ? 'all_subscriptions_expired'
              : null,
        })
        .eq('id', row.id)
        .eq('status', 'sending');
      sent += 1;
    } else {
      // Transient failure — return to pending for retry
      await supabase
        .from('wine_reminders')
        .update({ status: 'pending', last_error: lastError })
        .eq('id', row.id)
        .eq('status', 'sending');
      failed += 1;
    }
  }

  const summary = {
    ok: true,
    claimed: rows.length,
    sent,
    failed,
    canceled_skipped: canceledSkipped,
    pushes,
    expired_subscriptions_removed: expiredSubs,
  };
  console.log('[send-due-reminders]', summary);
  return jsonResponse(summary);
});
