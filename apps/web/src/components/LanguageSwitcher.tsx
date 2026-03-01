/**
 * Language Switcher Component
 * 
 * Provides a UI for users to switch between supported languages (English and Hebrew).
 * 
 * Features:
 * - Visual flag indicators for each language
 * - Persists selection to localStorage
 * - Automatically updates document direction (RTL for Hebrew, LTR for English)
 * - Accessible keyboard navigation
 * - Clean dropdown design
 * 
 * Usage:
 * <LanguageSwitcher />
 */

import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { languages, changeLanguage, type LanguageCode } from '../i18n/config';
import { trackLocalization } from '../services/analytics';

export function LanguageSwitcher() {
  // Get i18n utilities
  const { i18n, t } = useTranslation();
  
  // Dropdown open/close state
  const [isOpen, setIsOpen] = useState(false);
  
  // Reference to dropdown for click-outside detection
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get current language
  const currentLang = i18n.language as LanguageCode;
  const currentLanguage = languages[currentLang] || languages.en;

  /**
   * Handle language change
   * Updates i18n, localStorage, and document direction
   */
  const handleLanguageChange = async (langCode: LanguageCode) => {
    await changeLanguage(langCode);
    trackLocalization.changeLanguage(langCode); // Track language change
    setIsOpen(false);
  };

  /**
   * Close dropdown when clicking outside
   * Delay adding the listener to prevent the opening click from immediately closing the dropdown
   */
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    // Wait for next event loop before adding click-outside listener
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      {/**
       * Language Toggle Button
       * 
       * Mobile Optimizations:
       * - Minimum 44x44px touch target (iOS/Apple guidelines)
       * - Adequate padding for comfortable tapping
       * - Large tap area with visual feedback
       * - Reduced gap on mobile for smaller screens
       */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent min-h-[44px] min-w-[44px]"
        style={{
          background: 'var(--bg-surface)',
          borderColor: 'var(--border-medium)',
        }}
        aria-label={t('languageSwitcher.changeLanguage')}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {/* Current language flag - slightly smaller on mobile */}
        <span className="text-lg sm:text-xl" role="img" aria-label={currentLanguage.name}>
          {currentLanguage.flag}
        </span>
        
        {/* Current language code - responsive sizing */}
        <span 
          className="text-xs sm:text-sm font-medium uppercase"
          style={{ color: 'var(--text-secondary)' }}
        >
          {currentLanguage.code}
        </span>
        
        {/* Dropdown arrow - responsive sizing */}
        <svg
          className={`w-3 h-3 sm:w-4 sm:h-4 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
          style={{ color: 'var(--text-tertiary)' }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/**
       * Dropdown Menu
       * 
       * Mobile Optimizations:
       * - Full-width on mobile for easier tapping
       * - Larger touch targets (min 48px height)
       * - Better positioning (accounts for RTL)
       * - Smooth animations
       * - Shadow for depth perception
       */}
      {isOpen && (
        <div
          className="absolute right-0 rtl:right-auto rtl:left-0 mt-2 w-48 sm:w-56 rounded-lg py-1 z-50 animate-fadeIn"
          style={{
            background: 'var(--bg-dropdown)',
            boxShadow: 'var(--shadow-dropdown)',
            border: '1px solid var(--border-subtle)',
          }}
          role="menu"
          aria-orientation="vertical"
        >
          {/* Map through all supported languages */}
          {Object.entries(languages).map(([code, lang]) => {
            const isActive = code === currentLang;
            
            return (
              <button
                key={code}
                onClick={() => handleLanguageChange(code as LanguageCode)}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors min-h-[48px]"
                style={{
                  background: isActive ? 'var(--wine-50)' : 'transparent',
                  color: isActive ? 'var(--wine-700)' : 'var(--text-secondary)',
                  fontWeight: isActive ? 500 : 400,
                }}
                role="menuitem"
                disabled={isActive}
              >
                {/* Language flag - consistent size */}
                <span className="text-xl flex-shrink-0" role="img" aria-label={lang.name}>
                  {lang.flag}
                </span>
                
                {/* Language name - RTL-aware alignment */}
                <span className="flex-1 text-left rtl:text-right">{lang.name}</span>
                
                {/* Check mark for active language */}
                {isActive && (
                  <svg
                    className="w-5 h-5 flex-shrink-0"
                    style={{ color: 'var(--wine-600)' }}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

