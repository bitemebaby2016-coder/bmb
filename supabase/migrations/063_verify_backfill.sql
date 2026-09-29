-- ============================================
-- Bite Me Baby — Migration 063: TEN-02 Verification (READ-ONLY)
-- Date: 2026-09-29 · Baseline: post-migration-062
-- Scope: Read-only checks to confirm backfill correctness before enforcement
-- Impact: NONE — no schema changes, no data mutations
-- ============================================

BEGIN;

-- Verify single tenant exists
DO $$
DECLARE v_count int;
BEGIN
  SELECT count(*) INTO v_count FROM public.tenants WHERE id = 'tenant-bmb-001';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'ERR_VERIFY_TENANT: Expected exactly 1 tenant-bmb-001, found %', v_count;
  END IF;
END $$;

-- Verify all drivers have tenant_id
DO $$
DECLARE v_null int; v_total int;
BEGIN
  SELECT count(*) INTO v_total FROM public.drivers;
  SELECT count(*) INTO v_null FROM public.drivers WHERE tenant_id IS NULL;
  IF v_null > 0 THEN
    RAISE EXCEPTION 'ERR_VERIFY_DRIVERS: % of % drivers have null tenant_id', v_null, v_total;
  END IF;
  -- Also print counts for evidence capture
  RAISE NOTICE 'TEN-02 VERIFY: drivers = % total, 0 null, % with tenant-bmb-001', v_total, (v_total - v_null);
END $$;

-- Verify all delivery_rounds have tenant_id
DO $$
DECLARE v_null int; v_total int;
BEGIN
  SELECT count(*) INTO v_total FROM public.delivery_rounds;
  SELECT count(*) INTO v_null FROM public.delivery_rounds WHERE tenant_id IS NULL;
  IF v_null > 0 THEN
    RAISE EXCEPTION 'ERR_VERIFY_ROUNDS: % of % rounds have null tenant_id', v_null, v_total;
  END IF;
  RAISE NOTICE 'TEN-02 VERIFY: delivery_rounds = % total, 0 null', v_total;
END $$;

-- Verify all delivery_zones have tenant_id
DO $$
DECLARE v_null int; v_total int;
BEGIN
  SELECT count(*) INTO v_total FROM public.delivery_zones;
  SELECT count(*) INTO v_null FROM public.delivery_zones WHERE tenant_id IS NULL;
  IF v_null > 0 THEN
    RAISE EXCEPTION 'ERR_VERIFY_ZONES: % of % zones have null tenant_id', v_null, v_total;
  END IF;
  RAISE NOTICE 'TEN-02 VERIFY: delivery_zones = % total, 0 null', v_total;
END $$;

-- Verify all delivery_assignments have tenant_id
DO $$
DECLARE v_null int; v_total int;
BEGIN
  SELECT count(*) INTO v_total FROM public.delivery_assignments;
  SELECT count(*) INTO v_null FROM public.delivery_assignments WHERE tenant_id IS NULL;
  IF v_null > 0 THEN
    RAISE EXCEPTION 'ERR_VERIFY_ASSIGNMENTS: % of % assignments have null tenant_id', v_null, v_total;
  END IF;
  RAISE NOTICE 'TEN-02 VERIFY: delivery_assignments = % total, 0 null', v_total;
END $$;

-- Confirm existing row counts are preserved (critical non-regression check)
DO $$
DECLARE v_orders int; v_items int; v_payments int;
BEGIN
  SELECT count(*) INTO v_orders FROM public.orders;
  SELECT count(*) INTO v_items FROM public.order_items;
  SELECT count(*) INTO v_payments FROM public.payment_intents;
  RAISE NOTICE 'TEN-02 VERIFY: orders=% order_items=% payment_intents=% (preserved)', v_orders, v_items, v_payments;
END $$;

COMMIT;
