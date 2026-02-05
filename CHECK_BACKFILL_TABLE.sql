-- Quick check: Does profile_backfill_jobs table exist?

SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'profile_backfill_jobs'
) as table_exists;

-- If FALSE, you need to run the wine profiles migration
-- File: supabase/migrations/20260205_add_wine_profiles.sql
