/**
 * WeeklySummaryCard
 *
 * Self-contained premium card showing "This Week with Sommi":
 *   – 1–3 personalised insight bullets (preference trend, top signal, explore next)
 *   – Activity count + date range shown as a compact header meta line, not as a bullet
 *
 * Renders nothing when:
 *   – data is still loading (silent — no skeleton flicker)
 *   – opens_count === 0 (no activity this week)
 *   – all dimensions returned null (no interesting pattern this week)
 *   – fetch failed (fails soft)
 *
 * Low activity (1 open) shows top_signal only when rating ≥ 3. No preference_trend
 * is shown for a single data point (can't claim a "lean" from one bottle).
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { fetchWeeklyActivity } from '../services/historyService';
import { getMyTasteProfile } from '../services/tasteProfileService';
import { getWeeklySummary } from '../services/weeklySummaryService';
import type { WeeklySummary } from '../services/weeklySummaryService';
import { trackWeeklySummary } from '../services/analytics';

// ─── Date range helper ────────────────────────────────────────────────────────

function formatDateRange(start: Date, end: Date, locale: string): string {
  const ll = locale === 'he' ? 'he-IL' : 'en-US';
  const fmt = (d: Date) =>
    d.toLocaleDateString(ll, { month: 'short', day: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
}

function formatOpensLabel(count: number, t: (k: string, o?: any) => string): string {
  if (count === 1) return t('weeklySummary.activity.one');
  if (count <= 3) return t('weeklySummary.activity.few', { count });
  return t('weeklySummary.activity.busy', { count });
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

  // Silent on load, no activity, or no interesting pattern
  if (!ready || !summary) return null;

  const dateRange = formatDateRange(summary.period_start, summary.period_end, i18n.language);
  const opensLabel = formatOpensLabel(summary.opens_count, t);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="mt-6 rounded-2xl overflow-hidden"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        boxShadow: '0 1px 8px rgba(0,0,0,0.05)',
      }}
    >
      {/* Wine-tone accent bar */}
      <div
        style={{
          height: '3px',
          background: 'linear-gradient(90deg, var(--wine-500, #be185d), var(--wine-300, #f472b6))',
        }}
      />

      <div className="px-5 pt-4 pb-5">
        {/* Header */}
        <div className="flex items-baseline justify-between mb-1">
          <h2
            className="text-base font-semibold"
            style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
          >
            {t('weeklySummary.title')}
          </h2>
        </div>

        {/* Meta line: opens count · date range */}
        <p className="text-xs mb-4" style={{ color: 'var(--text-tertiary)' }}>
          {opensLabel} · {dateRange}
        </p>

        {/* Insight bullets */}
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

              {/* Translate here, using the React useTranslation hook — not the i18n singleton */}
              <span
                className="text-sm leading-snug pt-0.5"
                style={{ color: 'var(--text-primary)' }}
              >
                {String(t(item.key, item.params as any))}
              </span>
            </motion.li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}
