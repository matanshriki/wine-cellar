/**
 * Paddle Billing Routes
 *
 * GET  /api/billing/checkout-config  — Returns price IDs + user email for Paddle overlay checkout
 * POST /api/billing/webhook          — Paddle webhook handler (raw body, HMAC-verified)
 * GET  /api/billing/portal           — Returns Paddle customer portal URL
 *
 * Security:
 *   - checkout-config and portal use authenticateSupabase (Supabase JWT).
 *   - webhook uses Paddle HMAC-SHA256 signature verification; never uses an auth token.
 *   - Service-role Supabase client is used for all DB mutations (bypasses RLS).
 *   - Price IDs are resolved server-side only; the browser never decides which price to charge.
 */

import { Router, type Request, type Response } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config.js';
import { type AuthRequest, authenticateSupabase } from '../middleware/auth.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any, any, any>;

export const billingRouter = Router();

// ── Paddle price ID → plan metadata map ──────────────────────────────────────

interface PlanMeta {
  planKey: string;
  monthlyCredits: number;
}

function getPlanMeta(priceId: string): PlanMeta | null {
  if (!priceId) return null;
  const entries: Array<[string, PlanMeta]> = [
    [config.paddlePricePremiumMonthly,   { planKey: 'premium',   monthlyCredits: 150 }],
    [config.paddlePriceCollectorMonthly, { planKey: 'collector', monthlyCredits: 500 }],
    // Yearly price IDs are only added when the env var is configured
    ...(config.paddlePricePremiumYearly   ? [[config.paddlePricePremiumYearly,   { planKey: 'premium',   monthlyCredits: 150 }]] as Array<[string, PlanMeta]> : []),
    ...(config.paddlePriceCollectorYearly ? [[config.paddlePriceCollectorYearly, { planKey: 'collector', monthlyCredits: 500 }]] as Array<[string, PlanMeta]> : []),
  ];
  return Object.fromEntries(entries)[priceId] ?? null;
}

interface TopUpMeta {
  bonusCredits: number;
}

function getTopUpMeta(priceId: string): TopUpMeta | null {
  const map: Record<string, TopUpMeta> = {
    [config.paddlePriceTopup50]:  { bonusCredits: 50  },
    [config.paddlePriceTopup150]: { bonusCredits: 150 },
  };
  return map[priceId] ?? null;
}

// ── Supabase service-role client ──────────────────────────────────────────────

function getServiceClient(): AnySupabase | null {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) return null;
  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { persistSession: false },
  }) as AnySupabase;
}

// ── Paddle API helpers ────────────────────────────────────────────────────────

const PADDLE_API_BASE = config.paddleEnvironment === 'sandbox'
  ? 'https://sandbox-api.paddle.com'
  : 'https://api.paddle.com';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function paddleApi(path: string, options: RequestInit = {}): Promise<any> {
  const res = await fetch(`${PADDLE_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${config.paddleApiKey}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Paddle API ${path} → ${res.status}: ${body}`);
  }
  return res.json() as Promise<any>;
}

// ── Webhook signature verification ────────────────────────────────────────────

/**
 * Verifies Paddle's HMAC-SHA256 webhook signature.
 * Paddle-Signature header format: ts=<unix_ts>;h1=<hex_signature>
 * Signed payload: "<ts>:<raw_body>"
 */
function verifyPaddleSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
): boolean {
  if (!signatureHeader || !config.paddleWebhookSecret) return false;

  const parts: Record<string, string> = {};
  for (const part of signatureHeader.split(';')) {
    const [k, v] = part.split('=');
    if (k && v) parts[k] = v;
  }
  const ts = parts['ts'];
  const h1 = parts['h1'];
  if (!ts || !h1) return false;

  const signed = `${ts}:${rawBody.toString('utf8')}`;
  const expected = createHmac('sha256', config.paddleWebhookSecret)
    .update(signed)
    .digest('hex');

  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(h1, 'hex'));
  } catch {
    return false;
  }
}

// ── 1. GET /api/billing/checkout-config ──────────────────────────────────────

/**
 * Returns price ID, customer email (for Paddle pre-fill), and Paddle environment
 * so the browser can open Paddle's overlay checkout.
 *
 * The plan / top-up key is resolved server-side so the browser never controls
 * which price is charged.
 */
