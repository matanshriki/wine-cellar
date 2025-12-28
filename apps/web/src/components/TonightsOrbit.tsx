/**
 * Tonight's Orbit Widget
 * 
 * Premium circular layout showing 2-3 recommended bottles
 * Subtle, elegant, NOT sci-fi - inspired by luxury watch complications
 */

import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import type { BottleWithWineInfo } from '../services/bottleService';

interface TonightsOrbitProps {
  bottles: BottleWithWineInfo[];
  onBottleClick: (bottle: BottleWithWineInfo) => void;
}

export function TonightsOrbit({ bottles, onBottleClick }: TonightsOrbitProps) {
  const { t } = useTranslation();

  /**
   * Smart Selection Logic:
   * 1. Prioritize bottles marked as "READY" (optimal drinking window)
   * 2. Then "PEAK_SOON" bottles (approaching optimal window)
   * 3. Then bottles with highest quantity (you have more to enjoy)
   * 4. Finally, newest additions (most recent purchases)
   */
  const getSmartSelection = (bottles: BottleWithWineInfo[]) => {
    const scored = bottles.map(bottle => {
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

      {/* Enhanced Bottle Grid Layout */}
      <div className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                className="relative h-full p-4 rounded-lg transition-all duration-200"
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
                {bottle.wine.image_url && (
                  <div className="mb-3 flex justify-center">
                    <img 
                      src={bottle.wine.image_url} 
                      alt={bottle.wine.wine_name}
                      className="w-20 h-28 object-cover rounded-md"
                      style={{
                        border: '1px solid var(--border-base)',
                        boxShadow: 'var(--shadow-sm)',
                      }}
                      loading="lazy"
                      onError={(e) => {
                        // Hide image if it fails to load
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                )}

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
                  className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
                  style={{
                    background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.03), rgba(164, 77, 90, 0.03))',
                    border: '2px solid var(--border-accent)',
                  }}
                />
              </div>
            </motion.button>
          ))}
        </div>

        {/* Show message if less than 3 bottles */}
        {topBottles.length < 3 && (
          <div 
            className="mt-4 p-3 rounded-lg text-sm text-center"
            style={{
              background: 'var(--bg-surface-elevated)',
              color: 'var(--text-tertiary)',
            }}
          >
            {t('dashboard.tonightsOrbit.needMore', 'Add more bottles to see personalized recommendations')}
          </div>
        )}
      </div>
    </div>
  );
}
