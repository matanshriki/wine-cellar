/**
 * Recommendation Service
 * 
 * Generates wine recommendations from user's Supabase cellar.
 * 
 * Features:
 * - Smart variety algorithm (increased randomization)
 * - History-aware (penalizes recently opened bottles)
 * - Session rotation (tracks shown bottles in localStorage)
 */

import i18n from '../i18n/config';
import { supabase } from '../lib/supabase';
import type { Database, TasteProfile } from '../types/supabase';
import { getLocalizedWineData } from '../utils/wineTranslations';
import * as labelArtService from './labelArtService';
import * as wineProfileService from './wineProfileService';
import * as tasteProfileService from './tasteProfileService';
import { getBottleInsight } from './insightService';
import type { BottleWithWineInfo } from './bottleService';
import { findExplicitDislike, isSweetnessMismatch } from './tasteMatch';
import {
  differenceFromTop,
  groundedPairingReasons,
  hasTrustedStructure,
  mealContextFor,
  type DiffInput,
  type MealContext,
} from './mealPairing';
import { bottleMatchesMaxPriceUsd } from '../utils/priceTiers';

// LocalStorage key for tracking recently shown recommendations
const RECENT_RECOMMENDATIONS_KEY = 'wine_recent_recommendations';
const ROTATION_DAYS = 3; // How many days to remember shown bottles

type Bottle = Database['public']['Tables']['bottles']['Row'];
type Wine = Database['public']['Tables']['wines']['Row'];

export interface RecommendationInput {
  mealType?: string;
  /** Optional follow-up for broad meals (e.g. pasta → "tomato"). See MEAL_DETAILS. */
  mealDetail?: string;
  occasion?: string;
  vibe?: string;
  wineType?: 'red' | 'white' | 'rose' | 'mixed';
  constraints?: {
    avoidTooYoung?: boolean;
    preferReadyToDrink?: boolean;
    maxPrice?: number;
  };
  /** When true, reserved (Keep) bottles are included in suggestions */
  includeReserved?: boolean;
}

export interface BottleWithWine extends Bottle {
  wine: Wine;
}

export interface Recommendation {
  bottleId: string;
  bottle: {
    id: string;
    name: string;
    producer?: string;
    vintage?: number;
    style: string;
    region?: string;
    quantity: number;
    rating?: number | null;
    vivinoUrl?: string | null;
    imageUrl?: string | null;
  };
  wineId: string;
  explanation: string;
  servingInstructions: string;
  score: number;
  affinityReason?: string | null;
  /** The InsightType that generated affinityReason — used for analytics. */
  affinityInsightType?: string | null;
}

/**
 * Generate wine recommendations from user's cellar
 * 
 * Improvements:
 * - Increased randomization for variety
 * - Penalizes recently recommended bottles
 * - Better rotation to prevent same bottles appearing
 */
