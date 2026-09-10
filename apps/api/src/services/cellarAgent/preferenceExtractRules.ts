/**
 * Phase 2A deterministic HE/EN preference extraction (no LLM).
 * Only unambiguous remember/store language may auto-apply canonical taste.
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

/** Canonical region allowlist: aliases → id */
const REGION_ALIASES: Record<string, { id: string; en: string; he?: string }> = {
  rioja: { id: 'rioja', en: 'Rioja', he: 'ריוחה' },
  ריוחה: { id: 'rioja', en: 'Rioja', he: 'ריוחה' },
  burgundy: { id: 'burgundy', en: 'Burgundy', he: 'בורגון' },
  בורגון: { id: 'burgundy', en: 'Burgundy', he: 'בורגון' },
  bordeaux: { id: 'bordeaux', en: 'Bordeaux', he: 'בורדו' },
  בורדו: { id: 'bordeaux', en: 'Bordeaux', he: 'בורדו' },
  barolo: { id: 'barolo', en: 'Barolo' },
  napa: { id: 'napa', en: 'Napa' },
  champagne: { id: 'champagne', en: 'Champagne', he: 'שמפניה' },
  שמפניה: { id: 'champagne', en: 'Champagne', he: 'שמפניה' },
  tuscany: { id: 'tuscany', en: 'Tuscany', he: 'טוסקנה' },
  טוסקנה: { id: 'tuscany', en: 'Tuscany', he: 'טוסקנה' },
  rhone: { id: 'rhone', en: 'Rhone' },
  'rhône': { id: 'rhone', en: 'Rhone' },
  piemonte: { id: 'piemonte', en: 'Piemonte' },
  piedmont: { id: 'piemonte', en: 'Piemonte' },
  mendoza: { id: 'mendoza', en: 'Mendoza' },
  mosel: { id: 'mosel', en: 'Mosel' },
  alsace: { id: 'alsace', en: 'Alsace' },
  priorat: { id: 'priorat', en: 'Priorat' },
};

const GRAPE_ALIASES: Record<string, { id: string; en: string; he?: string }> = {
  'pinot noir': { id: 'pinot_noir', en: 'Pinot Noir', he: 'פינו נואר' },
  pinot: { id: 'pinot_noir', en: 'Pinot Noir', he: 'פינו נואר' },
  'פינו נואר': { id: 'pinot_noir', en: 'Pinot Noir', he: 'פינו נואר' },
  cabernet: { id: 'cabernet', en: 'Cabernet', he: 'קברנה' },
  קברנה: { id: 'cabernet', en: 'Cabernet', he: 'קברנה' },
  merlot: { id: 'merlot', en: 'Merlot', he: 'מרלו' },
  מרלו: { id: 'merlot', en: 'Merlot', he: 'מרלו' },
  syrah: { id: 'syrah', en: 'Syrah' },
  shiraz: { id: 'syrah', en: 'Syrah' },
  sangiovese: { id: 'sangiovese', en: 'Sangiovese' },
  nebbiolo: { id: 'nebbiolo', en: 'Nebbiolo' },
  chardonnay: { id: 'chardonnay', en: 'Chardonnay', he: 'שרדונה' },
  שרדונה: { id: 'chardonnay', en: 'Chardonnay', he: 'שרדונה' },
  riesling: { id: 'riesling', en: 'Riesling' },
  sauvignon: { id: 'sauvignon', en: 'Sauvignon Blanc' },
  tempranillo: { id: 'tempranillo', en: 'Tempranillo' },
  malbec: { id: 'malbec', en: 'Malbec' },
  grenache: { id: 'grenache', en: 'Grenache' },
  primitivo: { id: 'primitivo', en: 'Primitivo', he: 'פרימיטיבו' },
  פרימיטיבו: { id: 'primitivo', en: 'Primitivo', he: 'פרימיטיבו' },
  zinfandel: { id: 'zinfandel', en: 'Zinfandel' },
  barbera: { id: 'barbera', en: 'Barbera' },
};

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
const RETRACT_HE = /תשכח|כבר\s+לא\s+אוהב|תסיר\s+את\s+ההעדפה/;

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

