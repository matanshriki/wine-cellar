/**
 * Supabase Authentication Context
 * 
 * Manages user authentication state using Supabase Auth.
 * Replaces the previous AuthContext that used Express backend.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import * as profileService from '../services/profileService';
import type { Database } from '../types/supabase';
import { 
  markSessionActive, 
  shouldRecoverSession, 
  clearSessionMarkers, 
  isStandalone,
  setupSessionKeepAlive,
  checkSessionTimeout 
} from '../utils/sessionPersistence';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  profileComplete: boolean;
  loading: boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileComplete, setProfileComplete] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load profile when user changes (non-blocking)
  const loadProfile = async (currentUser: User | null) => {
    if (!currentUser) {
      setProfile(null);
      setProfileComplete(false);
      return;
    }

    try {
      // Add timeout to prevent infinite loading
      const profilePromise = profileService.getOrCreateProfile();
      const timeoutPromise = new Promise<null>((resolve) => 
        setTimeout(() => resolve(null), 5000)
      );

      const result = await Promise.race([profilePromise, timeoutPromise]);
      
      if (result) {
        setProfile(result.profile);
        setProfileComplete(result.isComplete);
        
        // Load user's preferred language from database
        if (result.profile.preferred_language) {
          const { changeLanguage } = await import('../i18n/config');
          // Don't save back to database (avoid infinite loop)
          await changeLanguage(result.profile.preferred_language as any, false);
          console.log('[Auth] Loaded preferred language from database:', result.profile.preferred_language);
        }
      } else {
        console.warn('Profile loading timed out');
        setProfile(null);
        setProfileComplete(false);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      // Don't block login on profile error - set defaults
      setProfile(null);
      setProfileComplete(false);
    }
  };

  useEffect(() => {
    let keepAliveCleanup: (() => void) | null = null;
    let timeoutCheckInterval: NodeJS.Timeout | null = null;

    // Function to check and enforce session timeouts
    const checkAndEnforceTimeout = async () => {
      const timeoutCheck = checkSessionTimeout();
      if (timeoutCheck.expired) {
        console.log('[Session] Auto-logout:', timeoutCheck.reason);
        // Force logout
        await supabase.auth.signOut();
        clearSessionMarkers();
        setUser(null);
        setSession(null);
        setProfile(null);
        setProfileComplete(false);
        
        // Show a toast or message to user (optional)
        // You could emit an event here if needed
      }
    };

    // Get initial session with recovery support
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false); // Set loading false BEFORE profile load
      
      if (session?.user) {
        // Check if session has timed out (client-side enforcement)
        const timeoutCheck = checkSessionTimeout();
        if (timeoutCheck.expired) {
          console.log('[Session] Session timeout detected on load:', timeoutCheck.reason);
          // Force logout immediately
          await supabase.auth.signOut();
          clearSessionMarkers();
          setUser(null);
          setSession(null);
          return;
        }
        
        // Mark session as active
        markSessionActive();
        
        // Load profile in background (non-blocking)
        loadProfile(session.user);

        // Setup session keep-alive for PWA mode
        if (isStandalone()) {
          console.log('Running in standalone mode - enabling session keep-alive');
          keepAliveCleanup = setupSessionKeepAlive(async () => {
            // Refresh the session
            const { data } = await supabase.auth.refreshSession();
            if (data.session) {
              setSession(data.session);
              setUser(data.session.user);
            }
          });
        }
        
        // Setup periodic timeout checks (every 60 seconds)
        timeoutCheckInterval = setInterval(checkAndEnforceTimeout, 60 * 1000);
        
      } else if (shouldRecoverSession()) {
        // Check if we're within timeout windows before attempting recovery
        const timeoutCheck = checkSessionTimeout();
        if (timeoutCheck.expired) {
          console.log('[Session] Cannot recover - session timeout:', timeoutCheck.reason);
          clearSessionMarkers();
          return;
        }
        
        // Attempt to recover session if there was recent activity
        console.log('Attempting session recovery...');
        supabase.auth.refreshSession().then(({ data, error }) => {
          if (error) {
            console.warn('Session recovery failed:', error);
            clearSessionMarkers();
          } else if (data.session) {
            console.log('Session recovered successfully');
            setSession(data.session);
            setUser(data.session.user);
            markSessionActive();
            if (data.session.user) {
              loadProfile(data.session.user);
            }
            // Setup timeout checks for recovered session
            timeoutCheckInterval = setInterval(checkAndEnforceTimeout, 60 * 1000);
          }
        });
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event);
      
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false); // Set loading false BEFORE profile load
      
      if (session?.user) {
        // Mark session as active on any auth change
        markSessionActive();
        
        // Load profile in background (non-blocking)
        loadProfile(session.user);

        // Setup keep-alive if not already active
        if (isStandalone() && !keepAliveCleanup) {
          keepAliveCleanup = setupSessionKeepAlive(async () => {
            const { data } = await supabase.auth.refreshSession();
            if (data.session) {
              setSession(data.session);
              setUser(data.session.user);
            }
          });
        }
        
        // Setup timeout checks if not already active (for new sign-ins)
        if (!timeoutCheckInterval && event === 'SIGNED_IN') {
          timeoutCheckInterval = setInterval(checkAndEnforceTimeout, 60 * 1000);
        }
      } else {
        // Clear session markers on sign out
        if (event === 'SIGNED_OUT') {
          clearSessionMarkers();
        }
        
        // Cleanup keep-alive
        if (keepAliveCleanup) {
          keepAliveCleanup();
          keepAliveCleanup = null;
        }
        
        // Cleanup timeout checks
        if (timeoutCheckInterval) {
          clearInterval(timeoutCheckInterval);
          timeoutCheckInterval = null;
        }
      }
    });

    return () => {
      subscription.unsubscribe();
      if (keepAliveCleanup) {
        keepAliveCleanup();
      }
      if (timeoutCheckInterval) {
        clearInterval(timeoutCheckInterval);
      }
    };
  }, []);

  const signUp = async (email: string, password: string, displayName?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName || email.split('@')[0],
        },
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    // Note: User will need to confirm email if email confirmation is enabled
    // For local dev, email confirmation is typically disabled
    if (data.user) {
      setUser(data.user);
      setSession(data.session);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }

    setUser(data.user);
    setSession(data.session);
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/cellar`,
      },
    });

    if (error) {
      throw new Error(error.message);
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      throw new Error(error.message);
    }

    // Clear cookie consent from localStorage on logout
    // This ensures each user gets their own consent prompt
    localStorage.removeItem('cookie_consent');
    localStorage.removeItem('analytics_enabled');
    localStorage.removeItem('consent_user_id');

    setUser(null);
    setSession(null);
    setProfile(null);
    setProfileComplete(false);
  };

  const refreshProfile = async () => {
    await loadProfile(user);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        profileComplete,
        loading,
        signUp,
        signIn,
        signInWithGoogle,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within SupabaseAuthProvider');
  }
  return context;
}

