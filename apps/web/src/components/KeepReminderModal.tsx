/**
 * KeepReminderModal
 *
 * Shown once per day per bottle when a reserved bottle's reserved_date has arrived
 * (today or in the past). The user can:
 *   • Open the bottle now  → triggers the standard mark-as-opened flow
 *   • Snooze for today      → dismissed for today (localStorage key)
 *   • Remove the reservation → clears the Keep flag on the bottle
 *
 * Dismissed reminders are stored in localStorage so the modal doesn't reappear
 * during the same calendar day for the same bottle.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { BottleWithWineInfo } from '../services/bottleService';
import * as bottleService from '../services/bottleService';
import { useLocalizedWine } from '../hooks/useLocalizedWine';
import { useWineDisplayImage } from '../hooks/useWineDisplayImage';
import { toast } from '../lib/toast';

const DISMISSED_KEY = 'keep-reminder-dismissed'; // localStorage key

/** Returns the set of bottle IDs dismissed today. */
function getDismissedToday(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return new Set();
    const parsed: { date: string; ids: string[] } = JSON.parse(raw);
    const today = new Date().toISOString().slice(0, 10);
    if (parsed.date !== today) return new Set();
    return new Set(parsed.ids);
  } catch {
    return new Set();
  }
}

/** Mark a bottle ID as dismissed for today. */
function dismissForToday(bottleId: string) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const existing = getDismissedToday();
    existing.add(bottleId);
    localStorage.setItem(
      DISMISSED_KEY,
      JSON.stringify({ date: today, ids: Array.from(existing) })
    );
  } catch {
    // non-critical
  }
}

/** Returns bottles whose reserved_date ≤ today and haven't been dismissed today. */
export function findDueReminders(
  bottles: BottleWithWineInfo[]
): BottleWithWineInfo[] {
  const today = new Date().toISOString().slice(0, 10);
  const dismissed = getDismissedToday();
  return bottles.filter(
    (b) =>
      b.is_reserved &&
      b.reserved_date &&
      b.reserved_date <= today &&
      !dismissed.has(b.id)
  );
}

interface KeepReminderModalProps {
  bottles: BottleWithWineInfo[]; // all due reminders
  onOpenBottle: (bottle: BottleWithWineInfo) => void; // open standard mark-as-opened flow
  onRefresh: () => void;
}

