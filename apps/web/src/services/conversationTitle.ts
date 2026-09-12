/**
 * Pure helpers for sommelier conversation titles (no Supabase / browser deps).
 */

import type { AgentMessage } from './agentService';

/**
 * Generate a title for a conversation based on its first user message.
 * Returns a short, descriptive title (max 50 chars).
 */
export function generateConversationTitle(messages: AgentMessage[]): string {
  if (messages.length === 0) {
    return 'New conversation';
  }

  const firstUserMessage = messages.find((m) => m.role === 'user');
  if (!firstUserMessage) {
    return 'New conversation';
  }

  const content = firstUserMessage.content.trim();
  if (!content) {
    return 'New conversation';
  }

  if (content.length <= 50) {
    return content;
  }

  return content.substring(0, 47) + '...';
}

/** Placeholder used before the first real user turn is persisted. */
export function isPlaceholderConversationTitle(title: string | null | undefined): boolean {
  return !title || title.trim() === '' || title.trim() === 'New conversation';
}

/**
 * Keep a real title; replace null/placeholder with one derived from messages.
 */
export function resolveConversationTitle(
  existingTitle: string | null | undefined,
  messages: AgentMessage[]
): string {
  if (!isPlaceholderConversationTitle(existingTitle)) {
    return existingTitle!.trim();
  }
  return generateConversationTitle(messages);
}
