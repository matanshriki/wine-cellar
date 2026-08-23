-- Phase 0 Batch 2: transactional open / soft-undo consumption RPCs (DATA-001/002)

-- ── Soft-undo columns ────────────────────────────────────────────────────────

ALTER TABLE public.consumption_history
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS undone_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS idempotency_key uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'consumption_history_status_check'
  ) THEN
    ALTER TABLE public.consumption_history
      ADD CONSTRAINT consumption_history_status_check
      CHECK (status IN ('active', 'undone'));
  END IF;
END $$;

UPDATE public.consumption_history
SET status = 'active'
WHERE status IS NULL OR status = '';

CREATE UNIQUE INDEX IF NOT EXISTS consumption_history_user_idempotency_uidx
  ON public.consumption_history (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS consumption_history_bottle_active_idx
  ON public.consumption_history (bottle_id)
  WHERE status = 'active';

-- ── open_bottles ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.open_bottles(
  p_bottle_id uuid,
  p_opened_quantity integer,
  p_idempotency_key uuid DEFAULT NULL,
  p_occasion text DEFAULT NULL,
  p_meal_type text DEFAULT NULL,
  p_vibe text DEFAULT NULL,
  p_user_rating integer DEFAULT NULL,
  p_tasting_notes text DEFAULT NULL,
  p_meal_notes text DEFAULT NULL
)
RETURNS public.consumption_history
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_bottle public.bottles%ROWTYPE;
  v_history public.consumption_history%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_opened_quantity IS NULL OR p_opened_quantity < 1 THEN
    RAISE EXCEPTION 'invalid_opened_quantity' USING ERRCODE = '22023';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_history
    FROM public.consumption_history
    WHERE user_id = v_uid AND idempotency_key = p_idempotency_key;

    IF FOUND THEN
      RETURN v_history;
    END IF;
  END IF;

  SELECT * INTO v_bottle
  FROM public.bottles
  WHERE id = p_bottle_id AND user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_bottle.quantity < p_opened_quantity THEN
    RAISE EXCEPTION 'insufficient_quantity' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.consumption_history (
    user_id,
    bottle_id,
    wine_id,
    opened_quantity,
    occasion,
    meal_type,
    vibe,
    user_rating,
    tasting_notes,
    meal_notes,
    status,
    idempotency_key
  ) VALUES (
    v_uid,
    p_bottle_id,
    v_bottle.wine_id,
    p_opened_quantity,
    p_occasion,
    p_meal_type,
    p_vibe,
    p_user_rating,
    p_tasting_notes,
    p_meal_notes,
    'active',
    p_idempotency_key
  )
  RETURNING * INTO v_history;

  UPDATE public.bottles
  SET quantity = quantity - p_opened_quantity,
      updated_at = now()
  WHERE id = p_bottle_id AND user_id = v_uid;

  RETURN v_history;
END;
$$;

-- ── undo_consumption ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.undo_consumption(
  p_history_id uuid,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS public.consumption_history
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_history public.consumption_history%ROWTYPE;
  v_bottle public.bottles%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_history
  FROM public.consumption_history
  WHERE id = p_history_id AND user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_history.status = 'undone' THEN
    RETURN v_history;
  END IF;

  SELECT * INTO v_bottle
  FROM public.bottles
  WHERE id = v_history.bottle_id AND user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'bottle_missing' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.bottles
  SET quantity = quantity + v_history.opened_quantity,
      updated_at = now()
  WHERE id = v_bottle.id;

  UPDATE public.consumption_history
  SET status = 'undone',
      undone_at = now()
  WHERE id = v_history.id
  RETURNING * INTO v_history;

  RETURN v_history;
END;
$$;

REVOKE ALL ON FUNCTION public.open_bottles(uuid, integer, uuid, text, text, text, integer, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.open_bottles(uuid, integer, uuid, text, text, text, integer, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.open_bottles(uuid, integer, uuid, text, text, text, integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_bottles(uuid, integer, uuid, text, text, text, integer, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.undo_consumption(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.undo_consumption(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.undo_consumption(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.undo_consumption(uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.open_bottles IS
  'Atomically open N bottles: insert active consumption_history and decrement quantity.';
COMMENT ON FUNCTION public.undo_consumption IS
  'Soft-undo a consumption event and restore opened_quantity to the bottle.';
