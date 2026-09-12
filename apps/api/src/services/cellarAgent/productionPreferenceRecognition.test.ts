/**
 * Production single-preference recognition + acknowledgment truthfulness.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  extractPreferenceEvidence,
  lookupWineTermLabels,
} from './preferenceExtractRules.js';
import { classifyAgentRoute } from './agentRouter.js';
import { preferenceAckMessage } from './canonicalTasteWrite.js';

const PREV = process.env.CANONICAL_TASTE_WRITES;

describe('production single-preference recognition', () => {
  beforeEach(() => {
    process.env.CANONICAL_TASTE_WRITES = '1';
  });
  afterEach(() => {
    process.env.CANONICAL_TASTE_WRITES = PREV;
  });

  it('1: full-body Hebrew → body full', () => {
    const m = 'תזכור שאני מעדיף בדרך כלל יינות אדומים בעלי גוף מלא';
    expect(classifyAgentRoute(m)).toBe('memory_update');
    const c = extractPreferenceEvidence(m)!;
    expect(c.dimension).toBe('body');
    expect(c.valueId).toBe('full');
    expect(c.applyCanonical).toBe(true);
  });

  it('2: מריוחה → region rioja', () => {
    const m = 'תזכור שאני אוהב יינות מריוחה';
    const c = extractPreferenceEvidence(m)!;
    expect(c.dimension).toBe('region');
    expect(c.valueId).toBe('rioja');
    expect(c.applyCanonical).toBe(true);
  });

  it('3: מנביולו → grape nebbiolo', () => {
    const m = 'תזכור שאני אוהב יינות מנביולו';
    const c = extractPreferenceEvidence(m)!;
    expect(c.dimension).toBe('grape');
    expect(c.valueId).toBe('nebbiolo');
    expect(c.labelHe).toBe('נביולו');
    expect(c.applyCanonical).toBe(true);
    expect(preferenceAckMessage('remember_saved', c, 'en')).toMatch(/Nebbiolo/);
    expect(preferenceAckMessage('remember_saved', c, 'he')).toMatch(/נביולו/);
  });

  it('4: קברנה סובניון → cabernet_sauvignon, never sauvignon blanc', () => {
    const m = 'תזכור שאני אוהב יינות קברנה סובניון';
    const c = extractPreferenceEvidence(m)!;
    expect(c.dimension).toBe('grape');
    expect(c.valueId).toBe('cabernet_sauvignon');
    expect(c.valueId).not.toBe('sauvignon');
    expect(c.labelEn).toBe('Cabernet Sauvignon');
    expect(preferenceAckMessage('remember_saved', c, 'en')).toMatch(/Cabernet Sauvignon/);
  });

  it('5: מ Nero di Troia → nero_di_troia', () => {
    const m = 'תזכור שאני אוהב יינות מ Nero di Troia';
    const c = extractPreferenceEvidence(m)!;
    expect(c.dimension).toBe('grape');
    expect(c.valueId).toBe('nero_di_troia');
    expect(c.labelEn).toBe('Nero di Troia');
  });

  it('6: Amarone HE → style amarone', () => {
    const c = extractPreferenceEvidence('תזכור שאני אוהב אמרונה')!;
    expect(c.dimension).toBe('style');
    expect(c.valueId).toBe('amarone');
    expect(c.applyCanonical).toBe(true);
  });

  it('7: English equivalents normalize to same IDs', () => {
    expect(extractPreferenceEvidence('Remember that I like Nebbiolo')!.valueId).toBe('nebbiolo');
    expect(extractPreferenceEvidence('Remember that I like Rioja')!.valueId).toBe('rioja');
    expect(
      extractPreferenceEvidence('Remember that I like Cabernet Sauvignon')!.valueId
    ).toBe('cabernet_sauvignon');
    expect(extractPreferenceEvidence('Remember that I like Nero di Troia')!.valueId).toBe(
      'nero_di_troia'
    );
    expect(extractPreferenceEvidence('Remember that I like Amarone')!.valueId).toBe('amarone');
    expect(extractPreferenceEvidence('Remember that I like Amarone')!.dimension).toBe('style');
  });

  it('8: Hebrew attached prefixes work', () => {
    expect(extractPreferenceEvidence('תזכור שאני אוהב מנביולו')!.valueId).toBe('nebbiolo');
    expect(extractPreferenceEvidence('תזכור שאני אוהב בנביולו')!.valueId).toBe('nebbiolo');
    expect(extractPreferenceEvidence('תזכור שאני אוהב לנביולו')!.valueId).toBe('nebbiolo');
    expect(extractPreferenceEvidence('תזכור שאני אוהב מברולו')!.valueId).toBe('barolo');
    expect(extractPreferenceEvidence('תזכור שאני אוהב מאמרונה')!.valueId).toBe('amarone');
  });

  it('9: unrelated Hebrew words do not false-match', () => {
    // "מברק" must not become Barolo / Berak wine term via prefix stripping
    const c = extractPreferenceEvidence('תזכור שאני אוהב מברק');
    expect(c?.applyCanonical).not.toBe(true);
  });

  it('10: Cabernet Franc remains distinct', () => {
    const c = extractPreferenceEvidence('Remember that I like Cabernet Franc')!;
    expect(c.valueId).toBe('cabernet_franc');
    expect(c.valueId).not.toBe('cabernet_sauvignon');
    expect(c.valueId).not.toBe('cabernet');
  });

  it('11: Sauvignon Blanc remains distinct', () => {
    const c = extractPreferenceEvidence('Remember that I like Sauvignon Blanc')!;
    expect(c.valueId).toBe('sauvignon');
    expect(c.labelEn).toBe('Sauvignon Blanc');
  });

  it('12–13: unsupported term → no canonical eligibility + unrecognized ack', () => {
    const c = extractPreferenceEvidence('תזכור שאני אוהב יינות מזן לא קיים בכלל')!;
    expect(c.class).toBe('ambiguous');
    expect(c.applyCanonical).toBe(false);
    const ack = preferenceAckMessage('unrecognized', c, 'en');
    expect(ack).toMatch(/couldn't identify/i);
    expect(ack).not.toMatch(/I've noted that preference/i);
    expect(ack).not.toMatch(/I'll remember/i);
  });

  it('14: persist_failed does not claim success', () => {
    const c = extractPreferenceEvidence('Remember that I like Nebbiolo')!;
    const ack = preferenceAckMessage('persist_failed', c, 'en');
    expect(ack).toMatch(/couldn't save/i);
    expect(ack).not.toMatch(/I'll remember/i);
  });

  it('15: writes-disabled ack does not claim permanent save', () => {
    const c = extractPreferenceEvidence('Remember that I like Nebbiolo')!;
    const ack = preferenceAckMessage('remember_disabled', c, 'en');
    expect(ack).toMatch(/not enabled/i);
    expect(ack).not.toMatch(/I'll remember that you prefer/i);
  });

  it('16–17: reply language follows request language, not message script', () => {
    const c = extractPreferenceEvidence('תזכור שאני אוהב יינות מנביולו')!;
    expect(preferenceAckMessage('remember_saved', c, 'he')).toMatch(/הבנתי/);
    expect(preferenceAckMessage('remember_saved', c, 'en')).toMatch(/Got it/);
    expect(preferenceAckMessage('unrecognized', c, 'he')).toMatch(/הבנתי שאתה רוצה/);
    expect(preferenceAckMessage('unrecognized', c, 'en')).toMatch(/I understood/);
  });

  it('high-value aliases resolve', () => {
    expect(extractPreferenceEvidence('תזכור שאני אוהב ברברה')!.valueId).toBe('barbera');
    expect(extractPreferenceEvidence('תזכור שאני אוהב פרימיטיבו')!.valueId).toBe('primitivo');
    expect(extractPreferenceEvidence('תזכור שאני אוהב אליאניקו')!.valueId).toBe('aglianico');
    expect(extractPreferenceEvidence('תזכור שאני אוהב טאורזי')!.valueId).toBe('taurasi');
    expect(extractPreferenceEvidence('תזכור שאני אוהב מלבק')!.valueId).toBe('malbec');
    expect(extractPreferenceEvidence('תזכור שאני אוהב קנונאו')!.valueId).toBe('cannonau');
    expect(lookupWineTermLabels('style', 'amarone')?.he).toBe('אמרונה');
  });

  it('bare Cabernet stays generic cabernet; Sauvignon phrase is specific', () => {
    expect(extractPreferenceEvidence('Remember that I like Cabernet')!.valueId).toBe('cabernet');
    expect(
      extractPreferenceEvidence('Remember that I like Cabernet Sauvignon')!.valueId
    ).toBe('cabernet_sauvignon');
  });
});
