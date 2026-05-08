-- Structured serving guidance per bottle (AI-generated, nullable)
ALTER TABLE public.bottles
  ADD COLUMN IF NOT EXISTS serving_guidance JSONB NULL;

COMMENT ON COLUMN public.bottles.serving_guidance IS
  'Structured AI serving guidance: temp range, decant recommendation, opening instructions, explanation. Shape: {temp_min, temp_max, decanting, decant_min, decant_max, open_before_minutes, glassware, short_instruction, explanation, confidence, source_summary}';

-- Barrel aging metadata per wine (confidence/source, nullable)
ALTER TABLE public.wines
  ADD COLUMN IF NOT EXISTS barrel_aging_metadata JSONB NULL;

COMMENT ON COLUMN public.wines.barrel_aging_metadata IS
  'Barrel aging confidence/source metadata: {is_estimated: bool, confidence: high|medium|low, source: string}';
