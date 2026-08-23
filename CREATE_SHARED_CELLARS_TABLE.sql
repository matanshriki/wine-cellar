-- Create shared_cellars table for short, reliable share links
-- Prefer applying supabase/migrations/20260823_phase0_batch3_4_view_and_shares.sql
-- for lockdown (no world-readable SELECT; public access via get_shared_cellar_public).

CREATE TABLE IF NOT EXISTS shared_cellars (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  view_count INTEGER DEFAULT 0,
  revoked_at TIMESTAMPTZ NULL,
  CONSTRAINT shared_cellars_id_length CHECK (char_length(id) >= 6 AND char_length(id) <= 10)
);

CREATE INDEX IF NOT EXISTS idx_shared_cellars_id ON shared_cellars(id);
CREATE INDEX IF NOT EXISTS idx_shared_cellars_user_id ON shared_cellars(user_id);
CREATE INDEX IF NOT EXISTS idx_shared_cellars_expires_at ON shared_cellars(expires_at);

ALTER TABLE shared_cellars ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view shared cellars" ON shared_cellars;

DROP POLICY IF EXISTS "Users can view their own shared cellars" ON shared_cellars;
CREATE POLICY "Users can view their own shared cellars"
  ON shared_cellars FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own shared cellars" ON shared_cellars;
CREATE POLICY "Users can create their own shared cellars"
  ON shared_cellars FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own shared cellars" ON shared_cellars;
CREATE POLICY "Users can delete their own shared cellars"
  ON shared_cellars FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own shared cellars" ON shared_cellars;
CREATE POLICY "Users can update their own shared cellars"
  ON shared_cellars FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

REVOKE ALL ON TABLE public.shared_cellars FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.shared_cellars TO authenticated;
