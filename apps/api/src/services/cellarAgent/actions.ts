/**
 * Action interfaces (Phase 1 stubs).
 *
 * Future: open bottle, mark consumed, log feedback — callable by a true agent loop.
 * Phase 1 only declares contracts so orchestration can evolve without API breaks.
 */

export interface OpenBottleAction {
  type: 'open_bottle';
  bottleId: string;
  userId: string;
  occurredAt: string;
}

export interface UserFeedbackEvent {
  type: 'feedback';
  userId: string;
  bottleId?: string;
  rating?: number;
  sentiment?: 'positive' | 'negative' | 'neutral';
  commentLen?: number;
  createdAt: string;
}

/** Side-effect channel — implement with jobs/webhooks later. */
export interface CellarActionService {
  recordOpenBottle(event: OpenBottleAction): Promise<void>;
  recordFeedback(event: UserFeedbackEvent): Promise<void>;
}

export const nullCellarActionService: CellarActionService = {
  async recordOpenBottle() {
    /* no-op */
  },
  async recordFeedback() {
    /* no-op */
  },
};
