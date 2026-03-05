-- Add stable storage paths for images
-- Fix: Store paths instead of expiring signed URLs
-- Assumes image_url (and optionally label_image_url) already exist. Only adds path columns.

-- Add path columns to bottles table
ALTER TABLE bottles
ADD COLUMN IF NOT EXISTS label_image_path TEXT,
ADD COLUMN IF NOT EXISTS image_path TEXT;

-- Add path columns to wines table
ALTER TABLE wines
ADD COLUMN IF NOT EXISTS label_image_path TEXT,
ADD COLUMN IF NOT EXISTS image_path TEXT;

-- Add indexes only for existing URL columns (safe if you have only image_url)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bottles' AND column_name = 'label_image_url') THEN
    CREATE INDEX IF NOT EXISTS idx_bottles_label_image_url ON bottles(label_image_url) WHERE label_image_url IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bottles' AND column_name = 'image_url') THEN
    CREATE INDEX IF NOT EXISTS idx_bottles_image_url ON bottles(image_url) WHERE image_url IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'wines' AND column_name = 'label_image_url') THEN
    CREATE INDEX IF NOT EXISTS idx_wines_label_image_url ON wines(label_image_url) WHERE label_image_url IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'wines' AND column_name = 'image_url') THEN
    CREATE INDEX IF NOT EXISTS idx_wines_image_url ON wines(image_url) WHERE image_url IS NOT NULL;
  END IF;
END $$;

-- Comments
COMMENT ON COLUMN bottles.label_image_path IS 'Stable storage path for label image (e.g. "labels/userId/uuid.jpg") - generates URL at runtime';
COMMENT ON COLUMN bottles.image_path IS 'Stable storage path for bottle image - generates URL at runtime';
COMMENT ON COLUMN wines.label_image_path IS 'Stable storage path for wine label image - generates URL at runtime';
COMMENT ON COLUMN wines.image_path IS 'Stable storage path for wine image - generates URL at runtime';

-- Keep existing image_url (and label_image_url if present) for backward compatibility. Do not drop them.
