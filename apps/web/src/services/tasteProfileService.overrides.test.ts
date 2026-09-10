import { describe, it, expect } from 'vitest';
import type { TasteProfile } from '../types/supabase';
import { attachPreservedOverrides } from './tasteProfileOverrides';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function baseProfile(overrides?: TasteProfile['overrides']): TasteProfile {
  return {
    version: 1,
    vector: {
      body: 0.4,
      tannin: 0.4,
      acidity: 0.5,
      oak: 0.3,
      sweetness: 0.2,
      power: 0.4,
    },
    preferences: {
      reds_bias: 0.2,
      whites_bias: -0.1,
      sparkling_bias: 0,
      style_tags: { bold: 0.5 },
      regions: { Bordeaux: 0.8 },
      grapes: { Merlot: 0.6 },
    },
    ...(overrides ? { overrides } : {}),
    confidence: 'low',
    data_points: { rated_count: 3, last_rated_at: '2026-01-01T00:00:00.000Z' },
  };
}

describe('attachPreservedOverrides', () => {
  it('A: existing overrides survive recompute (preserveOverrides=true)', () => {
    const previous = baseProfile({ vector: { body: 0.9, oak: 0.1 } });
    const computed = baseProfile();
    computed.vector.body = 0.55;
    computed.confidence = 'med';
    computed.data_points = { rated_count: 8, last_rated_at: '2026-09-01T00:00:00.000Z' };
    delete computed.overrides;

    const result = attachPreservedOverrides(computed, previous, true);

    expect(result.overrides?.vector).toEqual({ body: 0.9, oak: 0.1 });
  });

  it('B: computed vector/preferences/confidence/data_points still come from the new computation', () => {
    const previous = baseProfile({ vector: { body: 0.9 } });
    previous.vector.body = 0.1;
    previous.preferences.regions = { Old: 1 };
    previous.confidence = 'low';
    previous.data_points = { rated_count: 2, last_rated_at: '2020-01-01T00:00:00.000Z' };

    const computed = baseProfile();
    computed.vector = {
      body: 0.7,
      tannin: 0.6,
      acidity: 0.55,
      oak: 0.4,
      sweetness: 0.15,
      power: 0.65,
    };
    computed.preferences = {
      reds_bias: 0.9,
      whites_bias: 0,
      sparkling_bias: 0,
      style_tags: {},
      regions: { Rioja: 1 },
      grapes: { Tempranillo: 1 },
    };
    computed.confidence = 'high';
    computed.data_points = { rated_count: 20, last_rated_at: '2026-09-10T00:00:00.000Z' };

    const result = attachPreservedOverrides(computed, previous, true);

    expect(result.vector).toEqual(computed.vector);
    expect(result.preferences).toEqual(computed.preferences);
    expect(result.confidence).toBe('high');
    expect(result.data_points).toEqual(computed.data_points);
    expect(result.overrides?.vector).toEqual({ body: 0.9 });
  });

  it('C: profile without overrides recomputes normally', () => {
    const previous = baseProfile();
    delete previous.overrides;
    const computed = baseProfile();
    computed.vector.body = 0.62;
    delete computed.overrides;

    const result = attachPreservedOverrides(computed, previous, true);

    expect(result.overrides).toBeUndefined();
    expect(result.vector.body).toBe(0.62);
  });

  it('C2: null previous with preserve still returns computed fields without overrides', () => {
    const computed = baseProfile();
    delete computed.overrides;
    computed.confidence = 'med';

    const result = attachPreservedOverrides(computed, null, true);

    expect(result.overrides).toBeUndefined();
    expect(result.confidence).toBe('med');
  });

  it('D: Reset path (preserveOverrides=false) drops overrides and does not reattach them', () => {
    const previous = baseProfile({ vector: { body: 0.95, tannin: 0.2 } });
    const computed = baseProfile();
    computed.vector.body = 0.5;
    delete computed.overrides;

    const result = attachPreservedOverrides(computed, previous, false);

    expect(result.overrides).toBeUndefined();
    expect(result.vector.body).toBe(0.5);
  });

  it('F: does not mutate the previous or computed profile objects', () => {
    const previous = baseProfile({ vector: { body: 0.9 } });
    const computed = baseProfile();
    computed.vector.body = 0.33;
    delete computed.overrides;

    const previousSnapshot = structuredClone(previous);
    const computedSnapshot = structuredClone(computed);

    const result = attachPreservedOverrides(computed, previous, true);

    expect(previous).toEqual(previousSnapshot);
    expect(computed).toEqual(computedSnapshot);
    expect(result).not.toBe(computed);
    expect(result).not.toBe(previous);
    expect(result.overrides).not.toBe(previous.overrides);
    expect(result.overrides?.vector).not.toBe(previous.overrides?.vector);

    // Mutating the result must not leak into previous
    result.overrides!.vector!.body = 0.11;
    expect(previous.overrides?.vector?.body).toBe(0.9);
  });
});

describe('rating callers preserve overrides by default (E)', () => {
  it('historyService rating paths call recomputeMyTasteProfile without opting out of preservation', () => {
    const src = readFileSync(resolve(__dirname, './historyService.ts'), 'utf8');
    const calls = [...src.matchAll(/recomputeMyTasteProfile\(([^)]*)\)/g)];
    expect(calls.length).toBeGreaterThanOrEqual(2);
    for (const match of calls) {
      expect(match[1]).not.toMatch(/preserveOverrides\s*:\s*false/);
    }
  });

  it('TasteProfileCard Reset goes through resetTasteProfile (explicit discard), Recompute uses default preserve', () => {
    const src = readFileSync(
      resolve(__dirname, '../components/TasteProfileCard.tsx'),
      'utf8'
    );
    expect(src).toMatch(/recomputeMyTasteProfile\(\)/);
    expect(src).toMatch(/resetTasteProfile\(\)/);
    expect(src).not.toMatch(/recomputeMyTasteProfile\(\s*\{\s*preserveOverrides\s*:\s*false/);
  });

  it('resetTasteProfile explicitly opts out of preservation', () => {
    const src = readFileSync(resolve(__dirname, './tasteProfileService.ts'), 'utf8');
    expect(src).toMatch(
      /export async function resetTasteProfile[\s\S]*?recomputeMyTasteProfile\(\s*\{\s*preserveOverrides:\s*false\s*\}\s*\)/
    );
    expect(src).toMatch(
      /preserveOverrides = options\.preserveOverrides !== false/
    );
  });
});