export async function getRecommendations(input: RecommendationInput): Promise<Recommendation[]> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('Not authenticated');
  }


  // Fetch taste profile + bottles + recent history in parallel — all independent
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [userTasteProfile, bottlesResult, historyResult] = await Promise.all([
    tasteProfileService.getMyTasteProfile().catch(() => null),
    supabase
      .from('bottles')
      .select(`*, wine:wines(*)`)
      .eq('user_id', user.id)
      .gt('quantity', 0)
      .order('created_at', { ascending: false }),
    supabase
      .from('consumption_history')
      .select('bottle_id')
      .eq('user_id', user.id)
      .gte('opened_at', sevenDaysAgo.toISOString()),
  ]);

  const { data: bottles, error } = bottlesResult;
  const { data: recentHistory } = historyResult;

  if (error) throw new Error('Failed to fetch bottles');
  if (!bottles || bottles.length === 0) return [];

  const reservedBottles = (bottles as unknown as BottleWithWine[]).filter(b => (b as any).is_reserved);
  const nonReservedBottles = (bottles as unknown as BottleWithWine[]).filter(b => !(b as any).is_reserved);

  const recentlyOpenedBottleIds = new Set(recentHistory?.map(h => h.bottle_id) || []);

  // Get recently shown recommendations from localStorage (rotation tracking)
  const recentlyShownBottleIds = getRecentlyShownBottles();

  // Start from non-reserved bottles by default
  // If user explicitly passes includeReserved=true the caller can set it on the input.
  const startingPool = (input as any).includeReserved ? (bottles as unknown as BottleWithWine[]) : nonReservedBottles;

  // Cast to proper type
  const bottlesWithWine = startingPool;

  // Filter by constraints
  let filteredBottles = bottlesWithWine;

  // Filter by max price if provided (USD cap). Unknown prices are excluded —
  // missing purchase_price must not be treated as zero / "cheap".
  // Intentional change from pre-2026-10 behavior that kept unknown prices in-range.
  if (input.constraints?.maxPrice && input.constraints.maxPrice > 0) {
    const maxUsd = input.constraints.maxPrice;
    filteredBottles = filteredBottles.filter((b) =>
      bottleMatchesMaxPriceUsd(
        b.purchase_price,
        (b as { purchase_price_currency?: string | null }).purchase_price_currency,
        maxUsd,
      ),
    );
  }

  // Filter by readiness if requested.
  // Respect both the DB-computed readiness_status AND the more nuanced AI readiness_label.
  // A bottle qualifies as "ready to drink" only when BOTH agree (or when no AI label exists yet).
  if (input.constraints?.preferReadyToDrink) {
    const readyByStatus = (b: BottleWithWine) => {
      const status = (b as any).readiness_status?.toLowerCase();
      return status === 'inwindow' || status === 'peak' || status === 'ready';
    };
    const notHoldByAI = (b: BottleWithWine) => {
      const label = (b as any).readiness_label as string | undefined;
      // If no AI label yet, don't exclude the bottle — defer to status
      if (!label) return true;
      return label !== 'HOLD';
    };

    filteredBottles = filteredBottles.filter(b => readyByStatus(b) && notHoldByAI(b));
  }

  // Skip bottles the analysis says are too young, unless nothing else is left.
  if (input.constraints?.avoidTooYoung) {
    const notTooYoung = filteredBottles.filter(b => {
      const label = (b as any).readiness_label as string | undefined;
      const status = (b as any).readiness_status?.toLowerCase();
      return label !== 'HOLD' && status !== 'tooyoung' && status !== 'too_young';
    });
    if (notTooYoung.length > 0) filteredBottles = notTooYoung;
  }

  // If no bottles match constraints, fall back to all bottles
  if (filteredBottles.length === 0) {
    filteredBottles = bottlesWithWine;
  }

  // Filter by wine type if specified (not "mixed") - MUST happen before scoring
  if (input.wineType && input.wineType !== 'mixed') {
    filteredBottles = filteredBottles.filter(b => {
      const color = b.wine.color?.toLowerCase();
      if (input.wineType === 'red') return color === 'red';
      if (input.wineType === 'white') return color === 'white';
      if (input.wineType === 'rose') return color === 'rose' || color === 'rosé';
      return true;
    });
    
    // If no wines match the type, return empty (let the UI handle the message)
    if (filteredBottles.length === 0) {
      return [];
    }
  }

  const mealContext = mealContextFor(input.mealType, input.mealDetail);
  const effectiveSweetness = userTasteProfile
    ? tasteProfileService.getEffectiveVector(userTasteProfile).sweetness
    : null;

  // Simple scoring algorithm based on meal type and wine style
  const scoredBottles = filteredBottles.map(bottle => {
    let score = 50; // Base score
    let affinityReason: string | null = null;
    let affinityInsightType: string | null = null;
    const wineProfile = wineProfileService.getWineProfile(bottle.wine);
    
    const wineColor = bottle.wine.color.toLowerCase();
    const mealType = input.mealType?.toLowerCase() || '';
    
    // Meal pairing heuristics
    if (mealType.includes('steak') || mealType.includes('beef')) {
      if (wineColor === 'red') score += 30;
    } else if (mealType.includes('fish') || mealType.includes('seafood')) {
      if (wineColor === 'white') score += 30;
      if (wineColor === 'sparkling') score += 20;
    } else if (mealType.includes('pasta')) {
      if (wineColor === 'red') score += 20;
      if (wineColor === 'white') score += 15;
    } else if (mealType.includes('chicken')) {
      if (wineColor === 'white') score += 20;
      if (wineColor === 'red') score += 10;
    } else if (mealType.includes('cheese')) {
      if (wineColor === 'red') score += 15;
      if (wineColor === 'white') score += 15;
      if (wineColor === 'sparkling') score += 25;
    } else if (mealType.includes('spicy') || mealType.includes('asian')) {
      if (wineColor === 'white') score += 25;
      if (wineColor === 'rose') score += 20;
    } else if (mealType.includes('pizza')) {
      if (wineColor === 'red') score += 25;
    }

    // Occasion bonuses
    const occasion = input.occasion?.toLowerCase() || '';
    if (occasion.includes('celebration') || occasion.includes('special')) {
      if (wineColor === 'sparkling') score += 20;
      if (bottle.purchase_price && bottle.purchase_price > 50) score += 10;
    }
    if (occasion.includes('date')) {
      if (wineColor === 'sparkling') score += 15;
      if (wineColor === 'red') score += 10;
    }

    // Vibe bonuses
    const vibe = input.vibe?.toLowerCase() || '';
    if (vibe.includes('special') || vibe.includes('surprise')) {
      if (bottle.purchase_price && bottle.purchase_price > 40) score += 10;
      if (bottle.readiness_status?.toLowerCase() === 'peak') score += 15;
    }
    if (vibe.includes('easy') || vibe.includes('casual')) {
      if (wineColor === 'white' || wineColor === 'rose') score += 10;
    }

    // Readiness bonus — DB-computed date math
    const readinessStatus = bottle.readiness_status?.toLowerCase();
    if (readinessStatus === 'peak') score += 20;
    if (readinessStatus === 'inwindow') score += 15;
    if (readinessStatus === 'ready') score += 10;

    // AI readiness label adjustment — more nuanced than date math alone.
    // When the sommelier AI says HOLD, penalise heavily so these bottles
    // don't get recommended for tonight unless there's nothing else available.
    const aiLabel = (bottle as any).readiness_label as string | undefined;
    if (aiLabel === 'READY') score += 15;
    if (aiLabel === 'PEAK_SOON') score += 8;
    if (aiLabel === 'HOLD') score -= 35;

    // Meal detail (only when the user answered the optional follow-up)
    if (mealContext) {
      score += wineProfileService.calculateFoodPairingScore(wineProfile, mealContext.food) * 0.6;
    }

    // Explicit exclusions sink a bottle; softer sweetness preferences only nudge (and are disclosed).
    if (userTasteProfile) {
      if (findExplicitDislike(bottle.wine, userTasteProfile, i18n.language)) score -= 60;
      if (isSweetnessMismatch(effectiveSweetness, wineProfileService.sweetnessOf(wineProfile))) score -= 15;
    }

    // TASTE PROFILE AFFINITY SCORING
    if (userTasteProfile) {
      const affinity = tasteProfileService.calculateAffinity(wineProfile, userTasteProfile);
      const affinityWeight = tasteProfileService.getAffinityWeight(userTasteProfile.confidence);
      
      const affinityBonus = affinity * affinityWeight * 50;
      score += affinityBonus;
      
      // Use the richer insight service (covers region, grape, structural, drink window,
      // past openings, color bias, and educational) instead of structural-only generateAffinityReason.
      // BottleWithWine and BottleWithWineInfo are structurally identical (Bottle + { wine: Wine });
      // the cast is safe and avoids a spurious as-any.
      const insight = getBottleInsight(bottle as unknown as BottleWithWineInfo, userTasteProfile);
      affinityReason = insight ? insight.text : null;
      affinityInsightType = insight ? insight.type : null;
    }

    // Penalty for recently opened bottles (prevents repetition)
    if (recentlyOpenedBottleIds.has(bottle.id)) {
      score -= 40; // Strong penalty to ensure variety
    }

    // Penalty for recently shown bottles (even if not opened)
    if (recentlyShownBottleIds.has(bottle.id)) {
      score -= 25; // Moderate penalty to encourage rotation
    }

    // INCREASED random factor for more variety (was 10, now 25)
    // This ensures different bottles can win even with similar base scores
    score += Math.random() * 25;

    return { bottle, score, affinityReason, affinityInsightType, wineProfile };
  });

  // Sort by score and take top 3
  scoredBottles.sort((a, b) => b.score - a.score);
  
  // Debug: Log top 5 scores to understand selection
  
  const topBottles = scoredBottles.slice(0, 3);
  const topDiff = topBottles[0] ? diffInputOf(topBottles[0].bottle, topBottles[0].wineProfile) : null;

  // Format recommendations
  const recommendations: Recommendation[] = topBottles.map((item, index) => {
    const { bottle, score, affinityReason, affinityInsightType, wineProfile } = item;
    const wine = bottle.wine;
    const localized = getLocalizedWineData(wine, i18n.language);

    const explanation = generateExplanation({
      bottle,
      wine,
      input,
      wineProfile,
      mealContext,
      rank: index + 1,
      top: index > 0 ? topDiff : null,
    });

    // Generate serving instructions
    let servingInstructions = generateServingInstructions(bottle, wine);

    // Get display image using centralized logic (user image > AI generated > placeholder)
    const displayImage = labelArtService.getWineDisplayImage(wine);

    return {
      bottleId: bottle.id,
      wineId: bottle.wine_id,
      bottle: {
        id: bottle.id,
        name: localized.wine_name,
        producer: localized.producer,
        vintage: wine.vintage || undefined,
        style: wine.color,
        region: localized.region || undefined,
        quantity: bottle.quantity,
        rating: wine.rating || null,
        vivinoUrl: wine.vivino_url || null,
        imageUrl: displayImage.imageUrl,
      },
      explanation,
      servingInstructions,
      score: Math.round(score),
      affinityReason,
      affinityInsightType,
    };
  });

  // Track these recommendations for rotation
  trackShownBottles(recommendations.map(r => r.bottleId));


  // Attach metadata about excluded reserved bottles so callers can show a note
  (recommendations as any).__reservedExcludedCount = input.includeReserved ? 0 : reservedBottles.length;

  return recommendations;
}

