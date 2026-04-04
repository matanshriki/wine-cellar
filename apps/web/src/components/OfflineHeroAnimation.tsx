/**
 * Premium offline hero: horizontal bottle + Wi‑Fi slash, inline SVG + Framer Motion.
 * AppleTV-adjacent micro-motion; PWA-friendly (transforms/lightweight); respects reduced motion.
 */

import { useId } from 'react';
import { motion } from 'framer-motion';

export type OfflineHeroPhase = 'offline' | 'reconnect';

const easeInOut = [0.42, 0, 0.58, 1] as const;

const VB = 512;
const CLIP_X = 80;
const CLIP_Y = 216;
const CLIP_H = 78;
const CLIP_RX = 8;
const WINE_MAX_W = 292;

const W_OFFLINE_LOW = WINE_MAX_W * 0.68;
const W_OFFLINE_HIGH = WINE_MAX_W * 0.72;
const W_OFFLINE_MID = WINE_MAX_W * 0.7;

interface Props {
  phase: OfflineHeroPhase;
  reducedMotion: boolean;
}

export function OfflineHeroAnimation({ phase, reducedMotion }: Props) {
  const uid = useId().replace(/:/g, '');
  const clipId = `wine-clip-${uid}`;

  const rm = reducedMotion;
  const reconnecting = phase === 'reconnect';

  return (
    <div
      className="relative mx-auto flex w-full max-w-[min(100%,320px)] shrink-0 justify-center"
      style={{ aspectRatio: `${VB} / ${VB}` }}
      aria-hidden
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 ${VB} ${VB}`}
        className="h-auto w-full max-h-[min(85vw,320px)]"
        fill="none"
      >
        <defs>
          <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
            <motion.rect
              x={CLIP_X}
              y={CLIP_Y}
              height={CLIP_H}
              rx={CLIP_RX}
              ry={CLIP_RX}
              initial={false}
              animate={
                rm
                  ? { width: W_OFFLINE_MID }
                  : reconnecting
                    ? { width: WINE_MAX_W }
                    : { width: [W_OFFLINE_LOW, W_OFFLINE_HIGH, W_OFFLINE_LOW] }
              }
              transition={
                rm
                  ? { duration: 0 }
                  : reconnecting
                    ? { duration: 0.6, ease: easeInOut }
                    : { duration: 4.2, repeat: Infinity, ease: easeInOut }
              }
            />
          </clipPath>
        </defs>

        {/* A) Glow — soft ellipse, no filters */}
        <motion.g
          id="glow"
          style={{ transformOrigin: '256px 270px', transformBox: 'fill-box' }}
          initial={false}
          animate={
            rm
              ? { opacity: 0.12, scale: 1 }
              : { opacity: [0.1, 0.16, 0.1], scale: [1, 1.02, 1] }
          }
          transition={
            rm
              ? { duration: 0 }
              : { duration: 3.8, repeat: Infinity, ease: easeInOut }
          }
        >
          <ellipse
            cx={256}
            cy={270}
            rx={190}
            ry={118}
            fill="var(--wine-500)"
            fillOpacity={0.22}
          />
        </motion.g>

        {/* Wi‑Fi offline — split arcs + dot + slash */}
        <g id="wifi-offline" stroke="var(--text-secondary)" strokeLinecap="round">
          <motion.path
            id="wifi-arc-1"
            d="M198 122c16.2-12.7 36.8-20 58-20s41.8 7.3 58 20"
            strokeWidth={12}
            fill="none"
            initial={false}
            animate={
              rm
                ? { opacity: 0.35 }
                : reconnecting
                  ? { opacity: [0.35, 1, 0], strokeDashoffset: 0 }
                  : { opacity: [0.2, 0.9, 0.2], strokeDashoffset: [0, -4, 0] }
            }
            transition={
              rm
                ? { duration: 0 }
                : reconnecting
                  ? { duration: 1, ease: easeInOut, times: [0, 0.4, 1] }
                  : {
                      opacity: { duration: 1.8, repeat: Infinity, ease: easeInOut },
                      strokeDashoffset: { duration: 2.2, repeat: Infinity, ease: 'linear' },
                    }
            }
            strokeDasharray="4 10"
          />
          <motion.path
            id="wifi-arc-2"
            d="M220 153.5c10.2-6.5 22.8-10.5 36-10.5s25.8 4 36 10.5"
            strokeWidth={12}
            fill="none"
            initial={false}
            animate={
              rm
                ? { opacity: 0.28 }
                : reconnecting
                  ? { opacity: [0.28, 1, 0] }
                  : { opacity: [0.1, 0.6, 0.1], strokeDashoffset: [0, -6, 0] }
            }
            transition={
              rm
                ? { duration: 0 }
                : reconnecting
                  ? { duration: 1, ease: easeInOut, times: [0, 0.4, 1] }
                  : {
                      opacity: { duration: 2.2, repeat: Infinity, ease: easeInOut },
                      strokeDashoffset: { duration: 2.5, repeat: Infinity, ease: 'linear' },
                    }
            }
            strokeDasharray="3 8"
          />
          <motion.circle
            id="wifi-arc-3"
            cx={256}
            cy={195}
            r={10}
            fill="var(--text-secondary)"
            stroke="none"
            initial={false}
            animate={
              rm
                ? { opacity: 0.22 }
                : reconnecting
                  ? { opacity: [0.22, 1, 0] }
                  : { opacity: [0.05, 0.35, 0.05] }
            }
            transition={
              rm
                ? { duration: 0 }
                : reconnecting
                  ? { duration: 1, ease: easeInOut, times: [0, 0.4, 1] }
                  : { duration: 2.6, repeat: Infinity, ease: easeInOut }
            }
          />
          <motion.line
            x1={170}
            y1={90}
            x2={342}
            y2={220}
            strokeWidth={12}
            initial={false}
            animate={
              rm
                ? { opacity: 0.45 }
                : reconnecting
                  ? { opacity: [0.45, 0.85, 0.2] }
                  : { opacity: [0.25, 0.55, 0.25] }
            }
            transition={
              rm
                ? { duration: 0 }
                : reconnecting
                  ? { duration: 1, times: [0, 0.35, 1], ease: easeInOut }
                  : { duration: 2.4, repeat: Infinity, ease: easeInOut }
            }
          />
        </g>

        <g id="bottle-group" transform="translate(0, 30)">
          {/* B+C) Wine: liquid clip + wave micro-motion */}
          <motion.g
            id="wine-wave"
            clipPath={`url(#${clipId})`}
            style={{ transformOrigin: '226px 255px' }}
            initial={false}
            animate={
              rm
                ? { x: 0, rotate: 0 }
                : reconnecting
                  ? { x: 0, rotate: 0 }
                  : { x: [-6, 6, -6], rotate: [-0.2, 0.2, -0.2] }
            }
            transition={
              rm || reconnecting
                ? { duration: 0 }
                : { duration: 2.9, repeat: Infinity, ease: easeInOut }
            }
          >
            <rect
              id="wine-liquid"
              x={80}
              y={216}
              width={WINE_MAX_W}
              height={78}
              rx={8}
              ry={8}
              fill="var(--wine-700)"
              opacity={reconnecting ? 1 : 0.94}
            />
          </motion.g>

          <g id="bottle-outline" stroke="var(--text-secondary)" strokeLinecap="round" strokeLinejoin="round" fill="none">
            <path
              d="M375 210 H80 c-16.5 0 -30 13.5 -30 30 v30 c0 16.5 13.5 30 30 30 h295"
              strokeWidth={10}
            />
            <path
              d="M375 210 c30 0 35 15 45 25 l45 5 c11 1.2 20 10 20 21 v18 c0 11 -9 19.8 -20 21 l-45 5 c-10 10 -15 25 -45 25"
              strokeWidth={10}
            />
            <path
              d="M60 240s15-15 15 0-15 15-15 0"
              strokeWidth={6}
              opacity={0.6}
            />
            <path
              d="M90 220 h260"
              stroke="var(--text-inverse, #fff)"
              strokeWidth={4}
              opacity={0.25}
            />
          </g>
        </g>
      </svg>
    </div>
  );
}
