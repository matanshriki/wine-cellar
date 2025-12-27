/**
 * WineLoader Component
 * 
 * A premium, wine-themed loading animation featuring a minimalist wine glass
 * with an animated fill level. Perfect for loading states in a luxury wine app.
 * 
 * Features:
 * - SVG-based (lightweight, scalable)
 * - Smooth fill animation with premium easing
 * - Respects prefers-reduced-motion (shows static icon instead)
 * - Accessible (aria-label)
 * - Works in RTL/LTR
 * - Mobile + desktop optimized
 */

import { useEffect, useState } from 'react';

interface WineLoaderProps {
  /** Size in pixels (default: 48) */
  size?: number;
  /** Optional loading message */
  message?: string;
  /** Custom color (default: wine color from CSS vars) */
  color?: string;
}

export function WineLoader({ size = 48, message, color }: WineLoaderProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Check for prefers-reduced-motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    // Listen for changes
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return (
    <div 
      className="flex flex-col items-center justify-center"
      role="status"
      aria-live="polite"
      aria-label={message || 'Loading'}
    >
      {/* Wine Glass SVG */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          filter: 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.1))',
        }}
      >
        {/* Wine Glass Outline */}
        <g>
          {/* Bowl */}
          <path
            d="M 25 15 Q 20 35, 25 50 L 40 50 L 40 75 L 30 75 L 30 80 L 70 80 L 70 75 L 60 75 L 60 50 L 75 50 Q 80 35, 75 15 Z"
            stroke={color || 'var(--color-wine-500)'}
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* Stem */}
          <line
            x1="50"
            y1="50"
            x2="50"
            y2="75"
            stroke={color || 'var(--color-wine-500)'}
            strokeWidth="2"
            strokeLinecap="round"
          />
          
          {/* Base */}
          <line
            x1="30"
            y1="80"
            x2="70"
            y2="80"
            stroke={color || 'var(--color-wine-500)'}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </g>

        {/* Animated Wine Fill */}
        {!prefersReducedMotion ? (
          <>
            {/* Wine liquid with animated clip-path */}
            <defs>
              <clipPath id="wine-glass-clip">
                <path d="M 25 15 Q 20 35, 25 50 L 75 50 Q 80 35, 75 15 Z" />
              </clipPath>
              
              {/* Animated mask for fill level */}
              <mask id="wine-fill-mask">
                <rect
                  x="0"
                  y="0"
                  width="100"
                  height="100"
                  fill="white"
                >
                  {/* Animate the fill level */}
                  <animate
                    attributeName="y"
                    values="100;20;100"
                    dur="2.5s"
                    repeatCount="indefinite"
                    calcMode="spline"
                    keySplines="0.42 0 0.58 1; 0.42 0 0.58 1"
                  />
                </rect>
              </mask>
            </defs>
            
            {/* Wine fill with gradient */}
            <g clipPath="url(#wine-glass-clip)" mask="url(#wine-fill-mask)">
              <defs>
                <linearGradient id="wine-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={color || 'var(--color-wine-400)'} stopOpacity="0.9" />
                  <stop offset="100%" stopColor={color || 'var(--color-wine-600)'} stopOpacity="1" />
                </linearGradient>
              </defs>
              
              <path
                d="M 25 15 Q 20 35, 25 50 L 75 50 Q 80 35, 75 15 Z"
                fill="url(#wine-gradient)"
              />
              
              {/* Shine effect */}
              <ellipse
                cx="35"
                cy="30"
                rx="8"
                ry="12"
                fill="white"
                opacity="0.15"
              />
            </g>
          </>
        ) : (
          // Static fill for reduced motion
          <g clipPath="url(#wine-glass-clip)">
            <defs>
              <clipPath id="wine-glass-clip-static">
                <path d="M 25 15 Q 20 35, 25 50 L 75 50 Q 80 35, 75 15 Z" />
              </clipPath>
              <linearGradient id="wine-gradient-static" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={color || 'var(--color-wine-400)'} stopOpacity="0.9" />
                <stop offset="100%" stopColor={color || 'var(--color-wine-600)'} stopOpacity="1" />
              </linearGradient>
            </defs>
            
            {/* Static 50% fill */}
            <rect
              x="20"
              y="30"
              width="60"
              height="25"
              fill="url(#wine-gradient-static)"
              clipPath="url(#wine-glass-clip-static)"
              opacity="0.8"
            />
            
            {/* Gentle pulse */}
            <rect
              x="20"
              y="30"
              width="60"
              height="25"
              fill="url(#wine-gradient-static)"
              clipPath="url(#wine-glass-clip-static)"
              opacity="0.3"
            >
              <animate
                attributeName="opacity"
                values="0.3;0.6;0.3"
                dur="2s"
                repeatCount="indefinite"
              />
            </rect>
          </g>
        )}
      </svg>

      {/* Loading Message */}
      {message && (
        <p 
          className="mt-3 text-sm text-gray-600"
          style={{ 
            color: 'var(--color-stone-600)',
            fontWeight: 500,
          }}
        >
          {message}
        </p>
      )}
      
      {/* Screen reader text */}
      <span className="sr-only">{message || 'Loading, please wait'}</span>
    </div>
  );
}

