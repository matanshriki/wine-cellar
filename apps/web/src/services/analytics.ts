/**
 * Google Analytics 4 (GA4) — Privacy-safe SPA analytics
 *
 * DESIGN PRINCIPLES
 * - Zero PII: no emails, names, or free-text fields ever leave the device
 * - Consent-first: GA script is only loaded after the user accepts analytics
 * - Pseudonymous: logged-in users are identified by Supabase UUID only
 * - Context-rich: every event carries app_session_id, language, theme, is_pwa
 *
 * USAGE
 *   import { trackEvent, trackBottle, trackAuth, … } from './analytics';
 *
 * ENV VARS
 *   VITE_GA4_MEASUREMENT_ID   GA4 measurement ID (e.g. G-XXXXXXXXXX)
 *   VITE_ANALYTICS_ENABLED    Set to "true" to enable tracking
 *   VITE_GA_DEBUG             Set to "true" to enable GA DebugView (dev-only)
 *
 * UTM LINK TEMPLATES (attach to links you control for reliable AI attribution)
 *   ?utm_source=chatgpt&utm_medium=ai&utm_campaign=aeo
 *   ?utm_source=gemini&utm_medium=ai&utm_campaign=aeo
 *   ?utm_source=perplexity&utm_medium=ai&utm_campaign=aeo
 *   ?ai_source=<engine>   (highest priority, custom param)
 */

import {
  isIos,
  isAndroid,
  isIPad,
  isStandalonePwa,
} from '../utils/deviceDetection';
import { sendAttributionToGA } from './aiAttribution';

// ── Global gtag types ─────────────────────────────────────────────────────────

declare global {
  interface Window {
    gtag?: (
      command: 'config' | 'event' | 'js' | 'set',
      targetId: string | Date,
      params?: Record<string, unknown>
    ) => void;
    dataLayer?: unknown[];
  }
}

// ── Session ID ────────────────────────────────────────────────────────────────

const SESSION_ID_KEY = 'app_session_id';

/** Generate a v4-style UUID without any external library. */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get or create the anonymous session ID stored in sessionStorage.
 * Resets automatically when the browser tab/window is closed.
 */
export function getAppSessionId(): string {
  let id = sessionStorage.getItem(SESSION_ID_KEY);
  if (!id) {
    id = generateUUID();
    sessionStorage.setItem(SESSION_ID_KEY, id);
  }
  return id;
}

// ── Context params ────────────────────────────────────────────────────────────

/**
 * Returns lightweight context parameters that are appended to every event.
 * Reads from localStorage / DOM so it can be called outside React.
 * Contains NO PII.
 */
function getContextParams(): Record<string, unknown> {
  return {
    app_session_id: getAppSessionId(),
    language: document.documentElement.lang || localStorage.getItem('i18nextLng') || 'en',
    theme: localStorage.getItem('theme') || 'white',
    is_pwa: isStandalonePwa(),
  };
}

// ── Guards ────────────────────────────────────────────────────────────────────

/** True when GA is configured via env and the user hasn't opted out. */
export function isAnalyticsEnabled(): boolean {
  const enabled = import.meta.env.VITE_ANALYTICS_ENABLED === 'true';
  const measurementId = import.meta.env.VITE_GA4_MEASUREMENT_ID;

  if (!enabled) return false;
  if (!measurementId) {
    console.warn('[Analytics] No measurement ID — set VITE_GA4_MEASUREMENT_ID');
    return false;
  }
  // Runtime opt-out (see disableAnalytics())
  if (localStorage.getItem('analytics_disabled') === 'true') return false;

  return true;
}

/** True when the user has explicitly accepted the cookie consent banner. */
export function hasAnalyticsConsent(): boolean {
  const consent = localStorage.getItem('cookie_consent');
  const analyticsEnabled = localStorage.getItem('analytics_enabled');
  return consent === 'accepted' && analyticsEnabled === 'true';
}

/** Disable analytics at runtime (called when user opts out). */
export function disableAnalytics(): void {
  localStorage.setItem('analytics_disabled', 'true');
  localStorage.setItem('cookie_consent', 'rejected');
  localStorage.setItem('analytics_enabled', 'false');
  console.log('[Analytics] Disabled by user');
}

// ── Initialisation ────────────────────────────────────────────────────────────

/**
 * Grant analytics consent and activate GA4 data collection.
 *
 * The gtag.js script is already loaded from index.html with consent denied by
 * default (Consent Mode v2). This function upgrades consent to "granted" once
 * the user accepts the cookie banner, which unblocks data collection.
 *
 * Safe to call multiple times — guarded by a sessionStorage flag.
 */
