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
