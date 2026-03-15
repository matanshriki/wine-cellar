/**
 * useGaPageViews — SPA page-view tracking for Google Analytics 4
 *
 * Fires a GA4 `page_view` event on every React Router location change.
 * Skips the very first render to avoid double-firing when the initial
 * page_view is handled by the GA config call in initializeAnalytics().
 *
 * Usage (place inside a component that is a child of <BrowserRouter>):
 *   useGaPageViews();
 */

import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '../services/analytics';

export function useGaPageViews(): void {
  const { pathname } = useLocation();
  // Track whether this is the very first render of this hook instance.
  // We do fire on first mount — GA's send_page_view:false means GA won't
  // auto-send, so we must send the initial view ourselves.
  const didMount = useRef(false);

  useEffect(() => {
    // Always fire — including on initial mount (first page load)
    // so the entry route is captured in GA.
    trackPageView(pathname);
    didMount.current = true;
  }, [pathname]);
}
