import { describe, it, expect } from 'vitest';
import { classifyAgentRoute } from './agentRouter.js';
import { parseChosenBottleIds } from './chosenBottleIds.js';

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
