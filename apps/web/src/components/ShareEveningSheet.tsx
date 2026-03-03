/**
 * ShareEveningSheet
 *
 * Luxury bottom sheet that lets the host:
 *  - Generate / view the public guest link
 *  - Copy it to clipboard
 *  - Open the guest view
 *  - See a live summary of guest votes
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { toast } from '../lib/toast';
import type { QueuedWine, EveningPlan } from '../services/eveningPlanService';
import * as eveningShareService from '../services/eveningShareService';
import type { EveningShare, VoteSummaryEntry } from '../services/eveningShareService';

interface ShareEveningSheetProps {
  isOpen: boolean;
  onClose: () => void;
  plan: EveningPlan;
  onShareCreated?: (shareId: string) => void;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MedalIcon({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-lg">🥇</span>;
  if (rank === 2) return <span className="text-lg">🥈</span>;
  if (rank === 3) return <span className="text-lg">🥉</span>;
  return (
    <span className="text-sm font-bold w-6 text-center" style={{ color: 'var(--text-tertiary)' }}>
      {rank}
    </span>
  );
}

function VoteSummaryRow({ entry, rank }: { entry: VoteSummaryEntry; rank: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: rank * 0.05 }}
      className="flex items-center gap-3 p-3 rounded-xl"
      style={{
        background: rank === 1 ? 'var(--wine-50)' : 'var(--bg-surface-elevated)',
        border: `1px solid ${rank === 1 ? 'var(--wine-200)' : 'var(--border-subtle)'}`,
      }}
    >
      <MedalIcon rank={rank} />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
          {entry.wine_name}
        </p>
        <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
          {entry.producer}
        </p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--wine-500)' }}>
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
        <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
          {entry.vote_count}
        </span>
      </div>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ShareEveningSheet({ isOpen, onClose, plan, onShareCreated }: ShareEveningSheetProps) {
  const { t } = useTranslation();

  const [share, setShare] = useState<EveningShare | null>(null);
  const [shareUrl, setShareUrl] = useState<string>('');
  const [loadingShare, setLoadingShare] = useState(false);
  const [copied, setCopied] = useState(false);

  const [voteSummary, setVoteSummary] = useState<VoteSummaryEntry[]>([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [loadingVotes, setLoadingVotes] = useState(false);

  // ── Create / retrieve share link ──────────────────────────────────────────
  const initShare = useCallback(async () => {
    if (!isOpen) return;
    setLoadingShare(true);
    try {
      const result = await eveningShareService.createOrGetEveningShare(
        plan.id,
        plan.queue as QueuedWine[],
        plan.occasion,
        plan.plan_name,
      );
      setShare(result);
      setShareUrl(eveningShareService.getShareUrl(result.id));
      onShareCreated?.(result.id);
    } catch (err) {
      console.error('[ShareEveningSheet] Failed to create share:', err);
      toast.error(t('guestMode.share.createError', 'Failed to create share link'));
    } finally {
      setLoadingShare(false);
    }
  }, [isOpen, plan, t]);

  // ── Load vote summary ──────────────────────────────────────────────────────
  const refreshVotes = useCallback(async () => {
    if (!share) return;
    setLoadingVotes(true);
    try {
      const summary = await eveningShareService.getVoteSummary(
        share.id,
        plan.queue as QueuedWine[],
      );
      setVoteSummary(summary);
      setTotalVotes(summary.reduce((acc, e) => acc + e.vote_count, 0));
    } catch (err) {
      console.error('[ShareEveningSheet] Failed to load votes:', err);
    } finally {
      setLoadingVotes(false);
    }
  }, [share, plan.queue]);

  useEffect(() => {
    if (isOpen) initShare();
  }, [isOpen, initShare]);

  useEffect(() => {
    if (share) refreshVotes();
  }, [share, refreshVotes]);

  // Poll for new votes every 30 s while the sheet is open
  useEffect(() => {
    if (!isOpen || !share) return;
    const timer = setInterval(refreshVotes, 30_000);
    return () => clearInterval(timer);
  }, [isOpen, share, refreshVotes]);

  // ── Copy handler ───────────────────────────────────────────────────────────
  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success(t('guestMode.share.copied', 'Link copied!'));
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error(t('guestMode.share.copyError', 'Failed to copy'));
    }
  };

  const hasVotes = voteSummary.some((e) => e.vote_count > 0);
  const topWines = voteSummary.filter((e) => e.vote_count > 0).slice(0, 5);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120]"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 z-[121] rounded-t-3xl overflow-hidden"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-xl)',
              paddingBottom: 'max(1.5rem, var(--safe-bottom))',
              maxHeight: '90dvh',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border-medium)' }} />
            </div>

            <div className="overflow-y-auto touch-scroll" style={{ maxHeight: 'calc(90dvh - 2rem)' }}>
              <div className="px-6 pt-2 pb-6 space-y-6">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                      {t('guestMode.share.title', 'Share with guests')}
                    </h2>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                      {t('guestMode.share.subtitle', 'Let guests view the lineup and vote for their favorites')}
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ml-3"
                    style={{ background: 'var(--bg-surface-elevated)', color: 'var(--text-tertiary)' }}
                    aria-label="Close"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Share Link Card */}
                {loadingShare ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--wine-200)', borderTopColor: 'var(--wine-600)' }} />
                  </div>
                ) : shareUrl ? (
                  <div
                    className="p-4 rounded-2xl space-y-3"
                    style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-medium)' }}
                  >
                    {/* URL display */}
                    <div
                      className="px-3 py-2.5 rounded-xl text-sm font-mono break-all"
                      style={{
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {shareUrl}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <motion.button
                        onClick={handleCopy}
                        whileTap={{ scale: 0.96 }}
                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all"
                        style={{
                          background: copied
                            ? 'linear-gradient(135deg, #16a34a, #15803d)'
                            : 'linear-gradient(135deg, var(--wine-600), var(--wine-700))',
                          color: '#fff',
                        }}
                      >
                        {copied ? (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            {t('guestMode.share.copiedButton', 'Copied!')}
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            {t('guestMode.share.copyButton', 'Copy link')}
                          </>
                        )}
                      </motion.button>

                      <motion.a
                        href={shareUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        whileTap={{ scale: 0.96 }}
                        className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl font-medium text-sm"
                        style={{
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-medium)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        {t('guestMode.share.openButton', 'Preview')}
                      </motion.a>
                    </div>

                    {/* Expiry note */}
                    {share && (
                      <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                        {t('guestMode.share.expires', 'Link expires in 7 days · Guests do not need to log in')}
                      </p>
                    )}
                  </div>
                ) : null}

                {/* Guest Activity / Vote Summary */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                      {t('guestMode.share.guestActivity', 'Guest activity')}
                    </h3>
                    {share && (
                      <button
                        onClick={refreshVotes}
                        disabled={loadingVotes}
                        className="text-xs px-2 py-1 rounded-lg transition-opacity"
                        style={{ color: 'var(--wine-600)', background: 'var(--wine-50)' }}
                      >
                        {loadingVotes ? '...' : t('guestMode.share.refresh', 'Refresh')}
                      </button>
                    )}
                  </div>

                  {!share ? (
                    <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>
                      {t('guestMode.share.noShareYet', 'Generate a link to start collecting votes')}
                    </p>
                  ) : loadingVotes && totalVotes === 0 ? (
                    <div className="flex items-center justify-center py-6">
                      <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border-medium)', borderTopColor: 'var(--wine-600)' }} />
                    </div>
                  ) : !hasVotes ? (
                    <div
                      className="text-center py-6 rounded-2xl"
                      style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)' }}
                    >
                      <p className="text-2xl mb-2">🍷</p>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                        {t('guestMode.share.noVotesYet', 'No votes yet')}
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        {t('guestMode.share.shareToCollect', 'Share the link and guests can start voting')}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* Stats bar */}
                      <div
                        className="flex items-center gap-3 px-4 py-3 rounded-xl mb-3"
                        style={{ background: 'var(--wine-50)', border: '1px solid var(--wine-100)' }}
                      >
                        <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--wine-600)' }}>
                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                        </svg>
                        <p className="text-sm font-medium" style={{ color: 'var(--wine-800)' }}>
                          {t('guestMode.share.totalVotes', '{{count}} vote', { count: totalVotes })}
                          {totalVotes !== 1 ? 's' : ''}{' '}
                          {topWines[0] && (
                            <>
                              · {t('guestMode.share.mostLoved', 'Most loved:')} <strong>{topWines[0].wine_name}</strong>
                            </>
                          )}
                        </p>
                      </div>

                      {/* Ranked list */}
                      {topWines.map((entry, i) => (
                        <VoteSummaryRow key={entry.wine_id} entry={entry} rank={i + 1} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
