/**
 * Pure taste-compatibility checks shared by bottle insights, recommendations,
 * Plan Evening and Tonight. No i18n or Supabase here, so it is unit-testable.
 */

import type { TasteProfile } from '../types/supabase';
import type { SweetnessAssessment } from '../utils/sweetness';
import { isKnownSweeterThanDry } from '../utils/sweetness';

type ExplicitItem = { id: string; label_en?: string; label_he?: string };

export interface ExplicitDislikeMatch {
  kind: 'region' | 'grape' | 'style';
  id: string;
  label: string;
}

export interface TasteMatchWine {
  wine_name?: string | null;
  producer?: string | null;
  region?: string | null;
  appellation?: string | null;
  regional_wine_style?: string | null;
  grapes?: unknown;
}

/** Below this the user leans clearly dry (0–1 scale; default profile is 0.2). */
export const DRY_PREFERENCE_THRESHOLD = 0.3;

function grapesText(grapes: unknown): string {
  if (Array.isArray(grapes)) return grapes.filter((g) => typeof g === 'string').join(' ');
  if (typeof grapes === 'string') return grapes;
  return '';
}

function norm(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// Mirrors termMatchesBlob in apps/api/src/services/cellarAgent/tasteScoring.ts.
function termMatches(id: string, blob: string): boolean {
  const needle = norm(id).replace(/_/g, ' ').trim();
  if (needle.length < 3) return false;
  return blob.includes(needle) || blob.includes(needle.replace(/\s+/g, ''));
}

/** First explicit region/grape/style dislike that matches this wine (dislike wins over like). */
export function findExplicitDislike(
  wine: TasteMatchWine | null | undefined,
  profile: TasteProfile | null | undefined,
  language: string = 'en',
): ExplicitDislikeMatch | null {
  const explicit = profile?.explicit;
  if (!wine || !explicit) return null;

  const hay = norm(
    [wine.wine_name, wine.producer, wine.region, wine.appellation, wine.regional_wine_style, grapesText(wine.grapes)]
      .filter(Boolean)
      .join(' '),
  );
  const region = norm([wine.region, wine.appellation].filter(Boolean).join(' '));
  const grapes = norm(grapesText(wine.grapes));
  const label = (i: ExplicitItem) => (language === 'he' ? i.label_he : i.label_en) || i.label_en || i.id;

  const groups: Array<[ExplicitDislikeMatch['kind'], ExplicitItem[] | undefined, string]> = [
    ['grape', explicit.grapes_disliked, grapes],
    ['region', explicit.regions_disliked, region],
    ['style', explicit.styles_disliked, hay],
  ];
  for (const [kind, list, primary] of groups) {
    for (const item of list ?? []) {
      if (termMatches(item.id, primary) || termMatches(item.id, hay)) {
        return { kind, id: item.id, label: label(item) };
      }
    }
  }
  return null;
}

/**
 * The user prefers dry wines and this wine is established (label or profile) as
 * off-dry or sweeter. Unknown sweetness never triggers this or a "dry" claim.
 */
export function isSweetnessMismatch(
  userSweetness: number | null | undefined,
  wineSweetness: SweetnessAssessment | null | undefined,
): boolean {
  if (typeof userSweetness !== 'number') return false;
  return userSweetness < DRY_PREFERENCE_THRESHOLD && isKnownSweeterThanDry(wineSweetness);
}
