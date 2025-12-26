/**
 * Tonight's Recommendation Page - Luxury Redesign
 * 
 * Premium features:
 * - Elegant ChoiceCard selection for meal/occasion/vibe
 * - Luxury Toggle switches for preferences
 * - Smooth animations and transitions
 * - Progress indicator
 * - Premium results display
 * - Mobile-first design
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '../lib/toast';
import { useNavigate } from 'react-router-dom';
import { CelebrationModal } from '../components/CelebrationModal';
import { ChoiceCard } from '../components/ui/ChoiceCard';
import { Toggle } from '../components/ui/Toggle';
import * as historyService from '../services/historyService';
import * as recommendationService from '../services/recommendationService';

type Recommendation = recommendationService.Recommendation;

const mealTypes = [
  { value: 'pizza', icon: '🍕' },
  { value: 'steak', icon: '🥩' },
  { value: 'pasta', icon: '🍝' },
  { value: 'fish', icon: '🐟' },
  { value: 'spicy_asian', icon: '🌶️' },
  { value: 'cheese', icon: '🧀' },
];

const occasions = [
  { value: 'casual', icon: '😊' },
  { value: 'date_night', icon: '💕' },
  { value: 'hosting_friends', icon: '👥' },
  { value: 'celebration', icon: '🎉' },
];

const vibes = [
  { value: 'easy_drinking', icon: '🌊' },
  { value: 'crowd_pleaser', icon: '👍' },
  { value: 'special', icon: '✨' },
  { value: 'surprise_me', icon: '🎲' },
];

export function RecommendationPage() {
  const { t } = useTranslation();
  const [step, setStep] = useState<'form' | 'results'>('form');
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState({
    mealType: '',
    occasion: '',
    vibe: '',
    avoidTooYoung: true,
    preferReadyToDrink: true,
    maxPrice: '',
  });
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [showCelebrationModal, setShowCelebrationModal] = useState(false);
  const [celebrationBottleName, setCelebrationBottleName] = useState('');
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const requestContext: recommendationService.RecommendationInput = {
        mealType: context.mealType || undefined,
        occasion: context.occasion || undefined,
        vibe: context.vibe || undefined,
        constraints: {
          avoidTooYoung: context.avoidTooYoung,
          preferReadyToDrink: context.preferReadyToDrink,
          maxPrice: context.maxPrice ? parseFloat(context.maxPrice) : undefined,
        },
      };

      const recs = await recommendationService.getRecommendations(requestContext);
      
      if (recs.length === 0) {
        toast.info(t('recommendation.results.noResults'));
        return;
      }

      setRecommendations(recs);
      setStep('results');
    } catch (error: any) {
      console.error('[RecommendationPage] Error:', error);
      toast.error(error.message || t('errors.generic'));
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkOpened(rec: Recommendation) {
    if (!rec.bottle) return;

    try {
      await historyService.markBottleOpened({
        bottle_id: rec.bottleId,
        occasion: context.occasion || undefined,
        meal_type: context.mealType || undefined,
        vibe: context.vibe || undefined,
      });
      
      setCelebrationBottleName(rec.bottle.name);
      setShowCelebrationModal(true);
    } catch (error: any) {
      console.error('[RecommendationPage] Error:', error);
      toast.error(error.message || t('recommendation.results.markFailed'));
    }
  }

  function handleCelebrationClose() {
    setShowCelebrationModal(false);
    setCelebrationBottleName('');
  }

  function handleViewHistory() {
    setShowCelebrationModal(false);
    setCelebrationBottleName('');
    navigate('/history');
  }

  // Results View
  if (step === 'results') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
      >
        <div className="mb-6">
          <button 
            onClick={() => setStep('form')} 
            className="btn btn-ghost mb-4 -ms-2"
            style={{ color: 'var(--color-wine-600)' }}
          >
            <svg className="w-5 h-5 flip-rtl" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t('recommendation.results.backToForm')}
          </button>
          
          <h1 
            className="text-3xl sm:text-4xl font-bold mb-2"
            style={{ 
              fontFamily: 'var(--font-display)',
              color: 'var(--color-stone-950)'
            }}
          >
            {t('recommendation.results.title')}
          </h1>
          <p style={{ color: 'var(--color-stone-600)' }}>
            {t('recommendation.results.subtitle')}
          </p>
        </div>

        <div className="space-y-6">
          {recommendations.map((rec, index) => (
            <motion.div
              key={rec.bottleId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="card-hover card"
              style={{ border: '2px solid var(--color-stone-200)' }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold"
                      style={{
                        background: 'linear-gradient(135deg, var(--color-wine-500) 0%, var(--color-wine-600) 100%)',
                        color: 'white',
                      }}
                    >
                      {index + 1}
                    </div>
                    {rec.bottle && (
                      <div className="flex-1">
                        <h3 
                          className="text-xl sm:text-2xl font-bold mb-1"
                          style={{ 
                            fontFamily: 'var(--font-display)',
                            color: 'var(--color-stone-950)'
                          }}
                        >
                          {rec.bottle.name}
                        </h3>
                        <p className="text-sm" style={{ color: 'var(--color-stone-600)' }}>
                          {rec.bottle.producer && `${rec.bottle.producer} • `}
                          {rec.bottle.vintage || 'NV'} • {t(`cellar.wineStyles.${rec.bottle.style}`)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <span className="badge badge-wine">
                  {t('recommendation.results.score')}: {rec.score}
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 
                    className="font-semibold mb-2 flex items-center gap-2"
                    style={{ color: 'var(--color-wine-700)' }}
                  >
                    <span>✨</span>
                    {t('recommendation.results.whyThisBottle')}
                  </h4>
                  <p style={{ color: 'var(--color-stone-700)' }}>{rec.explanation}</p>
                </div>

                <div 
                  className="p-4 rounded-xl"
                  style={{ 
                    backgroundColor: 'var(--color-wine-50)',
                    borderLeft: '4px solid var(--color-wine-500)'
                  }}
                >
                  <h4 
                    className="font-semibold mb-2 flex items-center gap-2"
                    style={{ color: 'var(--color-wine-800)' }}
                  >
                    <span>🍷</span>
                    {t('recommendation.results.servingInstructions')}
                  </h4>
                  <p style={{ color: 'var(--color-stone-700)' }}>{rec.servingInstructions}</p>
                </div>

                {rec.bottle && rec.bottle.quantity > 0 && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleMarkOpened(rec)}
                    className="w-full btn btn-primary btn-lg"
                  >
                    <span className="text-xl">🍾</span>
                    {t('recommendation.results.markAsOpened')}
                  </motion.button>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        <CelebrationModal
          isOpen={showCelebrationModal}
          onClose={handleCelebrationClose}
          bottleName={celebrationBottleName}
          onViewHistory={handleViewHistory}
        />
      </motion.div>
    );
  }

  // Form View
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-3xl"
    >
      <div className="mb-8">
        <h1 
          className="text-3xl sm:text-4xl font-bold mb-2"
          style={{ 
            fontFamily: 'var(--font-display)',
            color: 'var(--color-stone-950)'
          }}
        >
          {t('recommendation.title')}
        </h1>
        <p style={{ color: 'var(--color-stone-600)' }}>
          {t('recommendation.subtitle')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Main Selection Card - Compact Layout */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card space-y-5"
        >
          {/* Meal Type */}
          <div>
            <h3 
              className="text-base font-semibold mb-3"
              style={{ color: 'var(--color-stone-900)' }}
            >
              {t('recommendation.form.mealType')}
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-3 gap-2">
              {mealTypes.map((meal) => (
                <motion.button
                  key={meal.value}
                  type="button"
                  onClick={() => setContext({ ...context, mealType: meal.value })}
                  whileTap={{ scale: 0.95 }}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all"
                  style={{
                    backgroundColor: context.mealType === meal.value 
                      ? 'var(--color-wine-50)' 
                      : 'var(--color-stone-50)',
                    border: `2px solid ${
                      context.mealType === meal.value 
                        ? 'var(--color-wine-500)' 
                        : 'var(--color-stone-200)'
                    }`,
                    boxShadow: context.mealType === meal.value ? 'var(--glow-wine)' : 'none',
                  }}
                >
                  <span className="text-2xl">{meal.icon}</span>
                  <span 
                    className="text-xs font-medium text-center leading-tight"
                    style={{
                      color: context.mealType === meal.value 
                        ? 'var(--color-wine-800)' 
                        : 'var(--color-stone-700)'
                    }}
                  >
                    {t(`recommendation.form.mealTypes.${meal.value}`)}
                  </span>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Occasion */}
          <div>
            <h3 
              className="text-base font-semibold mb-3"
              style={{ color: 'var(--color-stone-900)' }}
            >
              {t('recommendation.form.occasion')}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {occasions.map((occ) => (
                <motion.button
                  key={occ.value}
                  type="button"
                  onClick={() => setContext({ ...context, occasion: occ.value })}
                  whileTap={{ scale: 0.95 }}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all"
                  style={{
                    backgroundColor: context.occasion === occ.value 
                      ? 'var(--color-wine-50)' 
                      : 'var(--color-stone-50)',
                    border: `2px solid ${
                      context.occasion === occ.value 
                        ? 'var(--color-wine-500)' 
                        : 'var(--color-stone-200)'
                    }`,
                    boxShadow: context.occasion === occ.value ? 'var(--glow-wine)' : 'none',
                  }}
                >
                  <span className="text-2xl">{occ.icon}</span>
                  <span 
                    className="text-xs font-medium text-center leading-tight"
                    style={{
                      color: context.occasion === occ.value 
                        ? 'var(--color-wine-800)' 
                        : 'var(--color-stone-700)'
                    }}
                  >
                    {t(`recommendation.form.occasions.${occ.value}`)}
                  </span>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Vibe */}
          <div>
            <h3 
              className="text-base font-semibold mb-3"
              style={{ color: 'var(--color-stone-900)' }}
            >
              {t('recommendation.form.vibe')}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {vibes.map((v) => (
                <motion.button
                  key={v.value}
                  type="button"
                  onClick={() => setContext({ ...context, vibe: v.value })}
                  whileTap={{ scale: 0.95 }}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all"
                  style={{
                    backgroundColor: context.vibe === v.value 
                      ? 'var(--color-wine-50)' 
                      : 'var(--color-stone-50)',
                    border: `2px solid ${
                      context.vibe === v.value 
                        ? 'var(--color-wine-500)' 
                        : 'var(--color-stone-200)'
                    }`,
                    boxShadow: context.vibe === v.value ? 'var(--glow-wine)' : 'none',
                  }}
                >
                  <span className="text-2xl">{v.icon}</span>
                  <span 
                    className="text-xs font-medium text-center leading-tight"
                    style={{
                      color: context.vibe === v.value 
                        ? 'var(--color-wine-800)' 
                        : 'var(--color-stone-700)'
                    }}
                  >
                    {t(`recommendation.form.vibes.${v.value}`)}
                  </span>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Preferences - Compact Toggles */}
          <div className="pt-2">
            <h3 
              className="text-base font-semibold mb-3"
              style={{ color: 'var(--color-stone-900)' }}
            >
              {t('recommendation.form.preferences')}
            </h3>
            <div className="space-y-3">
              <Toggle
                checked={context.avoidTooYoung}
                onChange={(checked) => setContext({ ...context, avoidTooYoung: checked })}
                label={t('recommendation.form.avoidTooYoung')}
                size="md"
              />
              <Toggle
                checked={context.preferReadyToDrink}
                onChange={(checked) => setContext({ ...context, preferReadyToDrink: checked })}
                label={t('recommendation.form.preferReadyToDrink')}
                size="md"
              />
            </div>
          </div>

          {/* Max Price - Inline */}
          <div className="pt-2">
            <label 
              className="block text-base font-semibold mb-2"
              style={{ color: 'var(--color-stone-900)' }}
            >
              {t('recommendation.form.maxPrice')}
            </label>
            <input
              type="number"
              value={context.maxPrice}
              onChange={(e) => setContext({ ...context, maxPrice: e.target.value })}
              className="input"
              placeholder={t('recommendation.form.maxPricePlaceholder')}
              min="0"
            />
          </div>
        </motion.div>

        {/* Submit Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="sticky bottom-4 z-10"
        >
          <motion.button
            type="submit"
            disabled={loading}
            className="w-full btn btn-primary btn-lg shadow-xl"
            whileHover={!loading ? { scale: 1.02 } : {}}
            whileTap={!loading ? { scale: 0.98 } : {}}
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>{t('recommendation.form.finding')}</span>
              </div>
            ) : (
              <>
                <span className="text-xl">🔍</span>
                <span>{t('recommendation.form.getRecommendations')}</span>
              </>
            )}
          </motion.button>
        </motion.div>
      </form>
    </motion.div>
  );
}
