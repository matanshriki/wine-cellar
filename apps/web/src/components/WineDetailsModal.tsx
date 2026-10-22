/**
 * Wine Details Modal
 * 
 * Displays comprehensive wine information in a beautiful bottle-themed modal
 */

import { useState, useEffect, useMemo, useId, useRef } from 'react';
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
import { WineImage } from './ui/WineImage';
import { StarRating } from './ui/StarRating';
import { useDialogA11y } from '../hooks/useDialogA11y';
import { ChevronDown, ExternalLink, ImagePlus, Sparkles as SparklesIcon } from 'lucide-react';
import { toast } from '../lib/toast';
import { trackAILabel, trackUpload, trackInsight } from '../services/analytics';
import { addMonitoringBreadcrumb } from '../lib/monitoring';
import { getCurrencyCode, convertCurrency, formatCurrency } from '../utils/currency';
import { useAuth } from '../contexts/SupabaseAuthContext';
import type { AIAnalysis } from '../services/aiAnalysisService';
import { getLocalizedAnalysis } from '../services/aiAnalysisService';
import type { TasteProfile } from '../types/supabase';
import * as tasteProfileService from '../services/tasteProfileService';
import { getBottleInsight } from '../services/insightService';
import { SommiInsightPill } from './SommiInsightPill';
import { recordShownInsight } from '../services/insightCache';
import { readCachedFoodPairing, getFoodPairingFallback, triggerFoodPairingGeneration } from '../services/foodPairingService';
import type { FoodPairing } from '../services/foodPairingService';
import { readKosherInfo } from '../services/kosherService';

// ─── Collapsible section ──────────────────────────────────────────────────────

