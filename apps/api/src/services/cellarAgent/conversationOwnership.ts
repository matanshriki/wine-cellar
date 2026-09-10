/**
 * Validate optional conversation_id ownership for Phase 2B.1 pending taste flows.
 * Uses user JWT + RLS — never trusts client ID without a row visible to auth.uid().
 */

import type { SupabaseClient } from '@supabase/supabase-js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ConversationIdValidation =
  | { ok: true; conversationId: string | null }
  | { ok: false; reason: 'invalid_format' | 'forbidden' };

/**
 * null/undefined/empty → allowed (legacy clients).
 * Non-empty → must be UUID and owned by the authenticated user (RLS).
 */
export async function validateOwnedConversationId(
  supabase: SupabaseClient,
  conversationId: string | null | undefined
): Promise<ConversationIdValidation> {
  if (conversationId == null || conversationId === '') {
    return { ok: true, conversationId: null };
  }

  const id = conversationId.trim();
  if (!UUID_RE.test(id)) {
    return { ok: false, reason: 'invalid_format' };
  }

  const { data, error } = await supabase
    .from('sommelier_conversations')
    .select('id')
    .eq('id', id)
    .maybeSingle();

  if (error || !data?.id) {
    return { ok: false, reason: 'forbidden' };
  }

  return { ok: true, conversationId: data.id };
}
