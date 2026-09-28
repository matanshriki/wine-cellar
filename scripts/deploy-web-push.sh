#!/usr/bin/env bash
# Production Web Push deploy helper (run interactively after supabase login + vercel login).
# Never echoes secret values.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .local/vapid.env ]]; then
  echo "Missing .local/vapid.env — generate with: npx web-push generate-vapid-keys --json > .local/vapid.json"
  exit 1
fi

# shellcheck disable=SC1091
source .local/vapid.env

echo "==> 1/5 Apply migration"
supabase db push

echo "==> 2/5 Set Edge secrets (values not printed)"
supabase secrets set \
  "VAPID_PUBLIC_KEY=${VAPID_PUBLIC_KEY}" \
  "VAPID_PRIVATE_KEY=${VAPID_PRIVATE_KEY}" \
  "VAPID_SUBJECT=${VAPID_SUBJECT}"
# Do NOT overwrite WEBHOOK_SECRET.
# Separately set WINE_REMINDER_CRON_SECRET (new random value) and add the same
# value to Vault as name wine_reminder_cron_secret — see send_due_reminders.example.sql

echo "==> 3/5 Deploy send-due-reminders"
supabase functions deploy send-due-reminders

echo "==> 4/5 Web: set VITE_VAPID_PUBLIC_KEY on Vercel, then deploy"
echo "    vercel env add VITE_VAPID_PUBLIC_KEY production   # paste public key"
echo "    Then: cd apps/web && vercel --prod   OR push to main if CI deploys"

echo "==> 5/5 Schedule cron (edit project ref + vault name, then run in SQL editor)"
echo "    See supabase/cron/send_due_reminders.example.sql"
echo "    Verify: select jobid, jobname, schedule, active from cron.job where jobname = 'send-due-wine-reminders';"

echo "Done preparing steps. Verify /sw.js contains push listener; leave iPhone closed-app test to human."
