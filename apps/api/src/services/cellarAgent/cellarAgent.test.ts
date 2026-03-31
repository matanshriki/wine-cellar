import { describe, it, expect } from 'vitest';
import { classifyAgentRoute } from './agentRouter.js';
import { parseChosenBottleIds } from './chosenBottleIds.js';
import { inferMemoryUpdateFromText } from './preferenceInference.js';
import { extractConstraints, detectsSpecificProducerMention } from './tools.js';
import { scoreBottleHeuristically } from './heuristics.js';
import type { CellarBottleInput } from './types.js';

describe('parseChosenBottleIds', () => {
  it('parses string arrays', () => {
    expect(parseChosenBottleIds(['a', 'b'])).toEqual(['a', 'b']);
  });
  it('returns empty for null', () => {
    expect(parseChosenBottleIds(null)).toEqual([]);
  });
});

describe('classifyAgentRoute', () => {
  it('routes open bottle intents', () => {
    expect(classifyAgentRoute('I opened it')).toBe('open_bottle');
  });
  it('routes mark-as-open phrasing (not only "opened")', () => {
    expect(classifyAgentRoute('Please mark this bottle as open')).toBe('open_bottle');
    expect(classifyAgentRoute('Can you open this bottle?')).toBe('open_bottle');
  });
  it('routes short open follow-up when last recommendation bottle is known', () => {
    const ctx = { lastRecommendationBottleId: 'b0000000-0000-4000-8000-000000000001' };
    expect(classifyAgentRoute('open it', ctx)).toBe('open_bottle');
    expect(classifyAgentRoute('mark as open', ctx)).toBe('open_bottle');
  });
  it('defaults to recommend for dinner questions', () => {
    expect(classifyAgentRoute('What should I open for steak tonight?')).toBe('recommend');
  });
  it('does not steal pairing questions as feedback', () => {
    expect(classifyAgentRoute('Something perfect with salmon for tonight')).toBe('recommend');
  });
  it('routes similar', () => {
    expect(classifyAgentRoute('What else do I have like this?')).toBe('similar');
  });

  it('routes Hebrew open-bottle intents', () => {
    expect(classifyAgentRoute('סמן את הבקבוק כפתוח')).toBe('open_bottle');
    expect(classifyAgentRoute('פתחתי את הבקבוק')).toBe('open_bottle');
    expect(classifyAgentRoute('מה אפתח היום?')).toBe('recommend');
  });

  it('routes Hebrew similar and memory', () => {
    expect(classifyAgentRoute('מה עוד יש דומה לזה?')).toBe('similar');
    expect(classifyAgentRoute('תזכור שאני אוהב בורדו')).toBe('memory_update');
  });
});

describe('inferMemoryUpdateFromText', () => {
  it('extracts region preference from natural positive sentiment', () => {
    const result = inferMemoryUpdateFromText(
      'i was drinking this wine 2018 Viña Alberdi Reserva from La Rioja Alta in the past, and i really love it. it was a great wine.'
    );
    expect(result).not.toBeNull();
    expect(result?.favoriteRegions).toEqual(['rioja']);
  });

  it('extracts grape preference from casual praise', () => {
    const result = inferMemoryUpdateFromText(
      'I had an amazing Nebbiolo last week, loved every sip'
    );
    expect(result).not.toBeNull();
    expect(result?.favoriteGrapes).toEqual(['nebbiolo']);
  });

  it('returns null when no region/grape/body signal is present', () => {
    expect(inferMemoryUpdateFromText('the weather was great today')).toBeNull();
  });

  it('extracts body preference from explicit statement', () => {
    const result = inferMemoryUpdateFromText('I prefer lighter wines');
    expect(result).not.toBeNull();
    expect(result?.bodyPreference).toBe('light');
  });
});

// ─── Hebrew-specific regression tests (from real user report) ────────────────

describe('extractConstraints — Hebrew', () => {
  const PASSOVER_MSG =
    'מגניב. מחר בערב יש חג פסח, חשבתי לפתוח את אחד מהאדומים (של יקב רזיאל)';

  it('detects red color from Hebrew "אדומים"', () => {
    const c = extractConstraints(PASSOVER_MSG);
    expect(c.colors).toContain('red');
  });

  it('detects celebration occasion from Hebrew holiday terms', () => {
    const c = extractConstraints(PASSOVER_MSG);
    expect(c.occasionKeywords).toContain('celebration');
  });

  it('does not detect white or rosé when only reds mentioned', () => {
    const c = extractConstraints(PASSOVER_MSG);
    expect(c.colors).not.toContain('white');
    expect(c.colors).not.toContain('rose');
  });

  it('detects Hebrew לבן as white', () => {
    const c = extractConstraints('תן לי המלצה על יין לבן טוב');
    expect(c.colors).toContain('white');
  });
});

describe('detectsSpecificProducerMention', () => {
  it('detects Hebrew winery pattern יקב', () => {
    expect(detectsSpecificProducerMention('חשבתי לפתוח יין מיקב רזיאל')).toBe(true);
  });

  it('detects English "winery" keyword', () => {
    expect(detectsSpecificProducerMention('I want something from Yarden Winery')).toBe(true);
  });

  it('detects "château" keyword', () => {
    expect(detectsSpecificProducerMention('Do you have any Château Margaux?')).toBe(true);
  });

  it('returns false for general questions', () => {
    expect(detectsSpecificProducerMention('What should I drink tonight?')).toBe(false);
    expect(detectsSpecificProducerMention('מה כדאי לשתות הלילה?')).toBe(false);
  });
});

describe('scoreBottleHeuristically — explicit producer mention boost', () => {
  const base: CellarBottleInput = {
    id: 'test-1',
    producer: 'Raziel',
    wineName: 'Raziel Reserve',
    vintage: 2018,
    region: 'Galilee',
    country: 'Israel',
    grapes: ['Cabernet Sauvignon'],
    color: 'red',
    quantity: 2,
    readinessStatus: 'aging', // low base score
  };

  it('gives big boost when producer name appears in user message (Latin)', () => {
    const { score: scoreWithMention } = scoreBottleHeuristically(
      base,
      { requestedCount: null, colors: [], regionHints: [], grapeHints: [], foodKeywords: [], occasionKeywords: [], wantsSparkling: false, wantsChampagne: false },
      'i want to open the raziel reserve tonight',
      null,
      null
    );
    const { score: scoreWithout } = scoreBottleHeuristically(
      base,
      { requestedCount: null, colors: [], regionHints: [], grapeHints: [], foodKeywords: [], occasionKeywords: [], wantsSparkling: false, wantsChampagne: false },
      'i want something nice tonight',
      null,
      null
    );
    expect(scoreWithMention).toBeGreaterThan(scoreWithout + 25);
  });

  it('red color constraint boosts red Raziel bottle', () => {
    const constraints = extractConstraints(
      'מגניב. מחר בערב יש חג פסח, חשבתי לפתוח את אחד מהאדומים (של יקב רזיאל)'
    );
    expect(constraints.colors).toContain('red');
    const { score } = scoreBottleHeuristically(
      base,
      constraints,
      'מגניב. מחר בערב יש חג פסח, חשבתי לפתוח את אחד מהאדומים (של יקב רזיאל)',
      null,
      null
    );
    // Should get color_match (+22) + readiness base (8 for aging)
    expect(score).toBeGreaterThanOrEqual(30);
  });
});
