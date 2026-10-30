-- ============================================================
-- SUPERSEDED — DO NOT APPLY SEPARATELY
--
-- The as-of / half-open / durable_comparable metrics logic is now
-- included in:
--   supabase/migrations/20261030_admin_engagement_dashboard.sql
--
-- Applying this file after the cleaned migration is unnecessary and
-- can cause confusion. Kept only for historical reference of the
-- incremental patch that was folded into the release migration.
-- ============================================================

SELECT 'engagement_as_of_coverage_patch.sql is superseded; apply 20261030_admin_engagement_dashboard.sql only'
  AS notice;
