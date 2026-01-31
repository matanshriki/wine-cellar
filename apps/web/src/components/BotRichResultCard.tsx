/**
 * Bot Rich Result Card
 * 
 * Premium container for rich agent responses (multi-bottle carousels, etc.)
 * Wider than normal chat bubbles, luxury card styling
 */

import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface BotRichResultCardProps {
  summary?: string | null;
  children: ReactNode;
  onViewAll?: () => void;
}

export function BotRichResultCard({ summary, children, onViewAll }: BotRichResultCardProps) {
  const { t } = useTranslation();

  return (
    <div
      className="bot-rich-result"
      style={{
        width: '100%',
        maxWidth: '100%',
        padding: '20px',
        borderRadius: '20px',
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-light)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
      }}
    >
      {/* Optional summary */}
      {summary && (
        <p
          style={{
            fontSize: '14px',
            color: 'var(--text-secondary)',
            marginBottom: '16px',
            lineHeight: '1.5',
          }}
        >
          {summary}
        </p>
      )}

      {/* Rich content (carousel, etc) */}
      <div style={{ marginBottom: onViewAll ? '16px' : 0 }}>
        {children}
      </div>

      {/* Optional "View all" action */}
      {onViewAll && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onViewAll}
            style={{
              padding: '8px 16px',
              border: '1px solid var(--wine-600)',
              borderRadius: '8px',
              backgroundColor: 'transparent',
              color: 'var(--wine-600)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--wine-50)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            {t('common.viewAll', 'View all')} →
          </button>
        </div>
      )}
    </div>
  );
}
