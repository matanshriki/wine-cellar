/**
 * Theme Toggle Component
 * 
 * Luxury toggle switches for light/dark theme.
 * Two variants: full (for settings) and compact (for header).
 */

import { motion } from 'framer-motion';
import { useTheme } from '../contexts/ThemeContext';

/**
 * Full Theme Toggle (for settings page)
 * Premium pill-style segmented control
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="inline-flex rounded-full p-1" style={{
      background: 'var(--bg-muted)',
      border: '1px solid var(--border-subtle)',
    }}>
      {/* Light Theme Button */}
      <motion.button
        onClick={() => setTheme('light')}
        className="relative px-6 py-2 rounded-full text-sm font-medium transition-colors"
        style={{
          background: theme === 'light' ? 'var(--bg-surface)' : 'transparent',
          color: theme === 'light' ? 'var(--text-primary)' : 'var(--text-secondary)',
          boxShadow: theme === 'light' ? 'var(--shadow-sm)' : 'none',
        }}
        whileTap={{ scale: 0.95 }}
        aria-label="Light theme"
      >
        {/* Sun icon */}
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
          <span>Light</span>
        </div>
      </motion.button>

      {/* Dark Theme Button */}
      <motion.button
        onClick={() => setTheme('dark')}
        className="relative px-6 py-2 rounded-full text-sm font-medium transition-colors"
        style={{
          background: theme === 'dark' ? 'var(--bg-surface)' : 'transparent',
          color: theme === 'dark' ? 'var(--text-primary)' : 'var(--text-secondary)',
          boxShadow: theme === 'dark' ? 'var(--shadow-sm)' : 'none',
        }}
        whileTap={{ scale: 0.95 }}
        aria-label="Dark theme"
      >
        {/* Moon icon */}
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
          <span>Dark</span>
        </div>
      </motion.button>
    </div>
  );
}

/**
 * Compact Theme Toggle (for header/nav)
 * Minimal icon-only button
 */
export function CompactThemeToggle() {
  const { theme, setTheme } = useTheme();

  const handleClick = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  };

  return (
    <motion.button
      onClick={handleClick}
      className="relative flex items-center justify-center rounded-full"
      style={{
        width: '36px',
        height: '36px',
        background: theme === 'light'
          ? 'rgba(0, 0, 0, 0.04)'
          : 'rgba(255, 255, 255, 0.06)',
        color: 'var(--text-secondary)',
      }}
      whileTap={{ scale: 0.9 }}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
    >
      {theme === 'light' ? (
        // Moon icon for light mode (click to go dark)
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : (
        // Sun icon for dark mode (click to go light)
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      )}
    </motion.button>
  );
}
