/**
 * Perplexity web-search layer for Kosher wine detection.
 *
 * Used as Layer 2 in detect-kosher-status, between the deterministic rule
 * engine (Layer 1) and the conservative OpenAI fallback (Layer 3).
 *
 * Key design principles:
 * - Only runs for wines that pass shouldRunPerplexity() (cost control).
 * - Conservative: absence of evidence → null, not false.
 * - Citation-backed: kosher_source_url comes from Perplexity's citations array.
 * - Confidence calibrated against citation authority (capped down when no
 *   authoritative source URL backs the model's stated confidence).
 * - All failures are silent warn + return KOSHER_UNKNOWN — never throws.
 */

import {
  type KosherResult,
  type KosherConfidence,
  KOSHER_UNKNOWN,
} from './wineKosherDetection.ts';

// ── Wine data type (canonical definition — imported by index.ts) ──────────────

export interface WineData {
  producer: string;
  wine_name: string;
  vintage?: number | null;
  country?: string | null;
  region?: string | null;
  appellation?: string | null;
  color?: string | null;
}

// ── Partial-Kosher producer list ──────────────────────────────────────────────
//
// Producers known to have AT LEAST ONE Kosher cuvée, but whose full range is
// NOT Kosher certified. Including them here activates Perplexity for wine-level
// evidence (e.g. "Drappier Carte d'Or Kosher Champagne").
//
// This list does NOT mark anything Kosher by itself.
// Only add a producer when you are certain they have at least one documented
// Kosher cuvée that cannot be identified by a keyword in the wine name alone.

export const PARTIAL_KOSHER_PRODUCERS: readonly string[] = [
  'drappier',                       // Drappier Carte d'Or Brut Kosher Champagne
  'baron edmond de rothschild',     // Specific Kosher cuvées
  'baron edmond',                   // Alias / short form
  'rothschild',                     // Broader Rothschild family wines
  'antinori',                       // Antinori has a dedicated Kosher label
];

// ── Known Kosher producers / importers ───────────────────────────────────────
//
// Producers and importers whose PRIMARY business or a major product line is
// certified Kosher wine. Matching any of these in the producer or wine-name
// field is a strong positive signal even if the deterministic rule didn't match.
//
// Note: many of these are ALREADY in the rule table at high confidence, so
// the skip logic would have returned early before we even check this list.
// This list is a safety net for edge cases: variant spellings, data where the
// producer field carries the importer name, etc.

export const KNOWN_KOSHER_PRODUCERS: readonly string[] = [
  'herzog',
  'baron herzog',
  'covenant',
  'hagafen',
  'bartenura',
  'kedem',
  'royal wine',
  'manischewitz',
  'alfasi',
  'goose bay',          // New Zealand, Kosher certified
  'terra di seta',      // Tuscan Kosher
  'cantina giuliano',
  'cantina gabriele',
  'psagot',
  'yarden',
  'gamla',
  'golan heights',
  'carmel winery',
  'barkan',
  'recanati',
  'galil mountain',
  'dalton',
  'flam',
  'tzuba',
  'netofa',
  'tabor winery',
  "segal's wine",
  'segal wines',
  'four gates',
  'amphora winery',
];

// ── Kosher keyword signals ────────────────────────────────────────────────────
//
// Certification-status and process terms (all lowercased for comparison).
// ANY of these appearing in producer, wine_name, appellation, region, or
// notes field is a strong positive signal.
//
// Producer/importer brand names are in KNOWN_KOSHER_PRODUCERS above.
// This list focuses on certification bodies, processes, and status words.

const KOSHER_KEYWORD_SIGNALS: readonly string[] = [
  // English certification and status terms
  'kosher',
  'kosher wine',
  'kosher for passover',
  'kfp',
  'mevushal',
  'non-mevushal',
  'mehadrin',
  'badatz',
  'rabanut',
  'star-k',
  'kof-k',
  'crc kosher',
  'ok kosher',
  // Hebrew terms
  'כשר',
  'כשר לפסח',
  'מבושל',
  'לא מבושל',
  'מהדרין',
  'בד״ץ',
  'ב"ד',
  'רבנות',
  'הכשר',
];

