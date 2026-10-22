/**
 * Cellar readiness chip matching — aligned with Drink Window bucket counts,
 * which categorize solely by AI `readiness_label` (not legacy readiness_status).
 */

export type CellarReadinessChip = 'ready' | 'peakSoon' | 'aging' | 'pastPeak';

export type ReadinessLabel = 'HOLD' | 'PEAK_SOON' | 'READY' | string | null | undefined;

export interface ReadinessFilterable {
  readiness_status?: string | null;
  readiness_label?: ReadinessLabel;
}

/** True when the bottle matches a Drink-Window-aligned readiness chip. */
export function matchesReadinessChip(
  bottle: ReadinessFilterable,
  chip: CellarReadinessChip,
): boolean {
  const label = bottle.readiness_label ?? undefined;
  switch (chip) {
    case 'ready':
      return label === 'READY';
    case 'peakSoon':
      return label === 'PEAK_SOON';
    case 'aging':
      return label === 'HOLD';
    case 'pastPeak':
      return bottle.readiness_status === 'PastPeak';
    default:
      return false;
  }
}

/** Drink Window “wines analyzed” membership. */
export function hasDrinkWindowAnalysis(bottle: ReadinessFilterable): boolean {
  const label = bottle.readiness_label;
  return label === 'HOLD' || label === 'PEAK_SOON' || label === 'READY';
}
