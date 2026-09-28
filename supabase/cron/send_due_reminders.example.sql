-- Schedule send-due-reminders every minute (pg_cron + pg_net).
-- Vault is empty in this project — use a dedicated dispatcher secret.
-- Do NOT overwrite Edge Function secret WEBHOOK_SECRET (used by other functions).
--
-- Prerequisites:
--   1. Edge Function secrets:
--        WINE_REMINDER_CRON_SECRET   (new; preferred for this cron)
--        VAPID_PUBLIC_KEY
--        VAPID_PRIVATE_KEY
--        VAPID_SUBJECT
--        SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (usually auto)
--        WEBHOOK_SECRET              (optional legacy; leave unchanged)
--   2. Vault row (name only below — value = same as WINE_REMINDER_CRON_SECRET):
--        select vault.create_secret('<NEW_RANDOM_VALUE>', 'wine_reminder_cron_secret');
--   3. Deploy: supabase functions deploy send-due-reminders
--   4. Auth-test with Bearer = that new value → AUTH_OK before scheduling
--
-- Also set VITE_VAPID_PUBLIC_KEY on Vercel (public key only).

-- Create Vault secret once (paste value yourself; do not commit it):
-- select vault.create_secret('<NEW_RANDOM_VALUE>', 'wine_reminder_cron_secret');

/*
select cron.schedule(
  'send-due-wine-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://pktelrzyllbwrmcfgocx.supabase.co/functions/v1/send-due-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'wine_reminder_cron_secret'
      )
    ),
    body := '{"batch_size": 50}'::jsonb
  ) as request_id;
  $$
);
*/

-- Verify:
-- select jobid, jobname, schedule, active from cron.job where jobname = 'send-due-wine-reminders';

-- Unschedule:
-- select cron.unschedule('send-due-wine-reminders');
