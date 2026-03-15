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
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  }, [pathname]);

  return null;
}
