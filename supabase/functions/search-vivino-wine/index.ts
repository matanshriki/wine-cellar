/**
 * Supabase Edge Function: Search Vivino Wine
 *
 * Takes AI-extracted wine data and tries multiple strategies to find
 * the exact wine page on Vivino, returning the wine ID for use with
 * the fetch-vivino-data function.
 *
 * Strategies (in order):
 * 1. Slug URL guessing: construct /en/{producer-wine-slug}/w and follow redirects
 * 2. API explore/explore: fetch top candidates, extract winery_id, drill down into
 *    /api/wineries/{id}/wines for a targeted full-catalog fuzzy match
 * 3. Direct fuzzy match on explore candidates (fallback if no winery found)
 *
 * Endpoint: POST /functions/v1/search-vivino-wine
 * Body: { producer?, wine_name, vintage?, region?, grape? }
 * Response: { success: true, match: { wine_id, confidence, name, winery } | null, candidates: [] }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { buildCorsHeaders } from '../_shared/corsAllowlist.ts';
import { requireUser } from '../_shared/requireUser.ts';
import { checkRateLimit } from '../_shared/rateLimit.ts';

const CONFIDENCE_THRESHOLD = 0.5;

interface WineInput {
  producer?: string | null;
  wine_name?: string | null;
  vintage?: number | string | null;
  region?: string | null;
  grape?: string | null;
}

interface WineCandidate {
  wine_id: string;
  name: string;
  winery: string;
  winery_id: string | null;
  vintage: number | null;
  raw_text: string;
}

interface ScoredCandidate extends WineCandidate {
  confidence: number;
}

// ── Shared HTTP headers ───────────────────────────────────────────────────────

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.vivino.com/',
  'Cache-Control': 'no-cache',
};

// ── String utilities ──────────────────────────────────────────────────────────

function normalizeString(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/château/g, 'chateau')
    .replace(/\bch\.\s*/g, 'chateau ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toSlug(s: string): string {
  return normalizeString(s)
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function tokenize(s: string): Set<string> {
  const STOP_WORDS = new Set(['the', 'de', 'du', 'la', 'le', 'les', 'di', 'del', 'des', 'a', 'et', 'and', 'von', 'van', 'of']);
  return new Set(
    normalizeString(s)
      .split(' ')
      .filter(t => t.length > 1 && !STOP_WORDS.has(t))
  );
}

function jaccardScore(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  const intersection = [...a].filter(t => b.has(t)).length;
  const union = new Set([...a, ...b]).size;
  return intersection / union;
}

function subsetBonus(inputTokens: Set<string>, candidateTokens: Set<string>): number {
  if (inputTokens.size === 0) return 0;
  const matched = [...inputTokens].filter(t => candidateTokens.has(t)).length;
  return matched / inputTokens.size;
}

// ── Strategy 1: Slug-based URL guessing ──────────────────────────────────────

/**
 * Extract wine_id from a Vivino wine page URL.
 * Handles patterns like:
 *   https://www.vivino.com/w/123456
 *   https://www.vivino.com/en/wine-name/w/123456?year=2020
 */
function extractWineIdFromUrl(url: string): string | null {
  const m = url.match(/\/w\/(\d{4,10})(?:[?&/]|$)/);
  return m ? m[1] : null;
}

/**
 * Try to find a wine by constructing its likely Vivino URL slug.
 * Vivino wine URLs follow the pattern: /en/{producer-slug}-{wine-slug}/w/{id}
 *
 * We request the URL without the ID and follow the redirect to discover the ID.
 */
async function trySlugStrategies(input: WineInput): Promise<WineCandidate | null> {
  const producer = input.producer?.trim() ?? '';
  const wineName = input.wine_name?.trim() ?? '';
  if (!producer && !wineName) return null;

  const producerSlug = toSlug(producer);
  const wineSlug = toSlug(wineName);

  const slugCandidates: string[] = [];

  if (producerSlug && wineSlug) {
    slugCandidates.push(`${producerSlug}-${wineSlug}`);
    slugCandidates.push(wineSlug);
  } else if (wineSlug) {
    slugCandidates.push(wineSlug);
  }

  for (const slug of slugCandidates) {
    const testUrl = `https://www.vivino.com/en/${slug}/w`;
    console.log('[Search Vivino Wine] Trying slug URL:', testUrl);

    try {
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: BROWSER_HEADERS,
        redirect: 'follow',
      });

      const finalUrl = response.url;
      console.log('[Search Vivino Wine] Final URL after redirect:', finalUrl, '| Status:', response.status);

      if (response.ok) {
        const wine_id = extractWineIdFromUrl(finalUrl);
        if (wine_id) {
          console.log('[Search Vivino Wine] ✅ Found wine_id via slug:', wine_id, '| from URL:', finalUrl);
          const urlSlugMatch = finalUrl.match(/\/en\/([^/]+)\/w\//);
          const urlSlug = urlSlugMatch ? urlSlugMatch[1] : slug;
          return {
            wine_id,
            name: wineName,
            winery: producer,
            winery_id: null,
            vintage: input.vintage ? parseInt(String(input.vintage)) : null,
            raw_text: urlSlug,
          };
        }
      }
    } catch (err) {
      console.log('[Search Vivino Wine] Slug fetch error:', err);
    }
  }

  return null;
}

