/**
 * Internal wine metadata enrichment (rule-based, no LLM).
 * Single source of truth: imported by Edge Functions and (via Vite alias) the web app.
 *
 * Conservative: fills missing/generic grapes, or replaces when suspicion + matching rule.
 */

export const WINE_METADATA_ENRICHMENT_VERSION = "2026-03-v1";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WineColor = "red" | "white" | "rose" | "sparkling";

export type WineEnrichmentRow = {
  producer: string;
  wine_name: string;
  vintage?: number | null;
  country?: string | null;
  region?: string | null;
  appellation?: string | null;
  regional_wine_style?: string | null;
  color?: string | null;
  grapes?: unknown;
  entry_source?: string | null;
};

export type EnrichmentPlan = {
  hasUpdates: boolean;
  updates: {
    grapes?: string[];
    regional_wine_style?: string;
  };
  matchedRuleId: string | null;
  confidence: number;
  suspicion: { flagged: boolean; reasons: string[]; fixTags: string[] };
  logLines: string[];
};

type InferenceRule = {
  id: string;
  /** Lower = evaluated first (more specific rules should win). */
  priority: number;
  /** At least one normalized substring must appear in haystack. */
  anyOf: string[];
  /** If set, every entry must appear in haystack. */
  allOf?: string[];
  /** Empty = any color */
  colors: WineColor[];
  grapes: string[];
  /** Suggested regional_wine_style when current is empty */
  style?: string;
  confidence: number;
  /** Suspicion fix tags this rule can resolve (replace bad grapes). */
  fixTags: string[];
};

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

