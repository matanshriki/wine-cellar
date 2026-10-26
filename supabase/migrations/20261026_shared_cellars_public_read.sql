-- Ensure shared_cellars exists with public read for share links,
-- and a sensible expiry default aligned with product copy (7 days).

CREATE TABLE IF NOT EXISTS public.shared_cellars (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  view_count INTEGER DEFAULT 0,
  CONSTRAINT shared_cellars_id_length CHECK (char_length(id) >= 6 AND char_length(id) <= 10)
);

CREATE INDEX IF NOT EXISTS idx_shared_cellars_id ON public.shared_cellars(id);
CREATE INDEX IF NOT EXISTS idx_shared_cellars_user_id ON public.shared_cellars(user_id);
CREATE INDEX IF NOT EXISTS idx_shared_cellars_expires_at ON public.shared_cellars(expires_at);

ALTER TABLE public.shared_cellars ENABLE ROW LEVEL SECURITY;

-- Align default expiry with in-app copy ("Expires in 7 days")
ALTER TABLE public.shared_cellars
  ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '7 days');

DROP POLICY IF EXISTS "Anyone can view shared cellars" ON public.shared_cellars;
CREATE POLICY "Anyone can view shared cellars"
  ON public.shared_cellars
  FOR SELECT
  USING (expires_at IS NULL OR expires_at > NOW());

DROP POLICY IF EXISTS "Users can create their own shared cellars" ON public.shared_cellars;
CREATE POLICY "Users can create their own shared cellars"
  ON public.shared_cellars
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own shared cellars" ON public.shared_cellars;
CREATE POLICY "Users can delete their own shared cellars"
  ON public.shared_cellars
  FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own shared cellars" ON public.shared_cellars;
CREATE POLICY "Users can update their own shared cellars"
  ON public.shared_cellars
  FOR UPDATE
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.shared_cellars IS 'Stores shared cellar data with short IDs for reliable sharing';