// Case-sensitive exact-word signals — checked against the original (non-lowercased) text
// to avoid false positives (e.g. "OU" must not match inside "Mouton").
const KOSHER_CASESENSITIVE_PATTERN = /\bOU\b|\bOK\b(?=\s*[Kk]osher)/;

// ── Perplexity trigger filter ─────────────────────────────────────────────────

/**
 * Returns true if Perplexity should be invoked for this wine.
 *
 * Uses a POSITIVE SIGNAL MODEL: Perplexity runs only when at least one
 * concrete indicator suggests Kosher certification might be verifiable
 * via web search. There is NO hard country blocklist — country is only used
 * as a POSITIVE signal (Israel), never as a negative exclusion.
 *
 * Wines with no Kosher signal are skipped for cost control, regardless of
 * their country of origin. A French or US wine with explicit Kosher signals
 * is still eligible; a generic Barolo with no signals is not — because of
 * the lack of signals, not because of its country.
 *
 * @param wine           Wine data from the request
 * @param ruleConfidence Confidence returned by the rule engine, or null if no rule matched
 */
export function shouldRunPerplexity(
  wine: WineData,
  ruleConfidence: KosherConfidence | null,
): boolean {
  // Never run if the rule engine already gave a definitive high-confidence answer
  if (ruleConfidence === 'high') return false;

  // Signal E: always run when the rule engine matched at med confidence (upgrade attempt)
  if (ruleConfidence === 'med') return true;

  // Signal A: Israeli wine — high yield, certification data is publicly indexed
  if (wine.country?.toLowerCase().includes('israel')) return true;

  // Build a combined lowercase haystack from all text fields
  const parts = [
    wine.producer,
    wine.wine_name,
    wine.region ?? '',
    wine.appellation ?? '',
  ];
  const haystackLower = parts.join(' ').toLowerCase();

  // Signal B: Kosher certification/process keywords (case-insensitive)
  if (KOSHER_KEYWORD_SIGNALS.some((kw) => haystackLower.includes(kw.toLowerCase()))) return true;

  // Signal B (case-sensitive): "OU" certification mark — avoid matching "Mouton", etc.
  const haystackOrig = parts.join(' ');
  if (KOSHER_CASESENSITIVE_PATTERN.test(haystackOrig)) return true;

  // Signal C: partial-Kosher producers (have some Kosher cuvées, not full range)
  const producerLower = wine.producer.toLowerCase();
  if (PARTIAL_KOSHER_PRODUCERS.some((p) => producerLower.includes(p))) return true;

  // Signal D: known Kosher producers / major importers
  if (KNOWN_KOSHER_PRODUCERS.some((p) => haystackLower.includes(p))) return true;

  // No positive signal found → skip Perplexity for cost control.
  // This is NOT a country exclusion — it is a signal exclusion.
  // A Chateau Margaux with no Kosher keywords is skipped not because it is French,
  // but because there is no reason to believe it might be Kosher.
  return false;
}

// ── Prompts ───────────────────────────────────────────────────────────────────

