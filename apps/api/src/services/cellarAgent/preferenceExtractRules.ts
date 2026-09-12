/**
 * Phase 2A deterministic HE/EN preference extraction (no LLM).
 * Only unambiguous remember/store language may auto-apply canonical taste.
 *
 * Hebrew prefix strategy:
 * - Known catalog aliases that are Hebrew-script get explicit prefixed forms:
 *   מ / ב / ל / ה / ו + base (e.g. נביולו → מנביולו).
 * - We do NOT strip arbitrary first letters from free text (avoids false positives).
 * - Latin terms are matched case-insensitively inside mixed RTL/LTR text via includes().
 * - Longer aliases are preferred so "cabernet sauvignon" beats "sauvignon" / "cabernet".
 */

export type EvidenceScope =
  | 'stable'
  | 'stable_candidate'
  | 'bottle'
  | 'session'
  | 'operational'
  | 'ambiguous';

export type EvidencePolarity = 'like' | 'dislike' | 'retract' | 'neutral';

export type EvidenceDimension = 'region' | 'grape' | 'body' | 'style' | 'descriptor' | 'other';

export type ExtractionClass =
  | 'stable_remember'
  | 'stable_general'
  | 'bottle'
  | 'session'
  | 'operational'
  | 'ambiguous'
  | 'contradiction'
  | 'retraction';

export interface ExtractedPreferenceCandidate {
  class: ExtractionClass;
  scope: EvidenceScope;
  polarity: EvidencePolarity;
  dimension: EvidenceDimension;
  valueId: string;
  labelEn?: string;
  labelHe?: string;
  confidence: number;
  locale: 'en' | 'he' | 'unknown';
  status: 'active' | 'pending_unsupported' | 'recorded_no_apply';
  /** Eligible for canonical apply when kill-switch ON */
  applyCanonical: boolean;
  extractionVersion: 'rules_v2';
}

type TermEntry = { id: string; en: string; he?: string };

/** Safe attached Hebrew prepositions/conjunctions for known wine terms only. */
const HE_SAFE_PREFIXES = ['מ', 'ב', 'ל', 'ה', 'ו'] as const;

function withHebrewPrefixes(aliases: string[]): string[] {
  const out = new Set<string>();
  for (const a of aliases) {
    const t = a.trim();
    if (!t) continue;
    out.add(t);
    if (/[\u0590-\u05FF]/.test(t)) {
      for (const p of HE_SAFE_PREFIXES) {
        out.add(p + t);
      }
    }
  }
  return [...out];
}

function buildAliasMap(
  entries: Array<{ aliases: string[]; term: TermEntry }>
): Record<string, TermEntry> {
  const map: Record<string, TermEntry> = {};
  for (const { aliases, term } of entries) {
    for (const a of withHebrewPrefixes(aliases)) {
      map[a.toLowerCase()] = term;
      map[a] = term; // preserve exact Hebrew key for includes on original text
    }
  }
  return map;
}

/** Canonical region allowlist: aliases → id */
const REGION_ALIASES: Record<string, TermEntry> = buildAliasMap([
  { aliases: ['rioja', 'ריוחה'], term: { id: 'rioja', en: 'Rioja', he: 'ריוחה' } },
  { aliases: ['burgundy', 'בורגון'], term: { id: 'burgundy', en: 'Burgundy', he: 'בורגון' } },
  { aliases: ['bordeaux', 'בורדו'], term: { id: 'bordeaux', en: 'Bordeaux', he: 'בורדו' } },
  {
    aliases: ['barolo', 'ברולו'],
    term: { id: 'barolo', en: 'Barolo', he: 'ברולו' },
  },
  { aliases: ['napa'], term: { id: 'napa', en: 'Napa' } },
  {
    aliases: ['champagne', 'שמפניה'],
    term: { id: 'champagne', en: 'Champagne', he: 'שמפניה' },
  },
  { aliases: ['tuscany', 'טוסקנה'], term: { id: 'tuscany', en: 'Tuscany', he: 'טוסקנה' } },
  { aliases: ['rhone', 'rhône'], term: { id: 'rhone', en: 'Rhone' } },
  { aliases: ['piemonte', 'piedmont'], term: { id: 'piemonte', en: 'Piemonte' } },
  { aliases: ['mendoza'], term: { id: 'mendoza', en: 'Mendoza' } },
  { aliases: ['mosel'], term: { id: 'mosel', en: 'Mosel' } },
  { aliases: ['alsace'], term: { id: 'alsace', en: 'Alsace' } },
  { aliases: ['priorat'], term: { id: 'priorat', en: 'Priorat' } },
  {
    aliases: ['taurasi', 'טאורזי'],
    term: { id: 'taurasi', en: 'Taurasi', he: 'טאורזי' },
  },
]);

