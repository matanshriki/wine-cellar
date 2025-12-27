import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '../lib/toast';
import { WineLoader } from '../components/WineLoader';
import * as historyService from '../services/historyService';

interface HistoryEvent {
  id: string;
  opened_at: string;
  occasion: string | null;
  meal_type: string | null;
  vibe: string | null;
  user_rating: number | null;
  tasting_notes: string | null;
  bottle: {
    wine: {
      producer: string;
      wine_name: string;
      vintage: number | null;
      color: string;
      region: string | null;
    };
  } | null;
}

export function HistoryPage() {
  const { t, i18n } = useTranslation();
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [stats, setStats] = useState<historyService.ConsumptionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    
    try {
      console.log('[HistoryPage] Loading data...');
      
      const [historyData, statsData] = await Promise.all([
        historyService.listHistory(),
        historyService.getConsumptionStats(),
      ]);
      
      console.log('[HistoryPage] Data loaded:', { historyCount: historyData.length, stats: statsData });
      
      setEvents(historyData);
      setStats(statsData);
    } catch (error: any) {
      console.error('[HistoryPage] Error loading data:', error);
      setError(error.message || 'Failed to load history');
      toast.error(error.message || t('history.error.loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    // Use current language for date formatting
    const locale = i18n.language === 'he' ? 'he-IL' : 'en-US';
    return date.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  if (loading) {
    return <WineLoader variant="page" size="lg" message={t('history.loading')} />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">{t('history.error.title')}</h2>
          <p className="text-sm text-gray-600 mb-6">{t('history.error.subtitle')}</p>
          <button
            onClick={loadData}
            className="btn btn-primary"
          >
            {t('history.error.retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('history.title')}</h1>
        <p className="text-sm sm:text-base text-gray-600 mt-1">{t('history.subtitle')}</p>
      </div>

      {stats && stats.total_opens > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="card">
            <div className="text-xs sm:text-sm text-gray-600 mb-1">{t('history.stats.totalOpens')}</div>
            <div className="text-2xl sm:text-3xl font-bold text-gray-900">{stats.total_opens}</div>
          </div>

          {stats.average_rating > 0 && (
            <div className="card">
              <div className="text-xs sm:text-sm text-gray-600 mb-1">{t('history.stats.averageRating')}</div>
              <div className="text-2xl sm:text-3xl font-bold text-gray-900">
                {stats.average_rating.toFixed(1)}/5
              </div>
            </div>
          )}

          {stats.favorite_color && (
            <div className="card">
              <div className="text-xs sm:text-sm text-gray-600 mb-1">{t('history.stats.favoriteStyle')}</div>
              {/* Note: color value is NOT translated - translate the label */}
              <div className="text-2xl sm:text-3xl font-bold text-gray-900">
                {t(`cellar.wineStyles.${stats.favorite_color}`)}
              </div>
            </div>
          )}

          {stats.favorite_region && (
            <div className="card">
              <div className="text-xs sm:text-sm text-gray-600 mb-1">{t('history.stats.favoriteRegion')}</div>
              {/* Note: region name is NOT translated - it's actual geographic data */}
              <div className="text-lg sm:text-xl font-bold text-gray-900">
                {stats.favorite_region}
              </div>
            </div>
          )}
        </div>
      )}

      {stats && stats.top_regions.length > 1 && (
        <div className="card mb-6 sm:mb-8">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">
            {t('history.stats.topRegions')}
          </h2>
          <div className="space-y-2">
            {stats.top_regions.slice(0, 5).map((item) => (
              <div key={item.region} className="flex items-center justify-between">
                {/* Note: region name is NOT translated - it's actual geographic data */}
                <span className="text-sm sm:text-base text-gray-700">{item.region}</span>
                <span className="badge badge-gray text-xs sm:text-sm">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">
          {t('history.openingHistory')}
        </h2>

        {events.length === 0 ? (
          <div className="text-center py-8 sm:py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-base sm:text-lg font-semibold text-gray-900 mb-2">{t('history.empty.title')}</p>
            <p className="text-xs sm:text-sm text-gray-500">
              {t('history.empty.subtitle')}
            </p>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {events.map((event) => (
              <div key={event.id} className="border-l-4 border-primary-500 pl-3 sm:pl-4 py-2">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-2">
                  <div className="flex-1">
                    {/* Note: Wine name, producer, vintage are NOT translated - they're actual wine data */}
                    <h3 className="font-semibold text-sm sm:text-base text-gray-900">
                      {event.bottle?.wine?.wine_name || t('history.unknownBottle')}
                    </h3>
                    <div className="text-xs sm:text-sm text-gray-600">
                      {event.bottle?.wine?.producer && `${event.bottle.wine.producer} • `}
                      {event.bottle?.wine?.vintage || 'NV'}
                    </div>
                  </div>
                  <div className="text-xs sm:text-sm text-gray-500 mt-1 sm:mt-0 whitespace-nowrap">
                    {formatDate(event.opened_at)}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-2">
                  {/* Wine color badge - translates the display text */}
                  {event.bottle?.wine?.color && (
                    <span className="badge badge-gray text-xs">
                      {t(`cellar.wineStyles.${event.bottle.wine.color}`)}
                    </span>
                  )}
                  {/* Note: meal_type and occasion are stored as enum values, displayed as-is */}
                  {event.meal_type && (
                    <span className="badge badge-blue text-xs">
                      {event.meal_type.replace('_', ' ')}
                    </span>
                  )}
                  {event.occasion && (
                    <span className="badge badge-green text-xs">
                      {event.occasion.replace('_', ' ')}
                    </span>
                  )}
                  {event.user_rating && (
                    <span className="badge badge-yellow text-xs">⭐ {event.user_rating}/5</span>
                  )}
                </div>

                {/* Note: tasting_notes are user-generated content, NOT translated */}
                {event.tasting_notes && (
                  <p className="text-xs sm:text-sm text-gray-700 italic mt-2">{event.tasting_notes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

