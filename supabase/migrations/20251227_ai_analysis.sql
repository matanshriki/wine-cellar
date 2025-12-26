-- AI Analysis Enhancement
-- Adds fields for ChatGPT-generated sommelier notes directly to bottles table

-- Add AI-specific fields to bottles table
ALTER TABLE bottles
ADD COLUMN IF NOT EXISTS analysis_summary TEXT,
ADD COLUMN IF NOT EXISTS analysis_reasons JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS readiness_label TEXT CHECK (readiness_label IN ('READY', 'HOLD', 'PEAK_SOON')),
ADD COLUMN IF NOT EXISTS confidence TEXT CHECK (confidence IN ('LOW', 'MEDIUM', 'HIGH')),
ADD COLUMN IF NOT EXISTS assumptions TEXT;

-- Note: drink_window_start, drink_window_end, serve_temp_c, decant_minutes, analysis_notes, analyzed_at
-- already exist in bottles table from initial schema

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_bottles_analyzed_at ON bottles(analyzed_at) WHERE analyzed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bottles_readiness_label ON bottles(readiness_label) WHERE readiness_label IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN bottles.analysis_summary IS 'AI-generated sommelier note (2-3 sentences)';
COMMENT ON COLUMN bottles.analysis_reasons IS 'Array of bullet points explaining the analysis';
COMMENT ON COLUMN bottles.drink_window_start IS 'Estimated year to start drinking';
COMMENT ON COLUMN bottles.drink_window_end IS 'Estimated year to finish drinking';
COMMENT ON COLUMN bottles.readiness_label IS 'AI readiness label (READY/HOLD/PEAK_SOON)';
COMMENT ON COLUMN bottles.confidence IS 'AI confidence level (LOW/MEDIUM/HIGH)';
COMMENT ON COLUMN bottles.assumptions IS 'Assumptions made when confidence is low';
COMMENT ON COLUMN bottles.analyzed_at IS 'Timestamp of analysis generation';

