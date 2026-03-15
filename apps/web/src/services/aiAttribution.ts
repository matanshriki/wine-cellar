/**
 * AI Source Attribution — AEO Traffic Tracking
 *
 * Detects and attributes traffic arriving from AI answer engines
 * (ChatGPT, Gemini, Perplexity, Copilot, etc.) for GA4 reporting.
 *
 * PRIVACY NOTES:
 * - Only referrer *domain* is stored, never the full URL or path.
 * - No PII is collected or sent.
 * - Attribution data lives in localStorage (first/last touch) and
 *   sessionStorage (sent-flag to avoid duplicate GA events).
 * - captureAttribution() runs before consent, but no data is sent to
 *   GA until the user accepts analytics via the cookie consent banner.
 *
 * FLOW:
 *   main.tsx  → captureAttribution()   (always; captures & stores locally)
 *   analytics → sendAttributionToGA()  (only after GA is initialised + consent)
 *
 * UTM LINK TEMPLATES (for links you control — most reliable source tagging):
 *   ?utm_source=chatgpt&utm_medium=ai&utm_campaign=aeo
 *   ?utm_source=gemini&utm_medium=ai&utm_campaign=aeo
 *   ?utm_source=perplexity&utm_medium=ai&utm_campaign=aeo
 *   ?utm_source=copilot&utm_medium=ai&utm_campaign=aeo
 *   ?utm_source=claude&utm_medium=ai&utm_campaign=aeo
 *   ?utm_source=poe&utm_medium=ai&utm_campaign=aeo
 *   Custom:  ?ai_source=<engine>   (highest priority, no medium needed)
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AttributionData {
  /** Traffic source slug: ai engine name, referrer domain, or 'direct' */
  source: string;
  /** 'ai' | 'referral' | 'organic' | 'direct' | utm_medium value */
  medium: string;
  /** utm_campaign value, or '' */
  campaign: string;
  /** Detected AI engine name, or '' if not an AI source */
  ai_source: string;
  /** Referrer top-level hostname (no path/query), or '' */
  referrer_domain: string;
  /** Page path at the time of the visit */
  landing_path: string;
  /** Unix ms timestamp */
  timestamp: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FIRST_TOUCH_KEY = 'first_touch_source';
const LAST_TOUCH_KEY = 'last_touch_source';
/** sessionStorage flag — prevents re-sending GA events within the same tab session */
const SESSION_SENT_KEY = 'ai_attribution_ga_sent';

/**
 * Known AI referrer hostname → canonical engine slug.
 * Checked against the full hostname (and its subdomains).
 */
const AI_REFERRER_MAP: Record<string, string> = {
  'chat.openai.com': 'chatgpt',
  'chatgpt.com': 'chatgpt',
  'gemini.google.com': 'gemini',
  'bard.google.com': 'gemini',
  'perplexity.ai': 'perplexity',
  'copilot.microsoft.com': 'copilot',
  'poe.com': 'poe',
  'you.com': 'you',
  'claude.ai': 'claude',
  'phind.com': 'phind',
  'kagi.com': 'kagi',
};

/**
 * utm_source values that imply an AI engine (when no referrer is present).
 * Checked case-insensitively with substring matching.
 */
