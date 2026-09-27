-- ============================================
-- Bite Me Baby — Migration 046: Channel Identity Foundation (F-14 follow-up)
-- Owner Decision: IDENTITY FOUNDATION ONLY (2026-09-27)
--   · canonical mapping: External Channel Identity → Canonical Customer
--   · NO production Facebook/Messenger integration in this round
--   · NO self-linking from client JWT (server-authoritative only)
--   · data minimization: NO tokens/secrets/message content in this table
--   · historical identities: none (no backfill — UNKNOWN = UNKNOWN)
--
-- Table: customer_channel_identities (per §14 draft — no design delta)
--   UNIQUE (channel, external_user_id)        → one identity per external ref
--   one identity → one customer at a time     → relink = explicit admin op
--   channel is part of the identity key       → FB ID ≠ Messenger ID
--
-- RLS: deny-by-default
--   anon/customer/driver      → no SELECT/INSERT/UPDATE/DELETE policies
--   admin                     → SELECT only (operational)
--   writes                    → SECURITY DEFINER admin RPCs (audited) only
--
-- RPCs (all audited via append_audit_log; actor from auth.uid()):
--   link_channel_identity(p_channel, p_external_user_id, p_customer_ref, p_display_name)
--       admin-only; duplicate → returns existing (no silent reassign)
--   unlink_channel_identity(p_id)
--       admin-only
--   resolve_channel_identity(p_channel, p_external_user_id)
--       service_role only (future verified adapters); lookup authority
--
-- Reversible: DROP TABLE / DROP FUNCTION (additive; no existing table touched).
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.customer_channel_identities (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel           text NOT NULL,
  external_user_id  text NOT NULL,
  customer_ref      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name      text,
  created_at        timestamptz NOT NULL DEFAULT NOW(),
  updated_at        timestamptz NOT NULL DEFAULT NOW()
);

-- duplicate identity guard (DB-level, concurrency-safe)
CREATE UNIQUE INDEX IF NOT EXISTS uq_cci_channel_extid
  ON public.customer_channel_identities (channel, external_user_id);

CREATE INDEX IF NOT EXISTS idx_cci_customer
  ON public.customer_channel_identities (customer_ref);

-- ===== RLS: deny-by-default =====
ALTER TABLE public.customer_channel_identities ENABLE ROW LEVEL SECURITY;

-- admin operational read only; NO anon/customer/driver policies (full deny);
-- NO INSERT/UPDATE/DELETE policies at all (writes via SECURITY DEFINER RPCs)
DROP POLICY IF EXISTS cci_admin_read ON public.customer_channel_identities;
CREATE POLICY cci_admin_read ON public.customer_channel_identities
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- harden direct table access (defense-in-depth on top of RLS)
REVOKE INSERT, UPDATE, DELETE ON public.customer_channel_identities FROM anon, authenticated;

-- ===== admin link/unlink RPCs (audited) =====
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
  -- NO SELF-LINKING: admin/operational identity management only
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
    -- collision: identity owned by ANOTHER customer — never silently reassign
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

  INSERT INTO public.customer_channel_identities
    (channel, external_user_id, customer_ref, display_name)
  VALUES
    (v_channel, v_ext, p_customer_ref, NULLIF(trim(COALESCE(p_display_name, '')), ''))
  RETURNING id INTO v_new_id;

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

CREATE OR REPLACE FUNCTION public.unlink_channel_identity(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_row   record;
BEGIN
  IF v_actor IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'ERR_ONLY_ADMIN';
  END IF;
  SELECT * INTO v_row FROM public.customer_channel_identities WHERE id = p_id;
  IF v_row IS NULL THEN
    RAISE EXCEPTION 'ERR_IDENTITY_NOT_FOUND';
  END IF;
  DELETE FROM public.customer_channel_identities WHERE id = p_id;
  PERFORM public.append_audit_log(
    p_action := 'identity_unlinked',
    p_entity_type := 'customer_channel_identity',
    p_entity_id := p_id::text,
    p_description := 'external channel identity unlinked (relink requires explicit admin link)',
    p_metadata := jsonb_build_object(
      'channel', v_row.channel, 'external_user_id', v_row.external_user_id,
      'customer_ref', v_row.customer_ref
    )
  );
  RETURN jsonb_build_object('unlinked', true, 'channel', v_row.channel, 'external_user_id', v_row.external_user_id);
END;
$function$;

-- ===== identity resolution (future verified adapters) — service_role only =====
CREATE OR REPLACE FUNCTION public.resolve_channel_identity(
  p_channel text,
  p_external_user_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_channel text := upper(NULLIF(trim(COALESCE(p_channel, '')), ''));
  v_ext     text := NULLIF(trim(COALESCE(p_external_user_id, '')), '');
  v_row     record;
BEGIN
  IF v_channel IS NULL OR v_ext IS NULL THEN
    RAISE EXCEPTION 'ERR_INVALID_IDENTITY';
  END IF;
  SELECT customer_ref, id, display_name INTO v_row
    FROM public.customer_channel_identities
   WHERE channel = v_channel AND external_user_id = v_ext
   LIMIT 1;
  IF v_row IS NULL THEN
    RETURN jsonb_build_object('linked', false, 'channel', v_channel, 'external_user_id', v_ext);
  END IF;
  RETURN jsonb_build_object(
    'linked', true, 'channel', v_channel, 'external_user_id', v_ext,
    'customer_ref', v_row.customer_ref, 'display_name', v_row.display_name
  );
END;
$function$;

-- resolve = trusted-integration authority: service_role only (no client grant)
REVOKE ALL ON FUNCTION public.resolve_channel_identity(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_channel_identity(text, text) TO service_role;

GRANT EXECUTE ON FUNCTION public.link_channel_identity(text, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unlink_channel_identity(uuid) TO authenticated;

COMMIT;


