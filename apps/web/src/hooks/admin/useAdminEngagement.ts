import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { EngagementRisk, EngagementSegment } from '../../lib/admin/engagementRules';

export interface EngagementOverview {
  config: Record<string, unknown>;
  generated_at: string;
  reporting_timezone: string;
  exclusions: {
    rule: string;
    excluded_count: number;
    visible: boolean;
  };
  data_coverage: {
    historical_tables: string[];
    app_events_tracking_since: string | null;
    last_active_at_users_tracked: number;
    last_active_at_note: string;
    limitations: string[];
  };
  totals: {
    total_users: number;
    new_signups_7d: number;
    new_signups_28d: number;
    meaningfully_active_7d: number;
    meaningfully_active_28d: number;
    activation_denominator: number;
    activation_numerator: number;
    seg_new: number;
    seg_not_activated: number;
    seg_occasional: number;
    seg_regular: number;
    seg_power: number;
    seg_dormant: number;
    risk_none: number;
    risk_declining: number;
    risk_at_risk: number;
    risk_insufficient: number;
    risk_prolonged: number;
    adopted_bottles: number;
    adopted_scans: number;
    adopted_recommendations: number;
    adopted_sommelier: number;
    adopted_consumption: number;
    adopted_evening_plans: number;
    adopted_reminders: number;
    adopted_wishlist: number;
    adopted_ai: number;
    users_with_ai_failures_28d: number;
    users_with_scan_failures_28d: number;
  };
  activation_rate: number | null;
  activation_metric?: string;
  activation_window_days: number;
  activation_rate_note?: string;
  feature_adoption: Record<string, number>;
  error_signals_28d: {
    users_with_ai_failures: number;
    users_with_scan_failures: number;
    scan_failures_note: string;
    ai_failure_statuses?: string;
  };
}

export interface EngagementUserRow {
  user_id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
  last_active_at: string | null;
  is_admin: boolean;
  is_excluded: boolean;
  account_age_days: number;
  is_activated: boolean;
  first_value_at: string | null;
  last_meaningful_at: string | null;
  days_since_last_meaningful: number | null;
  active_days_7d: number;
  active_days_28d: number;
  active_days_prev_28d: number;
  lifetime_active_days: number;
  actions_28d: number;
  actions_prev_28d: number;
  bottle_count: number;
  scan_wine_count: number;
  recommendation_count: number;
  conversation_count: number;
  consumption_count: number;
  evening_plan_count: number;
  reminder_count: number;
  wishlist_count: number;
  ai_calls_total: number;
  ai_calls_28d: number;
  ai_failed_28d: number;
  scan_failed_28d: number;
  bottles_28d: number;
  scans_28d: number;
  recommendations_28d: number;
  conversations_touched_28d: number;
  consumptions_28d: number;
  segment: EngagementSegment;
  risk: EngagementRisk;
  segment_reason: string;
  risk_reason: string;
  activity_trend: 'up' | 'down' | 'flat';
}

export interface EngagementUsersResponse {
  total: number;
  limit: number;
  offset: number;
  reporting_timezone: string;
  users: EngagementUserRow[];
}

export interface EngagementUserFilters {
  search?: string;
  segment?: EngagementSegment | '';
  risk?: EngagementRisk | '';
  feature?: string;
  minAccountAgeDays?: number | null;
  maxAccountAgeDays?: number | null;
  activityWindow?: '' | '7d' | '28d' | 'none_28d' | 'any';
  sort?: string;
  sortDir?: 'asc' | 'desc';
  includeExcluded?: boolean;
}

export interface EngagementUserDetail {
  reporting_timezone: string;
  config: Record<string, unknown>;
  user: EngagementUserRow;
  classification: {
    segment: EngagementSegment;
    risk: EngagementRisk;
    segment_reason: string;
    risk_reason: string;
    observed_evidence: string[];
    possible_explanations: string[];
    unknown_causes: string[];
    data_sufficiency: string;
  };
  comparable_periods: {
    current_28d: Record<string, number>;
    previous_28d: Record<string, number>;
  };
  feature_breakdown: Record<string, number>;
  timeline: Array<{ at: string; kind: string; meta: Record<string, unknown> }>;
  technical_failures: {
    ai_failures_90d: Array<Record<string, unknown>>;
    scan_failures_90d: Array<Record<string, unknown>>;
    scan_failures_coverage: string;
  };
  suggested_actions: Array<{
    ord?: number;
    title: string;
    evidence: string;
    action: string;
  }>;
}

export function useAdminEngagementOverview() {
  return useQuery<EngagementOverview>({
    queryKey: ['admin', 'engagement', 'overview'],
    queryFn: async () => {
      // Cast: generated Database types lag new admin RPCs.
      const { data, error } = await (supabase as any).rpc('admin_engagement_overview');
      if (error) throw new Error(error.message);
      return data as EngagementOverview;
    },
    staleTime: 60_000,
    retry: 1,
  });
}

export function useAdminEngagementUsers(
  limit: number,
  offset: number,
  filters: EngagementUserFilters,
) {
  return useQuery<EngagementUsersResponse>({
    queryKey: ['admin', 'engagement', 'users', limit, offset, filters],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('admin_engagement_users', {
        p_limit: limit,
        p_offset: offset,
        p_search: filters.search || null,
        p_segment: filters.segment || null,
        p_risk: filters.risk || null,
        p_feature: filters.feature || null,
        p_min_account_age_days: filters.minAccountAgeDays ?? null,
        p_max_account_age_days: filters.maxAccountAgeDays ?? null,
        p_activity_window: filters.activityWindow || null,
        p_sort: filters.sort || 'last_meaningful_at',
        p_sort_dir: filters.sortDir || 'desc',
        p_include_excluded: filters.includeExcluded ?? false,
      });
      if (error) throw new Error(error.message);
      return data as EngagementUsersResponse;
    },
    staleTime: 30_000,
    retry: 1,
  });
}

export function useAdminEngagementUserDetail(userId: string | null) {
  return useQuery<EngagementUserDetail>({
    queryKey: ['admin', 'engagement', 'user', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('admin_engagement_user_detail', {
        p_user_id: userId,
      });
      if (error) throw new Error(error.message);
      return data as EngagementUserDetail;
    },
    staleTime: 30_000,
    retry: 1,
  });
}
