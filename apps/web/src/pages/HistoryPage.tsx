import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ChevronRight, NotebookPen, Star, Undo2, Wine } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '../lib/toast';
import { WineLoader } from '../components/WineLoader';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { WineDetailsModal } from '../components/WineDetailsModal';
import { RateRitualSheet, MOOD_CHIPS } from '../components/RateRitualSheet';
import * as historyService from '../services/historyService';
import * as bottleService from '../services/bottleService';
import type { BottleWithWineInfo } from '../services/bottleService';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Parse tasting_notes back into chip IDs and free-text notes */
function parseTastingNotes(raw: string | null): { chipIds: string[]; notes: string } {
  if (!raw) return { chipIds: [], notes: '' };
  const emojiToId: Record<string, string> = {
    '🔁': 'would_buy_again',
    '🍽️': 'great_with_food',
    '✨': 'special_occasion',
  };
  const allEmojis = new Set(Object.keys(emojiToId));
  const sepIdx = raw.indexOf(' · ');
  if (sepIdx !== -1) {
    const chipsPart = raw.slice(0, sepIdx);
    const tokens = chipsPart.split(' ');
    if (tokens.every(t => allEmojis.has(t))) {
      return {
        chipIds: tokens.map(t => emojiToId[t]).filter(Boolean),
        notes: raw.slice(sepIdx + 3),
      };
    }
  }
  // No separator — check if the whole string is chip emojis
  const tokens = raw.split(' ');
  if (tokens.length <= 3 && tokens.every(t => allEmojis.has(t))) {
    return { chipIds: tokens.map(t => emojiToId[t]).filter(Boolean), notes: '' };
  }
  return { chipIds: [], notes: raw };
}

