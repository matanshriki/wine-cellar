/**
 * Sommelier Chat Button
 *
 * Floating action button that opens the Sommelier Agent chat.
 * Used both as a per-page button (RecommendationPage) and as a
 * global persistent FAB injected by Layout on Cellar / History / Wishlist.
 *
 * First-visit experience:
 *   - sm+: luxury gold tooltip above the button + golden FAB (once; stored in
 *     localStorage).
 *   - Mobile / narrow (global FAB only): “Meet Sommi” chip fades in, stays ~5 s,
 *     fades out, then repeats every 30 s as a CTA. Not persisted — stops when the
 *     tab closes or site data is cleared.
 *
 * Subsequent visits:
 *   - Compact wine-gradient pill with a subtle wobble + ping animation.
 *
 * When isGlobal=true (Layout injection):
 *   - Hides itself behind open modals/dialogs via MutationObserver.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { trackSommelier } from '../services/analytics';
import { SOMMI_AGENT_ICON_URL } from '../constants/brandAssets';

/** Gold card + desktop scheduling (legacy key — unchanged for backward compat). */
const DESKTOP_INTRO_KEY = 'sommelier-fab-intro-seen';

/** Mobile CTA chip: repeat interval + visible duration (global FAB / narrow viewport only). */
const MOBILE_HINT_INTERVAL_MS = 30_000;
const MOBILE_HINT_VISIBLE_MS = 5000;

/** Dev server only: replay first-visit FAB UI every load; never persist intro-seen. */
const SOMMELIER_FAB_INTRO_DEBUG =
  import.meta.env.DEV &&
  (import.meta.env.VITE_SOMMELIER_FAB_INTRO_DEBUG === 'true' ||
    import.meta.env.VITE_SOMMELIER_FAB_INTRO_DEBUG === '1');

function hasDesktopIntroBeenSeen(): boolean {
  if (SOMMELIER_FAB_INTRO_DEBUG) return false;
  return !!localStorage.getItem(DESKTOP_INTRO_KEY);
}

interface SommelierChatButtonProps {
  /**
   * When true the button is managed globally by Layout and:
   *   - Runs a MutationObserver to hide itself when any modal is open.
   *   - Always renders the text label (not hidden on small screens).
   */
  isGlobal?: boolean;
}

