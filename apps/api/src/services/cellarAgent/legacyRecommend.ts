/**
 * Legacy recommendation path (pre-orchestration behavior).
 *
 * Sends up to 50 shuffled bottles to the model — used only when orchestration
 * throws so the endpoint stays resilient.
 */

import OpenAI from 'openai';
import { buildLegacySystemPrompt } from './prompt.js';
import type { CellarBottleInput } from './types.js';
import { buildLegacyCellarContextPayload } from './candidateSelection.js';
import { sliceHistoryForChat } from './chatMessages.js';
import { validateModelOutput } from './validation.js';

export async function runLegacyRecommendation(params: {
  openai: OpenAI;
  message: string;
  history: unknown[];
  cellarBottles: CellarBottleInput[];
  tasteContext?: string;
}): Promise<unknown> {
  const { openai, message, history, cellarBottles, tasteContext } = params;
  const { bottles, summary } = buildLegacyCellarContextPayload(cellarBottles);
  const conversationHistory = sliceHistoryForChat(history, 8);

  const systemContent = buildLegacySystemPrompt({
    cellarJson: JSON.stringify(bottles, null, 2),
    summary,
    tasteContext,
  });

  let attempt = 0;
  const maxAttempts = 2;
  let recommendation: unknown = null;

  while (attempt < maxAttempts && !recommendation) {
    attempt++;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemContent },
          ...conversationHistory,
          { role: 'user', content: message },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.8,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      const parsed = JSON.parse(content) as Record<string, unknown>;
      const ids = new Set(bottles.map((b) => b.id));

      if (parsed.bottles && Array.isArray(parsed.bottles) && parsed.bottles.length > 0) {
        const hasInvalid = (parsed.bottles as { bottleId?: string }[]).some(
          (b) => !b?.bottleId || !ids.has(b.bottleId)
        );
        if (hasInvalid && attempt < maxAttempts) {
          continue;
        }
      }

      const rec = parsed.recommendation as { bottleId?: string } | undefined;
      if (rec?.bottleId && !ids.has(rec.bottleId) && attempt < maxAttempts) {
        continue;
      }

      const v = validateModelOutput(parsed, bottles);
      recommendation = v.recommendation;
    } catch {
      if (attempt >= maxAttempts) {
        throw new Error('Failed to generate valid recommendation');
      }
    }
  }

  if (!recommendation) {
    throw new Error('Failed to generate valid recommendation');
  }

  return recommendation;
}
