-- ============================================================
-- Readiness Backfill — Pure SQL (run in Supabase SQL Editor)
-- Replicates the logic from the backfill-readiness edge function v2
-- Applies to ALL bottles for ALL users in one shot.
--
-- Safe to run multiple times — only updates rows where data
-- is missing or version is outdated (change the WHERE clause
-- at the bottom if you want to force-update everything).
-- ============================================================

WITH

-- ── Step 1: Join bottles → wines, compute age and structure score ──────────
wine_data AS (
  SELECT
    b.id                                                          AS bottle_id,
    w.vintage,
    LOWER(COALESCE(w.color, 'red'))                               AS color,
    LOWER(COALESCE(w.region, ''))                                 AS region,
    (EXTRACT(YEAR FROM NOW())::int - w.vintage)                   AS age,

    -- Structure score from wine_profile JSONB (used for red aging potential)
    COALESCE((w.wine_profile->>'body')::numeric,    3)
    + COALESCE((w.wine_profile->>'tannin')::numeric,  3)
    + COALESCE((w.wine_profile->>'acidity')::numeric, 3)
    + COALESCE((w.wine_profile->>'oak')::numeric,     2)
    + COALESCE((w.wine_profile->>'power')::numeric,   3)          AS structure_score,

    -- Grapes as a searchable text string (handles both JSONB array and plain text)
    LOWER(
      CASE
        WHEN jsonb_typeof(w.grapes) = 'array'
        THEN array_to_string(ARRAY(SELECT jsonb_array_elements_text(w.grapes)), ' ')
        ELSE COALESCE(w.grapes::text, '')
      END
    )                                                             AS grapes_str,

    w.wine_profile IS NOT NULL                                    AS has_profile

  FROM bottles b
  JOIN wines   w ON w.id = b.wine_id
  WHERE w.vintage IS NOT NULL
    AND w.vintage >= 1900
    AND w.vintage <= EXTRACT(YEAR FROM NOW())::int + 1
),

-- ── Step 2: Derive aging_potential for reds ───────────────────────────────
with_potential AS (
  SELECT *,
    CASE
      -- Not needed for sparkling / white / rosé
      WHEN color LIKE '%sparkling%'
        OR color LIKE '%white%'
        OR color LIKE '%rose%'
        OR color LIKE '%rosé%'
      THEN NULL

      -- Use wine profile structure score when available
      WHEN has_profile THEN
        CASE
          WHEN structure_score >= 18 THEN 'high'
          WHEN structure_score <= 12 THEN 'low'
          ELSE                            'medium'
        END

      -- Heuristic fallback based on region / grape variety
      ELSE
        CASE
          WHEN region    LIKE '%bordeaux%'
            OR region    LIKE '%barolo%'
            OR region    LIKE '%brunello%'
            OR grapes_str LIKE '%cabernet%'
          THEN 'high'

          WHEN grapes_str LIKE '%pinot noir%'
            OR grapes_str LIKE '%gamay%'
          THEN 'low'

          ELSE 'medium'
        END
    END AS aging_potential

  FROM wine_data
),

-- ── Step 3: Expand aging_potential into numeric thresholds ───────────────
with_thresholds AS (
  SELECT *,
    -- Years from vintage before bottle enters drinking window
    CASE aging_potential
      WHEN 'high'   THEN 4
      WHEN 'low'    THEN 1
      ELSE               2
    END AS hold_until,

    -- Year range where bottle is considered "Peak"
    CASE aging_potential
      WHEN 'high'   THEN 6
      WHEN 'low'    THEN 2
      ELSE               3
    END AS peak_start,

    CASE aging_potential
      WHEN 'high'   THEN 15
      WHEN 'low'    THEN 5
      ELSE               8
    END AS peak_end,

    -- Upper bound of the drinking window
    CASE aging_potential
      WHEN 'high'   THEN 25
      WHEN 'low'    THEN 8
      ELSE               15
    END AS max_age

  FROM with_potential
),

