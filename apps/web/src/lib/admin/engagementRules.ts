/**
 * Sommi admin engagement classification — deterministic heuristics.
 *
 * SQL RPCs in supabase/migrations/20261030_admin_engagement_dashboard.sql
 * must stay in sync with this module.
 *
 * Reporting timezone: UTC.
 * Fixed as-of timestamp T (timestamptz). Half-open windows (non-overlapping):
 *   current:  [T - 28 days, T)
 *   previous: [T - 56 days, T - 28 days)
 *
 * Metrics describe observed retained activity only. Account age ≥56d is
 * eligibility for two windows — not tracking completeness. Missing, deleted,
 * or unlogged activity must not be treated as confirmed inactivity.
 */

export const ENGAGEMENT_RULES = {
  reportingTimezone: 'UTC',
  onboardingDays: 14,
  windowDays: 28,
  comparableHistoryDays: 56,
  dormantDays: 60,
  powerMinActiveDays: 8,
  regularMinActiveDays: 3,
  atRiskPrevMinActiveDays: 3,
  atRiskCurrentMaxActiveDays: 1,
  atRiskMinDaysSinceLast: 14,
  decliningDropRatio: 0.5,
  decliningMinAbsoluteDrop: 2,
  minLifetimeActiveDaysForRisk: 3,
} as const;

export type EngagementSegment =
  | 'new'
  | 'not_activated'
  | 'occasional_engaged'
  | 'regular'
  | 'power_user'
  | 'dormant';

export type EngagementRisk =
  | 'no_detected_decline'
  | 'declining_engagement'
  | 'at_risk_of_disengagement'
  | 'insufficient_history'
  | 'prolonged_inactivity';

/**
 * Whether period-over-period risk may be scored from observed retained sources.
 * observed_retained_comparable ≠ complete instrumentation.
 */
export type ObservationCoverage =
  | 'observed_retained_comparable'
  | 'insufficient_account_age'
  | 'insufficient_lifetime_activity'
  | 'empty_comparison_windows'
  | 'incomplete_source_history';

export interface EngagementActivitySnapshot {
  accountAgeDays: number;
  isActivated: boolean;
  daysSinceLastMeaningful: number | null;
  activeDaysCurrent28: number;
  activeDaysPrevious28: number;
  actionsCurrent28: number;
  lifetimeActiveDays: number;
  /**
   * When false/incomplete, durable retained tables did not yield a trustworthy
   * period-over-period comparison (caller sets via resolveObservationCoverage).
   */
  observationCoverage?: ObservationCoverage;
  /** When false, chat message timestamps are incomplete — suppresses decline risk. */
  chatHistoryComplete?: boolean;
}

export interface EngagementClassification {
  segment: EngagementSegment;
  risk: EngagementRisk;
  segmentReason: string;
  riskReason: string;
  rulesApplied: string[];
  observationCoverage: ObservationCoverage;
}

export function isActivated(flags: {
  bottleCount: number;
  scanWineCount: number;
  deliveredRecommendationCount: number;
  meaningfulConversationCount: number;
  consumptionCount: number;
  bottleAddedEventCount?: number;
  /** Agent events with non-empty chosen_bottle_ids */
  agentDeliveredRecommendationCount?: number;
}): boolean {
  return (
    flags.bottleCount > 0 ||
    flags.scanWineCount > 0 ||
    flags.deliveredRecommendationCount > 0 ||
    (flags.agentDeliveredRecommendationCount ?? 0) > 0 ||
    flags.meaningfulConversationCount > 0 ||
    flags.consumptionCount > 0 ||
    (flags.bottleAddedEventCount ?? 0) > 0
  );
}

/** Half-open window membership for an activity instant vs fixed as-of T. */
export function activityWindowMembershipMs(
  activityMs: number,
  asOfMs: number,
): 'current_28' | 'previous_28' | 'older' | 'future' {
  const day = 86_400_000;
  if (activityMs >= asOfMs) return 'future';
  if (activityMs >= asOfMs - 28 * day) return 'current_28';
  if (activityMs >= asOfMs - 56 * day) return 'previous_28';
  return 'older';
}

export function resolveObservationCoverage(
  s: Pick<
    EngagementActivitySnapshot,
    | 'accountAgeDays'
    | 'lifetimeActiveDays'
    | 'activeDaysCurrent28'
    | 'activeDaysPrevious28'
    | 'chatHistoryComplete'
  >,
): ObservationCoverage {
  const r = ENGAGEMENT_RULES;
  if (s.accountAgeDays < r.comparableHistoryDays) return 'insufficient_account_age';
  if (s.lifetimeActiveDays < r.minLifetimeActiveDaysForRisk) {
    return 'insufficient_lifetime_activity';
  }
  if (s.activeDaysCurrent28 === 0 && s.activeDaysPrevious28 === 0) {
    return 'empty_comparison_windows';
  }
  if (s.chatHistoryComplete === false) return 'incomplete_source_history';
  return 'observed_retained_comparable';
}

