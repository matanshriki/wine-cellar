/**
 * Tonight's Orbit Widget
 * 
 * Premium circular layout showing 2-3 recommended bottles
 * Subtle, elegant, NOT sci-fi - inspired by luxury watch complications
 */

import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import type { BottleWithWineInfo } from '../services/bottleService';
import * as labelArtService from '../services/labelArtService';

interface TonightsOrbitProps {
  bottles: BottleWithWineInfo[];
  onBottleClick: (bottle: BottleWithWineInfo) => void;
}

export function TonightsOrbit({ bottles, onBottleClick }: TonightsOrbitProps) {
  const { t } = useTranslation();

  /**
   * Smart Selection Logic:
   * 1. Filter out bottles with quantity = 0 (already opened/consumed)
   * 2. Prioritize bottles marked as "READY" (optimal drinking window)
   * 3. Then "PEAK_SOON" bottles (approaching optimal window)
   * 4. Then bottles with highest quantity (you have more to enjoy)
   * 5. Finally, newest additions (most recent purchases)
   */
  const getSmartSelection = (bottles: BottleWithWineInfo[]) => {
    // First, filter out bottles that are already opened (quantity = 0)
    const availableBottles = bottles.filter(bottle => bottle.quantity > 0);
    
    const scored = availableBottles.map(bottle => {
      const analysis = bottle as any;
      let score = 0;

      // Highest priority: Ready to drink
      if (analysis.readiness_label === 'READY') {
        score += 100;
      }
      // Medium priority: Peak soon
      else if (analysis.readiness_label === 'PEAK_SOON') {
        score += 50;
      }
      // Lower priority: Hold (but still show if nothing else)
      else if (analysis.readiness_label === 'HOLD') {
        score += 10;
      }

      // Bonus for higher quantity (you have more to enjoy)
      score += Math.min(bottle.quantity * 5, 25);

      // Bonus for recent additions (assume newer = more interesting)
      // This is a simple heuristic; in a real app you'd use created_at timestamp
      score += Math.random() * 10; // Add slight randomness for variety

      return { bottle, score };
    });

    // Sort by score (highest first) and take top 3
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(item => item.bottle);
  };

  const topBottles = getSmartSelection(bottles);

  if (topBottles.length === 0) {
    return null;
  }

  return (
    <div className="luxury-card overflow-hidden">
      {/* Premium Header with gradient background */}
      <div 
        className="p-6 pb-8"
        style={{
          background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.03) 0%, rgba(164, 77, 90, 0.03) 100%)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 
              className="text-2xl mb-2"
              style={{ 
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-display)',
                fontWeight: 'var(--font-bold)',
                letterSpacing: '-0.02em',
              }}
            >
              {t('dashboard.tonightsOrbit.title', 'Tonight\'s Selection')}
            </h2>
            <p 
              className="text-sm"
              style={{ color: 'var(--text-secondary)' }}
            >
              {t('dashboard.tonightsOrbit.subtitle', 'Perfect bottles for this evening')}
            </p>
          </div>
          
          {/* Decorative icon */}
          <div 
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, var(--gold-50), var(--gold-100))',
              border: '1px solid var(--gold-200)',
            }}
          >
            <span className="text-2xl">✨</span>
          </div>
        </div>
      </div>

      {/* Enhanced Bottle Layout - Horizontal Carousel on Mobile */}
      <div className="tonights-selection-container">
        {/* Mobile: Horizontal Carousel */}
        <div className="tonights-carousel md:hidden">
          {topBottles.map((bottle, index) => (
            <motion.button
              key={bottle.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ 
                delay: index * 0.1,
                duration: 0.4,
                ease: [0.4, 0, 0.2, 1]
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onBottleClick(bottle);
              }}
              className="group cursor-pointer text-left"
              style={{
                minHeight: '44px',
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation',
              }}
            >
              <div
                className="relative h-full p-3 rounded-lg transition-all duration-200 group-active:scale-[0.98]"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                {/* Premium indicator */}
                <div 
                  className="absolute top-2 end-2 w-7 h-7 rounded-full flex items-center justify-center z-10"
                  style={{
                    background: 'linear-gradient(135deg, var(--wine-50), var(--wine-100))',
                    border: '1px solid var(--wine-200)',
                  }}
                >
                  <span className="text-xs font-semibold" style={{ color: 'var(--wine-700)' }}>
                    {index + 1}
                  </span>
                </div>

                {/* Wine Image - Larger for mobile carousel */}
                {(() => {
                  const displayImage = labelArtService.getWineDisplayImage(bottle.wine);
                  return displayImage.imageUrl && (
                    <div className="flex justify-center relative">
                      <img 
                        src={displayImage.imageUrl} 
                        alt={bottle.wine.wine_name}
                        className="w-36 h-48 object-cover rounded-md mb-0.5"
                        style={{
                          border: '1px solid var(--border-base)',
                          boxShadow: 'var(--shadow-md)',
                        }}
                        loading="lazy"
                        onError={(e) => {
                          // Hide image if it fails to load
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      {/* AI Generated Badge */}
                      {displayImage.isGenerated && (
                        <div 
                          className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[9px] font-medium flex items-center gap-0.5"
                          style={{
                            background: 'rgba(0, 0, 0, 0.7)',
                            color: 'white',
                            backdropFilter: 'blur(4px)',
                          }}
                          title="AI-generated label art"
                        >
                          <svg className="w-2 h-2" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                          </svg>
                          <span>AI</span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Wine name */}
                <div 
                  className="font-semibold text-base mb-1 pe-8 line-clamp-2 leading-snug"
                  style={{ 
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 'var(--font-semibold)',
                  }}
                >
                  {bottle.wine.wine_name}
                </div>

                {/* Details row */}
                <div className="space-y-1.5 mb-2">
                  {/* Vintage */}
                  {bottle.wine.vintage && (
                    <div 
                      className="text-sm flex items-center gap-2"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <span className="text-xs">📅</span>
                      <span>{bottle.wine.vintage}</span>
                    </div>
                  )}
                  
                  {/* Region */}
                  {bottle.wine.region && (
                    <div 
                      className="text-xs truncate"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      📍 {bottle.wine.region}
                    </div>
                  )}

                  {/* Rating */}
                  {bottle.wine.rating && (
                    <div 
                      className="flex items-center gap-1"
                      title={`${bottle.wine.rating} ${t('cellar.bottle.vivinoRating')}`}
                    >
                      {[1, 2, 3, 4, 5].map((star) => {
                        const rating = bottle.wine.rating || 0;
                        const filled = star <= Math.floor(rating);
                        const halfFilled = !filled && star <= Math.ceil(rating);
                        
                        return (
                          <span
                            key={`${bottle.id}-star-${star}`}
                            className="text-xs"
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
                  )}
                </div>

                {/* Wine style badge */}
                <span
                  className="badge-luxury badge-luxury-wine text-xs inline-block"
                >
                  {t(`cellar.wineStyles.${bottle.wine.color}`)}
                </span>

                {/* Hover effect overlay */}
                <div 
                  className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity duration-200 pointer-events-none"
                  style={{
                    background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.05), rgba(164, 77, 90, 0.05))',
                    border: '2px solid var(--wine-300)',
                  }}
                />
                
                {/* Click hint icon (visible on hover/focus) */}
                <div 
                  className="absolute bottom-3 end-3 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  style={{
                    background: 'var(--wine-500)',
                    color: 'white',
                  }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Desktop/Tablet: Grid Layout */}
        <div className="hidden md:grid md:grid-cols-3 gap-4 p-6">
          {topBottles.map((bottle, index) => (
            <motion.button
              key={bottle.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ 
                delay: index * 0.1,
                duration: 0.4,
                ease: [0.4, 0, 0.2, 1]
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onBottleClick(bottle);
              }}
              className="group cursor-pointer text-left"
              style={{
                minHeight: '44px',
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation',
              }}
            >
              <div
                className="relative h-full p-4 rounded-lg transition-all duration-200 group-active:scale-[0.98]"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                {/* Premium indicator */}
                <div 
                  className="absolute top-3 end-3 w-8 h-8 rounded-full flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, var(--wine-50), var(--wine-100))',
                    border: '1px solid var(--wine-200)',
                  }}
                >
                  <span className="text-xs font-semibold" style={{ color: 'var(--wine-700)' }}>
                    {index + 1}
                  </span>
                </div>

                {/* Wine Image */}
                {(() => {
                  const displayImage = labelArtService.getWineDisplayImage(bottle.wine);
                  return displayImage.imageUrl && (
                    <div className="mb-3 flex justify-center relative">
                      <img 
                        src={displayImage.imageUrl} 
                        alt={bottle.wine.wine_name}
                        className="w-20 h-28 object-cover rounded-md"
                        style={{
                          border: '1px solid var(--border-base)',
                          boxShadow: 'var(--shadow-sm)',
                        }}
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      {displayImage.isGenerated && (
                        <div 
                          className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-medium flex items-center gap-0.5"
                          style={{
                            background: 'rgba(0, 0, 0, 0.7)',
                            color: 'white',
                            backdropFilter: 'blur(4px)',
                          }}
                          title="AI-generated label art"
                        >
                          <svg className="w-2 h-2" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                          </svg>
                          <span>AI</span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Wine name */}
                <div 
                  className="font-semibold text-base mb-2 pe-10 line-clamp-2 leading-snug"
                  style={{ 
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 'var(--font-semibold)',
                  }}
                >
                  {bottle.wine.wine_name}
                </div>

                {/* Details row */}
                <div className="space-y-2 mb-3">
                  {bottle.wine.vintage && (
                    <div 
                      className="text-sm flex items-center gap-2"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <span className="text-xs">📅</span>
                      <span>{bottle.wine.vintage}</span>
                    </div>
                  )}
                  
                  {bottle.wine.region && (
                    <div 
                      className="text-xs truncate"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      📍 {bottle.wine.region}
                    </div>
                  )}

                  {bottle.wine.rating && (
                    <div 
                      className="flex items-center gap-1"
                      title={`${bottle.wine.rating} ${t('cellar.bottle.vivinoRating')}`}
                    >
                      {[1, 2, 3, 4, 5].map((star) => {
                        const rating = bottle.wine.rating || 0;
                        const filled = star <= Math.floor(rating);
                        const halfFilled = !filled && star <= Math.ceil(rating);
                        
                        return (
                          <span
                            key={`${bottle.id}-star-${star}-desktop`}
                            className="text-xs"
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
                  )}
                </div>

                {/* Wine style badge */}
                <span
                  className="badge-luxury badge-luxury-wine text-xs inline-block"
                >
                  {t(`cellar.wineStyles.${bottle.wine.color}`)}
                </span>

                {/* Hover effect overlay */}
                <div 
                  className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity duration-200 pointer-events-none"
                  style={{
                    background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.05), rgba(164, 77, 90, 0.05))',
                    border: '2px solid var(--wine-300)',
                  }}
                />
                
                {/* Click hint icon */}
                <div 
                  className="absolute bottom-3 end-3 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  style={{
                    background: 'var(--wine-500)',
                    color: 'white',
                  }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Show message if less than 3 bottles */}
        {topBottles.length < 3 && (
          <div 
            className="mx-6 mb-6 p-3 rounded-lg text-sm text-center md:mt-4"
            style={{
              background: 'var(--bg-surface-elevated)',
              color: 'var(--text-tertiary)',
            }}
          >
            {t('dashboard.tonightsOrbit.needMore', 'Add more bottles to see personalized recommendations')}
          </div>
        )}
      </div>

      {/* Carousel Styles */}
      <style>{`
        .tonights-selection-container {
          position: relative;
        }

        /* Mobile Horizontal Carousel */
        .tonights-carousel {
          display: flex;
          overflow-x: auto;
          overflow-y: hidden;
          scroll-snap-type: x mandatory;
          scroll-behavior: smooth;
          -webkit-overflow-scrolling: touch;
          gap: 1rem;
          padding: 1.5rem;
          padding-bottom: 1.5rem;
          /* Hide scrollbar but keep functionality */
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .tonights-carousel::-webkit-scrollbar {
          display: none;
        }

        /* Each card in carousel */
        .tonights-carousel > button {
          flex: 0 0 85%;
          max-width: 320px;
          scroll-snap-align: start;
          scroll-snap-stop: always;
        }

        /* Show peek of next card */
        .tonights-carousel > button:last-child {
          margin-inline-end: 1.5rem;
        }

        /* RTL Support */
        [dir="rtl"] .tonights-carousel {
          direction: rtl;
        }

        [dir="rtl"] .tonights-carousel > button:last-child {
          margin-inline-start: 1.5rem;
          margin-inline-end: 0;
        }

        /* Prevent horizontal page scroll */
        .tonights-carousel {
          margin-left: 0;
          margin-right: 0;
        }

        /* Compact mobile card styling - increased for larger images */
        .tonights-carousel .relative {
          min-height: 230px;
        }

        /* Touch feedback */
        @media (hover: none) {
          .tonights-carousel > button:active {
            transform: scale(0.98);
          }
        }

        /* Smooth entrance animation */
        @media (prefers-reduced-motion: no-preference) {
          .tonights-carousel > button {
            animation: slideInCarousel 0.4s ease-out forwards;
            opacity: 0;
          }

          .tonights-carousel > button:nth-child(1) {
            animation-delay: 0s;
          }

          .tonights-carousel > button:nth-child(2) {
            animation-delay: 0.1s;
          }

          .tonights-carousel > button:nth-child(3) {
            animation-delay: 0.2s;
          }
        }

        @keyframes slideInCarousel {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        [dir="rtl"] @keyframes slideInCarousel {
          from {
            transform: translateX(-20px);
          }
          to {
            transform: translateX(0);
          }
        }

        /* Tablet and up: Use grid */
        @media (min-width: 768px) {
          .tonights-carousel {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
