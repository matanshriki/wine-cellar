-- ============================================================
-- Food Pairing Backfill — pg_cron setup
-- ============================================================
-- Run this ONCE in the Supabase SQL editor (not as a migration).
-- DO NOT commit this file with real secrets filled in.
--
-- Pre-requisites:
--   1. Enable pg_cron and pg_net extensions in the Supabase dashboard
--      (Database → Extensions → search "cron" and "http")
--   2. Deploy the Edge Function:
--        supabase functions deploy backfill-food-pairing
--   3. Set BACKFILL_CRON_SECRET in Supabase Edge Function env vars:
--        supabase secrets set BACKFILL_CRON_SECRET=<your-random-secret>
--      or via Supabase dashboard → Edge Functions → backfill-food-pairing → Secrets
--   4. Replace the two placeholders below with the actual values, then run.
-- ============================================================

-- Replace these two values before running:
-- YOUR_CRON_SECRET  →  the same value you set as BACKFILL_CRON_SECRET above
-- YOUR_PROJECT_REF  →  pktelrzyllbwrmcfgocx  (your Supabase project ref)

SELECT cron.schedule(
  'food-pairing-backfill',    -- job name (must be unique)
  '*/5 * * * *',              -- every 5 minutes; change to '*/10 * * * *' for calmer pace
  $$
  SELECT net.http_post(
    url     := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/backfill-food-pairing',
    headers := jsonb_build_object(
      'Content-Type',   'application/json',
      'x-cron-secret',  'YOUR_CRON_SECRET'
    ),
    body    := '{"batchSize": 15}'::jsonb
  );
  $$
);

-- ── Useful admin queries ──────────────────────────────────────────────────────

-- Check that the job was created:
-- SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'food-pairing-backfill';

-- Watch recent run history (last 20):
-- SELECT runid, jobid, status, start_time, end_time
--   FROM cron.job_run_details
--  WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'food-pairing-backfill')
--  ORDER BY start_time DESC LIMIT 20;

-- How many wines still need pairing:
-- SELECT COUNT(*) FROM public.wines WHERE food_pairing IS NULL;

-- Pause the job once all wines are processed:
-- SELECT cron.unschedule('food-pairing-backfill');

-- Remove the job entirely:
-- SELECT cron.unschedule('food-pairing-backfill');
