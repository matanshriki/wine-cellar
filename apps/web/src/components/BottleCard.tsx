import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { BottleWithWineInfo } from '../services/bottleService';
import { DemoActionModal } from './DemoActionModal';
import { MuseumViewModal } from './MuseumViewModal';
import { useWineDisplayImage } from '../hooks/useWineDisplayImage';
import { useLocalizedWine } from '../hooks/useLocalizedWine';
import { KeepBadge } from './KeepBadge';
import { WineImage } from './ui/WineImage';
import { StarRating } from './ui/StarRating';
import { OverflowMenu } from './ui/OverflowMenu';
import { Eye, Pencil, Trash2 } from 'lucide-react';

interface Props {
  bottle: BottleWithWineInfo;
  onEdit: () => void;
  onDelete: () => void;
  onAnalyze: () => void;
  onMarkOpened?: () => void;
  isDemo?: boolean; // Onboarding v1 – production: Flag for demo bottles
  onShowDetails?: () => void; // Callback to show details modal (centralized)
}

export function BottleCard({ bottle, onEdit, onDelete, onAnalyze, onMarkOpened, isDemo = false, onShowDetails }: Props) {
  const { t } = useTranslation();
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [demoAction, setDemoAction] = useState<'edit' | 'markOpened' | 'delete'>('edit');
  const [showMuseumView, setShowMuseumView] = useState(false);
  const [imageErrorRetried, setImageErrorRetried] = useState(false);
  const localizedWine = useLocalizedWine(bottle.wine);

  // Merge the bottle's own image fields into the wine object as a fallback.
  // This guards against a past bug where adding a second bottle of the same wine
  // (without a photo) could overwrite the shared wine record's image_path with null,
  // while the first bottle's own label_image_path remained correct.
  const wineWithBottleFallback = {
    ...bottle.wine,
    image_path: bottle.wine.image_path || (bottle as any).label_image_path || (bottle as any).image_path || null,
    label_image_path: bottle.wine.label_image_path || (bottle as any).label_image_path || null,
    image_url: bottle.wine.image_url || (bottle as any).image_url || null,
    label_image_url: (bottle.wine as any).label_image_url || (bottle as any).label_image_url || null,
  };
  const displayImage = useWineDisplayImage(wineWithBottleFallback);

  const handleImageError = useCallback(() => {
    if (!imageErrorRetried) {
      setImageErrorRetried(true);
      displayImage.refreshImage();
    }
  }, [imageErrorRetried, displayImage.refreshImage]);

  // Onboarding v1 – production: Handle demo bottle actions
  const handleDemoAction = (action: 'edit' | 'markOpened' | 'delete') => {
    setDemoAction(action);
    setShowDemoModal(true);
  };

  const handleAddBottleFromDemo = () => {
    // This will be handled by parent component (CellarPage)
    // For now, we'll just close the modal
    setShowDemoModal(false);
    // TODO: Trigger add bottle flow from parent
  };

  const readinessBadge = (() => {
    switch (bottle.readiness_status) {
      case 'InWindow': return { key: 'ready', tone: 'ready' };
      case 'Peak': return { key: 'peak', tone: 'ready' };
      case 'TooYoung': return { key: 'aging', tone: 'hold' };
      case 'Approaching': return { key: 'nearingPeak', tone: 'drink-soon' };
      case 'Unknown':
      case null:
      case undefined: return null;
      default: return { key: 'pastPeak', tone: 'drink-soon' };
    }
  })();

  return (
    <>
      <article
        className="luxury-card luxury-card-hover p-4 sm:p-4 md:p-5 w-full"
        onClick={(e) => {
          // Pointer convenience only; keyboard users use the title button.
          const target = e.target as HTMLElement;
          if (!target.closest('button, a, [role="menu"]') && onShowDetails) {
            onShowDetails();
          }
        }}
        style={{ cursor: onShowDetails ? 'pointer' : 'default' }}
      >
        {/* Header Section */}
        <div className="relative mb-3 flex gap-3 md:gap-4">
          {!displayImage.isLoading && displayImage.imageUrl && !imageErrorRetried ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowMuseumView(true);
              }}
              aria-label={`${t('bottle.viewImage')}: ${localizedWine.wine_name}`}
              className="flex-shrink-0 wine-image-container rounded-[var(--radius-md)]"
            >
              <WineImage
                src={displayImage.imageUrl}
                alt=""
                isGenerated={displayImage.isGenerated}
                onError={handleImageError}
                className="wine-image-size"
              />
            </button>
          ) : (
            <WineImage
              src={null}
              alt={localizedWine.wine_name}
              isLoading={displayImage.isLoading}
              className="wine-image-size"
            />
          )}

        {/* Text Content */}
        <div className="flex-1 min-w-0">
          {/* Wine Style Badge + Keep Badge - Top Right */}
          <div className="absolute top-0 end-0 flex flex-col gap-1 items-end">
            <span className="badge-luxury badge-luxury-wine text-xs">
              {t(`cellar.wineStyles.${bottle.wine.color}`)}
            </span>
            {bottle.is_reserved && (
              <KeepBadge
                reservedFor={bottle.reserved_for}
                reservedDate={bottle.reserved_date}
                size="sm"
              />
            )}
            {/* Readiness badge — only show when no AI analysis exists yet (AI label takes over once analyzed) */}
            {readinessBadge && !(bottle as any).readiness_label && (
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{
                  background: `var(--status-${readinessBadge.tone}-bg)`,
                  color: `var(--status-${readinessBadge.tone}-text)`,
                }}
              >
                {t(`cellar.readiness.${readinessBadge.key}`)}
              </span>
            )}
            {/* Kosher chip — high-confidence verified only.
                Medium-confidence ("Likely Kosher") is intentionally omitted
                from the card because a small chip cannot convey the nuance.
                The full details modal shows the softer "Likely Kosher" wording. */}
            {(bottle.wine as any).is_kosher === true &&
              (bottle.wine as any).kosher_confidence === 'high' && (
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{
                  background: 'var(--status-ready-bg)',
                  color: 'var(--status-ready-text)',
                }}
                title={t('kosher.chipTitle')}
              >
                {t('kosher.chipLabel')}
              </span>
            )}
          </div>

          <h3 
            className="text-lg sm:text-xl md:text-2xl font-semibold line-clamp-2 leading-tight mb-2 pe-20"
            style={{ 
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-display)',
              fontWeight: 'var(--font-semibold)',
              letterSpacing: '-0.01em',
            }}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onShowDetails?.();
              }}
              className="text-start rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-text)]"
              aria-label={t('cellar.bottle.viewDetailsFor', { name: localizedWine.wine_name })}
            >
              {localizedWine.wine_name}
            </button>
          </h3>

          {localizedWine.producer && (
            <p 
              className="text-sm truncate pe-20"
              style={{ 
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-body)',
              }}
            >
              {localizedWine.producer}
            </p>
          )}

          {/* Vivino Rating - Note: NOT translated, it's numerical data */}
          {bottle.wine.rating && (
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center gap-1" title={`${bottle.wine.rating} ${t('cellar.bottle.vivinoRating')}`}>
                <StarRating rating={bottle.wine.rating} size={14} />
              </div>

              {/* Vivino Link */}
              {bottle.wine.vivino_url && (
                <a
                  href={bottle.wine.vivino_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-2 py-1 rounded transition-all duration-200 vivino-link-hover"
                  style={{
                    color: 'var(--accent-text)',
                    backgroundColor: 'var(--wine-50)',
                    border: '1px solid var(--wine-200)',
                    minHeight: '28px',
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={t('a11y.viewOnVivino')}
                >
                  Vivino
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Details Section - Clean icon-based layout */}
      <div className="flex items-center justify-between mb-3">
        {/* Vintage - Note: NOT translated, it's the actual year */}
        {bottle.wine.vintage && (
          <div className="flex items-center gap-2">
            <span className="text-base" aria-hidden="true">📅</span>
            <span 
              className="text-sm font-medium"
              style={{ color: 'var(--text-secondary)' }}
            >
              {bottle.wine.vintage}
            </span>
          </div>
        )}

        {/* Quantity Badge */}
        <span 
          className="badge-luxury badge-luxury-neutral text-xs"
          title={t('cellar.bottle.quantity')}
        >
          ×{bottle.quantity}
        </span>
      </div>

      {(localizedWine.region || localizedWine.country || (localizedWine.grapes && localizedWine.grapes.length > 0)) && (
        <div className="mb-3 space-y-1">
          {(localizedWine.region || localizedWine.country) && (
            <div className="flex items-center gap-2">
              <span className="text-base flex-shrink-0" aria-hidden="true">📍</span>
              <span 
                className="text-sm line-clamp-1"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {[localizedWine.region, localizedWine.country].filter(Boolean).join(', ')}
              </span>
            </div>
          )}

          {localizedWine.grapes && localizedWine.grapes.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-base flex-shrink-0" aria-hidden="true">🍇</span>
              <span 
                className="text-sm line-clamp-1"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {localizedWine.grapes.join(', ')}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Divider */}
      <div className="divider-luxury my-3" />

      {/* Analysis Status - Compact Badge or Generate Button */}
      {(bottle as any).analysis_summary && (bottle as any).readiness_label ? (
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span 
              className="px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5"
              style={{
                backgroundColor: 'var(--wine-50)',
                color: 'var(--accent-text)',
                border: '1px solid var(--wine-200)',
              }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{t('cellar.sommelier.analyzed', 'Analyzed')}</span>
            </span>
            {/* Readiness Status Indicator */}
            <span 
              className="text-xs px-2 py-1 rounded-full font-medium"
              style={{
                backgroundColor: 
                  (bottle as any).readiness_label === 'READY' 
                    ? 'var(--status-ready-bg)' 
                    : (bottle as any).readiness_label === 'HOLD'
                    ? 'var(--status-hold-bg)'
                    : 'var(--status-drink-soon-bg)',
                color: 
                  (bottle as any).readiness_label === 'READY' 
                    ? 'var(--status-ready-text)' 
                    : (bottle as any).readiness_label === 'HOLD'
                    ? 'var(--status-hold-text)'
                    : 'var(--status-drink-soon-text)',
              }}
            >
              {t(`cellar.sommelier.status.${((bottle as any).readiness_label || '').toLowerCase()}`, (bottle as any).readiness_label)}
            </span>
          </div>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!isDemo) {
                onAnalyze();
              }
            }}
            disabled={isDemo}
            className="app-icon-btn disabled:opacity-50"
            aria-label={t('cellar.sommelier.refresh', 'Refresh analysis')}
            title={t('cellar.sommelier.refresh', 'Refresh analysis')}
          >
            <svg
              className="w-4 h-4"
              style={{ color: 'var(--text-secondary)' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      ) : (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!isDemo) {
              onAnalyze();
            }
          }}
          disabled={isDemo}
          title={isDemo ? t('onboarding.demoRecommendation.demoOnly') : undefined}
          className="w-full mb-3 py-3 px-4 text-sm md:text-base font-semibold rounded-full transition-all min-h-[44px] md:min-h-[48px] group analyze-button-hover"
          style={{
            backgroundColor: isDemo ? 'var(--bg-muted)' : 'var(--bg-subtle)',
            color: isDemo ? 'var(--text-tertiary)' : 'var(--accent-text)',
            border: '1px solid var(--border-medium)',
            WebkitTapHighlightColor: 'transparent',
            touchAction: 'manipulation',
            cursor: isDemo ? 'not-allowed' : 'pointer',
            opacity: isDemo ? 0.6 : 1,
          }}
        >
          <div className="flex items-center justify-center gap-2">
            <svg 
              className="w-4 h-4 md:w-5 md:h-5 transition-transform group-hover:rotate-12" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span>{t('cellar.sommelier.generate')}</span>
          </div>
        </button>
      )}

      {/* Actions Section */}
      <div className="space-y-2.5">
        {/* Primary Action: Mark as Opened - Only show if quantity > 0 */}
        {onMarkOpened && bottle.quantity > 0 && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // Onboarding v1 – production: Show demo modal for demo bottles
              if (isDemo) {
                handleDemoAction('markOpened');
              } else {
                onMarkOpened();
              }
            }}
            className="w-full py-2.5 px-4 md:py-3 md:px-5 text-sm md:text-base font-semibold rounded-full transition-all min-h-[44px] md:min-h-[48px] group mark-opened-hover"
            style={{
              background: 'var(--sommi-gradient-primary)',
              color: '#fff',
              boxShadow: '0 8px 20px -10px rgba(107, 31, 47, 0.6)',
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation',
            }}
          >
            <div className="flex items-center justify-center gap-2">
              <span className="text-base md:text-lg">🍷</span>
              <span>{t('cellar.bottle.markOpened')}</span>
            </div>
          </button>
        )}
        
        {/* Secondary actions: Details + overflow (Edit / Delete) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onShowDetails?.();
            }}
            className="flex-1 py-2 px-3 text-sm font-semibold rounded-full transition-all min-h-[44px] flex items-center justify-center gap-1.5 details-button-hover"
            style={{
              backgroundColor: 'var(--wine-50)',
              color: 'var(--accent-text)',
              border: '1px solid var(--wine-200)',
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation',
            }}
          >
            <Eye className="w-4 h-4" strokeWidth={1.75} aria-hidden />
            <span>{t('cellar.bottle.details')}</span>
          </button>
          <OverflowMenu
            label={t('cellar.bottle.moreActions', { name: localizedWine.wine_name })}
            items={[
              {
                key: 'edit',
                label: t('cellar.bottle.edit'),
                icon: <Pencil className="h-4 w-4" strokeWidth={1.75} />,
                onSelect: onEdit,
              },
              {
                key: 'delete',
                label: t('cellar.bottle.delete'),
                icon: <Trash2 className="h-4 w-4" strokeWidth={1.75} />,
                tone: 'danger',
                onSelect: () => (isDemo ? handleDemoAction('delete') : onDelete()),
              },
            ]}
          />
        </div>
      </div>
    </article>
      
    {/* Image Size & Desktop Hover Styles */}
    <style>{`
        /* Uniform wine image size - responsive */
        .wine-image-size {
          width: 64px;
          height: 80px;
        }
        
        @media (min-width: 640px) {
          .wine-image-size {
            width: 80px;
            height: 96px;
          }
        }
        
        @media (min-width: 768px) {
          .wine-image-size {
            width: 96px;
            height: 112px;
          }
        }
        
        @media (hover: hover) and (pointer: fine) {
          /* Card hover effect */
          .luxury-card-hover:hover {
            transform: translateY(-2px);
            box-shadow: var(--shadow-card-hover);
          }
          
          /* Vivino link hover */
          .vivino-link-hover:hover {
            background-color: var(--wine-100);
            border-color: var(--wine-300);
            transform: translateY(-1px);
          }
          
          /* Analyze button hover */
          .analyze-button-hover:hover {
            background-color: var(--wine-50);
            border-color: var(--wine-300);
            transform: translateY(-1px);
            box-shadow: var(--shadow-md);
          }
          
          /* Mark opened button hover */
          .mark-opened-hover:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 28px -10px rgba(107, 31, 47, 0.6);
          }
          
          /* Details button hover */
          .details-button-hover:hover {
            background-color: var(--wine-100);
            border-color: var(--wine-300);
            transform: translateY(-1px);
          }
          
        }
        
        /* Touch feedback */
        .mark-opened-hover:active,
        .analyze-button-hover:active,
        .details-button-hover:active {
          transform: scale(0.98);
        }
    `}</style>
    
    {/* Onboarding v1 – production: Demo Action Modal */}
    <DemoActionModal
      isOpen={showDemoModal}
      onClose={() => setShowDemoModal(false)}
      onAddBottle={handleAddBottleFromDemo}
      action={demoAction}
    />

    {/* Museum View Modal */}
    <MuseumViewModal
      isOpen={showMuseumView}
      onClose={() => setShowMuseumView(false)}
      onShowDetails={onShowDetails}
      bottle={{
        id: bottle.id,
        name: localizedWine.wine_name || '',
        producer: localizedWine.producer || undefined,
        vintage: bottle.wine.vintage || undefined,
        style: bottle.wine.style || 'red',
        rating: bottle.wine.rating || undefined,
        region: localizedWine.region || undefined,
        grapes: localizedWine.grapes && localizedWine.grapes.length > 0
          ? localizedWine.grapes.join(', ')
          : undefined,
        label_image_url: displayImage.imageUrl || undefined,
        readiness_label: (bottle as any).readiness_label || undefined,
        readiness_status: bottle.readiness_status || undefined,
      }}
    />
  </>
  );
}
