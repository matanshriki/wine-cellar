/**
 * GuestEveningPage
 *
 * Public (no auth required) guest view of a shared evening lineup.
 * Route: /share/evening/:shortCode
 *
 * Guests can:
 *  - View the full lineup as luxury cards
 *  - Tap ♥ to vote / un-vote for a wine
 *  - See live vote counts
 *
 * Anonymous fingerprint stored in localStorage; votes persist across refreshes.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as eveningShareService from '../services/eveningShareService';
import type { GuestShareData } from '../services/eveningShareService';
import type { QueuedWine } from '../services/eveningPlanService';

// ─── Wine Card ────────────────────────────────────────────────────────────────

interface WineCardProps {
  wine: QueuedWine;
  voteCount: number;
  hasVoted: boolean;
  onToggle: () => void;
  votePending: boolean;
}

function colorDot(color: string) {
  const map: Record<string, string> = {
    red: '#8B1A1A',
    white: '#D4B483',
    rosé: '#E8B4B8',
    rose: '#E8B4B8',
    sparkling: '#C6A94C',
    orange: '#C07A3B',
  };
  return map[color?.toLowerCase()] ?? '#888';
}

function WineCard({ wine, voteCount, hasVoted, onToggle, votePending }: WineCardProps) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: 'var(--bg-surface)',
        border: `1px solid ${hasVoted ? 'var(--wine-300)' : 'var(--border-subtle)'}`,
        boxShadow: hasVoted ? '0 4px 24px rgba(164,77,90,0.15)' : 'var(--shadow-sm)',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
    >
      {/* Image / placeholder */}
      {wine.image_url ? (
        <div className="w-full h-48 overflow-hidden flex-shrink-0">
          <img
            src={wine.image_url}
            alt={wine.wine_name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      ) : (
        <div
          className="w-full h-48 flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, var(--wine-100), var(--wine-200))' }}
        >
          <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" style={{ color: 'var(--wine-400)' }}>
            <path fill="currentColor" d="M6 2h12v2H6V2zm0 18c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V6H6v14zM8 8h8v12H8V8z" />
          </svg>
        </div>
      )}

      {/* Info */}
      <div className="p-4 flex-1 flex flex-col gap-3">
        <div className="flex-1">
          {/* Color chip */}
          <div className="flex items-center gap-1.5 mb-2">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ background: colorDot(wine.color) }}
            />
            <span className="text-xs capitalize font-medium" style={{ color: 'var(--text-tertiary)' }}>
              {wine.color}
            </span>
          </div>

          <h3 className="font-bold text-base leading-tight mb-1" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
            {wine.wine_name}
          </h3>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {wine.producer}
            {wine.vintage ? ` · ${wine.vintage}` : ''}
          </p>
        </div>

        {/* Vote button */}
        <motion.button
          whileTap={{ scale: votePending ? 1 : 0.93 }}
          onClick={onToggle}
          disabled={votePending}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all"
          style={{
            background: hasVoted
              ? 'linear-gradient(135deg, var(--wine-600), var(--wine-700))'
              : 'var(--bg-surface-elevated)',
            color: hasVoted ? '#fff' : 'var(--text-secondary)',
            border: hasVoted ? 'none' : '1px solid var(--border-medium)',
            opacity: votePending ? 0.7 : 1,
          }}
          aria-label={hasVoted ? 'Remove favorite' : 'Mark as favorite'}
          aria-pressed={hasVoted}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.svg
              key={hasVoted ? 'filled' : 'outline'}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill={hasVoted ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth={hasVoted ? 0 : 2}
            >
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </motion.svg>
          </AnimatePresence>

          {hasVoted ? 'Favorited' : 'Favorite'}

          {voteCount > 0 && (
            <span
              className="ml-1 px-2 py-0.5 rounded-full text-xs font-bold"
              style={{
                background: hasVoted ? 'rgba(255,255,255,0.2)' : 'var(--wine-100)',
                color: hasVoted ? '#fff' : 'var(--wine-700)',
              }}
            >
              {voteCount}
            </span>
          )}
        </motion.button>
      </div>
    </motion.article>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-2xl overflow-hidden animate-pulse" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
      <div className="w-full h-48" style={{ background: 'var(--bg-surface-elevated)' }} />
      <div className="p-4 space-y-3">
        <div className="h-3 rounded w-1/4" style={{ background: 'var(--bg-surface-elevated)' }} />
        <div className="h-5 rounded w-3/4" style={{ background: 'var(--bg-surface-elevated)' }} />
        <div className="h-4 rounded w-1/2" style={{ background: 'var(--bg-surface-elevated)' }} />
        <div className="h-11 rounded-xl" style={{ background: 'var(--bg-surface-elevated)' }} />
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function GuestEveningPage() {
  const { shortCode } = useParams<{ shortCode: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareData, setShareData] = useState<GuestShareData | null>(null);

  // Local vote state (optimistic)
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({});
  const [myVotes, setMyVotes] = useState<Set<string>>(new Set());
  const [pendingVotes, setPendingVotes] = useState<Set<string>>(new Set());

  const [sessionId] = useState(() => eveningShareService.getGuestSessionId());
  const [sessionVoteKey] = useState(() => `guest_votes_${shortCode}`);

  // ── Load share data ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!shortCode) {
      setError('Invalid link');
      setLoading(false);
      return;
    }

    eveningShareService
      .fetchGuestShareData(shortCode)
      .then((data) => {
        setShareData(data);
        setVoteCounts(data.vote_counts ?? {});

        // Restore my votes from localStorage (in case of page refresh)
        const saved = localStorage.getItem(sessionVoteKey);
        if (saved) {
          try {
            setMyVotes(new Set(JSON.parse(saved)));
          } catch {
            /* ignore */
          }
        }
      })
      .catch((err) => {
        console.error('[GuestEveningPage] Failed to load share:', err);
        setError(err.message ?? 'This link is invalid or has expired.');
      })
      .finally(() => setLoading(false));
  }, [shortCode, sessionVoteKey]);

  // ── Persist my votes to localStorage ─────────────────────────────────────
  const persistMyVotes = useCallback(
    (next: Set<string>) => {
      localStorage.setItem(sessionVoteKey, JSON.stringify(Array.from(next)));
    },
    [sessionVoteKey],
  );

  // ── Toggle vote ───────────────────────────────────────────────────────────
  const handleToggleVote = useCallback(
    async (wineId: string) => {
      if (!shortCode) return;
      if (pendingVotes.has(wineId)) return; // debounce

      const wasVoted = myVotes.has(wineId);
      const action: 'add' | 'remove' = wasVoted ? 'remove' : 'add';

      // Optimistic update
      const nextMyVotes = new Set(myVotes);
      if (wasVoted) {
        nextMyVotes.delete(wineId);
      } else {
        nextMyVotes.add(wineId);
      }
      setMyVotes(nextMyVotes);
      persistMyVotes(nextMyVotes);

      setVoteCounts((prev) => ({
        ...prev,
        [wineId]: Math.max(0, (prev[wineId] ?? 0) + (wasVoted ? -1 : 1)),
      }));

      setPendingVotes((prev) => new Set([...prev, wineId]));

      try {
        const updated = await eveningShareService.submitGuestVote(
          shortCode,
          wineId,
          sessionId,
          action,
        );
        // Reconcile with server truth
        setVoteCounts(updated);
      } catch (err) {
        console.error('[GuestEveningPage] Vote failed, reverting:', err);
        // Revert optimistic update
        setMyVotes(myVotes);
        persistMyVotes(myVotes);
        setVoteCounts((prev) => ({
          ...prev,
          [wineId]: Math.max(0, (prev[wineId] ?? 0) + (wasVoted ? 1 : -1)),
        }));
      } finally {
        setPendingVotes((prev) => {
          const next = new Set(prev);
          next.delete(wineId);
          return next;
        });
      }
    },
    [shortCode, sessionId, myVotes, pendingVotes, persistMyVotes],
  );

  // ── Render ────────────────────────────────────────────────────────────────
  const lineup: QueuedWine[] = shareData?.lineup ?? [];
  const totalVotes = Object.values(voteCounts).reduce((a, b) => a + b, 0);

  return (
    <div
      className="min-h-screen"
      style={{
        background: 'var(--bg-primary)',
        paddingTop: 'max(1.5rem, var(--safe-top))',
        paddingBottom: 'max(2rem, var(--safe-bottom))',
        paddingLeft: 'max(1rem, var(--safe-left))',
        paddingRight: 'max(1rem, var(--safe-right))',
      }}
    >
      <div className="max-w-lg mx-auto">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          {/* Wordmark */}
          <p className="text-xs uppercase tracking-widest mb-4 font-medium" style={{ color: 'var(--wine-500)' }}>
            Wine Cellar Brain
          </p>

          <h1
            className="text-3xl font-bold mb-2"
            style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
          >
            {loading
              ? 'Tonight\'s Lineup'
              : shareData?.share.plan_name
              ? shareData.share.plan_name
              : "Tonight's Lineup"}
          </h1>
          <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
            Vote for your favorite
          </p>

          {/* Occasion chip */}
          {shareData?.share.occasion && (
            <div className="mt-3 flex justify-center">
              <span
                className="inline-block px-3 py-1.5 rounded-full text-xs font-medium capitalize"
                style={{ background: 'var(--wine-100)', color: 'var(--wine-700)' }}
              >
                {shareData.share.occasion}
              </span>
            </div>
          )}

          {/* Vote tally */}
          {!loading && totalVotes > 0 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-3 text-sm font-medium"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {totalVotes} vote{totalVotes !== 1 ? 's' : ''} so far
            </motion.p>
          )}
        </motion.header>

        {/* ── Error state ──────────────────────────────────────────────── */}
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16"
          >
            <p className="text-5xl mb-4">🍷</p>
            <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              Link unavailable
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {error}
            </p>
          </motion.div>
        )}

        {/* ── Loading skeletons ────────────────────────────────────────── */}
        {loading && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2, 3].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {/* ── Wine cards ───────────────────────────────────────────────── */}
        {!loading && !error && lineup.length > 0 && (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            {lineup.map((wine) => (
              <WineCard
                key={wine.wine_id}
                wine={wine}
                voteCount={voteCounts[wine.wine_id] ?? 0}
                hasVoted={myVotes.has(wine.wine_id)}
                onToggle={() => handleToggleVote(wine.wine_id)}
                votePending={pendingVotes.has(wine.wine_id)}
              />
            ))}
          </motion.div>
        )}

        {/* ── Empty lineup ─────────────────────────────────────────────── */}
        {!loading && !error && lineup.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-4">🍾</p>
            <p className="text-lg font-medium" style={{ color: 'var(--text-secondary)' }}>
              No wines in the lineup yet
            </p>
          </div>
        )}

        {/* ── Footer microcopy ─────────────────────────────────────────── */}
        {!loading && !error && (
          <motion.footer
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-10 text-center space-y-1"
          >
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Your vote is saved on this device
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              No account required · No personal data collected
            </p>
          </motion.footer>
        )}
      </div>
    </div>
  );
}
