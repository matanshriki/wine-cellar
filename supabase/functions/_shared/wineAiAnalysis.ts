/**
 * Shared OpenAI sommelier-analysis prompts for analyze-wine and analyze-cellar.
 * Keeps single-bottle and bulk cellar analysis aligned (same JSON fields + rules).
 */

export type WineAnalysisMode = "single" | "cellar";

export interface WineAnalysisInput {
  wine_name: string;
  producer?: string | null;
  vintage?: number | null;
  region?: string | null;
  country?: string | null;
  appellation?: string | null;
  grapes?: string[] | string | null;
  color?: string | null;
  notes?: string | null;
  /** Loaded from wines.regional_wine_style when available */
  regional_wine_style?: string | null;
  /** Loaded from wines.wine_profile when available (body, tannin, acidity, oak, sweetness, etc.) */
  wine_profile?: {
    body?: number | null;
    tannin?: number | null;
    acidity?: number | null;
    oak?: number | null;
    sweetness?: number | null;
    alcohol_est?: number | null;
    power?: number | null;
    style_tags?: string[] | null;
  } | null;
  /** Vivino community rating 0–5, from wines.rating */
  rating?: number | null;
  /** Vivino wine ID, from wines.vivino_wine_id */
  vivino_wine_id?: string | null;
}

/** Structured serving guidance returned by AI and stored on bottles.serving_guidance */
export interface ServingGuidance {
  temp_min: number;
  temp_max: number;
  /** "recommended" = always decant, "optional" = can benefit, "none" = no decanting */
  decanting: "recommended" | "optional" | "none";
  decant_min: number;
  decant_max: number;
  /** Total minutes the bottle should be open before drinking (includes decant time) */
  open_before_minutes: number;
  glassware: string;
  /** 1-sentence user-facing instruction */
  short_instruction: string;
  /** 1-2 sentence explanation of the why */
  explanation: string;
  confidence: "high" | "medium" | "low";
  source_summary: string;
}

/** Barrel aging metadata stored on wines.barrel_aging_metadata */
export interface BarrelAgingMetadata {
  is_estimated: boolean;
  confidence: "high" | "medium" | "low";
  source: string;
}

export function formatGrapesForPrompt(grapes: WineAnalysisInput["grapes"]): string {
  if (Array.isArray(grapes)) return grapes.join(", ") || "Unknown";
  if (typeof grapes === "string" && grapes.trim()) return grapes.trim();
  return "Unknown";
}

/** Format a stored wine_profile object into a concise human-readable block for the prompt. */
function formatWineProfileForPrompt(profile: WineAnalysisInput["wine_profile"]): string | null {
  if (!profile || typeof profile !== "object") return null;

  const label = (
    val: number | null | undefined,
    scale: [string, string, string, string, string],
  ): string | null => {
    if (val == null) return null;
    const idx = Math.max(0, Math.min(4, Math.round(val) - 1));
    return `${val}/5 (${scale[idx]})`;
  };

  const lines: string[] = [];
  const b = label(profile.body, ["very light", "light", "medium", "full", "very full"]);
  if (b) lines.push(`  Body: ${b}`);
  const t = label(profile.tannin, ["silky/no tannin", "soft", "medium", "firm", "grippy/astringent"]);
  if (t) lines.push(`  Tannin: ${t}`);
  const a = label(profile.acidity, ["low", "medium-low", "medium", "bright", "high/racy"]);
  if (a) lines.push(`  Acidity: ${a}`);
  const o = label(profile.oak, ["none/minimal", "light", "moderate", "strong", "heavy"]);
  if (o) lines.push(`  Oak: ${o}`);
  const s = label(profile.sweetness, ["bone dry", "dry", "off-dry", "medium-sweet", "sweet"]);
  if (s) lines.push(`  Sweetness: ${s}`);
  if (profile.alcohol_est != null) lines.push(`  Estimated alcohol: ${profile.alcohol_est}%`);
  if (Array.isArray(profile.style_tags) && profile.style_tags.length) {
    lines.push(`  Style tags: ${profile.style_tags.join(", ")}`);
  }

  return lines.length ? lines.join("\n") : null;
}

