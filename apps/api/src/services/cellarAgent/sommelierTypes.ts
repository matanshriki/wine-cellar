/**
 * Domain types for Phase 2 sommelier agent (memory, events, explainability).
 */

import type { CellarIntent } from './types.js';

/** Stored in sommelier_agent_memory.preferences JSONB */
export interface SommelierPreferenceMemory {
  version: number;
  preferredStyles?: string[];
  dislikedProfiles?: string[];
  favoriteGrapes?: string[];
  favoriteRegions?: string[];
  /** light | medium | full */
  bodyPreference?: string | null;
  /** special | casual | balanced */
  occasionPreference?: string | null;
}

export type RecommendationOutcome =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'opened'
  | 'feedback_positive'
  | 'feedback_negative'
  | 'feedback_neutral';

/** Explainability payload persisted on recommendation events */
export interface RecommendationExplanation {
  intent: CellarIntent;
  signals: {
    readiness?: string;
    pairingFit?: string;
    styleFit?: string;
    preferenceFit?: string;
    diversity?: string;
  };
  topScores: { bottleId: string; score: number }[];
}

export type AgentRoute =
  | 'recommend'
  | 'open_bottle'
  | 'memory_update'
  | 'similar'
  | 'tasting_draft'
  | 'feedback_inline'
  | 'buy_recommendation';

export interface ActionContext {
  lastRecommendationBottleId?: string;
  lastEventId?: string;
  anchorBottleId?: string;
}

/** Optional extension on API responses — clients may ignore */
export interface AgentResponseMeta {
  eventId?: string;
  routedAction?: AgentRoute;
  explanation?: RecommendationExplanation;
  /** When an action ran without a full recommendation payload */
  actionResult?: 'ok' | 'error';
  /**
   * How the reply was produced (observability — not for UI logic).
   * - deterministic_action: routed server action (open, memory, draft, …), no rec LLM
   * - orchestrated_shortlist: LLM on server-ranked shortlist + validation
   * - legacy_full_cellar: fallback LLM over full cellar (orchestrated path failed)
   */
  processingMode?: 'deterministic_action' | 'orchestrated_shortlist' | 'legacy_full_cellar';
}
