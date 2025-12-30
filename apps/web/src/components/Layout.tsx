import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/SupabaseAuthContext';
import { LanguageSwitcher } from './LanguageSwitcher';
import { CompleteProfileModal } from './CompleteProfileModal';
import { UserMenu } from './UserMenu';
import { BottomNav } from './BottomNav';

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, profile, profileComplete, refreshProfile } = useAuth();
  const [showCompleteProfile, setShowCompleteProfile] = useState(false);
  const location = useLocation();
  const { t, i18n } = useTranslation();

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

  const navItems = [
    { path: '/cellar', label: t('nav.cellar') },
    { path: '/recommendation', label: t('nav.tonight') },
    { path: '/history', label: t('nav.history') },
  ];

  return (
    <div className="min-h-screen" style={{ position: 'relative' }}>
      {/* Luxury Background (light with subtle texture) */}
      <div className="luxury-background" />

      {/**
       * Top Navigation Bar - Light Luxury Design
       * safe-area-top: Ensures proper spacing for iPhone notch/status bar in PWA mode
       */}
      <nav 
        className="sticky top-0 z-40 safe-area-top"
        style={{ 
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo/Brand */}
            <div className="flex items-center gap-4 sm:gap-8">
              <Link 
                to="/cellar" 
                className="flex items-center gap-2 group"
              >
                <span className="text-2xl">🍷</span>
                <span 
                  className="hidden xs:inline text-xl sm:text-2xl font-bold transition-colors"
                  style={{ 
                    fontFamily: 'var(--font-display)',
                    color: 'var(--wine-700)',
                  }}
                >
                  {t('app.title')}
                </span>
              </Link>

              {/* Desktop Navigation - Light Luxury pill tabs */}
              <div className="hidden md:flex gap-2">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => {
                      // Instant scroll for desktop (smooth scroll handled by Layout useEffect)
                      window.scrollTo(0, 0);
                    }}
                    className={`
                      px-4 py-2 rounded-full text-sm font-medium transition-all
                      ${
                        location.pathname === item.path
                          ? ''
                          : 'hover:bg-opacity-80'
                      }
                    `}
                    style={{
                      background: location.pathname === item.path 
                        ? 'linear-gradient(135deg, var(--wine-600), var(--wine-700))' 
                        : 'var(--bg-surface-2)',
                      color: location.pathname === item.path 
                        ? 'var(--text-inverse)' 
                        : 'var(--text-secondary)',
                      boxShadow: location.pathname === item.path 
                        ? 'var(--shadow-sm)' 
                        : 'none',
                    }}
                  >
                    {item.label}
                  </Link>
                ))}
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
       */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-bottom-nav">
        {children}
      </main>

      {/* Premium Bottom Navigation for Mobile */}
      <BottomNav />

      {/* Complete Profile Modal */}
      <CompleteProfileModal
        isOpen={showCompleteProfile}
        onComplete={handleProfileComplete}
        currentName={profile?.display_name || ''}
      />
    </div>
  );
}

