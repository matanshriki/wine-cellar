/**
 * Single source of truth for a wine's residual sweetness.
 *
 * Sweetness is about residual sugar, not fruit flavor: a "fruit-forward" red can
 * still be bone dry, so style tags like `fruit-forward` never imply sweetness.
 *
 * Basis, strongest first:
 * - `label`: a sweetness term on the label (Amabile, Demi-Sec, Spätlese, Brut…).
 * - `profile`: a stored AI / Vivino taste profile (an estimate).
 * - `unknown`: only a color/region heuristic, or no data. Unknown is never "dry".
 */

export type SweetnessLevel = 'dry' | 'off_dry' | 'medium_sweet' | 'sweet';
export type SweetnessBasis = 'label' | 'profile' | 'unknown';

export interface SweetnessAssessment {
  level: SweetnessLevel | null;
  basis: SweetnessBasis;
  /** The label term that decided the level, when basis is `label`. */
  term?: string;
}

interface SweetnessTerm {
  pattern: RegExp;
  level: SweetnessLevel;
}

// Ordered: compound/sweeter terms must win over the dry terms they contain
// ("demi-sec" contains "sec", "halbtrocken" contains "trocken", "off-dry" contains "dry").
const SWEET_TERMS: SweetnessTerm[] = [
  { pattern: /\b(trockenbeerenauslese|beerenauslese|eiswein|ice ?wine|icewine)\b/, level: 'sweet' },
  { pattern: /\b(sauternes|barsac|tokaji aszu|aszu|vin santo|passito|recioto|pedro ximenez)\b/, level: 'sweet' },
  { pattern: /\b(late harvest|vendange tardive|vendanges tardives|selection de grains nobles|sgn|noble rot)\b/, level: 'sweet' },
  { pattern: /\b(port|porto|banyuls|maury|rutherglen|muscat de beaumes|moscatel de setubal|vin doux naturel)\b/, level: 'sweet' },
  { pattern: /\b(dolce|doux|dulce|sweet|liquoroso|moelleux|liquoreux)\b/, level: 'sweet' },
  { pattern: /\bauslese\b/, level: 'sweet' },
  { pattern: /\b(amabile|abboccato|demi[- ]?sec|semi[- ]?sweet|medium[- ]?sweet|semi[- ]?seco|semi[- ]?dulce|spatlese|lieblich|moscato d ?asti|asti spumante|brachetto)\b/, level: 'medium_sweet' },
  { pattern: /\b(off[- ]?dry|medium[- ]?dry|halbtrocken|feinherb|extra dry|extra sec|demi doux|semi[- ]?secco)\b/, level: 'off_dry' },
];

const DRY_TERMS: RegExp[] = [
  /\b(brut nature|pas dose|zero dosage|dosage zero|extra brut|brut)\b/,
  /\b(trocken|secco|seco)\b/,
  /\b(bone dry|dry)\b(?! creek)/,
];

/** Lowercase, strip diacritics (aszú → aszu, spätlese → spatlese), collapse punctuation. */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’'`]/g, ' ')
    .replace(/[^a-z0-9\- ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function inferSweetnessFromText(text: string | null | undefined): { level: SweetnessLevel; term: string } | null {
  if (!text) return null;
  const s = normalize(text);
  if (!s) return null;
  // German Prädikat names describe ripeness at harvest; "trocken"/"halbtrocken" decide the style.
  if (/\b(spatlese|auslese)\b/.test(s)) {
    if (/\btrocken\b/.test(s)) return { level: 'dry', term: 'trocken' };
    if (/\b(halbtrocken|feinherb)\b/.test(s)) return { level: 'off_dry', term: s.match(/\b(halbtrocken|feinherb)\b/)![0] };
  }
  for (const { pattern, level } of SWEET_TERMS) {
    const m = s.match(pattern);
    if (m) return { level, term: m[0] };
  }
  for (const pattern of DRY_TERMS) {
    const m = s.match(pattern);
    if (m) return { level: 'dry', term: m[0] };
  }
  return null;
}

/**
 * Stored profiles carry `sweetness_scale` from this version on. Unversioned
 * profiles were written by prompts that defined the 0–5 scale differently:
 * - generate-wine-profile (Feb 2026): 0 bone dry, 1–2 off-dry, 3–4 medium sweet, 5 very sweet
 * - backfill-wine-profiles (Mar 2026): 0 bone dry, 5 very sweet, nothing in between
 * Version 2: 0 bone dry, 1 dry, 2 off-dry, 3 medium sweet, 4 sweet, 5 very sweet.
 * Keep in sync with supabase/functions/_shared/sweetnessScale.ts.
 */
export const SWEETNESS_SCALE_VERSION = 2;

const V2_LEVELS: readonly SweetnessLevel[] = ['dry', 'dry', 'off_dry', 'medium_sweet', 'sweet', 'sweet'];

// Only claims every legacy definition supports: 1 was "off-dry" in one prompt and
// undefined in the other, so it stays unknown; 4 is at least medium sweet.
const LEGACY_LEVELS: readonly (SweetnessLevel | null)[] = ['dry', null, 'off_dry', 'medium_sweet', 'medium_sweet', 'sweet'];

/**
 * Level a stored 0–5 score supports, given the scale version that produced it.
 * Null when the value is missing, outside the integer 0–5 schema, or ambiguous.
 */
export function levelFromStoredScore(score: unknown, scaleVersion?: unknown): SweetnessLevel | null {
  if (typeof score !== 'number' || !Number.isInteger(score) || score < 0 || score > 5) return null;
  return scaleVersion === SWEETNESS_SCALE_VERSION ? V2_LEVELS[score] : LEGACY_LEVELS[score];
}

/** Representative 0–5 score for a level (used when a label term overrides a profile). */
export function scoreFromLevel(level: SweetnessLevel): number {
  switch (level) {
    case 'dry': return 0.5;
    case 'off_dry': return 2;
    case 'medium_sweet': return 3;
    case 'sweet': return 4.5;
  }
}

export interface SweetnessWineInput {
  wine_name?: string | null;
  regional_wine_style?: string | null;
  wine_profile?: { sweetness?: number | null; source?: string | null; sweetness_scale?: number | null } | null;
}

/** Label-visible text that may carry a sweetness term. Producer names are excluded on purpose. */
function labelText(wine: SweetnessWineInput): string {
  return [wine.wine_name, wine.regional_wine_style].filter(Boolean).join(' ');
}

export function assessWineSweetness(wine: SweetnessWineInput | null | undefined): SweetnessAssessment {
  if (!wine) return { level: null, basis: 'unknown' };

  const fromLabel = inferSweetnessFromText(labelText(wine));
  if (fromLabel) return { level: fromLabel.level, basis: 'label', term: fromLabel.term };

  // Only the AI profile functions write stored profiles. Heuristic profiles are
  // color/region placeholders, and no Vivino profile writer defines this scale.
  const profile = wine.wine_profile;
  if (profile?.source !== 'ai') return { level: null, basis: 'unknown' };
  const level = levelFromStoredScore(profile.sweetness, profile.sweetness_scale);
  return level ? { level, basis: 'profile' } : { level: null, basis: 'unknown' };
}

export function isKnownDry(a: SweetnessAssessment | null | undefined): boolean {
  return !!a && a.basis !== 'unknown' && a.level === 'dry';
}

/** Off-dry or sweeter, from a non-unknown basis. */
export function isKnownSweeterThanDry(a: SweetnessAssessment | null | undefined): boolean {
  return !!a && a.basis !== 'unknown' && a.level !== null && a.level !== 'dry';
}