function buildPerplexitySystemPrompt(): string {
  return `You are a wine Kosher certification expert with access to real-time web search.

Search the web for Kosher certification information about the wine the user describes.

HARD RULES — follow these exactly:
1. DEFAULT to is_kosher: null. Only return true or false when you found clear, source-backed evidence.
2. Return is_kosher: true ONLY when you found an authoritative source explicitly confirming Kosher certification for this producer or this specific wine.
3. Return is_kosher: false ONLY when you found an explicit official statement that this exact wine or producer is NOT certified Kosher. Absence of evidence is NOT evidence of absence — return null, not false.
4. Return is_kosher: null for all uncertain cases. Null is always the safe and correct answer when not sure.
5. Do NOT mark a wine Kosher just because it is Israeli. Not all Israeli wineries are Kosher-certified. Search for specific certification evidence.
6. Do NOT hallucinate. Do NOT infer Kosher status from country, region, reputation, or price point.
7. Prefer wine-specific evidence (exact cuvée) over producer-level evidence where possible.
8. For Israeli wines, also search Hebrew terms: כשר (Kosher), כשר לפסח (Kosher for Passover), מבושל (Mevushal), בד"ץ (Badatz), רבנות (Rabanut), הכשר (certification).

PREFERRED SOURCES (in descending authority):
- Official producer website (e.g. winery.co.il, winery.com)
- OU certified product database (oukosher.org)
- Rabbinic / Badatz authority registries (badatz.org.il and similar)
- Royal Wine product pages (royalwine.com) — wine-specific listings only
- Credible Kosher wine retailers (kosherwine.com, koshertothedoor.com)
- Kosher certification directories (kosherquest.org)

SECONDARY SOURCES (support med confidence only):
- Credible wine retailers listing the wine with a "Kosher" designation
- Wine-Searcher or Vivino listings with explicit Kosher label
- Reputable wine publications mentioning certification

NOT ACCEPTABLE as evidence: forums, blogs, recipe sites, social media, unverified user reviews.

CONFIDENCE RULES:
- "high": authoritative source (preferred list above) explicitly confirms Kosher certification for this wine/producer
- "med": credible secondary source supports Kosher status; or evidence is producer-level rather than wine-specific; or the authoritative source page is found but confirmation is indirect
- "low": ambiguous, indirect, or low-quality source — prefer returning null instead of low
- null: no relevant source found, or you are uncertain

IMPORTANT: If your only evidence for Kosher status is that the wine is Israeli, or that the producer has a Kosher reputation without a specific source, return null.

Return ONLY valid JSON in this exact structure — no markdown fences, no prose:
{
  "is_kosher": true | false | null,
  "kosher_for_passover": true | false | null,
  "mevushal": true | false | null,
  "kosher_certification": "certification body or null",
  "kosher_confidence": "high" | "med" | "low" | null,
  "kosher_source_url": "best supporting URL or null",
  "kosher_source_name": "readable source name or null",
  "kosher_notes": "concise explanation (1-2 sentences) or null"
}`;
}

function buildPerplexityUserPrompt(wine: WineData): string {
  const lines: string[] = [
    `Producer: ${wine.producer}`,
    `Wine name: ${wine.wine_name}`,
    `Vintage: ${wine.vintage ?? 'NV'}`,
    `Country: ${wine.country ?? 'Unknown'}`,
  ];
  if (wine.region) lines.push(`Region: ${wine.region}`);
  if (wine.appellation) lines.push(`Appellation: ${wine.appellation}`);
  if (wine.color) lines.push(`Color: ${wine.color}`);

  const isIsraeli = wine.country?.toLowerCase().includes('israel') ?? false;

  const searchGuidance = isIsraeli
    ? `\nSearch in both English and Hebrew.\nEnglish: "${wine.producer}" "${wine.wine_name}" kosher wine certification\nHebrew: "${wine.producer}" כשר הכשר רבנות בד"ץ "${wine.wine_name}"`
    : `\nSearch: "${wine.producer}" "${wine.wine_name}" kosher certified wine\nAlso try: "${wine.producer}" kosher certification site:oukosher.org OR site:royalwine.com`;

  return `Find Kosher certification information for this specific wine. Return null for any field where you lack clear, source-backed evidence.
${searchGuidance}

Wine details:
${lines.join('\n')}

Remember: absence of Kosher evidence = null, not false. Return JSON only.`;
}

// ── JSON extraction ───────────────────────────────────────────────────────────

/**
 * Extract JSON from Perplexity's text content.
 * Handles: plain JSON, JSON in markdown code blocks, JSON embedded in prose.
 */
function extractJsonFromContent(content: string): string | null {
  const trimmed = content.trim();

  // 1. Direct parse (model returned only JSON)
  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch { /* fall through */ }

  // 2. Markdown code block  (```json ... ``` or ``` ... ```)
  const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) {
    const candidate = codeBlock[1].trim();
    try { JSON.parse(candidate); return candidate; } catch { /* fall through */ }
  }

  // 3. Greedy JSON object extraction (model mixed prose + JSON)
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try { JSON.parse(jsonMatch[0]); return jsonMatch[0]; } catch { /* fall through */ }
  }

  return null;
}

// ── Citation authority ────────────────────────────────────────────────────────

// Domains whose presence in a citation URL supports the model's 'high'
// confidence assertion.
const HIGH_AUTHORITY_DOMAINS: readonly string[] = [
  'oukosher.org',
  'royalwine.com',
  'kosherwine.com',
  'koshertothedoor.com',
  'kosherquest.org',
  'badatz.org.il',
];

