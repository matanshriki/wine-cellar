/**
 * Theme Toggle Component
 * 
 * Luxury pill toggle between White (light) and Red (dark) themes.
 * Wine-inspired with smooth animations and premium feel.
 */

import { motion } from 'framer-motion';
import { useTheme } from '../contexts/ThemeContext';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className="relative inline-flex items-center p-1 rounded-full"
      style={{
        background: theme === 'white' 
          ? 'rgba(0, 0, 0, 0.06)'
          : 'rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(10px)',
      }}
    >
      {/* Background slider */}
      <motion.div
        className="absolute rounded-full"
        style={{
          height: '32px',
          width: '72px',
          background: theme === 'white'
            ? 'linear-gradient(135deg, #FFFFFF, #F9F9F9)'
            : 'linear-gradient(135deg, #8B2741, #7A1E2D)',
          boxShadow: theme === 'white'
            ? '0 2px 4px rgba(0, 0, 0, 0.1)'
            : '0 2px 8px rgba(122, 30, 45, 0.4)',
        }}
        animate={{
          x: theme === 'white' ? 0 : 76,
        }}
        transition={{
          type: 'spring',
          stiffness: 400,
          damping: 30,
        }}
      />

      {/* White mode button */}
      <motion.button
        onClick={() => setTheme('white')}
        className="relative z-10 flex items-center justify-center rounded-full"
        style={{
          width: '72px',
          height: '32px',
          color: theme === 'white' ? 'var(--color-stone-900)' : 'var(--text-tertiary)',
        }}
        whileTap={{ scale: 0.95 }}
        aria-label="White theme (light mode)"
      >
        {/* Sun/White wine glass icon */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M8 2h8l-2 12h-4L8 2z" />
          <path d="M12 14v8" />
          <path d="M8 22h8" />
        </svg>
      </motion.button>

      {/* Red mode button */}
      <motion.button
        onClick={() => setTheme('red')}
        className="relative z-10 flex items-center justify-center rounded-full"
        style={{
          width: '72px',
          height: '32px',
          color: theme === 'red' ? '#FFFFFF' : 'var(--text-tertiary)',
        }}
        whileTap={{ scale: 0.95 }}
        aria-label="Red theme (dark mode)"
      >
        {/* Moon/Red wine glass icon */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="currentColor"
          stroke="none"
        >
          <path d="M8 2h8l-2 12h-4L8 2z" />
          <path d="M12 14v8" />
          <path d="M8 22h8" />
        </svg>
      </motion.button>
    </div>
  );
}

/**
 * Compact Theme Toggle (for header)
 * Smaller version suitable for navigation bar
 */
export function CompactThemeToggle() {
  const { theme, setTheme } = useTheme();

  const handleClick = () => {
    const newTheme = theme === 'white' ? 'red' : 'white';
    console.log('[ThemeToggle] Button clicked! Switching from', theme, 'to', newTheme);
    setTheme(newTheme);
  };

  return (
    <motion.button
      onClick={handleClick}
      className="relative flex items-center justify-center rounded-full"
      style={{
        width: '36px',
        height: '36px',
        background: theme === 'white'
          ? 'rgba(0, 0, 0, 0.04)'
          : 'rgba(255, 255, 255, 0.06)',
        color: theme === 'white' ? 'var(--color-stone-700)' : 'var(--text-secondary)',
      }}
      whileHover={{ 
        scale: 1.05,
        background: theme === 'white'
          ? 'rgba(0, 0, 0, 0.08)'
          : 'rgba(255, 255, 255, 0.10)',
      }}
      whileTap={{ scale: 0.95 }}
      aria-label={`Switch to ${theme === 'white' ? 'red' : 'white'} theme`}
    >
      {/* Wine glass icon that changes fill based on theme */}
      <motion.svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill={theme === 'red' ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        animate={{
          rotate: theme === 'red' ? 0 : 0,
        }}
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 20,
        }}
      >
        <path d="M8 2h8l-2 12h-4L8 2z" />
        <path d="M12 14v8" />
        <path d="M8 22h8" />
      </motion.svg>
    </motion.button>
  );
}
