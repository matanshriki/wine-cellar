-- Per-locale AI analysis text snapshots on bottles (mirrors food_pairing pattern).
-- Legacy flat columns are unchanged and remain populated for compatibility.

ALTER TABLE public.bottles
  ADD COLUMN IF NOT EXISTS analysis_data JSONB DEFAULT NULL;

COMMENT ON COLUMN public.bottles.analysis_data IS
  'Per-locale AI sommelier analysis prose. Keys: en | he. Shape per key: { summary, reasons[], serving_guidance{}, assumptions }. '
  'Legacy columns analysis_summary, analysis_reasons, serving_guidance, assumptions remain canonical for queries and older clients.';

-- One-time backfill: copy existing flat analysis into analysis_data.en when analysis_data is empty.
-- LIMITATION: Historical rows do not record which language the legacy text was generated in.
-- Hebrew-only legacy text may be mis-keyed as "en" until the user runs "Generate analysis in Hebrew"
-- from the Wine Page CTA (which writes analysis_data.he without removing legacy fields).
UPDATE public.bottles b
SET analysis_data = jsonb_build_object(
  'en',
  jsonb_build_object(
    'summary', to_jsonb(b.analysis_summary),
    'reasons', COALESCE(b.analysis_reasons, '[]'::jsonb),
    'serving_guidance', COALESCE(b.serving_guidance, 'null'::jsonb),
    'assumptions', CASE
      WHEN b.assumptions IS NULL THEN NULL::jsonb
      ELSE to_jsonb(b.assumptions)
    END
  )
)
WHERE b.analysis_summary IS NOT NULL
  AND length(trim(b.analysis_summary)) > 0
  AND b.readiness_label IS NOT NULL
  AND (
    b.analysis_data IS NULL
    OR b.analysis_data = 'null'::jsonb
    OR b.analysis_data = '{}'::jsonb
  );
