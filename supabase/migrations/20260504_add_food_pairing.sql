-- Food Pairing Enrichment
-- Adds AI-generated food pairing recommendations to the wines table.
-- Follows the same pattern as wine_profile (jsonb on wines, not bottles).

ALTER TABLE public.wines
  ADD COLUMN IF NOT EXISTS food_pairing         JSONB,
  ADD COLUMN IF NOT EXISTS food_pairing_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS food_pairing_confidence TEXT;

-- Index so backfill queries can quickly find wines that still need pairing
CREATE INDEX IF NOT EXISTS idx_wines_food_pairing_null
  ON public.wines (user_id)
  WHERE food_pairing IS NULL;

COMMENT ON COLUMN public.wines.food_pairing IS
  'AI-generated food pairing JSON: {summary, best_pairings, everyday_pairings, avoid, pairing_logic, occasion_fit, confidence}';
COMMENT ON COLUMN public.wines.food_pairing_updated_at IS
  'Timestamp of last food_pairing generation';
COMMENT ON COLUMN public.wines.food_pairing_confidence IS
  'AI confidence for food pairing: low | med | high';
