/**
 * Profile “What Sommi remembers” — public DTO + atomic Profile memory mutations.
 * Uses apply_taste_profile_memory_action (never create/resolve pending). Zero credits.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  isCanonicalTasteWritesEnabled,
  syncLegacyAfterTasteConfirmation,
} from './canonicalTasteWrite.js';
import { lookupWineTermLabels } from './preferenceExtractRules.js';
import {
  isProfileMemoryOperationId,
  profileMemoryIdempotencyKey,
} from './profileMemoryOperation.js';
import { loadUserTasteProfile } from './tasteProfileRepo.js';
import { bodyLabel, type PendingTasteAction } from './tasteConfirmation.js';
import type {
  ExplicitPreferenceValue,
  ExplicitTastePreferences,
  StructuredTasteProfile,
} from './tasteProfileTypes.js';
import { logSommelier, logSommelierWarn, shortUser } from './sommelierLog.js';

export type PublicMemoryItem = {
  id: string;
  label: string;
};

export type PublicSommiMemory = {
  regions_liked: PublicMemoryItem[];
  regions_disliked: PublicMemoryItem[];
  grapes_liked: PublicMemoryItem[];
  grapes_disliked: PublicMemoryItem[];
  styles_liked: PublicMemoryItem[];
  styles_disliked: PublicMemoryItem[];
  body: { value: 'light' | 'medium' | 'full'; label: string } | null;
};

export type ProfileMemoryAction =
  | {
      type: 'remove_region';
      polarity: 'like' | 'dislike';
      id: string;
    }
  | {
      type: 'remove_grape';
      polarity: 'like' | 'dislike';
      id: string;
    }
  | {
      type: 'remove_style';
      polarity: 'like' | 'dislike';
      id: string;
    }
  | {
      type: 'replace_body';
      value: 'light' | 'medium' | 'full';
      /** Body value at confirm time — stable across retries. */
      from: 'light' | 'medium' | 'full';
    }
  | {
      type: 'clear_body';
      /** Body value at confirm time — stable across retries. */
      from: 'light' | 'medium' | 'full';
    };

export type ProfileMemoryApplyResult =
  | { ok: true; memory: PublicSommiMemory; reason: string }
  | {
      ok: false;
      reason:
        | 'writes_off'
        | 'invalid_action'
        | 'invalid_operation_id'
        | 'not_found'
        | 'conflict'
        | 'idempotency_conflict'
        | 'rpc_error'
        | 'rpc_throw'
        | 'load_error';
      message: string;
      memory?: PublicSommiMemory;
    };