/**
 * Get recently shown bottle IDs from localStorage
 */
function getRecentlyShownBottles(): Set<string> {
  try {
    const stored = localStorage.getItem(RECENT_RECOMMENDATIONS_KEY);
    if (!stored) return new Set();

    const data = JSON.parse(stored);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - ROTATION_DAYS);

    // Filter out old entries
    const recent = data.filter((entry: { date: string }) => 
      new Date(entry.date) > cutoffDate
    );

    return new Set(recent.map((entry: { bottleId: string }) => entry.bottleId));
  } catch (error) {
    console.error('[RecommendationService] Error reading recent bottles:', error);
    return new Set();
  }
}

/**
 * Track bottles shown in this recommendation session
 */
function trackShownBottles(bottleIds: string[]) {
  try {
    const stored = localStorage.getItem(RECENT_RECOMMENDATIONS_KEY);
    const existing = stored ? JSON.parse(stored) : [];
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - ROTATION_DAYS);

    // Remove old entries and add new ones
    const filtered = existing.filter((entry: { date: string }) => 
      new Date(entry.date) > cutoffDate
    );

    const newEntries = bottleIds.map(bottleId => ({
      bottleId,
      date: new Date().toISOString()
    }));

    const updated = [...filtered, ...newEntries];
    localStorage.setItem(RECENT_RECOMMENDATIONS_KEY, JSON.stringify(updated));
    
  } catch (error) {
    console.error('[RecommendationService] Error tracking shown bottles:', error);
  }
}

