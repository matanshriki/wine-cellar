-- ============================================================
-- DIAGNOSE & REPAIR: Missing bottle images
-- Run in Supabase SQL Editor (safe to run multiple times)
--
-- NOTE: bottles table has: image_url, image_path, label_image_path
--       wines  table has:  image_url, image_path, label_image_path, label_image_url
-- ============================================================

-- ── STEP 1: DIAGNOSIS ────────────────────────────────────────
-- Shows a breakdown of image status across all active bottles.

SELECT
  CASE
    WHEN b.label_image_path IS NOT NULL OR b.image_path IS NOT NULL
      THEN '1_has_stable_path_on_bottle'
    WHEN b.image_url LIKE '%/storage/v1/object/sign/%'
      THEN '2_has_expired_signed_url'
    WHEN b.image_url LIKE '%/storage/v1/object/public/%'
      THEN '3_has_public_storage_url'
    WHEN b.image_url IS NOT NULL
      THEN '4_has_external_url_eg_vivino'
    ELSE '5_no_image_at_all'
  END AS image_status,
  COUNT(*) AS bottles
FROM bottles b
WHERE b.quantity > 0
GROUP BY 1
ORDER BY 1;

-- ── STEP 2: FIND BOTTLES WHOSE WINE RECORD LOST ITS IMAGE ────
-- Bottles that still have label_image_path on the bottles row
-- but the shared wine record has image_path = NULL.
-- (Root cause: a second bottle added without a photo overwrote
--  the wine record via upsert — now fixed in the app code.)

SELECT
  b.id               AS bottle_id,
  w.id               AS wine_id,
  w.wine_name,
  w.producer,
  b.label_image_path AS bottle_path,
  b.image_path       AS bottle_image_path,
  w.image_path       AS wine_path,
  w.image_url        AS wine_image_url
FROM bottles b
JOIN wines   w ON w.id = b.wine_id
WHERE b.quantity > 0
  AND COALESCE(b.label_image_path, b.image_path) IS NOT NULL
  AND COALESCE(w.image_path, w.label_image_path) IS NULL
ORDER BY b.created_at DESC;

-- ── STEP 3: REPAIR — copy bottle paths back to wine record ────
-- For every bottle that still has a path but whose wine record
-- doesn't, update the wine record with the bottle's path and a
-- permanent public URL.  Safe to re-run.

DO $$
DECLARE
  project_url    TEXT := 'https://pktelrzyllbwrmcfgocx.supabase.co';
  storage_prefix TEXT;
  updated_wines  INT;
BEGIN
  storage_prefix := project_url || '/storage/v1/object/public/labels/';

  UPDATE wines w
  SET
    image_path       = COALESCE(sub.label_image_path, sub.image_path),
    label_image_path = sub.label_image_path,
    image_url        = storage_prefix || COALESCE(sub.label_image_path, sub.image_path)
  FROM (
    SELECT DISTINCT ON (b.wine_id)
      b.wine_id,
      b.label_image_path,
      b.image_path
    FROM bottles b
    WHERE b.quantity > 0
      AND COALESCE(b.label_image_path, b.image_path) IS NOT NULL
    ORDER BY b.wine_id, b.created_at ASC  -- oldest bottle most likely to have the scanned photo
  ) sub
  WHERE w.id = sub.wine_id
    AND COALESCE(w.image_path, w.label_image_path) IS NULL;

  GET DIAGNOSTICS updated_wines = ROW_COUNT;
  RAISE NOTICE 'Wine records repaired: %', updated_wines;
END $$;

-- ── STEP 4: REPAIR — replace expired signed URLs with public URLs ──
-- Converts any remaining signed URLs to permanent public URLs
-- in bottles.image_url and wines.image_url / wines.label_image_url.

UPDATE bottles
SET image_url = (
  (regexp_match(image_url, '^(https://[^/]+)'))[1]
  || '/storage/v1/object/public/'
  || (regexp_match(image_url, 'object/sign/([^/]+)/([^?]+)'))[1]
  || '/'
  || (regexp_match(image_url, 'object/sign/([^/]+)/([^?]+)'))[2]
)
WHERE image_url LIKE '%/storage/v1/object/sign/%';

UPDATE wines
SET image_url = (
  (regexp_match(image_url, '^(https://[^/]+)'))[1]
  || '/storage/v1/object/public/'
  || (regexp_match(image_url, 'object/sign/([^/]+)/([^?]+)'))[1]
  || '/'
  || (regexp_match(image_url, 'object/sign/([^/]+)/([^?]+)'))[2]
)
WHERE image_url LIKE '%/storage/v1/object/sign/%';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name   = 'wines'
               AND column_name  = 'label_image_url') THEN
    UPDATE wines
    SET label_image_url = (
      (regexp_match(label_image_url, '^(https://[^/]+)'))[1]
      || '/storage/v1/object/public/'
      || (regexp_match(label_image_url, 'object/sign/([^/]+)/([^?]+)'))[1]
      || '/'
      || (regexp_match(label_image_url, 'object/sign/([^/]+)/([^?]+)'))[2]
    )
    WHERE label_image_url LIKE '%/storage/v1/object/sign/%';
  END IF;
END $$;

-- ── STEP 5: BACKFILL — extract stable paths from stored URLs ──
-- For rows that still have no image_path but have a storage URL,
-- extract the path component and store it.

UPDATE bottles
SET image_path = CASE
  WHEN image_url ~ 'object/sign/'   THEN (regexp_match(image_url, 'object/sign/([^/]+)/([^?]+)'))[2]
  WHEN image_url ~ 'object/public/' THEN (regexp_match(image_url, 'object/public/([^/]+)/([^?]*)'))[2]
END
WHERE image_url  LIKE '%/storage/v1/object/%'
  AND image_path IS NULL;

UPDATE wines
SET image_path = CASE
  WHEN image_url ~ 'object/sign/'   THEN (regexp_match(image_url, 'object/sign/([^/]+)/([^?]+)'))[2]
  WHEN image_url ~ 'object/public/' THEN (regexp_match(image_url, 'object/public/([^/]+)/([^?]*)'))[2]
END
WHERE image_url  LIKE '%/storage/v1/object/%'
  AND image_path IS NULL;

-- ── FINAL CHECK ───────────────────────────────────────────────
SELECT
  CASE
    WHEN b.label_image_path IS NOT NULL OR b.image_path IS NOT NULL
      THEN '1_has_stable_path_on_bottle'
    WHEN b.image_url LIKE '%/storage/v1/object/sign/%'
      THEN '2_has_expired_signed_url_STILL'
    WHEN b.image_url LIKE '%/storage/v1/object/public/%'
      THEN '3_has_public_storage_url'
    WHEN b.image_url IS NOT NULL
      THEN '4_has_external_url_eg_vivino'
    ELSE '5_no_image_at_all'
  END AS image_status,
  COUNT(*) AS bottles
FROM bottles b
WHERE b.quantity > 0
GROUP BY 1
ORDER BY 1;
