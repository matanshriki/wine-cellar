/**
 * Minimal Web Push sender for Deno (Supabase Edge Functions).
 * Uses npm:web-push (VAPID + encrypted payload). Private key never leaves the server.
 */

import webpush from 'npm:web-push@3.6.7';

export type PushSubscriptionKeys = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PushPayload = {
  title: string;
  body: string;
  tag?: string;
  data?: Record<string, unknown>;
};

export type SendResult =
  | { ok: true; statusCode: number }
  | { ok: false; statusCode: number; expired: boolean; error: string };

let configured = false;

export function configureWebPush(vapidPublicKey: string, vapidPrivateKey: string, subject: string) {
  webpush.setVapidDetails(subject, vapidPublicKey, vapidPrivateKey);
  configured = true;
}

export async function sendWebPush(
  sub: PushSubscriptionKeys,
  payload: PushPayload,
): Promise<SendResult> {
  if (!configured) {
    return { ok: false, statusCode: 0, expired: false, error: 'VAPID not configured' };
  }

  try {
    const result = await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify(payload),
      {
        TTL: 60 * 60 * 12, // 12h
        urgency: 'normal',
      },
    );
    return { ok: true, statusCode: result.statusCode };
  } catch (err: unknown) {
    const statusCode =
      err && typeof err === 'object' && 'statusCode' in err
        ? Number((err as { statusCode: number }).statusCode)
        : 0;
    const message = err instanceof Error ? err.message : String(err);
    // 404 / 410 = subscription gone
    const expired = statusCode === 404 || statusCode === 410;
    return { ok: false, statusCode, expired, error: message };
  }
}
