/**
 * Evening Queue Player - Spotify-like Wine Queue Experience
 * 
 * Premium "Now Playing" interface for evening plans:
 * - Hero "Now Pouring" card with current wine
 * - Queue list showing upcoming wines
 * - Playback controls (prev/next/jump)
 * - Progress tracking
 * - Completion flow
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { toast } from '../lib/toast';
import type { QueuedWine, EveningPlan } from '../services/eveningPlanService';
import * as eveningPlanService from '../services/eveningPlanService';
import * as historyService from '../services/historyService';

interface EveningQueuePlayerProps {
  isOpen: boolean;
  onClose: () => void;
  plan: EveningPlan;
  onPlanUpdated: (plan: EveningPlan) => void;
  onComplete: () => void;
}

export function EveningQueuePlayer({
  isOpen,
  onClose,
  plan,
  onPlanUpdated,
  onComplete,
}: EveningQueuePlayerProps) {
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(plan.now_playing_index);
  const [queue, setQueue] = useState<QueuedWine[]>(plan.queue);
  const [showWrapUp, setShowWrapUp] = useState(false);
  
  const currentWine = queue[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === queue.length - 1;

  // Sync with plan changes
  useEffect(() => {
    setCurrentIndex(plan.now_playing_index);
    setQueue(plan.queue);
  }, [plan]);

  // Handle navigation
  const handleNext = async () => {
    if (isLast) return;
    
    const newIndex = currentIndex + 1;
    setCurrentIndex(newIndex);
    
    try {
      await eveningPlanService.updateProgress(plan.id, newIndex);
      onPlanUpdated({ ...plan, now_playing_index: newIndex });
    } catch (error) {
      console.error('[QueuePlayer] Error updating progress:', error);
    }
  };

  const handlePrevious = async () => {
    if (isFirst) return;
    
    const newIndex = currentIndex - 1;
    setCurrentIndex(newIndex);
    
    try {
      await eveningPlanService.updateProgress(plan.id, newIndex);
      onPlanUpdated({ ...plan, now_playing_index: newIndex });
    } catch (error) {
      console.error('[QueuePlayer] Error updating progress:', error);
    }
  };

  const handleJumpTo = async (index: number) => {
    if (index === currentIndex) return;
    
    setCurrentIndex(index);
    
    try {
      await eveningPlanService.updateProgress(plan.id, index);
      onPlanUpdated({ ...plan, now_playing_index: index });
    } catch (error) {
      console.error('[QueuePlayer] Error jumping:', error);
    }
  };

  const handleWrapUp = () => {
    setShowWrapUp(true);
  };

  if (!isOpen) return null;

  if (showWrapUp) {
    return (
      <WrapUpModal
        isOpen={true}
        onClose={() => setShowWrapUp(false)}
        plan={plan}
        queue={queue}
        onComplete={onComplete}
      />
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        style={{
          background: 'var(--bg-overlay)',
          backdropFilter: 'var(--blur-medium)',
          WebkitBackdropFilter: 'var(--blur-medium)',
        }}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-xl)',
            maxHeight: '90vh',
          }}
        >
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                  🎯 Your Evening
                </h2>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                  {currentIndex + 1} of {queue.length} • {plan.occasion || 'Evening'}
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                style={{ background: 'var(--bg-surface-elevated)', color: 'var(--text-tertiary)' }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Now Pouring Hero */}
            <div className="px-6 py-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentIndex}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="text-center mb-6">
                    <div
                      className="inline-block px-3 py-1.5 rounded-full text-xs font-medium mb-4"
                      style={{ background: 'var(--wine-100)', color: 'var(--wine-700)' }}
                    >
                      🍷 Now Pouring
                    </div>
                    
                    {/* Wine Image */}
                    {currentWine.image_url ? (
                      <div className="w-48 h-48 mx-auto mb-6 rounded-2xl overflow-hidden" style={{ boxShadow: 'var(--shadow-lg)' }}>
                        <img
                          src={currentWine.image_url}
                          alt={currentWine.wine_name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div
                        className="w-48 h-48 mx-auto mb-6 rounded-2xl flex items-center justify-center"
                        style={{
                          background: 'linear-gradient(135deg, var(--wine-100), var(--wine-200))',
                          border: '1px solid var(--border-medium)',
                        }}
                      >
                        <svg className="w-20 h-20" fill="none" viewBox="0 0 24 24" style={{ color: 'var(--wine-600)' }}>
                          <path fill="currentColor" d="M6 2h12v2H6V2zm0 18c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V6H6v14zM8 8h8v12H8V8z"/>
                        </svg>
                      </div>
                    )}

                    {/* Wine Info */}
                    <h3 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                      {currentWine.wine_name}
                    </h3>
                    <p className="text-lg mb-2" style={{ color: 'var(--text-secondary)' }}>
                      {currentWine.producer}
                    </p>
                    {currentWine.vintage && (
                      <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                        {currentWine.vintage}
                      </p>
                    )}
                    
                    {/* Rating */}
                    {currentWine.rating && (
                      <div className="mt-3 flex items-center justify-center gap-1">
                        <span className="text-yellow-500">⭐</span>
                        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                          {currentWine.rating.toFixed(1)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Serving Notes */}
                  <div
                    className="p-4 rounded-xl"
                    style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-medium)' }}
                  >
                    <h4 className="font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                      Serving notes:
                    </h4>
                    <ul className="space-y-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <li>• Open now and let breathe for 10-15 minutes</li>
                      <li>• Serve at room temperature (16-18°C)</li>
                      {currentWine.color === 'red' && <li>• Consider decanting for 30 minutes</li>}
                    </ul>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Queue List */}
            <div className="px-6 pb-6">
              <h4 className="font-medium mb-3 text-sm uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                Queue
              </h4>
              <div className="space-y-2">
                {queue.map((wine, idx) => (
                  <motion.button
                    key={idx}
                    onClick={() => handleJumpTo(idx)}
                    className="w-full p-3 rounded-xl flex gap-3 items-center text-left transition-all"
                    style={{
                      background: idx === currentIndex
                        ? 'linear-gradient(135deg, rgba(164, 77, 90, 0.15), rgba(164, 77, 90, 0.08))'
                        : 'var(--bg-surface-elevated)',
                      border: idx === currentIndex
                        ? '1px solid var(--wine-300)'
                        : '1px solid var(--border-subtle)',
                      opacity: idx < currentIndex ? 0.5 : 1,
                    }}
                    whileHover={{ scale: idx === currentIndex ? 1 : 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {/* Wine Thumbnail */}
                    {wine.image_url ? (
                      <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0" style={{ border: '1px solid var(--border-medium)' }}>
                        <img
                          src={wine.image_url}
                          alt={wine.wine_name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div
                        className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{
                          background: 'linear-gradient(135deg, var(--wine-100), var(--wine-200))',
                          border: '1px solid var(--border-medium)',
                        }}
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" style={{ color: 'var(--wine-500)' }}>
                          <path fill="currentColor" d="M6 2h12v2H6V2zm0 18c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V6H6v14zM8 8h8v12H8V8z"/>
                        </svg>
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <h5 className="font-semibold truncate text-sm" style={{ color: 'var(--text-primary)' }}>
                        {wine.wine_name}
                      </h5>
                      <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                        {wine.producer}
                      </p>
                    </div>
                    {idx === currentIndex && (
                      <div className="flex-shrink-0">
                        <svg className="w-5 h-5 animate-pulse-subtle" fill="none" viewBox="0 0 24 24" style={{ color: 'var(--wine-600)' }}>
                          <path fill="currentColor" d="M8 5v14l11-7z"/>
                        </svg>
                      </div>
                    )}
                  </motion.button>
                ))}
              </div>
            </div>
          </div>

          {/* Controls Footer */}
          <div className="px-6 pb-6 border-t pt-4 flex-shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
            {/* Progress Bar */}
            <div className="mb-4">
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface-elevated)' }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${((currentIndex + 1) / queue.length) * 100}%`,
                    background: 'linear-gradient(90deg, var(--wine-500), var(--wine-600))',
                  }}
                />
              </div>
            </div>

            {/* Control Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handlePrevious}
                disabled={isFirst}
                className="px-4 py-3 rounded-xl font-medium transition-all flex-shrink-0"
                style={{
                  background: isFirst ? 'var(--bg-surface-elevated)' : 'var(--bg-surface-elevated)',
                  color: isFirst ? 'var(--text-muted)' : 'var(--text-primary)',
                  border: '1px solid var(--border-medium)',
                  cursor: isFirst ? 'not-allowed' : 'pointer',
                  opacity: isFirst ? 0.5 : 1,
                }}
              >
                ← Previous
              </button>
              
              {!isLast && (
                <button
                  onClick={handleNext}
                  className="btn-luxury-primary flex-1"
                >
                  Next wine →
                </button>
              )}
              
              {isLast && (
                <button
                  onClick={handleWrapUp}
                  className="btn-luxury-primary flex-1"
                  style={{
                    background: 'linear-gradient(135deg, var(--wine-600), var(--wine-700))',
                  }}
                >
                  Wrap up evening 🎉
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Wrap Up Modal Component (imported separately to keep file size manageable)
function WrapUpModal({ isOpen, onClose, plan, queue, onComplete }: any) {
  const [wineStates, setWineStates] = useState<Record<number, {
    opened: boolean;
    quantity: number;
    rating: number | null;
    notes: string;
  }>>({});

  const handleToggleOpened = (index: number) => {
    setWineStates(prev => ({
      ...prev,
      [index]: {
        opened: !(prev[index]?.opened || false),
        quantity: prev[index]?.quantity || 1,
        rating: prev[index]?.rating || null,
        notes: prev[index]?.notes || '',
      },
    }));
  };

  const handleSaveToHistory = async () => {
    console.log('[WrapUp] Saving to history...', wineStates);
    
    try {
      // For each opened wine, create history entry and update cellar
      for (const [idx, state] of Object.entries(wineStates)) {
        if (!state.opened) continue;
        
        const wine = queue[parseInt(idx)];
        
        // Call existing history service to mark bottle opened
        await historyService.markBottleOpened({
          bottle_id: wine.bottle_id,
          opened_count: state.quantity,
          tasting_notes: state.notes || undefined,
          user_rating: state.rating || undefined,
        });
        
        console.log('[WrapUp] ✅ Recorded:', wine.wine_name, state.quantity, 'bottles');
      }
      
      // Calculate completion stats
      const openedCount = Object.values(wineStates).filter(s => s.opened).length;
      const ratings = Object.values(wineStates)
        .filter(s => s.opened && s.rating)
        .map(s => s.rating!);
      const avgRating = ratings.length > 0 
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length 
        : null;
      
      // Update queue with completion data
      const updatedQueue = queue.map((wine: QueuedWine, idx: number) => ({
        ...wine,
        opened: wineStates[idx]?.opened || false,
        opened_quantity: wineStates[idx]?.quantity || 0,
        user_rating: wineStates[idx]?.rating || null,
        notes: wineStates[idx]?.notes || undefined,
      }));
      
      // Complete the plan
      await eveningPlanService.completePlan(plan.id, {
        queue: updatedQueue,
        total_bottles_opened: openedCount,
        average_rating: avgRating,
      });
      
      toast.success(`🎉 Saved! ${openedCount} ${openedCount === 1 ? 'wine' : 'wines'} added to history.`);
      onComplete();
    } catch (error) {
      console.error('[WrapUp] Error saving to history:', error);
      toast.error('Failed to save to history. Please try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] flex items-center justify-center p-4"
      style={{
        background: 'var(--bg-overlay)',
        backdropFilter: 'var(--blur-medium)',
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl rounded-2xl overflow-hidden"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
            🎉 Wrap up the evening
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Mark which wines you opened and rate them
          </p>
        </div>

        {/* Wines List (scrollable) */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {queue.map((wine: QueuedWine, idx: number) => {
            const state = wineStates[idx] || { opened: false, quantity: 1, rating: null, notes: '' };
            
            return (
              <div
                key={idx}
                className="p-4 rounded-xl"
                style={{
                  background: state.opened ? 'var(--wine-50)' : 'var(--bg-surface-elevated)',
                  border: state.opened ? '1px solid var(--wine-200)' : '1px solid var(--border-medium)',
                }}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={state.opened}
                    onChange={() => handleToggleOpened(idx)}
                    className="mt-1 w-5 h-5 rounded"
                    style={{ accentColor: 'var(--wine-600)' }}
                  />
                  
                  {/* Wine Thumbnail */}
                  {wine.image_url ? (
                    <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0" style={{ border: '1px solid var(--border-medium)' }}>
                      <img
                        src={wine.image_url}
                        alt={wine.wine_name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div
                      className="w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{
                        background: 'linear-gradient(135deg, var(--wine-100), var(--wine-200))',
                        border: '1px solid var(--border-medium)',
                      }}
                    >
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" style={{ color: 'var(--wine-500)' }}>
                        <path fill="currentColor" d="M6 2h12v2H6V2zm0 18c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V6H6v14zM8 8h8v12H8V8z"/>
                      </svg>
                    </div>
                  )}
                  
                  <div className="flex-1">
                    <h4 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {wine.wine_name}
                    </h4>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {wine.producer}
                    </p>
                    
                    {state.opened && (
                      <div className="mt-3 space-y-3">
                        {/* Quantity */}
                        <div>
                          <label className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
                            Bottles opened
                          </label>
                          <div className="flex items-center gap-2 mt-1">
                            <button
                              onClick={() => setWineStates(prev => ({
                                ...prev,
                                [idx]: { ...state, quantity: Math.max(1, state.quantity - 1) },
                              }))}
                              className="w-8 h-8 rounded-lg flex items-center justify-center"
                              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-medium)' }}
                            >
                              −
                            </button>
                            <span className="w-12 text-center font-medium" style={{ color: 'var(--text-primary)' }}>
                              {state.quantity}
                            </span>
                            <button
                              onClick={() => setWineStates(prev => ({
                                ...prev,
                                [idx]: { ...state, quantity: state.quantity + 1 },
                              }))}
                              className="w-8 h-8 rounded-lg flex items-center justify-center"
                              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-medium)' }}
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {/* Rating */}
                        <div>
                          <label className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
                            Your rating (optional)
                          </label>
                          <div className="flex gap-1 mt-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                onClick={() => setWineStates(prev => ({
                                  ...prev,
                                  [idx]: { ...state, rating: star },
                                }))}
                                className="text-2xl transition-transform hover:scale-110"
                              >
                                {state.rating && star <= state.rating ? '⭐' : '☆'}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-4 border-t space-y-3" style={{ borderColor: 'var(--border-subtle)' }}>
          <button
            onClick={handleSaveToHistory}
            className="btn-luxury-primary w-full"
          >
            Save to history
          </button>
          <button
            onClick={onClose}
            className="btn-luxury-secondary w-full"
          >
            Not now
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
