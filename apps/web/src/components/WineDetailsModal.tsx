/**
 * Wine Details Modal
 * 
 * Displays comprehensive wine information in a beautiful bottle-themed modal
 */

import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import type { BottleWithWineInfo } from '../services/bottleService';
import * as bottleService from '../services/bottleService';
import * as labelArtService from '../services/labelArtService';
import * as storageImageService from '../services/storageImageService';
import { useWineDisplayImage } from '../hooks/useWineDisplayImage';
import { useLocalizedWine } from '../hooks/useLocalizedWine';
import { AddWineImageDialog } from './AddWineImageDialog';
import { SommelierNotes } from './SommelierNotes';
import { KeepBadge } from './KeepBadge';
import { toast } from '../lib/toast';
import { trackAILabel, trackUpload, trackInsight } from '../services/analytics';
import { getCurrencyCode, convertCurrency, formatCurrency } from '../utils/currency';
import { useAuth } from '../contexts/SupabaseAuthContext';
import type { AIAnalysis } from '../services/aiAnalysisService';
import type { TasteProfile } from '../types/supabase';
import * as tasteProfileService from '../services/tasteProfileService';
import { getBottleInsight } from '../services/insightService';
import { SommiInsightPill } from './SommiInsightPill';
import { recordShownInsight } from '../services/insightCache';
import { readCachedFoodPairing, getFoodPairingFallback, triggerFoodPairingGeneration } from '../services/foodPairingService';
import type { FoodPairing } from '../services/foodPairingService';
import type { BottleWithWineInfo } from '../services/bottleService';

// ─── Food Pairing Section ─────────────────────────────────────────────────────

function FoodPairingSection({
  wine,
  bottle,
}: {
  wine: Record<string, unknown>;
  bottle: BottleWithWineInfo;
}) {
  const { t, i18n } = useTranslation();
  const language = i18n.language ?? 'en';
  const aiPairing = readCachedFoodPairing(wine, language);
  const fallback = getFoodPairingFallback(wine as any);

  // Auto-trigger generation for the current language if not cached yet
  useEffect(() => {
    if (!aiPairing) {
      triggerFoodPairingGeneration(bottle, language);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, bottle.wine_id]);

  return (
    <div>
      <h3
        className="text-sm font-semibold mb-3 flex items-center gap-2"
        style={{ color: 'var(--text-primary)' }}
      >
        <span>🍽️</span>
        <span>{t('foodPairing.sectionTitle')}</span>
        {aiPairing && (
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{
              background: 'linear-gradient(135deg, var(--gold-500), var(--gold-600))',
              color: 'white',
              fontSize: '10px',
            }}
          >
            {t('foodPairing.badge')}
          </span>
        )}
      </h3>

      {/* AI-generated data */}
      {aiPairing && <PairingCard pairing={aiPairing} />}

      {/* Pending state — AI not generated yet; show fallback clearly labelled */}
      {!aiPairing && (
        <>
          {/* Subtle pending notice */}
          <div
            className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg"
            style={{
              background: 'var(--bg-muted)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <svg className="w-3.5 h-3.5 flex-shrink-0 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                {t('foodPairing.pendingTitle')}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {t('foodPairing.pendingSubtitle')}
              </p>
            </div>
          </div>

          {/* Style-based fallback, clearly labelled */}
          <div className="mb-2 flex items-center gap-1.5">
            <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: 'var(--bg-muted)', color: 'var(--text-tertiary)', border: '1px solid var(--border-subtle)' }}>
              {t('foodPairing.styleFallbackLabel')}
            </span>
          </div>
          <PairingCard pairing={fallback} muted />
        </>
      )}
    </div>
  );
}

interface PairingCardProps {
  pairing: FoodPairing;
  muted?: boolean;
}