const READINESS_RULES = `READINESS LABEL RULES — follow strictly based on the wine's actual age and structure:
- "HOLD": Wine is too young; tannins and structure need time. Typically reds under 5 years, structured whites under 2 years.
- "PEAK_SOON": Wine is approaching but has not yet reached its optimal window; generally 5–15 years for most quality reds.
- "READY": Wine is in its drinking window now. ANY wine 15 years or older must use "READY". For wines 30+ years old, ALWAYS use "READY" — they are at peak or already declining and should be consumed soon. NEVER assign "HOLD" or "PEAK_SOON" to a wine that is over 20 years old. Mention explicitly in the summary whether the wine is at its peak or may be past it.
- If wine_profile is provided: tannin score 4–5 and age < 5 years → strongly prefer "HOLD"; tannin score 1–2 → prefer "READY" or "PEAK_SOON" even at moderate age; this overrides the default age thresholds when structure data is available.
- If vintage is unknown (NV or missing): do NOT assume the wine is young. Set readiness to "READY" unless the wine style is known to require significant aging (e.g., young Vintage Port, Barolo Riserva with no age data). Use confidence "LOW".`;

const BARREL_RULES = `BARREL / OAK (wine-level, for catalog + user preference learning):
- For most quality RED wines and many structured whites, you MUST provide your best estimate (do not leave both fields null unless the wine is almost always unoaked in that region/style, e.g. many crisp whites).
- barrel_aging_note: Short phrase (max ~200 chars) describing typical barrel regimen (e.g. "≈12–18 months American/French oak"). If genuinely no oak is typical, say "Typically little or no oak" and set months to 0.
- barrel_aging_months_est: Integer — total months in oak/barrel you judge typical for this producer/style (0 = unoaked). Only use null if you have no reasonable basis at all.
- barrel_aging_confidence: "high" if you have reliable producer/regional knowledge, "medium" if typical for the style, "low" if genuinely uncertain.
- barrel_aging_source: Short description of where the estimate comes from, e.g. "producer technical sheet", "regional style norm", "AI general knowledge".
- These are ESTIMATES from general knowledge, not guaranteed facts for this bottle.`;

const SERVING_RULES = `SERVING GUIDANCE — generate accurate, wine-specific serving instructions. This is NOT a generic recommendation.

Use the wine's actual type, age, structure, producer, and region:

TEMPERATURE:
- Sparkling (Champagne, Prosecco, Cava): 6–9°C
- Sweet/dessert white (Sauternes, TBA, late harvest): 6–10°C
- Crisp dry white (Sauvignon Blanc, Pinot Grigio, Riesling): 8–11°C
- Full-bodied white (aged Burgundy, Viognier, oaked Chardonnay): 10–13°C
- Rosé: 8–12°C
- Light red (Pinot Noir, Gamay, Schiava): 13–15°C
- Medium red (Sangiovese, Tempranillo, Merlot-dominant): 15–17°C
- Full-bodied/tannic red (Cabernet Sauvignon, Barolo, Aglianico, Amarone, Syrah): 16–18°C
- Fortified (Port, Sherry, Madeira): varies 6–18°C by style

DECANTING (use "recommended", "optional", or "none"):
- Young, tannic, full-bodied reds (< 8 years): "recommended", 60–120 min
- Medium-age structured reds (8–15 years): "recommended", 30–60 min
- Mature reds (15–25 years): "optional", 15–30 min — handle carefully, no aggressive decanting
- Very old reds (> 25 years): "optional", 10–20 min — stand upright 24h first; sediment risk
- Light reds: "optional", 10–20 min
- Whites and rosés: "none" (or "optional" only if reductive/closed)
- Sparkling: "none"
- Dessert wines: "none"

OPEN_BEFORE_MINUTES: total lead time to open bottle before drinking (0 = open and serve immediately)

GLASSWARE: recommend a specific glass type appropriate for the wine

SHORT_INSTRUCTION: 1 sentence the user reads at the moment of opening (e.g. "Decant for 90 minutes before serving.")
EXPLANATION: 1–2 sentences explaining WHY — mention the specific wine's structure, age, or style

CONFIDENCE:
- "high": you have reliable producer/regional knowledge for this exact wine
- "medium": typical for the style/region/age with reasonable certainty
- "low": missing vintage or limited knowledge; using style-based reasoning

SOURCE_SUMMARY: brief note on the basis (e.g. "Based on Barolo DOCG typical aging; Nebbiolo tannin profile for a 3-year-old wine.")

WHEN WINE STRUCTURE DATA IS PROVIDED (wine_profile fields above):
- Calibrate decanting by tannin score: score 4–5 and age < 6 years → 90–120 min recommended; score 1–2 → 10–20 min optional at most even for reds
- Calibrate serving temperature by body: score 4–5 → use the warmer end of the range; score 1–2 → use the cooler end
- Alcohol ≥ 14.5%: serve 1–2°C cooler within the range so the wine does not taste hot
- Heavy oak (score 4–5) in a young wine: recommend extra airing before serving
- Aged white wine (color = white, age ≥ 10 years): serve at 12–15°C — cold (8°C) suppresses aromatic complexity in aged whites
- NV or vintage-unknown wine: base guidance on color, regional_wine_style, and style_tags only; never assume the wine is young; set confidence to "low" unless the wine style clearly implies readiness (e.g. most Prosecco, Champagne NV)`;

