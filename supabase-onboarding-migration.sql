-- CRIPRI Universal School Website: Principal onboarding functions
-- Apply this script in the Supabase SQL Editor after reviewing it.
-- The one-time TELWA GIRLS recovery was completed separately. DO NOT rerun that recovery.
-- This script does not disable RLS and does not create broad table policies.

BEGIN;

CREATE OR REPLACE FUNCTION public.review_school_application(
  p_application_id uuid,
  p_decision text,
  p_reason text DEFAULT NULL
)
RETURNS public.school_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_reviewer_id uuid;
  v_decision text;
  v_application public.school_applications%ROWTYPE;
  v_school_id uuid;
BEGIN
  v_reviewer_id := auth.uid();
  IF v_reviewer_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.platform_reviewers AS pr
    WHERE pr.user_id = v_reviewer_id
      AND pr.active = true
  ) THEN
    RAISE EXCEPTION 'Active platform reviewer access required';
  END IF;

  v_decision := lower(btrim(coalesce(p_decision, '')));
  IF v_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Decision must be approved or rejected';
  END IF;

  SELECT a.*
  INTO v_application
  FROM public.school_applications AS a
  WHERE a.id = p_application_id
    AND a.status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found or has already been reviewed';
  END IF;

  IF v_decision = 'approved' THEN
    INSERT INTO public.schools (name, slug, status)
    VALUES (v_application.school_name, v_application.requested_slug, 'pending')
    RETURNING id INTO v_school_id;
  END IF;

  UPDATE public.school_applications AS a
  SET status = v_decision,
      reviewed_at = now(),
      reviewed_by = v_reviewer_id,
      review_reason = NULLIF(btrim(coalesce(p_reason, '')), '')
  WHERE a.id = p_application_id
  RETURNING a.* INTO v_application;

  INSERT INTO public.application_review_audit (
    application_id,
    school_id,
    reviewer_id,
    decision,
    reason
  )
  VALUES (
    v_application.id,
    v_school_id,
    v_reviewer_id,
    v_decision,
    NULLIF(btrim(coalesce(p_reason, '')), '')
  );

  RETURN v_application;
END;
$function$;

ALTER FUNCTION public.review_school_application(uuid, text, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.review_school_application(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_school_application(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.activate_principal_school()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid;
  v_email text;
  v_email_confirmed_at timestamptz;
  v_match_count integer;
  v_application_id uuid;
  v_school_id uuid;
  v_school_status text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT u.email, u.email_confirmed_at
  INTO v_email, v_email_confirmed_at
  FROM auth.users AS u
  WHERE u.id = v_user_id;

  IF v_email IS NULL OR v_email_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'A confirmed email address is required before school activation';
  END IF;

  SELECT count(DISTINCT a.id)
  INTO v_match_count
  FROM public.school_applications AS a
  INNER JOIN public.application_review_audit AS ar
    ON ar.application_id = a.id
  WHERE lower(btrim(a.contact_email)) = lower(btrim(v_email))
    AND a.status = 'approved'
    AND lower(coalesce(a.contact_role, '')) ~ '(principal|headteacher)'
    AND ar.decision = 'approved'
    AND ar.school_id IS NOT NULL;

  IF v_match_count <> 1 THEN
    RAISE EXCEPTION 'No uniquely approved Principal or Headteacher application matches this confirmed email';
  END IF;

  SELECT a.id, ar.school_id
  INTO v_application_id, v_school_id
  FROM public.school_applications AS a
  INNER JOIN public.application_review_audit AS ar
    ON ar.application_id = a.id
  WHERE lower(btrim(a.contact_email)) = lower(btrim(v_email))
    AND a.status = 'approved'
    AND lower(coalesce(a.contact_role, '')) ~ '(principal|headteacher)'
    AND ar.decision = 'approved'
    AND ar.school_id IS NOT NULL
  FOR UPDATE OF a;

  IF v_application_id IS NULL OR v_school_id IS NULL THEN
    RAISE EXCEPTION 'Approved school application could not be linked';
  END IF;

  SELECT s.status
  INTO v_school_status
  FROM public.schools AS s
  WHERE s.id = v_school_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The approved school record could not be found';
  END IF;

  IF v_school_status = 'suspended' THEN
    RAISE EXCEPTION 'This school is suspended. Contact CRIPRI Technologies';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.school_memberships AS sm
    WHERE sm.user_id = v_user_id
      AND sm.school_id <> v_school_id
  ) THEN
    RAISE EXCEPTION 'This account is already linked to a different school';
  END IF;

  INSERT INTO public.school_memberships (school_id, user_id, role)
  VALUES (v_school_id, v_user_id, 'school_admin')
  ON CONFLICT (school_id, user_id)
  DO UPDATE SET role = EXCLUDED.role;

  UPDATE public.schools
  SET status = 'active'
  WHERE id = v_school_id
    AND status = 'pending';

  RETURN jsonb_build_object(
    'application_id', v_application_id,
    'school_id', v_school_id,
    'school_status', 'active'
  );
END;
$function$;

ALTER FUNCTION public.activate_principal_school() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.activate_principal_school() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_principal_school() TO authenticated;

COMMIT;

-- Security notes:
-- * The caller cannot supply a user_id or school_id; both are derived and verified server-side.
-- * Principal activation requires a confirmed Supabase email and exactly one approved application.
-- * School membership is restricted to the matched school and role school_admin.
-- * Existing Row Level Security remains enabled and unchanged.
-- * The frontend must use only the Supabase publishable key.