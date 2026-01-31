/**
 * Bot Single Wine Result Card
 * 
 * Luxury rich result card for single wine recommendations from the chat agent.
 * Matches the premium design of the multi-wine carousel with:
 * - Wide card layout (not cramped bubble)
 * - Clickable wine hero card with image and metadata
 * - "Why this wine" section with read more functionality
 * - Action buttons for viewing/opening the wine
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { shouldReduceMotion } from '../utils/pwaAnimationFix';
import type { BottleWithWineInfo } from '../services/bottleService';

interface BotSingleWineResultCardProps {
  bottle: BottleWithWineInfo;
  reason: string;
  serveTemp?: string;
  decant?: string;
  imageUrl: string | null;
  onOpenBottle?: () => void;
}

export function BotSingleWineResultCard({
  bottle,
  reason,
  serveTemp,
  decant,
  imageUrl,
  onOpenBottle,
}: BotSingleWineResultCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const reduceMotion = shouldReduceMotion();

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

  // Truncate reason to first 2-4 lines (approximately 200 characters)
  const shouldTruncate = reason.length > 200;
  const displayReason = !isExpanded && shouldTruncate ? reason.slice(0, 200) + '...' : reason;

  return (
    <motion.div
      initial={reduceMotion ? {} : { opacity: 0, y: 10 }}
      animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        width: '100%',
        maxWidth: '600px',
        backgroundColor: 'var(--bg-surface)',
        borderRadius: '20px',
        border: '1px solid var(--border-light)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px 12px 20px',
          borderBottom: '1px solid var(--border-light)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg
            style={{ width: '18px', height: '18px', color: 'var(--wine-600)' }}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <span
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--wine-700)',
              letterSpacing: '0.02em',
              textTransform: 'uppercase',
            }}
          >
            {t('cellarSommelier.sommelierPick', 'Sommelier Pick')}
          </span>
        </div>
      </div>

      {/* Wine Hero Card */}
      <motion.div
        onClick={() => navigate(`/cellar?bottleId=${bottle.id}`)}
        style={{
          padding: '20px',
          cursor: 'pointer',
          display: 'flex',
          gap: '16px',
          backgroundColor: 'white',
          transition: 'background-color 0.2s',
        }}
        whileHover={reduceMotion ? {} : { backgroundColor: 'var(--bg-subtle)' }}
        whileTap={reduceMotion ? {} : { scale: 0.99 }}
      >
        {/* Bottle Image */}
        <div
          style={{
            flexShrink: 0,
            width: '100px',
            height: '120px',
            borderRadius: '12px',
            backgroundColor: 'var(--bg-subtle)',
            overflow: 'hidden',
            border: '1px solid var(--border-light)',
          }}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={`${bottle.wine.producer} ${bottle.wine.name}`}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
              loading="lazy"
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                style={{ width: '40px', height: '40px', color: 'var(--text-tertiary)' }}
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
        </div>

        {/* Wine Info */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
          {/* Wine Name */}
          <h4
            style={{
              fontSize: '18px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              lineHeight: '1.3',
              margin: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {bottle.wine.name}
          </h4>

          {/* Producer + Region + Vintage */}
          <p
            style={{
              fontSize: '14px',
              color: 'var(--text-secondary)',
              lineHeight: '1.4',
              margin: 0,
            }}
          >
            {bottle.wine.producer}
            {bottle.wine.region && (
              <span style={{ color: 'var(--text-tertiary)' }}>
                {' • '}
                {bottle.wine.region}
              </span>
            )}
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

          {/* Metadata Row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
              marginTop: '4px',
            }}
          >
            {/* Rating */}
            {bottle.wine.rating && bottle.wine.rating > 0 && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--gold-600)',
                }}
              >
                ⭐ {bottle.wine.rating.toFixed(1)}
              </span>
            )}

            {/* Bottle Count */}
            {bottle.quantity && bottle.quantity > 1 && (
              <span
                style={{
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: 'var(--wine-50)',
                  color: 'var(--wine-700)',
                }}
              >
                ×{bottle.quantity} {t('cellar.inCellar', 'in cellar')}
              </span>
            )}

            {/* Readiness Status */}
            {bottle.wine.readiness_status && getReadinessBadge(bottle.wine.readiness_status)}
          </div>
        </div>
      </motion.div>

      {/* Why This Wine Section */}
      <div
        style={{
          padding: '16px 20px',
          backgroundColor: 'var(--bg-subtle)',
          borderTop: '1px solid var(--border-light)',
        }}
      >
        <h5
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            margin: '0 0 8px 0',
            textTransform: 'uppercase',
            letterSpacing: '0.02em',
          }}
        >
          {t('cellarSommelier.whyThisWine', 'Why this wine')}
        </h5>

        <AnimatePresence mode="wait">
          <motion.p
            key={isExpanded ? 'expanded' : 'collapsed'}
            initial={reduceMotion ? {} : { opacity: 0 }}
            animate={reduceMotion ? {} : { opacity: 1 }}
            exit={reduceMotion ? {} : { opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              fontSize: '14px',
              color: 'var(--text-primary)',
              lineHeight: '1.6',
              margin: 0,
              whiteSpace: 'pre-wrap',
            }}
          >
            {displayReason}
          </motion.p>
        </AnimatePresence>

        {shouldTruncate && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              marginTop: '8px',
              padding: '4px 0',
              border: 'none',
              background: 'none',
              color: 'var(--wine-600)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {isExpanded ? t('common.readLess', 'Read less') : t('common.readMore', 'Read more')}
            <svg
              style={{
                width: '14px',
                height: '14px',
                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s',
              }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}

        {/* Serving Details */}
        {(serveTemp || decant) && (
          <div
            style={{
              marginTop: '12px',
              paddingTop: '12px',
              borderTop: '1px solid var(--border-light)',
              display: 'flex',
              gap: '16px',
              fontSize: '13px',
            }}
          >
            {serveTemp && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg
                  style={{ width: '16px', height: '16px', color: 'var(--text-tertiary)' }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
                <span style={{ color: 'var(--text-secondary)' }}>{serveTemp}</span>
              </div>
            )}
            {decant && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg
                  style={{ width: '16px', height: '16px', color: 'var(--text-tertiary)' }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span style={{ color: 'var(--text-secondary)' }}>{decant}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions Row */}
      <div
        style={{
          padding: '16px 20px',
          borderTop: '1px solid var(--border-light)',
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        {/* Primary Action - Open Wine */}
        {onOpenBottle && (
          <motion.button
            onClick={onOpenBottle}
            whileHover={reduceMotion ? {} : { scale: 1.02 }}
            whileTap={reduceMotion ? {} : { scale: 0.98 }}
            style={{
              flex: 1,
              minWidth: '140px',
              padding: '12px 20px',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, var(--wine-600), var(--wine-700))',
              color: 'white',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(124, 48, 48, 0.2)',
              transition: 'box-shadow 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(124, 48, 48, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(124, 48, 48, 0.2)';
            }}
          >
            {t('cellar.markAsOpened', 'Open Wine')}
          </motion.button>
        )}

        {/* Secondary Action - View in Cellar */}
        <motion.button
          onClick={() => navigate(`/cellar?bottleId=${bottle.id}`)}
          whileHover={reduceMotion ? {} : { scale: 1.02 }}
          whileTap={reduceMotion ? {} : { scale: 0.98 }}
          style={{
            flex: 1,
            minWidth: '140px',
            padding: '12px 20px',
            borderRadius: '12px',
            border: '1px solid var(--wine-600)',
            background: 'transparent',
            color: 'var(--wine-600)',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--wine-50)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          {t('cellarSommelier.viewInCellar', 'View in Cellar')}
        </motion.button>
      </div>
    </motion.div>
  );
}