// Israeli TLD suffix — official Israeli winery sites are authoritative for
// their own wines.
const AUTHORITATIVE_TLD_SUFFIXES: readonly string[] = ['.co.il'];

/**
 * Returns true when the citation URL is from a source authoritative enough
 * to support a 'high' confidence Kosher claim.
 */
function citationSupportsHigh(citationUrl: string | null, producer: string): boolean {
  if (!citationUrl) return false;
  try {
    const { hostname } = new URL(citationUrl);
    const lower = hostname.toLowerCase();

    // Explicit high-authority domain list
    if (HIGH_AUTHORITY_DOMAINS.some((d) => lower === d || lower.endsWith(`.${d}`))) return true;

    // Israeli official TLD
    if (AUTHORITATIVE_TLD_SUFFIXES.some((s) => lower.endsWith(s))) return true;

    // Producer's own website: producer slug appears in hostname
    // Use first 8+ chars of first alpha-only word of producer name
    const producerWord = producer.toLowerCase().match(/[a-z]{4,}/)?.[0] ?? '';
    if (producerWord.length >= 4 && lower.includes(producerWord)) return true;
  } catch { /* malformed URL */ }
  return false;
}

/**
 * Pick the best (most authoritative) URL from Perplexity's citations array.
 * Prefers known-authoritative domains; falls back to the first citation.
 */
function pickBestCitation(citations: string[]): string | null {
  if (!citations || citations.length === 0) return null;

  // First pass: prefer authoritative domains
  for (const url of citations) {
    try {
      const { hostname } = new URL(url);
      const lower = hostname.toLowerCase();
      if (
        HIGH_AUTHORITY_DOMAINS.some((d) => lower === d || lower.endsWith(`.${d}`)) ||
        AUTHORITATIVE_TLD_SUFFIXES.some((s) => lower.endsWith(s))
      ) {
        return url;
      }
    } catch { /* skip malformed */ }
  }

  // Fall back to first available citation
  return citations[0] ?? null;
}

function sourceNameFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Calibrate confidence downward when the citation doesn't back the model's
 * stated confidence. We never upgrade confidence above what the model stated.
 *
 *   model=high + authoritative citation → keep high
 *   model=high + no authoritative citation → downgrade to med
 *   model=med  → keep med (citation quality doesn't upgrade beyond model's claim)
 *   model=low  → keep low (UI hides low; caller may coerce to null)
 *   model=null → null
 */
function calibrateConfidence(
  modelConfidence: KosherConfidence | null,
  citationUrl: string | null,
  producer: string,
): KosherConfidence | null {
  if (!modelConfidence || modelConfidence === 'low') return modelConfidence;
  if (modelConfidence === 'high') {
    return citationSupportsHigh(citationUrl, producer) ? 'high' : 'med';
  }
  return 'med';
}

// ── Response parser ───────────────────────────────────────────────────────────

/**
 * Parse and validate the raw Perplexity response into a KosherResult.
 *
 * Safety coercions applied (same contract as parseAiKosherResponse):
 * - is_kosher: false only persisted when calibrated confidence = 'high'
 * - confidence is capped by citation authority
 * - confidence is set to null when is_kosher is null (no result)
 */
