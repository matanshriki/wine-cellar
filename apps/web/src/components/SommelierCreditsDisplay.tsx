/**
 * SommelierCreditsDisplay
 *
 * Shows the user's Sommelier Credit balance. Only renders when
 * monetization_enabled = true for the current user. Returns null for
 * all other users — completely invisible.
 *
 * Props:
 *   onUpgradeClick — optional callback to open the pricing modal.
 *   compact        — renders a smaller inline badge (for nav bars etc.)
 */

import React from 'react';
import { Sparkles, AlertTriangle } from 'lucide-react';
import { useMonetizationAccess } from '../hooks/useMonetizationAccess';
import { getCreditsRequired } from '../lib/creditPolicy';

interface SommelierCreditsDisplayProps {
  onUpgradeClick?: () => void;
  /** Render a condensed single-line badge instead of the full card */
  compact?: boolean;
  /** Highlight cost of a pending action (shown as "–N credits") */
  pendingActionType?: string;
}

export function SommelierCreditsDisplay({
  onUpgradeClick,
  compact = false,
  pendingActionType,
}: SommelierCreditsDisplayProps) {
  const {
    monetizationEnabled,
    creditEnforcementEnabled,
    effectiveBalance,
    isLowBalance,
    balanceLabel,
    monthlyLimit,
    creditsLoading,
  } = useMonetizationAccess();

  // ── Dark launch guard: only render for flagged users ─────────────────────
  if (!monetizationEnabled) return null;
  if (creditsLoading) return null;

  const pendingCost = pendingActionType ? getCreditsRequired(pendingActionType) : 0;
  const isBlocked   = creditEnforcementEnabled && effectiveBalance === 0;

  // ── Compact badge (for nav bar / sidebar) ────────────────────────────────
  // Uses CSS variables so it's visible in both light (white nav) and dark themes.
  if (compact) {
    const badgeStyle: React.CSSProperties = isBlocked
      ? { background: 'rgba(220,38,38,0.1)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.18)' }
      : isLowBalance
      ? { background: 'rgba(217,119,6,0.1)', color: '#d97706', border: '1px solid rgba(217,119,6,0.18)' }
      : {
          background: 'var(--bg-surface)',
          color: 'var(--text-secondary)',
          border: '1px solid var(--border-subtle)',
        };

    return (
      <button
        type="button"
        onClick={onUpgradeClick}
        className="inline-flex items-center gap-1.5 rounded-xl px-2.5 text-xs font-medium transition-opacity hover:opacity-80 active:opacity-60"
        style={{ ...badgeStyle, height: '36px' }}
        aria-label={balanceLabel}
      >
        <Sparkles size={13} />
        <span>{effectiveBalance}</span>
      </button>
    );
  }

  // ── Full card ────────────────────────────────────────────────────────────
  return (
    <div
      className={[
        'rounded-xl border p-4 transition-colors',
        isBlocked
          ? 'border-red-500/30 bg-red-500/5'
          : isLowBalance
          ? 'border-amber-500/30 bg-amber-500/5'
          : 'border-white/10 bg-white/5',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles
            size={16}
            className={
              isBlocked
                ? 'text-red-400'
                : isLowBalance
                ? 'text-amber-400'
                : 'text-white/50'
            }
          />
          <span className="text-sm font-medium text-white/80">Sommelier Credits</span>
        </div>

        {(isLowBalance || isBlocked) && (
          <AlertTriangle size={14} className={isBlocked ? 'text-red-400' : 'text-amber-400'} />
        )}
      </div>

      {/* Balance display */}
      <div className="mt-3">
        <span
          className={[
            'text-2xl font-semibold tabular-nums',
            isBlocked
              ? 'text-red-300'
              : isLowBalance
              ? 'text-amber-300'
              : 'text-white',
          ].join(' ')}
        >
          {effectiveBalance}
        </span>
        {monthlyLimit > 0 && (
          <span className="ml-1 text-sm text-white/40">/ {monthlyLimit}</span>
        )}
      </div>

      {/* Contextual sub-text */}
      <p className="mt-1 text-xs text-white/40">
        {isBlocked
          ? 'All Sommelier Credits used for this period'
          : isLowBalance
          ? 'Running low — consider upgrading for deeper insights'
          : 'Credits reset monthly'}
      </p>

      {/* Pending action cost */}
      {pendingCost > 0 && !isBlocked && (
        <p className="mt-2 text-xs text-white/50">
          This action uses{' '}
          <span className="font-medium text-white/70">{pendingCost} credit{pendingCost !== 1 ? 's' : ''}</span>
        </p>
      )}

      {/* Upgrade CTA (shown when low or blocked) */}
      {(isLowBalance || isBlocked) && onUpgradeClick && (
        <button
          type="button"
          onClick={onUpgradeClick}
          className="mt-3 w-full rounded-lg bg-white/10 py-2 text-xs font-medium text-white/80 transition-colors hover:bg-white/15 active:scale-[0.98]"
        >
          Upgrade for deeper cellar insights and more Sommelier sessions
        </button>
      )}
    </div>
  );
}
