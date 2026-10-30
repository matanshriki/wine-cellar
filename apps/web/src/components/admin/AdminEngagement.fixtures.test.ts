/**
 * Fixture-based UI contract checks (not end-to-end against a live DB).
 * Validates labels, coverage copy, and classification→display mapping used by AdminEngagement.
 */
import { describe, expect, it } from 'vitest';
import {
  classifyEngagement,
  ENGAGEMENT_DEFINITIONS,
  RISK_LABELS,
  SEGMENT_LABELS,
  type EngagementRisk,
  type EngagementSegment,
} from '../../lib/admin/engagementRules';

describe('AdminEngagement display fixtures', () => {
  it('has labels for every segment and risk', () => {
    (Object.keys(SEGMENT_LABELS) as EngagementSegment[]).forEach((k) => {
      expect(SEGMENT_LABELS[k].length).toBeGreaterThan(0);
    });
    (Object.keys(RISK_LABELS) as EngagementRisk[]).forEach((k) => {
      expect(RISK_LABELS[k].length).toBeGreaterThan(0);
    });
  });

  it('documents coverage and comparable windows for partial-data UI', () => {
    expect(ENGAGEMENT_DEFINITIONS.sourceCoverage).toMatch(/observed retained activity/i);
    expect(ENGAGEMENT_DEFINITIONS.comparableWindows).toMatch(/observed_retained_comparable/i);
    expect(ENGAGEMENT_DEFINITIONS.durableComparableMeaning).toMatch(/does NOT prove/i);
    expect(ENGAGEMENT_DEFINITIONS.activationMetric).toMatch(/Not a 14-day conversion/i);
    expect(ENGAGEMENT_DEFINITIONS.activated).toMatch(/Empty chats/i);
  });

  it('maps SQL-validated fixture classifications to UI labels', () => {
    const rows = [
      {
        email: 'new@user.com',
        snap: {
          accountAgeDays: 7, isActivated: true, daysSinceLastMeaningful: 6,
          activeDaysCurrent28: 1, activeDaysPrevious28: 0, actionsCurrent28: 1, lifetimeActiveDays: 1,
        },
        expectSeg: 'New',
        expectRisk: 'Insufficient history',
      },
      {
        email: 'dormant@user.com',
        snap: {
          accountAgeDays: 200, isActivated: true, daysSinceLastMeaningful: 90,
          activeDaysCurrent28: 0, activeDaysPrevious28: 0, actionsCurrent28: 0, lifetimeActiveDays: 5,
        },
        expectSeg: 'Dormant',
        expectRisk: 'Prolonged inactivity',
      },
      {
        email: 'atrisk@user.com',
        snap: {
          accountAgeDays: 200, isActivated: true, daysSinceLastMeaningful: 29,
          activeDaysCurrent28: 0, activeDaysPrevious28: 5, actionsCurrent28: 0, lifetimeActiveDays: 20,
        },
        expectSeg: 'Occasional engaged',
        expectRisk: 'At risk of disengagement',
      },
    ] as const;

    for (const row of rows) {
      const c = classifyEngagement(row.snap);
      expect(SEGMENT_LABELS[c.segment]).toBe(row.expectSeg);
      expect(RISK_LABELS[c.risk]).toBe(row.expectRisk);
    }
  });

  it('empty and partial states have explicit non-zero semantics copy', () => {
    // Empty windows must not read as healthy engagement in UI copy.
    expect(RISK_LABELS.insufficient_history).not.toMatch(/decline/i);
    expect(RISK_LABELS.prolonged_inactivity).not.toMatch(/No detected/i);
  });
});
