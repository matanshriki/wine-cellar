import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '../lib/toast';
import { WineLoader } from '../components/WineLoader';
import { WineDetailsModal } from '../components/WineDetailsModal';
import * as historyService from '../services/historyService';
import * as bottleService from '../services/bottleService';
import type { BottleWithWineInfo } from '../services/bottleService';

interface HistoryEvent {
  id: string;
  opened_at: string;
  occasion: string | null;
  meal_type: string | null;
  vibe: string | null;
  user_rating: number | null;
  tasting_notes: string | null;
  notes: string | null;
  bottle_id: string;
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
  const [selectedBottle, setSelectedBottle] = useState<BottleWithWineInfo | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [ratingLoading, setRatingLoading] = useState<string | null>(null);
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesText, setNotesText] = useState<string>('');
  const [notesSaving, setNotesSaving] = useState<string | null>(null);

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

  async function handleWineClick(event: HistoryEvent) {
    if (!event.bottle_id) {
      toast.error(t('history.error.noBottleData'));
      return;
    }

    try {
      const bottle = await bottleService.getBottle(event.bottle_id);
      if (!bottle) {
        toast.error(t('history.error.noBottleData'));
        return;
      }
      setSelectedBottle(bottle);
      setIsModalOpen(true);
    } catch (error: any) {
      console.error('[HistoryPage] Error loading bottle:', error);
      toast.error(error.message || t('history.error.loadBottleFailed'));
    }
  }

  async function handleQuickRating(eventId: string, isPositive: boolean) {
    console.log('[HistoryPage] Updating rating for event:', eventId, 'isPositive:', isPositive);
    setRatingLoading(eventId);
    
    try {
      // Update rating: thumbs up = 5, thumbs down = 2
      const newRating = isPositive ? 5 : 2;
      console.log('[HistoryPage] Setting user_rating to:', newRating);
      
      const updatedEvent = await historyService.updateConsumptionHistory(eventId, {
        user_rating: newRating,
      });
      
      console.log('[HistoryPage] ✅ Rating updated successfully:', updatedEvent);

      // Optimistically update local state (instant feedback)
      setEvents((prevEvents) => 
        prevEvents.map(event => 
          event.id === eventId 
            ? { ...event, user_rating: newRating } 
            : event
        )
      );
      
      console.log('[HistoryPage] Local state updated optimistically');
      
      // Also refresh from server to ensure consistency
      await loadData();
      
      console.log('[HistoryPage] Data reloaded from server');
      
      toast.success(t('history.ratingUpdated'));
    } catch (error: any) {
      console.error('[HistoryPage] ❌ Error updating rating:', error);
      toast.error(error.message || t('history.error.ratingFailed'));
    } finally {
      setRatingLoading(null);
    }
  }

  function handleEditNotes(eventId: string, currentNotes: string | null) {
    console.log('[HistoryPage] Editing notes for event:', eventId);
    setEditingNotesId(eventId);
    setNotesText(currentNotes || '');
  }

  function handleCancelNotes() {
    console.log('[HistoryPage] Cancelled notes editing');
    setEditingNotesId(null);
    setNotesText('');
  }

  async function handleSaveNotes(eventId: string) {
    console.log('[HistoryPage] Saving notes for event:', eventId);
    setNotesSaving(eventId);
    
    try {
      const updatedEvent = await historyService.updateConsumptionHistory(eventId, {
        notes: notesText.trim() || null,
      });
      
      console.log('[HistoryPage] ✅ Notes saved successfully:', updatedEvent);

      // Optimistically update local state
      setEvents((prevEvents) => 
        prevEvents.map(event => 
          event.id === eventId 
            ? { ...event, notes: notesText.trim() || null } 
            : event
        )
      );
      
      // Clear editing state
      setEditingNotesId(null);
      setNotesText('');
      
      toast.success(t('history.notesSaved'));
    } catch (error: any) {
      console.error('[HistoryPage] ❌ Error saving notes:', error);
      toast.error(error.message || t('history.error.notesFailed'));
    } finally {
      setNotesSaving(null);
    }
  }

  function handleModalClose() {
    setIsModalOpen(false);
    setSelectedBottle(null);
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
              <div 
                key={event.id} 
                className="group relative border-l-4 border-primary-500 pl-3 sm:pl-4 py-3 sm:py-4 rounded-r-lg hover:bg-gray-50 transition-all duration-200 cursor-pointer"
                onClick={() => handleWineClick(event)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleWineClick(event);
                  }
                }}
              >
                {/* Wine Info Section */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-3">
                  <div className="flex-1 pr-2">
                    {/* Note: Wine name, producer, vintage are NOT translated - they're actual wine data */}
                    <h3 className="font-semibold text-base sm:text-lg text-gray-900 group-hover:text-primary-600 transition-colors">
                      {event.bottle?.wine?.wine_name || t('history.unknownBottle')}
                    </h3>
                    <div className="text-xs sm:text-sm text-gray-600 mt-1">
                      {event.bottle?.wine?.producer && `${event.bottle.wine.producer} • `}
                      <span className="font-medium">{event.bottle?.wine?.vintage || 'NV'}</span>
                      {event.bottle?.wine?.region && ` • ${event.bottle.wine.region}`}
                    </div>
                  </div>
                  <div className="text-xs sm:text-sm text-gray-500 mt-2 sm:mt-0 whitespace-nowrap font-medium">
                    {formatDate(event.opened_at)}
                  </div>
                </div>

                {/* Badges Section */}
                <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-3">
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
                </div>

                {/* Tasting Notes */}
                {/* Note: tasting_notes are user-generated content, NOT translated */}
                {event.tasting_notes && (
                  <p className="text-xs sm:text-sm text-gray-700 italic mb-3 pl-3 border-l-2 border-gray-200">
                    "{event.tasting_notes}"
                  </p>
                )}

                {/* Rating Section */}
                <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                  <span className="text-xs text-gray-600 font-medium">{t('history.quickRating')}:</span>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleQuickRating(event.id, true);
                      }}
                      disabled={ratingLoading === event.id}
                      className={`
                        flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all
                        ${event.user_rating && event.user_rating >= 4 
                          ? 'bg-green-100 text-green-700 border-2 border-green-500' 
                          : 'bg-gray-100 text-gray-600 hover:bg-green-50 hover:text-green-600 border-2 border-transparent hover:border-green-300'
                        }
                        ${ratingLoading === event.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                      `}
                      aria-label={t('history.thumbsUp')}
                    >
                      <span className="text-base">👍</span>
                      <span>{t('history.liked')}</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleQuickRating(event.id, false);
                      }}
                      disabled={ratingLoading === event.id}
                      className={`
                        flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all
                        ${event.user_rating && event.user_rating <= 3 
                          ? 'bg-orange-100 text-orange-700 border-2 border-orange-500' 
                          : 'bg-gray-100 text-gray-600 hover:bg-orange-50 hover:text-orange-600 border-2 border-transparent hover:border-orange-300'
                        }
                        ${ratingLoading === event.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                      `}
                      aria-label={t('history.thumbsDown')}
                    >
                      <span className="text-base">👎</span>
                      <span>{t('history.notLiked')}</span>
                    </button>
                  </div>

                  {/* Current Rating Display */}
                  {event.user_rating && (
                    <span className="ml-auto badge badge-yellow text-xs">
                      ⭐ {event.user_rating}/5
                    </span>
                  )}
                </div>

                {/* Personal Notes Section */}
                <div 
                  className="mt-3 pt-3 border-t border-gray-200"
                  onClick={(e) => e.stopPropagation()}
                >
                  {editingNotesId === event.id ? (
                    /* Editing Mode */
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-700 flex items-center gap-1">
                        <span>📝</span>
                        <span>{t('history.personalNotes')}</span>
                      </label>
                      <textarea
                        value={notesText}
                        onChange={(e) => setNotesText(e.target.value)}
                        placeholder={t('history.notesPlaceholder')}
                        maxLength={1000}
                        rows={3}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          color: 'var(--text-primary)',
                        }}
                      />
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-gray-500">
                          {notesText.length}/1000
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleCancelNotes()}
                            className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors min-h-[36px]"
                          >
                            {t('common.cancel')}
                          </button>
                          <button
                            onClick={() => handleSaveNotes(event.id)}
                            disabled={notesSaving === event.id}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 rounded-md transition-colors min-h-[36px] flex items-center gap-1"
                          >
                            {notesSaving === event.id ? (
                              <>
                                <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                <span>{t('common.saving')}</span>
                              </>
                            ) : (
                              t('common.save')
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Display Mode */
                    <div>
                      {event.notes ? (
                        <div>
                          <div className="text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                            <span>📝</span>
                            <span>{t('history.personalNotes')}:</span>
                          </div>
                          <p className="text-sm text-gray-700 mb-2 pl-4 whitespace-pre-wrap">
                            {event.notes}
                          </p>
                          <button
                            onClick={() => handleEditNotes(event.id, event.notes)}
                            className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                          >
                            {t('common.edit')}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleEditNotes(event.id, null)}
                          className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                        >
                          <span>📝</span>
                          <span>{t('history.addNote')}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Click Indicator */}
                <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Wine Details Modal */}
      <WineDetailsModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        bottle={selectedBottle}
        onRefresh={loadData}
      />
    </div>
  );
}

