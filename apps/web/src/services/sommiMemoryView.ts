/**
 * Pure Sommi explicit-memory view helpers (no Supabase — safe for unit tests).
 */

import {
  bodyPreferenceLabel,
  resolveMemoryItemLabel,
} from './sommiMemoryLabels';
import type { TasteProfile } from '../types/supabase';

export type PublicMemoryItem = { id: string; label: string };

export type PublicSommiMemory = {
  regions_liked: PublicMemoryItem[];
  regions_disliked: PublicMemoryItem[];
  grapes_liked: PublicMemoryItem[];
  grapes_disliked: PublicMemoryItem[];
  body: { value: 'light' | 'medium' | 'full'; label: string } | null;
};

export function extractPublicSommiMemory(
  profile: TasteProfile | null | undefined,
  language: string,
  t: (key: string, fallback: string) => string
): PublicSommiMemory {
  const explicit = profile?.explicit;
  const lang = language.startsWith('he') ? 'he' : 'en';

  const map = (
    dimension: 'region' | 'grape',
    list?: Array<{ id: string; label_en?: string; label_he?: string }>
  ): PublicMemoryItem[] => {
    if (!list?.length) return [];
    return list.map((item) => ({
      id: item.id,
      label: resolveMemoryItemLabel(dimension, item, lang),
    }));
  };

  const bodyVal = explicit?.body?.value;
  return {
    regions_liked: map('region', explicit?.regions_liked),
    regions_disliked: map('region', explicit?.regions_disliked),
    grapes_liked: map('grape', explicit?.grapes_liked),
    grapes_disliked: map('grape', explicit?.grapes_disliked),
    body:
      bodyVal === 'light' || bodyVal === 'medium' || bodyVal === 'full'
        ? { value: bodyVal, label: bodyPreferenceLabel(bodyVal, lang, t) }
        : null,
  };
}

export function countPublicSommiMemory(memory: PublicSommiMemory): number {
  return (
    memory.regions_liked.length +
    memory.regions_disliked.length +
    memory.grapes_liked.length +
    memory.grapes_disliked.length +
    (memory.body ? 1 : 0)
  );
}

export function previewMemoryLabels(memory: PublicSommiMemory, limit = 4): string[] {
  const labels: string[] = [];
  if (memory.body) labels.push(memory.body.label);
  for (const item of [
    ...memory.regions_liked,
    ...memory.regions_disliked,
    ...memory.grapes_liked,
    ...memory.grapes_disliked,
  ]) {
    if (labels.length >= limit) break;
    labels.push(item.label);
  }
  return labels.slice(0, limit);
}
