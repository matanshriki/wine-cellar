/**
 * Device and Platform Detection Utilities
 * 
 * Helpers for detecting iOS, PWA mode, and other platform-specific behaviors
 */

/**
 * Detect if running on iOS (iPhone, iPad, iPod)
 */
export function isIos(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * Detect if running as a PWA in standalone mode
 */
export function isStandalonePwa(): boolean {
  // Standard PWA detection
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }
  
  // iOS-specific PWA detection
  if ((navigator as any).standalone === true) {
    return true;
  }
  
  // Android PWA detection (some browsers)
  if (document.referrer.includes('android-app://')) {
    return true;
  }
  
  return false;
}

/**
 * Detect if running as iOS PWA (standalone)
 * This is the specific case where we want to use getUserMedia instead of file input
 */
export function isIosStandalonePwa(): boolean {
  return isIos() && isStandalonePwa();
}

/**
 * Detect if running on Android
 */
export function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent);
}

/**
 * Detect if running as Android PWA (standalone)
 * Like iOS PWA, we prefer getUserMedia over the file-input OS chooser.
 */
export function isAndroidPwa(): boolean {
  return isAndroid() && isStandalonePwa();
}

/**
 * Detect if running on mobile (any mobile device)
 */
export function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Detect if running on Samsung browser (has special camera handling quirks)
 */
export function isSamsungBrowser(): boolean {
  return /Samsung/i.test(navigator.userAgent) || /SamsungBrowser/i.test(navigator.userAgent);
}

/**
 * Detect if running on an iPad.
 *
 * Covers two generations:
 *  - Older iPads (pre-iOS 13): "iPad" appears in the user-agent string.
 *  - Modern iPads (iOS 13+): Apple switched to the desktop Safari UA
 *    ("Macintosh; Intel Mac OS X …"), but the device still reports
 *    navigator.maxTouchPoints > 1 (unlike a real Mac).
 */
export function isIPad(): boolean {
  const ua = navigator.userAgent;
  if (/iPad/i.test(ua)) return true;
  if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return true;
  return false;
}
