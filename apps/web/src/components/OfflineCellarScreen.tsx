/**
 * Full-viewport offline state for the cellar: premium illustration,
 * sommelier-toned copy, reconnect sequence, and hard reload for PWA recovery.
 */

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { MetaHead } from './MetaHead';
import { OfflineIllustration } from './OfflineIllustration';
import { shouldReduceMotion } from '../utils/pwaAnimationFix';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

const easeLuxury = [0.45, 0, 0.55, 1] as const;

export function OfflineCellarScreen() {
  const { t } = useTranslation();
  const reduceMotion = shouldReduceMotion();
  const isOnline = useOnlineStatus();
  const prevOnlineRef = useRef<boolean | null>(null);
  const [illustrationPhase, setIllustrationPhase] = useState<'offline' | 'reconnect'>('offline');

  useEffect(() => {
    const prev = prevOnlineRef.current;
    prevOnlineRef.current = isOnline;

    if (prev === false && isOnline === true) {
      setIllustrationPhase('reconnect');
      const tId = window.setTimeout(() => {
        window.location.reload();
      }, 1350);
      return () => clearTimeout(tId);
    }
  }, [isOnline]);

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
          <OfflineIllustration phase={illustrationPhase} reducedMotion={reduceMotion} />

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

          <motion.button
            type="button"
            onClick={handleTryAgain}
            whileTap={{
              scale: 0.98,
              boxShadow: '0 10px 40px rgba(166, 53, 82, 0.45)',
            }}
            transition={{ duration: 0.16, ease: easeLuxury }}
            className="relative w-full max-w-xs py-4 px-8 rounded-xl font-semibold text-base min-h-[52px] overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, var(--wine-600), var(--wine-700))',
              color: 'var(--text-inverse, #fff)',
              border: '1px solid var(--wine-700)',
              boxShadow: '0 8px 28px rgba(139, 21, 56, 0.28)',
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation',
            }}
          >
            {!reduceMotion && (
              <motion.span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 w-1/3"
                style={{
                  left: '-20%',
                  background:
                    'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                }}
                animate={{ left: ['-20%', '120%'] }}
                transition={{
                  duration: 4.5,
                  repeat: Infinity,
                  ease: 'linear',
                  repeatDelay: 1.4,
                }}
              />
            )}
            <span className="relative z-[1]">{t('cellar.offline.tryAgain')}</span>
          </motion.button>
        </div>
      </main>
    </div>
  );
}
