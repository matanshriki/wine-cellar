import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/SupabaseAuthContext';
import { useFeatureFlag } from '../contexts/FeatureFlagsContext'; // Feature flags
import { useFeatureFlags as useBetaFeatureFlags } from '../hooks/useFeatureFlags'; // Beta feature flags (multi-bottle, share)
import { LanguageSwitcher } from './LanguageSwitcher';
import { CompleteProfileModal } from './CompleteProfileModal';
import { UserMenu } from './UserMenu';
import { BottomNav } from './BottomNav';
import { MobileFloatingFooter } from './MobileFloatingFooter';
import { AddBottleSheet } from './AddBottleSheet';
import { useAddBottleContext } from '../contexts/AddBottleContext';
import { shouldReduceMotion } from '../utils/pwaAnimationFix';

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, profile, profileComplete, refreshProfile } = useAuth();
  const [showCompleteProfile, setShowCompleteProfile] = useState(false);
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const { showAddSheet, openAddBottleFlow, closeAddBottleFlow } = useAddBottleContext();
  const betaFlags = useBetaFeatureFlags(); // Beta features (multi-bottle)

  // Show CompleteProfile modal if profile is incomplete
  useEffect(() => {
    if (user && profile && !profileComplete) {
      setShowCompleteProfile(true);
    } else {
      setShowCompleteProfile(false);
    }
  }, [user, profile, profileComplete]);

  /**
   * Sync document direction when language changes
   * This ensures RTL/LTR is always correct even if component re-renders
   */
  useEffect(() => {
    const direction = i18n.language === 'he' ? 'rtl' : 'ltr';
    if (document.documentElement.dir !== direction) {
      document.documentElement.dir = direction;
      document.documentElement.lang = i18n.language;
    }
  }, [i18n.language]);

  /**
   * SAFEGUARD: Reset body overflow on route change
   * Prevents stuck scroll lock if a modal fails to clean up
   * Only resets if no modal/dialog is currently open
   */
  useEffect(() => {
    // Check if any modal is open by looking for common modal attributes
    const hasOpenModal = document.querySelector('[role="dialog"][aria-modal="true"]');
    
    if (!hasOpenModal && document.body.style.overflow === 'hidden') {
      // No modal is open but scroll is locked - unlock it
      console.warn('[Layout] Unlocking stuck scroll on route change');
      document.body.style.overflow = '';
    }
  }, [location.pathname]);

  /**
   * Luxury Scroll Restoration
   * Smoothly scrolls to top on route changes (mobile-first UX)
   * Critical for bottom nav navigation experience
   */
  useEffect(() => {
    // Small delay to ensure DOM has updated after navigation
    const scrollTimer = setTimeout(() => {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: 'smooth',
      });
    }, 10);

    return () => clearTimeout(scrollTimer);
  }, [location.pathname]);

  async function handleProfileComplete() {
    setShowCompleteProfile(false);
    await refreshProfile();
  }

  // Wishlist feature (feature-flagged) - Add wishlist nav item only if enabled
  const wishlistEnabled = useFeatureFlag('wishlistEnabled');
  
  const navItems = [
    { path: '/cellar', label: t('nav.cellar') },
    { path: '/recommendation', label: t('nav.tonight') },
    { path: '/history', label: t('nav.history') },
    // Wishlist feature (feature-flagged)
    ...(wishlistEnabled ? [{ 
      path: '/wishlist', 
      label: t('nav.wishlist'),
    }] : []),
  ];

  return (
    <div className="min-h-screen" style={{ position: 'relative', overflow: 'visible' }}>
      {/* Luxury Background (light with subtle texture) */}
      <div className="luxury-background" />

      {/**
       * Top Navigation Bar - Sticky with translucent glass effect
       * safe-area-top: Ensures proper spacing for iPhone notch/status bar in PWA mode
       */}
      <nav 
        className="fixed top-0 left-0 right-0 z-40 safe-area-top"
        style={{ 
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border-light)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo/Brand - Scroll to Top Button */}
            <div className="flex items-center gap-4 sm:gap-8">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('[Wine Glass Icon] CLICKED! scrollY:', window.scrollY);
                  
                  // Always scroll to top (simplified - no jitter check)
                  const behavior = shouldReduceMotion() ? 'auto' : 'smooth';
                  window.scrollTo({ top: 0, behavior });
                  console.log('[Wine Glass Icon] Scroll command sent with behavior:', behavior);
                }}
                onKeyDown={(e) => {
                  console.log('[Wine Glass Icon] Key pressed:', e.key);
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const behavior = shouldReduceMotion() ? 'auto' : 'smooth';
                    window.scrollTo({ top: 0, behavior });
                  }
                }}
                type="button"
                className="flex items-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-wine-500 focus-visible:ring-offset-2 rounded-lg transition-all hover:opacity-80 active:scale-95"
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  padding: '4px',
                  WebkitTapHighlightColor: 'transparent',
                  touchAction: 'manipulation',
                  userSelect: 'none',
                  pointerEvents: 'auto',
                  position: 'relative',
                  zIndex: 10,
                }}
                aria-label="Scroll to top"
                tabIndex={0}
              >
                <span className="text-2xl pointer-events-none">🍷</span>
                <span 
                  className="hidden xs:inline text-xl sm:text-2xl font-bold pointer-events-none"
                  style={{ 
                    fontFamily: 'var(--font-display)',
                    color: 'var(--wine-700)',
                  }}
                >
                  {t('app.title')}
                </span>
              </button>

              {/* Desktop Navigation - Light Luxury pill tabs */}
              <div className="hidden md:flex gap-2">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  
                  const handleClick = (e: React.MouseEvent) => {
                    console.log('[Desktop Nav]', item.path, 'clicked, isActive:', isActive);
                    if (isActive) {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('[Desktop Nav] Scrolling to top');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                  };
                  
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={handleClick}
                      className={`
                        px-4 py-2 rounded-full text-sm font-medium transition-all
                        ${
                          isActive
                            ? ''
                            : 'hover:bg-opacity-80'
                        }
                      `}
                      style={{
                        background: isActive 
                          ? 'linear-gradient(135deg, var(--wine-600), var(--wine-700))' 
                          : 'var(--bg-surface-2)',
                      color: isActive 
                        ? 'var(--text-inverse)' 
                        : 'var(--text-secondary)',
                      boxShadow: isActive 
                        ? 'var(--shadow-sm)' 
                        : 'none',
                    }}
                  >
                    {item.label}
                  </Link>
                );
                })}
              </div>
            </div>

            {/* End side actions */}
            <div className="flex items-center gap-3">
              <LanguageSwitcher />
              <UserMenu />
            </div>
          </div>
        </div>
      </nav>

      {/**
       * Main Content Area
       * Mobile: extra padding bottom for bottom nav (pb-bottom-nav includes safe-area)
       * Desktop: standard padding (pb-bottom-nav automatically switches at md breakpoint)
       * Top padding added to account for fixed header
       */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-bottom-nav" style={{ paddingTop: 'calc(4rem + 1.5rem)' }}>
        {children}
      </main>

      {/* Mobile Floating Footer with Camera FAB - Replaces BottomNav on mobile */}
      <MobileFloatingFooter onCameraClick={openAddBottleFlow} />

      {/* Global Add Bottle Sheet - Accessible from Camera FAB on any page */}
      <AddBottleSheet
        isOpen={showAddSheet}
        onClose={closeAddBottleFlow}
        onUploadPhoto={() => {
          closeAddBottleFlow();
          // Trigger camera/label capture
          const event = new CustomEvent('openLabelCapture');
          window.dispatchEvent(event);
        }}
        onManualEntry={() => {
          closeAddBottleFlow();
          // Trigger manual form
          const event = new CustomEvent('openManualForm');
          window.dispatchEvent(event);
        }}
        onMultiBottleImport={() => {
          closeAddBottleFlow();
          // Trigger multi-bottle import
          const event = new CustomEvent('openMultiBottleImport');
          window.dispatchEvent(event);
        }}
        showMultiBottleOption={betaFlags.canMultiBottleImport} // Beta feature - enabled for specific users
      />

      {/* Complete Profile Modal */}
      <CompleteProfileModal
        isOpen={showCompleteProfile}
        onComplete={handleProfileComplete}
        currentName={profile?.display_name || ''}
      />
    </div>
  );
}

