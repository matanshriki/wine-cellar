/**
 * Feature Flags Hook
 * 
 * Checks user's feature flag permissions from the database.
 * Features are enabled in dev environment OR if user has the flag enabled in production.
 */

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { isDevEnvironment } from '../utils/devOnly';

interface FeatureFlags {
  canShareCellar: boolean;
  canMultiBottleImport: boolean;
  loading: boolean;
}

export function useFeatureFlags(): FeatureFlags {
  const [flags, setFlags] = useState<FeatureFlags>({
    canShareCellar: false,
    canMultiBottleImport: false,
    loading: true,
  });

  useEffect(() => {
    async function loadFeatureFlags() {
      // In dev environment, all features are enabled
      if (isDevEnvironment()) {
        setFlags({
          canShareCellar: true,
          canMultiBottleImport: true,
          loading: false,
        });
        return;
      }

      // In production, check database flags
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setFlags({
            canShareCellar: false,
            canMultiBottleImport: false,
            loading: false,
          });
          return;
        }

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('can_share_cellar, can_multi_bottle_import')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('[useFeatureFlags] Error loading feature flags:', error);
          setFlags({
            canShareCellar: false,
            canMultiBottleImport: false,
            loading: false,
          });
          return;
        }

        setFlags({
          canShareCellar: profile?.can_share_cellar ?? false,
          canMultiBottleImport: profile?.can_multi_bottle_import ?? false,
          loading: false,
        });
      } catch (error) {
        console.error('[useFeatureFlags] Error:', error);
        setFlags({
          canShareCellar: false,
          canMultiBottleImport: false,
          loading: false,
        });
      }
    }

    loadFeatureFlags();
  }, []);

  return flags;
}

