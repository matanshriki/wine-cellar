/**
 * Translate short natural feedback into structured preference deltas (deterministic).
 * Keeps the domain focused — no generic chat completion here.
 */

import type { SommelierPreferenceMemory } from './sommelierTypes.js';

export interface InferredFeedback {
  tags: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
  preferenceDelta: Partial<SommelierPreferenceMemory>;
}

export function inferFeedbackFromText(text: string): InferredFeedback {
  const t = text.toLowerCase();
  const tags: string[] = [];
  const preferenceDelta: Partial<SommelierPreferenceMemory> = {};

  if (/\b(i\s+liked|loved|perfect|great|excellent)\b/.test(t)) {
    tags.push('liked');
  }
  if (/\b(too\s+heavy|too\s+big|too\s+full)\b/.test(t)) {
    tags.push('too_heavy');
    preferenceDelta.bodyPreference = 'light';
    preferenceDelta.dislikedProfiles = ['heavy'];
  }
  if (/\b(too\s+light|too\s+thin|watery)\b/.test(t)) {
    tags.push('too_light');
    preferenceDelta.bodyPreference = 'medium';
  }
  if (/\b(too\s+acid(ic)?|too\s+sour|too\s+tart)\b/.test(t)) {
    tags.push('too_acidic');
    preferenceDelta.dislikedProfiles = ['high_acid'];
  }
  if (/\b(not\s+special|ordinary|boring)\b/.test(t)) {
    tags.push('not_special');
  }
  if (/\b(perfect\s+for\s+dinner|great\s+with\s+food|paired\s+well)\b/.test(t)) {
    tags.push('pairing_hit');
  }
  if (/\b(more\s+like\s+this|another\s+like\s+this)\b/.test(t)) {
    tags.push('more_like_this');
  }

  let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
  if (tags.some((x) => ['liked', 'pairing_hit'].includes(x))) sentiment = 'positive';
  if (tags.some((x) => ['too_heavy', 'too_light', 'too_acidic', 'not_special'].includes(x))) {
    sentiment = sentiment === 'positive' ? 'neutral' : 'negative';
  }

  return { tags, sentiment, preferenceDelta };
}

const POSITIVE_SENTIMENT =
  /\b(love|loved|really\s+lik(e|ed)|amazing|fantastic|incredible|great|excellent|wonderful|perfect|adore|enjoy(ed)?|favorite|favourite)\b/;

const REGION_RE =
  /\b(burgundy|bordeaux|barolo|rioja|napa|champagne|tuscany|rh[oô]ne|piemonte?|mendoza|willamette|mosel|alsace|stellenbosch|marlborough|priorat)\b/;

const GRAPE_RE =
  /\b(pinot\s+noir|cabernet|merlot|syrah|shiraz|sangiovese|nebbiolo|chardonnay|riesling|sauvignon|tempranillo|malbec|grenache|zinfandel|barbera)\b/;

export function inferMemoryUpdateFromText(text: string): Partial<SommelierPreferenceMemory> | null {
  const t = text.toLowerCase();
  const out: Partial<SommelierPreferenceMemory> = {};

  if (/\b(i\s+prefer|i\s+like|remember\s+(that\s+)?i)\b.*\b(lighter|light(er)?\s+wines?|light\s+body)\b/.test(t)) {
    out.bodyPreference = 'light';
  } else if (/\b(heavier|fuller|bold(er)?)\b/.test(t) && /\b(prefer|like|want)\b/.test(t)) {
    out.bodyPreference = 'full';
  }

  const hasPositive = POSITIVE_SENTIMENT.test(t);

  const regionMatch = t.match(REGION_RE);
  if (regionMatch && hasPositive) {
    out.favoriteRegions = [regionMatch[1]];
  }

  const grapeMatch = t.match(GRAPE_RE);
  if (grapeMatch && hasPositive) {
    out.favoriteGrapes = [grapeMatch[1].replace(/\s+/, ' ')];
  }

  return Object.keys(out).length ? out : null;
}
