-- Add personal notes field to consumption_history table
-- This allows users to add/edit notes about wines they've opened

ALTER TABLE public.consumption_history
ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN public.consumption_history.notes IS 'Personal notes added by user after opening the wine';

