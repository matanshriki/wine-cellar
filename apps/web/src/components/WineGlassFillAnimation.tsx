/**
 * Wine Glass Fill Animation
 * 
 * A celebratory animation showing a wine glass filling up.
 * Used in success states after opening a bottle.
 */

import { motion } from 'framer-motion';

interface WineGlassFillAnimationProps {
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = {
  sm: { container: 48, glass: 32 },
  md: { container: 72, glass: 48 },
  lg: { container: 96, glass: 64 },
};

export function WineGlassFillAnimation({ size = 'md' }: WineGlassFillAnimationProps) {
  const dimensions = SIZES[size];

  return (
    <div 
      className="relative flex items-center justify-center"
      style={{ width: dimensions.container, height: dimensions.container }}
    >
      {/* Glow effect */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(164, 76, 104, 0.3) 0%, transparent 70%)',
        }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1.5, opacity: [0, 1, 0.5] }}
        transition={{ duration: 1, ease: 'easeOut' }}
      />

      {/* Wine glass SVG */}
      <motion.svg
        viewBox="0 0 64 64"
        style={{ width: dimensions.glass, height: dimensions.glass }}
        initial={{ scale: 0, rotate: -10 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        {/* Glass outline */}
        <path
          d="M20 8 C20 8 18 20 18 26 C18 34 24 40 32 40 C40 40 46 34 46 26 C46 20 44 8 44 8"
          fill="none"
          stroke="var(--wine-300)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        
        {/* Wine fill - animated */}
        <motion.path
          d="M21 24 C21 24 20 26 20 28 C20 34 25 38 32 38 C39 38 44 34 44 28 C44 26 43 24 43 24 C43 24 40 22 32 22 C24 22 21 24 21 24 Z"
          fill="var(--wine-500)"
          initial={{ scale: 0, y: 10 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5, ease: 'easeOut' }}
        />

        {/* Stem */}
        <path
          d="M32 40 L32 52"
          stroke="var(--wine-300)"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Base */}
        <path
          d="M24 52 L40 52"
          stroke="var(--wine-300)"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Shine effect */}
        <motion.ellipse
          cx="26"
          cy="20"
          rx="3"
          ry="6"
          fill="white"
          opacity="0.3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          transition={{ delay: 0.6 }}
        />
      </motion.svg>

      {/* Sparkles */}
      {[...Array(3)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute text-yellow-400"
          style={{
            fontSize: size === 'lg' ? 16 : size === 'md' ? 12 : 8,
          }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ 
            scale: [0, 1, 0],
            opacity: [0, 1, 0],
            x: [0, (i - 1) * 20],
            y: [0, -15 - i * 5],
          }}
          transition={{ 
            delay: 0.5 + i * 0.15,
            duration: 0.6,
            ease: 'easeOut',
          }}
        >
          ✨
        </motion.div>
      ))}
    </div>
  );
}
