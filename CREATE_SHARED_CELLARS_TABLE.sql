-- Create shared_cellars table for short, reliable share links
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS shared_cellars (
  id TEXT PRIMARY KEY, -- Short ID like 'xK9mP2'
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_data JSONB NOT NULL, -- Stores bottles, stats, userName, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'), -- Auto-expire after 30 days
  view_count INTEGER DEFAULT 0, -- Track how many times link was viewed
  
  CONSTRAINT shared_cellars_id_length CHECK (char_length(id) >= 6 AND char_length(id) <= 10)
);

-- Index for fast lookups by share ID
CREATE INDEX IF NOT EXISTS idx_shared_cellars_id ON shared_cellars(id);

-- Index for user's shared cellars
CREATE INDEX IF NOT EXISTS idx_shared_cellars_user_id ON shared_cellars(user_id);

-- Index for cleanup of expired shares
CREATE INDEX IF NOT EXISTS idx_shared_cellars_expires_at ON shared_cellars(expires_at);

-- Enable Row Level Security
ALTER TABLE shared_cellars ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view shared cellars (public read)
CREATE POLICY "Anyone can view shared cellars"
  ON shared_cellars
  FOR SELECT
  USING (true);

-- Policy: Users can create their own shared cellars
CREATE POLICY "Users can create their own shared cellars"
  ON shared_cellars
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own shared cellars
CREATE POLICY "Users can delete their own shared cellars"
  ON shared_cellars
  FOR DELETE
  USING (auth.uid() = user_id);

-- Policy: Users can update their own shared cellars
CREATE POLICY "Users can update their own shared cellars"
  ON shared_cellars
  FOR UPDATE
  USING (auth.uid() = user_id);

COMMENT ON TABLE shared_cellars IS 'Stores shared cellar data with short IDs for reliable sharing';
COMMENT ON COLUMN shared_cellars.id IS 'Short, URL-safe share ID (6-10 chars)';
COMMENT ON COLUMN shared_cellars.share_data IS 'JSON object containing bottles, stats, userName, avatarUrl, sortBy, sortDir';
COMMENT ON COLUMN shared_cellars.expires_at IS 'Automatic expiration date (default 30 days)';
COMMENT ON COLUMN shared_cellars.view_count IS 'Number of times this share link was viewed';

