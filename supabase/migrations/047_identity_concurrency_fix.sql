-- ============================================
-- Bite Me Baby — Migration 047: link_channel_identity concurrency fix
-- Bug (found by production concurrent probe): parallel link of the same
-- (channel, external_user_id) — both pre-checks pass, second INSERT hits
-- raw unique_violation (HTTP 400). Fix: catch unique_violation on INSERT,
-- re-select the winner row and report collision (audited).
-- ============================================

BEGIN;

CREATE OR REPLACE FUNCTION public.link_channel_identity(
  p_channel          text,
  p_external_user_id text,
  p_customer_ref     uuid,
  p_display_name     text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_actor   uuid := auth.uid();
  v_channel text;
  v_ext     text;
  v_existing record;
  v_new_id  uuid;
BEGIN
  IF v_actor IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'ERR_ONLY_ADMIN';
  END IF;

  v_channel := upper(NULLIF(trim(COALESCE(p_channel, '')), ''));
  IF v_channel IS NULL OR v_channel !~ '^[A-Z][A-Z0-9_]{2,31}$' THEN
    RAISE EXCEPTION 'ERR_INVALID_CHANNEL';
  END IF;
  v_ext := NULLIF(trim(COALESCE(p_external_user_id, '')), '');
  IF v_ext IS NULL OR length(v_ext) > 128 THEN
    RAISE EXCEPTION 'ERR_INVALID_EXTERNAL_USER_ID';
  END IF;
  IF p_customer_ref IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_customer_ref) THEN
    RAISE EXCEPTION 'ERR_CUSTOMER_NOT_FOUND';
  END IF;

  -- duplicate identity (same channel + same external_user_id) → ONE identity
  SELECT * INTO v_existing FROM public.customer_channel_identities
   WHERE channel = v_channel AND external_user_id = v_ext LIMIT 1;
  IF v_existing IS NOT NULL THEN
    IF v_existing.customer_ref = p_customer_ref THEN
      PERFORM public.append_audit_log(
        p_action := 'identity_link_duplicate',
        p_entity_type := 'customer_channel_identity',
        p_entity_id := v_existing.id::text,
        p_description := 'duplicate identity link (same customer) — no-op',
        p_metadata := jsonb_build_object('channel', v_channel, 'external_user_id', v_ext)
      );
      RETURN jsonb_build_object(
        'id', v_existing.id, 'channel', v_channel, 'external_user_id', v_ext,
        'customer_ref', v_existing.customer_ref, 'duplicate', true
      );
    END IF;
    PERFORM public.append_audit_log(
      p_action := 'identity_link_rejected',
      p_entity_type := 'customer_channel_identity',
      p_entity_id := v_existing.id::text,
      p_description := 'identity collision — external identity already owned by another customer',
      p_metadata := jsonb_build_object(
        'channel', v_channel, 'external_user_id', v_ext,
        'existing_customer', v_existing.customer_ref, 'requested_customer', p_customer_ref
      )
    );
    RETURN jsonb_build_object(
      'id', v_existing.id, 'channel', v_channel, 'external_user_id', v_ext,
      'customer_ref', v_existing.customer_ref, 'duplicate', false, 'collision', true
    );
  END IF;

  BEGIN
    INSERT INTO public.customer_channel_identities
      (channel, external_user_id, customer_ref, display_name)
    VALUES
      (v_channel, v_ext, p_customer_ref, NULLIF(trim(COALESCE(p_display_name, '')), ''))
    RETURNING id INTO v_new_id;
  EXCEPTION
    WHEN unique_violation THEN
      -- concurrent race: DB constraint is the authority (no application lock)
      SELECT * INTO v_existing FROM public.customer_channel_identities
       WHERE channel = v_channel AND external_user_id = v_ext LIMIT 1;
      PERFORM public.append_audit_log(
        p_action := 'identity_link_rejected',
        p_entity_type := 'customer_channel_identity',
        p_entity_id := v_existing.id::text,
        p_description := 'identity collision (concurrent) — resolved by DB unique constraint',
        p_metadata := jsonb_build_object(
          'channel', v_channel, 'external_user_id', v_ext,
          'existing_customer', v_existing.customer_ref, 'requested_customer', p_customer_ref
        )
      );
      RETURN jsonb_build_object(
        'id', v_existing.id, 'channel', v_channel, 'external_user_id', v_ext,
        'customer_ref', v_existing.customer_ref, 'duplicate', false, 'collision', true
      );
  END;

  PERFORM public.append_audit_log(
    p_action := 'identity_linked',
    p_entity_type := 'customer_channel_identity',
    p_entity_id := v_new_id::text,
    p_description := 'external channel identity linked to canonical customer',
    p_metadata := jsonb_build_object(
      'channel', v_channel, 'external_user_id', v_ext, 'customer_ref', p_customer_ref
    )
  );

  RETURN jsonb_build_object(
    'id', v_new_id, 'channel', v_channel, 'external_user_id', v_ext,
    'customer_ref', p_customer_ref, 'duplicate', false, 'collision', false
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.link_channel_identity(text, text, uuid, text) TO authenticated;

COMMIT;
