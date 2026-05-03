/**
 * WeeklySummaryCard
 *
 * Self-contained premium card that shows "This Week with Sommi":
 * a concise 1-3 item summary of the user's wine activity and taste
 * signals over the last 7 days.
 *
 * Data is fetched independently so the component can be dropped
 * anywhere without requiring parent refactors.
 *
 * Renders nothing when:
 *   – data is still loading (silent, no skeleton)
 *   – activity_level is 'none' (zero opens this week)
 *   – fetch failed (fails soft)
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { fetchWeeklyActivity } from '../services/historyService';
import { getMyTasteProfile } from '../services/tasteProfileService';
import { getWeeklySummary } from '../services/weeklySummaryService';
import type { WeeklySummary } from '../services/weeklySummaryService';
import { trackWeeklySummary } from '../services/analytics';

// ─── Date range label ─────────────────────────────────────────────────────────

function formatDateRange(start: Date, end: Date, locale: string): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-US', {
      month: 'short',
      day: 'numeric',
    });
  return `${fmt(start)} – ${fmt(end)}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function WeeklySummaryCard() {
  const { t, i18n } = useTranslation();
  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    try {
      const [entries, profile] = await Promise.all([
        fetchWeeklyActivity(7),
        getMyTasteProfile(),
      ]);
      const result = getWeeklySummary(entries, profile);
      setSummary(result);

      if (result) {
        trackWeeklySummary.shown({
          activity_level: result.activity_level,
          item_types: result.items.map((i) => i.type),
          item_count: result.items.length,
        });
      }
    } catch (err) {
      console.warn('[WeeklySummaryCard] Load failed (silent):', err);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Silent during load and when no activity
  if (!ready || !summary) return null;

  const dateRange = formatDateRange(summary.period_start, summary.period_end, i18n.language);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="mb-6 sm:mb-8 rounded-2xl overflow-hidden"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        boxShadow: '0 1px 8px rgba(0,0,0,0.05)',
      }}
    >
      {/* Accent bar */}
      <div
        style={{
          height: '3px',
          background: 'linear-gradient(90deg, var(--wine-500, #be185d), var(--wine-300, #f472b6))',
        }}
      />

      <div className="px-5 pt-4 pb-5">
        {/* Header */}
        <div className="flex items-baseline justify-between mb-4">
          <h2
            className="text-base font-semibold"
            style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
          >
            {t('weeklySummary.title')}
          </h2>
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {dateRange}
          </span>
        </div>

        {/* Items */}
        <ul className="space-y-3">
          {summary.items.map((item, idx) => (
            <motion.li
              key={item.type}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.07, duration: 0.22, ease: 'easeOut' }}
              className="flex items-start gap-3"
            >
              {/* Icon bubble */}
              <span
                className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full text-sm"
                style={{
                  background: 'var(--wine-50, #fdf2f8)',
                  border: '1px solid var(--wine-100, #fce7f3)',
                }}
                aria-hidden
              >
                {item.icon}
              </span>

              {/* Text */}
              <span
                className="text-sm leading-snug pt-0.5"
                style={{ color: 'var(--text-primary)' }}
              >
                {item.text}
              </span>
            </motion.li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}