function DetailsSection({
  icon,
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  icon: string;
  title: string;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  return (
    <section className="min-w-0">
      <h3 className="m-0">
        <button
          type="button"
          className="app-disclosure w-full -mx-1"
          style={{ color: 'var(--text-primary)' }}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
        >
          <span aria-hidden>{icon}</span>
          <span>{title}</span>
          {badge}
          <ChevronDown className="app-disclosure-chevron ms-auto h-4 w-4" strokeWidth={1.75} aria-hidden />
        </button>
      </h3>
      {open && (
        <div id={panelId} className="mt-2 min-w-0">
          {children}
        </div>
      )}
    </section>
  );
}

// ─── Kosher Status Section ────────────────────────────────────────────────────

function KosherStatusSection({ wine }: { wine: Record<string, unknown> }) {
  const { t } = useTranslation();
  const kosher = readKosherInfo(wine);

  // Visibility rules (evaluated top-to-bottom; first match wins):
  //   null              → nothing
  //   true  + high      → verified Kosher badge
  //   true  + med       → softer "Likely Kosher" badge
  //   true  + low/null  → nothing (not reliable enough to surface)
  //   false + high/med  → "Not Kosher" (genuinely confirmed)
  //   false + low/null  → nothing (absence of evidence ≠ evidence of absence)

  if (kosher.is_kosher === null) return null;
  if (kosher.is_kosher === true && (kosher.kosher_confidence === 'low' || kosher.kosher_confidence === null)) return null;
  if (kosher.is_kosher === false && (kosher.kosher_confidence === 'low' || kosher.kosher_confidence === null)) return null;

  // At this point either:
  //   is_kosher=true  with confidence high|med
  //   is_kosher=false with confidence high|med
  const isVerified = kosher.is_kosher === true && kosher.kosher_confidence === 'high';
  const isLikely   = kosher.is_kosher === true && kosher.kosher_confidence === 'med';
  const isNotKosher = kosher.is_kosher === false;

  return (
    <div>
      <h3
        className="text-sm font-semibold mb-3 flex items-center gap-2"
        style={{ color: 'var(--text-primary)' }}
      >
        <span>✡️</span>
        <span>{t('kosher.sectionHeading')}</span>
      </h3>

      <div
        className="rounded-xl p-4 space-y-3"
        style={{
          background: isVerified
            ? 'linear-gradient(135deg, rgba(34,197,94,0.07), rgba(21,128,61,0.10))'
            : isLikely
            ? 'linear-gradient(135deg, rgba(34,197,94,0.04), rgba(21,128,61,0.06))'
            : 'var(--bg-muted)',
          border: isVerified
            ? '1px solid rgba(34,197,94,0.25)'
            : isLikely
            ? '1px solid rgba(34,197,94,0.15)'
            : '1px solid var(--border-subtle)',
        }}
      >
        {/* Primary status badge */}
        <div className="flex items-center gap-2 flex-wrap">
          {isVerified && (
            <span
              className="text-xs px-3 py-1 rounded-full font-semibold"
              style={{
                background: 'rgba(34,197,94,0.15)',
                color: 'rgb(21,128,61)',
                border: '1px solid rgba(34,197,94,0.4)',
              }}
            >
              {t('kosher.verified')}
            </span>
          )}

          {isLikely && (
            <span
              className="text-xs px-3 py-1 rounded-full font-medium"
              style={{
                background: 'rgba(34,197,94,0.08)',
                color: 'rgb(22,101,52)',
                border: '1px solid rgba(34,197,94,0.2)',
              }}
            >
              {t('kosher.likelyKosher')}
            </span>
          )}

          {isNotKosher && (
            <span
              className="text-xs px-3 py-1 rounded-full font-medium"
              style={{
                background: 'var(--bg-surface)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-base)',
              }}
            >
              {t('kosher.notKosher')}
            </span>
          )}

          {/* Sub-badges: only show alongside a positive (true) status */}
          {kosher.is_kosher && kosher.kosher_for_passover && (
            <span
              className="text-xs px-2.5 py-1 rounded-full font-medium"
              style={{
                background: 'rgba(234,179,8,0.12)',
                color: 'rgb(133,100,0)',
                border: '1px solid rgba(234,179,8,0.3)',
              }}
            >
              {t('kosher.kosherForPassover')}
            </span>
          )}

          {kosher.is_kosher && kosher.mevushal === true && (
            <span
              className="text-xs px-2.5 py-1 rounded-full font-medium"
              style={{
                background: 'rgba(99,102,241,0.10)',
                color: 'rgb(67,56,202)',
                border: '1px solid rgba(99,102,241,0.25)',
              }}
            >
              {t('kosher.mevushal')}
            </span>
          )}

          {kosher.is_kosher && kosher.mevushal === false && (
            <span
              className="text-xs px-2.5 py-1 rounded-full font-medium"
              style={{
                background: 'var(--bg-surface)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-base)',
              }}
            >
              {t('kosher.nonMevushal')}
            </span>
          )}
        </div>

        {kosher.kosher_confidence &&
          (kosher.kosher_confidence === 'low' ||
            kosher.kosher_confidence === 'med' ||
            kosher.kosher_confidence === 'high') &&
          (isVerified || isLikely || isNotKosher) && (
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {t(`kosher.confidence.${kosher.kosher_confidence}`)}
          </p>
        )}
        {kosher.is_kosher && kosher.kosher_certification && (
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {t('kosher.certifiedBy')} <span className="font-medium">{kosher.kosher_certification}</span>
          </p>
        )}

        {/* Source */}
        {kosher.is_kosher && kosher.kosher_source_name && (
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {t('kosher.source')}{' '}
            {kosher.kosher_source_url ? (
              <a
                href={kosher.kosher_source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
                style={{ color: 'var(--text-secondary)' }}
              >
                {kosher.kosher_source_name}
              </a>
            ) : (
              <span>{kosher.kosher_source_name}</span>
            )}
          </p>
        )}

        {/* Notes */}
        {kosher.kosher_notes && (
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {kosher.kosher_notes}
          </p>
        )}
      </div>
    </div>
  );
}

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
    <DetailsSection icon="🍽️" title={t('foodPairing.sectionTitle')} badge={aiPairing ? (
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: 'var(--gold-50)', color: 'var(--text-eyebrow)' }}
          >
            {t('foodPairing.badge')}
          </span>
        ) : undefined}>

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
    </DetailsSection>
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
                  color: 'var(--text-eyebrow)',
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useDialogA11y(dialogRef, isOpen, onClose, {
    initialFocusRef: closeButtonRef,
    isTopmost: !showImageDialog && !showGenerateDialog,
  });

  useEffect(() => {
    setBarrelFromRefresh(null);
  }, [bottle?.id]);

  // Load taste profile once when the modal opens (cached after first load)
  useEffect(() => {
    if (!isOpen || !bottle) return;
    addMonitoringBreadcrumb('bottle.modal_opened', 'ui', {
      bottle_id: bottle.id,
      wine_id: bottle.wine_id ?? undefined,
    });
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

  const localizedAnalysis = useMemo(() => {
    if (!bottle) return null;
    return getLocalizedAnalysis(bottle as unknown as Record<string, unknown>, i18n.language ?? 'en');
  }, [bottle, i18n.language]);

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
            className="absolute inset-0 bg-[var(--bg-overlay)] backdrop-blur-sm"
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
              ref={dialogRef}
              className="luxury-card flex w-full min-w-0 flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
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
                      className="text-2xl sm:text-3xl font-bold mb-1 leading-tight"
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
                    ref={closeButtonRef}
                    type="button"
                    onClick={onClose}
                    className="flex-shrink-0 w-11 h-11 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all duration-200 modal-close-button"
                    style={{
                      backgroundColor: 'var(--bg-muted)',
                      color: 'var(--text-secondary)',
                      WebkitTapHighlightColor: 'transparent',
                    }}
                    aria-label={t('common.close')}
                  >
                    <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Content - Scrollable */}
              <div 
                className="luxury-scrollbar min-w-0 flex-1 space-y-5 overflow-x-hidden overflow-y-auto px-4 py-4 sm:px-6 sm:py-5"
                style={{
                  WebkitOverflowScrolling: 'touch',
                  overscrollBehavior: 'contain',
                }}
              >
                {/* Wine Image & Quick Stats */}
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                  {/* Wine image: framed, never stretched; original opens in a new tab */}
                  <div className="flex-shrink-0 mx-auto sm:mx-0 flex flex-col items-center gap-2 w-32">
                    <WineImage
                      src={displayImage.imageUrl}
                      alt={localizedWine.wine_name}
                      isGenerated={displayImage.isGenerated}
                      loading="eager"
                      className="w-28 h-36 sm:w-32 sm:h-40"
                      iconSize={36}
                      showUnavailableText
                    />
                    {displayImage.imageUrl && (
                      <a
                        href={displayImage.imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="app-link inline-flex items-center gap-1 text-xs min-h-[32px]"
                      >
                        <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                        {t('bottle.viewImage')}
                      </a>
                    )}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (isDemoBottle) {
                            toast.warning(t('onboarding.demoRecommendation.demoOnly', '(Demo mode - not available)'));
                            return;
                          }
                          setShowImageDialog(true);
                        }}
                        disabled={isDemoBottle}
                        className="app-icon-btn disabled:opacity-50"
                        aria-label={displayImage.imageUrl ? t('wineImage.updateButton', 'Update Image') : t('wineImage.addButton', 'Add Image')}
                        title={displayImage.imageUrl ? t('wineImage.updateButton', 'Update Image') : t('wineImage.addButton', 'Add Image')}
                      >
                        <ImagePlus className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                      </button>
                      {userCanGenerateAI && !displayImage.imageUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            if (isDemoBottle) {
                              toast.warning(t('onboarding.demoRecommendation.demoOnly', '(Demo mode - not available)'));
                              return;
                            }
                            setShowGenerateDialog(true);
                          }}
                          disabled={isGenerating || isDemoBottle}
                          className="app-icon-btn disabled:opacity-50"
                          aria-label={isGenerating ? t('labelArt.generating', 'Generating...') : t('labelArt.generate', 'Generate Label Art')}
                          title={isGenerating ? t('labelArt.generating', 'Generating...') : t('labelArt.generate', 'Generate Label Art')}
                        >
                          <SparklesIcon className={`h-4 w-4 ${isGenerating ? 'animate-pulse' : ''}`} strokeWidth={1.75} aria-hidden />
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
                          {t('wineDetails.vivinoRating')}
                        </div>
                        <StarRating rating={wine.rating} size={16} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Readiness summary */}
                {(displayBottle as any).readiness_label && (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span
                      className="px-3 py-1 rounded-full text-xs font-semibold"
                      style={{
                        background: `var(--status-${(displayBottle as any).readiness_label === 'READY' ? 'ready' : (displayBottle as any).readiness_label === 'HOLD' ? 'hold' : 'drink-soon'}-bg)`,
                        color: `var(--status-${(displayBottle as any).readiness_label === 'READY' ? 'ready' : (displayBottle as any).readiness_label === 'HOLD' ? 'hold' : 'drink-soon'}-text)`,
                      }}
                    >
                      {t(`cellar.sommelier.status.${String((displayBottle as any).readiness_label).toLowerCase()}`)}
                    </span>
                    {(displayBottle as any).drink_window_start && (displayBottle as any).drink_window_end && (
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {t('wineDetails.drinkWindowRange', {
                          start: (displayBottle as any).drink_window_start,
                          end: (displayBottle as any).drink_window_end,
                        })}
                      </span>
                    )}
                  </div>
                )}

                {/* Sommi Insight */}
                {!isDemoBottle && (
                  <SommiInsightPill insight={insight} />
                )}

                {/* Divider */}
                <div style={{ borderTop: '1px solid var(--border-subtle)' }} />

                {/* Location Info */}
                {(localizedWine.region || localizedWine.country || (wine as any).regional_wine_style) && (
                  <DetailsSection icon="📍" title={t('cellar.bottle.origin')} defaultOpen>
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
                          <div className="text-sm font-medium" style={{ color: 'var(--accent-text)' }}>
                            {(wine as any).regional_wine_style}
                          </div>
                        </div>
                      )}
                    </div>
                  </DetailsSection>
                )}

                {/* Grapes */}
                {localizedWine.grapes && localizedWine.grapes.length > 0 && (
                  <DetailsSection icon="🍇" title={t('cellar.bottle.grapes')} defaultOpen>
                    <div className="flex flex-wrap gap-2">
                      {localizedWine.grapes.map((grape: string, index: number) => (
                        <span 
                          key={`${wine.id}-grape-${index}-${grape}`}
                          className="px-3 py-1 rounded-full text-sm"
                          style={{
                            backgroundColor: 'var(--wine-50)',
                            color: 'var(--accent-text)',
                            border: '1px solid var(--wine-200)',
                          }}
                        >
                          {grape}
                        </span>
                      ))}
                    </div>
                  </DetailsSection>
                )}

                {/* Storage Info */}
                {(bottle.storage_location || bottle.purchase_date || bottle.purchase_price) && (
                  <DetailsSection icon="📦" title={t('cellar.bottle.storage')}>
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
                  </DetailsSection>
                )}

                {/* AI Analysis - Full Sommelier Notes */}
                {localizedAnalysis && (displayBottle as any).readiness_label && (
                  <DetailsSection icon="🔬" title={t('cellar.bottle.analysis')}>
                    <SommelierNotes
                      analysis={{
                        analysis_summary: localizedAnalysis.analysis_summary,
                        analysis_reasons: localizedAnalysis.analysis_reasons,
                        readiness_label: (displayBottle as any).readiness_label,
                        serving_temp_c:
                          servingGuidanceFromRefresh?.temp_min
                          ?? localizedAnalysis.serving_guidance?.temp_min
                          ?? displayBottle.serve_temp_c
                          ?? null,
                        decant_minutes:
                          servingGuidanceFromRefresh?.decant_min
                          ?? localizedAnalysis.serving_guidance?.decant_min
                          ?? displayBottle.decant_minutes
                          ?? 0,
                        serving_guidance:
                          servingGuidanceFromRefresh
                          ?? localizedAnalysis.serving_guidance
                          ?? ((displayBottle as any).serving_guidance ?? null),
                        drink_window_start: (displayBottle as any).drink_window_start,
                        drink_window_end: (displayBottle as any).drink_window_end,
                        confidence: (displayBottle as any).confidence || 'MEDIUM',
                        assumptions: localizedAnalysis.assumptions ?? (displayBottle as any).assumptions,
                        analyzed_at: (displayBottle as any).analyzed_at || new Date().toISOString(),
                        barrel_aging_note:
                          barrelFromRefresh !== null
                            ? barrelFromRefresh.note
                            : (displayBottle.wine.barrel_aging_note ?? null),
                        barrel_aging_months_est:
                          barrelFromRefresh !== null
                            ? barrelFromRefresh.months
                            : (displayBottle.wine.barrel_aging_months_est ?? null),
                        barrel_aging_metadata: (displayBottle.wine as any).barrel_aging_metadata ?? null,
                      }}
                      onRefresh={handleRefreshAnalysis}
                      isRefreshing={isRefreshing}
                    />
                    {localizedAnalysis.showsMissingLanguageCta && !isDemoBottle && handleRefreshAnalysis && (
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => void handleRefreshAnalysis()}
                          disabled={isRefreshing}
                          className="text-xs font-medium px-3 py-2 rounded-full transition-colors disabled:opacity-50"
                          style={{
                            background: 'var(--bg-muted)',
                            border: '1px solid var(--border-base)',
                            color: 'var(--accent-text)',
                          }}
                        >
                          {i18n.language.startsWith('he')
                            ? t('wineDetails.analysis.generateInHebrew')
                            : t('wineDetails.analysis.generateInEnglish')}
                        </button>
                      </div>
                    )}
                  </DetailsSection>
                )}

                {/* Notes */}
                {bottle.notes && (
                  <DetailsSection icon="📝" title={t('cellar.bottle.notes')} defaultOpen>
                    <p 
                      className="text-sm p-4 rounded-lg"
                      style={{
                        backgroundColor: 'var(--bg-muted)',
                        color: 'var(--text-secondary)',
                      }}
                      dir="auto"
                    >
                      {bottle.notes}
                    </p>
                  </DetailsSection>
                )}

                {/* Food Pairing — always shown */}
                {!isDemoBottle && (
                  <FoodPairingSection wine={wine} bottle={displayBottle} />
                )}

                {/* Kosher Status */}
                {!isDemoBottle && (
                  <KosherStatusSection wine={wine} />
                )}

                {/* Keep / Reserved Section */}
                {bottle.is_reserved && !isDemoBottle && (
                  <div className="min-w-0">
                    <h3
                      className="mb-3 flex min-w-0 flex-wrap items-center gap-2 text-sm font-semibold"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-eyebrow)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
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
                          className="text-xs px-3 py-1.5 rounded-full font-medium transition-all duration-150"
                          style={{
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-base)',
                            color: 'var(--text-secondary)',
                            cursor: isRemovingKeep ? 'not-allowed' : 'pointer',
                            opacity: isRemovingKeep ? 0.6 : 1,
                            minHeight: '44px',
                          }}
                        >
                          {isRemovingKeep ? '…' : t('cellar.bottle.removeKeep')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* Sticky actions: always reachable without scrolling */}
              {(onMarkAsOpened || wine.vivino_url) && (
                <div
                  className="flex-shrink-0 flex items-center gap-2 border-t px-4 pt-3 sm:px-6"
                  style={{
                    borderColor: 'var(--border-subtle)',
                    backgroundColor: 'var(--bg-surface)',
                    paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))',
                  }}
                >
                  {onMarkAsOpened && (
                    <button
                      type="button"
                      onClick={() => {
                        if (isDemoBottle) {
                          toast.warning(t('onboarding.demoRecommendation.demoOnly', '(Demo mode - not available)'));
                          return;
                        }
                        onMarkAsOpened(bottle);
                        onClose();
                      }}
                      disabled={isDemoBottle}
                      className="btn-luxury-primary flex-1 !min-h-[48px] disabled:opacity-50"
                    >
                      <span aria-hidden>🍷</span>
                      <span>{t('cellar.bottle.markOpened')}</span>
                    </button>
                  )}
                  {wine.vivino_url && (
                    <a
                      href={wine.vivino_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`btn-luxury-secondary !min-h-[48px] ${onMarkAsOpened ? '' : 'flex-1'}`}
                      aria-label={t('a11y.viewOnVivino')}
                    >
                      <span>{onMarkAsOpened ? 'Vivino' : t('cellar.bottle.openVivino')}</span>
                      <ExternalLink className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                    </a>
                  )}
                </div>
              )}
              <style>{`
                @media (hover: hover) and (pointer: fine) {
                  .modal-close-button:hover {
                    background-color: var(--bg-muted-hover) !important;
                  }
                }
              `}</style>
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
            className="fixed inset-0 bg-[var(--bg-overlay)] backdrop-blur-sm z-[60]"
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
                <h3 className="app-section-title mb-4">
                  {t('labelArt.selectStyle')}
                </h3>
                
                <div className="space-y-3 mb-4">
                  <button
                    onClick={() => handleGenerateLabelArt('classic')}
                    className="w-full p-4 rounded-lg text-start transition-all border-2"
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
                    className="w-full p-4 rounded-lg text-start transition-all border-2"
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