-- ── Step 4: Compute final readiness_score, drink_status, windows ─────────
computed AS (
  SELECT
    bottle_id,
    vintage,

    -- readiness_score (0-100)
    CASE
      -- Sparkling
      WHEN color LIKE '%sparkling%' THEN
        CASE
          WHEN age < 1   THEN 80
          WHEN age <= 5  THEN 85
          ELSE                60
        END

      -- White / Rosé
      WHEN color LIKE '%white%'
        OR color LIKE '%rose%'
        OR color LIKE '%rosé%' THEN
        CASE
          WHEN age < 1   THEN 75
          WHEN age <= 3  THEN 85
          WHEN age <= 7  THEN 70
          ELSE                55
        END

      -- Red (all others)
      ELSE
        CASE
          WHEN age < hold_until  THEN 40
          WHEN age < peak_start  THEN 65
          WHEN age <= peak_end   THEN 90
          WHEN age <= max_age    THEN 75
          ELSE                        50
        END
    END AS readiness_score,

    -- readiness_status enum value
    CASE
      WHEN color LIKE '%sparkling%' THEN
        CASE WHEN age <= 5 THEN 'InWindow' ELSE 'PastPeak' END

      WHEN color LIKE '%white%'
        OR color LIKE '%rose%'
        OR color LIKE '%rosé%' THEN
        CASE
          WHEN age < 1   THEN 'InWindow'
          WHEN age <= 3  THEN 'Peak'
          WHEN age <= 7  THEN 'InWindow'
          ELSE                'PastPeak'
        END

      ELSE  -- Red
        CASE
          WHEN age < hold_until  THEN 'TooYoung'
          WHEN age < peak_start  THEN 'Approaching'
          WHEN age <= peak_end   THEN 'Peak'
          WHEN age <= max_age    THEN 'InWindow'
          ELSE                        'PastPeak'
        END
    END AS drink_status,

    -- drink_window_start (year)
    CASE
      WHEN color LIKE '%sparkling%'
        OR color LIKE '%white%'
        OR color LIKE '%rose%'
        OR color LIKE '%rosé%'
      THEN vintage
      ELSE vintage + hold_until
    END AS drink_from_year,

    -- drink_window_end (year)
    CASE
      WHEN color LIKE '%sparkling%'                          THEN vintage + 5
      WHEN color LIKE '%white%'
        OR color LIKE '%rose%'
        OR color LIKE '%rosé%'                              THEN vintage + 7
      ELSE                                                       vintage + max_age
    END AS drink_to_year,

    -- Confidence level mirrors the edge function logic
    CASE
      WHEN color LIKE '%sparkling%'                          THEN 'high'
      WHEN color LIKE '%white%'
        OR color LIKE '%rose%'
        OR color LIKE '%rosé%'                              THEN 'med'
      WHEN has_profile                                       THEN 'high'
      ELSE                                                        'low'
    END AS confidence

  FROM with_thresholds
)

-- ── Final UPDATE ──────────────────────────────────────────────────────────
UPDATE bottles
SET
  readiness_score      = c.readiness_score,
  readiness_status     = c.drink_status,
  drink_window_start   = c.drink_from_year,
  drink_window_end     = c.drink_to_year,
  readiness_confidence = c.confidence,
  readiness_version    = 2,
  readiness_updated_at = NOW()
FROM computed c
WHERE bottles.id = c.bottle_id
  -- Only update bottles that are missing readiness data or are on an older version.
  -- Remove this condition (or change to "AND 1=1") to force-update everything.
  AND (
    bottles.readiness_score IS NULL
    OR bottles.readiness_status IS NULL
    OR bottles.readiness_updated_at IS NULL
    OR COALESCE(bottles.readiness_version, 0) < 2
  );

-- Show how many rows were updated
-- (Supabase SQL editor displays this automatically)
