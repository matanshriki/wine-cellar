/**
 * ScrollToTop Component
 * 
 * Automatically scrolls to the top of the page when the route changes.
 * Uses smooth scrolling for better UX.
 * Also tracks page views for analytics.
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '../services/analytics';

export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Scroll to top smoothly when route changes
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'smooth'
    });
    
    // Track page view for analytics
    // This fires on every route change, perfect for SPA tracking
    trackPageView(pathname);
  }, [pathname]);

  return null;
}



