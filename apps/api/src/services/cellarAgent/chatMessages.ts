import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

/**
 * Normalize client history to OpenAI chat params (last N turns).
 */
export function sliceHistoryForChat(
  history: unknown,
  maxLen: number
): ChatCompletionMessageParam[] {
  const h = (Array.isArray(history) ? history : []) as Array<{
    role?: string;
    content?: string;
  }>;
  return h.slice(-maxLen).map((msg): ChatCompletionMessageParam => {
    const r = msg.role;
    const role: 'user' | 'assistant' | 'system' =
      r === 'assistant' ? 'assistant' : r === 'system' ? 'system' : 'user';
    return { role, content: String(msg.content ?? '') };
  });
}