export function SommelierChatButton({ isGlobal = false }: SommelierChatButtonProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const [showIntro, setShowIntro] = useState(false);
  const [showMobileHint, setShowMobileHint] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const introTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistDesktopIntroSeen = useCallback(() => {
    if (SOMMELIER_FAB_INTRO_DEBUG) return;
    localStorage.setItem(DESKTOP_INTRO_KEY, '1');
  }, []);

  /** Desktop gold card: close UI + mark desktop intro only. */
  const dismissGoldIntro = useCallback(() => {
    setShowIntro(false);
    persistDesktopIntroSeen();
    if (introTimerRef.current) clearTimeout(introTimerRef.current);
  }, [persistDesktopIntroSeen]);

  /** FAB tap: hide gold + chip UI; persist desktop intro only (mobile chip loops again). */
  const dismissAllFabIntros = useCallback(() => {
    setShowIntro(false);
    setShowMobileHint(false);
    persistDesktopIntroSeen();
    if (introTimerRef.current) clearTimeout(introTimerRef.current);
  }, [persistDesktopIntroSeen]);

  // ── Desktop sm+: gold card once (localStorage) ────────────────────────────
  useEffect(() => {
    const smUp = window.matchMedia('(min-width: 640px)').matches;
    if (!smUp) return;
    if (hasDesktopIntroBeenSeen()) return;
    const t = setTimeout(() => setShowIntro(true), 1600);
    return () => clearTimeout(t);
  }, []);

  // ── Mobile: repeating CTA chip (Layout / isGlobal FAB only; not persisted) ─
  useEffect(() => {
    if (!isGlobal) return;

    const mq = window.matchMedia('(max-width: 639px)');
    let cleanupLoop: (() => void) | undefined;

    const startLoop = () => {
      const initial = window.setTimeout(() => setShowMobileHint(true), 600);
      const interval = window.setInterval(
        () => setShowMobileHint(true),
        MOBILE_HINT_INTERVAL_MS
      );
      return () => {
        window.clearTimeout(initial);
        window.clearInterval(interval);
      };
    };

    const sync = () => {
      cleanupLoop?.();
      cleanupLoop = undefined;
      setShowMobileHint(false);
      if (mq.matches) {
        cleanupLoop = startLoop();
      }
    };

    sync();
    mq.addEventListener('change', sync);
    return () => {
      mq.removeEventListener('change', sync);
      cleanupLoop?.();
    };
  }, [isGlobal]);

  // Mobile chip: visible window then fade out (next show is from interval)
  useEffect(() => {
    if (!showMobileHint) return;
    const t = window.setTimeout(() => setShowMobileHint(false), MOBILE_HINT_VISIBLE_MS);
    return () => window.clearTimeout(t);
  }, [showMobileHint]);

  // Auto-dismiss gold card after 7 s (desktop only in practice)
  useEffect(() => {
    if (!showIntro) return;
    introTimerRef.current = setTimeout(() => dismissGoldIntro(), 7000);
    return () => {
      if (introTimerRef.current) clearTimeout(introTimerRef.current);
    };
  }, [showIntro, dismissGoldIntro]);

  // ── Modal detection (global mode only) ─────────────────────────────────────
  useEffect(() => {
    if (!isGlobal) return;

    const check = () => {
      const hasModal = !!document.querySelector('[role="dialog"][aria-modal="true"]');
      setIsModalOpen(hasModal);
    };

    check();

    const observer = new MutationObserver(check);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['role', 'aria-modal'],
    });

    return () => observer.disconnect();
  }, [isGlobal]);

  const handleClick = useCallback(() => {
    dismissAllFabIntros();
    // Track which page the user clicked from (strip leading slash → 'cellar', 'history', …)
    const source = location.pathname.replace(/^\//, '') || 'unknown';
    trackSommelier.agentButtonClick(source);
    navigate('/agent');
  }, [dismissAllFabIntros, navigate, location.pathname]);

  // ── Rendering ───────────────────────────────────────────────────────────────
  if (isGlobal && isModalOpen) return null;

  return (
    <div
      className="fixed z-[45]"
      style={{
        bottom: 'calc(6.5rem + env(safe-area-inset-bottom, 0px) + 1rem)',
        right: '1rem',
      }}
    >
      {/* ── First-visit CTA tooltip (tablet/desktop only) ───────────────────── */}
      <AnimatePresence>
        {showIntro && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.93 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.95 }}
            transition={{ type: 'spring', damping: 22, stiffness: 280 }}
            className="absolute end-0 hidden min-w-[232px] max-w-[260px] sm:block"
            style={{ bottom: 'calc(100% + 14px)', zIndex: 1 }}
          >
            <div
              className="relative rounded-2xl p-4"
              style={{
                background: 'linear-gradient(135deg, #d4af37 0%, #c49b30 55%, #9e7c28 100%)',
                border: '1px solid rgba(255, 255, 255, 0.38)',
                boxShadow:
                  '0 12px 40px rgba(180, 140, 30, 0.5), 0 0 0 1px rgba(255,255,255,0.15)',
              }}
            >
              {/* Dismiss */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  dismissGoldIntro();
                }}
                className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full transition-opacity opacity-60 hover:opacity-100"
                style={{ color: 'rgba(255,255,255,0.9)' }}
                aria-label="Dismiss"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>

              {/* Sparkle icon */}
              <motion.div
                animate={{ rotate: [0, 18, -12, 18, 0], scale: [1, 1.18, 1, 1.18, 1] }}
                transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.6 }}
                className="text-xl mb-2 select-none"
                aria-hidden="true"
              >
                ✨
              </motion.div>

              <p
                className="text-sm font-bold leading-tight mb-1 pe-5"
                style={{
                  color: 'rgba(255,255,255,0.97)',
                  fontFamily: 'var(--font-display)',
                  letterSpacing: '-0.01em',
                }}
              >
                {t('sommelierFab.introTitle', 'Meet your AI Sommelier')}
              </p>
              <p
                className="text-xs leading-snug"
                style={{ color: 'rgba(255,255,255,0.76)' }}
              >
                {t(
                  'sommelierFab.introSubtitle',
                  'Ask about pairings, when to open a bottle, or what to serve tonight.'
                )}
              </p>

              {/* Tap CTA */}
              <motion.div
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 1.6, repeat: Infinity }}
                className="mt-3 flex items-center gap-1.5"
                style={{ color: 'rgba(255,255,255,0.9)' }}
              >
                <svg
                  className="w-3.5 h-3.5 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5"
                  />
                </svg>
                <span className="text-xs font-semibold">
                  {t('sommelierFab.introCta', 'Tap to try it')}
                </span>
              </motion.div>

              {/* Arrow caret pointing down-right toward button */}
              <div
                className="absolute -bottom-[7px] right-6"
                style={{
                  width: 14,
                  height: 14,
                  background: '#9e7c28',
                  transform: 'rotate(45deg)',
                  borderRight: '1px solid rgba(255,255,255,0.18)',
                  borderBottom: '1px solid rgba(255,255,255,0.18)',
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── FAB button ──────────────────────────────────────────────────────── */}
      <div className="relative">
        {/* Mobile/PWA (global FAB): repeating CTA — Meet Sommi, fades ~5 s, every 30 s */}
        {isGlobal && (
          <AnimatePresence>
            {showMobileHint && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="pointer-events-none absolute end-0 z-[2] sm:hidden"
                style={{ bottom: 'calc(100% + 10px)' }}
                aria-hidden="true"
              >
                <div
                  className="max-w-[11rem] rounded-2xl px-3 py-2 text-center text-xs font-semibold leading-tight shadow-lg"
                  style={{
                    fontFamily: 'var(--font-display)',
                    background: 'var(--bg-surface)',
                    color: 'var(--wine-700)',
                    border: '1px solid var(--wine-300)',
                    boxShadow: '0 6px 20px rgba(0, 0, 0, 0.12)',
                  }}
                >
                  {t('sommelierFab.mobileHint', 'Meet Sommi')}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* First-visit golden halo — pulses to attract attention */}
        <AnimatePresence>
          {showIntro && (
            <motion.div
              initial={{ scale: 1, opacity: 0.6 }}
              animate={{ scale: [1, 1.7, 1], opacity: [0.55, 0, 0.55] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.9, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle, rgba(212,175,55,0.65) 0%, transparent 70%)',
              }}
            />
          )}
        </AnimatePresence>

        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 14, stiffness: 220, delay: 0.25 }}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.93 }}
          onClick={handleClick}
          className="relative flex h-14 w-14 min-h-[3.5rem] min-w-[3.5rem] items-center justify-center gap-2 rounded-full p-0.5 shadow-2xl sm:h-auto sm:min-h-0 sm:w-auto sm:min-w-0 sm:justify-start sm:gap-2.5 sm:p-0 sm:px-5 sm:py-3"
          style={{
            background: showIntro
              ? 'linear-gradient(135deg, #d4af37, #b8963d)'
              : 'linear-gradient(135deg, var(--wine-600), var(--wine-700))',
            color: 'white',
            border: showIntro
              ? '2px solid rgba(255,255,255,0.42)'
              : '2px solid rgba(255,255,255,0.38)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            boxShadow: showIntro
              ? '0 8px 36px rgba(180,140,30,0.55), 0 0 0 1px rgba(255,255,255,0.15)'
              : '0 8px 32px rgba(139,21,56,0.4), 0 0 0 1px rgba(255,255,255,0.1)',
            WebkitTapHighlightColor: 'transparent',
            touchAction: 'manipulation',
            transition: 'background 0.4s ease, box-shadow 0.4s ease, border-color 0.4s ease',
          }}
          aria-label={t('cellarSommelier.askSommelier', 'Ask the Sommelier')}
        >
          {/* Sommi agent mark — matches chat /agent avatar */}
          <motion.div
            animate={
              showIntro
                ? { rotate: [0, -10, 10, -10, 0], scale: [1, 1.12, 1] }
                : { rotate: [0, -10, 10, -10, 0] }
            }
            transition={{
              duration: showIntro ? 1.4 : 2,
              repeat: Infinity,
              repeatDelay: showIntro ? 0.9 : 3,
            }}
            className="h-full w-full flex-shrink-0 overflow-hidden rounded-full ring-1 ring-inset ring-white/70 shadow-none sm:h-7 sm:w-7 sm:ring-1"
          >
            <img
              src={SOMMI_AGENT_ICON_URL}
              alt=""
              width={512}
              height={512}
              className="h-full w-full scale-[1.42] object-cover object-center sm:scale-[1.12]"
              aria-hidden="true"
              loading="lazy"
              decoding="async"
              sizes="(min-width: 640px) 28px, 56px"
            />
          </motion.div>

          {/* Label — hidden on mobile (icon-only pill), visible on sm+ screens */}
          <span
            className="hidden sm:inline text-sm font-semibold whitespace-nowrap"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            {t('cellarSommelier.askSommelier', 'Ask Sommelier')}
          </span>

          {/* Subtle ping — only shown after intro is dismissed */}
          {!showIntro && (
            <span
              className="absolute inset-0 rounded-full animate-ping opacity-10 pointer-events-none"
              style={{
                background: 'linear-gradient(135deg, var(--wine-600), var(--wine-700))',
              }}
            />
          )}
        </motion.button>
      </div>
    </div>
  );
}