function PairingCard({ pairing, muted = false }: PairingCardProps) {
  const { t } = useTranslation();
  const opacity = muted ? 0.75 : 1;

  return (
    <div
      className="rounded-xl p-4 space-y-4"
      style={{
        background: 'linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-muted) 100%)',
        border: '1px solid var(--border-subtle)',
        opacity,
      }}
    >
      {/* Summary */}
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {pairing.summary}
      </p>

      {/* Best pairings */}
      {pairing.best_pairings.length > 0 && (
        <div>
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('foodPairing.premiumPairings')}
          </p>
          <div className="flex flex-wrap gap-2">
            {pairing.best_pairings.map((dish, i) => (
              <span
                key={i}
                className="text-xs px-2.5 py-1 rounded-full"
                style={{
                  background: 'var(--wine-50, rgba(164,77,90,0.08))',
                  color: 'var(--wine-700, #8b2e3d)',
                  border: '1px solid var(--wine-200, rgba(164,77,90,0.2))',
                }}
              >
                {dish}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Everyday pairings */}
      {pairing.everyday_pairings.length > 0 && (
        <div>
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('foodPairing.everydayPairings')}
          </p>
          <div className="flex flex-wrap gap-2">
            {pairing.everyday_pairings.map((dish, i) => (
              <span
                key={i}
                className="text-xs px-2.5 py-1 rounded-full"
                style={{
                  background: 'var(--bg-muted)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-base)',
                }}
              >
                {dish}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Pairing logic */}
      {pairing.pairing_logic && (
        <p
          className="text-xs italic"
          style={{ color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}
        >
          {pairing.pairing_logic}
        </p>
      )}

      {/* Occasions */}
      {pairing.occasion_fit.length > 0 && (
        <div>
          <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('foodPairing.occasions')}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {pairing.occasion_fit.map((occ, i) => (
              <span
                key={i}
                className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  background: 'var(--gold-50, rgba(212,175,55,0.08))',
                  color: 'var(--gold-700, #8a6d00)',
                  border: '1px solid var(--gold-200, rgba(212,175,55,0.25))',
                }}
              >
                {occ}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Avoid */}
      {pairing.avoid.length > 0 && (
        <div>
          <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('foodPairing.avoid')}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {pairing.avoid.join(' · ')}
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface WineDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  bottle: BottleWithWineInfo | null;
  onMarkAsOpened?: (bottle: BottleWithWineInfo) => void;
  onRefresh?: () => void;
  /**
   * Re-run AI analysis. Return the analysis object so barrel fields can render
   * immediately (they live on `wines` and may not be in `bottle` yet).
   */
  onAnalyze?: () => Promise<AIAnalysis | void | undefined> | AIAnalysis | void | undefined;
}

export function WineDetailsModal({ isOpen, onClose, bottle, onMarkAsOpened, onRefresh, onAnalyze }: WineDetailsModalProps) {
  const { t, i18n } = useTranslation();
  const { preferredCurrency } = useAuth();
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRemovingKeep, setIsRemovingKeep] = useState(false);

  const [userCanGenerateAI, setUserCanGenerateAI] = useState(false);
  /** After refresh, show barrel + serving from the API response until bottle data catches up */
  const [barrelFromRefresh, setBarrelFromRefresh] = useState<{
    note: string | null;
    months: number | null;
  } | null>(null);
  const [servingGuidanceFromRefresh, setServingGuidanceFromRefresh] = useState<import('../services/aiAnalysisService').ServingGuidance | null>(null);
  const [tasteProfile, setTasteProfile] = useState<TasteProfile | null>(null);

  const displayImage = useWineDisplayImage(bottle?.wine);
  const localizedWine = useLocalizedWine(bottle?.wine);

  useEffect(() => {
    setBarrelFromRefresh(null);
  }, [bottle?.id]);

  // Load taste profile once when the modal opens (cached after first load)
  useEffect(() => {
    if (!isOpen || !bottle) return;
    tasteProfileService.getMyTasteProfile().then(setTasteProfile).catch(() => null);
  }, [isOpen]);

  // Compute insight once per open — skips demo bottles
  const insight = useMemo(
    () => (bottle && !(bottle as any).is_demo ? getBottleInsight(bottle, tasteProfile) : null),
    [bottle, tasteProfile],
  );

  // Track + record insight once when the modal first opens and insight is ready
  useEffect(() => {
    if (!isOpen || !insight || !bottle) return;
    recordShownInsight(insight);
    trackInsight.shown({
      insight_type: insight.type,
      surface: 'bottle_details',
      is_personalized: insight.type !== 'educational',
      bottle_id: bottle.id,
      wine_id: bottle.wine_id,
    });
    // Intentionally only on isOpen change + insight type; avoids tracking
    // duplicate events if tasteProfile updates asynchronously while modal stays open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, insight?.type]);

  /**
   * Wraps the parent's onAnalyze so the modal can show a spinner while the
   * AI analysis is running, and automatically clears it when done/errored.
   */
  const handleRefreshAnalysis = onAnalyze
    ? async () => {
        setIsRefreshing(true);
        try {
          const result = await onAnalyze();
          if (result && typeof result === 'object' && 'readiness_label' in result) {
            const ar = result as AIAnalysis;
            setBarrelFromRefresh({
              note: ar.barrel_aging_note ?? null,
              months: ar.barrel_aging_months_est ?? null,
            });
            if (ar.serving_guidance) {
              setServingGuidanceFromRefresh(ar.serving_guidance);
            }
          }
        } finally {
          setIsRefreshing(false);
        }
      }
    : undefined;

  const handleRemoveKeep = async () => {
    if (!bottle || isDemoBottle) return;
    setIsRemovingKeep(true);
    try {
      await bottleService.updateBottle(bottle.id, {
        is_reserved: false,
        reserved_for: null,
        reserved_date: null,
        reserved_note: null,
      });
      toast.success(t('cellar.bottle.keepRemoved'));
      if (onRefresh) onRefresh();
    } catch {
      toast.error(t('errors.generic', 'Something went wrong'));
    } finally {
      setIsRemovingKeep(false);
    }
  };

  // Lock body scroll when modal is open.
  // Uses the negative-top trick so the page doesn't visually snap to y=0
  // (which can make the cellar behind the modal look "blank" to users).
  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY;

      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';

      return () => {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        // Restore the exact scroll position the user was at
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  // Check AI label art access once per session (result is cached in the service)
  useEffect(() => {
    if (!isOpen || !bottle) return;
    if (bottle.id.startsWith('demo-')) { setUserCanGenerateAI(false); return; }
    labelArtService.isLabelArtEnabledForUser().then(setUserCanGenerateAI);
  }, [isOpen, bottle?.id]);

  // Don't render anything if no bottle is available
  if (!bottle) return null;

  // Use bottle prop directly
  const displayBottle = bottle;
  const wine = displayBottle.wine;
  
  // Onboarding v1 – value first: Check if this is a demo bottle
  const isDemoBottle = displayBottle.id.startsWith('demo-');

  const handleSaveImage = async (imageUrl: string) => {
    // Onboarding v1 – value first: Prevent saving for demo bottles
    if (isDemoBottle) {
      toast.warning(t('onboarding.demoRecommendation.demoOnly', '(Demo mode - not available)'));
      return;
    }

    try {
      await bottleService.updateWineImage(wine.id, imageUrl || null);
      
      // Track image upload success
      if (imageUrl) {
        trackUpload.bottleImageSuccess();
      }
      
      toast.success(
        imageUrl 
          ? t('wineImage.updateSuccess', 'Wine image updated!')
          : t('wineImage.removeSuccess', 'Wine image removed')
      );
      
      // Refresh data if callback provided
      if (onRefresh) {
        onRefresh();
      }
    } catch (error: any) {
      console.error('Error updating wine image:', error);
      trackUpload.bottleImageError(error.message || 'unknown_error'); // Track image upload error
      throw error; // Let dialog handle the error
    }
  };

  const handleGenerateLabelArt = async (style: labelArtService.LabelArtStyle) => {
    // Onboarding v1 – value first: Prevent AI generation for demo bottles
    if (isDemoBottle) {
      toast.warning(t('onboarding.demoRecommendation.demoOnly', '(Demo mode - not available)'));
      return;
    }

    setIsGenerating(true);
    setShowGenerateDialog(false);
    trackAILabel.start(style); // Track AI label generation start
    
    try {
      console.log('[WineDetailsModal] 🎨 Starting AI label generation...');
      const result = await labelArtService.generateLabelArt(displayBottle, style);
      
      console.log('[WineDetailsModal] ✅ Generation successful:', result);
      trackAILabel.success(style); // Track successful AI label generation
      
      if (result.cached) {
        toast.success(t('labelArt.cachedSuccess', 'Using existing generated label art'));
      } else {
        toast.success(t('labelArt.generateSuccess', 'Label art generated successfully!'));
      }
      
      // Refresh parent component to update the bottle data
      if (onRefresh) {
        onRefresh();
      }
    } catch (error: any) {
      console.error('[WineDetailsModal] ❌ Error generating label art:', error);
      trackAILabel.error(error.message || 'unknown_error'); // Track AI label generation error
      
      // Check if it's a deployment issue (Edge Function not found)
      if (error.message?.includes('Failed to send a request to the Edge Function') || 
          error.message?.includes('FunctionsHttpError') ||
          error.message?.includes('FunctionsFetchError')) {
        toast.error(
          '⚙️ AI generation not deployed yet. See DEPLOY_AI_LABEL_ART.md for setup instructions.',
          { duration: 8000 }
        );
      } else if (error.message?.includes('AI image generation not configured')) {
        toast.error(
          '🔑 OpenAI API key not configured. Run: supabase secrets set OPENAI_API_KEY=sk-...',
          { duration: 8000 }
        );
      } else {
        toast.error(error.message || t('labelArt.generateFailed', 'Failed to generate label art'));
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.1, ease: 'easeOut' }}
          className="fixed inset-0 z-50"
          style={{
            willChange: 'opacity',
            WebkitBackfaceVisibility: 'hidden',
            backfaceVisibility: 'hidden',
          }}
        >
          {/* Backdrop */}
          <div
            onClick={onClose}
            className="absolute inset-0 bg-black bg-opacity-50"
            style={{ 
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
            }}
          />

          {/* Modal */}
          <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-4 md:p-6 lg:p-8 ios-modal-scroll">
            <motion.div
              initial={{ scale: 0.97, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.97, opacity: 0 }}
              transition={{ duration: 0.1, ease: 'easeOut' }}
              className="luxury-card flex w-full min-w-0 flex-col overflow-x-hidden"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  onClose();
                }
              }}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-labelledby="wine-details-title"
              style={{
                maxWidth: 'min(42rem, calc(100vw - 1.5rem))',
                maxHeight: 'calc(100dvh - 2rem)',
                height: 'auto',
                willChange: 'transform, opacity',
                WebkitBackfaceVisibility: 'hidden',
                backfaceVisibility: 'hidden',
                transform: 'translateZ(0)', // Force GPU acceleration on iOS
              }}
            >
              {/* Header */}
              <div 
                className="flex-shrink-0 p-4 sm:p-6 pb-3 sm:pb-4 border-b"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 pe-4">
                    <h2 
                      id="wine-details-title"
                      className="text-2xl sm:text-3xl md:text-4xl font-bold mb-1 leading-tight"
                      style={{ 
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-display)',
                      }}
                    >
                      {localizedWine.wine_name}
                    </h2>
                    {localizedWine.producer && (
                      <p 
                        className="text-base sm:text-lg"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {localizedWine.producer}
                      </p>
                    )}
                  </div>
                  
                  {/* Close button */}
                  <button
                    onClick={onClose}
                    className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all duration-200 modal-close-button"
                    style={{
                      backgroundColor: 'var(--bg-muted)',
                      color: 'var(--text-secondary)',
                      WebkitTapHighlightColor: 'transparent',
                    }}
                    aria-label="Close wine details"
                  >
                    <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Content - Scrollable */}
              <div 
                className="luxury-scrollbar min-w-0 flex-1 space-y-6 overflow-x-hidden overflow-y-auto px-4 py-4 pb-20 sm:px-6 sm:py-6 md:space-y-8 md:px-8 md:pb-8"
                style={{
                  WebkitOverflowScrolling: 'touch',
                  overscrollBehavior: 'contain',
                }}
              >
                {/* Wine Image & Quick Stats */}
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                  {/* Wine Bottle Image or Placeholder */}
                  <div className="flex-shrink-0 mx-auto sm:mx-0">
                    <div className="relative group">
                      {displayImage.imageUrl ? (
                        <div className="relative">
                          <img 
                            src={displayImage.imageUrl}
                            alt={localizedWine.wine_name}
                            className="w-40 h-48 sm:w-40 sm:h-52 object-contain rounded-lg wine-image"
                            style={{
                              border: '2px solid var(--border-base)',
                              boxShadow: 'var(--shadow-lg)',
                            }}
                            onError={(e) => {
                              // Show placeholder on error
                              const placeholder = e.currentTarget.parentElement?.nextElementSibling;
                              if (placeholder) {
                                placeholder.classList.remove('hidden');
                              }
                              e.currentTarget.parentElement!.style.display = 'none';
                            }}
                          />
                          {/* AI Generated Badge */}
                          {displayImage.isGenerated && (
                            <div 
                              className="absolute top-2 end-2 px-2 py-1 rounded text-xs font-medium flex items-center gap-1"
                              style={{
                                background: 'rgba(0, 0, 0, 0.6)',
                                color: 'white',
                                backdropFilter: 'blur(4px)',
                              }}
                            >
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                              </svg>
                              <span>AI</span>
                            </div>
                          )}
                        </div>
                      ) : null}
                      
                      {/* Premium Placeholder */}
                      <div 
                        className={`w-40 h-48 sm:w-40 sm:h-52 rounded-lg flex flex-col items-center justify-center ${displayImage.imageUrl ? 'hidden' : ''}`}
                        style={{
                          border: '2px dashed var(--border-base)',
                          background: 'linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-muted) 100%)',
                        }}
                      >
                        <svg className="w-16 h-16 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-tertiary)' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-xs text-center px-4" style={{ color: 'var(--text-tertiary)' }}>
                          No image
                        </p>
                      </div>
                    </div>

                    {/* Image Management Buttons */}
                    <div className="mt-2 md:mt-3 space-y-2">
                      {/* Add/Update User Image */}
                      <button
                        onClick={() => {
                          // Onboarding v1 – value first: Prevent image upload for demo bottles
                          if (isDemoBottle) {
                            toast.warning(t('onboarding.demoRecommendation.demoOnly', '(Demo mode - not available)'));
                            return;
                          }
                          setShowImageDialog(true);
                        }}
                        disabled={isDemoBottle}
                        className={`w-full py-2 px-3 md:py-2.5 md:px-4 rounded-lg text-xs md:text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 image-button-hover ${
                          isDemoBottle ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                        style={{
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-base)',
                          color: 'var(--text-secondary)',
                          minHeight: '40px',
                          WebkitTapHighlightColor: 'transparent',
                        }}
                        aria-label={displayImage.imageUrl ? 'Update wine image' : 'Add wine image'}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span>
                          {displayImage.imageUrl
                            ? t('wineImage.updateButton', 'Update Image')
                            : t('wineImage.addButton', 'Add Image')
                          }
                        </span>
                      </button>

                      {/* Generate Label Art Button */}
                      {userCanGenerateAI && !displayImage.imageUrl && (
                        <button
                          onClick={() => {
                            // Onboarding v1 – value first: Prevent AI generation for demo bottles
                            if (isDemoBottle) {
                              toast.warning(t('onboarding.demoRecommendation.demoOnly', '(Demo mode - not available)'));
                              return;
                            }
                            setShowGenerateDialog(true);
                          }}
                          disabled={isGenerating || isDemoBottle}
                          className={`w-full py-2 px-3 md:py-2.5 md:px-4 rounded-lg text-xs md:text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 ai-button-hover ${
                            isDemoBottle ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                          title={isDemoBottle ? t('onboarding.demoRecommendation.demoOnly', '(Demo mode - not available)') : "Generate AI label art"}
                          style={{
                            background: isGenerating || isDemoBottle ? 'var(--bg-muted)' : 'linear-gradient(135deg, var(--gold-500), var(--gold-600))',
                            border: '1px solid var(--gold-600)',
                            color: 'white',
                            minHeight: '40px',
                            opacity: isGenerating ? 0.6 : 1,
                            cursor: isGenerating ? 'not-allowed' : 'pointer',
                            WebkitTapHighlightColor: 'transparent',
                          }}
                          aria-label="Generate AI label art"
                        >
                          {isGenerating ? (
                            <>
                              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              <span>{t('labelArt.generating', 'Generating...')}</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                              </svg>
                              <span>{t('labelArt.generate', 'Generate Label Art')}</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="flex-1 flex flex-wrap gap-4 sm:gap-6">
                    {/* Vintage */}
                    {wine.vintage && (
                      <div className="flex-shrink-0">
                        <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>
                          {t('cellar.bottle.vintage')}
                        </div>
                        <div className="text-lg sm:text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {wine.vintage}
                        </div>
                      </div>
                    )}

                    {/* Wine Type */}
                    <div className="flex-shrink-0">
                      <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>
                        {t('cellar.bottle.type')}
                      </div>
                      <span className="badge-luxury badge-luxury-wine text-xs">
                        {t(`cellar.wineStyles.${wine.color}`)}
                      </span>
                    </div>

                    {/* Quantity */}
                    <div className="flex-shrink-0">
                      <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>
                        {t('cellar.bottle.quantity')}
                      </div>
                      <div className="text-lg sm:text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                        ×{bottle.quantity}
                      </div>
                    </div>

                    {/* Rating */}
                    {wine.rating && (
                      <div className="flex-shrink-0">
                        <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>
                          Vivino Rating
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-lg sm:text-xl font-semibold" style={{ color: 'var(--wine-500)' }}>
                            ★
                          </span>
                          <span className="text-lg sm:text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {wine.rating.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sommi Insight */}
                {!isDemoBottle && (
                  <SommiInsightPill insight={insight} />
                )}

                {/* Divider */}
                <div style={{ borderTop: '1px solid var(--border-subtle)' }} />

                {/* Location Info */}
                {(localizedWine.region || localizedWine.country || (wine as any).regional_wine_style) && (
                  <div>
                    <h3 
                      className="text-sm font-semibold mb-3 flex items-center gap-2"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <span>📍</span>
                      {t('cellar.bottle.origin')}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {localizedWine.region && (
                        <div>
                          <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>
                            {t('form.region', 'Region')}
                          </div>
                          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{localizedWine.region}</div>
                        </div>
                      )}
                      {localizedWine.country && (
                        <div>
                          <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>
                            {t('wineDetails.country', 'Country')}
                          </div>
                          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{localizedWine.country}</div>
                        </div>
                      )}
                      {(wine as any).regional_wine_style && (
                        <div className="col-span-1 sm:col-span-2">
                          <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>
                            {t('wineDetails.regionalWineStyle', 'Regional Wine Style')}
                          </div>
                          <div className="text-sm font-medium" style={{ color: 'var(--wine-600)' }}>
                            {(wine as any).regional_wine_style}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Grapes */}
                {localizedWine.grapes && localizedWine.grapes.length > 0 && (
                  <div>
                    <h3 
                      className="text-sm font-semibold mb-3 flex items-center gap-2"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <span>🍇</span>
                      {t('cellar.bottle.grapes')}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {localizedWine.grapes.map((grape: string, index: number) => (
                        <span 
                          key={`${wine.id}-grape-${index}-${grape}`}
                          className="px-3 py-1 rounded-full text-sm"
                          style={{
                            backgroundColor: 'var(--wine-50)',
                            color: 'var(--wine-700)',
                            border: '1px solid var(--wine-200)',
                          }}
                        >
                          {grape}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Storage Info */}
                {(bottle.storage_location || bottle.purchase_date || bottle.purchase_price) && (
                  <div>
                    <h3 
                      className="text-sm font-semibold mb-3 flex items-center gap-2"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <span>📦</span>
                      {t('cellar.bottle.storage')}
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      {bottle.storage_location && (
                        <div>
                          <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>
                            {t('form.storageLocation', 'Location')}
                          </div>
                          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{bottle.storage_location}</div>
                        </div>
                      )}
                      {bottle.purchase_date && (
                        <div>
                          <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>
                            {t('form.purchaseDate', 'Purchased')}
                          </div>
                          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            {new Date(bottle.purchase_date).toLocaleDateString()}
                          </div>
                        </div>
                      )}
                      {bottle.purchase_price && (
                        <div>
                          <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>
                            {t('form.purchasePrice', 'Purchase Price')}
                          </div>
                          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            {(() => {
                              const locale = i18n.language;
                              const storedCurrency = bottle.purchase_price_currency || 'USD';
                              const convertedAmount = convertCurrency(
                                bottle.purchase_price,
                                storedCurrency,
                                preferredCurrency
                              );
                              return formatCurrency(convertedAmount, locale, { currencyOverride: preferredCurrency });
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* AI Analysis - Full Sommelier Notes */}
                {(bottle as any).analysis_summary && (bottle as any).readiness_label && (
                  <div>
                    <h3 
                      className="text-sm font-semibold mb-3 flex items-center gap-2"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <span>🔬</span>
                      {t('cellar.bottle.analysis')}
                    </h3>
                    <SommelierNotes
                      analysis={{
                        analysis_summary: (bottle as any).analysis_summary,
                        analysis_reasons: (bottle as any).analysis_reasons || [],
                        readiness_label: (bottle as any).readiness_label,
                        serving_temp_c: (bottle as any).serving_guidance?.temp_min ?? bottle.serve_temp_c ?? null,
                        decant_minutes: (bottle as any).serving_guidance?.decant_min ?? bottle.decant_minutes ?? 0,
                        serving_guidance: servingGuidanceFromRefresh ?? (bottle as any).serving_guidance ?? null,
                        drink_window_start: (bottle as any).drink_window_start,
                        drink_window_end: (bottle as any).drink_window_end,
                        confidence: (bottle as any).confidence || 'MEDIUM',
                        assumptions: (bottle as any).assumptions,
                        analyzed_at: (bottle as any).analyzed_at || new Date().toISOString(),
                        barrel_aging_note:
                          barrelFromRefresh !== null
                            ? barrelFromRefresh.note
                            : (bottle.wine.barrel_aging_note ?? null),
                        barrel_aging_months_est:
                          barrelFromRefresh !== null
                            ? barrelFromRefresh.months
                            : (bottle.wine.barrel_aging_months_est ?? null),
                        barrel_aging_metadata: (bottle.wine as any).barrel_aging_metadata ?? null,
                      }}
                      onRefresh={handleRefreshAnalysis}
                      isRefreshing={isRefreshing}
                    />
                  </div>
                )}

                {/* Notes */}
                {bottle.notes && (
                  <div>
                    <h3 
                      className="text-sm font-semibold mb-3 flex items-center gap-2"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <span>📝</span>
                      {t('cellar.bottle.notes')}
                    </h3>
                    <p 
                      className="text-sm p-4 rounded-lg"
                      style={{
                        backgroundColor: 'var(--bg-muted)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {bottle.notes}
                    </p>
                  </div>
                )}

                {/* Food Pairing — always shown */}
                {!isDemoBottle && (
                  <FoodPairingSection wine={wine} bottle={displayBottle} />
                )}

                {/* Keep / Reserved Section */}
                {bottle.is_reserved && !isDemoBottle && (
                  <div className="min-w-0">
                    <h3
                      className="mb-3 flex min-w-0 flex-wrap items-center gap-2 text-sm font-semibold"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gold-600, #a37700)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      <span className="min-w-0">
                        <KeepBadge reservedFor={bottle.reserved_for} reservedDate={bottle.reserved_date} size="md" />
                      </span>
                    </h3>
                    <div
                      className="min-w-0 space-y-2 rounded-xl p-4 text-sm break-words"
                      style={{
                        background: 'linear-gradient(135deg, rgba(212,175,55,0.07), rgba(180,140,30,0.10))',
                        border: '1px solid rgba(212,175,55,0.3)',
                      }}
                    >
                      {bottle.reserved_for && (
                        <div className="flex min-w-0 items-start gap-2">
                          <span className="flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>🎉</span>
                          <span className="min-w-0 break-words" style={{ color: 'var(--text-secondary)' }}>
                            {t('cellar.bottle.keepReservedFor', { name: bottle.reserved_for })}
                          </span>
                        </div>
                      )}
                      {bottle.reserved_date && (
                        <div className="flex min-w-0 items-start gap-2">
                          <span className="flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>📅</span>
                          <span className="min-w-0 break-words" style={{ color: 'var(--text-secondary)' }}>
                            {t('cellar.bottle.keepDate', {
                              date: new Date(bottle.reserved_date).toLocaleDateString(i18n.language, {
                                year: 'numeric', month: 'long', day: 'numeric',
                              }),
                            })}
                          </span>
                        </div>
                      )}
                      {bottle.reserved_note && (
                        <div className="flex min-w-0 items-start gap-2">
                          <span className="flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>📝</span>
                          <span className="min-w-0 break-words" style={{ color: 'var(--text-secondary)' }}>{bottle.reserved_note}</span>
                        </div>
                      )}
                      <div className="pt-2 flex gap-2">
                        <button
                          onClick={handleRemoveKeep}
                          disabled={isRemovingKeep}
                          className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all duration-150"
                          style={{
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-base)',
                            color: 'var(--text-secondary)',
                            cursor: isRemovingKeep ? 'not-allowed' : 'pointer',
                            opacity: isRemovingKeep ? 0.6 : 1,
                            minHeight: '32px',
                          }}
                        >
                          {isRemovingKeep ? '…' : t('cellar.bottle.removeKeep')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                {(onMarkAsOpened || wine.vivino_url) && (
                  <div className="pt-4 md:pt-6 border-t mt-6" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div className="space-y-3 md:space-y-4 mt-4">
                      {/* Mark as Opened Button */}
                      {onMarkAsOpened && (
                        <button
                          onClick={() => {
                            // Onboarding v1 – value first: Prevent marking demo bottles as opened
                            if (isDemoBottle) {
                              toast.warning(t('onboarding.demoRecommendation.demoOnly', '(Demo mode - not available)'));
                              return;
                            }
                            onMarkAsOpened(bottle);
                            onClose();
                          }}
                          disabled={isDemoBottle}
                          className={`mark-opened-button flex items-center justify-center gap-2 md:gap-3 w-full py-3 md:py-3.5 px-4 md:px-6 rounded-lg md:rounded-xl font-medium text-sm md:text-base transition-all duration-200 ${
                            isDemoBottle ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                          style={{
                            background: 'linear-gradient(135deg, var(--gold-500), var(--gold-600))',
                            color: 'white',
                            minHeight: '48px',
                            boxShadow: '0 2px 8px rgba(212, 175, 55, 0.2)',
                            border: '1px solid var(--gold-600)',
                            WebkitTapHighlightColor: 'transparent',
                            touchAction: 'manipulation',
                          }}
                          aria-label="Mark this bottle as opened"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>{t('cellar.bottle.markOpened')}</span>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                        </button>
                      )}

                      {/* Vivino Link */}
                      {wine.vivino_url && (
                        <a
                          href={wine.vivino_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="vivino-button flex items-center justify-center gap-2 md:gap-3 w-full py-3 md:py-3.5 px-4 md:px-6 rounded-lg md:rounded-xl font-medium text-sm md:text-base transition-all duration-200"
                          style={{
                            background: 'linear-gradient(135deg, var(--wine-500), var(--wine-600))',
                            color: 'white',
                            minHeight: '48px',
                            boxShadow: '0 2px 8px rgba(164, 77, 90, 0.2)',
                            border: '1px solid var(--wine-600)',
                            WebkitTapHighlightColor: 'transparent',
                            touchAction: 'manipulation',
                          }}
                          aria-label="View this wine on Vivino"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
                          </svg>
                          <span>{t('cellar.bottle.openVivino')}</span>
                          <svg className="w-4 h-4 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                        </a>
                      )}
                    </div>
                    
                    <style>{`
                      /* Desktop Hover States */
                      @media (hover: hover) and (pointer: fine) {
                        .modal-close-button:hover {
                          background-color: var(--bg-muted-hover) !important;
                          transform: scale(1.05);
                        }
                        
                        .image-button-hover:hover {
                          transform: translateY(-1px);
                          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                          border-color: var(--border-medium);
                        }
                        
                        .ai-button-hover:hover:not(:disabled) {
                          transform: translateY(-1px);
                          box-shadow: 0 4px 16px rgba(212, 175, 55, 0.3);
                        }
                        
                        .vivino-button:hover, .mark-opened-button:hover {
                          transform: translateY(-2px);
                        }
                        
                        .vivino-button:hover {
                          box-shadow: 0 6px 20px rgba(164, 77, 90, 0.35) !important;
                        }
                        
                        .mark-opened-button:hover {
                          box-shadow: 0 6px 20px rgba(212, 175, 55, 0.35) !important;
                        }
                      }
                      
                      /* Touch Feedback */
                      .vivino-button:active, .mark-opened-button:active {
                        transform: scale(0.98);
                      }
                      
                      .image-button-hover:active, .modal-close-button:active {
                        transform: scale(0.95);
                      }
                    `}</style>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
      
      {/* Add/Update Wine Image Dialog */}
      {bottle && (
        <AddWineImageDialog 
          isOpen={showImageDialog}
          onClose={() => setShowImageDialog(false)}
          onSave={handleSaveImage}
          onSaveStoragePath={async (storagePath, bucket) => {
            if (isDemoBottle) {
              toast.warning(t('onboarding.demoRecommendation.demoOnly', '(Demo mode - not available)'));
              return;
            }
            try {
              await bottleService.updateWineStorageImage(wine.id, storagePath, bucket);
              storageImageService.clearImageCache(bucket, storagePath);
              trackUpload.bottleImageSuccess();
              toast.success(t('wineImage.updateSuccess', 'Wine image updated!'));
              if (onRefresh) onRefresh();
            } catch (error: any) {
              console.error('Error updating wine storage image:', error);
              trackUpload.bottleImageError(error.message || 'unknown_error');
              throw error;
            }
          }}
          currentImageUrl={displayImage.imageUrl ?? undefined}
          wineName={localizedWine.wine_name}
        />
      )}

      {/* Generate Label Art Style Selection Dialog */}
      {showGenerateDialog && bottle && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowGenerateDialog(false)}
            className="fixed inset-0 bg-black bg-opacity-50 z-[60]"
            style={{ backdropFilter: 'blur(4px)' }}
          />
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="luxury-card w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                  {t('labelArt.selectStyle')}
                </h3>
                
                <div className="space-y-3 mb-4">
                  <button
                    onClick={() => handleGenerateLabelArt('classic')}
                    className="w-full p-4 rounded-lg text-left transition-all border-2"
                    style={{
                      borderColor: 'var(--border-base)',
                      background: 'var(--bg-surface)',
                    }}
                  >
                    <div className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                      {t('labelArt.styleClassic')}
                    </div>
                    <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {t('labelArt.styleClassicDesc')}
                    </div>
                  </button>
                  
                  <button
                    onClick={() => handleGenerateLabelArt('modern')}
                    className="w-full p-4 rounded-lg text-left transition-all border-2"
                    style={{
                      borderColor: 'var(--border-base)',
                      background: 'var(--bg-surface)',
                    }}
                  >
                    <div className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                      {t('labelArt.styleModern')}
                    </div>
                    <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {t('labelArt.styleModernDesc')}
                    </div>
                  </button>
                </div>

                <p className="text-xs text-center italic" style={{ color: 'var(--text-tertiary)' }}>
                  {t('labelArt.disclaimer')}
                </p>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

