// Feedback iteration (dev only)
/**
 * Dev-only utilities for localhost testing
 * 
 * These functions help guard experimental features to localhost/dev environments only.
 * No production deployment - safe for testing UX and flows.
 */

/**
 * Check if we're in a dev environment
 * Returns true ONLY on localhost or when DEV env var is set
 */
export function isDevEnvironment(): boolean {
  // Check hostname
  const isLocalhost = 
    typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || 
     window.location.hostname === '127.0.0.1' ||
     window.location.hostname.startsWith('192.168.'));
  
  // Check environment variable
  const isDevMode = 
    import.meta.env.DEV === true || 
    import.meta.env.MODE === 'development' ||
    process.env.NODE_ENV === 'development';
  
  return isLocalhost || isDevMode;
}

/**
 * Log message only in dev
 */
export function devLog(message: string, ...args: any[]) {
  if (isDevEnvironment()) {
    console.log(`[DEV] ${message}`, ...args);
  }
}

