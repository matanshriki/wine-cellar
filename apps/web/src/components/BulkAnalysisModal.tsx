/**
 * Bulk Analysis Modal
 * 
 * Premium modal for analyzing entire cellar in bulk.
 * Features:
 * - Mode selection (missing only vs re-analyze all)
 * - Progress tracking
 * - Results summary
 * - Mobile-optimized
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import * as aiAnalysisService from '../services/aiAnalysisService';
import { toast } from '../lib/toast';
import { WineLoader } from './WineLoader';

interface BulkAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  totalBottles: number;
  unanalyzedCount: number;
}

export function BulkAnalysisModal({
  isOpen,
  onClose,
  onComplete,
  totalBottles,
  unanalyzedCount,
}: BulkAnalysisModalProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<aiAnalysisService.BulkAnalysisMode>('missing_only');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState<string>('');

  async function handleAnalyze() {
    setIsAnalyzing(true);
    setProgress(t('bulkAnalysis.analyzing', 'Analyzing bottles...'));

    try {
      console.log('[BulkAnalysisModal] Starting analysis, mode:', mode);

      const result = await aiAnalysisService.analyzeCellarBulk(mode, 20);

      console.log('[BulkAnalysisModal] Analysis complete:', result);

      // Close modal first
      onClose();

      // Small delay then show success message and refresh
      setTimeout(() => {
        // Show celebratory success toast with clear summary
        let successMsg = '';
        
        if (result.processedCount > 0) {
          successMsg = `🎉 Analysis Complete! ${result.processedCount} bottle${result.processedCount !== 1 ? 's' : ''} analyzed`;
          if (result.skippedCount > 0) {
            successMsg += `, ${result.skippedCount} skipped`;
          }
          if (result.failedCount > 0) {
            successMsg += `, ${result.failedCount} failed`;
          }
        } else if (result.skippedCount > 0) {
          successMsg = `✓ Analysis Complete! All ${result.skippedCount} bottle${result.skippedCount !== 1 ? 's' : ''} already have sommelier notes.`;
        } else {
          successMsg = '✓ Analysis Complete! Your cellar is fully analyzed.';
        }
        
        toast.success(successMsg);

        // Refresh cellar data
        onComplete();
      }, 300);

    } catch (error: any) {
      console.error('[BulkAnalysisModal] Error:', error);
      toast.error(error.message || t('bulkAnalysis.error', 'Failed to analyze cellar'));
      setProgress('');
    } finally {
      setIsAnalyzing(false);
    }
  }

  function handleClose() {
    if (!isAnalyzing) {
      onClose();
    }
  }

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{
          background: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(4px)',
          paddingBottom: 'calc(80px + env(safe-area-inset-bottom) + 0.5rem)', // Space for bottom nav - reduced padding
        }}
        onClick={handleClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          className="w-full max-w-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Card */}
          <div
            className="luxury-card overflow-hidden flex flex-col"
            style={{
              maxHeight: 'calc(100dvh - 140px - env(safe-area-inset-bottom))', // Account for bottom nav (80px) + safe area + smaller margins (60px)
            }}
          >
            {/* Header - Fixed */}
            <div
              className="px-6 py-5 flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, rgba(164, 77, 90, 0.05), rgba(212, 175, 55, 0.05))',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, var(--wine-100), var(--gold-100))',
                      border: '1px solid var(--wine-200)',
                    }}
                  >
                    <span className="text-xl">🧙‍♂️</span>
                  </div>
                  <h2
                    className="text-xl font-semibold"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {t('bulkAnalysis.title', 'Analyze Cellar')}
                  </h2>
                </div>
                {!isAnalyzing && (
                  <button
                    onClick={handleClose}
                    className="text-2xl leading-none opacity-60 hover:opacity-100 transition-opacity"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* Content - Scrollable */}
            <div 
              className="p-6 space-y-5 flex-1 overflow-y-auto"
              style={{
                overscrollBehavior: 'contain',
                minHeight: 0, // Allow flex child to shrink below content size
                WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
              }}
            >
              {/* Description */}
              <p
                className="text-sm"
                style={{ color: 'var(--text-secondary)' }}
              >
                {t(
                  'bulkAnalysis.description',
                  'Generate sommelier notes for multiple bottles at once. This will analyze wine characteristics, readiness, and serving recommendations.'
                )}
              </p>

              {/* Stats */}
              <div
                className="flex items-center justify-between p-4 rounded-lg"
                style={{
                  background: 'var(--bg-muted)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div>
                  <div
                    className="text-xs uppercase tracking-wide mb-1"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {t('bulkAnalysis.totalBottles', 'Total Bottles')}
                  </div>
                  <div
                    className="text-2xl font-semibold"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {totalBottles}
                  </div>
                </div>
                <div>
                  <div
                    className="text-xs uppercase tracking-wide mb-1"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {t('bulkAnalysis.unanalyzed', 'Unanalyzed')}
                  </div>
                  <div
                    className="text-2xl font-semibold"
                    style={{ color: 'var(--wine-400)' }}
                  >
                    {unanalyzedCount}
                  </div>
                </div>
              </div>

              {/* Mode Selection */}
              <div className="space-y-3">
                <label
                  className="text-sm font-medium"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {t('bulkAnalysis.modeLabel', 'Analysis Mode')}
                </label>

                {/* Missing Only (Default) */}
                <label
                  className={`
                    flex items-start gap-3 p-4 rounded-lg cursor-pointer transition-all
                    ${mode === 'missing_only' ? 'ring-2' : 'hover:bg-opacity-50'}
                  `}
                  style={{
                    background: mode === 'missing_only' ? 'var(--wine-50)' : 'var(--bg-surface)',
                    border: mode === 'missing_only' ? '1px solid var(--wine-200)' : '1px solid var(--border-base)',
                    ringColor: mode === 'missing_only' ? 'var(--wine-300)' : undefined,
                  }}
                >
                  <input
                    type="radio"
                    name="mode"
                    value="missing_only"
                    checked={mode === 'missing_only'}
                    onChange={() => setMode('missing_only')}
                    disabled={isAnalyzing}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div
                      className="font-medium text-sm mb-1"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {t('bulkAnalysis.missingOnly', 'Missing only')}
                      <span
                        className="ml-2 px-2 py-0.5 rounded text-xs"
                        style={{
                          background: 'var(--wine-100)',
                          color: 'var(--wine-600)',
                        }}
                      >
                        {t('bulkAnalysis.recommended', 'Recommended')}
                      </span>
                    </div>
                    <p
                      className="text-xs"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {t(
                        'bulkAnalysis.missingOnlyDesc',
                        `Analyze only bottles without sommelier notes (${unanalyzedCount} bottles)`
                      )}
                    </p>
                  </div>
                </label>

                {/* Re-analyze All */}
                <label
                  className={`
                    flex items-start gap-3 p-4 rounded-lg cursor-pointer transition-all
                    ${mode === 'all' ? 'ring-2' : 'hover:bg-opacity-50'}
                  `}
                  style={{
                    background: mode === 'all' ? 'var(--wine-50)' : 'var(--bg-surface)',
                    border: mode === 'all' ? '1px solid var(--wine-200)' : '1px solid var(--border-base)',
                    ringColor: mode === 'all' ? 'var(--wine-300)' : undefined,
                  }}
                >
                  <input
                    type="radio"
                    name="mode"
                    value="all"
                    checked={mode === 'all'}
                    onChange={() => setMode('all')}
                    disabled={isAnalyzing}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div
                      className="font-medium text-sm mb-1"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {t('bulkAnalysis.reanalyzeAll', 'Re-analyze all')}
                    </div>
                    <p
                      className="text-xs"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {t(
                        'bulkAnalysis.reanalyzeAllDesc',
                        `Regenerate notes for all bottles (up to 20 per session)`
                      )}
                    </p>
                  </div>
                </label>
              </div>

              {/* Progress - Wine Glass Spinner */}
              {isAnalyzing && (
                <div
                  className="p-6 rounded-lg text-center"
                  style={{
                    background: 'var(--wine-50)',
                    border: '1px solid var(--wine-200)',
                  }}
                >
                  <WineLoader 
                    size={80}
                    variant="inline"
                    message={progress}
                  />
                  <p
                    className="text-xs mt-3"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {t('bulkAnalysis.pleaseWait', 'This may take a minute...')}
                  </p>
                </div>
              )}
            </div>

            {/* Footer - Fixed */}
            <div
              className="px-6 py-4 flex gap-3 flex-shrink-0"
              style={{
                borderTop: '1px solid var(--border-subtle)',
                background: 'var(--bg-surface)',
                paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
              }}
            >
              <button
                onClick={handleClose}
                disabled={isAnalyzing}
                className="btn-luxury-secondary flex-1"
                style={{ minHeight: '44px' }}
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="btn-luxury-primary flex-1"
                style={{ minHeight: '44px' }}
              >
                {isAnalyzing
                  ? t('bulkAnalysis.analyzing', 'Analyzing...')
                  : t('bulkAnalysis.startAnalysis', 'Start Analysis')}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

