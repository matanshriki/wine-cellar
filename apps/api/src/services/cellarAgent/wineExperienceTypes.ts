/**
 * Wine-level experience memory (liked/disliked named wines).
 * Stored on sommelier_feedback_events (scope=bottle) via preference_delta —
 * no new tables/columns. wine_id snapshot survives bottle delete (FK SET NULL).
 */

export const WINE_EXPERIENCE_SCHEMA = 'wine_experience_v1' as const;

export type WineExperienceMatchStatus = 'matched' | 'unresolved' | 'ambiguous';

export type WineExperiencePolarity = 'like' | 'dislike';

/** Snapshot persisted in preference_delta JSONB */
export type WineExperienceDelta = {
  schema: typeof WINE_EXPERIENCE_SCHEMA;
  wine_id: string | null;
  bottle_id: string | null;
  producer: string | null;
  wine_name: string | null;
  vintage: number | null;
  display_label: string;
  match_status: WineExperienceMatchStatus;
  /** Soft grape hint from phrase — never written to explicit.grapes_liked */
  soft_grape_hint?: string | null;
  reason_text?: string | null;
};

export type WineExperienceRecord = {
  eventId: string;
  polarity: WineExperiencePolarity;
  displayLabel: string;
  wineId: string | null;
  bottleId: string | null;
  producer: string | null;
  wineName: string | null;
  vintage: number | null;
  matchStatus: WineExperienceMatchStatus;
  softGrapeHint: string | null;
  rawText: string | null;
  createdAt: string | null;
};

export type PublicWineExperienceItem = {
  id: string; // feedback event id
  label: string;
  polarity: WineExperiencePolarity;
  vintage: number | null;
  wineId: string | null;
};

export function isWineExperienceDelta(v: unknown): v is WineExperienceDelta {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return o.schema === WINE_EXPERIENCE_SCHEMA && typeof o.display_label === 'string';
}

export function wineExperienceIdentityKey(delta: Pick<WineExperienceDelta, 'wine_id' | 'display_label'>): string {
  if (delta.wine_id) return `wine:${delta.wine_id}`;
  return `label:${delta.display_label.toLowerCase().replace(/\s+/g, ' ').trim()}`;
}
