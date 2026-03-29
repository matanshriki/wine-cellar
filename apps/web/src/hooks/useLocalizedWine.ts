import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getLocalizedWineData, type LocalizedWineData } from '../utils/wineTranslations';

/**
 * Returns locale-aware display strings for a wine record.
 *
 * When the active language is Hebrew, values are resolved in priority order:
 *   1. AI-generated translation stored in `wine.translations.he`
 *   2. Static dictionary lookup (for countries, regions, grapes)
 *   3. Original Latin-script value
 *
 * For English (or any other language) the original values are returned as-is.
 */
export function useLocalizedWine(
  wine: {
    wine_name: string;
    producer: string;
    country?: string | null;
    region?: string | null;
    appellation?: string | null;
    grapes?: string[] | any | null;
    translations?: any;
  } | null | undefined,
): LocalizedWineData {
  const { i18n } = useTranslation();
  const language = i18n.language;

  return useMemo(() => {
    if (!wine) {
      return {
        wine_name: '',
        producer: '',
        country: null,
        region: null,
        appellation: null,
        grapes: null,
      };
    }
    return getLocalizedWineData(wine, language);
  }, [wine, language]);
}