/** Read-only compact star row */
function StarDisplay({ rating }: { rating: number }) {
  const n = Math.min(5, Math.max(0, Math.round(Number(rating) || 0)));
  return (
    <div className="flex gap-0.5" aria-label={`${n} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(star => (
        <span
          key={star}
          style={{ fontSize: '15px', filter: star <= n ? 'none' : 'grayscale(1) opacity(0.25)' }}
        >
          ⭐
        </span>
      ))}
    </div>
  );
}

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
  const navigate = useNavigate();
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [stats, setStats] = useState<historyService.ConsumptionStats | null>(null);
  const [loading, setLoading] = useState(true); // Keep true for proper data loading
  const [error, setError] = useState<string | null>(null);
  const [selectedBottle, setSelectedBottle] = useState<BottleWithWineInfo | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [ratingTarget, setRatingTarget] = useState<HistoryEvent | null>(null);
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesText, setNotesText] = useState<string>('');
  const [notesSaving, setNotesSaving] = useState<string | null>(null);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [showUndoConfirm, setShowUndoConfirm] = useState(false);
  const [undoEventData, setUndoEventData] = useState<{ id: string; wineName: string } | null>(null);

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

  function openRateSheet(event: HistoryEvent) {
    setRatingTarget(event);
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

  function handleUndoClick(event: HistoryEvent) {
    const wineName = event.bottle?.wine?.wine_name || t('history.unknownBottle');
    setUndoEventData({ id: event.id, wineName });
    setShowUndoConfirm(true);
  }

  async function confirmUndo() {
    if (!undoEventData) return;

    setUndoingId(undoEventData.id);
    setShowUndoConfirm(false);

    try {
      await historyService.undoBottleOpened(undoEventData.id);
      toast.success(t('history.movedBackToCellar'));
      // Reload data to reflect changes
      await loadData();
    } catch (error: any) {
      console.error('[HistoryPage] Error undoing bottle opened:', error);
      toast.error(error.message || t('history.moveBackError'));
    } finally {
      setUndoingId(null);
      setUndoEventData(null);
    }
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
      <EmptyState
        icon={<AlertCircle className="h-7 w-7" strokeWidth={1.75} aria-hidden />}
        title={t('history.error.title')}
        body={t('history.error.subtitle')}
        actions={
          <button onClick={loadData} className="btn-luxury-primary">
            {t('history.error.retry')}
          </button>
        }
      />
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow={t('history.eyebrow')}
        title={t('history.title')}
        subtitle={t('history.subtitle')}
      />

      {stats && stats.total_opens > 0 && (
        <section className="app-card px-4 py-3 sm:px-5 sm:py-4 mb-5" aria-label={t('history.stats.summary')}>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
            <div className="min-w-0">
              <dt className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('history.stats.totalOpens')}</dt>
              <dd className="app-display text-xl tabular-nums">{stats.total_opens}</dd>
            </div>
            {Number.isFinite(stats.average_rating) && stats.average_rating > 0 && (
              <div className="min-w-0">
                <dt className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('history.stats.averageRating')}</dt>
                <dd className="app-display text-xl tabular-nums">{Number(stats.average_rating).toFixed(1)}/5</dd>
              </div>
            )}
            {stats.favorite_color && (
              <div className="min-w-0">
                <dt className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('history.stats.favoriteStyle')}</dt>
                <dd className="app-display text-xl">{t(`cellar.wineStyles.${stats.favorite_color}`)}</dd>
              </div>
            )}
            {stats.favorite_region && (
              <div className="min-w-0">
                <dt className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('history.stats.favoriteRegion')}</dt>
                <dd className="app-display text-base sm:text-lg truncate" title={stats.favorite_region}>{stats.favorite_region}</dd>
              </div>
            )}
          </dl>
          {Array.isArray(stats.top_regions) && stats.top_regions.length > 1 && (
            <div className="mt-3 pt-3 border-t flex flex-wrap items-center gap-1.5" style={{ borderColor: 'var(--border-subtle)' }}>
              <span className="text-xs me-1" style={{ color: 'var(--text-secondary)' }}>{t('history.stats.topRegions')}:</span>
              {stats.top_regions.slice(0, 5).map((item) => (
                <span
                  key={item.region}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                  style={{ background: 'var(--bg-muted)', color: 'var(--text-primary)' }}
                >
                  <bdi>{item.region}</bdi>
                  <span className="font-semibold tabular-nums" style={{ color: 'var(--text-secondary)' }}>{item.count}</span>
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      {events.length === 0 ? (
        <EmptyState
          art="/assets/app/empty-history.jpg"
          title={t('history.empty.title')}
          body={t('history.empty.subtitle')}
          actions={
            <button onClick={() => navigate('/cellar')} className="btn-luxury-primary">
              <Wine className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              {t('history.empty.cta')}
            </button>
          }
        />
      ) : (
      <section aria-labelledby="history-list-title">
        <h2 id="history-list-title" className="app-section-title mb-3 sm:mb-4">
          {t('history.openingHistory')}
        </h2>
        {(
          <div className="space-y-3 sm:space-y-4">
            {events.map((event) => (
              <div 
                key={event.id} 
                className="app-card group relative border-s-4 ps-4 pe-10 sm:ps-5 py-4 sm:py-5 transition-shadow duration-200 cursor-pointer hover:shadow-[var(--shadow-card-hover)]"
                style={{ borderInlineStartColor: 'var(--wine-600)' }}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('button, a, textarea, input')) return;
                  handleWineClick(event);
                }}
              >
                {/* Wine Info Section */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-3">
                  <div className="flex-1 min-w-0 pe-2">
                    {/* Note: Wine name, producer, vintage are NOT translated - they're actual wine data */}
                    <h3 
                      className="font-semibold text-base sm:text-lg transition-colors group-hover:text-[var(--accent-text)]"
                      style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-display)' }}
                    >
                      <button
                        type="button"
                        onClick={() => handleWineClick(event)}
                        className="text-start rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-text)]"
                      >
                        {event.bottle?.wine?.wine_name || t('history.unknownBottle')}
                      </button>
                    </h3>
                    <div className="text-xs sm:text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                      {event.bottle?.wine?.producer && `${event.bottle.wine.producer} • `}
                      <span className="font-medium">{event.bottle?.wine?.vintage || 'NV'}</span>
                      {event.bottle?.wine?.region && ` • ${event.bottle.wine.region}`}
                    </div>
                  </div>
                  <div className="text-xs sm:text-sm mt-2 sm:mt-0 whitespace-nowrap font-medium" style={{ color: 'var(--text-tertiary)' }}>
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
                      {t(`recommendation.form.mealTypes.${event.meal_type}`, { defaultValue: event.meal_type.replace(/_/g, ' ') })}
                    </span>
                  )}
                  {event.occasion && (
                    <span className="badge badge-green text-xs">
                      {t(`recommendation.form.occasions.${event.occasion}`, { defaultValue: event.occasion.replace(/_/g, ' ') })}
                    </span>
                  )}
                </div>

                {/* Tasting notes — parsed into chips + free text */}
                {event.tasting_notes && (() => {
                  const { chipIds, notes: noteText } = parseTastingNotes(event.tasting_notes);
                  return (
                    <>
                      {chipIds.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {chipIds.map(chipId => {
                            const chip = MOOD_CHIPS.find(c => c.id === chipId);
                            if (!chip) return null;
                            return (
                              <span
                                key={chipId}
                                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                                style={{
                                  background: 'var(--wine-50)',
                                  color: 'var(--accent-text)',
                                  border: '1px solid var(--wine-200)',
                                }}
                              >
                                {chip.emoji} {t(chip.labelKey)}
                              </span>
                            );
                          })}
                        </div>
                      )}
                      {noteText && (
                        <p
                          className="text-xs sm:text-sm italic mb-3 ps-3 border-s-2"
                          style={{ color: 'var(--text-primary)', borderColor: 'var(--border-medium)' }}
                        >
                          "{noteText}"
                        </p>
                      )}
                    </>
                  );
                })()}

                {/* Personal Notes Section */}
                <div 
                  className="mb-3"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  {editingNotesId === event.id ? (
                    /* Editing Mode */
                    <div className="space-y-2">
                      <label htmlFor={`history-note-${event.id}`} className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--text-primary)' }}>
                        <NotebookPen className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                        <span>{t('history.personalNotes')}</span>
                      </label>
                      <textarea
                        id={`history-note-${event.id}`}
                        value={notesText}
                        onChange={(e) => setNotesText(e.target.value)}
                        placeholder={t('history.notesPlaceholder')}
                        maxLength={1000}
                        rows={3}
                        className="input-luxury w-full text-sm resize-none"
                      />
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                          {notesText.length}/1000
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleCancelNotes()}
                            className="px-4 text-sm font-medium rounded-full transition-colors min-h-[44px]"
                            style={{ 
                              color: 'var(--text-secondary)', 
                              background: 'var(--bg-muted)' 
                            }}
                          >
                            {t('common.cancel')}
                          </button>
                          <button
                            onClick={() => handleSaveNotes(event.id)}
                            disabled={notesSaving === event.id}
                            className="px-4 text-sm font-medium rounded-full transition-opacity min-h-[44px] flex items-center gap-1 disabled:opacity-60"
                            style={{ background: 'var(--sommi-gradient-primary)', color: 'var(--text-inverse)' }}
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
                          <div className="text-xs font-medium mb-1 flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                            <NotebookPen className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                            <span>{t('history.personalNotes')}:</span>
                          </div>
                          <p className="text-sm mb-2 ps-5 whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }} dir="auto">
                            {event.notes}
                          </p>
                          <button
                            onClick={() => handleEditNotes(event.id, event.notes)}
                            className="app-link text-xs inline-flex items-center min-h-[44px]"
                          >
                            {t('common.edit')}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleEditNotes(event.id, null)}
                          className="app-link text-xs flex items-center gap-1.5 min-h-[44px]"
                        >
                          <NotebookPen className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                          <span>{t('history.addNote')}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Rating Section */}
                <div
                  className="flex items-center justify-between gap-2 pt-2 border-t"
                  style={{ borderColor: 'var(--border-subtle)' }}
                  onClick={e => e.stopPropagation()}
                >
                  {Number(event.user_rating) > 0 ? (
                    <>
                      <StarDisplay rating={Number(event.user_rating)} />
                      <button
                        onClick={() => openRateSheet(event)}
                        className="app-link text-xs inline-flex items-center min-h-[44px] px-2 -me-2"
                      >
                        {t('history.editRating', 'Edit rating')}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => openRateSheet(event)}
                      className="flex items-center gap-1.5 px-4 min-h-[44px] rounded-full text-sm font-medium transition-colors hover:bg-[var(--wine-100)]"
                      style={{
                        background: 'var(--wine-50)',
                        color: 'var(--accent-text)',
                        border: '1px solid var(--wine-200)',
                      }}
                    >
                      <Star className="h-4 w-4" strokeWidth={1.75} style={{ color: 'var(--rating-star)' }} aria-hidden />
                      <span>{t('history.rateWine', 'Rate this wine')}</span>
                    </button>
                  )}
                </div>


                {/* Send back to cellar button */}
                <div 
                  className="mt-3 pt-3 border-t"
                  style={{ borderColor: 'var(--border-subtle)' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => handleUndoClick(event)}
                    disabled={undoingId === event.id}
                    className="w-full sm:w-auto px-4 py-2 text-sm font-medium rounded-full transition-all min-h-[44px] flex items-center justify-center gap-2"
                    style={{
                      backgroundColor: undoingId === event.id ? 'var(--bg-muted)' : 'var(--bg-secondary)',
                      border: '1px solid var(--border-medium)',
                      color: undoingId === event.id ? 'var(--text-tertiary)' : 'var(--accent-text)',
                      cursor: undoingId === event.id ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {undoingId === event.id ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>{t('history.moving')}</span>
                      </>
                    ) : (
                      <>
                        <Undo2 className="w-4 h-4 rtl:-scale-x-100" strokeWidth={1.75} aria-hidden />
                        <span>{t('history.sendBackToCellar')}</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Click Indicator */}
                <div className="absolute end-3 top-6 opacity-40 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-tertiary)' }} aria-hidden>
                  <ChevronRight className="w-5 h-5 rtl:-scale-x-100" strokeWidth={1.75} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      )}

      {/* Rate Ritual Sheet — same rich experience as after opening a bottle */}
      {ratingTarget && (() => {
        const { chipIds, notes: noteText } = parseTastingNotes(ratingTarget.tasting_notes);
        return (
          <RateRitualSheet
            isOpen={!!ratingTarget}
            onClose={() => setRatingTarget(null)}
            onRated={loadData}
            historyId={ratingTarget.id}
            wineName={ratingTarget.bottle?.wine?.wine_name ?? ''}
            producer={ratingTarget.bottle?.wine?.producer ?? ''}
            initialRating={ratingTarget.user_rating ?? undefined}
            initialNotes={noteText || undefined}
            initialChipIds={chipIds}
          />
        );
      })()}

      {/* Wine Details Modal */}
      <WineDetailsModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        bottle={selectedBottle}
        onRefresh={loadData}
      />

      {/* Undo Confirmation Modal */}
      <AnimatePresence>
        {showUndoConfirm && undoEventData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[var(--bg-overlay)] backdrop-blur-sm flex items-center justify-center p-4 z-[110]"
            role="dialog"
            aria-modal="true"
            onClick={() => setShowUndoConfirm(false)}
            style={{ backdropFilter: 'blur(4px)' }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'tween', duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="rounded-[1.5rem] w-full max-w-md overflow-hidden"
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-soft)',
                boxShadow: 'var(--shadow-modal)',
              }}
            >
              {/* Header */}
              <div 
                className="px-6 py-5 border-b"
                style={{ borderColor: 'var(--border-soft)' }}
              >
                <h3 className="app-section-title">
                  {t('common.dialogConfirmTitle')}
                </h3>
              </div>

              {/* Content */}
              <div className="px-6 py-6">
                <p 
                  className="text-base mb-3"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {t('history.undoConfirm')}
                </p>
                <p 
                  className="text-sm font-medium"
                  style={{ color: 'var(--text-primary)' }}
                >
                  "{undoEventData.wineName}"
                </p>
              </div>

              {/* Footer */}
              <div 
                className="px-6 py-4 border-t flex gap-3 justify-end"
                style={{ 
                  borderColor: 'var(--border-soft)',
                  backgroundColor: 'var(--bg-secondary)',
                }}
              >
                <button
                  onClick={() => setShowUndoConfirm(false)}
                  className="px-5 py-2.5 rounded-full font-medium transition-colors min-h-[44px]"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-medium)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={confirmUndo}
                  className="px-5 py-2.5 rounded-full font-medium transition-all min-h-[44px]"
                  style={{
                    background: 'var(--sommi-gradient-primary)',
                    color: 'white',
                  }}
                >
                  {t('history.moveBack')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

