-- Step B: edit same client_timer_id
UPDATE wine_reminders
SET fire_at = fire_at + interval '3 days',
    status = 'pending',
    sent_at = NULL,
    last_error = NULL
WHERE client_timer_id = 'keep_bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
RETURNING client_timer_id, status, fire_at;
