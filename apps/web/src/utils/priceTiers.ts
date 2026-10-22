/**
 * Tonight recommendation price bands.
 *
 * Canonical thresholds are USD maxima matching the long-standing filter:
 *   Any → no max
 *   $   → ≤ 25 USD
 *   $$  → ≤ 50 USD
 *   $$$ → ≤ 100 USD
 *   $$$$→ ≤ 200 USD
 *
 * UI labels convert those caps into the user's preferred currency for display.
 * Filtering always compares in USD after converting each bottle's stored price.
 * Bottles without a known purchase price or convertible currency are excluded
 * when a max is set (unknown ≠ cheap). Display preference never rewrites the
 * bottle's recorded purchase currency.
 */

import { convertCurrency, formatCurrency } from './currency';

/** Currencies with a known conversion path to USD for tier filtering. */
export const SUPPORTED_PURCHASE_CURRENCIES = ['USD', 'ILS'] as const;
export type SupportedPurchaseCurrency = (typeof SUPPORTED_PURCHASE_CURRENCIES)[number];

/** USD upper bounds by PriceRange index (0 = Any / no bound). */
export const PRICE_TIERS_USD = [0, 25, 50, 100, 200] as const;

export type PriceRangeIndex = 0 | 1 | 2 | 3 | 4;

export function maxPriceUsdForRange(range: PriceRangeIndex): number | undefined {
  if (range <= 0) return undefined;
  return PRICE_TIERS_USD[range];
}

/**
 * Normalize a stored purchase currency code.
 * - Missing / empty → USD (historical storage default when currency was omitted)
 * - NIS → ILS
 * - USD / ILS → as-is (case-insensitive)
 * - Anything else → null (no silent EUR→USD or non-USD→ILS assumption)
 */
export function normalizePurchaseCurrency(
  currency: string | null | undefined,
): SupportedPurchaseCurrency | null {
  if (currency === null || currency === undefined) return 'USD';
  const code = currency.trim().toUpperCase();
  if (!code) return 'USD';
  if (code === 'USD') return 'USD';
  if (code === 'ILS' || code === 'NIS') return 'ILS';
  return null;
}

/**
 * Compact band label in the user's preferred currency.
 * Tier buttons show the max only (e.g. "₪80" / "$25"); help copy explains "up to".
 */
export function formatPriceTierLabel(
  range: PriceRangeIndex,
  preferredCurrency: string,
  locale: string,
  anyLabel: string,
): string {
  if (range <= 0) return anyLabel;
  const usdCap = PRICE_TIERS_USD[range];
  const preferred = normalizePurchaseCurrency(preferredCurrency) ?? 'USD';
  const amount = convertCurrency(usdCap, 'USD', preferred);
  return formatCurrency(amount, locale, {
    currencyOverride: preferred,
    decimals: amount % 1 === 0 ? 0 : 2,
  });
}

/** Convert a bottle purchase price to USD for comparison with tier caps. */
export function purchasePriceToUsd(
  amount: number | null | undefined,
  currency: string | null | undefined,
): number | null {
  if (amount === null || amount === undefined || Number.isNaN(amount) || amount <= 0) {
    return null;
  }
  const source = normalizePurchaseCurrency(currency);
  // Unsupported / unconvertible currency → cannot compare to USD tiers.
  if (source === null) return null;
  return convertCurrency(amount, source, 'USD');
}

/**
 * Whether a bottle passes a max-price constraint (USD cap).
 * Unknown / non-positive prices and unsupported currencies fail when a max is set —
 * they are not treated as cheap.
 * When maxUsd is undefined/≤0, every bottle passes (no price filter).
 */
export function bottleMatchesMaxPriceUsd(
  purchasePrice: number | null | undefined,
  purchaseCurrency: string | null | undefined,
  maxUsd: number | null | undefined,
): boolean {
  if (maxUsd == null || maxUsd <= 0) return true;
  const usd = purchasePriceToUsd(purchasePrice, purchaseCurrency);
  return usd !== null && usd <= maxUsd;
}
