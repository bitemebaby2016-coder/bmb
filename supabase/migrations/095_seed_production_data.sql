-- ============================================
-- Bite Me Baby -- Production Seed: Day-1 Launch Data
-- Date: 2026-09-30 Baseline: M081-M094 deployed
-- Scope: Branches (idempotent), Delivery Rounds, Zones
-- Safe to re-run any number of times
-- ============================================

BEGIN;

-- SECTION 1: Branches (M081 schema) — ON CONFLICT (id) DO NOTHING
INSERT INTO public.branches (id, tenant_id, code, name, slug, address_line1, city, province, country, latitude, longitude, kitchen_latitude, kitchen_longitude, service_radius_km, status, is_default)
VALUES ('branch-bkk-central', 'tenant-bmb-001', 'main', 'BMB Central (สาขาหลัก)', 'main', '123 Silom Road, Bang Rak', 'Bangkok', 'Bangkok', 'TH', 13.7273, 100.5340, 13.7273, 100.5340, 10.00, 'active', true) ON CONFLICT (tenant_id, code) DO NOTHING;

-- SECTION 2: Delivery Rounds tomorrow schedule (M082+M025)
DO $$
DECLARE
  v_date date := CURRENT_DATE + 1;
  v_bid text;
BEGIN
  SELECT id INTO v_bid FROM public.branches WHERE tenant_id = 'tenant-bmb-001' AND is_default = true LIMIT 1;
  IF v_bid IS NULL THEN
    SELECT id INTO v_bid FROM public.branches WHERE tenant_id = 'tenant-bmb-001' ORDER BY sort_order NULLS FIRST LIMIT 1;
  END IF;
  IF v_bid IS NULL THEN v_bid := 'branch-bkk-central'; END IF;

  INSERT INTO public.delivery_rounds (id, round_key, display_name, cutoff_time, delivery_start, delivery_end, max_capacity, current_count, date, scheduled_date, name, status, branch_id, tenant_id)
    VALUES ('round-' || replace(v_date::text,'-','') || '-morning', 'morning', 'เช้า (06:00-09:00)', '08:00', '06:00', '09:00', 60, 0, v_date, v_date, 'morning', 'active', v_bid, 'tenant-bmb-001')
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.delivery_rounds (id, round_key, display_name, cutoff_time, delivery_start, delivery_end, max_capacity, current_count, date, scheduled_date, name, status, branch_id, tenant_id)
    VALUES ('round-' || replace(v_date::text,'-','') || '-midday', 'midday', 'เที่ยง (11:00-14:00)', '10:30', '11:00', '14:00', 80, 0, v_date, v_date, 'midday', 'active', v_bid, 'tenant-bmb-001')
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.delivery_rounds (id, round_key, display_name, cutoff_time, delivery_start, delivery_end, max_capacity, current_count, date, scheduled_date, name, status, branch_id, tenant_id)
    VALUES ('round-' || replace(v_date::text,'-','') || '-evening', 'evening', 'เย็น (17:00-20:00)', '16:00', '17:00', '20:00', 100, 0, v_date, v_date, 'evening', 'active', v_bid, 'tenant-bmb-001')
    ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Delivery rounds for % inserted/ignored, branch=%', v_date, v_bid;
END $$;

-- SECTION 3: Delivery Zones (M008+M083 schema)
DO $$ DECLARE v_bid text; BEGIN
  SELECT id INTO v_bid FROM public.branches WHERE tenant_id = 'tenant-bmb-001' AND is_default = true LIMIT 1;
  IF v_bid IS NULL THEN v_bid := 'branch-bkk-central'; END IF;

  INSERT INTO public.delivery_zones (id, name, min_distance_km, max_distance_km, fee, is_active, tenant_id, branch_id)
  VALUES
    ('zone-central-srilom',   'โซนใกล้ครัว ศรีโลม (0-3 กม.)',      0.00, 3.00, 35.00, true, 'tenant-bmb-001', v_bid),
    ('zone-central-pathumwan','โซนปทุมวัน / ราชปรารภ (3-6 กม.)',   3.00, 6.00, 55.00, true, 'tenant-bmb-001', v_bid),
    ('zone-central-thonglor', 'โซนทองหล่อ / เอกมัย (6-10 กม.)',    6.00, 10.00, 85.00, true, 'tenant-bmb-001', v_bid)
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Zones seeded for branch=%', v_bid;
END $$;

-- SECTION 4: Verification
DO $$ DECLARE
  v_bc int := 0; v_rc int := 0; v_zc int := 0; v_bid text;
BEGIN
  SELECT id INTO v_bid FROM public.branches WHERE tenant_id='tenant-bmb-001' AND is_default=true LIMIT 1;
  IF v_bid IS NULL THEN
    SELECT id INTO v_bid FROM public.branches WHERE tenant_id='tenant-bmb-001' LIMIT 1;
  END IF;
  IF v_bid IS NULL THEN
    RAISE EXCEPTION 'ERR_SEED: No branch found for tenant-bmb-001';
  END IF;
  SELECT count(*) INTO v_bc FROM public.branches WHERE tenant_id='tenant-bmb-001' AND status='active';
  SELECT count(*) INTO v_rc FROM public.delivery_rounds WHERE status='active';
  SELECT count(*) INTO v_zc FROM public.delivery_zones WHERE is_active=true;
  RAISE NOTICE 'Validation passed: branches=%, rounds=%, zones=% | main_branch=%', v_bc, v_rc, v_zc, v_bid;
END $$;

COMMIT;