function formatIdFallback(id: string): string {
  return id
    .split(/[_-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

export function resolvePublicLabel(
  dimension: 'region' | 'grape' | 'style',
  item: Pick<ExplicitPreferenceValue, 'id' | 'label_en' | 'label_he'>,
  language: 'en' | 'he'
): string {
  if (language === 'he') {
    if (item.label_he && item.label_he.trim()) return item.label_he.trim();
    if (item.label_en && item.label_en.trim()) return item.label_en.trim();
  } else {
    if (item.label_en && item.label_en.trim()) return item.label_en.trim();
    if (item.label_he && item.label_he.trim()) return item.label_he.trim();
  }
  const catalog = lookupWineTermLabels(dimension, item.id);
  if (catalog) {
    if (language === 'he' && catalog.he) return catalog.he;
    return catalog.en;
  }
  return formatIdFallback(item.id);
}

function mapList(
  dimension: 'region' | 'grape' | 'style',
  list: ExplicitPreferenceValue[] | undefined,
  language: 'en' | 'he'
): PublicMemoryItem[] {
  if (!list?.length) return [];
  return list.map((item) => ({
    id: item.id,
    label: resolvePublicLabel(dimension, item, language),
  }));
}

export function toPublicSommiMemory(
  explicit: ExplicitTastePreferences | null | undefined,
  language: 'en' | 'he' = 'en'
): PublicSommiMemory {
  const bodyVal = explicit?.body?.value;
  return {
    regions_liked: mapList('region', explicit?.regions_liked, language),
    regions_disliked: mapList('region', explicit?.regions_disliked, language),
    grapes_liked: mapList('grape', explicit?.grapes_liked, language),
    grapes_disliked: mapList('grape', explicit?.grapes_disliked, language),
    styles_liked: mapList('style', explicit?.styles_liked, language),
    styles_disliked: mapList('style', explicit?.styles_disliked, language),
    body:
      bodyVal === 'light' || bodyVal === 'medium' || bodyVal === 'full'
        ? { value: bodyVal, label: bodyLabel(bodyVal, language) }
        : null,
  };
}

export function countPublicSommiMemory(memory: PublicSommiMemory): number {
  return (
    memory.regions_liked.length +
    memory.regions_disliked.length +
    memory.grapes_liked.length +
    memory.grapes_disliked.length +
    memory.styles_liked.length +
    memory.styles_disliked.length +
    (memory.body ? 1 : 0)
  );
}

function listKey(
  dimension: 'region' | 'grape' | 'style',
  polarity: 'like' | 'dislike'
): keyof ExplicitTastePreferences {
  if (dimension === 'region') {
    return polarity === 'like' ? 'regions_liked' : 'regions_disliked';
  }
  if (dimension === 'grape') {
    return polarity === 'like' ? 'grapes_liked' : 'grapes_disliked';
  }
  return polarity === 'like' ? 'styles_liked' : 'styles_disliked';
}

function findTerm(
  explicit: ExplicitTastePreferences | undefined,
  dimension: 'region' | 'grape' | 'style',
  polarity: 'like' | 'dislike',
  id: string
): ExplicitPreferenceValue | null {
  if (!explicit) return null;
  const key = listKey(dimension, polarity);
  const list = explicit[key] as ExplicitPreferenceValue[];
  const needle = id.toLowerCase().trim();
  return list.find((x) => x.id === needle) ?? null;
}

export function parseProfileMemoryAction(body: unknown): ProfileMemoryAction | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const o = body as Record<string, unknown>;
  const type = typeof o.type === 'string' ? o.type : typeof o.action === 'string' ? o.action : '';

  if (type === 'remove_region' || type === 'remove_grape' || type === 'remove_style') {
    const polarity = o.polarity === 'dislike' ? 'dislike' : o.polarity === 'like' ? 'like' : null;
    const id = typeof o.id === 'string' ? o.id.toLowerCase().trim() : '';
    if (!polarity || !id || id.length > 64) return null;
    if (type === 'remove_region') return { type: 'remove_region', polarity, id };
    if (type === 'remove_grape') return { type: 'remove_grape', polarity, id };
    return { type: 'remove_style', polarity, id };
  }

  if (type === 'replace_body') {
    const value =
      typeof o.value === 'string'
        ? o.value.toLowerCase().trim()
        : typeof o.body === 'string'
          ? o.body.toLowerCase().trim()
          : '';
    const fromRaw =
      typeof o.from === 'string'
        ? o.from.toLowerCase().trim()
        : typeof o.existingValue === 'string'
          ? o.existingValue.toLowerCase().trim()
          : typeof o.existing_value === 'string'
            ? o.existing_value.toLowerCase().trim()
            : '';
    if (value !== 'light' && value !== 'medium' && value !== 'full') return null;
    if (fromRaw !== 'light' && fromRaw !== 'medium' && fromRaw !== 'full') return null;
    if (fromRaw === value) return null;
    return { type: 'replace_body', value, from: fromRaw };
  }

  if (type === 'clear_body') {
    const fromRaw =
      typeof o.from === 'string'
        ? o.from.toLowerCase().trim()
        : typeof o.existingValue === 'string'
          ? o.existingValue.toLowerCase().trim()
          : typeof o.existing_value === 'string'
            ? o.existing_value.toLowerCase().trim()
            : '';
    if (fromRaw !== 'light' && fromRaw !== 'medium' && fromRaw !== 'full') return null;
    return { type: 'clear_body', from: fromRaw };
  }

  return null;
}

async function applyAtomicProfileMemory(params: {
  userId: string;
  supabase: SupabaseClient;
  language: 'en' | 'he';
  pending: PendingTasteAction;
  polarity?: 'like' | 'dislike';
  rawText: string;
  operationId: string;
}): Promise<{ ok: true; reason: string } | { ok: false; reason: string; message: string }> {
  const idempotencyKey = profileMemoryIdempotencyKey(params.operationId);

  try {
    const { data, error } = await params.supabase.rpc('apply_taste_profile_memory_action', {
      p_payload: {
        operation_id: params.operationId,
        idempotency_key: idempotencyKey,
        action: params.pending.action,
        dimension: params.pending.dimension,
        existing_value: params.pending.existingValue,
        proposed_value: params.pending.proposedValue ?? null,
        polarity: params.polarity ?? null,
        locale: params.language,
        raw_text: params.rawText.slice(0, 4000),
        label_en: params.pending.labelEn ?? null,
        label_he: params.pending.labelHe ?? null,
      },
    });

    if (error) {
      logSommelierWarn('profile_memory_rpc', {
        user: shortUser(params.userId),
        code: error.code,
        message: error.message?.slice(0, 120),
      });
      return {
        ok: false,
        reason: 'rpc_error',
        message: error.message || 'rpc_failed',
      };
    }

    const row = data as {
      reason?: string;
      canonical_applied?: boolean;
      event_id?: string;
      status?: string;
    } | null;
    const reason = row?.reason || 'unknown';

    if (reason === 'applied' || reason === 'already_applied') {
      const mem = await syncLegacyAfterTasteConfirmation(
        params.userId,
        params.pending,
        params.supabase
      );
      if (mem === 'failed') {
        logSommelierWarn('taste_memory_dual_write_failed', {
          user: shortUser(params.userId),
          event: row?.event_id ?? 'none',
          source: 'profile_ui',
        });
      }
      logSommelier('action', {
        user: shortUser(params.userId),
        action: 'profile_sommi_memory',
        pendingAction: params.pending.action,
        dimension: params.pending.dimension,
        reason,
      });
      return { ok: true, reason };
    }

    if (reason === 'unchanged') {
      return { ok: true, reason: 'unchanged' };
    }
    if (reason === 'conflict') {
      return { ok: false, reason: 'conflict', message: reason };
    }
    if (reason === 'idempotency_conflict') {
      return { ok: false, reason: 'idempotency_conflict', message: reason };
    }
    if (reason === 'not_found') {
      return { ok: false, reason: 'not_found', message: reason };
    }

    return { ok: false, reason: 'rpc_error', message: reason };
  } catch (e) {
    logSommelierWarn('profile_memory_throw', {
      user: shortUser(params.userId),
      err: e instanceof Error ? e.message.slice(0, 120) : 'unknown',
    });
    return {
      ok: false,
      reason: 'rpc_throw',
      message: e instanceof Error ? e.message : 'throw',
    };
  }
}

export async function applyProfileSommiMemoryAction(params: {
  userId: string;
  supabase: SupabaseClient;
  action: ProfileMemoryAction;
  operationId: string;
  language?: 'en' | 'he';
}): Promise<ProfileMemoryApplyResult> {
  const language = params.language === 'he' ? 'he' : 'en';

  if (!isProfileMemoryOperationId(params.operationId)) {
    return {
      ok: false,
      reason: 'invalid_operation_id',
      message:
        language === 'he'
          ? 'מזהה פעולה לא חוקי.'
          : 'Invalid operation id.',
    };
  }
  const operationId = params.operationId.trim().toLowerCase();

  if (!isCanonicalTasteWritesEnabled()) {
    return {
      ok: false,
      reason: 'writes_off',
      message:
        language === 'he'
          ? 'עדכון העדפות שמורות לא פעיל כרגע.'
          : 'Saved preference updates are not enabled right now.',
    };
  }

  const loaded = await loadUserTasteProfile(params.userId, params.supabase);
  if (!loaded.loaded) {
    return {
      ok: false,
      reason: 'load_error',
      message:
        language === 'he' ? 'לא הצלחתי לטעון את הפרופיל.' : 'Could not load your profile.',
    };
  }

  const explicit = loaded.profile?.explicit;
  let pending: PendingTasteAction | null = null;
  let rawText = 'profile_ui';

  if (
    params.action.type === 'remove_region' ||
    params.action.type === 'remove_grape' ||
    params.action.type === 'remove_style'
  ) {
    const dimension =
      params.action.type === 'remove_region'
        ? 'region'
        : params.action.type === 'remove_grape'
          ? 'grape'
          : 'style';
    // Always call RPC (even if absent) so same-operation retries return already_applied.
    const item = findTerm(explicit, dimension, params.action.polarity, params.action.id);
    pending = {
      action: 'remove',
      dimension,
      existingValue: params.action.id,
      labelEn: item?.label_en,
      labelHe: item?.label_he,
    };
    rawText = `profile_ui remove ${dimension} ${params.action.id}`;
  } else if (params.action.type === 'replace_body') {
    pending = {
      action: 'replace',
      dimension: 'body',
      existingValue: params.action.from,
      proposedValue: params.action.value,
    };
    rawText = `profile_ui replace body ${params.action.from}→${params.action.value}`;
  } else if (params.action.type === 'clear_body') {
    pending = {
      action: 'remove',
      dimension: 'body',
      existingValue: params.action.from,
    };
    rawText = `profile_ui clear body ${params.action.from}`;
  }

  if (!pending) {
    return {
      ok: false,
      reason: 'invalid_action',
      message: language === 'he' ? 'פעולה לא חוקית.' : 'Invalid action.',
    };
  }

  const polarity =
    params.action.type === 'remove_region' ||
    params.action.type === 'remove_grape' ||
    params.action.type === 'remove_style'
      ? params.action.polarity
      : undefined;

  const applied = await applyAtomicProfileMemory({
    userId: params.userId,
    supabase: params.supabase,
    language,
    pending,
    polarity,
    rawText,
    operationId,
  });

  const reloaded = await loadUserTasteProfile(params.userId, params.supabase);
  const memory = toPublicSommiMemory(reloaded.profile?.explicit, language);

  if (!applied.ok) {
    const failReason:
      | 'conflict'
      | 'idempotency_conflict'
      | 'not_found'
      | 'rpc_error'
      | 'rpc_throw' =
      applied.reason === 'conflict' ||
      applied.reason === 'idempotency_conflict' ||
      applied.reason === 'not_found' ||
      applied.reason === 'rpc_error' ||
      applied.reason === 'rpc_throw'
        ? applied.reason
        : 'rpc_error';
    return {
      ok: false,
      reason: failReason,
      message:
        language === 'he'
          ? 'לא הצלחתי לעדכן את ההעדפה. נסה שוב.'
          : 'Could not update that preference. Please try again.',
      memory,
    };
  }

  if (applied.reason === 'unchanged') {
    return { ok: true, memory, reason: 'unchanged' };
  }

  // Verify canonical success before claiming ok (skip for already_applied recovery)
  if (applied.reason === 'applied') {
    if (
      params.action.type === 'remove_region' ||
      params.action.type === 'remove_grape' ||
      params.action.type === 'remove_style'
    ) {
      const stillThere = findTerm(
        reloaded.profile?.explicit,
        params.action.type === 'remove_region'
          ? 'region'
          : params.action.type === 'remove_grape'
            ? 'grape'
            : 'style',
        params.action.polarity,
        params.action.id
      );
      if (stillThere) {
        return {
          ok: false,
          reason: 'rpc_error',
          message:
            language === 'he'
              ? 'העדכון לא הושלם. נסה שוב.'
              : 'The update did not complete. Please try again.',
          memory,
        };
      }
    }
    if (params.action.type === 'clear_body' && reloaded.profile?.explicit?.body?.value) {
      return {
        ok: false,
        reason: 'rpc_error',
        message:
          language === 'he'
            ? 'העדכון לא הושלם. נסה שוב.'
            : 'The update did not complete. Please try again.',
        memory,
      };
    }
    if (
      params.action.type === 'replace_body' &&
      reloaded.profile?.explicit?.body?.value !== params.action.value
    ) {
      return {
        ok: false,
        reason: 'rpc_error',
        message:
          language === 'he'
            ? 'העדכון לא הושלם. נסה שוב.'
            : 'The update did not complete. Please try again.',
        memory,
      };
    }
  }

  return { ok: true, memory, reason: applied.reason };
}

/** Build public memory from a loaded structured profile (for GET helpers / tests). */
export function publicMemoryFromProfile(
  profile: StructuredTasteProfile | null | undefined,
  language: 'en' | 'he' = 'en'
): PublicSommiMemory {
  return toPublicSommiMemory(profile?.explicit, language);
}
