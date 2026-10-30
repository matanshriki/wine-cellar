import { describe, expect, it } from 'vitest';
import {
  activityWindowMembershipMs,
  classifyEngagement,
  classifyRisk,
  classifySegment,
  ENGAGEMENT_RULES,
  isActivated,
  isAiFailureStatus,
  resolveObservationCoverage,
  type EngagementActivitySnapshot,
} from './engagementRules';

function snap(partial: Partial<EngagementActivitySnapshot>): EngagementActivitySnapshot {
  return {
    accountAgeDays: 70,
    isActivated: true,
    daysSinceLastMeaningful: 3,
    activeDaysCurrent28: 4,
    activeDaysPrevious28: 4,
    actionsCurrent28: 6,
    lifetimeActiveDays: 10,
    ...partial,
  };
}

describe('isActivated', () => {
  it('rejects empty shells and zero-result recommendations', () => {
    expect(isActivated({
      bottleCount: 0, scanWineCount: 0, deliveredRecommendationCount: 0,
      meaningfulConversationCount: 0, consumptionCount: 0,
    })).toBe(false);
  });

  it('accepts durable and bottle_added durability signals', () => {
    expect(isActivated({
      bottleCount: 0, scanWineCount: 0, deliveredRecommendationCount: 0,
      meaningfulConversationCount: 0, consumptionCount: 0, bottleAddedEventCount: 1,
    })).toBe(true);
  });

  it('activates on agent-only delivered recommendations', () => {
    expect(isActivated({
      bottleCount: 0, scanWineCount: 0, deliveredRecommendationCount: 0,
      agentDeliveredRecommendationCount: 1,
      meaningfulConversationCount: 0, consumptionCount: 0,
    })).toBe(true);
  });
});

describe('half-open window boundaries', () => {
  const T = Date.parse('2026-10-30T12:00:00.000Z');
  const day = 86_400_000;

  it('places T-28d in current and T-28d-1ms in previous', () => {
    expect(activityWindowMembershipMs(T - 28 * day, T)).toBe('current_28');
    expect(activityWindowMembershipMs(T - 28 * day - 1, T)).toBe('previous_28');
    expect(activityWindowMembershipMs(T - 56 * day, T)).toBe('previous_28');
    expect(activityWindowMembershipMs(T - 56 * day - 1, T)).toBe('older');
    expect(activityWindowMembershipMs(T, T)).toBe('future');
  });
});

describe('observation coverage', () => {
  it('requires age ≥56 and non-empty windows for observed_retained_comparable', () => {
    expect(resolveObservationCoverage(snap({ accountAgeDays: 40 }))).toBe('insufficient_account_age');
    expect(resolveObservationCoverage(snap({
      accountAgeDays: 70, lifetimeActiveDays: 1,
    }))).toBe('insufficient_lifetime_activity');
    expect(resolveObservationCoverage(snap({
      activeDaysCurrent28: 0, activeDaysPrevious28: 0, lifetimeActiveDays: 5,
    }))).toBe('empty_comparison_windows');
    expect(resolveObservationCoverage(snap({ chatHistoryComplete: false }))).toBe('incomplete_source_history');
    expect(resolveObservationCoverage(snap({}))).toBe('observed_retained_comparable');
  });

  it('blocks At risk / No decline without observed_retained_comparable coverage', () => {
    const young = classifyRisk(snap({
      accountAgeDays: 40,
      activeDaysPrevious28: 5,
      activeDaysCurrent28: 0,
      daysSinceLastMeaningful: 20,
    }));
    expect(young.risk).toBe('insufficient_history');
    expect(young.observationCoverage).toBe('insufficient_account_age');
  });
});

