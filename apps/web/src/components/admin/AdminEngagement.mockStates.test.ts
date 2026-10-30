/**
 * MOCKED UI state contracts — not live Supabase / not DOM browser automation.
 * Validates synthetic overview/users/detail payloads and that AdminEngagement.tsx
 * still contains the loading, error, empty-coverage, filter, and drawer copy
 * those payloads are meant to exercise.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type {
  EngagementOverview,
  EngagementUserDetail,
  EngagementUserRow,
  EngagementUsersResponse,
} from '../../hooks/admin/useAdminEngagement';
import {
  ENGAGEMENT_DEFINITIONS,
  RISK_LABELS,
  SEGMENT_LABELS,
} from '../../lib/admin/engagementRules';

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'AdminEngagement.tsx'),
  'utf8',
);

const ZERO_TOTALS: EngagementOverview['totals'] = {
  total_users: 0,
  new_signups_7d: 0,
  new_signups_28d: 0,
  meaningfully_active_7d: 0,
  meaningfully_active_28d: 0,
  activation_denominator: 0,
  activation_numerator: 0,
  seg_new: 0,
  seg_not_activated: 0,
  seg_occasional: 0,
  seg_regular: 0,
  seg_power: 0,
  seg_dormant: 0,
  risk_none: 0,
  risk_declining: 0,
  risk_at_risk: 0,
  risk_insufficient: 0,
  risk_prolonged: 0,
  adopted_bottles: 0,
  adopted_scans: 0,
  adopted_recommendations: 0,
  adopted_sommelier: 0,
  adopted_consumption: 0,
  adopted_evening_plans: 0,
  adopted_reminders: 0,
  adopted_wishlist: 0,
  adopted_ai: 0,
  users_with_ai_failures_28d: 0,
  users_with_scan_failures_28d: 0,
};

function emptyOverview(): EngagementOverview {
  return {
    config: {},
    generated_at: '2026-10-30T00:00:00Z',
    reporting_timezone: 'UTC',
    exclusions: { rule: 'Admins + test emails', excluded_count: 0, visible: true },
    data_coverage: {
      historical_tables: ['profiles', 'bottles'],
      app_events_tracking_since: null,
      last_active_at_users_tracked: 0,
      last_active_at_note:
        'last_active_at not yet written for any user — do not treat as zero activity',
      limitations: ['Page views are not counted'],
    },
    totals: { ...ZERO_TOTALS },
    activation_rate: null,
    activation_window_days: 14,
    feature_adoption: { bottles: 0 },
    error_signals_28d: {
      users_with_ai_failures: 0,
      users_with_scan_failures: 0,
      scan_failures_note: 'insufficient history — bottle_scan_failed not tracked yet',
    },
  };
}

function populatedOverview(): EngagementOverview {
  return {
    ...emptyOverview(),
    activation_rate: 62.5,
    totals: {
      ...ZERO_TOTALS,
      total_users: 10,
      meaningfully_active_28d: 4,
      activation_denominator: 8,
      activation_numerator: 5,
      seg_occasional: 3,
      risk_at_risk: 1,
      risk_insufficient: 2,
      risk_prolonged: 1,
      seg_dormant: 1,
    },
  };
}

function sampleUser(partial: Partial<EngagementUserRow> = {}): EngagementUserRow {
  return {
    user_id: '11111111-1111-4111-8111-111111111111',
    email: 'fixture@sommi.test',
    display_name: 'Fixture',
    created_at: '2026-01-01T00:00:00Z',
    last_active_at: null,
    is_admin: false,
    is_excluded: true,
    account_age_days: 200,
    is_activated: true,
    first_value_at: '2026-02-01T00:00:00Z',
    last_meaningful_at: '2026-09-01T00:00:00Z',
    days_since_last_meaningful: 59,
    active_days_7d: 0,
    active_days_28d: 0,
    active_days_prev_28d: 5,
    lifetime_active_days: 20,
    actions_28d: 0,
    actions_prev_28d: 5,
    bottle_count: 3,
    scan_wine_count: 0,
    recommendation_count: 0,
    conversation_count: 0,
    consumption_count: 0,
    evening_plan_count: 0,
    reminder_count: 0,
    wishlist_count: 0,
    ai_calls_total: 0,
    ai_calls_28d: 0,
    ai_failed_28d: 0,
    scan_failed_28d: 0,
    bottles_28d: 0,
    scans_28d: 0,
    recommendations_28d: 0,
    conversations_touched_28d: 0,
    consumptions_28d: 0,
    segment: 'occasional_engaged',
    risk: 'at_risk_of_disengagement',
    segment_reason: 'Activated; infrequent cadence.',
    risk_reason: 'Down from prior window.',
    activity_trend: 'down',
    ...partial,
  };
}

describe('AdminEngagement MOCKED state contracts (not live Supabase)', () => {
  it('empty overview payload is coherent for empty UI', () => {
    const o = emptyOverview();
    expect(o.totals.total_users).toBe(0);
    expect(o.activation_rate).toBeNull();
    expect(o.data_coverage.app_events_tracking_since).toBeNull();
    expect(o.data_coverage.last_active_at_note).toMatch(/do not treat as zero activity/i);
  });

  it('populated + partial risk payload maps to UI labels', () => {
    const o = populatedOverview();
    expect(o.totals.risk_insufficient).toBeGreaterThan(0);
    expect(o.totals.risk_prolonged).toBeGreaterThan(0);
    expect(RISK_LABELS.insufficient_history).toBe('Insufficient history');
    expect(RISK_LABELS.prolonged_inactivity).toBe('Prolonged inactivity');
    expect(SEGMENT_LABELS.dormant).toBe('Dormant');
  });

  it('users list empty vs populated shapes', () => {
    const empty: EngagementUsersResponse = {
      total: 0,
      limit: 25,
      offset: 0,
      reporting_timezone: 'UTC',
      users: [],
    };
    const populated: EngagementUsersResponse = {
      total: 1,
      limit: 25,
      offset: 0,
      reporting_timezone: 'UTC',
      users: [sampleUser()],
    };
    expect(empty.users).toHaveLength(0);
    expect(populated.users[0].risk).toBe('at_risk_of_disengagement');
    expect(RISK_LABELS[populated.users[0].risk]).toBe('At risk of disengagement');
  });

  it('detail drawer payload includes classification + coverage fields', () => {
    const u = sampleUser({ risk: 'insufficient_history', segment: 'new' });
    const detail: EngagementUserDetail = {
      reporting_timezone: 'UTC',
      config: {},
      user: u,
      classification: {
        segment: u.segment,
        risk: u.risk,
        segment_reason: u.segment_reason,
        risk_reason: u.risk_reason,
        observed_evidence: ['Account age: 7 days'],
        possible_explanations: ['Unknown — insufficient signals'],
        unknown_causes: ['Inactivity does not prove dissatisfaction'],
        data_sufficiency: 'insufficient',
      },
      comparable_periods: {
        current_28d: { active_days: 0, actions: 0 },
        previous_28d: { active_days: 0, actions: 0 },
      },
      feature_breakdown: { bottles_total: 0 },
      timeline: [],
      technical_failures: {
        ai_failures_90d: [],
        scan_failures_90d: [],
        scan_failures_coverage: 'No bottle_scan_failed events in range (may be insufficient tracking history)',
      },
      suggested_actions: [],
    };
    expect(detail.classification.data_sufficiency).toBe('insufficient');
    expect(detail.technical_failures.scan_failures_coverage).toMatch(/insufficient tracking/i);
  });

  it('component source wires loading, error, filters, coverage, drawer (MOCKED evidence)', () => {
    expect(src).toMatch(/Loading engagement/);
    expect(src).toMatch(/Failed to load engagement/);
    expect(src).toMatch(/Search users/);
    expect(src).toMatch(/Segment filter/);
    expect(src).toMatch(/Risk filter/);
    expect(src).toMatch(/Include excluded/);
    expect(src).toMatch(/Classification explanation/);
    expect(src).toContain('ENGAGEMENT_DEFINITIONS.durableComparableMeaning');
    expect(ENGAGEMENT_DEFINITIONS.durableComparableMeaning).toMatch(/does NOT prove/i);
  });
});
