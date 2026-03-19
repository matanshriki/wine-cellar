/**
 * RateRitualSheet
 *
 * A compact luxury bottom sheet for rating a bottle after opening.
 * Updates the existing consumption_history record (no new DB row).
 *
 * Features:
 *  – 5-star interactive rating
 *  – 3 optional quick-mood chips
 *  – Free-text notes
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import * as historyService from '../services/historyService';
import { toast } from '../lib/toast';
import { shouldReduceMotion } from '../utils/pwaAnimationFix';

const reduce = shouldReduceMotion();

export const MOOD_CHIPS = [
  { id: 'would_buy_again', emoji: '🔁', labelKey: 'rateRitual.chips.wouldBuyAgain' },
  { id: 'great_with_food', emoji: '🍽️', labelKey: 'rateRitual.chips.greatWithFood' },
  { id: 'special_occasion', emoji: '✨', labelKey: 'rateRitual.chips.specialOccasion' },
] as const;

interface RateRitualSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after a rating is successfully saved (before onClose) */
  onRated?: () => void;
  historyId: string;
  wineName: string;
  producer: string;
  /** Pre-fill the sheet when editing an existing rating */
  initialRating?: number;
  initialNotes?: string;
  initialChipIds?: string[];
}

function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [hovered, setHovered] = useState(0);

  return (
    <div className="flex gap-1 justify-center" role="group" aria-label="Star rating">
      {[1, 2, 3, 4, 5].map(star => {
        const filled = star <= (hovered || value);
        return (
          <motion.button
            key={star}
            whileTap={{ scale: 0.8 }}
            onClick={() => onChange(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            onTouchStart={() => setHovered(star)}
            onTouchEnd={() => setHovered(0)}
            aria-label={`${star} star${star !== 1 ? 's' : ''}`}
            className="p-1"
            style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
          >
            <motion.span
              animate={{ scale: filled ? 1.15 : 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              className="text-3xl block"
              style={{
                filter: filled ? 'none' : 'grayscale(1) opacity(0.4)',
                color: filled ? '#D4AF37' : undefined,
              }}
            >
              ⭐
            </motion.span>
          </motion.button>
        );
      })}
    </div>
  );
}

export function RateRitualSheet({
  isOpen,
  onClose,
  onRated,
  historyId,
  wineName,
  producer,
  initialRating,
  initialNotes,
  initialChipIds,
}: RateRitualSheetProps) {
  const { t } = useTranslation();

  const [rating, setRating] = useState(initialRating ?? 0);
  const [selectedChips, setSelectedChips] = useState<Set<string>>(new Set(initialChipIds ?? []));
  const [notes, setNotes] = useState(initialNotes ?? '');
  const [loading, setLoading] = useState(false);

  // Sync prefill values whenever the sheet is opened (handles editing existing ratings)
  useEffect(() => {
    if (isOpen) {
      setRating(initialRating ?? 0);
      setSelectedChips(new Set(initialChipIds ?? []));
      setNotes(initialNotes ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  function toggleChip(id: string) {
    setSelectedChips(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    if (rating === 0) {
      toast.error(t('rateRitual.selectRating', 'Please select a rating'));
      return;
    }

    setLoading(true);
    try {
      const chipsText =
        selectedChips.size > 0
          ? Array.from(selectedChips)
              .map(id => MOOD_CHIPS.find(c => c.id === id)?.emoji)
              .join(' ')
          : undefined;

      const combinedNotes = [chipsText, notes.trim()].filter(Boolean).join(' · ') || undefined;

      await historyService.updateConsumptionHistory(historyId, {
        user_rating: rating,
        tasting_notes: combinedNotes,
      });

      toast.success(t('rateRitual.saved', 'Rating saved!'));
      onRated?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || t('rateRitual.saveFailed', 'Failed to save rating'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="rate-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60]"
            style={{
              background: 'var(--bg-overlay)',
              backdropFilter: 'var(--blur-medium)',
              WebkitBackdropFilter: 'var(--blur-medium)',
            }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            key="rate-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'tween', duration: reduce ? 0 : 0.28, ease: [0.4, 0, 0.2, 1] }}
            onClick={e => e.stopPropagation()}
            className="fixed left-0 right-0 z-[61] flex flex-col"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-light)',
              boxShadow: 'var(--shadow-xl)',
              bottom: 'max(0px, var(--safe-bottom))',
              maxHeight: 'calc(88dvh - max(0px, var(--safe-bottom)))',
              borderTopLeftRadius: 'var(--radius-2xl)',
              borderTopRightRadius: 'var(--radius-2xl)',
              borderBottom: 'none',
            }}
            role="dialog"
            aria-modal="true"
            aria-label={t('rateRitual.ariaLabel', 'Rate this wine')}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
              <div className="w-12 h-1 rounded-full" style={{ backgroundColor: 'var(--border-medium)' }} />
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-6 pb-4 space-y-5">
              {/* Header */}
              <div className="text-center">
                <h2
                  className="text-xl font-bold"
                  style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
                >
                  {t('rateRitual.title', 'How was it?')}
                </h2>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                  {producer} · {wineName}
                </p>
              </div>

              {/* Star rating */}
              <StarRating value={rating} onChange={setRating} />

              {/* Mood chips */}
              <div className="flex gap-2 justify-center flex-wrap">
                {MOOD_CHIPS.map(chip => {
                  const active = selectedChips.has(chip.id);
                  return (
                    <motion.button
                      key={chip.id}
                      whileTap={{ scale: 0.93 }}
                      onClick={() => toggleChip(chip.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all"
                      style={{
                        background: active ? 'var(--wine-50, #fdf2f5)' : 'var(--bg-muted)',
                        color: active ? 'var(--wine-700)' : 'var(--text-secondary)',
                        border: active ? '1px solid var(--wine-400)' : '1px solid var(--border-subtle)',
                      }}
                    >
                      <span>{chip.emoji}</span>
                      <span>{t(chip.labelKey)}</span>
                    </motion.button>
                  );
                })}
              </div>

              {/* Notes textarea */}
              <div>
                <label
                  className="block text-xs mb-1.5 font-medium"
                  style={{ color: 'var(--text-tertiary)' }}
                  htmlFor="tasting-notes"
                >
                  {t('rateRitual.notesLabel', 'Tasting notes (optional)')}
                </label>
                <textarea
                  id="tasting-notes"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder={t('rateRitual.notesPlaceholder', 'Describe what you tasted…')}
                  rows={3}
                  maxLength={400}
                  className="w-full rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none transition-colors"
                  style={{
                    background: 'var(--bg-muted)',
                    border: '1px solid var(--border-medium)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
            </div>

            {/* Actions */}
            <div
              className="flex-shrink-0 px-6 pt-3 pb-4 space-y-2"
              style={{ borderTop: '1px solid var(--border-subtle)' }}
            >
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSave}
                disabled={loading || rating === 0}
                className="w-full py-3.5 rounded-xl font-semibold text-sm transition-opacity"
                style={{
                  background:
                    rating === 0
                      ? 'var(--bg-muted)'
                      : 'linear-gradient(135deg, var(--wine-600), var(--wine-700))',
                  color: rating === 0 ? 'var(--text-tertiary)' : 'white',
                  border: rating === 0 ? '1px solid var(--border-medium)' : '1px solid var(--wine-700)',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? t('rateRitual.saving', 'Saving…') : t('rateRitual.save', 'Save rating')}
              </motion.button>
              <button
                onClick={onClose}
                className="w-full py-3 text-sm rounded-xl"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {t('rateRitual.skipRating', 'Skip for now')}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
