import { describe, expect, it } from 'vitest';
import {
  generateConversationTitle,
  isPlaceholderConversationTitle,
  resolveConversationTitle,
} from './conversationTitle';
import type { AgentMessage } from './agentService';

function userMsg(content: string): AgentMessage {
  return { role: 'user', content, timestamp: new Date().toISOString() };
}

describe('conversation titles', () => {
  it('treats null and New conversation as placeholders', () => {
    expect(isPlaceholderConversationTitle(null)).toBe(true);
    expect(isPlaceholderConversationTitle('')).toBe(true);
    expect(isPlaceholderConversationTitle('New conversation')).toBe(true);
    expect(isPlaceholderConversationTitle('Steak for dinner')).toBe(false);
  });

  it('generates a title from the first user message', () => {
    expect(
      generateConversationTitle([
        { role: 'assistant', content: 'Hi', timestamp: '1', isGreeting: true },
        userMsg('What should I open with steak tonight?'),
      ])
    ).toBe('What should I open with steak tonight?');
  });

  it('replaces placeholder titles after the first real turn', () => {
    expect(
      resolveConversationTitle('New conversation', [
        userMsg('Romantic date night bottle please'),
      ])
    ).toBe('Romantic date night bottle please');

    expect(
      resolveConversationTitle('Keep this title', [userMsg('Later message')])
    ).toBe('Keep this title');
  });
});
