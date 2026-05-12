/**
 * Supabase Edge Function: Search Vivino Wine
 *
 * Takes AI-extracted wine data, searches Vivino, fuzzy-matches candidates,
 * and returns the best matching wine ID automatically.
 *
 * Endpoint: POST /functions/v1/search-vivino-wine
 * Body: { producer?, wine_name, vintage?, region?, grape? }
 * Response: { success: true, match: { wine_id, confidence, name, winery } | null, candidates: [] }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Minimum confidence score required to return a match (0-1)
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
  vintage: number | null;
  raw_text: string;
}

interface ScoredCandidate extends WineCandidate {
  confidence: number;
}

// ── String utilities ──────────────────────────────────────────────────────────

function normalizeString(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining diacritics
    .replace(/château/g, 'chateau')
    .replace(/\bch\.\s*/g, 'chateau ')
    .replace(/domaine\b/g, 'domaine')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(s: string): Set<string> {
  const STOP_WORDS = new Set(['the', 'de', 'du', 'la', 'le', 'les', 'di', 'del', 'des', 'a', 'et', 'and', 'von', 'van', 'of']);
  return new Set(
    normalizeString(s)
      .split(' ')
      .filter(t => t.length > 1 && !STOP_WORDS.has(t))
  );
}

/** Jaccard similarity between two token sets, 0-1 */
function jaccardScore(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  const intersection = [...a].filter(t => b.has(t)).length;
  const union = new Set([...a, ...b]).size;
  return intersection / union;
}

/** Soft substring bonus — rewards when all input tokens appear in candidate text */
function subsetBonus(inputTokens: Set<string>, candidateTokens: Set<string>): number {
  if (inputTokens.size === 0) return 0;
  const matched = [...inputTokens].filter(t => candidateTokens.has(t)).length;
  return matched / inputTokens.size;
}

// ── Query builder ─────────────────────────────────────────────────────────────

function buildSearchQuery(input: WineInput): string {
  const parts: string[] = [];

  if (input.producer?.trim()) {
    parts.push(`"${input.producer.trim()}"`);
  }
  if (input.wine_name?.trim()) {
    parts.push(`"${input.wine_name.trim()}"`);
  }
  const vintage = input.vintage ? String(input.vintage).trim() : '';
  if (/^\d{4}$/.test(vintage)) {
    parts.push(vintage);
  }
  if (input.region?.trim() && input.region.trim().length > 2) {
    parts.push(`"${input.region.trim()}"`);
  }

  return parts.join(' ');
}

// ── HTML parsing ──────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract wine candidates from Vivino search page HTML.
 * Finds all /w/{id} links and extracts surrounding text for name/winery.
 */
function parseSearchResults(html: string): WineCandidate[] {
  const candidates: WineCandidate[] = [];
  const seenIds = new Set<string>();

  // Find all wine page links: href=".../ w/{id}..."
  const linkPattern = /href="([^"]*\/w\/(\d{4,8})[^"]*)"/g;
  let m: RegExpExecArray | null;

  while ((m = linkPattern.exec(html)) !== null) {
    const wine_id = m[2];
    if (seenIds.has(wine_id)) continue;
    seenIds.add(wine_id);

    // Grab ~600 chars of surrounding HTML for context
    const ctxStart = Math.max(0, m.index - 350);
    const ctxEnd = Math.min(html.length, m.index + 350);
    const contextHtml = html.slice(ctxStart, ctxEnd);

    // Strip HTML to readable text
    const text = stripHtml(contextHtml);

    // Extract vintage year (1950-2030)
    const vintageMatch = text.match(/\b(19[5-9]\d|20[0-3]\d)\b/);
    const vintage = vintageMatch ? parseInt(vintageMatch[0]) : null;

    // Split text into meaningful chunks by common separators
    const parts = text
      .split(/[\n\r,|·•·–—\t]+/)
      .map(s => s.trim())
      .filter(s => s.length > 2 && s.length < 120 && !/^\d+$/.test(s));

    const name = parts[0] || '';
    const winery = parts.length > 1 ? parts[1] : '';

    candidates.push({
      wine_id,
      name,
      winery,
      vintage,
      raw_text: text.slice(0, 300),
    });

    if (candidates.length >= 12) break; // Cap at 12 to avoid junk results
  }

  return candidates;
}

// ── Fuzzy scoring ─────────────────────────────────────────────────────────────

/**
 * Score a candidate against the user's input.
 * Returns 0-1 confidence value.
 *
 * Weights:
 *   - Wine name match vs combined candidate text: 0.45
 *   - Producer/winery match vs combined candidate text: 0.35
 *   - Vintage exact match: 0.20
 */
