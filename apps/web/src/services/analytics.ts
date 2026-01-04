/**
 * Google Analytics 4 (GA4) Integration
 * 
 * PRIVACY & COMPLIANCE:
 * - NO PII (Personally Identifiable Information) is tracked
 * - NO emails, names, or free-text fields are sent to GA
 * - Only internal IDs and app interactions are tracked
 * - Respects user privacy and GDPR/CCPA compliance
 * 
 * USAGE:
 * - Analytics only enabled when VITE_ANALYTICS_ENABLED=true and measurement ID exists
 * - Use trackPageView() for route changes
 * - Use trackEvent() for user actions
 * - Never pass PII in event parameters
 */

// Global gtag types
declare global {
  interface Window {
    gtag?: (
      command: 'config' | 'event' | 'js' | 'set',
      targetId: string | Date,
      params?: Record<string, any>
    ) => void;
    dataLayer?: any[];
  }
}

/**
 * Check if analytics is enabled
 */
export function isAnalyticsEnabled(): boolean {
  const enabled = import.meta.env.VITE_ANALYTICS_ENABLED === 'true';
  const measurementId = import.meta.env.VITE_GA4_MEASUREMENT_ID;
  
  if (!enabled) {
    console.log('[Analytics] Disabled via VITE_ANALYTICS_ENABLED');
    return false;
  }
  
  if (!measurementId) {
    console.warn('[Analytics] No measurement ID provided');
    return false;
  }
  
  return true;
}

/**
 * Check if user has given consent for analytics
 */
export function hasAnalyticsConsent(): boolean {
  // Check localStorage for consent status
  const consent = localStorage.getItem('cookie_consent');
  const analyticsEnabled = localStorage.getItem('analytics_enabled');
  
  // If consent hasn't been given yet, return false (don't track)
  if (!consent) {
    return false;
  }
  
  // Only track if consent was accepted and analytics explicitly enabled
  return consent === 'accepted' && analyticsEnabled === 'true';
}

/**
 * Initialize Google Analytics 4
 * Loads the gtag.js script and initializes tracking
 * Only runs if user has given consent
 */
export function initializeAnalytics(): void {
  if (!isAnalyticsEnabled()) {
    console.log('[Analytics] Skipping initialization - analytics disabled in env');
    return;
  }
  
  // Check if user has given consent
  if (!hasAnalyticsConsent()) {
    console.log('[Analytics] Skipping initialization - user has not given consent');
    return;
  }
  
  const measurementId = import.meta.env.VITE_GA4_MEASUREMENT_ID;
  const debugMode = import.meta.env.DEV; // Enable debug in development
  
  console.log('[Analytics] Initializing GA4:', {
    measurementId,
    debugMode,
    environment: import.meta.env.DEV ? 'development' : 'production',
    consent: 'given',
  });
  
  // Initialize dataLayer
  window.dataLayer = window.dataLayer || [];
  window.gtag = function() {
    window.dataLayer!.push(arguments);
  };
  
  // Set the initial timestamp
  window.gtag('js', new Date());
  
  // Configure GA4 with privacy-friendly settings
  window.gtag('config', measurementId, {
    // Privacy settings
    anonymize_ip: true, // Anonymize IP addresses
    allow_google_signals: false, // Disable Google Signals (cross-device tracking)
    allow_ad_personalization_signals: false, // Disable ad personalization
    
    // Debug mode (only in development)
    debug_mode: debugMode,
    
    // Custom settings
    send_page_view: false, // We'll manually track page views for SPA
    
    // App info
    app_name: 'Wine Cellar Brain',
    app_version: '1.0.0',
  });
  
  // Load the gtag.js script
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);
  
  console.log('[Analytics] ✅ GA4 initialized successfully');
}

/**
 * Track a page view
 * Call this on route changes in React SPA
 * 
 * @param path - The page path (e.g., '/cellar', '/recommendation')
 * @param title - Optional page title
 */
export function trackPageView(path: string, title?: string): void {
  if (!isAnalyticsEnabled() || !hasAnalyticsConsent() || !window.gtag) {
    return;
  }
  
  const measurementId = import.meta.env.VITE_GA4_MEASUREMENT_ID;
  
  console.log('[Analytics] 📄 Page view:', {
    path,
    title: title || document.title,
  });
  
  window.gtag('event', 'page_view', {
    page_path: path,
    page_title: title || document.title,
    page_location: window.location.href,
  });
}

/**
 * Track a custom event
 * 
 * IMPORTANT: Never pass PII in parameters
 * - OK: internal IDs, counts, categories, statuses
 * - NOT OK: emails, names, notes, free-text
 * 
 * @param eventName - Name of the event (e.g., 'bottle_add_manual')
 * @param params - Event parameters (NO PII!)
 */
