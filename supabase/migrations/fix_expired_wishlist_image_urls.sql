-- Fix broken image URLs in wishlist (no new columns, no code changes)
-- Replaces expired signed URLs with permanent PUBLIC URLs in wishlist_items.image_url.
--
-- REQUIREMENT: Your storage bucket (e.g. "labels") must be PUBLIC in Supabase:
--   Dashboard → Storage → select bucket → set "Public bucket" ON
--
-- Run once in Supabase SQL Editor. Safe to run multiple times.

-- Wishlist items: replace image_url with public URL (same column)
UPDATE wishlist_items
SET image_url = (
  (regexp_match(image_url, '^(https://[^/]+)'))[1]
  || '/storage/v1/object/public/'
  || (regexp_match(image_url, 'object/sign/([^/]+)/([^?]+)'))[1]
  || '/'
  || (regexp_match(image_url, 'object/sign/([^/]+)/([^?]+)'))[2]
)
WHERE image_url IS NOT NULL
  AND image_url LIKE '%/storage/v1/object/sign/%';
