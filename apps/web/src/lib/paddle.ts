/**
 * Paddle Billing — client-side SDK initialisation and checkout helpers.
 *
 * Uses @paddle/paddle-js (overlay checkout).
 * The client token is a public credential — safe in the browser.
 * The secret API key lives server-side only.
 */

import { initializePaddle, type Paddle, type CheckoutOpenOptions } from '@paddle/paddle-js';

const CLIENT_TOKEN = import.meta.env.VITE_PADDLE_CLIENT_TOKEN as string | undefined;
const ENVIRONMENT  = (import.meta.env.VITE_PADDLE_ENVIRONMENT ?? 'production') as 'sandbox' | 'production';

let paddleInstance: Paddle | null = null;
let initPromise: Promise<Paddle | null> | null = null;

/**
 * Returns a ready Paddle instance (initialised once, memoised).
 * Returns null when the client token is not configured.
 */
export async function getPaddle(): Promise<Paddle | null> {
  if (paddleInstance) return paddleInstance;
  if (initPromise)    return initPromise;

  if (!CLIENT_TOKEN) {
    console.warn('[Paddle] VITE_PADDLE_CLIENT_TOKEN not set — checkout disabled');
    return null;
  }

  initPromise = initializePaddle({
    token:       CLIENT_TOKEN,
    environment: ENVIRONMENT,
  }).then((paddle) => {
    paddleInstance = paddle ?? null;
    return paddleInstance;
  }).catch((err) => {
    console.error('[Paddle] Init failed:', err);
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

  // Fetch server-resolved config
  const resp = await fetch(`/api/billing/checkout-config?${query}`, {
    headers: { Authorization: `Bearer ${options?.authToken ?? ''}` },
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to get checkout config');
  }

  const cfg: CheckoutConfig = await resp.json();

  const paddle = await getPaddle();
  if (!paddle) throw new Error('Paddle SDK not available');

  const checkoutOpts: CheckoutOpenOptions = {
    items: [{ priceId: cfg.priceId, quantity: 1 }],
    customData: { userId: cfg.userId },
  };

  if (cfg.email) {
    checkoutOpts.customer = { email: cfg.email };
  }
  if (cfg.paddleCustomerId) {
    // If the user already has a Paddle customer, pass their ID to avoid duplicates
    checkoutOpts.customer = { id: cfg.paddleCustomerId } as any;
  }

  paddle.Checkout.open({
    ...checkoutOpts,
    settings: {
      displayMode: 'overlay',
      theme: 'dark',
      locale: 'en',
      successUrl: `${window.location.origin}/upgrade?success=1`,
    },
  });
}

/**
 * Returns the URL to open the Paddle customer portal.
 * Fetches from our server which calls the Paddle API.
 */
export async function getPortalUrl(authToken: string): Promise<string> {
  const resp = await fetch('/api/billing/portal', {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to get portal URL');
  }
  const { url } = await resp.json();
  return url;
}
