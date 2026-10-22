import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/supabase', () => ({ supabase: {} }));

import type { BottleWithWineInfo } from './bottleService';
import type { WineProfile } from './wineProfileService';
import {
  DEFAULT_CHOICES,
  applySwap,
  buildFoodProfile,
  buildLineup,
  fitReasons,
  initialPlannerState,
  isLightToFull,
  plannerReducer,
  servingGuidance,
  servingStage,
  singleFlight,
  stageReason,
  swapAlternatives,
  withProtein,
  type LineupSlot,
  type PlanChoices,
  type PlannerState,
} from './eveningPlanner';

function profile(power: number, extra: Partial<WineProfile> = {}): WineProfile {
  return {
    body: 3, tannin: 3, acidity: 3, oak: 2, sweetness: 0, alcohol_est: 13, power,
    style_tags: [], confidence: 'med', source: 'heuristic', updated_at: '2026-01-01', ...extra,
  };
}

let seq = 0;
function bottle(over: Record<string, unknown> = {}, wineOver: Record<string, unknown> = {}): BottleWithWineInfo {
  seq += 1;
  return {
    id: `b${seq}`,
    quantity: 1,
    readiness_label: 'READY',
    ...over,
    wine: { id: `w${seq}`, wine_name: `Wine ${seq}`, producer: 'P', color: 'red', rating: 4.4, vintage: 2018, ...wineOver },
  } as unknown as BottleWithWineInfo;
}

const powers = new Map<string, WineProfile>();
const profileOf = (b: BottleWithWineInfo) => powers.get(b.id) ?? profile(5);
const noJitter = () => 0;
const choices = (patch: Partial<PlanChoices> = {}): PlanChoices => ({ ...DEFAULT_CHOICES, ...patch });

describe('food choices', () => {
  it('"No food" clears hidden sauce/spice/smoke so they cannot affect the request', () => {
    const spicy = { protein: 'beef' as const, sauce: 'bbq' as const, spice: 'high' as const, smoke: 'high' as const };
    const cleared = withProtein(spicy, 'none');
    expect(cleared).toEqual({ protein: 'none', sauce: 'none', spice: 'low', smoke: 'low' });
    expect(buildFoodProfile(cleared)).toBeNull();
  });

  it('switching between dishes keeps the chosen details', () => {
    const food = withProtein({ protein: 'beef', sauce: 'tomato', spice: 'med', smoke: 'low' }, 'lamb');
    expect(food).toMatchObject({ protein: 'lamb', sauce: 'tomato', spice: 'med' });
    expect(buildFoodProfile(food)?.fat).toBe('high');
  });

  it('the reducer ignores dish-detail edits while "No food" is selected', () => {
    const s = plannerReducer(initialPlannerState, { type: 'food', patch: { spice: 'high' } });
    expect(s.choices.food.spice).toBe('low');
  });
});

describe('lineup constraints', () => {
  it('excludes opened, reserved, non-red (reds only) and sub-4.2 Vivino bottles', () => {
    const ok = bottle();
    const pool = [
      ok,
      bottle({ quantity: 0 }),
      bottle({ is_reserved: true }),
      bottle({}, { color: 'white' }),
      bottle({}, { rating: 4.1 }),
    ];
    const { slots, eligibleCount } = buildLineup(pool, choices({ redsOnly: true }), { profileOf, random: noJitter });
    expect(slots.map((s) => s.bottle.id)).toEqual([ok.id]);
    expect(eligibleCount).toBe(1);
  });

  it('returns fewer wines rather than breaking a filter, and reports what was asked for', () => {
    const pool = [bottle(), bottle()];
    const result = buildLineup(pool, choices({ groupSize: '5-8' }), { profileOf, random: noJitter });
    expect(result.requested).toBe(4);
    expect(result.slots).toHaveLength(2);
  });

  it('never puts two bottles of the same wine in a lineup', () => {
    const a = bottle({}, { id: 'same' });
    const b = bottle({}, { id: 'same' });
    const c = bottle();
    const { slots } = buildLineup([a, b, c], choices(), { profileOf, random: noJitter });
    expect(new Set(slots.map((s) => s.bottle.wine.id)).size).toBe(slots.length);
  });

  it('orders the lineup lighter to fuller and numbers positions from 1', () => {
    const heavy = bottle();
    const light = bottle();
    const mid = bottle();
    powers.set(heavy.id, profile(9)).set(light.id, profile(2)).set(mid.id, profile(5));
    const { slots } = buildLineup([heavy, light, mid], choices(), { profileOf, random: noJitter });
    expect(slots.map((s) => s.bottle.id)).toEqual([light.id, mid.id, heavy.id]);
    expect(slots.map((s) => s.position)).toEqual([1, 2, 3]);
    expect(isLightToFull(slots)).toBe(true);
  });
});