function scoreCandidate(candidate: WineCandidate, input: WineInput, totalCandidates: number): number {
  const candidateText = `${candidate.name} ${candidate.winery} ${candidate.raw_text}`;
  const candidateTokens = tokenize(candidateText);

  let score = 0;
  let weightUsed = 0;

  // Wine name match (0.45)
  if (input.wine_name) {
    const inputTokens = tokenize(input.wine_name);
    const jaccard = jaccardScore(inputTokens, candidateTokens);
    const subset = subsetBonus(inputTokens, candidateTokens);
    const nameScore = Math.max(jaccard, subset * 0.8);
    score += nameScore * 0.45;
    weightUsed += 0.45;
  }

  // Producer/winery match (0.35)
  if (input.producer) {
    const inputTokens = tokenize(input.producer);
    const jaccard = jaccardScore(inputTokens, candidateTokens);
    const subset = subsetBonus(inputTokens, candidateTokens);
    const producerScore = Math.max(jaccard, subset * 0.8);
    score += producerScore * 0.35;
    weightUsed += 0.35;
  }

  // Vintage exact match (0.20)
  if (input.vintage && candidate.vintage) {
    const inputVintage = parseInt(String(input.vintage));
    if (!isNaN(inputVintage)) {
      score += (inputVintage === candidate.vintage ? 1 : 0) * 0.2;
      weightUsed += 0.2;
    }
  }

  const rawScore = weightUsed > 0 ? score / weightUsed : 0;

  // Boost confidence when there are very few candidates (search was precise)
  const precisionBoost = totalCandidates === 1 ? 0.15 : totalCandidates === 2 ? 0.08 : 0;

  return Math.min(1, rawScore + precisionBoost);
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const input: WineInput = await req.json();

    if (!input.wine_name && !input.producer) {
      throw new Error('At least wine_name or producer is required');
    }

    console.log('[Search Vivino Wine] Input:', JSON.stringify(input));

    // Build search query
    const query = buildSearchQuery(input);
    console.log('[Search Vivino Wine] Query:', query);

    // Fetch Vivino search page
    const searchUrl = `https://www.vivino.com/search/wines?q=${encodeURIComponent(query)}`;
    console.log('[Search Vivino Wine] Fetching:', searchUrl);

    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.vivino.com/',
        'Cache-Control': 'no-cache',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`Vivino search returned ${response.status}`);
    }

    const html = await response.text();
    console.log('[Search Vivino Wine] Got HTML, length:', html.length);

    // Parse candidates
    const candidates = parseSearchResults(html);
    console.log('[Search Vivino Wine] Parsed candidates:', candidates.length);

    if (candidates.length === 0) {
      // Try a simpler query without quotes as fallback
      const simpleQuery = [input.producer, input.wine_name, input.vintage]
        .filter(Boolean).join(' ');

      if (simpleQuery !== query) {
        console.log('[Search Vivino Wine] No results, trying simple query:', simpleQuery);
        const fallbackUrl = `https://www.vivino.com/search/wines?q=${encodeURIComponent(simpleQuery)}`;
        const fallbackRes = await fetch(fallbackUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.vivino.com/',
          },
          redirect: 'follow',
        });

        if (fallbackRes.ok) {
          const fallbackHtml = await fallbackRes.text();
          const fallbackCandidates = parseSearchResults(fallbackHtml);
          candidates.push(...fallbackCandidates);
        }
      }
    }

    if (candidates.length === 0) {
      console.log('[Search Vivino Wine] No candidates found');
      return new Response(
        JSON.stringify({ success: true, match: null, candidates: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Score all candidates
    const scored: ScoredCandidate[] = candidates.map(c => ({
      ...c,
      confidence: scoreCandidate(c, input, candidates.length),
    }));

    // Sort by confidence descending
    scored.sort((a, b) => b.confidence - a.confidence);

    const best = scored[0];
    console.log('[Search Vivino Wine] Best candidate:', {
      wine_id: best.wine_id,
      confidence: best.confidence,
      name: best.name,
      winery: best.winery,
    });

    // Return match only if confidence is above threshold
    const match = best.confidence >= CONFIDENCE_THRESHOLD
      ? { wine_id: best.wine_id, confidence: best.confidence, name: best.name, winery: best.winery }
      : null;

    // Return top 5 candidates for potential UI use
    const topCandidates = scored.slice(0, 5).map(c => ({
      wine_id: c.wine_id,
      confidence: c.confidence,
      name: c.name,
      winery: c.winery,
    }));

    return new Response(
      JSON.stringify({ success: true, match, candidates: topCandidates }),
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
