-- ============================================================
-- Food Pairing Backfill — pg_cron setup
-- ============================================================
-- Run this ONCE in the Supabase SQL editor (not as a migration).
-- DO NOT commit this file with real secrets filled in.
--
-- Pre-requisites:
--   1. Enable pg_cron and pg_net extensions (Database → Extensions).
--   2. Deploy: supabase functions deploy backfill-food-pairing
--   3. Edge Function secret: BACKFILL_CRON_SECRET (same value you put in x-cron-secret below)
--
-- IMPORTANT — Supabase requires the anon (publishable) key on every Edge Function call:
--   https://supabase.com/docs/guides/functions/schedule-functions
--   Use Vault (recommended) OR inline placeholders below.
-- ============================================================

-- ── Recommended: Vault (publishable key + project URL + cron secret) ───────

-- select vault.create_secret('https://pktelrzyllbwrmcfgocx.supabase.co', 'project_url');
-- select vault.create_secret('YOUR_SUPABASE_ANON_KEY', 'publishable_key');
-- select vault.create_secret('YOUR_BACKFILL_CRON_SECRET', 'backfill_cron_secret');

-- SELECT cron.schedule(
--   'food-pairing-backfill',
--   '*/5 * * * *',
--   $$
--   SELECT net.http_post(
--     url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
--            || '/functions/v1/backfill-food-pairing',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
--       'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
--       'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'backfill_cron_secret')
--     ),
--     body := '{"batchSize": 15}'::jsonb
--   );
--   $$
-- );

-- ── One-off: trigger a single wine (replace all YOUR_* placeholders) ───────

-- SELECT net.http_post(
--   url     := 'https://pktelrzyllbwrmcfgocx.supabase.co/functions/v1/backfill-food-pairing',
--   headers := jsonb_build_object(
--     'Content-Type', 'application/json',
--     'Authorization', 'Bearer YOUR_SUPABASE_ANON_KEY',
--     'apikey', 'YOUR_SUPABASE_ANON_KEY',
--     'x-cron-secret', 'YOUR_BACKFILL_CRON_SECRET'
--   ),
--   body    := jsonb_build_object('wine_id', 'YOUR-WINE-UUID')
-- );

-- ── Debug: see HTTP result (wait a few seconds after http_post) ────────────

-- SELECT id, status_code, left(content::text, 2000) AS body_preview
-- FROM net._http_response
-- ORDER BY id DESC
-- LIMIT 10;

-- How many wines still need pairing:
-- SELECT COUNT(*) FROM public.wines WHERE food_pairing IS NULL;

-- SELECT cron.unschedule('food-pairing-backfill');
