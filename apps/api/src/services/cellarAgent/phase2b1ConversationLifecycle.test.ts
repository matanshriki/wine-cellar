/**
 * Phase 2B.1 conversation ownership + mixed NULL→non-null resolve policy.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { validateOwnedConversationId } from './conversationOwnership.js';
import {
  processTasteConfirmation,
  processPreferenceMessage,
} from './canonicalTasteWrite.js';
import { resolveAckMessage } from './tasteConfirmation.js';
import type { StructuredTasteProfile } from './tasteProfileTypes.js';

const OWNED_CONV = '11111111-1111-4111-8111-111111111111';
const OTHER_CONV = '22222222-2222-4222-8222-222222222222';
const BAD_ID = 'not-a-uuid';

function chainable(result: { data: unknown; error: unknown }) {
  const api: Record<string, unknown> = {};
  const self = () => api;
  for (const m of [
    'select',
    'eq',
    'is',
    'order',
    'limit',
    'update',
    'maybeSingle',
    'single',
  ]) {
    api[m] = vi.fn(self);
  }
  api.maybeSingle = vi.fn(async () => result);
  api.single = vi.fn(async () => result);
  // terminal for update().eq... without maybeSingle
  Object.defineProperty(api, 'then', {
    value: undefined,
    configurable: true,
  });
  return api;
}

function makeSupabase(opts: {
  ownedConversationIds?: Set<string>;
  resolveRpc?: (payload: Record<string, unknown>) => { data: unknown; error: unknown };
  createRpc?: (payload: Record<string, unknown>) => { data: unknown; error: unknown };
  nullPendingId?: string | null;
  updateCalls?: Array<Record<string, unknown>>;
}) {
  const owned = opts.ownedConversationIds ?? new Set([OWNED_CONV]);
  const updateCalls = opts.updateCalls ?? [];

  return {
    from(table: string) {
      if (table === 'sommelier_conversations') {
        return {
          select() {
            return {
              eq(_col: string, id: string) {
                return {
                  async maybeSingle() {
                    if (owned.has(id)) {
                      return { data: { id }, error: null };
                    }
                    return { data: null, error: null };
                  },
                };
              },
            };
          },
        };
      }
      if (table === 'sommelier_feedback_events') {
        const state: {
          filters: Record<string, unknown>;
          isUpdate: boolean;
          patch: Record<string, unknown> | null;
        } = { filters: {}, isUpdate: false, patch: null };

        const api: Record<string, any> = {
          select() {
            return api;
          },
          update(patch: Record<string, unknown>) {
            state.isUpdate = true;
            state.patch = patch;
            updateCalls.push(patch);
            return api;
          },
          eq(col: string, val: unknown) {
            state.filters[col] = val;
            return api;
          },
          is(col: string, val: unknown) {
            state.filters[`is:${col}`] = val;
            return api;
          },
          order() {
            return api;
          },
          limit() {
            return api;
          },
          async maybeSingle() {
            if (state.isUpdate) {
              updateCalls.push({ ...state.patch, ...state.filters });
              return { data: null, error: null };
            }
            if (opts.nullPendingId) {
              return { data: { id: opts.nullPendingId }, error: null };
            }
            return { data: null, error: null };
          },
        };

        // Allow bare update().eq().eq() without maybeSingle
        api.then = (resolve: (v: unknown) => void) => {
          if (state.isUpdate && state.patch) {
            updateCalls.push({ ...state.patch, ...state.filters });
          }
          resolve({ data: null, error: null });
        };

        return api;
      }
      return chainable({ data: null, error: null });
    },
    async rpc(name: string, args: { p_payload: Record<string, unknown> }) {
      if (name === 'resolve_taste_confirmation' && opts.resolveRpc) {
        return opts.resolveRpc(args.p_payload);
      }
      if (name === 'create_taste_pending_confirmation' && opts.createRpc) {
        return opts.createRpc(args.p_payload);
      }
      return { data: null, error: { message: `unexpected rpc ${name}` } };
    },
  } as any;
}

describe('validateOwnedConversationId', () => {
  it('allows null for legacy clients', async () => {
    const sb = makeSupabase({});
    const r = await validateOwnedConversationId(sb, null);
    expect(r).toEqual({ ok: true, conversationId: null });
  });

  it('14: rejects invalid format', async () => {
    const sb = makeSupabase({});
    const r = await validateOwnedConversationId(sb, BAD_ID);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('invalid_format');
  });

  it('14: rejects cross-user / unknown conversation id', async () => {
    const sb = makeSupabase({ ownedConversationIds: new Set([OWNED_CONV]) });
    const r = await validateOwnedConversationId(sb, OTHER_CONV);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('forbidden');
  });

  it('accepts owned uuid', async () => {
    const sb = makeSupabase({});
    const r = await validateOwnedConversationId(sb, OWNED_CONV);
    expect(r).toEqual({ ok: true, conversationId: OWNED_CONV });
  });
});

describe('processTasteConfirmation scoping', () => {
  const prev = process.env.CANONICAL_TASTE_WRITES;

  beforeEach(() => {
    process.env.CANONICAL_TASTE_WRITES = '1';
  });
  afterEach(() => {
    process.env.CANONICAL_TASTE_WRITES = prev;
  });

  it('9: pending created in conversation A resolves in A', async () => {
    const sb = makeSupabase({
      resolveRpc: (payload) => {
        expect(payload.conversation_id).toBe(OWNED_CONV);
        return {
          data: {
            reason: 'applied',
            canonical_applied: true,
            pending_action: {
              action: 'remove',
              dimension: 'region',
              existing_value: 'rioja',
              label_en: 'Rioja',
            },
          },
          error: null,
        };
      },
    });
    // Skip legacy memory sync failures by stubbing — applied path calls sync
    const r = await processTasteConfirmation({
      userId: 'user-1',
      message: 'yes',
      supabase: sb,
      conversationId: OWNED_CONV,
    });
    expect(r.reason).toBe('applied');
    expect(r.applied).toBe(true);
  });

  it('10+11: pending from A cannot resolve in B; standalone yes in B is not_found', async () => {
    const sb = makeSupabase({
      ownedConversationIds: new Set([OWNED_CONV, OTHER_CONV]),
      resolveRpc: (payload) => {
        expect(payload.conversation_id).toBe(OTHER_CONV);
        return { data: { reason: 'not_found', canonical_applied: false }, error: null };
      },
      nullPendingId: null,
    });
    const r = await processTasteConfirmation({
      userId: 'user-1',
      message: 'yes',
      supabase: sb,
      conversationId: OTHER_CONV,
    });
    expect(r.applied).toBe(false);
    expect(r.reason).toBe('not_found');
  });

  it('12: old client NULL → NULL continues (resolve with null conversation_id)', async () => {
    const sb = makeSupabase({
      resolveRpc: (payload) => {
        expect(payload.conversation_id).toBeNull();
        return {
          data: {
            reason: 'applied',
            canonical_applied: true,
            pending_action: {
              action: 'remove',
              dimension: 'region',
              existing_value: 'rioja',
              label_en: 'Rioja',
            },
          },
          error: null,
        };
      },
    });
    const r = await processTasteConfirmation({
      userId: 'user-1',
      message: 'yes',
      supabase: sb,
      conversationId: null,
    });
    expect(r.reason).toBe('applied');
  });

  it('13: NULL → non-null mixed transition does not apply automatically', async () => {
    const updateCalls: Array<Record<string, unknown>> = [];
    const sb = makeSupabase({
      resolveRpc: () => ({
        data: { reason: 'not_found', canonical_applied: false },
        error: null,
      }),
      nullPendingId: 'null-pending-event',
      updateCalls,
    });
    const r = await processTasteConfirmation({
      userId: 'user-1',
      message: 'yes',
      supabase: sb,
      conversationId: OWNED_CONV,
    });
    expect(r.applied).toBe(false);
    expect(r.reason).toBe('stale_null_pending');
    expect(r.message.toLowerCase()).toMatch(/send the preference change again|שיחה/);
    expect(updateCalls.some((u) => u.status === 'superseded')).toBe(true);
  });

  it('14: cross-user conversation id is rejected before resolve rpc', async () => {
    let rpcCalled = false;
    const sb = makeSupabase({
      ownedConversationIds: new Set([OWNED_CONV]),
      resolveRpc: () => {
        rpcCalled = true;
        return { data: { reason: 'applied', canonical_applied: true }, error: null };
      },
    });
    const r = await processTasteConfirmation({
      userId: 'user-1',
      message: 'yes',
      supabase: sb,
      conversationId: OTHER_CONV,
    });
    expect(rpcCalled).toBe(false);
    expect(r.reason).toBe('forbidden_conversation');
    expect(r.applied).toBe(false);
  });

  it('15: expired ack remains correct', () => {
    expect(resolveAckMessage('expired', null, 'en')).toMatch(/expired/i);
    expect(resolveAckMessage('superseded', null, 'en')).toMatch(/send the request again/i);
  });
});

describe('processPreferenceMessage conversation ownership', () => {
  const prev = process.env.CANONICAL_TASTE_WRITES;

  beforeEach(() => {
    process.env.CANONICAL_TASTE_WRITES = '1';
  });
  afterEach(() => {
    process.env.CANONICAL_TASTE_WRITES = prev;
  });

  function profileWithBody(): StructuredTasteProfile {
    return {
      version: 2,
      vector: { body: 0.8, tannin: 0.5, acidity: 0.5, oak: 0.5, sweetness: 0.2, power: 0.5 },
      preferences: {
        reds_bias: 0,
        whites_bias: 0,
        sparkling_bias: 0,
        style_tags: {},
        regions: {},
        grapes: {},
      },
      explicit: {
        regions_liked: [],
        regions_disliked: [],
        grapes_liked: [],
        grapes_disliked: [],
        styles_liked: [],
        styles_disliked: [],
        body: { value: 'full', confidence: 0.9 },
      },
      confidence: 'high',
      data_points: { rated_count: 5, last_rated_at: null },
    };
  }

  it('creates pending with owned conversation_id', async () => {
    const sb = makeSupabase({
      createRpc: (payload) => {
        expect(payload.conversation_id).toBe(OWNED_CONV);
        return {
          data: { event_id: 'evt-1', reason: 'pending_confirmation' },
          error: null,
        };
      },
    });
    const r = await processPreferenceMessage({
      userId: 'user-1',
      message: 'Remember that I prefer light-bodied wines',
      supabase: sb,
      tasteProfile: profileWithBody(),
      conversationId: OWNED_CONV,
    });
    expect(r?.reason).toBe('pending_confirmation');
    expect(r?.acknowledgmentKind).toBe('pending_confirm');
  });

  it('rejects cross-user conversation before pending create', async () => {
    let createCalled = false;
    const sb = makeSupabase({
      ownedConversationIds: new Set([OWNED_CONV]),
      createRpc: () => {
        createCalled = true;
        return { data: null, error: null };
      },
    });
    const r = await processPreferenceMessage({
      userId: 'user-1',
      message: 'Remember that I prefer light-bodied wines',
      supabase: sb,
      tasteProfile: profileWithBody(),
      conversationId: OTHER_CONV,
    });
    expect(createCalled).toBe(false);
    expect(r?.reason).toBe('forbidden_conversation');
  });
});
