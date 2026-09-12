/**
 * Localized labels for explicit Sommi memory items (web).
 * Prefers stored labels, then a small wine-term catalog, then formatted id.
 */

const REGION_BY_ID: Record<string, { en: string; he?: string }> = {
  rioja: { en: 'Rioja', he: 'ריוחה' },
  burgundy: { en: 'Burgundy', he: 'בורגון' },
  bordeaux: { en: 'Bordeaux', he: 'בורדו' },
  barolo: { en: 'Barolo', he: 'ברולו' },
  napa: { en: 'Napa' },
  champagne: { en: 'Champagne', he: 'שמפניה' },
  tuscany: { en: 'Tuscany', he: 'טוסקנה' },
  rhone: { en: 'Rhone' },
  piemonte: { en: 'Piemonte' },
  mendoza: { en: 'Mendoza' },
  mosel: { en: 'Mosel' },
  alsace: { en: 'Alsace' },
  priorat: { en: 'Priorat' },
  taurasi: { en: 'Taurasi', he: 'טאורזי' },
};

const GRAPE_BY_ID: Record<string, { en: string; he?: string }> = {
  pinot_noir: { en: 'Pinot Noir', he: 'פינו נואר' },
  cabernet: { en: 'Cabernet', he: 'קברנה' },
  cabernet_sauvignon: { en: 'Cabernet Sauvignon', he: 'קברנה סוביניון' },
  cabernet_franc: { en: 'Cabernet Franc', he: 'קברנה פרנק' },
  merlot: { en: 'Merlot', he: 'מרלו' },
  syrah: { en: 'Syrah' },
  sangiovese: { en: 'Sangiovese' },
  nebbiolo: { en: 'Nebbiolo', he: 'נביולו' },
  nero_di_troia: { en: 'Nero di Troia', he: 'נרו די טרויה' },
  chardonnay: { en: 'Chardonnay', he: 'שרדונה' },
  riesling: { en: 'Riesling' },
  sauvignon: { en: 'Sauvignon Blanc' },
  tempranillo: { en: 'Tempranillo' },
  malbec: { en: 'Malbec', he: 'מלבק' },
  grenache: { en: 'Grenache' },
  primitivo: { en: 'Primitivo', he: 'פרימיטיבו' },
  zinfandel: { en: 'Zinfandel' },
  barbera: { en: 'Barbera', he: 'ברברה' },
  aglianico: { en: 'Aglianico', he: 'אליאניקו' },
  cannonau: { en: 'Cannonau', he: 'קנונאו' },
};

const STYLE_BY_ID: Record<string, { en: string; he?: string }> = {
  amarone: { en: 'Amarone', he: 'אמרונה' },
};

export function formatMemoryIdFallback(id: string): string {
  return id
    .split(/[_-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

export function resolveMemoryItemLabel(
  dimension: 'region' | 'grape' | 'style',
  item: { id: string; label_en?: string; label_he?: string },
  language: string
): string {
  const he = language.startsWith('he');
  if (he) {
    if (item.label_he?.trim()) return item.label_he.trim();
    if (item.label_en?.trim()) return item.label_en.trim();
  } else {
    if (item.label_en?.trim()) return item.label_en.trim();
    if (item.label_he?.trim()) return item.label_he.trim();
  }
  const catalog = (
    dimension === 'region'
      ? REGION_BY_ID
      : dimension === 'grape'
        ? GRAPE_BY_ID
        : STYLE_BY_ID
  )[item.id.toLowerCase()];
  if (catalog) {
    if (he && catalog.he) return catalog.he;
    return catalog.en;
  }
  return formatMemoryIdFallback(item.id);
}

export function bodyPreferenceLabel(
  value: 'light' | 'medium' | 'full',
  language: string,
  t: (key: string, fallback: string) => string
): string {
  if (value === 'light') return t('sommiMemory.bodyLight', language.startsWith('he') ? 'קל' : 'Light');
  if (value === 'full') return t('sommiMemory.bodyFull', language.startsWith('he') ? 'מלא' : 'Full');
  return t('sommiMemory.bodyMedium', language.startsWith('he') ? 'בינוני' : 'Medium');
}
