-- Phase 2A: atomic taste_profile patches + evidence/canonical apply RPCs
-- Additive only. SECURITY INVOKER; identity from auth.uid().

-- ── Evidence columns on sommelier_feedback_events ────────────────────────────

ALTER TABLE public.sommelier_feedback_events
  ADD COLUMN IF NOT EXISTS scope text,
  ADD COLUMN IF NOT EXISTS polarity text,
  ADD COLUMN IF NOT EXISTS extraction_version text,
  ADD COLUMN IF NOT EXISTS locale text,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS target_dimension text,
  ADD COLUMN IF NOT EXISTS target_value text,
  ADD COLUMN IF NOT EXISTS applied_to_canonical boolean DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sommelier_feedback_scope_check'
  ) THEN
    ALTER TABLE public.sommelier_feedback_events
      ADD CONSTRAINT sommelier_feedback_scope_check
      CHECK (
        scope IS NULL OR scope IN (
          'stable', 'stable_candidate', 'bottle', 'session',
          'operational', 'ambiguous'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sommelier_feedback_polarity_check'
  ) THEN
    ALTER TABLE public.sommelier_feedback_events
      ADD CONSTRAINT sommelier_feedback_polarity_check
      CHECK (
        polarity IS NULL OR polarity IN ('like', 'dislike', 'retract', 'neutral')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sommelier_feedback_status_check'
  ) THEN
    ALTER TABLE public.sommelier_feedback_events
      ADD CONSTRAINT sommelier_feedback_status_check
      CHECK (
        status IS NULL OR status IN (
          'active', 'pending_unsupported', 'recorded_no_apply', 'superseded', 'retracted'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sommelier_feedback_dimension_check'
  ) THEN
    ALTER TABLE public.sommelier_feedback_events
      ADD CONSTRAINT sommelier_feedback_dimension_check
      CHECK (
        target_dimension IS NULL OR target_dimension IN (
          'region', 'grape', 'body', 'style', 'descriptor', 'other'
        )
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sommelier_feedback_idempotency
  ON public.sommelier_feedback_events (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ── Helpers ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._taste_profile_clamp01(p numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT GREATEST(0::numeric, LEAST(1::numeric, COALESCE(p, 0)));
$$;

CREATE OR REPLACE FUNCTION public._taste_profile_ensure_base(p_doc jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v jsonb := COALESCE(p_doc, '{}'::jsonb);
BEGIN
  IF NOT (v ? 'vector') THEN
    v := v || jsonb_build_object(
      'vector', jsonb_build_object(
        'body', 0.5, 'tannin', 0.5, 'acidity', 0.5,
        'oak', 0.5, 'sweetness', 0.2, 'power', 0.5
      )
    );
  END IF;
  IF NOT (v ? 'preferences') THEN
    v := v || jsonb_build_object(
      'preferences', jsonb_build_object(
        'reds_bias', 0, 'whites_bias', 0, 'sparkling_bias', 0,
        'style_tags', '{}'::jsonb, 'regions', '{}'::jsonb, 'grapes', '{}'::jsonb
      )
    );
  END IF;
  IF NOT (v ? 'confidence') THEN
    v := v || jsonb_build_object('confidence', 'low');
  END IF;
  IF NOT (v ? 'data_points') THEN
    v := v || jsonb_build_object(
      'data_points', jsonb_build_object('rated_count', 0, 'last_rated_at', null)
    );
  END IF;
  IF NOT (v ? 'version') THEN
    v := jsonb_set(v, '{version}', '1'::jsonb, true);
  END IF;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public._taste_profile_resolve_version(p_doc jsonb)
RETURNS int
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_ver int;
  v_has_explicit boolean;
BEGIN
  v_ver := COALESCE((p_doc->>'version')::int, 1);
  v_has_explicit := (p_doc ? 'explicit') AND p_doc->'explicit' IS NOT NULL
    AND p_doc->'explicit' <> 'null'::jsonb;
  IF v_has_explicit THEN
    RETURN GREATEST(v_ver, 2);
  END IF;
  RETURN GREATEST(v_ver, 1);
END;
$$;

-- ── apply_taste_profile_patch ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.apply_taste_profile_patch(
  p_action text,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.profiles%ROWTYPE;
  v_doc jsonb;
  v_ver int;
  v_payload jsonb := COALESCE(p_payload, '{}'::jsonb);
  v_vector jsonb;
  v_prefs jsonb;
  v_conf text;
  v_dp jsonb;
  v_ov jsonb;
  v_key text;
  v_val numeric;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_action IS NULL OR p_action NOT IN (
    'recompute_inferred', 'set_overrides', 'clear_overrides'
  ) THEN
    RAISE EXCEPTION 'invalid_action' USING ERRCODE = '22023';
  END IF;

  IF octet_length(v_payload::text) > 16384 THEN
    RAISE EXCEPTION 'payload_too_large' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_row
  FROM public.profiles
  WHERE id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_missing' USING ERRCODE = 'P0002';
  END IF;

  v_doc := public._taste_profile_ensure_base(v_row.taste_profile);
  v_ver := COALESCE((v_doc->>'version')::int, COALESCE(v_row.taste_profile_version, 1));

  IF v_ver > 2 THEN
    RAISE EXCEPTION 'unsupported_version' USING ERRCODE = '22023';
  END IF;

  IF p_action = 'recompute_inferred' THEN
    IF NOT (v_payload ? 'vector') OR NOT (v_payload ? 'preferences') THEN
      RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '22023';
    END IF;
    v_vector := v_payload->'vector';
    v_prefs := v_payload->'preferences';
    v_conf := COALESCE(v_payload->>'confidence', 'low');
    IF v_conf NOT IN ('low', 'med', 'high') THEN
      RAISE EXCEPTION 'invalid_confidence' USING ERRCODE = '22023';
    END IF;
    v_dp := COALESCE(v_payload->'data_points', jsonb_build_object('rated_count', 0, 'last_rated_at', null));

    -- Clamp vector dimensions
    FOR v_key IN SELECT unnest(ARRAY['body','tannin','acidity','oak','sweetness','power']) LOOP
      IF v_vector ? v_key THEN
        v_val := public._taste_profile_clamp01((v_vector->>v_key)::numeric);
        v_vector := jsonb_set(v_vector, ARRAY[v_key], to_jsonb(v_val), true);
      END IF;
    END LOOP;

    v_doc := jsonb_set(v_doc, '{vector}', v_vector, true);
    v_doc := jsonb_set(v_doc, '{preferences}', v_prefs, true);
    v_doc := jsonb_set(v_doc, '{confidence}', to_jsonb(v_conf), true);
    v_doc := jsonb_set(v_doc, '{data_points}', v_dp, true);
    -- overrides + explicit preserved from locked row via v_doc base

  ELSIF p_action = 'set_overrides' THEN
    IF NOT (v_payload ? 'vector') OR jsonb_typeof(v_payload->'vector') <> 'object' THEN
      RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '22023';
    END IF;
    v_ov := '{}'::jsonb;
    FOR v_key IN SELECT unnest(ARRAY['body','tannin','acidity','oak','sweetness','power']) LOOP
      IF v_payload->'vector' ? v_key THEN
        v_val := public._taste_profile_clamp01((v_payload->'vector'->>v_key)::numeric);
        v_ov := jsonb_set(v_ov, ARRAY[v_key], to_jsonb(v_val), true);
      END IF;
    END LOOP;
    v_doc := jsonb_set(v_doc, '{overrides}', jsonb_build_object('vector', v_ov), true);

  ELSIF p_action = 'clear_overrides' THEN
    v_doc := v_doc - 'overrides';
  END IF;

  v_ver := public._taste_profile_resolve_version(v_doc);
  v_doc := jsonb_set(v_doc, '{version}', to_jsonb(v_ver), true);

  UPDATE public.profiles
  SET
    taste_profile = v_doc,
    taste_profile_version = v_ver,
    taste_profile_updated_at = now()
  WHERE id = v_uid;

  RETURN v_doc;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_taste_profile_patch(text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_taste_profile_patch(text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.apply_taste_profile_patch(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_taste_profile_patch(text, jsonb) TO service_role;

-- ── Explicit merge helper (internal) ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._taste_merge_explicit_value(
  p_doc jsonb,
  p_list text,           -- e.g. regions_liked
  p_value jsonb,         -- ExplicitPreferenceValue
  p_event_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_explicit jsonb;
  v_arr jsonb;
  v_id text;
  v_i int;
  v_found int := -1;
  v_item jsonb;
  v_ids jsonb;
  v_new_ids text[];
  v_eid text;
BEGIN
  v_id := lower(trim(COALESCE(p_value->>'id', '')));
  IF v_id = '' OR length(v_id) > 64 THEN
    RETURN p_doc;
  END IF;

  v_explicit := COALESCE(p_doc->'explicit', '{}'::jsonb);
  IF NOT (v_explicit ? 'regions_liked') THEN
    v_explicit := v_explicit || jsonb_build_object(
      'regions_liked', '[]'::jsonb,
      'regions_disliked', '[]'::jsonb,
      'grapes_liked', '[]'::jsonb,
      'grapes_disliked', '[]'::jsonb,
      'styles_liked', '[]'::jsonb,
      'styles_disliked', '[]'::jsonb,
      'body', null
    );
  END IF;

  v_arr := COALESCE(v_explicit->p_list, '[]'::jsonb);
  FOR v_i IN 0 .. GREATEST(jsonb_array_length(v_arr) - 1, -1) LOOP
    IF lower(v_arr->v_i->>'id') = v_id THEN
      v_found := v_i;
      EXIT;
    END IF;
  END LOOP;

  v_ids := COALESCE((CASE WHEN v_found >= 0 THEN v_arr->v_found->'evidence_event_ids' ELSE '[]'::jsonb END), '[]'::jsonb);
  v_new_ids := ARRAY[p_event_id::text];
  FOR v_i IN 0 .. GREATEST(jsonb_array_length(v_ids) - 1, -1) LOOP
    v_eid := v_ids->>v_i;
    IF v_eid IS DISTINCT FROM p_event_id::text THEN
      v_new_ids := v_new_ids || v_eid;
    END IF;
  END LOOP;
  -- cap 10
  IF array_length(v_new_ids, 1) > 10 THEN
    v_new_ids := v_new_ids[1:10];
  END IF;

  v_item := jsonb_build_object(
    'id', v_id,
    'confidence', public._taste_profile_clamp01(COALESCE((p_value->>'confidence')::numeric, 0.9)),
    'updated_at', COALESCE(p_value->>'updated_at', now()::text),
    'source', COALESCE(p_value->>'source', 'chat'),
    'evidence_event_ids', to_jsonb(v_new_ids)
  );
  IF p_value ? 'label_en' THEN
    v_item := v_item || jsonb_build_object('label_en', left(p_value->>'label_en', 80));
  END IF;
  IF p_value ? 'label_he' THEN
    v_item := v_item || jsonb_build_object('label_he', left(p_value->>'label_he', 80));
  END IF;

  IF v_found >= 0 THEN
    v_arr := jsonb_set(v_arr, ARRAY[v_found::text], v_item, true);
  ELSE
    IF jsonb_array_length(v_arr) >= 20 THEN
      RETURN p_doc; -- cap: refuse add
    END IF;
    v_arr := v_arr || jsonb_build_array(v_item);
  END IF;

  v_explicit := jsonb_set(v_explicit, ARRAY[p_list], v_arr, true);
  v_explicit := jsonb_set(v_explicit, '{updated_at}', to_jsonb(now()::text), true);
  RETURN jsonb_set(p_doc, '{explicit}', v_explicit, true);
END;
$$;

CREATE OR REPLACE FUNCTION public._taste_merge_explicit_body(
  p_doc jsonb,
  p_body jsonb,
  p_event_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_explicit jsonb;
  v_val text;
  v_ids jsonb;
  v_new_ids text[];
  v_i int;
  v_eid text;
  v_item jsonb;
BEGIN
  v_val := lower(trim(COALESCE(p_body->>'value', '')));
  IF v_val NOT IN ('light', 'medium', 'full') THEN
    RETURN p_doc;
  END IF;

  v_explicit := COALESCE(p_doc->'explicit', '{}'::jsonb);
  IF NOT (v_explicit ? 'regions_liked') THEN
    v_explicit := v_explicit || jsonb_build_object(
      'regions_liked', '[]'::jsonb,
      'regions_disliked', '[]'::jsonb,
      'grapes_liked', '[]'::jsonb,
      'grapes_disliked', '[]'::jsonb,
      'styles_liked', '[]'::jsonb,
      'styles_disliked', '[]'::jsonb,
      'body', null
    );
  END IF;

  v_ids := COALESCE(v_explicit->'body'->'evidence_event_ids', '[]'::jsonb);
  v_new_ids := ARRAY[p_event_id::text];
  FOR v_i IN 0 .. GREATEST(jsonb_array_length(v_ids) - 1, -1) LOOP
    v_eid := v_ids->>v_i;
    IF v_eid IS DISTINCT FROM p_event_id::text THEN
      v_new_ids := v_new_ids || v_eid;
    END IF;
  END LOOP;
  IF array_length(v_new_ids, 1) > 10 THEN
    v_new_ids := v_new_ids[1:10];
  END IF;

  v_item := jsonb_build_object(
    'value', v_val,
    'confidence', public._taste_profile_clamp01(COALESCE((p_body->>'confidence')::numeric, 0.9)),
    'updated_at', COALESCE(p_body->>'updated_at', now()::text),
    'source', COALESCE(p_body->>'source', 'chat'),
    'evidence_event_ids', to_jsonb(v_new_ids)
  );

  v_explicit := jsonb_set(v_explicit, '{body}', v_item, true);
  v_explicit := jsonb_set(v_explicit, '{updated_at}', to_jsonb(now()::text), true);
  RETURN jsonb_set(p_doc, '{explicit}', v_explicit, true);
END;
$$;

-- ── apply_taste_evidence_and_canonical ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.apply_taste_evidence_and_canonical(
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_payload jsonb := COALESCE(p_payload, '{}'::jsonb);
  v_event public.sommelier_feedback_events%ROWTYPE;
  v_existing public.sommelier_feedback_events%ROWTYPE;
  v_row public.profiles%ROWTYPE;
  v_doc jsonb;
  v_ver int;
  v_key text;
  v_scope text;
  v_polarity text;
  v_status text;
  v_dim text;
  v_tval text;
  v_locale text;
  v_ext text;
  v_raw text;
  v_apply boolean;
  v_reason text := 'skipped';
  v_inserted boolean := false;
  v_applied boolean := false;
  v_list text;
  v_pref jsonb;
  v_tags text[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  IF octet_length(v_payload::text) > 16384 THEN
    RAISE EXCEPTION 'payload_too_large' USING ERRCODE = '22023';
  END IF;

  v_key := NULLIF(trim(COALESCE(v_payload->>'idempotency_key', '')), '');
  IF v_key IS NULL OR length(v_key) > 200 THEN
    RAISE EXCEPTION 'invalid_idempotency_key' USING ERRCODE = '22023';
  END IF;

  v_scope := COALESCE(v_payload->>'scope', 'ambiguous');
  v_polarity := COALESCE(v_payload->>'polarity', 'neutral');
  v_status := COALESCE(v_payload->>'status', 'recorded_no_apply');
  v_dim := NULLIF(v_payload->>'target_dimension', '');
  v_tval := NULLIF(left(COALESCE(v_payload->>'target_value', ''), 64), '');
  v_locale := COALESCE(NULLIF(v_payload->>'locale', ''), 'unknown');
  v_ext := COALESCE(NULLIF(v_payload->>'extraction_version', ''), 'rules_v2');
  v_raw := left(COALESCE(v_payload->>'raw_text', ''), 4000);
  v_apply := COALESCE((v_payload->>'apply_canonical')::boolean, false);
  v_tags := COALESCE(
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_payload->'structured_tags', '[]'::jsonb))),
    ARRAY[]::text[]
  );

  IF v_scope NOT IN ('stable','stable_candidate','bottle','session','operational','ambiguous') THEN
    RAISE EXCEPTION 'invalid_scope' USING ERRCODE = '22023';
  END IF;
  IF v_polarity NOT IN ('like','dislike','retract','neutral') THEN
    RAISE EXCEPTION 'invalid_polarity' USING ERRCODE = '22023';
  END IF;

  -- Find existing by idempotency
  SELECT * INTO v_existing
  FROM public.sommelier_feedback_events
  WHERE user_id = v_uid AND idempotency_key = v_key;

  IF FOUND THEN
    v_event := v_existing;
    IF v_existing.applied_to_canonical IS TRUE THEN
      RETURN jsonb_build_object(
        'event_id', v_existing.id,
        'evidence', 'existing',
        'canonical_applied', false,
        'reason', 'already_applied',
        'profile_version', null
      );
    END IF;
    -- recover: fall through to apply if requested
    v_reason := 'recover_existing';
  ELSE
    INSERT INTO public.sommelier_feedback_events (
      user_id, raw_text, structured_tags, sentiment, preference_delta,
      scope, polarity, extraction_version, locale, idempotency_key, status,
      target_dimension, target_value, applied_to_canonical,
      recommendation_event_id, bottle_id
    ) VALUES (
      v_uid, v_raw, v_tags,
      COALESCE(v_payload->>'sentiment', 'neutral'),
      COALESCE(v_payload->'preference_delta', '{}'::jsonb),
      v_scope, v_polarity, v_ext, v_locale, v_key, v_status,
      v_dim, v_tval, false,
      NULLIF(v_payload->>'recommendation_event_id', '')::uuid,
      NULLIF(v_payload->>'bottle_id', '')::uuid
    )
    RETURNING * INTO v_event;
    v_inserted := true;
    v_reason := 'inserted';
  END IF;

  IF NOT v_apply OR v_scope <> 'stable' OR v_status = 'pending_unsupported' THEN
    RETURN jsonb_build_object(
      'event_id', v_event.id,
      'evidence', CASE WHEN v_inserted THEN 'inserted' ELSE 'existing' END,
      'canonical_applied', false,
      'reason', CASE WHEN NOT v_apply THEN 'apply_false' ELSE 'not_eligible' END,
      'profile_version', null
    );
  END IF;

  -- Lock profile and apply once
  SELECT * INTO v_row
  FROM public.profiles
  WHERE id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_missing' USING ERRCODE = 'P0002';
  END IF;

  v_doc := public._taste_profile_ensure_base(v_row.taste_profile);
  v_ver := COALESCE((v_doc->>'version')::int, COALESCE(v_row.taste_profile_version, 1));
  IF v_ver > 2 THEN
    RAISE EXCEPTION 'unsupported_version' USING ERRCODE = '22023';
  END IF;

  -- Contradiction guards: dislike list blocks like; opposite body blocks
  IF v_dim = 'body' AND v_polarity = 'like' AND v_tval IN ('light','medium','full') THEN
    IF v_doc->'explicit'->'body' IS NOT NULL
       AND v_doc->'explicit'->'body'->>'value' IS NOT NULL
       AND v_doc->'explicit'->'body'->>'value' <> v_tval THEN
      UPDATE public.sommelier_feedback_events
      SET status = 'pending_unsupported'
      WHERE id = v_event.id;
      RETURN jsonb_build_object(
        'event_id', v_event.id,
        'evidence', CASE WHEN v_inserted THEN 'inserted' ELSE 'existing' END,
        'canonical_applied', false,
        'reason', 'contradiction',
        'profile_version', v_ver
      );
    END IF;
    v_pref := jsonb_build_object(
      'value', v_tval,
      'confidence', 0.9,
      'updated_at', now()::text,
      'source', 'chat'
    );
    v_doc := public._taste_merge_explicit_body(v_doc, v_pref, v_event.id);
    v_applied := true;
  ELSIF v_dim IN ('region','grape','style') AND v_polarity = 'like' AND v_tval IS NOT NULL THEN
    v_list := CASE v_dim
      WHEN 'region' THEN 'regions_liked'
      WHEN 'grape' THEN 'grapes_liked'
      ELSE 'styles_liked'
    END;
    -- if already in disliked → contradiction
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(
        COALESCE(v_doc->'explicit'->(replace(v_list, '_liked', '_disliked')), '[]'::jsonb)
      ) e WHERE lower(e->>'id') = lower(v_tval)
    ) THEN
      UPDATE public.sommelier_feedback_events
      SET status = 'pending_unsupported'
      WHERE id = v_event.id;
      RETURN jsonb_build_object(
        'event_id', v_event.id,
        'evidence', CASE WHEN v_inserted THEN 'inserted' ELSE 'existing' END,
        'canonical_applied', false,
        'reason', 'contradiction',
        'profile_version', v_ver
      );
    END IF;
    v_pref := jsonb_build_object(
      'id', lower(v_tval),
      'confidence', 0.9,
      'updated_at', now()::text,
      'source', 'chat',
      'label_en', NULLIF(v_payload->>'label_en', ''),
      'label_he', NULLIF(v_payload->>'label_he', '')
    );
    v_doc := public._taste_merge_explicit_value(v_doc, v_list, v_pref, v_event.id);
    v_applied := true;
  ELSE
    v_reason := 'unsupported_delta';
    v_applied := false;
  END IF;

  IF v_applied THEN
    v_ver := 2;
    v_doc := jsonb_set(v_doc, '{version}', '2'::jsonb, true);
    UPDATE public.profiles
    SET
      taste_profile = v_doc,
      taste_profile_version = 2,
      taste_profile_updated_at = now()
    WHERE id = v_uid;

    UPDATE public.sommelier_feedback_events
    SET applied_to_canonical = true, status = 'active'
    WHERE id = v_event.id;

    v_reason := 'applied';
  END IF;

  RETURN jsonb_build_object(
    'event_id', v_event.id,
    'evidence', CASE WHEN v_inserted THEN 'inserted' ELSE 'existing' END,
    'canonical_applied', v_applied,
    'reason', v_reason,
    'profile_version', v_ver,
    'taste_profile', CASE WHEN v_applied THEN v_doc ELSE NULL END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_taste_evidence_and_canonical(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_taste_evidence_and_canonical(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.apply_taste_evidence_and_canonical(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_taste_evidence_and_canonical(jsonb) TO service_role;

COMMENT ON FUNCTION public.apply_taste_profile_patch(text, jsonb) IS
  'Phase 2A: atomic taste_profile layer patch (recompute_inferred|set_overrides|clear_overrides). SECURITY INVOKER.';
COMMENT ON FUNCTION public.apply_taste_evidence_and_canonical(jsonb) IS
  'Phase 2A: idempotent evidence insert + optional canonical explicit apply. SECURITY INVOKER.';
