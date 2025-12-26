/**
 * i18n Configuration
 * 
 * This file configures react-i18next for multi-language support.
 * 
 * Key Features:
 * - Auto-detection of user's browser language
 * - Fallback to English if translation is missing
 * - localStorage persistence of selected language
 * - Support for Hebrew RTL and English LTR
 * 
 * Libraries used:
 * - i18next: Core i18n framework
 * - react-i18next: React bindings for i18next
 * - i18next-browser-languagedetector: Auto-detects user language from browser
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation resources
import enTranslations from './locales/en.json';
import heTranslations from './locales/he.json';

// Define supported languages with their configurations
export const languages = {
  en: {
    code: 'en',
    name: 'English',
    dir: 'ltr', // Left-to-right
    flag: '🇺🇸',
  },
  he: {
    code: 'he',
    name: 'עברית', // Hebrew
    dir: 'rtl', // Right-to-left
    flag: '🇮🇱',
  },
} as const;

// Type-safe language codes
export type LanguageCode = keyof typeof languages;

// Initialize i18next
i18n
  // Detect user language
  // Order: localStorage > browser language > fallback
  .use(LanguageDetector)
  
  // Pass the i18n instance to react-i18next
  .use(initReactI18next)
  
  // Initialize with configuration
  .init({
    // Translation resources for all supported languages
    resources: {
      en: {
        translation: enTranslations,
      },
      he: {
        translation: heTranslations,
      },
    },

    // Fallback language if translation is missing
    fallbackLng: 'en',
    
    // Default language (will be overridden by detector)
    lng: 'en',

    // Namespaces (we use single 'translation' namespace for simplicity)
    defaultNS: 'translation',
    ns: ['translation'],

    // Enable debug mode in development for troubleshooting
    debug: process.env.NODE_ENV === 'development',

    // React-i18next options
    react: {
      // Wait for translations to load before rendering
      useSuspense: false,
      
      // Bind i18n to React component lifecycle
      bindI18n: 'languageChanged',
    },

    // Interpolation options
    interpolation: {
      // React already handles escaping
      escapeValue: false,
      
      // Format functions for numbers, dates, etc.
      format: (value, format, lng) => {
        // Example: Format numbers based on locale
        if (format === 'number') {
          return new Intl.NumberFormat(lng).format(value);
        }
        
        // Example: Format dates based on locale
        if (format === 'date') {
          return new Intl.DateTimeFormat(lng).format(value);
        }
        
        return value;
      },
    },

    // Language detection options
    detection: {
      // Order of detection methods
      order: [
        'localStorage',      // Check localStorage first (persisted choice)
        'navigator',         // Then browser language
        'htmlTag',          // Then HTML lang attribute
      ],
      
      // Keys for localStorage
      lookupLocalStorage: 'i18nextLng',
      
      // Cache user selection
      caches: ['localStorage'],
    },
  });

/**
 * Helper function to change language and update document direction
 * 
 * @param languageCode - The language code to switch to (en | he)
 */
export const changeLanguage = async (languageCode: LanguageCode) => {
  // Change i18n language (also saves to localStorage)
  await i18n.changeLanguage(languageCode);
  
  // Update document direction (RTL for Hebrew, LTR for English)
  const direction = languages[languageCode].dir;
  document.documentElement.dir = direction;
  document.documentElement.lang = languageCode;
};

/**
 * Initialize direction on app load based on current language
 */
export const initializeDirection = () => {
  const currentLang = i18n.language as LanguageCode;
  const direction = languages[currentLang]?.dir || 'ltr';
  document.documentElement.dir = direction;
  document.documentElement.lang = currentLang;
};

export default i18n;