export function initializeAnalytics(): void {
  if (!isAnalyticsEnabled()) {
    console.log('[Analytics] Skipping — disabled or no measurement ID');
    return;
  }

  if (!hasAnalyticsConsent()) {
    console.log('[Analytics] Skipping — waiting for consent');
    return;
  }

  // Guard: already activated this session
  if (sessionStorage.getItem('ga4_consent_granted')) {
    console.log('[Analytics] Already activated');
    return;
  }
  sessionStorage.setItem('ga4_consent_granted', '1');

  // gtag is always available from index.html — no script injection needed
  if (!window.gtag) {
    console.warn('[Analytics] gtag not found — check index.html');
    return;
  }

  const measurementId = import.meta.env.VITE_GA4_MEASUREMENT_ID as string;
  const debugMode = import.meta.env.VITE_GA_DEBUG === 'true' || import.meta.env.DEV;

  // Upgrade consent from 'denied' (set in index.html) to 'granted'
  window.gtag('consent', 'update', {
    analytics_storage: 'granted',
  });

  // Apply debug mode and any runtime config overrides
  window.gtag('config', measurementId, {
    send_page_view: false,
    debug_mode: debugMode,
    app_name: 'Sommi',
  });

  // Platform user property (persistent across this session)
  const platform = detectPlatform();
  window.gtag('set', 'user_properties', { platform });

  // Send queued AI attribution (once per session)
  sendAttributionToGA();

  console.log('[Analytics] ✅ GA4 consent granted + activated', { measurementId, debugMode, platform });
}

// ── User identity ─────────────────────────────────────────────────────────────

/**
 * Set a pseudonymous GA4 user_id from the Supabase auth UUID.
 * Called when the user signs in. Does NOT send any PII.
 */
export function setAnalyticsUser(supabaseUserId: string): void {
  if (!isAnalyticsEnabled() || !hasAnalyticsConsent() || !window.gtag) return;

  const measurementId = import.meta.env.VITE_GA4_MEASUREMENT_ID as string;
  window.gtag('config', measurementId, { user_id: supabaseUserId });

  console.log('[Analytics] User ID set (pseudonymous)');
}

/**
 * Clear the GA4 user_id when the user signs out.
 */
export function clearAnalyticsUser(): void {
  if (!window.gtag) return;

  const measurementId = import.meta.env.VITE_GA4_MEASUREMENT_ID as string;
  if (!measurementId) return;

  window.gtag('config', measurementId, { user_id: undefined });
  console.log('[Analytics] User ID cleared');
}

/**
 * Set persistent user properties on the GA4 session.
 * Call this when user preferences load (language, theme, etc.).
 * Silently skips when GA is not ready.
 */
export function setAnalyticsUserProperties(
  props: Partial<{
    language: string;
    theme: string;
    is_pwa: boolean;
    platform: AppPlatform;
  }>
): void {
  if (!isAnalyticsEnabled() || !hasAnalyticsConsent() || !window.gtag) return;
  window.gtag('set', 'user_properties', props as Record<string, unknown>);
}

// ── Page views ────────────────────────────────────────────────────────────────

/**
 * Track a page view.
 * Called by useGaPageViews on every React Router location change.
 */
export function trackPageView(path: string, title?: string): void {
  if (!isAnalyticsEnabled() || !hasAnalyticsConsent() || !window.gtag) return;

  const referrerDomain = (() => {
    try {
      return document.referrer ? new URL(document.referrer).hostname : '';
    } catch {
      return '';
    }
  })();

  window.gtag('event', 'page_view', {
    page_path: path,
    page_title: title || document.title,
    page_location: window.location.href,
    ...(referrerDomain ? { referrer_domain: referrerDomain } : {}),
    ...getContextParams(),
  });

  if (import.meta.env.DEV) {
    console.log('[Analytics] page_view', path);
  }
}

// ── Core event helper ─────────────────────────────────────────────────────────

/**
 * Track a custom GA4 event.
 * Context params (app_session_id, language, theme, is_pwa) are auto-appended.
 * PII fields are stripped before sending.
 */
export function trackEvent(eventName: string, params?: Record<string, unknown>): void {
  if (!isAnalyticsEnabled() || !hasAnalyticsConsent() || !window.gtag) return;

  const merged = { ...getContextParams(), ...sanitizeEventParams(params) };

  window.gtag('event', eventName, merged);

  if (import.meta.env.DEV) {
    console.log('[Analytics] event', eventName, merged);
  }
}