function translateColor(color: string): string {
  const key = `cellar.wineStyles.${color.toLowerCase()}`;
  const translated = i18n.t(key);
  return translated !== key ? translated : color;
}

function translateMeal(meal: string): string {
  const key = `recommendation.form.mealTypes.${meal}`;
  const translated = i18n.t(key);
  return translated !== key ? translated : meal;
}

type Readiness = DiffInput['readiness'];

function readinessOf(bottle: BottleWithWine): Readiness {
  const label = (bottle as any).readiness_label as string | undefined;
  if (label === 'READY' || label === 'PEAK_SOON' || label === 'HOLD') return label;
  return null;
}

function diffInputOf(bottle: BottleWithWine, profile: wineProfileService.WineProfile): DiffInput {
  return {
    color: bottle.wine.color?.toLowerCase() ?? '',
    profile,
    readiness: readinessOf(bottle),
    vintage: bottle.wine.vintage ?? null,
  };
}

/** Same color heuristics the score uses, so the explanation never contradicts the ranking. */
function colorFitsMeal(meal: string, color: string): boolean {
  if (meal.includes('steak') || meal.includes('beef') || meal.includes('pizza')) return color === 'red';
  if (meal.includes('fish') || meal.includes('seafood')) return color === 'white' || color === 'sparkling';
  if (meal.includes('pasta') || meal.includes('chicken')) return color === 'red' || color === 'white';
  if (meal.includes('cheese')) return color === 'red' || color === 'white' || color === 'sparkling';
  if (meal.includes('spicy') || meal.includes('asian')) return color === 'white' || color === 'rose';
  return false;
}

function firstGrape(grapes: unknown): string | null {
  if (Array.isArray(grapes)) return (grapes.find((g) => typeof g === 'string' && g.trim()) as string) ?? null;
  if (typeof grapes === 'string' && grapes.trim()) return grapes.split(',')[0].trim();
  return null;
}

/**
 * Builds "why this bottle" from data only: identity, how the measured style meets
 * the dish, maturity, and (for options 2–3) how it differs from the first pick.
 * When the data cannot support a pairing claim, it says so.
 */
