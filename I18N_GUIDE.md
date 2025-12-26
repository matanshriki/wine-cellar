# 🌍 Internationalization (i18n) Guide

## Overview

Wine Cellar Brain now supports multiple languages with full RTL (Right-to-Left) support for Hebrew. The implementation uses **react-i18next**, the industry-standard i18n solution for React applications.

## Supported Languages

- **English (en)** 🇺🇸 - LTR (Left-to-Right)
- **Hebrew (he)** 🇮🇱 - RTL (Right-to-Left)

## Architecture

### Technology Stack

**Libraries Used:**
- `i18next` - Core internationalization framework
- `react-i18next` - React bindings for i18next  
- `i18next-browser-languagedetector` - Auto-detects user's browser language

### Folder Structure

```
src/
├── i18n/
│   ├── config.ts          # i18n configuration and initialization
│   └── locales/
│       ├── en.json        # English translations
│       └── he.json        # Hebrew translations
├── components/
│   └── LanguageSwitcher.tsx  # Language toggle component
└── main.tsx               # App entry point with i18n init
```

## Key Features

### 1. Automatic Language Detection

The app automatically detects the user's preferred language from:
1. **localStorage** - Previously selected language (highest priority)
2. **Browser language** - User's browser/OS language settings
3. **Fallback** - English if no match found

### 2. Persistent Language Selection

Selected language is saved to `localStorage` with key `i18nextLng` and persists across sessions.

### 3. RTL Support

When Hebrew is selected:
- Document direction automatically switches to RTL
- CSS properly mirrors (margins, padding, text alignment)
- TailwindCSS directional utilities adapt automatically

### 4. Type-Safe Translations

TypeScript ensures translation keys are valid at compile-time, preventing runtime errors from missing translations.

## Configuration

### i18n Config (`src/i18n/config.ts`)

```typescript
// Define supported languages
export const languages = {
  en: {
    code: 'en',
    name: 'English',
    dir: 'ltr',
    flag: '🇺🇸',
  },
  he: {
    code: 'he',
    name: 'עברית',
    dir: 'rtl',
    flag: '🇮🇱',
  },
} as const;

// Initialize i18next with configuration
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { /* translation files */ },
    fallbackLng: 'en',
    debug: process.env.NODE_ENV === 'development',
    // ... more config
  });
```

### Key Configuration Options

| Option | Value | Purpose |
|--------|-------|---------|
| `fallbackLng` | `'en'` | Default if translation missing |
| `debug` | `true` (dev only) | Console logging for troubleshooting |
| `react.useSuspense` | `false` | Render immediately, don't wait for translations |
| `interpolation.escapeValue` | `false` | React handles escaping |

## Usage

### 1. Basic Translation

```typescript
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t('app.title')}</h1>
      <p>{t('app.tagline')}</p>
    </div>
  );
}
```

### 2. Translation with Variables (Interpolation)

```typescript
// Translation file (en.json)
{
  "cellar": {
    "bottleCount": "{{count}} bottles"
  }
}

// Component
<p>{t('cellar.bottleCount', { count: 10 })}</p>
// Output: "10 bottles"
```

### 3. Pluralization

```typescript
// Translation file (en.json)
{
  "cellar": {
    "bottleCount_one": "{{count}} bottle",
    "bottleCount_other": "{{count}} bottles"
  }
}

// Component
<p>{t('cellar.bottleCount', { count: 1 })}</p>  // "1 bottle"
<p>{t('cellar.bottleCount', { count: 5 })}</p>  // "5 bottles"
```

### 4. Change Language Programmatically

```typescript
import { changeLanguage } from '../i18n/config';

// Switch to Hebrew
await changeLanguage('he');

// Switch to English
await changeLanguage('en');
```

### 5. Access Current Language

```typescript
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { i18n } = useTranslation();
  
  const currentLang = i18n.language; // 'en' or 'he'
  const isRTL = document.documentElement.dir === 'rtl';
  
  return <div>Current language: {currentLang}</div>;
}
```

## Translation Files

### Structure

Translation files use nested JSON objects for organization:

```json
{
  "app": {
    "title": "Wine Cellar Brain"
  },
  "nav": {
    "cellar": "Cellar",
    "tonight": "Tonight?"
  },
  "cellar": {
    "title": "My Cellar",
    "bottle": {
      "vintage": "Vintage",
      "region": "Region"
    }
  }
}
```

### Accessing Nested Keys

```typescript
t('app.title')           // "Wine Cellar Brain"
t('nav.cellar')          // "Cellar"
t('cellar.bottle.vintage') // "Vintage"
```

### Translation Guidelines

1. **Keys should be semantic** - Use descriptive paths, not content
   - ✅ `nav.cellar`
   - ❌ `nav.cellarPage`

2. **Group by feature/page** - Organize by section of the app
   - `auth.*` - Authentication
   - `cellar.*` - Cellar page
   - `common.*` - Shared strings

3. **Use consistent naming** - Follow patterns throughout
   - Form labels: `bottleForm.name`, `bottleForm.vintage`
   - Buttons: `common.save`, `common.cancel`
   - Messages: `auth.welcome`, `cellar.bottleAdded`

4. **Avoid hardcoded strings** - All user-facing text should be translated

