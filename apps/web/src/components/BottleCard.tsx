import { useTranslation } from 'react-i18next';
import type { BottleWithWineInfo } from '../services/bottleService';
import { SommelierNotes } from './SommelierNotes';
import type { AIAnalysis } from '../services/aiAnalysisService';

interface Props {
  bottle: BottleWithWineInfo;
  onEdit: () => void;
  onDelete: () => void;
  onAnalyze: () => void;
  onMarkOpened?: () => void;
}

export function BottleCard({ bottle, onEdit, onDelete, onAnalyze, onMarkOpened }: Props) {
  const { t } = useTranslation();

  return (
    <div className="luxury-card luxury-card-hover p-4 sm:p-5">
      {/* Header Section */}
      <div className="relative mb-4 flex gap-3">
        {/* Wine Image - Left Side */}
        {bottle.wine.image_url && (
          <div className="flex-shrink-0">
            <img 
              src={bottle.wine.image_url} 
              alt={bottle.wine.wine_name}
              className="w-16 h-20 sm:w-20 sm:h-24 object-cover rounded-md"
              style={{
                border: '1px solid var(--border-base)',
                boxShadow: 'var(--shadow-sm)',
              }}
              loading="lazy"
              onError={(e) => {
                // Hide image if it fails to load
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        )}

        {/* Text Content */}
        <div className="flex-1 min-w-0">
          {/* Wine Style Badge - Top Right */}
          <div className="absolute top-0 end-0">
            <span className="badge-luxury badge-luxury-wine text-xs">
              {t(`cellar.wineStyles.${bottle.wine.color}`)}
            </span>
          </div>

          {/* Wine Name - Note: NOT translated, it's actual wine data */}
          <h3 
            className="text-lg sm:text-xl font-semibold line-clamp-2 leading-tight mb-2 pe-20"
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
                      key={star}
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
                  className="text-xs px-2 py-1 rounded transition-colors"
                  style={{
                    color: 'var(--wine-600)',
                    backgroundColor: 'var(--wine-50)',
                    border: '1px solid var(--wine-200)',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  Vivino
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Details Section - Clean icon-based layout */}
      <div className="grid grid-cols-2 gap-3 mb-4">
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
        <div className="flex items-center gap-2 justify-end">
          <span 
            className="badge-luxury badge-luxury-neutral text-xs"
            title={t('cellar.bottle.quantity')}
          >
            ×{bottle.quantity}
          </span>
        </div>

        {/* Region - Note: NOT translated, it's actual geographic data */}
        {bottle.wine.region && (
          <div className="col-span-2 flex items-start gap-2">
            <span className="text-base flex-shrink-0" aria-hidden="true">📍</span>
            <span 
              className="text-sm line-clamp-1"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {bottle.wine.region}
            </span>
          </div>
        )}

        {/* Grapes - Note: NOT translated, they're actual grape variety names */}
        {bottle.wine.grapes && Array.isArray(bottle.wine.grapes) && bottle.wine.grapes.length > 0 && (
          <div className="col-span-2 flex items-start gap-2">
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

      {/* Divider */}
      <div className="divider-luxury my-4" />

      {/* Sommelier Notes (AI Analysis) */}
      {(bottle as any).analysis_summary && (bottle as any).readiness_label ? (
        <div className="mb-4">
          <SommelierNotes
            analysis={{
              analysis_summary: (bottle as any).analysis_summary,
              analysis_reasons: (bottle as any).analysis_reasons || [],
              readiness_label: (bottle as any).readiness_label,
              serving_temp_c: bottle.serve_temp_c || 16,
              decant_minutes: bottle.decant_minutes || 0,
              drink_window_start: (bottle as any).drink_window_start,
              drink_window_end: (bottle as any).drink_window_end,
              confidence: (bottle as any).confidence || 'MEDIUM',
              assumptions: (bottle as any).assumptions,
              analyzed_at: (bottle as any).analyzed_at || new Date().toISOString(),
            }}
            onRefresh={onAnalyze}
          />
        </div>
      ) : (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onAnalyze();
          }}
          className="w-full mb-4 py-3 px-4 text-sm font-medium rounded-lg transition-all min-h-[44px] group hover-wine-btn"
          style={{
            backgroundColor: 'var(--bg-subtle)',
            color: 'var(--wine-700)',
            border: '1px solid var(--border-base)',
            boxShadow: 'var(--shadow-xs)',
            WebkitTapHighlightColor: 'transparent',
            touchAction: 'manipulation',
          }}
        >
          <div className="flex items-center justify-center gap-2">
            <svg 
              className="w-4 h-4 transition-transform group-hover:rotate-12" 
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
      <div className="space-y-3">
        {/* Primary Action: Mark as Opened - Only show if quantity > 0 */}
        {onMarkOpened && bottle.quantity > 0 && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onMarkOpened();
            }}
            className="w-full py-3 px-4 text-sm font-semibold rounded-lg transition-all min-h-[44px] group"
            style={{
              background: 'linear-gradient(135deg, var(--wine-600), var(--wine-700))',
              color: 'var(--text-inverse)',
              boxShadow: 'var(--shadow-sm)',
            WebkitTapHighlightColor: 'transparent',
            touchAction: 'manipulation',
          }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div className="flex items-center justify-center gap-2">
              <span className="text-base">🍷</span>
              <span>{t('cellar.bottle.markOpened')}</span>
            </div>
          </button>
        )}
        
        {/* Secondary Actions: Edit / Delete */}
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onEdit();
            }}
            className="flex-1 py-2.5 px-4 text-sm font-medium rounded-lg transition-all min-h-[44px]"
            style={{
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-base)',
              boxShadow: 'var(--shadow-xs)',
            WebkitTapHighlightColor: 'transparent',
            touchAction: 'manipulation',
          }}
          >
            {t('cellar.bottle.edit')}
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete();
            }}
            className="py-2.5 px-4 text-sm font-medium rounded-lg transition-all min-h-[44px]"
            style={{
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--color-error)',
              border: '1px solid var(--border-base)',
              boxShadow: 'var(--shadow-xs)',
            WebkitTapHighlightColor: 'transparent',
            touchAction: 'manipulation',
          }}
          >
            {t('cellar.bottle.delete')}
          </button>
        </div>
      </div>
    </div>
  );
}
