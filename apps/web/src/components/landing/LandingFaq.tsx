import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { fadeUp } from './landingMotion';

const FAQ_KEYS = ['start', 'import', 'recs', 'pricing', 'devices', 'privacy'] as const;

export function LandingFaq() {
  const { t } = useTranslation();

  return (
    <motion.div {...fadeUp} className="lp-faq max-w-3xl mx-auto">
      {FAQ_KEYS.map((key) => (
        <details key={key}>
          <summary>
            <span>{t(`landing.faq_${key}_q`)}</span>
            <span className="lp-faq-chevron text-lg leading-none" aria-hidden>
              +
            </span>
          </summary>
          <p className="pb-5 text-sm sm:text-base leading-relaxed pe-8" style={{ color: 'var(--lp-stone-muted)' }}>
            {t(`landing.faq_${key}_a`)}
          </p>
        </details>
      ))}
    </motion.div>
  );
}
