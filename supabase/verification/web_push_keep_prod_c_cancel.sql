-- Step C: cancel + confirm single row
UPDATE wine_reminders
SET status = 'canceled'
WHERE client_timer_id = 'keep_bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  AND status IN ('pending', 'sending')
RETURNING client_timer_id, status, fire_at;