export function normalizeForMatch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function parseGrapesField(grapes: unknown): string[] {
  if (grapes == null) return [];
  if (Array.isArray(grapes)) {
    return grapes.map((x) => String(x).trim()).filter(Boolean);
  }
  if (typeof grapes === "string") {
    const t = grapes.trim();
    if (!t) return [];
    try {
      const j = JSON.parse(t);
      if (Array.isArray(j)) return j.map((x) => String(x).trim()).filter(Boolean);
    } catch {
      /* not JSON */
    }
    return t.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

export function buildWineEnrichmentHaystack(w: WineEnrichmentRow): string {
  const parts = [
    w.country,
    w.region,
    w.appellation,
    w.regional_wine_style,
    w.wine_name,
    w.producer,
  ].filter(Boolean) as string[];
  return normalizeForMatch(parts.join(" "));
}

function normalizeWineColor(raw: string | null | undefined): WineColor {
  const c = (raw || "red").toLowerCase();
  if (c === "white" || c === "rose" || c === "sparkling") return c;
  return "red";
}

const GENERIC_GRAPE_TOKENS = new Set([
  "red blend",
  "white blend",
  "blend",
  "other",
  "mixed",
  "mixed blend",
  "table wine",
  "wine",
  "red",
  "white",
  "varietal",
]);

export function isOnlyGenericGrapes(grapes: string[]): boolean {
  if (grapes.length === 0) return true;
  return grapes.every((g) => GENERIC_GRAPE_TOKENS.has(normalizeForMatch(g)));
}

// ---------------------------------------------------------------------------
// Suspicion: grape vs geography (internal diagnostics)
// ---------------------------------------------------------------------------

const GRAPE_NORM = {
  aglianico: "aglianico",
  nebbiolo: "nebbiolo",
  sangiovese: "sangiovese",
  primitivo: "primitivo",
  negroamaro: "negroamaro",
  barbera: "barbera",
  dolcetto: "dolcetto",
  montepulciano: "montepulciano",
  corvina: "corvina",
  tempranillo: "tempranillo",
  grenache: "grenache",
  garnacha: "grenache",
  syrah: "syrah",
  shiraz: "syrah",
  cabernet: "cabernet sauvignon",
  "cabernet sauvignon": "cabernet sauvignon",
  merlot: "merlot",
  "pinot grigio": "pinot grigio",
  "pinot gris": "pinot grigio",
} as Record<string, string>;

function canonicalGrapeName(g: string): string {
  const n = normalizeForMatch(g);
  return GRAPE_NORM[n] ?? n;
}

function grapeSet(grapes: string[]): Set<string> {
  return new Set(grapes.map(canonicalGrapeName));
}

const BDX_MARKERS = [
  "bordeaux",
  "cotes de bourg",
  "côte de bourg",
  "medoc",
  "médoc",
  "haut-medoc",
  "haut médoc",
  "graves",
  "pessac",
  "saint-emilion",
  "st emilion",
  "saint emilion",
  "pomerol",
  "margaux",
  "pauillac",
  "saint-julien",
  "st julien",
  "saint julien",
  "lalande",
  "pessac-leognan",
  "blaye",
  "entre-deux-mers",
];

const RIOJA_MARKERS = ["rioja"];
const BAROLO_MARKERS = ["barolo"];
const NAPA_MARKERS = ["napa"];

const SOUTHERN_ITALY_VARIETIES = new Set([
  "aglianico",
  "primitivo",
  "negroamaro",
  "nero d'avola",
  "nero davola",
]);

function haystackHasAny(haystack: string, markers: string[]): boolean {
  return markers.some((m) => haystack.includes(normalizeForMatch(m)));
}

export type EnrichmentBackfillFilterMode =
  | "candidates"
  | "missing_grapes"
  | "suspicious";

/**
 * Whether this row is worth running the planner on (reduces work for paged backfill).
 */
export function rowNeedsEnrichmentAttention(
  wine: WineEnrichmentRow,
  filterMode: EnrichmentBackfillFilterMode,
): boolean {
  const grapes = parseGrapesField(wine.grapes);
  const color = normalizeWineColor(wine.color);
  const haystack = buildWineEnrichmentHaystack(wine);
  const suspicion = detectSuspiciousGrapes(haystack, grapes, color);
  if (filterMode === "suspicious") return suspicion.flagged;
  if (filterMode === "missing_grapes") {
    return grapes.length === 0 || isOnlyGenericGrapes(grapes);
  }
  return (
    suspicion.flagged ||
    grapes.length === 0 ||
    isOnlyGenericGrapes(grapes)
  );
}

export function detectSuspiciousGrapes(
  haystack: string,
  grapes: string[],
  color: WineColor,
): { flagged: boolean; reasons: string[]; fixTags: string[] } {
  const reasons: string[] = [];
  const fixTags: string[] = [];
  const gset = grapeSet(grapes);
  if (gset.size === 0) {
    return { flagged: false, reasons: [], fixTags: [] };
  }

  const isRedLike = color === "red" || color === "rose";

  if (isRedLike && haystackHasAny(haystack, BDX_MARKERS)) {
    for (const g of gset) {
      if (
        g === "aglianico" ||
        g === "nebbiolo" ||
        g === "sangiovese" ||
        SOUTHERN_ITALY_VARIETIES.has(g)
      ) {
        reasons.push(
          `Grape "${g}" is implausible for Bordeaux / Gironde appellations`,
        );
        fixTags.push("bordeaux_red");
        break;
      }
    }
  }

  if (isRedLike && haystackHasAny(haystack, RIOJA_MARKERS)) {
    for (const g of gset) {
      if (g === "nebbiolo" || g === "aglianico") {
        reasons.push(`Grape "${g}" is implausible for Rioja`);
        fixTags.push("rioja_red");
        break;
      }
    }
  }

  if (isRedLike && haystackHasAny(haystack, NAPA_MARKERS)) {
    for (const g of gset) {
      if (g === "sangiovese" || g === "nebbiolo" || g === "aglianico") {
        reasons.push(`Grape "${g}" is unusual for Napa red (possible mislabel)`);
        fixTags.push("napa_red");
        break;
      }
    }
  }

  if (isRedLike && haystackHasAny(haystack, BAROLO_MARKERS)) {
    for (const g of gset) {
      if (g === "tempranillo" || g === "grenache" || g === "syrah" || g === "merlot") {
        reasons.push(`Grape "${g}" is implausible for Barolo (Nebbiolo zone)`);
        fixTags.push("barolo");
        break;
      }
    }
  }

  const flagged = reasons.length > 0;
  return { flagged, reasons, fixTags: [...new Set(fixTags)] };
}

// ---------------------------------------------------------------------------
// Rule table (extend by adding objects — keep sorted by priority)
// ---------------------------------------------------------------------------

const INFERENCE_RULES: InferenceRule[] = [
  {
    id: "barolo_nebbiolo",
    priority: 10,
    anyOf: ["barolo"],
    colors: ["red"],
    grapes: ["Nebbiolo"],
    style: "Barolo",
    confidence: 0.95,
    fixTags: ["barolo"],
  },
  {
    id: "barbaresco_nebbiolo",
    priority: 11,
    anyOf: ["barbaresco"],
    colors: ["red"],
    grapes: ["Nebbiolo"],
    style: "Barbaresco",
    confidence: 0.95,
    fixTags: [],
  },
  {
    id: "brunello_sangiovese",
    priority: 12,
    anyOf: ["brunello", "montalcino"],
    colors: ["red"],
    grapes: ["Sangiovese"],
    style: "Brunello di Montalcino",
    confidence: 0.94,
    fixTags: [],
  },
  {
    id: "chianti_sangiovese",
    priority: 15,
    anyOf: ["chianti"],
    colors: ["red"],
    grapes: ["Sangiovese"],
    style: "Chianti",
    confidence: 0.88,
    fixTags: [],
  },
  {
    id: "amarone_corvina_blend",
    priority: 16,
    anyOf: ["amarone"],
    colors: ["red"],
    grapes: ["Corvina", "Rondinella", "Molinara"],
    style: "Amarone della Valpolicella",
    confidence: 0.9,
    fixTags: [],
  },
  {
    id: "valpolicella_ripasso_style",
    priority: 17,
    anyOf: ["valpolicella"],
    allOf: [],
    colors: ["red"],
    grapes: ["Corvina", "Rondinella", "Molinara"],
    style: "Valpolicella",
    confidence: 0.78,
    fixTags: [],
  },
  {
    id: "rioja_tempranillo_blend",
    priority: 20,
    anyOf: ["rioja"],
    colors: ["red", "rose"],
    grapes: ["Tempranillo", "Garnacha", "Graciano"],
    style: "Rioja",
    confidence: 0.9,
    fixTags: ["rioja_red"],
  },
  {
    id: "bordeaux_red_blend",
    priority: 25,
    anyOf: BDX_MARKERS,
    colors: ["red", "rose"],
    grapes: ["Merlot", "Cabernet Sauvignon", "Cabernet Franc"],
    style: "Bordeaux blend",
    confidence: 0.88,
    fixTags: ["bordeaux_red"],
  },
  {
    id: "southern_rhone_gsm",
    priority: 30,
    anyOf: [
      "chateauneuf",
      "châteauneuf",
      "gigondas",
      "vacqueyras",
      "lirac",
      "southern rhone",
      "southern rhône",
      "cotes du rhone",
      "côtes du rhône",
      "cotes du rhône",
    ],
    colors: ["red", "rose"],
    grapes: ["Grenache", "Syrah", "Mourvèdre"],
    style: "Southern Rhône blend",
    confidence: 0.82,
    fixTags: [],
  },
  {
    id: "northern_rhone_syrah",
    priority: 28,
    anyOf: ["hermitage", "cote rotie", "côte rôtie", "cornas", "northern rhone", "northern rhône", "st joseph", "saint-joseph", "crozes-hermitage"],
    colors: ["red"],
    grapes: ["Syrah"],
    style: "Northern Rhône Syrah",
    confidence: 0.9,
    fixTags: [],
  },
  {
    id: "napa_cab_blend",
    priority: 40,
    anyOf: ["napa"],
    colors: ["red"],
    grapes: ["Cabernet Sauvignon", "Merlot", "Cabernet Franc", "Petit Verdot"],
    style: "Napa Valley red",
    confidence: 0.72,
    fixTags: ["napa_red"],
  },
];

function ruleMatches(rule: InferenceRule, haystack: string, color: WineColor): boolean {
  if (rule.colors.length && !rule.colors.includes(color)) return false;
  const anyOk = rule.anyOf.some((k) => haystack.includes(normalizeForMatch(k)));
  if (!anyOk) return false;
  if (rule.allOf?.length) {
    const allOk = rule.allOf.every((k) => haystack.includes(normalizeForMatch(k)));
    if (!allOk) return false;
  }
  return true;
}

function canFixWithRule(
  suspicion: { flagged: boolean; fixTags: string[] },
  rule: InferenceRule,
): boolean {
  if (!suspicion.flagged) return false;
  if (!suspicion.fixTags.length) return false;
  return suspicion.fixTags.some((t) => rule.fixTags.includes(t));
}

const MIN_CONFIDENCE_FILL = 0.65;
const MIN_CONFIDENCE_FIX = 0.72;

/**
 * Compute which wine fields would change (pure function — no I/O).
 */
export function planWineMetadataEnrichment(wine: WineEnrichmentRow): EnrichmentPlan {
  const logLines: string[] = [];
  const haystack = buildWineEnrichmentHaystack(wine);
  const color = normalizeWineColor(wine.color);
  const grapes = parseGrapesField(wine.grapes);
  const suspicion = detectSuspiciousGrapes(haystack, grapes, color);

  if (suspicion.flagged) {
    logLines.push(`[wineEnrichment] Suspicion: ${suspicion.reasons.join("; ")}`);
  }

  const missingOrGeneric = grapes.length === 0 || isOnlyGenericGrapes(grapes);

  const sorted = [...INFERENCE_RULES].sort((a, b) => a.priority - b.priority);

  let matched: InferenceRule | null = null;
  let mode: "fill" | "fix" | null = null;

  for (const rule of sorted) {
    if (!ruleMatches(rule, haystack, color)) continue;

    if (missingOrGeneric && rule.confidence >= MIN_CONFIDENCE_FILL) {
      matched = rule;
      mode = "fill";
      break;
    }
    if (
      canFixWithRule(suspicion, rule) &&
      rule.confidence >= MIN_CONFIDENCE_FIX
    ) {
      matched = rule;
      mode = "fix";
      break;
    }
  }

  if (!matched || !mode) {
    return {
      hasUpdates: false,
      updates: {},
      matchedRuleId: null,
      confidence: 0,
      suspicion,
      logLines,
    };
  }

  const updates: EnrichmentPlan["updates"] = {};

  const grapesEqual =
    grapes.length === matched.grapes.length &&
    grapeSet(grapes).size === matched.grapes.length &&
    matched.grapes.every((g) => grapeSet(grapes).has(canonicalGrapeName(g)));

  if (!grapesEqual) {
    updates.grapes = [...matched.grapes];
    logLines.push(
      `[wineEnrichment] ${mode === "fix" ? "Replace" : "Set"} grapes via rule "${matched.id}" (confidence ${matched.confidence})`,
    );
  }

  const styleEmpty = !(wine.regional_wine_style || "").trim();
  if (styleEmpty && matched.style) {
    updates.regional_wine_style = matched.style;
    logLines.push(`[wineEnrichment] Set regional_wine_style="${matched.style}"`);
  }

  const hasUpdates = Object.keys(updates).length > 0;
  if (hasUpdates) {
    logLines.push(`[wineEnrichment] version=${WINE_METADATA_ENRICHMENT_VERSION} mode=${mode}`);
  }

  return {
    hasUpdates,
    updates,
    matchedRuleId: matched.id,
    confidence: matched.confidence,
    suspicion,
    logLines,
  };
}

/**
 * Shallow normalize string fields on a wine-shaped object (for display / matching).
 */
export function normalizeWineMetadataStrings(w: WineEnrichmentRow): WineEnrichmentRow {
  return {
    ...w,
    producer: (w.producer || "").trim(),
    wine_name: (w.wine_name || "").trim(),
    country: w.country?.trim() || null,
    region: w.region?.trim() || null,
    appellation: w.appellation?.trim() || null,
    regional_wine_style: w.regional_wine_style?.trim() || null,
  };
}
