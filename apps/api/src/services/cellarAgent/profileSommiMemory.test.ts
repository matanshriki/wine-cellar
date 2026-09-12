/**
 * Profile Sommi memory — public DTO + operation-scoped idempotency tests.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  countPublicSommiMemory,
  parseProfileMemoryAction,
  publicMemoryFromProfile,
  resolvePublicLabel,
  toPublicSommiMemory,
  applyProfileSommiMemoryAction,
} from './profileSommiMemory.js';
import {
  isProfileMemoryOperationId,
  parseProfileMemoryOperationId,
  profileMemoryIdempotencyKey,
} from './profileMemoryOperation.js';
import type { StructuredTasteProfile } from './tasteProfileTypes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const prev = process.env.CANONICAL_TASTE_WRITES;

const OP_A = '11111111-1111-4111-a111-111111111111';
const OP_B = '22222222-2222-4222-a222-222222222222';
const OP_C = '33333333-3333-4333-a333-333333333333';

function profileWithExplicit(
  explicit: StructuredTasteProfile['explicit']
): StructuredTasteProfile {
  return {
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
    explicit,
    confidence: 'med',
    data_points: { rated_count: 3, last_rated_at: null },
  };
}

function emptyExplicit() {
  return {
    regions_liked: [] as { id: string; confidence: number; label_en?: string }[],
    regions_disliked: [] as { id: string; confidence: number; label_en?: string }[],
    grapes_liked: [] as { id: string; confidence: number; label_en?: string }[],
    grapes_disliked: [] as { id: string; confidence: number; label_en?: string }[],
    styles_liked: [] as never[],
    styles_disliked: [] as never[],
    body: null as { value: 'light' | 'medium' | 'full'; confidence: number } | null,
  };
}

function mockSupabase(opts: {
  getExplicit: () => StructuredTasteProfile['explicit'];
  onRpc?: (
    name: string,
    args: { p_payload: Record<string, unknown> }
  ) => { data: unknown; error: unknown };
}) {
  const rpcCalls: { name: string; payload: Record<string, unknown> }[] = [];
  const supabase = {
    from(table: string) {
      if (table === 'profiles') {
        return {
          select() {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    return {
                      data: { taste_profile: profileWithExplicit(opts.getExplicit()) },
                      error: null,
                    };
                  },
                };
              },
            };
          },
        };
      }
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => ({ data: { preferences: {} }, error: null }),
              };
            },
          };
        },
        upsert: async () => ({ error: null }),
      };
    },
    async rpc(name: string, args: { p_payload: Record<string, unknown> }) {
      rpcCalls.push({ name, payload: args.p_payload });
      if (opts.onRpc) return opts.onRpc(name, args) as any;
      throw new Error(`unexpected rpc ${name}`);
    },
  } as any;
  return { supabase, rpcCalls };
}

describe('profileSommiMemory public view', () => {
  it('hides legacy_suppress, confidence, evidence, and source from public DTO', () => {
    const memory = toPublicSommiMemory(
      {
        regions_liked: [
          {
            id: 'rioja',
            confidence: 0.9,
            source: 'chat',
            evidence_event_ids: ['evt-1'],
            label_en: 'Rioja',
            label_he: 'ריוחה',
          },
        ],
        regions_disliked: [],
        grapes_liked: [],
        grapes_disliked: [],
        styles_liked: [],
        styles_disliked: [],
        body: { value: 'full', confidence: 0.9, source: 'chat' },
        legacy_suppress: { regions: ['bordeaux'], body: true },
      },
      'en'
    );
    expect(JSON.stringify(memory)).not.toMatch(/legacy_suppress|confidence|evidence|source/);
    expect(memory.regions_liked).toEqual([{ id: 'rioja', label: 'Rioja' }]);
    expect(memory.body).toEqual({ value: 'full', label: 'full-bodied' });
    expect(countPublicSommiMemory(memory)).toBe(2);
  });

  it('uses Hebrew labels when language is he', () => {
    expect(
      resolvePublicLabel('region', { id: 'rioja', label_en: 'Rioja', label_he: 'ריוחה' }, 'he')
    ).toBe('ריוחה');
  });

  it('falls back to catalog then formatted id', () => {
    expect(resolvePublicLabel('region', { id: 'rioja' }, 'en')).toBe('Rioja');
    expect(resolvePublicLabel('grape', { id: 'obscure_grape' }, 'en')).toBe('Obscure Grape');
  });

  it('counts only visible explicit preferences', () => {
    const memory = publicMemoryFromProfile(
      profileWithExplicit({
        regions_liked: [{ id: 'rioja', confidence: 0.9, label_en: 'Rioja' }],
        regions_disliked: [{ id: 'bordeaux', confidence: 0.9, label_en: 'Bordeaux' }],
        grapes_liked: [],
        grapes_disliked: [{ id: 'merlot', confidence: 0.9, label_en: 'Merlot' }],
        styles_liked: [],
        styles_disliked: [],
        body: { value: 'light', confidence: 0.9 },
        legacy_suppress: { regions: ['napa'] },
      })
    );
    expect(countPublicSommiMemory(memory)).toBe(4);
  });
});

describe('parseProfileMemoryAction + operationId', () => {
  it('accepts allowlisted actions only', () => {
    expect(
      parseProfileMemoryAction({ type: 'remove_region', polarity: 'like', id: 'rioja' })
    ).toEqual({ type: 'remove_region', polarity: 'like', id: 'rioja' });
    expect(
      parseProfileMemoryAction({ type: 'replace_body', value: 'medium', from: 'full' })
    ).toEqual({ type: 'replace_body', value: 'medium', from: 'full' });
    expect(parseProfileMemoryAction({ type: 'clear_body', from: 'full' })).toEqual({
      type: 'clear_body',
      from: 'full',
    });
    expect(parseProfileMemoryAction({ type: 'replace_body', value: 'medium' })).toBeNull();
    expect(parseProfileMemoryAction({ type: 'clear_body' })).toBeNull();
    expect(parseProfileMemoryAction({ type: 'add_region', id: 'rioja' })).toBeNull();
  });

  it('13: rejects missing/invalid operation IDs', () => {
    expect(parseProfileMemoryOperationId({})).toBeNull();
    expect(parseProfileMemoryOperationId({ operationId: 'not-a-uuid' })).toBeNull();
    expect(parseProfileMemoryOperationId({ operationId: OP_A })).toBe(OP_A);
    expect(isProfileMemoryOperationId(OP_A)).toBe(true);
    expect(profileMemoryIdempotencyKey(OP_A)).toBe(`profile_memory_action_${OP_A}`);
  });
});

describe('applyProfileSommiMemoryAction atomic RPC', () => {
  beforeEach(() => {
    process.env.CANONICAL_TASTE_WRITES = '1';
  });
  afterEach(() => {
    process.env.CANONICAL_TASTE_WRITES = prev;
  });

  it('rejects when writes are off without calling RPCs', async () => {
    process.env.CANONICAL_TASTE_WRITES = '0';
    const { supabase, rpcCalls } = mockSupabase({
      getExplicit: () => emptyExplicit(),
      onRpc: () => ({ data: null, error: null }),
    });

    const result = await applyProfileSommiMemoryAction({
      userId: 'user-1',
      supabase,
      action: { type: 'clear_body', from: 'full' },
      operationId: OP_A,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('writes_off');
    expect(rpcCalls).toHaveLength(0);
  });

  it('rejects invalid operationId without RPC', async () => {
    const { supabase, rpcCalls } = mockSupabase({
      getExplicit: () => emptyExplicit(),
      onRpc: () => ({ data: null, error: null }),
    });
    const result = await applyProfileSommiMemoryAction({
      userId: 'user-1',
      supabase,
      action: { type: 'clear_body', from: 'full' },
      operationId: 'bad',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid_operation_id');
    expect(rpcCalls).toHaveLength(0);
  });

  it('1: same operation ID retried after success → already_applied, same key', async () => {
    let hasRioja = true;
    let call = 0;
    const { supabase, rpcCalls } = mockSupabase({
      getExplicit: () => {
        const e = emptyExplicit();
        if (hasRioja) e.regions_liked = [{ id: 'rioja', confidence: 0.9, label_en: 'Rioja' }];
        return e;
      },
      onRpc: (name, args) => {
        expect(name).toBe('apply_taste_profile_memory_action');
        expect(args.p_payload.operation_id).toBe(OP_A);
        expect(args.p_payload.idempotency_key).toBe(profileMemoryIdempotencyKey(OP_A));
        call += 1;
        hasRioja = false;
        return {
          data: {
            reason: call === 1 ? 'applied' : 'already_applied',
            canonical_applied: true,
            status: 'applied',
            event_id: 'e1',
          },
          error: null,
        };
      },
    });

    const a = await applyProfileSommiMemoryAction({
      userId: 'user-1',
      supabase,
      action: { type: 'remove_region', polarity: 'like', id: 'rioja' },
      operationId: OP_A,
    });
    hasRioja = true; // simulate lost response / stale local view
    const b = await applyProfileSommiMemoryAction({
      userId: 'user-1',
      supabase,
      action: { type: 'remove_region', polarity: 'like', id: 'rioja' },
      operationId: OP_A,
    });
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    if (b.ok) expect(b.reason).toBe('already_applied');
    expect(rpcCalls).toHaveLength(2);
    expect(rpcCalls[0]!.payload.idempotency_key).toBe(rpcCalls[1]!.payload.idempotency_key);
    expect(rpcCalls.map((c) => c.name)).not.toContain('create_taste_pending_confirmation');
  });

  it('2: concurrent same operation ID → one key / one mutation intent', async () => {
    const keys = new Set<string>();
    let applyCount = 0;
    let hasRioja = true;
    const { supabase } = mockSupabase({
      getExplicit: () => {
        const e = emptyExplicit();
        if (hasRioja) e.regions_liked = [{ id: 'rioja', confidence: 0.9, label_en: 'Rioja' }];
        return e;
      },
      onRpc: (_name, args) => {
        keys.add(String(args.p_payload.idempotency_key));
        applyCount += 1;
        hasRioja = false;
        return {
          data: {
            reason: applyCount === 1 ? 'applied' : 'already_applied',
            canonical_applied: true,
            event_id: 'same',
          },
          error: null,
        };
      },
    });

    const [r1, r2] = await Promise.all([
      applyProfileSommiMemoryAction({
        userId: 'user-1',
        supabase,
        action: { type: 'remove_region', polarity: 'like', id: 'rioja' },
        operationId: OP_A,
      }),
      applyProfileSommiMemoryAction({
        userId: 'user-1',
        supabase,
        action: { type: 'remove_region', polarity: 'like', id: 'rioja' },
        operationId: OP_A,
      }),
    ]);
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(keys.size).toBe(1);
  });

  it('3: same operation ID with different payload → idempotency_conflict', async () => {
    const { supabase } = mockSupabase({
      getExplicit: () => {
        const e = emptyExplicit();
        e.regions_liked = [
          { id: 'rioja', confidence: 0.9, label_en: 'Rioja' },
          { id: 'napa', confidence: 0.9, label_en: 'Napa' },
        ];
        return e;
      },
      onRpc: () => ({
        data: { reason: 'idempotency_conflict', canonical_applied: false },
        error: null,
      }),
    });

    const result = await applyProfileSommiMemoryAction({
      userId: 'user-1',
      supabase,
      action: { type: 'remove_region', polarity: 'like', id: 'napa' },
      operationId: OP_A,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('idempotency_conflict');
  });

  it('4: different operation IDs while already absent → second accurate no-op/not_found', async () => {
    const reasons: string[] = [];
    const { supabase, rpcCalls } = mockSupabase({
      getExplicit: () => emptyExplicit(),
      onRpc: (_name, args) => {
        reasons.push('not_found');
        return {
          data: { reason: 'not_found', canonical_applied: false, status: 'noop' },
          error: null,
        };
      },
    });

    const a = await applyProfileSommiMemoryAction({
      userId: 'user-1',
      supabase,
      action: { type: 'remove_region', polarity: 'like', id: 'rioja' },
      operationId: OP_A,
    });
    const b = await applyProfileSommiMemoryAction({
      userId: 'user-1',
      supabase,
      action: { type: 'remove_region', polarity: 'like', id: 'rioja' },
      operationId: OP_B,
    });
    expect(a.ok).toBe(false);
    expect(b.ok).toBe(false);
    if (!a.ok) expect(a.reason).toBe('not_found');
    if (!b.ok) expect(b.reason).toBe('not_found');
    expect(rpcCalls[0]!.payload.idempotency_key).not.toBe(rpcCalls[1]!.payload.idempotency_key);
  });

  it('5–8: remove Rioja (A), re-add via chat state, remove again (B) applies', async () => {
    let hasRioja = true;
    const appliedOps: string[] = [];
    const { supabase, rpcCalls } = mockSupabase({
      getExplicit: () => {
        const e = emptyExplicit();
        if (hasRioja) e.regions_liked = [{ id: 'rioja', confidence: 0.9, label_en: 'Rioja' }];
        return e;
      },
      onRpc: (_name, args) => {
        const op = String(args.p_payload.operation_id);
        appliedOps.push(op);
        hasRioja = false;
        return {
          data: { reason: 'applied', canonical_applied: true, event_id: `e-${op}` },
          error: null,
        };
      },
    });

    const first = await applyProfileSommiMemoryAction({
      userId: 'user-1',
      supabase,
      action: { type: 'remove_region', polarity: 'like', id: 'rioja' },
      operationId: OP_A,
    });
    expect(first.ok).toBe(true);

    // Simulate chat re-remember: preference restored under a different evidence path
    hasRioja = true;

    const second = await applyProfileSommiMemoryAction({
      userId: 'user-1',
      supabase,
      action: { type: 'remove_region', polarity: 'like', id: 'rioja' },
      operationId: OP_B,
    });
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.reason).toBe('applied');
    expect(appliedOps).toEqual([OP_A, OP_B]);
    expect(rpcCalls[0]!.payload.idempotency_key).not.toBe(rpcCalls[1]!.payload.idempotency_key);
  });

  it('9: replace full→light (A); restore full; replace light again (B) evaluates normally', async () => {
    let body: 'full' | 'light' = 'full';
    const { supabase, rpcCalls } = mockSupabase({
      getExplicit: () => {
        const e = emptyExplicit();
        e.body = { value: body, confidence: 0.9 };
        return e;
      },
      onRpc: (_name, args) => {
        body = String(args.p_payload.proposed_value) as 'light';
        return {
          data: { reason: 'applied', canonical_applied: true, event_id: 'body' },
          error: null,
        };
      },
    });

    const a = await applyProfileSommiMemoryAction({
      userId: 'user-1',
      supabase,
      action: { type: 'replace_body', value: 'light', from: 'full' },
      operationId: OP_A,
    });
    expect(a.ok).toBe(true);

    body = 'full'; // chat/other path restored full
    const b = await applyProfileSommiMemoryAction({
      userId: 'user-1',
      supabase,
      action: { type: 'replace_body', value: 'light', from: 'full' },
      operationId: OP_B,
    });
    expect(b.ok).toBe(true);
    if (b.ok) expect(b.reason).toBe('applied');
    expect(rpcCalls[0]!.payload.idempotency_key).not.toBe(rpcCalls[1]!.payload.idempotency_key);
  });

  it('14: cross-user same operation UUID derives same key string but is scoped by auth.uid in RPC', () => {
    // Unique index is (user_id, idempotency_key). Key itself is operation-scoped only.
    expect(profileMemoryIdempotencyKey(OP_C)).toBe(`profile_memory_action_${OP_C}`);
    const sql = readFileSync(
      resolve(__dirname, '../../../../../supabase/migrations/20260912_taste_profile_memory_action.sql'),
      'utf8'
    );
    expect(sql).toMatch(/WHERE user_id = v_uid AND idempotency_key = v_key/);
    expect(sql).toMatch(/v_uid uuid := auth\.uid\(\)/);
  });

  it('7: kill switch OFF creates no pending/action', async () => {
    process.env.CANONICAL_TASTE_WRITES = '0';
    const rpc = vi.fn();
    const supabase = { from: vi.fn(), rpc } as any;
    const result = await applyProfileSommiMemoryAction({
      userId: 'user-1',
      supabase,
      action: { type: 'remove_region', polarity: 'like', id: 'rioja' },
      operationId: OP_A,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('writes_off');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('8: Profile module never calls create/resolve pending RPCs', async () => {
    const src = readFileSync(resolve(__dirname, './profileSommiMemory.ts'), 'utf8');
    expect(src).toMatch(/apply_taste_profile_memory_action/);
    expect(src).not.toMatch(/create_taste_pending_confirmation/);
    expect(src).not.toMatch(/resolve_taste_confirmation/);
    expect(src).not.toMatch(/openai|creditService|recommendCellar/i);
  });

  it('migration uses operation-scoped keys and never creates pending_confirmation', () => {
    const sql = readFileSync(
      resolve(__dirname, '../../../../../supabase/migrations/20260912_taste_profile_memory_action.sql'),
      'utf8'
    );
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.apply_taste_profile_memory_action/);
    expect(sql).toMatch(/profile_memory_action_/);
    expect(sql).toMatch(/idempotency_conflict/);
    expect(sql).toMatch(/reason', 'unchanged'/);
    expect(sql).not.toMatch(/VALUES \([\s\S]*'pending_confirmation'/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.apply_taste_profile_memory_action/);
  });
});
