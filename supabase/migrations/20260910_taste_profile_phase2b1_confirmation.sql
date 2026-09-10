-- Phase 2B.1: pending confirmation for contradiction / forget of canonical explicit
-- Additive only. SECURITY INVOKER; identity from auth.uid().
-- Does not mutate existing rows or create pending events.

-- ── New columns ──────────────────────────────────────────────────────────────

ALTER TABLE public.sommelier_feedback_events
  ADD COLUMN IF NOT EXISTS confirmation_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS conversation_id uuid;

-- ── Extend status CHECK (drop + recreate; keep prior values) ───────────────

ALTER TABLE public.sommelier_feedback_events
  DROP CONSTRAINT IF EXISTS sommelier_feedback_status_check;

ALTER TABLE public.sommelier_feedback_events
  ADD CONSTRAINT sommelier_feedback_status_check
  CHECK (
    status IS NULL OR status IN (
      'active',
      'pending_unsupported',
      'recorded_no_apply',
      'superseded',
      'retracted',
      'pending_confirmation',
      'applied',
      'rejected',
      'expired'
    )
  );

-- At most one active pending confirmation per (user, conversation) when conversation set;
-- and at most one active pending per user when conversation_id IS NULL.
CREATE UNIQUE INDEX IF NOT EXISTS uq_sommelier_feedback_pending_confirm_conv
  ON public.sommelier_feedback_events (user_id, conversation_id)
  WHERE status = 'pending_confirmation' AND conversation_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sommelier_feedback_pending_confirm_user
  ON public.sommelier_feedback_events (user_id)
  WHERE status = 'pending_confirmation' AND conversation_id IS NULL;

COMMENT ON COLUMN public.sommelier_feedback_events.confirmation_expires_at IS
  'Phase 2B.1: when pending_confirmation expires (typically now()+15m).';
COMMENT ON COLUMN public.sommelier_feedback_events.resolved_at IS
  'Phase 2B.1: when pending confirmation was applied/rejected/expired/superseded.';
COMMENT ON COLUMN public.sommelier_feedback_events.conversation_id IS
  'Phase 2B.1: optional web sommelier_conversations.id; pending scoped when present.';

