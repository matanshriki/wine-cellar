/**
 * Wine-level experience memory: extract, resolve, score, correct/remove.
 * Reuses sommelier_feedback_events — no new tables.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { extractPreferenceEvidence } from './preferenceExtractRules.js';
import { resolveWinePhraseInCellar } from './wineExperienceResolve.js';
import {
  wineExperienceIdentityKey,
  isWineExperienceDelta,
  WINE_EXPERIENCE_SCHEMA,
} from './wineExperienceTypes.js';
import {
  dedupeWineExperiencesByIdentity,
  loadActiveWineExperiences,
  processWineExperienceMessage,
  toPublicWineExperienceItems,
  retractWineExperienceEvent,
} from './wineExperiencePersist.js';
import {
  applyPreferenceScores,
  WINE_EXPERIENCE_WEIGHTS,
  type TasteScoreContext,
} from './tasteScoring.js';
import { parseProfileMemoryAction, toPublicSommiMemory } from './profileSommiMemory.js';
import { classifyAgentRoute } from './agentRouter.js';
import type { CellarBottleInput } from './types.js';

const angiuli: CellarBottleInput = {
  id: 'bottle-angiuli-2019',
  wineId: 'wine-angiuli-ndt',
  producer: 'Angiuli Donato',
  wineName: 'Nero di Troia',
  vintage: 2019,
  region: 'Puglia',
  country: 'Italy',
  grapes: ['Nero di Troia'],
  color: 'red',
  quantity: 1,
  readinessStatus: 'ready',
};

const angiuliOtherVintage: CellarBottleInput = {
  ...angiuli,
  id: 'bottle-angiuli-2021',
  wineId: 'wine-angiuli-ndt-2021',
  vintage: 2021,
};

const otherWine: CellarBottleInput = {
  id: 'bottle-other',
  wineId: 'wine-other',
  producer: 'Château Test',
  wineName: 'Grand Vin',
  vintage: 2018,
  region: 'Bordeaux',
  grapes: ['Cabernet Sauvignon'],
  color: 'red',
  quantity: 2,
  readinessStatus: 'ready',
};

describe('extractNamedWineExperience', () => {
  it('Remember that I loved Angiuli Donato Nero di Troia → wine_experience (not grape)', () => {
    const c = extractPreferenceEvidence(
      'Remember that I loved Angiuli Donato Nero di Troia'
    )!;
    expect(c).toBeTruthy();
    expect(c.class).toBe('wine_experience');
    expect(c.polarity).toBe('like');
    expect(c.applyCanonical).toBe(false);
    expect(c.wineNamePhrase).toMatch(/Angiuli Donato Nero di Troia/i);
    expect(c.valueId).not.toBe('nero_di_troia');
    expect(c.softGrapeHint).toBe('nero_di_troia');
  });

  it('grape-only remember stays on grape path', () => {
    const c = extractPreferenceEvidence('Remember that I like Nero di Troia')!;
    expect(c.class).not.toBe('wine_experience');
    expect(c.dimension).toBe('grape');
    expect(c.valueId).toBe('nero_di_troia');
  });

  it("I didn't like a named wine → wine_experience dislike", () => {
    const c = extractPreferenceEvidence(
      "I didn't like Angiuli Donato Nero di Troia"
    )!;
    expect(c.class).toBe('wine_experience');
    expect(c.polarity).toBe('dislike');
  });

  it('Hebrew loved named wine → wine_experience', () => {
    const c = extractPreferenceEvidence('תזכור שאהבתי את Angiuli Donato Nero di Troia')!;
    expect(c.class).toBe('wine_experience');
    expect(c.polarity).toBe('like');
  });

  it('correction phrasing extracts dislike', () => {
    const c = extractPreferenceEvidence(
      'Actually, I did not like Angiuli Donato Nero di Troia'
    )!;
    expect(c.class).toBe('wine_experience');
    expect(c.polarity).toBe('dislike');
  });
});

describe('agentRouter memory_update for wine experiences', () => {
  it('routes loved / did not like named wines to memory_update', () => {
    expect(
      classifyAgentRoute('Remember that I loved Angiuli Donato Nero di Troia')
    ).toBe('memory_update');
    expect(
      classifyAgentRoute("I didn't like Angiuli Donato Nero di Troia")
    ).toBe('memory_update');
    expect(classifyAgentRoute('אהבתי את Angiuli Donato')).toBe('memory_update');
  });
});

describe('resolveWinePhraseInCellar', () => {
  it('matches Angiuli when cellar has the bottle', () => {
    const r = resolveWinePhraseInCellar(
      'Angiuli Donato Nero di Troia',
      [angiuli, otherWine]
    );
    expect(r.status).toBe('matched');
    if (r.status === 'matched') {
      expect(r.bottle.wineId).toBe('wine-angiuli-ndt');
      expect(r.bottle.bottleId).toBe('bottle-angiuli-2019');
    }
  });

  it('asks clarification when two close matches', () => {
    const twin: CellarBottleInput = {
      ...angiuli,
      id: 'bottle-angiuli-riserva',
      wineId: 'wine-angiuli-riserva',
      wineName: 'Nero di Troia Riserva',
    };
    const r = resolveWinePhraseInCellar('Angiuli Nero di Troia', [angiuli, twin]);
    expect(r.status).toBe('ambiguous');
    if (r.status === 'ambiguous') {
      expect(r.candidates.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('unresolved when cellar empty — still usable as label memory', () => {
    const r = resolveWinePhraseInCellar('Angiuli Donato Nero di Troia', []);
    expect(r.status).toBe('unresolved');
    if (r.status === 'unresolved') {
      expect(r.displayLabel).toMatch(/Angiuli/i);
    }
  });
});

describe('wineExperience identity + public view', () => {
  it('identity prefers wine_id over label', () => {
    expect(
      wineExperienceIdentityKey({
        wine_id: 'wine-1',
        display_label: 'Foo',
      })
    ).toBe('wine:wine-1');
    expect(
      wineExperienceIdentityKey({
        wine_id: null,
        display_label: 'Angiuli Donato Nero di Troia',
      })
    ).toBe('label:angiuli donato nero di troia');
  });

  it('toPublicSommiMemory surfaces wines_liked / wines_disliked', () => {
    const memory = toPublicSommiMemory(null, 'en', [
      {
        id: 'evt-1',
        label: 'Angiuli Donato Nero di Troia (2019)',
        polarity: 'like',
        vintage: 2019,
        wineId: 'wine-angiuli-ndt',
      },
    ]);
    expect(memory.wines_liked).toHaveLength(1);
    expect(memory.wines_disliked).toHaveLength(0);
    expect(memory.wines_liked[0]!.label).toMatch(/Angiuli/);
  });

  it('parseProfileMemoryAction accepts remove_wine_experience', () => {
    const action = parseProfileMemoryAction({
      type: 'remove_wine_experience',
      id: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(action).toEqual({
      type: 'remove_wine_experience',
      id: '550e8400-e29b-41d4-a716-446655440000',
    });
  });

  it('isWineExperienceDelta guards schema', () => {
    expect(
      isWineExperienceDelta({
        schema: WINE_EXPERIENCE_SCHEMA,
        display_label: 'X',
        wine_id: null,
        bottle_id: null,
        producer: null,
        wine_name: null,
        vintage: null,
        match_status: 'unresolved',
      })
    ).toBe(true);
    expect(isWineExperienceDelta({ schema: 'other', display_label: 'X' })).toBe(
      false
    );
  });
});

describe('recommendation scoring with wine experiences', () => {
  const prevEnv = process.env.TASTE_SHORTLIST_SCORING;

  beforeEach(() => {
    process.env.TASTE_SHORTLIST_SCORING = '1';
  });

  afterEach(() => {
    if (prevEnv === undefined) delete process.env.TASTE_SHORTLIST_SCORING;
    else process.env.TASTE_SHORTLIST_SCORING = prevEnv;
  });

  it('same wine_id like boosts; does not assert grape like', () => {
    const tasteCtx: TasteScoreContext = {
      tasteProfile: null,
      requestBodyPreference: null,
      wineExperiences: [
        {
          polarity: 'like',
          wineId: 'wine-angiuli-ndt',
          producer: 'Angiuli Donato',
          wineName: 'Nero di Troia',
          vintage: 2019,
          displayLabel: 'Angiuli Donato Nero di Troia',
        },
      ],
    };
    const hit = applyPreferenceScores(angiuli, null, tasteCtx, []);
    expect(hit.score).toBe(WINE_EXPERIENCE_WEIGHTS.sameWineLike);
    expect(hit.features.some((f) => f.startsWith('wine_experience_like:'))).toBe(
      true
    );
    expect(hit.features.some((f) => f.includes('explicit_grape'))).toBe(false);

    const miss = applyPreferenceScores(
      {
        ...otherWine,
        grapes: ['Nero di Troia'],
        wineName: 'Random Nero',
        producer: 'Other Estate',
      },
      null,
      tasteCtx,
      []
    );
    expect(miss.score).toBe(0);
  });

  it('different vintage of same label gets weaker boost', () => {
    const tasteCtx: TasteScoreContext = {
      tasteProfile: null,
      requestBodyPreference: null,
      wineExperiences: [
        {
          polarity: 'like',
          wineId: 'wine-angiuli-ndt',
          producer: 'Angiuli Donato',
          wineName: 'Nero di Troia',
          vintage: 2019,
          displayLabel: 'Angiuli Donato Nero di Troia',
        },
      ],
    };
    // Same wine_id → treated as same wine (vintage mismatch still weaker path when vintages both set)
    const sameIdDiffVintage: CellarBottleInput = {
      ...angiuli,
      vintage: 2021,
    };
    const r = applyPreferenceScores(sameIdDiffVintage, null, tasteCtx, []);
    expect(r.score).toBe(WINE_EXPERIENCE_WEIGHTS.sameLabelDifferentVintageLike);

    // Different wine_id, same producer+name → other-vintage path
    const r2 = applyPreferenceScores(angiuliOtherVintage, null, tasteCtx, []);
    expect(r2.score).toBe(WINE_EXPERIENCE_WEIGHTS.sameLabelDifferentVintageLike);
  });

  it('dislike penalizes same wine', () => {
    const tasteCtx: TasteScoreContext = {
      tasteProfile: null,
      requestBodyPreference: null,
      wineExperiences: [
        {
          polarity: 'dislike',
          wineId: 'wine-angiuli-ndt',
          producer: 'Angiuli Donato',
          wineName: 'Nero di Troia',
          vintage: 2019,
          displayLabel: 'Angiuli Donato Nero di Troia',
        },
      ],
    };
    const r = applyPreferenceScores(angiuli, null, tasteCtx, []);
    expect(r.score).toBe(WINE_EXPERIENCE_WEIGHTS.sameWineDislike);
  });
});

const angiuliDelta = {
  schema: WINE_EXPERIENCE_SCHEMA,
  wine_id: 'wine-angiuli-ndt',
  bottle_id: 'bottle-angiuli-2019',
  producer: 'Angiuli Donato',
  wine_name: 'Nero di Troia',
  vintage: 2019,
  display_label: 'Angiuli Donato Nero di Troia',
  match_status: 'matched' as const,
};

describe('processWineExperienceMessage persistence', () => {
  function mockSupabase(opts?: {
    rpcEventId?: string;
    activeRows?: Array<Record<string, unknown>>;
    loadRows?: Array<Record<string, unknown>>;
  }) {
    const rpc = vi.fn().mockResolvedValue({
      data: { event_id: opts?.rpcEventId ?? 'evt-new' },
      error: null,
    });
    const active = opts?.activeRows ?? [];
    const loadRows = opts?.loadRows ?? active;
    const eqCalls: Array<{ col: string; val: unknown }> = [];
    const updateEqCalls: Array<{ col: string; val: unknown }> = [];

    function feedbackSelectChain() {
      const resolvedActive = { data: active, error: null };
      const chain: Record<string, unknown> = {};
      chain.eq = (col: string, val: unknown) => {
        eqCalls.push({ col, val });
        return chain;
      };
      // Thenable + chainable: listActive awaits .in(); load uses .in().order().limit()
      chain.in = () => {
        const afterIn: Record<string, unknown> = {
          order: () => ({
            limit: async () => ({ data: loadRows, error: null }),
          }),
          then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
            Promise.resolve(resolvedActive).then(resolve, reject),
        };
        return afterIn;
      };
      chain.order = () => chain;
      chain.limit = async () => ({ data: loadRows, error: null });
      return chain;
    }

    const updateInEq = vi.fn((col: string, val: unknown) => {
      updateEqCalls.push({ col, val });
      return Promise.resolve({ error: null });
    });

    const from = vi.fn().mockImplementation((table: string) => {
      if (table === 'bottles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn((col: string, val: unknown) => {
              eqCalls.push({ col, val });
              return {
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              };
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue(feedbackSelectChain()),
        update: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            eq: updateInEq,
          }),
          eq: vi.fn((col: string, val: unknown) => {
            updateEqCalls.push({ col, val });
            return {
              eq: vi.fn((col2: string, val2: unknown) => {
                updateEqCalls.push({ col: col2, val: val2 });
                return {
                  eq: vi.fn((col3: string, val3: unknown) => {
                    updateEqCalls.push({ col: col3, val: val3 });
                    return {
                      eq: vi.fn((col4: string, val4: unknown) => {
                        updateEqCalls.push({ col: col4, val: val4 });
                        return {
                          select: vi.fn().mockReturnValue({
                            maybeSingle: vi.fn().mockResolvedValue({
                              data: { id: 'evt-1' },
                              error: null,
                            }),
                          }),
                        };
                      }),
                    };
                  }),
                };
              }),
            };
          }),
        }),
      };
    });

    return {
      rpc,
      from,
      eqCalls,
      updateEqCalls,
    } as unknown as {
      rpc: ReturnType<typeof vi.fn>;
      from: ReturnType<typeof vi.fn>;
      eqCalls: Array<{ col: string; val: unknown }>;
      updateEqCalls: Array<{ col: string; val: unknown }>;
    };
  }

  it('saves matched wine with apply_canonical false', async () => {
    const supabase = mockSupabase({ rpcEventId: 'evt-angiuli' });
    const candidate = extractPreferenceEvidence(
      'Remember that I loved Angiuli Donato Nero di Troia'
    )!;
    const result = await processWineExperienceMessage({
      userId: 'user-1',
      message: 'Remember that I loved Angiuli Donato Nero di Troia',
      candidate,
      cellarBottles: [angiuli],
      supabase: supabase as never,
      language: 'en',
    });
    expect(result.kind).toBe('saved');
    expect(result.message).toMatch(/I'll remember you loved/i);
    expect(result.message).toMatch(/without assuming you like every wine of that grape/i);
    expect(supabase.rpc).toHaveBeenCalledWith(
      'apply_taste_evidence_and_canonical',
      expect.objectContaining({
        p_payload: expect.objectContaining({
          apply_canonical: false,
          scope: 'bottle',
          polarity: 'like',
          preference_delta: expect.objectContaining({
            schema: WINE_EXPERIENCE_SCHEMA,
            wine_id: 'wine-angiuli-ndt',
            display_label: expect.stringMatching(/Angiuli/i),
          }),
        }),
      })
    );
  });

  it('clarifies when ambiguous', async () => {
    const twin: CellarBottleInput = {
      ...angiuli,
      id: 'bottle-b',
      wineId: 'wine-b',
      wineName: 'Nero di Troia Riserva',
    };
    const supabase = mockSupabase();
    const candidate = extractPreferenceEvidence(
      'Remember that I loved Angiuli Nero di Troia'
    )!;
    const result = await processWineExperienceMessage({
      userId: 'user-1',
      message: 'Remember that I loved Angiuli Nero di Troia',
      candidate,
      cellarBottles: [angiuli, twin],
      supabase: supabase as never,
      language: 'en',
    });
    expect(result.kind).toBe('clarification');
    expect(result.clarificationOptions?.length).toBeGreaterThanOrEqual(2);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('saves unresolved phrase when no cellar match', async () => {
    const supabase = mockSupabase();
    const candidate = extractPreferenceEvidence(
      'Remember that I loved Angiuli Donato Nero di Troia'
    )!;
    const result = await processWineExperienceMessage({
      userId: 'user-1',
      message: 'Remember that I loved Angiuli Donato Nero di Troia',
      candidate,
      cellarBottles: [],
      supabase: supabase as never,
      language: 'en',
    });
    expect(result.kind).toBe('saved');
    expect(supabase.rpc).toHaveBeenCalledWith(
      'apply_taste_evidence_and_canonical',
      expect.objectContaining({
        p_payload: expect.objectContaining({
          preference_delta: expect.objectContaining({
            match_status: 'unresolved',
            wine_id: null,
          }),
        }),
      })
    );
  });

  it('correction retracts prior like then saves dislike', async () => {
    const supabase = mockSupabase({
      activeRows: [
        {
          id: 'evt-old',
          polarity: 'like',
          preference_delta: angiuliDelta,
        },
      ],
    });
    const candidate = extractPreferenceEvidence(
      'Actually, I did not like Angiuli Donato Nero di Troia'
    )!;
    const result = await processWineExperienceMessage({
      userId: 'user-1',
      message: 'Actually, I did not like Angiuli Donato Nero di Troia',
      candidate,
      cellarBottles: [angiuli],
      supabase: supabase as never,
      language: 'en',
    });
    expect(result.kind).toBe('corrected');
    expect(result.message).toMatch(/Updated your memory/i);
    expect(supabase.rpc).toHaveBeenCalledWith(
      'apply_taste_evidence_and_canonical',
      expect.objectContaining({
        p_payload: expect.objectContaining({
          polarity: 'dislike',
        }),
      })
    );
  });

  it('repeat loved wine is a no-op — no second active write / no stack', async () => {
    const supabase = mockSupabase({
      activeRows: [
        {
          id: 'evt-existing',
          polarity: 'like',
          preference_delta: angiuliDelta,
        },
      ],
    });
    const candidate = extractPreferenceEvidence(
      'Remember that I loved Angiuli Donato Nero di Troia'
    )!;
    const result = await processWineExperienceMessage({
      userId: 'user-1',
      message: 'Remember that I loved Angiuli Donato Nero di Troia',
      candidate,
      cellarBottles: [angiuli],
      supabase: supabase as never,
      language: 'en',
    });
    expect(result.kind).toBe('saved');
    expect(result.eventId).toBe('evt-existing');
    expect(result.message).toMatch(/already remember/i);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('scopes active-identity lookups to the authenticated user', async () => {
    const supabase = mockSupabase();
    const candidate = extractPreferenceEvidence(
      'Remember that I loved Angiuli Donato Nero di Troia'
    )!;
    await processWineExperienceMessage({
      userId: 'user-42',
      message: 'Remember that I loved Angiuli Donato Nero di Troia',
      candidate,
      cellarBottles: [angiuli],
      supabase: supabase as never,
      language: 'en',
    });
    expect(supabase.eqCalls.some((c) => c.col === 'user_id' && c.val === 'user-42')).toBe(
      true
    );
  });
});

describe('edge: profile remove stops scoring', () => {
  const prevEnv = process.env.TASTE_SHORTLIST_SCORING;

  beforeEach(() => {
    process.env.TASTE_SHORTLIST_SCORING = '1';
  });
  afterEach(() => {
    if (prevEnv === undefined) delete process.env.TASTE_SHORTLIST_SCORING;
    else process.env.TASTE_SHORTLIST_SCORING = prevEnv;
  });

  it('retractWineExperienceEvent scopes by user_id + active status', async () => {
    const eqArgs: Array<[string, unknown]> = [];
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: '550e8400-e29b-41d4-a716-446655440000' },
      error: null,
    });
    let chain: Record<string, unknown> = {};
    chain = {
      eq: vi.fn((col: string, val: unknown) => {
        eqArgs.push([col, val]);
        return chain;
      }),
      select: vi.fn().mockReturnValue({ maybeSingle }),
    };
    const update = vi.fn().mockReturnValue(chain);
    const supabase = {
      from: vi.fn().mockReturnValue({ update }),
    };
    const r = await retractWineExperienceEvent({
      userId: 'user-1',
      eventId: '550e8400-e29b-41d4-a716-446655440000',
      supabase: supabase as never,
    });
    expect(r.ok).toBe(true);
    expect(update).toHaveBeenCalledWith({
      status: 'retracted',
      polarity: 'retract',
    });
    expect(eqArgs).toEqual(
      expect.arrayContaining([
        ['id', '550e8400-e29b-41d4-a716-446655440000'],
        ['user_id', 'user-1'],
        ['scope', 'bottle'],
        ['status', 'active'],
      ])
    );
  });

  it('retracted events are not loaded; scoring boost is gone', async () => {
    const eqCalls: Array<{ col: string; val: unknown }> = [];
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn((col: string, val: unknown) => {
            eqCalls.push({ col, val });
            return {
              eq: vi.fn((col2: string, val2: unknown) => {
                eqCalls.push({ col: col2, val: val2 });
                return {
                  eq: vi.fn((col3: string, val3: unknown) => {
                    eqCalls.push({ col: col3, val: val3 });
                    return {
                      in: vi.fn().mockReturnValue({
                        order: vi.fn().mockReturnValue({
                          limit: vi.fn().mockResolvedValue({
                            // DB would not return retracted rows (status=active filter)
                            data: [],
                            error: null,
                          }),
                        }),
                      }),
                    };
                  }),
                };
              }),
            };
          }),
        }),
      }),
    };
    const loaded = await loadActiveWineExperiences('user-1', supabase as never);
    expect(loaded).toEqual([]);
    expect(eqCalls).toEqual(
      expect.arrayContaining([
        { col: 'user_id', val: 'user-1' },
        { col: 'status', val: 'active' },
      ])
    );

    const tasteCtx: TasteScoreContext = {
      tasteProfile: null,
      requestBodyPreference: null,
      wineExperiences: [],
    };
    const scored = applyPreferenceScores(angiuli, null, tasteCtx, []);
    expect(scored.score).toBe(0);
    expect(scored.features.some((f) => f.startsWith('wine_experience'))).toBe(false);
  });
});

describe('edge: bottle_id NULL after cellar delete', () => {
  const prevEnv = process.env.TASTE_SHORTLIST_SCORING;

  beforeEach(() => {
    process.env.TASTE_SHORTLIST_SCORING = '1';
  });
  afterEach(() => {
    if (prevEnv === undefined) delete process.env.TASTE_SHORTLIST_SCORING;
    else process.env.TASTE_SHORTLIST_SCORING = prevEnv;
  });

  it('loads wine_id from preference_delta when row.bottle_id is null', async () => {
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                      data: [
                        {
                          id: 'evt-orphan',
                          bottle_id: null, // FK cleared on bottle delete
                          polarity: 'like',
                          raw_text: 'Remember that I loved Angiuli Donato Nero di Troia',
                          created_at: '2026-09-01T00:00:00.000Z',
                          status: 'active',
                          scope: 'bottle',
                          preference_delta: {
                            ...angiuliDelta,
                            // snapshot retains identity even if FK bottle_id is null
                            bottle_id: 'bottle-angiuli-2019',
                          },
                        },
                      ],
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    };

    const loaded = await loadActiveWineExperiences('user-1', supabase as never);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]!.wineId).toBe('wine-angiuli-ndt');
    expect(loaded[0]!.displayLabel).toMatch(/Angiuli/);
    expect(loaded[0]!.eventId).toBe('evt-orphan');

    const publicItems = toPublicWineExperienceItems(loaded);
    expect(publicItems[0]!.id).toBe('evt-orphan');
    expect(publicItems[0]!.wineId).toBe('wine-angiuli-ndt');
    expect(publicItems[0]!.label).toMatch(/Angiuli/);

    const tasteCtx: TasteScoreContext = {
      tasteProfile: null,
      requestBodyPreference: null,
      wineExperiences: loaded.map((w) => ({
        polarity: w.polarity,
        wineId: w.wineId,
        producer: w.producer,
        wineName: w.wineName,
        vintage: w.vintage,
        displayLabel: w.displayLabel,
      })),
    };
    // New cellar bottle with same wine_id still gets the boost
    const scored = applyPreferenceScores(angiuli, null, tasteCtx, []);
    expect(scored.score).toBe(WINE_EXPERIENCE_WEIGHTS.sameWineLike);
  });
});

describe('edge: dedupe prevents stacked scoring', () => {
  const prevEnv = process.env.TASTE_SHORTLIST_SCORING;

  beforeEach(() => {
    process.env.TASTE_SHORTLIST_SCORING = '1';
  });
  afterEach(() => {
    if (prevEnv === undefined) delete process.env.TASTE_SHORTLIST_SCORING;
    else process.env.TASTE_SHORTLIST_SCORING = prevEnv;
  });

  it('dedupeWineExperiencesByIdentity keeps one signal per wine', () => {
    const dup = dedupeWineExperiencesByIdentity([
      {
        eventId: 'newer',
        polarity: 'like',
        displayLabel: 'Angiuli Donato Nero di Troia',
        wineId: 'wine-angiuli-ndt',
        bottleId: null,
        producer: 'Angiuli Donato',
        wineName: 'Nero di Troia',
        vintage: 2019,
        matchStatus: 'matched',
        softGrapeHint: null,
        rawText: null,
        createdAt: '2026-09-02',
      },
      {
        eventId: 'older',
        polarity: 'like',
        displayLabel: 'Angiuli Donato Nero di Troia',
        wineId: 'wine-angiuli-ndt',
        bottleId: 'b1',
        producer: 'Angiuli Donato',
        wineName: 'Nero di Troia',
        vintage: 2019,
        matchStatus: 'matched',
        softGrapeHint: null,
        rawText: null,
        createdAt: '2026-09-01',
      },
    ]);
    expect(dup).toHaveLength(1);
    expect(dup[0]!.eventId).toBe('newer');

    const tasteCtx: TasteScoreContext = {
      tasteProfile: null,
      requestBodyPreference: null,
      wineExperiences: dup.map((w) => ({
        polarity: w.polarity,
        wineId: w.wineId,
        producer: w.producer,
        wineName: w.wineName,
        vintage: w.vintage,
        displayLabel: w.displayLabel,
      })),
    };
    expect(applyPreferenceScores(angiuli, null, tasteCtx, []).score).toBe(
      WINE_EXPERIENCE_WEIGHTS.sameWineLike
    );
  });
});

describe('retractWineExperienceEvent', () => {
  it('marks active event retracted', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: '550e8400-e29b-41d4-a716-446655440000' },
      error: null,
    });
    const supabase = {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    maybeSingle,
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    };
    const r = await retractWineExperienceEvent({
      userId: 'user-1',
      eventId: '550e8400-e29b-41d4-a716-446655440000',
      supabase: supabase as never,
    });
    expect(r.ok).toBe(true);
  });
});

describe('toPublicWineExperienceItems', () => {
  it('formats vintage in label', () => {
    const items = toPublicWineExperienceItems([
      {
        eventId: 'e1',
        polarity: 'like',
        displayLabel: 'Angiuli Donato Nero di Troia',
        wineId: 'w1',
        bottleId: 'b1',
        producer: 'Angiuli Donato',
        wineName: 'Nero di Troia',
        vintage: 2019,
        matchStatus: 'matched',
        softGrapeHint: 'nero_di_troia',
        rawText: 'Remember that I loved Angiuli Donato Nero di Troia',
        createdAt: null,
      },
    ]);
    expect(items[0]!.label).toBe('Angiuli Donato Nero di Troia (2019)');
  });
});