## RTL Support

### How It Works

When language is changed to Hebrew:

1. **Document Direction Updated**
   ```typescript
   document.documentElement.dir = 'rtl';
   document.documentElement.lang = 'he';
   ```

2. **CSS Automatically Mirrors**
   - `margin-left: 10px` → `margin-right: 10px`
   - `text-align: left` → `text-align: right`
   - `border-radius: 10px 0 0 10px` → `border-radius: 0 10px 10px 0`

3. **TailwindCSS Adapts**
   - `ml-4` effectively becomes `mr-4`
   - `rounded-l-lg` becomes `rounded-r-lg`
   - `text-left` becomes `text-right`

### RTL Best Practices

1. **Use Logical Properties**
   ```css
   /* ❌ Avoid physical directions */
   margin-left: 10px;
   
   /* ✅ Use logical properties */
   margin-inline-start: 10px;
   ```

2. **Use TailwindCSS Directional Classes**
   ```jsx
   /* These automatically flip in RTL */
   <div className="ml-4 text-left rounded-l-lg">
   ```

3. **Icons and Images**
   - Directional icons (arrows) should flip
   - Non-directional icons (settings) stay the same
   - Use CSS `transform: scaleX(-1)` to flip in RTL

## Language Switcher Component

### Usage

```typescript
import { LanguageSwitcher } from './components/LanguageSwitcher';

function MyNav() {
  return (
    <nav>
      <LanguageSwitcher />
    </nav>
  );
}
```

### Features

- **Dropdown menu** with all supported languages
- **Visual flags** for each language
- **Check mark** indicates current language
- **Keyboard accessible** with proper ARIA labels
- **Click outside to close** behavior
- **Persists selection** to localStorage

## Adding a New Language

### Step 1: Create Translation File

Create `src/i18n/locales/[code].json`:

```json
{
  "app": {
    "title": "Your Translation Here"
  }
  // ... copy structure from en.json
}
```

### Step 2: Add to Configuration

Update `src/i18n/config.ts`:

```typescript
// Import translation
import frTranslations from './locales/fr.json';

// Add to languages object
export const languages = {
  en: { /* ... */ },
  he: { /* ... */ },
  fr: {
    code: 'fr',
    name: 'Français',
    dir: 'ltr',
    flag: '🇫🇷',
  },
} as const;

// Add to resources
i18n.init({
  resources: {
    en: { translation: enTranslations },
    he: { translation: heTranslations },
    fr: { translation: frTranslations },
  },
  // ... rest of config
});
```

### Step 3: Test

1. Switch language using Language Switcher
2. Verify all strings are translated
3. Check for missing translations (check console in dev mode)
4. Test RTL layout if applicable

## Testing

### Manual Testing Checklist

- [ ] Language switcher appears in nav
- [ ] Can switch between English and Hebrew
- [ ] Selected language persists after page refresh
- [ ] Hebrew shows RTL layout correctly
- [ ] English shows LTR layout correctly
- [ ] All text is translated (no English in Hebrew mode)
- [ ] Forms work correctly in both directions
- [ ] Buttons and navigation work in both directions

### Testing Tips

1. **Clear localStorage** to test auto-detection:
   ```javascript
   localStorage.clear();
   ```

2. **Change browser language** to test detection:
   - Chrome: Settings → Languages
   - Firefox: Preferences → Language

3. **Check for missing translations**:
   - Enable debug mode in config
   - Check browser console for warnings

## Common Issues

### Issue: Translations Not Loading

**Solution:** Ensure i18n is initialized before React renders:

```typescript
// main.tsx
import './i18n/config';  // Must be before App import
import { App } from './App';
```

### Issue: RTL Layout Broken

**Solution:** Check that direction is set on document:

```typescript
// Should be called on language change
document.documentElement.dir = 'rtl';
```

### Issue: Mixed Text Directions

**Solution:** Wrap inline foreign text with dir attribute:

```jsx
<p>
  This is English text with <span dir="rtl">טקסט בעברית</span> inline.
</p>
```

### Issue: Language Not Persisting

**Solution:** Check localStorage is enabled and working:

```javascript
// Test localStorage
localStorage.setItem('test', 'value');
console.log(localStorage.getItem('test')); // Should log 'value'
```

## Performance Considerations

1. **Translation Files** - Loaded on demand, not bundled
2. **Language Detection** - Happens once on app load
3. **Direction Changes** - Instant, no page reload needed
4. **Bundle Size** - ~50KB for i18next libraries (minified + gzipped)

## Accessibility

- Language switcher has proper ARIA labels
- `lang` attribute updated on `<html>` element
- Screen readers announce language changes
- Keyboard navigation fully supported

## Browser Support

- All modern browsers (Chrome, Firefox, Safari, Edge)
- IE11+ with polyfills
- Mobile browsers (iOS Safari, Chrome Mobile)
- Tested on latest 2 versions of each browser

## Resources

- [react-i18next Documentation](https://react.i18next.com/)
- [i18next Documentation](https://www.i18next.com/)
- [RTL CSS Best Practices](https://rtlstyling.com/)
- [WCAG Accessibility Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

---

**Need help?** Check the [react-i18next documentation](https://react.i18next.com/) or open an issue.

