-- ============================================
-- Bite Me Baby -- Production Seed: Day-1 Launch Data
-- Date: 2026-09-30 -- Baseline: M081-M094 deployed
-- Scope: Active Branches, Delivery Rounds, Delivery Zones for opening day
-- Usage: Run ONCE on fresh Supabase project to bootstrap operations
-- Owner Decision: Use single branch (BKK-Central) for soft launch
-- ============================================

BEGIN;

-- =====================================================
-- SECTION 1: Branches (TEN-07)
-- =====================================================

INSERT INTO public.branches (id, tenant_id, name, slug, address, phone, kitchen_latitude, kitchen_longitude, status, is_active, sort_order)
VALUES
  ('branch-bkk-central', 'tenant-bmb-001', 'BMB Central (สาขาหลัก)', 'bkk-central', 
   '123 Silom Road, Bang Rak, Bangkok 10500', '02-xxx-xxxx', 13.7273, 100.5340, 'active', true, 1),
  ('branch-bkk-south', 'tenant-bmb-001', 'BMB South (สาขาย่อย)', 'bkk-south',
   '456 Rama IV Road, Pathumwan, Bangkok 10330', '02-xxx-xxxx', 13.7367, 100.5232, 'active', false, 2)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.branches IS 'TEN-07: Multi-branch operational units';


-- =====================================================
-- SECTION 2: Delivery Rounds (M082 + M025)
-- For BKK Central - Tomorrow's schedule
-- =====================================================

DO Part 1 written
DECLARE
  v_tomorrows_date text := (CURRENT_DATE + INTERVAL '1 day')::text;
  v_round_key text;
  v_round_id text;
BEGIN
  -- Morning Round (06:00-09:00)
  v_round_id := 'round-' || replace(v_tomorrows_date, '-', '') || '-morning';
  IF NOT EXISTS (SELECT 1 FROM public.delivery_rounds WHERE id = v_round_id) THEN
    INSERT INTO public.delivery_rounds (id, round_key, display_name, cutoff_time, delivery_start, delivery_end, max_capacity, current_count, date, scheduled_date, name, status, branch_id)
    VALUES (v_round_id, 'morning', 'เช้า (06:00-09:00)', '08:00', '06:00', '09:00', 60, 0, v_tomorrows_date, v_tomorrows_date, 'morning', 'active', 'branch-bkk-central');
  END IF;

  -- Midday Round (11:00-14:00)
  v_round_id := 'round-' || replace(v_tomorrows_date, '-', '') || '-midday';
  IF NOT EXISTS (SELECT 1 FROM public.delivery_rounds WHERE id = v_round_id) THEN
    INSERT INTO public.delivery_rounds (id, round_key, display_name, cutoff_time, delivery_start, delivery_end, max_capacity, current_count, date, scheduled_date, name, status, branch_id)
    VALUES (v_round_id, 'midday', 'เที่ยง (11:00-14:00)', '10:30', '11:00', '14:00', 80, 0, v_tomorrows_date, v_tomorrows_date, 'midday', 'active', 'branch-bkk-central');
  END IF;

  -- Evening Round (17:00-20:00)
  v_round_id := 'round-' || replace(v_tomorrows_date, '-', '') || '-evening';
  IF NOT EXISTS (SELECT 1 FROM public.delivery_rounds WHERE id = v_round_id) THEN
    INSERT INTO public.delivery_rounds (id, round_key, display_name, cutoff_time, delivery_start, delivery_end, max_capacity, current_count, date, scheduled_date, name, status, branch_id)
    VALUES (v_round_id, 'evening', 'เยน (17:00-20:00)', '16:00', '17:00', '20:00', 100, 0, v_tomorrows_date, v_tomorrows_date, 'evening', 'active', 'branch-bkk-central');
  END IF;

  RAISE NOTICE 'Seeded 3 delivery rounds for % at branch-bkk-central', v_tomorrows_date;
END Part 1 written;


-- =====================================================
-- SECTION 3: Delivery Zones (M083)
-- For BKK Central - Service coverage areas
-- =====================================================

INSERT INTO public.delivery_zones (id, branch_id, name, min_order, delivery_fee, estimated_minutes, latitude, longitude, radius_km, status, is_default)
VALUES
  ('zone-central-srilom', 'branch-bkk-central', 'Sri Salaem / Silom (0-3km)', 50.00, 35.00, 30, 13.7273, 100.5340, 3.0, 'active', true),
  ('zone-central-pathumwan', 'branch-bkk-central', 'Pathumwan / Ratchaprarop (3-6km)', 50.00, 55.00, 45, 13.7367, 100.5232, 6.0, 'active', false),
  ('zone-central-thonglor', 'branch-bkk-central', 'Thonglor / Ekamai (6-10km)', 80.00, 85.00, 60, 13.7338, 100.5828, 10.0, 'active', false)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.delivery_zones IS 'M083: Branch-level delivery zone definitions';

-- =====================================================
-- SECTION 4: Business Settings (M086)
-- Default settings for BKK Central
-- =====================================================

INSERT INTO public.business_settings (id, tenant_id, brand_id, branch_id, key_name, key_value, updated_at)
VALUES
  ('setting-bkk-central-hours-start', 'tenant-bmb-001', 'brand-bmb-main', 'branch-bkk-central', 'operating_hours_start', '06:00', NOW()),
  ('setting-bkk-central-hours-end', 'tenant-bmb-001', 'brand-bmb-main', 'branch-bkk-central', 'operating_hours_end', '22:00', NOW()),
  ('setting-bkk-central-prep', 'tenant-bmb-001', 'brand-bmb-main', 'branch-bkk-central', 'kitchen_prep_buffer_min', '15', NOW()),
  ('setting-bkk-central-max-orders', 'tenant-bmb-001', 'brand-bmb-main', 'branch-bkk-central', 'max_orders_per_round', '200', NOW())
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.business_settings IS 'M086: Branch-specific business settings';


-- =====================================================
-- VERIFICATION CHECKS
-- =====================================================

DO } DECLARE v_branch_count int; v_round_count int; v_zone_count int; BEGIN
  SELECT count(*) INTO v_branch_count FROM public.branches WHERE tenant_id = 'tenant-bmb-001' AND status = 'active';
  SELECT count(*) INTO v_round_count FROM public.delivery_rounds WHERE status = 'active' AND branch_id = 'branch-bkk-central';
  SELECT count(*) INTO v_zone_count FROM public.delivery_zones WHERE branch_id = 'branch-bkk-central' AND status = 'active';
  
  IF v_branch_count < 1 THEN
    RAISE EXCEPTION 'ERR_SEED: Expected ≥1 active branches for tenant-bmb-001, found %', v_branch_count;
  END IF;
  IF v_round_count < 3 THEN
    RAISE EXCEPTION 'ERR_SEED: Expected ≥3 active rounds for branch-bkk-central, found %', v_round_count;
  END IF;
  IF v_zone_count < 1 THEN
    RAISE EXCEPTION 'ERR_SEED: Expected ≥1 active zones for branch-bkk-central, found %', v_zone_count;
  END IF;
  
  RAISE NOTICE 'Validation passed: % branches, % rounds, % zones', v_branch_count, v_round_count, v_zone_count;
END };

COMMIT;

