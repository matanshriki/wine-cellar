/**
 * Theme Toggle Component
 * 
 * Luxury toggle switches for light/dark theme.
 * Two variants: full (for settings) and compact (for header).
 */

import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { useWinePour } from './WinePourTransition';

/**
 * Full Theme Toggle (for settings page)
 * Premium pill-style segmented control
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();

  return (
    <div className="inline-flex rounded-full p-1" style={{
      background: 'var(--bg-muted)',
      border: '1px solid var(--border-subtle)',
    }}>
      {/* White Theme Button */}
      <motion.button
        onClick={() => setTheme('white')}
        className="relative px-5 min-h-[40px] rounded-full text-sm font-semibold transition-colors"
        style={{
          background: theme === 'white' ? 'var(--bg-surface)' : 'transparent',
          color: theme === 'white' ? 'var(--text-heading)' : 'var(--text-secondary)',
          boxShadow: theme === 'white' ? 'var(--shadow-card)' : 'none',
        }}
        whileTap={{ scale: 0.95 }}
        aria-pressed={theme === 'white'}
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
          <span>{t('profile.theme.light')}</span>
        </div>
      </motion.button>

      {/* Red Theme Button */}
      <motion.button
        onClick={() => setTheme('red')}
        className="relative px-5 min-h-[40px] rounded-full text-sm font-semibold transition-colors"
        style={{
          background: theme === 'red' ? 'var(--bg-surface)' : 'transparent',
          color: theme === 'red' ? 'var(--text-heading)' : 'var(--text-secondary)',
          boxShadow: theme === 'red' ? 'var(--shadow-card)' : 'none',
        }}
        whileTap={{ scale: 0.95 }}
        aria-pressed={theme === 'red'}
      >
        {/* Moon icon */}
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
          <span>{t('profile.theme.dark')}</span>
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
  const winePour = useWinePour();
  const { t } = useTranslation();

  const handleClick = () => {
    const newTheme = theme === 'white' ? 'red' : 'white';

    if (winePour) {
      winePour.triggerPour(newTheme, () => setTheme(newTheme));
    } else {
      setTheme(newTheme);
    }
  };

  return (
    <motion.button
      onClick={handleClick}
      className="relative flex items-center justify-center rounded-full transition-colors hover:bg-[var(--interactive-hover)]"
      style={{
        width: '40px',
        height: '40px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        color: 'var(--text-secondary)',
      }}
      whileTap={{ scale: 0.9 }}
      aria-label={theme === 'white' ? t('profile.theme.switchToDark') : t('profile.theme.switchToLight')}
    >
      {theme === 'white' ? (
        // Moon icon for white mode (click to go red/dark)
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : (
        // Sun icon for red mode (click to go white/light)
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