billingRouter.get(
  '/checkout-config',
  authenticateSupabase,
  async (req: AuthRequest, res: Response) => {
    const { plan, topup, period } = req.query as { plan?: string; topup?: string; period?: string };
    const isYearly = period === 'yearly';

    // Resolve price ID — server controls which price ID is used; browser never decides.
    // If a yearly price ID is not yet configured, fall back to monthly so checkout
    // still works while the operator adds the env var.
    let priceId: string | null = null;
    if (plan === 'premium') {
      priceId = (isYearly && config.paddlePricePremiumYearly)
        ? config.paddlePricePremiumYearly
        : config.paddlePricePremiumMonthly;
    }
    if (plan === 'collector') {
      priceId = (isYearly && config.paddlePriceCollectorYearly)
        ? config.paddlePriceCollectorYearly
        : config.paddlePriceCollectorMonthly;
    }
    if (topup === '50')  priceId = config.paddlePriceTopup50;
    if (topup === '150') priceId = config.paddlePriceTopup150;

    if (!priceId) {
      return res.status(400).json({ error: 'Invalid plan or topup parameter' });
    }

    // Fetch user email from Supabase for Paddle pre-fill
    const supabase = getServiceClient();
    let email: string | undefined;
    let paddleCustomerId: string | undefined;

    if (supabase && req.userId) {
      const { data: auth } = await supabase.auth.admin.getUserById(req.userId);
      email = auth?.user?.email ?? undefined;

      // Return existing Paddle customer ID so Paddle links to the same customer
      const { data: credits } = await supabase
        .from('user_ai_credits')
        .select('paddle_customer_id')
        .eq('user_id', req.userId)
        .maybeSingle();
      paddleCustomerId = credits?.paddle_customer_id ?? undefined;
    }

    return res.json({
      priceId,
      environment: config.paddleEnvironment,
      email,
      paddleCustomerId,
      userId: req.userId,   // passed as customData to Paddle so we can map webhook → user
    });
  },
);

// ── 2. POST /api/billing/webhook ──────────────────────────────────────────────

/**
 * Paddle posts webhooks here. Raw body is required for HMAC verification.
 * Express.json() is NOT applied to this route — we register it before the
 * global json middleware using express.raw().
 */
