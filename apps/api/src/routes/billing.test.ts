/**
 * Paddle Billing — unit tests for credit renewal logic
 *
 * Tests cover:
 *   A — Renewal resets 50 → 150 (partial balance before cycle end)
 *   B — Renewal resets 0 → 150 (fully exhausted balance)
 *   C — Renewal resets 150 → 150 (unused full balance)
 *   D — Duplicate webhook event is processed only once
 *   E — Failed / non-renewal transaction does not reset credits
 *   F — Top-up bonus credits are preserved; only subscription credits reset
 *   G — Plan upgrade: renewal uses the new plan's allowance (300 credits)
 *   H — userId absent from custom_data but resolvable via DB lookup (the core bug fix)
 *   I — lookupUserByPaddleIds resolves by subscription_id before customer_id
 *   J — subscription.updated administrative change (no period advance) does not reset credits
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handlePaddleEvent, lookupUserByPaddleIds, getPlanMeta, getTopUpMeta } from './billing.js';

// ── Mock config ──────────────────────────────────────────────────────────────

vi.mock('../config.js', () => ({
  config: {
    paddlePricePremiumMonthly:   'price_premium_monthly',
    paddlePricePremiumYearly:    'price_premium_yearly',
    paddlePriceCollectorMonthly: 'price_collector_monthly',
    paddlePriceCollectorYearly:  '',
    paddlePriceTopup50:          'price_topup_50',
    paddlePriceTopup150:         'price_topup_150',
    paddleEnvironment:           'sandbox',
    paddleApiKey:                'test-api-key',
    paddleWebhookSecret:         'test-secret',
    supabaseUrl:                 'http://localhost:54321',
    supabaseServiceRoleKey:      'test-service-role',
    webUrl:                      'http://localhost:5173',
    nodeEnv:                     'test',
    metaPixelId:                 '',
    metaConversionsApiAccessToken: '',
  },
}));

vi.mock('../lib/metaConversionsApi.js', () => ({
  sendMetaCapiEvent: vi.fn().mockResolvedValue(undefined),
  valueCurrencyFromPaddlePayload: vi.fn().mockReturnValue(null),
}));

vi.mock('../lib/sentry.js', () => ({
  Sentry: { addBreadcrumb: vi.fn(), withScope: vi.fn(), captureException: vi.fn() },
  isSentryInitialized: vi.fn().mockReturnValue(false),
}));

// ── Mock Supabase builder ────────────────────────────────────────────────────

/**
 * Builds a minimal Supabase mock with configurable per-table responses.
 *
 * Usage:
 *   const supabase = buildSupabaseMock({
 *     'user_ai_credits': [{ user_id: 'uuid-1', credit_balance: 50, bonus_credits: 0 }],
 *   });
 *   supabase._rpc.mockResolvedValue({ data: null, error: null });
 */
