/**
 * Rate Ritual Sheet
 * 
 * Compact luxury sheet for rating a wine after opening.
 * Features 5-star rating, quick chips, and optional notes.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { WineTimer } from '../contexts/TimerContext';
import * as historyService from '../services/historyService';
import { toast } from '../lib/toast';
import { shouldReduceMotion } from '../utils/pwaAnimationFix';

interface RateRitualSheetProps {
  isOpen: boolean;
  onClose: () => void;
  timer?: WineTimer | null;
  bottleId?: string;
  wineName?: string;
  producer?: string;
  vintage?: number;
  imageUrl?: string;
}

const QUICK_CHIPS = [
  { id: 'buy_again', emoji: '🔁', labelKey: 'ritual.wouldBuyAgain' },
  { id: 'special_occasion', emoji: '🎉', labelKey: 'ritual.specialOccasion' },
  { id: 'food_pairing', emoji: '🍽️', labelKey: 'ritual.greatWithFood' },
];

export function RateRitualSheet({ 
  isOpen, 
  onClose, 
  timer, 
  bottleId: propBottleId,
  wineName: propWineName,
  producer: propProducer,
  vintage: propVintage,
  imageUrl: propImageUrl,
}: RateRitualSheetProps) {
  const { t } = useTranslation();
  const reduceMotion = shouldReduceMotion();
  
  const [rating, setRating] = useState(0);
  const [selectedChips, setSelectedChips] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Derive values from timer or props
  const bottleId = timer?.bottle_id || propBottleId;
  const wineName = timer?.wine_name || propWineName || 'Wine';
  const producer = timer?.producer || propProducer;
  const vintage = timer?.vintage || propVintage;
  const imageUrl = timer?.image_url || propImageUrl;

  // Reset state when sheet opens
  useEffect(() => {
    if (isOpen) {
      setRating(0);
      setSelectedChips([]);
      setNotes('');
      setIsLoading(false);
    }
  }, [isOpen]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const toggleChip = (chipId: string) => {
    setSelectedChips(prev => 
      prev.includes(chipId) 
        ? prev.filter(id => id !== chipId)
        : [...prev, chipId]
    );
  };

  const handleSave = async () => {
    if (!bottleId) {
      toast.error(t('ritual.noBottle', 'Unable to find bottle'));
      return;
    }

    if (rating === 0) {
      toast.error(t('ritual.pleaseRate', 'Please select a rating'));
      return;
    }

    setIsLoading(true);
    try {
      // Build notes with chips
      let fullNotes = notes.trim();
      if (selectedChips.length > 0) {
        const chipLabels = selectedChips.map(id => {
          const chip = QUICK_CHIPS.find(c => c.id === id);
          return chip ? `${chip.emoji} ${t(chip.labelKey, chip.id)}` : '';
        }).filter(Boolean);
        if (chipLabels.length > 0) {
          fullNotes = fullNotes 
            ? `${chipLabels.join(' · ')}\n\n${fullNotes}`
            : chipLabels.join(' · ');
        }
      }

      await historyService.updateConsumptionHistory(bottleId, {
        user_rating: rating,
        tasting_notes: fullNotes || undefined,
      });

      toast.success(t('ritual.ratingSaved', 'Rating saved!'));
      onClose();
    } catch (error: any) {
      console.error('Failed to save rating:', error);
      toast.error(error.message || t('ritual.saveFailed', 'Failed to save rating'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0"
            style={{
              background: 'var(--bg-overlay)',
              backdropFilter: 'var(--blur-medium)',
              WebkitBackdropFilter: 'var(--blur-medium)',
            }}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Sheet */}
          <motion.div
            className="relative w-full sm:max-w-md z-10 ios-modal-scroll"
            style={{
              background: 'var(--bg-surface)',
              borderTopLeftRadius: 'var(--radius-2xl)',
              borderTopRightRadius: 'var(--radius-2xl)',
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
              boxShadow: 'var(--shadow-2xl)',
              maxHeight: 'calc(85dvh - env(safe-area-inset-bottom))',
              marginBottom: 'env(safe-area-inset-bottom)',
            }}
            initial={reduceMotion ? { opacity: 0 } : { y: '100%' }}
            animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { y: '100%' }}
            transition={{ type: 'tween', duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div 
                className="w-12 h-1 rounded-full" 
                style={{ background: 'var(--border-medium)' }}
              />
            </div>

            {/* Content */}
            <div className="px-6 pb-6 overflow-y-auto" style={{ maxHeight: 'calc(75dvh - 3rem)' }}>
              {/* Header */}
              <div className="text-center mb-6">
                <h3 
                  className="text-xl font-bold mb-1"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {t('ritual.rateThisWine', 'Rate This Wine')}
                </h3>
                <p 
                  className="text-sm"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {wineName}
                  {producer && ` by ${producer}`}
                  {vintage && ` · ${vintage}`}
                </p>
              </div>

              {/* Star Rating */}
              <div className="flex justify-center gap-2 mb-6">
                {[1, 2, 3, 4, 5].map((star) => (
                  <motion.button
                    key={star}
                    onClick={() => setRating(star)}
                    className="p-1"
                    whileTap={{ scale: 0.9 }}
                    whileHover={{ scale: 1.1 }}
                  >
                    <motion.svg
                      className="w-10 h-10"
                      viewBox="0 0 24 24"
                      fill={star <= rating ? 'var(--wine-500)' : 'none'}
                      stroke={star <= rating ? 'var(--wine-500)' : 'var(--border-medium)'}
                      strokeWidth={1.5}
                      initial={false}
                      animate={star <= rating ? { scale: [1, 1.2, 1] } : {}}
                      transition={{ duration: 0.2 }}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                      />
                    </motion.svg>
                  </motion.button>
                ))}
              </div>

              {/* Quick Chips */}
              <div className="mb-5">
                <p 
                  className="text-sm font-medium mb-3 text-center"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {t('ritual.quickTags', 'Quick Tags (optional)')}
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {QUICK_CHIPS.map((chip) => (
                    <motion.button
                      key={chip.id}
                      onClick={() => toggleChip(chip.id)}
                      className="px-4 py-2 rounded-full text-sm font-medium transition-all"
                      style={{
                        background: selectedChips.includes(chip.id) ? 'var(--wine-100)' : 'var(--bg-muted)',
                        color: selectedChips.includes(chip.id) ? 'var(--wine-700)' : 'var(--text-secondary)',
                        border: `2px solid ${selectedChips.includes(chip.id) ? 'var(--wine-400)' : 'transparent'}`,
                      }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {chip.emoji} {t(chip.labelKey, chip.id.replace('_', ' '))}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="mb-6">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('ritual.notesPlaceholder', 'Add tasting notes...')}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl resize-none transition-all"
                  style={{
                    background: 'var(--bg-muted)',
                    color: 'var(--text-primary)',
                    border: '2px solid var(--border-subtle)',
                  }}
                />
              </div>

              {/* CTAs */}
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  disabled={isLoading}
                  className="flex-1 py-3.5 rounded-xl font-medium transition-all disabled:opacity-50"
                  style={{
                    background: 'var(--bg-muted)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <motion.button
                  onClick={handleSave}
                  disabled={isLoading || rating === 0}
                  className="flex-1 py-3.5 rounded-xl font-semibold transition-all disabled:opacity-50"
                  style={{
                    background: 'linear-gradient(135deg, var(--wine-500), var(--wine-600))',
                    color: 'white',
                    boxShadow: '0 4px 12px rgba(164, 76, 104, 0.3)',
                  }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isLoading ? t('common.saving', 'Saving...') : t('ritual.saveRating', 'Save Rating')}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
