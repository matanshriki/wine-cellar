/**
 * Cellar Sommelier orchestrator (Phase 1).
 *
 * Single linear pipeline with deterministic “tools” before the LLM:
 * intent → constraints → clarification hint → shortlist → (optional diversity) →
 * prompt → LLM → validate. This is agent-ready because each step can later become
 * async tools, memory lookups, or policies without changing the HTTP contract.
 *
 * On any failure in the orchestrated path, we fall back to `runLegacyRecommendation`
 * so production behavior stays stable.
 */

import OpenAI from 'openai';
import {
  buildLegacyCellarContextPayload,
  compactBottlesForLlm,
  computeEffectiveShortlistCap,
  diversifyShortlistForPrompt,
  shortlistCandidates,
  takeTopForCap,
} from './candidateSelection.js';
import { buildOrchestratedSystemPrompt } from './prompt.js';
import type { CellarBottleInput, OrchestrationLogPayload } from './types.js';
import { validateModelOutput } from './validation.js';
import {
  buildReasoningContext,
  detectIntent,
  extractConstraints,
  needsClarification,
} from './tools.js';
import { nullCellarMemoryService, type CellarMemoryService } from './memory.js';
import { runLegacyRecommendation } from './legacyRecommend.js';
import { sliceHistoryForChat } from './chatMessages.js';

function logOrchestration(payload: OrchestrationLogPayload): void {
  console.log(
    '[Sommelier][orchestration]',
    JSON.stringify({
      intent: payload.intent,
      constraintsSummary: payload.constraintsSummary,
      clarificationNeeded: payload.clarificationNeeded,
      shortlistSize: payload.shortlistSize,
      topHeuristicScores: payload.topHeuristicScores,
      validationResult: payload.validationResult,
      fallbackUsed: payload.fallbackUsed,
      messageLen: payload.messageLen,
      historyLen: payload.historyLen,
    })
  );
}

function constraintsSummaryText(c: ReturnType<typeof extractConstraints>): string {
  const parts: string[] = [];
  if (c.requestedCount) parts.push(`count=${c.requestedCount}`);
  if (c.colors.length) parts.push(`colors=${c.colors.join('+')}`);
  if (c.regionHints.length) parts.push(`regions=${c.regionHints.length}`);
  if (c.grapeHints.length) parts.push(`grapes=${c.grapeHints.length}`);
  if (c.foodKeywords.length) parts.push(`food=${c.foodKeywords.length}`);
  return parts.join(';') || 'none';
}

/**
 * Orchestrated LLM path: shortlist-only cellar JSON in the system prompt.
 */
async function runOrchestratedRecommendation(params: {
  openai: OpenAI;
  message: string;
  history: unknown[];
  cellarBottles: CellarBottleInput[];
  memory?: CellarMemoryService;
}): Promise<{ recommendation: unknown; log: OrchestrationLogPayload }> {
  const { openai, message, history, cellarBottles } = params;
  const memory = params.memory ?? nullCellarMemoryService;
  void memory; // Phase 1: optional dependency wired for future use

  const conversationHistory = sliceHistoryForChat(history, 8);
  const messageLen = message.length;
  const historyLen = conversationHistory.length;
  const userMessageLower = message.toLowerCase();

  const intent = detectIntent(message, historyLen);
  const constraints = extractConstraints(message);
  const clarificationNeeded = needsClarification(
    intent,
    constraints,
    cellarBottles,
    message,
    historyLen
  );

  const { scored, relaxedFilter } = shortlistCandidates(
    cellarBottles,
    constraints,
    userMessageLower
  );

  const cap = computeEffectiveShortlistCap(scored.length);
  const top = takeTopForCap(scored, cap);

  const diversified =
    intent === 'multi_recommendation' && top.length > 1
      ? diversifyShortlistForPrompt(scored, cap)
      : top;

  const compact = compactBottlesForLlm(diversified);

  let summary = '';
  if (cellarBottles.length > compact.length) {
    summary = `\n\nNote: Your full cellar has more bottles than listed here. This is a relevance-ranked shortlist for this question only.`;
  }

  const shortlistRegions = compact
    .map((b) => b.region)
    .filter(Boolean)
    .slice(0, 8) as string[];

  const reasoning = buildReasoningContext(
    intent,
    constraints,
    shortlistRegions,
    clarificationNeeded,
    relaxedFilter
  );

  const systemContent = buildOrchestratedSystemPrompt({
    shortlistJson: JSON.stringify(compact, null, 2),
    summary,
    reasoningBlock: [reasoning.shortlistSummary, reasoning.clarificationHint]
      .filter(Boolean)
      .join('\n'),
  });

  let attempt = 0;
  const maxAttempts = 2;
  let recommendation: unknown = null;
  let validationResult: OrchestrationLogPayload['validationResult'] = 'skipped';

  const bottles = compact;

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
          validationResult = 'failed';
          continue;
        }
      }

      const rec = parsed.recommendation as { bottleId?: string } | undefined;
      if (rec?.bottleId && !ids.has(rec.bottleId) && attempt < maxAttempts) {
        validationResult = 'failed';
        continue;
      }

      const v = validateModelOutput(parsed, bottles);
      recommendation = v.recommendation;
      validationResult = v.validationResult;
    } catch {
      validationResult = 'failed';
      if (attempt >= maxAttempts) {
        throw new Error('Failed to generate valid recommendation');
      }
    }
  }

  if (!recommendation) {
    throw new Error('Failed to generate valid recommendation');
  }

  const topHeuristicScores = scored.slice(0, 5).map((s) => ({
    bottleId: s.bottle.id,
    score: Math.round(s.score * 10) / 10,
  }));

  const log: OrchestrationLogPayload = {
    intent,
    constraintsSummary: constraintsSummaryText(constraints),
    clarificationNeeded,
    shortlistSize: compact.length,
    topHeuristicScores,
    validationResult,
    fallbackUsed: false,
    messageLen,
    historyLen,
  };

  return { recommendation, log };
}

export interface RecommendCellarParams {
  openai: OpenAI;
  message: string;
  history: unknown[];
  cellarBottles: CellarBottleInput[];
  memory?: CellarMemoryService;
}

/**
 * Primary entry: orchestrated path with legacy fallback on any error.
 */
export async function recommendCellar(params: RecommendCellarParams): Promise<unknown> {
  const { openai, message, history, cellarBottles, memory } = params;

  try {
    const { recommendation, log } = await runOrchestratedRecommendation({
      openai,
      message,
      history,
      cellarBottles,
      memory,
    });
    logOrchestration(log);
    return recommendation;
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown error';
    console.warn('[Sommelier][orchestration] Falling back to legacy path:', reason);

    const intent = detectIntent(message, ((history || []) as unknown[]).length);
    const constraints = extractConstraints(message);
    const fallbackLog: OrchestrationLogPayload = {
      intent,
      constraintsSummary: constraintsSummaryText(constraints),
      clarificationNeeded: false,
      shortlistSize: buildLegacyCellarContextPayload(cellarBottles).bottles.length,
      topHeuristicScores: [],
      validationResult: 'skipped',
      fallbackUsed: true,
      messageLen: message.length,
      historyLen: ((history || []) as unknown[]).length,
    };
    logOrchestration(fallbackLog);

    return runLegacyRecommendation({ openai, message, history, cellarBottles });
  }
}
