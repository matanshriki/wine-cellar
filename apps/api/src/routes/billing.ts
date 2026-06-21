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
 *
 * Credit renewal flow:
 *   - subscription.renewed  — canonical renewal event; resets credit_balance to plan allowance.
 *   - transaction.completed (origin: subscription_recurring) — safety-net fallback.
 *   - bonus_credits (top-up purchases) are never touched by renewal events.
 *
 * Idempotency:
 *   - Every event is recorded in paddle_events with a UNIQUE constraint on event_id.
 *   - processed_successfully = TRUE → event fully handled; future duplicates are skipped.
 *   - processed_successfully = FALSE → event received but userId unresolvable; retries allowed.
 *
 * userId resolution (fixes the renewal bug):
 *   1. Try event.data.custom_data.userId  (present on initial checkout events)
 *   2. Fall back to DB lookup by paddle_subscription_id → user_ai_credits.user_id
 *      (works for recurring renewals where Paddle does not resend custom_data)
 *   3. Fall back to DB lookup by paddle_customer_id → user_ai_credits.user_id
 *   4. If all three fail, record the event as processed_successfully = FALSE and
 *      log an error so the repair script can backfill.
 */

import { Router, type Request, type Response } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config.js';
import { type AuthRequest, authenticateSupabase } from '../middleware/auth.js';
import { sendMetaCapiEvent, valueCurrencyFromPaddlePayload } from '../lib/metaConversionsApi.js';
import { Sentry, isSentryInitialized } from '../lib/sentry.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any, any, any>;

export const billingRouter = Router();

const META_EVENT_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ── Paddle price ID → plan metadata map ──────────────────────────────────────

export interface PlanMeta {
  planKey: string;
  monthlyCredits: number;
}

