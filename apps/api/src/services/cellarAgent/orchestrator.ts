/**
 * Cellar Sommelier orchestrator
 *
 * Flow: classify route → dispatch.
 * - Side-effect routes (open, memory, draft, feedback) never use the legacy LLM fallback.
 * - LLM routes (recommend, similar) use orchestrated shortlist; on failure only those fall back to legacy.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
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
import type { CellarBottleInput, CellarIntent, OrchestrationLogPayload, ScoredCandidate } from './types.js';
import { validateModelOutput } from './validation.js';
import {
  buildReasoningContext,
  detectIntent,
  extractConstraints,
  needsClarification,
} from './tools.js';
import { runLegacyRecommendation } from './legacyRecommend.js';
import { sliceHistoryForChat } from './chatMessages.js';
import {
  classifyAgentRoute,
  extractDraftTextFromMessage,
  extractUuidFromMessage,
} from './agentRouter.js';
import {
  loadSommelierMemory,
  insertRecommendationEvent,
  mergeAndSavePreferences,
} from './sommelierRepo.js';
import type { ActionContext, AgentResponseMeta, RecommendationExplanation } from './sommelierTypes.js';
import { findSimilarCandidates } from './similarBottles.js';
import { inferMemoryUpdateFromText } from './preferenceInference.js';
import {
  markBottleOpened,
  saveSommelierFeedback,
  createTastingNoteDraft,
} from './sommelierActions.js';
import { logSommelier, logSommelierError, logSommelierWarn, shortUser } from './sommelierLog.js';
import type { SommelierPreferenceMemory } from './sommelierTypes.js';

function constraintsSummaryText(c: ReturnType<typeof extractConstraints>): string {
  const parts: string[] = [];
  if (c.requestedCount) parts.push(`count=${c.requestedCount}`);
  if (c.colors.length) parts.push(`colors=${c.colors.join('+')}`);
  if (c.regionHints.length) parts.push(`regions=${c.regionHints.length}`);
  if (c.grapeHints.length) parts.push(`grapes=${c.grapeHints.length}`);
  if (c.foodKeywords.length) parts.push(`food=${c.foodKeywords.length}`);
  return parts.join(';') || 'none';
}

function buildExplanation(
  intent: CellarIntent,
  constraints: ReturnType<typeof extractConstraints>,
  scored: ScoredCandidate[],
  relaxedFilter: boolean,
  memoryLoaded: boolean
): RecommendationExplanation {
  const topScores = scored.slice(0, 5).map((s) => ({
    bottleId: s.bottle.id,
    score: Math.round(s.score * 10) / 10,
  }));
  const signals: RecommendationExplanation['signals'] = {
    readiness: 'Heuristic ranking favors ready/peak bottles.',
  };
  if (constraints.foodKeywords.length) {
    signals.pairingFit = `Food context: ${constraints.foodKeywords.join(', ')}`;
  }
  if (constraints.colors.length) {
    signals.styleFit = `Color signals: ${constraints.colors.join(', ')}`;
  }
  if (memoryLoaded) {
    signals.preferenceFit = 'Applied learned sommelier preferences from prior sessions.';
  }
  if (relaxedFilter) {
    signals.diversity = 'Color filter relaxed to keep a viable shortlist.';
  }
  return { intent, signals, topScores };
}

function inferResponseType(rec: unknown): string {
  if (!rec || typeof rec !== 'object') return 'message';
  const o = rec as Record<string, unknown>;
  if (o.type === 'bottle_list' || (o.bottles && Array.isArray(o.bottles))) return 'bottle_list';
  if (o.recommendation && typeof o.recommendation === 'object') return 'single';
  return 'message';
}

function extractChosenIds(rec: unknown): string[] {
  if (!rec || typeof rec !== 'object') return [];
  const o = rec as Record<string, unknown>;
  if (o.bottles && Array.isArray(o.bottles)) {
    return (o.bottles as { bottleId?: string }[])
      .map((b) => b.bottleId)
      .filter((id): id is string => typeof id === 'string');
  }
  const r = o.recommendation as { bottleId?: string } | undefined;
  if (r?.bottleId) return [r.bottleId];
  return [];
}

function withMeta(base: Record<string, unknown>, meta: AgentResponseMeta): unknown {
  return { ...base, agentMeta: meta };
}

/**
 * Safer than inferring from DB alone: explicit id in message, or client-provided context.
 */
function resolveBottleIdForOpenAction(message: string, ctx: ActionContext | undefined): string | null {
  const fromMsg = extractUuidFromMessage(message);
  if (fromMsg) return fromMsg;
  if (ctx?.lastRecommendationBottleId) return ctx.lastRecommendationBottleId;
  if (ctx?.anchorBottleId) return ctx.anchorBottleId;
  return null;
}

