/**
 * Theme Context - Dark Mode V2
 * 
 * Manages theme state (light/dark) with localStorage and Supabase persistence.
 * 
 * Features:
 * - Local state management
 * - localStorage caching
 * - Supabase profile sync (optional)
 * - Smooth theme transitions
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { safeGetItem, safeSetItem } from '../utils/safeLocalStorage';

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

// Feature flag: Set to true to enable dark mode feature
const DARK_MODE_ENABLED = true;

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>('white');
  const [isLoading, setIsLoading] = useState(true);

  // Load theme on mount
  useEffect(() => {
    if (DARK_MODE_ENABLED) {
      loadTheme();
    } else {
      // Force light mode when dark mode is disabled
      applyTheme('white');
      setIsLoading(false);
    }
  }, []);

  async function loadTheme() {
    try {
      // 1. Try localStorage first (instant)
      const stored = safeGetItem('theme');
      if (stored === 'white' || stored === 'red') {
        setThemeState(stored);
        applyTheme(stored);
      }

      // 2. Then sync with Supabase profile (background)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('theme_preference')
          .eq('id', user.id)
          .single();

        if (profile?.theme_preference && 
            (profile.theme_preference === 'white' || profile.theme_preference === 'red')) {
          setThemeState(profile.theme_preference);
          applyTheme(profile.theme_preference);
          safeSetItem('theme', profile.theme_preference);
        }
      }
    } catch (error) {
      console.error('[ThemeContext] Error loading theme:', error);
      // Fallback to white theme
      setThemeState('white');
      applyTheme('white');
    } finally {
      setIsLoading(false);
    }
  }

  const setTheme = async (newTheme: Theme) => {
    if (!DARK_MODE_ENABLED) return;

    try {
      setThemeState(newTheme);
      applyTheme(newTheme);
      safeSetItem('theme', newTheme);

      // Save to Supabase in the background (non-blocking)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        supabase
          .from('profiles')
          .update({ theme_preference: newTheme })
          .eq('id', user.id)
          .then(({ error }) => {
            if (error) console.error('[ThemeContext] Error saving theme to profile:', error);
          });
      }
    } catch (error) {
      console.error('[ThemeContext] Error setting theme:', error);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isLoading }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Apply theme to DOM
 */
function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);

  // Update meta theme-color for mobile browsers
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', theme === 'red' ? '#0B0B0D' : '#FFFFFF');
  }
}
