import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { fadeUp, prefersReducedMotion } from './landingMotion';

const PAINS = [
  { key: 'which', img: '/assets/landing/pain-which-bottle.jpg' },
  { key: 'late', img: '/assets/landing/pain-too-late.jpg' },
  { key: 'forgot', img: '/assets/landing/pain-forgot.jpg' },
] as const;

/** "Sound familiar?" — illustrated problem cards. */
export function LandingPainCards() {
  const { t } = useTranslation();

  return (
    <section
      id="problem"
      className="lp-section-anchor py-16 sm:py-24"
      style={{ background: 'var(--lp-surface)' }}
      aria-labelledby="landing-pain-heading"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <motion.div {...fadeUp} className="text-center mb-10 sm:mb-14">
          <h2
            id="landing-pain-heading"
            className="text-[1.9rem] sm:text-4xl lg:text-[2.75rem] font-semibold leading-tight mb-2"
            style={{ color: 'var(--lp-burgundy)' }}
          >
            {t('landing.painTitle')}
          </h2>
          <p className="text-lg sm:text-xl font-semibold" style={{ color: 'var(--lp-burgundy-bright)' }}>
            {t('landing.painSubtitle')}
          </p>
        </motion.div>

        <ul className="lp-snap-row list-none m-0 p-0">
          {PAINS.map(({ key, img }, i) => (
            <motion.li
              key={key}
              {...fadeUp}
              transition={
                prefersReducedMotion ? undefined : { duration: 0.45, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }
              }
              className="lp-pain-card"
            >
              <div className="relative overflow-hidden rounded-[1.25rem] mb-5" style={{ aspectRatio: '4 / 3' }}>
                <img
                  src={img}
                  alt=""
                  width={960}
                  height={640}
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                  aria-hidden
                />
              </div>
              <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--lp-ink)' }}>
                {t(`landing.pain_${key}_title`)}
              </h3>
              <p className="text-base leading-relaxed" style={{ color: 'var(--lp-stone-muted)' }}>
                {t(`landing.pain_${key}_body`)}
              </p>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}
