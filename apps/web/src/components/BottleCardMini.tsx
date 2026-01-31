/**
 * Bottle Card Mini
 * 
 * Compact luxury card for bottle recommendations in carousel
 * Clean hierarchy, minimal text, prominent image
 */

import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import type { BottleRecommendation } from './BottleCarousel';

interface BottleCardMiniProps {
  bottle: BottleRecommendation;
  onClick?: () => void;
  index: number;
}

export function BottleCardMini({ bottle, onClick, index }: BottleCardMiniProps) {
  const { t } = useTranslation();

  // Get readiness badge style
  const getReadinessBadge = (status: string | null | undefined) => {
    if (!status) return null;

    const badges: Record<string, { text: string; color: string; bg: string }> = {
      ready: {
        text: t('cellar.readiness.ready', 'Ready'),
        color: 'var(--color-emerald-700)',
        bg: 'var(--color-emerald-50)',
      },
      peak: {
        text: t('cellar.readiness.peak', 'Peak'),
        color: 'var(--gold-700)',
        bg: 'var(--gold-50)',
      },
      aging: {
        text: t('cellar.readiness.aging', 'Hold'),
        color: 'var(--wine-700)',
        bg: 'var(--wine-50)',
      },
      drink_soon: {
        text: t('cellar.readiness.drinkSoon', 'Drink Soon'),
        color: 'var(--color-rose-700)',
        bg: 'var(--color-rose-50)',
      },
    };

    const badge = badges[status.toLowerCase()];
    if (!badge) return null;

    return (
      <span
        style={{
          padding: '4px 10px',
          borderRadius: '6px',
          fontSize: '11px',
          fontWeight: 600,
          backgroundColor: badge.bg,
          color: badge.color,
          whiteSpace: 'nowrap',
        }}
      >
        {badge.text}
      </span>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.3 }}
      onClick={onClick}
      style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        border: '1px solid var(--border-light)',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        cursor: 'pointer',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
      }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Wine Image */}
      {bottle.imageUrl ? (
        <div
          style={{
            width: '100%',
            height: '160px',
            backgroundColor: 'var(--bg-subtle)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <img
            src={bottle.imageUrl}
            alt={`${bottle.producer} ${bottle.name}`}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
            loading="lazy"
          />
        </div>
      ) : (
        <div
          style={{
            width: '100%',
            height: '160px',
            backgroundColor: 'var(--bg-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            style={{ width: '48px', height: '48px', color: 'var(--text-tertiary)' }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
      )}

      {/* Content */}
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
        {/* Wine Name - Primary */}
        <h4
          style={{
            fontSize: '16px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            lineHeight: '1.3',
            margin: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 1,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {bottle.name}
        </h4>

        {/* Producer + Vintage - Secondary */}
        <p
          style={{
            fontSize: '14px',
            color: 'var(--text-secondary)',
            lineHeight: '1.4',
            margin: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {bottle.producer}
          {bottle.vintage && (
            <span
              style={{
                fontWeight: 600,
                marginLeft: '6px',
                color: 'var(--text-primary)',
              }}
            >
              {bottle.vintage}
            </span>
          )}
        </p>

        {/* Metadata Row - Tertiary */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
            marginTop: '4px',
          }}
        >
          {/* Rating */}
          {bottle.rating && bottle.rating > 0 && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--gold-600)',
              }}
            >
              ⭐ {bottle.rating.toFixed(1)}
            </span>
          )}

          {/* Readiness Status */}
          {bottle.readinessStatus && getReadinessBadge(bottle.readinessStatus)}
        </div>

        {/* Why - Italic quote (single line) */}
        {bottle.shortWhy && (
          <p
            style={{
              fontSize: '13px',
              color: 'var(--text-tertiary)',
              lineHeight: '1.4',
              fontStyle: 'italic',
              margin: 0,
              marginTop: 'auto',
              paddingTop: '8px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            "{bottle.shortWhy}"
          </p>
        )}
      </div>
    </motion.div>
  );
}