describe('classifySegment', () => {
  it('marks onboarding as new', () => {
    expect(classifySegment(snap({ accountAgeDays: 5 })).segment).toBe('new');
  });

  it('labels not_activated with uncertainty note', () => {
    const r = classifySegment(snap({ accountAgeDays: 20, isActivated: false }));
    expect(r.segment).toBe('not_activated');
    expect(r.reason).toMatch(/uncertain/i);
  });

  it('classifies power only by active days', () => {
    expect(classifySegment(snap({ activeDaysCurrent28: 9 })).segment).toBe('power_user');
    expect(classifySegment(snap({ activeDaysCurrent28: 5, actionsCurrent28: 50 })).segment).toBe('regular');
  });
});

describe('classifyRisk', () => {
  it('uses prolonged_inactivity for dormant empty windows', () => {
    expect(classifyRisk(snap({
      daysSinceLastMeaningful: 90,
      activeDaysCurrent28: 0,
      activeDaysPrevious28: 0,
    })).risk).toBe('prolonged_inactivity');
  });

  it('suppresses decline risk when chat history incomplete', () => {
    const c = classifyRisk(snap({
      activeDaysPrevious28: 5,
      activeDaysCurrent28: 0,
      daysSinceLastMeaningful: 20,
      chatHistoryComplete: false,
    }));
    expect(c.risk).toBe('insufficient_history');
    expect(c.observationCoverage).toBe('incomplete_source_history');
  });

  it('flags at_risk only with observed_retained_comparable coverage', () => {
    expect(classifyRisk(snap({
      activeDaysPrevious28: 5,
      activeDaysCurrent28: 0,
      daysSinceLastMeaningful: 20,
    })).risk).toBe('at_risk_of_disengagement');
  });

  it('does not auto-flag occasional prior cadence as at risk', () => {
    expect(classifyRisk(snap({
      activeDaysPrevious28: 1,
      activeDaysCurrent28: 0,
      daysSinceLastMeaningful: 20,
    })).risk).toBe('no_detected_decline');
  });
});

describe('ENGAGEMENT_RULES contract', () => {
  it('keeps comparable history = 2 × window', () => {
    expect(ENGAGEMENT_RULES.comparableHistoryDays).toBe(ENGAGEMENT_RULES.windowDays * 2);
  });
});

describe('AI failure status classification', () => {
  it('counts only failed and error', () => {
    expect(isAiFailureStatus('failed')).toBe(true);
    expect(isAiFailureStatus('error')).toBe(true);
    expect(isAiFailureStatus('success')).toBe(false);
    expect(isAiFailureStatus('blocked_limit')).toBe(false);
    expect(isAiFailureStatus('pending')).toBe(false);
    expect(isAiFailureStatus(null)).toBe(false);
  });
});

describe('parity with SQL fixtures (as-of 2026-10-30T12:00Z)', () => {
  const cases: Array<{ id: string; snap: EngagementActivitySnapshot; seg: string; risk: string }> = [
    {
      id: 'new',
      snap: snap({ accountAgeDays: 7, isActivated: true, activeDaysCurrent28: 1, activeDaysPrevious28: 0, lifetimeActiveDays: 1, daysSinceLastMeaningful: 6 }),
      seg: 'new', risk: 'insufficient_history',
    },
    {
      id: 'dormant',
      snap: snap({ accountAgeDays: 200, daysSinceLastMeaningful: 90, activeDaysCurrent28: 0, activeDaysPrevious28: 0, lifetimeActiveDays: 5 }),
      seg: 'dormant', risk: 'prolonged_inactivity',
    },
    {
      id: 'power',
      snap: snap({ activeDaysCurrent28: 9, activeDaysPrevious28: 8, lifetimeActiveDays: 40 }),
      seg: 'power_user', risk: 'no_detected_decline',
    },
    {
      id: 'atrisk',
      snap: snap({ activeDaysCurrent28: 0, activeDaysPrevious28: 5, daysSinceLastMeaningful: 29, lifetimeActiveDays: 20 }),
      seg: 'occasional_engaged', risk: 'at_risk_of_disengagement',
    },
  ];

  for (const c of cases) {
    it(c.id, () => {
      const out = classifyEngagement(c.snap);
      expect(out.segment).toBe(c.seg);
      expect(out.risk).toBe(c.risk);
    });
  }
});
