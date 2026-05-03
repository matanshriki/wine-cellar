/**
 * SommiInsightPill
 *
 * Displays one short, personalized wine insight as a premium pill badge.
 * Returns null (renders nothing) when no insight is provided.
 *
 * Reuses the exact visual style already established by the affinityReason
 * pill in RecommendationPage — wine gradient background, bordered, subtle.
 */

import { motion } from 'framer-motion';
import type { WineInsight } from '../services/insightService';

interface SommiInsightPillProps {
  insight: WineInsight | null | undefined;
  /** When true the pill animates in; set to false for static rendering */
  animate?: boolean;
  className?: string;
}

export function SommiInsightPill({
  insight,
  animate = true,
  className,
}: SommiInsightPillProps) {
  if (!insight) return null;

  const pill = (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '5px 12px',
        borderRadius: '999px',
        fontSize: '13px',
        fontWeight: 500,
        lineHeight: 1.4,
        background: 'linear-gradient(135deg, var(--wine-50, #fdf2f8), var(--wine-100, #fce7f3))',
        color: 'var(--wine-700, #be185d)',
        border: '1px solid var(--wine-200, #fbcfe8)',
        whiteSpace: 'nowrap' as const,
        maxWidth: '100%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
      title={insight.text}
    >
      <span aria-hidden style={{ flexShrink: 0 }}>{insight.icon}</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{insight.text}</span>
    </span>
  );

  if (!animate) return pill;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      style={{ display: 'inline-flex', maxWidth: '100%' }}
    >
      {pill}
    </motion.div>
  );
}
