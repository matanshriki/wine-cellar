/**
 * Explicit agent actions — invoked only when routing rules match (never autonomous).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  insertFeedbackEvent,
  insertTastingDraft,
  mergeAndSavePreferences,
} from './sommelierRepo.js';
import type { SommelierPreferenceMemory } from './sommelierTypes.js';
import { inferFeedbackFromText } from './preferenceInference.js';

export async function saveSommelierFeedback(
  userId: string,
  params: {
    rawText: string;
    recommendationEventId?: string | null;
    bottleId?: string | null;
    supabase: SupabaseClient;
    applyToMemory?: boolean;
  }
): Promise<{ feedbackId: string | null; preferenceDelta: Partial<SommelierPreferenceMemory> }> {
  const inferred = inferFeedbackFromText(params.rawText);
  const feedbackId = await insertFeedbackEvent(
    userId,
    {
      recommendation_event_id: params.recommendationEventId ?? null,
      bottle_id: params.bottleId ?? null,
      raw_text: params.rawText,
      structured_tags: inferred.tags,
      sentiment: inferred.sentiment,
      preference_delta: inferred.preferenceDelta,
    },
    params.supabase
  );

  if (params.applyToMemory !== false && Object.keys(inferred.preferenceDelta).length > 0) {
    await mergeAndSavePreferences(userId, inferred.preferenceDelta, params.supabase);
  }

  return { feedbackId, preferenceDelta: inferred.preferenceDelta };
}

export async function createTastingNoteDraft(
  userId: string,
  params: {
    draftText: string;
    bottleId?: string | null;
    sourceEventId?: string | null;
    supabase: SupabaseClient;
  }
): Promise<string | null> {
  return insertTastingDraft(
    userId,
    {
      bottle_id: params.bottleId ?? null,
      draft_text: params.draftText,
      source_event_id: params.sourceEventId ?? null,
    },
    params.supabase
  );
}

/**
 * Record consumption + decrement inventory (mirrors web historyService.markBottleOpened).
 */
export async function markBottleOpened(
  userId: string,
  params: {
    bottleId: string;
    openedCount?: number;
    supabase: SupabaseClient;
    occasion?: string;
    vibe?: string;
  }
): Promise<{ ok: true; consumptionId: string } | { ok: false; error: string }> {
  const openedCount = params.openedCount ?? 1;
  if (openedCount < 1) {
    return { ok: false, error: 'Invalid opened count' };
  }

  const { data: bottle, error: bottleError } = await params.supabase
    .from('bottles')
    .select('id, wine_id, quantity')
    .eq('id', params.bottleId)
    .eq('user_id', userId)
    .single();

  if (bottleError || !bottle) {
    return { ok: false, error: 'Bottle not found' };
  }

  const qty = bottle.quantity as number;
  if (qty <= 0) {
    return { ok: false, error: 'No bottles left to open' };
  }
  if (openedCount > qty) {
    return { ok: false, error: 'Opened count exceeds available quantity' };
  }

  const { data: history, error: historyError } = await params.supabase
    .from('consumption_history')
    .insert({
      user_id: userId,
      bottle_id: params.bottleId,
      wine_id: bottle.wine_id,
      opened_quantity: openedCount,
      occasion: params.occasion ?? null,
      vibe: params.vibe ?? null,
    } as Record<string, unknown>)
    .select('id')
    .single();

  if (historyError || !history) {
    console.warn('[Sommelier][open] consumption insert failed:', historyError?.message);
    return { ok: false, error: 'Failed to record consumption' };
  }

  const newQuantity = qty - openedCount;
  const { error: updateError } = await params.supabase
    .from('bottles')
    .update({ quantity: newQuantity })
    .eq('id', params.bottleId)
    .eq('user_id', userId);

  if (updateError) {
    console.warn('[Sommelier][open] quantity update failed:', updateError.message);
    return { ok: false, error: 'Failed to update bottle quantity' };
  }

  return { ok: true, consumptionId: history.id as string };
}
