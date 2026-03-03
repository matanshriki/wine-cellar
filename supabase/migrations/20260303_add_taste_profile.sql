-- Migration: Add taste_profile columns to profiles table
-- Purpose: Store per-user wine taste preferences derived from ratings
-- Date: 2026-03-03

-- Add taste profile columns to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS taste_profile jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS taste_profile_updated_at timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS taste_profile_version int NOT NULL DEFAULT 1;

-- Create index for efficient querying of users with taste profiles
CREATE INDEX IF NOT EXISTS idx_profiles_taste_profile_updated_at 
ON profiles (taste_profile_updated_at) 
WHERE taste_profile IS NOT NULL;

-- Add comment documenting the taste_profile JSON schema
COMMENT ON COLUMN profiles.taste_profile IS 'User taste profile JSON: {
  "version": 1,
  "vector": { "body": 0-1, "tannin": 0-1, "acidity": 0-1, "oak": 0-1, "sweetness": 0-1, "power": 0-1 },
  "preferences": {
    "reds_bias": -1 to 1,
    "whites_bias": -1 to 1,
    "sparkling_bias": -1 to 1,
    "style_tags": { "<tag>": weight },
    "regions": { "<region>": weight },
    "grapes": { "<grape>": weight }
  },
  "overrides": { "vector": { ... } },
  "confidence": "low"|"med"|"high",
  "data_points": { "rated_count": number, "last_rated_at": ISO string }
}';

COMMENT ON COLUMN profiles.taste_profile_updated_at IS 'Timestamp of last taste profile computation';
COMMENT ON COLUMN profiles.taste_profile_version IS 'Schema version of taste profile (for future migrations)';
