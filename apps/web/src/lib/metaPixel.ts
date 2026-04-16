/**
 * Meta (Facebook) Pixel — browser-side events for Sommi paid acquisition funnel.
 * Loads from index.html (inline Meta base code) and/or when VITE_META_PIXEL_ID is set for dynamic init.
 * Pairs with POST /api/meta/conversion for CAPI deduplication.
 */

declare global {
  interface Window {
    fbq?: MetaFbq;
    _fbq?: MetaFbq;
  }
}

type MetaFbq = (
  cmd: 'init' | 'track' | 'trackCustom',
  arg1: string,
  arg2?: Record<string, unknown>,
  arg3?: Record<string, unknown>,
) => void;

const PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID?.trim();

let loadPromise: Promise<boolean> | null = null;

function devLog(message: string, extra?: unknown): void {
  if (import.meta.env.DEV) {
    console.log(`[Meta Pixel] ${message}`, extra ?? '');
  }
}

export function isMetaPixelConfigured(): boolean {
  if (PIXEL_ID) return true;
  return typeof window !== 'undefined' && typeof window.fbq === 'function';
}

export function generateMetaEventId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Injects fbevents.js once and calls fbq('init', pixelId).
 */
export function ensureMetaPixelLoaded(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  // Inline snippet in index.html initialises fbq before React runs
  if (typeof window.fbq === 'function') {
    return Promise.resolve(true);
  }
  if (!PIXEL_ID) {
    devLog('Skipped — VITE_META_PIXEL_ID not set and no fbq on window');
    return Promise.resolve(false);
  }
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve) => {
    const existing = document.getElementById('meta-pixel-fbevents');
    if (existing && window.fbq) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.id = 'meta-pixel-fbevents';
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    script.onload = () => {
      if (!window.fbq) {
        devLog('fbevents loaded but fbq missing');
        resolve(false);
        return;
      }
      window.fbq('init', PIXEL_ID);
      devLog('Initialized', { pixelId: PIXEL_ID });
      resolve(true);
    };
    script.onerror = () => {
      devLog('Failed to load fbevents.js');
      resolve(false);
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

async function withFbq(fn: (fbq: MetaFbq) => void): Promise<void> {
  const ok = await ensureMetaPixelLoaded();
  if (!ok || !window.fbq) return;
  fn(window.fbq);
}

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

export async function notifyMetaConversionServer(params: {
  authToken: string;
  eventName: 'Lead' | 'InitiateCheckout' | 'Purchase';
  eventId: string;
  eventSourceUrl?: string;
  value?: number;
  currency?: string;
}): Promise<void> {
  if (!API_BASE) {
    devLog('notifyMetaConversionServer skipped — VITE_API_URL not set');
    return;
  }

  try {
    const res = await fetch(`${API_BASE.replace(/\/$/, '')}/api/meta/conversion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.authToken}`,
      },
      body: JSON.stringify({
        eventName: params.eventName,
        eventId: params.eventId,
        eventSourceUrl: params.eventSourceUrl ?? window.location.href,
        ...(params.eventName === 'Purchase'
          ? { value: params.value, currency: params.currency }
          : {}),
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      devLog('CAPI relay failed', { status: res.status, err });
    }
  } catch (e) {
    devLog('CAPI relay error', e);
  }
}

/** Standard PageView — public marketing routes */
export async function trackPageView(): Promise<void> {
  await withFbq((fbq) => {
    fbq('track', 'PageView');
    devLog('track PageView');
  });
}

/** Custom — primary landing CTA (e.g. “Start”) */
export async function trackCTAButtonClick(params?: { placement?: string }): Promise<void> {
  await withFbq((fbq) => {
    fbq('trackCustom', 'CTAButtonClick', {
      ...(params?.placement ? { placement: params.placement } : {}),
    });
    devLog('trackCustom CTAButtonClick', params);
  });
}

/** Custom — user started email signup before account exists */
export async function trackSignupStarted(): Promise<void> {
  await withFbq((fbq) => {
    fbq('trackCustom', 'SignupStarted');
    devLog('trackCustom SignupStarted');
  });
}

/** Standard Lead — pass the same event_id to the server for deduplication */
export async function trackLead(eventId: string): Promise<void> {
  await withFbq((fbq) => {
    fbq('track', 'Lead', {}, { eventID: eventId });
    devLog('track Lead', { eventId });
  });
}

export async function trackInitiateCheckout(eventId: string): Promise<void> {
  await withFbq((fbq) => {
    fbq('track', 'InitiateCheckout', {}, { eventID: eventId });
    devLog('track InitiateCheckout', { eventId });
  });
}

export async function trackPurchase(params: {
  eventId: string;
  value: number;
  currency: string;
}): Promise<void> {
  await withFbq((fbq) => {
    fbq(
      'track',
      'Purchase',
      {
        value: params.value,
        currency: params.currency,
      },
      { eventID: params.eventId },
    );
    devLog('track Purchase', params);
  });
}
