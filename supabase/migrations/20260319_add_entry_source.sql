-- Track how each wine was originally added to the cellar
-- Possible values: 'manual' | 'ai_scan' | 'csv_import' | 'vivino'

ALTER TABLE public.wines
ADD COLUMN IF NOT EXISTS entry_source TEXT DEFAULT NULL
  CHECK (entry_source IN ('manual', 'ai_scan', 'csv_import', 'vivino'));

COMMENT ON COLUMN wines.entry_source IS
  'How the wine was originally added: manual (form), ai_scan (camera label scan), csv_import (generic CSV), vivino (Vivino CSV export)';

CREATE INDEX IF NOT EXISTS wines_entry_source_idx
  ON public.wines (entry_source)
  WHERE entry_source IS NOT NULL;

-- Backfill existing wines using available signals:
--   vivino_wine_id present  → 'vivino'
--   label_image_path or image_path present → 'ai_scan'
--   everything else         → 'manual' (includes historical CSV imports we can't distinguish)
UPDATE public.wines SET entry_source =
  CASE
    WHEN vivino_wine_id IS NOT NULL              THEN 'vivino'
    WHEN label_image_path IS NOT NULL
      OR image_path IS NOT NULL                  THEN 'ai_scan'
    ELSE                                              'manual'
  END
WHERE entry_source IS NULL;
