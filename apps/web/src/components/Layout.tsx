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
import { PwaInstallPrompt } from './PwaInstallPrompt';
import { usePwaInstallPrompt } from '../hooks/usePwaInstallPrompt';
import { CompactThemeToggle } from './ThemeToggle';
import { SommelierChatButton } from './SommelierChatButton';
import { useAddBottleContext } from '../contexts/AddBottleContext';
import { shouldReduceMotion } from '../utils/pwaAnimationFix';
import { isIosStandalonePwa, isAndroidPwa as isAndroidPwaCheck, isMobileDevice, isSamsungBrowser, isIPad } from '../utils/deviceDetection';

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
  // Flag used to detect iOS camera cancellation (onChange doesn't fire on iOS when user cancels)
  const awaitingCameraResult = useRef(false);
  // Monotonic counter — incremented on every new camera session so stale timeouts are no-ops
  const cameraSessionId = useRef(0);
  
  // Detect device type
  const isMobile = isMobileDevice();
  const isSamsung = isSamsungBrowser();
  const isIosPwa = isIosStandalonePwa();
  const isIpad = isIPad();
  const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                (window.navigator as any).standalone === true ||
                document.referrer.includes('android-app://');
  // Android PWA: use getUserMedia in-app camera (same as iOS PWA) to avoid
  // the OS gallery chooser which causes scroll-lock and poor UX.
  const isAndroidPwa = isAndroidPwaCheck();

  // Show CompleteProfile modal if profile is incomplete
  useEffect(() => {
    if (user && profile && !profileComplete) {
      setShowCompleteProfile(true);
    } else {
      setShowCompleteProfile(false);
    }
  }, [user, profile, profileComplete]);

  // Handle immediate camera trigger (for mobile/PWA fallback)
  useEffect(() => {
    const handleOpenImmediateCamera = () => {
      if (!immediateCameraInputRef.current) return;

      // ── Scroll-lock fix for Android (and any platform) ────────────────────
      // When the OS file-chooser/gallery opens, Android can pause the JS
      // lifecycle. Any body scroll-lock applied by an open modal stays locked
      // when the chooser is dismissed, causing a "stuck scroll" bug.
      // Solution: release the lock before clicking, then restore it (only if
      // a modal is still open) when the window regains focus.
      const prevOverflow = document.body.style.overflow;
      const prevPosition = document.body.style.position;
      const prevWidth    = document.body.style.width;
      const scrollY      = window.scrollY;

      if (prevOverflow === 'hidden') {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width    = '';
        // position:fixed snaps the page to top — restore the real scroll pos
        if (prevPosition === 'fixed') window.scrollTo(0, scrollY);
      }

      // Restore scroll state when chooser is dismissed
      const restoreScrollState = () => {
        const hasOpenModal = document.querySelector('[role="dialog"][aria-modal="true"]');
        if (hasOpenModal && prevOverflow === 'hidden') {
          document.body.style.overflow = prevOverflow;
          document.body.style.position = prevPosition;
          document.body.style.width    = prevWidth;
        }
      };

      // ── iOS camera-cancellation detection ─────────────────────────────────
      // On iOS, cancelling the native camera does NOT fire onChange on the
      // file input. We use focus/visibilitychange (which DO fire when the user
      // returns from the OS camera) to show the fallback sheet instead.
      const sessionId = ++cameraSessionId.current;
      awaitingCameraResult.current = true;

      const dispatchFallbackIfCancelled = () => {
        // Give onChange a short window to fire (Android fires it synchronously
        // before focus, but a small delay is safe for all platforms).
        setTimeout(() => {
          // sessionId guard: if the user quickly re-opens the camera within this
          // 400ms window, cameraSessionId will have been incremented and this
          // stale timer becomes a no-op — preventing a false-positive fallback.
          if (awaitingCameraResult.current && cameraSessionId.current === sessionId) {
            console.log('[Camera] Returned from OS camera without file (iOS cancel?) — showing fallback');
            awaitingCameraResult.current = false;
            window.dispatchEvent(
              new CustomEvent('showCameraFallback', { detail: { reason: 'cancelled' } })
            );
          }
        }, 400);
      };

      // window 'focus' fires when returning from the OS chooser on most Android
      window.addEventListener('focus', restoreScrollState, { once: true });
      window.addEventListener('focus', dispatchFallbackIfCancelled, { once: true });

      // visibilitychange is the backup (some Android WebViews prefer this)
      const onVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          restoreScrollState();
          document.removeEventListener('visibilitychange', onVisibilityChange);
          dispatchFallbackIfCancelled();
        }
      };
      document.addEventListener('visibilitychange', onVisibilityChange);

      immediateCameraInputRef.current.click();
    };

    window.addEventListener('openImmediateCamera', handleOpenImmediateCamera);
    return () => {
      window.removeEventListener('openImmediateCamera', handleOpenImmediateCamera);
    };
  }, []);

  // Handle camera file selection
  const handleCameraFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    // onChange fired — clear the iOS cancellation-detection flag regardless of whether
    // a file was selected. The timeout in dispatchFallbackIfCancelled will be a no-op.
    awaitingCameraResult.current = false;

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
    if (isIosPwa || isAndroidPwa || (isIpad && isPWA)) {
      // iOS PWA, Android PWA, or iPad PWA:
      // Use getUserMedia in-app camera — avoids the OS file-chooser entirely,
      // which prevents scroll-lock issues and opens the camera directly.
      openPwaCamera();
    } else if (isMobile || isPWA || isIpad) {
      // Non-PWA mobile / iPad: open camera via file input (capture="environment")
      openImmediateCamera();
    } else {
      // Desktop: Show options modal
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

  // Scroll-to-top on route change is handled by <ScrollToTop /> in App.tsx.

  async function handleProfileComplete() {
    setShowCompleteProfile(false);
    await refreshProfile();
  }

  // PWA install prompt state — lifted here so we can hide the bottom nav while it's open
  const pwaPrompt = usePwaInstallPrompt();

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
          background: 'var(--bg-nav, rgba(255, 255, 255, 0.95))',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-nav, 0 2px 8px rgba(0, 0, 0, 0.04))',
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
                {/* Wine glass SVG — replaces the emoji for a more refined look */}
                <svg
                  className="w-7 h-7 flex-shrink-0 pointer-events-none"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ color: 'var(--wine-600)' }}
                  aria-hidden="true"
                >
                  {/* Bowl */}
                  <path d="M6.5 3h11L16 11a4 4 0 01-8 0L6.5 3z" />
                  {/* Stem */}
                  <line x1="12" y1="15" x2="12" y2="20" />
                  {/* Base */}
                  <path d="M9 20h6" />
                </svg>

                {/* Title + tagline */}
                <div className="hidden xs:flex flex-col leading-none pointer-events-none gap-0.5">
                  <span
                    className="text-lg sm:text-xl font-bold tracking-wide"
                    style={{
                      fontFamily: 'var(--font-display)',
                      color: 'var(--wine-700)',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {t('app.title')}
                  </span>
                  {/* Tagline — visible on iPad and desktop only */}
                  <span
                    className="hidden md:block text-[9px] font-medium uppercase tracking-widest"
                    style={{ color: 'var(--wine-400)', letterSpacing: '0.18em' }}
                  >
                    {t('app.tagline')}
                  </span>
                </div>
              </button>

              {/* Desktop Navigation - Light Luxury pill tabs (hidden on iPad; bottom nav handles it) */}
              <div className={isIpad ? 'hidden' : 'hidden md:flex gap-2'}>
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
      {/* On iPad the md: CSS rule resets pb-bottom-nav to 2rem, but we're showing the footer
          there too, so override it back to the full nav height via inline style. */}
      <main
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-bottom-nav"
        style={{
          paddingTop: 'calc(4rem + 1.5rem)',
          ...(isIpad ? { paddingBottom: 'calc(104px + env(safe-area-inset-bottom) + 1.5rem)' } : {}),
        }}
      >
        {children}
      </main>

      {/* Mobile Floating Footer with Camera FAB — hidden while the PWA install prompt is open */}
      {!pwaPrompt.isVisible && (
        <MobileFloatingFooter onCameraClick={handleCameraFabClick} isTablet={isIpad} />
      )}

      {/* Global Sommelier FAB — shown on content pages that don't already have it.
          Hidden on /recommendation (has its own), /agent (IS the agent), and admin/auth pages. */}
      {['/cellar', '/history', '/community'].includes(location.pathname) && (
        <SommelierChatButton isGlobal />
      )}

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
          // Retry camera: PWA platforms use getUserMedia in-app camera
          if (isIosPwa || isAndroidPwa || (isIpad && isPWA)) {
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

      {/* PWA Install Prompt — shown after first bottle, not in standalone PWA */}
      <PwaInstallPrompt
        isVisible={pwaPrompt.isVisible}
        platform={pwaPrompt.platform}
        hasNativePrompt={pwaPrompt.hasNativePrompt}
        handleInstall={pwaPrompt.handleInstall}
        handleDismiss={pwaPrompt.handleDismiss}
      />
    </div>
  );
}