export function parsePerplexityKosherResponse(
  content: string,
  citations: string[],
  producer: string,
): KosherResult | null {
  const jsonStr = extractJsonFromContent(content);
  if (!jsonStr) return null;

  let parsed: Record<string, unknown>;
  try {
    const raw = JSON.parse(jsonStr);
    if (typeof raw !== 'object' || raw === null) return null;
    parsed = raw as Record<string, unknown>;
  } catch {
    return null;
  }

  // Validate model-stated confidence
  const validConfidences = new Set<string>(['low', 'med', 'high']);
  const rawModelConfidence = validConfidences.has(parsed.kosher_confidence as string)
    ? (parsed.kosher_confidence as KosherConfidence)
    : null;

  // Determine source URL: prefer Perplexity's citations array over model's JSON field
  const bestCitation = pickBestCitation(citations);
  const modelSourceUrl =
    typeof parsed.kosher_source_url === 'string' && parsed.kosher_source_url.trim()
      ? parsed.kosher_source_url.trim()
      : null;
  const finalSourceUrl = bestCitation ?? modelSourceUrl;

  // Calibrate confidence against citation authority
  const calibratedConfidence = calibrateConfidence(rawModelConfidence, finalSourceUrl, producer);

  // Safety rule: is_kosher=false only accepted at 'high' calibrated confidence.
  // At lower confidence the model is asserting "Not Kosher" merely from lack of
  // evidence — that is uncertainty, not a confirmed non-Kosher determination.
  let isKosher: boolean | null;
  if (parsed.is_kosher === true) {
    isKosher = true;
  } else if (parsed.is_kosher === false) {
    isKosher = calibratedConfidence === 'high' ? false : null;
  } else {
    isKosher = null;
  }

  // When the result is null, confidence and source info must also be null
  const finalConfidence = isKosher === null ? null : calibratedConfidence;
  const finalSource = isKosher === null ? null : finalSourceUrl;
  const finalSourceName = isKosher === null
    ? null
    : (typeof parsed.kosher_source_name === 'string' && parsed.kosher_source_name.trim()
        ? parsed.kosher_source_name.trim()
        : sourceNameFromUrl(finalSource));

  const kfp =
    parsed.kosher_for_passover === true ? true
      : parsed.kosher_for_passover === false ? false
      : null;

  const mev =
    parsed.mevushal === true ? true
      : parsed.mevushal === false ? false
      : null;

  return {
    is_kosher: isKosher,
    kosher_for_passover: kfp,
    mevushal: mev,
    kosher_certification:
      typeof parsed.kosher_certification === 'string' && parsed.kosher_certification.trim()
        ? parsed.kosher_certification.trim()
        : null,
    kosher_confidence: finalConfidence,
    kosher_source_url: finalSource,
    kosher_source_name: finalSourceName,
    kosher_notes:
      isKosher !== null &&
      typeof parsed.kosher_notes === 'string' && parsed.kosher_notes.trim()
        ? parsed.kosher_notes.trim()
        : null,
  };
}

// ── Main exported function ────────────────────────────────────────────────────

const PERPLEXITY_TIMEOUT_MS = 15_000; // 15 s — generous for web search

/**
 * Query Perplexity sonar-pro for Kosher certification of a wine.
 *
 * Always returns KOSHER_UNKNOWN on any failure — never throws.
 * Caller must check shouldRunPerplexity() before calling this function.
 *
 * @param wine    Wine metadata
 * @param apiKey  PERPLEXITY_API_KEY from Deno.env
 */
export async function queryPerplexityForKosher(
  wine: WineData,
  apiKey: string,
): Promise<KosherResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PERPLEXITY_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        temperature: 0,
        max_tokens: 512,
        messages: [
          { role: 'system', content: buildPerplexitySystemPrompt() },
          { role: 'user', content: buildPerplexityUserPrompt(wine) },
        ],
        // Request citations alongside the response (supported by online Perplexity models)
        return_citations: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '(unreadable)');
      console.warn(`[wineKosherPerplexity] HTTP ${response.status}: ${errText.slice(0, 300)}`);
      return KOSHER_UNKNOWN;
    }

    // deno-lint-ignore no-explicit-any
    const data: any = await response.json();
    const content: string = data.choices?.[0]?.message?.content ?? '';

    // Collect citations — Perplexity may return them as top-level 'citations'
    // array or embedded in 'search_results'. Handle both formats defensively.
    const citations: string[] = [
      ...(Array.isArray(data.citations) ? data.citations : []),
      ...(Array.isArray(data.search_results)
        ? data.search_results.map((r: { url?: string }) => r.url).filter(Boolean)
        : []),
    ];

    const parsed = parsePerplexityKosherResponse(content, citations, wine.producer);

    if (!parsed) {
      console.warn('[wineKosherPerplexity] Could not parse response — returning null');
      return KOSHER_UNKNOWN;
    }

    return parsed;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.warn('[wineKosherPerplexity] Request timed out after 15 s');
    } else {
      console.warn(
        '[wineKosherPerplexity] Request failed:',
        err instanceof Error ? err.message : String(err),
      );
    }
    return KOSHER_UNKNOWN;
  } finally {
    clearTimeout(timeoutId);
  }
}