const AI_UTM_SOURCES = [
  'chatgpt',
  'gemini',
  'perplexity',
  'copilot',
  'poe',
  'you',
  'claude',
  'phind',
  'kagi',
  'bing-chat',
  'bard',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Safely extract hostname from a URL string; returns '' on failure. */
function safeHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Look up a hostname in the AI referrer map.
 * Tries exact match first, then checks if the hostname ends with '.domain'.
 */
function detectAiFromHostname(hostname: string): string {
  if (!hostname) return '';

  for (const [domain, slug] of Object.entries(AI_REFERRER_MAP)) {
    if (hostname === domain || hostname.endsWith('.' + domain)) {
      // Special case: bing.com only qualifies as Copilot when path includes /chat
      if (domain === 'bing.com') {
        if (document.referrer.includes('/chat')) return slug;
        continue;
      }
      return slug;
    }
  }
  return '';
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Capture attribution on first page load.
 *
 * Reads document.referrer + URL params, resolves source/medium, and
 * persists to localStorage as first-touch (immutable) and last-touch (mutable).
 *
 * MUST be called before the React render (in main.tsx) so the original
 * referrer/URL are still in their raw state.
 *
 * Does NOT send anything to GA — safe to call without user consent.
 */
export function captureAttribution(): void {
  const params = new URLSearchParams(window.location.search);

  const utmSource = params.get('utm_source') ?? '';
  const utmMedium = params.get('utm_medium') ?? '';
  const utmCampaign = params.get('utm_campaign') ?? '';
  const explicitAiSource = params.get('ai_source') ?? '';

  const referrerDomain = safeHostname(document.referrer);

  let source = 'direct';
  let medium = 'direct';
  let aiSource = '';

  // ── Priority 1: Explicit ?ai_source= param ───────────────────────────────
  if (explicitAiSource) {
    aiSource = explicitAiSource.toLowerCase().trim();
    source = aiSource;
    medium = utmMedium || 'ai';
  }
  // ── Priority 2: utm_source present ──────────────────────────────────────
  else if (utmSource) {
    source = utmSource;
    medium = utmMedium || 'referral';

    const srcLower = utmSource.toLowerCase();
    if (AI_UTM_SOURCES.some(ai => srcLower.includes(ai))) {
      aiSource = srcLower;
      medium = utmMedium || 'ai';
    }
  }
  // ── Priority 3: Referrer domain ──────────────────────────────────────────
  else if (referrerDomain) {
    source = referrerDomain;
    medium = 'referral';

    const detected = detectAiFromHostname(referrerDomain);
    if (detected) {
      aiSource = detected;
      medium = 'ai';
    }
  }

  const data: AttributionData = {
    source,
    medium,
    campaign: utmCampaign,
    ai_source: aiSource,
    referrer_domain: referrerDomain,
    landing_path: window.location.pathname,
    timestamp: Date.now(),
  };

  // First-touch: write once, never overwrite
  if (!localStorage.getItem(FIRST_TOUCH_KEY)) {
    localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(data));
  }

  // Last-touch: always update
  localStorage.setItem(LAST_TOUCH_KEY, JSON.stringify(data));

  if (import.meta.env.DEV) {
    console.log('[AiAttribution] Captured:', data);
  }
}

/**
 * Send attribution data to GA4 as user properties + an event.
 *
 * Call this after GA is initialised (i.e., inside or after initializeAnalytics()).
 * Uses sessionStorage to fire at most once per browser tab session.
 *
 * Requires window.gtag to be defined — if not, returns silently.
 */
export function sendAttributionToGA(): void {
  if (!window.gtag) return;

  // De-duplicate within a single browser session
  if (sessionStorage.getItem(SESSION_SENT_KEY)) return;
  sessionStorage.setItem(SESSION_SENT_KEY, '1');

  let firstTouch: AttributionData | null = null;
  let lastTouch: AttributionData | null = null;

  try {
    const ft = localStorage.getItem(FIRST_TOUCH_KEY);
    const lt = localStorage.getItem(LAST_TOUCH_KEY);
    if (ft) firstTouch = JSON.parse(ft);
    if (lt) lastTouch = JSON.parse(lt);
  } catch {
    return;
  }

  if (!lastTouch) return;

  const resolvedAiSource =
    lastTouch.ai_source || firstTouch?.ai_source || '';

  // Set persistent user properties (appear on every subsequent event)
  window.gtag('set', 'user_properties', {
    first_touch_source: firstTouch?.source ?? '',
    last_touch_source: lastTouch.source,
    ai_source: resolvedAiSource,
  });

  // Fire a discrete event only when there's something meaningful to report:
  // an AI source was detected, or explicit UTMs were present, or a known referrer
  const hasMeaningfulSignal =
    resolvedAiSource !== '' ||
    lastTouch.campaign !== '' ||
    (lastTouch.medium !== 'direct' && lastTouch.referrer_domain !== '');

  if (hasMeaningfulSignal) {
    window.gtag('event', 'ai_referral_detected', {
      ai_source: resolvedAiSource,
      referrer_domain: lastTouch.referrer_domain,
      landing_path: lastTouch.landing_path,
      utm_source: lastTouch.source,
      utm_medium: lastTouch.medium,
      utm_campaign: lastTouch.campaign,
      first_touch_ai_source: firstTouch?.ai_source ?? '',
    });

    if (import.meta.env.DEV) {
      console.log('[AiAttribution] GA event sent: ai_referral_detected', {
        ai_source: resolvedAiSource,
        referrer_domain: lastTouch.referrer_domain,
      });
    }
  }
}

/**
 * Read stored attribution data (for debugging or display).
 */
export function getStoredAttribution(): {
  firstTouch: AttributionData | null;
  lastTouch: AttributionData | null;
} {
  try {
    const ft = localStorage.getItem(FIRST_TOUCH_KEY);
    const lt = localStorage.getItem(LAST_TOUCH_KEY);
    return {
      firstTouch: ft ? JSON.parse(ft) : null,
      lastTouch: lt ? JSON.parse(lt) : null,
    };
  } catch {
    return { firstTouch: null, lastTouch: null };
  }
}
