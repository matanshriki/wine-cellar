-- Step D: cleanup
DELETE FROM wine_reminders
WHERE client_timer_id = 'keep_bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
RETURNING client_timer_id;