export function buildWineAnalysisSystemPrompt(
  mode: WineAnalysisMode,
  language: string,
): string {
  const languageInstruction = language === "he"
    ? "CRITICAL: You MUST write ALL text fields in HEBREW (עברית). The analysis_summary, analysis_reasons, barrel_aging_note (if not null), assumptions, and ALL serving guidance text fields must be in Hebrew."
    : "Write all text fields in English.";

  const heBlock = mode === "single"
    ? `
  "he_translations": {
    "wine_name": "Hebrew transliteration of the wine name",
    "producer": "Hebrew transliteration of the producer name",
    "region": "Hebrew name of the region (e.g. Bordeaux → בורדו)",
    "country": "Hebrew name of the country (e.g. France → צרפת)",
    "appellation": "Hebrew transliteration of the appellation or null",
    "grapes": ["Hebrew names of grape varieties"]
  }`
    : "";

  const heInstruction = mode === "single"
    ? `- ALWAYS include the "he_translations" object with Hebrew transliterations/translations of the wine metadata. Use standard Hebrew wine terminology. For proper nouns (wine names, producers), provide the commonly used Hebrew transliteration. For geographic names and grape varieties, use the standard Hebrew equivalents.`
    : `- Do NOT include "he_translations" in your JSON (bulk analysis; omit the key entirely).`;

  return `You are an expert sommelier analyzing wines. You MUST respond with valid JSON only, using this exact structure:

{
  "analysis_summary": "2-3 sentence sommelier note",
  "analysis_reasons": ["bullet 1", "bullet 2", "bullet 3"],
  "readiness_label": "READY" | "HOLD" | "PEAK_SOON",
  "serving_temp_c": number,
  "decant_minutes": number,
  "drink_window_start": number | null,
  "drink_window_end": number | null,
  "confidence": "LOW" | "MEDIUM" | "HIGH",
  "assumptions": "string or null",
  "barrel_aging_note": "string or null",
  "barrel_aging_months_est": number | null,
  "barrel_aging_confidence": "high" | "medium" | "low" | null,
  "barrel_aging_source": "string or null",
  "serving": {
    "temp_min": number,
    "temp_max": number,
    "decanting": "recommended" | "optional" | "none",
    "decant_min": number,
    "decant_max": number,
    "open_before_minutes": number,
    "glassware": "string",
    "short_instruction": "string",
    "explanation": "string",
    "confidence": "high" | "medium" | "low",
    "source_summary": "string"
  }${mode === "single" ? "," : ""}${heBlock}
}

IMPORTANT:
- Reference the SPECIFIC wine details (producer, region, vintage) in your analysis
- Do NOT use generic template language
- If data is missing, lower confidence and mention assumptions
- Analysis must be unique per bottle
- serving_temp_c must equal serving.temp_min (kept for backward compatibility)
- decant_minutes must equal serving.decant_min (kept for backward compatibility)
- ${languageInstruction}
${heInstruction}

${READINESS_RULES}

${BARREL_RULES}

${SERVING_RULES}`;
}

