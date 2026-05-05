import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export interface AdminAiCall {
  id: string;
  user_id: string;
  user_email: string | null;
  action_type: string;
  model_name: string | null;
  request_status: string;
  input_tokens: number | null;
  output_tokens: number | null;
  estimated_cost_usd: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AdminAiSummaryRow {
  action_type: string;
  model_name: string | null;
  total_calls: number;
  success_count: number;
  failure_count: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_usd: number;
  calls_7d: number;
  cost_7d_usd: number;
  failure_rate: number;
}

export function useAdminAiCalls(
  limit = 100,
  offset = 0,
  statusFilter: string | null = null,
) {
  return useQuery<AdminAiCall[]>({
    queryKey: ['admin', 'ai-calls', limit, offset, statusFilter],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_get_ai_calls', {
        p_limit:  limit,
        p_offset: offset,
        p_status: statusFilter,
      });
      if (error) throw new Error(error.message);
      return (data ?? []) as AdminAiCall[];
    },
    staleTime: 30_000,
    retry: 1,
  });
}

export function useAdminAiSummary() {
  return useQuery<AdminAiSummaryRow[]>({
    queryKey: ['admin', 'ai-summary'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_get_ai_summary');
      if (error) throw new Error(error.message);
      return (data ?? []) as AdminAiSummaryRow[];
    },
    staleTime: 60_000,
    retry: 1,
  });
}
