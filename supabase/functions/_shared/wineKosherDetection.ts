/**
 * Kosher wine detection — rule-based producer lookup.
 * Single source of truth shared by the detect-kosher-status Edge Function.
 *
 * Conservative design: only mark is_kosher=true when the producer is a known
 * certified Kosher winery. All other wines default to null (unknown).
 * Never guess. Never hallucinate.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type KosherConfidence = 'low' | 'med' | 'high';

export interface KosherResult {
  is_kosher: boolean | null;
  kosher_for_passover: boolean | null;
  mevushal: boolean | null;
  kosher_certification: string | null;
  kosher_confidence: KosherConfidence | null;
  kosher_source_name: string | null;
  kosher_source_url: string | null;
  kosher_notes: string | null;
}

export const KOSHER_UNKNOWN: KosherResult = {
  is_kosher: null,
  kosher_for_passover: null,
  mevushal: null,
  kosher_certification: null,
  kosher_confidence: null,
  kosher_source_name: null,
  kosher_source_url: null,
  kosher_notes: null,
};

interface KosherProducerRule {
  /** Canonical producer name (for logging / audit) */
  id: string;
  /**
   * All normalized substrings that must appear in the normalized producer name
   * for this rule to match. Matching is substring-based (includes).
   */
  allOf: string[];
  /**
   * Normalized substrings that, if present in the producer name, disqualify
   * the match. Used to exclude partial matches (e.g. "chateau" in "Chateau Margaux").
   */
  noneOf?: string[];
  is_kosher: boolean;
  kosher_for_passover: boolean | null;
  mevushal: boolean | null;
  kosher_certification: string | null;
  confidence: KosherConfidence;
  source_name: string;
  source_url: string | null;
  notes: string | null;
}

// ── Normalization ─────────────────────────────────────────────────────────────

