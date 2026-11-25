// ============================================
// Bite Me Baby — R181/R186 source-contract test (Migration 181: Add-on Margin Rules, 186: Promotion BKK Date Gate)
// ตรวจสอบ migration 181 มี:
// 1. business_settings.addon_margin_policy feature flags
// 2. addon_margin_setting helper function
// 3. compute_addons_price ใช้ promo_price เมื่อแอดมินตั้ง
// 4. promotion_apply_rules ใช้ max_discount_pct จาก policy (ไม่ hardcode 15%)
// ตรวจสอบ migration 186 มี:
// 1. promotion_apply_rules ใช้ (now() AT TIME ZONE 'Asia/Bangkok')::date
// 2. create_order_with_items ใช้ v_today = (now() AT TIME ZONE 'Asia/Bangkok')::date
// 3. ทุก date comparison ใช้ BKK time zone
// ============================================

import { describe, it, expect } from 'vitest'
import mig181Src from '../../supabase/migrations/181_addon_margin_rules.sql?raw'
import mig186Src from '../../supabase/migrations/186_promotion_date_bkk.sql?raw'

describe('R181/R186 — Migration 181: Add-on Margin Rules + 186: Promotion BKK Date Gate', () => {
  // ============================================
  // A — Migration 181: Add-on Margin Rules
  // ============================================
  describe('Migration 181: Add-on Margin Rules (R49)', () => {
    it('มี business_settings.addon_margin_policy DO block INSERT IF NOT EXISTS', () => {
      expect(mig181Src).toContain('DO $$ BEGIN')
      expect(mig181Src).toContain("IF NOT EXISTS (SELECT 1 FROM public.business_settings WHERE key = 'addon_margin_policy') THEN")
      expect(mig181Src).toContain("INSERT INTO public.business_settings (key, value)")
      expect(mig181Src).toContain("VALUES ('addon_margin_policy'")
    })

    it('ค่าเริ่มต้น: enabled=true, max_discount_pct=15, min_addon_margin_pct=0, main_dish_required=false, cross_sell_enabled=true', () => {
      expect(mig181Src).toContain('"enabled": true')
      expect(mig181Src).toContain('"max_discount_pct": 15')
      expect(mig181Src).toContain('"min_addon_margin_pct": 0')
      expect(mig181Src).toContain('"main_dish_required": false')
      expect(mig181Src).toContain('"cross_sell_enabled": true')
    })

    it('มี addon_margin_setting(text, numeric) helper function RETURNS numeric', () => {
      expect(mig181Src).toContain('CREATE OR REPLACE FUNCTION public.addon_margin_setting(p_field text, p_default numeric)')
      expect(mig181Src).toContain('RETURNS numeric')
      expect(mig181Src).toContain('LANGUAGE sql')
      expect(mig181Src).toContain('STABLE')
      expect(mig181Src).toContain('SECURITY DEFINER')
      expect(mig181Src).toContain('SET search_path = public')
    })

    it('addon_margin_setting อ่านค่าจาก business_settings.value ->> p_field ::numeric มี COALESCE fallback p_default', () => {
      expect(mig181Src).toMatch(/SELECT COALESCE\([\s\S]*?\(SELECT \(value ->> p_field\)::numeric[\s\S]*?FROM public\.business_settings[\s\S]*?WHERE key = 'addon_margin_policy'[\s\S]*?p_default\)/)
    })

    it('addon_margin_setting GRANT: REVOKE PUBLIC + GRANT TO PUBLIC, authenticated, service_role', () => {
      expect(mig181Src).toContain('REVOKE ALL ON FUNCTION public.addon_margin_setting(text, numeric) FROM PUBLIC')
      expect(mig181Src).toContain('GRANT EXECUTE ON FUNCTION public.addon_margin_setting(text, numeric) TO PUBLIC, authenticated, service_role')
    })

    it('compute_addons_price ใช้ promo_price เมื่อ > 0 มิฉะนั้น price (R49)', () => {
      expect(mig181Src).toContain('CREATE OR REPLACE FUNCTION public.compute_addons_price(p_product_id text, p_options jsonb)')
      expect(mig181Src).toMatch(/v_price := COALESCE\(NULLIF\(\(v_addon->>'promo_price'\)::numeric, 0\), COALESCE\(\(v_addon->>'price'\)::numeric, 0\)\)/)
    })

it('promotion_apply_rules ใช้ max_discount_pct จาก addon_margin_setting (ไม่ hardcode 0.15)', () => {
      // หา promotion_apply_rules definition
      expect(mig181Src).toContain('CREATE OR REPLACE FUNCTION public.promotion_apply_rules(p_promo_id text, p_subtotal numeric, p_eligible numeric)')
      // ตรวจสอบการเรียก addon_margin_setting
      expect(mig181Src).toContain("v_cap_pct := COALESCE(public.addon_margin_setting('max_discount_pct', 15), 15)")
      // ตรวจสอบใช้ v_cap_pct แทน hardcode 0.15
      expect(mig181Src).toMatch(/v_disc := LEAST\(v_disc, ROUND\(v_sub \* \(GREATEST\(0, LEAST\(v_cap_pct, 90\)\) \/ 100\), 2\)\)/)
      // ไม่มี hardcode 0.15 ในโค้ดจริง (เฉพาะ comment อาจมี) — ตรวจเฉพาะใน function body
      const fnBodyMatch = mig181Src.match(/CREATE OR REPLACE FUNCTION public\.promotion_apply_rules\([\s\S]*?\$\$/)
      const fnBody = fnBodyMatch ? fnBodyMatch[0] : ''
      // ใน function body ไม่ควรมี 0.15 หรือ 15/100 เป็นตัวเลข hardcode
      expect(fnBody).not.toMatch(/[^0-9.]0\.15[^0-9.]/)
      expect(fnBody).not.toContain('15/100')
    })

    it('promotion_apply_rules มี validation ครบ: v_sub <= 0, p_promo_id null, promotions_enabled, min_order_amount, discount_type, max_discount_amount, budget, usage_limit', () => {
      expect(mig181Src).toContain('IF v_sub <= 0 THEN RETURN 0; END IF;')
      expect(mig181Src).toContain("IF p_promo_id IS NULL OR btrim(p_promo_id) = '' THEN RETURN 0; END IF;")
      expect(mig181Src).toContain('IF NOT public.promotions_enabled() THEN RETURN 0; END IF;')
      expect(mig181Src).toContain('IF v_sub < COALESCE(v_promo.min_order_amount, 0) THEN RETURN 0; END IF;')
      expect(mig181Src).toContain("IF v_promo.discount_type = 'percentage' THEN")
      expect(mig181Src).toContain("ELSIF v_promo.discount_type = 'fixed_amount' THEN")
      expect(mig181Src).toContain('IF v_promo.max_discount_amount IS NOT NULL THEN')
      expect(mig181Src).toContain('v_state := public.promotion_budget_state();')
      expect(mig181Src).toContain('IF v_promo.usage_limit IS NOT NULL THEN')
    })

    it('promotion_apply_rules มี EXCEPTION WHEN OTHERS RETURN 0 (fail-safe)', () => {
      expect(mig181Src).toContain('EXCEPTION WHEN OTHERS THEN')
      expect(mig181Src).toContain('RETURN 0;')
    })
  })

  // ============================================
  // B — Migration 186: Promotion BKK Date Gate
  // ============================================
  describe('Migration 186: Promotion BKK Date Gate (R48/R49)', () => {
    it('มี BEGIN/COMMIT transaction wrapper', () => {
      expect(mig186Src).toContain('BEGIN;')
      expect(mig186Src).toContain('COMMIT;')
    })

    it('promotion_apply_rules ใช้ (now() AT TIME ZONE \'Asia/Bangkok\')::date สำหรับ start_date/end_date', () => {
      expect(mig186Src).toContain('CREATE OR REPLACE FUNCTION public.promotion_apply_rules(p_promo_id text, p_subtotal numeric, p_eligible numeric)')
      expect(mig186Src).toMatch(/start_date <= \(now\(\) AT TIME ZONE 'Asia\/Bangkok'\)::date/)
      expect(mig186Src).toMatch(/end_date\s{3}>= \(now\(\) AT TIME ZONE 'Asia\/Bangkok'\)::date/)
    })

    it('promotion_apply_rules ยังคง logic ครบจาก 181: addon_margin_setting, budget, usage_limit, EXCEPTION', () => {
      expect(mig186Src).toContain("v_cap_pct := COALESCE(public.addon_margin_setting('max_discount_pct', 15), 15)")
      expect(mig186Src).toContain('v_state := public.promotion_budget_state();')
      expect(mig186Src).toContain('IF v_promo.usage_limit IS NOT NULL THEN')
      expect(mig186Src).toContain('EXCEPTION WHEN OTHERS THEN')
      expect(mig186Src).toContain('RETURN 0;')
    })

    it('create_order_with_items ใช้ v_today = (now() AT TIME ZONE \'Asia/Bangkok\')::date', () => {
      expect(mig186Src).toContain('CREATE OR REPLACE FUNCTION public.create_order_with_items(')
      expect(mig186Src).toMatch(/v_today date := \(now\(\) AT TIME ZONE 'Asia\/Bangkok'\)::date;/)
    })

    it('create_order_with_items SAME_DAY ใช้ v_round_date <> v_today (BKK date)', () => {
      expect(mig186Src).toMatch(/IF v_mode = 'SAME_DAY' THEN[\s\S]*?IF v_round_date IS NULL OR v_round_date <> v_today THEN RAISE EXCEPTION 'ERR_ROUND_DATE'/)
    })

    it('create_order_with_items PRE_ORDER ใช้ v_today สำหรับ p_scheduled_date < v_today', () => {
      expect(mig186Src).toMatch(/IF p_scheduled_date IS NULL THEN RAISE EXCEPTION 'ERR_MISSING_SCHEDULED_DATE'[\s\S]*?IF p_scheduled_date < v_today THEN RAISE EXCEPTION 'ERR_SCHEDULED_DATE_INVALID'/)
    })

    it('create_order_with_items PRE_ORDER cutoff ใช้ (now() at time zone \'Asia/Bangkok\')', () => {
      expect(mig186Src).toMatch(/IF \(now\(\) at time zone 'Asia\/Bangkok'\) > \(p_scheduled_date \+ v_pre_order_cutoff\) THEN/)
    })

    it('create_order_with_items promotion code date window ใช้ BKK date', () => {
      expect(mig186Src).toMatch(/start_date IS NULL OR start_date <= \(now\(\) AT TIME ZONE 'Asia\/Bangkok'\)::date/)
      expect(mig186Src).toMatch(/end_date\s{3}IS NULL OR end_date >= \(now\(\) AT TIME ZONE 'Asia\/Bangkok'\)::date/)
    })

    it('มี DO block verification: to_regprocedure promotion_apply_rules + RAISE NOTICE 186 PASS', () => {
      expect(mig186Src).toContain("DO $$ BEGIN")
      expect(mig186Src).toContain("to_regprocedure('public.promotion_apply_rules(text,numeric,numeric)') IS NULL")
      expect(mig186Src).toContain("RAISE EXCEPTION '186 FAIL: promotion_apply_rules missing'")
      expect(mig186Src).toContain("RAISE NOTICE '186 PASS: BKK date gate applied'")
    })

    it('ไม่มี CURRENT_DATE ใน date comparison (ต้องใช้ BKK date ทุกที่)', () => {
      // นับจำนวน CURRENT_DATE ในฟังก์ชันสำคัญ
      const promoApplyMatch = mig186Src.match(/CREATE OR REPLACE FUNCTION public\.promotion_apply_rules\([\s\S]*?\$\$/)
      const createOrderMatch = mig186Src.match(/CREATE OR REPLACE FUNCTION public\.create_order_with_items\([\s\S]*?\$function\$/)
      
      expect(promoApplyMatch).not.toBeNull()
      expect(createOrderMatch).not.toBeNull()
      
      if (promoApplyMatch && createOrderMatch) {
        // promotion_apply_rules ไม่ควรมี CURRENT_DATE
        expect(promoApplyMatch[0]).not.toContain('CURRENT_DATE')
        // create_order_with_items ไม่ควรมี CURRENT_DATE (ใช้ v_today แทน)
        expect(createOrderMatch[0]).not.toContain('CURRENT_DATE')
      }
    })
  })

  // ============================================
  // C — Additive/Idempotent checks
  // ============================================
  describe('Additive/Idempotent — ไม่มี DROP TABLE/COLUMN, CREATE OR REPLACE ครบ', () => {
    it('Migration 181: ไม่มี DROP TABLE/DROP COLUMN, มี CREATE OR REPLACE ทุกฟังก์ชัน', () => {
      expect(mig181Src).not.toContain('DROP TABLE')
      expect(mig181Src).not.toContain('DROP COLUMN')
      expect(mig181Src).toContain('CREATE OR REPLACE FUNCTION public.addon_margin_setting')
      expect(mig181Src).toContain('CREATE OR REPLACE FUNCTION public.compute_addons_price')
      expect(mig181Src).toContain('CREATE OR REPLACE FUNCTION public.promotion_apply_rules')
    })

    it('Migration 186: ไม่มี DROP TABLE/DROP COLUMN, มี CREATE OR REPLACE ทุกฟังก์ชัน', () => {
      expect(mig186Src).not.toContain('DROP TABLE')
      expect(mig186Src).not.toContain('DROP COLUMN')
      expect(mig186Src).toContain('CREATE OR REPLACE FUNCTION public.promotion_apply_rules')
      expect(mig186Src).toContain('CREATE OR REPLACE FUNCTION public.create_order_with_items')
    })

    it('Migration 186: มี DO block verification probe ฟังก์ชัน', () => {
      expect(mig186Src).toContain("to_regprocedure('public.promotion_apply_rules(text,numeric,numeric)')")
    })
  })
})