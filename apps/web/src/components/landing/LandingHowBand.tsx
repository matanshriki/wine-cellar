import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { trackCTAButtonClick } from '../../lib/metaPixel';
import { fadeUp } from './landingMotion';

const STEPS = [
  { step: 1, shot: 'add' },
  { step: 2, shot: 'ask' },
  { step: 3, shot: 'pick' },
] as const;

/** "How it works" — big numerals over real app screens on a burgundy band. */
export function LandingHowBand() {
  const { t, i18n } = useTranslation();
  const loc = i18n.language?.startsWith('he') ? 'he' : 'en';

  return (
    <section
      id="how-it-works"
      className="lp-section-anchor lp-how-band relative overflow-hidden py-16 sm:py-24"
      aria-labelledby="landing-how-heading"
    >
      <div className="relative z-[1] max-w-6xl mx-auto px-4 sm:px-6">
        <motion.div {...fadeUp} className="text-center mb-12 sm:mb-16">
          <h2
            id="landing-how-heading"
            className="text-[1.9rem] sm:text-4xl lg:text-[2.75rem] font-semibold leading-tight mb-3"
            style={{ color: 'var(--lp-ivory)' }}
          >
            {t('landing.howTitle')}
          </h2>
          <p className="text-base sm:text-lg" style={{ color: 'rgba(247, 241, 232, 0.78)' }}>
            {t('landing.howBandSubtitle')}
          </p>
        </motion.div>

        <ol className="grid grid-cols-1 md:grid-cols-3 gap-14 md:gap-8 list-none m-0 p-0">
          {STEPS.map(({ step, shot }) => (
            <motion.li key={step} {...fadeUp} className="flex flex-col items-center text-center">
              <div className="relative mb-7">
                <span className="lp-how-numeral" aria-hidden>
                  {step}
                </span>
                <div className="lp-how-phone relative">
                  <img
                    src={`/assets/landing/app/${loc}-${shot}.jpg`}
                    alt={t(`landing.howShotAlt${step}`)}
                    width={585}
                    height={1211}
                    className="block h-full w-full object-cover object-top"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </div>
              <p className="sr-only">{t('landing.howStepLabel', { step })}</p>
              <h3 className="text-xl sm:text-2xl font-semibold mb-2" style={{ color: 'var(--lp-ivory)' }}>
                {t(`landing.how${step}Title`)}
              </h3>
              <p className="text-base leading-relaxed max-w-xs" style={{ color: 'rgba(247, 241, 232, 0.75)' }}>
                {t(`landing.how${step}Body`)}
              </p>
            </motion.li>
          ))}
        </ol>

        <motion.div {...fadeUp} className="mt-14 flex justify-center">
          <Link
            to="/login"
            className="lp-cta-gold"
            onClick={() => {
              void trackCTAButtonClick({ placement: 'how', cta: 'start_free' });
            }}
          >
            {t('landing.ctaStartFree')}
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
