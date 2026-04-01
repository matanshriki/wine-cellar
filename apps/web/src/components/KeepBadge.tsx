/**
 * KeepBadge — premium "Keep / Reserved" chip shown on bottle cards and modals.
 *
 * Matches the app's existing luxury badge system (blur/soft border, CSS vars).
 * Shows event name + optional date on hover via a tooltip.
 */

import { useTranslation } from 'react-i18next';

interface KeepBadgeProps {
  reservedFor?: string | null;
  reservedDate?: string | null;
  /** 'sm' = compact card badge (default), 'md' = modal/details section badge */
  size?: 'sm' | 'md';
  className?: string;
}

export function KeepBadge({ reservedFor, reservedDate, size = 'sm', className = '' }: KeepBadgeProps) {
  const { t, i18n } = useTranslation();

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString(i18n.language, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const tooltipParts: string[] = [];
  if (reservedFor) tooltipParts.push(t('cellar.bottle.keepReservedFor', { name: reservedFor }));
  else tooltipParts.push(t('cellar.bottle.keepTooltip'));
  if (reservedDate) tooltipParts.push(t('cellar.bottle.keepDate', { date: formatDate(reservedDate) }));

  const tooltip = tooltipParts.join(' · ');

  const label = t('cellar.bottle.keepBadge');

  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    borderRadius: '9999px',
    fontWeight: 600,
    letterSpacing: '0.01em',
    cursor: 'default',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    background: 'linear-gradient(135deg, rgba(212,175,55,0.12), rgba(180,140,30,0.18))',
    border: '1px solid rgba(212,175,55,0.35)',
    color: 'var(--gold-700, #92660a)',
    boxShadow: '0 1px 4px rgba(212,175,55,0.15)',
    whiteSpace: 'nowrap',
    ...(size === 'sm'
      ? { fontSize: '10px', padding: '2px 8px', lineHeight: '16px' }
      : { fontSize: '12px', padding: '4px 12px', lineHeight: '18px' }),
  };

  return (
    <span
      style={baseStyle}
      className={className}
      title={tooltip}
      aria-label={tooltip}
    >
      {/* Lock icon */}
      <svg
        style={{ flexShrink: 0 }}
        width={size === 'sm' ? 9 : 11}
        height={size === 'sm' ? 9 : 11}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      {label}
    </span>
  );
}
