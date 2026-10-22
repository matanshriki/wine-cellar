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
import { StarRating } from '../components/ui/StarRating';
import { WineImage } from '../components/ui/WineImage';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, ChevronDown, ChevronUp, ChevronRight, ChevronLeft, Info, Sparkles, Wine, GlassWater } from 'lucide-react';
import { toast } from '../lib/toast';
import { useNavigate } from 'react-router-dom';
import { CelebrationModal } from '../components/CelebrationModal';
import { WineDetailsModal } from '../components/WineDetailsModal';
import { SommelierChatButton } from '../components/SommelierChatButton';
import { TonightSommiCard } from '../components/TonightSommiCard';
import { Toggle } from '../components/ui/Toggle';
import { mealDetailOptions } from '../services/mealPairing';
import * as recommendationService from '../services/recommendationService';
import * as bottleService from '../services/bottleService';
import * as aiAnalysisService from '../services/aiAnalysisService';
import { trackRecommendation, trackInsight } from '../services/analytics';
import type { InsightType } from '../services/insightService';
import { useOpenRitual } from '../contexts/OpenRitualContext';
import { OfflineCellarScreen } from '../components/OfflineCellarScreen';
import { WineLoader } from '../components/WineLoader';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { isConnectivityFetchFailure } from '../utils/connectivityErrors';
import { isInsufficientCreditsError } from '../lib/insufficientCredits';
import { useFeatureFlags } from '../contexts/FeatureFlagsContext';
import { useAuth } from '../contexts/SupabaseAuthContext';
import {
  formatPriceTierLabel,
  maxPriceUsdForRange,
  type PriceRangeIndex,
} from '../utils/priceTiers';