// ── Strategy 2: API JSON endpoint ─────────────────────────────────────────────

/**
 * Parse Vivino /api/explore/explore JSON response into wine candidates.
 * The correct response path is data.explore_vintage.matches.
 * Results are sorted by popularity (not text relevance) — we use fuzzy matching
 * to find the best fit from the top candidates.
 */
function parseExploreResults(data: any): WineCandidate[] {
  const candidates: WineCandidate[] = [];
  const seenIds = new Set<string>();

  const matches = data?.explore_vintage?.matches ?? [];

  for (const match of matches.slice(0, 25)) {
    const vintageObj = match?.vintage;
    const wine = vintageObj?.wine;
    if (!wine?.id || !wine?.name) continue;

    const wine_id = String(wine.id);
    if (seenIds.has(wine_id)) continue;
    seenIds.add(wine_id);

    const name = wine.name as string;
    const winery = (wine.winery?.name as string) ?? '';
    const winery_id = wine.winery?.id ? String(wine.winery.id) : null;
    const region = (wine.region?.name as string) ?? '';

    const vintageStr: string = vintageObj?.name ?? vintageObj?.seo_name ?? '';
    const vintageMatch = vintageStr.match(/\b(19[5-9]\d|20[0-3]\d)\b/);
    const vintage = vintageMatch ? parseInt(vintageMatch[1]) : null;

    const raw_text = `${winery} ${name} ${region}`.trim();
    candidates.push({ wine_id, name, winery, winery_id, vintage, raw_text });
  }

  return candidates;
}

async function fetchExploreCandidates(query: string): Promise<WineCandidate[]> {
  const params = new URLSearchParams({
    country_code: 'en',
    currency_code: 'USD',
    grape_filter: 'varietal',
    min_rating: '1',
    page: '1',
    price_range_max: '50000',
    price_range_min: '1',
    q: query,
  });

  // Correct endpoint: /api/explore/explore (not /api/explore)
  const apiUrl = `https://www.vivino.com/api/explore/explore?${params.toString()}`;
  console.log('[Search Vivino Wine] Explore API URL:', apiUrl);

  const response = await fetch(apiUrl, {
    headers: { ...BROWSER_HEADERS, 'Accept': 'application/json' },
  });

  if (!response.ok) throw new Error(`Vivino explore API returned ${response.status}`);

  const data = await response.json();
  console.log('[Search Vivino Wine] Explore records_matched:', data?.explore_vintage?.records_matched);
  return parseExploreResults(data);
}

// ── Strategy 3: Winery drill-down ─────────────────────────────────────────────

/**
 * From explore candidates, find the winery_id whose name best matches the input producer.
 * Returns the winery_id if we find a reasonably confident match (Jaccard ≥ 0.3).
 */
function findWineryId(candidates: WineCandidate[], input: WineInput): string | null {
  if (!input.producer || candidates.length === 0) return null;

  const producerTokens = tokenize(input.producer);
  if (producerTokens.size === 0) return null;

  let bestWineryId: string | null = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    if (!candidate.winery_id || !candidate.winery) continue;
    const candidateWineryTokens = tokenize(candidate.winery);
    const jaccard = jaccardScore(producerTokens, candidateWineryTokens);
    const subset = subsetBonus(producerTokens, candidateWineryTokens);
    const score = Math.max(jaccard, subset * 0.8);

    if (score > bestScore) {
      bestScore = score;
      bestWineryId = candidate.winery_id;
    }
  }

  console.log('[Search Vivino Wine] Best winery match score:', bestScore, '→ winery_id:', bestWineryId);
  return bestScore >= 0.3 ? bestWineryId : null;
}

