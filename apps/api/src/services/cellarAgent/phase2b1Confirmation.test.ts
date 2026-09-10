/**
 * Phase 2B.1: confirmation classification, pending detection, and routing tests.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  classifyConfirmationDecision,
  detectPendingTasteAction,
  pendingPromptMessage,
} from './tasteConfirmation.js';
import { extractPreferenceEvidence } from './preferenceExtractRules.js';
import { classifyAgentRoute } from './agentRouter.js';
import { isCanonicalTasteWritesEnabled } from './canonicalTasteWrite.js';
import type { StructuredTasteProfile } from './tasteProfileTypes.js';
import { applyPreferenceScores, EXPLICIT_PREFERENCE_WEIGHTS } from './tasteScoring.js';
import type { CellarBottleInput } from './types.js';
import type { SommelierPreferenceMemory } from './sommelierTypes.js';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function profileWith(explicit: StructuredTasteProfile['explicit']): StructuredTasteProfile {
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
    confidence: 'high',
    data_points: { rated_count: 5, last_rated_at: null },
  };
}

describe('Phase 2B.1 confirmation classification', () => {
  it('HE/EN yes confirms', () => {
    expect(classifyConfirmationDecision('yes')).toBe('confirm');
    expect(classifyConfirmationDecision('כן')).toBe('confirm');
    expect(classifyConfirmationDecision('כן, תעדכן')).toBe('confirm');
    expect(classifyConfirmationDecision('confirm')).toBe('confirm');
  });

  it('HE/EN no rejects', () => {
    expect(classifyConfirmationDecision('no')).toBe('reject');
    expect(classifyConfirmationDecision('לא')).toBe('reject');
    expect(classifyConfirmationDecision('תשאיר')).toBe('reject');
    expect(classifyConfirmationDecision('cancel')).toBe('reject');
  });

  it('unrelated text is not confirmation', () => {
    expect(classifyConfirmationDecision('recommend a wine')).toBeNull();
    expect(classifyConfirmationDecision('yesterday')).toBeNull();
  });

  it('routes yes/no to taste_confirmation', () => {
    expect(classifyAgentRoute('yes')).toBe('taste_confirmation');
    expect(classifyAgentRoute('לא')).toBe('taste_confirmation');
    expect(classifyAgentRoute('כן, תעדכן')).toBe('taste_confirmation');
  });
});

describe('Phase 2B.1 pending creation detection', () => {
  it('body full → remember light creates pending replace', () => {
    const c = extractPreferenceEvidence('Remember that I prefer light-bodied wines')!;
    const d = detectPendingTasteAction(
      c,
      profileWith({
        regions_liked: [],
        regions_disliked: [],
        grapes_liked: [],
        grapes_disliked: [],
        styles_liked: [],
        styles_disliked: [],
        body: { value: 'full', confidence: 0.9 },
      })
    );
    expect(d.kind).toBe('pending');
    if (d.kind === 'pending') {
      expect(d.action.action).toBe('replace');
      expect(d.action.existingValue).toBe('full');
      expect(d.action.proposedValue).toBe('light');
    }
  });

  it('liked Rioja → remember dislike creates pending move_polarity', () => {
    const c = extractPreferenceEvidence('Remember that I do not like Rioja')!;
    expect(c.polarity).toBe('dislike');
    const d = detectPendingTasteAction(
      c,
      profileWith({
        regions_liked: [{ id: 'rioja', confidence: 0.9 }],
        regions_disliked: [],
        grapes_liked: [],
        grapes_disliked: [],
        styles_liked: [],
        styles_disliked: [],
        body: null,
      })
    );
    expect(d.kind).toBe('pending');
    if (d.kind === 'pending') {
      expect(d.action.action).toBe('move_polarity');
      expect(d.action.proposedPolarity).toBe('dislike');
    }
  });

  it('forget liked Rioja creates pending remove', () => {
    const c = extractPreferenceEvidence('Forget that I like Rioja')!;
    expect(c.class).toBe('retraction');
    const d = detectPendingTasteAction(
      c,
      profileWith({
        regions_liked: [{ id: 'rioja', confidence: 0.9 }],
        regions_disliked: [],
        grapes_liked: [],
        grapes_disliked: [],
        styles_liked: [],
        styles_disliked: [],
        body: null,
      })
    );
    expect(d.kind).toBe('pending');
    if (d.kind === 'pending') {
      expect(d.action.action).toBe('remove');
      expect(d.action.existingValue).toBe('rioja');
    }
  });

  it('forget unknown preference creates no pending', () => {
    const c = extractPreferenceEvidence('Forget that I like Rioja')!;
    const d = detectPendingTasteAction(c, profileWith({
      regions_liked: [],
      regions_disliked: [],
      grapes_liked: [],
      grapes_disliked: [],
      styles_liked: [],
      styles_disliked: [],
      body: null,
    }));
    expect(d.kind).toBe('not_found');
  });

  it('repeated identical preference requires no confirmation', () => {
    const c = extractPreferenceEvidence('Remember that I like Rioja')!;
    const d = detectPendingTasteAction(
      c,
      profileWith({
        regions_liked: [{ id: 'rioja', confidence: 0.9 }],
        regions_disliked: [],
        grapes_liked: [],
        grapes_disliked: [],
        styles_liked: [],
        styles_disliked: [],
        body: null,
      })
    );
    expect(d.kind).toBe('reaffirm');
  });

  it('session/bottle create no pending', () => {
    const session = extractPreferenceEvidence('Tonight I prefer light wine')!;
    expect(detectPendingTasteAction(session, null).kind).toBe('none');
    const bottle = extractPreferenceEvidence('This bottle was too heavy')!;
    expect(detectPendingTasteAction(bottle, null).kind).toBe('none');
  });

  it('Hebrew pending replace prompt names old and new body', () => {
    const msg = pendingPromptMessage(
      {
        action: 'replace',
        dimension: 'body',
        existingValue: 'full',
        proposedValue: 'light',
      },
      'he'
    );
    expect(msg).toMatch(/מלאים/);
    expect(msg).toMatch(/קלילים/);
  });
});

describe('Phase 2B.1 legacy suppress scoring', () => {
  const prev = process.env.TASTE_SHORTLIST_SCORING;
  beforeEach(() => {
    process.env.TASTE_SHORTLIST_SCORING = '1';
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.TASTE_SHORTLIST_SCORING;
    else process.env.TASTE_SHORTLIST_SCORING = prev;
  });

  it('removed region does not reappear via legacy memory when suppressed', () => {
    const bottle: CellarBottleInput = {
      id: 'r1',
      producer: 'X',
      wineName: 'Y',
      region: 'Rioja',
      country: 'Spain',
      grapes: ['Tempranillo'],
      color: 'red',
      quantity: 1,
      readinessStatus: 'ready',
    };
    const memory: SommelierPreferenceMemory = {
      version: 1,
      favoriteRegions: ['rioja'],
    };
    const features: string[] = [];
    const r = applyPreferenceScores(
      bottle,
      memory,
      {
        tasteProfile: profileWith({
          regions_liked: [],
          regions_disliked: [],
          grapes_liked: [],
          grapes_disliked: [],
          styles_liked: [],
          styles_disliked: [],
          body: null,
          legacy_suppress: { regions: ['rioja'] },
        }),
        requestBodyPreference: null,
      },
      features
    );
    expect(r.features).not.toContain('agent_memory_region');
    expect(r.score).toBeLessThan(EXPLICIT_PREFERENCE_WEIGHTS.region);
  });
});

describe('Phase 2B.1 kill switch still defaults OFF for missing', () => {
  const prev = process.env.CANONICAL_TASTE_WRITES;
  afterEach(() => {
    if (prev === undefined) delete process.env.CANONICAL_TASTE_WRITES;
    else process.env.CANONICAL_TASTE_WRITES = prev;
  });
  it('missing is OFF', () => {
    delete process.env.CANONICAL_TASTE_WRITES;
    expect(isCanonicalTasteWritesEnabled()).toBe(false);
  });
});

describe('Phase 2B.1 migration static SQL', () => {
  const sql = readFileSync(
    resolve(__dirname, '../../../../../supabase/migrations/20260910_taste_profile_phase2b1_confirmation.sql'),
    'utf8'
  );

  it('defines confirmation RPCs as SECURITY INVOKER', () => {
    expect(sql).toMatch(/create_taste_pending_confirmation/);
    expect(sql).toMatch(/resolve_taste_confirmation/);
    expect(sql).toMatch(/SECURITY INVOKER/);
    expect(sql).toMatch(/pending_confirmation/);
    expect(sql).toMatch(/confirmation_expires_at/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.resolve_taste_confirmation/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.resolve_taste_confirmation\(jsonb\) TO authenticated/);
  });
});
