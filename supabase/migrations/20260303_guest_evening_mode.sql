-- Migration: Guest mode for evening plans
-- Adds short-code share links and anonymous guest voting
-- Date: 2026-03-03

-- ─────────────────────────────────────────────
-- 1. evening_plan_shares
-- Short-code links a host can share with guests.
-- id is a human-readable 7-char alphanumeric code (same pattern as shared_cellars).
-- lineup_snapshot stores a frozen copy of the queue at share time.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.evening_plan_shares (
  id TEXT PRIMARY KEY CHECK (char_length(id) >= 6 AND char_length(id) <= 10),
  evening_plan_id UUID NOT NULL REFERENCES public.evening_plans(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Frozen copy of lineup so guest page works even if plan is modified later
  -- Array of: { wine_id, bottle_id, position, wine_name, producer, vintage, color, image_url }
  lineup_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Plan context for guest page header
  occasion TEXT,
  plan_name TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_evening_plan_shares_plan_id
  ON public.evening_plan_shares(evening_plan_id);

CREATE INDEX IF NOT EXISTS idx_evening_plan_shares_created_by
  ON public.evening_plan_shares(created_by);

-- RLS: only the authenticated host can create/read/update their own shares
ALTER TABLE public.evening_plan_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Host manages own shares"
  ON public.evening_plan_shares
  FOR ALL
  USING (auth.uid() = created_by);

COMMENT ON TABLE public.evening_plan_shares IS
  'Short-code share links for evening plans (host → guests). '
  'id is a 7-char URL-safe alphanumeric code.';

COMMENT ON COLUMN public.evening_plan_shares.lineup_snapshot IS
  'Frozen queue snapshot at share time: [{wine_id, wine_name, producer, vintage, color, image_url, ...}]';

-- ─────────────────────────────────────────────
-- 2. evening_guest_votes
-- Anonymous, session-based "favorite" votes from guests.
-- voter_fingerprint = a UUID the guest generates on first visit and persists in localStorage.
-- Unique constraint prevents duplicate votes per (share, wine, guest).
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.evening_guest_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id TEXT NOT NULL REFERENCES public.evening_plan_shares(id) ON DELETE CASCADE,
  wine_id UUID NOT NULL,
  voter_fingerprint TEXT NOT NULL,
  vote_type TEXT NOT NULL DEFAULT 'favorite',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_vote_per_guest UNIQUE (share_id, wine_id, voter_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_evening_guest_votes_share_id
  ON public.evening_guest_votes(share_id);

CREATE INDEX IF NOT EXISTS idx_evening_guest_votes_share_wine
  ON public.evening_guest_votes(share_id, wine_id);

-- RLS: no direct public access; edge functions use service role key to bypass RLS.
-- The host can read their own plan's votes (for the summary view).
ALTER TABLE public.evening_guest_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Host reads own plan votes"
  ON public.evening_guest_votes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.evening_plan_shares eps
      WHERE eps.id = share_id AND eps.created_by = auth.uid()
    )
  );

COMMENT ON TABLE public.evening_guest_votes IS
  'Anonymous guest wine votes for shared evening lineups. '
  'voter_fingerprint is a UUID stored in the guest browser localStorage only.';
