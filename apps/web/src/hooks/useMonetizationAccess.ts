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
 * SHARED STATE:
 *   This hook reads from MonetizationContext, which is a single shared instance
 *   for the entire app. Calling `refresh()` from any component (e.g. after a
 *   Paddle checkout) immediately updates every consumer — including the nav bar
 *   credit badge — without a full page reload.
 */

import { useMonetizationContext } from '../contexts/MonetizationContext';

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
  /** Trigger a manual refresh (e.g. after a payment) — updates ALL consumers */
  refresh: () => void;
}

export function useMonetizationAccess(): MonetizationAccess {
  return useMonetizationContext();
}
