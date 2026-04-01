-- Migration: Add Keep/Reserve feature to bottles table
-- Allows users to mark bottles as reserved for a future event or date.
-- Reserved bottles are excluded from automatic suggestions by default.

ALTER TABLE public.bottles
  ADD COLUMN IF NOT EXISTS is_reserved   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reserved_for  text,
  ADD COLUMN IF NOT EXISTS reserved_date date,
  ADD COLUMN IF NOT EXISTS reserved_note text;

-- Index for fast filtering (most queries exclude reserved bottles)
CREATE INDEX IF NOT EXISTS bottles_is_reserved_idx ON public.bottles (is_reserved)
  WHERE is_reserved = true;

COMMENT ON COLUMN public.bottles.is_reserved   IS 'When true, bottle is reserved for a future event and excluded from suggestions by default.';
COMMENT ON COLUMN public.bottles.reserved_for  IS 'Label describing the event or person the bottle is kept for (e.g. "Noa''s birthday").';
COMMENT ON COLUMN public.bottles.reserved_date IS 'Target date for the event the bottle is reserved for.';
COMMENT ON COLUMN public.bottles.reserved_note IS 'Optional free-text note about the reservation.';
