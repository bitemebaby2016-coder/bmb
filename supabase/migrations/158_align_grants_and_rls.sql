-- ============================================
-- Bite Me Baby Migration 158: align grants + enable RLS (ปิดแผน W-1 ส่วนที่ Owner อนุมัติ)
-- Date: 2026-10-26 · Source: e2e/w1-parity-report-2026-10-26.md (ผล fresh replay เทียบ production)
-- Owner อนุมัติ 2026-10-26: "อนุมัติทั้ง 157 (P0) + เขียน migration 158 ... แล้ว apply ด้วยกันเลย"
-- PART A — เปิด RLS ที่ 092/094 ไม่เคยสั่ง: admin_portfolio_items · products_branch_overrides
-- PART B — GRANT ที่ production มีแต่ fresh replay ไม่มี (31 ตาราง + 108 grants)
--   สร้างจากผล parity จริง · ไม่แตะ anon · **ข้าม object ที่ยังไม่ถูกสร้าง**
--   (CI ข้าม 124 ไป apply ทีหลัง → เวอร์ชันแรกของไฟล์นี้ล้มใน Contract Tests #152 ·
--    ของที่สร้างทีหลังได้สิทธิ์จาก PART C ซึ่ง mirror pg_default_acl ของ production)
-- PART C — default privileges = authenticated + service_role เท่านั้น (ไม่ใส่ anon) · idempotent
-- ============================================

BEGIN;

ALTER TABLE public.admin_portfolio_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products_branch_overrides ENABLE ROW LEVEL SECURITY;

