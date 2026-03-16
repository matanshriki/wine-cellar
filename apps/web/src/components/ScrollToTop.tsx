/**
 * ScrollToTop — scrolls to the top of the page on every route change,
 * and delegates GA4 page-view tracking to useGaPageViews().
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useGaPageViews } from '../hooks/useGaPageViews';

export function ScrollToTop() {
  const { pathname } = useLocation();

  // Fire GA4 page_view on every route change (no double-firing on initial load)
  useGaPageViews();

  useEffect(() => {
    // Instant scroll — the new page should always open at the top immediately.
    // Using 'smooth' would render the page at the old scroll position first
    // and then animate up, making it look like the page opened in the middle.
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
