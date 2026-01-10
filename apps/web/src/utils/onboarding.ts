/**
 * Onboarding Utilities - Onboarding v1 – production
 * 
 * Manages onboarding state using localStorage.
 * Shows value-first onboarding to new users only.
 */

// Onboarding v1 – production: Storage keys
const ONBOARDING_SEEN_KEY = 'wcb_onboarding_seen';
const DEMO_MODE_ACTIVE_KEY = 'wcb_demo_mode_active';
const FIRST_BOTTLE_ADDED_KEY = 'wcb_first_bottle_added';

/**
 * Check if onboarding should be shown (first-time user)
 * Returns true for users who haven't seen onboarding yet
 */
export function shouldShowOnboarding(): boolean {
  return !localStorage.getItem(ONBOARDING_SEEN_KEY);
}

/**
 * Mark onboarding as seen (user has completed or skipped)
 */
export function markOnboardingSeen(): void {
  localStorage.setItem(ONBOARDING_SEEN_KEY, 'true');
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
  localStorage.removeItem(DEMO_MODE_ACTIVE_KEY);
  localStorage.removeItem(FIRST_BOTTLE_ADDED_KEY);
  console.log('[Onboarding] State reset - refresh to see onboarding');
}

// Expose reset function globally for easy testing and support
(window as any).resetOnboarding = resetOnboardingState;

