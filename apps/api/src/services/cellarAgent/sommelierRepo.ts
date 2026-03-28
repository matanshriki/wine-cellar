/**
 * Supabase persistence for sommelier agent (user JWT — RLS enforced).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { RecommendationExplanation, RecommendationOutcome, SommelierPreferenceMemory } from './sommelierTypes.js';

const DEFAULT_MEMORY: SommelierPreferenceMemory = { version: 1 };

export async function loadSommelierMemory(
  userId: string,
  supabase: SupabaseClient
): Promise<SommelierPreferenceMemory> {
  const { data, error } = await supabase
    .from('sommelier_agent_memory')
    .select('preferences')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.warn('[Sommelier][memory] load failed:', error.message);
    return { ...DEFAULT_MEMORY };
  }

  if (!data?.preferences || typeof data.preferences !== 'object') {
    return { ...DEFAULT_MEMORY };
  }

  return mergeMemoryDefaults(data.preferences as SommelierPreferenceMemory);
}

function mergeMemoryDefaults(p: SommelierPreferenceMemory): SommelierPreferenceMemory {
  return {
    ...DEFAULT_MEMORY,
    ...p,
    version: p.version || 1,
  };
}

export async function saveSommelierMemory(
  userId: string,
  preferences: SommelierPreferenceMemory,
  supabase: SupabaseClient
): Promise<void> {
  const { error } = await supabase.from('sommelier_agent_memory').upsert(
    {
      user_id: userId,
      preferences: { ...preferences, version: preferences.version || 1 },
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    console.warn('[Sommelier][memory] save failed:', error.message);
  }
}

export async function mergeAndSavePreferences(
  userId: string,
  delta: Partial<SommelierPreferenceMemory>,
  supabase: SupabaseClient
): Promise<SommelierPreferenceMemory> {
  const current = await loadSommelierMemory(userId, supabase);
  const merged: SommelierPreferenceMemory = {
    ...current,
    ...delta,
    preferredStyles: uniq([...(current.preferredStyles || []), ...(delta.preferredStyles || [])]),
    dislikedProfiles: uniq([...(current.dislikedProfiles || []), ...(delta.dislikedProfiles || [])]),
    favoriteGrapes: uniq([...(current.favoriteGrapes || []), ...(delta.favoriteGrapes || [])]),
    favoriteRegions: uniq([...(current.favoriteRegions || []), ...(delta.favoriteRegions || [])]),
    bodyPreference: delta.bodyPreference ?? current.bodyPreference,
    occasionPreference: delta.occasionPreference ?? current.occasionPreference,
    version: 1,
  };
  await saveSommelierMemory(userId, merged, supabase);
  return merged;
}

function uniq(arr: string[]): string[] {
  return [...new Set(arr.map((s) => s.trim().toLowerCase()).filter(Boolean))];
}

/**
 * Load recently recommended bottle IDs (last N events) to penalize repeats.
 * Returns a flat Set of bottle IDs chosen in recent turns.
 */
export async function loadRecentRecommendedBottleIds(
  userId: string,
  supabase: SupabaseClient,
  limit = 5
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('sommelier_recommendation_events')
    .select('chosen_bottle_ids')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return new Set();

  const ids = new Set<string>();
  for (const row of data) {
    const arr = row.chosen_bottle_ids;
    if (Array.isArray(arr)) {
      for (const id of arr) {
        if (typeof id === 'string' && id.length > 0) ids.add(id);
      }
    }
  }
  return ids;
}

export interface RecommendationEventInsert {
  user_message: string;
  detected_intent: string;
  shortlist_bottle_ids: string[];
  chosen_bottle_ids: string[];
  response_type: string;
  explanation: RecommendationExplanation | null;
  taste_context_present: boolean;
}

export async function insertRecommendationEvent(
  userId: string,
  row: RecommendationEventInsert,
  supabase: SupabaseClient
): Promise<string | null> {
  const { data, error } = await supabase
    .from('sommelier_recommendation_events')
    .insert({
      user_id: userId,
      user_message: row.user_message.slice(0, 4000),
      detected_intent: row.detected_intent,
      shortlist_bottle_ids: row.shortlist_bottle_ids,
      chosen_bottle_ids: row.chosen_bottle_ids,
      response_type: row.response_type,
      explanation: row.explanation,
      taste_context_present: row.taste_context_present,
      outcome: 'pending',
    })
    .select('id')
    .single();

  if (error) {
    console.warn('[Sommelier][events] insert failed:', error.message);
    return null;
  }

  return data?.id ?? null;
}

export async function updateRecommendationOutcome(
  eventId: string,
  userId: string,
  outcome: RecommendationOutcome,
  supabase: SupabaseClient
): Promise<boolean> {
  const { error } = await supabase
    .from('sommelier_recommendation_events')
    .update({ outcome })
    .eq('id', eventId)
    .eq('user_id', userId);

  if (error) {
    console.warn('[Sommelier][events] outcome update failed:', error.message);
    return false;
  }
  return true;
}

export async function insertFeedbackEvent(
  userId: string,
  params: {
    recommendation_event_id?: string | null;
    bottle_id?: string | null;
    raw_text: string;
    structured_tags: string[];
    sentiment?: string | null;
    preference_delta?: Record<string, unknown> | null;
  },
  supabase: SupabaseClient
): Promise<string | null> {
  const { data, error } = await supabase
    .from('sommelier_feedback_events')
    .insert({
      user_id: userId,
      recommendation_event_id: params.recommendation_event_id ?? null,
      bottle_id: params.bottle_id ?? null,
      raw_text: params.raw_text.slice(0, 4000),
      structured_tags: params.structured_tags,
      sentiment: params.sentiment ?? null,
      preference_delta: params.preference_delta ?? null,
    })
    .select('id')
    .single();

  if (error) {
    console.warn('[Sommelier][feedback] insert failed:', error.message);
    return null;
  }
  return data?.id ?? null;
}

export async function insertTastingDraft(
  userId: string,
  params: { bottle_id?: string | null; draft_text: string; source_event_id?: string | null },
  supabase: SupabaseClient
): Promise<string | null> {
  const { data, error } = await supabase
    .from('sommelier_tasting_drafts')
    .insert({
      user_id: userId,
      bottle_id: params.bottle_id ?? null,
      draft_text: params.draft_text.slice(0, 8000),
      source_event_id: params.source_event_id ?? null,
    })
    .select('id')
    .single();

  if (error) {
    console.warn('[Sommelier][drafts] insert failed:', error.message);
    return null;
  }
  return data?.id ?? null;
}
