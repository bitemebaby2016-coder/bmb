-- ============================================
-- Bite Me Baby — PHASE 0 TRUTH LOCK (OWNER: run in Supabase SQL Editor)
-- READ-ONLY ONLY. Paste & run. Output is evidence for SEC-01 + migration chain.
-- ============================================

-- (1) orders RLS policies (S-3): anon must NOT be able to read orders.
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename IN ('orders', 'pre_orders', 'payment_intents', 'customers', 'ai_conversations', 'products')
ORDER BY tablename, cmd;

-- (2) Migration chain markers: every table that each migration must have created.
SELECT to_regclass('public.orders')            IS NOT NULL AS m001_orders,
       to_regclass('public.pre_orders')        IS NOT NULL AS m001_pre_orders,
       to_regclass('public.payment_intents')   IS NOT NULL AS m008_payment_intents,
       to_regclass('public.delivery_zones')    IS NOT NULL AS m008_delivery_zones,
       to_regclass('public.provider_orders')   IS NOT NULL AS m008_provider_orders,
       to_regclass('public.media_assets')      IS NOT NULL AS m008_media_assets,
       to_regclass('public.business_settings') IS NOT NULL AS m008_business_settings,
       to_regclass('public.inventory')         IS NOT NULL AS m006_inventory,
       to_regclass('public.inventory_transactions') IS NOT NULL AS m006_inventory_tx;

-- (3) 015 / 016 column markers.
SELECT count(*) FILTER (WHERE column_name = 'default_latitude') = 1 AS m015_customer_lat,
       count(*) FILTER (WHERE column_name = 'addons') = 1 AS m016_products_addons,
       count(*) FILTER (WHERE column_name = 'is_banner') = 1 AS m016_promotions_banner
FROM information_schema.columns
WHERE table_schema = 'public'
  AND ( (table_name = 'customers'  AND column_name = 'default_latitude')
     OR (table_name = 'products'   AND column_name = 'addons')
     OR (table_name = 'promotions' AND column_name = 'is_banner') );

-- (4) RPC/trigger presence (007/008/016).
SELECT p.proname,
       CASE WHEN p.proname IN ('create_order_with_items','transition_order_status',
                               'create_payment_intent_record','confirm_offline_payment',
                               'submit_offline_payment_reference','mark_payment_failed',
                               'record_payment_result','compute_addons_price') THEN 'OK' END AS check_ok
FROM pg_proc p
WHERE p.proname IN ('create_order_with_items','transition_order_status',
                    'create_payment_intent_record','confirm_offline_payment',
                    'submit_offline_payment_reference','mark_payment_failed',
                    'record_payment_result','compute_addons_price')
ORDER BY p.proname;

SELECT tgname, tgrelid::regclass AS on_table
FROM pg_trigger
WHERE tgname = 'orders_guard_status_transition';

-- ============================================
-- END — record output JSON into e2e/truth-lock-sql-result.json (owner action)
-- ============================================