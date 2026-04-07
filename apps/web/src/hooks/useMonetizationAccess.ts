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
 * CACHING:
 *   Derived values are persisted in localStorage (keyed by user id) so the
 *   badge renders instantly on subsequent page loads — no async wait, no blink.
 *   The cache is invalidated on sign-out and silently refreshed in the background.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import {
  getEffectiveCreditBalance,
  isLowCreditBalance,
  creditBalanceLabel,
} from '../lib/creditPolicy';

// ── localStorage cache (stale-while-revalidate) ──────────────────────────────

const CACHE_PREFIX = 'wine_mon_v1_';

interface MonetizationCache {
  monetizationEnabled: boolean;
  creditEnforcementEnabled: boolean;
  effectiveBalance: number;
  isLowBalance: boolean;
  balanceLabel: string;
  monthlyLimit: number;
  planKey: string | null;
}

function cacheKey(userId: string) {
  return CACHE_PREFIX + userId;
}

function readCache(userId: string): MonetizationCache | null {
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    return raw ? (JSON.parse(raw) as MonetizationCache) : null;
  } catch {
    return null;
  }
}

function writeCache(userId: string, data: MonetizationCache): void {
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify(data));
  } catch {
    // localStorage may be unavailable (private mode, quota exceeded, etc.)
  }
}

function clearCache(userId: string): void {
  try {
    localStorage.removeItem(cacheKey(userId));
  } catch {}
}

// ── Hook ─────────────────────────────────────────────────────────────────────

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
  /** True only during the very first load when there is no cached data */
  creditsLoading: boolean;
  /**
   * True once the first successful Supabase fetch has completed.
   * Use this to gate UI that must reflect the live DB value (e.g. plan badges)
   * rather than a potentially stale localStorage cache.
   */
  isFreshFromDB: boolean;
  /** Trigger a manual refresh (e.g. after a payment) */
  refresh: () => void;
}

const EMPTY: MonetizationCache = {
  monetizationEnabled: false,
  creditEnforcementEnabled: false,
  effectiveBalance: 0,
  isLowBalance: false,
  balanceLabel: 'You have 0 Sommelier Credits left this month',
  monthlyLimit: 0,
  planKey: null,
};

export function useMonetizationAccess(): MonetizationAccess {
  // Resolved user id — set once on first successful auth fetch
  const resolvedUserId = useRef<string | null>(null);

  // Seed state directly from localStorage so the badge renders in the same
  // frame as the component mounts (stale-while-revalidate pattern).
  const [values, setValues] = useState<MonetizationCache>(EMPTY);

  // creditsLoading is only true when there is NO cached data to show —
  // background refreshes happen silently without flipping this flag.
  const [creditsLoading, setCreditsLoading] = useState(true);

  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const [isFreshFromDB, setIsFreshFromDB] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user || cancelled) {
          if (!cancelled) setCreditsLoading(false);
          return;
        }

        const userId = session.user.id;
        resolvedUserId.current = userId;

        // If we have a cached entry for this user, show it immediately and
        // skip the loading indicator — the fresh fetch runs in the background.
        const cached = readCache(userId);
        if (cached) {
          setValues(cached);
          setCreditsLoading(false);
        }

        // Fetch fresh data from Supabase (always runs, even when cache hit)
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

        if (cancelled) return;

        const monEnabled = ent?.monetization_enabled ?? false;
        const enfEnabled = ent?.credit_enforcement_enabled ?? false;
        const creditRow = cred ?? {
          credit_balance: 0,
          bonus_credits: 0,
          monthly_credit_limit: 0,
          plan_key: null,
        };

        const fresh: MonetizationCache = {
          monetizationEnabled: monEnabled,
          creditEnforcementEnabled: enfEnabled,
          effectiveBalance: getEffectiveCreditBalance(creditRow),
          isLowBalance: monEnabled ? isLowCreditBalance(creditRow) : false,
          balanceLabel: creditBalanceLabel(creditRow),
          monthlyLimit: creditRow.monthly_credit_limit ?? 0,
          planKey: creditRow.plan_key ?? null,
        };

        setValues(fresh);
        setCreditsLoading(false);
        setIsFreshFromDB(true);
        writeCache(userId, fresh);
      } catch (err) {
        console.warn('[useMonetizationAccess] fetch error (non-fatal):', err);
        if (!cancelled) setCreditsLoading(false);
      }
    }

    load();

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        // Clear stale cache so the next user on the same device starts fresh
        if (resolvedUserId.current) clearCache(resolvedUserId.current);
        resolvedUserId.current = null;
        setValues(EMPTY);
        setCreditsLoading(false);
        return;
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        load();
      }
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  return {
    ...values,
    creditsLoading,
    isFreshFromDB,
    refresh,
  };
}