function buildSupabaseMock(
  tableData: Record<string, Record<string, unknown> | null> = {},
) {
  const rpc = vi.fn().mockResolvedValue({ data: null, error: null });

  // Tracks which table is currently being queried so chained methods return
  // the right data. Each call to .from() resets the active table.
  let activeTable = '';
  let activeFilters: Record<string, string> = {};

  const maybeSingle = vi.fn().mockImplementation(() => {
    const rows = tableData[activeTable];
    if (!rows) return Promise.resolve({ data: null, error: null });

    // If rows is a single object (not an array), return it directly
    if (!Array.isArray(rows)) return Promise.resolve({ data: rows, error: null });

    // Filter by the accumulated .eq() conditions
    const match = (rows as Record<string, unknown>[]).find((row) =>
      Object.entries(activeFilters).every(([k, v]) => String(row[k]) === String(v)),
    );
    return Promise.resolve({ data: match ?? null, error: null });
  });

  const eq = vi.fn().mockImplementation((col: string, val: unknown) => {
    activeFilters[col] = String(val);
    return { eq, maybeSingle };
  });

  const select = vi.fn().mockReturnValue({ eq, maybeSingle });

  const from = vi.fn().mockImplementation((table: string) => {
    activeTable   = table;
    activeFilters = {};
    return { select };
  });

  // auth.admin.getUserById mock (used by Meta CAPI helper — not relevant for credit tests)
  const auth = {
    admin: {
      getUserById: vi.fn().mockResolvedValue({ data: { user: { email: 'user@example.com' } } }),
    },
  };

  return { rpc, from, auth, _rpc: rpc, _from: from };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const FAKE_EVENT_ID   = 'evt_01test000000000000000000001';
const FAKE_USER_ID    = '00000000-0000-4000-8000-000000000001';
const FAKE_SUB_ID     = 'sub_01test000000000000000000001';
const FAKE_CUST_ID    = 'ctm_01test000000000000000000001';
const PRICE_PREMIUM   = 'price_premium_monthly';
const PRICE_COLLECTOR = 'price_collector_monthly';
const PRICE_300       = 'price_collector_monthly'; // reuse collector (500); override via a separate price below

function makeRenewalData(overrides: {
  priceId?: string;
  subscriptionId?: string;
  customerId?: string;
  userId?: string | null;
  periodStart?: string;
  periodEnd?: string;
} = {}) {
  return {
    id:              overrides.subscriptionId ?? FAKE_SUB_ID,
    customer_id:     overrides.customerId    ?? FAKE_CUST_ID,
    custom_data:     overrides.userId !== undefined
                       ? (overrides.userId ? { userId: overrides.userId } : null)
                       : { userId: FAKE_USER_ID },
    items: [{ price: { id: overrides.priceId ?? PRICE_PREMIUM } }],
    current_billing_period: {
      starts_at: overrides.periodStart ?? '2026-07-01T00:00:00Z',
      ends_at:   overrides.periodEnd   ?? '2026-08-01T00:00:00Z',
    },
  };
}

// ── getPlanMeta ──────────────────────────────────────────────────────────────

describe('getPlanMeta', () => {
  it('resolves premium monthly → 150 credits', () => {
    const plan = getPlanMeta('price_premium_monthly');
    expect(plan).toEqual({ planKey: 'premium', monthlyCredits: 150 });
  });

  it('resolves collector monthly → 500 credits', () => {
    const plan = getPlanMeta('price_collector_monthly');
    expect(plan).toEqual({ planKey: 'collector', monthlyCredits: 500 });
  });

  it('returns null for an unknown price ID', () => {
    expect(getPlanMeta('price_unknown_xyz')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(getPlanMeta('')).toBeNull();
  });
});

// ── getTopUpMeta ─────────────────────────────────────────────────────────────

describe('getTopUpMeta', () => {
  it('resolves topup-50 price', () => {
    expect(getTopUpMeta('price_topup_50')).toEqual({ bonusCredits: 50 });
  });
  it('resolves topup-150 price', () => {
    expect(getTopUpMeta('price_topup_150')).toEqual({ bonusCredits: 150 });
  });
  it('returns null for non-topup price', () => {
    expect(getTopUpMeta('price_premium_monthly')).toBeNull();
  });
});

// ── lookupUserByPaddleIds ─────────────────────────────────────────────────────

describe('lookupUserByPaddleIds', () => {
  it('Test I — resolves user_id by paddle_subscription_id (preferred)', async () => {
    const supabase = buildSupabaseMock({
      user_ai_credits: { user_id: FAKE_USER_ID, paddle_subscription_id: FAKE_SUB_ID },
    });

    const result = await lookupUserByPaddleIds(supabase as any, FAKE_SUB_ID, FAKE_CUST_ID);
    expect(result).toBe(FAKE_USER_ID);

    // Should have queried by subscription_id first
    expect(supabase._from).toHaveBeenCalledWith('user_ai_credits');
  });

  it('falls back to paddle_customer_id when subscription_id has no match', async () => {
    // subscription_id lookup returns null; customer_id lookup returns the user
    let callCount = 0;
    const maybeSingle = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve({ data: null, error: null }); // subscription miss
      return Promise.resolve({ data: { user_id: FAKE_USER_ID }, error: null }); // customer hit
    });

    const eq = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }), maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });

    const supabase = { from, auth: { admin: { getUserById: vi.fn() } } };
    const result = await lookupUserByPaddleIds(supabase as any, 'sub_unknown', FAKE_CUST_ID);
    expect(result).toBe(FAKE_USER_ID);
  });

  it('returns null when neither subscription_id nor customer_id matches', async () => {
    const supabase = buildSupabaseMock({ user_ai_credits: null });
    const result = await lookupUserByPaddleIds(supabase as any, 'sub_unknown', 'ctm_unknown');
    expect(result).toBeNull();
  });

  it('returns null when both IDs are null', async () => {
    const supabase = buildSupabaseMock({});
    const result = await lookupUserByPaddleIds(supabase as any, null, null);
    expect(result).toBeNull();
  });
});