function resolveAnchorForSimilar(message: string, ctx: ActionContext | undefined): string | null {
  const fromMsg = extractUuidFromMessage(message);
  if (fromMsg) return fromMsg;
  if (ctx?.anchorBottleId) return ctx.anchorBottleId;
  if (ctx?.lastRecommendationBottleId) return ctx.lastRecommendationBottleId;
  return null;
}

async function runOrchestratedRecommendation(params: {
  openai: OpenAI;
  message: string;
  history: unknown[];
  cellarBottles: CellarBottleInput[];
  memory: SommelierPreferenceMemory | null;
  tasteContext?: string;
  scoredOverride?: ScoredCandidate[];
  intentOverride?: CellarIntent;
}): Promise<{
  recommendation: unknown;
  log: OrchestrationLogPayload;
  explanation: RecommendationExplanation;
  shortlistIds: string[];
}> {
  const {
    openai,
    message,
    history,
    cellarBottles,
    memory,
    tasteContext,
    scoredOverride,
    intentOverride,
  } = params;

  const conversationHistory = sliceHistoryForChat(history, 8);
  const messageLen = message.length;
  const historyLen = conversationHistory.length;
  const userMessageLower = message.toLowerCase();

  const intent = intentOverride ?? detectIntent(message, historyLen);
  const constraints = extractConstraints(message);
  const clarificationNeeded = needsClarification(
    intent,
    constraints,
    cellarBottles,
    message,
    historyLen
  );

  const { scored, relaxedFilter } = scoredOverride
    ? { scored: scoredOverride, relaxedFilter: false }
    : shortlistCandidates(cellarBottles, constraints, userMessageLower, memory);

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
    tasteContext,
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
        throw new Error('empty_openai_content');
      }

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(content) as Record<string, unknown>;
      } catch {
        throw new Error('json_parse_failed');
      }

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
    } catch (e) {
      validationResult = 'failed';
      if (attempt >= maxAttempts) {
        logSommelierError('llm', e, { phase: 'orchestrated_turn' });
        throw e instanceof Error ? e : new Error('llm_turn_failed');
      }
    }
  }

  if (!recommendation) {
    throw new Error('no_recommendation_after_retries');
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

  const explanation = buildExplanation(
    intent,
    constraints,
    scored,
    relaxedFilter,
    !!memory && Object.keys(memory).length > 1
  );

  return {
    recommendation,
    log,
    explanation,
    shortlistIds: compact.map((b) => b.id),
  };
}

async function persistEvent(
  userId: string,
  supabase: SupabaseClient | null,
  params: {
    message: string;
    detectedIntent: string;
    shortlistIds: string[];
    recommendation: unknown;
    explanation: RecommendationExplanation;
    tasteContextPresent: boolean;
  }
): Promise<string | undefined> {
  if (!supabase) return undefined;
  const id = await insertRecommendationEvent(
    userId,
    {
      user_message: params.message,
      detected_intent: params.detectedIntent,
      shortlist_bottle_ids: params.shortlistIds,
      chosen_bottle_ids: extractChosenIds(params.recommendation),
      response_type: inferResponseType(params.recommendation),
      explanation: params.explanation,
      taste_context_present: params.tasteContextPresent,
    },
    supabase
  );
  return id ?? undefined;
}

async function runLlmPathThenPersist(params: {
  openai: OpenAI;
  userId: string;
  supabase: SupabaseClient | null;
  message: string;
  history: unknown[];
  cellarBottles: CellarBottleInput[];
  memory: SommelierPreferenceMemory | null;
  tasteContext?: string;
  scoredOverride?: ScoredCandidate[];
  intentOverride?: CellarIntent;
  routedAction: 'recommend' | 'similar';
}): Promise<unknown> {
  const { recommendation, log, explanation, shortlistIds } = await runOrchestratedRecommendation({
    openai: params.openai,
    message: params.message,
    history: params.history,
    cellarBottles: params.cellarBottles,
    memory: params.memory,
    tasteContext: params.tasteContext,
    scoredOverride: params.scoredOverride,
    intentOverride: params.intentOverride,
  });

  logSommelier('orchestration', {
    route: params.routedAction,
    user: shortUser(params.userId),
    intent: log.intent,
    shortlistSize: String(log.shortlistSize),
    validation: log.validationResult,
    fallback: String(log.fallbackUsed),
  });

  const eventId = await persistEvent(params.userId, params.supabase, {
    message: params.message,
    detectedIntent: params.intentOverride ?? log.intent,
    shortlistIds,
    recommendation,
    explanation,
    tasteContextPresent: !!params.tasteContext?.trim(),
  });

  const base = recommendation as Record<string, unknown>;
  return withMeta(base, {
    eventId,
    routedAction: params.routedAction,
    explanation,
  });
}

