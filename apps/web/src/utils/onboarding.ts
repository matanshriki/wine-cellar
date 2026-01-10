/**
 * Onboarding Utilities - Onboarding v1 – production
 * 
 * Manages onboarding state using localStorage.
 * Shows value-first onboarding to new users only.
 * Re-shows after 7 days if cellar is still empty (re-engagement).
 */

// Onboarding v1 – production: Storage keys
const ONBOARDING_SEEN_KEY = 'wcb_onboarding_seen';
const ONBOARDING_TIMESTAMP_KEY = 'wcb_onboarding_timestamp';
const DEMO_MODE_ACTIVE_KEY = 'wcb_demo_mode_active';
const FIRST_BOTTLE_ADDED_KEY = 'wcb_first_bottle_added';

// Re-engagement: 7 days in milliseconds
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Check if onboarding should be shown
 * Returns true if:
 * 1. User has never seen onboarding, OR
 * 2. User skipped 7+ days ago AND still has empty cellar
 */
export function shouldShowOnboarding(bottleCount: number = 0): boolean {
  const hasSeenOnboarding = localStorage.getItem(ONBOARDING_SEEN_KEY) === 'true';
  
  // First-time user - always show
  if (!hasSeenOnboarding) {
    return true;
  }
  
  // User has seen it before - check if we should re-engage
  const timestampStr = localStorage.getItem(ONBOARDING_TIMESTAMP_KEY);
  if (!timestampStr) {
    // No timestamp (old version) - don't show again
    return false;
  }
  
  const timestamp = parseInt(timestampStr, 10);
  const now = Date.now();
  const daysSinceLastSeen = (now - timestamp) / (24 * 60 * 60 * 1000);
  
  // Re-engagement: Show again if 7+ days passed AND cellar is still empty
  if (daysSinceLastSeen >= 7 && bottleCount === 0) {
    console.log('[Onboarding] Re-engagement: 7+ days passed with empty cellar - showing onboarding again');
    return true;
  }
  
  return false;
}

/**
 * Mark onboarding as seen (user has completed or skipped)
 * Stores timestamp for re-engagement logic
 */
export function markOnboardingSeen(): void {
  localStorage.setItem(ONBOARDING_SEEN_KEY, 'true');
  localStorage.setItem(ONBOARDING_TIMESTAMP_KEY, Date.now().toString());
}

/**
 * Check if demo mode is currently active
 */
export function isDemoModeActive(): boolean {
  return localStorage.getItem(DEMO_MODE_ACTIVE_KEY) === 'true';
}

/**
 * Activate demo mode
 */
export function activateDemoMode(): void {
  localStorage.setItem(DEMO_MODE_ACTIVE_KEY, 'true');
}

/**
 * Deactivate demo mode
 */
export function deactivateDemoMode(): void {
  localStorage.removeItem(DEMO_MODE_ACTIVE_KEY);
}

/**
 * Check if user has added their first bottle
 */
export function hasAddedFirstBottle(): boolean {
  return localStorage.getItem(FIRST_BOTTLE_ADDED_KEY) === 'true';
}

/**
 * Mark that user has added their first bottle
 */
export function markFirstBottleAdded(): void {
  localStorage.setItem(FIRST_BOTTLE_ADDED_KEY, 'true');
  // Onboarding v1 – production: Exit demo mode when first bottle is added
  deactivateDemoMode();
}

/**
 * Reset all onboarding state (for testing/support)
 * Available globally as window.resetOnboarding()
 */
export function resetOnboardingState(): void {
  localStorage.removeItem(ONBOARDING_SEEN_KEY);
  localStorage.removeItem(ONBOARDING_TIMESTAMP_KEY);
  localStorage.removeItem(DEMO_MODE_ACTIVE_KEY);
  localStorage.removeItem(FIRST_BOTTLE_ADDED_KEY);
  console.log('[Onboarding] State reset - refresh to see onboarding');
}

// Expose reset function globally for easy testing and support
(window as any).resetOnboarding = resetOnboardingState;

