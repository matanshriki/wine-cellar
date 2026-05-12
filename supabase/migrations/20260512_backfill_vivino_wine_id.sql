-- Backfill vivino_wine_id from vivino_url for wines that already have
-- a direct wine-page URL (contains /w/{numeric_id}).
-- This covers wines added before the vivino_wine_id column was populated.
-- Runs once on deploy; safe to re-run (WHERE vivino_wine_id IS NULL ensures idempotency).
UPDATE public.wines
SET vivino_wine_id = (regexp_match(vivino_url, '/w/(\d+)'))[1]
WHERE
  vivino_wine_id IS NULL
  AND vivino_url IS NOT NULL
  AND vivino_url ~ '/w/\d+';