function generateExplanation(params: {
  bottle: BottleWithWine;
  wine: Wine;
  input: RecommendationInput;
  wineProfile: wineProfileService.WineProfile;
  mealContext: MealContext | null;
  rank: number;
  top: DiffInput | null;
}): string {
  const { bottle, wine, input, wineProfile, mealContext, top } = params;
  const t = i18n.t.bind(i18n);
  const G = 'recommendation.grounded';
  const parts: string[] = [];
  const color = translateColor(wine.color);
  const localized = getLocalizedWineData(wine, i18n.language);
  const origin = localized.region || null;
  const grape = firstGrape(localized.grapes ?? wine.grapes);
  const mealKey = input.mealType?.toLowerCase() || '';

  if (grape && origin) parts.push(t(`${G}.identityGrapeOrigin`, { grape, origin, color }));
  else if (grape) parts.push(t(`${G}.identityGrape`, { grape, color }));
  else if (origin) parts.push(t(`${G}.identityOrigin`, { origin, color }));

  const reasons = mealContext ? groundedPairingReasons(wineProfile, mealContext) : [];
  for (const r of reasons) parts.push(t(`${G}.pairing.${r.key}`));

  if (mealKey && reasons.length === 0) {
    const meal = translateMeal(mealKey);
    parts.push(
      colorFitsMeal(mealKey, wine.color.toLowerCase())
        ? t(`${G}.colorFits`, { color, meal })
        : t(`${G}.colorStretch`, { color, meal }),
    );
  }

  const readiness = readinessOf(bottle);
  if (readiness === 'READY') parts.push(t('recommendation.generated.readinessReady'));
  else if (readiness === 'PEAK_SOON') parts.push(t('recommendation.generated.readinessPeakSoon'));
  else if (readiness === 'HOLD') parts.push(t('recommendation.generated.readinessHold'));
  else if (bottle.readiness_status) {
    const status = bottle.readiness_status.toLowerCase();
    if (status === 'peak') parts.push(t('recommendation.generated.readinessPeak'));
    else if (status === 'inwindow' || status === 'ready') parts.push(t('recommendation.generated.readinessInWindow'));
  }

  const occasion = input.occasion?.toLowerCase() || '';
  if ((occasion.includes('celebration') || occasion.includes('special')) && wine.color.toLowerCase() === 'sparkling') {
    parts.push(t(`${G}.occasionBubbles`));
  } else if ((occasion.includes('friends') || occasion.includes('hosting')) && bottle.quantity >= 2) {
    parts.push(t(`${G}.occasionShare`, { count: bottle.quantity }));
  }

  if (top) {
    const key = differenceFromTop(diffInputOf(bottle, wineProfile), top);
    parts.push(t(`${G}.diff.${key}`, { color, vintage: wine.vintage ?? '' }));
  }

  const knowsStyle = hasTrustedStructure(wineProfile) || wineProfile.sweetness_basis === 'label';
  if (mealKey && !knowsStyle && reasons.length === 0) {
    parts.push(t(`${G}.limitedData`));
  }

  return parts.join(' ').trim();
}

function generateServingInstructions(bottle: BottleWithWine, wine: Wine): string {
  const t = i18n.t.bind(i18n);
  const wineColor = wine.color.toLowerCase();

  let temp: string | null = null;
  let decanting = t('recommendation.generated.noDecanting');

  if (wineColor === 'red') {
    temp = bottle.serve_temp_c ? `${bottle.serve_temp_c}°C` : '16-18°C';

    if (bottle.decant_minutes && bottle.decant_minutes > 0) {
      decanting = t('recommendation.generated.decantFor', { minutes: bottle.decant_minutes });
    } else if (wine.vintage && wine.vintage < new Date().getFullYear() - 5) {
      decanting = t('recommendation.generated.decantForBest');
    } else {
      decanting = t('recommendation.generated.decantHelpful');
    }
  } else if (wineColor === 'white' || wineColor === 'rose') {
    temp = bottle.serve_temp_c ? `${bottle.serve_temp_c}°C` : '8-12°C';
    decanting = t('recommendation.generated.noDecanting');
  } else if (wineColor === 'sparkling') {
    temp = bottle.serve_temp_c ? `${bottle.serve_temp_c}°C` : '6-8°C';
    decanting = t('recommendation.generated.serveImmediately');
  }

  if (temp === null) {
    return decanting;
  }

  return `${t('recommendation.generated.serveAt', { temp })} ${decanting}.`;
}