async function legacyFallback(params: {
  openai: OpenAI;
  message: string;
  history: unknown[];
  cellarBottles: CellarBottleInput[];
  tasteContext?: string;
  userId: string;
}): Promise<unknown> {
  logSommelier('fallback', {
    user: shortUser(params.userId),
    reason: 'orchestrated_path_failed',
  });
  const intent = detectIntent(params.message, ((params.history || []) as unknown[]).length);
  const constraints = extractConstraints(params.message);
  const fallbackLog: OrchestrationLogPayload = {
    intent,
    constraintsSummary: constraintsSummaryText(constraints),
    clarificationNeeded: false,
    shortlistSize: buildLegacyCellarContextPayload(params.cellarBottles).bottles.length,
    topHeuristicScores: [],
    validationResult: 'skipped',
    fallbackUsed: true,
    messageLen: params.message.length,
    historyLen: ((params.history || []) as unknown[]).length,
  };
  logSommelier('orchestration', {
    route: 'legacy',
    user: shortUser(params.userId),
    intent: fallbackLog.intent,
    shortlistSize: String(fallbackLog.shortlistSize),
    validation: fallbackLog.validationResult,
    fallback: 'true',
  });
  return runLegacyRecommendation({
    openai: params.openai,
    message: params.message,
    history: params.history,
    cellarBottles: params.cellarBottles,
    tasteContext: params.tasteContext,
  });
}

export interface RecommendCellarParams {
  openai: OpenAI;
  userId: string;
  supabase: SupabaseClient | null;
  message: string;
  history: unknown[];
  cellarBottles: CellarBottleInput[];
  tasteContext?: string;
  actionContext?: ActionContext;
}

function safeActionErrorMessage(): Record<string, unknown> {
  return {
    message: 'Something went wrong on our side. Please try again in a moment.',
    type: 'single',
  };
}

