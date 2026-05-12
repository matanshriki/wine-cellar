/** Mirror of apps/api valueCurrencyFromPaddlePayload for Edge runtime. */

/**
 * Paddle amounts are in minor units and arrive as strings (e.g. "1000" = $10.00).
 * Numeric values (used in tests/sandbox) are also accepted.
 */
function parseMinorUnits(v: unknown): number | undefined {
  if (typeof v === 'number' && !Number.isNaN(v)) return v / 100;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = parseInt(v, 10);
    if (!Number.isNaN(n)) return n / 100;
  }
  return undefined;
}

export function valueCurrencyFromPaddlePayload(
  data: Record<string, unknown> | null | undefined,
): { value: number; currency: string } | null {
  if (!data || typeof data !== 'object') return null;

  const d = data;
  const detailsTotals =
    d.details &&
    typeof d.details === 'object' &&
    (d.details as Record<string, unknown>).totals &&
    typeof (d.details as Record<string, unknown>).totals === 'object'
      ? ((d.details as Record<string, unknown>).totals as Record<string, unknown>)
      : null;

  const topTotals =
    d.totals && typeof d.totals === 'object' ? (d.totals as Record<string, unknown>) : null;

  const currency =
    (typeof d.currency_code === 'string' && d.currency_code) ||
    (typeof detailsTotals?.currency_code === 'string' && detailsTotals.currency_code) ||
    (typeof topTotals?.currency_code === 'string' && topTotals.currency_code) ||
    'USD';

  const value =
    parseMinorUnits(detailsTotals?.total) ??
    parseMinorUnits(detailsTotals?.grand_total) ??
    parseMinorUnits(topTotals?.total) ??
    parseMinorUnits(topTotals?.grand_total);

  if (value == null) return null;

  return { value, currency };
}
