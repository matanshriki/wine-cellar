/**
 * Sommi credits — Credit Policy (Backend)
 *
 * Single source of truth for action credit costs.
 * Change costs here only — do not scatter magic numbers across routes.
 *
 * Mirror: apps/web/src/lib/creditPolicy.ts (kept in sync manually for now;
 * move to a shared package when the monorepo warrants it).
 */

// ── Action type registry ─────────────────────────────────────────────────────

export const AI_ACTION_TYPES = [
  'sommelier_chat_message',
  'wine_comparison',
  'food_pairing',
  'personalized_recommendation',
  'cellar_analysis',
  'invoice_scan',
  // Phase 2 — edge function paths
  'wine_bottle_analysis',
  'label_scan',
  'receipt_scan',
  'wine_profile_generation',
  'label_art_generation',
  'voice_transcription',
] as const;

export type AiActionType = (typeof AI_ACTION_TYPES)[number];

// ── Credit cost map ──────────────────────────────────────────────────────────

/**
 * Credits consumed per successful action.
 * Costs are deliberately conservative for the dark-launch phase.
 * Adjust here before enforcement is enabled for real users.
 */
export const ACTION_CREDIT_COSTS: Record<AiActionType, number> = {
  // Core sommelier chat (Express API)
  sommelier_chat_message:      1,
  wine_comparison:             2,
  food_pairing:                1,
  personalized_recommendation: 2,
  cellar_analysis:             10,
  invoice_scan:                8,
  // Phase 2 — edge function paths
  wine_bottle_analysis:        1,   // analyze-wine: single bottle AI notes
  label_scan:                  2,   // parse-label-image: single label vision scan
  receipt_scan:                8,   // parse-label-image: multi-bottle / receipt mode
  wine_profile_generation:     1,   // generate-wine-profile: taste vector generation
  label_art_generation:        5,   // generate-label-art: DALL-E 3 (expensive)
  voice_transcription:         0,   // transcribe: supporting feature, no charge
};

// ── Plan definitions (scaffold — not wired to Stripe yet) ────────────────────

export const PLAN_MONTHLY_CREDITS: Record<string, number> = {
  free:      15,
  premium:   150,
  collector: 500,
};

// ── Helper functions ─────────────────────────────────────────────────────────

/**
 * Returns the credit cost for a given action type.
 * Returns 0 for unknown action types (safe default — never blocks).
 */
export function getCreditsRequired(actionType: AiActionType | string): number {
  return ACTION_CREDIT_COSTS[actionType as AiActionType] ?? 0;
}

/**
 * Effective balance = credit_balance + bonus_credits.
 * Bonus credits are spent only after regular balance is exhausted.
 */
export function getEffectiveCreditBalance(row: {
  credit_balance: number;
  bonus_credits: number;
}): number {
  return row.credit_balance + row.bonus_credits;
}

/**
 * Returns true if the user has enough credits for the action.
 * Always returns true when enforcement is disabled.
 */
export function canUserAffordAction(
  row: { credit_balance: number; bonus_credits: number },
  actionType: AiActionType | string,
  enforcementEnabled: boolean,
): boolean {
  if (!enforcementEnabled) return true;
  const required = getCreditsRequired(actionType);
  return getEffectiveCreditBalance(row) >= required;
}

/**
 * Estimates USD cost based on token counts and model.
 * Pricing as of 2025 — update as OpenAI rates change.
 * Returns null if token data is unavailable.
 */
export function estimateCostUsd(
  modelName: string | null | undefined,
  inputTokens: number | null | undefined,
  outputTokens: number | null | undefined,
): number | null {
  if (!modelName || inputTokens == null || outputTokens == null) return null;

  // Per-million-token pricing (approximate)
  const pricing: Record<string, { input: number; output: number }> = {
    'gpt-4o':          { input: 2.5,  output: 10.0 },
    'gpt-4o-mini':     { input: 0.15, output: 0.6  },
    'gpt-4-turbo':     { input: 10.0, output: 30.0 },
    'gpt-3.5-turbo':   { input: 0.5,  output: 1.5  },
  };

  const key = Object.keys(pricing).find((k) => modelName.startsWith(k));
  if (!key) return null;

  const { input, output } = pricing[key];
  return (inputTokens / 1_000_000) * input + (outputTokens / 1_000_000) * output;
}
