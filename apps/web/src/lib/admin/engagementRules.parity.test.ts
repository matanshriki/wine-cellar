/**
 * Kept as a thin re-export suite pointing at SQL-validated fixtures.
 * Full SQL execution: supabase/verification/engagement_local_tests.sql
 * against disposable Postgres (.local/pg-engagement on :54329).
 */
import { describe, expect, it } from 'vitest';
import { activityWindowMembershipMs, classifyEngagement } from './engagementRules';

const AS_OF = Date.parse('2026-10-30T12:00:00.000Z');

describe('SQL-aligned window + fixture parity', () => {
  it('half-open boundaries match SQL [T-28d,T) / [T-56d,T-28d)', () => {
    const day = 86_400_000;
    expect(activityWindowMembershipMs(AS_OF - 28 * day, AS_OF)).toBe('current_28');
    expect(activityWindowMembershipMs(AS_OF - 28 * day - 1, AS_OF)).toBe('previous_28');
  });

  it('matches engagement_local_tests.sql expectations for atrisk fixture shape', () => {
    const c = classifyEngagement({
      accountAgeDays: 200,
      isActivated: true,
      daysSinceLastMeaningful: 29,
      activeDaysCurrent28: 0,
      activeDaysPrevious28: 5,
      actionsCurrent28: 0,
      lifetimeActiveDays: 20,
    });
    expect(c.segment).toBe('occasional_engaged');
    expect(c.risk).toBe('at_risk_of_disengagement');
  });
});
