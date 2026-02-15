/**
 * Theme Context
 * 
 * Manages theme switching between White (light) and Red (luxury dark).
 * Persists to localStorage + Supabase profile.
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

export type Theme = 'white' | 'red';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>('white');
  const [isLoading, setIsLoading] = useState(true);

  // Load theme on mount
  useEffect(() => {
    async function loadTheme() {
      try {
        // 1. Try localStorage first (instant)
        const { data: { user } } = await supabase.auth.getUser();
        const localKey = user ? `theme:${user.id}` : 'theme:guest';
        const cachedTheme = localStorage.getItem(localKey) as Theme | null;

        if (cachedTheme && (cachedTheme === 'white' || cachedTheme === 'red')) {
          applyTheme(cachedTheme);
          setThemeState(cachedTheme);
        }

        // 2. If logged in, sync from profile (authoritative)
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('theme_preference')
            .eq('id', user.id)
            .single();

          if (profile?.theme_preference) {
            const dbTheme = profile.theme_preference as Theme;
            if (dbTheme !== cachedTheme) {
              // DB is authoritative, update local cache
              localStorage.setItem(localKey, dbTheme);
              applyTheme(dbTheme);
              setThemeState(dbTheme);
            }
          }
        }
      } catch (error) {
        console.error('[Theme] Error loading theme:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadTheme();
  }, []);

  const setTheme = async (newTheme: Theme) => {
    try {
      // Update state and DOM immediately
      setThemeState(newTheme);
      applyTheme(newTheme);

      // Update localStorage
      const { data: { user } } = await supabase.auth.getUser();
      const localKey = user ? `theme:${user.id}` : 'theme:guest';
      localStorage.setItem(localKey, newTheme);

      // Update Supabase profile if logged in
      if (user) {
        await supabase
          .from('profiles')
          .update({ theme_preference: newTheme })
          .eq('id', user.id);
      }

      console.log('[Theme] Theme updated to:', newTheme);
    } catch (error) {
      console.error('[Theme] Error setting theme:', error);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isLoading }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Apply theme to DOM
function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
  
  // Also update meta theme-color for mobile browsers
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', theme === 'red' ? '#0B0B0D' : '#FFFFFF');
  }
}
