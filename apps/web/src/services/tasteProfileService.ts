/**
 * Taste Profile Service
 * 
 * Computes and manages per-user taste profiles based on rating history.
 * Used to personalize recommendations across the app.
 */

import { supabase } from '../lib/supabase';
import type { TasteProfile, TasteProfileVector, TasteProfilePreferences } from '../types/supabase';
import * as wineProfileService from './wineProfileService';
import type { WineProfile } from './wineProfileService';

const PROFILE_VERSION = 1;
const MAX_HISTORY_ENTRIES = 100;

interface RatedWineEntry {
  id: string;
  user_rating: number;
  opened_at: string;
  wine: {
    id: string;
    producer: string;
    wine_name: string;
    vintage: number | null;
    color: string;
    region: string | null;
    country: string | null;
    grapes: string[] | null;
    wine_profile: WineProfile | null;
  };
}

/**
 * Compute taste profile for a user based on their rating history
 */
export async function computeTasteProfile(userId: string): Promise<TasteProfile | null> {
  console.log('[TasteProfileService] Computing taste profile for user:', userId);
  
  const ratedEntries = await fetchRatedHistory(userId);
  
  if (ratedEntries.length === 0) {
    console.log('[TasteProfileService] No rated entries found');
    return null;
  }
  
  console.log('[TasteProfileService] Found', ratedEntries.length, 'rated entries');
  
  const vector = computeVector(ratedEntries);
  const preferences = computePreferences(ratedEntries);
  const confidence = getConfidence(ratedEntries.length);
  
  const lastRatedAt = ratedEntries.length > 0 
    ? ratedEntries[0].opened_at 
    : null;
  
  const profile: TasteProfile = {
    version: PROFILE_VERSION,
    vector,
    preferences,
    confidence,
    data_points: {
      rated_count: ratedEntries.length,
      last_rated_at: lastRatedAt,
    },
  };
  
  console.log('[TasteProfileService] Computed profile:', {
    confidence,
    rated_count: ratedEntries.length,
    vector: Object.entries(vector).map(([k, v]) => `${k}: ${v.toFixed(2)}`).join(', '),
  });
  
  return profile;
}

/**
 * Fetch rated history entries with wine details
 */
async function fetchRatedHistory(userId: string): Promise<RatedWineEntry[]> {
  const { data, error } = await supabase
    .from('consumption_history')
    .select(`
      id,
      user_rating,
      opened_at,
      wine:wines(
        id,
        producer,
        wine_name,
        vintage,
        color,
        region,
        country,
        grapes,
        wine_profile
      )
    `)
    .eq('user_id', userId)
    .not('user_rating', 'is', null)
    .order('opened_at', { ascending: false })
    .limit(MAX_HISTORY_ENTRIES);
  
  if (error) {
    console.error('[TasteProfileService] Error fetching history:', error);
    return [];
  }
  
  return (data || []).filter(entry => (entry as any).wine !== null) as unknown as RatedWineEntry[];
}

/**
 * Compute taste vector from rated entries
 */
function computeVector(entries: RatedWineEntry[]): TasteProfileVector {
  let bodySum = 0, tanninSum = 0, aciditySum = 0, oakSum = 0, sweetnessSum = 0, powerSum = 0;
  let totalWeight = 0;
  
  const now = Date.now();
  
  for (const entry of entries) {
    const wineProfile = entry.wine.wine_profile || wineProfileService.getHeuristicProfile(entry.wine);
    const ratingWeight = mapRatingToWeight(entry.user_rating);
    
    const entryAge = (now - new Date(entry.opened_at).getTime()) / (1000 * 60 * 60 * 24);
    const recencyWeight = Math.max(0.5, 1 - (entryAge / 365));
    
    const weight = ratingWeight * recencyWeight;
    
    if (weight > 0) {
      bodySum += normalizeBody(wineProfile.body) * weight;
      tanninSum += normalizeTannin(wineProfile.tannin) * weight;
      aciditySum += normalizeAcidity(wineProfile.acidity) * weight;
      oakSum += normalizeOak(wineProfile.oak) * weight;
      sweetnessSum += normalizeSweetness(wineProfile.sweetness) * weight;
      powerSum += normalizePower(wineProfile.power) * weight;
      totalWeight += weight;
    }
  }
  
  if (totalWeight === 0) {
    return { body: 0.5, tannin: 0.5, acidity: 0.5, oak: 0.5, sweetness: 0.2, power: 0.5 };
  }
  
  return {
    body: clamp(bodySum / totalWeight, 0, 1),
    tannin: clamp(tanninSum / totalWeight, 0, 1),
    acidity: clamp(aciditySum / totalWeight, 0, 1),
    oak: clamp(oakSum / totalWeight, 0, 1),
    sweetness: clamp(sweetnessSum / totalWeight, 0, 1),
    power: clamp(powerSum / totalWeight, 0, 1),
  };
}

