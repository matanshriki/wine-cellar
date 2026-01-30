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
  event: WineEvent | null;
  onDismiss: (eventId: string) => void;
  onViewMatches?: (filterTag: string) => void;
}

export function WineEventBanner({ event, onDismiss, onViewMatches }: WineEventBannerProps) {
  const { t, i18n } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const navigate = useNavigate();

  // Debug: Log event details
  useEffect(() => {
    if (event) {
      console.log('[WineEventBanner] 🍷 Rendering event:', {
        name: event.name,
        matchCount: event.matchCount,
        filterTag: event.filterTag,
        hasButton: event.matchCount > 0 && !!event.filterTag
      });
    }
  }, [event]);

  useEffect(() => {
    if (event) {
      // Delay appearance for smooth fade-in
      const timer = setTimeout(() => setIsVisible(true), 300);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [event]);

  if (!event) return null;

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
    
    if (diffDays === 0) {
      return `${formattedDate} • Today`;
    } else if (diffDays === 1) {
      return `${formattedDate} • Tomorrow`;
    } else if (diffDays === -1) {
      return `${formattedDate} • Yesterday`;
    } else if (diffDays > 0) {
      return `${formattedDate} • Upcoming`;
    } else if (diffDays < 0 && diffDays >= -7) {
      return `${formattedDate} • This week`;
    }
    
    return formattedDate;
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
            background: 'linear-gradient(135deg, rgba(101, 48, 69, 0.08) 0%, rgba(139, 69, 91, 0.05) 100%)',
            borderRadius: '16px',
            border: '1px solid rgba(139, 69, 91, 0.15)',
            backdropFilter: 'blur(10px)',
          }}
        >
          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 p-1 hover:bg-white/10 rounded-full transition-colors"
            aria-label="Dismiss"
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
            <div className="flex-1 min-w-0 pr-6">
              {/* "This week is..." header */}
              <p 
                className="text-xs font-medium mb-1 uppercase tracking-wide opacity-70"
                style={{ color: '#8b455b' }}
              >
                {t('wineEvents.thisWeek', 'This week')}
              </p>
              
              <h3 
                className="text-lg font-bold mb-1"
                style={{ 
                  color: '#653045',
                  lineHeight: '1.3',
                }}
              >
                {event.name}
              </h3>
              
              {/* Date with context (Today, Tomorrow, etc.) */}
              <p 
                className="text-sm mb-1 font-medium"
                style={{ 
                  color: '#8b455b',
                  lineHeight: '1.5',
                }}
              >
                📅 {formatDateWithContext(event.date)}
              </p>
              
              <p 
                className="text-sm mb-2 opacity-80"
                style={{ 
                  color: '#653045',
                  lineHeight: '1.5',
                }}
              >
                {event.description}
              </p>

              {/* Matching bottles indicator */}
              {event.matchCount > 0 && event.filterTag && (
                <div 
                  className="text-sm font-medium mb-2"
                  style={{ color: '#8b455b' }}
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
                      background: 'linear-gradient(135deg, #653045 0%, #8b455b 100%)',
                      color: 'white',
                      boxShadow: '0 2px 8px rgba(101, 48, 69, 0.2)',
                    }}
                  >
                    {t('wineEvents.viewMatches')}
                  </button>
                ) : event.sourceUrl ? (
                  <button
                    onClick={handleLearnMore}
                    className="px-4 py-2 rounded-full text-sm font-medium transition-all"
                    style={{
                      background: 'linear-gradient(135deg, #653045 0%, #8b455b 100%)',
                      color: 'white',
                      boxShadow: '0 2px 8px rgba(101, 48, 69, 0.2)',
                    }}
                  >
                    {t('wineEvents.learnMore')}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
