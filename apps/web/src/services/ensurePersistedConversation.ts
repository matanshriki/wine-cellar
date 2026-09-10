/**
 * Ensure a persisted sommelier conversation thread exists before agent API calls.
 * Empty messages[] rows are allowed by schema (DEFAULT '[]').
 *
 * Create fn is injected so unit tests do not load the browser Supabase client.
 */

import type { AgentMessage } from './agentService';
import type { SommelierConversation } from './sommelierConversationService';

export type CreateConversationFn = (
  messages?: AgentMessage[],
  title?: string
) => Promise<SommelierConversation>;

/**
 * Serializes concurrent first-sends so only one empty conversation row is created.
 */
export function createConversationEnsureGate(createFn: CreateConversationFn) {
  let inFlight: Promise<SommelierConversation> | null = null;

  return {
    async ensure(
      current: SommelierConversation | null | undefined
    ): Promise<SommelierConversation> {
      if (current?.id) {
        return current;
      }
      if (!inFlight) {
        inFlight = createFn([], 'New conversation').finally(() => {
          inFlight = null;
        });
      }
      return inFlight;
    },
    reset() {
      inFlight = null;
    },
  };
}

/**
 * Return the active conversation, or create an empty owned row when missing.
 */
export async function ensurePersistedConversation(
  current: SommelierConversation | null | undefined,
  createFn: CreateConversationFn
): Promise<SommelierConversation> {
  if (current?.id) {
    return current;
  }
  return createFn([], 'New conversation');
}
