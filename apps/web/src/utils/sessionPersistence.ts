/**
 * Session Persistence Utilities
 * 
 * Handles session recovery and persistence for PWA/standalone mode on iOS.
 * iOS can clear session storage when the app is reopened from the home screen.
 * 
 * Also implements client-side session timeouts:
 * - Maximum session duration: 7 days (absolute timeout)
 * - Inactivity timeout: 3 days (no user interaction)
 */

const SESSION_CHECK_KEY = 'wine-cellar-session-active';
const LAST_ACTIVITY_KEY = 'wine-cellar-last-activity';
const SESSION_START_KEY = 'wine-cellar-session-start';

// Session timeout constants (in milliseconds)
const MAX_SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
const INACTIVITY_TIMEOUT = 3 * 24 * 60 * 60 * 1000;   // 3 days

/**
 * Mark session as active and update activity timestamp
 * Also sets session start time if this is a new session
 */
export function markSessionActive(): void {
  try {
    const now = Date.now().toString();
    localStorage.setItem(SESSION_CHECK_KEY, 'true');
    localStorage.setItem(LAST_ACTIVITY_KEY, now);
    
    // Set session start time if not already set
    if (!localStorage.getItem(SESSION_START_KEY)) {
      localStorage.setItem(SESSION_START_KEY, now);
      console.log('[Session] New session started');
    }
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
 * Clear session markers (called on logout)
 */
export function clearSessionMarkers(): void {
  try {
    localStorage.removeItem(SESSION_CHECK_KEY);
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    localStorage.removeItem(SESSION_START_KEY);
  } catch (error) {
    console.warn('Failed to clear session markers:', error);
  }
}

/**
 * Check if the session has exceeded maximum duration (7 days)
 * Returns { expired: boolean, reason?: string, timeRemaining?: number }
 */
export function checkSessionTimeout(): { expired: boolean; reason?: string; timeRemaining?: number } {
  try {
    const sessionStart = localStorage.getItem(SESSION_START_KEY);
    const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
    
    if (!sessionStart || !lastActivity) {
      return { expired: false };
    }
    
    const now = Date.now();
    const sessionStartTime = parseInt(sessionStart, 10);
    const lastActivityTime = parseInt(lastActivity, 10);
    
    // Check absolute session duration (7 days from start)
    const sessionAge = now - sessionStartTime;
    if (sessionAge > MAX_SESSION_DURATION) {
      const daysOld = Math.floor(sessionAge / (24 * 60 * 60 * 1000));
      console.log(`[Session] Session expired: ${daysOld} days old (max 7 days)`);
      return { 
        expired: true, 
        reason: `Session expired after ${daysOld} days. Please log in again.` 
      };
    }
    
    // Check inactivity timeout (3 days since last activity)
    const timeSinceActivity = now - lastActivityTime;
    if (timeSinceActivity > INACTIVITY_TIMEOUT) {
      const daysInactive = Math.floor(timeSinceActivity / (24 * 60 * 60 * 1000));
      console.log(`[Session] Session expired: ${daysInactive} days inactive (max 3 days)`);
      return { 
        expired: true, 
        reason: `Session expired due to ${daysInactive} days of inactivity. Please log in again.` 
      };
    }
    
    // Session is still valid - return time remaining
    const timeUntilExpiry = Math.min(
      MAX_SESSION_DURATION - sessionAge,
      INACTIVITY_TIMEOUT - timeSinceActivity
    );
    
    return { 
      expired: false, 
      timeRemaining: timeUntilExpiry 
    };
    
  } catch (error) {
    console.warn('Failed to check session timeout:', error);
    return { expired: false };
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




