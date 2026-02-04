import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BottleWithWineInfo } from '../services/bottleService';
import { DemoActionModal } from './DemoActionModal';
import { MuseumViewModal } from './MuseumViewModal';
import * as labelArtService from '../services/labelArtService';

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
  
  // Get display image using centralized logic (user image > AI generated > placeholder)
  const displayImage = labelArtService.getWineDisplayImage(bottle.wine);

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

  return (
    <>
      <div 
        className="luxury-card luxury-card-hover p-4 sm:p-4 md:p-5 w-full"
        onClick={(e) => {
          // Only trigger details if not clicking on a button
          const target = e.target as HTMLElement;
          const isButton = target.closest('button') || target.closest('a');
          if (!isButton && onShowDetails) {
            onShowDetails();
          }
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && onShowDetails) {
            e.preventDefault();
            onShowDetails();
          }
        }}
        style={{ cursor: onShowDetails ? 'pointer' : 'default' }}
        aria-label={`View details for ${bottle.wine.wine_name}`}
      >
        {/* Header Section */}
        <div className="relative mb-3 flex gap-3 md:gap-4">
          {/* Wine Image - Left Side */}
          {displayImage.imageUrl && (
            <div 
              className="flex-shrink-0 wine-image-container wine-image-size cursor-pointer relative group"
              onClick={(e) => {
                e.stopPropagation(); // Don't trigger card details
                console.log('[BottleCard] Opening museum view for:', bottle.wine.wine_name);
                setShowMuseumView(true);
              }}
              role="button"
              tabIndex={0}
              aria-label={t('bottle.viewImage', 'View image in full screen')}
            >
              <img 
                src={displayImage.imageUrl} 
                alt={bottle.wine.wine_name}
                className="object-cover rounded-md transition-transform duration-300 group-hover:scale-105"
                style={{
                  width: '100%',
                  height: '100%',
                  border: '1px solid var(--border-base)',
                  boxShadow: 'var(--shadow-sm)',
                }}
                loading="lazy"
                onError={(e) => {
                  // Hide image if it fails to load
                  e.currentTarget.style.display = 'none';
                }}
              />
              
              {/* Museum View Icon Overlay */}
              <div 
                className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-md pointer-events-none"
                style={{
                  background: 'rgba(0, 0, 0, 0.5)',
                }}
              >
                <svg className="w-7 h-7 text-white drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              
              {/* AI Generated Badge */}
              {displayImage.isGenerated && (
                <div 
                  className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 z-10"
                  style={{
                    background: 'rgba(0, 0, 0, 0.7)',
                    color: 'white',
                    backdropFilter: 'blur(4px)',
                  }}
                  title="AI-generated label art"
                >
                  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                  </svg>
                  <span>AI</span>
                </div>
              )}
            </div>
          )}
          
          {/* Placeholder for no image - consistent spacing */}
          {!displayImage.imageUrl && (
            <div className="flex-shrink-0 wine-image-container wine-image-size">
              <div
                className="rounded-md flex items-center justify-center transition-transform duration-300"
                style={{
                  width: '100%',
                  height: '100%',
                  border: '1px dashed var(--border-base)',
                  background: 'linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-muted) 100%)',
                }}
              >
                <span className="text-3xl">🍷</span>
              </div>
            </div>
          )}

        {/* Text Content */}
        <div className="flex-1 min-w-0">
          {/* Wine Style Badge - Top Right */}
          <div className="absolute top-0 end-0 flex flex-col gap-1 items-end">
            <span className="badge-luxury badge-luxury-wine text-xs">
              {t(`cellar.wineStyles.${bottle.wine.color}`)}
            </span>
            {/* Feedback iteration (dev only) - Readiness Badge */}
            {bottle.readiness_status && bottle.readiness_status !== 'Unknown' && (
              <span 
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{
                  background: 
                    bottle.readiness_status === 'InWindow' || bottle.readiness_status === 'Peak'
                      ? 'var(--color-emerald-100)'
                      : bottle.readiness_status === 'TooYoung' || bottle.readiness_status === 'Approaching'
                      ? 'var(--color-amber-100)'
                      : 'var(--color-orange-100)',
                  color:
                    bottle.readiness_status === 'InWindow' || bottle.readiness_status === 'Peak'
                      ? 'var(--color-emerald-700)'
                      : bottle.readiness_status === 'TooYoung' || bottle.readiness_status === 'Approaching'
                      ? 'var(--color-amber-700)'
                      : 'var(--color-orange-700)',
                }}
              >
                {bottle.readiness_status === 'InWindow' || bottle.readiness_status === 'Peak'
                  ? '✓ Ready'
                  : bottle.readiness_status === 'TooYoung' || bottle.readiness_status === 'Approaching'
                  ? '⏳ Hold'
                  : '🍷 Drink Soon'}
              </span>
            )}
          </div>

          {/* Wine Name - Note: NOT translated, it's actual wine data */}
          <h3 
            className="text-lg sm:text-xl md:text-2xl font-semibold line-clamp-2 leading-tight mb-2 pe-20"
            style={{ 
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-display)',
              fontWeight: 'var(--font-semibold)',
              letterSpacing: '-0.01em',
            }}
          >
            {bottle.wine.wine_name}
          </h3>

          {/* Producer - Note: NOT translated, it's actual wine data */}
          {bottle.wine.producer && (
            <p 
              className="text-sm truncate pe-20"
              style={{ 
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-body)',
              }}
            >
              {bottle.wine.producer}
            </p>
          )}

          {/* Vivino Rating - Note: NOT translated, it's numerical data */}
          {bottle.wine.rating && (
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center gap-1" title={`${bottle.wine.rating} ${t('cellar.bottle.vivinoRating')}`}>
                {[1, 2, 3, 4, 5].map((star) => {
                  const rating = bottle.wine.rating || 0;
                  const filled = star <= Math.floor(rating);
                  const halfFilled = !filled && star <= Math.ceil(rating);
                  
                  return (
                    <span
                      key={`${bottle.id}-star-${star}`}
                      className="text-base"
                      style={{
                        color: filled || halfFilled ? 'var(--wine-500)' : 'var(--border-base)',
                      }}
                      aria-hidden="true"
                    >
                      {filled ? '★' : halfFilled ? '⯪' : '☆'}
                    </span>
                  );
                })}
                <span
                  className="text-xs font-medium ms-1"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {bottle.wine.rating.toFixed(1)}
                </span>
              </div>

              {/* Vivino Link */}
              {bottle.wine.vivino_url && (
                <a
                  href={bottle.wine.vivino_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-2 py-1 rounded transition-all duration-200 vivino-link-hover"
                  style={{
                    color: 'var(--wine-600)',
                    backgroundColor: 'var(--wine-50)',
                    border: '1px solid var(--wine-200)',
                    minHeight: '28px',
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="View on Vivino"
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

      {/* Region & Country & Grapes - Compact single line */}
      {(bottle.wine.region || bottle.wine.country || (bottle.wine.grapes && Array.isArray(bottle.wine.grapes) && bottle.wine.grapes.length > 0)) && (
        <div className="mb-3 space-y-1">
          {/* Region & Country - Note: NOT translated, it's actual geographic data */}
          {(bottle.wine.region || bottle.wine.country) && (
            <div className="flex items-center gap-2">
              <span className="text-base flex-shrink-0" aria-hidden="true">📍</span>
              <span 
                className="text-sm line-clamp-1"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {[bottle.wine.region, bottle.wine.country].filter(Boolean).join(', ')}
              </span>
            </div>
          )}

          {/* Grapes - Note: NOT translated, they're actual grape variety names */}
          {bottle.wine.grapes && Array.isArray(bottle.wine.grapes) && bottle.wine.grapes.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-base flex-shrink-0" aria-hidden="true">🍇</span>
              <span 
                className="text-sm line-clamp-1"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {bottle.wine.grapes.join(', ')}
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
              className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2"
              style={{
                backgroundColor: 'var(--wine-50)',
                color: 'var(--wine-700)',
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
                    ? 'var(--color-green-100)' 
                    : (bottle as any).readiness_label === 'HOLD'
                    ? 'var(--color-blue-100)'
                    : 'var(--color-yellow-100)',
                color: 
                  (bottle as any).readiness_label === 'READY' 
                    ? 'var(--color-green-700)' 
                    : (bottle as any).readiness_label === 'HOLD'
                    ? 'var(--color-blue-700)'
                    : 'var(--color-yellow-700)',
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
            className="p-1.5 rounded-lg transition-colors disabled:opacity-50"
            style={{
              backgroundColor: 'transparent',
            }}
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
          className="w-full mb-3 py-3 px-4 text-sm md:text-base font-medium rounded-lg md:rounded-xl transition-all min-h-[44px] md:min-h-[48px] group analyze-button-hover"
          style={{
            backgroundColor: isDemo ? 'var(--bg-muted)' : 'var(--bg-subtle)',
            color: isDemo ? 'var(--text-tertiary)' : 'var(--wine-700)',
            border: '1px solid var(--border-base)',
            boxShadow: 'var(--shadow-xs)',
            WebkitTapHighlightColor: 'transparent',
            touchAction: 'manipulation',
            cursor: isDemo ? 'not-allowed' : 'pointer',
            opacity: isDemo ? 0.6 : 1,
          }}
          aria-label="Generate sommelier notes"
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
            className="w-full py-2.5 px-4 md:py-3 md:px-5 text-sm md:text-base font-semibold rounded-lg transition-all min-h-[44px] group mark-opened-hover"
            style={{
              background: 'linear-gradient(135deg, var(--wine-600), var(--wine-700))',
              color: 'var(--text-inverse)',
              boxShadow: 'var(--shadow-sm)',
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation',
            }}
            aria-label="Mark bottle as opened"
          >
            <div className="flex items-center justify-center gap-2">
              <span className="text-base md:text-lg">🍷</span>
              <span>{t('cellar.bottle.markOpened')}</span>
            </div>
          </button>
        )}
        
        {/* Secondary Actions: Details / Edit / Delete */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (onShowDetails) {
                onShowDetails();
              }
            }}
            className="py-2 px-2 text-xs md:text-sm font-medium rounded-lg transition-all min-h-[40px] flex items-center justify-center gap-1 details-button-hover"
            style={{
              backgroundColor: 'var(--wine-50)',
              color: 'var(--wine-700)',
              border: '1px solid var(--wine-200)',
              boxShadow: 'var(--shadow-xs)',
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation',
            }}
            aria-label="View bottle details"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span className="hidden sm:inline">{t('cellar.bottle.details')}</span>
          </button>
          
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onEdit();
            }}
            className="py-2 px-2 text-xs md:text-sm font-medium rounded-lg transition-all min-h-[40px] edit-button-hover"
            style={{
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-base)',
              boxShadow: 'var(--shadow-xs)',
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation',
            }}
            aria-label="Edit bottle"
          >
            {t('cellar.bottle.edit')}
          </button>
          
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // Onboarding v1 – production: Show demo modal for demo bottles
              if (isDemo) {
                handleDemoAction('delete');
              } else {
                onDelete();
              }
            }}
            className="py-2 px-2 text-xs md:text-sm font-medium rounded-lg transition-all min-h-[40px] delete-button-hover"
            style={{
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--color-error)',
              border: '1px solid var(--border-base)',
              boxShadow: 'var(--shadow-xs)',
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation',
            }}
            aria-label="Delete bottle"
          >
            {t('cellar.bottle.delete')}
          </button>
        </div>
      </div>
    </div>
      
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
            transform: translateY(-4px);
            box-shadow: var(--shadow-xl);
          }
          
          /* Wine image zoom on card hover */
          .luxury-card-hover:hover .wine-image-container img {
            transform: scale(1.08);
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
            box-shadow: 0 8px 24px rgba(164, 77, 90, 0.3);
          }
          
          /* Details button hover */
          .details-button-hover:hover {
            background-color: var(--wine-100);
            border-color: var(--wine-300);
            transform: translateY(-1px);
          }
          
          /* Edit button hover */
          .edit-button-hover:hover {
            background-color: var(--bg-muted);
            border-color: var(--border-medium);
            transform: translateY(-1px);
          }
          
          /* Delete button hover */
          .delete-button-hover:hover {
            background-color: rgba(239, 68, 68, 0.1);
            border-color: var(--color-error);
            transform: translateY(-1px);
          }
        }
        
        /* Touch feedback */
        .mark-opened-hover:active,
        .analyze-button-hover:active,
        .details-button-hover:active,
        .edit-button-hover:active,
        .delete-button-hover:active {
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
      bottle={{
        id: bottle.id,
        name: bottle.wine.wine_name || '',
        producer: bottle.wine.producer || undefined,
        vintage: bottle.wine.vintage || undefined,
        style: bottle.wine.style || 'red',
        rating: bottle.wine.rating || undefined,
        region: bottle.wine.region || undefined,
        grapes: bottle.wine.grapes || undefined,
        label_image_url: displayImage.imageUrl || undefined,
        readiness_status: bottle.readiness_status || undefined,
      }}
    />
  </>
  );
}
