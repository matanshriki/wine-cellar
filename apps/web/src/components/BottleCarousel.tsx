/**
 * Luxury Bottle Carousel Component
 * 
 * Displays multiple wine bottle recommendations in a premium carousel UI
 * - Horizontal swipe on mobile
 * - Arrow controls on desktop
 * - Snap scrolling
 * - RTL/LTR support
 */

import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import * as labelArtService from '../services/labelArtService';

export interface BottleRecommendation {
  bottleId: string;
  name: string;
  producer: string;
  vintage?: number | null;
  region?: string | null;
  rating?: number | null;
  readinessStatus?: string | null;
  serveTempC?: number | null;
  decantMinutes?: number | null;
  shortWhy: string;
  imageUrl?: string | null;
}

interface BottleCarouselProps {
  title?: string;
  bottles: BottleRecommendation[];
  onBottleClick?: (bottleId: string) => void;
  onMarkOpened?: (bottleId: string) => void;
}

export function BottleCarousel({
  title,
  bottles,
  onBottleClick,
  onMarkOpened,
}: BottleCarouselProps) {
  const { t, i18n } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isRTL = i18n.language === 'he';

  // Handle arrow navigation
  const goToNext = () => {
    if (currentIndex < bottles.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      scrollToIndex(nextIndex);
    }
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      setCurrentIndex(prevIndex);
      scrollToIndex(prevIndex);
    }
  };

  const scrollToIndex = (index: number) => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const cardWidth = container.scrollWidth / bottles.length;
      const scrollPosition = cardWidth * index;
      
      container.scrollTo({
        left: isRTL ? -(scrollPosition) : scrollPosition,
        behavior: 'smooth',
      });
    }
  };

  // Update current index based on scroll position
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollLeft = Math.abs(container.scrollLeft);
      const cardWidth = container.scrollWidth / bottles.length;
      const index = Math.round(scrollLeft / cardWidth);
      setCurrentIndex(index);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [bottles.length]);

  // Get readiness badge style
  const getReadinessBadge = (status: string | null | undefined) => {
    if (!status) return null;

    const badges = {
      ready: { text: t('cellar.readiness.ready'), tone: 'ready' },
      peak: { text: t('cellar.readiness.peak'), tone: 'ready' },
      aging: { text: t('cellar.readiness.aging'), tone: 'hold' },
      drink_soon: { text: t('cellar.readiness.drinkSoon'), tone: 'drink-soon' },
    };

    const badge = badges[status as keyof typeof badges];
    if (!badge) return null;

    return (
      <span
        style={{
          display: 'inline-block',
          padding: '4px 12px',
          borderRadius: '12px',
          fontSize: '11px',
          fontWeight: 600,
          backgroundColor: `var(--status-${badge.tone}-bg)`,
          color: `var(--status-${badge.tone}-text)`,
        }}
      >
        {badge.text}
      </span>
    );
  };

  if (bottles.length === 0) return null;

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '800px',
        margin: '0 auto',
      }}
    >
      {/* Title */}
      {title && (
        <h3
          style={{
            fontSize: '16px',
            fontWeight: 600,
            color: 'var(--text-heading)',
            marginBottom: '16px',
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {title}
        </h3>
      )}

      {/* Carousel Container */}
      <div style={{ position: 'relative' }}>
        {/* Desktop Arrow - Previous */}
        {bottles.length > 1 && (
          <button
            aria-label={t('common.previous')}
            onClick={goToPrevious}
            disabled={currentIndex === 0}
            style={{
              position: 'absolute',
              left: isRTL ? 'auto' : '-12px',
              right: isRTL ? '-12px' : 'auto',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
              opacity: currentIndex === 0 ? 0.3 : 1,
              zIndex: 10,
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              transition: 'all 0.2s',
            }}
            className="hidden sm:flex"
          >
            <svg
              style={{
                width: '20px',
                height: '20px',
                transform: isRTL ? 'rotate(180deg)' : 'none',
              }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
        )}

        {/* Scrollable Container */}
        <div
          ref={scrollContainerRef}
          style={{
            display: 'flex',
            gap: '16px',
            overflowX: 'auto',
            scrollSnapType: 'x mandatory',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            padding: '4px',
          }}
          className="hide-scrollbar"
        >
          {bottles.map((bottle, index) => (
            <motion.div
              key={bottle.bottleId}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              style={{
                flex: '0 0 280px',
                scrollSnapAlign: 'start',
              }}
            >
              <div
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderRadius: '16px',
                  border: '1px solid var(--border-subtle)',
                  padding: '16px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  transition: 'all 0.3s',
                  cursor: 'pointer',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                }}
                onClick={() => onBottleClick?.(bottle.bottleId)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                }}
              >
                {/* Wine Image */}
                {bottle.imageUrl && (
                  <div
                    style={{
                      width: '100%',
                      height: '120px',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      marginBottom: '12px',
                      backgroundColor: 'var(--bg-muted)',
                    }}
                  >
                    <img
                      src={bottle.imageUrl}
                      alt={`${bottle.producer} ${bottle.name}`}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                      }}
                    />
                  </div>
                )}

                {/* Wine Info */}
                <div style={{ flex: 1, marginBottom: '12px' }}>
                  <h4
                    style={{
                      fontSize: '16px',
                      fontWeight: 700,
                      color: 'var(--text-heading)',
                      marginBottom: '4px',
                      lineHeight: '1.3',
                    }}
                  >
                    {bottle.producer}
                  </h4>
                  <p
                    style={{
                      fontSize: '14px',
                      color: 'var(--text-secondary)',
                      marginBottom: '8px',
                      lineHeight: '1.4',
                    }}
                  >
                    {bottle.name}
                    {bottle.vintage && (
                      <>
                        {' '}
                        <span style={{ fontWeight: 600 }}>
                          {bottle.vintage}
                        </span>
                      </>
                    )}
                  </p>

                  {/* Region */}
                  {bottle.region && (
                    <p
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-tertiary)',
                        marginBottom: '8px',
                      }}
                    >
                      📍 {bottle.region}
                    </p>
                  )}

                  {/* Readiness Badge */}
                  {bottle.readinessStatus && (
                    <div style={{ marginBottom: '8px' }}>
                      {getReadinessBadge(bottle.readinessStatus)}
                    </div>
                  )}

                  {/* Why This Bottle */}
                  <p
                    style={{
                      fontSize: '13px',
                      color: 'var(--text-primary)',
                      lineHeight: '1.5',
                      marginTop: '8px',
                      fontStyle: 'italic',
                    }}
                  >
                    "{bottle.shortWhy}"
                  </p>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onBottleClick?.(bottle.bottleId);
                    }}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid #7c3030',
                      backgroundColor: 'var(--bg-surface)',
                      color: 'var(--accent-text)',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {t('common.viewDetails', 'View Details')}
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Desktop Arrow - Next */}
        {bottles.length > 1 && (
          <button
            aria-label={t('common.next')}
            onClick={goToNext}
            disabled={currentIndex === bottles.length - 1}
            style={{
              position: 'absolute',
              right: isRTL ? 'auto' : '-12px',
              left: isRTL ? '-12px' : 'auto',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: currentIndex === bottles.length - 1 ? 'not-allowed' : 'pointer',
              opacity: currentIndex === bottles.length - 1 ? 0.3 : 1,
              zIndex: 10,
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              transition: 'all 0.2s',
            }}
            className="hidden sm:flex"
          >
            <svg
              style={{
                width: '20px',
                height: '20px',
                transform: isRTL ? 'rotate(180deg)' : 'none',
              }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Dot Indicators */}
      {bottles.length > 1 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '8px',
            marginTop: '16px',
          }}
        >
          {bottles.map((_, index) => (
            <button
              key={index}
              type="button"
              className="app-hit-target"
              onClick={() => {
                setCurrentIndex(index);
                scrollToIndex(index);
              }}
              aria-label={`Go to bottle ${index + 1}`}
              aria-current={currentIndex === index ? 'true' : undefined}
            >
              <span
                aria-hidden
                style={{
                  display: 'block',
                  width: currentIndex === index ? '24px' : '8px',
                  height: '8px',
                  borderRadius: '4px',
                  backgroundColor: currentIndex === index ? 'var(--wine-600)' : 'var(--border-medium)',
                  transition: 'all 0.3s',
                }}
              />
            </button>
          ))}
        </div>
      )}

      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
