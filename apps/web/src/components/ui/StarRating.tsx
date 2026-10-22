import { useTranslation } from 'react-i18next';
import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number;
  max?: number;
  size?: number;
  showValue?: boolean;
  className?: string;
}

/** Read-only star rating with fractional fill; announced once as "x out of 5". */
export function StarRating({ rating, max = 5, size = 14, showValue = true, className = '' }: StarRatingProps) {
  const { t } = useTranslation();
  const clamped = Math.max(0, Math.min(max, rating));

  return (
    <span
      className={`inline-flex items-center gap-0.5 ${className}`}
      role="img"
      aria-label={t('common.ratingOutOf', { rating: clamped.toFixed(1), max })}
    >
      {Array.from({ length: max }, (_, i) => {
        const fill = Math.max(0, Math.min(1, clamped - i));
        return (
          <span key={i} className="relative inline-flex" style={{ width: size, height: size }} aria-hidden>
            <Star width={size} height={size} strokeWidth={1.75} style={{ color: 'var(--text-tertiary)' }} />
            {fill > 0 && (
              <span
                className="absolute inset-y-0 start-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
              >
                <Star
                  width={size}
                  height={size}
                  strokeWidth={1.75}
                  style={{ color: 'var(--rating-star)', fill: 'var(--rating-star)' }}
                />
              </span>
            )}
          </span>
        );
      })}
      {showValue && (
        <span className="text-xs font-medium ms-1 tabular-nums" style={{ color: 'var(--text-secondary)' }} aria-hidden>
          {clamped.toFixed(1)}
        </span>
      )}
    </span>
  );
}