// ── PII sanitiser ─────────────────────────────────────────────────────────────

const BLOCKED_KEYS = new Set([
  'email',
  'name',
  'display_name',
  'first_name',
  'last_name',
  'notes',
  'tasting_notes',
  'user_notes',
  'wine_notes',
  'producer',
  'wine_name',
]);

function sanitizeEventParams(
  params?: Record<string, unknown>
): Record<string, unknown> {
  if (!params) return {};

  const safe: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(params)) {
    const keyLower = key.toLowerCase();
    const isBlocked = [...BLOCKED_KEYS].some((b) => keyLower.includes(b));

    if (isBlocked) {
      if (import.meta.env.DEV) {
        console.warn('[Analytics] ⚠ Blocked PII field:', key);
      }
      continue;
    }

    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      safe[key] = value;
    }
  }

  return safe;
}

// ── Platform detection ────────────────────────────────────────────────────────

export type AppPlatform =
  | 'ios_pwa'
  | 'android_pwa'
  | 'ipad_pwa'
  | 'ios_mobile_web'
  | 'android_mobile_web'
  | 'ipad_web'
  | 'desktop_web';

export function detectPlatform(): AppPlatform {
  const pwa = isStandalonePwa();
  const ios = isIos();
  const android = isAndroid();
  const ipad = isIPad();

  if (pwa) {
    if (ipad) return 'ipad_pwa';
    if (ios) return 'ios_pwa';
    if (android) return 'android_pwa';
    return 'desktop_web';
  }

  if (ipad) return 'ipad_web';
  if (ios) return 'ios_mobile_web';
  if (android) return 'android_mobile_web';
  return 'desktop_web';
}

export const trackPlatform = {
  identify: () => {
    if (!isAnalyticsEnabled() || !hasAnalyticsConsent() || !window.gtag) return;
    const platform = detectPlatform();
    window.gtag('set', 'user_properties', { platform });
    trackEvent('platform_identified', { platform });
  },
};

// ── Auth events ───────────────────────────────────────────────────────────────

export const trackAuth = {
  signUp: (provider: 'email' | 'google' = 'email') =>
    trackEvent('sign_up', { provider, platform: detectPlatform() }),

  login: (provider: 'email' | 'google' = 'email') =>
    trackEvent('login_success', { provider, platform: detectPlatform() }),

  logout: () => trackEvent('logout'),
};

// ── Bottle events ─────────────────────────────────────────────────────────────

export const trackBottle = {
  /**
   * A bottle was added to the cellar.
   * @param method  How it was added
   * @param quantity  Number of bottles added in this operation
   */
  added: (
    method: 'manual' | 'scan' | 'csv' | 'receipt' | 'multi',
    quantity: number = 1
  ) => trackEvent('bottle_added', { method, quantity }),

  /** @deprecated Use trackBottle.added('manual') */
  addManual: () => trackBottle.added('manual'),

  /** @deprecated Use trackBottle.added('scan', count) */
  addScan: (mode?: string, count?: number) => {
    trackBottle.added(
      mode === 'receipt' ? 'receipt' : mode === 'multi' ? 'multi' : 'scan',
      count ?? 1
    );
  },

  edit: () => trackEvent('bottle_edited'),
  delete: () => trackEvent('bottle_deleted'),

  /**
   * A bottle was marked as opened.
   * @param from  Where the user triggered the open action
   */
  opened: (params?: {
    quantity?: number;
    vintage?: number;
    from?: 'tonight' | 'plan' | 'agent' | 'details' | 'cellar';
  }) =>
    trackEvent('bottle_opened', {
      quantity: params?.quantity ?? 1,
      ...(params?.vintage ? { vintage: params.vintage } : {}),
      ...(params?.from ? { from: params.from } : {}),
    }),
};

// ── Scan events ───────────────────────────────────────────────────────────────

export const trackLabelParse = {
  /** Scan pipeline started */
  start: (params?: { source?: 'camera' | 'gallery'; mode?: 'label' | 'receipt' | 'multi' }) =>
    trackEvent('scan_started', {
      source: params?.source ?? 'unknown',
      mode: params?.mode ?? 'label',
    }),

  /** Scan returned valid results */
  success: (
    mode: 'single' | 'multi' | 'receipt',
    detectedCount: number,
    confidence?: number
  ) =>
    trackEvent('scan_success', {
      mode,
      detected_count: detectedCount,
      ...(confidence !== undefined ? { confidence: Math.round(confidence * 100) } : {}),
    }),

  /** Scan pipeline threw an error */
  error: (errorType: string) =>
    trackEvent('scan_failed', { error_code: errorType }),
};