describe('swap', () => {
  const lineupOf = (...bs: BottleWithWineInfo[]): LineupSlot[] => bs.map((b, i) => ({ bottle: b, profile: profile(i + 1), position: i + 1 }));

  it('offers only eligible wines that are not already in the lineup', () => {
    const inA = bottle();
    const inB = bottle();
    const sameWineAsA = bottle({}, { id: inA.wine.id });
    const reserved = bottle({ is_reserved: true });
    const empty = bottle({ quantity: 0 });
    const free = bottle();
    const options = swapAlternatives([inA, inB, sameWineAsA, reserved, empty, free], choices(), lineupOf(inA, inB), { profileOf });
    expect(options.map((o) => o.bottle.id)).toEqual([free.id]);
  });

  it('respects reds-only and the Vivino filter for alternatives too', () => {
    const inA = bottle();
    const white = bottle({}, { color: 'white' });
    const low = bottle({}, { rating: 3.9 });
    expect(swapAlternatives([inA, white, low], choices({ redsOnly: true }), lineupOf(inA), { profileOf })).toEqual([]);
  });

  it('replaces only the chosen slot and keeps positions', () => {
    const [a, b, c, alt] = [bottle(), bottle(), bottle(), bottle()];
    const lineup = lineupOf(a, b, c);
    const next = applySwap(lineup, 2, alt, profile(7));
    expect(next.map((s) => s.bottle.id)).toEqual([a.id, alt.id, c.id]);
    expect(next[0]).toBe(lineup[0]);
    expect(next[2]).toBe(lineup[2]);
    expect(next[1].profile.power).toBe(7);
  });

  it('refuses a swap that would duplicate a wine already in the lineup', () => {
    const [a, b] = [bottle(), bottle()];
    const lineup = lineupOf(a, b);
    expect(applySwap(lineup, 2, a, profile(1))).toBe(lineup);
    expect(applySwap(lineup, 2, bottle({}, { id: a.wine.id }), profile(1))).toBe(lineup);
  });

  it('flags a lineup that is no longer lighter-to-fuller after a swap', () => {
    const [a, b, c, alt] = [bottle(), bottle(), bottle(), bottle()];
    expect(isLightToFull(applySwap(lineupOf(a, b, c), 1, alt, profile(9)))).toBe(false);
  });
});

describe('planner state', () => {
  const generated = (state: PlannerState) => {
    const slots: LineupSlot[] = [{ bottle: bottle(), profile: profile(3), position: 1 }];
    return plannerReducer(plannerReducer(state, { type: 'generateStart' }), { type: 'generateDone', result: { slots, requested: 3, eligibleCount: 1 } });
  };

  it('Back from review keeps every planning choice and the lineup', () => {
    let s = plannerReducer(initialPlannerState, { type: 'choices', patch: { occasion: 'bbq', groupSize: '5-8', redsOnly: true, startTime: '2hours' } });
    s = plannerReducer(s, { type: 'protein', protein: 'beef' });
    s = plannerReducer(s, { type: 'food', patch: { smoke: 'high' } });
    const before = s.choices;
    s = generated(s);
    expect(s.step).toBe('review');
    s = plannerReducer(s, { type: 'back' });
    expect(s.step).toBe('plan');
    expect(s.choices).toEqual(before);
    expect(s.lineup).toHaveLength(1);
  });

  it('ignores a second Generate while one is running', () => {
    const s1 = plannerReducer(initialPlannerState, { type: 'generateStart' });
    expect(plannerReducer(s1, { type: 'generateStart' })).toBe(s1);
    expect(plannerReducer(s1, { type: 'startBegin' })).toBe(s1);
  });

  it('ignores a second Start evening while one is running, and Back is blocked meanwhile', () => {
    const s1 = plannerReducer(generated(initialPlannerState), { type: 'startBegin' });
    expect(s1.busy).toBe('starting');
    expect(plannerReducer(s1, { type: 'startBegin' })).toBe(s1);
    expect(plannerReducer(s1, { type: 'back' })).toBe(s1);
  });

  it('keeps inputs and lineup after a failed start or generate', () => {
    const reviewed = generated(initialPlannerState);
    const failedStart = plannerReducer(plannerReducer(reviewed, { type: 'startBegin' }), { type: 'startFailed' });
    expect(failedStart).toMatchObject({ step: 'review', busy: 'idle', error: 'startFailed', lineup: reviewed.lineup });
    const failedGen = plannerReducer(plannerReducer(initialPlannerState, { type: 'generateStart' }), { type: 'generateFailed' });
    expect(failedGen).toMatchObject({ step: 'plan', busy: 'idle', error: 'generateFailed', choices: initialPlannerState.choices });
  });

  it('stays on the plan step with a clear error when no bottle is eligible', () => {
    const s = plannerReducer(plannerReducer(initialPlannerState, { type: 'generateStart' }), {
      type: 'generateDone',
      result: { slots: [], requested: 3, eligibleCount: 0 },
    });
    expect(s).toMatchObject({ step: 'plan', error: 'noEligible', busy: 'idle' });
  });
});