export function getPlanMeta(priceId: string): PlanMeta | null {
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

export function getTopUpMeta(priceId: string): TopUpMeta | null {
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

// ── userId resolution ─────────────────────────────────────────────────────────

/**
 * Looks up the internal user_id for a Paddle subscription or customer.
 *
 * This is the fallback for recurring renewal events where Paddle does not
 * include the original checkout custom_data (userId) in the event payload.
 * The mapping was stored during subscription.created / subscription.activated.
 *
 * Exported for unit testing.
 */
export async function lookupUserByPaddleIds(
  supabase: AnySupabase,
  paddleSubscriptionId: string | null | undefined,
  paddleCustomerId: string | null | undefined,
): Promise<string | null> {
  if (paddleSubscriptionId) {
    const { data, error } = await supabase
      .from('user_ai_credits')
      .select('user_id')
      .eq('paddle_subscription_id', paddleSubscriptionId)
      .maybeSingle();
    if (error) {
      console.error('[Paddle] DB lookup by subscription_id failed:', error.message);
    } else if (data?.user_id) {
      return data.user_id as string;
    }
  }

  if (paddleCustomerId) {
    const { data, error } = await supabase
      .from('user_ai_credits')
      .select('user_id')
      .eq('paddle_customer_id', paddleCustomerId)
      .maybeSingle();
    if (error) {
      console.error('[Paddle] DB lookup by customer_id failed:', error.message);
    } else if (data?.user_id) {
      return data.user_id as string;
    }
  }

  return null;
}

/**
 * Resolves the Supabase user_id for a Paddle event.
 *
 * Priority:
 *   1. custom_data.userId  (present when the checkout set it directly)
 *   2. DB lookup by paddle_subscription_id  (works for recurring renewals)
 *   3. DB lookup by paddle_customer_id  (last resort)
 *
 * Returns null only when the subscription was never provisioned in our
 * system (genuine orphan event or unrelated test event).
 */
async function resolveEventUserId(
  supabase: AnySupabase,
  eventType: string,
  data: Record<string, unknown>,
): Promise<{ userId: string | null; resolvedVia: 'custom_data' | 'db_subscription' | 'db_customer' | 'none' }> {
  // 1. Try custom_data first (cheapest path; present on initial checkout events)
  const customData = paddleCustomData(data);
  const customDataUserId = customData['userId'] ?? null;
  if (customDataUserId) {
    return { userId: customDataUserId, resolvedVia: 'custom_data' };
  }

  // 2. Extract Paddle IDs from the event for DB lookup.
  //    subscription events: data.id is the subscription ID
  //    transaction events:  data.subscription_id is the subscription ID
  const isSubscriptionEvent = eventType.startsWith('subscription.');
  const paddleSubId = isSubscriptionEvent
    ? (data?.id as string | null | undefined)
    : (data?.subscription_id as string | null | undefined);
  const paddleCustId = data?.customer_id as string | null | undefined;

  // 3. DB fallback (handles recurring renewals with no custom_data)
  if (paddleSubId || paddleCustId) {
    const userId = await lookupUserByPaddleIds(supabase, paddleSubId, paddleCustId);
    if (userId) {
      const via = paddleSubId ? 'db_subscription' : 'db_customer';
      return { userId, resolvedVia: via as 'db_subscription' | 'db_customer' };
    }
  }

  return { userId: null, resolvedVia: 'none' };
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
    const { plan, topup, period, meta_event_id } = req.query as {
      plan?: string;
      topup?: string;
      period?: string;
      meta_event_id?: string;
    };
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

    const metaEventId =
      typeof meta_event_id === 'string' && META_EVENT_ID_RE.test(meta_event_id.trim())
        ? meta_event_id.trim()
        : undefined;

    return res.json({
      priceId,
      environment: config.paddleEnvironment,
      email,
      paddleCustomerId,
      userId: req.userId,   // passed as customData to Paddle so we can map webhook → user
      metaEventId,
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

      console.log(`[Paddle Webhook] Received event_type=${eventType} event_id=${eventId}`);

      if (isSentryInitialized()) {
        Sentry.addBreadcrumb({
          message: 'billing.webhook_received',
          category: 'billing',
          data: { event_type: eventType, event_id: eventId },
          level: 'info',
        });
      }

      const supabase = getServiceClient();
      if (!supabase) {
        console.error('[Paddle Webhook] Service client unavailable — missing service role key');
        return res.status(500).json({ error: 'Service unavailable' });
      }

      // 2. Idempotency check — skip only if the event was previously handled successfully.
      //    Events with processed_successfully = FALSE are allowed to be re-processed
      //    (they were recorded but no credits were granted due to unresolvable userId).
      const { data: existing, error: idempotencyErr } = await supabase
        .from('paddle_events')
        .select('id, processed_successfully')
        .eq('event_id', eventId)
        .maybeSingle();

      if (idempotencyErr) {
        // Table may not exist yet — log and continue
        console.error('[Paddle Webhook] paddle_events table error (migration may be missing):', idempotencyErr.message);
      }

      if (existing?.processed_successfully === true) {
        console.log(`[Paddle Webhook] event_id=${eventId} already successfully processed — skipping (duplicate)`);
        return res.json({ ok: true, duplicate: true, processed_successfully: true });
      }

      // 3. Resolve userId: try custom_data first, fall back to DB lookup.
      //    This fixes the recurring renewal bug where Paddle does not resend
      //    custom_data in subscription.renewed events.
      const { userId, resolvedVia } = await resolveEventUserId(supabase, eventType, event.data ?? {});

      if (userId) {
        if (resolvedVia !== 'custom_data') {
          console.log(
            `[Paddle Webhook] event_id=${eventId} event_type=${eventType}: ` +
            `userId=${userId} resolved via ${resolvedVia} (custom_data was absent)`,
          );
        } else {
          console.log(`[Paddle Webhook] event_id=${eventId} event_type=${eventType}: userId=${userId} (from custom_data)`);
        }
      } else {
        console.warn(
          `[Paddle Webhook] event_id=${eventId} event_type=${eventType}: ` +
          `userId could not be resolved from custom_data or DB — credits cannot be granted`,
        );
      }

      // 4. Process event
      let processedSuccessfully = false;
      try {
        processedSuccessfully = await handlePaddleEvent(supabase, eventType, eventId, event.data, userId);
        if (processedSuccessfully) {
          console.log(`[Paddle Webhook] event_id=${eventId} event_type=${eventType}: handler completed successfully`);
        }
      } catch (err: any) {
        console.error(`[Paddle Webhook] Handler error for event_type=${eventType} event_id=${eventId}:`, err.message);
        if (isSentryInitialized()) {
          Sentry.withScope((scope) => {
            scope.setTag('event_type', eventType);
            scope.setTag('event_id', eventId);
            Sentry.captureException(err);
          });
        }
        // Still record the event for debugging; return 200 so Paddle doesn't retry
      }

      // 5. Persist event for audit + idempotency
      //    If the event already exists (processed_successfully = FALSE from a prior attempt),
      //    update it in-place. Otherwise insert a new row.
      if (existing) {
        // Re-processing attempt: update the existing row
        const { error: updateErr } = await supabase
          .from('paddle_events')
          .update({
            user_id: userId ?? null,
            processed_successfully: processedSuccessfully,
            processed_at: new Date().toISOString(),
          })
          .eq('event_id', eventId);
        if (updateErr) {
          console.error('[Paddle Webhook] Failed to update paddle_events:', updateErr.message);
        }
      } else {
        const { error: insertErr } = await supabase.from('paddle_events').insert({
          event_id:               eventId,
          event_type:             eventType,
          user_id:                userId ?? null,
          payload:                event,
          processed_successfully: processedSuccessfully,
        });
        if (insertErr) {
          console.error('[Paddle Webhook] Failed to insert into paddle_events:', insertErr.message);
        }
      }

      return res.json({ ok: true, processed_successfully: processedSuccessfully });
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

// ── Meta Purchase (webhook) — same event_id as browser checkout when metaEventId is in custom_data ──

async function trySendMetaPurchaseFromPaddleWebhook(
  supabase: AnySupabase,
  userId: string | null,
  data: Record<string, unknown>,
  customData: Record<string, string>,
) {
  const metaEventId = customData['metaEventId'] ?? customData['meta_event_id'];
  if (!metaEventId?.trim() || !userId) return;

  const vc = valueCurrencyFromPaddlePayload(data);
  if (!vc) {
    if (config.nodeEnv === 'development') {
      console.warn('[Meta CAPI] Purchase webhook skipped — could not parse Paddle totals');
    }
    return;
  }

  const { data: auth } = await supabase.auth.admin.getUserById(userId);
  const email = auth?.user?.email ?? undefined;

  await sendMetaCapiEvent({
    eventName: 'Purchase',
    eventId: metaEventId.trim(),
    eventSourceUrl: `${config.webUrl.replace(/\/$/, '')}/upgrade`,
    user: {
      email,
      externalId: userId,
    },
    customData: { value: vc.value, currency: vc.currency },
  });
}

function paddleCustomData(data: unknown): Record<string, string> {
  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>).custom_data : undefined;
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v != null) out[k] = String(v);
  }
  return out;
}

// ── Event handler ─────────────────────────────────────────────────────────────

/**
 * Dispatches a verified Paddle event to the appropriate credit-granting logic.
 *
 * Returns TRUE when the event resulted in a meaningful action (credits granted,
 * subscription state updated), FALSE when the event was intentionally ignored
 * (unknown price, non-subscription transaction origin, etc.).
 *
 * For subscription renewal events (subscription.renewed, transaction.completed
 * with origin subscription_recurring), credit_balance is SET to the plan's
 * monthly allowance — unused credits from the previous cycle are discarded.
 * bonus_credits (purchased top-ups) are never affected by renewal events.
 *
 * Exported for unit testing.
 */
export async function handlePaddleEvent(
  supabase: AnySupabase,
  eventType: string,
  eventId: string,
  data: any,
  userId: string | null,
): Promise<boolean> {
  const customData = paddleCustomData(data);

  switch (eventType) {
    // ── Subscription created / activated ────────────────────────────────────
    case 'subscription.created':
    case 'subscription.activated': {
      if (!userId) {
        console.warn(`[Paddle] ${eventType} event_id=${eventId}: userId unresolvable — cannot provision`);
        return false;
      }
      const priceId         = data?.items?.[0]?.price?.id;
      const subscriptionId  = data?.id;
      const customerId      = data?.customer_id;
      const periodEnd       = data?.current_billing_period?.ends_at ?? null;
      const periodStart     = data?.current_billing_period?.starts_at ?? null;

      const plan = getPlanMeta(priceId);
      if (!plan) {
        console.warn(`[Paddle] ${eventType} event_id=${eventId}: unknown price_id=${priceId}`);
        return false;
      }

      console.log(
        `[Paddle] ${eventType} event_id=${eventId} subscription_id=${subscriptionId} ` +
        `user_id=${userId} plan=${plan.planKey} allowance=${plan.monthlyCredits}`,
      );

      await supabase.rpc('paddle_grant_credits', {
        p_user_id:                userId,
        p_plan_key:               plan.planKey,
        p_credits_to_set:         plan.monthlyCredits,
        p_bonus_credits_to_add:   0,
        p_billing_period_end:     periodEnd,
        p_billing_period_start:   periodStart,
        p_billing_status:         'active',
        p_paddle_customer_id:     customerId,
        p_paddle_subscription_id: subscriptionId,
      });

      console.log(
        `[Paddle] ${eventType} event_id=${eventId} user_id=${userId}: ` +
        `credit_balance SET to ${plan.monthlyCredits} (new subscription)`,
      );

      await trySendMetaPurchaseFromPaddleWebhook(supabase, userId, data, customData);
      return true;
    }

    // ── Subscription renewed ─────────────────────────────────────────────────
    // This is the canonical monthly renewal event in Paddle Billing v2.
    // credit_balance is RESET (SET) to the plan allowance — not added.
    // bonus_credits (purchased top-ups) are untouched.
    case 'subscription.renewed': {
      if (!userId) {
        console.warn(`[Paddle] subscription.renewed event_id=${eventId}: userId unresolvable — cannot reset credits`);
        return false;
      }
      const priceId        = data?.items?.[0]?.price?.id;
      const subscriptionId = data?.id;
      const customerId     = data?.customer_id;
      const periodEnd      = data?.current_billing_period?.ends_at ?? null;
      const periodStart    = data?.current_billing_period?.starts_at ?? null;

      const plan = getPlanMeta(priceId);
      if (!plan) {
        console.warn(`[Paddle] subscription.renewed event_id=${eventId}: unknown price_id=${priceId}`);
        return false;
      }

      // Fetch current balance before reset for structured logging
      const { data: prevRow } = await supabase
        .from('user_ai_credits')
        .select('credit_balance, bonus_credits, monthly_limit')
        .eq('user_id', userId)
        .maybeSingle();
      const prevBalance    = prevRow?.credit_balance ?? null;
      const bonusCredits   = prevRow?.bonus_credits ?? 0;

      console.log(
        `[Paddle] subscription.renewed event_id=${eventId} subscription_id=${subscriptionId} ` +
        `user_id=${userId} plan=${plan.planKey} allowance=${plan.monthlyCredits} ` +
        `prev_subscription_credits=${prevBalance ?? 'unknown'} bonus_credits=${bonusCredits}`,
      );

      const { error: rpcErr } = await supabase.rpc('paddle_grant_credits', {
        p_user_id:                userId,
        p_plan_key:               plan.planKey,
        p_credits_to_set:         plan.monthlyCredits,
        p_bonus_credits_to_add:   0,
        p_billing_period_end:     periodEnd,
        p_billing_period_start:   periodStart,
        p_billing_status:         'active',
        p_paddle_customer_id:     customerId,
        p_paddle_subscription_id: subscriptionId,
      });

      if (rpcErr) {
        console.error(
          `[Paddle] subscription.renewed event_id=${eventId} user_id=${userId}: paddle_grant_credits failed:`,
          rpcErr.message,
        );
        throw rpcErr;
      }

      console.log(
        `[Paddle] subscription.renewed event_id=${eventId} user_id=${userId}: ` +
        `credit_balance RESET ${prevBalance ?? '?'} → ${plan.monthlyCredits} ` +
        `(bonus_credits unchanged: ${bonusCredits})`,
      );

      return true;
    }

    // ── Subscription updated (plan change, payment method, address, etc.) ─────
    // Only refresh credits when the billing period actually advances (i.e. the
    // period end moved forward). This prevents unnecessary credit resets when a
    // user updates their card mid-cycle or when Paddle fires administrative updates.
    case 'subscription.updated': {
      if (!userId) return false;
      const priceId        = data?.items?.[0]?.price?.id;
      const subscriptionId = data?.id;
      const customerId     = data?.customer_id;
      const periodEnd      = data?.current_billing_period?.ends_at ?? null;
      const periodStart    = data?.current_billing_period?.starts_at ?? null;
      const status         = data?.status;

      // Cancelled status on subscription.updated — downgrade to free immediately
      if (status === 'cancelled' || status === 'canceled') {
        console.log(
          `[Paddle] subscription.updated event_id=${eventId} status=${status} ` +
          `user_id=${userId} — cancelling subscription`,
        );
        await supabase.rpc('paddle_cancel_subscription', { p_user_id: userId });
        return true;
      }

      const plan = getPlanMeta(priceId);
      if (!plan) {
        console.warn(`[Paddle] subscription.updated event_id=${eventId}: unknown price_id=${priceId}`);
        return false;
      }

      // Only reset credits if the billing period has advanced since what we stored.
      // Compare the incoming period_end with the DB value; skip if unchanged.
      const { data: existing } = await supabase
        .from('user_ai_credits')
        .select('billing_period_end, current_period_end, credit_balance, bonus_credits')
        .eq('user_id', userId)
        .maybeSingle();

      const storedEnd = existing?.billing_period_end ?? existing?.current_period_end;
      const incomingEnd = periodEnd ? new Date(periodEnd) : null;
      const storedEndDate = storedEnd ? new Date(storedEnd) : null;

      const periodAdvanced =
        incomingEnd !== null &&
        (storedEndDate === null || incomingEnd > storedEndDate);

      if (!periodAdvanced) {
        // Administrative update (card change, address, plan metadata) — update
        // plan metadata without touching credit_balance.
        console.log(
          `[Paddle] subscription.updated event_id=${eventId} user_id=${userId} ` +
          `— no period advance (administrative update); updating metadata only`,
        );
        await supabase.rpc('paddle_grant_credits', {
          p_user_id:                userId,
          p_plan_key:               plan.planKey,
          p_credits_to_set:         0,  // 0 = don't touch credit_balance
          p_bonus_credits_to_add:   0,
          p_billing_period_end:     periodEnd,
          p_billing_period_start:   periodStart,
          p_billing_status:         status === 'active' ? 'active' : status ?? null,
          p_paddle_customer_id:     customerId,
          p_paddle_subscription_id: subscriptionId,
        });
        return true;
      }

      // Period advanced — effective renewal via subscription.updated (rare fallback
      // for cases where subscription.renewed was not delivered). Grant fresh credits.
      const prevBalance  = existing?.credit_balance ?? null;
      const bonusCredits = existing?.bonus_credits ?? 0;

      console.log(
        `[Paddle] subscription.updated event_id=${eventId} user_id=${userId} plan=${plan.planKey} ` +
        `— period advanced; resetting credits. allowance=${plan.monthlyCredits} ` +
        `prev_subscription_credits=${prevBalance ?? 'unknown'} bonus_credits=${bonusCredits}`,
      );

      await supabase.rpc('paddle_grant_credits', {
        p_user_id:                userId,
        p_plan_key:               plan.planKey,
        p_credits_to_set:         plan.monthlyCredits,
        p_bonus_credits_to_add:   0,
        p_billing_period_end:     periodEnd,
        p_billing_period_start:   periodStart,
        p_billing_status:         'active',
        p_paddle_customer_id:     customerId,
        p_paddle_subscription_id: subscriptionId,
      });

      console.log(
        `[Paddle] subscription.updated event_id=${eventId} user_id=${userId}: ` +
        `credit_balance RESET ${prevBalance ?? '?'} → ${plan.monthlyCredits} ` +
        `(bonus_credits unchanged: ${bonusCredits})`,
      );

      return true;
    }

    // ── Subscription cancelled ─────────────────────────────────────────────
    case 'subscription.canceled': {
      if (!userId) return false;
      console.log(
        `[Paddle] subscription.canceled event_id=${eventId} user_id=${userId} — cancelling subscription`,
      );
      await supabase.rpc('paddle_cancel_subscription', { p_user_id: userId });
      return true;
    }

    // ── Transaction completed ──────────────────────────────────────────────
    case 'transaction.completed': {
      if (!userId) return false;

      const originType     = data?.origin ?? '';
      const priceId        = data?.items?.[0]?.price?.id;
      const subscriptionId = data?.subscription_id ?? null;
      const customerId     = data?.customer_id;

      // ── Subscription renewal safety net ──────────────────────────────────
      // subscription.renewed is the canonical renewal event (handled above).
      // transaction.completed (origin: subscription_recurring) fires for the
      // same payment. If subscription.renewed was already processed (its own
      // event_id is in paddle_events), this path is still reached because
      // transaction.completed has a different event_id. Both call
      // paddle_grant_credits with p_credits_to_set = plan.monthlyCredits,
      // which is a SET operation — calling it twice is idempotent.
      if (originType === 'subscription_recurring') {
        const plan = getPlanMeta(priceId);
        if (!plan) {
          console.warn(
            `[Paddle] transaction.completed(subscription_recurring) event_id=${eventId}: ` +
            `unknown price_id=${priceId} — skipping`,
          );
          return false;
        }

        // Fetch current balance for structured logging
        const { data: prevRow } = await supabase
          .from('user_ai_credits')
          .select('credit_balance, bonus_credits')
          .eq('user_id', userId)
          .maybeSingle();
        const prevBalance  = prevRow?.credit_balance ?? null;
        const bonusCredits = prevRow?.bonus_credits ?? 0;

        console.log(
          `[Paddle] transaction.completed(subscription_recurring) event_id=${eventId} ` +
          `subscription_id=${subscriptionId} user_id=${userId} plan=${plan.planKey} ` +
          `allowance=${plan.monthlyCredits} prev_subscription_credits=${prevBalance ?? 'unknown'} ` +
          `bonus_credits=${bonusCredits} — safety-net renewal credit reset`,
        );

        await supabase.rpc('paddle_grant_credits', {
          p_user_id:                userId,
          p_plan_key:               plan.planKey,
          p_credits_to_set:         plan.monthlyCredits,
          p_bonus_credits_to_add:   0,
          p_billing_period_end:     null,  // period dates come from subscription events
          p_billing_period_start:   null,
          p_billing_status:         'active',
          p_paddle_customer_id:     customerId,
          p_paddle_subscription_id: subscriptionId,
        });

        console.log(
          `[Paddle] transaction.completed event_id=${eventId} user_id=${userId}: ` +
          `credit_balance RESET ${prevBalance ?? '?'} → ${plan.monthlyCredits} ` +
          `(bonus_credits unchanged: ${bonusCredits})`,
        );

        return true;
      }

      // ── Subscription initial charge — credits already granted by subscription.activated ──
      if (originType === 'subscription_create') {
        console.log(
          `[Paddle] transaction.completed(subscription_create) event_id=${eventId} user_id=${userId} ` +
          `— credits already handled by subscription.activated`,
        );
        return true;
      }

      // ── One-time top-up ───────────────────────────────────────────────────
      const topUp = getTopUpMeta(priceId);
      if (!topUp) {
        console.warn(
          `[Paddle] transaction.completed event_id=${eventId}: unknown price_id=${priceId} ` +
          `(origin: ${originType}) — skipping`,
        );
        return false;
      }

      console.log(
        `[Paddle] transaction.completed (top-up) event_id=${eventId} user_id=${userId} ` +
        `bonus_credits_to_add=${topUp.bonusCredits}`,
      );

      const { error: rpcErr } = await supabase.rpc('paddle_grant_credits', {
        p_user_id:                userId,
        p_plan_key:               'topup',
        p_credits_to_set:         0,
        p_bonus_credits_to_add:   topUp.bonusCredits,
        p_billing_period_end:     null,
        p_billing_period_start:   null,
        p_billing_status:         null,
        p_paddle_customer_id:     customerId,
        p_paddle_subscription_id: null,
      });
      if (rpcErr) {
        console.error(`[Paddle] paddle_grant_credits (top-up) event_id=${eventId} failed:`, rpcErr.message);
        throw rpcErr;
      }

      console.log(
        `[Paddle] transaction.completed (top-up) event_id=${eventId} user_id=${userId}: ` +
        `bonus_credits +${topUp.bonusCredits} (subscription credits untouched)`,
      );

      await trySendMetaPurchaseFromPaddleWebhook(supabase, userId, data, customData);
      return true;
    }

    default:
      console.log(`[Paddle] Unhandled event_type=${eventType} event_id=${eventId}`);
      return false;
  }
}
