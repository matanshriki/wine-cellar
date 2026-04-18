/** Mirror of apps/api valueCurrencyFromPaddlePayload for Edge runtime. */

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

  const rawTotal =
    (typeof detailsTotals?.total === 'number' ? detailsTotals.total : undefined) ??
    (typeof detailsTotals?.grand_total === 'number' ? detailsTotals.grand_total : undefined) ??
    (typeof topTotals?.total === 'number' ? topTotals.total : undefined) ??
    (typeof topTotals?.grand_total === 'number' ? topTotals.grand_total : undefined);

  if (rawTotal == null || typeof rawTotal !== 'number' || Number.isNaN(rawTotal)) {
    return null;
  }

  return { value: rawTotal, currency };
}
