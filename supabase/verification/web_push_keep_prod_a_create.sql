-- Step A: cleanup + create
DELETE FROM wine_reminders WHERE client_timer_id = 'keep_bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

INSERT INTO wine_reminders (
  user_id, client_timer_id, reminder_type, fire_at, status, bottle_id, wine_name, producer
)
SELECT
  id,
  'keep_bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'keep',
  now() + interval '10 days',
  'pending',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'Prod Keep Verify',
  'Sommi Test'
FROM auth.users
ORDER BY created_at DESC NULLS LAST
LIMIT 1
RETURNING client_timer_id, reminder_type, status, fire_at, bottle_id;
