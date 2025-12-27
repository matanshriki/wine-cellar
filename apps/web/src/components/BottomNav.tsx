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

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

interface NavItem {
  path: string;
  labelKey: string;
  icon: React.ReactNode;
  activeIcon: React.ReactNode;
}

export const BottomNav: React.FC = () => {
  const location = useLocation();
  const { t } = useTranslation();

  const navItems: NavItem[] = [
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

  return (
    <>
      {/**
       * Bottom Navigation
       * 
       * Fixed to bottom on mobile only (md:hidden).
       * Content spacing handled by Layout's pb-bottom-nav utility.
       * Height: h-16 (64px) + env(safe-area-inset-bottom)
       */}
      <nav
        className="fixed bottom-0 inset-x-0 bg-white border-t md:hidden safe-area-bottom"
        style={{
          borderColor: 'var(--color-stone-200)',
          zIndex: 'var(--z-sticky)',
        }}
      >
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                className="relative flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors"
                aria-label={t(item.labelKey)}
                aria-current={isActive ? 'page' : undefined}
              >
                <div
                  className="relative transition-colors"
                  style={{
                    color: isActive ? 'var(--color-wine-600)' : 'var(--color-stone-500)',
                  }}
                >
                  {isActive ? item.activeIcon : item.icon}

                  {/* Active indicator pill */}
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 -z-10 rounded-full"
                      style={{
                        backgroundColor: 'var(--color-wine-100)',
                        scale: 1.4,
                      }}
                      transition={{
                        type: 'spring',
                        stiffness: 400,
                        damping: 30,
                      }}
                    />
                  )}
                </div>

                <span
                  className="text-xs font-medium transition-colors"
                  style={{
                    color: isActive ? 'var(--color-wine-700)' : 'var(--color-stone-600)',
                  }}
                >
                  {t(item.labelKey)}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
};

