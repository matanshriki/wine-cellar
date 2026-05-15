-- Migration: 20260515_add_kosher_enrichment_method.sql
-- Adds a tracking column that records HOW the Kosher status was determined.
-- This is required for Phase 2 backfill to target the right rows (e.g. upgrade
-- AI-derived 'low' results with Perplexity web search while leaving rule-based
-- 'high' results untouched).
--
-- Allowed values:
--   'rule'       — determined by the deterministic producer rule engine
--   'ai'         — determined by OpenAI (conservative, may be null result)
--   'perplexity' — determined by Perplexity web search (Phase 2)
--   'manual'     — set manually by an admin override (Phase 2)
--
-- NULL = not yet enriched (kosher_updated_at will also be null for these rows).

ALTER TABLE public.wines
  ADD COLUMN IF NOT EXISTS kosher_enrichment_method TEXT
    CHECK (kosher_enrichment_method IN ('rule', 'ai', 'perplexity', 'manual'));

COMMENT ON COLUMN public.wines.kosher_enrichment_method IS
  'How the Kosher status was determined: rule | ai | perplexity | manual. NULL = not yet enriched.';

-- Index to let the Phase 2 backfill efficiently find rows enriched only by AI
-- (i.e., candidates for a Perplexity upgrade).
CREATE INDEX IF NOT EXISTS idx_wines_kosher_method
  ON public.wines (user_id, kosher_enrichment_method)
  WHERE kosher_enrichment_method IS NOT NULL;