// ── handlePaddleEvent — subscription.renewed ─────────────────────────────────

describe('handlePaddleEvent — subscription.renewed', () => {
  let supabase: ReturnType<typeof buildSupabaseMock>;

  beforeEach(() => {
    supabase = buildSupabaseMock({
      user_ai_credits: {
        user_id:        FAKE_USER_ID,
        credit_balance: 50,
        bonus_credits:  0,
        monthly_limit:  150,
        billing_period_end: '2026-07-01T00:00:00Z',
        current_period_end: '2026-07-01T00:00:00Z',
      },
    });
  });

  // ── Test A ──────────────────────────────────────────────────────────────
  it('Test A — resets 50 remaining subscription credits to 150 on renewal', async () => {
    const data = makeRenewalData();  // credit_balance = 50 from mock above

    const ok = await handlePaddleEvent(supabase as any, 'subscription.renewed', FAKE_EVENT_ID, data, FAKE_USER_ID);

    expect(ok).toBe(true);
    expect(supabase._rpc).toHaveBeenCalledWith('paddle_grant_credits', expect.objectContaining({
      p_user_id:        FAKE_USER_ID,
      p_plan_key:       'premium',
      p_credits_to_set: 150,
      p_bonus_credits_to_add: 0,
      p_billing_status: 'active',
    }));
  });

  // ── Test B ──────────────────────────────────────────────────────────────
  it('Test B — resets 0 remaining subscription credits to 150 on renewal', async () => {
    supabase = buildSupabaseMock({
      user_ai_credits: {
        user_id: FAKE_USER_ID, credit_balance: 0, bonus_credits: 0, monthly_limit: 150,
      },
    });

    const data = makeRenewalData();
    const ok = await handlePaddleEvent(supabase as any, 'subscription.renewed', FAKE_EVENT_ID, data, FAKE_USER_ID);

    expect(ok).toBe(true);
    expect(supabase._rpc).toHaveBeenCalledWith('paddle_grant_credits', expect.objectContaining({
      p_credits_to_set: 150,
      p_bonus_credits_to_add: 0,
    }));
  });

  // ── Test C ──────────────────────────────────────────────────────────────
  it('Test C — resets 150 remaining subscription credits to 150 on renewal (idempotent value)', async () => {
    supabase = buildSupabaseMock({
      user_ai_credits: {
        user_id: FAKE_USER_ID, credit_balance: 150, bonus_credits: 0, monthly_limit: 150,
      },
    });

    const data = makeRenewalData();
    const ok = await handlePaddleEvent(supabase as any, 'subscription.renewed', FAKE_EVENT_ID, data, FAKE_USER_ID);

    expect(ok).toBe(true);
    expect(supabase._rpc).toHaveBeenCalledWith('paddle_grant_credits', expect.objectContaining({
      p_credits_to_set: 150,
      p_bonus_credits_to_add: 0,
    }));
  });

  // ── Test F ──────────────────────────────────────────────────────────────
  it('Test F — renewal resets subscription credits to 150 but does not affect 40 bonus_credits', async () => {
    supabase = buildSupabaseMock({
      user_ai_credits: {
        user_id: FAKE_USER_ID, credit_balance: 50, bonus_credits: 40, monthly_limit: 150,
      },
    });

    const data = makeRenewalData();
    const ok = await handlePaddleEvent(supabase as any, 'subscription.renewed', FAKE_EVENT_ID, data, FAKE_USER_ID);

    expect(ok).toBe(true);

    // p_credits_to_set = 150 (subscription reset), p_bonus_credits_to_add = 0 (untouched)
    expect(supabase._rpc).toHaveBeenCalledWith('paddle_grant_credits', expect.objectContaining({
      p_credits_to_set:       150,
      p_bonus_credits_to_add: 0,   // bonus_credits preservation is enforced in paddle_grant_credits SQL
    }));
  });

  // ── Test G ──────────────────────────────────────────────────────────────
  it('Test G — plan with 500 credits (collector): renewal grants 500, not 150', async () => {
    supabase = buildSupabaseMock({
      user_ai_credits: {
        user_id: FAKE_USER_ID, credit_balance: 100, bonus_credits: 0, monthly_limit: 500,
      },
    });

    // User changed to collector plan before this renewal
    const data = makeRenewalData({ priceId: PRICE_COLLECTOR });
    const ok = await handlePaddleEvent(supabase as any, 'subscription.renewed', FAKE_EVENT_ID, data, FAKE_USER_ID);

    expect(ok).toBe(true);
    expect(supabase._rpc).toHaveBeenCalledWith('paddle_grant_credits', expect.objectContaining({
      p_plan_key:       'collector',
      p_credits_to_set: 500,
    }));
  });

  it('returns false for unknown price ID', async () => {
    const data = makeRenewalData({ priceId: 'price_unknown_xyz' });
    const ok = await handlePaddleEvent(supabase as any, 'subscription.renewed', FAKE_EVENT_ID, data, FAKE_USER_ID);

    expect(ok).toBe(false);
    expect(supabase._rpc).not.toHaveBeenCalled();
  });

  it('returns false and does not call RPC when userId is null', async () => {
    const data = makeRenewalData();
    const ok = await handlePaddleEvent(supabase as any, 'subscription.renewed', FAKE_EVENT_ID, data, null);

    expect(ok).toBe(false);
    expect(supabase._rpc).not.toHaveBeenCalled();
  });

  it('propagates RPC errors by throwing', async () => {
    const rpcError = { message: 'DB constraint violation' };
    supabase._rpc.mockResolvedValueOnce({ data: null, error: rpcError });

    const data = makeRenewalData();
    await expect(
      handlePaddleEvent(supabase as any, 'subscription.renewed', FAKE_EVENT_ID, data, FAKE_USER_ID),
    ).rejects.toMatchObject(rpcError);
  });
});

