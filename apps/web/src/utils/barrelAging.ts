import type { BarrelAgingMetadata } from '../services/aiAnalysisService';

export interface BarrelAgingInput {
  barrel_aging_note?: string | null;
  barrel_aging_months_est?: number | null;
  barrel_aging_metadata?: BarrelAgingMetadata | null;
}

export interface BarrelAgingView {
  status: 'verified' | 'estimate';
  confidence: BarrelAgingMetadata['confidence'];
  /** A specific source (producer sheet, label…) or null when it is general wine knowledge. */
  source: string | null;
  note: string | null;
  /** Months to show as a separate line; null when unknown, zero, or already stated in the note. */
  months: number | null;
}

const GENERIC_SOURCES = new Set(['ai general knowledge', 'general knowledge', 'ai', '']);
/** Non-specific bases the AI prompt suggests ("regional style norm", "typical practice"…) — the UI's general-basis line already says this. */
const GENERIC_SOURCE_PATTERN = /\b(?:style|regional)\s+norms?\b|\btypical\b|\bgeneral\b/i;
const NOTE_STATES_MONTHS = /\d+\s*(?:[–-]\s*\d+\s*)?(?:months?|mos?\.?|חודש(?:ים)?)/i;

/**
 * Single source of truth for how barrel-aging data is labelled in the UI.
 *
 * Status meanings:
 * - verified → producer-confirmed fact (`is_estimated === false` and high confidence)
 * - estimate → regional/style-based (or weaker) guess; confidence reflects how
 *   typical the practice is, NOT bottle-specific verification.
 * Drink-window confidence is a separate field and must not be conflated with this.
 */
export function describeBarrelAging(input: BarrelAgingInput): BarrelAgingView | null {
  const note = input.barrel_aging_note?.trim() || null;
  const rawMonths = input.barrel_aging_months_est;
  const hasMonths = typeof rawMonths === 'number' && Number.isFinite(rawMonths);
  if (!note && !hasMonths) return null;

  const meta = input.barrel_aging_metadata ?? null;
  const confidence = meta?.confidence ?? 'medium';
  // Producer confirmation only — never promote a regional estimate to "verified".
  const verified = !!meta && meta.is_estimated === false && confidence === 'high';
  const rawSource = meta?.source?.trim() ?? '';
  const source = GENERIC_SOURCES.has(rawSource.toLowerCase()) || GENERIC_SOURCE_PATTERN.test(rawSource) ? null : rawSource;

  const months =
    hasMonths && (rawMonths as number) > 0 && !(note && NOTE_STATES_MONTHS.test(note))
      ? (rawMonths as number)
      : null;

  return { status: verified ? 'verified' : 'estimate', confidence, source, note, months };
}
