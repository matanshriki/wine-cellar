/**
 * Full-viewport offline state for the cellar: luxury bottle + cork motif,
 * sommelier-toned copy, and a hard reload for PWA / browser recovery.
 */

import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { MetaHead } from './MetaHead';
import { shouldReduceMotion } from '../utils/pwaAnimationFix';

export function OfflineCellarScreen() {
  const { t } = useTranslation();
  const reduceMotion = shouldReduceMotion();

  function handleTryAgain() {
    window.location.reload();
  }

  return (
    <div
      className="flex flex-col min-h-[100dvh] w-full"
      style={{
        background:
          'linear-gradient(180deg, var(--bg-surface) 0%, var(--bg-secondary, var(--bg-surface)) 45%, var(--bg-surface) 100%)',
      }}
    >
      <MetaHead
        title={t('cellar.title')}
        description={t('cellar.offline.metaDescription')}
        url="/cellar"
        noIndex={true}
      />

      <main
        className="flex-1 flex flex-col items-center justify-center px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]"
        aria-labelledby="offline-cellar-title"
      >
        <div className="w-full max-w-md flex flex-col items-center text-center gap-8">
          {/* Bottle + cork — SVG luxury illustration */}
          <div
            className="relative flex items-end justify-center"
            style={{ height: 200, width: 120 }}
            aria-hidden
          >
            {/* Soft glow */}
            <div
              className="absolute rounded-full opacity-40 blur-3xl"
              style={{
                width: 140,
                height: 100,
                bottom: 8,
                background:
                  'radial-gradient(ellipse at center, var(--wine-300) 0%, transparent 70%)',
              }}
            />

            <svg
              width="100"
              height="180"
              viewBox="0 0 100 180"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="relative z-[1]"
            >
              <defs>
                <linearGradient id="offline-bottle-glass" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="var(--wine-200, #f0dfe4)" stopOpacity="0.95" />
                  <stop offset="45%" stopColor="var(--wine-100, #f8eef1)" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="var(--wine-300, #eba8ba)" stopOpacity="0.35" />
                </linearGradient>
                <linearGradient id="offline-bottle-wine" x1="50%" y1="0%" x2="50%" y2="100%">
                  <stop offset="0%" stopColor="var(--wine-500)" />
                  <stop offset="100%" stopColor="var(--wine-700)" />
                </linearGradient>
                <linearGradient id="offline-cork" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#d4a574" />
                  <stop offset="50%" stopColor="#b8834d" />
                  <stop offset="100%" stopColor="#8b5a2b" />
                </linearGradient>
                <linearGradient id="offline-gold-foil" x1="0%" y1="50%" x2="100%" y2="50%">
                  <stop offset="0%" stopColor="#c9a227" stopOpacity="0.2" />
                  <stop offset="50%" stopColor="#e8d48a" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#c9a227" stopOpacity="0.2" />
                </linearGradient>
              </defs>

              {/* Bottle body */}
              <path
                d="M38 52 L36 58 L32 150 Q32 168 50 168 Q68 168 68 150 L64 58 L62 52 Q50 48 38 52Z"
                fill="url(#offline-bottle-glass)"
                stroke="var(--border-medium, rgba(0,0,0,0.08))"
                strokeWidth="0.75"
              />
              <path
                d="M40 72 L38 148 Q38 162 50 162 Q62 162 62 148 L60 72 Q50 68 40 72Z"
                fill="url(#offline-bottle-wine)"
                opacity="0.92"
              />
              {/* Shoulder highlight */}
              <path
                d="M42 76 Q50 72 58 76 L57 90 Q50 86 43 90 Z"
                fill="white"
                opacity="0.12"
              />
              {/* Gold foil band */}
              <rect
                x="34"
                y="48"
                width="32"
                height="7"
                rx="1.5"
                fill="url(#offline-gold-foil)"
                opacity="0.9"
              />
              {/* Neck */}
              <path
                d="M42 48 L42 32 Q42 28 50 28 Q58 28 58 32 L58 48 Z"
                fill="url(#offline-bottle-glass)"
                stroke="var(--border-medium, rgba(0,0,0,0.08))"
                strokeWidth="0.5"
              />

              {/* Cork — animated (luxury subtle motion) */}
              <motion.g
                animate={
                  reduceMotion
                    ? {}
                    : {
                        y: [0, -5, 0],
                        rotate: [-1.2, 1.2, -1.2],
                      }
                }
                transition={{
                  duration: 3.2,
                  repeat: Infinity,
                  ease: [0.45, 0, 0.55, 1],
                }}
                style={{ transformOrigin: '50px 24px' }}
              >
                <rect
                  x="44"
                  y="14"
                  width="12"
                  height="18"
                  rx="2"
                  fill="url(#offline-cork)"
                  stroke="#6b4423"
                  strokeWidth="0.4"
                  opacity="0.98"
                />
                <ellipse cx="50" cy="14" rx="5.5" ry="2.2" fill="#e8c896" opacity="0.85" />
                {/* Cork grain lines */}
                <path
                  d="M46 18 L54 18 M46 22 L54 22 M46 26 L52 26"
                  stroke="#6b4423"
                  strokeWidth="0.35"
                  opacity="0.35"
                  strokeLinecap="round"
                />
              </motion.g>
            </svg>
          </div>

          <div className="space-y-3" role="status" aria-live="polite">
            <h1
              id="offline-cellar-title"
              className="text-2xl sm:text-[1.65rem] leading-snug"
              style={{
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-display)',
                fontWeight: 'var(--font-bold)',
                letterSpacing: '-0.02em',
              }}
            >
              {t('cellar.offline.title')}
            </h1>
            <p
              className="text-base leading-relaxed max-w-sm mx-auto"
              style={{ color: 'var(--text-secondary)' }}
            >
              {t('cellar.offline.subtitle')}
            </p>
          </div>

          <button
            type="button"
            onClick={handleTryAgain}
            className="w-full max-w-xs py-4 px-8 rounded-xl font-semibold text-base transition-all min-h-[52px]"
            style={{
              background: 'linear-gradient(135deg, var(--wine-600), var(--wine-700))',
              color: 'var(--text-inverse, #fff)',
              border: '1px solid var(--wine-700)',
              boxShadow: '0 8px 28px rgba(139, 21, 56, 0.28)',
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation',
            }}
          >
            {t('cellar.offline.tryAgain')}
          </button>
        </div>
      </main>
    </div>
  );
}