DO $mig158tbl$
DECLARE v_skip int := 0;
BEGIN
  IF to_regclass('public.addon_groups') IS NULL THEN
    v_skip := v_skip + 1;
  ELSE
    EXECUTE format('GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.%I TO authenticated', 'addon_groups');
  END IF;
  IF to_regclass('public.addons') IS NULL THEN
    v_skip := v_skip + 1;
  ELSE
    EXECUTE format('GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.%I TO authenticated', 'addons');
  END IF;
  IF to_regclass('public.admin_portfolio_items') IS NULL THEN
    v_skip := v_skip + 1;
  ELSE
    EXECUTE format('GRANT DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.%I TO authenticated', 'admin_portfolio_items');
  END IF;
  IF to_regclass('public.ai_customer_memory') IS NULL THEN
    v_skip := v_skip + 1;
  ELSE
    EXECUTE format('GRANT DELETE, INSERT, SELECT, UPDATE ON public.%I TO authenticated', 'ai_customer_memory');
  END IF;
  IF to_regclass('public.audit_logs') IS NULL THEN
    v_skip := v_skip + 1;
  ELSE
    EXECUTE format('GRANT DELETE, INSERT, UPDATE ON public.%I TO authenticated', 'audit_logs');
  END IF;
  IF to_regclass('public.branches') IS NULL THEN
    v_skip := v_skip + 1;
  ELSE
    EXECUTE format('GRANT DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.%I TO authenticated', 'branches');
  END IF;
  IF to_regclass('public.brands') IS NULL THEN
    v_skip := v_skip + 1;
  ELSE
    EXECUTE format('GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.%I TO authenticated', 'brands');
  END IF;
  IF to_regclass('public.business_settings') IS NULL THEN
    v_skip := v_skip + 1;
  ELSE
    EXECUTE format('GRANT DELETE, INSERT, UPDATE ON public.%I TO authenticated', 'business_settings');
  END IF;
  IF to_regclass('public.content_approvals') IS NULL THEN
    v_skip := v_skip + 1;
  ELSE
    EXECUTE format('GRANT DELETE, INSERT, UPDATE ON public.%I TO authenticated', 'content_approvals');
  END IF;
  IF to_regclass('public.customer_channel_identities') IS NULL THEN
    v_skip := v_skip + 1;
  ELSE
    EXECUTE format('GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.%I TO authenticated', 'customer_channel_identities');
  END IF;
  IF to_regclass('public.customer_intelligence') IS NULL THEN
    v_skip := v_skip + 1;
  ELSE
    EXECUTE format('GRANT DELETE, INSERT, UPDATE ON public.%I TO authenticated', 'customer_intelligence');
  END IF;
  IF to_regclass('public.daily_closings') IS NULL THEN
    v_skip := v_skip + 1;
  ELSE
    EXECUTE format('GRANT REFERENCES, TRIGGER, TRUNCATE ON public.%I TO authenticated', 'daily_closings');
  END IF;
  IF to_regclass('public.delivery_zones') IS NULL THEN
    v_skip := v_skip + 1;
  ELSE
    EXECUTE format('GRANT DELETE, INSERT, UPDATE ON public.%I TO authenticated', 'delivery_zones');
  END IF;
  IF to_regclass('public.dispatch_offer_declines') IS NULL THEN
    v_skip := v_skip + 1;
  ELSE
    EXECUTE format('GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.%I TO authenticated', 'dispatch_offer_declines');
  END IF;
  IF to_regclass('public.dispatch_offers') IS NULL THEN
    v_skip := v_skip + 1;
  ELSE
    EXECUTE format('GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.%I TO authenticated', 'dispatch_offers');
  END IF;
  IF to_regclass('public.driver_location_history') IS NULL THEN
    v_skip := v_skip + 1;
  ELSE
    EXECUTE format('GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.%I TO authenticated', 'driver_location_history');
  END IF;
  IF to_regclass('public.marketing_posts') IS NULL THEN
    v_skip := v_skip + 1;
  ELSE
    EXECUTE format('GRANT REFERENCES, TRIGGER, TRUNCATE ON public.%I TO authenticated', 'marketing_posts');
  END IF;
  IF to_regclass('public.marketing_rules') IS NULL THEN
    v_skip := v_skip + 1;
  ELSE
    EXECUTE format('GRANT REFERENCES, TRIGGER, TRUNCATE ON public.%I TO authenticated', 'marketing_rules');
  END IF;
  IF to_regclass('public.menu_schedule') IS NULL THEN
    v_skip := v_skip + 1;
  ELSE
    EXECUTE format('GRANT DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.%I TO authenticated', 'menu_schedule');
  END IF;
  IF to_regclass('public.menu_sections') IS NULL THEN
    v_skip := v_skip + 1;
  ELSE
    EXECUTE format('GRANT DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.%I TO authenticated', 'menu_sections');
  END IF;
  IF to_regclass('public.notification_prefs') IS NULL THEN
    v_skip := v_skip + 1;
  ELSE
    EXECUTE format('GRANT DELETE, INSERT, SELECT, UPDATE ON public.%I TO authenticated', 'notification_prefs');
  END IF;
  IF to_regclass('public.order_status_history') IS NULL THEN
    v_skip := v_skip + 1;
  ELSE
    EXECUTE format('GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.%I TO authenticated', 'order_status_history');
  END IF;
  IF to_regclass('public.print_jobs') IS NULL THEN
    v_skip := v_skip + 1;
  ELSE
    EXECUTE format('GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.%I TO authenticated', 'print_jobs');
  END IF;
  IF to_regclass('public.product_addon_groups') IS NULL THEN
    v_skip := v_skip + 1;
  ELSE
    EXECUTE format('GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.%I TO authenticated', 'product_addon_groups');
  END IF;
  IF to_regclass('public.products_branch_overrides') IS NULL THEN
    v_skip := v_skip + 1;
  ELSE
    EXECUTE format('GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.%I TO authenticated', 'products_branch_overrides');
  END IF;
  IF to_regclass('public.promotion_products') IS NULL THEN
    v_skip := v_skip + 1;
  ELSE
    EXECUTE format('GRANT REFERENCES, TRIGGER, TRUNCATE ON public.%I TO authenticated', 'promotion_products');
  END IF;
  IF to_regclass('public.provider_orders') IS NULL THEN
    v_skip := v_skip + 1;
  ELSE
    EXECUTE format('GRANT DELETE, INSERT, SELECT, UPDATE ON public.%I TO authenticated', 'provider_orders');
  END IF;
  IF to_regclass('public.push_subscriptions') IS NULL THEN
    v_skip := v_skip + 1;
  ELSE
    EXECUTE format('GRANT DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.%I TO authenticated', 'push_subscriptions');
  END IF;
  IF to_regclass('public.shifts') IS NULL THEN
    v_skip := v_skip + 1;
  ELSE
    EXECUTE format('GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.%I TO authenticated', 'shifts');
  END IF;
  IF to_regclass('public.system_errors') IS NULL THEN
    v_skip := v_skip + 1;
  ELSE
    EXECUTE format('GRANT DELETE, INSERT, UPDATE ON public.%I TO authenticated', 'system_errors');
  END IF;
  IF to_regclass('public.tenants') IS NULL THEN
    v_skip := v_skip + 1;
  ELSE
    EXECUTE format('GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.%I TO authenticated', 'tenants');
  END IF;
  RAISE NOTICE '158 tables: granted=%, skipped=%', 31 - v_skip, v_skip;
