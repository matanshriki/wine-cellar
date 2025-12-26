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
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false); // Set loading false BEFORE profile load
      
      // Load profile in background (non-blocking)
      if (session?.user) {
        loadProfile(session.user);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false); // Set loading false BEFORE profile load
      
      // Load profile in background (non-blocking)
      if (session?.user) {
        loadProfile(session.user);
      }
    });

    return () => subscription.unsubscribe();
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

