/**
 * Feature Flags Service
 * 
 * Manages per-user feature flags stored in the profiles table.
 * Implements fail-closed approach: if fetch fails, all flags default to false.
 * 
 * Usage:
 * - Call fetchFeatureFlags() after authentication
 * - Store result in context/state
 * - Check flags before showing UI or allowing route access
 */

import { supabase } from '../lib/supabase';

export interface FeatureFlags {
  wishlistEnabled: boolean;
  cellarAgentEnabled: boolean;
  csvImportEnabled: boolean; // CSV Import feature (disabled by default for most users)
  // Add more feature flags here as needed in the future
}

export interface FeatureFlagsResult {
  flags: FeatureFlags | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Default flags (fail-closed: all features disabled by default)
 */
export const DEFAULT_FLAGS: FeatureFlags = {
  wishlistEnabled: false,
  cellarAgentEnabled: false,
  csvImportEnabled: false, // CSV Import disabled by default
};

/**
 * Fetch feature flags for the current authenticated user
 * 
 * @returns FeatureFlags object or null if fetch fails
 * @throws Error if user is not authenticated
 */
export async function fetchFeatureFlags(): Promise<FeatureFlags> {
  try {
    console.log('[FeatureFlags] Fetching feature flags...');
    
    // Check authentication
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('[FeatureFlags] Session error:', sessionError);
      throw new Error('Failed to get session');
    }
    
    if (!session) {
      console.warn('[FeatureFlags] No active session - returning default flags');
      return DEFAULT_FLAGS;
    }
    
    // Fetch user's profile with feature flags
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('wishlist_enabled, cellar_agent_enabled, csv_import_enabled')
      .eq('id', session.user.id)
      .single();
    
    if (profileError) {
      console.error('[FeatureFlags] Profile fetch error:', profileError);
      // Fail closed: return default flags
      return DEFAULT_FLAGS;
    }
    
    if (!profile) {
      console.warn('[FeatureFlags] Profile not found - returning default flags');
      return DEFAULT_FLAGS;
    }
    
    const flags: FeatureFlags = {
      wishlistEnabled: profile.wishlist_enabled ?? false,
      cellarAgentEnabled: profile.cellar_agent_enabled ?? false,
      csvImportEnabled: profile.csv_import_enabled ?? false,
    };
    
    console.log('[FeatureFlags] ✅ Feature flags loaded:', flags);
    return flags;
    
  } catch (error: any) {
    console.error('[FeatureFlags] ❌ Unexpected error fetching feature flags:', error);
    // Fail closed: return default flags
    return DEFAULT_FLAGS;
  }
}

/**
 * Refresh feature flags for the current user
 * Useful after toggling flags in admin panel
 */
export async function refreshFeatureFlags(): Promise<FeatureFlags> {
  console.log('[FeatureFlags] Refreshing feature flags...');
  return fetchFeatureFlags();
}

/**
 * Check if a specific feature is enabled
 * Helper function for inline checks
 */
export function isFeatureEnabled(flags: FeatureFlags | null, feature: keyof FeatureFlags): boolean {
  if (!flags) return false;
  return flags[feature] === true;
}

