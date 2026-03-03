/**
 * Open Ritual Sheet
 * 
 * Premium multi-step modal for the wine opening ritual:
 * 1. Confirm quantity (if multiple bottles)
 * 2. Serving guidance + timer options
 * 3. Success + rate reminder option
 */

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { BottleWithWineInfo } from '../services/bottleService';
import { getServingRecommendations, DECANT_PRESETS, RATE_REMINDER_PRESETS, getDefaultDecantPresetIndex, getDefaultRatePresetIndex } from '../utils/servingRecommendations';
import { useTimers } from '../contexts/TimerContext';
import * as historyService from '../services/historyService';
import { toast } from '../lib/toast';
import { shouldReduceMotion } from '../utils/pwaAnimationFix';
import { WineGlassFillAnimation } from './WineGlassFillAnimation';

interface OpenRitualSheetProps {
  isOpen: boolean;
  onClose: () => void;
  bottle: BottleWithWineInfo | null;
  onSuccess?: () => void;
  planEveningId?: string;
}

type RitualStep = 'open' | 'serve' | 'success';

export function OpenRitualSheet({ isOpen, onClose, bottle, onSuccess, planEveningId }: OpenRitualSheetProps) {
  const { t } = useTranslation();
  const { createTimer } = useTimers();
  const reduceMotion = shouldReduceMotion();
  
  const [step, setStep] = useState<RitualStep>('open');
  const [quantity, setQuantity] = useState(1);
  const [enableDecantTimer, setEnableDecantTimer] = useState(false);
  const [selectedDecantIndex, setSelectedDecantIndex] = useState(1);
  const [selectedRateIndex, setSelectedRateIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showRateOption, setShowRateOption] = useState(false);

  // Get serving recommendations
  const recommendations = useMemo(() => {
    if (!bottle) return null;
    return getServingRecommendations(bottle);
  }, [bottle]);

  // Reset state when sheet opens
  useEffect(() => {
    if (isOpen && bottle) {
      setStep('open');
      setQuantity(1);
      setIsLoading(false);
      setShowRateOption(false);
      
      if (recommendations) {
        const decantRecommended = recommendations.decant.recommended;
        setEnableDecantTimer(decantRecommended);
        setSelectedDecantIndex(getDefaultDecantPresetIndex(recommendations.decant.minutes));
        setSelectedRateIndex(getDefaultRatePresetIndex(recommendations.decant.minutes));
      }
    }
  }, [isOpen, bottle, recommendations]);

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

  const wine = bottle?.wine;
  const maxQuantity = bottle?.quantity || 1;
  const hasMultipleBottles = maxQuantity > 1;

  const handleQuantityChange = (delta: number) => {
    const newQty = Math.max(1, Math.min(maxQuantity, quantity + delta));
    setQuantity(newQty);
  };

  const handleContinueToServe = () => {
    setStep('serve');
  };

  const handleOpenAndStart = async () => {
    if (!bottle) return;
    
    setIsLoading(true);
    try {
      await historyService.markBottleOpened({
        bottle_id: bottle.id,
        opened_quantity: quantity,
      });

      // Start decant timer if enabled
      if (enableDecantTimer) {
        const decantMinutes = DECANT_PRESETS[selectedDecantIndex].minutes;
        createTimer({
          wine_id: bottle.wine_id,
          wine_name: wine?.wine_name || 'Wine',
          producer: wine?.producer,
          vintage: wine?.vintage,
          duration_minutes: decantMinutes,
          type: 'decant',
          label: t('ritual.decanting', 'Decanting'),
          bottle_id: bottle.id,
          image_url: wine?.image_url || bottle.image_url || undefined,
          plan_evening_id: planEveningId,
        });
      }

      setStep('success');
      setShowRateOption(true);
    } catch (error: any) {
      console.error('Failed to open bottle:', error);
      toast.error(error.message || t('ritual.openFailed', 'Failed to open bottle'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipTimer = async () => {
    if (!bottle) return;
    
    setIsLoading(true);
    try {
      await historyService.markBottleOpened({
        bottle_id: bottle.id,
        opened_quantity: quantity,
      });
      
      setStep('success');
      setShowRateOption(true);
    } catch (error: any) {
      console.error('Failed to open bottle:', error);
      toast.error(error.message || t('ritual.openFailed', 'Failed to open bottle'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetRateReminder = () => {
    if (!bottle) return;
    
    const reminderMinutes = RATE_REMINDER_PRESETS[selectedRateIndex].minutes;
    createTimer({
      wine_id: bottle.wine_id,
      wine_name: wine?.wine_name || 'Wine',
      producer: wine?.producer,
      vintage: wine?.vintage,
      duration_minutes: reminderMinutes,
      type: 'rate',
      label: t('ritual.rateReminder', 'Rate this wine'),
      bottle_id: bottle.id,
      image_url: wine?.image_url || bottle.image_url || undefined,
      plan_evening_id: planEveningId,
    });
    
    toast.success(t('ritual.reminderSet', 'Reminder set!'));
    handleClose();
  };

  const handleClose = () => {
    if (step === 'success') {
      onSuccess?.();
    }
    onClose();
  };

  const handleNoThanks = () => {
    handleClose();
  };

  if (!bottle || !wine) return null;

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
            onClick={() => step !== 'success' && handleClose()}
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
              maxHeight: 'calc(90dvh - env(safe-area-inset-bottom))',
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
            <div className="px-6 pb-6 overflow-y-auto" style={{ maxHeight: 'calc(80dvh - 3rem)' }}>
              <AnimatePresence mode="wait">
                {step === 'open' && (
                  <StepOpen
                    key="step-open"
                    wine={wine}
                    bottle={bottle}
                    quantity={quantity}
                    maxQuantity={maxQuantity}
                    hasMultipleBottles={hasMultipleBottles}
                    onQuantityChange={handleQuantityChange}
                    onContinue={handleContinueToServe}
                    onCancel={handleClose}
                    reduceMotion={reduceMotion}
                  />
                )}

                {step === 'serve' && recommendations && (
                  <StepServe
                    key="step-serve"
                    wine={wine}
                    recommendations={recommendations}
                    enableDecantTimer={enableDecantTimer}
                    setEnableDecantTimer={setEnableDecantTimer}
                    selectedDecantIndex={selectedDecantIndex}
                    setSelectedDecantIndex={setSelectedDecantIndex}
                    onStartAndOpen={handleOpenAndStart}
                    onSkipTimer={handleSkipTimer}
                    isLoading={isLoading}
                    reduceMotion={reduceMotion}
                  />
                )}

                {step === 'success' && (
                  <StepSuccess
                    key="step-success"
                    wine={wine}
                    showRateOption={showRateOption}
                    selectedRateIndex={selectedRateIndex}
                    setSelectedRateIndex={setSelectedRateIndex}
                    onSetReminder={handleSetRateReminder}
                    onNoThanks={handleNoThanks}
                    reduceMotion={reduceMotion}
                  />
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Step 1: Open - Quantity selection
interface StepOpenProps {
  wine: any;
  bottle: BottleWithWineInfo;
  quantity: number;
  maxQuantity: number;
  hasMultipleBottles: boolean;
  onQuantityChange: (delta: number) => void;
  onContinue: () => void;
  onCancel: () => void;
  reduceMotion: boolean;
}

function StepOpen({ wine, bottle, quantity, maxQuantity, hasMultipleBottles, onQuantityChange, onContinue, onCancel, reduceMotion }: StepOpenProps) {
  const { t } = useTranslation();
  const imageUrl = wine?.image_url || bottle?.image_url;

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -20 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      {/* Wine Card */}
      <div 
        className="flex items-center gap-4 p-4 rounded-xl"
        style={{ background: 'var(--bg-muted)' }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={wine?.wine_name}
            className="w-16 h-20 object-contain rounded-lg"
            style={{ background: 'var(--bg-surface)' }}
          />
        ) : (
          <div 
            className="w-16 h-20 rounded-lg flex items-center justify-center text-3xl"
            style={{ background: 'var(--bg-surface)' }}
          >
            🍷
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 
            className="font-semibold text-lg truncate"
            style={{ color: 'var(--text-primary)' }}
          >
            {wine?.wine_name}
          </h3>
          <p 
            className="text-sm truncate"
            style={{ color: 'var(--text-secondary)' }}
          >
            {wine?.producer}
          </p>
          <p 
            className="text-sm"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {wine?.vintage && `${wine.vintage} · `}
            {wine?.region}
          </p>
        </div>
      </div>

      {/* Quantity Stepper (only if multiple bottles) */}
      {hasMultipleBottles && (
        <div className="space-y-3">
          <p 
            className="text-center font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            {t('ritual.howMany', 'How many bottles are you opening?')}
          </p>
          <div className="flex items-center justify-center gap-4">
            <motion.button
              onClick={() => onQuantityChange(-1)}
              disabled={quantity <= 1}
              className="w-14 h-14 rounded-full flex items-center justify-center transition-all disabled:opacity-30"
              style={{
                background: quantity > 1 ? 'var(--wine-600)' : 'var(--bg-muted)',
                color: quantity > 1 ? 'white' : 'var(--text-tertiary)',
              }}
              whileTap={{ scale: 0.95 }}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
              </svg>
            </motion.button>

            <div 
              className="w-20 h-20 rounded-2xl flex items-center justify-center"
              style={{ 
                background: 'var(--bg-muted)',
                border: '2px solid var(--border-medium)',
              }}
            >
              <span 
                className="text-4xl font-bold"
                style={{ color: 'var(--text-primary)' }}
              >
                {quantity}
              </span>
            </div>

            <motion.button
              onClick={() => onQuantityChange(1)}
              disabled={quantity >= maxQuantity}
              className="w-14 h-14 rounded-full flex items-center justify-center transition-all disabled:opacity-30"
              style={{
                background: quantity < maxQuantity ? 'var(--wine-600)' : 'var(--bg-muted)',
                color: quantity < maxQuantity ? 'white' : 'var(--text-tertiary)',
              }}
              whileTap={{ scale: 0.95 }}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </motion.button>
          </div>
          <p 
            className="text-center text-sm"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {t('ritual.inCellar', '{{count}} in cellar', { count: maxQuantity })}
          </p>
        </div>
      )}

      {/* CTAs */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onCancel}
          className="flex-1 py-3.5 rounded-xl font-medium transition-all"
          style={{
            background: 'var(--bg-muted)',
            color: 'var(--text-secondary)',
          }}
        >
          {t('common.cancel', 'Cancel')}
        </button>
        <motion.button
          onClick={onContinue}
          className="flex-1 py-3.5 rounded-xl font-semibold transition-all"
          style={{
            background: 'linear-gradient(135deg, var(--wine-500), var(--wine-600))',
            color: 'white',
            boxShadow: '0 4px 12px rgba(164, 76, 104, 0.3)',
          }}
          whileTap={{ scale: 0.98 }}
        >
          {t('common.continue', 'Continue')}
        </motion.button>
      </div>
    </motion.div>
  );
}

// Step 2: Serve - Temperature and decant options
interface StepServeProps {
  wine: any;
  recommendations: ReturnType<typeof getServingRecommendations>;
  enableDecantTimer: boolean;
  setEnableDecantTimer: (val: boolean) => void;
  selectedDecantIndex: number;
  setSelectedDecantIndex: (idx: number) => void;
  onStartAndOpen: () => void;
  onSkipTimer: () => void;
  isLoading: boolean;
  reduceMotion: boolean;
}

function StepServe({ 
  wine, 
  recommendations, 
  enableDecantTimer, 
  setEnableDecantTimer, 
  selectedDecantIndex, 
  setSelectedDecantIndex,
  onStartAndOpen, 
  onSkipTimer, 
  isLoading,
  reduceMotion 
}: StepServeProps) {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -20 }}
      transition={{ duration: 0.25 }}
      className="space-y-5"
    >
      <div className="text-center mb-2">
        <h3 
          className="text-xl font-semibold"
          style={{ color: 'var(--text-primary)' }}
        >
          {t('ritual.servingGuidance', 'Serving Guidance')}
        </h3>
      </div>

      {/* Serving Temperature Card */}
      <div 
        className="p-4 rounded-xl flex items-center gap-4"
        style={{ background: 'var(--bg-muted)' }}
      >
        <div 
          className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
          style={{ background: 'var(--wine-100)' }}
        >
          🌡️
        </div>
        <div className="flex-1">
          <p 
            className="font-medium"
            style={{ color: 'var(--text-primary)' }}
          >
            {recommendations.servingTemp.label}
          </p>
          <p 
            className="text-sm"
            style={{ color: 'var(--text-secondary)' }}
          >
            {recommendations.servingTemp.celsius}°C · {recommendations.servingTemp.description}
          </p>
        </div>
      </div>

      {/* Decant Recommendation Card */}
      <div 
        className="p-4 rounded-xl"
        style={{ background: 'var(--bg-muted)' }}
      >
        <div className="flex items-center gap-4 mb-3">
          <div 
            className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
            style={{ background: 'var(--wine-100)' }}
          >
            🍷
          </div>
          <div className="flex-1">
            <p 
              className="font-medium"
              style={{ color: 'var(--text-primary)' }}
            >
              {recommendations.decant.label}
            </p>
            <p 
              className="text-sm"
              style={{ color: 'var(--text-secondary)' }}
            >
              {recommendations.decant.description}
            </p>
          </div>
        </div>

        {/* Decant Timer Toggle */}
        {recommendations.decant.recommended && (
          <div className="space-y-3 pt-2">
            <button
              onClick={() => setEnableDecantTimer(!enableDecantTimer)}
              className="w-full flex items-center justify-between py-2.5 px-4 rounded-lg transition-all"
              style={{
                background: enableDecantTimer ? 'var(--wine-50)' : 'var(--bg-surface)',
                border: `2px solid ${enableDecantTimer ? 'var(--wine-400)' : 'var(--border-subtle)'}`,
              }}
            >
              <span 
                className="font-medium"
                style={{ color: 'var(--text-primary)' }}
              >
                {t('ritual.startDecantTimer', 'Start decant timer')}
              </span>
              <div 
                className="w-6 h-6 rounded-full flex items-center justify-center transition-all"
                style={{
                  background: enableDecantTimer ? 'var(--wine-600)' : 'var(--bg-muted)',
                }}
              >
                {enableDecantTimer && (
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </button>

            {/* Duration Presets */}
            {enableDecantTimer && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex gap-2"
              >
                {DECANT_PRESETS.map((preset, idx) => (
                  <button
                    key={preset.minutes}
                    onClick={() => setSelectedDecantIndex(idx)}
                    className="flex-1 py-2.5 rounded-lg font-medium text-sm transition-all"
                    style={{
                      background: selectedDecantIndex === idx ? 'var(--wine-600)' : 'var(--bg-surface)',
                      color: selectedDecantIndex === idx ? 'white' : 'var(--text-secondary)',
                      border: `1px solid ${selectedDecantIndex === idx ? 'var(--wine-600)' : 'var(--border-subtle)'}`,
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* CTAs */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onSkipTimer}
          disabled={isLoading}
          className="flex-1 py-3.5 rounded-xl font-medium transition-all disabled:opacity-50"
          style={{
            background: 'var(--bg-muted)',
            color: 'var(--text-secondary)',
          }}
        >
          {enableDecantTimer ? t('ritual.skipTimer', 'Skip Timer') : t('ritual.serveNow', 'Serve Now')}
        </button>
        <motion.button
          onClick={onStartAndOpen}
          disabled={isLoading}
          className="flex-1 py-3.5 rounded-xl font-semibold transition-all disabled:opacity-50"
          style={{
            background: 'linear-gradient(135deg, var(--wine-500), var(--wine-600))',
            color: 'white',
            boxShadow: '0 4px 12px rgba(164, 76, 104, 0.3)',
          }}
          whileTap={{ scale: 0.98 }}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              >
                ⏳
              </motion.span>
              {t('common.loading', 'Loading...')}
            </span>
          ) : enableDecantTimer ? (
            t('ritual.startAndOpen', 'Start & Open')
          ) : (
            t('ritual.openNow', 'Open Now')
          )}
        </motion.button>
      </div>
    </motion.div>
  );
}

// Step 3: Success - Celebration and rate reminder
interface StepSuccessProps {
  wine: any;
  showRateOption: boolean;
  selectedRateIndex: number;
  setSelectedRateIndex: (idx: number) => void;
  onSetReminder: () => void;
  onNoThanks: () => void;
  reduceMotion: boolean;
}

function StepSuccess({ wine, showRateOption, selectedRateIndex, setSelectedRateIndex, onSetReminder, onNoThanks, reduceMotion }: StepSuccessProps) {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 text-center py-4"
    >
      {/* Success Animation */}
      <div className="flex justify-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
        >
          <WineGlassFillAnimation size="lg" />
        </motion.div>
      </div>

      {/* Success Message */}
      <div>
        <motion.h3 
          className="text-2xl font-bold mb-2"
          style={{ color: 'var(--text-primary)' }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {t('ritual.enjoy', 'Enjoy!')}
        </motion.h3>
        <motion.p 
          className="text-base"
          style={{ color: 'var(--text-secondary)' }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {t('ritual.rateQuestion', 'Want a reminder to rate it later?')}
        </motion.p>
      </div>

      {/* Rate Reminder Presets */}
      {showRateOption && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex gap-2"
        >
          {RATE_REMINDER_PRESETS.map((preset, idx) => (
            <button
              key={preset.minutes}
              onClick={() => setSelectedRateIndex(idx)}
              className="flex-1 py-3 rounded-xl font-medium transition-all"
              style={{
                background: selectedRateIndex === idx ? 'var(--wine-100)' : 'var(--bg-muted)',
                color: selectedRateIndex === idx ? 'var(--wine-700)' : 'var(--text-secondary)',
                border: `2px solid ${selectedRateIndex === idx ? 'var(--wine-400)' : 'transparent'}`,
              }}
            >
              {preset.label}
            </button>
          ))}
        </motion.div>
      )}

      {/* CTAs */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="flex gap-3 pt-2"
      >
        <button
          onClick={onNoThanks}
          className="flex-1 py-3.5 rounded-xl font-medium transition-all"
          style={{
            background: 'var(--bg-muted)',
            color: 'var(--text-secondary)',
          }}
        >
          {t('ritual.noThanks', 'No Thanks')}
        </button>
        <motion.button
          onClick={onSetReminder}
          className="flex-1 py-3.5 rounded-xl font-semibold transition-all"
          style={{
            background: 'linear-gradient(135deg, var(--wine-500), var(--wine-600))',
            color: 'white',
            boxShadow: '0 4px 12px rgba(164, 76, 104, 0.3)',
          }}
          whileTap={{ scale: 0.98 }}
        >
          {t('ritual.setReminder', 'Set Reminder')}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
