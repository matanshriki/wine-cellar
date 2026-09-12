-- =============================================================================
-- READ-ONLY verification: Sommi Memory Profile display discrepancy
-- =============================================================================
-- DO NOT run as a migration. DO NOT write/update/delete.
-- DO NOT execute mutation RPCs (apply_*, create_taste_*, resolve_taste_*).
--
-- HOW TO SUPPLY THE TARGET USER (pick ONE):
--
--   Option A — set a session GUC before running this file:
--     select set_config('app.debug_user_id', '<AUTH_USER_UUID>', false);
--
--   Option B — replace the placeholder UUID below (keep quotes):
--     Only in the CTE `target` — nowhere else.
--
-- HOW TO FIND THE AUTH USER UUID SAFELY (do not paste into chat reports):
--   1. User opens the app while signed in.
--   2. In Supabase Dashboard → Authentication → Users → copy that user's UUID, OR
--   3. From a trusted SQL session as the user/service:
--        select auth.uid();   -- when JWT is present
--      or match by email ONLY in a private admin session; do not export email
--      into this script's results or into the final diagnosis report.
--
-- PRIVACY: This script never selects email, tokens, or other users' rows.
-- Raw chat text query is COMMENTED OUT and disabled by default.
-- =============================================================================

WITH target AS (
  -- >>> SET TARGET USER UUID HERE (Option B) OR via set_config (Option A) <<<
  SELECT COALESCE(
    NULLIF(current_setting('app.debug_user_id', true), ''),
    '00000000-0000-0000-0000-000000000000'  -- replace if not using set_config
  )::uuid AS user_id
),
explicit_doc AS (
  SELECT
    t.user_id,
    p.taste_profile_version,
    p.taste_profile_updated_at,
    p.taste_profile -> 'explicit' AS explicit,
    p.taste_profile -> 'explicit' -> 'legacy_suppress' AS legacy_suppress
  FROM target t
  JOIN public.profiles p ON p.id = t.user_id
),
-- A) Canonical explicit lists (ids only — no email)
canonical_lists AS (
  SELECT
    user_id,
    taste_profile_version,
    taste_profile_updated_at,
    COALESCE(
      (
        SELECT jsonb_agg(lower(e->>'id') ORDER BY lower(e->>'id'))
        FROM jsonb_array_elements(COALESCE(explicit -> 'regions_liked', '[]'::jsonb)) e
      ),
      '[]'::jsonb
    ) AS regions_liked_ids,
    COALESCE(
      (
        SELECT jsonb_agg(lower(e->>'id') ORDER BY lower(e->>'id'))
        FROM jsonb_array_elements(COALESCE(explicit -> 'regions_disliked', '[]'::jsonb)) e
      ),
      '[]'::jsonb
    ) AS regions_disliked_ids,
    COALESCE(
      (
        SELECT jsonb_agg(lower(e->>'id') ORDER BY lower(e->>'id'))
        FROM jsonb_array_elements(COALESCE(explicit -> 'grapes_liked', '[]'::jsonb)) e
      ),
      '[]'::jsonb
    ) AS grapes_liked_ids,
    COALESCE(
      (
        SELECT jsonb_agg(lower(e->>'id') ORDER BY lower(e->>'id'))
        FROM jsonb_array_elements(COALESCE(explicit -> 'grapes_disliked', '[]'::jsonb)) e
      ),
      '[]'::jsonb
    ) AS grapes_disliked_ids,
    COALESCE(
      (
        SELECT jsonb_agg(lower(e->>'id') ORDER BY lower(e->>'id'))
        FROM jsonb_array_elements(COALESCE(explicit -> 'styles_liked', '[]'::jsonb)) e
      ),
      '[]'::jsonb
    ) AS styles_liked_ids,
    COALESCE(
      (
        SELECT jsonb_agg(lower(e->>'id') ORDER BY lower(e->>'id'))
        FROM jsonb_array_elements(COALESCE(explicit -> 'styles_disliked', '[]'::jsonb)) e
      ),
      '[]'::jsonb
    ) AS styles_disliked_ids,
    NULLIF(lower(trim(COALESCE(explicit -> 'body' ->> 'value', ''))), '') AS body_value,
    legacy_suppress
  FROM explicit_doc
),
-- C) Legacy agent memory preferences (JSON only for this user)
legacy_memory AS (
  SELECT
    t.user_id,
    m.preferences AS legacy_preferences,
    m.updated_at AS legacy_updated_at
  FROM target t
  LEFT JOIN public.sommelier_agent_memory m ON m.user_id = t.user_id
)
-- Result set 1: side-by-side comparison
SELECT
  'comparison' AS section,
  c.user_id IS NOT NULL AS user_row_found,
  c.taste_profile_version,
  c.taste_profile_updated_at,
  c.regions_liked_ids,
  c.regions_disliked_ids,
  c.grapes_liked_ids,
  c.grapes_disliked_ids,
  c.styles_liked_ids,
  c.styles_disliked_ids,
  c.body_value,
  c.legacy_suppress,
  l.legacy_preferences -> 'favoriteRegions' AS legacy_favorite_regions,
  l.legacy_preferences -> 'favoriteGrapes' AS legacy_favorite_grapes,
  l.legacy_preferences -> 'bodyPreference' AS legacy_body_preference,
  l.legacy_updated_at
