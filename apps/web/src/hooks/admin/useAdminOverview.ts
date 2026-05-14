import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export interface AdminOverviewMetrics {
  total_users: number;
  new_users_7d: number;
  total_bottles: number;
  bottles_added_7d: number;
  total_wines: number;
  users_with_bottles: number;
  users_with_zero_bottles: number;
  wines_missing_food_pairing: number;
  wines_missing_image: number;
  wines_missing_region: number;
  wines_missing_grapes: number;
  wines_low_confidence: number;
  bottles_not_analyzed: number;
  bottles_no_drink_window: number;
  ai_calls_7d: number;
  ai_failed_7d: number;
  ai_cost_7d_usd: number;
  ai_active_users_7d: number;
  /** Requires app_events data — 0 until trackEvent() instrumentation is active */
  events_7d: number;
  /** Requires app_events data — 0 until trackEvent() instrumentation is active */
  event_active_users_7d: number;
  /** Signup source breakdown, all time. Empty array for pre-feature deployments. */
  acquisition_by_source: { source: string; medium: string; users: number }[];
  /** Signup medium breakdown, all time. */
  acquisition_by_medium: { medium: string; users: number }[];
  /** New users in the last 7 days broken down by source. */
  new_users_by_source_7d: { source: string; users: number }[];
}

export function useAdminOverview() {
  return useQuery<AdminOverviewMetrics>({
    queryKey: ['admin', 'overview'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_overview_metrics');
      if (error) throw new Error(error.message);
      return data as AdminOverviewMetrics;
    },
    staleTime: 60_000,
    retry: 1,
  });
}