/**
 * Compute preferences from rated entries
 */
function computePreferences(entries: RatedWineEntry[]): TasteProfilePreferences {
  const colorCounts: Record<string, { positive: number; negative: number }> = {
    red: { positive: 0, negative: 0 },
    white: { positive: 0, negative: 0 },
    sparkling: { positive: 0, negative: 0 },
    rose: { positive: 0, negative: 0 },
  };
  
  const regionWeights: Record<string, number> = {};
  const grapeWeights: Record<string, number> = {};
  const styleTagWeights: Record<string, number> = {};
  
  for (const entry of entries) {
    const weight = mapRatingToWeight(entry.user_rating);
    const color = entry.wine.color?.toLowerCase() || 'red';
    
    if (colorCounts[color]) {
      if (weight > 0) {
        colorCounts[color].positive += weight;
      } else {
        colorCounts[color].negative += Math.abs(weight);
      }
    }
    
    if (entry.wine.region) {
      const region = entry.wine.region;
      regionWeights[region] = (regionWeights[region] || 0) + weight;
    }
    
    if (entry.wine.grapes && Array.isArray(entry.wine.grapes)) {
      for (const grape of entry.wine.grapes) {
        if (typeof grape === 'string') {
          grapeWeights[grape] = (grapeWeights[grape] || 0) + weight;
        }
      }
    }
    
    const wineProfile = entry.wine.wine_profile || wineProfileService.getHeuristicProfile(entry.wine);
    if (wineProfile.style_tags) {
      for (const tag of wineProfile.style_tags) {
        styleTagWeights[tag] = (styleTagWeights[tag] || 0) + weight;
      }
    }
  }
  
  const normalizeColorBias = (counts: { positive: number; negative: number }): number => {
    const total = counts.positive + counts.negative;
    if (total === 0) return 0;
    return clamp((counts.positive - counts.negative) / total, -1, 1);
  };
  
  return {
    reds_bias: normalizeColorBias(colorCounts.red),
    whites_bias: normalizeColorBias(colorCounts.white),
    sparkling_bias: normalizeColorBias(colorCounts.sparkling),
    style_tags: normalizeWeights(styleTagWeights),
    regions: normalizeWeights(regionWeights),
    grapes: normalizeWeights(grapeWeights),
  };
}

/**
 * Map rating (1-5) to weight (-1 to 1)
 */
function mapRatingToWeight(rating: number): number {
  switch (rating) {
    case 5: return 1.0;
    case 4: return 0.5;
    case 3: return 0.0;
    case 2: return -0.5;
    case 1: return -1.0;
    default: return 0;
  }
}

function normalizeBody(value: number): number {
  return clamp((value - 1) / 4, 0, 1);
}

function normalizeTannin(value: number): number {
  return clamp((value - 1) / 4, 0, 1);
}

function normalizeAcidity(value: number): number {
  return clamp((value - 1) / 4, 0, 1);
}

function normalizeOak(value: number): number {
  return clamp((value - 1) / 4, 0, 1);
}

function normalizeSweetness(value: number): number {
  return clamp(value / 5, 0, 1);
}

function normalizePower(value: number): number {
  return clamp((value - 1) / 9, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeWeights(weights: Record<string, number>): Record<string, number> {
  const maxAbs = Math.max(...Object.values(weights).map(Math.abs), 1);
  const normalized: Record<string, number> = {};
  
  for (const [key, value] of Object.entries(weights)) {
    normalized[key] = clamp(value / maxAbs, -1, 1);
  }
  
  return normalized;
}

function getConfidence(ratedCount: number): 'low' | 'med' | 'high' {
  if (ratedCount < 5) return 'low';
  if (ratedCount <= 15) return 'med';
  return 'high';
}

/**
 * Save taste profile to user's profile
 */
export async function saveTasteProfile(userId: string, profile: TasteProfile): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    // @ts-expect-error - taste_profile columns added via migration but not yet in generated types
    .update({
      taste_profile: profile,
      taste_profile_updated_at: new Date().toISOString(),
      taste_profile_version: PROFILE_VERSION,
    })
    .eq('id', userId);
  
  if (error) {
    console.error('[TasteProfileService] Error saving profile:', error);
    throw new Error('Failed to save taste profile');
  }
  
  console.log('[TasteProfileService] Profile saved successfully');
}

/**
 * Get taste profile for current user
 */
export async function getMyTasteProfile(): Promise<TasteProfile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return null;
  }
  
  const { data, error } = await supabase
    .from('profiles')
    .select('taste_profile')
    .eq('id', user.id)
    .single();
  
  if (error || !data) {
    return null;
  }
  
  return (data as any).taste_profile as TasteProfile | null;
}

