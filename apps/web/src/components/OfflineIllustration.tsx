/**
 * Offline hero: readable “no Wi‑Fi” motif + small wine-glass accent (on-brand).
 * Framer Motion; respects reduced motion via props + useReducedMotion.
 */

import { useEffect, useId, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export type OfflineIllustrationPhase = 'offline' | 'reconnect';

type ThemeHint = 'red' | 'white' | 'unknown';

function useDataTheme(): ThemeHint {
  const [theme, setTheme] = useState<ThemeHint>(() => {
    if (typeof document === 'undefined') return 'unknown';
    const t = document.documentElement.getAttribute('data-theme');
    if (t === 'red' || t === 'white') return t;
    return 'unknown';
  });

  useEffect(() => {
    const el = document.documentElement;
    const obs = new MutationObserver(() => {
      const t = el.getAttribute('data-theme');
      setTheme(t === 'red' || t === 'white' ? t : 'unknown');
    });
    obs.observe(el, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  return theme;
}

const easeLuxury = [0.45, 0, 0.55, 1] as const;

interface Props {
  phase: OfflineIllustrationPhase;
  reducedMotion: boolean;
}

export function OfflineIllustration({ phase, reducedMotion }: Props) {
  const rawId = useId().replace(/:/g, '');
  const id = `off-${rawId}`;
  const sysReduce = useReducedMotion();
  const staticMode = reducedMotion || !!sysReduce;
  const theme = useDataTheme();
  const reconnecting = phase === 'reconnect';

  const glowA = theme === 'red' ? 0.12 : 0.07;
  const glowB = theme === 'red' ? 0.04 : 0.025;

  return (
    <div
      className="relative flex justify-center items-center mx-auto shrink-0"
      style={{ width: 168, height: 124 }}
      aria-hidden
    >
      <svg
        width={168}
        height={124}
        viewBox="0 0 168 124"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible"
      >
        <defs>
          <radialGradient id={`${id}-glow`} cx="50%" cy="45%" r="50%">
            <stop offset="0%" stopColor="var(--wine-400)" stopOpacity={glowA} />
            <stop offset="70%" stopColor="var(--wine-300)" stopOpacity={glowB} />
            <stop offset="100%" stopColor="var(--wine-300)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${id}-wine`} x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="var(--wine-500)" />
            <stop offset="100%" stopColor="var(--wine-700)" />
          </linearGradient>
          <clipPath id={`${id}-bowl`}>
            <path d="M 52 98 L 56 112 Q 62 118 70 118 Q 78 118 84 112 L 88 98 Z" />
          </clipPath>
        </defs>

        <motion.g
          animate={staticMode ? { scale: 1 } : { scale: [1, 1.04, 1] }}
          transition={{ duration: 3.2, repeat: staticMode ? 0 : Infinity, ease: easeLuxury }}
          style={{ transformOrigin: '84px 56px' }}
        >
          <circle cx={84} cy={56} r={44} fill={`url(#${id}-glow)`} />
        </motion.g>

        {/* Wi‑Fi arcs — large, obvious */}
        <g stroke="var(--wine-600)" strokeWidth={3} strokeLinecap="round" fill="none">
          <motion.path
            d="M 36 68 Q 84 28 132 68"
            animate={
              reconnecting
                ? { opacity: 1 }
                : staticMode
                  ? { opacity: 0.5 }
                  : { opacity: [0.35, 0.75, 0.35] }
            }
            transition={
              reconnecting
                ? { duration: 0.35, ease: easeLuxury }
                : staticMode
                  ? {}
                  : { duration: 2.8, repeat: Infinity, ease: easeLuxury }
            }
          />
          <motion.path
            d="M 48 68 Q 84 42 120 68"
            animate={
              reconnecting
                ? { opacity: 1 }
                : staticMode
                  ? { opacity: 0.65 }
                  : { opacity: [0.45, 0.9, 0.45] }
            }
            transition={
              reconnecting
                ? { duration: 0.35, ease: easeLuxury }
                : staticMode
                  ? {}
                  : { duration: 2.8, repeat: Infinity, ease: easeLuxury, delay: 0.08 }
            }
          />
          <motion.path
            d="M 60 68 Q 84 52 108 68"
            animate={
              reconnecting
                ? { opacity: 1 }
                : staticMode
                  ? { opacity: 0.8 }
                  : { opacity: [0.55, 1, 0.55] }
            }
            transition={
              reconnecting
                ? { duration: 0.35, ease: easeLuxury }
                : staticMode
                  ? {}
                  : { duration: 2.8, repeat: Infinity, ease: easeLuxury, delay: 0.16 }
            }
          />
        </g>

        <circle cx={84} cy={72} r={4} fill="var(--wine-700)" opacity={0.9} />

        {/* “No signal” slash — hidden when reconnecting */}
        {!reconnecting && (
          <motion.line
            x1={44}
            y1={38}
            x2={124}
            y2={82}
            stroke="var(--text-tertiary)"
            strokeWidth={2.5}
            strokeLinecap="round"
            animate={staticMode ? { opacity: 0.55 } : { opacity: [0.4, 0.75, 0.4] }}
            transition={{ duration: 2.8, repeat: staticMode ? 0 : Infinity, ease: easeLuxury }}
          />
        )}

        {/* Small wine glass — brand tie-in; liquid bobs gently */}
        <path
          d="M 52 98 L 56 112 Q 62 118 70 118 Q 78 118 84 112 L 88 98 Z"
          stroke="var(--border-medium)"
          strokeWidth={1.2}
          fill="var(--bg-surface)"
          fillOpacity={0.2}
        />
        <g clipPath={`url(#${id}-bowl)`}>
          <motion.rect
            x={52}
            width={36}
            fill={`url(#${id}-wine)`}
            opacity={0.85}
            initial={false}
            animate={{
              y: reconnecting ? 100 : 104,
              height: reconnecting ? 18 : 14,
            }}
            transition={{
              duration: reconnecting ? (staticMode ? 0.12 : 0.55) : 0,
              ease: easeLuxury,
            }}
          />
          {!staticMode && !reconnecting && (
            <motion.rect
              x={52}
              y={102}
              width={36}
              height={4}
              fill="var(--wine-400)"
              fillOpacity={0.45}
              animate={{ x: [51.5, 52.5, 51.5] }}
              transition={{ duration: 3.4, repeat: Infinity, ease: easeLuxury }}
            />
          )}
        </g>
        <path d="M 68 118 L 68 122 M 72 118 L 72 122" stroke="var(--border-medium)" strokeWidth={1.5} strokeLinecap="round" />
        <line x1={64} y1={122} x2={76} y2={122} stroke="var(--border-medium)" strokeWidth={1.5} strokeLinecap="round" />
      </svg>
    </div>
  );
}
