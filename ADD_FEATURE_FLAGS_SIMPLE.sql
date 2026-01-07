-- SIMPLIFIED VERSION - Just add the columns (no index issues)
-- Run this first to add the feature flag columns

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS can_share_cellar BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS can_multi_bottle_import BOOLEAN DEFAULT FALSE;

-- That's it! The columns are now added.
-- You can add indexes later if needed.

-- To verify it worked:
-- SELECT * FROM profiles LIMIT 1;

