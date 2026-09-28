/**
 * Regression: “Remember that I like [grape]” → saved ack → visible in Profile DTO.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { classifyAgentRoute } from './agentRouter.js';
import {
  extractPreferenceEvidence,
} from './preferenceExtractRules.js';
import {
  preferenceAckMessage,
  processPreferenceMessage,
} from './canonicalTasteWrite.js';
import {
  countPublicSommiMemory,
  toPublicSommiMemory,
} from './profileSommiMemory.js';

describe('Remember that I like [grape] → Profile', () => {
  const prev = process.env.CANONICAL_TASTE_WRITES;

  beforeEach(() => {
    process.env.CANONICAL_TASTE_WRITES = '1';
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.CANONICAL_TASTE_WRITES;
    else process.env.CANONICAL_TASTE_WRITES = prev;
  });

  it('routes + extracts Nebbiolo as stable grape remember', () => {
    const message = 'Remember that I like Nebbiolo';
    expect(classifyAgentRoute(message)).toBe('memory_update');
    const c = extractPreferenceEvidence(message)!;
    expect(c.class).toBe('stable_remember');
    expect(c.dimension).toBe('grape');
    expect(c.valueId).toBe('nebbiolo');
    expect(c.applyCanonical).toBe(true);
    expect(preferenceAckMessage('remember_saved', c, 'en')).toMatch(
      /I'll remember that you prefer Nebbiolo/i
    );
  });

  it('after agent save, grape appears in public Sommi memory (Profile)', async () => {
    const message = 'Remember that I like Nebbiolo';
    const candidate = extractPreferenceEvidence(message)!;

    const rpc = vi.fn().mockResolvedValue({
      data: {
        event_id: 'evt-nebbiolo',
        canonical_applied: true,
        reason: 'applied',
      },
      error: null,
    });

    // Dual-write to legacy memory after canonical apply
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const supabase = {
      rpc,
      from: vi.fn((table: string) => {
        if (table === 'sommelier_agent_memory') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { preferences: {} }, error: null }),
              }),
            }),
            upsert,
          };
        }
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        };
      }),
    };

    const result = await processPreferenceMessage({
      userId: 'user-1',
      message,
      supabase: supabase as never,
      language: 'en',
      tasteProfile: null,
      conversationId: null,
    });

    expect(result).toBeTruthy();
    expect(result!.canonicalApplied).toBe(true);
    expect(result!.acknowledgmentKind).toBe('remember_saved');
    expect(rpc).toHaveBeenCalledWith(
      'apply_taste_evidence_and_canonical',
      expect.objectContaining({
        p_payload: expect.objectContaining({
          apply_canonical: true,
          target_dimension: 'grape',
          target_value: 'nebbiolo',
          polarity: 'like',
        }),
      })
    );

    // Profile card reads public DTO built from taste_profile.explicit
    const memory = toPublicSommiMemory(
      {
        regions_liked: [],
        regions_disliked: [],
        grapes_liked: [
          {
            id: candidate.valueId,
            confidence: 0.9,
            label_en: candidate.labelEn,
            label_he: candidate.labelHe,
          },
        ],
        grapes_disliked: [],
        styles_liked: [],
        styles_disliked: [],
        body: null,
      },
      'en'
    );
    expect(memory.grapes_liked.map((g) => g.id)).toContain('nebbiolo');
    expect(memory.grapes_liked[0]!.label).toMatch(/Nebbiolo/i);
    expect(countPublicSommiMemory(memory)).toBeGreaterThanOrEqual(1);
  });
});
