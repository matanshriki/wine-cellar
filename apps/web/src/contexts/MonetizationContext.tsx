/**
 * MonetizationContext
 *
 * Provides a single shared instance of monetization state to the entire app.
 * By using a context, calling `refresh()` from any component (e.g. PricingModal
 * after a purchase) immediately updates every consumer — including the nav bar
 * credit badge — without a full page reload.
 *
 * All components should call `useMonetizationAccess()` as before; the hook
 * now reads from this context instead of maintaining independent state.
 */

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import {
  getEffectiveCreditBalance,
  isLowCreditBalance,
  creditBalanceLabel,
} from '../lib/creditPolicy';
import type { MonetizationAccess } from '../hooks/useMonetizationAccess';

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

function cacheKey(userId: string) { return CACHE_PREFIX + userId; }

function readCache(userId: string): MonetizationCache | null {
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    return raw ? (JSON.parse(raw) as MonetizationCache) : null;
  } catch { return null; }
}

function writeCache(userId: string, data: MonetizationCache): void {
  try { localStorage.setItem(cacheKey(userId), JSON.stringify(data)); } catch {}
}

function clearCache(userId: string): void {
  try { localStorage.removeItem(cacheKey(userId)); } catch {}
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

// ── Context ───────────────────────────────────────────────────────────────────

const MonetizationContext = createContext<MonetizationAccess | null>(null);

export function MonetizationProvider({ children }: { children: ReactNode }) {
  const resolvedUserId = useRef<string | null>(null);
  const [values, setValues] = useState<MonetizationCache>(EMPTY);
  const [creditsLoading, setCreditsLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [isFreshFromDB, setIsFreshFromDB] = useState(false);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.user || cancelled) {
          if (!cancelled) setCreditsLoading(false);
          return;
        }

        const userId = session.user.id;
        resolvedUserId.current = userId;

        const cached = readCache(userId);
        if (cached) {
          setValues(cached);
          setCreditsLoading(false);
        }

        const [{ data: ent }, { data: cred }] = await Promise.all([
          supabase.from('user_entitlements').select('*').eq('user_id', userId).maybeSingle(),
          supabase.from('user_ai_credits').select('*').eq('user_id', userId).maybeSingle(),
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
        console.warn('[MonetizationContext] fetch error (non-fatal):', err);
        if (!cancelled) setCreditsLoading(false);
      }
    }

    load();

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        if (resolvedUserId.current) clearCache(resolvedUserId.current);
        resolvedUserId.current = null;
        setValues(EMPTY);
        setCreditsLoading(false);
        setIsFreshFromDB(false);
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

  return (
    <MonetizationContext.Provider value={{ ...values, creditsLoading, isFreshFromDB, refresh }}>
      {children}
    </MonetizationContext.Provider>
  );
}

export function useMonetizationContext(): MonetizationAccess {
  const ctx = useContext(MonetizationContext);
  if (!ctx) throw new Error('useMonetizationContext must be used inside <MonetizationProvider>');
  return ctx;
}
