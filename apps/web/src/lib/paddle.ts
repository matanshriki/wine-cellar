/**
 * Paddle Billing — client-side SDK initialisation and checkout helpers.
 *
 * Uses @paddle/paddle-js (overlay checkout).
 * The client token is a public credential — safe in the browser.
 * The secret API key lives server-side only.
 */

// Types-only import keeps the module graph clean while the runtime SDK is lazy-loaded
import type { Paddle, CheckoutOpenOptions } from '@paddle/paddle-js';

const CLIENT_TOKEN = import.meta.env.VITE_PADDLE_CLIENT_TOKEN as string | undefined;
const ENVIRONMENT  = (import.meta.env.VITE_PADDLE_ENVIRONMENT ?? 'production') as 'sandbox' | 'production';
const API_BASE     = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

let paddleInstance: Paddle | null = null;
let initPromise: Promise<Paddle | null> | null = null;

/**
 * Returns a ready Paddle instance (initialised once, memoised).
 * The Paddle SDK is dynamically imported on first call so it is excluded from
 * the initial app bundle — users who never open the upgrade flow pay zero cost.
 */
export async function getPaddle(): Promise<Paddle | null> {
  if (paddleInstance) return paddleInstance;
  if (initPromise)    return initPromise;

  if (!CLIENT_TOKEN) {
    console.warn('[Paddle] VITE_PADDLE_CLIENT_TOKEN not set — checkout disabled');
    return null;
  }

  initPromise = import('@paddle/paddle-js').then(({ initializePaddle }) =>
    initializePaddle({ token: CLIENT_TOKEN!, environment: ENVIRONMENT })
  ).then((paddle) => {
    paddleInstance = paddle ?? null;
    return paddleInstance;
  }).catch((err) => {
    console.error('[Paddle] Init failed:', err);
    initPromise = null; // allow retry
    return null;
  });

  return initPromise;
}

// ── Checkout helpers ──────────────────────────────────────────────────────────

export interface CheckoutConfig {
  priceId: string;
  environment: string;
  email?: string;
  paddleCustomerId?: string;
  userId: string;
}

/**
 * Fetches checkout config from our server (so the browser never decides
 * which price ID to charge) then opens the Paddle overlay.
 */
export async function openCheckout(
  params: { plan?: string; topup?: string },
  options?: {
    authToken: string;
    onSuccess?: () => void;
    onClose?: () => void;
  },
): Promise<void> {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, v]) => Boolean(v)) as [string, string][],
  ).toString();

  // Fetch server-resolved config (use absolute API URL to avoid hitting the SPA server)
  const resp = await fetch(`${API_BASE}/api/billing/checkout-config?${query}`, {
    headers: { Authorization: `Bearer ${options?.authToken ?? ''}` },
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to get checkout config');
  }

  const cfg: CheckoutConfig = await resp.json();

  const paddle = await getPaddle();
  if (!paddle) throw new Error('Paddle SDK not available');

  // Pre-fill the customer email if we have it (Paddle handles returning customers by email)
  // Do NOT pass paddleCustomerId into the customer object — not a valid overlay field.
  const checkoutOpts: CheckoutOpenOptions = {
    items: [{ priceId: cfg.priceId, quantity: 1 }],
    customData: { userId: cfg.userId },
    ...(cfg.email ? { customer: { email: cfg.email } } : {}),
  };

  // Wire success / close callbacks via the global event system before opening.
  // We clear the callback immediately after it fires to avoid stale listeners
  // across multiple checkout sessions.
  if (options?.onSuccess || options?.onClose) {
    paddle.Update({
      eventCallback: (event: any) => {
        if (event.name === 'checkout.completed') {
          options?.onSuccess?.();
          paddle.Update({ eventCallback: undefined });
        } else if (event.name === 'checkout.closed') {
          options?.onClose?.();
          paddle.Update({ eventCallback: undefined });
        }
      },
    });
  }

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