export function buildWineAnalysisUserPrompt(
  wine: WineAnalysisInput,
  currentYear: number,
  language: string,
  mode: WineAnalysisMode,
): string {
  const age = wine.vintage != null ? currentYear - wine.vintage : null;
  const grapes = formatGrapesForPrompt(wine.grapes);
  const profileText = formatWineProfileForPrompt(wine.wine_profile);

  const heSuffix = mode === "single"
    ? " כתוב הכל בעברית. הוסף גם תרגומים לעברית בשדה he_translations."
    : "";

  if (language === "he") {
    const heProfileSection = profileText
      ? `\nמבנה היין (פרופיל מאוחסן):\n${profileText}`
      : "";
    const heStyleSection = wine.regional_wine_style
      ? `\nסיווג סגנון: ${wine.regional_wine_style}`
      : "";
    const heRatingSection = wine.rating != null
      ? `\nדירוג קהילת Vivino: ${wine.rating}/5`
      : "";

    return `נתח את היין הזה וספק הערות סומלייה:

שם היין: ${wine.wine_name}
יצרן: ${wine.producer ?? "לא ידוע"}
בציר: ${wine.vintage ?? "ללא בציר"}
גיל: ${age != null ? `${age} שנים` : "לא ידוע"}
אזור: ${wine.region ?? "לא ידוע"}
מדינה: ${wine.country ?? "לא ידוע"}
אפלסיון: ${wine.appellation ?? "לא ידוע"}
ענבים: ${grapes}
סגנון: ${wine.color ?? "לא ידוע"}
הערות משתמש: ${wine.notes?.trim() ? wine.notes : "אין"}${heProfileSection}${heStyleSection}${heRatingSection}

שנה נוכחית: ${currentYear}

ספק ניתוח מפורט וספציפי לבקבוק. התייחס ליצרן, לאזור ולבציר האמיתיים בסיכום שלך. אל תיתן עצות גנריות. אם סופק פרופיל מבנה יין, השתמש בנתוני טאנינים, גוף ואלכוהול כדי לכייל את הנחיות ההגשה. אם היין הוא בן 20 שנה ומעלה, דון במפורש האם הוא בשיאו, עבר את שיאו, או עדיין מפתיע בחיוניותו — והגדר את readiness_label כ-"READY".${heSuffix}`;
  }

  const profileSection = profileText
    ? `\nWine Structure (stored profile):\n${profileText}`
    : "";
  const styleSection = wine.regional_wine_style
    ? `\nWine Style Classification: ${wine.regional_wine_style}`
    : "";
  const ratingSection = wine.rating != null
    ? `\nVivino Community Rating: ${wine.rating}/5 (use as a quality/popularity signal, not as the sole quality source)`
    : "";

  return `Analyze this wine and provide sommelier notes:

Wine Name: ${wine.wine_name}
Producer: ${wine.producer ?? "Unknown"}
Vintage: ${wine.vintage ?? "NV"}
Age: ${age != null ? `${age} years` : "Unknown — do not assume the wine is young"}
Region: ${wine.region ?? "Unknown"}
Country: ${wine.country ?? "Unknown"}
Appellation: ${wine.appellation ?? "Unknown"}
Grapes: ${grapes}
Style: ${wine.color ?? "Unknown"}
User Notes: ${wine.notes?.trim() ? wine.notes : "None"}${profileSection}${styleSection}${ratingSection}

Current Year: ${currentYear}

Provide a detailed, bottle-specific analysis. Reference the actual producer, region, and vintage in your summary. Do not give generic advice. If wine structure data is provided above, use tannin, body, oak, and alcohol values to calibrate decant time and serving temperature — do not ignore them. Pay close attention to the wine's age: young tannic reds need longer decanting than mature or delicate wines; very old reds need gentle, brief handling. If the wine is 20+ years old, explicitly discuss whether it is at its peak, past its prime, or still surprisingly vibrant — and set readiness_label to "READY".${mode === "single" ? " Also include Hebrew translations in he_translations." : ""}`;
}