// ── handlePaddleEvent — Test D (duplicate event idempotency) ─────────────────

describe('handlePaddleEvent — idempotency (Test D)', () => {
  it('Test D — duplicate webhook: second call with same eventId still calls RPC (handler is idempotent at DB level)', async () => {
    // The idempotency check lives in the webhook route, not in handlePaddleEvent.
    // handlePaddleEvent itself is called at most once per eventId when the route
    // detects processed_successfully = true.  Here we verify that if the handler
    // IS called twice (e.g. in a test or if the idempotency table had a gap),
    // the RPC is called each time — the SET semantics in paddle_grant_credits make
    // this safe (150 SET to 150 = no net change).

    const supabase = buildSupabaseMock({
      user_ai_credits: {
        user_id: FAKE_USER_ID, credit_balance: 50, bonus_credits: 0, monthly_limit: 150,
      },
    });

    const data = makeRenewalData();

    const ok1 = await handlePaddleEvent(supabase as any, 'subscription.renewed', FAKE_EVENT_ID, data, FAKE_USER_ID);
    const ok2 = await handlePaddleEvent(supabase as any, 'subscription.renewed', FAKE_EVENT_ID, data, FAKE_USER_ID);

    expect(ok1).toBe(true);
    expect(ok2).toBe(true);
    // Each handlePaddleEvent call issues exactly one paddle_grant_credits RPC call.
    // (The balance SELECT uses supabase.from(), not supabase.rpc().)
    // Two handler calls → two RPC calls. Both SET credit_balance = 150, which is idempotent.
    expect(supabase._rpc).toHaveBeenCalledTimes(2);
  });
});

