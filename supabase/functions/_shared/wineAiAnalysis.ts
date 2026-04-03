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
}

export function formatGrapesForPrompt(grapes: WineAnalysisInput["grapes"]): string {
  if (Array.isArray(grapes)) return grapes.join(", ") || "Unknown";
  if (typeof grapes === "string" && grapes.trim()) return grapes.trim();
  return "Unknown";
}

const READINESS_RULES = `READINESS LABEL RULES — follow strictly based on the wine's actual age:
- "HOLD": Wine is too young; tannins and structure need time. Typically reds under 5 years, structured whites under 2 years.
- "PEAK_SOON": Wine is approaching but has not yet reached its optimal window; generally 5–15 years for most quality reds.
- "READY": Wine is in its drinking window now. ANY wine 15 years or older must use "READY". For wines 30+ years old, ALWAYS use "READY" — they are at peak or already declining and should be consumed soon. NEVER assign "HOLD" or "PEAK_SOON" to a wine that is over 20 years old. Mention explicitly in the summary whether the wine is at its peak or may be past it.`;

const BARREL_RULES = `BARREL / OAK (wine-level, for catalog + user preference learning):
- For most quality RED wines and many structured whites, you MUST provide your best estimate (do not leave both fields null unless the wine is almost always unoaked in that region/style, e.g. many crisp whites).
- barrel_aging_note: Short phrase (max ~200 chars) describing typical barrel regimen (e.g. "≈12–18 months American/French oak"). If genuinely no oak is typical, say "Typically little or no oak" and set months to 0.
- barrel_aging_months_est: Integer — total months in oak/barrel you judge typical for this producer/style (0 = unoaked). Only use null if you have no reasonable basis at all.
- These are ESTIMATES from general knowledge, not guaranteed facts for this bottle.`;

export function buildWineAnalysisSystemPrompt(
  mode: WineAnalysisMode,
  language: string,
): string {
  const languageInstruction = language === "he"
    ? "CRITICAL: You MUST write ALL text fields in HEBREW (עברית). The analysis_summary, analysis_reasons, barrel_aging_note (if not null), and assumptions must be in Hebrew."
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
  "barrel_aging_months_est": number | null${mode === "single" ? "," : ""}${heBlock}
}

IMPORTANT:
- Reference the SPECIFIC wine details (producer, region, vintage) in your analysis
- Do NOT use generic template language
- If data is missing, lower confidence and mention assumptions
- Analysis must be unique per bottle
- ${languageInstruction}
${heInstruction}

${READINESS_RULES}

${BARREL_RULES}`;
}

export function buildWineAnalysisUserPrompt(
  wine: WineAnalysisInput,
  currentYear: number,
  language: string,
  mode: WineAnalysisMode,
): string {
  const age = wine.vintage != null ? currentYear - wine.vintage : null;
  const grapes = formatGrapesForPrompt(wine.grapes);

  const heSuffix = mode === "single"
    ? " כתוב הכל בעברית. הוסף גם תרגומים לעברית בשדה he_translations."
    : "";

  if (language === "he") {
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
הערות משתמש: ${wine.notes?.trim() ? wine.notes : "אין"}

שנה נוכחית: ${currentYear}

ספק ניתוח מפורט וספציפי לבקבוק. התייחס ליצרן, לאזור ולבציר האמיתיים בסיכום שלך. אל תיתן עצות גנריות. אם היין הוא בן 20 שנה ומעלה, דון במפורש האם הוא בשיאו, עבר את שיאו, או עדיין מפתיע בחיוניותו — והגדר את readiness_label כ-"READY".${heSuffix}`;
  }

  return `Analyze this wine and provide sommelier notes:

Wine Name: ${wine.wine_name}
Producer: ${wine.producer ?? "Unknown"}
Vintage: ${wine.vintage ?? "NV"}
Age: ${age != null ? `${age} years` : "Unknown"}
Region: ${wine.region ?? "Unknown"}
Country: ${wine.country ?? "Unknown"}
Appellation: ${wine.appellation ?? "Unknown"}
Grapes: ${grapes}
Style: ${wine.color ?? "Unknown"}
User Notes: ${wine.notes?.trim() ? wine.notes : "None"}

Current Year: ${currentYear}

Provide a detailed, bottle-specific analysis. Reference the actual producer, region, and vintage in your summary. Do not give generic advice. If the wine is 20+ years old, explicitly discuss whether it is at its peak, past its prime, or still surprisingly vibrant — and set readiness_label to "READY".${mode === "single" ? " Also include Hebrew translations in he_translations." : ""}`;
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
  return a;
}
