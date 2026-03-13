/**
 * Sommelier Chat Button
 *
 * Floating action button that opens the Sommelier Agent chat.
 * Used both as a per-page button (RecommendationPage) and as a
 * global persistent FAB injected by Layout on Cellar / History / Wishlist.
 *
 * First-visit experience:
 *   - A luxury gold tooltip slides up above the button with a CTA message.
 *   - The button itself glows gold so users know it's new and special.
 *   - Auto-dismisses after 7 s or immediately when the user taps anywhere.
 *   - State is persisted in localStorage so the intro only shows once.
 *
 * Subsequent visits:
 *   - Compact wine-gradient pill with a subtle wobble + ping animation.
 *
 * When isGlobal=true (Layout injection):
 *   - Hides itself behind open modals/dialogs via MutationObserver.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const INTRO_SEEN_KEY = 'sommelier-fab-intro-seen';

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
  const { t } = useTranslation();

  const [showIntro, setShowIntro] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const introTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── First-visit intro ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!localStorage.getItem(INTRO_SEEN_KEY)) {
      // Short delay so the page content loads first
      const t = setTimeout(() => setShowIntro(true), 1600);
      return () => clearTimeout(t);
    }
  }, []);

  // Auto-dismiss after 7 s
  useEffect(() => {
    if (!showIntro) return;
    introTimerRef.current = setTimeout(() => dismissIntro(), 7000);
    return () => {
      if (introTimerRef.current) clearTimeout(introTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showIntro]);

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

  const dismissIntro = useCallback(() => {
    setShowIntro(false);
    localStorage.setItem(INTRO_SEEN_KEY, '1');
    if (introTimerRef.current) clearTimeout(introTimerRef.current);
  }, []);

  const handleClick = useCallback(() => {
    dismissIntro();
    navigate('/agent');
  }, [dismissIntro, navigate]);

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
      {/* ── First-visit CTA tooltip ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showIntro && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.93 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.95 }}
            transition={{ type: 'spring', damping: 22, stiffness: 280 }}
            className="absolute right-0 min-w-[232px] max-w-[260px]"
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
                  dismissIntro();
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
          className="relative flex items-center gap-2.5 px-5 py-3 rounded-full shadow-2xl"
          style={{
            background: showIntro
              ? 'linear-gradient(135deg, #d4af37, #b8963d)'
              : 'linear-gradient(135deg, var(--wine-600), var(--wine-700))',
            color: 'white',
            border: showIntro
              ? '2px solid rgba(255,255,255,0.42)'
              : '2px solid rgba(255,255,255,0.2)',
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
          {/* Chat icon with animation */}
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
            className="flex-shrink-0"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
          </motion.div>

          {/* Label — always visible on global FAB; hidden on mobile on standalone usage */}
          <span
            className={isGlobal ? 'text-sm font-semibold whitespace-nowrap' : 'hidden sm:inline text-sm font-semibold whitespace-nowrap'}
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