FROM canonical_lists c
FULL OUTER JOIN legacy_memory l USING (user_id);

-- Result set 2: recent relevant feedback events (privacy-minimized)
WITH target AS (
  SELECT COALESCE(
    NULLIF(current_setting('app.debug_user_id', true), ''),
    '00000000-0000-0000-0000-000000000000'
  )::uuid AS user_id
)
SELECT
  'feedback_events' AS section,
  e.id AS event_id,
  e.created_at,
  e.scope,
  e.polarity,
  e.target_dimension,
  e.target_value,
  e.status,
  e.applied_to_canonical,
  e.extraction_version,
  e.conversation_id IS NOT NULL AS has_conversation_id,
  left(COALESCE(e.preference_delta->>'schema', ''), 40) AS delta_schema,
  left(COALESCE(e.preference_delta->>'class', ''), 40) AS delta_class,
  left(COALESCE(e.preference_delta->>'reason', ''), 40) AS delta_reason,
  left(COALESCE(e.preference_delta->>'extraction_method', ''), 40) AS extraction_method,
  CASE
    WHEN e.preference_delta ? 'error' THEN left(e.preference_delta->>'error', 80)
    ELSE NULL
  END AS safe_error_snippet
FROM target t
JOIN public.sommelier_feedback_events e ON e.user_id = t.user_id
WHERE e.created_at > now() - interval '90 days'
  AND (
    e.target_dimension IN ('region', 'grape', 'body', 'style')
    OR e.scope IN ('stable', 'stable_candidate', 'ambiguous')
    OR e.status IN ('applied', 'pending_confirmation', 'recorded_no_apply', 'pending_unsupported')
    OR COALESCE(e.extraction_version, '') ILIKE '%profile%'
    OR COALESCE(e.extraction_version, '') ILIKE '%rules%'
  )
ORDER BY e.created_at DESC
LIMIT 80;

-- =============================================================================
-- OPTIONAL (DISABLED): raw text diagnostic — uncomment ONLY in a private session.
-- Never paste raw_text into tickets/chats shared beyond the account owner.
-- =============================================================================
-- WITH target AS (
--   SELECT COALESCE(
--     NULLIF(current_setting('app.debug_user_id', true), ''),
--     '00000000-0000-0000-0000-000000000000'
--   )::uuid AS user_id
-- )
-- SELECT
--   e.id,
--   e.created_at,
--   e.target_dimension,
--   e.target_value,
--   e.status,
--   e.applied_to_canonical,
--   left(e.raw_text, 200) AS raw_text_prefix
-- FROM target t
-- JOIN public.sommelier_feedback_events e ON e.user_id = t.user_id
-- ORDER BY e.created_at DESC
-- LIMIT 40;
