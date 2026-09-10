/**
 * Phase 2A kill-switch + canonical evidence apply client (user JWT supabase).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildIdempotencyKey,
  extractPreferenceEvidence,
  type ExtractedPreferenceCandidate,
} from './preferenceExtractRules.js';
import { mergeAndSavePreferences } from './sommelierRepo.js';
import type { SommelierPreferenceMemory } from './sommelierTypes.js';
import { logSommelier, logSommelierWarn, shortUser } from './sommelierLog.js';

/**
 * CANONICAL_TASTE_WRITES — default OFF when missing/invalid.
 * Truth table: missing/empty/0/false/off → OFF; 1/true/on → ON; other → OFF + warn.
 */
export function isCanonicalTasteWritesEnabled(): boolean {
  const raw = process.env.CANONICAL_TASTE_WRITES;
  if (raw === undefined || raw === null) return false;
  const v = String(raw).trim().toLowerCase();
  if (v === '') return false;
  if (v === '1' || v === 'true' || v === 'on') return true;
  if (v === '0' || v === 'false' || v === 'off') return false;
  console.warn('[Sommelier] CANONICAL_TASTE_WRITES invalid value; treating as OFF:', v.slice(0, 32));
  return false;
}

export type CanonicalApplyResult = {
  candidate: ExtractedPreferenceCandidate;
  eventId: string | null;
  canonicalApplied: boolean;
  reason: string;
  acknowledgmentKind:
    | 'remember_saved'
    | 'remember_disabled'
    | 'general_ack'
    | 'unsupported_change'
    | 'session_ack'
    | 'bottle_ack'
    | 'none';
  memoryDualWrite: 'ok' | 'failed' | 'skipped' | 'legacy_only';
};

function legacyMemoryDelta(
  candidate: ExtractedPreferenceCandidate
): Partial<SommelierPreferenceMemory> | null {
  if (candidate.class !== 'stable_remember' || candidate.polarity !== 'like') return null;
  const delta: Partial<SommelierPreferenceMemory> = { version: 1 };
  if (candidate.dimension === 'region') {
    delta.favoriteRegions = [candidate.labelEn || candidate.valueId];
    return delta;
  }
  if (candidate.dimension === 'grape') {
    delta.favoriteGrapes = [candidate.labelEn || candidate.valueId];
    return delta;
  }
  if (candidate.dimension === 'body') {
    if (candidate.valueId === 'light' || candidate.valueId === 'full') {
      delta.bodyPreference = candidate.valueId;
      return delta;
    }
  }
  return null;
}

async function writeLegacyMemory(
  userId: string,
  candidate: ExtractedPreferenceCandidate,
  supabase: SupabaseClient
): Promise<'ok' | 'failed' | 'skipped'> {
  const delta = legacyMemoryDelta(candidate);
  if (!delta) return 'skipped';
  try {
    await mergeAndSavePreferences(userId, delta, supabase);
    return 'ok';
  } catch {
    return 'failed';
  }
}

