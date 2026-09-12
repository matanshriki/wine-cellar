/**
 * Sommi explicit-memory API mutations for Profile (zero credits).
 */

import { supabase } from '../lib/supabase';
import type { PublicSommiMemory } from './sommiMemoryView';
import { shouldRetainOperationIdAfterFailure } from './sommiMemoryOperation';

export type { PublicMemoryItem, PublicSommiMemory } from './sommiMemoryView';
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
  | {
      type: 'replace_body';
      value: 'light' | 'medium' | 'full';
      from: 'light' | 'medium' | 'full';
    }
  | { type: 'clear_body'; from: 'light' | 'medium' | 'full' };

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
