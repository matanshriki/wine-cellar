/**
 * Sommi credits — Credit Policy (Frontend)
 *
 * Single source of truth for action credit costs — frontend copy.
 * Keep in sync with apps/api/src/config/creditPolicy.ts.
 *
 * Used by UI to show "this action costs X credits" before the user triggers it.
 * Credit deduction itself always happens server-side.
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

// ── Plan definitions (scaffold) ──────────────────────────────────────────────

export interface PlanDefinition {
  key: string;
  label: string;
  monthlyCredits: number;
  priceMonthly: number | null;
  /** Annual price in USD. null = no annual option (e.g. free tier). */
  priceYearly: number | null;
  features: string[];
  highlight?: boolean;
}

export const PLANS: PlanDefinition[] = [
  {
    key: 'free',
    label: 'Free',
    monthlyCredits: 15,
    priceMonthly: null,
    priceYearly: null,
    features: [
      '15 Sommi credits / month',
      'Basic cellar management',
      'Limited AI access',
    ],
  },
  {
    key: 'premium',
    label: 'Premium',
    monthlyCredits: 150,
    priceMonthly: 9,
    priceYearly: 90,   // $7.50/mo effective — save $18/yr (17% off)
    features: [
      '150 Sommi credits / month',
      'Full Sommi access',
      'Advanced recommendations',
      'Premium cellar insights',
    ],
    highlight: true,
  },
  {
    key: 'collector',
    label: 'Collector',
    monthlyCredits: 500,
    priceMonthly: 24,
    priceYearly: 240,  // $20/mo effective — save $48/yr (17% off)
    features: [
      '500 Sommi credits / month',
      'Advanced cellar analysis',
      'Bulk intelligence features',
    ],
  },
];

export interface TopUpOption {
  credits: number;
  price: number;
  label: string;
}

export const TOP_UP_OPTIONS: TopUpOption[] = [
  { credits: 50,  price: 4,  label: '50 Sommi credits' },
  { credits: 150, price: 10, label: '150 Sommi credits' },
];

// ── Helper functions ─────────────────────────────────────────────────────────

export function getCreditsRequired(actionType: AiActionType | string): number {
  return ACTION_CREDIT_COSTS[actionType as AiActionType] ?? 0;
}

export function getEffectiveCreditBalance(row: {
  credit_balance: number;
  bonus_credits: number;
}): number {
  return row.credit_balance + row.bonus_credits;
}

export function canUserAffordAction(
  row: { credit_balance: number; bonus_credits: number },
  actionType: AiActionType | string,
  enforcementEnabled: boolean,
): boolean {
  if (!enforcementEnabled) return true;
  return getEffectiveCreditBalance(row) >= getCreditsRequired(actionType);
}

/**
 * Returns true when the effective balance is low enough to show a warning.
 * Threshold: fewer than 5 credits remaining.
 */
export function isLowCreditBalance(row: {
  credit_balance: number;
  bonus_credits: number;
}): boolean {
  return getEffectiveCreditBalance(row) < 5;
}

/**
 * Human-readable label for credits remaining.
 * e.g. "You have 12 Sommi credits left this month"
 */
export function creditBalanceLabel(row: {
  credit_balance: number;
  bonus_credits: number;
}): string {
  const balance = getEffectiveCreditBalance(row);
  return `You have ${balance} Sommi credit${balance === 1 ? '' : 's'} left this month`;
}
