-- One-time backfill: extract storage paths from signed/public URLs for ALL users
-- Run this once in Supabase SQL Editor. No admin panel needed.
-- Safe to run multiple times (only updates rows where path is still null).

-- Bottles: image_url -> image_path
UPDATE bottles
SET image_path = CASE
  WHEN image_url ~ 'object/sign/' THEN (regexp_match(image_url, 'object/sign/([^/]+)/([^?]+)'))[2]
  WHEN image_url ~ 'object/public/' THEN (regexp_match(image_url, 'object/public/([^/]+)/([^?]*)'))[2]
  ELSE NULL
END
WHERE image_url IS NOT NULL
  AND image_url LIKE '%/storage/v1/object/%'
  AND (image_path IS NULL OR image_path = '');

-- Bottles: label_image_url -> label_image_path (only if column exists; skip if not)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bottles' AND column_name = 'label_image_url') THEN
    UPDATE bottles
    SET label_image_path = CASE
      WHEN label_image_url ~ 'object/sign/' THEN (regexp_match(label_image_url, 'object/sign/([^/]+)/([^?]+)'))[2]
      WHEN label_image_url ~ 'object/public/' THEN (regexp_match(label_image_url, 'object/public/([^/]+)/([^?]*)'))[2]
      ELSE NULL
    END
    WHERE label_image_url IS NOT NULL
      AND label_image_url LIKE '%/storage/v1/object/%'
      AND (label_image_path IS NULL OR label_image_path = '');
  END IF;
END $$;

-- Wines: image_url -> image_path
UPDATE wines
SET image_path = CASE
  WHEN image_url ~ 'object/sign/' THEN (regexp_match(image_url, 'object/sign/([^/]+)/([^?]+)'))[2]
  WHEN image_url ~ 'object/public/' THEN (regexp_match(image_url, 'object/public/([^/]+)/([^?]*)'))[2]
  ELSE NULL
END
WHERE image_url IS NOT NULL
  AND image_url LIKE '%/storage/v1/object/%'
  AND (image_path IS NULL OR image_path = '');

-- Wines: label_image_url -> label_image_path (only if column exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'wines' AND column_name = 'label_image_url') THEN
    UPDATE wines
    SET label_image_path = CASE
      WHEN label_image_url ~ 'object/sign/' THEN (regexp_match(label_image_url, 'object/sign/([^/]+)/([^?]+)'))[2]
      WHEN label_image_url ~ 'object/public/' THEN (regexp_match(label_image_url, 'object/public/([^/]+)/([^?]*)'))[2]
      ELSE NULL
    END
    WHERE label_image_url IS NOT NULL
      AND label_image_url LIKE '%/storage/v1/object/%'
      AND (label_image_path IS NULL OR label_image_path = '');
  END IF;
END $$;