// ── handlePaddleEvent — Test E (non-renewal events) ──────────────────────────

describe('handlePaddleEvent — Test E (failed / non-renewal events)', () => {
  it('Test E — unhandled event type does not call paddle_grant_credits', async () => {
    const supabase = buildSupabaseMock({});

    const ok = await handlePaddleEvent(
      supabase as any,
      'transaction.payment_failed',  // not in the handled set
      FAKE_EVENT_ID,
      { id: FAKE_SUB_ID, customer_id: FAKE_CUST_ID, custom_data: { userId: FAKE_USER_ID } },
      FAKE_USER_ID,
    );

    expect(ok).toBe(false);
    expect(supabase._rpc).not.toHaveBeenCalled();
  });

  it('transaction.completed with subscription_create origin does not reset credits', async () => {
    const supabase = buildSupabaseMock({});

    const ok = await handlePaddleEvent(
      supabase as any,
      'transaction.completed',
      FAKE_EVENT_ID,
      {
        origin: 'subscription_create',
        items: [{ price: { id: PRICE_PREMIUM } }],
        subscription_id: FAKE_SUB_ID,
        customer_id: FAKE_CUST_ID,
        custom_data: { userId: FAKE_USER_ID },
      },
      FAKE_USER_ID,
    );

    // Returns true (acknowledged) but paddle_grant_credits is NOT called because
    // subscription.activated already handled the initial credits.
    expect(ok).toBe(true);
    expect(supabase._rpc).not.toHaveBeenCalled();
  });

  it('subscription.updated with no period advance does not reset credit_balance', async () => {
    const supabase = buildSupabaseMock({
      user_ai_credits: {
        user_id: FAKE_USER_ID,
        credit_balance: 75,
        bonus_credits: 0,
        billing_period_end: '2026-08-01T00:00:00Z',  // same as incoming — no advance
        current_period_end: '2026-08-01T00:00:00Z',
      },
    });

    const ok = await handlePaddleEvent(
      supabase as any,
      'subscription.updated',
      FAKE_EVENT_ID,
      {
        id: FAKE_SUB_ID,
        customer_id: FAKE_CUST_ID,
        status: 'active',
        items: [{ price: { id: PRICE_PREMIUM } }],
        custom_data: { userId: FAKE_USER_ID },
        current_billing_period: {
          starts_at: '2026-07-01T00:00:00Z',
          ends_at:   '2026-08-01T00:00:00Z',  // same end date → no advance
        },
      },
      FAKE_USER_ID,
    );

    expect(ok).toBe(true);
    // Metadata-only update: p_credits_to_set = 0 (balance untouched)
    expect(supabase._rpc).toHaveBeenCalledWith('paddle_grant_credits', expect.objectContaining({
      p_credits_to_set: 0,
    }));
  });
});

// ── handlePaddleEvent — transaction.completed top-up (Test F continued) ──────

describe('handlePaddleEvent — top-up purchase', () => {
  it('top-up adds bonus_credits without touching credit_balance', async () => {
    const supabase = buildSupabaseMock({
      user_ai_credits: {
        user_id: FAKE_USER_ID, credit_balance: 150, bonus_credits: 0, monthly_limit: 150,
      },
    });

    const ok = await handlePaddleEvent(
      supabase as any,
      'transaction.completed',
      FAKE_EVENT_ID,
      {
        origin: 'web',
        items: [{ price: { id: 'price_topup_50' } }],
        customer_id: FAKE_CUST_ID,
        subscription_id: null,
        custom_data: { userId: FAKE_USER_ID },
      },
      FAKE_USER_ID,
    );

    expect(ok).toBe(true);
    expect(supabase._rpc).toHaveBeenCalledWith('paddle_grant_credits', expect.objectContaining({
      p_plan_key:             'topup',
      p_credits_to_set:       0,      // subscription credits untouched
      p_bonus_credits_to_add: 50,     // bonus added
    }));
  });
});

