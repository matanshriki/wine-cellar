import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export interface AdminWineQuality {
  wine_id: string;
  user_id: string;
  user_email: string | null;
  producer: string;
  wine_name: string;
  vintage: number | null;
  country: string | null;
  region: string | null;
  color: string;
  has_image: boolean;
  has_food_pairing: boolean;
  has_wine_profile: boolean;
  has_grapes: boolean;
  has_drink_window: boolean;
  food_pairing_confidence: string | null;
  wine_profile_confidence: string | null;
  gap_count: number;
  created_at: string;
}

export function useAdminWineDataQuality(limit = 100, offset = 0) {
  return useQuery<AdminWineQuality[]>({
    queryKey: ['admin', 'wine-quality', limit, offset],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_get_wine_data_quality', {
        p_limit:  limit,
        p_offset: offset,
      });
      if (error) throw new Error(error.message);
      return (data ?? []) as AdminWineQuality[];
    },
    staleTime: 120_000,
    retry: 1,
  });
}