function findRegion(text: string): { id: string; en: string; he?: string } | null {
  const lower = text.toLowerCase();
  // Longer keys first
  const keys = Object.keys(REGION_ALIASES).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (k.length >= 3 && (lower.includes(k) || text.includes(k))) {
      return REGION_ALIASES[k];
    }
  }
  return null;
}

function findGrape(text: string): { id: string; en: string; he?: string } | null {
  const lower = text.toLowerCase();
  const keys = Object.keys(GRAPE_ALIASES).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (k.length >= 3 && (lower.includes(k) || text.includes(k))) {
      return GRAPE_ALIASES[k];
    }
  }
  return null;
}

function findBody(text: string): 'light' | 'medium' | 'full' | null {
  const t = text.toLowerCase();
  if (
    /\b(full[-\s]?bodied|fuller|heavier|bold(?:er)?|too\s+heavy|heavy)\b/.test(t) ||
    /גוף\s+מלא|מלא[־\s]?גוף|כבד/.test(text)
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
  const body = findBody(text);

  const base = {
    locale,
    extractionVersion: 'rules_v2' as const,
    confidence: 0.9,
  };

  if (isRetract) {
    const target = region || grape;
    return {
      ...base,
      class: 'retraction',
      scope: 'stable',
      polarity: 'retract',
      dimension: region ? 'region' : grape ? 'grape' : body ? 'body' : 'other',
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
      dimension: body ? 'body' : region ? 'region' : grape ? 'grape' : 'other',
      valueId: body || region?.id || grape?.id || 'session',
      labelEn: region?.en || grape?.en,
      labelHe: region?.he || grape?.he,
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

  // Explicit remember + allowlisted target
  if (isRemember && !isNeg) {
    if (region) {
      return {
        ...base,
        class: 'stable_remember',
        scope: 'stable',
        polarity: 'like',
        dimension: 'region',
        valueId: region.id,
        labelEn: region.en,
        labelHe: region.he,
        status: 'active',
        applyCanonical: true,
      };
    }
    if (grape) {
      return {
        ...base,
        class: 'stable_remember',
        scope: 'stable',
        polarity: 'like',
        dimension: 'grape',
        valueId: grape.id,
        labelEn: grape.en,
        labelHe: grape.he,
        status: 'active',
        applyCanonical: true,
      };
    }
    if (body) {
      return {
        ...base,
        class: 'stable_remember',
        scope: 'stable',
        polarity: 'like',
        dimension: 'body',
        valueId: body,
        status: 'active',
        applyCanonical: true,
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
  if (isGeneralLike && !isNeg && (region || grape || body)) {
    const target = region || grape;
    return {
      ...base,
      class: 'stable_general',
      scope: 'stable_candidate',
      polarity: 'like',
      dimension: region ? 'region' : grape ? 'grape' : 'body',
      valueId: target?.id || body || 'unknown',
      labelEn: target?.en,
      labelHe: target?.he,
      status: 'recorded_no_apply',
      applyCanonical: false,
      confidence: 0.7,
    };
  }

  if (isNeg && (region || grape)) {
    const target = region || grape!;
    return {
      ...base,
      class: 'stable_general',
      scope: 'stable_candidate',
      polarity: 'dislike',
      dimension: region ? 'region' : 'grape',
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
  // Simple stable hash (not crypto) for idempotency within Postgres text key
  let h = 0;
  for (let i = 0; i < raw.length; i++) {
    h = (h * 31 + raw.charCodeAt(i)) | 0;
  }
  return `p2a_${Math.abs(h).toString(16)}_${params.candidate.valueId}`.slice(0, 180);
}
