import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export interface AdminEvent {
  id: string;
  user_id: string | null;
  user_email: string | null;
  event_name: string;
  event_type: string | null;
  source: string | null;
  page: string | null;
  session_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export function useAdminEvents(
  limit = 100,
  offset = 0,
  eventNameFilter: string | null = null,
) {
  return useQuery<AdminEvent[]>({
    queryKey: ['admin', 'events', limit, offset, eventNameFilter],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_get_events', {
        p_limit:      limit,
        p_offset:     offset,
        p_event_name: eventNameFilter,
      });
      if (error) throw new Error(error.message);
      return (data ?? []) as AdminEvent[];
    },
    staleTime: 30_000,
    retry: 1,
  });
}
