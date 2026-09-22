-- ============================================
-- Bite Me Baby — Migration 031: production ACL drift repair (PHASE 3B · WAVE 2 addendum)
-- Date: 2026-09-22 · Baseline: f4b4211 · Found by: post-push contracts_029 G2 FAIL
--   + anon REST probe (anon executed ensure_rounds_for_date on production)
--
-- Root cause (production-only drift):
--   The manual-apply era (SQL Editor as `postgres`) left ALTER DEFAULT PRIVILEGES
--   in schema public that auto-grant EXECUTE on FUNCTIONS to anon (and wide table
--   grants). Functions created AFTER that (023–025 lineage) inherited anon EXECUTE
--   on production; migration 028's `REVOKE ... FROM PUBLIC` does not remove the
--   explicit per-role anon entry. Local (fresh db reset) never had those defaults
--   → local is the canonical reference: 49 anon-callable functions, vs 82 on
--   production (33 drifted).
--
-- Change (exactly TWO things):
--   1. Remove the drifted DEFAULT PRIVILEGES for role `postgres` in schema public
--      (anon entries for FUNCTIONS/TABLES/SEQUENCES) → future objects get NO
--      implicit anon grants; every migration grants explicitly (canonical
--      pattern; converges production toward local for future objects).
--   2. REVOKE EXECUTE FROM anon on the 33 drifted functions (the exact set where
--      production allows anon but local denies). Existing canonical anon grants
--      (the 49 that both allow) are untouched; authenticated/service_role grants
--      are untouched; RLS is untouched.
--
-- NOT changed (per Phase 3B gate):
--   authenticated / service_role EXECUTE grants · RLS policies · table ACLs
--   (table exposure is RLS-governed — a full table-ACL pass remains the F-3
--   follow-up) · supabase_admin defaults (platform-owned role; unused by our
--   migration pipeline).
--
-- Idempotent: safe to re-run (REVOKEs are idempotent).
-- Rollback: re-run the drifted ALTER DEFAULT PRIVILEGES + re-GRANT EXECUTE to
--   anon (not desired — this restores an anonymous write path).
-- ============================================

BEGIN;

-- 1. stop the drift at its source (future objects: no implicit anon grants)
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;

-- 2. revoke anon EXECUTE on the drifted functions.
--    REVOKE has no IF EXISTS in Postgres and the drifted set differs between
--    environments (some exist only on production), so each REVOKE runs through
--    a DO block that tolerates undefined_function (SQLSTATE 42883/42P01).
--    Signature strings are pg_get_function_identity_arguments output — exact.
DO $$
DECLARE
  sigs text[] := ARRAY[
    'append_audit_log(p_action text, p_entity_type text, p_entity_id text, p_description text, p_metadata jsonb, p_user_email text)',
    'assign_driver(p_order_number text, p_driver_id text)',
    'auto_approve_order()',
    'calculate_loyalty_points(p_order_total numeric)',
    'cancel_order(p_order_number text, p_reason text)',
    'cancel_pre_order(p_order_number text)',
    'check_product_availability(p_product_id uuid)',
    'compute_delivery_fee_rpc(p_dropoff_latitude numeric, p_dropoff_longitude numeric, p_delivery_method text, p_items_count integer, p_distance_km numeric)',
    'create_notification(p_title text, p_message text, p_category text, p_customer_id text)',
    'create_order_with_items(p_items jsonb, p_delivery_round_id text, p_delivery_method text, p_delivery_address text, p_dropoff_latitude numeric, p_dropoff_longitude numeric, p_customer_name text, p_customer_phone text, p_payment_method text, p_special_instructions text, p_promotion_code text, p_distance_km numeric, p_order_mode text, p_scheduled_date date)',
    'create_pre_order_with_items(p_product_id text, p_quantity integer, p_delivery_round_id text, p_scheduled_date date, p_customer_name text, p_customer_phone text, p_delivery_latitude numeric, p_delivery_longitude numeric, p_delivery_address text, p_special_instructions text)',
    'create_production_batch(p_delivery_round_id text, p_scheduled_date date, p_order_mode text)',
    'deduct_inventory_for_order(p_order_number text)',
    'driver_accept_assignment(p_order_number text, p_driver_phone text)',
    'driver_login(p_phone text, p_name text)',
    'driver_update_delivery_status(p_order_number text, p_driver_phone text, p_status text, p_latitude numeric, p_longitude numeric)',
    'ensure_rounds_for_date(p_date date)',
    'get_ai_memory()',
    'get_inventory_requirements(p_product_id text, p_quantity integer)',
    'kitchen_queue(p_delivery_round_id text, p_scheduled_date date)',
    'list_system_errors(p_limit integer)',
    'my_deliveries(p_driver_phone text)',
    'quote_pre_order(p_product_id text, p_quantity integer)',
    'record_system_error(p_message text, p_source text, p_level text, p_details jsonb)',
    'restore_inventory_for_order(p_order_number text)',
    'review_content(p_approval_id text, p_decision text, p_note text)',
    'save_ai_memory(p_memory jsonb)',
    'set_notification_pref(p_channel text, p_enabled boolean)',
    'submit_content_for_approval(p_content_type text, p_title text, p_body text)',
    'update_order_status()',
    'upsert_driver(p_name text, p_phone text, p_vehicle_label text)',
    'upsert_mascot_override(p_role_name text, p_media_url text, p_alt text)',
    'validate_order_before_submit()'
  ];
  s text;
BEGIN
  FOREACH s IN ARRAY sigs LOOP
    BEGIN
      EXECUTE 'REVOKE EXECUTE ON FUNCTION public.' || s || ' FROM anon';
    EXCEPTION WHEN undefined_function OR undefined_object THEN
      NULL; -- function absent on this environment: nothing to revoke
    END;
  END LOOP;
END
$$;

COMMIT;

-- ============================================
-- END OF MIGRATION 031
-- ============================================