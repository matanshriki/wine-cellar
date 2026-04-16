/**
 * Paddle Billing — client-side SDK initialisation and checkout helpers.
 *
 * Uses @paddle/paddle-js (overlay checkout).
 * The client token is a public credential — safe in the browser.
 * The secret API key lives server-side only.
 */

// Types-only import keeps the module graph clean while the runtime SDK is lazy-loaded
import type { Paddle, CheckoutOpenOptions } from '@paddle/paddle-js';
import {
  generateMetaEventId,
  notifyMetaConversionServer,
  trackInitiateCheckout,
  trackPurchase,
} from './metaPixel';

const CLIENT_TOKEN = import.meta.env.VITE_PADDLE_CLIENT_TOKEN as string | undefined;
const DEFAULT_ENVIRONMENT = (import.meta.env.VITE_PADDLE_ENVIRONMENT ?? 'production') as
  | 'sandbox'
  | 'production';
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

/** One memoised SDK instance per environment (sandbox vs production tokens/prices must not mix). */
const paddleInitByEnv = new Map<'sandbox' | 'production', Promise<Paddle | null>>();

/**
 * Returns a ready Paddle instance for the given Billing environment.
 * Always pass `environment` from {@link CheckoutConfig} in checkout flows so the SDK
 * matches the server-resolved price IDs (Vite env alone can drift from API deploy config).
 * The Paddle SDK is dynamically imported on first call per environment.
 */
export async function getPaddle(environment?: 'sandbox' | 'production'): Promise<Paddle | null> {
  const env = environment ?? DEFAULT_ENVIRONMENT;

  if (!CLIENT_TOKEN) {
    console.warn('[Paddle] VITE_PADDLE_CLIENT_TOKEN not set — checkout disabled');
    return null;
  }

  let pending = paddleInitByEnv.get(env);
  if (!pending) {
    pending = import('@paddle/paddle-js')
      .then(({ initializePaddle }) =>
        initializePaddle({ token: CLIENT_TOKEN!, environment: env }),
      )
      .then((paddle) => paddle ?? null)
      .catch((err) => {
        console.error('[Paddle] Init failed:', err);
        paddleInitByEnv.delete(env);
        return null;
      });
    paddleInitByEnv.set(env, pending);
  }
  return pending;
}

// ── Checkout helpers ──────────────────────────────────────────────────────────

export interface CheckoutConfig {
  priceId: string;
  environment: 'sandbox' | 'production';
  email?: string;
  paddleCustomerId?: string;
  userId: string;
  /** Echo of meta_event_id for Meta Pixel + CAPI deduplication */
  metaEventId?: string;
}

/**
 * Fetches checkout config from our server (so the browser never decides
 * which price ID to charge) then opens the Paddle overlay.
 */
export async function openCheckout(
  params: { plan?: string; topup?: string; period?: 'monthly' | 'yearly' },
  options?: {
    authToken: string;
    onSuccess?: () => void;
    onClose?: () => void;
  },
): Promise<void> {
  const metaEventId = generateMetaEventId();

  const search = new URLSearchParams(
    Object.entries(params).filter(([, v]) => Boolean(v)) as [string, string][],
  );
  search.set('meta_event_id', metaEventId);

  const query = search.toString();

  // Fetch server-resolved config (use absolute API URL to avoid hitting the SPA server)
  const resp = await fetch(`${API_BASE}/api/billing/checkout-config?${query}`, {
    headers: { Authorization: `Bearer ${options?.authToken ?? ''}` },
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to get checkout config');
  }

  const cfg: CheckoutConfig = await resp.json();

  const paddleEnv = cfg.environment === 'sandbox' ? 'sandbox' : 'production';
  const paddle = await getPaddle(paddleEnv);
  if (!paddle) throw new Error('Paddle SDK not available');

  const dedupeId = cfg.metaEventId ?? metaEventId;

  void trackInitiateCheckout(dedupeId);
  if (options?.authToken) {
    void notifyMetaConversionServer({
      authToken: options.authToken,
      eventName: 'InitiateCheckout',
      eventId: dedupeId,
      eventSourceUrl: typeof window !== 'undefined' ? window.location.href : undefined,
    });
  }

  // Prefer Paddle customer id when we already have one (webhook); else pre-fill email.
  // Types allow `customer: { id }` OR `customer: { email }`, not both.
  const checkoutOpts: CheckoutOpenOptions = {
    items: [{ priceId: cfg.priceId, quantity: 1 }],
    customData: { userId: String(cfg.userId), metaEventId: String(dedupeId) },
    ...(cfg.paddleCustomerId
      ? { customer: { id: cfg.paddleCustomerId } }
      : cfg.email
        ? { customer: { email: cfg.email } }
        : {}),
  };

  // Wire success / close callbacks via the global event system before opening.
  // Always register so Meta Purchase runs even if callers omit onSuccess/onClose.
  paddle.Update({
    eventCallback: (event: any) => {
      if (event.name === 'checkout.completed') {
        const d = event.data;
        const total =
          d?.totals && typeof d.totals.total === 'number' ? d.totals.total : undefined;
        const currency = typeof d?.currency_code === 'string' ? d.currency_code : 'USD';
        if (total != null && options?.authToken) {
          void trackPurchase({
            eventId: dedupeId,
            value: total,
            currency,
          });
          void notifyMetaConversionServer({
            authToken: options.authToken,
            eventName: 'Purchase',
            eventId: dedupeId,
            eventSourceUrl: typeof window !== 'undefined' ? window.location.href : undefined,
            value: total,
            currency,
          });
        }
        options?.onSuccess?.();
        paddle.Update({ eventCallback: undefined });
      } else if (event.name === 'checkout.closed') {
        options?.onClose?.();
        paddle.Update({ eventCallback: undefined });
      } else if (event.name === 'checkout.error' || event.name === 'checkout.failed') {
        const detail = typeof event?.detail === 'string' ? event.detail : JSON.stringify(event);
        console.error('[Paddle] Checkout error:', detail);
        paddle.Update({ eventCallback: undefined });
      }
    },
  });

  paddle.Checkout.open({
    ...checkoutOpts,
    settings: {
      displayMode: 'overlay',
      theme: 'dark',
      locale: 'en',
      // successUrl is for redirect mode only — overlay uses the onComplete event
      // After payment the webhook provisions credits; the page can poll for changes
    },
  });
}

/**
 * Returns the URL to open the Paddle customer portal.
 * Fetches from our server which calls the Paddle API.
 */
export async function getPortalUrl(authToken: string): Promise<string> {
  const resp = await fetch(`${API_BASE}/api/billing/portal`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to get portal URL');
  }
  const { url } = await resp.json();
  return url;
}