/**
 * Canonical grape allowlist.
 * Cabernet Sauvignon uses id `cabernet_sauvignon` (not generic cabernet, never sauvignon blanc).
 * Bare "Cabernet" / "קברנה" alone still maps to generic `cabernet`.
 */
const GRAPE_ALIASES: Record<string, TermEntry> = buildAliasMap([
  {
    aliases: ['pinot noir', 'pinot', 'פינו נואר'],
    term: { id: 'pinot_noir', en: 'Pinot Noir', he: 'פינו נואר' },
  },
  {
    aliases: [
      'cabernet sauvignon',
      'קברנה סוביניון',
      'קברנה סובניון',
      'קברנה סובינון',
    ],
    term: {
      id: 'cabernet_sauvignon',
      en: 'Cabernet Sauvignon',
      he: 'קברנה סוביניון',
    },
  },
  {
    aliases: ['cabernet franc', 'קברנה פרנק'],
    term: { id: 'cabernet_franc', en: 'Cabernet Franc', he: 'קברנה פרנק' },
  },
  {
    aliases: ['cabernet', 'קברנה'],
    term: { id: 'cabernet', en: 'Cabernet', he: 'קברנה' },
  },
  { aliases: ['merlot', 'מרלו'], term: { id: 'merlot', en: 'Merlot', he: 'מרלו' } },
  { aliases: ['syrah', 'shiraz'], term: { id: 'syrah', en: 'Syrah' } },
  { aliases: ['sangiovese'], term: { id: 'sangiovese', en: 'Sangiovese' } },
  {
    aliases: ['nebbiolo', 'נביולו'],
    term: { id: 'nebbiolo', en: 'Nebbiolo', he: 'נביולו' },
  },
  {
    aliases: ['nero di troia', 'נרו די טרויה'],
    term: { id: 'nero_di_troia', en: 'Nero di Troia', he: 'נרו די טרויה' },
  },
  {
    aliases: ['chardonnay', 'שרדונה'],
    term: { id: 'chardonnay', en: 'Chardonnay', he: 'שרדונה' },
  },
  { aliases: ['riesling'], term: { id: 'riesling', en: 'Riesling' } },
  {
    aliases: ['sauvignon blanc', 'sauvignon'],
    term: { id: 'sauvignon', en: 'Sauvignon Blanc' },
  },
  { aliases: ['tempranillo'], term: { id: 'tempranillo', en: 'Tempranillo' } },
  {
    aliases: ['malbec', 'מלבק'],
    term: { id: 'malbec', en: 'Malbec', he: 'מלבק' },
  },
  { aliases: ['grenache'], term: { id: 'grenache', en: 'Grenache' } },
  {
    aliases: ['primitivo', 'פרימיטיבו'],
    term: { id: 'primitivo', en: 'Primitivo', he: 'פרימיטיבו' },
  },
  { aliases: ['zinfandel'], term: { id: 'zinfandel', en: 'Zinfandel' } },
  {
    aliases: ['barbera', 'ברברה'],
    term: { id: 'barbera', en: 'Barbera', he: 'ברברה' },
  },
  {
    aliases: ['aglianico', 'אליאניקו'],
    term: { id: 'aglianico', en: 'Aglianico', he: 'אליאניקו' },
  },
  {
    aliases: ['cannonau', 'קנונאו'],
    term: { id: 'cannonau', en: 'Cannonau', he: 'קנונאו' },
  },
]);

