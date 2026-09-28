/**
 * Web Push client helpers — subscribe / unsubscribe / permission status.
 * VAPID private key stays on the server; only VITE_VAPID_PUBLIC_KEY is used here.
 */

import { supabase } from '../lib/supabase';
import { isIos, isStandalonePwa } from '../utils/deviceDetection';

export type PushPermissionState =
  | 'unsupported'
  | 'needs_standalone' // iOS Safari tab — must Add to Home Screen
  | 'denied'
  | 'default'
  | 'granted'
  | 'no_vapid_key';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function getVapidPublicKey(): string | null {
  const key = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  return key?.trim() || null;
}

export function getPushPermissionState(): PushPermissionState {
  if (typeof window === 'undefined') return 'unsupported';
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return 'unsupported';
  }
  // iOS Web Push only works for Home Screen PWAs (Safari 16.4+)
  if (isIos() && !isStandalonePwa()) {
    return 'needs_standalone';
  }
  if (!getVapidPublicKey()) return 'no_vapid_key';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  return 'default';
}

export async function getActivePushSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator)) return null;
  const reg = await navigator.serviceWorker.ready.catch(() => null);
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

/**
 * Request permission (must be from a user gesture), subscribe to Push, upsert row.
 * Returns true when a subscription is stored for this device.
 */
export async function enablePushNotifications(userId: string): Promise<{
  ok: boolean;
  state: PushPermissionState;
  error?: string;
}> {
  const state = getPushPermissionState();
  if (state === 'unsupported' || state === 'needs_standalone' || state === 'no_vapid_key') {
    return { ok: false, state };
  }
  if (state === 'denied') {
    return { ok: false, state: 'denied', error: 'Permission denied' };
  }

  const vapidKey = getVapidPublicKey();
  if (!vapidKey) return { ok: false, state: 'no_vapid_key' };

  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') {
    return { ok: false, state: permission === 'denied' ? 'denied' : 'default' };
  }

  const reg = await navigator.serviceWorker.ready.catch(() => null);
  if (!reg) {
    return { ok: false, state: 'unsupported', error: 'Service worker not ready' };
  }

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
  }

  const json = sub.toJSON();
  const endpoint = json.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return { ok: false, state: 'granted', error: 'Incomplete subscription keys' };
  }

  const { error } = await (supabase as any).from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint,
      p256dh,
      auth,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 500) : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' },
  );

  if (error) {
    console.warn('[push] upsert failed', error);
    return { ok: false, state: 'granted', error: error.message };
  }

  return { ok: true, state: 'granted' };
}

/** Remove this device's push subscription from the browser and server. */
export async function disablePushNotificationsForThisDevice(userId?: string | null): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.ready.catch(() => null);
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe().catch(() => {});
      if (userId) {
        await (supabase as any)
          .from('push_subscriptions')
          .delete()
          .eq('user_id', userId)
          .eq('endpoint', endpoint);
      } else if (endpoint) {
        // Best-effort delete by endpoint (RLS may block if already signed out)
        await (supabase as any).from('push_subscriptions').delete().eq('endpoint', endpoint);
      }
    }
  } catch (err) {
    console.warn('[push] disable failed', err);
  }
}

export type ReminderInsert = {
  userId: string;
  clientTimerId: string;
  reminderType: 'decant' | 'rate';
  fireAt: string;
  bottleId: string;
  wineId: string;
  historyId?: string;
  wineName: string;
  producer: string;
};

/** Persist a server reminder with absolute fire_at. Idempotent per client timer id. */
export async function upsertWineReminder(data: ReminderInsert): Promise<void> {
  const { error } = await (supabase as any).from('wine_reminders').upsert(
    {
      user_id: data.userId,
      client_timer_id: data.clientTimerId,
      reminder_type: data.reminderType,
      fire_at: data.fireAt,
      status: 'pending',
      bottle_id: data.bottleId || null,
      wine_id: data.wineId || null,
      history_id: data.historyId || null,
      wine_name: data.wineName,
      producer: data.producer,
      last_error: null,
      sent_at: null,
    },
    { onConflict: 'user_id,client_timer_id' },
  );
  if (error) {
    console.warn('[push] reminder upsert failed', error);
    throw error;
  }
}

/** Cancel a pending reminder (no-op if already sent). */
export async function cancelWineReminder(userId: string, clientTimerId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('wine_reminders')
    .update({ status: 'canceled' })
    .eq('user_id', userId)
    .eq('client_timer_id', clientTimerId)
    .in('status', ['pending', 'sending']);
  if (error) {
    console.warn('[push] reminder cancel failed', error);
  }
}