// ── CSV events ────────────────────────────────────────────────────────────────

export const trackCSV = {
  start: () => trackEvent('bottle_import_csv_start'),
  success: (count: number) =>
    trackEvent('bottle_import_csv_success', { bottle_count: count }),
  error: (errorType: string) =>
    trackEvent('bottle_import_csv_error', { error_type: errorType }),
};

// ── Recommendation / Plan Evening events ─────────────────────────────────────

export const trackRecommendation = {
  run: (mealType?: string, occasion?: string) =>
    trackEvent('recommendation_run', {
      meal_type: mealType,
      occasion: occasion,
    }),
  resultsShown: (resultCount: number) =>
    trackEvent('recommendation_results_shown', { result_count: resultCount }),
};

export const trackEveningPlan = {
  started: (params?: { occasion?: string; group_size?: number }) =>
    trackEvent('plan_evening_started', {
      ...(params?.occasion ? { occasion: params.occasion } : {}),
      ...(params?.group_size !== undefined ? { group_size: params.group_size } : {}),
    }),

  completed: (params?: { opened_count?: number; avg_rating?: number }) =>
    trackEvent('plan_evening_completed', {
      opened_count: params?.opened_count ?? 0,
      ...(params?.avg_rating !== undefined
        ? { avg_rating: Math.round(params.avg_rating * 10) / 10 }
        : {}),
    }),
};

// ── Wishlist events ───────────────────────────────────────────────────────────

export const trackWishlist = {
  added: () => trackEvent('wishlist_added'),
  movedToCellar: () => trackEvent('wishlist_moved_to_cellar'),
};

// ── AI Agent / Sommelier events ───────────────────────────────────────────────

export const trackSommelier = {
  generate: () => trackEvent('sommelier_notes_generate'),
  success: () => trackEvent('sommelier_notes_success'),
  error: (errorType: string) =>
    trackEvent('sommelier_notes_error', { error_type: errorType }),

  agentButtonClick: (source: string) =>
    trackEvent('sommelier_agent_click', { source, platform: detectPlatform() }),

  agentOpen: () =>
    trackEvent('sommelier_agent_open', { platform: detectPlatform() }),

  /**
   * User sent a query to the AI agent.
   * Send only the intent category — NEVER the raw query text.
   */
  agentQuery: (intentCategory: string) =>
    trackEvent('agent_query', { intent_category: intentCategory }),

  /** User tapped a recommendation card returned by the agent. */
  agentRecommendationClicked: (type: 'single' | 'multi') =>
    trackEvent('agent_recommendation_clicked', { recommendation_type: type }),
};

// ── Upload events ─────────────────────────────────────────────────────────────

export const trackUpload = {
  profileAvatarSuccess: () => trackEvent('profile_avatar_upload_success'),
  profileAvatarError: (errorType: string) =>
    trackEvent('profile_avatar_upload_error', { error_type: errorType }),
  bottleImageSuccess: () => trackEvent('bottle_image_upload_success'),
  bottleImageError: (errorType: string) =>
    trackEvent('bottle_image_upload_error', { error_type: errorType }),
};

// ── Error events ──────────────────────────────────────────────────────────────

export const trackError = {
  appError: (errorType: string, errorCode?: string) =>
    trackEvent('app_error', { error_type: errorType, error_code: errorCode }),
  apiError: (endpoint: string, statusCode: number) =>
    trackEvent('api_error', {
      // Strip UUIDs from endpoint paths before logging
      endpoint: endpoint.replace(/\/[0-9a-f-]{36}/gi, '/:id'),
      status_code: statusCode,
    }),
};

// ── Localisation events ───────────────────────────────────────────────────────

export const trackLocalization = {
  changeLanguage: (language: string) =>
    trackEvent('language_change', { language }),
};

// ── AI label events (legacy aliases) ─────────────────────────────────────────

export const trackAILabel = {
  start: (style: string) => trackEvent('ai_label_generate_start', { style }),
  success: (style: string) => trackEvent('ai_label_generate_success', { style }),
  error: (errorType: string) =>
    trackEvent('ai_label_generate_error', { error_type: errorType }),
};
