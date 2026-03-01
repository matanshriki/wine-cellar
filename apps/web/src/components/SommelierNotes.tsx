/**
 * Sommelier Notes Component
 * 
 * Premium UI for displaying AI-generated wine analysis
 * 
 * Features:
 * - Status chips (Ready/Hold/Peak Soon)
 * - Confidence badge
 * - Expandable "Why" section with reasons
 * - Elegant serving suggestions
 * - Refresh button
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import type { AIAnalysis } from '../services/aiAnalysisService';

interface SommelierNotesProps {
  analysis: AIAnalysis;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function SommelierNotes({ analysis, onRefresh, isRefreshing }: SommelierNotesProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  // Get status styling - theme-aware colors
  const getStatusStyle = (label: string) => {
    switch (label) {
      case 'READY':
        return {
          bg: 'var(--status-ready-bg)',
          text: 'var(--status-ready-text)',
          border: 'transparent',
        };
      case 'PEAK_SOON':
        return {
          bg: 'var(--status-drink-soon-bg)',
          text: 'var(--status-drink-soon-text)',
          border: 'transparent',
        };
      case 'HOLD':
        return {
          bg: 'var(--status-hold-bg)',
          text: 'var(--status-hold-text)',
          border: 'transparent',
        };
      default:
        return {
          bg: 'var(--bg-muted)',
          text: 'var(--text-secondary)',
          border: 'transparent',
        };
    }
  };

  const statusStyle = getStatusStyle(analysis.readiness_label);

  // Get confidence badge styling - theme-aware colors
  const getConfidenceBadge = () => {
    const badges = {
      HIGH: { text: t('cellar.sommelier.confidence.high'), color: 'var(--status-ready-text)' },
      MEDIUM: { text: t('cellar.sommelier.confidence.medium'), color: 'var(--status-hold-text)' },
      LOW: { text: t('cellar.sommelier.confidence.low'), color: 'var(--status-drink-soon-text)' },
    };
    return badges[analysis.confidence] || badges.MEDIUM;
  };

  const confidenceBadge = getConfidenceBadge();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-lg"
      style={{
        backgroundColor: 'var(--bg-subtle)',
        border: '1px solid var(--border-base)',
        boxShadow: 'var(--shadow-xs)',
      }}
    >
      {/* Header with Status and Confidence */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Chip */}
          <span
            className="px-3 py-1 rounded-full text-xs font-semibold"
            style={{
              backgroundColor: statusStyle.bg,
              color: statusStyle.text,
              border: `2px solid ${statusStyle.border}`,
            }}
          >
            {t(`cellar.sommelier.status.${analysis.readiness_label.toLowerCase()}`)}
          </span>

          {/* Confidence Badge */}
          <span 
            className="flex items-center gap-1 text-xs"
            style={{ color: 'var(--text-secondary)' }}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span style={{ color: confidenceBadge.color }}>
              {confidenceBadge.text}
            </span>
          </span>
        </div>

        {/* Refresh Button */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-1.5 rounded-lg transition-colors disabled:opacity-50"
            style={{
            backgroundColor: 'transparent',
          }}
            aria-label={t('cellar.sommelier.refresh')}
          >
            <svg
              className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
              style={{ color: 'var(--text-secondary)' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        )}
      </div>

      {/* AI Label */}
      <div 
        className="flex items-center gap-1 text-xs mb-2"
        style={{ color: 'var(--text-tertiary)' }}
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <span>{t('cellar.sommelier.aiPowered')}</span>
      </div>

      {/* Sommelier Summary */}
      <p 
        className="text-sm leading-relaxed mb-3"
        style={{ color: 'var(--text-primary)' }}
      >
        {analysis.analysis_summary}
      </p>

      {/* Serving Suggestions */}
      <div className="flex items-center gap-3 mb-3 text-sm">
        {analysis.serving_temp_c && (
          <div 
            className="flex items-center gap-1.5"
            style={{ color: 'var(--text-secondary)' }}
          >
            <span>🌡️</span>
            <span>{analysis.serving_temp_c}°C</span>
          </div>
        )}
        {analysis.decant_minutes > 0 && (
          <div 
            className="flex items-center gap-1.5"
            style={{ color: 'var(--text-secondary)' }}
          >
            <span>⏱️</span>
            <span>{analysis.decant_minutes}min</span>
          </div>
        )}
        {analysis.drink_window_start && analysis.drink_window_end && (
          <div 
            className="flex items-center gap-1.5"
            style={{ color: 'var(--text-secondary)' }}
          >
            <span>📅</span>
            <span>{analysis.drink_window_start}-{analysis.drink_window_end}</span>
          </div>
        )}
      </div>

      {/* Expandable "Why" Section */}
      {analysis.analysis_reasons && analysis.analysis_reasons.length > 0 && (
        <div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 text-xs font-medium transition-colors"
          style={{ color: 'var(--wine-600)' }}
          >
            <svg
              className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span>{t('cellar.sommelier.whyThisAnalysis')}</span>
          </button>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-2 pl-4 border-l-2"
                style={{ borderColor: 'var(--wine-300)' }}
              >
                <ul className="space-y-1.5">
                  {analysis.analysis_reasons.map((reason, index) => (
                    <motion.li
                      key={`analysis-reason-${index}-${reason.substring(0, 30)}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="text-xs flex items-start gap-2"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <span className="text-wine-500 flex-shrink-0 mt-0.5">•</span>
                      <span>{reason}</span>
                    </motion.li>
                  ))}
                </ul>

                {/* Assumptions (if confidence is low) */}
                {analysis.assumptions && (
                  <p 
                    className="mt-2 text-xs italic"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {t('cellar.sommelier.assumptions')}: {analysis.assumptions}
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Analysis Date */}
      <div 
        className="mt-3 pt-2 text-xs"
        style={{ 
          borderTop: '1px solid var(--border-subtle)',
          color: 'var(--text-tertiary)'
        }}
      >
        {t('cellar.sommelier.analyzedOn')} {new Date(analysis.analyzed_at).toLocaleDateString()}
      </div>
    </motion.div>
  );
}

