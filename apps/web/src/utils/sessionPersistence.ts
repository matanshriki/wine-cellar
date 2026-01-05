/**
 * Session Persistence Utilities
 * 
 * Handles session recovery and persistence for PWA/standalone mode on iOS.
 * iOS can clear session storage when the app is reopened from the home screen.
 */

const SESSION_CHECK_KEY = 'wine-cellar-session-active';
const LAST_ACTIVITY_KEY = 'wine-cellar-last-activity';

/**
 * Mark session as active
 */
export function markSessionActive(): void {
  try {
    localStorage.setItem(SESSION_CHECK_KEY, 'true');
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
  } catch (error) {
    console.warn('Failed to mark session as active:', error);
  }
}

/**
 * Check if we should attempt session recovery
 * Returns true if there was recent activity (within last 7 days)
 */
export function shouldRecoverSession(): boolean {
  try {
    const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
    if (!lastActivity) return false;

    const lastActivityTime = parseInt(lastActivity, 10);
    const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
    const timeSinceLastActivity = Date.now() - lastActivityTime;

    return timeSinceLastActivity < sevenDaysInMs;
  } catch (error) {
    console.warn('Failed to check session recovery:', error);
    return false;
  }
}

/**
 * Clear session markers
 */
export function clearSessionMarkers(): void {
  try {
    localStorage.removeItem(SESSION_CHECK_KEY);
    localStorage.removeItem(LAST_ACTIVITY_KEY);
  } catch (error) {
    console.warn('Failed to clear session markers:', error);
  }
}

/**
 * Check if app is running in standalone mode (iOS home screen)
 */
export function isStandalone(): boolean {
  // Check if running as a PWA/standalone app
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  );
}

/**
 * Setup periodic session refresh to keep it alive
 */
export function setupSessionKeepAlive(callback: () => Promise<void>): () => void {
  // Update activity marker every 5 minutes
  const intervalId = setInterval(() => {
    markSessionActive();
    // Optionally trigger a session refresh
    callback().catch(err => console.warn('Session refresh failed:', err));
  }, 5 * 60 * 1000);

  // Also update on user interaction
  const updateActivity = () => markSessionActive();
  window.addEventListener('click', updateActivity, { passive: true });
  window.addEventListener('touchstart', updateActivity, { passive: true });
  window.addEventListener('scroll', updateActivity, { passive: true });

  // Cleanup function
  return () => {
    clearInterval(intervalId);
    window.removeEventListener('click', updateActivity);
    window.removeEventListener('touchstart', updateActivity);
    window.removeEventListener('scroll', updateActivity);
  };
}