/** Normalize OpenAI barrel fields for DB + API */
export function normalizeBarrelFields<T extends Record<string, unknown>>(a: T): T {
  const rawNote = a.barrel_aging_note;
  let note: string | null = null;
  if (typeof rawNote === "string" && rawNote.trim()) {
    note = rawNote.trim().slice(0, 2000);
  }

  const rawMonths = a.barrel_aging_months_est;
  let months: number | null = null;
  if (typeof rawMonths === "number" && Number.isFinite(rawMonths)) {
    months = Math.round(rawMonths);
  } else if (typeof rawMonths === "string" && rawMonths.trim()) {
    const p = parseInt(rawMonths.trim(), 10);
    if (!Number.isNaN(p)) months = p;
  }
  if (months !== null && (months < 0 || months > 240)) {
    months = null;
  }

  (a as Record<string, unknown>).barrel_aging_note = note;
  (a as Record<string, unknown>).barrel_aging_months_est = months;

  // Normalize barrel metadata
  const rawConf = a.barrel_aging_confidence;
  const validConf = ["high", "medium", "low"];
  const barrelConf = typeof rawConf === "string" && validConf.includes(rawConf) ? rawConf : "medium";

  const rawSrc = a.barrel_aging_source;
  const barrelSrc = typeof rawSrc === "string" && rawSrc.trim() ? rawSrc.trim().slice(0, 500) : "AI general knowledge";

  const barrelMeta: BarrelAgingMetadata = {
    is_estimated: true,
    confidence: barrelConf as "high" | "medium" | "low",
    source: barrelSrc,
  };
  (a as Record<string, unknown>).barrel_aging_metadata = barrelMeta;

  return a;
}

/** Validate and normalize a serving guidance object from OpenAI response */
export function normalizeServingGuidance(raw: unknown): ServingGuidance | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;

  const tempMin = typeof s.temp_min === "number" && Number.isFinite(s.temp_min) ? s.temp_min : null;
  const tempMax = typeof s.temp_max === "number" && Number.isFinite(s.temp_max) ? s.temp_max : null;
  if (tempMin === null || tempMax === null) return null;

  const validDecanting = ["recommended", "optional", "none"];
  const decanting = typeof s.decanting === "string" && validDecanting.includes(s.decanting)
    ? (s.decanting as "recommended" | "optional" | "none")
    : "optional";

  const decantMin = typeof s.decant_min === "number" && Number.isFinite(s.decant_min) ? Math.max(0, s.decant_min) : 0;
  const decantMax = typeof s.decant_max === "number" && Number.isFinite(s.decant_max) ? Math.max(0, s.decant_max) : decantMin;
  const openBefore = typeof s.open_before_minutes === "number" && Number.isFinite(s.open_before_minutes)
    ? Math.max(0, s.open_before_minutes)
    : decantMax;

  const glassware = typeof s.glassware === "string" && s.glassware.trim() ? s.glassware.trim().slice(0, 200) : "standard wine glass";
  const shortInstruction = typeof s.short_instruction === "string" && s.short_instruction.trim()
    ? s.short_instruction.trim().slice(0, 500)
    : "";
  const explanation = typeof s.explanation === "string" && s.explanation.trim()
    ? s.explanation.trim().slice(0, 1000)
    : "";

  const validConf = ["high", "medium", "low"];
  const confidence = typeof s.confidence === "string" && validConf.includes(s.confidence)
    ? (s.confidence as "high" | "medium" | "low")
    : "medium";

  const sourceSummary = typeof s.source_summary === "string" && s.source_summary.trim()
    ? s.source_summary.trim().slice(0, 500)
    : "AI sommelier analysis";

  return {
    temp_min: tempMin,
    temp_max: tempMax,
    decanting,
    decant_min: decantMin,
    decant_max: decantMax,
    open_before_minutes: openBefore,
    glassware,
    short_instruction: shortInstruction,
    explanation,
    confidence,
    source_summary: sourceSummary,
  };
}

/**
 * Fallback serving guidance when AI is unavailable or returns incomplete data.
 * Based on wine color and age (vintage year).
 */
