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
const DARK_MODE_ENABLED = false;

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
      const stored = localStorage.getItem('theme');
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
          localStorage.setItem('theme', profile.theme_preference);
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
    // Skip theme changes when dark mode is disabled
    if (!DARK_MODE_ENABLED) {
      return;
    }

    try {
      console.log('[ThemeContext] ===== SETTING THEME =====');
      console.log('[ThemeContext] Old theme:', theme);
      console.log('[ThemeContext] New theme:', newTheme);
      
      // Update state
      setThemeState(newTheme);
      console.log('[ThemeContext] State updated');
      
      // Apply to DOM
      applyTheme(newTheme);
      console.log('[ThemeContext] DOM updated');
      
      // Save to localStorage
      localStorage.setItem('theme', newTheme);
      console.log('[ThemeContext] localStorage updated');
      
      // Save to Supabase (background, non-blocking)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        console.log('[ThemeContext] Saving to Supabase profile...');
        supabase
          .from('profiles')
          .update({ theme_preference: newTheme })
          .eq('id', user.id)
          .then(({ error }) => {
            if (error) {
              console.error('[ThemeContext] Error saving theme to profile:', error);
            } else {
              console.log('[ThemeContext] ✅ Theme saved to profile successfully');
            }
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
  console.log('[applyTheme] ===== APPLYING THEME =====');
  console.log('[applyTheme] Theme value:', theme);
  console.log('[applyTheme] BEFORE - html data-theme:', document.documentElement.getAttribute('data-theme'));
  
  // Set data-theme attribute on html element
  document.documentElement.setAttribute('data-theme', theme);
  
  console.log('[applyTheme] AFTER - html data-theme:', document.documentElement.getAttribute('data-theme'));
  
  // Check computed CSS variable
  const computedBg = getComputedStyle(document.documentElement).getPropertyValue('--bg');
  console.log('[applyTheme] Computed --bg color:', computedBg);
  
  const computedText = getComputedStyle(document.documentElement).getPropertyValue('--text-primary');
  console.log('[applyTheme] Computed --text-primary color:', computedText);
  
  // Update meta theme-color for mobile browsers
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    const newColor = theme === 'red' ? '#0B0B0D' : '#FFFFFF';
    metaTheme.setAttribute('content', newColor);
    console.log('[applyTheme] Meta theme-color updated to:', newColor);
  }
  
  console.log('[applyTheme] ✅ Theme applied successfully');
}