/**
 * Recompute and save taste profile for current user
 */
export async function recomputeMyTasteProfile(): Promise<TasteProfile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('Not authenticated');
  }
  
  const profile = await computeTasteProfile(user.id);
  
  if (profile) {
    await saveTasteProfile(user.id, profile);
  }
  
  return profile;
}

/**
 * Apply manual calibration overrides to taste profile
 */
export async function applyCalibration(overrides: Partial<TasteProfileVector>): Promise<TasteProfile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('Not authenticated');
  }
  
  const currentProfile = await getMyTasteProfile();
  
  if (!currentProfile) {
    const baseProfile: TasteProfile = {
      version: PROFILE_VERSION,
      vector: { body: 0.5, tannin: 0.5, acidity: 0.5, oak: 0.5, sweetness: 0.2, power: 0.5 },
      preferences: {
        reds_bias: 0,
        whites_bias: 0,
        sparkling_bias: 0,
        style_tags: {},
        regions: {},
        grapes: {},
      },
      overrides: { vector: overrides },
      confidence: 'low',
      data_points: { rated_count: 0, last_rated_at: null },
    };
    
    await saveTasteProfile(user.id, baseProfile);
    return baseProfile;
  }
  
  const updatedProfile: TasteProfile = {
    ...currentProfile,
    overrides: {
      ...currentProfile.overrides,
      vector: {
        ...(currentProfile.overrides?.vector || {}),
        ...overrides,
      },
    },
  };
  
  await saveTasteProfile(user.id, updatedProfile);
  return updatedProfile;
}

/**
 * Get effective vector (learned + calibration overrides)
 */
export function getEffectiveVector(profile: TasteProfile): TasteProfileVector {
  const learnedWeight = profile.confidence === 'low' ? 0.7 : profile.confidence === 'med' ? 0.85 : 0.9;
  const overrideWeight = 1 - learnedWeight;
  
  const learned = profile.vector;
  const overrides = profile.overrides?.vector || {};
  
  return {
    body: learned.body * learnedWeight + (overrides.body ?? learned.body) * overrideWeight,
    tannin: learned.tannin * learnedWeight + (overrides.tannin ?? learned.tannin) * overrideWeight,
    acidity: learned.acidity * learnedWeight + (overrides.acidity ?? learned.acidity) * overrideWeight,
    oak: learned.oak * learnedWeight + (overrides.oak ?? learned.oak) * overrideWeight,
    sweetness: learned.sweetness * learnedWeight + (overrides.sweetness ?? learned.sweetness) * overrideWeight,
    power: learned.power * learnedWeight + (overrides.power ?? learned.power) * overrideWeight,
  };
}

/**
 * Calculate affinity score between wine and user taste profile
 * Returns a score between 0 and 1 (higher = better match)
 */
export function calculateAffinity(
  wineProfile: WineProfile,
  userProfile: TasteProfile
): number {
  const userVector = getEffectiveVector(userProfile);
  
  const wineVector: TasteProfileVector = {
    body: normalizeBody(wineProfile.body),
    tannin: normalizeTannin(wineProfile.tannin),
    acidity: normalizeAcidity(wineProfile.acidity),
    oak: normalizeOak(wineProfile.oak),
    sweetness: normalizeSweetness(wineProfile.sweetness),
    power: normalizePower(wineProfile.power),
  };
  
  let totalDiff = 0;
  let dimensions = 0;
  
  for (const key of Object.keys(wineVector) as (keyof TasteProfileVector)[]) {
    totalDiff += Math.abs(wineVector[key] - userVector[key]);
    dimensions++;
  }
  
  const avgDiff = totalDiff / dimensions;
  const affinity = 1 - avgDiff;
  
  return clamp(affinity, 0, 1);
}

/**
 * Get affinity weight based on confidence level
 */
export function getAffinityWeight(confidence: 'low' | 'med' | 'high'): number {
  switch (confidence) {
    case 'low': return 0.1;
    case 'med': return 0.25;
    case 'high': return 0.4;
    default: return 0;
  }
}

/**
 * Generate a "Because you like..." explanation
 */
