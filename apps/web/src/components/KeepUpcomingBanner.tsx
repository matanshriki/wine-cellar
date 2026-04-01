/**
 * KeepUpcomingBanner
 *
 * Shows a compact, dismissible amber banner for each reserved bottle
 * whose reserved_date is 1–7 days away. Dismissed once per calendar day
 * per bottle via localStorage.
 *
 * On the actual day, the full KeepReminderModal popup takes over instead.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { BottleWithWineInfo } from '../services/bottleService';
import { dismissBannerForToday } from './KeepReminderModal';
import { useLocalizedWine } from '../hooks/useLocalizedWine';

type UpcomingBottle = BottleWithWineInfo & { daysUntil: number };

interface KeepUpcomingBannerProps {
  bottles: UpcomingBottle[];
}

function BannerRow({
  bottle,
  onDismiss,
}: {
  bottle: UpcomingBottle;
  onDismiss: (id: string) => void;
}) {
  const { t } = useTranslation();
  const localizedWine = useLocalizedWine(bottle.wine);

  const daysLabel =
    bottle.daysUntil === 1
      ? t('cellar.bottle.keepBannerTomorrow')
      : t('cellar.bottle.keepBannerDays', { count: bottle.daysUntil });

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      exit={{ opacity: 0, y: -8, height: 0 }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      className="overflow-hidden"
    >
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{
          background: 'linear-gradient(135deg, rgba(212,175,55,0.12), rgba(180,140,30,0.18))',
          borderBottom: '1px solid rgba(212,175,55,0.2)',
        }}
      >
        {/* Icon */}
        <span className="text-lg flex-shrink-0 select-none" aria-hidden="true">🗓</span>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--gold-700, #92660a)' }}>
            {daysLabel}
            {bottle.reserved_for && (
              <span className="font-normal" style={{ color: 'var(--gold-600, #a37700)' }}>
                {' · '}{bottle.reserved_for}
              </span>
            )}
          </p>
          <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {localizedWine.wine_name}
            {localizedWine.producer ? ` · ${localizedWine.producer}` : ''}
          </p>
        </div>

        {/* Dismiss × */}
        <button
          onClick={() => {
            dismissBannerForToday(bottle.id);
            onDismiss(bottle.id);
          }}
          className="flex-shrink-0 p-1.5 rounded-full transition-colors duration-150"
          style={{
            color: 'var(--gold-600, #a37700)',
            WebkitTapHighlightColor: 'transparent',
          }}
          aria-label={t('common.dismiss', 'Dismiss')}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </motion.div>
  );
}

export function KeepUpcomingBanner({ bottles }: KeepUpcomingBannerProps) {
  const [visible, setVisible] = useState<UpcomingBottle[]>(bottles);

  const dismiss = (id: string) => {
    setVisible((prev) => prev.filter((b) => b.id !== id));
  };

  if (visible.length === 0) return null;

  return (
    <div
      className="w-full overflow-hidden rounded-xl"
      style={{
        border: '1px solid rgba(212,175,55,0.25)',
        boxShadow: '0 2px 12px rgba(212,175,55,0.08)',
        marginBottom: '1rem',
      }}
    >
      <AnimatePresence initial={false}>
        {visible.map((b) => (
          <BannerRow key={b.id} bottle={b} onDismiss={dismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}