END $mig158tbl$;

DO $mig158fn$
DECLARE sig text; v_qual text; v_name text; v_args text;
        v_svc int := 0; v_auth int := 0; v_skip int := 0;
BEGIN
  -- NOTE: to_regprocedure() ใช้ไม่ได้กับรายการนี้ เพราะ pg_get_function_identity_arguments
  -- คืน "ชื่อ parameter + ชนิด" ซึ่ง regprocedure input ไม่รองรับ (พิสูจน์แล้ว = syntax error)
  -- → ตรวจการมีอยู่จริงด้วย pg_proc + identity args (ตัวเดียวกับที่ใช้ generate) แล้วค่อย GRANT
  FOREACH sig IN ARRAY ARRAY['public.admin_cancel_assignment(p_order_number text, p_reason text)', 'public.admin_delete_job(p_id text)', 'public.admin_list_jobs(p_status text)', 'public.affiliate_intent_hook()', 'public.affiliate_order_hook()', 'public.append_audit_log(p_action text, p_entity_type text, p_entity_id text, p_description text, p_metadata jsonb, p_user_email text)', 'public.assign_driver(p_order_number text, p_driver_id text)', 'public.cancel_dispatch_offer(p_order_number text, p_reason text)', 'public.cancel_order(p_order_number text, p_reason text)', 'public.cancel_pre_order(p_order_number text)', 'public.claim_dispatch_offer(p_order_number text)', 'public.close_day(p_date date)', 'public.close_shift(p_shift_id text, p_counted_cash numeric, p_notes text)', 'public.confirm_offline_payment(p_order_number text)', 'public.create_notification(p_title text, p_message text, p_category text, p_customer_id text)', 'public.create_order_with_items(p_items jsonb, p_delivery_round_id text, p_delivery_method text, p_delivery_address text, p_dropoff_latitude numeric, p_dropoff_longitude numeric, p_customer_name text, p_customer_phone text, p_payment_method text, p_special_instructions text, p_promotion_code text, p_distance_km numeric, p_order_mode text, p_scheduled_date date, p_branch_id text, p_source_channel text, p_external_ref_id text, p_customer_ref uuid)', 'public.create_order_with_items_i(p_items jsonb, p_delivery_round_id text, p_delivery_method text, p_delivery_address text, p_dropoff_latitude numeric, p_dropoff_longitude numeric, p_customer_name text, p_customer_phone text, p_payment_method text, p_special_instructions text, p_promotion_code text, p_distance_km numeric, p_order_mode text, p_scheduled_date date, p_branch_id text, p_source_channel text, p_external_ref_id text, p_customer_ref uuid, p_client_submit_key text)', 'public.create_payment_intent_record(p_order_number text, p_amount numeric, p_method payment_method, p_provider text, p_metadata jsonb)', 'public.create_pre_order_with_items(p_product_id text, p_quantity integer, p_delivery_round_id text, p_scheduled_date date, p_customer_name text, p_customer_phone text, p_delivery_latitude numeric, p_delivery_longitude numeric, p_delivery_address text, p_special_instructions text)', 'public.create_production_batch(p_delivery_round_id text, p_scheduled_date date, p_order_mode text)', 'public.deduct_inventory_for_order(p_order_number text)', 'public.dispatch_order(p_order_number text)', 'public.driver_accept_assignment(p_order_number text, p_driver_phone text)', 'public.driver_attach_pod(p_order_number text, p_object_path text, p_latitude numeric, p_longitude numeric)', 'public.driver_decline_assignment(p_order_number text, p_reason text)', 'public.driver_decline_offer(p_order_number text)', 'public.driver_login(p_display_name text)', 'public.driver_update_delivery_status(p_order_number text, p_driver_phone text, p_status text, p_latitude numeric, p_longitude numeric)', 'public.driver_update_location(p_latitude numeric, p_longitude numeric, p_order_number text)', 'public.drivers_promote_rider()', 'public.enforce_menu_gate()', 'public.enforce_operating_hours()', 'public.enforce_pre_order_cancel_window()', 'public.enforce_pre_order_window()', 'public.ensure_rounds_for_date(p_date date)', 'public.gen_pickup_code()', 'public.get_ai_memory()', 'public.get_daily_sales(p_date date)', 'public.get_inventory_requirements(p_product_id text, p_quantity integer)', 'public.get_kitchen_summary(p_date date)', 'public.get_menu_for_date(p_scheduled_date date)', 'public.is_admin()', 'public.is_auditor()', 'public.is_branch_admin(p_branch_id text)', 'public.is_developer()', 'public.is_finance()', 'public.is_inventory()', 'public.is_kitchen()', 'public.is_marketing()', 'public.is_owner()', 'public.is_platform_admin()', 'public.is_pos()', 'public.is_rider()', 'public.is_support()', 'public.kitchen_queue(p_delivery_round_id text, p_scheduled_date date)', 'public.link_driver_user(p_driver_id text, p_user_id uuid)', 'public.list_drivers()', 'public.list_recipes_with_inventory(p_product_id text)', 'public.list_system_errors(p_limit integer)', 'public.loyalty_my_history(p_limit integer)', 'public.loyalty_my_status()', 'public.loyalty_order_hook()', 'public.loyalty_payment_intent_hook()', 'public.marketing_save_rules(p_rules jsonb)', 'public.marketing_schedule_post(p_post_id text, p_when timestamp with time zone)', 'public.my_deliveries(p_driver_phone text)', 'public.open_shift(p_opening_cash numeric, p_branch_id text)', 'public.order_ready_to_make(p_order_number text)', 'public.points_ledger_guard()', 'public.pos_closeout_order(p_order_number text, p_mark_paid boolean)', 'public.promote_to_full_admin(p_email text)', 'public.publish_menu_schedule(p_scheduled_date date, p_publish boolean)', 'public.quote_pre_order(p_product_id text, p_quantity integer)', 'public.record_system_error(p_message text, p_source text, p_level text, p_details jsonb)', 'public.referral_my_code()', 'public.referral_my_status()', 'public.referral_order_status_hook()', 'public.referral_preview(p_code text)', 'public.register_push_subscription(p_endpoint text, p_p256dh text, p_auth_secret text, p_user_agent text, p_audience text)', 'public.resolve_home_branch_id()', 'public.restore_inventory_for_order(p_order_number text)', 'public.review_content(p_approval_id text, p_decision text, p_note text)', 'public.save_ai_memory(p_memory jsonb)', 'public.set_menu_schedule(p_scheduled_date date, p_items jsonb)', 'public.set_notification_pref(p_channel text, p_enabled boolean)', 'public.set_user_role(p_user_id uuid, p_role text)', 'public.submit_content_for_approval(p_content_type text, p_title text, p_body text, p_image_url text, p_mascot text)', 'public.submit_offline_payment_reference(p_order_number text, p_reference text)', 'public.submit_payment_slip(p_order_number text, p_slip_path text)', 'public.tenant_create_admin(p_name text, p_slug text)', 'public.tenant_get_admin(p_tenant_id text)', 'public.tenant_list_admin()', 'public.tenant_set_default_brand(p_tenant_id text, p_brand_id text)', 'public.tenant_set_status(p_tenant_id text, p_status text)', 'public.tenant_update_admin(p_tenant_id text, p_name text, p_slug text, p_status text)', 'public.track_order(p_order_number text, p_phone text)', 'public.transition_order_status(p_order_number text, p_new_status order_status)', 'public.unregister_push_subscription(p_subscription_id text, p_endpoint text)', 'public.upsert_driver(p_name text, p_phone text, p_vehicle_label text)', 'public.upsert_mascot_override(p_role_name text, p_media_url text, p_alt text)'] LOOP
    v_qual := split_part(sig, '(', 1);
    v_name := split_part(v_qual, '.', 2);
    v_args := substr(sig, position('(' IN sig) + 1, length(sig) - position('(' IN sig) - 1);
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = v_name
        AND pg_get_function_identity_arguments(p.oid) = v_args
    ) THEN
      v_skip := v_skip + 1;
      CONTINUE;
    END IF;
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', sig);
    v_svc := v_svc + 1;
  END LOOP;
  FOREACH sig IN ARRAY ARRAY['public.affiliate_intent_hook()', 'public.affiliate_order_hook()', 'public.drivers_promote_rider()', 'public.loyalty_order_hook()', 'public.loyalty_payment_intent_hook()', 'public.points_ledger_guard()', 'public.resolve_channel_identity(p_channel text, p_external_user_id text)', 'public.resolve_home_branch_id()'] LOOP
    v_qual := split_part(sig, '(', 1);
    v_name := split_part(v_qual, '.', 2);
    v_args := substr(sig, position('(' IN sig) + 1, length(sig) - position('(' IN sig) - 1);
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = v_name
        AND pg_get_function_identity_arguments(p.oid) = v_args
    ) THEN
      v_skip := v_skip + 1;
      CONTINUE;
    END IF;
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', sig);
    v_auth := v_auth + 1;
  END LOOP;
  RAISE NOTICE '158 functions: service_role=%, authenticated=%, skipped=%', v_svc, v_auth, v_skip;