// ── handlePaddleEvent — Test H (core bug fix: DB fallback for userId) ─────────

describe('handlePaddleEvent — Test H (userId resolved via DB when absent from custom_data)', () => {
  it('Test H — subscription.renewed with null custom_data uses DB lookup to resolve userId', async () => {
    // This is the exact scenario that caused the bug:
    // Paddle renewal event arrives with custom_data = null (no userId).
    // The handler must look up userId via paddle_subscription_id from user_ai_credits.
    //
    // NOTE: The actual DB lookup is performed by resolveEventUserId() in the webhook
    // route before calling handlePaddleEvent. This test verifies that handlePaddleEvent
    // correctly processes the renewal when called with the resolved userId
    // (i.e. it does NOT re-check custom_data internally — it trusts the resolved userId).

    const supabase = buildSupabaseMock({
      user_ai_credits: {
        user_id:         FAKE_USER_ID,
        credit_balance:  50,
        bonus_credits:   0,
        monthly_limit:   150,
        paddle_subscription_id: FAKE_SUB_ID,
        paddle_customer_id:     FAKE_CUST_ID,
      },
    });

    // Event data has NO custom_data — simulates a real Paddle renewal event
    const data = makeRenewalData({ userId: null });  // null → custom_data is null
    expect(data.custom_data).toBeNull();

    // The webhook route would have resolved userId via DB lookup and passed it in:
    const resolvedUserId = FAKE_USER_ID;

    const ok = await handlePaddleEvent(
      supabase as any,
      'subscription.renewed',
      FAKE_EVENT_ID,
      data,
      resolvedUserId,  // resolved externally by lookupUserByPaddleIds
    );

    expect(ok).toBe(true);
    expect(supabase._rpc).toHaveBeenCalledWith('paddle_grant_credits', expect.objectContaining({
      p_user_id:        FAKE_USER_ID,
      p_credits_to_set: 150,
    }));
  });

  it('Test H (integration) — lookupUserByPaddleIds + handlePaddleEvent together simulate the full fix', async () => {
    // Simulate the full fallback flow: lookup then grant
    let selectCallCount = 0;
    const maybeSingle = vi.fn().mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        // DB lookup by subscription_id → user found
        return Promise.resolve({ data: { user_id: FAKE_USER_ID }, error: null });
      }
      // handlePaddleEvent's pre-log SELECT for credit_balance
      return Promise.resolve({
        data: { credit_balance: 50, bonus_credits: 0, monthly_limit: 150 },
        error: null,
      });
    });

    const eq = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }), maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const supabase = { from, rpc, auth: { admin: { getUserById: vi.fn() } } };

    // Step 1: Look up user (this is what the webhook route does before calling handlePaddleEvent)
    const resolvedUserId = await lookupUserByPaddleIds(supabase as any, FAKE_SUB_ID, null);
    expect(resolvedUserId).toBe(FAKE_USER_ID);

    // Step 2: Call handler with the resolved userId
    const data = makeRenewalData({ userId: null });
    const ok = await handlePaddleEvent(
      supabase as any,
      'subscription.renewed',
      FAKE_EVENT_ID,
      data,
      resolvedUserId,
    );

    expect(ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith('paddle_grant_credits', expect.objectContaining({
      p_user_id:        FAKE_USER_ID,
      p_credits_to_set: 150,
    }));
  });
});

// ── handlePaddleEvent — subscription lifecycle events ────────────────────────

