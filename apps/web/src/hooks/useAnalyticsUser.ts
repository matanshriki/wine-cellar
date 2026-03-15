/**
 * useAnalyticsUser — sync Supabase auth state with GA4 user identity
 *
 * When a user signs in:
 *   - Sets GA4 user_id to their Supabase UUID (pseudonymous, not email)
 *   - Sets persistent user properties: language, theme, is_pwa
 *
 * When a user signs out:
 *   - Clears the GA4 user_id
 *
 * Must be rendered inside <SupabaseAuthProvider> and <BrowserRouter>.
 * Called once from AppRoutes in App.tsx.
 */

import { useEffect } from 'react';
import { useAuth } from '../contexts/SupabaseAuthContext';
import {
  setAnalyticsUser,
  clearAnalyticsUser,
  setAnalyticsUserProperties,
  detectPlatform,
} from '../services/analytics';
import { isStandalonePwa } from '../utils/deviceDetection';

export function useAnalyticsUser(): void {
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      // Set pseudonymous user identity (UUID only — no email, no name)
      setAnalyticsUser(user.id);

      // Set user properties that help segment reports
      setAnalyticsUserProperties({
        language:
          document.documentElement.lang ||
          localStorage.getItem('i18nextLng') ||
          'en',
        theme: (localStorage.getItem('theme') as 'white' | 'red') || 'white',
        is_pwa: isStandalonePwa(),
        platform: detectPlatform(),
      });
    } else {
      clearAnalyticsUser();
    }
  }, [user?.id]);
}