describe('singleFlight', () => {
  it('runs the action once for concurrent calls and allows a new run afterwards', async () => {
    let calls = 0;
    let release!: () => void;
    const run = singleFlight(() => {
      calls += 1;
      return new Promise<void>((r) => { release = r; });
    });
    const p1 = run();
    const p2 = run();
    expect(p2).toBe(p1);
    release();
    await p1;
    expect(calls).toBe(1);
    const p3 = run();
    release();
    await p3;
    expect(calls).toBe(2);
  });

  it('clears the in-flight lock after a failure so the user can retry', async () => {
    let calls = 0;
    const run = singleFlight(async () => {
      calls += 1;
      throw new Error('network');
    });
    await expect(run()).rejects.toThrow('network');
    await expect(run()).rejects.toThrow('network');
    expect(calls).toBe(2);
  });
});

describe('review explanations', () => {
  const slots = (...p: number[]): LineupSlot[] => p.map((power, i) => ({ bottle: bottle(), profile: profile(power), position: i + 1 }));

  it('names serving stages by position', () => {
    expect([0, 1, 2].map((i) => servingStage(i, 3))).toEqual(['opener', 'middle', 'main']);
    expect(servingStage(0, 1)).toBe('only');
    expect([0, 1].map((i) => servingStage(i, 2))).toEqual(['opener', 'main']);
  });

  it('claims lighter/fuller positions only when the intensity estimates differ', () => {
    const ordered = slots(2, 5, 8);
    expect([0, 1, 2].map((i) => stageReason(ordered, i))).toEqual(['lighterStart', 'bridge', 'fullestLast']);
    const flat = slots(5, 5, 5);
    expect([0, 1, 2].map((i) => stageReason(flat, i))).toEqual([null, null, null]);
  });

  it('cites pairing reasons only from stored AI/Vivino structure', () => {
    const beef = buildFoodProfile({ protein: 'beef', sauce: 'none', spice: 'low', smoke: 'low' });
    const guessed = { bottle: bottle(), profile: profile(8, { body: 5, tannin: 5 }) };
    expect(fitReasons(guessed, beef).some((r) => r.kind === 'pairing')).toBe(false);
    const stored = { bottle: bottle(), profile: profile(8, { body: 5, tannin: 5, source: 'ai' }) };
    expect(fitReasons(stored, beef)[0]).toEqual({ kind: 'pairing', key: 'meatTanninBody', tone: 'positive' });
  });

  it('falls back to readiness, and never adds food reasons without a dish', () => {
    const stored = { bottle: bottle({ readiness_label: 'PEAK_SOON' }), profile: profile(8, { body: 5, tannin: 5, source: 'ai' }) };
    expect(fitReasons(stored, null)).toEqual([{ kind: 'readiness', key: 'peakSoon' }]);
  });

  it('reads serving guidance only when well-formed', () => {
    expect(servingGuidance(bottle({ serving_guidance: { temp_min: 16, temp_max: 18, decanting: 'recommended', decant_min: 30, decant_max: 60 } })))
      .toEqual({ temp: { min: 16, max: 18 }, decant: { min: 30, max: 60 } });
    expect(servingGuidance(bottle({ serving_guidance: { temp_min: 18, temp_max: 12, decanting: 'none' } }))).toBeNull();
    expect(servingGuidance(bottle({ serving_guidance: { decanting: 'optional', decant_min: 20 } }))).toBeNull();
    expect(servingGuidance(bottle())).toBeNull();
  });
});
