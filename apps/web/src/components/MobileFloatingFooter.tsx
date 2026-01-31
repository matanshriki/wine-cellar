/**
 * Mobile Floating Footer with Camera FAB
 * 
 * Luxury floating bottom navigation with centered Camera FAB.
 * Replaces the existing bottom nav on mobile with a more premium iOS-style design.
 * 
 * Features:
 * - Floating pill/glass design with backdrop blur
 * - Centered circular Camera FAB that floats above the footer
 * - Smooth animations using existing framer-motion
 * - Safe area support for notched devices
 * - Accessible and keyboard navigable
 * - RTL support
 */

import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useFeatureFlags } from '../contexts/FeatureFlagsContext';
import { shouldReduceMotion } from '../utils/pwaAnimationFix';

interface MobileFloatingFooterProps {
  onCameraClick: () => void;
}

export function MobileFloatingFooter({ onCameraClick }: MobileFloatingFooterProps) {
  const location = useLocation();
  const { t } = useTranslation();
  const { flags } = useFeatureFlags();
  const reduceMotion = shouldReduceMotion();

  // Navigation items - keeping all 4 items visible
  // Icons are inline SVGs (not lazy loaded) for instant rendering
  const navItems = [
    {
      path: '/cellar',
      labelKey: 'nav.cellar',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
      ),
    },
    {
      path: '/recommendation',
      labelKey: 'nav.tonight',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
    },
    {
      path: '/history',
      labelKey: 'nav.history',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ];

  // Add wishlist if enabled (default to showing base items immediately to prevent icon flash)
  const allNavItems = flags?.wishlistEnabled
    ? [
        ...navItems,
        {
          path: '/wishlist',
          labelKey: 'nav.wishlist',
          icon: (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          ),
        },
      ]
    : navItems;

  // Always show at least the base items (prevents delayed icon rendering)
  const displayItems = allNavItems.length > 0 ? allNavItems : navItems;

  return (
    <>
      {/* Fixed container for footer + FAB */}
      <div 
        className="fixed bottom-0 left-0 right-0 md:hidden pointer-events-none"
        style={{
          zIndex: 'var(--z-sticky)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >

        {/* Floating Footer with integrated Camera FAB */}
        <motion.div
          initial={reduceMotion ? false : { y: 100, opacity: 0 }}
          animate={reduceMotion ? false : { y: 0, opacity: 1 }}
          transition={{
            type: reduceMotion ? 'tween' : 'spring',
            stiffness: 300,
            damping: 30,
          }}
          className="relative mx-4 mb-4 pointer-events-auto"
        >
          {/* Camera FAB - Centered and protruding above footer */}
          <div className="absolute left-1/2 -translate-x-1/2 -top-8 z-10">
            <motion.button
              onClick={onCameraClick}
              className="relative w-16 h-16 rounded-full flex items-center justify-center overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, var(--wine-500), var(--wine-600))',
                boxShadow: '0 8px 32px rgba(164, 76, 104, 0.5), 0 4px 16px rgba(0, 0, 0, 0.2)',
                border: '4px solid rgba(255, 255, 255, 0.95)',
              }}
              initial={false}
              whileTap={reduceMotion ? {} : { 
                scale: 0.92,
                boxShadow: '0 4px 16px rgba(164, 76, 104, 0.4), 0 2px 8px rgba(0, 0, 0, 0.15)',
              }}
              whileHover={reduceMotion ? {} : {
                y: -3,
                scale: 1.05,
                boxShadow: '0 12px 40px rgba(164, 76, 104, 0.6), 0 6px 20px rgba(0, 0, 0, 0.25)',
              }}
              transition={{
                type: reduceMotion ? 'tween' : 'spring',
                stiffness: 400,
                damping: 17,
              }}
              aria-label={t('cellar.addBottleButton', 'Add bottle')}
              tabIndex={0}
            >
              {/* Camera Icon - Larger for prominence */}
              <svg 
                className="w-8 h-8" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="white" 
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>

              {/* Subtle shine effect */}
              {!reduceMotion && (
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 60%)',
                  }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.7, 0] }}
                  transition={{
                    duration: 2.5,
                    repeat: 0,
                    ease: 'easeInOut',
                  }}
                />
              )}

              {/* Focus ring */}
              <div className="absolute inset-0 rounded-full ring-2 ring-offset-2 ring-wine-400 opacity-0 focus-visible:opacity-100 transition-opacity" />
            </motion.button>
          </div>

          {/* Footer Pill */}
          <div
            className="rounded-full"
            style={{
              background: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06), inset 0 1px 2px rgba(255, 255, 255, 1)',
              border: '1px solid rgba(255, 255, 255, 0.8)',
            }}
          >
            <div className="flex items-center h-16 px-2">
              {/* Left nav items */}
              {displayItems.slice(0, 2).map((item) => {
                const isActive = location.pathname === item.path;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className="relative flex flex-col items-center justify-center flex-1 h-full transition-colors"
                    aria-label={t(item.labelKey)}
                    aria-current={isActive ? 'page' : undefined}
                    style={{
                      color: isActive ? 'var(--wine-600)' : 'var(--color-stone-500)',
                    }}
                  >
                    <motion.div
                      className="relative"
                      whileTap={reduceMotion ? {} : { scale: 0.9 }}
                      transition={{ duration: 0.1 }}
                    >
                      {item.icon}
                      
                      {/* Active indicator dot */}
                      {isActive && (
                        <motion.div
                          layoutId="mobileActiveTab"
                          className="absolute w-1 h-1 rounded-full"
                          style={{
                            backgroundColor: 'var(--wine-600)',
                            bottom: '-5px',
                            left: '41%',
                          }}
                          transition={{
                            type: 'spring',
                            stiffness: 400,
                            damping: 30,
                          }}
                        />
                      )}
                    </motion.div>
                  </Link>
                );
              })}

              {/* Center spacer for Camera FAB */}
              <div className="flex-1 h-full" />

              {/* Right nav items */}
              {displayItems.slice(2).map((item) => {
                const isActive = location.pathname === item.path;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className="relative flex flex-col items-center justify-center flex-1 h-full transition-colors"
                    aria-label={t(item.labelKey)}
                    aria-current={isActive ? 'page' : undefined}
                    style={{
                      color: isActive ? 'var(--wine-600)' : 'var(--color-stone-500)',
                    }}
                  >
                    <motion.div
                      className="relative"
                      whileTap={reduceMotion ? {} : { scale: 0.9 }}
                      transition={{ duration: 0.1 }}
                    >
                      {item.icon}
                      
                      {/* Active indicator dot */}
                      {isActive && (
                        <motion.div
                          layoutId="mobileActiveTab"
                          className="absolute w-1 h-1 rounded-full"
                          style={{
                            backgroundColor: 'var(--wine-600)',
                            bottom: '-5px',
                            left: '41%',
                          }}
                          transition={{
                            type: 'spring',
                            stiffness: 400,
                            damping: 30,
                          }}
                        />
                      )}
                    </motion.div>
                  </Link>
                );
              })}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Spacer to prevent content from being covered */}
      <div 
        className="md:hidden" 
        style={{ 
          height: 'calc(104px + env(safe-area-inset-bottom))', // Footer height + FAB protrusion + safe area
        }} 
      />
    </>
  );
}
