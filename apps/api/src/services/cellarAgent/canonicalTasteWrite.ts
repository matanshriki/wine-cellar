/**
 * Phase 2A/2B.1 kill-switch + canonical evidence / pending confirmation client.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildIdempotencyKey,
  extractPreferenceEvidence,
  type ExtractedPreferenceCandidate,
} from './preferenceExtractRules.js';
import {
  mergeAndSavePreferences,
  patchSommelierMemoryRemovals,
} from './sommelierRepo.js';
import type { SommelierPreferenceMemory } from './sommelierTypes.js';
import { logSommelier, logSommelierWarn, shortUser } from './sommelierLog.js';
import type { StructuredTasteProfile } from './tasteProfileTypes.js';
import {
  classifyConfirmationDecision,
  detectPendingTasteAction,
  pendingPromptMessage,
  resolveAckMessage,
  type PendingTasteAction,
} from './tasteConfirmation.js';
import { validateOwnedConversationId } from './conversationOwnership.js';

/**
 * CANONICAL_TASTE_WRITES — default OFF when missing/invalid.
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
    | 'pending_confirm'
    | 'not_found'
    | 'reaffirm'
    | 'unrecognized'
    | 'persist_failed'
    | 'none';
  memoryDualWrite: 'ok' | 'failed' | 'skipped' | 'legacy_only';
  pendingAction?: PendingTasteAction;
  /** Override message when pending/resolve needs exact bilingual text */
  messageOverride?: string;
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

async function syncLegacyAfterPendingApply(
  userId: string,
  action: PendingTasteAction,
  supabase: SupabaseClient
): Promise<'ok' | 'failed' | 'skipped'> {
  try {
    if (action.action === 'replace' && action.dimension === 'body' && action.proposedValue) {
      if (action.proposedValue === 'light' || action.proposedValue === 'full') {
        await patchSommelierMemoryRemovals(
          userId,
          { setBodyPreference: action.proposedValue },
          supabase
        );
        return 'ok';
      }
      // medium (or unexpected): clear legacy body so a prior light/full scalar cannot linger
      await patchSommelierMemoryRemovals(userId, { clearBodyPreference: true }, supabase);
      return 'ok';
    }
    if (action.action === 'remove' && action.dimension === 'body') {
      await patchSommelierMemoryRemovals(userId, { clearBodyPreference: true }, supabase);
      return 'ok';
    }
    if (action.action === 'remove' && action.dimension === 'region') {
      await patchSommelierMemoryRemovals(
        userId,
        { removeRegions: [action.existingValue, action.labelEn || ''].filter(Boolean) },
        supabase
      );
      return 'ok';
    }
    if (action.action === 'remove' && action.dimension === 'grape') {
      await patchSommelierMemoryRemovals(
        userId,
        { removeGrapes: [action.existingValue, action.labelEn || ''].filter(Boolean) },
        supabase
      );
      return 'ok';
    }
    if (action.action === 'remove' && action.dimension === 'style') {
      // Legacy agent memory has no styles list — canonical is authoritative.
      return 'skipped';
    }
    if (action.action === 'move_polarity' && action.dimension === 'region') {
      if (action.proposedPolarity === 'dislike') {
        await patchSommelierMemoryRemovals(
          userId,
          { removeRegions: [action.existingValue, action.labelEn || ''].filter(Boolean) },
          supabase
        );
      } else {
        await mergeAndSavePreferences(
          userId,
          { favoriteRegions: [action.labelEn || action.existingValue], version: 1 },
          supabase
        );
      }
      return 'ok';
    }
    if (action.action === 'move_polarity' && action.dimension === 'grape') {
      if (action.proposedPolarity === 'dislike') {
        await patchSommelierMemoryRemovals(
          userId,
          { removeGrapes: [action.existingValue, action.labelEn || ''].filter(Boolean) },
          supabase
        );
      } else {
        await mergeAndSavePreferences(
          userId,
          { favoriteGrapes: [action.labelEn || action.existingValue], version: 1 },
          supabase
        );
      }
      return 'ok';
    }
    return 'skipped';
  } catch {
    return 'failed';
  }
}

