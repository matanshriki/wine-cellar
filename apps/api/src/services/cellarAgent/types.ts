/**
 * Cellar Sommelier agent types (Phase 1).
 *
 * Central types keep the orchestration pipeline explicit: intent → constraints →
 * shortlist → LLM (explain/polish) → validation. Future phases can attach memory,
 * tool results, and action outcomes without rewriting the router.
 */

/** High-level intent for routing and observability (not exposed to clients). */
export type CellarIntent =
  | 'single_recommendation'
  | 'multi_recommendation'
  | 'browse_cellar'
  | 'pairing'
  | 'similar_cellar'
  | 'general';

/**
 * Bottle shape as sent from the client in `cellarContext.bottles`.
 * Kept permissive to match the existing API contract.
 */
export interface CellarBottleInput {
  id: string;
  producer?: string;
  wineName?: string;
  vintage?: number;
  region?: string;
  country?: string;
  grapes?: string | string[];
  color?: string;
  drinkWindowStart?: number;
  drinkWindowEnd?: number;
  readinessStatus?: string;
  notes?: string;
  quantity?: number;
}

/** Deterministic extraction output used for shortlisting and prompt context. */
export interface ExtractedConstraints {
  /** Parsed count for multi-bottle asks; null if not specified. */
  requestedCount: number | null;
  /** Normalized color filters (lowercase), e.g. ['red', 'white']. */
  colors: string[];
  regionHints: string[];
  grapeHints: string[];
  foodKeywords: string[];
  occasionKeywords: string[];
  wantsSparkling: boolean;
  wantsChampagne: boolean;
}

/** Compact bottle row sent to the LLM (token-safe). */
export interface CompactCellarBottle {
  id: string;
  producer: string;
  wineName: string;
  vintage?: number;
  region?: string;
  country?: string;
  grapes?: string | string[];
  color?: string;
  drinkWindowStart?: number;
  drinkWindowEnd?: number;
  readinessStatus?: string;
  notes?: string;
  quantity?: number;
}

export interface CellarContextBuildResult {
  bottles: CompactCellarBottle[];
  summary: string;
  totalBottles: number;
}

/** Result of deterministic candidate ranking before the LLM call. */
export interface ScoredCandidate {
  bottle: CellarBottleInput;
  score: number;
  features: string[];
}

/** Structured, production-safe observability (no raw user text). */
export interface OrchestrationLogPayload {
  intent: CellarIntent;
  constraintsSummary: string;
  clarificationNeeded: boolean;
  shortlistSize: number;
  topHeuristicScores: { bottleId: string; score: number }[];
  validationResult: 'ok' | 'partial' | 'failed' | 'skipped';
  fallbackUsed: boolean;
  /** Length only — avoids logging PII. */
  messageLen: number;
  historyLen: number;
}

export interface ReasoningContext {
  intent: CellarIntent;
  constraints: ExtractedConstraints;
  shortlistSummary: string;
  clarificationHint?: string;
}

/** OpenAI JSON response shapes (subset used for validation). */
export type RecommendationResponse =
  | SingleRecommendationResponse
  | BottleListResponse
  | ConversationalFallbackResponse;

export interface SingleRecommendationResponse {
  type?: 'single';
  message?: string;
  recommendation?: {
    bottleId: string;
    reason?: string;
    serveTemp?: string;
    decant?: string;
  };
  followUpQuestion?: string;
}

export interface BottleListBottle {
  bottleId: string;
  name?: string;
  producer?: string;
  vintage?: number | null;
  region?: string | null;
  rating?: number | null;
  readinessStatus?: string | null;
  serveTempC?: number | null;
  decantMinutes?: number | null;
  shortWhy?: string;
}

export interface BottleListResponse {
  type?: 'bottle_list';
  title?: string;
  message?: string;
  bottles: BottleListBottle[];
  followUpQuestion?: string;
}

export interface ConversationalFallbackResponse {
  type?: string;
  message?: string;
  followUpQuestion?: string;
  recommendation?: SingleRecommendationResponse['recommendation'];
  bottles?: BottleListBottle[];
  title?: string;
}
