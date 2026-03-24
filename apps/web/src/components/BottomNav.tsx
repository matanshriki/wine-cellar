/**
 * Premium Bottom Navigation (Mobile-First)
 * 
 * Luxury bottom nav with:
 * - Smooth animations
 * - Active state indicators
 * - Icons + labels
 * - Safe area support (notched devices)
 * - RTL support
 * - Accessible
 */

import React, { useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useFeatureFlags } from '../contexts/FeatureFlagsContext'; // For wishlist feature flag
import { scrollAppToTop } from '../utils/scrollAppToTop';
import { useScrollDirectionNav } from '../hooks/useScrollDirectionNav';
import { shouldReduceMotion } from '../utils/pwaAnimationFix';
import {
  BOTTOM_NAV_LAYOUT_COMPACT_PX,
  BOTTOM_NAV_LAYOUT_EXPANDED_PX,
  NAV_ROW_COMPACT_PX,
  NAV_ROW_EXPANDED_PX,
} from '../constants/bottomNavLayout';

interface NavItem {
  path: string;
  labelKey: string;
  icon: React.ReactNode;
  activeIcon: React.ReactNode;
}

export const BottomNav: React.FC = () => {
  const location = useLocation();
  const { t } = useTranslation();
  const { flags, loading } = useFeatureFlags(); // Get feature flags and loading state
  const reduceMotion = shouldReduceMotion();
  const navMode = useScrollDirectionNav({ enabled: true });
  const compact = navMode === 'compact';

  const navLayoutTransition = useMemo(
    () => ({
      type: 'tween' as const,
      duration: reduceMotion ? 0.05 : 0.24,
      ease: [0.4, 0, 0.2, 1] as const,
    }),
    [reduceMotion]
  );

  useEffect(() => {
    const root = document.documentElement;
    const h = compact ? BOTTOM_NAV_LAYOUT_COMPACT_PX : BOTTOM_NAV_LAYOUT_EXPANDED_PX;
    root.style.setProperty('--bottom-nav-h', `${h}px`);
    return () => {
      root.style.setProperty('--bottom-nav-h', `${BOTTOM_NAV_LAYOUT_EXPANDED_PX}px`);
    };
  }, [compact]);

  // Build nav items array - conditionally include Wishlist if feature is enabled
  const baseNavItems: NavItem[] = [
    {
      path: '/cellar',
      labelKey: 'nav.cellar',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
      ),
      activeIcon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
      ),
    },
    {
      path: '/recommendation',
      labelKey: 'nav.tonight',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
      activeIcon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
    },
    {
      path: '/history',
      labelKey: 'nav.history',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      activeIcon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path fillRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 5a1 1 0 011 1v3.586l2.707 2.707a1 1 0 01-1.414 1.414l-3-3A1 1 0 0111 12V8a1 1 0 011-1z" clipRule="evenodd" />
        </svg>
      ),
    },
  ];

  // Add Wishlist nav item if feature is enabled
  const wishlistNavItem: NavItem = {
    path: '/wishlist',
    labelKey: 'nav.wishlist',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
      </svg>
    ),
    activeIcon: (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
      </svg>
    ),
  };

  // Always include Wishlist slot to prevent layout shift (show skeleton while loading)
  const navItems: NavItem[] = flags?.wishlistEnabled
    ? [...baseNavItems, wishlistNavItem]
    : baseNavItems;
  
  // During loading, show all 4 slots (including Wishlist skeleton) to prevent layout shift
  const shouldShowWishlist = loading || flags?.wishlistEnabled;

  return (
    <>
      {/**
       * Bottom Navigation
       * 
       * Fixed to bottom on mobile only (md:hidden).
       * Content spacing handled by Layout's pb-bottom-nav utility.
       * Height: h-16 (64px) + env(safe-area-inset-bottom)
       * 
       * UX Fix: Always shows 4 slots (including Wishlist skeleton during load) to prevent layout shift
       */}
      <nav
        className="fixed bottom-0 inset-x-0 border-t md:hidden safe-area-bottom"
        style={{
          background: 'var(--bg-nav)',
          borderColor: 'var(--border-subtle)',
          zIndex: 'var(--z-sticky)',
        }}
      >
        <motion.div
          className="flex items-center justify-around px-2"
          initial={false}
          animate={{
            height: compact ? NAV_ROW_COMPACT_PX : NAV_ROW_EXPANDED_PX,
          }}
          transition={navLayoutTransition}
          style={{ minHeight: 44 }}
        >
          {baseNavItems.map((item) => {
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={(e) => {
                  // If already on this page, scroll to top instead of navigating
                  if (isActive) {
                    e.preventDefault();
                    scrollAppToTop();
                  }
                }}
                className="relative flex flex-col items-center justify-center flex-1 min-h-[44px] min-w-[44px] h-full gap-0.5 transition-colors"
                aria-label={t(item.labelKey)}
                aria-current={isActive ? 'page' : undefined}
              >
                <motion.div
                  className="relative transition-colors flex items-center justify-center"
                  style={{
                    color: isActive ? 'var(--color-wine-600)' : 'var(--color-stone-500)',
                    transformOrigin: 'center',
                  }}
                  initial={false}
                  animate={reduceMotion ? undefined : { scale: compact ? 0.88 : 1 }}
                  transition={navLayoutTransition}
                >
                  {isActive ? item.activeIcon : item.icon}

                  {/* Active indicator pill */}
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 -z-10 rounded-full"
                      style={{
                        backgroundColor: 'var(--color-wine-100)',
                        transform: 'scale(1.4)',
                      }}
                      transition={{
                        type: 'tween',
                        duration: 0.2,
                        ease: 'easeOut',
                      }}
                    />
                  )}
                </motion.div>

                <motion.span
                  className="text-xs font-medium transition-colors overflow-hidden text-center leading-tight"
                  style={{
                    color: isActive ? 'var(--color-wine-700)' : 'var(--color-stone-600)',
                  }}
                  initial={false}
                  animate={
                    reduceMotion
                      ? undefined
                      : { opacity: compact ? 0 : 1, marginTop: compact ? 0 : 2, maxHeight: compact ? 0 : 20 }
                  }
                  transition={navLayoutTransition}
                  aria-hidden={compact}
                >
                  {t(item.labelKey)}
                </motion.span>
              </Link>
            );
          })}
          
          {/* Wishlist button - always reserve space to prevent layout shift */}
          {shouldShowWishlist && (
            <Link
              key={wishlistNavItem.path}
              to={wishlistNavItem.path}
              onClick={(e) => {
                // Prevent navigation during loading
                if (loading) {
                  e.preventDefault();
                  return;
                }
                // If already on wishlist page, scroll to top instead of navigating
                if (location.pathname === wishlistNavItem.path) {
                  e.preventDefault();
                  scrollAppToTop();
                }
              }}
              className="relative flex flex-col items-center justify-center flex-1 min-h-[44px] min-w-[44px] h-full gap-0.5 transition-colors"
              aria-label={t(wishlistNavItem.labelKey)}
              aria-current={location.pathname === wishlistNavItem.path ? 'page' : undefined}
              style={{
                opacity: loading ? 0.3 : 1, // Dim during loading
                pointerEvents: loading ? 'none' : 'auto', // Disable clicks during loading
              }}
            >
              <motion.div
                className="relative transition-colors flex items-center justify-center"
                style={{
                  color: location.pathname === wishlistNavItem.path ? 'var(--color-wine-600)' : 'var(--color-stone-500)',
                  transformOrigin: 'center',
                }}
                initial={false}
                animate={reduceMotion ? undefined : { scale: compact ? 0.88 : 1 }}
                transition={navLayoutTransition}
              >
                {location.pathname === wishlistNavItem.path ? wishlistNavItem.activeIcon : wishlistNavItem.icon}

                {/* Active indicator pill */}
                {location.pathname === wishlistNavItem.path && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 -z-10 rounded-full"
                    style={{
                      backgroundColor: 'var(--color-wine-100)',
                      transform: 'scale(1.4)',
                    }}
                    transition={{
                      type: 'tween',
                      duration: 0.2,
                      ease: 'easeOut',
                    }}
                  />
                )}
              </motion.div>

              <motion.span
                className="text-xs font-medium transition-colors overflow-hidden text-center leading-tight"
                style={{
                  color: location.pathname === wishlistNavItem.path ? 'var(--color-wine-700)' : 'var(--color-stone-600)',
                }}
                initial={false}
                animate={
                  reduceMotion
                    ? undefined
                    : { opacity: compact ? 0 : 1, marginTop: compact ? 0 : 2, maxHeight: compact ? 0 : 20 }
                }
                transition={navLayoutTransition}
                aria-hidden={compact}
              >
                {t(wishlistNavItem.labelKey)}
              </motion.span>
            </Link>
          )}
        </motion.div>
      </nav>
    </>
  );
};

