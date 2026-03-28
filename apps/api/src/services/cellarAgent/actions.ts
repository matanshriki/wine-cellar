/**
 * Action interfaces (Phase 1).
 *
 * Implementations live in `sommelierActions.ts` (mark opened, feedback, drafts).
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