/**
 * Fetch all wines for a specific winery from Vivino.
 * Response: { wines: [{ id, name, seo_name, winery, ... }] }
 */
async function fetchWineryWines(winery_id: string): Promise<WineCandidate[]> {
  const params = new URLSearchParams({ per_page: '100' });
  const url = `https://www.vivino.com/api/wineries/${winery_id}/wines?${params.toString()}`;
  console.log('[Search Vivino Wine] Winery wines URL:', url);

  const response = await fetch(url, {
    headers: { ...BROWSER_HEADERS, 'Accept': 'application/json' },
  });

  if (!response.ok) {
    console.log('[Search Vivino Wine] Winery wines API returned', response.status);
    return [];
  }

  const data = await response.json();

  // Handle both possible response shapes: { wines: [...] } or { winery: {...}, wines: [...] }
  const winesArray: any[] = Array.isArray(data?.wines)
    ? data.wines
    : Array.isArray(data)
    ? data
    : [];

  console.log('[Search Vivino Wine] Winery wines count:', winesArray.length);

  const candidates: WineCandidate[] = [];
  for (const wine of winesArray) {
    if (!wine?.id || !wine?.name) continue;
    const wine_id = String(wine.id);
    const name = wine.name as string;
    const wineryName = (wine.winery?.name as string) ?? '';
    candidates.push({
      wine_id,
      name,
      winery: wineryName,
      winery_id,
      vintage: null, // Winery endpoint returns base wines, not vintages
      raw_text: `${wineryName} ${name}`.trim(),
    });
  }

  return candidates;
}

// ── Fuzzy scoring ─────────────────────────────────────────────────────────────

function scoreCandidate(candidate: WineCandidate, input: WineInput, totalCandidates: number): number {
  const candidateText = `${candidate.name} ${candidate.winery} ${candidate.raw_text}`;
  const candidateTokens = tokenize(candidateText);

  let score = 0;
  let weightUsed = 0;

  if (input.wine_name) {
    const inputTokens = tokenize(input.wine_name);
    const jaccard = jaccardScore(inputTokens, candidateTokens);
    const subset = subsetBonus(inputTokens, candidateTokens);
    score += Math.max(jaccard, subset * 0.8) * 0.45;
    weightUsed += 0.45;
  }

  if (input.producer) {
    const inputTokens = tokenize(input.producer);
    const jaccard = jaccardScore(inputTokens, candidateTokens);
    const subset = subsetBonus(inputTokens, candidateTokens);
    score += Math.max(jaccard, subset * 0.8) * 0.35;
    weightUsed += 0.35;
  }

  if (input.vintage && candidate.vintage) {
    const inputVintage = parseInt(String(input.vintage));
    if (!isNaN(inputVintage)) {
      score += (inputVintage === candidate.vintage ? 1 : 0) * 0.2;
      weightUsed += 0.2;
    }
  }

  const rawScore = weightUsed > 0 ? score / weightUsed : 0;
  const precisionBoost = totalCandidates === 1 ? 0.15 : totalCandidates === 2 ? 0.08 : 0;
  return Math.min(1, rawScore + precisionBoost);
}

/**
 * Score winery wines (winery already confirmed — weight entirely on wine name).
 */
