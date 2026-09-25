/**
 * Recover prior cellarAccess from persisted conversation messages (RLS user client).
 * Used when an older web client omits actionContext.lastCellarAccess.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { CellarAccessMeta } from './types.js';
import { validateOwnedConversationId } from './conversationOwnership.js';

function isCellarAccessMeta(v: unknown): v is CellarAccessMeta {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.scope === 'string' &&
    typeof o.scannedBottleRows === 'number' &&
    typeof o.matchedBottleRows === 'number' &&
    o.hardFilters != null &&
    typeof o.hardFilters === 'object'
  );
}

/**
 * Walk messages newest-first; return the latest assistant agentMeta.cellarAccess.
 */
export function extractLastCellarAccessFromMessages(messages: unknown): CellarAccessMeta | null {
  if (!Array.isArray(messages)) return null;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!m || typeof m !== 'object') continue;
    const row = m as Record<string, unknown>;
    if (row.role !== 'assistant') continue;
    const meta = row.agentMeta;
    if (!meta || typeof meta !== 'object') continue;
    const access = (meta as Record<string, unknown>).cellarAccess;
    if (isCellarAccessMeta(access)) return access;
  }
  return null;
}

export async function loadLastCellarAccessFromConversation(
  userId: string,
  conversationId: string | null | undefined,
  supabase: SupabaseClient
): Promise<CellarAccessMeta | null> {
  if (!conversationId) return null;
  const owned = await validateOwnedConversationId(supabase, conversationId);
  if (!owned.ok || !owned.conversationId) return null;

  const { data, error } = await supabase
    .from('sommelier_conversations')
    .select('messages')
    .eq('id', owned.conversationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return null;
  return extractLastCellarAccessFromMessages(data.messages);
}

/** True when prior access has enough state to continue the same inventory list. */
export function priorAccessHasListContext(prior: CellarAccessMeta | null | undefined): boolean {
  if (!prior?.hardFilters) return false;
  const hf = prior.hardFilters;
  return (
    hf.wantsKosher === true ||
    (hf.colors?.length ?? 0) > 0 ||
    (hf.storageLocationHints?.length ?? 0) > 0 ||
    !!hf.similarAnchorBottleId ||
    prior.matchedBottleRows > 0
  );
}
