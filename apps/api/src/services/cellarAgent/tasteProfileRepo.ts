/**
 * Load profiles.taste_profile for the authenticated user (RLS via user JWT client).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  parseStructuredTasteProfile,
  type StructuredTasteProfile,
} from './tasteProfileTypes.js';

export type TasteProfileLoadResult = {
  profile: StructuredTasteProfile | null;
  /** Whether a row was read successfully (profile may still be null if empty/unusable). */
  loaded: boolean;
  /** Safe reason code for logs — never includes profile contents. */
  reason?: 'ok' | 'no_supabase' | 'query_error' | 'empty' | 'parse_rejected';
};

/**
 * Load and validate the caller's taste profile.
 * Always filters by `userId` (must match JWT subject). Never accepts client-supplied profile JSON.
 */
export async function loadUserTasteProfile(
  userId: string,
  supabase: SupabaseClient
): Promise<TasteProfileLoadResult> {
  if (!userId) {
    return { profile: null, loaded: false, reason: 'query_error' };
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('taste_profile')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    return { profile: null, loaded: false, reason: 'query_error' };
  }

  const raw = data?.taste_profile ?? null;
  if (raw == null) {
    return { profile: null, loaded: true, reason: 'empty' };
  }

  const profile = parseStructuredTasteProfile(raw);
  if (!profile) {
    return { profile: null, loaded: true, reason: 'parse_rejected' };
  }

  return { profile, loaded: true, reason: 'ok' };
}
