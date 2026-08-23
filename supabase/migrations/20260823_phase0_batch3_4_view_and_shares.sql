-- Phase 0 Batch 3/4: view repair + shared_cellars lockdown (MIG-001 / SEC-003)

-- ── MIG-001: ensure bottles_with_wine_info has no bottles.opened_at ───────────

DROP VIEW IF EXISTS public.bottles_with_wine_info;

CREATE VIEW public.bottles_with_wine_info
WITH (security_invoker = true)
AS
SELECT
  b.id,
  b.user_id,
  b.wine_id,
  b.quantity,
  b.purchase_date,
  b.purchase_price,
  b.purchase_location,
  b.storage_location,
  b.bottle_size_ml,
  b.notes,
  b.image_url,
  b.tags,
  b.created_at,
  b.updated_at,
  w.producer,
  w.wine_name,
  w.vintage,
  w.country,
  w.region,
  w.regional_wine_style,
  w.appellation,
  w.color,
  w.grapes,
  w.vivino_wine_id,
  w.vivino_url,
  w.rating,
  w.image_url AS wine_image_url,
  w.notes AS wine_notes,
  w.generated_image_path,
  w.generated_image_prompt_hash,
  w.generated_at
FROM public.bottles b
JOIN public.wines w ON b.wine_id = w.id;

GRANT SELECT ON public.bottles_with_wine_info TO authenticated;
GRANT SELECT ON public.bottles_with_wine_info TO service_role;

-- ── SEC-003: shared_cellars — revoke world-readable SELECT ───────────────────

ALTER TABLE public.shared_cellars
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz NULL;

DROP POLICY IF EXISTS "Anyone can view shared cellars" ON public.shared_cellars;

-- Owner can read own shares (manage / revoke)
DROP POLICY IF EXISTS "Users can view their own shared cellars" ON public.shared_cellars;
CREATE POLICY "Users can view their own shared cellars"
  ON public.shared_cellars
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Keep owner write policies if present; recreate defensively
DROP POLICY IF EXISTS "Users can create their own shared cellars" ON public.shared_cellars;
CREATE POLICY "Users can create their own shared cellars"
  ON public.shared_cellars
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own shared cellars" ON public.shared_cellars;
CREATE POLICY "Users can update their own shared cellars"
  ON public.shared_cellars
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own shared cellars" ON public.shared_cellars;
CREATE POLICY "Users can delete their own shared cellars"
  ON public.shared_cellars
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

REVOKE ALL ON TABLE public.shared_cellars FROM anon;
REVOKE ALL ON TABLE public.shared_cellars FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.shared_cellars TO authenticated;
GRANT ALL ON TABLE public.shared_cellars TO service_role;

-- Public read via RPC only (enforces expiry + revoke; increments view_count)
CREATE OR REPLACE FUNCTION public.get_shared_cellar_public(p_share_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.shared_cellars%ROWTYPE;
BEGIN
  IF p_share_id IS NULL OR char_length(p_share_id) < 6 OR char_length(p_share_id) > 64 THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_row
  FROM public.shared_cellars
  WHERE id = p_share_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_row.revoked_at IS NOT NULL THEN
    RETURN NULL;
  END IF;

  IF v_row.expires_at IS NOT NULL AND v_row.expires_at <= now() THEN
    RETURN NULL;
  END IF;

  UPDATE public.shared_cellars
  SET view_count = coalesce(view_count, 0) + 1
  WHERE id = v_row.id;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'share_data', v_row.share_data,
    'expires_at', v_row.expires_at,
    'view_count', coalesce(v_row.view_count, 0) + 1,
    'created_at', v_row.created_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_shared_cellar(p_share_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_updated int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  UPDATE public.shared_cellars
  SET revoked_at = now()
  WHERE id = p_share_id
    AND user_id = v_uid
    AND revoked_at IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.get_shared_cellar_public(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_cellar_public(text) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.revoke_shared_cellar(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_shared_cellar(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.revoke_shared_cellar(text) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_shared_cellar_public(text) IS
  'Public share lookup by short id. Enforces expiry/revoke; no table SELECT for anon.';
