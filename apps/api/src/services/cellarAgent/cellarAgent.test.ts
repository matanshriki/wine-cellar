import { describe, it, expect } from 'vitest';
import { classifyAgentRoute } from './agentRouter.js';
import { parseChosenBottleIds } from './chosenBottleIds.js';
import { inferMemoryUpdateFromText } from './preferenceInference.js';

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
