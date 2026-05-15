-- Migration: 20260515_add_kosher_status.sql
-- Adds Kosher certification fields to the wines catalog table.
-- All fields are nullable; null means "not yet determined" (never "assumed not Kosher").

ALTER TABLE public.wines
  ADD COLUMN IF NOT EXISTS is_kosher              BOOLEAN,
  ADD COLUMN IF NOT EXISTS kosher_for_passover    BOOLEAN,
  ADD COLUMN IF NOT EXISTS mevushal               BOOLEAN,
  ADD COLUMN IF NOT EXISTS kosher_certification   TEXT,
  ADD COLUMN IF NOT EXISTS kosher_confidence      TEXT
    CHECK (kosher_confidence IN ('low', 'med', 'high')),
  ADD COLUMN IF NOT EXISTS kosher_source_url      TEXT,
  ADD COLUMN IF NOT EXISTS kosher_source_name     TEXT,
  ADD COLUMN IF NOT EXISTS kosher_notes           TEXT,
  ADD COLUMN IF NOT EXISTS kosher_updated_at      TIMESTAMPTZ;

COMMENT ON COLUMN public.wines.is_kosher IS
  'Whether this wine is Kosher certified. NULL = unknown; never assume false.';
COMMENT ON COLUMN public.wines.kosher_for_passover IS
  'Whether Kosher for Passover (Pesach). NULL = unknown.';
COMMENT ON COLUMN public.wines.mevushal IS
  'Whether the wine is Mevushal (flash-pasteurized). NULL = unknown.';
COMMENT ON COLUMN public.wines.kosher_certification IS
  'Certification body, e.g. "OU", "Badatz", "KFP", "CRC". NULL = unknown.';
COMMENT ON COLUMN public.wines.kosher_confidence IS
  'Confidence in Kosher status: low | med | high. NULL = not yet checked.';
COMMENT ON COLUMN public.wines.kosher_source_url IS
  'URL of the source that confirmed Kosher status.';
COMMENT ON COLUMN public.wines.kosher_source_name IS
  'Human-readable source name, e.g. "Royal Wine", "KosherWine.com".';
COMMENT ON COLUMN public.wines.kosher_notes IS
  'Free-text notes about Kosher status (e.g., vintage-specific caveats).';
COMMENT ON COLUMN public.wines.kosher_updated_at IS
  'When Kosher detection was last run. NULL = never enriched.';

-- Index for "show only Kosher wines" cellar filter
CREATE INDEX IF NOT EXISTS idx_wines_is_kosher
  ON public.wines (user_id, is_kosher)
  WHERE is_kosher IS NOT NULL;

-- Index for backfill: find wines that have never been checked
CREATE INDEX IF NOT EXISTS idx_wines_kosher_not_checked
  ON public.wines (user_id)
  WHERE kosher_updated_at IS NULL;
