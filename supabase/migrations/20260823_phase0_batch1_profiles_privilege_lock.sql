-- Phase 0 Batch 1: SEC-001 privilege lockdown + DEFINER hardening
-- - Block authenticated/anon from writing privileged profiles columns
-- - Signup attribution immutable once set
-- - Allow service_role + GUC bypass for sync_admin_to_profiles
-- - Fix search_path on critical DEFINER helpers
-- - Drop webhook trigger that embeds a Bearer secret in pg_get_triggerdef
-- - REVOKE dangerous credit/billing EXECUTEs from anon/authenticated

-- ── 1. Privilege-lock trigger ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.protect_profiles_privileges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_role text := coalesce(auth.role(), '');
  v_allow text := coalesce(current_setting('app.allow_profile_privilege_write', true), '');
BEGIN
  -- Trusted writers: service_role JWT, or explicit GUC from DEFINER sync paths
  IF v_role = 'service_role' OR v_allow = 'on' THEN
    RETURN NEW;
  END IF;

  -- Only constrain PostgREST client roles
  IF v_role IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      -- Force table defaults; ignore client-supplied privileged values
      NEW.is_admin := false;
      NEW.ai_label_art_enabled := false;
      NEW.can_multi_bottle_import := true;
      NEW.can_share_cellar := true;
      NEW.cellar_agent_enabled := true;
      NEW.csv_import_enabled := false;
      NEW.plan_evening_enabled := true;
      NEW.wishlist_enabled := true;
      NEW.last_active_at := NULL;
    ELSIF TG_OP = 'UPDATE' THEN
      NEW.is_admin := OLD.is_admin;
      NEW.ai_label_art_enabled := OLD.ai_label_art_enabled;
      NEW.can_multi_bottle_import := OLD.can_multi_bottle_import;
      NEW.can_share_cellar := OLD.can_share_cellar;
      NEW.cellar_agent_enabled := OLD.cellar_agent_enabled;
      NEW.csv_import_enabled := OLD.csv_import_enabled;
      NEW.plan_evening_enabled := OLD.plan_evening_enabled;
      NEW.wishlist_enabled := OLD.wishlist_enabled;
      NEW.last_active_at := OLD.last_active_at;

      -- Attribution: writable only while OLD is null
      IF OLD.signup_source IS NOT NULL THEN
        NEW.signup_source := OLD.signup_source;
      END IF;
      IF OLD.signup_medium IS NOT NULL THEN
        NEW.signup_medium := OLD.signup_medium;
      END IF;
      IF OLD.signup_campaign IS NOT NULL THEN
        NEW.signup_campaign := OLD.signup_campaign;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profiles_privileges_trg ON public.profiles;
CREATE TRIGGER protect_profiles_privileges_trg
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profiles_privileges();

COMMENT ON FUNCTION public.protect_profiles_privileges() IS
  'Blocks authenticated/anon from changing privileged profile columns; service_role or app.allow_profile_privilege_write=on may write.';

-- ── 2. is_admin + sync_admin_to_profiles ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF check_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = check_user_id AND is_admin = true
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.admins
    WHERE user_id = check_user_id
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.sync_admin_to_profiles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.allow_profile_privilege_write', 'on', true);

  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles SET is_admin = true WHERE id = NEW.user_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles SET is_admin = false WHERE id = OLD.user_id;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sync_admin_to_profiles_trigger ON public.admins;
CREATE TRIGGER sync_admin_to_profiles_trigger
  AFTER INSERT OR DELETE ON public.admins
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_admin_to_profiles();

-- Harden search_path on other known DEFINER helpers (body unchanged)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'handle_new_user' AND pg_get_function_identity_arguments(p.oid) = ''
  ) THEN
    EXECUTE 'ALTER FUNCTION public.handle_new_user() SET search_path = public';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'count_bottles_needing_readiness'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.count_bottles_needing_readiness(text, integer) SET search_path = public';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_active_events_for_user'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.get_active_events_for_user(uuid, integer, integer) SET search_path = public';
  END IF;
END $$;

-- ── 3. Remove secret-bearing signup webhook trigger ──────────────────────────
-- The prior trigger embedded a Bearer token in the catalog. Rotate that secret
-- in the admin-notifications edge function / Dashboard, then recreate the
-- webhook via Dashboard (Database → Webhooks) without putting secrets in SQL.

DROP TRIGGER IF EXISTS "notify-admin-signup" ON public.profiles;

-- ── 4. Lock down billing / credit mutating DEFINER RPCs ──────────────────────

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'paddle_grant_credits',
        'paddle_cancel_subscription',
        'reset_monthly_credits',
        'reset_free_user_credits',
        'repair_subscription_credits',
        'provision_free_credits_on_signup'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;
