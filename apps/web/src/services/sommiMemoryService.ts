/**
 * Sommi explicit-memory API mutations for Profile (zero credits).
 */

import { supabase } from '../lib/supabase';
import type { TasteProfile } from '../types/supabase';
import {
  extractPublicSommiMemory,
  type PublicSommiMemory,
} from './sommiMemoryView';
import { shouldRetainOperationIdAfterFailure } from './sommiMemoryOperation';

export type {
  PublicMemoryItem,
  PublicSommiMemory,
  PublicWineMemoryItem,
} from './sommiMemoryView';
export {
  countPublicSommiMemory,
  extractPublicSommiMemory,
  previewMemoryLabels,
} from './sommiMemoryView';
export {
  createProfileMemoryOperationId,
  isProfileMemoryOperationId,
  resolveOperationIdForAttempt,
  shouldRetainOperationIdAfterFailure,
} from './sommiMemoryOperation';

export type SommiMemoryMutation =
  | { type: 'remove_region'; polarity: 'like' | 'dislike'; id: string }
  | { type: 'remove_grape'; polarity: 'like' | 'dislike'; id: string }
  | { type: 'remove_style'; polarity: 'like' | 'dislike'; id: string }
  | { type: 'remove_wine_experience'; id: string }
  | {
      type: 'replace_body';
      value: 'light' | 'medium' | 'full';
      from: 'light' | 'medium' | 'full';
    }
  | { type: 'clear_body'; from: 'light' | 'medium' | 'full' };

export type SommiMemoryLoadSource = 'api' | 'taste_profile_fallback';

export type SommiMemoryLoadResult = {
  memory: PublicSommiMemory;
  source: SommiMemoryLoadSource;
  /** True when wine experiences could not be loaded (API GET failed). */
  winesUnavailable: boolean;
};

function emptyPublicMemory(): PublicSommiMemory {
  return {
    regions_liked: [],
    regions_disliked: [],
    grapes_liked: [],
    grapes_disliked: [],
    styles_liked: [],
    styles_disliked: [],
    body: null,
    wines_liked: [],
    wines_disliked: [],
  };
}

/**
 * Read taste_profile.explicit for the authenticated user only (RLS + eq id = session.user.id).
 * Does not include named-wine experiences (those live on feedback_events via the API).
 */
export async function fetchSommiMemoryFromTasteProfile(
  language: string
): Promise<PublicSommiMemory | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('taste_profile')
    .eq('id', session.user.id)
    .maybeSingle();

  if (error || !data) return null;
  const profile = (data as { taste_profile?: TasteProfile | null }).taste_profile;
  return extractPublicSommiMemory(profile, language, (_key, fallback) => fallback);
}

/**
 * Prefer API (includes wine experiences). If GET fails, fall back to the
 * authenticated user's taste_profile.explicit — never show a false “empty”
 * when grape/region/body prefs exist. Caller should surface winesUnavailable.
 */
export async function loadSommiMemory(
  language: string
): Promise<SommiMemoryLoadResult | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const apiUrl = import.meta.env.VITE_API_URL || '';
  const endpoint = apiUrl ? `${apiUrl}/api/profile/sommi-memory` : '/api/profile/sommi-memory';
  const locale = language.startsWith('he') ? 'he' : 'en';
  try {
    const response = await fetch(`${endpoint}?locale=${locale}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      credentials: 'include',
    });
    if (response.ok) {
      const data = await response.json();
      const memory = (data?.memory as PublicSommiMemory) ?? null;
      if (memory) {
        return {
          memory: {
            ...emptyPublicMemory(),
            ...memory,
            wines_liked: memory.wines_liked ?? [],
            wines_disliked: memory.wines_disliked ?? [],
          },
          source: 'api',
          winesUnavailable: false,
        };
      }
    }
  } catch {
    // fall through
  }

  const fallback = await fetchSommiMemoryFromTasteProfile(language);
  if (!fallback) return null;
  return {
    memory: fallback,
    source: 'taste_profile_fallback',
    winesUnavailable: true,
  };
}

/** @deprecated Prefer loadSommiMemory for source/winesUnavailable. */
export async function fetchSommiMemory(
  language: string
): Promise<PublicSommiMemory | null> {
  const loaded = await loadSommiMemory(language);
  return loaded?.memory ?? null;
}

export type SommiMemoryMutationResult =
  | { ok: true; memory: PublicSommiMemory; reason?: string }
  | {
      ok: false;
      message: string;
      memory?: PublicSommiMemory;
      status: number | 'network' | 'parse';
      retainOperationId: boolean;
    };

export async function mutateSommiMemory(
  mutation: SommiMemoryMutation,
  language: string,
  operationId: string
): Promise<SommiMemoryMutationResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return {
      ok: false,
      message: 'Not authenticated',
      status: 401,
      retainOperationId: false,
    };
  }

  const apiUrl = import.meta.env.VITE_API_URL || '';
  const endpoint = apiUrl ? `${apiUrl}/api/profile/sommi-memory` : '/api/profile/sommi-memory';

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      credentials: 'include',
      body: JSON.stringify({
        ...mutation,
        operationId,
        locale: language.startsWith('he') ? 'he' : 'en',
      }),
    });
  } catch {
    return {
      ok: false,
      message: 'Network error',
      status: 'network',
      retainOperationId: true,
    };
  }

  const data = await response.json().catch(() => null);
  if (data == null && !response.ok) {
    return {
      ok: false,
      message: 'Request failed',
      status: 'parse',
      retainOperationId: shouldRetainOperationIdAfterFailure('parse'),
    };
  }

  if (!response.ok) {
    const status = response.status;
    return {
      ok: false,
      message:
        data && typeof data.message === 'string' ? data.message : 'Request failed',
      memory: data?.memory ?? undefined,
      status,
      retainOperationId: shouldRetainOperationIdAfterFailure(status),
    };
  }

  return {
    ok: true,
    memory: data.memory as PublicSommiMemory,
    reason: typeof data.reason === 'string' ? data.reason : undefined,
  };
}
