/**
 * Memory port (Phase 1 interface).
 *
 * Phase 2 persists preferences in `sommelier_agent_memory` via `sommelierRepo.ts`
 * and loads them in `orchestrator.ts`. This file keeps the abstract port for tests.
 */

import type { CellarBottleInput } from './types.js';

/** Long-lived taste preferences (not yet persisted). */
export interface UserTasteProfile {
  userId: string;
  preferredColors?: string[];
  preferredRegions?: string[];
  avoidedRegions?: string[];
  bodyPreference?: 'light' | 'medium' | 'full';
  sweetnessTolerance?: 'dry' | 'off_dry' | 'sweet';
  updatedAt?: string;
}

export interface StyleSignal {
  style: string;
  sentiment: 'like' | 'dislike';
  source?: 'explicit' | 'inferred';
}

/** Past picks from this assistant (for diversity / “already suggested”). */
export interface RecommendationHistoryEntry {
  bottleId: string;
  suggestedAt: string;
  context?: string;
}

/**
 * Optional memory port — wire a real implementation in Phase 2+.
 * The orchestrator accepts this as an optional dependency so routes stay stable.
 */
export interface CellarMemoryService {
  getTasteProfile(userId: string): Promise<UserTasteProfile | null>;
  getRecentRecommendations(userId: string, limit: number): Promise<RecommendationHistoryEntry[]>;
  /** Reserved: e.g. boost bottles similar to past likes. */
  scoreMemoryBoost?(userId: string, bottle: CellarBottleInput): Promise<number>;
}

/** No-op stub until persistence exists. */
export const nullCellarMemoryService: CellarMemoryService = {
  async getTasteProfile() {
    return null;
  },
  async getRecentRecommendations() {
    return [];
  },
};
