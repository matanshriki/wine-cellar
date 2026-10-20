import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  BellRing,
  Bookmark,
  BookOpen,
  History,
  Hourglass,
  MessageCircle,
  ScanLine,
  Sparkles,
  UtensilsCrossed,
  Wine,
  type LucideIcon,
} from 'lucide-react';
import { fadeUp, prefersReducedMotion } from './landingMotion';

type Tone = 'burgundy' | 'gold' | 'sage' | 'rose' | 'cream';

const FEATURES: { key: string; Icon: LucideIcon; tone: Tone }[] = [
  { key: 'cellar', Icon: Wine, tone: 'burgundy' },
  { key: 'window', Icon: Hourglass, tone: 'gold' },
  { key: 'scan', Icon: ScanLine, tone: 'sage' },
  { key: 'pairing', Icon: UtensilsCrossed, tone: 'rose' },
  { key: 'tonight', Icon: Sparkles, tone: 'cream' },
  { key: 'chat', Icon: MessageCircle, tone: 'gold' },
  { key: 'profile', Icon: BookOpen, tone: 'rose' },
  { key: 'history', Icon: History, tone: 'burgundy' },
  { key: 'wishlist', Icon: Bookmark, tone: 'cream' },
  { key: 'reminders', Icon: BellRing, tone: 'sage' },
];

/** Colored "blob" grid of everything the app does. */
export function LandingFeatureBlobs() {
  const { t } = useTranslation();

  return (
    <section
      id="features"
      className="lp-section-anchor py-16 sm:py-24"
      style={{ background: 'var(--lp-ivory)' }}
      aria-labelledby="landing-features-heading"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <motion.div {...fadeUp} className="text-center mb-10 sm:mb-14">
          <h2
            id="landing-features-heading"
            className="text-[1.75rem] sm:text-4xl font-semibold leading-tight mb-3"
            style={{ color: 'var(--lp-ink)' }}
          >
            {t('landing.featuresTitle')}
          </h2>
          <p className="text-base sm:text-lg" style={{ color: 'var(--lp-stone-muted)' }}>
            {t('landing.featuresSubtitle')}
          </p>
        </motion.div>

        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-8 sm:gap-y-10 list-none m-0 p-0">
          {FEATURES.map(({ key, Icon, tone }, i) => (
            <motion.li
              key={key}
              className="flex flex-col items-center text-center"
              initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.85 }}
              whileInView={prefersReducedMotion ? undefined : { opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.4, delay: (i % 5) * 0.06, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className={`lp-blob lp-blob-${tone} lp-blob-shape-${i % 4}`}>
                <Icon className="h-9 w-9 sm:h-10 sm:w-10" strokeWidth={1.75} aria-hidden />
              </div>
              <span className="mt-3 text-sm sm:text-base font-semibold" style={{ color: 'var(--lp-ink)' }}>
                {t(`landing.feature_${key}`)}
              </span>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}