export function trackEvent(eventName: string, params?: Record<string, any>): void {
  if (!isAnalyticsEnabled() || !hasAnalyticsConsent() || !window.gtag) {
    return;
  }
  
  console.log('[Analytics] 📊 Event:', eventName, params);
  
  // Sanitize params to ensure no PII
  const sanitizedParams = sanitizeEventParams(params);
  
  window.gtag('event', eventName, sanitizedParams);
}

/**
 * Sanitize event parameters to remove any potential PII
 * 
 * @param params - Raw event parameters
 * @returns Sanitized parameters safe for analytics
 */
function sanitizeEventParams(params?: Record<string, any>): Record<string, any> | undefined {
  if (!params) {
    return undefined;
  }
  
  const sanitized: Record<string, any> = {};
  
  // List of keys that should NEVER be sent (PII protection)
  const blockedKeys = [
    'email',
    'name',
    'display_name',
    'first_name',
    'last_name',
    'notes',
    'tasting_notes',
    'user_notes',
    'wine_notes',
    'producer', // Producer names could be considered identifying
    'wine_name', // Wine names could be considered identifying
  ];
  
  for (const [key, value] of Object.entries(params)) {
    // Skip blocked keys
    if (blockedKeys.some(blocked => key.toLowerCase().includes(blocked))) {
      console.warn(`[Analytics] ⚠️ Blocked PII field: ${key}`);
      continue;
    }
    
    // Only include primitive values and numbers
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = value;
    }
  }
  
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

/**
 * Track authentication events
 */
export const trackAuth = {
  signUp: () => trackEvent('sign_up'),
  login: () => trackEvent('login'),
  logout: () => trackEvent('logout'),
};

/**
 * Track bottle-related events
 */
export const trackBottle = {
  addManual: () => trackEvent('bottle_add_manual'),
  addScan: () => trackEvent('bottle_add_scan'),
  edit: () => trackEvent('bottle_edit'),
  delete: () => trackEvent('bottle_delete'),
  opened: (vintage?: number) => 
    trackEvent('bottle_opened', vintage ? { vintage } : undefined),
};

/**
 * Track CSV import events
 */
export const trackCSV = {
  start: () => trackEvent('bottle_import_csv_start'),
  success: (count: number) => trackEvent('bottle_import_csv_success', { bottle_count: count }),
  error: (errorType: string) => trackEvent('bottle_import_csv_error', { error_type: errorType }),
};

/**
 * Track recommendation events
 */
export const trackRecommendation = {
  run: (mealType?: string, occasion?: string) => 
    trackEvent('recommendation_run', {
      meal_type: mealType,
      occasion: occasion,
    }),
  resultsShown: (resultCount: number) => 
    trackEvent('recommendation_results_shown', { result_count: resultCount }),
};

/**
 * Track AI label generation events
 */
export const trackAILabel = {
  start: (style: string) => trackEvent('ai_label_generate_start', { style }),
  success: (style: string) => trackEvent('ai_label_generate_success', { style }),
  error: (errorType: string) => trackEvent('ai_label_generate_error', { error_type: errorType }),
};

/**
 * Track AI label parsing/scanning events (OCR)
 */
export const trackLabelParse = {
  start: (source: 'camera' | 'library') => trackEvent('label_parse_start', { source }),
  success: (fieldsExtracted: number, source: 'camera' | 'library') => 
    trackEvent('label_parse_success', { 
      fields_extracted: fieldsExtracted,
      source,
    }),
  error: (errorType: string, source: 'camera' | 'library', errorMessage?: string) => 
    trackEvent('label_parse_error', { 
      error_type: errorType,
      source,
      error_message: errorMessage ? errorMessage.substring(0, 100) : undefined, // Truncate to 100 chars
    }),
};

/**
 * Track upload events
 */
export const trackUpload = {
  profileAvatarSuccess: () => trackEvent('profile_avatar_upload_success'),
  profileAvatarError: (errorType: string) => 
    trackEvent('profile_avatar_upload_error', { error_type: errorType }),
  bottleImageSuccess: () => trackEvent('bottle_image_upload_success'),
  bottleImageError: (errorType: string) => 
    trackEvent('bottle_image_upload_error', { error_type: errorType }),
};

/**
 * Track app errors (NO PII - only error types and codes)
 */
export const trackError = {
  appError: (errorType: string, errorCode?: string) => 
    trackEvent('app_error', {
      error_type: errorType,
      error_code: errorCode,
    }),
  apiError: (endpoint: string, statusCode: number) => 
    trackEvent('api_error', {
      endpoint: endpoint.replace(/\/[0-9a-f-]{36}/gi, '/:id'), // Remove IDs from URLs
      status_code: statusCode,
    }),
};

/**
 * Track sommelier AI analysis events
 */
export const trackSommelier = {
  generate: () => trackEvent('sommelier_notes_generate'),
  success: () => trackEvent('sommelier_notes_success'),
  error: (errorType: string) => trackEvent('sommelier_notes_error', { error_type: errorType }),
};

/**
 * Track language/localization events
 */
export const trackLocalization = {
  changeLanguage: (language: string) => trackEvent('language_change', { language }),
};

