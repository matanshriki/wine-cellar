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

type ReadinessStatus = 'TooYoung' | 'Approaching' | 'InWindow' | 'Peak' | 'PastPeak' | 'Unknown';

export function BottleCard({ bottle, onEdit, onDelete, onAnalyze, onMarkOpened }: Props) {
  const { t } = useTranslation();

  const getReadinessColor = (status: ReadinessStatus) => {
    switch (status) {
      case 'Peak':
      case 'InWindow':
        return 'badge-green';
      case 'Approaching':
        return 'badge-yellow';
      case 'TooYoung':
      case 'PastPeak':
        return 'badge-red';
      default:
        return 'badge-gray';
    }
  };

  const getStyleColor = (style: string) => {
    switch (style) {
      case 'red':
        return 'bg-red-100 text-red-800';
      case 'white':
        return 'bg-yellow-100 text-yellow-800';
      case 'rose':
        return 'bg-pink-100 text-pink-800';
      case 'sparkling':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="card hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 min-w-0">
          {/* Note: Bottle name and producer are NOT translated - they're actual wine data */}
          <h3 className="font-semibold text-base sm:text-lg text-gray-900 truncate">
            {bottle.wine.wine_name}
          </h3>
          {bottle.wine.producer && (
            <p className="text-xs sm:text-sm text-gray-600 truncate">{bottle.wine.producer}</p>
          )}
        </div>
        {/* Wine style badge - translates the display text */}
        <span className={`badge ${getStyleColor(bottle.wine.color)} text-xs flex-shrink-0 ml-2`}>
          {t(`cellar.wineStyles.${bottle.wine.color}`)}
        </span>
      </div>

      <div className="space-y-1.5 sm:space-y-2 mb-3 sm:mb-4">
        {/* Note: vintage is NOT translated - it's the actual year */}
        {bottle.wine.vintage && (
          <div className="text-xs sm:text-sm text-gray-600">
            <span className="font-medium">{t('cellar.bottle.vintage')}:</span> {bottle.wine.vintage}
          </div>
        )}
        {/* Note: region name is NOT translated - it's actual geographic data */}
        {bottle.wine.region && (
          <div className="text-xs sm:text-sm text-gray-600">
            <span className="font-medium">{t('cellar.bottle.region')}:</span> {bottle.wine.region}
          </div>
        )}
        {/* Note: grapes are NOT translated - they're actual grape variety names */}
        {bottle.wine.grapes && Array.isArray(bottle.wine.grapes) && bottle.wine.grapes.length > 0 && (
          <div className="text-xs sm:text-sm text-gray-600">
            <span className="font-medium">{t('cellar.bottle.grapes')}:</span> {bottle.wine.grapes.join(', ')}
          </div>
        )}
        <div className="text-xs sm:text-sm text-gray-600">
          <span className="font-medium">{t('cellar.bottle.quantity')}:</span> {bottle.quantity}
        </div>
      </div>

      {/* Sommelier Notes (AI Analysis) */}
      {(bottle as any).analysis_summary && (bottle as any).readiness_label ? (
        <div className="mb-3 sm:mb-4">
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
          className="w-full mb-3 sm:mb-4 py-2.5 px-4 text-sm font-medium rounded-lg transition-all hover:opacity-90 active:scale-[0.98] min-h-[44px]"
          style={{
            backgroundColor: 'var(--color-wine-50)',
            color: 'var(--color-wine-700)',
            border: '2px solid var(--color-wine-200)',
            WebkitTapHighlightColor: 'transparent',
            touchAction: 'manipulation',
          }}
        >
          <div className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span>{t('cellar.sommelier.generate')}</span>
          </div>
        </button>
      )}

      <div className="space-y-2">
        {/* Mark as Opened Button - Only show if quantity > 0 and handler is provided */}
        {onMarkOpened && bottle.quantity > 0 && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onMarkOpened();
            }}
            className="w-full py-2.5 px-4 text-sm font-medium rounded-lg transition-all hover:opacity-90 active:scale-[0.98] min-h-[44px]"
            style={{
              backgroundColor: 'var(--color-wine-500)',
              color: 'white',
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation',
            }}
          >
            🍷 {t('cellar.bottle.markOpened')}
          </button>
        )}
        
        {/* Edit / Delete Buttons */}
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="flex-1 btn btn-secondary text-xs sm:text-sm py-2"
          >
            {t('cellar.bottle.edit')}
          </button>
          <button
            onClick={onDelete}
            className="btn btn-danger text-xs sm:text-sm py-2 px-3 sm:px-4"
          >
            {t('cellar.bottle.delete')}
          </button>
        </div>
      </div>
    </div>
  );
}