export function classifySegment(s: EngagementActivitySnapshot): {
  segment: EngagementSegment;
  reason: string;
  rulesApplied: string[];
} {
  const r = ENGAGEMENT_RULES;
  const rules: string[] = [];

  if (s.accountAgeDays < r.onboardingDays) {
    rules.push(`account_age_days (${s.accountAgeDays}) < onboarding_days (${r.onboardingDays})`);
    return {
      segment: 'new',
      reason: `Signed up ${s.accountAgeDays} day(s) ago; still within ${r.onboardingDays}-day onboarding window.`,
      rulesApplied: rules,
    };
  }

  if (!s.isActivated) {
    rules.push(`account_age_days >= ${r.onboardingDays} AND not activated (observed retained signals)`);
    return {
      segment: 'not_activated',
      reason: `Signed up ${s.accountAgeDays} days ago; no observed retained first-value (bottle, delivered run/agent recommendation, meaningful chat with content, consumption, or scan wine). Unlogged surfaces remain uncertain.`,
      rulesApplied: rules,
    };
  }

  if (
    s.daysSinceLastMeaningful !== null &&
    s.daysSinceLastMeaningful >= r.dormantDays
  ) {
    rules.push(`days_since_last_meaningful (${s.daysSinceLastMeaningful}) >= dormant_days (${r.dormantDays})`);
    return {
      segment: 'dormant',
      reason: `No observed retained meaningful activity for ${s.daysSinceLastMeaningful} days (threshold ${r.dormantDays}).`,
      rulesApplied: rules,
    };
  }

  if (s.activeDaysCurrent28 >= r.powerMinActiveDays) {
    rules.push(`active_days_28d (${s.activeDaysCurrent28}) >= ${r.powerMinActiveDays}`);
    return {
      segment: 'power_user',
      reason: `${s.activeDaysCurrent28} observed retained active day(s) in current window [T-28d, T) (power ≥${r.powerMinActiveDays}).`,
      rulesApplied: rules,
    };
  }

  if (s.activeDaysCurrent28 >= r.regularMinActiveDays) {
    rules.push(`active_days_28d (${s.activeDaysCurrent28}) >= ${r.regularMinActiveDays}`);
    return {
      segment: 'regular',
      reason: `${s.activeDaysCurrent28} observed retained active day(s) in current window [T-28d, T).`,
      rulesApplied: rules,
    };
  }

  rules.push('activated, not dormant, below regular/power thresholds');
  return {
    segment: 'occasional_engaged',
    reason:
      s.activeDaysCurrent28 > 0
        ? `${s.activeDaysCurrent28} observed retained active day(s) in current window (infrequent).`
        : `Activated; last observed retained activity ${s.daysSinceLastMeaningful ?? '—'} day(s) ago; below regular cadence.`,
    rulesApplied: rules,
  };
}

export function classifyRisk(s: EngagementActivitySnapshot): {
  risk: EngagementRisk;
  reason: string;
  rulesApplied: string[];
  observationCoverage: ObservationCoverage;
} {
  const r = ENGAGEMENT_RULES;
  const rules: string[] = [];
  const prev = s.activeDaysPrevious28;
  const curr = s.activeDaysCurrent28;
  const daysSince = s.daysSinceLastMeaningful;
  const coverage = s.observationCoverage ?? resolveObservationCoverage(s);

  if (
    daysSince !== null &&
    daysSince >= r.dormantDays &&
    curr === 0 &&
    prev === 0
  ) {
    rules.push('prolonged_inactivity from empty observed windows');
    return {
      risk: 'prolonged_inactivity',
      reason: `No observed retained meaningful activity for ${daysSince} days; both half-open 28d windows are empty — not scored as “no decline.”`,
      rulesApplied: rules,
      observationCoverage: 'empty_comparison_windows',
    };
  }

  if (coverage === 'insufficient_account_age') {
    rules.push(`observationCoverage=insufficient_account_age (age ${s.accountAgeDays} < 56)`);
    return {
      risk: 'insufficient_history',
      reason: `Account age ${s.accountAgeDays}d < 56d: previous window [T-56d, T-28d) is not fully observable for this account. Age alone is not tracking completeness; period-over-period risk is not scored.`,
      rulesApplied: rules,
      observationCoverage: coverage,
    };
  }

  if (coverage === 'insufficient_lifetime_activity') {
    rules.push('observationCoverage=insufficient_lifetime_activity');
    return {
      risk: 'insufficient_history',
      reason: `Only ${s.lifetimeActiveDays} observed retained lifetime active day(s); need ≥${r.minLifetimeActiveDaysForRisk} before scoring engagement risk.`,
      rulesApplied: rules,
      observationCoverage: coverage,
    };
  }

  if (coverage === 'empty_comparison_windows') {
    rules.push('observationCoverage=empty_comparison_windows');
    return {
      risk: 'insufficient_history',
      reason: `Both observed retained comparison windows are empty; zeros are not confirmed total inactivity (deletes/unlogged paths possible). No period-over-period risk scored.`,
      rulesApplied: rules,
      observationCoverage: coverage,
    };
  }

  if (coverage === 'incomplete_source_history') {
    rules.push('observationCoverage=incomplete_source_history');
    return {
      risk: 'insufficient_history',
      reason:
        'Chat/message timestamp history is incomplete; last_message_at is not used as daily history. Period-over-period decline conclusions are suppressed.',
      rulesApplied: rules,
      observationCoverage: coverage,
    };
  }

  // Period-over-period claims only when observed_retained_comparable.
  if (
    prev >= r.atRiskPrevMinActiveDays &&
    curr <= r.atRiskCurrentMaxActiveDays &&
    daysSince !== null &&
    daysSince >= r.atRiskMinDaysSinceLast
  ) {
    rules.push('at_risk with observed_retained_comparable coverage');
    return {
      risk: 'at_risk_of_disengagement',
      reason: `${curr} observed retained active day(s) in [T-28d, T), down from ${prev} in [T-56d, T-28d); ${daysSince} days since last observed activity.`,
      rulesApplied: rules,
      observationCoverage: coverage,
    };
  }

  if (
    prev >= 2 &&
    curr < prev * r.decliningDropRatio &&
    prev - curr >= r.decliningMinAbsoluteDrop
  ) {
    rules.push('declining with observed_retained_comparable coverage');
    return {
      risk: 'declining_engagement',
      reason: `${curr} observed retained active day(s) in [T-28d, T), down from ${prev} in [T-56d, T-28d).`,
      rulesApplied: rules,
      observationCoverage: coverage,
    };
  }

  rules.push('no_detected_decline with observed_retained_comparable coverage');
  return {
    risk: 'no_detected_decline',
    reason: `${curr} observed retained active day(s) in [T-28d, T) vs ${prev} in [T-56d, T-28d).`,
    rulesApplied: rules,
    observationCoverage: coverage,
  };
}

