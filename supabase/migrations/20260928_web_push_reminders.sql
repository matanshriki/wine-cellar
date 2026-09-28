-- Web Push subscriptions + server-side wine reminders (decant / rate-later)
-- Absolute fire_at; dispatcher claims pending rows to prevent duplicate sends.

-- ── push_subscriptions ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT push_subscriptions_endpoint_unique UNIQUE (endpoint)
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx
  ON public.push_subscriptions (user_id);

COMMENT ON TABLE public.push_subscriptions IS
  'Web Push endpoints per user/device. One row per browser push subscription endpoint.';

-- ── wine_reminders ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.wine_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  client_timer_id text NOT NULL,
  reminder_type text NOT NULL CHECK (reminder_type IN ('decant', 'rate')),
  fire_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'sent', 'canceled', 'failed')),
  bottle_id uuid,
  wine_id uuid,
  history_id uuid,
  wine_name text,
  producer text,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wine_reminders_user_client_timer_unique UNIQUE (user_id, client_timer_id)
);

CREATE INDEX IF NOT EXISTS wine_reminders_due_idx
  ON public.wine_reminders (fire_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS wine_reminders_user_status_idx
  ON public.wine_reminders (user_id, status);

COMMENT ON TABLE public.wine_reminders IS
  'Server-scheduled decant / rate-later reminders. fire_at is absolute UTC; delivery via Web Push cron.';
COMMENT ON COLUMN public.wine_reminders.client_timer_id IS
  'Matches local WineTimer.id so the client can cancel the same reminder.';

-- ── updated_at triggers (reuse existing helper if present) ───────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS push_subscriptions_updated_at ON public.push_subscriptions;
CREATE TRIGGER push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS wine_reminders_updated_at ON public.wine_reminders;
CREATE TRIGGER wine_reminders_updated_at
  BEFORE UPDATE ON public.wine_reminders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- ── Privileges (Data API) + RLS ─────────────────────────────────────────────
-- Explicit GRANTs are required so PostgREST can expose these tables. RLS then
-- restricts rows to the owning user. anon gets no table access.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wine_reminders TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
GRANT ALL ON public.wine_reminders TO service_role;

REVOKE ALL ON public.push_subscriptions FROM PUBLIC;
REVOKE ALL ON public.push_subscriptions FROM anon;
REVOKE ALL ON public.wine_reminders FROM PUBLIC;
REVOKE ALL ON public.wine_reminders FROM anon;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wine_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users manage own push subscriptions"
  ON public.push_subscriptions
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own wine reminders" ON public.wine_reminders;
CREATE POLICY "Users manage own wine reminders"
  ON public.wine_reminders
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role (edge cron) bypasses RLS by default.

-- ── Atomic claim for dispatcher (prevents duplicate sends) ───────────────────

CREATE OR REPLACE FUNCTION public.claim_due_wine_reminders(batch_size integer DEFAULT 50)
RETURNS SETOF public.wine_reminders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Recover rows stuck in 'sending' (worker crash) after 10 minutes
  UPDATE public.wine_reminders
  SET status = 'pending', updated_at = now()
  WHERE status = 'sending'
    AND updated_at < now() - interval '10 minutes';

  RETURN QUERY
  WITH due AS (
    SELECT wr.id
    FROM public.wine_reminders wr
    WHERE wr.status = 'pending'
      AND wr.fire_at <= now()
    ORDER BY wr.fire_at ASC
    LIMIT GREATEST(1, LEAST(COALESCE(batch_size, 50), 200))
    FOR UPDATE OF wr SKIP LOCKED
  )
  UPDATE public.wine_reminders wr
  SET status = 'sending', updated_at = now()
  FROM due
  WHERE wr.id = due.id
  RETURNING wr.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_due_wine_reminders(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_due_wine_reminders(integer) TO service_role;

COMMENT ON FUNCTION public.claim_due_wine_reminders(integer) IS
  'Claims due pending wine_reminders for the Web Push dispatcher. SKIP LOCKED prevents duplicate sends.';
