import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export interface AdminInsights {
  users_no_bottles: number;
  wines_missing_food_pairing: number;
  wines_missing_image: number;
  wines_missing_region_or_country: number;
  bottles_not_analyzed: number;
  bottles_no_drink_window: number;
  low_confidence_wines: number;
  ai_failure_rate_7d_pct: number;
  top_failing_ai_action: string | null;
  /** 0 until app_events has data */
  scan_starts_7d: number;
  /** 0 until app_events has data */
  scan_failures_7d: number;
  /** 0 until app_events has data */
  analysis_failures_7d: number;
  /** Empty array until app_events has data */
  top_events_7d: Array<{ event_name: string; count: number }>;
}

export function useAdminInsights() {
  return useQuery<AdminInsights>({
    queryKey: ['admin', 'insights'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_get_insights');
      if (error) throw new Error(error.message);
      return data as AdminInsights;
    },
    staleTime: 120_000,
    retry: 1,
  });
}
