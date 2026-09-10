/**
 * Static checks for Phase 2A migration SQL (no live DB required).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationPath = resolve(
  __dirname,
  '../../../../../supabase/migrations/20260910_taste_profile_phase2a_atomic.sql'
);

describe('Phase 2A migration static SQL', () => {
  const sql = readFileSync(migrationPath, 'utf8');

  it('adds evidence columns and unique idempotency index', () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS scope text/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS polarity text/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS extraction_version text/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS locale text/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS idempotency_key text/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS status text/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS target_dimension text/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS target_value text/);
    expect(sql).toMatch(/uq_sommelier_feedback_idempotency/);
    expect(sql).toMatch(/WHERE idempotency_key IS NOT NULL/);
  });

  it('defines SECURITY INVOKER patch RPC without public merge_explicit', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.apply_taste_profile_patch/);
    expect(sql).toMatch(/SECURITY INVOKER/);
    expect(sql).toMatch(/SET search_path = public/);
    expect(sql).toMatch(/recompute_inferred/);
    expect(sql).toMatch(/set_overrides/);
    expect(sql).toMatch(/clear_overrides/);
    expect(sql).not.toMatch(/p_action.*merge_explicit/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.apply_taste_profile_patch/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.apply_taste_profile_patch/);
  });

  it('defines evidence+canonical RPC with idempotent apply', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.apply_taste_evidence_and_canonical/);
    expect(sql).toMatch(/applied_to_canonical/);
    expect(sql).toMatch(/already_applied/);
    expect(sql).toMatch(/FOR UPDATE/);
    expect(sql).toMatch(/auth\.uid\(\)/);
    expect(sql).not.toMatch(/p_user_id/);
  });

  it('31: grants authenticated, revokes anon/public', () => {
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.apply_taste_evidence_and_canonical\(jsonb\) FROM PUBLIC/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.apply_taste_evidence_and_canonical\(jsonb\) FROM anon/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.apply_taste_evidence_and_canonical\(jsonb\) TO authenticated/);
  });
});
