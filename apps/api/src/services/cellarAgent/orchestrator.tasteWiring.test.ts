/**
 * Orchestrator wiring tests for Phase 1 taste shortlist + reserved similar path.
 * Mocks OpenAI + repo loaders; exercises real recommendCellar → shortlist path.
 */

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { CellarBottleInput } from './types.js';
import type { StructuredTasteProfile } from './tasteProfileTypes.js';

const loadUserTasteProfile = vi.fn();
const loadSommelierMemory = vi.fn();
const loadRecentRecommendedBottleIds = vi.fn();
const insertRecommendationEvent = vi.fn();
const mergeAndSavePreferences = vi.fn();

vi.mock('./tasteProfileRepo.js', () => ({
  loadUserTasteProfile: (...args: unknown[]) => loadUserTasteProfile(...args),
}));

vi.mock('./sommelierRepo.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./sommelierRepo.js')>();
  return {
    ...actual,
    loadSommelierMemory: (...args: unknown[]) => loadSommelierMemory(...args),
    loadRecentRecommendedBottleIds: (...args: unknown[]) =>
      loadRecentRecommendedBottleIds(...args),
    insertRecommendationEvent: (...args: unknown[]) => insertRecommendationEvent(...args),
    mergeAndSavePreferences: (...args: unknown[]) => mergeAndSavePreferences(...args),
  };
});

import { recommendCellar } from './orchestrator.js';

const fullBodyProfile: StructuredTasteProfile = {
  version: 1,
  vector: {
    body: 0.85,
    tannin: 0.8,
    acidity: 0.45,
    oak: 0.7,
    sweetness: 0.1,
    power: 0.8,
  },
  preferences: {
    reds_bias: 0,
    whites_bias: 0,
    sparkling_bias: 0,
    style_tags: {},
    regions: { Bordeaux: 0.95 },
    grapes: { Cabernet: 0.9 },
  },
  confidence: 'high',
  data_points: { rated_count: 20, last_rated_at: '2026-09-01T00:00:00.000Z' },
};

const bodyOnlyFullProfile: StructuredTasteProfile = {
  ...fullBodyProfile,
  preferences: {
    reds_bias: 0,
    whites_bias: 0,
    sparkling_bias: 0,
    style_tags: {},
    regions: {},
    grapes: {},
  },
};

const bottles: CellarBottleInput[] = [
  {
    id: 'bordeaux-cab',
    producer: 'Château Alpha',
    wineName: 'Grand Vin',
    region: 'Bordeaux',
    grapes: ['Cabernet Sauvignon'],
    color: 'red',
    quantity: 2,
    readinessStatus: 'ready',
  },
  {
    id: 'napa-cab',
    producer: 'Napa Estate',
    wineName: 'Reserve Cab',
    region: 'Napa Valley',
    grapes: ['Cabernet Sauvignon'],
    color: 'red',
    quantity: 1,
    readinessStatus: 'peak',
  },
  {
    id: 'burgundy-pinot',
    producer: 'Domaine Light',
    wineName: 'Village',
    region: 'Burgundy',
    grapes: ['Pinot Noir'],
    color: 'red',
    quantity: 2,
    readinessStatus: 'ready',
  },
  {
    id: 'loire-gamay',
    producer: 'Loire Co',
    wineName: 'Gamay',
    region: 'Loire',
    grapes: ['Gamay'],
    color: 'red',
    quantity: 2,
    readinessStatus: 'ready',
  },
  {
    id: 'reserved-bordeaux',
    producer: 'Keep Château',
    wineName: 'Special',
    region: 'Bordeaux',
    grapes: ['Cabernet Sauvignon'],
    color: 'red',
    quantity: 1,
    readinessStatus: 'peak',
    isReserved: true,
  },
];

