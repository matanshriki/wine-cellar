/**
 * usePwaInstallPrompt
 *
 * Manages the "install as PWA" prompt shown after the user adds their first bottle.
 *
 * Rules:
 * - Never shown when already running as a standalone PWA.
 * - Shown once the user has successfully created at least one bottle.
 * - If dismissed: suppressed for 7 days, then shown again.
 * - If "never" is stored (e.g. after successful Android install): never shown again.
 *
 * Platform routing (handled by the component, not this hook):
 *   iOS  → 2-step Safari "Add to Home Screen" guide (bottom sheet)
 *   Android → native beforeinstallprompt dialog triggered by button (bottom sheet)
 *   Desktop → QR code modal
 */

import { useState, useEffect } from 'react';
import { isStandalonePwa, isIos, isAndroid } from '../utils/deviceDetection';
import { supabase } from '../lib/supabase';
import { safeGetItem, safeSetItem } from '../utils/safeLocalStorage';

// ── localStorage keys ─────────────────────────────────────────────────────────
const KEY_DISMISSED_UNTIL = 'pwa_prompt_dismissed_until';
const KEY_NEVER           = 'pwa_prompt_never';
const KEY_HAS_BOTTLE      = 'pwa_has_bottle';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// ── Capture beforeinstallprompt as early as possible ─────────────────────────
// This event fires before React mounts, so we must capture it at module level.
let _deferredPrompt: any = null;

if (typeof window !== 'undefined') {
  window.addEventListener(
    'beforeinstallprompt',
    (e) => {
      e.preventDefault();
      _deferredPrompt = e;
    },
    { once: true },
  );

  // If the user installs via the browser's own UI, mark as never-show
  window.addEventListener(
    'appinstalled',
    () => {
      _deferredPrompt = null;
      safeSetItem(KEY_NEVER, 'true');
    },
    { once: true },
  );
}

// ── Platform type ─────────────────────────────────────────────────────────────
export type PromptPlatform = 'ios' | 'android' | 'desktop';

function detectPlatform(): PromptPlatform {
  if (isIos()) return 'ios';
  if (isAndroid()) return 'android';
  return 'desktop';
}

function isEligible(): boolean {
  // Already running as PWA
  if (isStandalonePwa()) return false;
  if (safeGetItem(KEY_NEVER) === 'true') return false;
  const until = safeGetItem(KEY_DISMISSED_UNTIL);
  if (until && Date.now() < parseInt(until, 10)) return false;
  return true;
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function usePwaInstallPrompt() {
  const [isVisible, setIsVisible]   = useState(false);
  const [platform]                  = useState<PromptPlatform>(detectPlatform);
  const [hasNativePrompt, setHasNativePrompt] = useState(false);

  // Re-check whether the native prompt is available once mounted
  useEffect(() => {
    setHasNativePrompt(!!_deferredPrompt);
  }, []);

  // Track whether user has ever added a bottle (persisted across sessions)
  const [hasBottle, setHasBottle] = useState(() => safeGetItem(KEY_HAS_BOTTLE) === 'true');

  // Show the prompt (with a 2-second delay so the page settles first)
  const tryShow = () => {
    if (!isEligible()) return;
    const timer = setTimeout(() => setIsVisible(true), 2000);
    return timer;
  };

  // Show on mount if:
  //  a) the user already has a bottle flag set in this browser context, OR
  //  b) the user is authenticated (covers the case where they open the site
  //     in a fresh browser tab / mobile Safari after previously using the PWA,
  //     where localStorage is isolated so KEY_HAS_BOTTLE was never written here)
  useEffect(() => {
    if (hasBottle) {
      const timer = tryShow();
      return () => { if (timer) clearTimeout(timer); };
    }
    // Fallback: check auth state — any logged-in user is eligible
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        safeSetItem(KEY_HAS_BOTTLE, 'true');
        setHasBottle(true);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for 'bottleCreated' events (fired by bottleService after a new bottle)
  useEffect(() => {
    const handler = () => {
      safeSetItem(KEY_HAS_BOTTLE, 'true');
      setHasBottle(true);
    };
    window.addEventListener('bottleCreated', handler);
    return () => window.removeEventListener('bottleCreated', handler);
  }, []);

  // When hasBottle flips to true mid-session, trigger the prompt
  useEffect(() => {
    if (!hasBottle) return;
    const timer = tryShow();
    return () => { if (timer) clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasBottle]);

  // ── Actions ────────────────────────────────────────────────────────────────

  /** Android: trigger native install dialog */
  const handleInstall = async () => {
    if (_deferredPrompt) {
      _deferredPrompt.prompt();
      const { outcome } = await _deferredPrompt.userChoice;
      _deferredPrompt = null;
      setHasNativePrompt(false);
      if (outcome === 'accepted') {
        safeSetItem(KEY_NEVER, 'true');
      } else {
        safeSetItem(KEY_DISMISSED_UNTIL, String(Date.now() + SEVEN_DAYS_MS));
      }
    }
    setIsVisible(false);
  };

  /** "Maybe later" — suppress for 7 days */
  const handleDismiss = () => {
    safeSetItem(KEY_DISMISSED_UNTIL, String(Date.now() + SEVEN_DAYS_MS));
    setIsVisible(false);
  };

  // On Android, only show the prompt when the native browser install dialog
  // is available. There's no good manual flow for Android like iOS's share sheet.
  const effectiveIsVisible = isVisible && !(platform === 'android' && !hasNativePrompt);

  return {
    isVisible: effectiveIsVisible,
    platform,
    /** Android: whether the native install dialog is available */
    hasNativePrompt,
    handleInstall,
    handleDismiss,
  };
}
