/**
 * Luxury Bottle Carousel Component
 * 
 * Premium carousel for multi-bottle agent responses
 * - Clean card design with strong hierarchy
 * - Smooth horizontal scrolling with snap points
 * - Minimal text density
 * - RTL/LTR support
 */

import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BottleCardMini } from './BottleCardMini';
import type { BottleRecommendation } from './BottleCarousel';

interface BottleCarouselLuxuryProps {
  bottles: BottleRecommendation[];
  onBottleClick?: (bottleId: string) => void;
}

export function BottleCarouselLuxury({ bottles, onBottleClick }: BottleCarouselLuxuryProps) {
  const { i18n } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isRTL = i18n.language === 'he';

  // Update current index based on scroll position
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollLeft = Math.abs(container.scrollLeft);
      const cardWidth = container.scrollWidth / bottles.length;
      const index = Math.round(scrollLeft / cardWidth);
      setCurrentIndex(Math.min(index, bottles.length - 1));
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [bottles.length]);

  // Scroll to specific index
  const scrollToIndex = (index: number) => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const cardWidth = container.scrollWidth / bottles.length;
      const scrollPosition = cardWidth * index;

      container.scrollTo({
        left: isRTL ? -scrollPosition : scrollPosition,
        behavior: 'smooth',
      });
    }
  };

  // Arrow navigation
  const goToNext = () => {
    if (currentIndex < bottles.length - 1) {
      scrollToIndex(currentIndex + 1);
    }
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      scrollToIndex(currentIndex - 1);
    }
  };

  if (bottles.length === 0) return null;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Desktop Navigation Arrows */}
      {bottles.length > 1 && (
        <>
          <button
            onClick={goToPrevious}
            disabled={currentIndex === 0}
            aria-label="Previous bottle"
            className="hidden md:flex"
            style={{
              position: 'absolute',
              left: isRTL ? 'auto' : '-16px',
              right: isRTL ? '-16px' : 'auto',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: 'white',
              border: '1px solid var(--border-light)',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
              opacity: currentIndex === 0 ? 0.4 : 1,
              zIndex: 10,
              boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (currentIndex > 0) {
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.1)';
            }}
          >
            <svg
              style={{
                width: '20px',
                height: '20px',
                color: 'var(--text-primary)',
                transform: isRTL ? 'rotate(180deg)' : 'none',
              }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            onClick={goToNext}
            disabled={currentIndex === bottles.length - 1}
            aria-label="Next bottle"
            className="hidden md:flex"
            style={{
              position: 'absolute',
              right: isRTL ? 'auto' : '-16px',
              left: isRTL ? '-16px' : 'auto',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: 'white',
              border: '1px solid var(--border-light)',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: currentIndex === bottles.length - 1 ? 'not-allowed' : 'pointer',
              opacity: currentIndex === bottles.length - 1 ? 0.4 : 1,
              zIndex: 10,
              boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (currentIndex < bottles.length - 1) {
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.1)';
            }}
          >
            <svg
              style={{
                width: '20px',
                height: '20px',
                color: 'var(--text-primary)',
                transform: isRTL ? 'rotate(180deg)' : 'none',
              }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      {/* Scrollable Container */}
      <div
        ref={scrollContainerRef}
        style={{
          display: 'grid',
          gridAutoFlow: 'column',
          gridAutoColumns: 'minmax(280px, 1fr)',
          gap: '16px',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          padding: '4px',
          marginBottom: '16px',
        }}
        className="hide-scrollbar-carousel"
      >
        {bottles.map((bottle, index) => (
          <div
            key={bottle.bottleId}
            style={{
              scrollSnapAlign: 'start',
              minWidth: '280px',
              maxWidth: '320px',
            }}
          >
            <BottleCardMini
              bottle={bottle}
              onClick={() => onBottleClick?.(bottle.bottleId)}
              index={index}
            />
          </div>
        ))}
      </div>

      {/* Dot Indicators (mobile) */}
      {bottles.length > 1 && (
        <div
          className="md:hidden"
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '8px',
            marginTop: '8px',
          }}
        >
          {bottles.map((_, index) => (
            <button
              key={index}
              onClick={() => scrollToIndex(index)}
              aria-label={`Go to bottle ${index + 1}`}
              style={{
                width: currentIndex === index ? '24px' : '8px',
                height: '8px',
                borderRadius: '4px',
                backgroundColor: currentIndex === index ? 'var(--wine-600)' : 'var(--border-medium)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                padding: 0,
              }}
            />
          ))}
        </div>
      )}

      <style>{`
        .hide-scrollbar-carousel::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
