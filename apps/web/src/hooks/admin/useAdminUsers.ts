import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export interface AdminUser {
  user_id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
  last_active_at: string | null;
  is_admin: boolean;
  preferred_language: string | null;
  /** utm_source / referrer domain / "direct" at signup. null for pre-feature users. */
  signup_source: string | null;
  /** utm_medium / "ai" / "referral" / "organic" / "direct" at signup. */
  signup_medium: string | null;
  /** utm_campaign at signup, empty string when not set. */
  signup_campaign: string | null;
  bottle_count: number;
  wine_count: number;
  ai_calls_total: number;
  ai_calls_7d: number;
  /** 0 until app_events has data */
  events_total: number;
  /** 0 until app_events has data */
  events_7d: number;
  /** null until app_events has data */
  last_event_at: string | null;
}

export function useAdminUsers(limit = 50, offset = 0) {
  return useQuery<AdminUser[]>({
    queryKey: ['admin', 'users', limit, offset],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_get_users', {
        p_limit: limit,
        p_offset: offset,
      });
      if (error) throw new Error(error.message);
      return (data ?? []) as AdminUser[];
    },
    staleTime: 60_000,
    retry: 1,
  });
}
