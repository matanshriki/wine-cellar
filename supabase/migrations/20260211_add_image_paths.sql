-- Add stable storage paths for images
-- Fix: Store paths instead of expiring signed URLs

-- Add path columns to bottles table
ALTER TABLE bottles
ADD COLUMN IF NOT EXISTS label_image_path TEXT,
ADD COLUMN IF NOT EXISTS image_path TEXT;

-- Add path columns to wines table
ALTER TABLE wines
ADD COLUMN IF NOT EXISTS label_image_path TEXT,
ADD COLUMN IF NOT EXISTS image_path TEXT;

-- Add indexes for backfill queries
CREATE INDEX IF NOT EXISTS idx_bottles_label_image_url ON bottles(label_image_url) WHERE label_image_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wines_label_image_url ON wines(label_image_url) WHERE label_image_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bottles_image_url ON bottles(image_url) WHERE image_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wines_image_url ON wines(image_url) WHERE image_url IS NOT NULL;

-- Comments
COMMENT ON COLUMN bottles.label_image_path IS 'Stable storage path for label image (e.g. "labels/userId/uuid.jpg") - generates URL at runtime';
COMMENT ON COLUMN bottles.image_path IS 'Stable storage path for bottle image - generates URL at runtime';
COMMENT ON COLUMN wines.label_image_path IS 'Stable storage path for wine label image - generates URL at runtime';
COMMENT ON COLUMN wines.image_path IS 'Stable storage path for wine image - generates URL at runtime';

-- Keep old *_url columns for backward compatibility during migration
-- DO NOT drop them yet - will be deprecated after backfill completes
