-- AI-derived barrel regimen (display + preference learning). Not verified fact sheets.
ALTER TABLE public.wines
  ADD COLUMN IF NOT EXISTS barrel_aging_note text NULL,
  ADD COLUMN IF NOT EXISTS barrel_aging_months_est integer NULL;

COMMENT ON COLUMN public.wines.barrel_aging_note IS 'Human-readable barrel/oak regimen estimate from AI analysis.';
COMMENT ON COLUMN public.wines.barrel_aging_months_est IS 'Estimated months in barrel (AI); null if unknown; for taste/preference signals.';
