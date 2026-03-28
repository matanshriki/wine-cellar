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
  it('defaults to recommend for dinner questions', () => {
    expect(classifyAgentRoute('What should I open for steak tonight?')).toBe('recommend');
  });
  it('does not steal pairing questions as feedback', () => {
    expect(classifyAgentRoute('Something perfect with salmon for tonight')).toBe('recommend');
  });
  it('routes similar', () => {
    expect(classifyAgentRoute('What else do I have like this?')).toBe('similar');
  });
});
