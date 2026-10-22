import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Wine, Sparkles } from 'lucide-react';

interface WineImageProps {
  src: string | null | undefined;
  alt: string;
  /** Sizing classes for the frame, e.g. "w-16 h-20" */
  className?: string;
  style?: CSSProperties;
  isGenerated?: boolean;
  isLoading?: boolean;
  loading?: 'lazy' | 'eager';
  /** Called once when the image fails, before the placeholder is shown (e.g. to refresh a signed URL). */
  onError?: () => void;
  /** Show "Image unavailable" under the placeholder after a load failure. */
  showUnavailableText?: boolean;
  iconSize?: number;
}

/**
 * Shared bottle/label image frame: never stretches (object-fit: contain on a
 * themed surface) and falls back to a theme-aware placeholder.
 */
export function WineImage({
  src,
  alt,
  className = '',
  style,
  isGenerated = false,
  isLoading = false,
  loading = 'lazy',
  onError,
  showUnavailableText = false,
  iconSize = 28,
}: WineImageProps) {
  const { t } = useTranslation();
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = !!src && failedSrc === src;

  if (isLoading) {
    return <div className={`app-wine-frame app-skeleton ${className}`} style={style} aria-hidden />;
  }

  return (
    <div className={`app-wine-frame ${className}`} style={style}>
      {src && !failed ? (
        <img
          src={src}
          alt={alt}
          loading={loading}
          decoding="async"
          onError={() => {
            setFailedSrc(src);
            onError?.();
          }}
        />
      ) : (
        <div className="app-wine-placeholder" role="img" aria-label={alt}>
          <Wine width={iconSize} height={iconSize} strokeWidth={1.5} aria-hidden />
          {failed && showUnavailableText && (
            <span className="text-[10px] leading-tight px-1 text-center" style={{ color: 'var(--text-tertiary)' }}>
              {t('cellar.imageUnavailable')}
            </span>
          )}
        </div>
      )}
      {isGenerated && src && !failed && (
        <span
          className="absolute top-1 start-1 inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-semibold"
          style={{ background: 'rgba(0,0,0,0.7)', color: '#fff' }}
          title={t('a11y.aiLabelArt')}
        >
          <Sparkles className="h-2.5 w-2.5" strokeWidth={2} aria-hidden />
          AI
        </span>
      )}
    </div>
  );
}
