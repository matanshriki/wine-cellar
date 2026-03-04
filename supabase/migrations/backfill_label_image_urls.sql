-- Backfill permanent public URLs for existing bottles/wines that already have
-- a storage path (image_path / label_image_path) but a NULL image_url.
--
-- The "labels" storage bucket is public, so the URL pattern is:
--   https://<project-ref>.supabase.co/storage/v1/object/public/labels/<path>
--
-- HOW TO RUN:
--   1. Replace <YOUR_PROJECT_REF> below with your Supabase project reference ID
--      (visible in Settings → General, e.g. "pktelrzyllbwrmcfgocx")
--   2. Run this script in the Supabase SQL Editor (one-time operation)

DO $$
DECLARE
  project_url TEXT := 'https://pktelrzyllbwrmcfgocx.supabase.co';  -- ← your project URL
  storage_prefix TEXT;
BEGIN
  storage_prefix := project_url || '/storage/v1/object/public/labels/';

  -- ── Backfill wines ──────────────────────────────────────────────────────────
  UPDATE public.wines
  SET image_url = storage_prefix || COALESCE(label_image_path, image_path)
  WHERE image_url IS NULL
    AND COALESCE(label_image_path, image_path) IS NOT NULL;

  RAISE NOTICE 'wines backfilled: % rows', (
    SELECT COUNT(*) FROM public.wines
    WHERE image_url LIKE storage_prefix || '%'
  );

  -- ── Backfill bottles ────────────────────────────────────────────────────────
  UPDATE public.bottles
  SET image_url = storage_prefix || COALESCE(label_image_path, image_path)
  WHERE image_url IS NULL
    AND COALESCE(label_image_path, image_path) IS NOT NULL;

  RAISE NOTICE 'bottles backfilled: % rows', (
    SELECT COUNT(*) FROM public.bottles
    WHERE image_url LIKE storage_prefix || '%'
  );
END $$;