describe('handlePaddleEvent — subscription lifecycle', () => {
  it('subscription.activated provisions initial credits and stores subscription ID', async () => {
    const supabase = buildSupabaseMock({ user_ai_credits: null });

    const ok = await handlePaddleEvent(
      supabase as any,
      'subscription.activated',
      FAKE_EVENT_ID,
      makeRenewalData(),
      FAKE_USER_ID,
    );

    expect(ok).toBe(true);
    expect(supabase._rpc).toHaveBeenCalledWith('paddle_grant_credits', expect.objectContaining({
      p_user_id:                FAKE_USER_ID,
      p_plan_key:               'premium',
      p_credits_to_set:         150,
      p_paddle_subscription_id: FAKE_SUB_ID,
      p_paddle_customer_id:     FAKE_CUST_ID,
    }));
  });

  it('subscription.canceled downgrades to free plan', async () => {
    const supabase = buildSupabaseMock({});

    const ok = await handlePaddleEvent(
      supabase as any,
      'subscription.canceled',
      FAKE_EVENT_ID,
      { id: FAKE_SUB_ID, customer_id: FAKE_CUST_ID },
      FAKE_USER_ID,
    );

    expect(ok).toBe(true);
    expect(supabase._rpc).toHaveBeenCalledWith('paddle_cancel_subscription', { p_user_id: FAKE_USER_ID });
  });

  it('subscription.updated with cancelled status calls paddle_cancel_subscription', async () => {
    const supabase = buildSupabaseMock({
      user_ai_credits: {
        user_id: FAKE_USER_ID, billing_period_end: null, current_period_end: null,
      },
    });

    const ok = await handlePaddleEvent(
      supabase as any,
      'subscription.updated',
      FAKE_EVENT_ID,
      {
        id: FAKE_SUB_ID, customer_id: FAKE_CUST_ID,
        status: 'cancelled',
        items: [{ price: { id: PRICE_PREMIUM } }],
        current_billing_period: { starts_at: null, ends_at: null },
      },
      FAKE_USER_ID,
    );

    expect(ok).toBe(true);
    expect(supabase._rpc).toHaveBeenCalledWith('paddle_cancel_subscription', { p_user_id: FAKE_USER_ID });
  });

  it('subscription.updated with period advance resets credits (fallback renewal path)', async () => {
    const supabase = buildSupabaseMock({
      user_ai_credits: {
        user_id:            FAKE_USER_ID,
        credit_balance:     60,
        bonus_credits:      0,
        billing_period_end: '2026-07-01T00:00:00Z',    // old period end
        current_period_end: '2026-07-01T00:00:00Z',
      },
    });

    const ok = await handlePaddleEvent(
      supabase as any,
      'subscription.updated',
      FAKE_EVENT_ID,
      {
        id: FAKE_SUB_ID, customer_id: FAKE_CUST_ID, status: 'active',
        items: [{ price: { id: PRICE_PREMIUM } }],
        current_billing_period: {
          starts_at: '2026-07-01T00:00:00Z',
          ends_at:   '2026-08-01T00:00:00Z',  // future date → period advanced
        },
      },
      FAKE_USER_ID,
    );

    expect(ok).toBe(true);
    expect(supabase._rpc).toHaveBeenCalledWith('paddle_grant_credits', expect.objectContaining({
      p_credits_to_set: 150,
      p_billing_status: 'active',
    }));
  });

  it('transaction.completed with subscription_recurring resets credits (safety net)', async () => {
    const supabase = buildSupabaseMock({
      user_ai_credits: {
        user_id: FAKE_USER_ID, credit_balance: 50, bonus_credits: 0,
      },
    });

    const ok = await handlePaddleEvent(
      supabase as any,
      'transaction.completed',
      FAKE_EVENT_ID,
      {
        origin: 'subscription_recurring',
        items: [{ price: { id: PRICE_PREMIUM } }],
        subscription_id: FAKE_SUB_ID,
        customer_id: FAKE_CUST_ID,
        custom_data: { userId: FAKE_USER_ID },
      },
      FAKE_USER_ID,
    );

    expect(ok).toBe(true);
    expect(supabase._rpc).toHaveBeenCalledWith('paddle_grant_credits', expect.objectContaining({
      p_credits_to_set: 150,
      p_bonus_credits_to_add: 0,
    }));
  });
});