export function generateAffinityReason(
  wineProfile: WineProfile,
  userProfile: TasteProfile
): string | null {
  const userVector = getEffectiveVector(userProfile);
  
  const bodyMatch = Math.abs(normalizeBody(wineProfile.body) - userVector.body) < 0.2;
  const tanninMatch = Math.abs(normalizeTannin(wineProfile.tannin) - userVector.tannin) < 0.2;
  const acidityMatch = Math.abs(normalizeAcidity(wineProfile.acidity) - userVector.acidity) < 0.2;
  const oakMatch = Math.abs(normalizeOak(wineProfile.oak) - userVector.oak) < 0.2;
  
  const highBody = userVector.body > 0.6 && wineProfile.body >= 4;
  const highTannin = userVector.tannin > 0.6 && wineProfile.tannin >= 4;
  const highAcidity = userVector.acidity > 0.6 && wineProfile.acidity >= 4;
  const highOak = userVector.oak > 0.6 && wineProfile.oak >= 4;
  const lowSweetness = userVector.sweetness < 0.3 && wineProfile.sweetness <= 1;
  
  if (highBody && highTannin) {
    return 'Matches your taste: bold & structured';
  }
  if (highAcidity && !highBody) {
    return 'Matches your taste: fresh & elegant';
  }
  if (highOak && highBody) {
    return 'Matches your taste: rich & oaky';
  }
  if (lowSweetness && bodyMatch) {
    return 'Matches your taste: dry & balanced';
  }
  if (bodyMatch && tanninMatch && acidityMatch) {
    return 'Great match for your palate';
  }
  
  return null;
}

/**
 * Get taste descriptors for display
 */
export function getTasteDescriptors(profile: TasteProfile): string[] {
  const vector = getEffectiveVector(profile);
  const descriptors: string[] = [];
  
  if (vector.body > 0.65) {
    descriptors.push('Bold wines');
  } else if (vector.body < 0.35) {
    descriptors.push('Light & delicate');
  }
  
  if (vector.tannin > 0.65) {
    descriptors.push('Structured');
  } else if (vector.tannin < 0.35) {
    descriptors.push('Silky smooth');
  }
  
  if (vector.acidity > 0.65) {
    descriptors.push('Fresh & crisp');
  }
  
  if (vector.oak > 0.65) {
    descriptors.push('Oak lover');
  } else if (vector.oak < 0.25) {
    descriptors.push('Unoaked');
  }
  
  if (vector.sweetness < 0.2) {
    descriptors.push('Dry');
  } else if (vector.sweetness > 0.5) {
    descriptors.push('Off-dry');
  }
  
  if (profile.preferences.reds_bias > 0.5) {
    descriptors.push('Red wine fan');
  } else if (profile.preferences.whites_bias > 0.5) {
    descriptors.push('White wine enthusiast');
  }
  
  return descriptors.slice(0, 3);
}

/**
 * Get top regions from preferences
 */
export function getTopRegions(profile: TasteProfile, limit = 3): string[] {
  return Object.entries(profile.preferences.regions)
    .filter(([_, weight]) => weight > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([region]) => region);
}

/**
 * Get top grapes from preferences
 */
export function getTopGrapes(profile: TasteProfile, limit = 3): string[] {
  return Object.entries(profile.preferences.grapes)
    .filter(([_, weight]) => weight > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([grape]) => grape);
}

/**
 * Reset taste profile (relearn from ratings)
 */
export async function resetTasteProfile(): Promise<TasteProfile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('Not authenticated');
  }
  
  const currentProfile = await getMyTasteProfile();
  
  if (currentProfile?.overrides) {
    const { overrides, ...rest } = currentProfile;
    await saveTasteProfile(user.id, rest);
  }
  
  return recomputeMyTasteProfile();
}

/**
 * Build taste profile context string for AI agent
 */
export function buildAgentContext(profile: TasteProfile): string {
  const vector = getEffectiveVector(profile);
  const descriptors = getTasteDescriptors(profile);
  const topRegions = getTopRegions(profile, 3);
  const topGrapes = getTopGrapes(profile, 3);
  
  const parts: string[] = [];
  
  if (descriptors.length > 0) {
    parts.push(`Taste: ${descriptors.join(', ')}`);
  }
  
  const vectorDesc: string[] = [];
  if (vector.body > 0.6) vectorDesc.push('medium-high body');
  else if (vector.body < 0.4) vectorDesc.push('lighter body');
  
  if (vector.tannin > 0.6) vectorDesc.push('appreciates tannin');
  else if (vector.tannin < 0.4) vectorDesc.push('prefers soft tannins');
  
  if (vector.acidity > 0.6) vectorDesc.push('likes acidity');
  
  if (vectorDesc.length > 0) {
    parts.push(`Prefers: ${vectorDesc.join(', ')}`);
  }
  
  if (topRegions.length > 0) {
    parts.push(`Favorite regions: ${topRegions.join(', ')}`);
  }
  
  if (topGrapes.length > 0) {
    parts.push(`Favorite grapes: ${topGrapes.join(', ')}`);
  }
  
  parts.push(`Profile confidence: ${profile.confidence}`);
  
  return parts.join('. ');
}
