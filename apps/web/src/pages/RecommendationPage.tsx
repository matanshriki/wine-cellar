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

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '../lib/toast';
import { useNavigate } from 'react-router-dom';
import { CelebrationModal } from '../components/CelebrationModal';
import { WineDetailsModal } from '../components/WineDetailsModal';
import { SommelierChatButton } from '../components/SommelierChatButton';
import { ChoiceCard } from '../components/ui/ChoiceCard';
import { Toggle } from '../components/ui/Toggle';
import { WineLoader } from '../components/WineLoader';
import * as historyService from '../services/historyService';
import * as recommendationService from '../services/recommendationService';
import * as bottleService from '../services/bottleService';
import { trackRecommendation } from '../services/analytics';
import { getCurrencySymbol, getCurrencyCode, convertCurrency } from '../utils/currency';

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
  const { t, i18n } = useTranslation();
  const currencySymbol = getCurrencySymbol(i18n.language);
  const [step, setStep] = useState<'form' | 'results'>('form');
  const [loading, setLoading] = useState(false);
  const [checkingCellar, setCheckingCellar] = useState(false); // Changed: Start as false for instant render
  const [hasCellarBottles, setHasCellarBottles] = useState(true); // Changed: Assume true by default
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
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedBottle, setSelectedBottle] = useState<bottleService.BottleWithWineInfo | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const navigate = useNavigate();

  // Check if user has bottles in cellar on mount (non-blocking)
  useEffect(() => {
    async function checkCellar() {
      try {
        const bottles = await bottleService.listBottles();
        const activeBottles = bottles.filter(b => b.quantity > 0);
        const hasBottles = activeBottles.length > 0;
        
        // Only update state if cellar is actually empty (prevents unnecessary re-render)
        if (!hasBottles) {
          setHasCellarBottles(false);
        }
        
        console.log('[RecommendationPage] Cellar check:', {
          totalBottles: bottles.length,
          activeBottles: activeBottles.length,
          hasCellarBottles: hasBottles
        });
      } catch (error) {
        console.error('[RecommendationPage] Error checking cellar:', error);
        // Keep default assumption (has bottles) on error
      }
    }
    
    checkCellar();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      // Convert maxPrice from display currency to USD for consistent filtering
      let maxPriceInUSD: number | undefined = undefined;
      if (context.maxPrice) {
        const enteredPrice = parseFloat(context.maxPrice);
        const displayCurrency = getCurrencyCode(i18n.language);
        
        // Convert to USD for backend filtering (bottles stored in various currencies)
        maxPriceInUSD = convertCurrency(enteredPrice, displayCurrency, 'USD');
      }
      
      const requestContext: recommendationService.RecommendationInput = {
        mealType: context.mealType || undefined,
        occasion: context.occasion || undefined,
        vibe: context.vibe || undefined,
        constraints: {
          avoidTooYoung: context.avoidTooYoung,
          preferReadyToDrink: context.preferReadyToDrink,
          maxPrice: maxPriceInUSD,
        },
      };

      trackRecommendation.run(context.mealType, context.occasion); // Track recommendation request
      const recs = await recommendationService.getRecommendations(requestContext);
      
      if (recs.length === 0) {
        toast.info(t('recommendation.results.noResults'));
        return;
      }

      trackRecommendation.resultsShown(recs.length); // Track recommendation results
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

  async function handleViewBottleDetails(bottleId: string) {
    setLoadingDetails(true);
    try {
      const bottle = await bottleService.getBottle(bottleId);
      if (bottle) {
        setSelectedBottle(bottle);
        setShowDetailsModal(true);
      } else {
        toast.error(t('errors.bottleNotFound', 'Bottle not found'));
      }
    } catch (error: any) {
      console.error('[RecommendationPage] Error loading bottle details:', error);
      toast.error(error.message || t('errors.generic'));
    } finally {
      setLoadingDetails(false);
    }
  }

  function handleCloseDetailsModal() {
    setShowDetailsModal(false);
    setSelectedBottle(null);
  }

  // Results View
  if (step === 'results') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        <div className="mb-6">
          <button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setStep('form');
            }}
            className="btn btn-ghost mb-4 -ms-2 min-h-[44px]"
            style={{
              color: 'var(--color-wine-600)',
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation',
            }}
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
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.2 }}
              className="card-hover card"
              style={{ border: '2px solid var(--color-stone-200)' }}
            >
              <div className="flex items-start gap-4 mb-4">
                {/* Wine Image */}
                {rec.bottle?.imageUrl && (
                  <div className="flex-shrink-0">
                    <img 
                      src={rec.bottle.imageUrl} 
                      alt={rec.bottle.name}
                      className="w-16 h-20 sm:w-20 sm:h-24 object-cover rounded-md"
                      style={{
                        border: '1px solid var(--color-stone-200)',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      }}
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-3 mb-3">
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
                      <div className="flex-1 min-w-0">
                        <h3 
                          className="text-xl sm:text-2xl font-bold mb-1"
                          style={{ 
                            fontFamily: 'var(--font-display)',
                            color: 'var(--color-stone-950)'
                          }}
                        >
                          {rec.bottle.name}
                        </h3>
                        <p className="text-sm mb-2" style={{ color: 'var(--color-stone-600)' }}>
                          {rec.bottle.producer && `${rec.bottle.producer} • `}
                          {rec.bottle.vintage || 'NV'} • {t(`cellar.wineStyles.${rec.bottle.style}`)}
                        </p>
                        
                        {/* Vivino Rating */}
                        {rec.bottle.rating && (
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1" title={`${rec.bottle.rating} ${t('cellar.bottle.vivinoRating')}`}>
                              {[1, 2, 3, 4, 5].map((star) => {
                                const rating = rec.bottle!.rating || 0;
                                const filled = star <= Math.floor(rating);
                                const halfFilled = !filled && star <= Math.ceil(rating);
                                
                                return (
                                  <span
                                    key={`${rec.bottleId}-star-${star}`}
                                    className="text-sm"
                                    style={{
                                      color: filled || halfFilled ? 'var(--color-wine-500)' : 'var(--color-stone-300)',
                                    }}
                                    aria-hidden="true"
                                  >
                                    {filled ? '★' : halfFilled ? '⯪' : '☆'}
                                  </span>
                                );
                              })}
                              <span
                                className="text-sm font-medium ms-1"
                                style={{ color: 'var(--color-stone-600)' }}
                              >
                                {rec.bottle.rating.toFixed(1)}
                              </span>
                            </div>
                            
                            {/* Vivino Link */}
                            {rec.bottle.vivinoUrl && (
                              <a
                                href={rec.bottle.vivinoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs px-2 py-1 rounded transition-colors"
                                style={{
                                  color: 'var(--color-wine-600)',
                                  backgroundColor: 'var(--color-wine-50)',
                                  border: '1px solid var(--color-wine-200)',
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                Vivino
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
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

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  {/* View Details Button */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleViewBottleDetails(rec.bottleId)}
                    disabled={loadingDetails}
                    className="flex-1 btn btn-secondary"
                    style={{
                      background: 'var(--color-stone-100)',
                      color: 'var(--color-stone-900)',
                      border: '1px solid var(--color-stone-300)',
                    }}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {loadingDetails ? t('common.loading', 'Loading...') : t('recommendation.results.viewDetails', 'View Details')}
                  </motion.button>

                  {/* Mark as Opened Button */}
                  {rec.bottle && rec.bottle.quantity > 0 && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleMarkOpened(rec)}
                      className="flex-1 btn btn-primary btn-lg"
                    >
                      <span className="text-xl">🍾</span>
                      {t('recommendation.results.markAsOpened')}
                    </motion.button>
                  )}
                </div>
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

        {/* Wine Details Modal */}
        <WineDetailsModal
          isOpen={showDetailsModal}
          onClose={handleCloseDetailsModal}
          bottle={selectedBottle}
        />

        {/* Floating Sommelier Chat Button */}
        <SommelierChatButton />
      </motion.div>
    );
  }

  // Form View
  // Show empty cellar message if no bottles (no loading state needed)
  if (!hasCellarBottles) {
    return (
      <div className="max-w-2xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="luxury-card text-center py-12 px-6"
        >
          {/* Elegant visual */}
          <div className="text-8xl mb-6">
            🍾
          </div>

          {/* Heading */}
          <h2
            className="text-2xl sm:text-3xl mb-3"
            style={{ 
              color: 'var(--text-primary)', 
              fontFamily: 'var(--font-display)',
              fontWeight: 'var(--font-bold)',
              letterSpacing: '-0.02em',
            }}
          >
            {t('recommendation.emptyCellar.title')}
          </h2>

          {/* Explanation */}
          <p
            className="text-base sm:text-lg mb-2 max-w-md mx-auto"
            style={{ color: 'var(--text-secondary)' }}
          >
            {t('recommendation.emptyCellar.message')}
          </p>

          {/* Helpful hint */}
          <p
            className="text-sm mb-8 max-w-md mx-auto"
            style={{ 
              color: 'var(--text-tertiary)',
              fontStyle: 'italic'
            }}
          >
            {t('recommendation.emptyCellar.hint')}
          </p>

          {/* Action button */}
          <button
            onClick={() => navigate('/cellar')}
            className="btn-luxury-primary"
          >
            {t('recommendation.emptyCellar.goToCellar')}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="max-w-3xl mx-auto px-4"
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
        <div className="card space-y-5">
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
              {t('recommendation.form.maxPrice', { 
                currencyCode: getCurrencyCode(i18n.language),
                defaultValue: `Maximum price (${getCurrencyCode(i18n.language)}, optional)` 
              })}
            </label>
            <input
              type="number"
              value={context.maxPrice}
              onChange={(e) => setContext({ ...context, maxPrice: e.target.value })}
              className="input"
              placeholder={`${t('recommendation.form.maxPricePlaceholder', { 
                currencySymbol: currencySymbol,
                defaultValue: `e.g., ${currencySymbol}100` 
              })}`}
              min="0"
            />
          </div>
        </div>

        {/* Submit Button - positioned above bottom nav on mobile */}
        <div className="sticky z-10 bottom-above-nav">
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
        </div>
      </form>

      {/* Floating Sommelier Chat Button */}
      <SommelierChatButton />
    </motion.div>
  );
}