/** Inner card for one bottle reminder */
function ReminderCard({
  bottle,
  onOpenBottle,
  onRefresh,
  onDone,
}: {
  bottle: BottleWithWineInfo;
  onOpenBottle: (b: BottleWithWineInfo) => void;
  onRefresh: () => void;
  onDone: () => void;
}) {
  const { t, i18n } = useTranslation();
  const localizedWine = useLocalizedWine(bottle.wine);
  const displayImage = useWineDisplayImage(bottle.wine);
  const [removing, setRemoving] = useState(false);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString(i18n.language, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

  const handleSnooze = () => {
    dismissForToday(bottle.id);
    onDone();
  };

  const handleOpen = () => {
    dismissForToday(bottle.id);
    onDone();
    onOpenBottle(bottle);
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await bottleService.updateBottle(bottle.id, {
        is_reserved: false,
        reserved_for: null,
        reserved_date: null,
        reserved_note: null,
      });
      toast.success(t('cellar.bottle.keepRemoved'));
      dismissForToday(bottle.id);
      onRefresh();
      onDone();
    } catch {
      toast.error(t('errors.generic', 'Something went wrong'));
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Bottle info */}
      <div className="flex gap-4 items-center">
        {/* Label image */}
        {displayImage.imageUrl && (
          <div className="flex-shrink-0">
            <img
              src={displayImage.imageUrl}
              alt={localizedWine.wine_name}
              className="w-20 h-28 object-cover rounded-xl"
              style={{
                border: '1px solid var(--border-base)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              }}
              loading="lazy"
            />
          </div>
        )}

        {/* Wine details */}
        <div className="flex-1 min-w-0">
          <p
            className="text-xl font-bold leading-tight mb-1 line-clamp-2"
            style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
          >
            {localizedWine.wine_name}
          </p>
          {localizedWine.producer && (
            <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
              {localizedWine.producer}
            </p>
          )}
          {bottle.wine.vintage && (
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
              {bottle.wine.vintage}
              {localizedWine.region ? ` · ${localizedWine.region}` : ''}
            </p>
          )}
        </div>
      </div>

      {/* Occasion card */}
      <div
        className="p-4 rounded-2xl space-y-2"
        style={{
          background: 'linear-gradient(135deg, rgba(212,175,55,0.10), rgba(180,140,30,0.15))',
          border: '1px solid rgba(212,175,55,0.35)',
        }}
      >
        {bottle.reserved_for && (
          <div className="flex items-center gap-2">
            <span className="text-lg" aria-hidden="true">🎉</span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider mb-0.5" style={{ color: 'rgba(212,175,55,0.8)' }}>
                {t('cellar.bottle.keepReminderFor')}
              </p>
              <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                {bottle.reserved_for}
              </p>
            </div>
          </div>
        )}
        {bottle.reserved_date && (
          <div className="flex items-center gap-2">
            <span className="text-lg" aria-hidden="true">📅</span>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {formatDate(bottle.reserved_date)}
            </p>
          </div>
        )}
        {bottle.reserved_note && (
          <div className="flex items-start gap-2">
            <span className="text-lg" aria-hidden="true">📝</span>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {bottle.reserved_note}
            </p>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-2.5">
        {/* Primary: Open bottle */}
        <button
          onClick={handleOpen}
          className="w-full py-3.5 px-5 rounded-xl font-semibold text-base transition-all duration-200"
          style={{
            background: 'linear-gradient(135deg, var(--wine-600), var(--wine-700))',
            color: 'white',
            boxShadow: '0 4px 16px rgba(164,77,90,0.3)',
            minHeight: '52px',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {t('cellar.bottle.keepReminderOpenNow')}
        </button>

        {/* Secondary: Snooze + Remove */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleSnooze}
            className="py-2.5 px-3 rounded-xl text-sm font-medium transition-all duration-150"
            style={{
              background: 'var(--bg-muted)',
              border: '1px solid var(--border-base)',
              color: 'var(--text-secondary)',
              minHeight: '44px',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {t('cellar.bottle.keepReminderSnooze')}
          </button>
          <button
            onClick={handleRemove}
            disabled={removing}
            className="py-2.5 px-3 rounded-xl text-sm font-medium transition-all duration-150"
            style={{
              background: 'var(--bg-muted)',
              border: '1px solid var(--border-base)',
              color: removing ? 'var(--text-tertiary)' : 'var(--text-secondary)',
              minHeight: '44px',
              cursor: removing ? 'not-allowed' : 'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {removing ? '…' : t('cellar.bottle.keepReminderRemove')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function KeepReminderModal({
  bottles,
  onOpenBottle,
  onRefresh,
}: KeepReminderModalProps) {
  const { t } = useTranslation();

  // Track which reminders remain; pop them off one at a time
  const [queue, setQueue] = useState<BottleWithWineInfo[]>(bottles);
  const current = queue[0] ?? null;

  const handleDone = () => {
    setQueue((q) => q.slice(1));
  };

  const isOpen = queue.length > 0;

  return (
    <AnimatePresence>
      {isOpen && current && (
        <motion.div
          key="keep-reminder-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 sm:p-6"
          style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', background: 'rgba(0,0,0,0.55)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) handleDone();
          }}
        >
          <motion.div
            key={current.id}
            initial={{ scale: 0.94, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 24 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="luxury-card w-full overflow-hidden"
            style={{ maxWidth: '26rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="px-6 pt-6 pb-4 text-center relative"
              style={{
                background: 'linear-gradient(160deg, rgba(212,175,55,0.08) 0%, transparent 60%)',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              {/* Multiple reminders indicator */}
              {queue.length > 1 && (
                <div
                  className="absolute top-4 end-4 text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{
                    background: 'var(--wine-50)',
                    color: 'var(--wine-700)',
                    border: '1px solid var(--wine-200)',
                  }}
                >
                  {queue.length}
                </div>
              )}

              {/* Decorative icon */}
              <div className="text-4xl mb-3 select-none" aria-hidden="true">🍾</div>

              <h2
                className="text-xl font-bold mb-1"
                style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
              >
                {t('cellar.bottle.keepReminderTitle')}
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {t('cellar.bottle.keepReminderSubtitle')}
              </p>
            </div>

            {/* Body */}
            <div className="px-6 py-5">
              <AnimatePresence mode="wait">
                <motion.div
                  key={current.id + '-card'}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.18 }}
                >
                  <ReminderCard
                    bottle={current}
                    onOpenBottle={onOpenBottle}
                    onRefresh={onRefresh}
                    onDone={handleDone}
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
