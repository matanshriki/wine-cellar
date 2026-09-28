/**
 * Persist / load / retract wine-level experiences on sommelier_feedback_events.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ExtractedPreferenceCandidate } from './preferenceExtractRules.js';
import { buildIdempotencyKey } from './preferenceExtractRules.js';
import { loadBottleCatalogForWineMemory } from './cellarInventoryRepo.js';
import { resolveWinePhraseInCellar } from './wineExperienceResolve.js';
import type { CellarBottleInput } from './types.js';
import {
  WINE_EXPERIENCE_SCHEMA,
  isWineExperienceDelta,
  wineExperienceIdentityKey,
  type PublicWineExperienceItem,
  type WineExperienceDelta,
  type WineExperiencePolarity,
  type WineExperienceRecord,
} from './wineExperienceTypes.js';
import { logSommelier, logSommelierWarn, shortUser } from './sommelierLog.js';

export type WineExperienceProcessResult = {
  kind: 'saved' | 'clarification' | 'corrected' | 'error';
  eventId: string | null;
  message: string;
  followUpQuestion?: string;
  record?: WineExperienceRecord;
  clarificationOptions?: Array<{ bottleId: string; label: string }>;
};

function buildDelta(params: {
  phrase: string;
  polarity: WineExperiencePolarity;
  softGrapeHint?: string;
  resolve: ReturnType<typeof resolveWinePhraseInCellar>;
  reasonText?: string | null;
}): WineExperienceDelta {
  if (params.resolve.status === 'matched') {
    const b = params.resolve.bottle;
    return {
      schema: WINE_EXPERIENCE_SCHEMA,
      wine_id: b.wineId,
      bottle_id: b.bottleId,
      producer: b.producer || null,
      wine_name: b.wineName || null,
      vintage: b.vintage,
      display_label: b.label || params.phrase,
      match_status: 'matched',
      soft_grape_hint: params.softGrapeHint ?? null,
      reason_text: params.reasonText ?? null,
    };
  }
  return {
    schema: WINE_EXPERIENCE_SCHEMA,
    wine_id: null,
    bottle_id: null,
    producer: null,
    wine_name: null,
    vintage: null,
    display_label: params.phrase,
    match_status: 'unresolved',
    soft_grape_hint: params.softGrapeHint ?? null,
    reason_text: params.reasonText ?? null,
  };
}

type ActiveIdentityRow = {
  id: string;
  polarity: 'like' | 'dislike';
  preference_delta: unknown;
};

async function listActiveWineExperienceRows(
  supabase: SupabaseClient,
  userId: string
): Promise<ActiveIdentityRow[]> {
  const { data, error } = await supabase
    .from('sommelier_feedback_events')
    .select('id, polarity, preference_delta')
    .eq('user_id', userId)
    .eq('scope', 'bottle')
    .eq('status', 'active')
    .in('polarity', ['like', 'dislike']);

  if (error || !data?.length) return [];
  return data.map((row) => ({
    id: row.id as string,
    polarity: row.polarity === 'dislike' ? 'dislike' : 'like',
    preference_delta: row.preference_delta,
  }));
}

async function findActiveForIdentity(
  supabase: SupabaseClient,
  userId: string,
  identityKey: string
): Promise<ActiveIdentityRow | null> {
  const rows = await listActiveWineExperienceRows(supabase, userId);
  for (const row of rows) {
    if (!isWineExperienceDelta(row.preference_delta)) continue;
    if (wineExperienceIdentityKey(row.preference_delta) === identityKey) {
      return row;
    }
  }
  return null;
}

async function retractActiveForIdentity(
  supabase: SupabaseClient,
  userId: string,
  identityKey: string
): Promise<number> {
  const rows = await listActiveWineExperienceRows(supabase, userId);
  const toRetract = rows.filter((row) => {
    if (!isWineExperienceDelta(row.preference_delta)) return false;
    return wineExperienceIdentityKey(row.preference_delta) === identityKey;
  });

  if (!toRetract.length) return 0;

  const ids = toRetract.map((r) => r.id);
  const { error: upErr } = await supabase
    .from('sommelier_feedback_events')
    .update({ status: 'retracted', polarity: 'retract' })
    .in('id', ids)
    .eq('user_id', userId);

  if (upErr) {
    logSommelierWarn('wine_experience_retract', {
      user: shortUser(userId),
      message: upErr.message.slice(0, 120),
    });
    return 0;
  }
  return ids.length;
}

/** Keep one active signal per wine identity (newest first). */
export function dedupeWineExperiencesByIdentity(
  records: WineExperienceRecord[]
): WineExperienceRecord[] {
  const seen = new Set<string>();
  const out: WineExperienceRecord[] = [];
  for (const r of records) {
    const key = wineExperienceIdentityKey({
      wine_id: r.wineId,
      display_label: r.displayLabel,
    });
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

export async function processWineExperienceMessage(params: {
  userId: string;
  message: string;
  candidate: ExtractedPreferenceCandidate;
  cellarBottles: CellarBottleInput[];
  supabase: SupabaseClient;
  language?: 'en' | 'he';
}): Promise<WineExperienceProcessResult> {
  const language = params.language === 'he' ? 'he' : 'en';
  const phrase = (params.candidate.wineNamePhrase || params.candidate.labelEn || '').trim();
  if (!phrase) {
    return {
      kind: 'error',
      eventId: null,
      message:
        language === 'he'
          ? 'לא הבנתי איזה יין לזכור. ציין יקב ושם יין.'
          : "I couldn't tell which wine to remember. Name the producer and wine.",
    };
  }

  const polarity: WineExperiencePolarity =
    params.candidate.polarity === 'dislike' ? 'dislike' : 'like';

  // Prefer in-stock cellar; if no confident match, include consumed/zero-qty rows
  // so wine_id can still be snapped after a bottle left the cellar.
  let resolvePool = params.cellarBottles;
  let resolved = resolveWinePhraseInCellar(phrase, resolvePool);
  if (resolved.status === 'unresolved') {
    const catalog = await loadBottleCatalogForWineMemory(
      params.userId,
      params.supabase
    );
    if (catalog.length) {
      const byId = new Map(resolvePool.map((b) => [b.id, b]));
      for (const b of catalog) {
        if (!byId.has(b.id)) byId.set(b.id, b);
      }
      resolvePool = [...byId.values()];
      resolved = resolveWinePhraseInCellar(phrase, resolvePool);
    }
  }

  if (resolved.status === 'ambiguous') {
    const opts = resolved.candidates.map((c) => ({
      bottleId: c.bottleId,
      label: c.vintage ? `${c.label} (${c.vintage})` : c.label,
    }));
    return {
      kind: 'clarification',
      eventId: null,
      message:
        language === 'he'
          ? `מצאתי כמה יינות דומים. לאיזה התכוונת?\n${opts.map((o, i) => `${i + 1}. ${o.label}`).join('\n')}`
          : `I found a few similar wines. Which one did you mean?\n${opts.map((o, i) => `${i + 1}. ${o.label}`).join('\n')}`,
      followUpQuestion:
        language === 'he' ? 'בחר את היין מהרשימה' : 'Reply with the wine number or full name',
      clarificationOptions: opts,
    };
  }

  const delta = buildDelta({
    phrase,
    polarity,
    softGrapeHint: params.candidate.softGrapeHint,
    resolve: resolved,
    reasonText: params.message.slice(0, 400),
  });

  const identityKey = wineExperienceIdentityKey(delta);

  // Same wine + same polarity already active → do not retract/re-insert.
  // Retracting first then calling the RPC with the same idempotency key leaves
  // the row retracted (RPC returns existing without reactivating).
  const existing = await findActiveForIdentity(
    params.supabase,
    params.userId,
    identityKey
  );
  if (existing && existing.polarity === polarity) {
    const label = delta.display_label;
    const vibe =
      polarity === 'like'
        ? language === 'he'
          ? 'אהבת'
          : 'loved'
        : language === 'he'
          ? 'לא אהבת'
          : "didn't like";
    return {
      kind: 'saved',
      eventId: existing.id,
      message:
        language === 'he'
          ? `כבר זכור אצלי ש${vibe} את ${label}.`
          : `I already remember you ${vibe} ${label}.`,
      record: {
        eventId: existing.id,
        polarity,
        displayLabel: label,
        wineId: delta.wine_id,
        bottleId: delta.bottle_id,
        producer: delta.producer,
        wineName: delta.wine_name,
        vintage: delta.vintage,
        matchStatus: delta.match_status,
        softGrapeHint: delta.soft_grape_hint ?? null,
        rawText: params.message,
        createdAt: null,
      },
    };
  }

  const retracted = await retractActiveForIdentity(
    params.supabase,
    params.userId,
    identityKey
  );

  const idempotencyKey = buildIdempotencyKey({
    userId: params.userId,
    message: params.message,
    candidate: params.candidate,
  });

  try {
    const { data, error } = await params.supabase.rpc('apply_taste_evidence_and_canonical', {
      p_payload: {
        idempotency_key: `${idempotencyKey}_wine`,
        scope: 'bottle',
        polarity,
        status: 'active',
        target_dimension: 'other',
        target_value: delta.wine_id || 'unresolved',
        locale: params.candidate.locale,
        extraction_version: params.candidate.extractionVersion,
        raw_text: params.message.slice(0, 4000),
        structured_tags: ['wine_experience', polarity, delta.match_status],
        sentiment: polarity === 'like' ? 'positive' : 'negative',
        apply_canonical: false,
        bottle_id: delta.bottle_id,
        preference_delta: delta,
      },
    });

    if (error) {
      logSommelierWarn('wine_experience_rpc', {
        user: shortUser(params.userId),
        message: error.message.slice(0, 120),
      });
      return {
        kind: 'error',
        eventId: null,
        message:
          language === 'he'
            ? 'לא הצלחתי לשמור את החוויה כרגע. נסה שוב.'
            : "I couldn't save that wine experience just now. Please try again.",
      };
    }

    const eventId =
      (data as { event_id?: string } | null)?.event_id ?? null;

    const label = delta.display_label;
    const vibe =
      polarity === 'like'
        ? language === 'he'
          ? 'אהבת'
          : 'loved'
        : language === 'he'
          ? 'לא אהבת'
          : "didn't like";

    let message: string;
    if (delta.match_status === 'matched') {
      message =
        language === 'he'
          ? `שמרתי ש${vibe} את ${label}${delta.vintage ? ` (${delta.vintage})` : ''}. אשתמש בזה בהמלצות — בלי להניח שאתה אוהב את כל היינות מאותו זן.`
          : `I'll remember you ${vibe} ${label}${delta.vintage ? ` (${delta.vintage})` : ''}. I'll use that experience in recommendations — without assuming you like every wine of that grape.`;
    } else {
      message =
        language === 'he'
          ? `שמרתי ש${vibe} את “${label}” (לא מצאתי התאמה מדויקת במרתף כרגע). אוכל לקשר כשיהיה בקבוק תואם.`
          : `I'll remember you ${vibe} “${label}” (no exact cellar match right now). I can link it if that wine shows up in your cellar.`;
    }

    if (retracted > 0) {
      message =
        language === 'he'
          ? `עדכנתי את הזיכרון ליין הזה. ${message}`
          : `Updated your memory for that wine. ${message}`;
    }

    logSommelier('wine_experience', {
      user: shortUser(params.userId),
      polarity,
      match: delta.match_status,
      retracted: String(retracted),
    });

    return {
      kind: retracted > 0 ? 'corrected' : 'saved',
      eventId,
      message,
      record: {
        eventId: eventId || '',
        polarity,
        displayLabel: label,
        wineId: delta.wine_id,
        bottleId: delta.bottle_id,
        producer: delta.producer,
        wineName: delta.wine_name,
        vintage: delta.vintage,
        matchStatus: delta.match_status,
        softGrapeHint: delta.soft_grape_hint ?? null,
        rawText: params.message,
        createdAt: null,
      },
    };
  } catch (e) {
    logSommelierWarn('wine_experience_throw', {
      user: shortUser(params.userId),
      err: e instanceof Error ? e.message.slice(0, 120) : 'unknown',
    });
    return {
      kind: 'error',
      eventId: null,
      message:
        language === 'he'
          ? 'לא הצלחתי לשמור את החוויה כרגע. נסה שוב.'
          : "I couldn't save that wine experience just now. Please try again.",
    };
  }
}

export async function loadActiveWineExperiences(
  userId: string,
  supabase: SupabaseClient
): Promise<WineExperienceRecord[]> {
  const { data, error } = await supabase
    .from('sommelier_feedback_events')
    .select(
      'id, bottle_id, raw_text, polarity, preference_delta, created_at, status, scope'
    )
    .eq('user_id', userId)
    .eq('scope', 'bottle')
    .eq('status', 'active')
    .in('polarity', ['like', 'dislike'])
    .order('created_at', { ascending: false })
    .limit(100);

  if (error || !data) return [];

  const out: WineExperienceRecord[] = [];
  for (const row of data) {
    const delta = row.preference_delta;
    if (!isWineExperienceDelta(delta)) continue;
    if (delta.schema !== WINE_EXPERIENCE_SCHEMA) continue;
    // Identity lives in preference_delta (survives bottle_id ON DELETE SET NULL).
    out.push({
      eventId: row.id,
      polarity: row.polarity === 'dislike' ? 'dislike' : 'like',
      displayLabel: delta.display_label,
      wineId: delta.wine_id,
      bottleId: delta.bottle_id ?? row.bottle_id ?? null,
      producer: delta.producer,
      wineName: delta.wine_name,
      vintage: delta.vintage,
      matchStatus: delta.match_status,
      softGrapeHint: delta.soft_grape_hint ?? null,
      rawText: row.raw_text,
      createdAt: row.created_at,
    });
  }
  return dedupeWineExperiencesByIdentity(out);
}

export function toPublicWineExperienceItems(
  records: WineExperienceRecord[]
): PublicWineExperienceItem[] {
  return records.map((r) => ({
    id: r.eventId,
    label: r.vintage ? `${r.displayLabel} (${r.vintage})` : r.displayLabel,
    polarity: r.polarity,
    vintage: r.vintage,
    wineId: r.wineId,
  }));
}

export async function retractWineExperienceEvent(params: {
  userId: string;
  eventId: string;
  supabase: SupabaseClient;
}): Promise<{ ok: boolean; reason: string }> {
  const { data, error } = await params.supabase
    .from('sommelier_feedback_events')
    .update({ status: 'retracted', polarity: 'retract' })
    .eq('id', params.eventId)
    .eq('user_id', params.userId)
    .eq('scope', 'bottle')
    .eq('status', 'active')
    .select('id')
    .maybeSingle();

  if (error) return { ok: false, reason: 'rpc_error' };
  if (!data) return { ok: false, reason: 'not_found' };
  return { ok: true, reason: 'retracted' };
}
