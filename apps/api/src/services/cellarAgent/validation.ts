/**
 * Validates model JSON against the active shortlist (or legacy cellar list).
 * Mirrors the previous route behavior so responses stay compatible.
 */

import type { CompactCellarBottle } from './types.js';

export type ValidationOutcome = 'ok' | 'partial' | 'failed';

export interface ValidatedRecommendation {
  recommendation: unknown;
  validationResult: ValidationOutcome;
}

function idSet(bottles: CompactCellarBottle[]): Set<string> {
  return new Set(bottles.map((b) => b.id));
}

/**
 * Validate parsed JSON; may filter invalid multi-bottle rows (partial).
 */
export function validateModelOutput(
  parsed: Record<string, unknown>,
  shortlist: CompactCellarBottle[]
): ValidatedRecommendation {
  const ids = idSet(shortlist);

  const bottles = parsed.bottles;
  if (bottles && Array.isArray(bottles) && bottles.length > 0) {
    const invalid = bottles.filter(
      (b: { bottleId?: string }) => !b?.bottleId || !ids.has(b.bottleId)
    );
    if (invalid.length > 0) {
      const validBottles = bottles.filter(
        (b: { bottleId?: string }) => b?.bottleId && ids.has(b.bottleId)
      );
      if (validBottles.length > 0) {
        return {
          validationResult: 'partial',
          recommendation: {
            type: 'bottle_list',
            title: (parsed.title as string) || 'Recommended Wines',
            message:
              (parsed.message as string) || 'Here are some wines from your cellar:',
            bottles: validBottles,
            ...(parsed.followUpQuestion ? { followUpQuestion: parsed.followUpQuestion } : {}),
          },
        };
      }
      return {
        validationResult: 'failed',
        recommendation: {
          message:
            "I couldn't find matching bottles in your cellar. Please try rephrasing your request.",
        },
      };
    }
    return {
      validationResult: 'ok',
      recommendation: {
        type: 'bottle_list',
        title: (parsed.title as string) || 'Recommended Wines',
        message:
          (parsed.message as string) || 'Here are some wines from your cellar:',
        bottles,
        ...(parsed.followUpQuestion ? { followUpQuestion: parsed.followUpQuestion } : {}),
      },
    };
  }

  const rec = parsed.recommendation as { bottleId?: string } | undefined;
  if (rec && rec.bottleId) {
    if (!ids.has(rec.bottleId)) {
      return {
        validationResult: 'failed',
        recommendation: {
          message:
            "I couldn't confidently pick a bottle from your cellar. Could you rephrase your request or be more specific?",
        },
      };
    }
    return { validationResult: 'ok', recommendation: parsed };
  }

  // Conversational / follow-up only
  return { validationResult: 'ok', recommendation: parsed };
}