export function buildFallbackServingGuidance(
  color: string | null | undefined,
  vintage: number | null | undefined,
  currentYear: number,
  readinessLabel?: string,
): ServingGuidance {
  const c = (color ?? "red").toLowerCase();
  const age = vintage != null ? currentYear - vintage : null;

  if (c === "sparkling") {
    return {
      temp_min: 6, temp_max: 9,
      decanting: "none", decant_min: 0, decant_max: 0,
      open_before_minutes: 0,
      glassware: "Champagne flute or tulip glass",
      short_instruction: "Serve well chilled immediately after opening.",
      explanation: "Sparkling wines are served cold to preserve bubbles and freshness.",
      confidence: "high", source_summary: "Standard sparkling wine serving protocol.",
    };
  }

  if (c === "white") {
    return {
      temp_min: 8, temp_max: 12,
      decanting: "none", decant_min: 0, decant_max: 0,
      open_before_minutes: 0,
      glassware: "White wine glass",
      short_instruction: "Serve chilled directly from the fridge.",
      explanation: "White wines are served cold to highlight acidity and freshness.",
      confidence: "medium", source_summary: "Standard white wine serving protocol.",
    };
  }

  if (c === "rose" || c === "rosé") {
    return {
      temp_min: 8, temp_max: 12,
      decanting: "none", decant_min: 0, decant_max: 0,
      open_before_minutes: 0,
      glassware: "White or rosé wine glass",
      short_instruction: "Serve well chilled.",
      explanation: "Rosé is best enjoyed cold to preserve its delicate fruit character.",
      confidence: "high", source_summary: "Standard rosé serving protocol.",
    };
  }

  // Red wine — use age to determine guidance
  if (age !== null && age > 25) {
    return {
      temp_min: 16, temp_max: 17,
      decanting: "optional", decant_min: 10, decant_max: 20,
      open_before_minutes: 30,
      glassware: "Large Burgundy or Bordeaux glass",
      short_instruction: "Stand upright for 24 hours, open gently, and decant briefly only if needed.",
      explanation: "Very old wines are fragile — excessive oxygen can cause them to fade quickly. Brief decanting separates sediment.",
      confidence: "medium", source_summary: "Fallback for wines over 25 years old.",
    };
  }

  if (age !== null && age > 15) {
    return {
      temp_min: 16, temp_max: 17,
      decanting: "optional", decant_min: 15, decant_max: 30,
      open_before_minutes: 30,
      glassware: "Large red wine glass",
      short_instruction: "Open 30 minutes before serving. Decant briefly if sediment is present.",
      explanation: "Mature reds have integrated tannins and benefit from careful handling rather than aggressive airing.",
      confidence: "medium", source_summary: "Fallback for mature reds (15–25 years).",
    };
  }

  if (age !== null && age > 8) {
    return {
      temp_min: 16, temp_max: 18,
      decanting: "recommended", decant_min: 30, decant_max: 60,
      open_before_minutes: 60,
      glassware: "Large red wine glass",
      short_instruction: "Open 1 hour before serving and decant for 30–60 minutes.",
      explanation: "This red is approaching maturity and benefits from moderate aeration to open up.",
      confidence: "medium", source_summary: "Fallback for medium-age reds (8–15 years).",
    };
  }

  if (readinessLabel === "HOLD") {
    return {
      temp_min: 16, temp_max: 18,
      decanting: "recommended", decant_min: 60, decant_max: 120,
      open_before_minutes: 90,
      glassware: "Large Bordeaux or Burgundy glass",
      short_instruction: "Open 90 minutes before serving and decant for at least 1 hour.",
      explanation: "This is a young, structured red that needs extended airing to soften its tannins.",
      confidence: "medium", source_summary: "Fallback for young tannic reds.",
    };
  }

  return {
    temp_min: 16, temp_max: 18,
    decanting: "recommended", decant_min: 30, decant_max: 60,
    open_before_minutes: 45,
    glassware: "Large red wine glass",
    short_instruction: "Open 45 minutes before serving.",
    explanation: "Red wines generally benefit from some aeration before serving.",
    confidence: "low", source_summary: "Generic fallback — AI serving guidance was unavailable; based on wine color only.",
  };
}
