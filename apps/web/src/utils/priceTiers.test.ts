import { describe, it, expect } from 'vitest';
import {
  bottleMatchesMaxPriceUsd,
  formatPriceTierLabel,
  maxPriceUsdForRange,
  purchasePriceToUsd,
  PRICE_TIERS_USD,
} from './priceTiers';

describe('priceTiers', () => {
  it('preserves the long-standing USD caps (Any / 25 / 50 / 100 / 200)', () => {
    expect(PRICE_TIERS_USD).toEqual([0, 25, 50, 100, 200]);
    expect(maxPriceUsdForRange(0)).toBeUndefined();
    expect(maxPriceUsdForRange(1)).toBe(25);
    expect(maxPriceUsdForRange(2)).toBe(50);
    expect(maxPriceUsdForRange(3)).toBe(100);
    expect(maxPriceUsdForRange(4)).toBe(200); // highest tier is capped, not open-ended
  });

  it('formats band labels in the preferred display currency', () => {
    expect(formatPriceTierLabel(0, 'ILS', 'he', 'הכל')).toBe('הכל');
    // $25 → ₪80 at the static 3.2 rate (Intl may insert RTL marks / NBSPs)
    const ils = formatPriceTierLabel(1, 'ILS', 'he', 'הכל').replace(/[\u200f\u200e\u00a0\s]/g, '');
    expect(ils).toMatch(/80₪|₪80/);
    expect(formatPriceTierLabel(1, 'USD', 'en', 'Any')).toMatch(/\$25/);
  });

  it('converts bottle currency when it differs from preferred display currency', () => {
    // ILS 80 stored → 25 USD at 3.2 — matches $ tier boundary
    expect(purchasePriceToUsd(80, 'ILS')).toBe(25);
    expect(purchasePriceToUsd(80, 'NIS')).toBe(25);
    expect(purchasePriceToUsd(25, 'USD')).toBe(25);
  });

  it('defaults missing currency to USD; rejects unsupported codes (no silent ILS/USD guess)', () => {
    expect(purchasePriceToUsd(40, null)).toBe(40);
    expect(purchasePriceToUsd(40, undefined)).toBe(40);
    expect(purchasePriceToUsd(40, '')).toBe(40);
    expect(purchasePriceToUsd(40, 'usd')).toBe(40);
    // EUR / GBP / etc. have no conversion rate — exclude from USD tier matching
    expect(purchasePriceToUsd(40, 'EUR')).toBeNull();
    expect(purchasePriceToUsd(40, 'GBP')).toBeNull();
    expect(purchasePriceToUsd(100, 'CAD')).toBeNull();
  });

  it('never treats a non-USD code as ILS unless it is ILS/NIS', () => {
    expect(purchasePriceToUsd(80, 'ILS')).toBe(25);
    expect(purchasePriceToUsd(80, 'EUR')).toBeNull(); // not 80/3.2
  });

  it('treats unknown / non-positive purchase prices as null (not cheap)', () => {
    expect(purchasePriceToUsd(null, 'USD')).toBeNull();
    expect(purchasePriceToUsd(undefined, 'ILS')).toBeNull();
    expect(purchasePriceToUsd(0, 'USD')).toBeNull();
    expect(purchasePriceToUsd(-5, 'USD')).toBeNull();
    expect(purchasePriceToUsd(Number.NaN, 'USD')).toBeNull();
  });

  it('includes prices at tier boundaries and excludes above', () => {
    expect(bottleMatchesMaxPriceUsd(25, 'USD', 25)).toBe(true);
    expect(bottleMatchesMaxPriceUsd(25.01, 'USD', 25)).toBe(false);
    expect(bottleMatchesMaxPriceUsd(80, 'ILS', 25)).toBe(true); // 80/3.2 = 25
    expect(bottleMatchesMaxPriceUsd(81, 'ILS', 25)).toBe(false); // 25.3125 > 25
    expect(bottleMatchesMaxPriceUsd(200, 'USD', 200)).toBe(true);
    expect(bottleMatchesMaxPriceUsd(200.01, 'USD', 200)).toBe(false);
  });

  it('excludes unknown prices when a max is set; passes all when Any', () => {
    expect(bottleMatchesMaxPriceUsd(null, 'USD', 50)).toBe(false);
    expect(bottleMatchesMaxPriceUsd(undefined, 'ILS', 50)).toBe(false);
    expect(bottleMatchesMaxPriceUsd(0, 'USD', 50)).toBe(false);
    expect(bottleMatchesMaxPriceUsd(null, 'USD', undefined)).toBe(true);
    expect(bottleMatchesMaxPriceUsd(null, 'USD', 0)).toBe(true);
    expect(bottleMatchesMaxPriceUsd(999, 'USD', undefined)).toBe(true);
  });
});