billingRouter.post(
  '/webhook',
  // express.raw() in index.ts captures the body as a Buffer in req.body before
  // express.json() can consume the stream — req.body is the raw Buffer here.
  async (req: Request, res: Response) => {
    try {
      const rawBody: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      const signature = req.headers['paddle-signature'] as string | undefined;

      // 1. Verify signature
      if (!verifyPaddleSignature(rawBody, signature)) {
        console.warn('[Paddle Webhook] Invalid signature — rejecting');
        return res.status(401).json({ error: 'Invalid signature' });
      }

      let event: any;
      try {
        event = JSON.parse(rawBody.toString('utf8'));
      } catch {
        return res.status(400).json({ error: 'Invalid JSON body' });
      }

      const eventId: string = event.event_id;
      const eventType: string = event.event_type;

      console.log(`[Paddle Webhook] ${eventType} (${eventId})`);

      const supabase = getServiceClient();
      if (!supabase) {
        console.error('[Paddle Webhook] Service client unavailable — missing service role key');
        return res.status(500).json({ error: 'Service unavailable' });
      }

      // 2. Idempotency check — skip if already processed
      const { data: existing, error: idempotencyErr } = await supabase
        .from('paddle_events')
        .select('id')
        .eq('event_id', eventId)
        .maybeSingle();

      if (idempotencyErr) {
        // Table may not exist yet — log and continue (don't abort; still grant credits)
        console.error('[Paddle Webhook] paddle_events table error (migration may be missing):', idempotencyErr.message);
      }

      if (existing) {
        console.log(`[Paddle Webhook] Already processed ${eventId} — skipping`);
        return res.json({ ok: true, duplicate: true });
      }

      // 3. Resolve user_id from custom_data
      const customData: Record<string, string> = event.data?.custom_data ?? {};
      const userId: string | null = customData['userId'] ?? null;
      console.log(`[Paddle Webhook] userId from custom_data: ${userId ?? 'NULL — credits cannot be granted!'}`);

      // 4. Process event
      try {
        await handlePaddleEvent(supabase, eventType, event.data, userId);
        console.log(`[Paddle Webhook] handlePaddleEvent completed for ${eventType}`);
      } catch (err: any) {
        console.error(`[Paddle Webhook] Handler error for ${eventType}:`, err.message);
        // Still store the event for debugging; return 200 so Paddle doesn't retry
      }

      // 5. Persist event for audit + idempotency
      const { error: insertErr } = await supabase.from('paddle_events').insert({
        event_id:  eventId,
        event_type: eventType,
        user_id:   userId ?? null,
        payload:   event,
      });
      if (insertErr) {
        console.error('[Paddle Webhook] Failed to persist event (paddle_events table may be missing):', insertErr.message);
      }

      return res.json({ ok: true });
    } catch (err: any) {
      console.error('[Paddle Webhook] Unhandled error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ── 3. GET /api/billing/portal ────────────────────────────────────────────────

/**
 * Returns a Paddle customer portal URL for the authenticated user.
 * Only works if the user has a paddle_customer_id on record.
 */
billingRouter.get(
  '/portal',
  authenticateSupabase,
  async (req: AuthRequest, res: Response) => {
    const supabase = getServiceClient();
    if (!supabase) {
      return res.status(500).json({ error: 'Service unavailable' });
    }

    const { data: credits } = await supabase
      .from('user_ai_credits')
      .select('paddle_customer_id')
      .eq('user_id', req.userId!)
      .maybeSingle();

    const customerId = credits?.paddle_customer_id;
    if (!customerId) {
      return res.status(404).json({ error: 'No billing account found — subscribe first' });
    }

    try {
      const data = await paddleApi(
        `/customers/${customerId}/portal-sessions`,
        { method: 'POST', body: JSON.stringify({}) },
      );
      const portalUrl = data?.data?.urls?.general?.overview ?? null;
      if (!portalUrl) throw new Error('Portal URL not returned by Paddle API');
      return res.json({ url: portalUrl });
    } catch (err: any) {
      console.error('[Paddle Portal] Error:', err.message);
      return res.status(500).json({ error: 'Failed to create portal session' });
    }
  },
);

// ── Event handler ─────────────────────────────────────────────────────────────

async function handlePaddleEvent(
  supabase: AnySupabase,
  eventType: string,
  data: any,
  userId: string | null,
) {
  switch (eventType) {
    // ── Subscription created / activated ────────────────────────────────────
    case 'subscription.created':
    case 'subscription.activated': {
      if (!userId) {
        console.warn(`[Paddle] ${eventType}: no userId in custom_data — cannot provision`);
        return;
      }
      const priceId         = data?.items?.[0]?.price?.id;
      const subscriptionId  = data?.id;
      const customerId      = data?.customer_id;
      const periodEnd       = data?.current_billing_period?.ends_at ?? null;

      const plan = getPlanMeta(priceId);
      if (!plan) {
        console.warn(`[Paddle] ${eventType}: unknown price ${priceId}`);
        return;
      }

      console.log(`[Paddle] Provisioning ${plan.planKey} for user ${userId}`);
      await supabase.rpc('paddle_grant_credits', {
        p_user_id:               userId,
        p_plan_key:              plan.planKey,
        p_credits_to_set:        plan.monthlyCredits,
        p_bonus_credits_to_add:  0,
        p_billing_period_end:    periodEnd,
        p_paddle_customer_id:    customerId,
        p_paddle_subscription_id: subscriptionId,
      });
      break;
    }

    // ── Subscription renewed / updated ────────────────────────────────────
    case 'subscription.updated': {
      if (!userId) return;
      const priceId        = data?.items?.[0]?.price?.id;
      const subscriptionId = data?.id;
      const customerId     = data?.customer_id;
      const periodEnd      = data?.current_billing_period?.ends_at ?? null;
      const status         = data?.status;

      // Cancellation-pending updates — don't reset credits yet
      if (status === 'canceled') {
        console.log(`[Paddle] subscription.updated with status=canceled for ${userId} — cancelling`);
        await supabase.rpc('paddle_cancel_subscription', { p_user_id: userId });
        return;
      }

      const plan = getPlanMeta(priceId);
      if (!plan) {
        console.warn(`[Paddle] subscription.updated: unknown price ${priceId}`);
        return;
      }

      console.log(`[Paddle] Renewing ${plan.planKey} credits for user ${userId}`);
      await supabase.rpc('paddle_grant_credits', {
        p_user_id:               userId,
        p_plan_key:              plan.planKey,
        p_credits_to_set:        plan.monthlyCredits,
        p_bonus_credits_to_add:  0,
        p_billing_period_end:    periodEnd,
        p_paddle_customer_id:    customerId,
        p_paddle_subscription_id: subscriptionId,
      });
      break;
    }

    // ── Subscription cancelled ─────────────────────────────────────────────
    case 'subscription.canceled': {
      if (!userId) return;
      console.log(`[Paddle] Cancelling subscription for user ${userId}`);
      await supabase.rpc('paddle_cancel_subscription', { p_user_id: userId });
      break;
    }

    // ── One-time top-up (transaction completed) ────────────────────────────
    case 'transaction.completed': {
      if (!userId) return;
      // Only handle non-subscription transactions (top-ups)
      const originType = data?.origin ?? '';
      if (originType === 'subscription_recurring' || originType === 'subscription_create') {
        // Handled by subscription.activated / subscription.updated
        return;
      }

      const priceId    = data?.items?.[0]?.price?.id;
      const customerId = data?.customer_id;

      const topUp = getTopUpMeta(priceId);
      if (!topUp) {
        console.warn(`[Paddle] transaction.completed: unknown price ${priceId}`);
        return;
      }

      console.log(`[Paddle] Adding ${topUp.bonusCredits} bonus credits for user ${userId}`);
      const { error: rpcErr } = await supabase.rpc('paddle_grant_credits', {
        p_user_id:               userId,
        p_plan_key:              'topup',
        p_credits_to_set:        0,
        p_bonus_credits_to_add:  topUp.bonusCredits,
        p_billing_period_end:    null,
        p_paddle_customer_id:    customerId,
        p_paddle_subscription_id: null,
      });
      if (rpcErr) {
        console.error('[Paddle] paddle_grant_credits RPC failed (function may be missing):', rpcErr.message);
        throw rpcErr; // surface to outer catch for logging
      }
      console.log(`[Paddle] Successfully granted ${topUp.bonusCredits} credits to user ${userId}`);
      break;
    }

    default:
      console.log(`[Paddle] Unhandled event type: ${eventType}`);
  }
}
