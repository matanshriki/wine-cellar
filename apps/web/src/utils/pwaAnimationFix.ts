/**
 * PWA Animation Fix Utilities
 * 
 * Handles animation issues in PWA standalone mode where:
 * 1. prefers-reduced-motion is incorrectly forced to 'reduce'
 * 2. Animations don't start when app loads in background
 * 3. requestAnimationFrame doesn't fire properly on initial load
 * 
 * Production-ready fix for iOS Safari and Android Chrome PWAs.
 */

/**
 * Check if app is running in standalone PWA mode
 */
export function isPWAStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  );
}

/**
 * Check if user ACTUALLY wants reduced motion (not just PWA false positive)
 * 
 * PWA standalone mode incorrectly reports prefers-reduced-motion: reduce on iOS/Android.
 * This function detects the real user preference by checking localStorage override.
 * 
 * Returns: true only if user explicitly enabled reduced motion
 */
export function shouldReduceMotion(): boolean {
  // Check if user explicitly set reduced motion preference
  try {
    const userPref = localStorage.getItem('wine-cellar-reduce-motion');
    if (userPref !== null) {
      return userPref === 'true';
    }
  } catch (e) {
    console.warn('[PWA Animation] Failed to read user preference:', e);
  }

  // If in PWA standalone, assume animations are OK unless explicitly disabled
  // (PWA incorrectly reports prefers-reduced-motion: reduce)
  if (isPWAStandalone()) {
    console.log('[PWA Animation] Running in standalone mode - enabling animations by default');
    return false;
  }

  // In regular browser, respect system preference
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Set user's reduced motion preference explicitly
 */
export function setReduceMotionPreference(reduce: boolean): void {
  try {
    localStorage.setItem('wine-cellar-reduce-motion', reduce.toString());
    console.log('[PWA Animation] User preference saved:', reduce);
  } catch (e) {
    console.warn('[PWA Animation] Failed to save user preference:', e);
  }
}

/**
 * Ensure animations start even if app loaded in background
 * 
 * In PWA mode, if the app starts while not visible, requestAnimationFrame
 * won't fire. This function detects visibility changes and triggers a callback.
 */
export function ensureAnimationOnVisible(callback: () => void): () => void {
  let hasTriggered = false;

  const trigger = () => {
    if (!hasTriggered && document.visibilityState === 'visible') {
      console.log('[PWA Animation] Page visible - starting animations');
      hasTriggered = true;
      // Use requestAnimationFrame to ensure we're ready to animate
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          callback();
        });
      });
    }
  };

  // Trigger immediately if already visible
  if (document.visibilityState === 'visible') {
    trigger();
  }

  // Listen for visibility changes
  document.addEventListener('visibilitychange', trigger);
  window.addEventListener('focus', trigger);

  // Cleanup function
  return () => {
    document.removeEventListener('visibilitychange', trigger);
    window.removeEventListener('focus', trigger);
  };
}

/**
 * Force animation restart for elements using Tailwind animate-* classes
 * 
 * PWA issue: Tailwind animations don't start if CSS sets animation-duration: 0.01ms
 * This function forces a reflow to restart the animation.
 */
export function restartTailwindAnimations(): void {
  const animatedElements = document.querySelectorAll(
    '[class*="animate-spin"], [class*="animate-bounce"], [class*="animate-ping"], [class*="animate-pulse"]'
  );

  console.log('[PWA Animation] Restarting', animatedElements.length, 'Tailwind animations');

  animatedElements.forEach((el) => {
    const htmlEl = el as HTMLElement;
    // Force reflow by toggling display
    const originalDisplay = htmlEl.style.display;
    htmlEl.style.display = 'none';
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    htmlEl.offsetHeight; // Force reflow
    htmlEl.style.display = originalDisplay;
  });
}

/**
 * Apply PWA animation fix class to body
 * This allows CSS to differentiate between real reduced-motion and PWA false positive
 */
export function applyPWAAnimationFix(): void {
  if (isPWAStandalone() && !shouldReduceMotion()) {
    document.body.classList.add('pwa-animations-enabled');
    console.log('[PWA Animation] PWA animations enabled');
  }
}

/**
 * Initialize PWA animation fixes on app load
 * Call this in your main.tsx or App.tsx
 */
export function initPWAAnimationFixes(): void {
  console.log('[PWA Animation] Initializing fixes...');
  
  // Apply body class for CSS targeting
  applyPWAAnimationFix();

  // Ensure animations start when visible
  ensureAnimationOnVisible(() => {
    console.log('[PWA Animation] Page became visible - restarting animations');
    restartTailwindAnimations();
  });

  // Also restart on page focus (PWA coming from background)
  window.addEventListener('focus', () => {
    console.log('[PWA Animation] Page focused - checking animations');
    setTimeout(() => restartTailwindAnimations(), 100);
  });

  // Listen for display-mode changes
  const mediaQuery = window.matchMedia('(display-mode: standalone)');
  const handleDisplayModeChange = () => {
    console.log('[PWA Animation] Display mode changed');
    applyPWAAnimationFix();
  };
  
  try {
    mediaQuery.addEventListener('change', handleDisplayModeChange);
  } catch (e) {
    // Fallback for older browsers
    mediaQuery.addListener(handleDisplayModeChange);
  }
}
