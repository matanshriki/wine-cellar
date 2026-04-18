-- Example: schedule daily-bottle-scan-summary with pg_cron + pg_net.
-- Prerequisites: enable pg_cron and pg_net; store secrets in Supabase Vault (Dashboard → Vault).
--
-- Recommended header: Authorization: Bearer <WEBHOOK_SECRET> (same secret as Database Webhooks).
-- Alternative: Bearer <SUPABASE_SERVICE_ROLE_KEY> (function also accepts this for cron compatibility).
--
-- Replace placeholders before running:
--   YOUR_PROJECT_REF
--   YOUR_WEBHOOK_SECRET_NAME_IN_VAULT

/*
select cron.schedule(
  'daily-bottle-scan-summary',
  '0 7 * * *',
  $$
  select net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/daily-bottle-scan-summary',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'YOUR_WEBHOOK_SECRET_NAME_IN_VAULT')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
*/
