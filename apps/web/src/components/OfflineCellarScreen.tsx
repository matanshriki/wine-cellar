/**
 * Full-viewport offline state for the cellar: premium illustration,
 * sommelier-toned copy, reconnect sequence, and hard reload for PWA recovery.
 */

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { MetaHead } from './MetaHead';
import { OfflineHeroAnimation } from './OfflineHeroAnimation';
import { shouldReduceMotion } from '../utils/pwaAnimationFix';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

const easeLuxury = [0.45, 0, 0.55, 1] as const;

export function OfflineCellarScreen() {
  const { t, i18n } = useTranslation();
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
      }, 1300);
      return () => clearTimeout(tId);
    }
  }, [isOnline]);

  function handleTryAgain() {
    window.location.reload();
  }

  return (
    <div
      className="flex flex-col w-full -mt-2 sm:-mt-1"
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

      {/**
       * Layout main already adds large padding-top (header) + pb-bottom-nav.
       * Use justify-start + tight gaps so title, copy, and CTA stay above the fold on phones.
       */}
      <section
        className="flex w-full max-w-md mx-auto flex-col items-center text-center justify-start gap-4 pt-4 sm:pt-5 pb-3 px-2 sm:px-0"
        aria-labelledby="offline-cellar-title"
      >
        <OfflineHeroAnimation
          phase={illustrationPhase}
          reducedMotion={reduceMotion}
          labelText={t('offline.bottleText')}
          bottleTextRtl={i18n.dir() === 'rtl'}
        />

        <div className="space-y-2" role="status" aria-live="polite">
          <h1
            id="offline-cellar-title"
            className="app-display text-2xl sm:text-3xl leading-snug px-1"
          >
            {t('cellar.offline.title')}
          </h1>
          <p
            className="text-sm sm:text-base leading-relaxed max-w-sm mx-auto px-1"
            style={{ color: 'var(--text-secondary)' }}
          >
            {t('cellar.offline.description')}
          </p>
        </div>

        <motion.button
            type="button"
            onClick={handleTryAgain}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.16, ease: easeLuxury }}
            className="relative w-full max-w-xs py-3.5 px-6 rounded-full font-semibold text-base min-h-[48px] overflow-hidden mt-1"
            style={{
              background: 'var(--sommi-gradient-primary)',
              color: '#fff',
              border: 'none',
              boxShadow: 'var(--shadow-cta)',
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation',
            }}
          >
            <span className="relative z-[1]">{t('cellar.offline.tryAgain')}</span>
          </motion.button>
      </section>
    </div>
  );
}