function scoreWineryCandidate(candidate: WineCandidate, input: WineInput): number {
  if (!input.wine_name) return 0;

  const nameTokens = tokenize(input.wine_name);
  const candidateTokens = tokenize(candidate.name);

  const jaccard = jaccardScore(nameTokens, candidateTokens);
  const subset = subsetBonus(nameTokens, candidateTokens);
  // Winery already matched — wine name match alone is authoritative
  return Math.max(jaccard, subset * 0.85);
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const auth = await requireUser(req);
    if (!auth.ok) {
      return new Response(auth.response.body, {
        status: auth.response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rl = checkRateLimit(`search-vivino:${auth.userId}`, 30, 60 * 60 * 1000);
    if (!rl.allowed) {
      return new Response(
        JSON.stringify({ success: false, error: 'rate_limited', match: null, candidates: [] }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Retry-After': String(rl.retryAfterSec),
          },
        }
      );
    }

    const input: WineInput = await req.json();

    if (!input.wine_name && !input.producer) {
      throw new Error('At least wine_name or producer is required');
    }

    // Cap string inputs
    for (const key of ['producer', 'wine_name', 'region', 'grape'] as const) {
      const v = input[key];
      if (typeof v === 'string' && v.length > 200) {
        input[key] = v.slice(0, 200);
      }
    }

    console.log('[Search Vivino Wine] Input:', JSON.stringify(input));

    // ── Strategy 1: Slug-based URL guessing ──────────────────────────────────
    const slugMatch = await trySlugStrategies(input);

    if (slugMatch) {
      const confidence = scoreCandidate(slugMatch, input, 1);
      const finalConfidence = Math.max(confidence, 0.75);
      console.log('[Search Vivino Wine] ✅ Slug match confidence:', finalConfidence);

      return new Response(
        JSON.stringify({
          success: true,
          match: {
            wine_id: slugMatch.wine_id,
            confidence: finalConfidence,
            name: slugMatch.name,
            winery: slugMatch.winery,
          },
          candidates: [{ wine_id: slugMatch.wine_id, confidence: finalConfidence, name: slugMatch.name, winery: slugMatch.winery }],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // ── Strategy 2: API explore/explore (correct endpoint + response key) ────
    console.log('[Search Vivino Wine] Slug strategy failed, trying explore API...');

    const query = [input.producer?.trim(), input.wine_name?.trim()]
      .filter(Boolean).join(' ');

    let exploreCandidates = await fetchExploreCandidates(query);
    console.log('[Search Vivino Wine] Explore candidates:', exploreCandidates.length);

    if (exploreCandidates.length === 0 && input.wine_name?.trim()) {
      exploreCandidates = await fetchExploreCandidates(input.wine_name.trim());
      console.log('[Search Vivino Wine] Name-only explore candidates:', exploreCandidates.length);
    }

    // ── Strategy 3: Winery drill-down ────────────────────────────────────────
    // Find the winery ID from explore results, then fetch ALL wines from that winery.
    // This gives us a targeted, fully-fuzzy-matchable catalog (5–100 wines vs 25 popularity-sorted).
    if (exploreCandidates.length > 0) {
      const wineryId = findWineryId(exploreCandidates, input);

      if (wineryId) {
        console.log('[Search Vivino Wine] Drilling down into winery:', wineryId);
        const wineryCandidates = await fetchWineryWines(wineryId);

        if (wineryCandidates.length > 0) {
          const scored: ScoredCandidate[] = wineryCandidates.map(c => ({
            ...c,
            confidence: scoreWineryCandidate(c, input),
          }));
          scored.sort((a, b) => b.confidence - a.confidence);

          const best = scored[0];
          console.log('[Search Vivino Wine] Best winery drill-down candidate:', {
            wine_id: best.wine_id,
            confidence: best.confidence,
            name: best.name,
            winery: best.winery,
          });

          if (best.confidence >= CONFIDENCE_THRESHOLD) {
            return new Response(
              JSON.stringify({
                success: true,
                match: {
                  wine_id: best.wine_id,
                  confidence: best.confidence,
                  name: best.name,
                  winery: best.winery,
                },
                candidates: scored.slice(0, 5).map(c => ({
                  wine_id: c.wine_id,
                  confidence: c.confidence,
                  name: c.name,
                  winery: c.winery,
                })),
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            );
          }

          console.log('[Search Vivino Wine] Winery drill-down best score below threshold:', best.confidence);
        }
      }
    }

    // ── Fallback: fuzzy match directly on explore candidates ─────────────────
    if (exploreCandidates.length === 0) {
      console.log('[Search Vivino Wine] No candidates found');
      return new Response(
        JSON.stringify({ success: true, match: null, candidates: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const scored: ScoredCandidate[] = exploreCandidates.map(c => ({
      ...c,
      confidence: scoreCandidate(c, input, exploreCandidates.length),
    }));
    scored.sort((a, b) => b.confidence - a.confidence);

    const best = scored[0];
    console.log('[Search Vivino Wine] Best explore candidate (direct):', {
      wine_id: best.wine_id,
      confidence: best.confidence,
      name: best.name,
      winery: best.winery,
    });

    const match = best.confidence >= CONFIDENCE_THRESHOLD
      ? { wine_id: best.wine_id, confidence: best.confidence, name: best.name, winery: best.winery }
      : null;

    return new Response(
      JSON.stringify({
        success: true,
        match,
        candidates: scored.slice(0, 5).map(c => ({
          wine_id: c.wine_id,
          confidence: c.confidence,
          name: c.name,
          winery: c.winery,
        })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('[Search Vivino Wine] Error:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Search failed', match: null, candidates: [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  }
});
