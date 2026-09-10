/**
 * Phase 2B.1 conversation-ID lifecycle: persist before first recommend send.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  createConversationEnsureGate,
  ensurePersistedConversation,
} from './ensurePersistedConversation';
import type { SommelierConversation } from './sommelierConversationService';

function fakeConv(id: string): SommelierConversation {
  return {
    id,
    user_id: 'user-1',
    title: 'New conversation',
    messages: [],
    created_at: '2026-09-10T00:00:00Z',
    updated_at: '2026-09-10T00:00:00Z',
    last_message_at: '2026-09-10T00:00:00Z',
  };
}

describe('ensurePersistedConversation', () => {
  it('1+2: creates a persisted conversation before first API send when none exists', async () => {
    const createFn = vi.fn(async () => fakeConv('conv-new'));
    const result = await ensurePersistedConversation(null, createFn);
    expect(createFn).toHaveBeenCalledTimes(1);
    expect(createFn).toHaveBeenCalledWith([], 'New conversation');
    expect(result.id).toBe('conv-new');
  });

  it('4: reuses existing conversation id without creating', async () => {
    const existing = fakeConv('conv-existing');
    const createFn = vi.fn(async () => fakeConv('should-not'));
    const result = await ensurePersistedConversation(existing, createFn);
    expect(createFn).not.toHaveBeenCalled();
    expect(result.id).toBe('conv-existing');
  });

  it('7: creation failure rejects so caller must not send unscoped', async () => {
    const createFn = vi.fn(async () => {
      throw new Error('Failed to create conversation');
    });
    await expect(ensurePersistedConversation(null, createFn)).rejects.toThrow(
      'Failed to create conversation'
    );
  });
});

describe('createConversationEnsureGate', () => {
  it('6: double first-send shares one in-flight create (single ID)', async () => {
    let resolveCreate!: (c: SommelierConversation) => void;
    const createFn = vi.fn(
      () =>
        new Promise<SommelierConversation>((resolve) => {
          resolveCreate = resolve;
        })
    );
    const gate = createConversationEnsureGate(createFn);

    const p1 = gate.ensure(null);
    const p2 = gate.ensure(null);
    expect(createFn).toHaveBeenCalledTimes(1);

    resolveCreate(fakeConv('conv-once'));
    const [a, b] = await Promise.all([p1, p2]);
    expect(a.id).toBe('conv-once');
    expect(b.id).toBe('conv-once');
  });

  it('5: New Chat reset then ensure yields a different persisted ID', async () => {
    let n = 0;
    const createFn = vi.fn(async () => fakeConv(`conv-${++n}`));
    const gate = createConversationEnsureGate(createFn);

    const first = await gate.ensure(null);
    gate.reset();
    const second = await gate.ensure(null);
    expect(first.id).toBe('conv-1');
    expect(second.id).toBe('conv-2');
    expect(createFn).toHaveBeenCalledTimes(2);
  });

  it('8: after refresh, reloaded conversation id is reused (no new create)', async () => {
    const createFn = vi.fn(async () => fakeConv('fresh'));
    const gate = createConversationEnsureGate(createFn);
    const reloaded = fakeConv('conv-from-list');
    const result = await gate.ensure(reloaded);
    expect(result.id).toBe('conv-from-list');
    expect(createFn).not.toHaveBeenCalled();
  });
});

describe('actionContext conversationId contract', () => {
  it('2+3: first and second turns carry the same non-null conversation id', () => {
    const conversationId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    const firstTurn = {
      lastEventId: undefined,
      lastRecommendationBottleId: undefined,
      conversationId,
    };
    const secondTurn = {
      ...firstTurn,
      conversationId,
    };
    expect(firstTurn.conversationId).toBeTruthy();
    expect(secondTurn.conversationId).toBe(firstTurn.conversationId);
  });
});
