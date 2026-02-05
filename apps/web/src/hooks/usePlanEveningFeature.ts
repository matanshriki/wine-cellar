/**
 * Plan Evening Feature Flag Hook
 * 
 * Checks if the current user has the "Plan an evening" feature enabled.
 * Returns loading state to prevent flickering.
 */

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function usePlanEveningFeature() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function checkFeature() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          if (mounted) {
            setIsEnabled(false);
            setIsLoading(false);
          }
          return;
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('plan_evening_enabled')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('[usePlanEveningFeature] Error fetching flag:', error);
          if (mounted) {
            setIsEnabled(false);
            setIsLoading(false);
          }
          return;
        }

        if (mounted) {
          setIsEnabled(data?.plan_evening_enabled || false);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('[usePlanEveningFeature] Unexpected error:', err);
        if (mounted) {
          setIsEnabled(false);
          setIsLoading(false);
        }
      }
    }

    checkFeature();

    return () => {
      mounted = false;
    };
  }, []);

  return { isEnabled, isLoading };
}
