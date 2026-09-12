-- Phase 2B.1 follow-up: atomic Profile Sommi-memory management
-- Forward-only additive migration. Does NOT modify Phase 2A / 2B.1 RPCs.
--
-- Problem: Profile UI used create_taste_pending_confirmation + resolve_taste_confirmation
-- as two transactions with conversation_id NULL. If resolve failed after create, a
-- user-level pending_confirmation remained that chat "yes" could apply.
--
-- Solution: single SECURITY INVOKER RPC that writes evidence as status=applied
-- (never pending_confirmation) and mutates explicit prefs atomically.
--
-- Idempotency: client-generated operation UUID (one logical UI confirm). Key shape:
--   profile_memory_action_<uuid>
-- Same operation + same action → already_applied. Same operation + different action → conflict.
-- Different operation + identical action → evaluated as a new logical mutation.

CREATE OR REPLACE FUNCTION public.apply_taste_profile_memory_action(
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
  v_key text;
  v_op text;
  v_action text;
  v_dim text;
  v_existing text;
  v_proposed text;
  v_polarity text;
  v_list text;
  v_locale text;
  v_raw text;
  v_existing_event public.sommelier_feedback_events%ROWTYPE;
  v_event public.sommelier_feedback_events%ROWTYPE;
  v_row public.profiles%ROWTYPE;
  v_doc jsonb;
  v_ver int;
  v_explicit jsonb;
  v_suppress jsonb;
  v_arr jsonb;
  v_new_arr jsonb := '[]'::jsonb;
  v_i int;
  v_found boolean := false;
  v_body_val text;
  v_delta jsonb;
  v_action_fp jsonb;
  v_stored_fp jsonb;
  v_ev_polarity text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  IF octet_length(v_payload::text) > 16384 THEN
    RAISE EXCEPTION 'payload_too_large' USING ERRCODE = '22023';
  END IF;

  -- Prefer operation_id (UUID); derive bounded idempotency key. Accept pre-derived key
  -- only when it matches the canonical prefix+uuid shape.
  v_op := NULLIF(lower(trim(COALESCE(v_payload->>'operation_id', ''))), '');
  IF v_op IS NOT NULL THEN
    IF v_op !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'invalid_operation_id' USING ERRCODE = '22023';
    END IF;
    v_key := 'profile_memory_action_' || v_op;
  ELSE
    v_key := NULLIF(lower(trim(COALESCE(v_payload->>'idempotency_key', ''))), '');
    IF v_key IS NULL
       OR v_key !~ '^profile_memory_action_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       OR length(v_key) > 200 THEN
      RAISE EXCEPTION 'invalid_idempotency_key' USING ERRCODE = '22023';
    END IF;
  END IF;

  v_action := COALESCE(v_payload->>'action', '');
  IF v_action NOT IN ('replace', 'remove') THEN
    RAISE EXCEPTION 'invalid_action' USING ERRCODE = '22023';
  END IF;

  v_dim := COALESCE(v_payload->>'dimension', '');
  IF v_dim NOT IN ('region', 'grape', 'body') THEN
    RAISE EXCEPTION 'invalid_dimension' USING ERRCODE = '22023';
  END IF;

  v_existing := NULLIF(left(lower(trim(COALESCE(v_payload->>'existing_value', ''))), 64), '');
  v_proposed := NULLIF(left(lower(trim(COALESCE(v_payload->>'proposed_value', ''))), 64), '');
  v_polarity := COALESCE(NULLIF(v_payload->>'polarity', ''), 'like');
  IF v_polarity NOT IN ('like', 'dislike') THEN
    RAISE EXCEPTION 'invalid_polarity' USING ERRCODE = '22023';
  END IF;

  IF v_action = 'replace' AND v_dim = 'body' THEN
    IF v_existing IS NULL OR v_proposed IS NULL OR v_existing = v_proposed THEN
      RAISE EXCEPTION 'invalid_replace_values' USING ERRCODE = '22023';
    END IF;
    IF v_existing NOT IN ('light', 'medium', 'full') OR v_proposed NOT IN ('light', 'medium', 'full') THEN
      RAISE EXCEPTION 'invalid_body_value' USING ERRCODE = '22023';
    END IF;
  ELSIF v_action = 'remove' AND v_dim = 'body' THEN
    IF v_existing IS NULL OR v_existing NOT IN ('light', 'medium', 'full') THEN
      RAISE EXCEPTION 'invalid_body_value' USING ERRCODE = '22023';
    END IF;
  ELSIF v_action = 'remove' AND v_dim IN ('region', 'grape') THEN
    IF v_existing IS NULL THEN
      RAISE EXCEPTION 'invalid_remove_value' USING ERRCODE = '22023';
    END IF;
  ELSE
    RAISE EXCEPTION 'unsupported_profile_action' USING ERRCODE = '22023';
  END IF;

  v_locale := COALESCE(NULLIF(v_payload->>'locale', ''), 'unknown');
  v_raw := left(COALESCE(v_payload->>'raw_text', 'profile_ui'), 4000);
  v_ev_polarity := CASE WHEN v_action = 'remove' THEN 'retract' ELSE 'like' END;

  v_action_fp := jsonb_build_object(
    'action', v_action,
    'dimension', v_dim,
    'existing_value', v_existing,
    'proposed_value', v_proposed,
    'polarity', CASE WHEN v_dim IN ('region', 'grape') THEN v_polarity ELSE NULL END
  );

  v_delta := jsonb_build_object(
    'schema', 'pref_profile_ui_v1',
    'source', 'profile_ui',
    'action', v_action_fp,
    'requires_confirmation', false,
    'extraction_method', 'profile_ui'
  );

  -- Idempotent: same user + same operation key
  SELECT * INTO v_existing_event
  FROM public.sommelier_feedback_events
  WHERE user_id = v_uid AND idempotency_key = v_key
  FOR UPDATE;

  IF FOUND THEN
    v_stored_fp := COALESCE(v_existing_event.preference_delta->'action', '{}'::jsonb);
    IF v_stored_fp IS DISTINCT FROM v_action_fp THEN
      RETURN jsonb_build_object(
        'reason', 'idempotency_conflict',
        'canonical_applied', false,
        'event_id', v_existing_event.id,
        'status', v_existing_event.status
      );
    END IF;

    IF v_existing_event.applied_to_canonical IS TRUE
       OR v_existing_event.status = 'applied' THEN
      RETURN jsonb_build_object(
        'reason', 'already_applied',
        'event_id', v_existing_event.id,
        'canonical_applied', true,
        'status', 'applied',
        'profile_version', 2
      );
    END IF;

    -- Never leave Profile-keyed rows as chat-confirmable pending
    IF v_existing_event.status = 'pending_confirmation' THEN
      UPDATE public.sommelier_feedback_events
      SET status = 'superseded', resolved_at = now()
      WHERE id = v_existing_event.id AND status = 'pending_confirmation';
    END IF;
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
    RETURN jsonb_build_object('reason', 'unsupported_version', 'canonical_applied', false);
  END IF;

  v_explicit := COALESCE(v_doc->'explicit', '{}'::jsonb);
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

  -- Semantic no-ops (new operation only — already_applied handled above).
  -- Do not insert evidence or mutate legacy_suppress.
  IF v_dim = 'body' THEN
    v_body_val := lower(trim(COALESCE(v_explicit->'body'->>'value', '')));
    IF v_action = 'replace' THEN
      IF v_body_val = v_proposed THEN
        RETURN jsonb_build_object(
          'reason', 'unchanged',
          'canonical_applied', false,
          'status', 'noop'
        );
      ELSIF v_body_val IS DISTINCT FROM v_existing THEN
        RETURN jsonb_build_object(
          'reason', 'conflict',
          'canonical_applied', false,
          'expected', v_existing,
          'actual', NULLIF(v_body_val, '')
        );
      END IF;
    ELSE
      -- remove/clear body
      IF v_body_val IS NULL OR v_body_val = '' THEN
        RETURN jsonb_build_object(
          'reason', 'unchanged',
          'canonical_applied', false,
          'status', 'noop'
        );
      ELSIF v_body_val IS DISTINCT FROM v_existing THEN
        RETURN jsonb_build_object(
          'reason', 'conflict',
          'canonical_applied', false,
          'expected', v_existing,
          'actual', NULLIF(v_body_val, '')
        );
      END IF;
    END IF;
  ELSE
    v_list := CASE
      WHEN v_dim = 'region' AND v_polarity = 'like' THEN 'regions_liked'
      WHEN v_dim = 'region' THEN 'regions_disliked'
      WHEN v_dim = 'grape' AND v_polarity = 'like' THEN 'grapes_liked'
      ELSE 'grapes_disliked'
    END;
    SELECT EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(v_explicit->v_list, '[]'::jsonb)) e
      WHERE lower(e->>'id') = v_existing
    ) INTO v_found;
    IF NOT v_found THEN
      RETURN jsonb_build_object(
        'reason', 'not_found',
        'canonical_applied', false,
        'status', 'noop'
      );
    END IF;
  END IF;

  -- Upsert evidence as applied BEFORE profile write so event id exists for merge helpers.
  -- Status is never pending_confirmation.
  BEGIN
    IF v_existing_event.id IS NOT NULL
       AND v_existing_event.applied_to_canonical IS DISTINCT FROM TRUE
       AND v_existing_event.status IS DISTINCT FROM 'applied' THEN
      UPDATE public.sommelier_feedback_events
      SET
        status = 'applied',
        scope = 'stable',
        polarity = v_ev_polarity,
        target_dimension = v_dim,
        target_value = COALESCE(v_proposed, v_existing),
        confirmation_expires_at = NULL,
        resolved_at = now(),
        conversation_id = NULL,
        preference_delta = v_delta,
        raw_text = v_raw,
        locale = v_locale,
        applied_to_canonical = true,
        structured_tags = ARRAY['profile_ui', v_action, v_dim]
      WHERE id = v_existing_event.id
      RETURNING * INTO v_event;
    ELSE
      INSERT INTO public.sommelier_feedback_events (
        user_id, raw_text, structured_tags, sentiment, preference_delta,
        scope, polarity, extraction_version, locale, idempotency_key, status,
        target_dimension, target_value, applied_to_canonical,
        confirmation_expires_at, conversation_id, resolved_at
      ) VALUES (
        v_uid, v_raw,
        ARRAY['profile_ui', v_action, v_dim],
        'neutral',
        v_delta,
        'stable', v_ev_polarity, 'profile_ui_v1', v_locale, v_key, 'applied',
        v_dim, COALESCE(v_proposed, v_existing), true,
        NULL, NULL, now()
      )
      RETURNING * INTO v_event;
    END IF;
  EXCEPTION
    WHEN unique_violation THEN
      -- Concurrent same-operation insert: treat as already applied if payload matches
      SELECT * INTO v_existing_event
      FROM public.sommelier_feedback_events
      WHERE user_id = v_uid AND idempotency_key = v_key
      FOR UPDATE;
      IF NOT FOUND THEN
        RAISE;
      END IF;
      v_stored_fp := COALESCE(v_existing_event.preference_delta->'action', '{}'::jsonb);
      IF v_stored_fp IS DISTINCT FROM v_action_fp THEN
        RETURN jsonb_build_object(
          'reason', 'idempotency_conflict',
          'canonical_applied', false,
          'event_id', v_existing_event.id,
          'status', v_existing_event.status
        );
      END IF;
      RETURN jsonb_build_object(
        'reason', 'already_applied',
        'event_id', v_existing_event.id,
        'canonical_applied', true,
        'status', 'applied',
        'profile_version', 2
      );
  END;

  -- Apply canonical mutation
  IF v_dim = 'body' AND v_action = 'replace' THEN
    v_doc := public._taste_merge_explicit_body(
      v_doc,
      jsonb_build_object(
        'value', v_proposed,
        'confidence', 0.9,
        'updated_at', now()::text,
        'source', 'profile_ui'
      ),
      v_event.id
    );
  ELSIF v_dim = 'body' AND v_action = 'remove' THEN
    v_explicit := COALESCE(v_doc->'explicit', v_explicit);
    IF v_explicit->'body' IS NOT NULL AND v_explicit->'body' <> 'null'::jsonb THEN
      v_explicit := jsonb_set(v_explicit, '{body}', 'null'::jsonb, true);
      v_suppress := COALESCE(v_explicit->'legacy_suppress', '{}'::jsonb);
      v_suppress := jsonb_set(v_suppress, '{body}', 'true'::jsonb, true);
      v_explicit := jsonb_set(v_explicit, '{legacy_suppress}', v_suppress, true);
      v_explicit := jsonb_set(v_explicit, '{updated_at}', to_jsonb(now()::text), true);
      v_doc := jsonb_set(v_doc, '{explicit}', v_explicit, true);
    END IF;
  ELSIF v_action = 'remove' THEN
    v_explicit := COALESCE(v_doc->'explicit', v_explicit);
    v_arr := COALESCE(v_explicit->v_list, '[]'::jsonb);
    v_new_arr := '[]'::jsonb;
    FOR v_i IN 0 .. GREATEST(jsonb_array_length(v_arr) - 1, -1) LOOP
      IF lower(v_arr->v_i->>'id') IS DISTINCT FROM v_existing THEN
        v_new_arr := v_new_arr || jsonb_build_array(v_arr->v_i);
      END IF;
    END LOOP;
    v_explicit := jsonb_set(v_explicit, ARRAY[v_list], v_new_arr, true);
    v_suppress := COALESCE(v_explicit->'legacy_suppress', '{}'::jsonb);
    IF v_dim = 'region' THEN
      v_suppress := jsonb_set(
        v_suppress,
        '{regions}',
        (
          SELECT COALESCE(jsonb_agg(DISTINCT x), '[]'::jsonb)
          FROM (
            SELECT jsonb_array_elements_text(COALESCE(v_suppress->'regions', '[]'::jsonb)) AS x
            UNION ALL
            SELECT v_existing
          ) s
        ),
        true
      );
    ELSE
      v_suppress := jsonb_set(
        v_suppress,
        '{grapes}',
        (
          SELECT COALESCE(jsonb_agg(DISTINCT x), '[]'::jsonb)
          FROM (
            SELECT jsonb_array_elements_text(COALESCE(v_suppress->'grapes', '[]'::jsonb)) AS x
            UNION ALL
            SELECT v_existing
          ) s
        ),
        true
      );
    END IF;
    v_explicit := jsonb_set(v_explicit, '{legacy_suppress}', v_suppress, true);
    v_explicit := jsonb_set(v_explicit, '{updated_at}', to_jsonb(now()::text), true);
    v_doc := jsonb_set(v_doc, '{explicit}', v_explicit, true);
  END IF;

  v_doc := jsonb_set(v_doc, '{version}', '2'::jsonb, true);

  UPDATE public.profiles
  SET
    taste_profile = v_doc,
    taste_profile_version = 2,
    taste_profile_updated_at = now()
  WHERE id = v_uid;

  RETURN jsonb_build_object(
    'reason', 'applied',
    'event_id', v_event.id,
    'canonical_applied', true,
    'status', 'applied',
    'profile_version', 2,
    'action', v_action,
    'dimension', v_dim
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_taste_profile_memory_action(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_taste_profile_memory_action(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.apply_taste_profile_memory_action(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_taste_profile_memory_action(jsonb) TO service_role;

COMMENT ON FUNCTION public.apply_taste_profile_memory_action(jsonb) IS
  'Profile UI: atomic explicit preference remove/replace/clear keyed by operation_id. Never creates pending_confirmation. SECURITY INVOKER.';
