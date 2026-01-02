/**
 * Profile Service
 * 
 * Data access layer for user profiles.
 */

import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';

type Profile = Database['public']['Tables']['profiles']['Row'];
type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

/**
 * Get the current user's profile
 */
export async function getMyProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    // Profile might not exist yet (race condition with trigger)
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching profile:', error);
    throw new Error('Failed to fetch profile');
  }

  return data;
}

/**
 * Create or update the current user's profile
 */
export async function upsertMyProfile(updates: Partial<ProfileUpdate>): Promise<Profile> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      id: user.id,
      ...updates,
    } as any)
    .select()
    .single();

  if (error) {
    console.error('Error upserting profile:', error);
    throw new Error('Failed to update profile');
  }

  return data;
}

/**
 * Update the current user's profile
 */
export async function updateMyProfile(updates: ProfileUpdate): Promise<Profile> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('Not authenticated');
  }

  // @ts-ignore - Supabase type inference issue
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating profile:', error);
    throw new Error('Failed to update profile');
  }

  return data;
}

/**
 * Get or create a profile for the current user
 * Returns the profile and a boolean indicating if it's complete (has display_name)
 */
export async function getOrCreateProfile(): Promise<{ profile: Profile; isComplete: boolean }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('Not authenticated');
    }

    // Try to get existing profile
    let profile = await getMyProfile();

    // If no profile exists, try to create one (trigger should have done this, but handle race condition)
    if (!profile) {
      console.log('[ProfileService] Creating new profile for user:', user.id);
      console.log('[ProfileService] User metadata:', user.user_metadata);
      
      // Extract first_name from Google OAuth
      const firstName = 
        user.user_metadata?.given_name ||      // Google OAuth
        user.user_metadata?.first_name ||      // Other providers
        user.user_metadata?.full_name?.split(' ')[0] ||  // Parse from full name
        user.user_metadata?.name?.split(' ')[0] ||       // Parse from name
        null;
      
      // Extract last_name from Google OAuth
      const lastName = 
        user.user_metadata?.family_name ||     // Google OAuth
        user.user_metadata?.last_name ||       // Other providers
        user.user_metadata?.full_name?.split(' ').slice(1).join(' ') ||  // Parse from full name
        user.user_metadata?.name?.split(' ').slice(1).join(' ') ||       // Parse from name
        null;
      
      // Display name defaults to first_name, or full name, or email username
      const displayName = 
        firstName ||
        user.user_metadata?.display_name ||
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split('@')[0] ||
        'User';

      console.log('[ProfileService] Extracted names:', { firstName, lastName, displayName });

      const newProfile: ProfileInsert = {
        id: user.id,
        display_name: displayName,
        first_name: firstName,
        last_name: lastName,
        email: user.email || null,
        avatar_url: user.user_metadata?.avatar_url || null,
        preferred_language: 'en',
      };

      const { data, error } = await supabase
        .from('profiles')
        .insert(newProfile as any)
        .select()
        .single();

      if (error) {
        console.error('Error creating profile:', error);
        
        // If the columns don't exist yet, return a mock profile
        if (error.code === '42703' || error.message.includes('column')) {
          console.warn('Profile table schema not updated yet - using mock profile');
          return {
            profile: {
              id: user.id,
              display_name: displayName,
              email: user.email || null,
              avatar_url: null,
              preferred_language: 'en',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            } as Profile,
            isComplete: true,
          };
        }
        
        throw new Error('Failed to create profile');
      }
      profile = data;
    } else if (!profile.first_name || !profile.last_name) {
      // Profile exists but is missing first_name or last_name - try to populate from user metadata
      console.log('[ProfileService] Profile exists but missing names, attempting to populate...');
      console.log('[ProfileService] User metadata:', user.user_metadata);
      
      const firstName = 
        user.user_metadata?.given_name ||
        user.user_metadata?.first_name ||
        user.user_metadata?.full_name?.split(' ')[0] ||
        user.user_metadata?.name?.split(' ')[0] ||
        null;
      
      const lastName = 
        user.user_metadata?.family_name ||
        user.user_metadata?.last_name ||
        user.user_metadata?.full_name?.split(' ').slice(1).join(' ') ||
        user.user_metadata?.name?.split(' ').slice(1).join(' ') ||
        null;
      
      // Only update if we have new data and the fields are currently empty
      if ((firstName && !profile.first_name) || (lastName && !profile.last_name)) {
        console.log('[ProfileService] Updating profile with names:', { firstName, lastName });
        
        const updates: Partial<ProfileUpdate> = {};
        if (firstName && !profile.first_name) updates.first_name = firstName;
        if (lastName && !profile.last_name) updates.last_name = lastName;
        
        // If display_name is empty or "User" (default fallback), set it to first_name
        const isDefaultDisplayName = !profile.display_name || 
                                      profile.display_name.toLowerCase() === 'user';
        if (isDefaultDisplayName && firstName) {
          updates.display_name = firstName;
          console.log('[ProfileService] Updating display_name from default to first_name:', firstName);
        }
        
        // @ts-ignore - Supabase type inference issue
        const { data: updated, error: updateError } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', user.id)
          .select()
          .single();
        
        if (!updateError && updated) {
          profile = updated;
        } else {
          console.warn('[ProfileService] Failed to update profile names:', updateError);
        }
      }
    }
    
    // One-time backward compatibility fix: Update existing users with display_name="User"
    // This handles users who were created before the first_name/last_name fields existed
    if (profile && profile.display_name?.toLowerCase() === 'user' && profile.first_name) {
      console.log('[ProfileService] Backward compat: Updating display_name from "User" to first_name');
      
      // @ts-ignore - Supabase type inference issue
      const { data: updated, error: updateError } = await supabase
        .from('profiles')
        .update({ display_name: profile.first_name })
        .eq('id', user.id)
        .select()
        .single();
      
      if (!updateError && updated) {
        profile = updated;
      } else {
        console.warn('[ProfileService] Failed to update display_name:', updateError);
      }
    }

    // Check if profile is complete (has a non-empty display_name)
    const isComplete = !!profile.display_name && profile.display_name.trim().length > 0;

    return { profile, isComplete };
  } catch (error) {
    console.error('Error in getOrCreateProfile:', error);
    throw error;
  }
}

/**
 * Check if the current user's profile is complete
 */
export async function isProfileComplete(): Promise<boolean> {
  const profile = await getMyProfile();
  return !!profile?.display_name && profile.display_name.trim().length > 0;
}

/**
 * Complete the user's profile by setting a display name
 */
export async function completeProfile(displayName: string): Promise<Profile> {
  if (!displayName || displayName.trim().length === 0) {
    throw new Error('Display name is required');
  }

  return updateMyProfile({ display_name: displayName.trim() });
}

/**
 * Update the user's preferred language
 */
export async function updatePreferredLanguage(language: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    console.warn('Cannot update language - user not authenticated');
    return;
  }

  const { error } = await supabase
    .from('profiles')
    .update({ preferred_language: language })
    .eq('id', user.id);

  if (error) {
    console.error('Error updating preferred language:', error);
    // Don't throw - fallback to localStorage only
  }
}