/** Exported for Profile UI create→resolve path (same legacy parity as chat). */
export async function syncLegacyAfterTasteConfirmation(
  userId: string,
  action: PendingTasteAction,
  supabase: SupabaseClient
): Promise<'ok' | 'failed' | 'skipped'> {
  return syncLegacyAfterPendingApply(userId, action, supabase);
}

export async function processPreferenceMessage(params: {
  userId: string;
  message: string;
  supabase: SupabaseClient;
  language?: 'en' | 'he';
  tasteProfile?: StructuredTasteProfile | null;
  conversationId?: string | null;
}): Promise<CanonicalApplyResult | null> {
  const candidate = extractPreferenceEvidence(params.message);
  if (!candidate) return null;

  const language = params.language === 'he' ? 'he' : 'en';
  const writesOn = isCanonicalTasteWritesEnabled();
  const pendingDetect = detectPendingTasteAction(candidate, params.tasteProfile ?? null);

  // ── Pending confirmation creation (2B.1) ─────────────────────────────────
  if (writesOn && pendingDetect.kind === 'pending') {
    const owned = await validateOwnedConversationId(
      params.supabase,
      params.conversationId
    );
    if (!owned.ok) {
      return {
        candidate,
        eventId: null,
        canonicalApplied: false,
        reason:
          owned.reason === 'invalid_format'
            ? 'invalid_conversation'
            : 'forbidden_conversation',
        acknowledgmentKind: 'unsupported_change',
        memoryDualWrite: 'skipped',
        messageOverride:
          language === 'he'
            ? 'לא הצלחתי לקשר את ההודעה לשיחה שלך. רענן ונסה שוב.'
            : "I couldn't tie that message to your conversation. Refresh and try again.",
      };
    }
    const conversationId = owned.conversationId;
    const action = pendingDetect.action;
    const idempotencyKey = buildIdempotencyKey({
      userId: params.userId,
      message: params.message,
      candidate,
    });
    try {
      const { data, error } = await params.supabase.rpc('create_taste_pending_confirmation', {
        p_payload: {
          idempotency_key: `${idempotencyKey}_pending`,
          action: action.action,
          dimension: action.dimension,
          existing_value: action.existingValue,
          proposed_value: action.proposedValue ?? null,
          proposed_polarity: action.proposedPolarity ?? null,
          locale: candidate.locale,
          raw_text: params.message.slice(0, 4000),
          conversation_id: conversationId,
          label_en: action.labelEn ?? candidate.labelEn ?? null,
          label_he: action.labelHe ?? candidate.labelHe ?? null,
        },
      });
      if (error) {
        logSommelierWarn('taste_pending_rpc', {
          user: shortUser(params.userId),
          code: error.code,
          message: error.message?.slice(0, 120),
        });
        return {
          candidate,
          eventId: null,
          canonicalApplied: false,
          reason: 'rpc_error',
          acknowledgmentKind: 'unsupported_change',
          memoryDualWrite: 'skipped',
        };
      }
      const row = data as { event_id?: string; reason?: string } | null;
      logSommelier('taste_preference_extract', {
        user: shortUser(params.userId),
        class: candidate.class,
        applied: 'no',
        writes: 'on',
        rpc: 'ok',
        reason: 'pending_confirmation',
      });
      return {
        candidate,
        eventId: row?.event_id ?? null,
        canonicalApplied: false,
        reason: 'pending_confirmation',
        acknowledgmentKind: 'pending_confirm',
        memoryDualWrite: 'skipped',
        pendingAction: action,
        messageOverride: pendingPromptMessage(action, language),
      };
    } catch (e) {
      logSommelierWarn('taste_pending_rpc_throw', {
        user: shortUser(params.userId),
        err: e instanceof Error ? e.message.slice(0, 120) : 'unknown',
      });
      return {
        candidate,
        eventId: null,
        canonicalApplied: false,
        reason: 'rpc_throw',
        acknowledgmentKind: 'unsupported_change',
        memoryDualWrite: 'skipped',
      };
    }
  }

  if (pendingDetect.kind === 'not_found') {
    return {
      candidate,
      eventId: null,
      canonicalApplied: false,
      reason: 'not_found',
      acknowledgmentKind: 'not_found',
      memoryDualWrite: 'skipped',
      messageOverride:
        language === 'he'
          ? 'לא מצאתי העדפה שמורה כזו להסרה.'
          : "I couldn't find that saved preference to remove.",
    };
  }

  if (pendingDetect.kind === 'reaffirm') {
    // Idempotent support: still write evidence with apply when writes on
    // Fall through to normal apply path with applyCanonical true for remember
  }

  // Kill switch OFF + would-be pending → do not claim mutation; legacy-only for remember
  if (!writesOn && pendingDetect.kind === 'pending') {
    return {
      candidate,
      eventId: null,
      canonicalApplied: false,
      reason: 'writes_off',
      acknowledgmentKind: 'unsupported_change',
      memoryDualWrite: 'skipped',
      messageOverride:
        language === 'he'
          ? 'רשמתי את הבקשה, אבל עדכון/הסרת העדפה שמורה מהצ׳אט לא פעיל כרגע. ההעדפה הקיימת לא שונתה.'
          : "I've noted that, but changing or removing a saved preference from chat isn't enabled right now. Your existing preference was not changed.",
    };
  }

  // Retraction without pending (writes off or not stored) already handled
  if (candidate.class === 'retraction' && pendingDetect.kind !== 'reaffirm') {
    if (pendingDetect.kind === 'none') {
      return {
        candidate,
        eventId: null,
        canonicalApplied: false,
        reason: 'not_found',
        acknowledgmentKind: 'not_found',
        memoryDualWrite: 'skipped',
        messageOverride:
          language === 'he'
            ? 'לא מצאתי העדפה שמורה כזו להסרה.'
            : "I couldn't find that saved preference to remove.",
      };
    }
  }

  const wantApply =
    writesOn &&
    candidate.applyCanonical &&
    (pendingDetect.kind === 'apply_direct' ||
      pendingDetect.kind === 'reaffirm' ||
      pendingDetect.kind === 'none');

  // First-time remember-dislike: create pending + auto-confirm (no user prompt)
  if (
    writesOn &&
    pendingDetect.kind === 'apply_direct' &&
    candidate.class === 'stable_remember' &&
    candidate.polarity === 'dislike' &&
    (candidate.dimension === 'region' || candidate.dimension === 'grape')
  ) {
    const owned = await validateOwnedConversationId(
      params.supabase,
      params.conversationId
    );
    if (!owned.ok) {
      return {
        candidate,
        eventId: null,
        canonicalApplied: false,
        reason:
          owned.reason === 'invalid_format'
            ? 'invalid_conversation'
            : 'forbidden_conversation',
        acknowledgmentKind: 'unsupported_change',
        memoryDualWrite: 'skipped',
        messageOverride:
          language === 'he'
            ? 'לא הצלחתי לקשר את ההודעה לשיחה שלך. רענן ונסה שוב.'
            : "I couldn't tie that message to your conversation. Refresh and try again.",
      };
    }
    const conversationId = owned.conversationId;
    const idempotencyKey = buildIdempotencyKey({
      userId: params.userId,
      message: params.message,
      candidate,
    });
    try {
      const { data: created, error: createErr } = await params.supabase.rpc(
        'create_taste_pending_confirmation',
        {
          p_payload: {
            idempotency_key: `${idempotencyKey}_dislike`,
            action: 'move_polarity',
            dimension: candidate.dimension,
            existing_value: candidate.valueId,
            proposed_value: candidate.valueId,
            proposed_polarity: 'dislike',
            locale: candidate.locale,
            raw_text: params.message.slice(0, 4000),
            conversation_id: conversationId,
            label_en: candidate.labelEn ?? null,
            label_he: candidate.labelHe ?? null,
          },
        }
      );
      if (createErr) throw createErr;
      const eventId = (created as { event_id?: string } | null)?.event_id;
      const { data: resolved, error: resolveErr } = await params.supabase.rpc(
        'resolve_taste_confirmation',
        {
          p_payload: {
            decision: 'confirm',
            event_id: eventId ?? null,
            conversation_id: conversationId,
          },
        }
      );
      if (resolveErr) throw resolveErr;
      const applied = !!(resolved as { canonical_applied?: boolean } | null)?.canonical_applied;
      if (applied) {
        await syncLegacyAfterPendingApply(
          params.userId,
          {
            action: 'move_polarity',
            dimension: candidate.dimension,
            existingValue: candidate.valueId,
            proposedValue: candidate.valueId,
            proposedPolarity: 'dislike',
            labelEn: candidate.labelEn,
            labelHe: candidate.labelHe,
          },
          params.supabase
        );
      }
      return {
        candidate,
        eventId: eventId ?? null,
        canonicalApplied: applied,
        reason: (resolved as { reason?: string } | null)?.reason ?? 'applied',
        acknowledgmentKind: applied ? 'remember_saved' : 'unsupported_change',
        memoryDualWrite: applied ? 'ok' : 'skipped',
      };
    } catch (e) {
      logSommelierWarn('taste_dislike_apply', {
        user: shortUser(params.userId),
        err: e instanceof Error ? e.message.slice(0, 120) : 'unknown',
      });
    }
  }

  // For retraction never apply via 2A RPC
  const applyCanonical = wantApply && candidate.class === 'stable_remember' && candidate.polarity === 'like';

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
        status:
          candidate.class === 'retraction' ? 'pending_unsupported' : candidate.status,
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
        apply_canonical: applyCanonical,
        label_en: candidate.labelEn ?? null,
        label_he: candidate.labelHe ?? null,
        preference_delta: {
          schema: 'pref_evidence_v1',
          class: candidate.class,
          polarity: candidate.polarity,
          dimension: candidate.dimension,
          value_id: candidate.valueId,
          confidence: candidate.confidence,
          requires_confirmation: false,
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

  if (canonicalApplied) {
    const mem = await writeLegacyMemory(params.userId, candidate, params.supabase);
    memoryDualWrite = mem;
    if (mem === 'failed') {
      logSommelierWarn('taste_memory_dual_write_failed', {
        user: shortUser(params.userId),
        event: eventId ?? 'none',
      });
    }
  } else if (!writesOn && candidate.class === 'stable_remember' && candidate.applyCanonical) {
    const mem = await writeLegacyMemory(params.userId, candidate, params.supabase);
    memoryDualWrite = mem === 'ok' ? 'legacy_only' : mem;
  }

  let acknowledgmentKind: CanonicalApplyResult['acknowledgmentKind'] = 'none';
  if (pendingDetect.kind === 'reaffirm' && (canonicalApplied || reason === 'already_applied')) {
    acknowledgmentKind = 'reaffirm';
  } else if (candidate.class === 'ambiguous') {
    // Explicit remember without a recognized allowlisted term — never claim success.
    acknowledgmentKind = 'unrecognized';
  } else if (candidate.class === 'stable_remember') {
    if (canonicalApplied) acknowledgmentKind = 'remember_saved';
    else if (reason === 'already_applied') acknowledgmentKind = 'reaffirm';
    else if (reason === 'contradiction') acknowledgmentKind = 'unsupported_change';
    else if (!writesOn) acknowledgmentKind = 'remember_disabled';
    else acknowledgmentKind = 'persist_failed';
  } else if (candidate.class === 'retraction' || candidate.class === 'contradiction') {
    acknowledgmentKind = 'unsupported_change';
  } else if (candidate.class === 'stable_general') {
    acknowledgmentKind = 'general_ack';
  } else if (candidate.class === 'session') {
    acknowledgmentKind = 'session_ack';
  } else if (candidate.class === 'bottle') {
    acknowledgmentKind = 'bottle_ack';
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

export async function processTasteConfirmation(params: {
  userId: string;
  message: string;
  supabase: SupabaseClient;
  language?: 'en' | 'he';
  conversationId?: string | null;
}): Promise<{ message: string; reason: string; applied: boolean }> {
  const language = params.language === 'he' ? 'he' : 'en';
  const decision = classifyConfirmationDecision(params.message);

  if (decision === null) {
    return {
      message:
        language === 'he'
          ? 'לא הבנתי. אפשר לענות ב״כן״ או ״לא״ לגבי שינוי ההעדפה.'
          : "I didn't catch that. Please answer yes or no about the preference change.",
      reason: 'not_confirmation',
      applied: false,
    };
  }

  if (decision === 'ambiguous') {
    return {
      message:
        language === 'he'
          ? 'אפשר לענות בבירור ״כן״ או ״לא״ לגבי שינוי ההעדפה?'
          : 'Please answer clearly with yes or no about the preference change.',
      reason: 'ambiguous',
      applied: false,
    };
  }

  if (!isCanonicalTasteWritesEnabled()) {
    return {
      message:
        language === 'he'
          ? 'עדכון העדפות שמורות מהצ׳אט לא פעיל כרגע. לא שיניתי דבר.'
          : 'Saved preference updates from chat are not enabled right now. Nothing was changed.',
      reason: 'writes_off',
      applied: false,
    };
  }

  const owned = await validateOwnedConversationId(
    params.supabase,
    params.conversationId
  );
  if (!owned.ok) {
    return {
      message:
        language === 'he'
          ? 'לא הצלחתי לקשר את האישור לשיחה שלך. רענן ונסה שוב.'
          : "I couldn't tie that confirmation to your conversation. Refresh and try again.",
      reason:
        owned.reason === 'invalid_format'
          ? 'invalid_conversation'
          : 'forbidden_conversation',
      applied: false,
    };
  }
  const conversationId = owned.conversationId;

  try {
    const { data, error } = await params.supabase.rpc('resolve_taste_confirmation', {
      p_payload: {
        decision: decision === 'confirm' ? 'confirm' : 'reject',
        conversation_id: conversationId,
      },
    });

    if (error) {
      logSommelierWarn('taste_resolve_rpc', {
        user: shortUser(params.userId),
        code: error.code,
        message: error.message?.slice(0, 120),
      });
      return {
        message:
          language === 'he'
            ? 'לא הצלחתי לעדכן את ההעדפה כרגע. נסה שוב.'
            : "I couldn't update that preference just now. Please try again.",
        reason: 'rpc_error',
        applied: false,
      };
    }

    const row = data as {
      reason?: string;
      canonical_applied?: boolean;
      pending_action?: Record<string, unknown>;
      event_id?: string;
    } | null;

    let reason = row?.reason || 'not_found';
    const pendingRaw = row?.pending_action;
    const action: PendingTasteAction | null = pendingRaw
      ? {
          action: pendingRaw.action as PendingTasteAction['action'],
          dimension: pendingRaw.dimension as PendingTasteAction['dimension'],
          existingValue: String(pendingRaw.existing_value || ''),
          proposedValue: pendingRaw.proposed_value
            ? String(pendingRaw.proposed_value)
            : undefined,
          proposedPolarity: pendingRaw.proposed_polarity as 'like' | 'dislike' | undefined,
          labelEn: pendingRaw.label_en ? String(pendingRaw.label_en) : undefined,
          labelHe: pendingRaw.label_he ? String(pendingRaw.label_he) : undefined,
        }
      : null;

    // Mixed client: non-null conversation resolve must not fall back to user-level NULL pending.
    if (reason === 'not_found' && conversationId) {
      const mixed = await handleNullPendingOnScopedResolve({
        supabase: params.supabase,
        userId: params.userId,
      });
      if (mixed) {
        reason = 'stale_null_pending';
        logSommelier('taste_preference_extract', {
          user: shortUser(params.userId),
          class: 'confirmation',
          applied: 'no',
          writes: 'on',
          rpc: 'ok',
          reason,
        });
        return {
          message: resolveAckMessage(reason, null, language),
          reason,
          applied: false,
        };
      }
    }

    if (reason === 'applied' && action) {
      const mem = await syncLegacyAfterPendingApply(params.userId, action, params.supabase);
      if (mem === 'failed') {
        logSommelierWarn('taste_memory_dual_write_failed', {
          user: shortUser(params.userId),
          event: row?.event_id ?? 'none',
        });
      }
    }

    logSommelier('taste_preference_extract', {
      user: shortUser(params.userId),
      class: 'confirmation',
      applied: row?.canonical_applied ? 'yes' : 'no',
      writes: 'on',
      rpc: 'ok',
      reason,
    });

    return {
      message: resolveAckMessage(reason, action, language),
      reason,
      applied: !!row?.canonical_applied,
    };
  } catch (e) {
    logSommelierWarn('taste_resolve_rpc_throw', {
      user: shortUser(params.userId),
      err: e instanceof Error ? e.message.slice(0, 120) : 'unknown',
    });
    return {
      message:
        language === 'he'
          ? 'לא הצלחתי לעדכן את ההעדפה כרגע. נסה שוב.'
          : "I couldn't update that preference just now. Please try again.",
      reason: 'rpc_throw',
      applied: false,
    };
  }
}

/**
 * When a scoped (non-null) resolve finds no pending, optionally supersede an orphaned
 * user-level NULL pending from an old client — never apply it into the new conversation.
 */
async function handleNullPendingOnScopedResolve(params: {
  supabase: SupabaseClient;
  userId: string;
}): Promise<boolean> {
  const { data, error } = await params.supabase
    .from('sommelier_feedback_events')
    .select('id')
    .eq('user_id', params.userId)
    .is('conversation_id', null)
    .eq('status', 'pending_confirmation')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.id) {
    return false;
  }

  const { error: updateError } = await params.supabase
    .from('sommelier_feedback_events')
    .update({
      status: 'superseded',
      resolved_at: new Date().toISOString(),
    })
    .eq('id', data.id)
    .eq('user_id', params.userId)
    .eq('status', 'pending_confirmation')
    .is('conversation_id', null);

  if (updateError) {
    logSommelierWarn('taste_null_pending_supersede', {
      user: shortUser(params.userId),
      message: updateError.message?.slice(0, 120),
    });
  }

  return true;
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

  if (kind === 'remember_saved' || kind === 'reaffirm') {
    if (language === 'he') {
      if (candidate.dimension === 'body') {
        return `הבנתי — אזכור שאתה מעדיף יינות עם גוף ${candidate.valueId === 'full' ? 'מלא' : candidate.valueId === 'light' ? 'קל' : 'בינוני'}.`;
      }
      if (candidate.dimension === 'region') {
        return `הבנתי — אזכור שאתה אוהב יינות מ${label}.`;
      }
      if (candidate.dimension === 'style') {
        return `הבנתי — אזכור שאתה אוהב ${label}.`;
      }
      return `הבנתי — אזכור שאתה אוהב ${label}.`;
    }
    if (candidate.dimension === 'body') {
      return `Got it — I'll remember that you prefer ${candidate.valueId}-bodied wines.`;
    }
    return `Got it — I'll remember that you prefer ${label}.`;
  }

  if (kind === 'unrecognized') {
    return language === 'he'
      ? 'הבנתי שאתה רוצה שאזכור העדפת יין, אבל לא הצלחתי לזהות איזו. נסה לציין זן, אזור או סגנון.'
      : "I understood that you want me to remember a wine preference, but I couldn't identify which one. Try naming the grape, region, or style.";
  }

  if (kind === 'persist_failed') {
    return language === 'he'
      ? 'זיהיתי את ההעדפה, אבל לא הצלחתי לשמור אותה כרגע. נסה שוב.'
      : "I recognized that preference, but couldn't save it just now. Please try again.";
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

export { classifyConfirmationDecision };
