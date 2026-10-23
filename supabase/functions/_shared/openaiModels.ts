/**
 * OpenAI model IDs for Edge Functions.
 *
 * Chat/vision default: gpt-6-luna (OpenAI replacement for gpt-4o-mini after
 * 2027-01-14 retirement). Override with Supabase secret OPENAI_CHAT_MODEL.
 *
 * Image default: gpt-image-2.5-flare (dall-e-3 shut down 2026-05-12).
 * Override with Supabase secret AI_IMAGE_MODEL.
 */

export const OPENAI_CHAT_MODEL =
  Deno.env.get('OPENAI_CHAT_MODEL')?.trim() || 'gpt-6-luna'

export const OPENAI_IMAGE_MODEL =
  Deno.env.get('AI_IMAGE_MODEL')?.trim() || 'gpt-image-2.5-flare'

export type OpenAiReasoningEffort =
  | 'none'
  | 'low'
  | 'medium'
  | 'high'
  | 'xhigh'
  | 'max'

function isReasoningChatModel(model: string): boolean {
  const m = model.toLowerCase()
  return (
    m.startsWith('gpt-5') ||
    m.startsWith('gpt-6') ||
    m.startsWith('o1') ||
    m.startsWith('o3')
  )
}

/**
 * Chat Completions sampling params compatible with OPENAI_CHAT_MODEL.
 *
 * GPT-5/6 quirks (confirmed against live API):
 * - `max_tokens` is rejected → use `max_completion_tokens`
 * - custom `temperature` is often rejected ("Only the default (1) value is supported")
 * - when reasoning is on, temperature/top_p are unsupported anyway
 *
 * For high-volume OCR / JSON extraction, pass `reasoningEffort: "none"` so we
 * don't burn the completion budget on hidden reasoning tokens.
 */
export function openaiChatSamplingParams(opts: {
  /** Ignored on gpt-5/6 — those models only accept the default temperature. */
  temperature?: number
  maxTokens?: number
  reasoningEffort?: OpenAiReasoningEffort
} = {}): Record<string, unknown> {
  const params: Record<string, unknown> = {}

  if (!isReasoningChatModel(OPENAI_CHAT_MODEL)) {
    if (opts.temperature !== undefined) {
      params.temperature = opts.temperature
    }
    if (opts.maxTokens !== undefined) {
      params.max_tokens = opts.maxTokens
    }
    return params
  }

  // Prefer none for extraction workloads so content isn't emptied by reasoning.
  params.reasoning_effort = opts.reasoningEffort ?? 'none'

  if (opts.maxTokens !== undefined) {
    params.max_completion_tokens = opts.maxTokens
  }

  // Do not send temperature on gpt-5/6 — API rejects non-default values.
  return params
}
