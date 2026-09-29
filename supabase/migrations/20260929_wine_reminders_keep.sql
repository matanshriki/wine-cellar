-- Allow Keep/Reserve reminders on wine_reminders (reuse Web Push infra).
-- Does NOT backfill overdue reserved_date values — clients only schedule future fire_at.

ALTER TABLE public.wine_reminders
  DROP CONSTRAINT IF EXISTS wine_reminders_reminder_type_check;

ALTER TABLE public.wine_reminders
  ADD CONSTRAINT wine_reminders_reminder_type_check
  CHECK (reminder_type IN ('decant', 'rate', 'keep'));

-- At most one pending Keep reminder per bottle (client_timer_id is keep_<bottleId>).
CREATE UNIQUE INDEX IF NOT EXISTS wine_reminders_one_pending_keep_per_bottle
  ON public.wine_reminders (user_id, bottle_id)
  WHERE reminder_type = 'keep'
    AND status = 'pending'
    AND bottle_id IS NOT NULL;

COMMENT ON COLUMN public.wine_reminders.reminder_type IS
  'decant | rate | keep — Keep fires ~10:00 local on reserved_date.';