/** Wine styles / appellation styles (not grapes). */
const STYLE_ALIASES: Record<string, TermEntry> = buildAliasMap([
  {
    aliases: ['amarone', 'אמרונה'],
    term: { id: 'amarone', en: 'Amarone', he: 'אמרונה' },
  },
]);

const REMEMBER_EN =
  /\b(remember(?:\s+that)?|please\s+remember|don'?t\s+forget|do\s+not\s+forget|store\s+(?:that|this))\b/i;
const REMEMBER_HE = /תזכ(?:ור|רי|רו)|אל\s+תשכח|תשמור\s+ש/;

const SESSION_EN =
  /\b(tonight|this\s+evening|right\s+now|for\s+(?:this|the)\s+meal|for\s+dinner\s+tonight|this\s+weekend)\b/i;
const SESSION_HE = /הערב|עכשיו|לארוחה\s+הזו|לארוחת/;

const BOTTLE_EN =
  /\b(this\s+bottle|this\s+wine|the\s+last\s+(?:one|bottle|wine)|that\s+bottle)\b/i;
const BOTTLE_HE = /היין\s+הזה|הבקבוק\s+הזה|המלצה\s+הזו/;

const RETRACT_EN =
  /\b(forget(?:\s+that)?|don'?t\s+(?:like|prefer)\s+.+\s+anymore|no\s+longer\s+(?:like|prefer)|remove\s+(?:that\s+)?preference)\b/i;
const RETRACT_HE = /תשכח|שכח(\s+ש)?|כבר\s+לא\s+אוהב|תסיר\s+את\s+ההעדפה/;

const OPERATIONAL_EN =
  /\b(drank\s+it\s+yesterday|too\s+expensive|save\s+(?:this|it)\s+for|anniversary|keep\s+(?:this|it))\b/i;
const OPERATIONAL_HE = /שתיתי\s+אתמול|יקר\s+מדי|תשמור\s+ל|יום\s+נישואין/;

const GENERAL_LIKE_EN = /\b(i\s+(?:like|love|prefer|enjoy))\b/i;
const GENERAL_LIKE_HE = /אני\s+(?:אוהב|אוהבת|מעדיף|מעדיפה)/;

const NEGATION_EN = /\b(don'?t|do\s+not|never|not)\b/i;
const NEGATION_HE = /לא\s+אוהב|לא\s+מעדיף|בלי\s+/;

function detectLocale(text: string): 'en' | 'he' | 'unknown' {
  if (/[\u0590-\u05FF]/.test(text)) return 'he';
  if (/[a-z]/i.test(text)) return 'en';
  return 'unknown';
}

function findTerm(
  text: string,
  table: Record<string, TermEntry>
): TermEntry | null {
  const lower = text.toLowerCase();
  const keys = Object.keys(table).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (k.length < 3) continue;
    if (lower.includes(k.toLowerCase()) || text.includes(k)) {
      return table[k]!;
    }
  }
  return null;
}

function findRegion(text: string): TermEntry | null {
  return findTerm(text, REGION_ALIASES);
}

function findGrape(text: string): TermEntry | null {
  return findTerm(text, GRAPE_ALIASES);
}

function findStyle(text: string): TermEntry | null {
  return findTerm(text, STYLE_ALIASES);
}

function findBody(text: string): 'light' | 'medium' | 'full' | null {
  const t = text.toLowerCase();
  if (
    /\b(full[-\s]?bodied|fuller|heavier|bold(?:er)?|too\s+heavy|heavy)\b/.test(t) ||
    /גוף\s+מלא|מלא[־\s]?גוף|כבד|בעלי\s+גוף\s+מלא/.test(text)
  ) {
    return 'full';
  }
  if (
    /\b(light[-\s]?bodied|lighter|delicate|too\s+light|light)\b/.test(t) ||
    /גוף\s+קל|קל[־\s]?גוף|קלים|יין\s+קל/.test(text)
  ) {
    return 'light';
  }
  if (/\bmedium[-\s]?bodied\b/.test(t) || /גוף\s+בינוני/.test(text)) {
    return 'medium';
  }
  return null;
}

function stableTermCandidate(
  base: Omit<
    ExtractedPreferenceCandidate,
    'dimension' | 'valueId' | 'labelEn' | 'labelHe' | 'polarity'
  > & { confidence: number },
  term: TermEntry,
  dimension: 'region' | 'grape' | 'style'
): Omit<ExtractedPreferenceCandidate, 'polarity'> {
  return {
    ...base,
    dimension,
    valueId: term.id,
    labelEn: term.en,
    labelHe: term.he,
  };
}

/**
 * Extract structured preference candidates from a user message.
 * Returns at most one primary candidate for Phase 2A.
 */
export function extractPreferenceEvidence(rawText: string): ExtractedPreferenceCandidate | null {
  const text = (rawText || '').trim();
  if (!text || text.length > 2000) return null;

  const locale = detectLocale(text);
  const isSession = SESSION_EN.test(text) || SESSION_HE.test(text);
  const isBottle = BOTTLE_EN.test(text) || BOTTLE_HE.test(text);
  const isRetract = RETRACT_EN.test(text) || RETRACT_HE.test(text);
  const isOperational = OPERATIONAL_EN.test(text) || OPERATIONAL_HE.test(text);
  const isRemember = REMEMBER_EN.test(text) || REMEMBER_HE.test(text);
  const isNeg = NEGATION_EN.test(text) || NEGATION_HE.test(text);
  const isGeneralLike = GENERAL_LIKE_EN.test(text) || GENERAL_LIKE_HE.test(text);

  const region = findRegion(text);
  const grape = findGrape(text);
  const style = findStyle(text);
  const body = findBody(text);

  const base = {
    locale,
    extractionVersion: 'rules_v2' as const,
    confidence: 0.9,
  };

  if (isRetract) {
    const target = region || grape || style;
    return {
      ...base,
      class: 'retraction',
      scope: 'stable',
      polarity: 'retract',
      dimension: region
        ? 'region'
        : grape
          ? 'grape'
          : style
            ? 'style'
            : body
              ? 'body'
              : 'other',
      valueId: target?.id || body || 'unknown',
      labelEn: target?.en,
      labelHe: target?.he,
      status: 'pending_unsupported',
      applyCanonical: false,
    };
  }

  if (isOperational && !isRemember) {
    return {
      ...base,
      class: 'operational',
      scope: 'operational',
      polarity: 'neutral',
      dimension: 'other',
      valueId: 'operational',
      status: 'recorded_no_apply',
      applyCanonical: false,
      confidence: 0.5,
    };
  }

  if (isSession) {
    return {
      ...base,
      class: 'session',
      scope: 'session',
      polarity: isNeg ? 'dislike' : 'like',
      dimension: body
        ? 'body'
        : region
          ? 'region'
          : grape
            ? 'grape'
            : style
              ? 'style'
              : 'other',
      valueId: body || region?.id || grape?.id || style?.id || 'session',
      labelEn: region?.en || grape?.en || style?.en,
      labelHe: region?.he || grape?.he || style?.he,
      status: 'recorded_no_apply',
      applyCanonical: false,
    };
  }

  if (isBottle) {
    return {
      ...base,
      class: 'bottle',
      scope: 'bottle',
      polarity: isNeg ? 'dislike' : 'like',
      dimension: body ? 'body' : 'other',
      valueId: body || 'bottle',
      status: 'recorded_no_apply',
      applyCanonical: false,
    };
  }

  const rememberBase = {
    ...base,
    class: 'stable_remember' as const,
    scope: 'stable' as const,
    status: 'active' as const,
    applyCanonical: true,
  };

  // Explicit remember + negation (dislike)
  if (isRemember && isNeg && !isSession && !isBottle) {
    if (region) {
      return { ...stableTermCandidate(rememberBase, region, 'region'), polarity: 'dislike' };
    }
    if (grape) {
      return { ...stableTermCandidate(rememberBase, grape, 'grape'), polarity: 'dislike' };
    }
    if (style) {
      return { ...stableTermCandidate(rememberBase, style, 'style'), polarity: 'dislike' };
    }
  }

  // Explicit remember + allowlisted target
  // Priority: region → grape → style → body (single primary candidate).
  if (isRemember && !isNeg) {
    if (region) {
      return { ...stableTermCandidate(rememberBase, region, 'region'), polarity: 'like' };
    }
    if (grape) {
      return { ...stableTermCandidate(rememberBase, grape, 'grape'), polarity: 'like' };
    }
    if (style) {
      return { ...stableTermCandidate(rememberBase, style, 'style'), polarity: 'like' };
    }
    if (body) {
      return {
        ...rememberBase,
        polarity: 'like',
        dimension: 'body',
        valueId: body,
      };
    }
    // Remember without known target
    return {
      ...base,
      class: 'ambiguous',
      scope: 'ambiguous',
      polarity: 'neutral',
      dimension: 'other',
      valueId: 'unknown',
      status: 'recorded_no_apply',
      applyCanonical: false,
      confidence: 0.3,
    };
  }

  // General like without remember → evidence only
  if (isGeneralLike && !isNeg && (region || grape || style || body)) {
    const target = region || grape || style;
    return {
      ...base,
      class: 'stable_general',
      scope: 'stable_candidate',
      polarity: 'like',
      dimension: region
        ? 'region'
        : grape
          ? 'grape'
          : style
            ? 'style'
            : 'body',
      valueId: target?.id || body || 'unknown',
      labelEn: target?.en,
      labelHe: target?.he,
      status: 'recorded_no_apply',
      applyCanonical: false,
      confidence: 0.7,
    };
  }

  if (isNeg && (region || grape || style)) {
    const target = region || grape || style!;
    return {
      ...base,
      class: 'stable_general',
      scope: 'stable_candidate',
      polarity: 'dislike',
      dimension: region ? 'region' : grape ? 'grape' : 'style',
      valueId: target.id,
      labelEn: target.en,
      labelHe: target.he,
      status: 'recorded_no_apply',
      applyCanonical: false,
      confidence: 0.7,
    };
  }

  return null;
}

export function buildIdempotencyKey(params: {
  userId: string;
  message: string;
  candidate: ExtractedPreferenceCandidate;
}): string {
  const norm = params.message.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 200);
  const raw = [
    params.userId,
    norm,
    params.candidate.extractionVersion,
    params.candidate.dimension,
    params.candidate.valueId,
    params.candidate.polarity,
  ].join('|');
  let h = 0;
  for (let i = 0; i < raw.length; i++) {
    h = (h * 31 + raw.charCodeAt(i)) | 0;
  }
  return `p2a_${Math.abs(h).toString(16)}_${params.candidate.valueId}`.slice(0, 180);
}

/**
 * Lookup bilingual wine-term labels for known region/grape/style ids.
 */
export function lookupWineTermLabels(
  dimension: 'region' | 'grape' | 'style',
  id: string
): { en: string; he?: string } | null {
  const needle = id.toLowerCase().trim();
  if (!needle) return null;
  const table =
    dimension === 'region'
      ? REGION_ALIASES
      : dimension === 'grape'
        ? GRAPE_ALIASES
        : STYLE_ALIASES;
  for (const entry of Object.values(table)) {
    if (entry.id === needle) {
      return { en: entry.en, he: entry.he };
    }
  }
  const direct = table[needle];
  if (direct) return { en: direct.en, he: direct.he };
  return null;
}