function mockOpenAiCapturingShortlist(opts?: {
  /** Return an invalid bottle id once to exercise validation retry */
  invalidFirst?: boolean;
}) {
  let call = 0;
  const create = vi.fn(async ({ messages }: { messages: Array<{ role: string; content: string }> }) => {
    call += 1;
    const system = messages.find((m) => m.role === 'system')?.content ?? '';
    // Shortlist JSON is embedded in the system prompt after "SHORTLIST"
    const jsonMatch = system.match(/\[[\s\S]*?\n\]/);
    let firstId = 'bordeaux-cab';
    if (jsonMatch) {
      try {
        const arr = JSON.parse(jsonMatch[0]) as Array<{ id: string }>;
        if (arr[0]?.id) firstId = arr[0].id;
        (create as typeof create & { lastShortlistIds?: string[] }).lastShortlistIds = arr.map(
          (b) => b.id
        );
      } catch {
        /* ignore parse issues — explanation.topScores is primary assert */
      }
    }
    const bottleId =
      opts?.invalidFirst && call === 1 ? '00000000-0000-4000-8000-000000000099' : firstId;
    return {
      choices: [
        {
          message: {
            content: JSON.stringify({
              type: 'single',
              message: 'Here is a pick from your cellar.',
              recommendation: {
                bottleId,
                reason: 'Matches your request.',
                serveTemp: '16C',
              },
            }),
          },
        },
      ],
    };
  });
  return {
    chat: { completions: { create } },
    create,
  };
}

