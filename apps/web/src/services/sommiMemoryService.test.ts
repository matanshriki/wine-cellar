/**
 * Web Sommi memory helpers — labels, counts, empty vs inferred distinction.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  countPublicSommiMemory,
  extractPublicSommiMemory,
  previewMemoryLabels,
} from './sommiMemoryView';
import { formatMemoryIdFallback, resolveMemoryItemLabel } from './sommiMemoryLabels';
import {
  createProfileMemoryOperationId,
  isProfileMemoryOperationId,
  resolveOperationIdForAttempt,
  shouldRetainOperationIdAfterFailure,
} from './sommiMemoryOperation';
import type { TasteProfile } from '../types/supabase';

const t = (_key: string, fallback: string) => fallback;

describe('sommiMemory web helpers', () => {
  it('extracts liked/disliked regions and grapes with localized labels', () => {
    const profile = {
      version: 2,
      vector: { body: 0.5, tannin: 0.5, acidity: 0.5, oak: 0.5, sweetness: 0.2, power: 0.5 },
      preferences: {
        reds_bias: 0,
        whites_bias: 0,
        sparkling_bias: 0,
        style_tags: {},
        regions: { Rioja: 0.9 },
        grapes: {},
      },
      explicit: {
        regions_liked: [{ id: 'rioja', confidence: 0.9, label_en: 'Rioja', label_he: 'ריוחה' }],
        regions_disliked: [{ id: 'bordeaux', confidence: 0.9, label_en: 'Bordeaux' }],
        grapes_liked: [{ id: 'cabernet', confidence: 0.9, label_en: 'Cabernet' }],
        grapes_disliked: [{ id: 'merlot', confidence: 0.9, label_en: 'Merlot' }],
        body: { value: 'full' as const, confidence: 0.9 },
      },
      confidence: 'med' as const,
      data_points: { rated_count: 4, last_rated_at: null },
    } satisfies TasteProfile;

    const en = extractPublicSommiMemory(profile, 'en', t);
    expect(en.regions_liked[0].label).toBe('Rioja');
    expect(en.regions_disliked[0].label).toBe('Bordeaux');
    expect(en.grapes_liked[0].label).toBe('Cabernet');
    expect(en.grapes_disliked[0].label).toBe('Merlot');
    expect(en.body?.label.toLowerCase()).toMatch(/full/);

    const he = extractPublicSommiMemory(profile, 'he', t);
    expect(he.regions_liked[0].label).toBe('ריוחה');
  });

  it('hides internal fields from extracted public memory', () => {
    const profile = {
      version: 2,
      vector: { body: 0.5, tannin: 0.5, acidity: 0.5, oak: 0.5, sweetness: 0.2, power: 0.5 },
      preferences: {
        reds_bias: 0,
        whites_bias: 0,
        sparkling_bias: 0,
        style_tags: {},
        regions: {},
        grapes: {},
      },
      explicit: {
        regions_liked: [
          {
            id: 'rioja',
            confidence: 0.99,
            label_en: 'Rioja',
            source: 'chat',
            evidence_event_ids: ['x'],
          },
        ],
        legacy_suppress: { regions: ['napa'] },
      },
      confidence: 'high' as const,
      data_points: { rated_count: 1, last_rated_at: null },
    } as unknown as TasteProfile;

    const memory = extractPublicSommiMemory(profile, 'en', t);
    expect(JSON.stringify(memory)).not.toMatch(/legacy_suppress|confidence|evidence|source/);
    expect(countPublicSommiMemory(memory)).toBe(1);
  });

  it('empty explicit memory is distinct from inferred preferences map', () => {
    const profile: TasteProfile = {
      version: 1,
      vector: { body: 0.5, tannin: 0.5, acidity: 0.5, oak: 0.5, sweetness: 0.2, power: 0.5 },
      preferences: {
        reds_bias: 0.4,
        whites_bias: 0,
        sparkling_bias: 0,
        style_tags: {},
        regions: { Rioja: 0.8 },
        grapes: { Tempranillo: 0.7 },
      },
      confidence: 'med',
      data_points: { rated_count: 5, last_rated_at: null },
    };
    const memory = extractPublicSommiMemory(profile, 'en', t);
    expect(countPublicSommiMemory(memory)).toBe(0);
    expect(previewMemoryLabels(memory)).toEqual({ labels: [], moreCount: 0 });
    expect(Object.keys(profile.preferences.regions)).toContain('Rioja');
  });

  it('preview shows +N more when capped', () => {
    const memory = {
      regions_liked: [
        { id: 'rioja', label: 'Rioja' },
        { id: 'napa', label: 'Napa' },
      ],
      regions_disliked: [],
      grapes_liked: [
        { id: 'nebbiolo', label: 'Nebbiolo' },
        { id: 'cabernet_sauvignon', label: 'Cabernet Sauvignon' },
      ],
      grapes_disliked: [],
      styles_liked: [{ id: 'amarone', label: 'Amarone' }],
      styles_disliked: [],
      body: { value: 'full' as const, label: 'Full' },
    };
    const preview = previewMemoryLabels(memory, 4);
    expect(preview.labels).toHaveLength(4);
    expect(preview.moreCount).toBe(2);
    expect(countPublicSommiMemory(memory)).toBe(6);
  });

  it('formats id fallback without snake_case', () => {
    expect(formatMemoryIdFallback('pinot_noir')).toBe('Pinot Noir');
    expect(resolveMemoryItemLabel('grape', { id: 'pinot_noir' }, 'en')).toBe('Pinot Noir');
    expect(resolveMemoryItemLabel('style', { id: 'amarone' }, 'he')).toBe('אמרונה');
  });
});

describe('sommiMemory operation ID lifecycle', () => {
  it('creates UUID-shaped operation IDs', () => {
    const id = createProfileMemoryOperationId();
    expect(isProfileMemoryOperationId(id)).toBe(true);
  });

  it('10: retry reuses the same operation ID', () => {
    const existing = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    expect(resolveOperationIdForAttempt(existing)).toBe(existing);
  });

  it('11: retain ID on unknown failure; clear on definitive reject', () => {
    expect(shouldRetainOperationIdAfterFailure('network')).toBe(true);
    expect(shouldRetainOperationIdAfterFailure(500)).toBe(true);
    expect(shouldRetainOperationIdAfterFailure(400)).toBe(false);
    expect(shouldRetainOperationIdAfterFailure(404)).toBe(false);
    expect(shouldRetainOperationIdAfterFailure(409)).toBe(false);
    expect(shouldRetainOperationIdAfterFailure(503)).toBe(false);
  });

  it('12: double-click resolve keeps a single ID when one is already active', () => {
    const first = resolveOperationIdForAttempt(null);
    const second = resolveOperationIdForAttempt(first);
    expect(second).toBe(first);
  });
});

describe('mutateSommiMemory operationId wire-up', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('sends operationId in the request body', async () => {
    vi.doMock('../lib/supabase', () => ({
      supabase: {
        auth: {
          getSession: async () => ({
            data: { session: { access_token: 'tok' } },
          }),
        },
      },
    }));

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        ok: true,
        memory: {
          regions_liked: [],
          regions_disliked: [],
          grapes_liked: [],
          grapes_disliked: [],
          body: null,
        },
      }),
    }));
    globalThis.fetch = fetchMock as any;

    const { mutateSommiMemory } = await import('./sommiMemoryService');
    const op = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    await mutateSommiMemory(
      { type: 'remove_region', polarity: 'like', id: 'rioja' },
      'en',
      op
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(String(init.body));
    expect(body.operationId).toBe(op);
    expect(body.type).toBe('remove_region');
  });
});
