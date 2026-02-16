import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEffect, useState, useRef } from 'react';
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
import { CameraFallbackSheet } from './CameraFallbackSheet';
import { PwaCameraCaptureModal } from './PwaCameraCaptureModal';
import { CompactThemeToggle } from './ThemeToggle';
import { useAddBottleContext } from '../contexts/AddBottleContext';
import { shouldReduceMotion } from '../utils/pwaAnimationFix';
import { isIosStandalonePwa, isMobileDevice, isSamsungBrowser } from '../utils/deviceDetection';

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, profile, profileComplete, refreshProfile } = useAuth();
  const [showCompleteProfile, setShowCompleteProfile] = useState(false);
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const { 
    showAddSheet, 
    scanningState, 
    scanningMessage, 
    showFallbackSheet,
    fallbackReason,
    showPwaCamera,
    openAddBottleFlow,
    openAddBottleFlowForScanning,
    closeAddBottleFlow,
    openImmediateCamera,
    openPwaCamera,
    closePwaCamera,
    closeFallbackSheet,
    handleSmartScan 
  } = useAddBottleContext();
  const betaFlags = useBetaFeatureFlags(); // Beta features (multi-bottle)
  
  // Immediate camera input ref (hidden, for non-iOS-PWA mobile)
  const immediateCameraInputRef = useRef<HTMLInputElement>(null);
  
  // Detect device type
  const isMobile = isMobileDevice();
  const isSamsung = isSamsungBrowser();
  const isIosPwa = isIosStandalonePwa();
  const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                (window.navigator as any).standalone === true ||
                document.referrer.includes('android-app://');

  // Show CompleteProfile modal if profile is incomplete
  useEffect(() => {
    if (user && profile && !profileComplete) {
      setShowCompleteProfile(true);
    } else {
      setShowCompleteProfile(false);
    }
  }, [user, profile, profileComplete]);

  // Handle immediate camera trigger (for mobile/PWA)
  useEffect(() => {
    const handleOpenImmediateCamera = () => {
      if (immediateCameraInputRef.current) {
        immediateCameraInputRef.current.click();
      }
    };

    window.addEventListener('openImmediateCamera', handleOpenImmediateCamera);
    return () => {
      window.removeEventListener('openImmediateCamera', handleOpenImmediateCamera);
    };
  }, []);

  // Handle camera file selection
  const handleCameraFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    
    if (!file) {
      // User cancelled camera or permission denied - show fallback sheet
      console.log('[Camera] No file selected - user cancelled or permission denied, showing fallback sheet');
      const event = new CustomEvent('showCameraFallback', { detail: { reason: 'cancelled' } });
      window.dispatchEvent(event);
      
      // Reset input
      e.target.value = '';
      return;
    }

    // File selected - proceed with smart scan
    console.log('[Camera] File selected, starting smart scan:', file.name, file.type);
    
    // CRITICAL FIX: Open AddBottleSheet so loader is visible
    // On mobile, the sheet is not open yet, so we need to open it to show the scanning state
    console.log('[Camera] Opening AddBottleSheet for scanning');
    openAddBottleFlowForScanning();
    
    // Minimal delay to ensure sheet is mounted, then begin scan
    // The sheet animation will mask any transition to scanning state
    requestAnimationFrame(() => {
      handleSmartScan(file);
    });
    
    // Reset input for next time
    setTimeout(() => {
      e.target.value = '';
    }, 500);
  };

  // Handle camera FAB click - different behavior based on platform
  const handleCameraFabClick = () => {
    console.log('[Camera FAB] Click detected', { 
      isMobile, 
      isPWA,
      isIosPwa,
      userAgent: navigator.userAgent.substring(0, 50) 
    });
    
    if (isIosPwa) {
      // iOS PWA: Open getUserMedia camera to avoid file chooser
      console.log('[Camera FAB] Opening PWA camera (iOS standalone - getUserMedia)');
      openPwaCamera();
    } else if (isMobile || isPWA) {
      // Other mobile/PWA: Open camera via file input (works fine)
      console.log('[Camera FAB] Opening camera immediately (mobile/PWA - file input)');
      openImmediateCamera();
    } else {
      // Desktop: Show options modal (existing behavior)
      console.log('[Camera FAB] Opening options modal (desktop flow)');
      openAddBottleFlow();
    }
  };

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
                  
                  const behavior = shouldReduceMotion() ? 'auto' : 'smooth';
                  
                  // Log scroll positions to debug
                  console.log('[Wine Glass Icon] CLICKED!');
                  console.log('  window.scrollY:', window.scrollY);
                  console.log('  document.documentElement.scrollTop:', document.documentElement.scrollTop);
                  console.log('  document.body.scrollTop:', document.body.scrollTop);
                  
                  // Try multiple scroll methods (body might be the scroll container)
                  window.scrollTo({ top: 0, behavior });
                  document.documentElement.scrollTo?.({ top: 0, behavior });
                  document.body.scrollTo?.({ top: 0, behavior });
                  
                  // Force scroll with scrollTop as fallback
                  if (behavior === 'auto') {
                    document.documentElement.scrollTop = 0;
                    document.body.scrollTop = 0;
                  }
                  
                  console.log('[Wine Glass Icon] Scroll commands sent with behavior:', behavior);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const behavior = shouldReduceMotion() ? 'auto' : 'smooth';
                    
                    // Try multiple scroll methods
                    window.scrollTo({ top: 0, behavior });
                    document.documentElement.scrollTo?.({ top: 0, behavior });
                    document.body.scrollTo?.({ top: 0, behavior });
                    
                    if (behavior === 'auto') {
                      document.documentElement.scrollTop = 0;
                      document.body.scrollTop = 0;
                    }
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
              <CompactThemeToggle />
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
      <MobileFloatingFooter onCameraClick={handleCameraFabClick} />

      {/* Hidden camera input for immediate capture (mobile/PWA) */}
      <input
        ref={immediateCameraInputRef}
        type="file"
        accept="image/*"
        {...(isMobile && !isSamsung && !isPWA ? { capture: 'environment' as const } : {})}
        onChange={handleCameraFileSelect}
        className="hidden"
        aria-label="Capture bottle photo"
      />

      {/* Global Add Bottle Sheet - Accessible from Camera FAB on any page (desktop) */}
      <AddBottleSheet
        isOpen={showAddSheet}
        onClose={closeAddBottleFlow}
        scanningState={scanningState}
        scanningMessage={scanningMessage}
        onPhotoSelected={async (file) => {
          // Call smart scan from context
          await handleSmartScan(file);
        }}
        onManualEntry={() => {
          closeAddBottleFlow();
          // Trigger manual form
          const event = new CustomEvent('openManualForm');
          window.dispatchEvent(event);
        }}
        onRetry={() => {
          // Reset to idle state to allow retry
          // The file input will trigger again when user selects
        }}
        showWishlistOption={false}
      />

      {/* Camera Fallback Sheet - Shown on mobile/PWA when camera cancelled/failed */}
      <CameraFallbackSheet
        isOpen={showFallbackSheet}
        onClose={closeFallbackSheet}
        reason={fallbackReason}
        onTryCamera={() => {
          closeFallbackSheet();
          // Retry camera based on platform
          if (isIosPwa) {
            openPwaCamera();
          } else {
            openImmediateCamera();
          }
        }}
        onChoosePhoto={async (file) => {
          console.log('[CameraFallback] Photo selected from library, opening sheet and starting scan');
          closeFallbackSheet();
          
          // CRITICAL FIX: Open AddBottleSheet to show loader
          openAddBottleFlowForScanning();
          
          // Minimal delay to ensure sheet is mounted, then begin scan
          requestAnimationFrame(async () => {
            await handleSmartScan(file);
          });
        }}
        onManualEntry={() => {
          closeFallbackSheet();
          const event = new CustomEvent('openManualForm');
          window.dispatchEvent(event);
        }}
      />

      {/* PWA Camera Capture Modal - iOS PWA getUserMedia camera */}
      <PwaCameraCaptureModal
        isOpen={showPwaCamera}
        onClose={() => {
          // User closed camera without capturing
          console.log('[PWA Camera] User closed camera, showing fallback options');
          closePwaCamera();
          
          // Show fallback options
          const event = new CustomEvent('showCameraFallback', { detail: { reason: 'cancelled' } });
          window.dispatchEvent(event);
        }}
        onCapture={async (file) => {
          // User captured photo
          console.log('[PWA Camera] Photo captured, starting scan');
          closePwaCamera();
          
          // Open AddBottleSheet to show scanning loader
          openAddBottleFlowForScanning();
          
          // Start scan
          requestAnimationFrame(async () => {
            await handleSmartScan(file);
          });
        }}
        onError={(error) => {
          // Camera error (permission denied, not found, etc)
          console.error('[PWA Camera] Error:', error);
          closePwaCamera();
          
          // Show fallback sheet with error reason
          const reason: 'permission-denied' | 'not-available' | 'error' = 
            error.name === 'NotAllowedError' ? 'permission-denied' :
            error.name === 'NotFoundError' ? 'not-available' :
            'error';
          
          const event = new CustomEvent('showCameraFallback', { detail: { reason } });
          window.dispatchEvent(event);
        }}
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

