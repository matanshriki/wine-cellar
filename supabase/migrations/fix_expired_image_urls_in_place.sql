-- Fix broken image URLs in place (no new columns, no code changes)
-- Replaces expired signed URLs with permanent PUBLIC URLs in the same column.
--
-- REQUIREMENT: Your storage bucket (e.g. "labels") must be PUBLIC in Supabase:
--   Dashboard → Storage → select bucket → set "Public bucket" ON
--
-- Run once in Supabase SQL Editor. Safe to run multiple times.

-- Bottles: replace image_url with public URL (same column)
UPDATE bottles
SET image_url = (
  (regexp_match(image_url, '^(https://[^/]+)'))[1]
  || '/storage/v1/object/public/'
  || (regexp_match(image_url, 'object/sign/([^/]+)/([^?]+)'))[1]
  || '/'
  || (regexp_match(image_url, 'object/sign/([^/]+)/([^?]+)'))[2]
)
WHERE image_url IS NOT NULL
  AND image_url LIKE '%/storage/v1/object/sign/%';

-- Bottles: same for label_image_url if the column exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bottles' AND column_name = 'label_image_url') THEN
    UPDATE bottles
    SET label_image_url = (
      (regexp_match(label_image_url, '^(https://[^/]+)'))[1]
      || '/storage/v1/object/public/'
      || (regexp_match(label_image_url, 'object/sign/([^/]+)/([^?]+)'))[1]
      || '/'
      || (regexp_match(label_image_url, 'object/sign/([^/]+)/([^?]+)'))[2]
    )
    WHERE label_image_url IS NOT NULL
      AND label_image_url LIKE '%/storage/v1/object/sign/%';
  END IF;
END $$;

-- Wines: replace image_url with public URL (same column)
UPDATE wines
SET image_url = (
  (regexp_match(image_url, '^(https://[^/]+)'))[1]
  || '/storage/v1/object/public/'
  || (regexp_match(image_url, 'object/sign/([^/]+)/([^?]+)'))[1]
  || '/'
  || (regexp_match(image_url, 'object/sign/([^/]+)/([^?]+)'))[2]
)
WHERE image_url IS NOT NULL
  AND image_url LIKE '%/storage/v1/object/sign/%';

-- Wines: same for label_image_url if the column exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'wines' AND column_name = 'label_image_url') THEN
    UPDATE wines
    SET label_image_url = (
      (regexp_match(label_image_url, '^(https://[^/]+)'))[1]
      || '/storage/v1/object/public/'
      || (regexp_match(label_image_url, 'object/sign/([^/]+)/([^?]+)'))[1]
      || '/'
      || (regexp_match(label_image_url, 'object/sign/([^/]+)/([^?]+)'))[2]
    )
    WHERE label_image_url IS NOT NULL
      AND label_image_url LIKE '%/storage/v1/object/sign/%';
  END IF;
END $$;