export function normalizeProducerForMatch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')       // strip diacritics
    .toLowerCase()
    .replace(/[''`]/g, '')        // strip apostrophes
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Known certified Kosher producers ─────────────────────────────────────────
//
// Rules are checked in order. First match wins.
// Only add a producer when you are CERTAIN it is certified Kosher.
// Mevushal and KFP flags are best-effort; leave null when not certain.
// Source URLs point to the winery's official site or a reliable registry.

const KOSHER_PRODUCER_RULES: KosherProducerRule[] = [
  // ── Israel: Major certified Kosher wineries ───────────────────────────────
  {
    id: 'golan_heights_winery',
    allOf: ['golan heights'],
    is_kosher: true,
    kosher_for_passover: true,
    mevushal: null,
    kosher_certification: 'Rabanut HaGolan',
    confidence: 'high',
    source_name: 'Golan Heights Winery',
    source_url: 'https://www.golanwines.co.il',
    notes: 'Full range is Kosher. Some Yarden lines are non-Mevushal.',
  },
  {
    id: 'yarden',
    allOf: ['yarden'],
    noneOf: ['garden'],
    is_kosher: true,
    kosher_for_passover: true,
    mevushal: null,
    kosher_certification: 'Rabanut HaGolan',
    confidence: 'high',
    source_name: 'Golan Heights Winery (Yarden)',
    source_url: 'https://www.golanwines.co.il',
    notes: 'Yarden label is the flagship of Golan Heights Winery, fully Kosher.',
  },
  {
    id: 'gamla',
    allOf: ['gamla'],
    is_kosher: true,
    kosher_for_passover: true,
    mevushal: null,
    kosher_certification: 'Rabanut HaGolan',
    confidence: 'high',
    source_name: 'Golan Heights Winery (Gamla)',
    source_url: 'https://www.golanwines.co.il',
    notes: null,
  },
  {
    id: 'carmel_winery',
    allOf: ['carmel'],
    noneOf: ['castel', 'caramel'],
    is_kosher: true,
    kosher_for_passover: true,
    mevushal: null,
    kosher_certification: 'Badatz Mehadrin',
    confidence: 'high',
    source_name: 'Carmel Winery',
    source_url: 'https://www.carmelwines.co.il',
    notes: 'One of Israel\'s largest wineries; fully Kosher across all labels.',
  },
  {
    id: 'barkan',
    allOf: ['barkan'],
    is_kosher: true,
    kosher_for_passover: true,
    mevushal: null,
    kosher_certification: 'Rabanut',
    confidence: 'high',
    source_name: 'Barkan Wine Cellars',
    source_url: 'https://www.barkan-winery.co.il',
    notes: null,
  },
  {
    id: 'recanati',
    allOf: ['recanati'],
    is_kosher: true,
    kosher_for_passover: true,
    mevushal: null,
    kosher_certification: 'Rabanut',
    confidence: 'high',
    source_name: 'Recanati Winery',
    source_url: 'https://www.recanati-winery.com',
    notes: null,
  },
  {
    id: 'galil_mountain',
    allOf: ['galil mountain'],
    is_kosher: true,
    kosher_for_passover: true,
    mevushal: null,
    kosher_certification: 'Rabanut',
    confidence: 'high',
    source_name: 'Galil Mountain Winery',
    source_url: 'https://www.galilmountain.co.il',
    notes: null,
  },
  {
    id: 'dalton',
    allOf: ['dalton'],
    is_kosher: true,
    kosher_for_passover: true,
    mevushal: null,
    kosher_certification: 'Rabanut',
    confidence: 'high',
    source_name: 'Dalton Winery',
    source_url: 'https://www.dalton-winery.com',
    notes: null,
  },
  {
    id: 'psagot',
    allOf: ['psagot'],
    is_kosher: true,
    kosher_for_passover: true,
    mevushal: null,
    kosher_certification: 'Rabanut',
    confidence: 'high',
    source_name: 'Psagot Winery',
    source_url: 'https://www.psagotwine.com',
    notes: null,
  },
  {
    id: 'domaine_du_castel',
    allOf: ['castel'],
    noneOf: ['carmel', 'chateau'],
    is_kosher: true,
    kosher_for_passover: null,
    mevushal: false,
    kosher_certification: 'Rabanut',
    confidence: 'high',
    source_name: 'Domaine du Castel',
    source_url: 'https://www.castel.co.il',
    notes: 'Boutique winery, non-Mevushal. Some vintages may vary.',
  },
  {
    id: 'flam',
    allOf: ['flam'],
    is_kosher: true,
    kosher_for_passover: null,
    mevushal: false,
    kosher_certification: 'Rabanut',
    confidence: 'high',
    source_name: 'Flam Winery',
    source_url: 'https://www.flamwinery.com',
    notes: 'Premium boutique winery, non-Mevushal.',
  },
  {
    id: 'tzuba',
    allOf: ['tzuba'],
    is_kosher: true,
    kosher_for_passover: true,
    mevushal: null,
    kosher_certification: 'Rabanut',
    confidence: 'high',
    source_name: 'Tzuba Winery',
    source_url: 'https://www.tzubawinery.co.il',
    notes: null,
  },
  {
    id: 'netofa',
    allOf: ['netofa'],
    is_kosher: true,
    kosher_for_passover: null,
    mevushal: false,
    kosher_certification: 'Rabanut',
    confidence: 'high',
    source_name: 'Domaine Netofa',
    source_url: null,
    notes: null,
  },
  {
    id: 'tabor',
    allOf: ['tabor'],
    noneOf: ['mt.', 'mount'],
    is_kosher: true,
    kosher_for_passover: true,
    mevushal: null,
    kosher_certification: 'Rabanut',
    confidence: 'high',
    source_name: 'Tabor Winery',
    source_url: 'https://www.taborwinery.co.il',
    notes: null,
  },
  {
    id: 'segal',
    allOf: ['segal'],
    is_kosher: true,
    kosher_for_passover: true,
    mevushal: null,
    kosher_certification: 'Rabanut',
    confidence: 'high',
    source_name: "Segal's Wine",
    source_url: null,
    notes: null,
  },
  {
    id: 'amphora',
    allOf: ['amphora'],
    is_kosher: true,
    kosher_for_passover: null,
    mevushal: null,
    kosher_certification: 'Rabanut',
    confidence: 'med',
    source_name: 'Amphora Winery',
    source_url: null,
    notes: null,
  },

  // ── USA: Certified Kosher wineries ────────────────────────────────────────
  {
    id: 'herzog_wine_cellars',
    allOf: ['herzog'],
    is_kosher: true,
    kosher_for_passover: true,
    mevushal: null,
    kosher_certification: 'OU',
    confidence: 'high',
    source_name: 'Herzog Wine Cellars',
    source_url: 'https://www.herzogwine.com',
    notes: 'California Kosher winery; some wines Mevushal, some not.',
  },
  {
    id: 'covenant_wines',
    allOf: ['covenant'],
    noneOf: ['old'],
    is_kosher: true,
    kosher_for_passover: true,
    mevushal: false,
    kosher_certification: 'KSA',
    confidence: 'high',
    source_name: 'Covenant Wines',
    source_url: 'https://www.covenantwines.com',
    notes: 'Premium Kosher, non-Mevushal. Napa Valley.',
  },
  {
    id: 'hagafen_cellars',
    allOf: ['hagafen'],
    is_kosher: true,
    kosher_for_passover: true,
    mevushal: null,
    kosher_certification: 'OU',
    confidence: 'high',
    source_name: 'Hagafen Cellars',
    source_url: 'https://www.hagafen.com',
    notes: 'Napa Valley Kosher winery.',
  },
  {
    id: 'four_gates',
    allOf: ['four gates'],
    is_kosher: true,
    kosher_for_passover: null,
    mevushal: false,
    kosher_certification: 'KSA',
    confidence: 'high',
    source_name: 'Four Gates Winery',
    source_url: null,
    notes: 'Small-production Kosher, non-Mevushal.',
  },

  // ── Italy: Certified Kosher producers ────────────────────────────────────
  {
    id: 'bartenura',
    allOf: ['bartenura'],
    is_kosher: true,
    kosher_for_passover: true,
    mevushal: true,
    kosher_certification: 'OU',
    confidence: 'high',
    source_name: 'Bartenura',
    source_url: 'https://www.bartenura.com',
    notes: 'Italian Kosher, typically Mevushal Moscato and other styles.',
  },
  {
    id: 'cantina_gabriele',
    allOf: ['cantina gabriele'],
    is_kosher: true,
    kosher_for_passover: null,
    mevushal: null,
    kosher_certification: 'OU',
    confidence: 'med',
    source_name: 'Cantina Gabriele',
    source_url: null,
    notes: null,
  },

  // ── France ────────────────────────────────────────────────────────────────
  // NOTE: Baron Edmond de Rothschild is intentionally excluded.
  // Only specific cuvées in that range are Kosher; producer-level matching
  // would create false positives for the majority of their non-Kosher wines.
  // This should be handled by Perplexity wine-level search in Phase 2.
  //
  // NOTE: Champagne Drappier is intentionally excluded.
  // Drappier is a conventional Champagne house; only one specific cuvée
  // is Kosher. Matching on the producer name alone would incorrectly mark
  // all other Drappier Champagnes as Kosher. Handle via Phase 2 web search.
  {
    id: 'royal_wine',
    allOf: ['royal wine'],
    is_kosher: true,
    kosher_for_passover: null,
    mevushal: null,
    // Downgraded from 'high' to 'med': Royal Wine is primarily an importer/
    // distributor. Wines bearing their name are Kosher, but producer-field
    // ambiguity means we cannot claim source-verified certainty.
    kosher_certification: 'OU',
    confidence: 'med',
    source_name: 'Royal Wine Corp.',
    source_url: 'https://www.royalwine.com',
    notes: 'Major Kosher wine importer/producer. Confidence is med because Royal Wine also acts as a distributor; wine-specific verification is recommended.',
  },
];

// ── Matching engine ──────────────────────────────────────────────────────────

function ruleMatches(rule: KosherProducerRule, normalizedProducer: string): boolean {
  const allMatch = rule.allOf.every((token) => normalizedProducer.includes(token));
  if (!allMatch) return false;
  if (rule.noneOf?.some((token) => normalizedProducer.includes(token))) return false;
  return true;
}

/**
 * Check whether a wine's producer matches a known certified-Kosher producer.
 * Returns the match result or KOSHER_UNKNOWN if no rule matched.
 */
export function detectKosherByProducerRule(
  producer: string,
  wineName?: string | null,
): KosherResult {
  const normalizedProducer = normalizeProducerForMatch(producer);
  const normalizedWineName = wineName ? normalizeProducerForMatch(wineName) : '';
  // Combine producer + wine name for broader matching surface
  const haystack = `${normalizedProducer} ${normalizedWineName}`.trim();

  for (const rule of KOSHER_PRODUCER_RULES) {
    if (ruleMatches(rule, haystack)) {
      return {
        is_kosher: rule.is_kosher,
        kosher_for_passover: rule.kosher_for_passover,
        mevushal: rule.mevushal,
        kosher_certification: rule.kosher_certification,
        kosher_confidence: rule.confidence,
        kosher_source_name: rule.source_name,
        kosher_source_url: rule.source_url,
        kosher_notes: rule.notes,
      };
    }
  }

  return KOSHER_UNKNOWN;
}

/** Wine row fields required by shouldSkipKosherEnrichment. */
export interface KosherEnrichmentState {
  kosher_updated_at?: string | null;
  kosher_confidence?: string | null;
  kosher_enrichment_method?: string | null;
  is_kosher?: boolean | null;
  kosher_source_url?: string | null;
}

/** How many days a Perplexity-null/low result is protected from retry. */
const PERPLEXITY_COOLDOWN_DAYS = 90;

/**
 * Whether a wine row already has reliable Kosher data and should be skipped.
 *
 * Rules evaluated in priority order (first match wins):
 *
 *   ALWAYS SKIP:
 *   1. method = 'manual'
 *      → admin override, immutable
 *   2. is_kosher = true AND confidence = 'high'
 *      → confirmed Kosher at high confidence, regardless of method
 *   3. kosher_source_url IS NOT NULL AND confidence ∈ {med, high}
 *      → source-backed result, already reliable
 *   4. method = 'rule' AND confidence = 'high'
 *      → authoritative deterministic result
 *   5. method = 'perplexity' AND confidence ∈ {med, high}
 *      → already web-searched with useful result
 *   6. method = 'perplexity' AND timestamp within PERPLEXITY_COOLDOWN_DAYS
 *      → Perplexity ran but found nothing; cooldown prevents expensive retries
 *
 *   DO NOT SKIP (eligible for Perplexity enrichment):
 *   - method = 'rule' AND confidence = 'med' → Perplexity upgrade candidate
 *   - method = 'ai'            → Perplexity has not run for this wine yet
 *   - method = null            → never enriched at all
 *   - kosher_updated_at = null → never enriched at all
 *
 *   Note on rule/med: these wines are NEVER skipped. When Perplexity actually
 *   runs for a rule/med wine and returns null/low, the function persists the
 *   result with method='perplexity' (not 'rule'). This activates the 90-day
 *   cooldown (rule 6 above) and prevents repeated expensive searches. Only
 *   if Perplexity was never triggered (no key, no signal, daily limit) is
 *   the result persisted as method='rule'.
 */
export function shouldSkipKosherEnrichment(wine: KosherEnrichmentState): boolean {
  // Never enriched → never skip
  if (!wine.kosher_updated_at) return false;

  const method = wine.kosher_enrichment_method;
  const confidence = wine.kosher_confidence;

  // Rule 1: Admin manual override — immutable
  if (method === 'manual') return true;

  // Rule 2: Confirmed Kosher at high confidence — already best possible result
  if (wine.is_kosher === true && confidence === 'high') return true;

  // Rule 3: Source-backed result at med/high — reliable enough, skip re-enrichment
  if (wine.kosher_source_url && (confidence === 'med' || confidence === 'high')) return true;

  // Rule 4: Deterministic rule at high — authoritative, Perplexity cannot improve
  if (method === 'rule' && confidence === 'high') return true;

  // Rule 5: Perplexity already ran and found useful data (med or high confidence)
  if (method === 'perplexity' && (confidence === 'med' || confidence === 'high')) return true;

  // Rule 6: Perplexity ran but returned null/low — enforce 90-day cooldown to
  // avoid expensive retries on wines with no web-searchable Kosher data.
  if (method === 'perplexity') {
    try {
      const updatedAt = new Date(wine.kosher_updated_at);
      const cooldownCutoff = new Date(Date.now() - PERPLEXITY_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
      if (updatedAt >= cooldownCutoff) return true; // within cooldown window
    } catch {
      // malformed date — do not skip (safe default)
    }
  }

  // Do NOT skip:
  //   method = 'ai'  → Perplexity has not run for this wine
  //   method = null  → never enriched (should not happen with kosher_updated_at set, but guard)
  return false;
}