describe('recommendCellar taste shortlist wiring', () => {
  const prevEnv = process.env.TASTE_SHORTLIST_SCORING;

  beforeEach(() => {
    process.env.TASTE_SHORTLIST_SCORING = '1';
    loadUserTasteProfile.mockReset();
    loadSommelierMemory.mockReset();
    loadRecentRecommendedBottleIds.mockReset();
    insertRecommendationEvent.mockReset();
    mergeAndSavePreferences.mockReset();

    loadSommelierMemory.mockResolvedValue({ version: 1 });
    loadRecentRecommendedBottleIds.mockResolvedValue(new Set());
    insertRecommendationEvent.mockResolvedValue('evt-1');
    mergeAndSavePreferences.mockResolvedValue({ version: 1 });
    loadUserTasteProfile.mockResolvedValue({
      profile: fullBodyProfile,
      loaded: true,
      reason: 'ok',
    });
  });

  afterEach(() => {
    if (prevEnv === undefined) delete process.env.TASTE_SHORTLIST_SCORING;
    else process.env.TASTE_SHORTLIST_SCORING = prevEnv;
  });

  async function runRecommend(params: {
    message?: string;
    openai?: ReturnType<typeof mockOpenAiCapturingShortlist>;
    actionContext?: { lastRecommendationBottleId?: string };
  } = {}) {
    const openai = params.openai ?? mockOpenAiCapturingShortlist();
    const result = (await recommendCellar({
      openai: openai as never,
      userId: 'user-1',
      supabase: {} as never,
      message: params.message ?? 'Recommend a red wine for steak tonight',
      history: [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'Hi — what are you eating?' },
      ],
      cellarBottles: bottles,
      scannedBottleRows: bottles.length,
      scannedPhysicalBottles: bottles.length,
      cellarSource: 'server' as const,
      tasteContext: 'prose should not drive scoring',
      actionContext: params.actionContext,
      language: 'en',
    })) as {
      agentMeta?: {
        explanation?: { topScores?: Array<{ bottleId: string; score: number }> };
        processingMode?: string;
      };
      recommendation?: { bottleId?: string };
      message?: string;
    };
    return { result, openai };
  }

  it('A+B: structured profile from loadUserTasteProfile changes shortlist order', async () => {
    const { result } = await runRecommend();
    expect(loadUserTasteProfile).toHaveBeenCalledWith('user-1', expect.anything());
    const top = result.agentMeta?.explanation?.topScores?.map((t) => t.bottleId) ?? [];
    expect(result.agentMeta?.explanation?.topScores?.[0]?.bottleId).toBe('bordeaux-cab');
    const signals = (result.agentMeta?.explanation as { signals?: Record<string, unknown> } | undefined)
      ?.signals;
    expect(signals).toMatchObject({
      tasteScoringVersion: 'taste_shortlist_v1',
      tasteProfileLoaded: true,
    });
  });

  it('C: TASTE_SHORTLIST_SCORING=0 restores pre-Phase-1 ordering', async () => {
    process.env.TASTE_SHORTLIST_SCORING = '0';
    const { result } = await runRecommend();
    const top = result.agentMeta?.explanation?.topScores?.map((t) => t.bottleId) ?? [];
    // Peak Napa outranks ready Bordeaux when taste boosts are off
    expect(top[0]).toBe('napa-cab');
  });

  it('D: null profile preserves legacy ordering', async () => {
    loadUserTasteProfile.mockResolvedValue({
      profile: null,
      loaded: true,
      reason: 'empty',
    });
    const { result } = await runRecommend();
    const top = result.agentMeta?.explanation?.topScores?.map((t) => t.bottleId) ?? [];
    expect(top[0]).toBe('napa-cab');
  });

  it('E: profile-load failure soft-fails and recommendation continues', async () => {
    loadUserTasteProfile.mockResolvedValue({
      profile: null,
      loaded: false,
      reason: 'query_error',
    });
    const { result } = await runRecommend();
    expect(result.recommendation?.bottleId || result.message).toBeTruthy();
    expect(result.agentMeta?.processingMode).toMatch(/orchestrated|legacy|conversational/);
  });

  it('F: agent memory bodyPreference globally suppresses conflicting taste body', async () => {
    loadUserTasteProfile.mockResolvedValue({
      profile: bodyOnlyFullProfile,
      loaded: true,
      reason: 'ok',
    });
    loadSommelierMemory.mockResolvedValue({
      version: 1,
      bodyPreference: 'light',
    });
    const { result } = await runRecommend();
    const top = result.agentMeta?.explanation?.topScores?.map((t) => t.bottleId) ?? [];
    // Light memory should prefer pinot/gamay over Napa jumping via taste_body:full
    expect(top[0]).not.toBe('napa-cab');
    expect(['burgundy-pinot', 'loire-gamay']).toContain(top[0]);
  });

  it('G: explicit current body request overrides memory and taste', async () => {
    loadUserTasteProfile.mockResolvedValue({
      profile: bodyOnlyFullProfile,
      loaded: true,
      reason: 'ok',
    });
    loadSommelierMemory.mockResolvedValue({
      version: 1,
      bodyPreference: 'full',
    });
    const { result } = await runRecommend({
      message: 'Something lighter for steak tonight please',
    });
    const top = result.agentMeta?.explanation?.topScores?.map((t) => t.bottleId) ?? [];
    expect(['burgundy-pinot', 'loire-gamay']).toContain(top[0]);
  });

  it('H: similar recommendations exclude reserved bottles by default', async () => {
    const openai = mockOpenAiCapturingShortlist();
    const result = (await recommendCellar({
      openai: openai as never,
      userId: 'user-1',
      supabase: {} as never,
      message: 'What else do I have like this?',
      history: [],
      cellarBottles: bottles,
      scannedBottleRows: bottles.length,
      scannedPhysicalBottles: bottles.length,
      cellarSource: 'server' as const,
      actionContext: { lastRecommendationBottleId: 'burgundy-pinot' },
      language: 'en',
    })) as {
      agentMeta?: { explanation?: { topScores?: Array<{ bottleId: string }> } };
    };
    const ids = result.agentMeta?.explanation?.topScores?.map((t) => t.bottleId) ?? [];
    expect(ids).not.toContain('reserved-bordeaux');
  });

  it('I: similar recommendations include reserved when explicitly requested', async () => {
    const result = (await recommendCellar({
      openai: mockOpenAiCapturingShortlist() as never,
      userId: 'user-1',
      supabase: {} as never,
      message: 'What else do I have like this? Please include reserved bottles',
      history: [],
      cellarBottles: bottles,
      scannedBottleRows: bottles.length,
      scannedPhysicalBottles: bottles.length,
      cellarSource: 'server' as const,
      actionContext: { lastRecommendationBottleId: 'burgundy-pinot' },
      language: 'en',
    })) as {
      agentMeta?: {
        routedAction?: string;
        explanation?: { topScores?: Array<{ bottleId: string }> };
      };
    };
    expect(result.agentMeta?.routedAction).toBe('similar');
    const ids = result.agentMeta?.explanation?.topScores?.map((t) => t.bottleId) ?? [];
    expect(ids).toContain('reserved-bordeaux');
  });

  it('J: bottle-ID validation rejects hallucinated ids (retry path)', async () => {
    const openai = mockOpenAiCapturingShortlist({ invalidFirst: true });
    const result = (await recommendCellar({
      openai: openai as never,
      userId: 'user-1',
      supabase: {} as never,
      message: 'Recommend a red wine for steak tonight',
      history: [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'Hi' },
      ],
      cellarBottles: bottles,
      scannedBottleRows: bottles.length,
      scannedPhysicalBottles: bottles.length,
      cellarSource: 'server' as const,
      language: 'en',
    })) as { recommendation?: { bottleId?: string }; agentMeta?: { processingMode?: string } };

    // Second attempt should succeed with a shortlist id
    expect(openai.create.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(result.recommendation?.bottleId).toBeTruthy();
    expect(result.recommendation?.bottleId).not.toBe(
      '00000000-0000-4000-8000-000000000099'
    );
  });
});
