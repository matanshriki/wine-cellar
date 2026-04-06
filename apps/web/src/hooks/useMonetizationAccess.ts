/**
 * useMonetizationAccess
 *
 * Feature-flag-aware hook for Sommelier Credits and monetization UI.
 *
 * ROLLOUT RULES:
 *   - monetization_enabled = false (default)  → caller gets all-false flags;
 *     no pricing UI, no credit counters, no upgrade CTAs should render.
 *   - monetization_enabled = true             → show credit balance and pricing entry.
 *   - credit_enforcement_enabled = true       → block actions when balance is 0.
 *
 * USAGE:
 *   const { monetizationEnabled, creditEnforcementEnabled, effectiveBalance,
 *           isLowBalance, creditsLoading } = useMonetizationAccess();
 *
 *   if (!monetizationEnabled) return null; // hide all monetization UI
 *
 * The hook is intentionally lightweight and does NOT subscribe to Realtime
 * (that can be added in Stage 3). It re-fetches on auth change via a key
 * derived from the user id.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  getEffectiveCreditBalance,
  isLowCreditBalance,
  creditBalanceLabel,
} from '../lib/creditPolicy';
import type { Database } from '../types/supabase';

type UserEntitlement = Database['public']['Tables']['user_entitlements']['Row'];
type UserAiCredits   = Database['public']['Tables']['user_ai_credits']['Row'];

export interface MonetizationAccess {
  /** Whether monetization UI should be shown to this user */
  monetizationEnabled: boolean;
  /** Whether the user is actually blocked when credits run out */
  creditEnforcementEnabled: boolean;
  /** Effective credit balance (credit_balance + bonus_credits) */
  effectiveBalance: number;
  /** True when balance < 5 — show low-credit warning */
  isLowBalance: boolean;
  /** Human-readable balance string for display */
  balanceLabel: string;
  /** Monthly credit limit from the user's plan */
  monthlyLimit: number;
  /** Plan key (e.g. 'free', 'premium', 'collector') */
  planKey: string | null;
  /** True while initial data is loading */
  creditsLoading: boolean;
  /** Trigger a manual refresh (e.g. after a payment) */
  refresh: () => void;
}

const DEFAULT_ACCESS: MonetizationAccess = {
  monetizationEnabled:       false,
  creditEnforcementEnabled:  false,
  effectiveBalance:          0,
  isLowBalance:              false,
  balanceLabel:              'You have 0 Sommelier Credits left this month',
  monthlyLimit:              0,
  planKey:                   null,
  creditsLoading:            true,
  refresh:                   () => {},
};

export function useMonetizationAccess(): MonetizationAccess {
  const [entitlement, setEntitlement] = useState<UserEntitlement | null>(null);
  const [credits, setCredits]         = useState<UserAiCredits | null>(null);
  const [loading, setLoading]         = useState(true);
  const [tick, setTick]               = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user || cancelled) {
          setEntitlement(null);
          setCredits(null);
          setLoading(false);
          return;
        }

        const userId = session.user.id;

        // Fetch both rows in parallel — missing rows are safe (default to null)
        const [{ data: ent }, { data: cred }] = await Promise.all([
          supabase
            .from('user_entitlements')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle(),
          supabase
            .from('user_ai_credits')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle(),
        ]);

        if (!cancelled) {
          setEntitlement(ent);
          setCredits(cred);
        }
      } catch (err) {
        console.warn('[useMonetizationAccess] fetch error (non-fatal):', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    // Re-fetch on auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'SIGNED_OUT') {
        load();
      }
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  // tick is intentionally included so `refresh()` re-triggers the fetch
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  // ── Derive values ────────────────────────────────────────────────────────

  const monetizationEnabled      = entitlement?.monetization_enabled       ?? false;
  const creditEnforcementEnabled = entitlement?.credit_enforcement_enabled ?? false;

  const creditRow = credits ?? {
    credit_balance: 0,
    bonus_credits:  0,
    monthly_credit_limit: 0,
    plan_key: null,
  };

  const effectiveBalance = getEffectiveCreditBalance(creditRow);
  const isLowBalance     = monetizationEnabled ? isLowCreditBalance(creditRow) : false;
  const balanceLabel     = creditBalanceLabel(creditRow);

  return {
    monetizationEnabled,
    creditEnforcementEnabled,
    effectiveBalance,
    isLowBalance,
    balanceLabel,
    monthlyLimit: creditRow.monthly_credit_limit ?? 0,
    planKey:      creditRow.plan_key ?? null,
    creditsLoading: loading,
    refresh,
  };
}