export function classifyEngagement(
  s: EngagementActivitySnapshot,
): EngagementClassification {
  const coverage = s.observationCoverage ?? resolveObservationCoverage(s);
  const snap = { ...s, observationCoverage: coverage };
  const seg = classifySegment(snap);
  const risk = classifyRisk(snap);
  return {
    segment: seg.segment,
    risk: risk.risk,
    segmentReason: seg.reason,
    riskReason: risk.reason,
    rulesApplied: [...seg.rulesApplied, ...risk.rulesApplied],
    observationCoverage: risk.observationCoverage,
  };
}

/** AI statuses counted as failures in engagement (matches SQL). */
export const AI_FAILURE_STATUSES = ['failed', 'error'] as const;

export function isAiFailureStatus(status: string | null | undefined): boolean {
  return status === 'failed' || status === 'error';
}

export const SEGMENT_LABELS: Record<EngagementSegment, string> = {
  new: 'New',
  not_activated: 'Not activated',
  occasional_engaged: 'Occasional engaged',
  regular: 'Regular',
  power_user: 'Power user',
  dormant: 'Dormant',
};

export const RISK_LABELS: Record<EngagementRisk, string> = {
  no_detected_decline: 'No detected decline',
  declining_engagement: 'Declining engagement',
  at_risk_of_disengagement: 'At risk of disengagement',
  insufficient_history: 'Insufficient history',
  prolonged_inactivity: 'Prolonged inactivity',
};

export const ENGAGEMENT_DEFINITIONS = {
  active:
    'Observed retained UTC activity in half-open window [T-28d, T): cellar, consumption, agent recommendation events with chosen bottles (plus any historical recommendation_runs), evening plan, meaningful Sommi chat days (per-message timestamps + non-empty user+assistant content), successful AI, reminder, wishlist. Login heartbeats do not drive cadence. last_message_at is never daily history.',
  activated:
    'Observed retained first value: bottle, scan wine, agent recommendation (non-empty chosen_bottle_ids) and/or historical delivered recommendation_run, meaningful chat with content, consumption, or bottle_added event. Empty chats / zero-result runs / role-only shells excluded.',
  activationDurability:
    'Survives bottle delete when wines/recs/chats/consumption/bottle_added remain. Pre-tracking hard deletes without retained signals cannot be reconstructed. Unlogged paths may under-count.',
  activationMetric:
    'Activation rate = lifetime observed activation among accounts aged ≥14 days. Not a 14-day conversion rate.',
  reportingTimezone: 'UTC',
  heuristicsNote:
    'Initial thresholds are heuristics for wine-app cadence — not validated churn predictions.',
  comparableWindows:
    'Period-over-period risk requires observed_retained_comparable: age ≥56d so both windows exist, non-empty retained comparison, and complete chat timestamp history where chats exist. Incomplete/deleted/unlogged history suppresses confident At risk / Declining / No decline.',
  sourceCoverage:
    'Metrics are observed retained activity for instrumented durable tables. app_events / last_active_at are tracking aids only. Missing rows are not confirmed inactivity.',
  durableComparableMeaning:
    'observed_retained_comparable means: (1) the account existed for the full previous window, (2) retained durable rows yield a non-empty comparison, and (3) chat cadence sources are timestamp-complete when present. It does NOT prove every surface was instrumented or that deletes were retained. When comparison is unreliable, risk stays insufficient_history or prolonged_inactivity.',
} as const;
