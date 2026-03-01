import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { shouldReduceMotion } from '../utils/pwaAnimationFix';

interface Props {
  message?: string;
  showProgress?: boolean;
  progress?: number; // 0-100
}

export function WineLoadingAnimation({ message, showProgress = false, progress = 0 }: Props) {
  const { t } = useTranslation();
  const [fillLevel, setFillLevel] = useState(0);
  const [isVisible, setIsVisible] = useState(document.visibilityState === 'visible');

  // PWA animation fix: Monitor visibility to restart animation when returning to app
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(document.visibilityState === 'visible');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    // PWA animation fix: Only animate when visible
    if (!isVisible) return;

    if (showProgress) {
      // Use provided progress
      setFillLevel(progress);
    } else {
      // Animate continuously
      const interval = setInterval(() => {
        setFillLevel((prev) => {
          if (prev >= 100) return 0;
          return prev + 2;
        });
      }, 50);
      return () => clearInterval(interval);
    }
  }, [showProgress, progress, isVisible]);

  return (
    <div className="flex flex-col items-center justify-center py-8 sm:py-12">
      {/* Wine Glass Animation */}
      <div className="relative w-32 h-32 sm:w-40 sm:h-40 mb-6">
        {/* Glass Outline */}
        <svg
          viewBox="0 0 100 140"
          className="w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Glass bowl (trapezoid) */}
          <path
            d="M 20 20 L 35 80 L 65 80 L 80 20 Z"
            fill="transparent"
            stroke="var(--wine-500)"
            strokeWidth="2"
            className="wine-glass-outline"
          />
          
          {/* Glass stem */}
          <line
            x1="50"
            y1="80"
            x2="50"
            y2="110"
            stroke="var(--wine-500)"
            strokeWidth="2"
          />
          
          {/* Glass base */}
          <line
            x1="35"
            y1="110"
            x2="65"
            y2="110"
            stroke="var(--wine-500)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          
          {/* Wine fill (animated) */}
          <defs>
            <linearGradient id="wineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="var(--wine-400)" stopOpacity="0.9" />
              <stop offset="100%" stopColor="var(--wine-600)" stopOpacity="1" />
            </linearGradient>
            
            <clipPath id="glassClip">
              <path d="M 20 20 L 35 80 L 65 80 L 80 20 Z" />
            </clipPath>
          </defs>
          
          {/* Animated wine fill */}
          <g clipPath="url(#glassClip)">
            <rect
              x="20"
              y={80 - (fillLevel * 0.6)} // 60px max fill height
              width="60"
              height="60"
              fill="url(#wineGradient)"
              className="transition-all duration-300 ease-out"
            />
            
            {/* Wine surface (with slight wave) */}
            <ellipse
              cx="50"
              cy={80 - (fillLevel * 0.6)}
              rx="15"
              ry="2"
              fill="var(--wine-500)"
              opacity="0.8"
              className="animate-pulse"
            />
          </g>
          
          {/* Bubbles */}
          {fillLevel > 20 && (
            <>
              <circle cx="40" cy={70 - (fillLevel * 0.4)} r="1.5" fill="var(--wine-300)" opacity="0.6" className="animate-ping" />
              <circle cx="60" cy={65 - (fillLevel * 0.5)} r="1" fill="var(--wine-300)" opacity="0.7" className="animate-ping" style={{ animationDelay: '0.3s' }} />
              <circle cx="45" cy={60 - (fillLevel * 0.5)} r="1.2" fill="var(--wine-300)" opacity="0.5" className="animate-ping" style={{ animationDelay: '0.6s' }} />
            </>
          )}
        </svg>
        
        {/* Sparkle effect */}
        {fillLevel > 50 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-4xl animate-bounce">✨</div>
          </div>
        )}
      </div>

      {/* Loading Message */}
      <div className="text-center space-y-2">
        <p 
          className="text-base sm:text-lg font-semibold"
          style={{ color: 'var(--text-heading)' }}
        >
          {message || t('loading.importing')}
        </p>
        
        {showProgress && (
          <div className="w-48 sm:w-64 mx-auto">
            <div 
              className="h-2 rounded-full overflow-hidden"
              style={{ background: 'var(--bg-muted)' }}
            >
              <div
                className="h-full transition-all duration-300 ease-out"
                style={{ 
                  width: `${progress}%`,
                  background: 'linear-gradient(135deg, var(--wine-500), var(--wine-600))',
                }}
              />
            </div>
            <p 
              className="text-xs sm:text-sm mt-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              {Math.round(progress)}%
            </p>
          </div>
        )}
        
        {!showProgress && (
          <p 
            className="text-xs sm:text-sm"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {t('loading.pleaseWait')}
          </p>
        )}
      </div>

      {/* Animated dots */}
      <div className="flex gap-1 mt-4">
        <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--wine-500)', animationDelay: '0s' }}></div>
        <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--wine-500)', animationDelay: '0.2s' }}></div>
        <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--wine-500)', animationDelay: '0.4s' }}></div>
      </div>
    </div>
  );
}

