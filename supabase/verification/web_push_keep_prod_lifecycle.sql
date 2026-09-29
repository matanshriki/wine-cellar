-- Prod Keep lifecycle returning row results (create → edit → cancel)
WITH u AS (
  SELECT id AS user_id FROM auth.users ORDER BY created_at DESC NULLS LAST LIMIT 1
),
bid AS (
  SELECT 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid AS bottle_id
),
cleanup AS (
  DELETE FROM wine_reminders wr
  USING bid
  WHERE wr.client_timer_id = 'keep_' || bid.bottle_id::text
  RETURNING 1
),
created AS (
  INSERT INTO wine_reminders (
    user_id, client_timer_id, reminder_type, fire_at, status, bottle_id, wine_name, producer
  )
  SELECT
    u.user_id,
    'keep_' || bid.bottle_id::text,
    'keep',
    date_trunc('day', now() AT TIME ZONE 'UTC') + interval '10 days' + interval '10 hours',
    'pending',
    bid.bottle_id,
    'Prod Keep Verify',
    'Sommi Test'
  FROM u, bid
  RETURNING client_timer_id, reminder_type, fire_at, status, bottle_id
),
edited AS (
  UPDATE wine_reminders wr
  SET fire_at = wr.fire_at + interval '3 days', status = 'pending', sent_at = NULL, last_error = NULL
  FROM created c
  WHERE wr.client_timer_id = c.client_timer_id
  RETURNING wr.client_timer_id, wr.fire_at AS edited_fire_at, wr.status AS edited_status
),
canceled AS (
  UPDATE wine_reminders wr
  SET status = 'canceled'
  FROM edited e
  WHERE wr.client_timer_id = e.client_timer_id AND wr.status IN ('pending', 'sending')
  RETURNING wr.client_timer_id, wr.status AS canceled_status, wr.fire_at
),
dup_check AS (
  SELECT count(*)::int AS pending_keep_rows
  FROM wine_reminders wr, bid
  WHERE wr.client_timer_id = 'keep_' || bid.bottle_id::text
),
final_cleanup AS (
  DELETE FROM wine_reminders wr
  USING bid
  WHERE wr.client_timer_id = 'keep_' || bid.bottle_id::text
  RETURNING 1
)
SELECT
  (SELECT reminder_type FROM created) AS created_type,
  (SELECT status FROM created) AS created_status,
  (SELECT fire_at FROM created) AS created_fire_at,
  (SELECT edited_fire_at FROM edited) AS edited_fire_at,
  (SELECT edited_status FROM edited) AS edited_status,
  (SELECT canceled_status FROM canceled) AS canceled_status,
  (SELECT pending_keep_rows FROM dup_check) AS rows_before_cleanup,
  '/cellar?reminder=keep&bottleId=bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' AS deep_link_shape,
  (SELECT count(*) FROM final_cleanup) AS cleaned;
