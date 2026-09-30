-- ============================================
-- Bite Me Baby -- Production Seed: Day-1 Launch Data
-- Date: 2026-09-30 - Baseline: M081-M094 deployed
-- Scope: Active Branches, Delivery Rounds, Delivery Zones for opening day
-- Usage: Run ONCE on fresh Supabase project to bootstrap operations
-- Owner Decision: Use single branch (BKK-Central) for soft launch
-- ============================================

BEGIN;

-- SECTION 1: Branches (TEN-07)
INSERT INTO public.branches (id, tenant_id, name, slug, address, phone, kitchen_latitude, kitchen_longitude, status, is_active, sort_order)
VALUES
  ('branch-bkk-central', 'tenant-bmb-001', 'BMB Central (สาขาหลัก)', 'bkk-central',
   '123 Silom Road, Bang Rak, Bangkok 10500', '02-xxx-xxxx', 13.7273, 100.5340, 'active', true, 1),
  ('branch-bkk-south', 'tenant-bmb-001', 'BMB South (สาขาย่อย)', 'bkk-south',
   '456 Rama IV Road, Pathumwan, Bangkok 10330', '02-xxx-xxxx', 13.7367, 100.5232, 'active', false, 2)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.branches IS 'TEN-07: Multi-branch operational units';

-- SECTION 2: Delivery Rounds - Tomorrow schedule for BKK Central
DO $$
DECLARE
  v_tomorrows_date text := (CURRENT_DATE + INTERVAL '1 day')::text;
  v_round_id text;
BEGIN
  v_round_id := 'round-' || replace(v_tomorrows_date, '-', '') || '-morning';
  IF NOT EXISTS (SELECT 1 FROM public.delivery_rounds WHERE id = v_round_id) THEN
    INSERT INTO public.delivery_rounds (id, round_key, display_name, cutoff_time, delivery_start, delivery_end, max_capacity, current_count, date, scheduled_date, name, status, branch_id)
    VALUES (v_round_id, 'morning', 'เช้า (06:00-09:00)', '08:00', '06:00', '09:00', 60, 0, v_tomorrows_date, v_tomorrows_date, 'morning', 'active', 'branch-bkk-central');
  END IF;

  v_round_id := 'round-' || replace(v_tomorrows_date, '-', '') || '-midday';
  IF NOT EXISTS (SELECT 1 FROM public.delivery_rounds WHERE id = v_round_id) THEN
    INSERT INTO public.delivery_rounds (id, round_key, display_name, cutoff_time, delivery_start, delivery_end, max_capacity, current_count, date, scheduled_date, name, status, branch_id)
    VALUES (v_round_id, 'midday', 'เที่ยง (11:00-14:00)', '10:30', '11:00', '14:00', 80, 0, v_tomorrows_date, v_tomorrows_date, 'midday', 'active', 'branch-bkk-central');
  END IF;

  v_round_id := 'round-' || replace(v_tomorrows_date, '-', '') || '-evening';
  IF NOT EXISTS (SELECT 1 FROM public.delivery_rounds WHERE id = v_round_id) THEN
    INSERT INTO public.delivery_rounds (id, round_key, display_name, cutoff_time, delivery_start, delivery_end, max_capacity, current_count, date, scheduled_date, name, status, branch_id)
    VALUES (v_round_id, 'evening', 'เยน (17:00-20:00)', '16:00', '17:00', '20:00', 100, 0, v_tomorrows_date, v_tomorrows_date, 'evening', 'active', 'branch-bkk-central');
  END IF;

  RAISE NOTICE 'Seeded 3 delivery rounds for % at branch-bkk-central', v_tomorrows_date;
END $$;

-- SECTION 3: Delivery Zones - BKK Central coverage areas
INSERT INTO public.delivery_zones (id, branch_id, name, min_order, delivery_fee, estimated_minutes, latitude, longitude, radius_km, status, is_default)
VALUES
  ('zone-central-srilom', 'branch-bkk-central', 'Sri Salaem / Silom (0-3km)', 50.00, 35.00, 30, 13.7273, 100.5340, 3.0, 'active', true),
  ('zone-central-pathumwan', 'branch-bkk-central', 'Pathumwan / Ratchaprarop (3-6km)', 50.00, 55.00, 45, 13.7367, 100.5232, 6.0, 'active', false),
  ('zone-central-thonglor', 'branch-bkk-central', 'Thonglor / Ekamai (6-10km)', 80.00, 85.00, 60, 13.7338, 100.5828, 10.0, 'active', false)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.delivery_zones IS 'M083: Branch-level delivery zone definitions';

-- SECTION 4: Business Settings - Default for BKK Central
INSERT INTO public.business_settings (id, tenant_id, brand_id, branch_id, key_name, key_value, updated_at)
VALUES
  ('setting-bkk-hours-start', 'tenant-bmb-001', 'brand-bmb-main', 'branch-bkk-central', 'operating_hours_start', '06:00', NOW()),
  ('setting-bkk-hours-end', 'tenant-bmb-001', 'brand-bmb-main', 'branch-bkk-central', 'operating_hours_end', '22:00', NOW()),
  ('setting-bkk-prep-min', 'tenant-bmb-001', 'brand-bmb-main', 'branch-bkk-central', 'kitchen_prep_buffer_min', '15', NOW()),
  ('setting-bkk-max-orders', 'tenant-bmb-001', 'brand-bmb-main', 'branch-bkk-central', 'max_orders_per_round', '200', NOW())
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.business_settings IS 'M086: Branch-specific business settings';

-- SECTION 5: Verification Checks
DO $$ DECLARE v_bc int; v_rc int; v_zc int; BEGIN
  SELECT count(*) INTO v_bc FROM public.branches WHERE tenant_id = 'tenant-bmb-001' AND status = 'active';
  SELECT count(*) INTO v_rc FROM public.delivery_rounds WHERE status = 'active' AND branch_id = 'branch-bkk-central';
  SELECT count(*) INTO v_zc FROM public.delivery_zones WHERE branch_id = 'branch-bkk-central' AND status = 'active';
  IF v_bc < 1 THEN
    RAISE EXCEPTION 'ERR_SEED: Expected >=1 active branches for tenant-bmb-001, found %', v_bc;
  END IF;
  IF v_rc < 3 THEN
    RAISE EXCEPTION 'ERR_SEED: Expected >=3 active rounds for branch-bkk-central, found %', v_rc;
  END IF;
  IF v_zc < 1 THEN
    RAISE EXCEPTION 'ERR_SEED: Expected >=1 active zones for branch-bkk-central, found %', v_zc;
  END IF;
  RAISE NOTICE 'Validation passed: % branches, % rounds, % zones', v_bc, v_rc, v_zc;
END $$;

COMMIT;
