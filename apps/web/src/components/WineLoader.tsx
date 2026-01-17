/**
 * WineLoader Component
 * 
 * A premium, wine-themed loading animation featuring a minimalist wine glass
 * with an animated fill level. Perfect for loading states in a luxury wine app.
 * 
 * Features:
 * - SVG-based (lightweight, scalable)
 * - CSS animations for mobile compatibility (no SMIL)
 * - Smooth fill animation with premium easing
 * - Respects prefers-reduced-motion (shows static icon instead)
 * - Accessible (aria-label)
 * - Works in RTL/LTR
 * - Mobile + desktop optimized
 * - Multiple variants (page, inline, small)
 * - No layout shift (reserves space)
 * 
 * @example
 * // Full-page loading
 * <WineLoader variant="page" message="Loading your cellar..." />
 * 
 * @example
 * // Inline loading
 * <WineLoader variant="inline" size="sm" />
 * 
 * @example
 * // Custom size
 * <WineLoader size={64} message="Processing..." />
 */

import { useEffect, useState, useRef } from 'react';
import { shouldReduceMotion, ensureAnimationOnVisible } from '../utils/pwaAnimationFix';

type LoaderVariant = 'page' | 'inline' | 'default';
type LoaderSize = 'sm' | 'md' | 'lg' | number;

interface WineLoaderProps {
  /** 
   * Visual variant
   * - 'page': Full-page centered loader with min-height
   * - 'inline': Compact inline loader
   * - 'default': Standard centered loader
   */
  variant?: LoaderVariant;
  /** 
   * Size preset or custom pixel value
   * - 'sm': 32px
   * - 'md': 48px (default)
   * - 'lg': 64px
   * - number: Custom size in pixels
   */
  size?: LoaderSize;
  /** Optional loading message */
  message?: string;
  /** Custom color (default: wine color from CSS vars) */
  color?: string;
  /** Additional CSS classes for the container */
  className?: string;
}

export function WineLoader({ 
  variant = 'default', 
  size = 'md', 
  message, 
  color,
  className = '' 
}: WineLoaderProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => shouldReduceMotion());
  const [fillLevel, setFillLevel] = useState(100);
  const [isVisible, setIsVisible] = useState(document.visibilityState === 'visible');
  const animationRef = useRef<number>();

  // PWA animation fix: Check for ACTUAL reduced motion preference (not PWA false positive)
  useEffect(() => {
    setPrefersReducedMotion(shouldReduceMotion());

    // Listen for visibility changes to restart animation in PWA
    const handleVisibilityChange = () => {
      const visible = document.visibilityState === 'visible';
      setIsVisible(visible);
      if (visible) {
        console.log('[WineLoader] Page visible - restarting animation');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, []);

  // PWA animation fix: CSS-based animation using requestAnimationFrame
  // Restarts when page becomes visible (PWA coming from background)
  useEffect(() => {
    if (prefersReducedMotion) return;

    const duration = 2500; // 2.5 seconds per cycle
    let startTime: number | null = null;
    let isAnimating = false;

    const animate = (timestamp: number) => {
      if (!isAnimating) return;
      
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = (elapsed % duration) / duration;

      // Ease in-out cubic function
      const easeInOutCubic = (t: number): number => {
        return t < 0.5
          ? 4 * t * t * t
          : 1 - Math.pow(-2 * t + 2, 3) / 2;
      };

      // Animate from 100 (bottom) to 20 (top) and back
      const easedProgress = easeInOutCubic(progress < 0.5 ? progress * 2 : (1 - progress) * 2);
      const newFillLevel = 100 - (easedProgress * 80); // 100 to 20

      setFillLevel(newFillLevel);

      animationRef.current = requestAnimationFrame(animate);
    };

    const startAnimation = () => {
      console.log('[WineLoader] Starting animation, visible:', isVisible);
      if (!isVisible) return; // Don't animate if not visible
      
      isAnimating = true;
      startTime = null; // Reset start time
      animationRef.current = requestAnimationFrame(animate);
    };

    // PWA animation fix: Start animation when visible
    if (isVisible) {
      // Use ensureAnimationOnVisible to handle PWA background start
      const cleanup = ensureAnimationOnVisible(startAnimation);
      
      return () => {
        isAnimating = false;
        cleanup();
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    } else {
      // Stop animation when hidden
      isAnimating = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }
  }, [prefersReducedMotion, isVisible]);

  // Convert size to pixels
  const sizeInPixels = typeof size === 'number' 
    ? size 
    : size === 'sm' 
      ? 32 
      : size === 'lg' 
        ? 64 
        : 48; // default to 'md'

  // Determine container classes based on variant
  const containerClasses = variant === 'page'
    ? 'flex flex-col items-center justify-center min-h-[60vh]'
    : variant === 'inline'
      ? 'inline-flex flex-col items-center justify-center'
      : 'flex flex-col items-center justify-center';

  return (
    <div 
      className={`${containerClasses} ${className}`}
      role="status"
      aria-live="polite"
      aria-label={message || 'Loading'}
    >
      {/* Wine Glass SVG */}
      <svg
        width={sizeInPixels}
        height={sizeInPixels}
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
            stroke={color || 'var(--wine-500)'}
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
            stroke={color || 'var(--wine-500)'}
            strokeWidth="2"
            strokeLinecap="round"
          />
          
          {/* Base */}
          <line
            x1="30"
            y1="80"
            x2="70"
            y2="80"
            stroke={color || 'var(--wine-500)'}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </g>

        {/* Wine Fill - Using React state with transform for mobile compatibility */}
        <defs>
          <clipPath id={`wine-glass-clip-${sizeInPixels}`}>
            <path d="M 25 15 Q 20 35, 25 50 L 75 50 Q 80 35, 75 15 Z" />
          </clipPath>
          
          <linearGradient id={`wine-gradient-${sizeInPixels}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color || 'var(--wine-400)'} stopOpacity="0.9" />
            <stop offset="100%" stopColor={color || 'var(--wine-600)'} stopOpacity="1" />
          </linearGradient>
        </defs>
        
        {!prefersReducedMotion ? (
          <>
            {/* Animated wine fill using clipPath and transform */}
            <g clipPath={`url(#wine-glass-clip-${sizeInPixels})`}>
              {/* Wine liquid - positioned and transformed */}
              <rect
                x="20"
                y="0"
                width="60"
                height="100"
                fill={`url(#wine-gradient-${sizeInPixels})`}
                style={{
                  transform: `translateY(${fillLevel}%)`,
                  transformOrigin: 'center',
                  willChange: 'transform',
                }}
              />
              
              {/* Shine effect */}
              <ellipse
                cx="35"
                cy="30"
                rx="8"
                ry="12"
                fill="white"
                opacity="0.15"
                style={{
                  transform: `translateY(${fillLevel * 0.5}%)`,
                  willChange: 'transform',
                }}
              />
            </g>
          </>
        ) : (
          // Static fill for reduced motion
          <g clipPath={`url(#wine-glass-clip-${sizeInPixels})`}>
            {/* Static 50% fill */}
            <rect
              x="20"
              y="30"
              width="60"
              height="25"
              fill={`url(#wine-gradient-${sizeInPixels})`}
              opacity="0.7"
            />
          </g>
        )}
      </svg>

      {/* Loading Message */}
      {message && (
        <p 
          className="mt-3 text-sm"
          style={{ 
            color: 'var(--text-secondary)',
            fontWeight: 500,
            fontFamily: 'var(--font-body)',
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