-- ── create_taste_pending_confirmation ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_taste_pending_confirmation(
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
  v_action text;
  v_dim text;
  v_existing text;
  v_proposed text;
  v_locale text;
  v_raw text;
  v_conv uuid;
  v_expires timestamptz;
  v_existing_event public.sommelier_feedback_events%ROWTYPE;
  v_event public.sommelier_feedback_events%ROWTYPE;
  v_delta jsonb;
  v_polarity text;
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

  v_action := COALESCE(v_payload->>'action', '');
  IF v_action NOT IN ('replace', 'remove', 'move_polarity') THEN
    RAISE EXCEPTION 'invalid_action' USING ERRCODE = '22023';
  END IF;

  v_dim := COALESCE(v_payload->>'dimension', '');
  IF v_dim NOT IN ('region', 'grape', 'body', 'style') THEN
    RAISE EXCEPTION 'invalid_dimension' USING ERRCODE = '22023';
  END IF;

  v_existing := NULLIF(left(lower(trim(COALESCE(v_payload->>'existing_value', ''))), 64), '');
  v_proposed := NULLIF(left(lower(trim(COALESCE(v_payload->>'proposed_value', ''))), 64), '');

  IF v_action = 'replace' AND (v_existing IS NULL OR v_proposed IS NULL OR v_existing = v_proposed) THEN
    RAISE EXCEPTION 'invalid_replace_values' USING ERRCODE = '22023';
  END IF;
  IF v_action = 'remove' AND v_existing IS NULL THEN
    RAISE EXCEPTION 'invalid_remove_value' USING ERRCODE = '22023';
  END IF;
  IF v_action = 'move_polarity' AND (v_existing IS NULL OR v_proposed IS NULL) THEN
    RAISE EXCEPTION 'invalid_move_values' USING ERRCODE = '22023';
  END IF;
  IF v_dim = 'body' AND v_action IN ('replace', 'remove') THEN
    IF v_existing IS NOT NULL AND v_existing NOT IN ('light', 'medium', 'full') THEN
      RAISE EXCEPTION 'invalid_body_value' USING ERRCODE = '22023';
    END IF;
    IF v_proposed IS NOT NULL AND v_proposed NOT IN ('light', 'medium', 'full') THEN
      RAISE EXCEPTION 'invalid_body_value' USING ERRCODE = '22023';
    END IF;
  END IF;

  v_locale := COALESCE(NULLIF(v_payload->>'locale', ''), 'unknown');
  v_raw := left(COALESCE(v_payload->>'raw_text', ''), 4000);
  v_polarity := CASE
    WHEN v_action = 'remove' THEN 'retract'
    WHEN v_action = 'move_polarity' AND COALESCE(v_payload->>'proposed_polarity', '') = 'dislike' THEN 'dislike'
    ELSE 'like'
  END;
  v_expires := now() + interval '15 minutes';

  BEGIN
    v_conv := NULLIF(v_payload->>'conversation_id', '')::uuid;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'invalid_conversation_id' USING ERRCODE = '22023';
  END;

  -- Idempotent: same key already pending → return it
  SELECT * INTO v_existing_event
  FROM public.sommelier_feedback_events
  WHERE user_id = v_uid AND idempotency_key = v_key;

  IF FOUND THEN
    IF v_existing_event.status = 'pending_confirmation'
       AND (v_existing_event.confirmation_expires_at IS NULL
            OR v_existing_event.confirmation_expires_at > now()) THEN
      RETURN jsonb_build_object(
        'event_id', v_existing_event.id,
        'status', 'pending_confirmation',
        'reason', 'already_pending',
        'expires_at', v_existing_event.confirmation_expires_at
      );
    END IF;
    IF v_existing_event.status IN ('applied', 'rejected', 'expired', 'superseded') THEN
      RETURN jsonb_build_object(
        'event_id', v_existing_event.id,
        'status', v_existing_event.status,
        'reason', 'already_resolved',
        'expires_at', v_existing_event.confirmation_expires_at
      );
    END IF;
  END IF;

  -- Supersede prior active pendings in scope
  IF v_conv IS NOT NULL THEN
    UPDATE public.sommelier_feedback_events
    SET status = 'superseded', resolved_at = now()
    WHERE user_id = v_uid
      AND conversation_id = v_conv
      AND status = 'pending_confirmation';
  ELSE
    UPDATE public.sommelier_feedback_events
    SET status = 'superseded', resolved_at = now()
    WHERE user_id = v_uid
      AND conversation_id IS NULL
      AND status = 'pending_confirmation';
  END IF;

  v_delta := jsonb_build_object(
    'schema', 'pref_pending_v1',
    'pending_action', jsonb_build_object(
      'action', v_action,
      'dimension', v_dim,
      'existing_value', v_existing,
      'proposed_value', v_proposed,
      'proposed_polarity', NULLIF(v_payload->>'proposed_polarity', ''),
      'label_en', NULLIF(left(COALESCE(v_payload->>'label_en', ''), 80), ''),
      'label_he', NULLIF(left(COALESCE(v_payload->>'label_he', ''), 80), '')
    ),
    'requires_confirmation', true,
    'extraction_method', 'rules_v2'
  );

  IF v_existing_event.id IS NOT NULL AND v_existing_event.status NOT IN ('applied', 'rejected') THEN
    UPDATE public.sommelier_feedback_events
    SET
      status = 'pending_confirmation',
      scope = 'stable',
      polarity = v_polarity,
      target_dimension = v_dim,
      target_value = COALESCE(v_proposed, v_existing),
      confirmation_expires_at = v_expires,
      resolved_at = NULL,
      conversation_id = v_conv,
      preference_delta = v_delta,
      raw_text = v_raw,
      locale = v_locale,
      applied_to_canonical = false
    WHERE id = v_existing_event.id
    RETURNING * INTO v_event;
  ELSE
    INSERT INTO public.sommelier_feedback_events (
      user_id, raw_text, structured_tags, sentiment, preference_delta,
      scope, polarity, extraction_version, locale, idempotency_key, status,
      target_dimension, target_value, applied_to_canonical,
      confirmation_expires_at, conversation_id
    ) VALUES (
      v_uid, v_raw,
      ARRAY['pending_confirmation', v_action, v_dim],
      'neutral',
      v_delta,
      'stable', v_polarity, 'rules_v2', v_locale, v_key, 'pending_confirmation',
      v_dim, COALESCE(v_proposed, v_existing), false,
      v_expires, v_conv
    )
    RETURNING * INTO v_event;
  END IF;

  RETURN jsonb_build_object(
    'event_id', v_event.id,
    'status', 'pending_confirmation',
    'reason', 'created',
    'expires_at', v_event.confirmation_expires_at,
    'action', v_action,
    'dimension', v_dim,
    'existing_value', v_existing,
    'proposed_value', v_proposed
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_taste_pending_confirmation(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_taste_pending_confirmation(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_taste_pending_confirmation(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_taste_pending_confirmation(jsonb) TO service_role;

-- ── resolve_taste_confirmation ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.resolve_taste_confirmation(
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
  v_decision text;
  v_event_id uuid;
  v_conv uuid;
  v_event public.sommelier_feedback_events%ROWTYPE;
  v_row public.profiles%ROWTYPE;
  v_doc jsonb;
  v_ver int;
  v_pending jsonb;
  v_action text;
  v_dim text;
  v_existing text;
  v_proposed text;
  v_prop_pol text;
  v_list text;
  v_opp text;
  v_arr jsonb;
  v_new_arr jsonb := '[]'::jsonb;
  v_item jsonb;
  v_i int;
  v_found boolean := false;
  v_body_val text;
  v_explicit jsonb;
  v_suppress jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  IF octet_length(v_payload::text) > 4096 THEN
    RAISE EXCEPTION 'payload_too_large' USING ERRCODE = '22023';
  END IF;

  v_decision := lower(trim(COALESCE(v_payload->>'decision', '')));
  IF v_decision NOT IN ('confirm', 'reject') THEN
    RAISE EXCEPTION 'invalid_decision' USING ERRCODE = '22023';
  END IF;

  BEGIN
    v_event_id := NULLIF(v_payload->>'event_id', '')::uuid;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'invalid_event_id' USING ERRCODE = '22023';
  END;

  BEGIN
    v_conv := NULLIF(v_payload->>'conversation_id', '')::uuid;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'invalid_conversation_id' USING ERRCODE = '22023';
  END;

  -- Lock newest matching pending event
  IF v_event_id IS NOT NULL THEN
    SELECT * INTO v_event
    FROM public.sommelier_feedback_events
    WHERE id = v_event_id AND user_id = v_uid
    FOR UPDATE;
  ELSIF v_conv IS NOT NULL THEN
    SELECT * INTO v_event
    FROM public.sommelier_feedback_events
    WHERE user_id = v_uid
      AND conversation_id = v_conv
      AND status = 'pending_confirmation'
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;
  ELSE
    SELECT * INTO v_event
    FROM public.sommelier_feedback_events
    WHERE user_id = v_uid
      AND conversation_id IS NULL
      AND status = 'pending_confirmation'
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('reason', 'not_found', 'canonical_applied', false);
  END IF;

  IF v_event.user_id IS DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object('reason', 'unauthorized', 'canonical_applied', false);
  END IF;

  -- Conversation binding when both sides have an id
  IF v_conv IS NOT NULL AND v_event.conversation_id IS NOT NULL
     AND v_event.conversation_id IS DISTINCT FROM v_conv THEN
    RETURN jsonb_build_object(
      'reason', 'wrong_conversation',
      'event_id', v_event.id,
      'canonical_applied', false
    );
  END IF;

  IF v_event.status = 'applied' THEN
    RETURN jsonb_build_object(
      'reason', 'already_resolved',
      'status', 'applied',
      'event_id', v_event.id,
      'canonical_applied', true
    );
  END IF;

  IF v_event.status = 'rejected' THEN
    RETURN jsonb_build_object(
      'reason', 'already_resolved',
      'status', 'rejected',
      'event_id', v_event.id,
      'canonical_applied', false
    );
  END IF;

  IF v_event.status = 'superseded' THEN
    RETURN jsonb_build_object(
      'reason', 'superseded',
      'event_id', v_event.id,
      'canonical_applied', false
    );
  END IF;

  IF v_event.status = 'expired'
     OR (v_event.status = 'pending_confirmation'
         AND v_event.confirmation_expires_at IS NOT NULL
         AND v_event.confirmation_expires_at <= now()) THEN
    UPDATE public.sommelier_feedback_events
    SET status = 'expired', resolved_at = COALESCE(resolved_at, now())
    WHERE id = v_event.id AND status = 'pending_confirmation';
    RETURN jsonb_build_object(
      'reason', 'expired',
      'event_id', v_event.id,
      'canonical_applied', false
    );
  END IF;

  IF v_event.status IS DISTINCT FROM 'pending_confirmation' THEN
    RETURN jsonb_build_object(
      'reason', 'not_found',
      'event_id', v_event.id,
      'canonical_applied', false
    );
  END IF;

  IF v_decision = 'reject' THEN
    UPDATE public.sommelier_feedback_events
    SET status = 'rejected', resolved_at = now()
    WHERE id = v_event.id;
    RETURN jsonb_build_object(
      'reason', 'rejected',
      'event_id', v_event.id,
      'canonical_applied', false,
      'status', 'rejected',
      'pending_action', v_event.preference_delta->'pending_action'
    );
  END IF;

  -- confirm path
  v_pending := COALESCE(v_event.preference_delta->'pending_action', '{}'::jsonb);
  v_action := v_pending->>'action';
  v_dim := v_pending->>'dimension';
  v_existing := lower(trim(COALESCE(v_pending->>'existing_value', '')));
  v_proposed := NULLIF(lower(trim(COALESCE(v_pending->>'proposed_value', ''))), '');
  v_prop_pol := COALESCE(v_pending->>'proposed_polarity', 'like');

  IF v_action NOT IN ('replace', 'remove', 'move_polarity')
     OR v_dim NOT IN ('region', 'grape', 'body', 'style') THEN
    RETURN jsonb_build_object('reason', 'unsupported_delta', 'event_id', v_event.id, 'canonical_applied', false);
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
    RETURN jsonb_build_object('reason', 'unsupported_version', 'event_id', v_event.id, 'canonical_applied', false);
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

  -- Conflict checks: expected existing value must still match
  IF v_dim = 'body' THEN
    v_body_val := lower(trim(COALESCE(v_explicit->'body'->>'value', '')));
    IF v_action IN ('replace', 'remove') AND v_body_val IS DISTINCT FROM v_existing THEN
      UPDATE public.sommelier_feedback_events
      SET status = 'superseded', resolved_at = now()
      WHERE id = v_event.id;
      RETURN jsonb_build_object(
        'reason', 'conflict',
        'event_id', v_event.id,
        'canonical_applied', false,
        'expected', v_existing,
        'actual', NULLIF(v_body_val, '')
      );
    END IF;
  ELSE
    v_list := CASE
      WHEN v_dim = 'region' AND v_action = 'move_polarity' AND v_prop_pol = 'dislike' THEN 'regions_liked'
      WHEN v_dim = 'grape' AND v_action = 'move_polarity' AND v_prop_pol = 'dislike' THEN 'grapes_liked'
      WHEN v_dim = 'region' AND v_action = 'remove' THEN
        CASE WHEN EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(v_explicit->'regions_liked', '[]'::jsonb)) e
          WHERE lower(e->>'id') = v_existing
        ) THEN 'regions_liked' ELSE 'regions_disliked' END
      WHEN v_dim = 'grape' AND v_action = 'remove' THEN
        CASE WHEN EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(v_explicit->'grapes_liked', '[]'::jsonb)) e
          WHERE lower(e->>'id') = v_existing
        ) THEN 'grapes_liked' ELSE 'grapes_disliked' END
      WHEN v_dim = 'region' THEN 'regions_liked'
      WHEN v_dim = 'grape' THEN 'grapes_liked'
      ELSE 'styles_liked'
    END;

    IF v_action IN ('remove', 'replace', 'move_polarity') THEN
      SELECT EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(v_explicit->v_list, '[]'::jsonb)) e
        WHERE lower(e->>'id') = v_existing
      ) INTO v_found;
      IF NOT v_found AND v_action = 'remove' THEN
        -- try opposite list for remove
        v_opp := replace(v_list, '_liked', '_disliked');
        IF v_opp = v_list THEN
          v_opp := replace(v_list, '_disliked', '_liked');
        END IF;
        SELECT EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(v_explicit->v_opp, '[]'::jsonb)) e
          WHERE lower(e->>'id') = v_existing
        ) INTO v_found;
        IF v_found THEN
          v_list := v_opp;
        END IF;
      END IF;
      -- move_polarity may add to disliked without prior liked entry (first-time dislike)
      IF NOT v_found AND v_action IS DISTINCT FROM 'move_polarity' THEN
        UPDATE public.sommelier_feedback_events
        SET status = 'superseded', resolved_at = now()
        WHERE id = v_event.id;
        RETURN jsonb_build_object(
          'reason', 'conflict',
          'event_id', v_event.id,
          'canonical_applied', false
        );
      END IF;
    END IF;
  END IF;

  -- Apply mutation
  IF v_dim = 'body' AND v_action = 'replace' THEN
    v_doc := public._taste_merge_explicit_body(
      v_doc,
      jsonb_build_object(
        'value', v_proposed,
        'confidence', 0.9,
        'updated_at', now()::text,
        'source', 'chat'
      ),
      v_event.id
    );
  ELSIF v_dim = 'body' AND v_action = 'remove' THEN
    v_explicit := jsonb_set(v_explicit, '{body}', 'null'::jsonb, true);
    v_suppress := COALESCE(v_explicit->'legacy_suppress', '{}'::jsonb);
    v_suppress := jsonb_set(v_suppress, '{body}', 'true'::jsonb, true);
    v_explicit := jsonb_set(v_explicit, '{legacy_suppress}', v_suppress, true);
    v_explicit := jsonb_set(v_explicit, '{updated_at}', to_jsonb(now()::text), true);
    v_doc := jsonb_set(v_doc, '{explicit}', v_explicit, true);
  ELSIF v_action = 'remove' THEN
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
    ELSIF v_dim = 'grape' THEN
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
  ELSIF v_action = 'move_polarity' AND v_dim IN ('region', 'grape', 'style') THEN
    -- remove from liked, add to disliked (or reverse). If source list miss, still add target.
    IF v_prop_pol = 'dislike' THEN
      v_list := CASE v_dim WHEN 'region' THEN 'regions_liked' WHEN 'grape' THEN 'grapes_liked' ELSE 'styles_liked' END;
      v_opp := CASE v_dim WHEN 'region' THEN 'regions_disliked' WHEN 'grape' THEN 'grapes_disliked' ELSE 'styles_disliked' END;
    ELSE
      v_list := CASE v_dim WHEN 'region' THEN 'regions_disliked' WHEN 'grape' THEN 'grapes_disliked' ELSE 'styles_disliked' END;
      v_opp := CASE v_dim WHEN 'region' THEN 'regions_liked' WHEN 'grape' THEN 'grapes_liked' ELSE 'styles_liked' END;
    END IF;
    v_arr := COALESCE(v_explicit->v_list, '[]'::jsonb);
    v_new_arr := '[]'::jsonb;
    FOR v_i IN 0 .. GREATEST(jsonb_array_length(v_arr) - 1, -1) LOOP
      IF lower(v_arr->v_i->>'id') IS DISTINCT FROM v_existing THEN
        v_new_arr := v_new_arr || jsonb_build_array(v_arr->v_i);
      END IF;
    END LOOP;
    v_explicit := jsonb_set(v_explicit, ARRAY[v_list], v_new_arr, true);
    v_doc := jsonb_set(v_doc, '{explicit}', v_explicit, true);
    v_doc := public._taste_merge_explicit_value(
      v_doc,
      v_opp,
      jsonb_build_object(
        'id', v_existing,
        'confidence', 0.9,
        'updated_at', now()::text,
        'source', 'chat',
        'label_en', v_pending->>'label_en',
        'label_he', v_pending->>'label_he'
      ),
      v_event.id
    );
  ELSIF v_action = 'replace' AND v_dim IN ('region', 'grape', 'style') THEN
    -- unlikely for 2B.1 region replace; treat as remove+add
    v_list := CASE v_dim WHEN 'region' THEN 'regions_liked' WHEN 'grape' THEN 'grapes_liked' ELSE 'styles_liked' END;
    v_arr := COALESCE(v_explicit->v_list, '[]'::jsonb);
    v_new_arr := '[]'::jsonb;
    FOR v_i IN 0 .. GREATEST(jsonb_array_length(v_arr) - 1, -1) LOOP
      IF lower(v_arr->v_i->>'id') IS DISTINCT FROM v_existing THEN
        v_new_arr := v_new_arr || jsonb_build_array(v_arr->v_i);
      END IF;
    END LOOP;
    v_explicit := jsonb_set(v_explicit, ARRAY[v_list], v_new_arr, true);
    v_doc := jsonb_set(v_doc, '{explicit}', v_explicit, true);
    IF v_proposed IS NOT NULL THEN
      v_doc := public._taste_merge_explicit_value(
        v_doc,
        v_list,
        jsonb_build_object(
          'id', v_proposed,
          'confidence', 0.9,
          'updated_at', now()::text,
          'source', 'chat'
        ),
        v_event.id
      );
    END IF;
  ELSE
    RETURN jsonb_build_object('reason', 'unsupported_delta', 'event_id', v_event.id, 'canonical_applied', false);
  END IF;

  v_doc := jsonb_set(v_doc, '{version}', '2'::jsonb, true);

  UPDATE public.profiles
  SET
    taste_profile = v_doc,
    taste_profile_version = 2,
    taste_profile_updated_at = now()
  WHERE id = v_uid;

  UPDATE public.sommelier_feedback_events
  SET
    status = 'applied',
    applied_to_canonical = true,
    resolved_at = now()
  WHERE id = v_event.id;

  RETURN jsonb_build_object(
    'reason', 'applied',
    'event_id', v_event.id,
    'canonical_applied', true,
    'status', 'applied',
    'profile_version', 2,
    'pending_action', v_pending
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_taste_confirmation(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_taste_confirmation(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.resolve_taste_confirmation(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_taste_confirmation(jsonb) TO service_role;

COMMENT ON FUNCTION public.create_taste_pending_confirmation(jsonb) IS
  'Phase 2B.1: create DB-backed pending taste confirmation. SECURITY INVOKER.';
COMMENT ON FUNCTION public.resolve_taste_confirmation(jsonb) IS
  'Phase 2B.1: confirm/reject pending taste change atomically. SECURITY INVOKER.';
