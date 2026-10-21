/**
 * Wine World Moments Banner
 * 
 * Subtle, luxury banner for wine/grape celebration days
 * Shows on cellar page when relevant events are active
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export interface WineEvent {
  id: string;
  name: string;
  date: string;
  type: 'grape' | 'wine' | 'occasion';
  description: string;
  sourceName: string | null;
  sourceUrl: string | null;
  matchCount: number;
  filterTag: string | null;
}

interface WineEventBannerProps {
  events: WineEvent[];
  onDismiss: (eventId: string) => void;
  onViewMatches?: (filterTag: string) => void;
}

export function WineEventBanner({ events, onDismiss, onViewMatches }: WineEventBannerProps) {
  const { t, i18n } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const navigate = useNavigate();

  // Current event being displayed
  const event = events[currentIndex];

  // Debug: Log events
  useEffect(() => {
    if (events.length > 0) {
      console.log('[WineEventBanner] 🍷 Rendering', events.length, 'events');
      console.log('[WineEventBanner] Current event:', {
        index: currentIndex,
        name: event.name,
        matchCount: event.matchCount,
        filterTag: event.filterTag,
      });
    }
  }, [events, currentIndex]);

  useEffect(() => {
    if (events.length > 0) {
      // Delay appearance for smooth fade-in
      const timer = setTimeout(() => setIsVisible(true), 300);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [events]);

  // Auto-rotate through events every 10 seconds if there are multiple
  useEffect(() => {
    if (events.length <= 1) return;

    const intervalId = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % events.length);
    }, 10000); // 10 seconds

    return () => clearInterval(intervalId);
  }, [events.length]);

  if (events.length === 0 || !event) return null;

  const handleDismiss = () => {
    setIsVisible(false);
    // Wait for animation to complete before calling onDismiss
    setTimeout(() => onDismiss(event.id), 300);
  };

  const handleViewMatches = () => {
    if (event.filterTag && onViewMatches) {
      onViewMatches(event.filterTag);
    }
  };

  const handleLearnMore = () => {
    if (event.sourceUrl) {
      window.open(event.sourceUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handlePrevious = () => {
    setCurrentIndex(prev => (prev - 1 + events.length) % events.length);
  };

  const handleNext = () => {
    setCurrentIndex(prev => (prev + 1) % events.length);
  };

  // Format date with context (Today, Tomorrow, or full date)
  const formatDateWithContext = (dateStr: string) => {
    const eventDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    eventDate.setHours(0, 0, 0, 0);
    
    const diffDays = Math.round((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    const formattedDate = eventDate.toLocaleDateString(i18n.language, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
    
    // Get context label (translated)
    let contextLabel = '';
    if (diffDays === 0) {
      contextLabel = t('wineEvents.today');
    } else if (diffDays === 1) {
      contextLabel = t('wineEvents.tomorrow');
    } else if (diffDays === -1) {
      contextLabel = t('wineEvents.yesterday');
    } else if (diffDays > 0) {
      contextLabel = t('wineEvents.upcoming');
    } else if (diffDays < 0 && diffDays >= -7) {
      contextLabel = t('wineEvents.thisWeekPassed');
    }
    
    return contextLabel ? `${formattedDate} • ${contextLabel}` : formattedDate;
  };

  // Icon based on event type
  const getEventIcon = () => {
    switch (event.type) {
      case 'grape':
        return '🍇';
      case 'wine':
        return '🍷';
      case 'occasion':
        return '🎉';
      default:
        return '🍷';
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="relative w-full px-4 py-3 mb-4"
          style={{
            background: 'var(--wine-50)',
            borderRadius: '16px',
            border: '1px solid var(--wine-200)',
            backdropFilter: 'blur(10px)',
          }}
        >
          {/* Navigation arrows (if multiple events) */}
          {events.length > 1 && (
            <>
              <button
                onClick={handlePrevious}
                className="absolute top-1/2 -translate-y-1/2 p-2 hover:bg-white/10 rounded-full transition-colors"
                aria-label={t('common.previous')}
                style={{
                  [i18n.dir() === 'rtl' ? 'right' : 'left']: '8px',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M12 16L6 10L12 4"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.6"
                  />
                </svg>
              </button>
              <button
                onClick={handleNext}
                className="absolute top-1/2 -translate-y-1/2 p-2 hover:bg-white/10 rounded-full transition-colors"
                aria-label={t('common.next')}
                style={{
                  [i18n.dir() === 'rtl' ? 'left' : 'right']: '48px',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M8 16L14 10L8 4"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.6"
                  />
                </svg>
              </button>
            </>
          )}

          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute top-2 p-1 hover:bg-white/10 rounded-full transition-colors"
            aria-label={t('common.dismiss')}
            style={{
              [i18n.dir() === 'rtl' ? 'left' : 'right']: '8px',
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 4L4 12M4 4L12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.6"
              />
            </svg>
          </button>

          {/* Content */}
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="text-2xl flex-shrink-0 mt-0.5">
              {getEventIcon()}
            </div>

            {/* Text content */}
            <div className="flex-1 min-w-0 pe-6">
              {/* "This week is..." header */}
              <p 
                className="text-xs font-medium mb-1 uppercase tracking-wide opacity-70"
                style={{ color: 'var(--accent-text)' }}
              >
                {t('wineEvents.thisWeek', 'This week')}
              </p>
              
              <h3 
                className="text-lg font-bold mb-1"
                style={{ 
                  color: 'var(--accent-text)',
                  lineHeight: '1.3',
                }}
              >
                {event.name}
              </h3>
              
              {/* Date with context (Today, Tomorrow, etc.) */}
              <p 
                className="text-sm mb-1 font-medium"
                style={{ 
                  color: 'var(--accent-text)',
                  lineHeight: '1.5',
                }}
              >
                📅 {formatDateWithContext(event.date)}
              </p>
              
              <p 
                className="text-sm mb-2 opacity-80"
                style={{ 
                  color: 'var(--accent-text)',
                  lineHeight: '1.5',
                }}
              >
                {event.description}
              </p>

              {/* Matching bottles indicator */}
              {event.matchCount > 0 && event.filterTag && (
                <div 
                  className="text-sm font-medium mb-2"
                  style={{ color: 'var(--accent-text)' }}
                >
                  {t('wineEvents.youHaveMatches', { count: event.matchCount })}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 mt-3">
                {event.matchCount > 0 && event.filterTag ? (
                  <button
                    onClick={handleViewMatches}
                    className="px-4 py-2 rounded-full text-sm font-medium transition-all"
                    style={{
                      background: 'var(--sommi-gradient-primary)',
                      color: 'white',
                      boxShadow: 'var(--shadow-cta)',
                    }}
                  >
                    {t('wineEvents.viewMatches')}
                  </button>
                ) : event.sourceUrl ? (
                  <button
                    onClick={handleLearnMore}
                    className="px-4 py-2 rounded-full text-sm font-medium transition-all"
                    style={{
                      background: 'var(--sommi-gradient-primary)',
                      color: 'white',
                      boxShadow: 'var(--shadow-cta)',
                    }}
                  >
                    {t('wineEvents.learnMore')}
                  </button>
                ) : null}
              </div>

              {/* Event counter (if multiple events) */}
              {events.length > 1 && (
                <div className="flex items-center justify-center gap-1.5 mt-3">
                  {events.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentIndex(index)}
                      className="w-2 h-2 rounded-full transition-all"
                      style={{
                        backgroundColor: index === currentIndex 
                          ? 'var(--accent-text)' 
                          : 'var(--border-medium)',
                        transform: index === currentIndex ? 'scale(1.2)' : 'scale(1)',
                      }}
                      aria-label={t('wineEvents.goToEvent', { index: index + 1 })}
                    />
                  ))}
                  <span 
                    className="text-xs ms-2 opacity-60"
                    style={{ color: 'var(--accent-text)' }}
                  >
                    {currentIndex + 1} / {events.length}
                  </span>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
