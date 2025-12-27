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
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-stone-50)' }}>
      {/**
       * Top Navigation Bar - Luxury Design
       */}
      <nav 
        className="bg-white sticky top-0 z-40"
        style={{ 
          borderBottom: `1px solid var(--color-stone-200)`,
          boxShadow: 'var(--shadow-sm)'
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
                    color: 'var(--color-wine-700)',
                  }}
                >
                  {t('app.title')}
                </span>
              </Link>

              {/* Desktop Navigation - Premium pill tabs */}
              <div className="hidden md:flex gap-2">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`
                      px-4 py-2 rounded-full text-sm font-medium transition-all
                      ${
                        location.pathname === item.path
                          ? 'shadow-md'
                          : 'hover:bg-opacity-50'
                      }
                    `}
                    style={{
                      backgroundColor: location.pathname === item.path 
                        ? 'var(--color-wine-100)' 
                        : 'transparent',
                      color: location.pathname === item.path 
                        ? 'var(--color-wine-800)' 
                        : 'var(--color-stone-600)',
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
       * Mobile: extra padding bottom for bottom nav
       */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-24 md:pb-8">
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