export async function processPreferenceMessage(params: {
  userId: string;
  message: string;
  supabase: SupabaseClient;
  language?: 'en' | 'he';
}): Promise<CanonicalApplyResult | null> {
  const candidate = extractPreferenceEvidence(params.message);
  if (!candidate) return null;

  const writesOn = isCanonicalTasteWritesEnabled();
  const wantApply = writesOn && candidate.applyCanonical;

  const idempotencyKey = buildIdempotencyKey({
    userId: params.userId,
    message: params.message,
    candidate,
  });

  let eventId: string | null = null;
  let canonicalApplied = false;
  let reason = 'skipped';
  let memoryDualWrite: CanonicalApplyResult['memoryDualWrite'] = 'skipped';
  let rpcOk = false;

  try {
    const { data, error } = await params.supabase.rpc('apply_taste_evidence_and_canonical', {
      p_payload: {
        idempotency_key: idempotencyKey,
        scope: candidate.scope,
        polarity: candidate.polarity,
        status: candidate.status,
        target_dimension: candidate.dimension,
        target_value: candidate.valueId,
        locale: candidate.locale,
        extraction_version: candidate.extractionVersion,
        raw_text: params.message.slice(0, 4000),
        structured_tags: [candidate.class, candidate.dimension, candidate.valueId],
        sentiment:
          candidate.polarity === 'like'
            ? 'positive'
            : candidate.polarity === 'dislike'
              ? 'negative'
              : 'neutral',
        apply_canonical: wantApply,
        label_en: candidate.labelEn ?? null,
        label_he: candidate.labelHe ?? null,
        preference_delta: {
          schema: 'pref_evidence_v1',
          class: candidate.class,
          polarity: candidate.polarity,
          dimension: candidate.dimension,
          value_id: candidate.valueId,
          confidence: candidate.confidence,
          requires_confirmation: candidate.status === 'pending_unsupported',
          applied_to_canonical: false,
          source_route: 'memory_update',
          extraction_method: 'rules_v2',
        },
      },
    });

    if (error) {
      logSommelierWarn('taste_evidence_rpc', {
        user: shortUser(params.userId),
        code: error.code,
        message: error.message?.slice(0, 120),
      });
      reason = 'rpc_error';
    } else {
      rpcOk = true;
      const row = data as {
        event_id?: string;
        canonical_applied?: boolean;
        reason?: string;
      } | null;
      eventId = row?.event_id ?? null;
      canonicalApplied = !!row?.canonical_applied;
      reason = row?.reason ?? 'ok';
    }
  } catch (e) {
    logSommelierWarn('taste_evidence_rpc_throw', {
      user: shortUser(params.userId),
      err: e instanceof Error ? e.message.slice(0, 120) : 'unknown',
    });
    reason = 'rpc_throw';
  }

  // Dual-write legacy memory only after successful canonical apply (kill-switch ON path).
  if (canonicalApplied) {
    const mem = await writeLegacyMemory(params.userId, candidate, params.supabase);
    memoryDualWrite = mem;
    if (mem === 'failed') {
      logSommelierWarn('taste_memory_dual_write_failed', {
        user: shortUser(params.userId),
        event: eventId ?? 'none',
      });
    }
  } else if (
    !writesOn &&
    candidate.class === 'stable_remember' &&
    candidate.applyCanonical
  ) {
    // Kill-switch OFF: keep legacy agent-memory behavior without claiming canonical save.
    const mem = await writeLegacyMemory(params.userId, candidate, params.supabase);
    memoryDualWrite = mem === 'ok' ? 'legacy_only' : mem;
  }

  let acknowledgmentKind: CanonicalApplyResult['acknowledgmentKind'] = 'none';
  if (candidate.class === 'stable_remember') {
    if (canonicalApplied) acknowledgmentKind = 'remember_saved';
    else if (reason === 'contradiction' || candidate.status === 'pending_unsupported') {
      acknowledgmentKind = 'unsupported_change';
    } else acknowledgmentKind = 'remember_disabled';
  } else if (candidate.class === 'retraction' || candidate.class === 'contradiction') {
    acknowledgmentKind = 'unsupported_change';
  } else if (candidate.class === 'stable_general') {
    acknowledgmentKind = 'general_ack';
  } else if (candidate.class === 'session') {
    acknowledgmentKind = 'session_ack';
  } else if (candidate.class === 'bottle') {
    acknowledgmentKind = 'bottle_ack';
  } else if (candidate.class === 'ambiguous' || candidate.class === 'operational') {
    acknowledgmentKind = 'none';
  }

  logSommelier('taste_preference_extract', {
    user: shortUser(params.userId),
    class: candidate.class,
    applied: canonicalApplied ? 'yes' : 'no',
    writes: writesOn ? 'on' : 'off',
    rpc: rpcOk ? 'ok' : 'fail',
    reason,
  });

  return {
    candidate,
    eventId,
    canonicalApplied,
    reason,
    acknowledgmentKind,
    memoryDualWrite,
  };
}

export function preferenceAckMessage(
  kind: CanonicalApplyResult['acknowledgmentKind'],
  candidate: ExtractedPreferenceCandidate,
  language: 'en' | 'he' = 'en'
): string | null {
  const label =
    language === 'he'
      ? candidate.labelHe || candidate.labelEn || candidate.valueId
      : candidate.labelEn || candidate.valueId;

  if (kind === 'remember_saved') {
    if (language === 'he') {
      if (candidate.dimension === 'body') {
        return `הבנתי — אזכור שאתה מעדיף יינות עם גוף ${candidate.valueId === 'full' ? 'מלא' : candidate.valueId === 'light' ? 'קל' : 'בינוני'}.`;
      }
      if (candidate.dimension === 'region') {
        return `הבנתי — אזכור שאתה מעדיף יינות מ${label}.`;
      }
      return `הבנתי — אזכור שאתה מעדיף ${label}.`;
    }
    if (candidate.dimension === 'body') {
      return `Got it — I'll remember that you prefer ${candidate.valueId}-bodied wines.`;
    }
    return `Got it — I'll remember that you prefer ${label}.`;
  }

  if (kind === 'remember_disabled') {
    return language === 'he'
      ? 'קיבלתי. שמרתי את זה כהעדפה לשיחה — עדכון הפרופיל הקבוע לא פעיל כרגע.'
      : "Got it. I've noted that for this chat — permanent profile updates are not enabled right now.";
  }

  if (kind === 'unsupported_change') {
    return language === 'he'
      ? 'רשמתי את הבקשה, אבל עדיין לא ניתן לשנות או להסיר העדפה שמורה מהצ׳אט. ההעדפה הקיימת לא שונתה.'
      : "I've recorded that, but changing or removing a remembered preference from chat isn't supported yet. Your existing preference was not changed.";
  }

  if (kind === 'general_ack') {
    return language === 'he'
      ? `קיבלתי לגבי ${label}. כדי לשמור את זה בפרופיל, כתוב במפורש \"תזכור ש...\"`
      : `Noted about ${label}. To save it to your profile, say explicitly \"Remember that...\".`;
  }

  if (kind === 'session_ack') {
    return language === 'he'
      ? 'מעולה — אתאים את ההמלצה להקשר של עכשיו, בלי לשנות את ההעדפות הקבועות.'
      : "Sounds good — I'll tailor this recommendation for now, without changing your lasting preferences.";
  }

  if (kind === 'bottle_ack') {
    return language === 'he'
      ? 'תודה על המשוב על היין הזה — שמרתי אותו כראיה בלי לשנות את טעם הפרופיל הכללי.'
      : "Thanks for the feedback on that bottle — I've saved it as evidence without changing your overall taste profile.";
  }

  return null;
}