type WineType = 'red' | 'white' | 'rose' | 'mixed';
type PriceRange = PriceRangeIndex;

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
  const { preferredCurrency } = useAuth();
  const { openRitual } = useOpenRitual();
  const { flags, loading: flagsLoading } = useFeatureFlags();
  const isOnline = useOnlineStatus();
  const [step, setStep] = useState<'form' | 'results'>('form');
  const [loading, setLoading] = useState(false);
  /** Initial cellar probe: needed for offline UI (same as cellar page) */
  const [cellarProbe, setCellarProbe] = useState<'pending' | 'ok' | 'offline'>('pending');
  const [hasCellarBottles, setHasCellarBottles] = useState(true);
  const [context, setContext] = useState({
    mealType: '',
    mealDetail: '',
    occasion: '',
    vibe: '',
    avoidTooYoung: true,
    preferReadyToDrink: true,
    wineType: 'mixed' as WineType,
    priceRange: 0 as PriceRange,
  });
  const [preferencesExpanded, setPreferencesExpanded] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [showCelebrationModal, setShowCelebrationModal] = useState(false);
  const [celebrationBottleName, setCelebrationBottleName] = useState('');
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedBottle, setSelectedBottle] = useState<bottleService.BottleWithWineInfo | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const navigate = useNavigate();

  // Scroll to top on mount. This page has a sticky submit button and long
  // content that can cause the global ScrollToTop to fire before the full
  // DOM is painted, leaving the page at the previous scroll position.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    async function checkCellar() {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setCellarProbe('offline');
        return;
      }
      try {
        const bottles = await bottleService.listBottles();
        const activeBottles = bottles.filter((b) => b.quantity > 0);
        setHasCellarBottles(activeBottles.length > 0);
        setCellarProbe('ok');
      } catch (error) {
        console.error('[RecommendationPage] Error checking cellar:', error);
        const msg = String((error as Error)?.message || '');
        const isAuth =
          msg === 'Not authenticated' || msg.includes('Not authenticated');
        if (!isAuth && isConnectivityFetchFailure(error)) {
          setCellarProbe('offline');
        } else {
          setHasCellarBottles(false);
          setCellarProbe('ok');
        }
      }
    }

    checkCellar();
  }, [isOnline]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      // Caps are defined in USD (see utils/priceTiers.ts); filtering converts bottle currencies.
      const maxPriceInUSD = maxPriceUsdForRange(context.priceRange);

      const requestContext: recommendationService.RecommendationInput = {
        mealType: context.mealType || undefined,
        mealDetail: context.mealDetail || undefined,
        occasion: context.occasion || undefined,
        vibe: context.vibe || undefined,
        constraints: {
          avoidTooYoung: context.avoidTooYoung,
          preferReadyToDrink: context.preferReadyToDrink,
          maxPrice: maxPriceInUSD,
        },
      };

      trackRecommendation.run(context.mealType, context.occasion);
      let recs = await recommendationService.getRecommendations(requestContext);

      // Filter by wine type if not "mixed"
      if (context.wineType !== 'mixed' && recs.length > 0) {
        const filtered = recs.filter((r) => {
          const style = (r.bottle?.style ?? '').toLowerCase();
          if (context.wineType === 'red') return style === 'red';
          if (context.wineType === 'white') return style === 'white';
          if (context.wineType === 'rose') return style.includes('rose') || style.includes('rosé');
          return true;
        });
        if (filtered.length > 0) recs = filtered;
      }

      if (recs.length === 0) {
        toast.info(t('recommendation.results.noResults'));
        setLoading(false);
        return;
      }

      trackRecommendation.resultsShown(recs.length);

      // Track each recommendation card that carries an insight pill
      recs.forEach((rec) => {
        if (rec.affinityReason && rec.affinityInsightType) {
          trackInsight.shown({
            insight_type: rec.affinityInsightType as InsightType,
            surface: 'recommendation_card',
            is_personalized: rec.affinityInsightType !== 'educational',
            bottle_id: rec.bottleId,
            wine_id: rec.wineId,
          });
        }
      });

      setRecommendations(recs);
      setStep('results');

      // Scroll to top after React paints the results.
      // On mobile / iOS PWA the scroll container may be documentElement or
      // body rather than window, so we target all three and fall back to
      // direct scrollTop assignment for browsers that ignore scrollTo().
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
        document.documentElement.scrollTo?.({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
        document.body.scrollTo?.({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('errors.generic');
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  function handleMarkOpened(rec: Recommendation) {
    if (!rec.bottle) return;

    // Fetch the full bottle object so the ritual sheet has all wine info
    bottleService.getBottle(rec.bottleId).then(fullBottle => {
      if (!fullBottle) return;
      openRitual(fullBottle, {
        occasion: context.occasion || undefined,
        mealType: context.mealType || undefined,
        vibe: context.vibe || undefined,
        onComplete: () => {
          setCelebrationBottleName(rec.bottle!.name);
          setShowCelebrationModal(true);
        },
      });
    }).catch(() => {
      toast.error(t('recommendation.results.markFailed'));
    });
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
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('errors.generic');
      toast.error(msg);
    } finally {
      setLoadingDetails(false);
    }
  }

  function handleCloseDetailsModal() {
    setShowDetailsModal(false);
    setSelectedBottle(null);
  }

  async function handleAnalyzeBottle() {
    if (!selectedBottle) return undefined;
    try {
      const analysisResult = await aiAnalysisService.generateAIAnalysis(
        selectedBottle,
        i18n.language,
      );
      const updated = await bottleService.getBottle(selectedBottle.id);
      if (updated) {
        setSelectedBottle(
          aiAnalysisService.mergeBottleWineWithAnalysisBarrel(updated, analysisResult),
        );
      }
      return analysisResult;
    } catch (error: any) {
      if (isInsufficientCreditsError(error)) {
        const detail: {
          context: 'analysis';
          requiredCredits?: number;
          balance?: number;
        } = { context: 'analysis' };
        if (
          typeof error.requiredCredits === 'number' &&
          typeof error.balance === 'number'
        ) {
          detail.requiredCredits = error.requiredCredits;
          detail.balance = error.balance;
        }
        window.dispatchEvent(
          new CustomEvent('sommi-insufficient-credits', { detail }),
        );
        return undefined;
      }
      toast.error(error?.message || t('cellar.sommelier.failed'));
      return undefined;
    }
  }

  if (cellarProbe === 'offline') {
    return <OfflineCellarScreen />;
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
            className="btn-luxury-ghost mb-4 -ms-3 text-sm"
            style={{ color: 'var(--accent-text)' }}
          >
            <ChevronLeft className="w-4 h-4 rtl:-scale-x-100" strokeWidth={1.75} aria-hidden />
            {t('recommendation.results.backToForm')}
          </button>
          <PageHeader
            className="!mb-0"
            eyebrow={t('recommendation.eyebrow')}
            title={t('recommendation.results.title')}
            subtitle={t('recommendation.results.subtitle')}
          />
        </div>

        <div className="space-y-6">
          {recommendations.map((rec, index) => (
            <motion.div
              key={rec.bottleId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.2 }}
              className="app-card p-5 sm:p-6"
            >
              <div className="flex items-start gap-4 mb-4">
                <WineImage
                  src={rec.bottle?.imageUrl}
                  alt={rec.bottle?.name ?? ''}
                  className="w-16 h-20 sm:w-20 sm:h-24"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-3 mb-3">
                    <div
                      className="lp-blob lp-blob-burgundy app-blob-sm shrink-0 text-lg font-semibold"
                      style={{ fontFamily: 'var(--font-display)' }}
                      aria-hidden
                    >
                      {index + 1}
                    </div>
                    {rec.bottle && (
                      <div className="flex-1 min-w-0">
                        <h3
                          className="app-display text-xl sm:text-2xl mb-1 break-words"
                        >
                          {rec.bottle.name}
                        </h3>
                        <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
                          {rec.bottle.producer && `${rec.bottle.producer} • `}
                          {rec.bottle.vintage || 'NV'} • {t(`cellar.wineStyles.${rec.bottle.style}`)}
                        </p>

                        {rec.bottle.rating && (
                          <div className="flex items-center gap-2">
                            <div
                              className="flex items-center gap-1"
                              title={`${rec.bottle.rating} ${t('cellar.bottle.vivinoRating')}`}
                            >
                              <StarRating rating={rec.bottle.rating} size={14} />
                            </div>
                            {rec.bottle.vivinoUrl && (
                              <a
                                href={rec.bottle.vivinoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-medium px-3 py-1 rounded-full transition-colors hover:bg-[var(--wine-100)]"
                                style={{
                                  color: 'var(--accent-text)',
                                  backgroundColor: 'var(--wine-50)',
                                  border: '1px solid var(--wine-200)',
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <bdi>Vivino</bdi>
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
                {/* Taste profile affinity reason */}
                {rec.affinityReason && (rec.affinityInsightType === 'taste_caution' ? (
                  <div
                    className="flex items-start gap-2 px-3 py-2 rounded-2xl text-sm font-medium"
                    style={{
                      background: 'var(--bg-muted)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-medium)',
                    }}
                  >
                    <Info className="h-4 w-4 mt-0.5 shrink-0" strokeWidth={1.75} style={{ color: 'var(--text-secondary)' }} aria-hidden />
                    {rec.affinityReason}
                  </div>
                ) : (
                  <div 
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium"
                    style={{ 
                      background: 'var(--wine-50)',
                      color: 'var(--accent-text)',
                      border: '1px solid var(--wine-200)',
                    }}
                  >
                    <Sparkles className="h-4 w-4 shrink-0" strokeWidth={1.75} style={{ color: 'var(--color-gold-500)' }} aria-hidden />
                    {rec.affinityReason}
                  </div>
                ))}
                
                <div>
                  <h4
                    className="font-semibold mb-2 flex items-center gap-2"
                    style={{ color: 'var(--accent-text)' }}
                  >
                    <Wine className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                    {t('recommendation.results.whyThisBottle')}
                  </h4>
                  <p style={{ color: 'var(--text-primary)' }}>{rec.explanation}</p>
                </div>

                <div
                  className="p-4 rounded-2xl"
                  style={{
                    backgroundColor: 'var(--bg-muted)',
                    borderInlineStart: '4px solid var(--color-gold-500)',
                  }}
                >
                  <h4
                    className="font-semibold mb-2 flex items-center gap-2"
                    style={{ color: 'var(--text-heading)' }}
                  >
                    <GlassWater className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                    {t('recommendation.results.servingInstructions')}
                  </h4>
                  <p style={{ color: 'var(--text-primary)' }}>{rec.servingInstructions}</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleViewBottleDetails(rec.bottleId)}
                    disabled={loadingDetails}
                    className="flex-1 btn-luxury-secondary"
                  >
                    <Info className="w-4 h-4" strokeWidth={1.75} aria-hidden />
                    {loadingDetails
                      ? t('common.loading', 'Loading...')
                      : t('recommendation.results.viewDetails', 'View Details')}
                  </motion.button>

                  {rec.bottle && rec.bottle.quantity > 0 && (
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleMarkOpened(rec)}
                      className="flex-1 btn-luxury-primary"
                    >
                      <span className="text-lg" aria-hidden>🍾</span>
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

        <WineDetailsModal
          isOpen={showDetailsModal}
          onClose={handleCloseDetailsModal}
          bottle={selectedBottle}
          onAnalyze={selectedBottle ? handleAnalyzeBottle : undefined}
        />

        <SommelierChatButton />
      </motion.div>
    );
  }

  if (cellarProbe === 'pending') {
    return (
      <WineLoader variant="page" size="lg" message={t('recommendation.checkingCellar')} />
    );
  }

  // Empty Cellar
  if (!hasCellarBottles) {
    return (
      <div className="max-w-2xl mx-auto">
        <EmptyState
          art="/assets/app/empty-cellar.jpg"
          title={t('recommendation.emptyCellar.title')}
          body={t('recommendation.emptyCellar.message')}
          actions={
            <button onClick={() => navigate('/cellar')} className="btn-luxury-primary">
              {t('recommendation.emptyCellar.goToCellar')}
            </button>
          }
        >
          <p className="mt-5 text-sm italic" style={{ color: 'var(--text-tertiary)' }}>
            {t('recommendation.emptyCellar.hint')}
          </p>
        </EmptyState>
      </div>
    );
  }

  // Form View
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="max-w-3xl mx-auto"
    >
      <PageHeader
        eyebrow={t('recommendation.eyebrow')}
        title={t('recommendation.title')}
        subtitle={t('recommendation.subtitle')}
      />

      {!flagsLoading && flags?.cellarAgentEnabled && <TonightSommiCard />}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="app-card p-5 sm:p-6 space-y-6">
          <div>
            <h3 className="app-eyebrow mb-3" style={{ color: 'var(--text-secondary)' }}>
              {t('recommendation.form.mealType')}
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-3 gap-2">
              {mealTypes.map((meal) => (
                <motion.button
                  key={meal.value}
                  type="button"
                  onClick={() => setContext({ ...context, mealType: meal.value, mealDetail: '' })}
                  whileTap={{ scale: 0.95 }}
                  aria-pressed={context.mealType === meal.value}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 min-h-[76px] rounded-2xl transition-colors hover:border-[var(--wine-300)]"
                  style={{
                    backgroundColor:
                      context.mealType === meal.value ? 'var(--wine-50)' : 'var(--bg-surface)',
                    border: `1.5px solid ${
                      context.mealType === meal.value ? 'var(--wine-500)' : 'var(--border-subtle)'
                    }`,
                  }}
                >
                  <span className="text-2xl" aria-hidden>{meal.icon}</span>
                  <span
                    className="text-xs font-medium text-center leading-tight"
                    style={{
                      color:
                        context.mealType === meal.value
                          ? 'var(--accent-text)'
                          : 'var(--text-secondary)',
                    }}
                  >
                    {t(`recommendation.form.mealTypes.${meal.value}`)}
                  </span>
                </motion.button>
              ))}
            </div>
            {mealDetailOptions(context.mealType).length > 0 && (
              <div
                role="group"
                aria-labelledby="meal-detail-label"
                aria-describedby="meal-detail-help"
                className="mt-4 rounded-2xl p-3 sm:p-4"
                style={{ backgroundColor: 'var(--bg-muted)' }}
              >
                <p id="meal-detail-label" className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>
                  {t('recommendation.form.mealDetail')}
                </p>
                <p id="meal-detail-help" className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
                  {t('recommendation.form.mealDetailOptional')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {mealDetailOptions(context.mealType).map((detail) => {
                    const selected = context.mealDetail === detail;
                    return (
                      <button
                        key={detail}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setContext({ ...context, mealDetail: selected ? '' : detail })}
                        className="min-h-[44px] px-4 rounded-full text-sm font-medium transition-colors"
                        style={{
                          backgroundColor: selected ? 'var(--wine-50)' : 'var(--bg-surface)',
                          color: selected ? 'var(--accent-text)' : 'var(--text-primary)',
                          border: `1.5px solid ${selected ? 'var(--wine-500)' : 'var(--border-medium)'}`,
                        }}
                      >
                        {t(`recommendation.form.mealDetails.${context.mealType}.${detail}`)}
                      </button>
                    );
                  })}
                  {context.mealDetail && (
                    <button
                      type="button"
                      onClick={() => setContext({ ...context, mealDetail: '' })}
                      className="min-h-[44px] px-4 rounded-full text-sm font-medium underline-offset-4 hover:underline"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {t('recommendation.form.mealDetailSkip')}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div>
            <h3 className="app-eyebrow mb-3" style={{ color: 'var(--text-secondary)' }}>
              {t('recommendation.form.occasion')}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {occasions.map((occ) => (
                <motion.button
                  key={occ.value}
                  type="button"
                  onClick={() => setContext({ ...context, occasion: occ.value })}
                  whileTap={{ scale: 0.95 }}
                  aria-pressed={context.occasion === occ.value}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 min-h-[76px] rounded-2xl transition-colors hover:border-[var(--wine-300)]"
                  style={{
                    backgroundColor:
                      context.occasion === occ.value ? 'var(--wine-50)' : 'var(--bg-surface)',
                    border: `1.5px solid ${
                      context.occasion === occ.value ? 'var(--wine-500)' : 'var(--border-subtle)'
                    }`,
                  }}
                >
                  <span className="text-2xl" aria-hidden>{occ.icon}</span>
                  <span
                    className="text-xs font-medium text-center leading-tight"
                    style={{
                      color:
                        context.occasion === occ.value
                          ? 'var(--accent-text)'
                          : 'var(--text-secondary)',
                    }}
                  >
                    {t(`recommendation.form.occasions.${occ.value}`)}
                  </span>
                </motion.button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="app-eyebrow mb-3" style={{ color: 'var(--text-secondary)' }}>
              {t('recommendation.form.vibe')}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {vibes.map((v) => (
                <motion.button
                  key={v.value}
                  type="button"
                  onClick={() => setContext({ ...context, vibe: v.value })}
                  whileTap={{ scale: 0.95 }}
                  aria-pressed={context.vibe === v.value}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 min-h-[76px] rounded-2xl transition-colors hover:border-[var(--wine-300)]"
                  style={{
                    backgroundColor:
                      context.vibe === v.value ? 'var(--wine-50)' : 'var(--bg-surface)',
                    border: `1.5px solid ${
                      context.vibe === v.value ? 'var(--wine-500)' : 'var(--border-subtle)'
                    }`,
                  }}
                >
                  <span className="text-2xl" aria-hidden>{v.icon}</span>
                  <span
                    className="text-xs font-medium text-center leading-tight"
                    style={{
                      color:
                        context.vibe === v.value ? 'var(--accent-text)' : 'var(--text-secondary)',
                    }}
                  >
                    {t(`recommendation.form.vibes.${v.value}`)}
                  </span>
                </motion.button>
              ))}
            </div>
          </div>

        </div>

        {/* Wine Preferences - Expandable Section */}
        <div
          className="app-card overflow-hidden"
        >
          <button
            type="button"
            onClick={() => setPreferencesExpanded(!preferencesExpanded)}
            aria-expanded={preferencesExpanded}
            className="w-full flex items-center justify-between px-5 sm:px-6 py-4 min-h-[56px] transition-colors hover:bg-[var(--interactive-hover)]"
            style={{
              backgroundColor: preferencesExpanded ? 'var(--bg-muted)' : 'transparent',
            }}
          >
            <span
              className="text-base font-semibold"
              style={{ color: 'var(--text-heading)' }}
            >
              {t('recommendation.form.winePreferences')}
            </span>
            {preferencesExpanded ? (
              <ChevronUp className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} strokeWidth={1.75} aria-hidden />
            ) : (
              <ChevronDown className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} strokeWidth={1.75} aria-hidden />
            )}
          </button>

          <AnimatePresence initial={false}>
            {preferencesExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div
                  className="px-5 sm:px-6 pb-5 space-y-5"
                  style={{ borderTop: '1px solid var(--border-subtle)' }}
                >
                  {/* Avoid too young toggle with clock icon */}
                  <div className="pt-4">
                    <div className="flex items-center gap-3">
                      <Clock
                        className="w-5 h-5 shrink-0"
                        strokeWidth={1.75}
                        style={{ color: 'var(--text-tertiary)' }}
                      />
                      <div className="flex-1">
                        <Toggle
                          checked={context.avoidTooYoung}
                          onChange={(checked) => setContext({ ...context, avoidTooYoung: checked })}
                          label={t('recommendation.form.avoidTooYoung')}
                          size="md"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Wine Type Segmented Control */}
                  <div>
                    <p id="rec-label-1"
                      className="block text-sm font-medium mb-2"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {t('recommendation.form.wineType')}
                    </p>
                    <div aria-labelledby="rec-label-1"
                      className="flex rounded-full p-1 gap-1"
                      role="group"
                      style={{
                        backgroundColor: 'var(--bg-muted)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      {(['red', 'white', 'rose', 'mixed'] as WineType[]).map((type) => {
                        const selected = context.wineType === type;
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setContext({ ...context, wineType: type })}
                            aria-pressed={selected}
                            className="flex-1 min-h-[44px] rounded-full font-medium text-sm transition-colors duration-150"
                            style={{
                              background: selected ? 'var(--sommi-gradient-primary)' : 'transparent',
                              color: selected ? '#fff' : 'var(--text-secondary)',
                            }}
                          >
                            {t(`recommendation.form.${type}`)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Price Range Segmented Control */}
                  <div>
                    <p id="rec-label-2"
                      className="block text-sm font-medium mb-2"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {t('recommendation.form.priceRange')}
                    </p>
                    <div aria-labelledby="rec-label-2"
                      className="flex rounded-full p-1 gap-1"
                      role="group"
                      style={{
                        backgroundColor: 'var(--bg-muted)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      {([0, 1, 2, 3, 4] as PriceRange[]).map((value) => {
                        const selected = context.priceRange === value;
                        const label = formatPriceTierLabel(
                          value,
                          preferredCurrency || 'USD',
                          i18n.language,
                          t('recommendation.form.priceAny'),
                        );
                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setContext({ ...context, priceRange: value })}
                            aria-pressed={selected}
                            title={label}
                            className="flex-1 min-h-[44px] rounded-full font-medium text-xs sm:text-sm px-1 transition-colors duration-150"
                            style={{
                              background: selected ? 'var(--sommi-gradient-primary)' : 'transparent',
                              color: selected ? '#fff' : 'var(--text-secondary)',
                            }}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    <p
                      className="text-xs mt-2 leading-relaxed"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      {t('recommendation.form.priceRangeHelp')}
                    </p>
                  </div>

                  {/* Prefer ready to drink toggle */}
                  <Toggle
                    checked={context.preferReadyToDrink}
                    onChange={(checked) => setContext({ ...context, preferReadyToDrink: checked })}
                    label={t('recommendation.form.preferReadyToDrink')}
                    size="md"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="sticky z-10 bottom-above-nav pt-3">
          <motion.button
            type="submit"
            disabled={loading}
            className="w-full min-h-[52px] rounded-full font-semibold text-base flex items-center justify-center gap-2 disabled:opacity-80"
            style={{
              background: 'var(--sommi-gradient-primary)',
              color: '#fff',
              boxShadow: 'var(--shadow-cta)',
              border: 'none',
            }}
            whileHover={!loading ? { y: -1 } : {}}
            whileTap={!loading ? { scale: 0.98 } : {}}
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>{t('recommendation.form.finding')}</span>
              </>
            ) : (
              <>
                <span>{t('recommendation.form.getRecommendations')}</span>
                <ChevronRight className="w-5 h-5 rtl:-scale-x-100" strokeWidth={2} aria-hidden />
              </>
            )}
          </motion.button>
        </div>
      </form>

      {/* Local FAB only when Sommi card is unavailable (flag off). */}
      {!flagsLoading && !flags?.cellarAgentEnabled && <SommelierChatButton />}
    </motion.div>
  );
}
