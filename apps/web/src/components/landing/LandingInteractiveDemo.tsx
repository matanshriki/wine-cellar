import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { prefersReducedMotion } from './landingMotion';

type DemoPhase = 'idle' | 'asking' | 'thinking' | 'answer';

/**
 * Public product demonstration with explicitly fictional sample data.
 * Does not call APIs, access cellars, or require auth.
 */
export function LandingInteractiveDemo() {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<DemoPhase>('idle');
  const [paused, setPaused] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const runSequence = () => {
    clearTimers();
    setPhase('asking');
    timers.current.push(
      setTimeout(() => setPhase('thinking'), prefersReducedMotion ? 200 : 900),
      setTimeout(() => setPhase('answer'), prefersReducedMotion ? 400 : 1900),
    );
  };

  useEffect(() => {
    if (paused) {
      clearTimers();
      return;
    }
    runSequence();
    const loop = setInterval(
      () => {
        if (!paused) runSequence();
      },
      prefersReducedMotion ? 8000 : 10000,
    );
    return () => {
      clearTimers();
      clearInterval(loop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restart when pause toggles
  }, [paused]);

  const showAnswer = phase === 'answer';
  const showThinking = phase === 'thinking';
  const showAsk = phase !== 'idle';

  return (
    <div
      className="rounded-[1.75rem] border overflow-hidden"
      style={{
        borderColor: 'rgba(74, 23, 34, 0.12)',
        background: 'linear-gradient(180deg, #fffdf9 0%, #f3eee6 100%)',
        boxShadow: '0 20px 56px rgba(45, 24, 16, 0.08)',
      }}
    >
      <div
        className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b"
        style={{ borderColor: 'rgba(74, 23, 34, 0.08)', background: 'rgba(255,253,249,0.85)' }}
      >
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--lp-ink)' }}>
            {t('landing.demoInteractiveTitle')}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--lp-stone-muted)' }}>
            {t('landing.demoInteractiveExample')}
          </p>
        </div>
        <button
          type="button"
          className="text-xs font-semibold rounded-full px-3 py-1.5 border min-h-[36px]"
          style={{
            borderColor: 'rgba(74, 23, 34, 0.18)',
            color: 'var(--lp-burgundy-mid)',
            background: 'rgba(255,255,255,0.7)',
          }}
          onClick={() => setPaused((p) => !p)}
          aria-pressed={paused}
        >
          {paused ? t('landing.demoResume') : t('landing.demoPause')}
        </button>
      </div>

      <div className="p-4 sm:p-6 min-h-[280px] sm:min-h-[300px] flex flex-col gap-3">
        <AnimatePresence mode="popLayout">
          {showAsk ? (
            <motion.div
              key="ask"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0 }}
              className="lp-demo-bubble-user self-end max-w-[92%] sm:max-w-[80%] px-4 py-3 text-sm leading-relaxed"
            >
              {t('landing.demoAsk')}
            </motion.div>
          ) : null}

          {showThinking ? (
            <motion.div
              key="think"
              initial={prefersReducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0 }}
              className="self-start text-xs font-medium px-2"
              style={{ color: 'var(--lp-stone-muted)' }}
              aria-live="polite"
            >
              {t('landing.demoThinking')}
            </motion.div>
          ) : null}

          {showAnswer ? (
            <motion.div
              key="answer"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="lp-demo-bubble-bot self-start max-w-[96%] sm:max-w-[88%] px-4 py-3.5 text-sm leading-relaxed"
              aria-live="polite"
            >
              <p className="mb-3">{t('landing.demoAnswerIntro')}</p>
              <div
                className="rounded-xl p-3 mb-3"
                style={{ background: 'rgba(74, 23, 34, 0.04)', border: '1px solid rgba(74, 23, 34, 0.08)' }}
              >
                <p className="font-semibold text-[0.9375rem]" style={{ color: 'var(--lp-ink)' }}>
                  {t('landing.demoAnswerWine')}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--lp-stone-muted)' }}>
                  {t('landing.demoAnswerMeta')}
                </p>
                <p
                  className="inline-flex mt-2 text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5"
                  style={{ background: 'var(--lp-sage-soft)', color: '#3f5238' }}
                >
                  {t('landing.demoAnswerWindow')}
                </p>
              </div>
              <p style={{ color: 'var(--lp-stone)' }}>{t('landing.demoAnswerWhy')}</p>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {phase === 'idle' || paused ? (
          <button
            type="button"
            onClick={() => {
              setPaused(false);
              runSequence();
            }}
            className="mt-auto self-center lp-cta-ghost text-sm"
          >
            {t('landing.demoReplay')}
          </button>
        ) : null}
      </div>

      <div
        className="px-4 sm:px-5 py-3 border-t text-xs leading-relaxed"
        style={{ borderColor: 'rgba(74, 23, 34, 0.08)', color: 'var(--lp-stone-muted)', background: '#f0ebe3' }}
      >
        {t('landing.demoDisclaimer')}
      </div>
    </div>
  );
}
