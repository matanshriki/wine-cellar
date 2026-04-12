/**
 * Feature Flags Context
 * 
 * Provides feature flags to the entire app via React Context.
 * Fetches flags on mount and after auth changes.
 * 
 * Features:
 * - Real-time updates via Supabase Realtime (no logout required)
 * - Toasts when flags change
 * - Auto-redirect when flags disable while on gated route
 * 
 * Usage:
 * ```tsx
 * const { flags, loading } = useFeatureFlags();
 * 
 * if (flags?.wishlistEnabled) {
 *   return <WishlistButton />;
 * }
 * ```
 */

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from '../lib/toast';
import * as featureFlagsService from '../services/featureFlagsService';
import type { FeatureFlags } from '../services/featureFlagsService';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface FeatureFlagsContextType {
  flags: FeatureFlags | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextType | undefined>(undefined);

export function FeatureFlagsProvider({ children }: { children: React.ReactNode }) {
  const [flags, setFlags] = useState<FeatureFlags | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const previousFlagsRef = useRef<FeatureFlags | null>(null);

  async function loadFlags(silent = false) {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const fetchedFlags = await featureFlagsService.fetchFeatureFlags();
      
      // Detect flag changes and show toasts
      if (previousFlagsRef.current && !silent) {
        detectFlagChanges(previousFlagsRef.current, fetchedFlags);
      }
      
      previousFlagsRef.current = fetchedFlags;
      setFlags(fetchedFlags);
    } catch (err: any) {
      console.error('[FeatureFlagsContext] Error loading flags:', err);
      setError(err);
      // Fail closed: set to default flags
      setFlags(featureFlagsService.DEFAULT_FLAGS);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function refetch() {
    await loadFlags();
  }

  // Detect flag changes and show toasts + handle redirects
  function detectFlagChanges(oldFlags: FeatureFlags, newFlags: FeatureFlags) {
    if (oldFlags.wishlistEnabled !== newFlags.wishlistEnabled) {
      if (newFlags.wishlistEnabled) {
        toast.success('New feature enabled: Wishlist ✅');
      } else {
        toast.warning('Wishlist feature disabled for your account');
        if (location.pathname === '/wishlist') navigate('/cellar', { replace: true });
      }
    }

    if (oldFlags.cellarAgentEnabled !== newFlags.cellarAgentEnabled) {
      if (newFlags.cellarAgentEnabled) {
        toast.success('New feature enabled: Sommi ✅');
      } else {
        toast.warning('Sommi feature disabled for your account');
        if (location.pathname === '/agent') navigate('/cellar', { replace: true });
      }
    }
  }

  // Load flags on mount
  useEffect(() => {
    loadFlags();
  }, []);

  // Reload flags when auth state changes
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        loadFlags();
      } else if (event === 'SIGNED_OUT') {
        setFlags(featureFlagsService.DEFAULT_FLAGS);
        setLoading(false);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Subscribe to real-time profile changes (Supabase Realtime)
  useEffect(() => {
    let channel: RealtimeChannel | null = null;

    async function setupRealtimeSubscription() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;

        channel = supabase
          .channel(`profile-changes-${session.user.id}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'profiles',
              filter: `id=eq.${session.user.id}`,
            },
            (payload) => {
              try {
                if (!payload?.new) return;
                const newRecord = payload.new as any;
                if (newRecord && 'wishlist_enabled' in newRecord) {
                  const updatedFlags: FeatureFlags = {
                    wishlistEnabled: newRecord.wishlist_enabled ?? false,
                    cellarAgentEnabled: newRecord.cellar_agent_enabled ?? false,
                    csvImportEnabled: newRecord.csv_import_enabled ?? false,
                  };
                  if (previousFlagsRef.current) detectFlagChanges(previousFlagsRef.current, updatedFlags);
                  previousFlagsRef.current = updatedFlags;
                  setFlags(updatedFlags);
                }
              } catch (err) {
                console.warn('[FeatureFlagsContext] Realtime callback error (ignored):', err);
              }
            }
          )
          .subscribe();

        channelRef.current = channel;
      } catch (error) {
        console.error('[FeatureFlagsContext] Failed to setup Realtime subscription:', error);
      }
    }

    setupRealtimeSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
        channelRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- intentionally stable; auth listener handles re-setup after login

  // Refetch flags on window focus (fallback for missed Realtime updates)
  useEffect(() => {
    function handleVisibilityChange() {
      if (!document.hidden) loadFlags(true);
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, []);

  return (
    <FeatureFlagsContext.Provider value={{ flags, loading, error, refetch }}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

/**
 * Hook to access feature flags
 * 
 * @throws Error if used outside of FeatureFlagsProvider
 */
export function useFeatureFlags(): FeatureFlagsContextType {
  const context = useContext(FeatureFlagsContext);
  
  if (context === undefined) {
    throw new Error('useFeatureFlags must be used within a FeatureFlagsProvider');
  }
  
  return context;
}

/**
 * Hook to check a specific feature flag
 * Returns false while loading (fail closed)
 */
export function useFeatureFlag(feature: keyof FeatureFlags): boolean {
  const { flags, loading } = useFeatureFlags();
  
  // While loading, return false (fail closed)
  if (loading) return false;
  
  return featureFlagsService.isFeatureEnabled(flags, feature);
}