export async function recommendCellar(params: RecommendCellarParams): Promise<unknown> {
  const { openai, userId, supabase, message, history, cellarBottles, tasteContext, actionContext } =
    params;

  const route = classifyAgentRoute(message, actionContext);
  let memoryPrefs: SommelierPreferenceMemory | null = null;
  if (supabase) {
    try {
      memoryPrefs = await loadSommelierMemory(userId, supabase);
    } catch {
      logSommelierWarn('memory_load_failed', { user: shortUser(userId) });
      memoryPrefs = null;
    }
  }

  logSommelier('route', {
    route,
    user: shortUser(userId),
    msgLen: String(message.length),
  });

  switch (route) {
      case 'open_bottle': {
        try {
        const bottleId = resolveBottleIdForOpenAction(message, actionContext);
        if (!bottleId) {
          return withMeta(
            {
              message:
                "I couldn't tell which bottle you opened. Mention the bottle or pick one from your last recommendation, then try again.",
            },
            { routedAction: 'open_bottle', actionResult: 'error' }
          );
        }
        if (!supabase) {
          return withMeta(
            { message: 'Opening bottles from chat requires storage. Try again later.' },
            { routedAction: 'open_bottle', actionResult: 'error' }
          );
        }
        const result = await markBottleOpened(userId, {
          bottleId,
          supabase,
          occasion: 'sommelier_agent',
        });
        if (!result.ok) {
          return withMeta({ message: result.error }, { routedAction: 'open_bottle', actionResult: 'error' });
        }
        logSommelier('action', {
          action: 'open_bottle',
          user: shortUser(userId),
          ok: 'true',
        });
        return withMeta(
          {
            message:
              "Done — I've recorded that bottle as opened and updated your cellar count.",
            type: 'single',
          },
          { routedAction: 'open_bottle', actionResult: 'ok' }
        );
        } catch (e) {
          logSommelierError('action', e, { user: shortUser(userId), action: 'open_bottle' });
          return withMeta(safeActionErrorMessage(), { routedAction: 'open_bottle', actionResult: 'error' });
        }
      }

      case 'tasting_draft': {
        try {
        const draftText = extractDraftTextFromMessage(message).trim();
        if (draftText.length < 2) {
          return withMeta(
            {
              message: 'Add a few words for your tasting note after the prompt, e.g. “Save a note: cherry, smoke, long finish”.',
            },
            { routedAction: 'tasting_draft', actionResult: 'error' }
          );
        }
        if (!supabase) {
          return withMeta(
            { message: "I can't save drafts right now — storage isn't available." },
            { routedAction: 'tasting_draft', actionResult: 'error' }
          );
        }
        const bottleId =
          actionContext?.lastRecommendationBottleId ||
          actionContext?.anchorBottleId ||
          extractUuidFromMessage(message) ||
          null;
        const draftId = await createTastingNoteDraft(userId, {
          draftText,
          bottleId,
          sourceEventId: actionContext?.lastEventId ?? null,
          supabase,
        });
        logSommelier('action', {
          action: 'tasting_draft',
          user: shortUser(userId),
          ok: draftId ? 'true' : 'false',
        });
        return withMeta(
          {
            message: draftId
              ? "I've saved a tasting note draft for you — you can refine it in your cellar later."
              : "I couldn't save the draft, but you can try again in a moment.",
            type: 'single',
          },
          { routedAction: 'tasting_draft', actionResult: draftId ? 'ok' : 'error' }
        );
        } catch (e) {
          logSommelierError('action', e, { user: shortUser(userId), action: 'tasting_draft' });
          return withMeta(safeActionErrorMessage(), { routedAction: 'tasting_draft', actionResult: 'error' });
        }
      }

      case 'memory_update': {
        try {
        const inferred = inferMemoryUpdateFromText(message);
        if (!supabase) {
          return withMeta(
            {
              message:
                "I've noted that in our chat — connect storage to remember it for next time.",
            },
            { routedAction: 'memory_update', actionResult: 'error' }
          );
        }
        if (!inferred || Object.keys(inferred).length === 0) {
          return withMeta(
            {
              message:
                "Tell me what you'd like me to remember — for example lighter reds, a favorite region, or casual vs special occasions.",
            },
            { routedAction: 'memory_update', actionResult: 'error' }
          );
        }
        await mergeAndSavePreferences(userId, inferred, supabase);
        logSommelier('action', { action: 'memory_update', user: shortUser(userId), ok: 'true' });
        return withMeta(
          {
            message:
              "Done — I'll lean on those preferences when shortlisting your cellar from now on.",
            type: 'single',
          },
          { routedAction: 'memory_update', actionResult: 'ok' }
        );
        } catch (e) {
          logSommelierError('action', e, { user: shortUser(userId), action: 'memory_update' });
          return withMeta(safeActionErrorMessage(), { routedAction: 'memory_update', actionResult: 'error' });
        }
      }

      case 'feedback_inline': {
        try {
        if (!supabase) {
          return withMeta(
            { message: 'Thanks for the feedback — I could not persist it just now.' },
            { routedAction: 'feedback_inline', actionResult: 'error' }
          );
        }
        await saveSommelierFeedback(userId, {
          rawText: message,
          recommendationEventId: actionContext?.lastEventId ?? null,
          bottleId: actionContext?.lastRecommendationBottleId ?? null,
          supabase,
          applyToMemory: true,
        });
        logSommelier('action', { action: 'feedback_inline', user: shortUser(userId), ok: 'true' });
        return withMeta(
          {
            message:
              "Thanks — I've logged that and will adjust future picks from your cellar.",
            type: 'single',
          },
          { routedAction: 'feedback_inline', actionResult: 'ok' }
        );
        } catch (e) {
          logSommelierError('action', e, { user: shortUser(userId), action: 'feedback_inline' });
          return withMeta(safeActionErrorMessage(), { routedAction: 'feedback_inline', actionResult: 'error' });
        }
      }

      case 'similar': {
        const anchor = resolveAnchorForSimilar(message, actionContext);
        if (!anchor) {
          return withMeta(
            {
              message:
                "Tell me which bottle to match (or ask for a recommendation first), e.g. “what else like the Barolo you suggested?”.",
            },
            { routedAction: 'similar', actionResult: 'error' }
          );
        }
        const constraints = extractConstraints(message);
        const cap = computeEffectiveShortlistCap(cellarBottles.length);
        const similarScored = findSimilarCandidates(
          anchor,
          cellarBottles,
          constraints,
          message.toLowerCase(),
          memoryPrefs,
          cap
        );
        if (similarScored.length === 0) {
          return withMeta(
            { message: "I couldn't find other bottles to compare in your cellar." },
            { routedAction: 'similar', actionResult: 'error' }
          );
        }
        try {
          return await runLlmPathThenPersist({
            openai,
            userId,
            supabase,
            message,
            history,
            cellarBottles,
            memory: memoryPrefs,
            tasteContext,
            scoredOverride: similarScored,
            intentOverride: 'similar_cellar',
            routedAction: 'similar',
          });
        } catch (e) {
          logSommelierError('llm', e, { user: shortUser(userId), route: 'similar' });
          return legacyFallback({ openai, message, history, cellarBottles, tasteContext, userId });
        }
      }

      default: {
        try {
          return await runLlmPathThenPersist({
            openai,
            userId,
            supabase,
            message,
            history,
            cellarBottles,
            memory: memoryPrefs,
            tasteContext,
            routedAction: 'recommend',
          });
        } catch (e) {
          logSommelierError('llm', e, { user: shortUser(userId), route: 'recommend' });
          return legacyFallback({ openai, message, history, cellarBottles, tasteContext, userId });
        }
      }
  }
}
