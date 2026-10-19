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