END $mig158fn$;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated, service_role;

DO $mig158chk$
DECLARE r record; bad int := 0;
BEGIN
  FOR r IN SELECT t FROM (VALUES ('addon_groups'), ('addons'), ('admin_portfolio_items'), ('ai_customer_memory'), ('audit_logs'), ('branches'), ('brands'), ('business_settings'), ('content_approvals'), ('customer_channel_identities'), ('customer_intelligence'), ('daily_closings'), ('delivery_zones'), ('dispatch_offer_declines'), ('dispatch_offers'), ('driver_location_history'), ('marketing_posts'), ('marketing_rules'), ('menu_schedule'), ('menu_sections'), ('notification_prefs'), ('order_status_history'), ('print_jobs'), ('product_addon_groups'), ('products_branch_overrides'), ('promotion_products'), ('provider_orders'), ('push_subscriptions'), ('shifts'), ('system_errors'), ('tenants')) AS v(t) LOOP
    IF to_regclass('public.' || r.t) IS NULL THEN CONTINUE; END IF;
    IF NOT has_table_privilege('authenticated', 'public.' || r.t, 'SELECT') THEN bad := bad + 1; END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                 WHERE n.nspname='public' AND c.relname='admin_portfolio_items' AND c.relrowsecurity) THEN
    RAISE EXCEPTION '158 INCOMPLETE: admin_portfolio_items RLS not enabled';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                 WHERE n.nspname='public' AND c.relname='products_branch_overrides' AND c.relrowsecurity) THEN
    RAISE EXCEPTION '158 INCOMPLETE: products_branch_overrides RLS not enabled';
  END IF;
  IF bad <> 0 THEN RAISE EXCEPTION '158 INCOMPLETE: authenticated missing SELECT on % table(s)', bad; END IF;
  RAISE NOTICE '158 OK: RLS on 2 tables + grants aligned (tables=31, functions=108)';
END $mig158chk$;

COMMIT;
